// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MusicPlayerElement } from './music-player';
import './music-player';

const config = {
  spotify: {
    playlistUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    title: 'Spotify 精选歌单',
  },
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
    const element = document.createElement('music-player') as MusicPlayerElement;
    element.setAttribute(
      'data-config',
      JSON.stringify({ ...config, defaultProvider: 'spotify' }),
    );
    document.body.append(element);
    await element.ready;

    (element.shadowRoot!.querySelector('[data-action="toggle"]') as HTMLButtonElement).click();

    expect(element.shadowRoot!.querySelector('[data-action="toggle"]')?.getAttribute('aria-expanded')).toBe('true');
    expect(element.shadowRoot!.querySelector('.shell')?.classList.contains('expanded')).toBe(true);
  });

  it('renders a safe official Spotify playlist embed without OAuth controls', async () => {
    const element = document.createElement('music-player') as MusicPlayerElement;
    element.setAttribute(
      'data-config',
      JSON.stringify({ ...config, defaultProvider: 'spotify' }),
    );
    document.body.append(element);
    await element.ready;

    const root = element.shadowRoot!;
    const iframe = root.querySelector<HTMLIFrameElement>('iframe[data-spotify-embed]');
    expect(iframe?.src).toBe(
      'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M',
    );
    expect(iframe?.title).toBe('Spotify 精选歌单');
    expect(root.querySelector('[data-action="login"]')).toBeNull();
    expect(root.querySelector('[data-action="primary"]')).toBeNull();
    expect(root.querySelector('[data-action="volume"]')).toBeNull();
  });

  it('rejects a non-Spotify iframe URL without rendering it', async () => {
    const element = document.createElement('music-player') as MusicPlayerElement;
    element.setAttribute(
      'data-config',
      JSON.stringify({
        ...config,
        defaultProvider: 'spotify',
        spotify: { playlistUrl: 'https://example.com/playlist/unsafe' },
      }),
    );
    document.body.append(element);
    await element.ready;

    expect(element.shadowRoot!.querySelector('iframe')).toBeNull();
    expect(element.shadowRoot!.textContent).toContain('Spotify playlist URL');
  });
});
