import { describe, expect, it } from 'vitest';
import {
  QISHUI_CAPABILITIES,
  SPOTIFY_CAPABILITIES,
  getPrimaryAction,
} from './providers';
import { createDefaultPlayerState, reducePlayerState, restorePlayerState } from './store';
import { validateQishuiTracks } from './validation';

describe('validateQishuiTracks', () => {
  it('normalizes valid configured tracks', () => {
    expect(
      validateQishuiTracks([
        {
          id: 'qishui-demo',
          title: 'Demo song',
          artist: 'Demo artist',
          coverUrl: '/images/qishui-demo.svg',
          externalUrl: 'https://music.douyin.com/example',
        },
      ]),
    ).toEqual([
      {
        id: 'qishui-demo',
        provider: 'qishui',
        title: 'Demo song',
        artist: 'Demo artist',
        coverUrl: '/images/qishui-demo.svg',
        externalUrl: 'https://music.douyin.com/example',
      },
    ]);
  });

  it('rejects non-HTTPS share links', () => {
    expect(() =>
      validateQishuiTracks([
        {
          id: 'unsafe',
          title: 'Unsafe',
          artist: 'Demo',
          coverUrl: '/cover.svg',
          externalUrl: 'http://music.douyin.com/example',
        },
      ]),
    ).toThrow('absolute HTTPS URL');
  });
});

describe('player state', () => {
  it('restores preferences without autoplaying', () => {
    expect(
      restorePlayerState(
        JSON.stringify({
          providerId: 'qishui',
          currentTrackId: 'qishui-demo',
          expanded: true,
          volume: 2,
          progressMs: 45_000,
          playback: 'playing',
        }),
      ),
    ).toEqual({
      providerId: 'qishui',
      currentTrackId: 'qishui-demo',
      expanded: true,
      volume: 1,
      progressMs: 45_000,
      playback: 'paused',
      errorMessage: undefined,
    });
  });

  it('pauses and clears errors when switching providers', () => {
    const failed = {
      ...createDefaultPlayerState(),
      playback: 'error' as const,
      errorMessage: 'Spotify unavailable',
    };

    expect(reducePlayerState(failed, { type: 'switch-provider', providerId: 'qishui' })).toMatchObject({
      providerId: 'qishui',
      playback: 'paused',
      progressMs: 0,
      errorMessage: undefined,
    });
  });
});

describe('provider capabilities', () => {
  it('uses inline play only for an authenticated, available Spotify session', () => {
    expect(getPrimaryAction(SPOTIFY_CAPABILITIES, true, false)).toBe('inline-play');
    expect(getPrimaryAction(SPOTIFY_CAPABILITIES, false, false)).toBe('open-external');
    expect(getPrimaryAction(SPOTIFY_CAPABILITIES, true, true)).toBe('open-external');
  });

  it('always opens Qishui tracks externally', () => {
    expect(getPrimaryAction(QISHUI_CAPABILITIES, true, false)).toBe('open-external');
  });
});
