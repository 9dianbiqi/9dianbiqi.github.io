import type { MusicTrack, SpotifyCatalog } from './types';

const SESSION_KEY = 'music-player.spotify-session.v1';
const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): unknown;
  removeItem(key: string): unknown;
}

const memoryStorage = new Map<string, string>();
const fallbackStorage: StorageLike = {
  getItem: (key) => memoryStorage.get(key) ?? null,
  setItem: (key, value) => memoryStorage.set(key, value),
  removeItem: (key) => memoryStorage.delete(key),
};

type SpotifyListener = (payload: any) => void;

export interface SpotifyPlayerLike {
  addListener(name: string, listener: SpotifyListener): unknown;
  connect(): Promise<boolean>;
  disconnect(): unknown;
  pause(): Promise<void> | void;
  resume(): Promise<void> | void;
  previousTrack(): Promise<void> | void;
  nextTrack(): Promise<void> | void;
  seek(positionMs: number): Promise<void> | void;
  setVolume(volume: number): Promise<void> | void;
}

export interface SpotifyPlaybackState {
  paused: boolean;
  position: number;
  duration: number;
  track?: MusicTrack;
}

type PlayerFactory = (
  getOAuthToken: () => Promise<string>,
  onState: (state: SpotifyPlaybackState) => void,
) => Promise<SpotifyPlayerLike>;

interface SpotifyProviderOptions {
  workerBaseUrl: string;
  fetchImpl?: typeof fetch;
  sessionStorage?: StorageLike;
  playerFactory?: PlayerFactory;
  onState?: (state: SpotifyPlaybackState) => void;
  onError?: (message: string) => void;
}

export class SpotifyProvider {
  readonly workerBaseUrl: string;
  unavailable = false;
  private fetchImpl: typeof fetch;
  private sessionStorage: StorageLike;
  private playerFactory: PlayerFactory;
  private player?: SpotifyPlayerLike;
  private deviceId?: string;
  private accessToken?: { value: string; expiresAt: number };
  private onState: (state: SpotifyPlaybackState) => void;
  private onError: (message: string) => void;

  constructor(options: SpotifyProviderOptions) {
    this.workerBaseUrl = options.workerBaseUrl.replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sessionStorage =
      options.sessionStorage ?? (typeof localStorage === 'undefined' ? fallbackStorage : localStorage);
    this.playerFactory = options.playerFactory ?? createBrowserSpotifyPlayer;
    this.onState = options.onState ?? (() => undefined);
    this.onError = options.onError ?? (() => undefined);
  }

  get authenticated() {
    return Boolean(this.sessionStorage.getItem(SESSION_KEY));
  }

  async loadCatalog(): Promise<SpotifyCatalog> {
    const response = await this.fetchImpl(`${this.workerBaseUrl}/catalog/spotify`, {
      headers: { Accept: 'application/json' },
    });
    const body = await this.readResponse<Partial<SpotifyCatalog>>(response);
    this.unavailable = false;
    return this.normalizeCatalog(body);
  }

  async refreshCatalog(): Promise<SpotifyCatalog> {
    const sessionToken = this.sessionStorage.getItem(SESSION_KEY);
    if (!sessionToken) throw new Error('Spotify owner session is required');
    const response = await this.fetchImpl(`${this.workerBaseUrl}/catalog/spotify/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, Accept: 'application/json' },
    });
    const body = await this.readResponse<Partial<SpotifyCatalog>>(response);
    this.unavailable = false;
    return this.normalizeCatalog(body);
  }

  private normalizeCatalog(body: Partial<SpotifyCatalog>): SpotifyCatalog {
    return {
      generatedAt: typeof body.generatedAt === 'string' ? body.generatedAt : null,
      playlistUrl: typeof body.playlistUrl === 'string' ? body.playlistUrl : '',
      tracks: Array.isArray(body.tracks)
        ? body.tracks.map((track) => ({ ...track, provider: 'spotify' as const }))
        : [],
    };
  }

  async exchangeSessionCode(code: string) {
    const response = await this.fetchImpl(`${this.workerBaseUrl}/auth/session/exchange`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ code }),
    });
    const body = await this.readResponse<{ sessionToken: string }>(response);
    if (!body.sessionToken) throw new Error('Spotify session exchange returned no token');
    this.sessionStorage.setItem(SESSION_KEY, body.sessionToken);
    this.unavailable = false;
  }

  async logout() {
    const token = this.sessionStorage.getItem(SESSION_KEY);
    if (token) {
      await this.fetchImpl(`${this.workerBaseUrl}/auth/session`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    this.player?.disconnect();
    this.player = undefined;
    this.deviceId = undefined;
    this.accessToken = undefined;
    this.sessionStorage.removeItem(SESSION_KEY);
  }

  async play(track: MusicTrack) {
    if (!track.spotifyUri) throw new Error('Spotify track has no URI');
    await this.ensurePlayer();
    const token = await this.getAccessToken();
    const response = await this.fetchImpl(
      `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(this.deviceId!)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ uris: [track.spotifyUri] }),
      },
    );
    if (!response.ok) await this.readResponse(response);
    this.unavailable = false;
  }

  async pause() {
    await this.player?.pause();
  }

  async resume() {
    await this.player?.resume();
  }

  async previous() {
    await this.player?.previousTrack();
  }

  async next() {
    await this.player?.nextTrack();
  }

  async seek(positionMs: number) {
    await this.player?.seek(positionMs);
  }

  async setVolume(volume: number) {
    await this.player?.setVolume(Math.min(1, Math.max(0, volume)));
  }

  private async ensurePlayer() {
    if (this.player && this.deviceId) return;
    if (!this.authenticated) throw new Error('Spotify owner session is required');
    const player = await this.playerFactory(() => this.getAccessToken(), this.onState);
    this.player = player;
    const ready = new Promise<void>((resolve, reject) => {
      player.addListener('ready', ({ device_id }: { device_id: string }) => {
        this.deviceId = device_id;
        resolve();
      });
      for (const name of ['initialization_error', 'authentication_error', 'account_error', 'playback_error']) {
        player.addListener(name, ({ message }: { message: string }) => {
          this.unavailable = true;
          this.onError(message);
          reject(new Error(message));
        });
      }
    });
    if (!(await player.connect())) throw new Error('Spotify SDK could not connect');
    await ready;
  }

  private async getAccessToken() {
    if (this.accessToken && Date.now() < this.accessToken.expiresAt - 30_000) {
      return this.accessToken.value;
    }
    const sessionToken = this.sessionStorage.getItem(SESSION_KEY);
    if (!sessionToken) throw new Error('Spotify owner session is required');
    const response = await this.fetchImpl(`${this.workerBaseUrl}/auth/session/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, Accept: 'application/json' },
    });
    const body = await this.readResponse<{ accessToken: string; expiresAt?: string }>(response);
    const expiresAt = body.expiresAt ? Date.parse(body.expiresAt) : Date.now() + 55 * 60_000;
    this.accessToken = { value: body.accessToken, expiresAt };
    return body.accessToken;
  }

  private async readResponse<T = unknown>(response: Response): Promise<T> {
    const body = response.headers.get('content-type')?.includes('application/json')
      ? await response.json()
      : undefined;
    if (!response.ok) {
      this.unavailable = true;
      if (response.status === 401) this.sessionStorage.removeItem(SESSION_KEY);
      throw new Error(`Spotify request failed (${response.status})`);
    }
    return body as T;
  }
}

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken(callback: (token: string) => void): void;
        volume: number;
        enableMediaSession: boolean;
      }) => SpotifyPlayerLike;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

let sdkPromise: Promise<void> | undefined;

function loadSpotifySdk() {
  if (window.Spotify) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = resolve;
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.addEventListener('error', () => reject(new Error('Spotify SDK failed to load')));
    document.head.append(script);
  });
  return sdkPromise;
}

async function createBrowserSpotifyPlayer(
  getOAuthToken: () => Promise<string>,
  onState: (state: SpotifyPlaybackState) => void,
) {
  await loadSpotifySdk();
  const player = new window.Spotify!.Player({
    name: '9dianbiqi Blog Player',
    getOAuthToken: (callback) => void getOAuthToken().then(callback),
    volume: 0.8,
    enableMediaSession: true,
  });
  player.addListener('player_state_changed', (state: any) => {
    if (!state) return;
    const current = state.track_window?.current_track;
    onState({
      paused: Boolean(state.paused),
      position: Number(state.position) || 0,
      duration: Number(state.duration) || 0,
      track: current
        ? {
            id: current.id,
            provider: 'spotify',
            title: current.name,
            artist: current.artists?.map((artist: { name: string }) => artist.name).join(', ') ?? '',
            coverUrl: current.album?.images?.[0]?.url ?? '',
            externalUrl: `https://open.spotify.com/track/${current.id}`,
            spotifyUri: current.uri,
            durationMs: current.duration_ms,
          }
        : undefined,
    });
  });
  return player;
}
