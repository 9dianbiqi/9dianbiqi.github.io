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

- Spotify：使用官方公开歌单 Embed，无需 Premium、Client ID、Secret、OAuth 或 Worker。
- 汽水音乐：读取站内配置并跳转官方分享链接，不使用非官方播放接口。
- Astro 客户端导航期间保持播放器实例和展开状态，不自动播放。

本地自动化验证：

```bash
npm run test:player
npm run test:e2e
npm run verify:music-player
```

Spotify 歌单、汽水歌曲和免费站内播放限制见 [`docs/music-player-configuration.md`](docs/music-player-configuration.md)。Spotify iframe 内部样式、完整歌曲播放资格和地区限制由 Spotify 控制。

## 发布

推送到 `main` 分支后，`.github/workflows/deploy.yml` 会使用 Astro 官方 GitHub Action 构建站点，并通过 GitHub Pages 发布到：

https://9dianbiqi.github.io
