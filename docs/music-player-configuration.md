# 免费音乐播放器配置

博客播放器是静态 Astro Web Component，不需要 Spotify Premium、OAuth、Cloudflare Worker 或任何服务器密钥。

## Spotify 官方 Embed

在 `src/music.config.ts` 配置一个公开 Spotify 歌单：

```ts
spotify: {
  playlistUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
  title: 'Spotify 精选歌单',
},
```

`playlistUrl` 必须是 `https://open.spotify.com/playlist/{playlistId}` 格式。查询参数会被移除，并由构建逻辑生成 `https://open.spotify.com/embed/playlist/{playlistId}`。非 HTTPS、非 Spotify 域名、单曲链接和非法 playlist ID 会使构建失败。

播放器使用 Spotify 官方 iframe，因此：

- 不需要 Spotify Developer Dashboard 应用或 Premium 开发者账号。
- 不保存 token，不访问 Spotify Web API，也不会读取私有歌单。
- iframe 内部按钮和样式由 Spotify 控制，外层面板仍可用 CSS 变量和 `::part()` 定制。
- 是否能播放完整歌曲取决于 Spotify、访客登录状态、地区、浏览器和内容授权。
- 不自动播放，访客必须主动点击官方播放器。

在 Spotify 中更新公开歌单后，Embed 会展示更新结果，不需要重新构建博客。只有更换歌单 URL 或标题时才需要重新发布。

## 汽水音乐

汽水音乐没有用于本项目的稳定官方网页播放 API，因此只配置官方 HTTPS 分享链接：

```ts
qishuiTracks: [
  {
    id: 'stable-song-id',
    title: '歌曲名',
    artist: '音乐人',
    coverUrl: '/images/music/example.jpg',
    externalUrl: 'https://官方汽水音乐分享链接',
  },
],
```

不要填写 Cookie、抓包地址、私有 API 或受保护音频 URL。

## 可选的免费站内播放来源

本次代码只包含 Spotify Embed 和汽水外跳。未来可在统一 provider 层增加：

- Audius：开放目录和音频流，最适合需要自定义播放按钮的免费 provider。
- YouTube IFrame Player：支持播放、暂停、切换和音量，但必须保留官方可见播放器。
- SoundCloud Widget：支持官方嵌入和 JavaScript 控制，是否允许站外播放由上传者决定。
- Bandcamp Embed：适合独立音乐和专辑，控制能力较少。
- 自有音频：在拥有公开播放权时可用 HTML5 `<audio>` 实现完全自定义控制。

不要通过非官方接口接入网易云、QQ 音乐、汽水音乐或其他受保护曲库。

## 验证与发布

```bash
npm test
npm run verify:music-player
npm run build
npm run test:e2e
```

推送并合并到 `main` 后，GitHub Pages workflow 会自动构建和发布，不需要配置 `PUBLIC_MUSIC_WORKER_URL` 或任何 Spotify secret。
