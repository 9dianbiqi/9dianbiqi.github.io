import type { ProviderCapabilities } from './types';

export const SPOTIFY_CAPABILITIES: ProviderCapabilities = {
  inlinePlayback: true,
  seek: true,
  volume: true,
  previousNext: true,
  externalOpen: true,
};

export const QISHUI_CAPABILITIES: ProviderCapabilities = {
  inlinePlayback: false,
  seek: false,
  volume: false,
  previousNext: false,
  externalOpen: true,
};

export type PrimaryAction = 'inline-play' | 'open-external';

export function getPrimaryAction(
  capabilities: ProviderCapabilities,
  authenticated: boolean,
  unavailable: boolean,
): PrimaryAction {
  return capabilities.inlinePlayback && authenticated && !unavailable
    ? 'inline-play'
    : 'open-external';
}
