import { QISHUI_CAPABILITIES, SPOTIFY_CAPABILITIES, getPrimaryAction } from './providers';
import { SpotifyProvider } from './spotify-provider';
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
  button, input { font: inherit; }
  button { cursor: pointer; }
  button:focus-visible, input:focus-visible {
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
  .now { display: grid; grid-template-columns: 54px minmax(0, 1fr) 44px; gap: 11px; align-items: center; padding: 12px; }
  .cover { width: 54px; height: 54px; border-radius: 9px; object-fit: cover; background: var(--music-player-surface); }
  .meta { min-width: 0; }
  .title, .artist { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .title { font-weight: 800; }
  .artist { color: var(--music-player-muted); font-size: .82rem; }
  .icon-button, .primary {
    min-width: 44px;
    min-height: 44px;
    border: 1px solid var(--music-player-border);
    border-radius: 999px;
    background: var(--music-player-bg);
    color: var(--music-player-accent);
  }
  .primary { min-width: 52px; background: var(--music-player-accent); color: #fffdf8; border-color: var(--music-player-accent); }
  .controls { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 0 12px 12px; }
  .external-label { min-height: 44px; width: 100%; border: 0; border-radius: 9px; padding: 9px 12px; background: var(--music-player-accent); color: #fffdf8; font-weight: 760; }
  .progress { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; padding: 0 12px 12px; color: var(--music-player-muted); font-size: .76rem; }
  .progress input, .volume input { accent-color: var(--music-player-highlight); width: 100%; }
  .volume { display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: center; padding: 0 12px 12px; color: var(--music-player-muted); }
  .queue { max-height: 228px; overflow: auto; border-top: 1px solid var(--music-player-border); padding: 7px; }
  .track { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 7px; width: 100%; min-height: 44px; align-items: center; border: 0; border-radius: 8px; background: transparent; color: inherit; text-align: left; }
  .track[aria-current='true'] { background: var(--music-player-surface); color: var(--music-player-accent); }
  .track-number { color: var(--music-player-muted); font-size: .76rem; text-align: center; }
  .empty, .error { margin: 0; padding: 14px; color: var(--music-player-muted); font-size: .86rem; }
  .error { color: #8f3b2c; }
  .login { margin: 0 12px 12px; width: calc(100% - 24px); min-height: 44px; border: 1px solid var(--music-player-border); border-radius: 9px; background: var(--music-player-bg); color: var(--music-player-accent); font-weight: 720; }
  @media (max-width: 640px) {
    :host { left: 0; right: 0; bottom: 0; }
    .shell { width: 100%; border-radius: 18px 18px 0 0; border-inline: 0; border-bottom: 0; }
    .shell.expanded { max-height: min(78vh, 620px); }
  }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; } }
`;

export class MusicPlayerElement extends HTMLElement {
  config!: MusicPlayerConfig;
  state: PlayerState = createDefaultPlayerState();
  tracks: Record<ProviderId, MusicTrack[]> = { spotify: [], qishui: [] };
  spotifyAuthenticated = false;
  spotifyUnavailable = false;
  private spotifyProvider?: SpotifyProvider;
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
    void this.initialize();
  }

  private async initialize() {
    this.attachShadow({ mode: 'open' });
    try {
      this.config = JSON.parse(this.dataset.config || '{}') as MusicPlayerConfig;
      this.config.qishuiTracks ??= [];
      this.config.workerBaseUrl = (this.config.workerBaseUrl || '').replace(/\/$/, '');
      this.tracks.qishui = validateQishuiTracks(this.config.qishuiTracks);
      if (this.config.workerBaseUrl) {
        this.spotifyProvider = new SpotifyProvider({
          workerBaseUrl: this.config.workerBaseUrl,
          onState: (spotifyState) => {
            this.state = {
              ...this.state,
              playback: spotifyState.paused ? 'paused' : 'playing',
              progressMs: spotifyState.position,
              ...(spotifyState.track ? { currentTrackId: spotifyState.track.id } : {}),
              errorMessage: undefined,
            };
            this.persist();
            this.renderAndBind();
          },
          onError: (message) => this.degradeSpotify(message),
        });
        await this.exchangeCallbackCode();
        this.spotifyAuthenticated = this.spotifyProvider.authenticated;
      }
      const saved = localStorage.getItem(STATE_KEY);
      this.state = saved ? restorePlayerState(saved) : createDefaultPlayerState();
      if (!saved && this.config.defaultProvider) {
        this.state.providerId = this.config.defaultProvider;
      }
      const activeTracks = this.tracks[this.state.providerId];
      if (!this.state.currentTrackId && activeTracks[0]) this.state.currentTrackId = activeTracks[0].id;
      this.render();
      this.bindEvents();
      if (this.state.providerId === 'spotify') await this.loadSpotifyCatalog();
    } catch (error) {
      this.shadowRoot!.innerHTML = `<style>${styles}</style><div class="shell"><p class="error">${this.escape(error instanceof Error ? error.message : '播放器配置无效')}</p></div>`;
    } finally {
      this.resolveReady();
    }
  }

  private currentTracks() {
    return this.tracks[this.state.providerId];
  }

  private currentTrack() {
    return this.currentTracks().find((track) => track.id === this.state.currentTrackId) ?? this.currentTracks()[0];
  }

  private async loadSpotifyCatalog() {
    if (!this.config.workerBaseUrl) {
      this.spotifyUnavailable = true;
      this.renderAndBind();
      return;
    }
    try {
      const catalog = await this.spotifyProvider!.loadCatalog();
      this.tracks.spotify = catalog.tracks;
      this.spotifyUnavailable = false;
      if (!this.state.currentTrackId && this.tracks.spotify[0]) {
        this.state.currentTrackId = this.tracks.spotify[0].id;
      }
    } catch {
      this.spotifyUnavailable = true;
    }
    this.renderAndBind();
  }

  private bindEvents() {
    if (!this.clickEventsBound) this.shadowRoot!.addEventListener('click', (event) => {
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
        this.persist();
        this.renderAndBind();
        return;
      }
      switch (button.dataset.action) {
        case 'toggle':
          this.state = reducePlayerState(this.state, { type: 'set-expanded', expanded: !this.state.expanded });
          this.persist();
          this.renderAndBind();
          break;
        case 'primary':
          void this.activatePrimaryAction();
          break;
        case 'previous':
          void this.runSpotifyControl(() => this.spotifyProvider?.previous());
          break;
        case 'next':
          void this.runSpotifyControl(() => this.spotifyProvider?.next());
          break;
        case 'login':
          this.startSpotifyLogin();
          break;
      }
    });
    this.clickEventsBound = true;
    this.shadowRoot!.querySelector<HTMLInputElement>('[data-action="volume"]')?.addEventListener('input', (event) => {
      this.state = reducePlayerState(this.state, {
        type: 'set-volume',
        volume: Number((event.target as HTMLInputElement).value),
      });
      this.persist();
      if (this.spotifyAuthenticated) void this.spotifyProvider?.setVolume(this.state.volume);
    });
  }

  private switchProvider(providerId: ProviderId) {
    if (providerId === this.state.providerId) return;
    this.state = reducePlayerState(this.state, { type: 'switch-provider', providerId });
    this.state.currentTrackId = this.tracks[providerId][0]?.id;
    this.persist();
    this.renderAndBind();
    if (providerId === 'spotify' && this.tracks.spotify.length === 0) void this.loadSpotifyCatalog();
  }

  private async activatePrimaryAction() {
    const track = this.currentTrack();
    if (!track) return;
    const capabilities = this.state.providerId === 'spotify' ? SPOTIFY_CAPABILITIES : QISHUI_CAPABILITIES;
    const action = getPrimaryAction(capabilities, this.spotifyAuthenticated, this.spotifyUnavailable);
    if (action === 'open-external') {
      window.open(track.externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      if (this.state.playback === 'playing') {
        await this.spotifyProvider?.pause();
        this.state = reducePlayerState(this.state, { type: 'set-playback', playback: 'paused' });
      } else {
        await this.spotifyProvider?.play(track);
        this.state = reducePlayerState(this.state, { type: 'set-playback', playback: 'playing' });
      }
      this.persist();
      this.renderAndBind();
    } catch (error) {
      this.degradeSpotify(error instanceof Error ? error.message : 'Spotify 暂不可用');
      window.open(track.externalUrl, '_blank', 'noopener,noreferrer');
    }
  }

  private startSpotifyLogin() {
    if (!this.config.workerBaseUrl) return;
    const returnTo = `${location.origin}${location.pathname}`;
    location.assign(`${this.config.workerBaseUrl}/auth/spotify/start?returnTo=${encodeURIComponent(returnTo)}`);
  }

  private async exchangeCallbackCode() {
    const url = new URL(location.href);
    const code = url.searchParams.get('music_code');
    if (!code || !this.spotifyProvider) return;
    try {
      await this.spotifyProvider.exchangeSessionCode(code);
      try {
        const catalog = await this.spotifyProvider.refreshCatalog();
        this.tracks.spotify = catalog.tracks;
      } catch {
        this.spotifyUnavailable = true;
      }
    } finally {
      url.searchParams.delete('music_code');
      history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }

  private async runSpotifyControl(control: () => Promise<unknown> | undefined) {
    try {
      await control();
    } catch (error) {
      this.degradeSpotify(error instanceof Error ? error.message : 'Spotify 暂不可用');
    }
  }

  private degradeSpotify(message: string) {
    this.spotifyUnavailable = true;
    this.spotifyAuthenticated = this.spotifyProvider?.authenticated ?? false;
    this.state = reducePlayerState(this.state, { type: 'set-error', message });
    this.persist();
    this.renderAndBind();
  }

  private persist() {
    localStorage.setItem(STATE_KEY, JSON.stringify(this.state));
  }

  private renderAndBind() {
    this.render();
    this.bindEvents();
  }

  private escape(value: string) {
    return value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]!);
  }

  private render() {
    const track = this.currentTrack();
    const isSpotify = this.state.providerId === 'spotify';
    const action = getPrimaryAction(
      isSpotify ? SPOTIFY_CAPABILITIES : QISHUI_CAPABILITIES,
      this.spotifyAuthenticated,
      this.spotifyUnavailable,
    );
    const primaryLabel = track
      ? action === 'inline-play'
        ? `${this.state.playback === 'playing' ? '暂停' : '播放'}：${track.title}`
        : `在${isSpotify ? ' Spotify' : '汽水音乐'}打开：${track.title}`
      : '暂无歌曲';
    const primaryContent = action === 'inline-play'
      ? `<slot name="icon-${this.state.playback === 'playing' ? 'pause' : 'play'}">${this.state.playback === 'playing' ? 'Ⅱ' : '▶'}</slot>`
      : isSpotify ? '打开 Spotify ↗' : '在汽水音乐打开 ↗';
    const tracks = this.currentTracks();

    this.shadowRoot!.innerHTML = `
      <style>${styles}</style>
      <section class="shell ${this.state.expanded ? 'expanded' : ''}" part="shell" aria-label="音乐播放器">
        <div class="details">
          <div class="tabs" role="tablist" aria-label="音乐供应商" part="provider-switch">
            ${(['spotify', 'qishui'] as ProviderId[]).map((provider) => `
              <button class="tab" type="button" role="tab" data-provider="${provider}" aria-selected="${this.state.providerId === provider}" aria-label="切换到${provider === 'spotify' ? ' Spotify' : '汽水音乐'}">
                ${provider === 'spotify' ? 'Spotify' : '汽水音乐 ↗'}
              </button>`).join('')}
          </div>
        </div>
        <div class="now">
          ${track ? `<img class="cover" src="${this.escape(track.coverUrl)}" alt="" loading="lazy" />` : '<div class="cover"></div>'}
          <div class="meta"><div class="title">${this.escape(track?.title ?? '暂无歌曲')}</div><div class="artist">${this.escape(track?.artist ?? (isSpotify ? '请配置 Worker 或刷新目录' : '请在配置中添加汽水分享链接'))}</div></div>
          <button class="icon-button" type="button" data-action="toggle" aria-label="${this.state.expanded ? '收起播放器' : '展开播放器'}" aria-expanded="${this.state.expanded}"><slot name="icon-expand">${this.state.expanded ? '⌄' : '⌃'}</slot></button>
        </div>
        <div class="details">
          ${action === 'inline-play' ? `<div class="controls" part="controls"><button class="icon-button" type="button" data-action="previous" aria-label="上一首"><slot name="icon-previous">‹</slot></button><button class="primary" type="button" data-action="primary" aria-label="${this.escape(primaryLabel)}">${primaryContent}</button><button class="icon-button" type="button" data-action="next" aria-label="下一首"><slot name="icon-next">›</slot></button></div>` : `<div class="controls" part="controls"><button class="external-label" type="button" data-action="primary" aria-label="${this.escape(primaryLabel)}">${primaryContent}</button></div>`}
          ${isSpotify && !this.spotifyAuthenticated ? `<button class="login" type="button" data-action="login" ${this.config.workerBaseUrl ? '' : 'disabled'}>博主登录 Spotify</button>` : ''}
          ${this.state.errorMessage ? `<p class="error" role="status">${this.escape(this.state.errorMessage)}</p>` : ''}
          <div class="volume"><span aria-hidden="true">音量</span><input type="range" min="0" max="1" step="0.05" value="${this.state.volume}" data-action="volume" aria-label="音量" ${isSpotify && action === 'inline-play' ? '' : 'disabled'} /></div>
          <div class="queue" part="queue" aria-label="歌曲列表">
            ${tracks.length ? tracks.map((item, index) => `<button class="track" part="track" type="button" data-track-id="${this.escape(item.id)}" aria-current="${item.id === track?.id}"><span class="track-number">${String(index + 1).padStart(2, '0')}</span><span><span class="title">${this.escape(item.title)}</span><span class="artist">${this.escape(item.artist)}</span></span></button>`).join('') : `<p class="empty">${isSpotify ? 'Spotify 目录暂不可用，登录或部署 Worker 后重试。' : '尚未配置汽水音乐歌曲。'}</p>`}
          </div>
        </div>
      </section>`;
  }
}

if (!customElements.get('music-player')) customElements.define('music-player', MusicPlayerElement);
