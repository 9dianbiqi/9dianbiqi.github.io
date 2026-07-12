# Article Reading Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布音乐播放器实现流程文章，并为宽屏文章页增加左侧固定目录、右侧阅读进度、相关文章和返回顶部。

**Architecture:** Astro 构建阶段使用纯函数挑选相关文章，页面渲染三栏语义结构；浏览器端小型脚本只负责阅读进度和当前章节。现有目录组件和正文宽度保持为单一事实来源，移动端降级为单栏。

**Tech Stack:** Astro 7、TypeScript 5、原生 JavaScript、CSS Grid、Vitest、Playwright、GitHub Pages

## Global Constraints

- 宽屏正文保持 680–720px，不通过拉长行宽填满空白。
- `≥1280px` 使用 220px／720px／220px 三栏；`981–1279px` 使用目录＋正文；`≤980px` 单栏。
- `note` 模板保持紧凑单栏。
- 右栏只包含阅读进度、最多 3 篇相关文章、返回顶部和全部文章。
- 相关文章在 Astro 构建阶段计算，不增加客户端 API 请求。
- 移动端按钮至少 44px，不使用固定左右栏。
- 新文章不增加 `verify:article-visuals` 历史失败数量。

---

### Task 1: 相关文章与阅读进度纯函数

**Files:**
- Create: `src/lib/relatedPosts.mjs`
- Create: `src/lib/relatedPosts.test.ts`
- Create: `src/lib/articleReading.mjs`
- Create: `src/lib/articleReading.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `getRelatedPosts(posts, currentPost, limit = 3)`
- Produces: `calculateReadingProgress(scrollY, articleTop, articleHeight, viewportHeight)`

- [ ] **Step 1: 写入相关文章排序和阅读进度失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { getRelatedPosts } from './relatedPosts.mjs';
import { calculateReadingProgress } from './articleReading.mjs';

const post = (id: string, tags: string[], date: string, draft = false) => ({
  id,
  data: { tags, pubDate: new Date(date), draft, title: id },
});

it('ranks shared tags, excludes current and drafts, then fills by recency', () => {
  const current = post('current', ['Astro', 'Spotify'], '2026-07-12');
  const result = getRelatedPosts([
    current,
    post('two-tags', ['Astro', 'Spotify'], '2026-07-01'),
    post('one-new', ['Astro'], '2026-07-10'),
    post('one-old', ['Spotify'], '2026-06-01'),
    post('draft', ['Astro', 'Spotify'], '2026-07-11', true),
  ], current, 3);
  expect(result.map(({ id }) => id)).toEqual(['two-tags', 'one-new', 'one-old']);
});

it('clamps reading progress between zero and one hundred', () => {
  expect(calculateReadingProgress(0, 100, 1000, 500)).toBe(0);
  expect(calculateReadingProgress(350, 100, 1000, 500)).toBe(50);
  expect(calculateReadingProgress(900, 100, 1000, 500)).toBe(100);
});
```

- [ ] **Step 2: 运行测试并确认模块不存在**

Run: `npx vitest run src/lib/relatedPosts.test.ts src/lib/articleReading.test.ts`

Expected: FAIL，提示无法解析两个新模块。

- [ ] **Step 3: 实现纯函数并把内容测试加入 npm test**

```js
export function getRelatedPosts(posts, currentPost, limit = 3) {
  const currentTags = new Set(currentPost.data.tags ?? []);
  return posts
    .filter((post) => post.id !== currentPost.id && !post.data.draft)
    .map((post) => ({
      post,
      score: (post.data.tags ?? []).filter((tag) => currentTags.has(tag)).length,
      date: new Date(post.data.updatedDate ?? post.data.pubDate).getTime(),
    }))
    .sort((a, b) => b.score - a.score || b.date - a.date)
    .slice(0, Math.max(0, limit))
    .map(({ post }) => post);
}
```

```js
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function calculateReadingProgress(scrollY, articleTop, articleHeight, viewportHeight) {
  const distance = Math.max(1, articleHeight - viewportHeight);
  return Math.round(clamp((scrollY - articleTop) / distance, 0, 1) * 100);
}
```

在 `package.json` 增加 `test:content`，并把 `test` 改为依次运行播放器与内容测试。

- [ ] **Step 4: 运行测试并确认通过**

Run: `npm test`

Expected: 播放器 18 个测试和新增内容测试全部 PASS。

- [ ] **Step 5: 提交纯函数**

```bash
git add package.json src/lib/relatedPosts.mjs src/lib/relatedPosts.test.ts src/lib/articleReading.mjs src/lib/articleReading.test.ts
git commit -m "feat: add article reading helpers"
```

### Task 2: 三栏语义结构与相关文章

**Files:**
- Create: `src/components/ArticleReadingRail.astro`
- Modify: `src/pages/blog/[...slug].astro`
- Modify: `src/styles/global.css`
- Modify: `scripts/verify-article-layouts.mjs`

**Interfaces:**
- Consumes: `getRelatedPosts(posts, currentPost, 3)`
- Produces: `ArticleReadingRail.astro` props `relatedPosts`
- Produces DOM hooks: `data-reading-rail`、`data-reading-progress`、`data-reading-current`

- [ ] **Step 1: 先扩展静态验证，要求右栏挂载和三栏 token**

```js
assert.match(page, /import ArticleReadingRail/);
assert.match(page, /<ArticleReadingRail relatedPosts={relatedPosts}/);
assert.match(styles, /grid-template-columns:\\s*220px minmax\\(0,\\s*720px\\) 220px/);
assert.match(rail, /data-reading-progress/);
assert.match(rail, /相关文章/);
```

- [ ] **Step 2: 运行静态验证并确认失败**

Run: `npm run verify:article-layouts`

Expected: FAIL，提示页面尚未导入 `ArticleReadingRail`。

- [ ] **Step 3: 实现右栏组件和构建期相关文章**

`ArticleReadingRail.astro` 渲染：

```astro
<aside class="reading-rail" data-reading-rail aria-label="阅读工具">
  <section class="reading-progress-card" aria-labelledby="reading-progress-title">
    <span id="reading-progress-title">阅读进度</span>
    <strong data-reading-percent>0%</strong>
    <progress data-reading-progress max="100" value="0">0%</progress>
    <p data-reading-current>文章开头</p>
  </section>
  <nav aria-label="相关文章">
    <h2>相关文章</h2>
    <ul>{relatedPosts.map((post) => <li><a href={`/blog/${post.id}/`}>{post.data.title}</a></li>)}</ul>
  </nav>
  <nav class="reading-actions" aria-label="文章快捷操作">
    <a href="#article-top">返回顶部</a>
    <a href="/blog/">全部文章</a>
  </nav>
</aside>
```

`getStaticPaths()` 在每篇文章 props 中加入 `relatedPosts: getRelatedPosts(posts, post, 3)`，文章根节点增加 `id="article-top"`，正文网格按目录、正文、右栏顺序渲染。

- [ ] **Step 4: 添加三档响应式 CSS**

宽屏核心规则：

```css
@media (min-width: 1280px) {
  .article-shell:not(.post-template-note) { max-width: 1264px; }
  .article-shell:not(.post-template-note) .article-layout {
    grid-template-columns: 220px minmax(0, 720px) 220px;
    gap: 32px;
    align-items: start;
  }
  .toc-shell, .reading-rail {
    position: sticky;
    top: 92px;
    max-height: calc(100vh - 116px);
  }
}
```

在 981–1279px 右栏跨正文列显示；≤980px 所有内容单栏；`note` 保持原样。

- [ ] **Step 5: 运行静态验证和构建**

Run: `npm run verify:article-layouts && npm run build`

Expected: 静态验证 PASS；Astro 0 errors、0 warnings，页面构建成功。

- [ ] **Step 6: 提交三栏结构**

```bash
git add src/components/ArticleReadingRail.astro src/pages/blog/[...slug].astro src/styles/global.css scripts/verify-article-layouts.mjs
git commit -m "feat: add three-column article workspace"
```

### Task 3: 阅读进度与当前章节

**Files:**
- Create: `src/scripts/article-reading-rail.ts`
- Modify: `src/components/ArticleReadingRail.astro`
- Modify: `e2e/article-reading-workspace.spec.ts`

**Interfaces:**
- Consumes: `calculateReadingProgress(...)`
- Enhances DOM hooks from Task 2 without changing server-rendered fallback content.

- [ ] **Step 1: 写入宽屏阅读进度和返回顶部 E2E 断言**

```ts
test('shows the three-column reading workspace and updates progress', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/blog/linux-export-mysql-postgresql-beginner-checklist/');
  await expect(page.locator('[data-article-toc]')).toBeVisible();
  await expect(page.locator('[data-reading-rail]')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await expect(page.locator('[data-reading-percent]')).not.toHaveText('0%');
  await page.getByRole('link', { name: '返回顶部' }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(20);
});
```

- [ ] **Step 2: 运行 E2E 并确认进度不变化**

Run: `npx playwright test e2e/article-reading-workspace.spec.ts --reporter=line`

Expected: FAIL，百分比保持 `0%`。

- [ ] **Step 3: 实现 rAF 节流的进度脚本**

脚本查询 `.prose`、`h2[id], h3[id]` 和右栏 hooks；在滚动与 resize 时调用 `calculateReadingProgress`，设置 progress value、百分比文本、`aria-valuenow` 和最后一个越过 140px 阈值的标题。返回顶部保持原生锚点行为。

- [ ] **Step 4: 验证桌面和移动端**

移动端断言 `.article-layout` 为单列、左右栏不 sticky、所有操作链接高度至少 44px。

Run: `npx playwright test e2e/article-reading-workspace.spec.ts --reporter=line`

Expected: 桌面和移动测试全部 PASS。

- [ ] **Step 5: 提交阅读增强**

```bash
git add src/scripts/article-reading-rail.ts src/components/ArticleReadingRail.astro e2e/article-reading-workspace.spec.ts
git commit -m "feat: add article reading progress"
```

### Task 4: 发布播放器实现流程文章

**Files:**
- Create: `src/content/blog/astro-free-spotify-embed-music-player-guide.md`
- Modify: `scripts/verify-article-visuals.mjs` only if the new article exposes a verifier defect; do not whitelist the article.

**Interfaces:**
- Produces public route: `/blog/astro-free-spotify-embed-music-player-guide/`

- [ ] **Step 1: 写入完整 frontmatter 和文章正文**

```yaml
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
```

正文覆盖规格列出的 11 个章节，使用 Mermaid、表格、引用和行内代码表达实现，不添加解释性 fenced code block，确保不扩大文章视觉验证基线。

- [ ] **Step 2: 运行文章与构建验证**

Run: `npm run verify:article-layouts && npm run verify:article-visuals && npm run build`

Expected: 新文章通过 frontmatter 和布局验证；`verify:article-visuals` 仍只报告原有 7 篇文件，不包含新文章；构建成功。

- [ ] **Step 3: 在浏览器测试新文章路由**

Run: `npx playwright test e2e/article-reading-workspace.spec.ts --reporter=line`

Expected: 新文章标题、目录、右栏和相关文章可见。

- [ ] **Step 4: 提交文章**

```bash
git add src/content/blog/astro-free-spotify-embed-music-player-guide.md
git commit -m "docs: publish Spotify embed implementation guide"
```

### Task 5: 全量验证与发布

**Files:**
- Modify: `docs/superpowers/plans/2026-07-12-article-reading-workspace.md`

**Interfaces:**
- Produces: 已发布到 `main` 的公开文章和三栏阅读工作台。

- [ ] **Step 1: 运行全量验证**

```bash
npm test
npm run verify:article-layouts
npm run verify:toc
npm run verify:post-nav
npm run verify:music-player
npm run build
npm run test:e2e -- --reporter=line
git diff --check
```

Expected: 所有功能验证 exit 0；`verify:article-visuals` 单独记录相同 7 篇历史基线。

- [ ] **Step 2: 推送远端功能分支并创建 PR**

以远端最新 `main` 为父提交发布 `codex/article-reading-workspace`，PR 标题使用 `Add article reading workspace and Spotify guide`，说明测试结果和响应式行为。

- [ ] **Step 3: 合并并监看 GitHub Pages**

检查 PR 可合并后使用 squash merge；等待 `Deploy to GitHub Pages` 成功，并验证公开文章 URL HTTP 200、三栏 hooks 存在。

- [ ] **Step 4: 勾选计划并同步最终状态**

提交完成状态，确保远端计划、PR 和线上页面一致。

