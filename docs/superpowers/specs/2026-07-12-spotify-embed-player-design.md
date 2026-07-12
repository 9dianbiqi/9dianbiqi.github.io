# Spotify 免费 Embed 播放器改造设计

## 目标

将现有依赖 Spotify Premium、Web API、Web Playback SDK、OAuth 和 Cloudflare Worker 的 Spotify 播放模式，改为无需开发者订阅的 Spotify 官方歌单 Embed。保留博客右下角悬浮播放器、移动端底部抽屉、来源切换、Astro 页面切换持久化和汽水音乐外跳能力。

## 范围

### 本次实现

- Spotify 来源改为一个公开歌单的官方 Embed。
- 歌单 URL 由 `src/music.config.ts` 静态配置并在构建时校验。
- 展开 Spotify 来源后显示官方 iframe；收起时保留紧凑标题与展开按钮。
- Web Component 继续通过 `transition:persist="music-player"` 跨 Astro 页面保存实例。
- 移除 Spotify 登录、Web Playback SDK、自定义 Spotify 播放控制和 Worker 目录读取。
- 删除不再需要的 Cloudflare Worker、Worker 测试、依赖、脚本、配置和部署说明。
- 汽水音乐维持 TypeScript 配置、官方 HTTPS 分享链接和外部打开行为。
- 更新 README、部署文档、测试和 GitHub Pages 工作流。

### 不在本次实现

- 不抓取 Spotify 页面或调用受限 Web API 获取歌曲元数据。
- 不尝试修改或遮盖 Spotify iframe 内部按钮。
- 不保证所有访客都能播放完整歌曲；实际播放长度、登录要求和地区限制由 Spotify 决定。
- 不在本次加入 Audius、YouTube、SoundCloud 或 Bandcamp provider。

## 配置与校验

`MusicPlayerConfig` 使用以下 Spotify 配置：

```ts
interface SpotifyEmbedConfig {
  playlistUrl: string;
  title?: string;
}

interface MusicPlayerConfig {
  spotify: SpotifyEmbedConfig;
  qishuiTracks: QishuiTrackConfig[];
  defaultProvider?: ProviderId;
}
```

`playlistUrl` 必须满足：

- 使用 `https:`。
- 主机名为 `open.spotify.com`。
- 路径格式为 `/playlist/{playlistId}`。
- playlist ID 只允许字母和数字。

构建时将公开 URL 转换为 `https://open.spotify.com/embed/playlist/{playlistId}`。配置无效时构建失败，避免发布空播放器或任意 iframe URL。

## 界面与交互

- Spotify 仍为默认来源。
- 紧凑状态显示 Spotify 歌单标题和官方来源标识，不显示虚构的当前歌曲信息。
- 展开后显示响应式 Spotify 官方歌单 iframe。
- iframe 设置描述性 `title`、`loading="lazy"`，并仅授予 Spotify 官方 Embed 所需的媒体权限。
- Spotify 来源不再渲染登录、进度、音量、上一首或下一首自定义按钮；这些控制由官方 iframe 提供。
- 汽水音乐继续显示自定义队列和“在汽水音乐打开 ↗”。
- 来源切换、展开状态和当前汽水歌曲继续持久化。
- Spotify iframe 随整个 Web Component 持久化，避免 Astro 客户端页面切换时重新创建。

## 组件边界

- `spotify-embed.ts`：只负责 URL 校验和 Embed URL 生成，不访问网络。
- `music-player.ts`：负责来源切换、持久状态、可访问性和渲染。
- `validation.ts`：继续负责汽水音乐配置校验。
- 删除 `spotify-provider.ts`，避免遗留 OAuth、会话令牌和 SDK 路径。

## 错误处理与安全

- 非 Spotify HTTPS 歌单 URL 在构建和组件初始化时拒绝。
- iframe URL 只由已验证 playlist ID 拼接，避免把任意地址注入 Shadow DOM。
- Spotify iframe 加载失败时由浏览器显示官方失败状态；播放器仍可切换至汽水音乐。
- 不保存 Spotify token，不创建 OAuth 会话，不部署 Worker。
- 不自动播放；必须由访客主动操作官方 Embed。

## 测试策略

- Vitest：Spotify URL 接受/拒绝、Embed URL 转换、无登录按钮、无自定义 Spotify 播放控制、汽水外跳和状态持久化。
- Playwright：桌面/移动布局、Spotify iframe、来源切换、键盘操作和 Astro 页面持久化。
- 静态验证：确认不存在 Spotify SDK、OAuth、Worker URL 和 Cloudflare 部署依赖。
- 全量验证：播放器测试、端到端测试、Astro 类型检查与构建、现有仓库验证脚本。

## 发布影响

- GitHub Pages 不再需要 `PUBLIC_MUSIC_WORKER_URL`。
- 不再需要 Spotify Client ID、Client Secret、Owner ID、Premium 或 Cloudflare Worker/KV/Durable Object。
- 上线只需把真实公开歌单 URL 写入 `src/music.config.ts`，合并 PR 后由现有 GitHub Pages workflow 构建。

