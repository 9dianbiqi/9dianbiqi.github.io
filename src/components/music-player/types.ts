export type ProviderId = 'spotify' | 'qishui';

export interface MusicTrack {
  id: string;
  provider: ProviderId;
  title: string;
  artist: string;
  coverUrl: string;
  externalUrl: string;
  durationMs?: number;
}

export interface ProviderCapabilities {
  inlinePlayback: boolean;
  seek: boolean;
  volume: boolean;
  previousNext: boolean;
  externalOpen: boolean;
}

export interface QishuiTrackConfig extends Omit<MusicTrack, 'provider'> {}

export interface SpotifyEmbedConfig {
  playlistUrl: string;
  title?: string;
}

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface PlayerState {
  providerId: ProviderId;
  currentTrackId?: string;
  expanded: boolean;
  volume: number;
  progressMs: number;
  playback: PlaybackStatus;
  errorMessage?: string;
}

export interface MusicPlayerConfig {
  spotify: SpotifyEmbedConfig;
  qishuiTracks: QishuiTrackConfig[];
  defaultProvider?: ProviderId;
}
