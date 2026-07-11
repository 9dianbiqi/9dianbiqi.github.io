# 9dianbiqi Astro Blog

这是一个使用 Astro 生成、通过 GitHub Pages 发布的个人技术博客。

## 本地开发

```bash
npm install
npm run dev
```

## 构建验证

```bash
npm run build
```

## 音乐播放器

博客包含一个可定制的全站悬浮 Web Component 播放器：

- Spotify：公开目录与外链；博主 OAuth 登录后启用 Web Playback SDK。
- 汽水音乐：读取站内配置并跳转官方分享链接，不使用非官方播放接口。
- Astro 客户端导航期间保持播放器状态，完整刷新后等待用户手动播放。

本地自动化验证：

```bash
npm run test:player
npm run test:worker
npm run typecheck:worker
npm run test:e2e
npm run verify:music-player
```

Spotify、Cloudflare、汽水歌曲配置和部署顺序见 [`docs/music-player-deployment.md`](docs/music-player-deployment.md)。

## 发布

推送到 `main` 分支后，`.github/workflows/deploy.yml` 会使用 Astro 官方 GitHub Action 构建站点，并通过 GitHub Pages 发布到：

https://9dianbiqi.github.io
