import type { PlayerState, ProviderId } from './types';

export type PlayerAction =
  | { type: 'switch-provider'; providerId: ProviderId }
  | { type: 'select-track'; trackId: string }
  | { type: 'set-expanded'; expanded: boolean }
  | { type: 'set-volume'; volume: number }
  | { type: 'set-progress'; progressMs: number }
  | { type: 'set-playback'; playback: PlayerState['playback'] }
  | { type: 'set-error'; message: string };

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function createDefaultPlayerState(): PlayerState {
  return {
    providerId: 'spotify',
    currentTrackId: undefined,
    expanded: false,
    volume: 0.8,
    progressMs: 0,
    playback: 'idle',
    errorMessage: undefined,
  };
}

export function restorePlayerState(serialized: string | null): PlayerState {
  const defaults = createDefaultPlayerState();
  if (!serialized) return defaults;

  try {
    const saved = JSON.parse(serialized) as Partial<PlayerState>;
    return {
      providerId: saved.providerId === 'qishui' ? 'qishui' : 'spotify',
      currentTrackId:
        typeof saved.currentTrackId === 'string' ? saved.currentTrackId : undefined,
      expanded: saved.expanded === true,
      volume: clamp(typeof saved.volume === 'number' ? saved.volume : defaults.volume, 0, 1),
      progressMs: Math.max(0, Number(saved.progressMs) || 0),
      playback: saved.playback === 'idle' ? 'idle' : 'paused',
      errorMessage: undefined,
    };
  } catch {
    return defaults;
  }
}

export function reducePlayerState(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'switch-provider':
      return {
        ...state,
        providerId: action.providerId,
        currentTrackId: undefined,
        progressMs: 0,
        playback: 'paused',
        errorMessage: undefined,
      };
    case 'select-track':
      return { ...state, currentTrackId: action.trackId, progressMs: 0, errorMessage: undefined };
    case 'set-expanded':
      return { ...state, expanded: action.expanded };
    case 'set-volume':
      return { ...state, volume: clamp(action.volume, 0, 1) };
    case 'set-progress':
      return { ...state, progressMs: Math.max(0, action.progressMs) };
    case 'set-playback':
      return { ...state, playback: action.playback, errorMessage: undefined };
    case 'set-error':
      return { ...state, playback: 'error', errorMessage: action.message };
  }
}
