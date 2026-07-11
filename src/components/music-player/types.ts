export type ProviderId = 'spotify' | 'qishui';

export interface MusicTrack {
  id: string;
  provider: ProviderId;
  title: string;
  artist: string;
  coverUrl: string;
  externalUrl: string;
  durationMs?: number;
  spotifyUri?: string;
}

export interface ProviderCapabilities {
  inlinePlayback: boolean;
  seek: boolean;
  volume: boolean;
  previousNext: boolean;
  externalOpen: boolean;
}

export interface QishuiTrackConfig extends Omit<MusicTrack, 'provider'> {}

export interface SpotifyCatalog {
  generatedAt: string | null;
  playlistUrl: string;
  tracks: MusicTrack[];
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
  workerBaseUrl: string;
  qishuiTracks: QishuiTrackConfig[];
  defaultProvider?: ProviderId;
  controls?: {
    previous?: boolean;
    next?: boolean;
    volume?: boolean;
  };
}
