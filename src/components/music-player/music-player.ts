import { createSpotifyEmbedUrl } from './spotify-embed';
import { createDefaultPlayerState, reducePlayerState, restorePlayerState } from './store';
import type { MusicPlayerConfig, MusicTrack, PlayerState, ProviderId } from './types';
import { validateQishuiTracks } from './validation';

const STATE_KEY = 'music-player.preferences.v1';

const styles = `
  :host {
    --music-player-bg: #fffdf8;
    --music-player-surface: #eef3ed;
    --music-player-text: #141817;
    --music-player-muted: #68736d;
    --music-player-accent: #123d3e;
    --music-player-highlight: #b55f46;
    --music-player-border: #ddd9cd;
    --music-player-radius: 12px;
    --music-player-shadow: 0 18px 50px rgba(20, 24, 23, 0.2);
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 30;
    color: var(--music-player-text);
    font-family: inherit;
  }
  * { box-sizing: border-box; }
  button { cursor: pointer; font: inherit; }
  button:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--music-player-highlight) 42%, transparent);
    outline-offset: 2px;
  }
  .shell {
    width: min(340px, calc(100vw - 32px));
    overflow: hidden;
    border: 1px solid var(--music-player-border);
    border-radius: var(--music-player-radius);
    background: color-mix(in srgb, var(--music-player-bg) 96%, transparent);
    box-shadow: var(--music-player-shadow);
    backdrop-filter: blur(18px);
  }
  .shell:not(.expanded) .details { display: none; }
  .tabs { display: flex; gap: 6px; padding: 10px 10px 0; }
  .tab {
    min-height: 44px;
    flex: 1;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--music-player-muted);
    font-weight: 720;
  }
  .tab[aria-selected='true'] { background: var(--music-player-accent); color: #fffdf8; }
  .now {
    display: grid;
    grid-template-columns: 54px minmax(0, 1fr) 44px;
    gap: 11px;
    align-items: center;
    padding: 12px;
  }
  .cover, .provider-mark {
    width: 54px;
    height: 54px;
    border-radius: 9px;
    background: var(--music-player-surface);
  }
  .cover { object-fit: cover; }
  .provider-mark {
    display: grid;
    place-items: center;
    color: #fff;
    background: #1ed760;
    font-size: 1.5rem;
    font-weight: 900;
  }
  .meta { min-width: 0; }
  .title, .artist { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .title { font-weight: 800; }
  .artist { color: var(--music-player-muted); font-size: .82rem; }
  .icon-button {
    min-width: 44px;
    min-height: 44px;
    border: 1px solid var(--music-player-border);
    border-radius: 999px;
    background: var(--music-player-bg);
    color: var(--music-player-accent);
  }
  .controls { display: flex; justify-content: center; padding: 0 12px 12px; }
  .external-label {
    min-height: 44px;
    width: 100%;
    border: 0;
    border-radius: 9px;
    padding: 9px 12px;
    background: var(--music-player-accent);
    color: #fffdf8;
    font-weight: 760;
  }
  .spotify-embed { padding: 12px; }
  .spotify-embed iframe {
    display: block;
    width: 100%;
    height: 352px;
    border: 0;
    border-radius: 12px;
    background: var(--music-player-surface);
  }
  .queue {
    max-height: 228px;
    overflow: auto;
    border-top: 1px solid var(--music-player-border);
    padding: 7px;
  }
  .track {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr);
    gap: 7px;
    width: 100%;
    min-height: 44px;
    align-items: center;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    text-align: left;
  }
  .track[aria-current='true'] { background: var(--music-player-surface); color: var(--music-player-accent); }
  .track-number { color: var(--music-player-muted); font-size: .76rem; text-align: center; }
  .empty, .error { margin: 0; padding: 14px; color: var(--music-player-muted); font-size: .86rem; }
  .error { color: #8f3b2c; }
  @media (max-width: 640px) {
    :host { left: 0; right: 0; bottom: 0; }
    .shell {
      width: 100%;
      border-radius: 18px 18px 0 0;
      border-inline: 0;
      border-bottom: 0;
    }
    .shell.expanded { max-height: min(82vh, 680px); overflow-y: auto; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition: none !important; }
  }
`;

export class MusicPlayerElement extends HTMLElement {
  config!: MusicPlayerConfig;
  state: PlayerState = createDefaultPlayerState();
  tracks: Record<ProviderId, MusicTrack[]> = { spotify: [], qishui: [] };
  private spotifyEmbedUrl = '';
  private initialized = false;
  private clickEventsBound = false;
  private resolveReady!: () => void;
  readonly ready: Promise<void>;

  constructor() {
    super();
    this.ready = new Promise((resolve) => (this.resolveReady = resolve));
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    this.initialize();
  }

  private initialize() {
    this.attachShadow({ mode: 'open' });
    try {
      this.config = JSON.parse(this.dataset.config || '{}') as MusicPlayerConfig;
      this.config.qishuiTracks ??= [];
      this.spotifyEmbedUrl = createSpotifyEmbedUrl(this.config.spotify?.playlistUrl ?? '');
      this.tracks.qishui = validateQishuiTracks(this.config.qishuiTracks);

      const saved = localStorage.getItem(STATE_KEY);
      this.state = saved ? restorePlayerState(saved) : createDefaultPlayerState();
      if (!saved && this.config.defaultProvider) this.state.providerId = this.config.defaultProvider;
      if (this.state.providerId === 'qishui') {
        const selectedStillExists = this.tracks.qishui.some(
          (track) => track.id === this.state.currentTrackId,
        );
        if (!selectedStillExists) this.state.currentTrackId = this.tracks.qishui[0]?.id;
      }

      this.render();
      this.bindEvents();
    } catch (error) {
      this.shadowRoot!.innerHTML = `
        <style>${styles}</style>
        <div class="shell">
          <p class="error">${this.escape(error instanceof Error ? error.message : '播放器配置无效')}</p>
        </div>`;
    } finally {
      this.resolveReady();
    }
  }

  private currentQishuiTrack() {
    return this.tracks.qishui.find((track) => track.id === this.state.currentTrackId)
      ?? this.tracks.qishui[0];
  }

  private bindEvents() {
    if (this.clickEventsBound) return;
    this.shadowRoot!.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button');
      if (!button) return;

      const provider = button.dataset.provider as ProviderId | undefined;
      if (provider) {
        this.switchProvider(provider);
        return;
      }

      const trackId = button.dataset.trackId;
      if (trackId) {
        this.state = reducePlayerState(this.state, { type: 'select-track', trackId });
        this.persistAndRender();
        return;
      }

      if (button.dataset.action === 'toggle') {
        this.state = reducePlayerState(this.state, {
          type: 'set-expanded',
          expanded: !this.state.expanded,
        });
        this.persistAndRender();
      }

      if (button.dataset.action === 'primary') {
        const track = this.currentQishuiTrack();
        if (track) window.open(track.externalUrl, '_blank', 'noopener,noreferrer');
      }
    });
    this.shadowRoot!.addEventListener('keydown', (event) => {
      const keyboardEvent = event as KeyboardEvent;
      const tab = (event.target as Element).closest<HTMLButtonElement>('[role="tab"]');
      if (!tab) return;

      const providers: ProviderId[] = ['spotify', 'qishui'];
      const currentIndex = providers.indexOf(tab.dataset.provider as ProviderId);
      const nextIndex = keyboardEvent.key === 'ArrowRight'
        ? (currentIndex + 1) % providers.length
        : keyboardEvent.key === 'ArrowLeft'
          ? (currentIndex - 1 + providers.length) % providers.length
          : keyboardEvent.key === 'Home'
            ? 0
            : keyboardEvent.key === 'End'
              ? providers.length - 1
              : -1;
      if (nextIndex < 0) return;

      keyboardEvent.preventDefault();
      const nextProvider = providers[nextIndex];
      this.switchProvider(nextProvider);
      this.shadowRoot!
        .querySelector<HTMLButtonElement>(`[data-provider="${nextProvider}"]`)
        ?.focus();
    });
    this.clickEventsBound = true;
  }

  private switchProvider(providerId: ProviderId) {
    if (providerId === this.state.providerId) return;
    this.state = reducePlayerState(this.state, { type: 'switch-provider', providerId });
    if (providerId === 'qishui') this.state.currentTrackId = this.tracks.qishui[0]?.id;
    this.persistAndRender();
  }

  private persistAndRender() {
    localStorage.setItem(STATE_KEY, JSON.stringify(this.state));
    this.render();
  }

  private escape(value: string) {
    return value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]!);
  }

  private render() {
    const isSpotify = this.state.providerId === 'spotify';
    const track = this.currentQishuiTrack();
    const spotifyTitle = this.config.spotify.title?.trim() || 'Spotify 歌单';
    const compactTitle = isSpotify ? spotifyTitle : track?.title ?? '暂无歌曲';
    const compactArtist = isSpotify
      ? 'Spotify 官方播放'
      : track?.artist ?? '请在配置中添加汽水分享链接';
    const compactArtwork = isSpotify
      ? '<div class="provider-mark" aria-hidden="true">♫</div>'
      : track
        ? `<img class="cover" src="${this.escape(track.coverUrl)}" alt="" loading="lazy" />`
        : '<div class="cover"></div>';

    this.shadowRoot!.innerHTML = `
      <style>${styles}</style>
      <section class="shell ${this.state.expanded ? 'expanded' : ''}" part="shell" aria-label="音乐播放器">
        <div class="details">
          <div class="tabs" role="tablist" aria-label="音乐供应商" part="provider-switch">
            ${(['spotify', 'qishui'] as ProviderId[]).map((provider) => `
              <button
                class="tab"
                type="button"
                role="tab"
                data-provider="${provider}"
                aria-selected="${this.state.providerId === provider}"
                aria-label="切换到${provider === 'spotify' ? ' Spotify' : '汽水音乐'}"
              >
                ${provider === 'spotify' ? 'Spotify' : '汽水音乐 ↗'}
              </button>`).join('')}
          </div>
        </div>
        <div class="now">
          ${compactArtwork}
          <div class="meta">
            <div class="title">${this.escape(compactTitle)}</div>
            <div class="artist">${this.escape(compactArtist)}</div>
          </div>
          <button
            class="icon-button"
            type="button"
            data-action="toggle"
            aria-label="${this.state.expanded ? '收起播放器' : '展开播放器'}"
            aria-expanded="${this.state.expanded}"
          >
            <slot name="icon-expand">${this.state.expanded ? '⌄' : '⌃'}</slot>
          </button>
        </div>
        <div class="details">
          ${isSpotify ? `
            <div class="spotify-embed" part="embed">
              <iframe
                data-spotify-embed
                src="${this.escape(this.spotifyEmbedUrl)}"
                title="${this.escape(spotifyTitle)}"
                loading="lazy"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              ></iframe>
            </div>` : `
            ${track ? `
              <div class="controls" part="controls">
                <button
                  class="external-label"
                  type="button"
                  data-action="primary"
                  aria-label="在汽水音乐打开：${this.escape(track.title)}"
                >
                  在汽水音乐打开 ↗
                </button>
              </div>` : ''}
            <div class="queue" part="queue" aria-label="歌曲列表">
              ${this.tracks.qishui.length ? this.tracks.qishui.map((item, index) => `
                <button
                  class="track"
                  part="track"
                  type="button"
                  data-track-id="${this.escape(item.id)}"
                  aria-current="${item.id === track?.id}"
                >
                  <span class="track-number">${String(index + 1).padStart(2, '0')}</span>
                  <span>
                    <span class="title">${this.escape(item.title)}</span>
                    <span class="artist">${this.escape(item.artist)}</span>
                  </span>
                </button>`).join('') : '<p class="empty">尚未配置汽水音乐歌曲。</p>'}
            </div>`}
        </div>
      </section>`;
  }
}

if (!customElements.get('music-player')) {
  customElements.define('music-player', MusicPlayerElement);
}
