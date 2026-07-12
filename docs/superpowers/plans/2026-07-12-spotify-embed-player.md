# Spotify 免费 Embed 播放器实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Spotify Premium、OAuth、Web API 和 Cloudflare Worker 播放方案替换为免费官方歌单 Embed，同时保留持久化悬浮播放器和汽水音乐外跳。

**Architecture:** 通过纯函数校验公开 Spotify 歌单 URL，并只从已验证的 playlist ID 生成官方 Embed URL。Web Component 负责渲染持久 iframe 和汽水队列，不访问 Spotify API；所有 OAuth、SDK、Worker 和会话代码随之删除。

**Tech Stack:** Astro 7、TypeScript 5、原生 Web Component、Spotify Embed iframe、Vitest、Playwright、GitHub Pages

## Global Constraints

- Spotify 仅使用 `https://open.spotify.com/playlist/{playlistId}` 公开歌单 URL。
- 不调用 Spotify Web API、Web Playback SDK、OAuth 或非官方接口。
- 不自动播放，且不遮盖或修改 Spotify iframe 内部控件。
- 汽水音乐继续只接受官方 HTTPS 分享链接并外跳。
- 保留 `transition:persist="music-player"`、键盘可访问性、ARIA 和移动端底部抽屉。
- 本次不新增 Audius、YouTube、SoundCloud 或 Bandcamp provider。

---

### Task 1: Spotify Embed URL 边界

**Files:**
- Create: `src/components/music-player/spotify-embed.ts`
- Create: `src/components/music-player/spotify-embed.test.ts`

**Interfaces:**
- Produces: `parseSpotifyPlaylistUrl(value: string): { playlistId: string; canonicalUrl: string }`
- Produces: `createSpotifyEmbedUrl(value: string): string`

- [x] **Step 1: 写入拒绝非官方 URL、接受公开歌单并生成 Embed URL 的失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { createSpotifyEmbedUrl, parseSpotifyPlaylistUrl } from './spotify-embed';

describe('Spotify Embed URL', () => {
  it('accepts an official HTTPS playlist URL', () => {
    expect(parseSpotifyPlaylistUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc')).toEqual({
      playlistId: '37i9dQZF1DXcBWIGoYBM5M',
      canonicalUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    });
  });

  it.each([
    'http://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    'https://example.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    'https://open.spotify.com/track/37i9dQZF1DXcBWIGoYBM5M',
    'https://open.spotify.com/playlist/not-valid!',
  ])('rejects unsafe or non-playlist input: %s', (value) => {
    expect(() => parseSpotifyPlaylistUrl(value)).toThrow('Spotify playlist URL');
  });

  it('builds the official embed URL from the validated ID', () => {
    expect(createSpotifyEmbedUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'))
      .toBe('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M');
  });
});
```

- [x] **Step 2: 运行测试并确认因模块不存在而失败**

Run: `npx vitest run src/components/music-player/spotify-embed.test.ts`

Expected: FAIL，提示无法解析 `./spotify-embed`。

- [x] **Step 3: 实现最小 URL 校验与转换函数**

```ts
const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9]+$/;

export function parseSpotifyPlaylistUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Spotify playlist URL must be a valid URL');
  }
  const segments = url.pathname.split('/').filter(Boolean);
  const playlistId = segments[0] === 'playlist' && segments.length === 2 ? segments[1] : '';
  if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com' || !PLAYLIST_ID_PATTERN.test(playlistId)) {
    throw new Error('Spotify playlist URL must use https://open.spotify.com/playlist/{playlistId}');
  }
  return {
    playlistId,
    canonicalUrl: `https://open.spotify.com/playlist/${playlistId}`,
  };
}

export function createSpotifyEmbedUrl(value: string) {
  const { playlistId } = parseSpotifyPlaylistUrl(value);
  return `https://open.spotify.com/embed/playlist/${playlistId}`;
}
```

- [x] **Step 4: 运行测试并确认通过**

Run: `npx vitest run src/components/music-player/spotify-embed.test.ts`

Expected: 6 tests PASS。

- [x] **Step 5: 提交 URL 边界**

```bash
git add src/components/music-player/spotify-embed.ts src/components/music-player/spotify-embed.test.ts
git commit -m "feat: validate Spotify embed playlists"
```

### Task 2: 静态配置与播放器 Embed 渲染

**Files:**
- Modify: `src/components/music-player/types.ts`
- Modify: `src/music.config.ts`
- Modify: `src/components/music-player/music-player.ts`
- Modify: `src/components/music-player/providers.ts`
- Modify: `src/components/music-player/music-player.test.ts`
- Delete: `src/components/music-player/spotify-provider.ts`
- Delete: `src/components/music-player/spotify-provider.test.ts`

**Interfaces:**
- Consumes: `createSpotifyEmbedUrl(value: string): string`
- Produces: `SpotifyEmbedConfig { playlistUrl: string; title?: string }`
- Produces: `MusicPlayerConfig.spotify: SpotifyEmbedConfig`

- [x] **Step 1: 将组件测试改为期望官方 iframe 且不存在登录和自定义 Spotify 控件**

```ts
const config = {
  spotify: {
    playlistUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    title: 'Spotify 精选歌单',
  },
  defaultProvider: 'spotify',
  qishuiTracks: [],
};

it('renders a safe official Spotify playlist embed without OAuth controls', async () => {
  const element = document.createElement('music-player') as MusicPlayerElement;
  element.setAttribute('data-config', JSON.stringify(config));
  document.body.append(element);
  await element.ready;

  const root = element.shadowRoot!;
  const iframe = root.querySelector<HTMLIFrameElement>('iframe[data-spotify-embed]');
  expect(iframe?.src).toBe('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M');
  expect(iframe?.title).toBe('Spotify 精选歌单');
  expect(root.querySelector('[data-action="login"]')).toBeNull();
  expect(root.querySelector('[data-action="primary"]')).toBeNull();
  expect(root.querySelector('[data-action="volume"]')).toBeNull();
});
```

- [x] **Step 2: 运行组件测试并确认旧 OAuth UI 导致失败**

Run: `npx vitest run src/components/music-player/music-player.test.ts`

Expected: FAIL，找不到 `iframe[data-spotify-embed]`，并仍存在旧登录 UI。

- [x] **Step 3: 更新类型和配置**

```ts
export interface SpotifyEmbedConfig {
  playlistUrl: string;
  title?: string;
}

export interface MusicPlayerConfig {
  spotify: SpotifyEmbedConfig;
  qishuiTracks: QishuiTrackConfig[];
  defaultProvider?: ProviderId;
}
```

`src/music.config.ts` 使用真实有效的公开默认歌单：

```ts
spotify: {
  playlistUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
  title: 'Spotify 精选歌单',
},
```

- [x] **Step 4: 将 Spotify 分支替换为官方 iframe**

在 `music-player.ts` 初始化时调用 `createSpotifyEmbedUrl(this.config.spotify.playlistUrl)`，把结果保存为私有字段。Spotify 展开内容只渲染：

```html
<div class="spotify-embed" part="embed">
  <iframe
    data-spotify-embed
    src="${this.escape(this.spotifyEmbedUrl)}"
    title="${this.escape(this.config.spotify.title || 'Spotify 歌单')}"
    loading="lazy"
    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
  ></iframe>
</div>
```

删除 `SpotifyProvider`、认证状态、回调兑换、目录加载、错误降级、自定义播放控制和登录 UI。Spotify 紧凑状态显示配置标题与“Spotify 官方播放”，汽水分支保留现有队列和外跳逻辑。

- [x] **Step 5: 运行播放器测试并修复所有行为回归**

Run: `npm run test:player`

Expected: 所有播放器测试 PASS，且不进行 Spotify 网络请求。

- [x] **Step 6: 提交 Embed UI**

```bash
git add src/music.config.ts src/components/music-player
git commit -m "feat: replace Spotify playback with official embed"
```

### Task 3: 删除 Cloudflare 和 Premium 基础设施

**Files:**
- Delete: `worker/`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`
- Modify: `.gitignore`
- Modify: `.github/workflows/deploy.yml`
- Modify: `scripts/verify-music-player.mjs`
- Delete: `docs/music-player-deployment.md`

**Interfaces:**
- Produces: 纯静态 GitHub Pages 构建，不需要运行时服务或秘密变量。

- [x] **Step 1: 更新静态验证脚本，使旧基础设施存在时失败**

验证规则必须检查：

```js
assert(!existsSync('worker'), 'worker directory must be removed');
assert(!packageJson.scripts['test:worker'], 'worker test script must be removed');
assert(!workflow.includes('PUBLIC_MUSIC_WORKER_URL'), 'workflow must not require a Worker URL');
assert(!playerSource.includes('SpotifyProvider'), 'OAuth provider must be removed');
assert(playerSource.includes('data-spotify-embed'), 'official Spotify embed must be rendered');
```

- [x] **Step 2: 运行静态验证并确认旧 Worker/Provider 导致失败**

Run: `npm run verify:music-player`

Expected: FAIL，至少报告 `worker directory must be removed`。

- [x] **Step 3: 删除 Worker 并清理项目配置**

删除整个 `worker/`，从 `package.json` 删除：

- `test:worker`
- `typecheck:worker`
- `@cloudflare/vitest-pool-workers`
- `@cloudflare/workers-types`
- `undici`
- `wrangler`

将 `test` 改为 `npm run test:player`，运行 `npm install --package-lock-only` 更新锁文件。从 GitHub Pages workflow 删除 `PUBLIC_MUSIC_WORKER_URL` 环境变量，从 `tsconfig.json` 和 `.gitignore` 删除 Worker 专用项。

- [x] **Step 4: 运行静态验证并确认通过**

Run: `npm run verify:music-player`

Expected: PASS，输出 Spotify Embed 静态架构验证成功。

- [x] **Step 5: 提交基础设施删除**

```bash
git add -A worker package.json package-lock.json tsconfig.json .gitignore .github/workflows/deploy.yml scripts/verify-music-player.mjs docs/music-player-deployment.md
git commit -m "refactor: remove Spotify OAuth worker"
```

### Task 4: 端到端行为与文档

**Files:**
- Modify: `e2e/music-player.spec.ts`
- Modify: `README.md`
- Create: `docs/music-player-configuration.md`

**Interfaces:**
- Consumes: `MusicPlayerConfig.spotify.playlistUrl`
- Produces: 无 Premium 的本地配置和 GitHub Pages 发布说明。

- [x] **Step 1: 更新 Playwright 断言，要求 Spotify iframe、来源切换和持久化**

```ts
await player.locator('[data-action="toggle"]').click();
await expect(player.locator('iframe[data-spotify-embed]')).toHaveAttribute(
  'src',
  /https:\/\/open\.spotify\.com\/embed\/playlist\//,
);
await expect(player.locator('[data-action="login"]')).toHaveCount(0);
await player.locator('[data-provider="qishui"]').click();
await expect(player.locator('[role="tab"][aria-selected="true"]')).toContainText('汽水音乐');
```

- [x] **Step 2: 运行端到端测试并确认旧断言或旧 UI 导致失败**

Run: `npm run test:e2e -- --reporter=line`

Expected: FAIL，旧 Spotify 登录/外跳断言与 Embed 设计不一致。

- [x] **Step 3: 完成端到端测试和文档**

README 和配置文档必须说明：

- Spotify Embed 不要求 Premium、Client ID、Secret、OAuth 或 Worker。
- 替换歌单只需修改 `src/music.config.ts` 中的公开 Spotify playlist URL。
- iframe 内部样式和完整播放资格由 Spotify 控制。
- 汽水音乐继续配置官方 HTTPS 分享链接。
- 合并到 `main` 后 GitHub Pages 自动发布。
- Audius、YouTube、SoundCloud、Bandcamp 是未来 provider 选项，不在本次代码范围。

- [x] **Step 4: 运行端到端测试并确认通过**

Run: `npm run test:e2e -- --reporter=line`

Expected: 桌面和移动端测试全部 PASS。

- [x] **Step 5: 提交端到端测试和文档**

```bash
git add e2e/music-player.spec.ts README.md docs/music-player-configuration.md
git commit -m "docs: document free Spotify embed setup"
```

### Task 5: 全量验证与现有 PR 更新

**Files:**
- Modify: `docs/superpowers/plans/2026-07-12-spotify-embed-player.md`（勾选已完成步骤）

**Interfaces:**
- Produces: 已验证并推送到 `codex/music-player` 的实现。

- [x] **Step 1: 运行播放器和构建验证**

```bash
npm test
npm run verify:music-player
npm run build
npm run test:e2e -- --reporter=line
```

Expected: 所有命令 exit 0；Vitest、Astro build 和 Playwright 无失败。

- [x] **Step 2: 运行现有仓库验证脚本**

```bash
npm run verify:home
npm run verify:home-video
npm run verify:obsidian
npm run verify:article-layouts
npm run verify:toc
npm run verify:archive-filter
npm run verify:home-content
npm run verify:content-first-ui
npm run verify:object-flow
npm run verify:post-nav
```

Expected: 所列现有验证全部 exit 0。单独记录既有的 `verify:article-visuals` 基线结果，不把未修改文章纳入本次范围。

- [x] **Step 3: 检查残留引用和工作区**

```bash
rg -n "SpotifyProvider|spotify-player.js|SPOTIFY_CLIENT|SPOTIFY_OWNER|PUBLIC_MUSIC_WORKER_URL|Durable Object|wrangler" src package.json .github README.md docs scripts
git diff --check
git status --short
```

Expected: 没有运行时代码或部署文档残留；只有历史计划/规格允许提到已删除架构；`git diff --check` exit 0。

- [ ] **Step 4: 提交计划完成状态并推送**

```bash
git add docs/superpowers/plans/2026-07-12-spotify-embed-player.md
git commit -m "docs: complete Spotify embed implementation plan"
git push origin codex/music-player
```

- [ ] **Step 5: 更新草稿 PR #2 描述**

PR 描述必须将方案改为免费 Spotify Embed，删除 Cloudflare/Spotify secrets 部署步骤，列出最新测试结果，并保留既有文章视觉验证基线说明。
