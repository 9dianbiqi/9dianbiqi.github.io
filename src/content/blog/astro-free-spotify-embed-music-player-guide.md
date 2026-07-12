---
title: 从 Premium OAuth 到免费 Embed：在 Astro 博客实现多平台音乐播放器
description: 记录一个 Astro 博客音乐播放器从 Spotify OAuth 与 Web Playback SDK，演进为免费官方 Embed 的完整设计、测试与发布过程。
pubDate: 2026-07-12
articleLayout: guide
tags:
  - Astro
  - Web Component
  - Spotify
  - 前端工程
readingTime: 12 分钟
---

我最初想做的并不是一个复杂的音乐服务，而是一个适合个人博客的播放器：

- 固定在页面右下角，不打断阅读。
- 可以自定义外壳、颜色、圆角和展开按钮。
- 在 Spotify 与汽水音乐之间切换。
- Astro 页面跳转时不销毁播放器。
- 不自动播放，也不把平台密钥暴露给浏览器。

真正开始实现后，我发现“在博客里播放音乐”至少包含三类完全不同的问题：界面、平台能力和内容授权。尤其是 Spotify，能展示歌单与能控制完整播放并不是一回事。

这篇文章记录最终方案，也记录为什么我删除了第一版已经完成的 OAuth 与 Cloudflare Worker。

## 先定义边界：播放器不等于音乐平台

播放器只负责统一交互，不应该假设每个平台都提供相同能力。

项目中的 provider 统一描述五种能力：站内播放、拖动进度、音量、上一首与下一首、外部打开。Spotify 官方 Embed 可以站内播放，但内部控制属于 Spotify iframe；汽水音乐没有适合本项目的官方网页播放接口，所以只提供外部打开。

| 来源 | 站内播放 | 自定义播放按钮 | 自定义队列 | 外部打开 |
| --- | --- | --- | --- | --- |
| Spotify Embed | 支持 | 不支持 iframe 内部按钮重绘 | 由公开歌单维护 | 支持 |
| 汽水音乐 | 不使用非官方音频接口 | 不支持 | 博客内配置展示 | 支持 |
| 自有音频 | 支持 | 完全支持 | 完全支持 | 可选 |

这个能力表很重要。它阻止界面为了“看起来统一”而伪造平台实际上不支持的操作。

## 第一版：OAuth、Web Playback SDK 与 Worker

第一版目标更激进：博主登录 Spotify 后，在博客内使用自定义按钮播放完整歌曲；访客只浏览公开目录并跳转 Spotify。

为避免 refresh token 进入浏览器，我设计了独立的 Cloudflare Worker：

1. 浏览器访问 Worker 的 OAuth 起点。
2. Worker 生成十分钟有效的 state。
3. Spotify 回调后，Worker 调用 `/me` 校验登录用户是不是站点所有者。
4. Durable Object 保存 refresh token、一次性 code 和七天会话。
5. Workers KV 缓存公开歌单。
6. 浏览器只保存随机会话令牌。

这一版还包含 401、403、429、Premium 失效、SDK 初始化失败与网络中断的降级处理。失败时队列仍然保留，主操作改为跳转 Spotify。

从工程角度看，它是完整的；从个人博客角度看，它太重了。

## 为什么删除已经完成的 OAuth 方案

Spotify 当前的开发模式要求应用所有者保持 Premium。Web Playback SDK 的完整站内播放同样面向 Premium 用户。

这意味着我不仅要维护：

- Spotify Client ID 与 Client Secret。
- OAuth redirect URI。
- Cloudflare Worker、KV 与 Durable Object。
- 会话过期、撤销、跨域和限流。

还必须持续支付 Premium 订阅。对于一个只想在文章旁边放音乐的个人博客，这些成本不成比例。

于是我重新比较了三个方案。

| 方案 | 费用 | 运维复杂度 | 样式自由度 | 完整播放控制 |
| --- | --- | --- | --- | --- |
| Web Playback SDK | 需要 Premium | 高 | 高 | 高 |
| Spotify 官方 Embed | 无开发者订阅要求 | 低 | 外壳可定制 | iframe 内控制 |
| 只展示链接 | 免费 | 最低 | 高 | 无站内播放 |

最终选择官方 Embed：保留自定义悬浮外壳，把真正的播放交还给 Spotify。

## 最终架构：静态博客也能完成

最终版本不需要服务端。

| 层级 | 职责 | 主要文件 |
| --- | --- | --- |
| Astro 页面 | 全站挂载并保持组件 | `BaseLayout.astro` |
| Web Component | 来源切换、展开状态、汽水队列 | `music-player.ts` |
| Spotify 边界 | 校验公开歌单并生成 Embed URL | `spotify-embed.ts` |
| 配置 | Spotify 歌单与汽水分享链接 | `music.config.ts` |
| 状态仓库 | 恢复来源、歌曲与展开状态 | `store.ts` |
| 测试 | 域逻辑、组件、真实浏览器 | Vitest 与 Playwright |

数据流也变得很短：

> TypeScript 配置 → Astro 构建校验 → Web Component → Spotify 官方 iframe 或汽水官方分享链接

没有 OAuth 回调，没有 refresh token，也没有 Worker URL。

## 严格校验 Spotify 歌单地址

免费方案并不意味着把任意 iframe 地址塞进页面。

配置只接受形如 `https://open.spotify.com/playlist/{playlistId}` 的公开歌单地址，并检查：

- 必须使用 HTTPS。
- 主机名必须严格等于 `open.spotify.com`。
- 路径必须恰好是 `/playlist/{playlistId}`。
- playlist ID 只能包含字母和数字。

查询参数会被移除，最后只根据通过验证的 ID 生成 `https://open.spotify.com/embed/playlist/{playlistId}`。

这条边界同时解决两个问题：错误配置会在构建阶段失败，Shadow DOM 也不会注入任意第三方 iframe。

## Web Component 负责外壳，不冒充 Spotify

播放器采用原生 Web Component，而不是绑定某个前端框架。

这样做适合 Astro：

- 组件只注册一次。
- Shadow DOM 隔离播放器样式。
- CSS 变量控制背景、文字、强调色、阴影和圆角。
- `::part()` 暴露外壳、来源切换、Embed、队列和歌曲行。
- 自定义元素可以被 Astro 的页面过渡直接持久化。

当来源是 Spotify 时，紧凑卡片只显示歌单名称和“Spotify 官方播放”。展开后才展示官方 iframe。

当来源是汽水音乐时，播放器显示站内配置的歌曲列表，主按钮固定为“在汽水音乐打开”。它不会请求私有 API，也不会解析音频直链。

## Astro 页面切换为什么不会重建播放器

播放器挂载在全站 `BaseLayout.astro`，并使用 `transition:persist="music-player"`。

普通客户端导航发生时，Astro 会复用同一个自定义元素实例，而不是销毁后重新创建。这带来几个直接结果：

- 展开状态保持。
- 当前来源保持。
- Spotify iframe 不会因为每次点文章而重新创建。
- Web Component 的事件监听不会重复绑定。

完整刷新时，站点从 `localStorage` 恢复来源、当前汽水歌曲和展开状态，但不会自动触发播放。是否开始播放仍然由用户点击决定。

## 切换来源时保持诚实

不同音乐平台的 ID、曲库和授权都不同，因此切换来源时不做跨平台歌曲匹配。

从 Spotify 切到汽水音乐后：

1. provider 状态改变。
2. 选择汽水配置中的第一首歌曲。
3. Spotify iframe 仍由官方组件管理。
4. 汽水操作始终打开官方 HTTPS 分享页。

这比根据标题和歌手“猜测同一首歌”可靠，也避免把错误版本推荐给访客。

## 可访问性不是最后补上的装饰

播放器从一开始就按键盘和触控使用：

- 交互按钮至少 44×44px。
- 来源切换使用 `tablist` 和 `tab` 语义。
- `ArrowLeft`、`ArrowRight`、`Home`、`End` 可以切换来源。
- 当前来源使用 `aria-selected`。
- 展开按钮同步 `aria-expanded`。
- 焦点使用明显的 `:focus-visible` 轮廓。
- 移动端变为全宽底部抽屉。

Spotify iframe 的标题来自配置，媒体权限只包含官方 Embed 需要的播放、剪贴板、加密媒体、全屏和画中画能力。

## 测试驱动的实现顺序

这次实现没有先写完整组件再补测试，而是按 RED、GREEN、REFACTOR 推进。

### 先验证 URL 边界

测试先导入不存在的 `spotify-embed` 模块，确认失败原因是目标能力尚未实现；然后补最小 URL 解析与 Embed 转换函数。

测试覆盖官方 HTTPS 歌单、HTTP、错误域名、单曲链接和非法 ID。

### 再替换播放器行为

组件测试先要求：

- 存在 `iframe[data-spotify-embed]`。
- 不存在 Spotify 登录按钮。
- 不存在自定义 Spotify 音量和播放按钮。
- 非 Spotify URL 不会渲染 iframe。

旧实现会按预期失败。随后才删除 `SpotifyProvider`、SDK 加载、OAuth code 兑换和目录请求。

### 最后删除基础设施

静态验证脚本先增加规则：`worker/` 必须不存在、构建 workflow 不能再读取 `PUBLIC_MUSIC_WORKER_URL`、播放器源码不能包含 `SpotifyProvider`。

验证失败后，再删除 Worker、Wrangler、Cloudflare 测试依赖和部署变量。

这种顺序能证明删除不是“看起来没用了”，而是新架构已经用自动化规则明确排除了它。

## 自动化验证覆盖了什么

最终验证分为四层：

| 层级 | 验证内容 |
| --- | --- |
| Vitest | URL 校验、状态恢复、provider 能力、汽水配置和组件行为 |
| 静态脚本 | Astro 挂载、`transition:persist`、无 Worker 残留 |
| Astro build | frontmatter、TypeScript、组件和静态路由 |
| Playwright | 桌面／移动布局、来源切换、键盘操作、页面持久化 |

上线前的核心命令是 `npm test`、`npm run verify:music-player`、`npm run build` 和 `npm run test:e2e`。

本次自动化结果为 18 个播放器测试、2 个浏览器测试，以及 16 个静态页面成功构建；Astro 诊断为 0 errors、0 warnings。

## 发布到 GitHub Pages

发布流程保持纯静态：

1. 功能分支完成测试。
2. 推送分支并创建 PR。
3. PR squash 合并到 `main`。
4. `Deploy to GitHub Pages` workflow 自动执行。
5. 线上检查首页是否包含 `<music-player>` 和公开歌单配置。

GitHub Actions 不需要 Spotify secret，也不需要 `PUBLIC_MUSIC_WORKER_URL`。

如果要更换歌单，只需修改 `src/music.config.ts` 中的 `spotify.playlistUrl`。只要仍是公开 Spotify playlist URL，构建会自动生成正确 Embed 地址。

## 汽水音乐配置原则

汽水歌曲配置包含稳定 ID、标题、艺人、站内封面和官方分享链接。

链接必须是绝对 HTTPS URL。不要填入 Cookie、抓包接口、私有 API 或受保护音频地址。

这种设计看起来没有“直接播放”那么炫，但它在版权、稳定性和维护成本之间更合理。

## 还可以接入哪些免费来源

统一 provider 能力层为后续扩展留出了空间：

- Audius：开放目录和音频流，适合真正自定义的网页播放器。
- YouTube IFrame Player：控制能力较完整，但必须保留可见视频播放器。
- SoundCloud Widget：支持官方嵌入与 JavaScript 控制，播放权限由上传者决定。
- Bandcamp Embed：适合独立音乐人与专辑。
- 自有音频：拥有公开播放权时，可用 HTML5 Audio 完全自定义。

网易云、QQ 音乐和汽水音乐不应该依赖来路不明的非官方音频接口。能请求到地址，不等于可以稳定、合规地使用。

## 这次重构最重要的收获

第一版并不是“写错了”，它只是解决了比博客真正需要的问题更大的问题。

重构后的判断标准很简单：

1. 平台官方支持什么，就展示什么。
2. 不为了自定义按钮引入长期付费和服务端运维。
3. 安全边界尽量前移到构建阶段。
4. 用测试证明旧基础设施可以删除。
5. 保持正文阅读和音乐体验互不干扰。

对于个人博客，最好的插件不一定是能力最多的插件，而是那个半年后仍然不需要你半夜维护 token、回调和限流的插件。
