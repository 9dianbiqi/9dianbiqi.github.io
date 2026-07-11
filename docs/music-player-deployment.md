# 音乐播放器配置与部署

播放器由 GitHub Pages 上的 Astro Web Component 和独立 Cloudflare Worker 组成。浏览器不会收到 Spotify refresh token；OAuth state、一次性 code 和七天会话保存在 SQLite-backed Durable Object，公开歌单缓存在 Workers KV。

## 1. 配置 Spotify 应用

1. 在 Spotify Developer Dashboard 创建应用，应用所有者保持 Premium。
2. 配置一个由该账号拥有或协作的 playlist。
3. 将最终 Worker 回调地址加入 Redirect URIs：

   ```text
   https://<worker-domain>/auth/spotify/callback
   ```

4. 记录 Client ID、Client Secret、Spotify owner user ID 和 playlist ID。

播放器请求以下 scopes：`streaming`、`user-read-private`、`user-read-email`、`user-read-playback-state`、`user-modify-playback-state`、`playlist-read-private`、`playlist-read-collaborative`。

## 2. 配置 Cloudflare

在 `worker/wrangler.jsonc` 中：

- 将 `SPOTIFY_REDIRECT_URI` 改为真实 Worker 回调地址。
- 将 `SPOTIFY_PLAYLIST_ID` 改为 owner/collaborative playlist ID。
- 保留正式博客和本地开发地址在 `ALLOWED_ORIGINS` 中。
- 如 Worker 域名改变，同步更新 Spotify Redirect URI。

创建 KV 并把返回的 production ID 写入 `kv_namespaces[0].id`：

```bash
npx wrangler kv namespace create CATALOG --config worker/wrangler.jsonc
```

设置 secrets；命令会交互读取值，不要把值写进 Git：

```bash
npx wrangler secret put SPOTIFY_CLIENT_ID --config worker/wrangler.jsonc
npx wrangler secret put SPOTIFY_CLIENT_SECRET --config worker/wrangler.jsonc
npx wrangler secret put SPOTIFY_OWNER_ID --config worker/wrangler.jsonc
```

本地调试时复制 `worker/.dev.vars.example` 为 `worker/.dev.vars` 并填入测试凭据。该文件已被 Git 忽略。

## 3. 验证并部署 Worker

```bash
npm run typecheck:worker
npm run test:worker
npx wrangler deploy --config worker/wrangler.jsonc
```

部署使用 `v1` Durable Object migration 创建 SQLite-backed `AuthSession`。部署后访问 `/catalog/spotify` 应先得到空目录；这是正常的。

## 4. 连接博客

在 GitHub 仓库 Settings → Secrets and variables → Actions → Variables 中创建：

```text
PUBLIC_MUSIC_WORKER_URL=https://<worker-domain>
```

GitHub Pages workflow 会在 Astro 构建时注入该地址。本地可用同名环境变量运行 Astro。

汽水音乐条目在 `src/music.config.ts` 中维护，只接受绝对 HTTPS 分享链接：

```ts
qishuiTracks: [
  {
    id: 'stable-local-id',
    title: '歌曲名',
    artist: '音乐人',
    coverUrl: '/images/music/example.jpg',
    externalUrl: 'https://<official-qishui-share-url>',
  },
]
```

不要填入抓包地址、Cookie、私有 API 或受保护音频 URL。

## 5. 首次登录与目录刷新

1. 打开博客播放器，展开后点击“博主登录 Spotify”。
2. 登录账号必须与 `SPOTIFY_OWNER_ID` 一致，否则 Worker 返回 403。
3. 登录成功后，使用会话调用：

   ```http
   POST /catalog/spotify/refresh
   Authorization: Bearer <opaque-session-token>
   Origin: https://9dianbiqi.github.io
   ```

   正常 UI 后续会保留同一会话；也可从浏览器开发工具发起该请求完成首次缓存。
4. 刷新博客，未登录访客应能浏览缓存目录并跳转 Spotify；博主登录后显示站内播放控制。

## 6. 发布前检查

```bash
npm run test:player
npm run test:worker
npm run typecheck:worker
npm run test:e2e
npm run verify:music-player
npm run build
```

真实账号冒烟测试需要覆盖：OAuth 回调、owner 拒绝、Spotify 播放/暂停/切歌/音量、目录刷新、汽水外跳、移动端抽屉和 Astro 页面切换持续状态。
