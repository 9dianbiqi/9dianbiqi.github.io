import type { ProviderCapabilities } from './types';

export const SPOTIFY_CAPABILITIES: ProviderCapabilities = {
  inlinePlayback: true,
  seek: false,
  volume: false,
  previousNext: false,
  externalOpen: true,
};

export const QISHUI_CAPABILITIES: ProviderCapabilities = {
  inlinePlayback: false,
  seek: false,
  volume: false,
  previousNext: false,
  externalOpen: true,
};
