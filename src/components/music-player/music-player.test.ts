// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MusicPlayerElement } from './music-player';
import './music-player';

const config = {
  workerBaseUrl: '',
  defaultProvider: 'qishui',
  qishuiTracks: [
    {
      id: 'qishui-demo',
      title: '汽水示例歌曲',
      artist: '示例音乐人',
      coverUrl: '/images/qishui-demo.svg',
      externalUrl: 'https://music.douyin.com/example',
    },
  ],
};

describe('music-player element', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders an accessible provider switch and Qishui external action', async () => {
    const element = document.createElement('music-player') as MusicPlayerElement;
    element.setAttribute('data-config', JSON.stringify(config));
    document.body.append(element);
    await element.ready;

    const root = element.shadowRoot!;
    expect(root.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('音乐供应商');
    expect(root.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain('汽水音乐');
    expect(root.querySelector('[data-action="primary"]')?.getAttribute('aria-label')).toBe(
      '在汽水音乐打开：汽水示例歌曲',
    );
    expect(root.querySelector('[data-action="primary"]')?.textContent).toContain('汽水音乐');
  });

  it('opens Qishui links externally instead of attempting inline playback', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const element = document.createElement('music-player') as MusicPlayerElement;
    element.setAttribute('data-config', JSON.stringify(config));
    document.body.append(element);
    await element.ready;

    (element.shadowRoot!.querySelector('[data-action="primary"]') as HTMLButtonElement).click();

    expect(open).toHaveBeenCalledWith(
      'https://music.douyin.com/example',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('keeps every interactive control at an accessible semantic button or tab', async () => {
    const element = document.createElement('music-player') as MusicPlayerElement;
    element.setAttribute('data-config', JSON.stringify(config));
    document.body.append(element);
    await element.ready;

    const interactive = [...element.shadowRoot!.querySelectorAll('button')];
    expect(interactive.length).toBeGreaterThan(3);
    expect(interactive.every((button) => button.getAttribute('aria-label') || button.textContent?.trim())).toBe(true);
  });

  it('handles an expand click exactly once after rendering', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ generatedAt: null, playlistUrl: '', tracks: [] }),
      ),
    );
    const element = document.createElement('music-player') as MusicPlayerElement;
    element.setAttribute(
      'data-config',
      JSON.stringify({ ...config, defaultProvider: 'spotify', workerBaseUrl: 'https://worker.example' }),
    );
    document.body.append(element);
    await element.ready;

    (element.shadowRoot!.querySelector('[data-action="toggle"]') as HTMLButtonElement).click();

    expect(element.shadowRoot!.querySelector('[data-action="toggle"]')?.getAttribute('aria-expanded')).toBe('true');
    expect(element.shadowRoot!.querySelector('.shell')?.classList.contains('expanded')).toBe(true);
  });

  it('upgrades an authenticated Spotify catalog to inline playback controls', async () => {
    localStorage.setItem('music-player.spotify-session.v1', 'opaque-session');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            generatedAt: '2026-07-12T00:00:00Z',
            playlistUrl: 'https://open.spotify.com/playlist/demo',
            tracks: [
              {
                id: 'spotify-demo',
                title: 'Spotify demo',
                artist: 'Demo artist',
                coverUrl: 'https://i.scdn.co/image/demo',
                externalUrl: 'https://open.spotify.com/track/spotify-demo',
                spotifyUri: 'spotify:track:spotify-demo',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    const element = document.createElement('music-player') as MusicPlayerElement;
    element.setAttribute(
      'data-config',
      JSON.stringify({ ...config, defaultProvider: 'spotify', workerBaseUrl: 'https://worker.example' }),
    );
    document.body.append(element);
    await element.ready;

    expect(element.shadowRoot!.querySelector('[data-action="primary"]')?.getAttribute('aria-label')).toBe(
      '播放：Spotify demo',
    );
    expect(element.shadowRoot!.querySelector('[data-action="login"]')).toBeNull();
  });

  it('keeps the player usable when the first post-login catalog refresh fails', async () => {
    history.replaceState({}, '', '/?music_code=single-use-code');
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(
          Response.json({ sessionToken: 'opaque-session', expiresAt: '2026-07-19T00:00:00Z' }),
        )
        .mockResolvedValueOnce(Response.json({ error: 'refresh_failed' }, { status: 502 }))
        .mockResolvedValueOnce(Response.json({ generatedAt: null, playlistUrl: '', tracks: [] })),
    );
    const element = document.createElement('music-player') as MusicPlayerElement;
    element.setAttribute(
      'data-config',
      JSON.stringify({ ...config, defaultProvider: 'spotify', workerBaseUrl: 'https://worker.example' }),
    );
    document.body.append(element);
    await element.ready;

    expect(element.shadowRoot!.querySelector('[aria-label="音乐播放器"]')).not.toBeNull();
    expect(location.search).toBe('');
  });
});
