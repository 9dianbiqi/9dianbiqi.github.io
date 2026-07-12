# 音乐播放器文章与三栏阅读工作台设计

## 目标

完成两个相互配合的博客改进：

1. 发布一篇面向读者的公开技术文章，完整记录从 Spotify Premium OAuth 方案转向免费官方 Embed 的实现流程。
2. 在宽屏文章页加入左侧固定目录和右侧阅读工具，利用现有空白提升阅读效率，同时保持正文的舒适行长。

## 公开文章

### 发布位置

- 文件：`src/content/blog/astro-free-spotify-embed-music-player-guide.md`
- 标题：《从 Premium OAuth 到免费 Embed：在 Astro 博客实现多平台音乐播放器》
- 模板：`guide`
- 标签：`Astro`、`Web Component`、`Spotify`、`前端工程`
- 状态：公开发布，不设置 `draft`

### 内容结构

文章使用可复现的工程叙事，而不是简单提交日志：

1. 为什么最初选择 Spotify Web API 和 Web Playback SDK。
2. Premium 限制带来的实际问题。
3. 最终免费架构：Astro、持久化 Web Component、Spotify Embed、汽水外跳。
4. 统一 provider 类型与能力边界。
5. Spotify 公开歌单 URL 的严格校验和 Embed URL 生成。
6. Shadow DOM 播放器、CSS 变量、`::part()` 和键盘可访问性。
7. `transition:persist="music-player"` 如何保持页面切换状态。
8. 为什么汽水音乐只使用官方分享链接。
9. TDD 过程、Vitest、Playwright、静态架构验证和构建验证。
10. GitHub Pages 发布流程与更换公开歌单的方法。
11. 已知限制与 Audius、YouTube、SoundCloud 等后续 provider 方向。

文章只展示不含密钥的关键代码片段。Spotify、汽水音乐内容均链接回官方平台，不提供抓包地址、受保护音频 URL 或非官方接口。

## 三栏阅读工作台

### 桌面布局

在视口宽度不小于 1280px 时，文章正文区采用：

```text
220px 左目录 + 32px 间距 + 720px 正文 + 32px 间距 + 220px 右工具
```

- `.article-shell` 最大宽度调整到能容纳三栏，页面居中。
- 正文保持约 680–720px，不通过拉长行宽填满空白。
- 左右栏均使用 `position: sticky`，顶部偏移避开站点导航。
- `note` 模板保持紧凑单栏，不强制显示完整三栏。

### 左侧目录

复用现有 `ArticleToc.astro` 和当前章节高亮逻辑：

- `essay` 与 `guide` 在宽屏都显示左侧固定目录。
- 当前章节继续使用 `aria-current="location"`。
- 目录过长时自身滚动，不推动正文。
- 不复制第二套标题扫描或锚点逻辑。

### 右侧阅读工具

新增 `ArticleReadingRail.astro`，内容严格限制为三组：

1. 阅读进度：百分比、进度条和当前章节名称。
2. 相关文章：按共同标签评分，排除当前文章，最多展示 3 篇。
3. 快捷操作：返回顶部和“全部文章”入口。

右栏不放广告、社交计数、天气、日历或大图，避免分散阅读注意力。

### 相关文章算法

新增纯函数：

```ts
getRelatedPosts(posts, currentPost, limit = 3)
```

规则：

- 排除草稿和当前文章。
- 每个共同标签计 1 分。
- 先按共同标签分数降序。
- 分数相同按 `updatedDate ?? pubDate` 降序。
- 没有共同标签时使用最新文章补足，但仍不超过 3 篇。

### 阅读进度

新增客户端脚本 `article-reading-rail.ts`：

- 以正文顶部到正文底部为计算区间。
- 使用被动 `scroll` 监听和 `requestAnimationFrame` 节流。
- 更新原生 `<progress>`、百分比文本和 `aria-valuenow`。
- 根据当前进入视口的 `h2/h3` 更新章节名称。
- 返回顶部按钮使用原生锚点；在 `prefers-reduced-motion` 下不强制平滑滚动。

## 响应式规则

- `≥ 1280px`：完整三栏。
- `981–1279px`：左目录＋正文；右栏作为正文后的阅读工具卡片。
- `≤ 980px`：单栏；沿用现有可折叠目录，阅读工具放在文章末尾。
- `≤ 640px`：相关文章单列、按钮保持至少 44px 触控高度。

音乐播放器继续固定在右下角。宽屏右栏为播放器预留底部安全空间，避免展开前的悬浮卡片遮挡返回顶部。

## 文件边界

- 修改 `src/pages/blog/[...slug].astro`：计算相关文章并挂载右栏。
- 修改 `src/components/ArticleToc.astro`：只增加三栏所需语义或 class，不重写目录数据。
- 新增 `src/components/ArticleReadingRail.astro`：右栏静态结构。
- 新增 `src/scripts/article-reading-rail.ts`：进度和当前章节。
- 新增 `src/lib/relatedPosts.mjs`：相关文章纯函数。
- 修改 `src/styles/global.css`：三栏与响应式布局。
- 新增公开文章 Markdown。
- 更新相关 Vitest、Playwright 和静态验证脚本。

## 可访问性与性能

- 右栏使用 `aside`，内部导航有明确 `aria-label`。
- 阅读进度同时提供视觉值和可读文本，不只依赖颜色。
- 所有链接和按钮支持键盘操作及可见焦点。
- 相关文章在 Astro 构建阶段计算，不增加浏览器 API 请求。
- 滚动逻辑不持续修改布局尺寸，避免明显重排。
- 移动端不使用固定左右栏。

## 验证

- Vitest：相关文章排序、排除当前文章、无共同标签补足。
- 静态验证：三栏组件挂载、目录保留、公开文章 frontmatter 和播放器文档关键章节。
- Playwright：宽屏三栏、目录固定、进度变化、返回顶部、相关文章、980px 以下单栏。
- 全量执行 `npm test`、`npm run build`、播放器验证、文章布局验证、TOC 验证和端到端测试。
- 记录但不扩大处理现有 `verify:article-visuals` 的七篇历史基线问题。

## 发布

在 `codex/article-reading-workspace` 分支完成实现与验证，推送后创建 PR。合并到 `main` 后由现有 GitHub Pages workflow 自动发布。

