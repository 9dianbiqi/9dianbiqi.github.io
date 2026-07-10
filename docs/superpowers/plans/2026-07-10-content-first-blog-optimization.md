# Content-First Blog Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Astro site into a content-first technical blog by compacting long article directories, adding a searchable/filterable archive, and replacing project-oriented homepage sections with recent posts and topic entry points.

**Architecture:** Keep static Astro rendering as the source of truth, isolate data transformation in small `.mjs` helpers that can be tested directly with Node, and use progressively enhanced client scripts only for archive filtering and active table-of-contents state. Existing design tokens and accessibility foundations remain; new components replace homepage information architecture without adding dependencies.

**Tech Stack:** Astro 7, TypeScript, framework-free browser scripts, Node assertion verifiers, CSS.

## Global Constraints

- Do not add third-party runtime dependencies.
- Do not add dark mode, comments, analytics, a newsletter, backend search, or pagination.
- Keep the existing teal/warm-white/clay visual identity and `16px` body baseline.
- Preserve the skip link, visible keyboard focus, responsive images, and reduced-motion support.
- Keep all work uncommitted until the user approves the running preview.
- Verify at `1440×900`, `768×900`, and `375×812`; no page-level horizontal overflow is allowed.

---

### Task 1: Nested article directory data and component

**Files:**
- Create: `src/lib/toc.mjs`
- Create: `scripts/verify-toc.mjs`
- Create: `src/components/ArticleToc.astro`
- Create: `src/scripts/article-toc.ts`
- Modify: `src/pages/blog/[...slug].astro`
- Modify: `package.json`

**Interfaces:**
- Consumes: Astro rendered headings shaped as `{ depth: number; slug: string; text: string }`.
- Produces: `buildToc(headings): TocItem[]`, `ArticleToc` props `{ items: TocItem[] }`, and browser behavior keyed by `[data-article-toc]` and `[data-toc-link]`.

- [ ] **Step 1: Write the failing pure-data verification**

```js
import assert from 'node:assert/strict';
import { buildToc } from '../src/lib/toc.mjs';

const result = buildToc([
  { depth: 2, slug: 'alpha', text: 'Alpha' },
  { depth: 3, slug: 'alpha-one', text: 'Alpha one' },
  { depth: 3, slug: 'orphan', text: 'Orphan' },
  { depth: 4, slug: 'ignored', text: 'Ignored' },
  { depth: 2, slug: 'beta', text: 'Beta' },
]);

assert.deepEqual(result, [
  {
    depth: 2,
    slug: 'alpha',
    text: 'Alpha',
    children: [
      { depth: 3, slug: 'alpha-one', text: 'Alpha one' },
      { depth: 3, slug: 'orphan', text: 'Orphan' },
    ],
  },
  { depth: 2, slug: 'beta', text: 'Beta', children: [] },
]);
assert.deepEqual(buildToc([{ depth: 3, slug: 'solo', text: 'Solo' }]), [
  { depth: 2, slug: 'solo', text: 'Solo', children: [] },
]);
```

- [ ] **Step 2: Run the test and confirm the missing-module failure**

Run: `node scripts/verify-toc.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/toc.mjs`.

- [ ] **Step 3: Implement the minimal heading normalizer**

```js
export function buildToc(headings) {
  const items = [];
  for (const heading of headings) {
    if (heading.depth === 2) {
      items.push({ ...heading, depth: 2, children: [] });
    } else if (heading.depth === 3) {
      const parent = items.at(-1);
      if (parent) parent.children.push({ ...heading, depth: 3 });
      else items.push({ ...heading, depth: 2, children: [] });
    }
  }
  return items;
}
```

- [ ] **Step 4: Run the pure-data verification**

Run: `node scripts/verify-toc.mjs`

Expected: PASS with `TOC checks passed.`.

- [ ] **Step 5: Add the responsive Astro component and client behavior**

The component must render nothing for an empty `items` array. Otherwise it renders one native `<details class="toc" data-article-toc>` with summary text `文章目录` and a top-level ordered hierarchy. Child lists use nested `<details class="toc-group">` only when children exist. Each anchor has `data-toc-link` and an exact heading fragment.

The client script must:

```ts
const toc = document.querySelector<HTMLElement>('[data-article-toc]');
const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]')];
const headings = links
  .map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1))))
  .filter((heading): heading is HTMLElement => Boolean(heading));

const setActive = (id: string) => {
  for (const link of links) {
    const active = decodeURIComponent(link.hash.slice(1)) === id;
    link.toggleAttribute('aria-current', active);
  }
};
```

Use `IntersectionObserver` when available, close the outer disclosure after link activation below `981px`, and reinitialize after `astro:page-load` so view transitions remain supported.

- [ ] **Step 6: Integrate the component into the article renderer**

Replace the flat heading filter with `buildToc(headings)` and replace the inline `<aside>` with `<ArticleToc items={toc} />`. Render metadata separators as `<span class="article-meta-separator" aria-hidden="true">·</span>` so they can be hidden at mobile breakpoints.

- [ ] **Step 7: Add and run the package verifier**

Add `"verify:toc": "node scripts/verify-toc.mjs"` to `package.json`, then run `npm run verify:toc`.

Expected: PASS.

---

### Task 2: Archive matching logic and progressive filter UI

**Files:**
- Create: `src/lib/archiveFilter.mjs`
- Create: `scripts/verify-archive-filter.mjs`
- Create: `src/scripts/archive-filter.ts`
- Modify: `src/pages/blog/index.astro`
- Modify: `package.json`

**Interfaces:**
- Consumes: rendered post attributes `data-search-text`, `data-tags`, URL parameters `q` and `tag`.
- Produces: `normalizeSearchText(value)`, `matchesArchivePost(post, filters)`, live count, pressed tag state, and no-results state.

- [ ] **Step 1: Write the failing matching tests**

```js
import assert from 'node:assert/strict';
import { matchesArchivePost, normalizeSearchText } from '../src/lib/archiveFilter.mjs';

assert.equal(normalizeSearchText('  Astro 前端  '), 'astro 前端');
const post = {
  searchText: 'vpn 入门 网络 安全',
  tags: ['VPN', '安全'],
};
assert.equal(matchesArchivePost(post, { query: 'vpn', tag: '' }), true);
assert.equal(matchesArchivePost(post, { query: '入门', tag: '安全' }), true);
assert.equal(matchesArchivePost(post, { query: '数据库', tag: '' }), false);
assert.equal(matchesArchivePost(post, { query: '', tag: '数据库' }), false);
```

- [ ] **Step 2: Run and confirm RED**

Run: `node scripts/verify-archive-filter.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the matching helper**

```js
export const normalizeSearchText = (value = '') =>
  value.trim().toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ');

export function matchesArchivePost(post, { query = '', tag = '' } = {}) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedTag = normalizeSearchText(tag);
  const queryMatch = !normalizedQuery || normalizeSearchText(post.searchText).includes(normalizedQuery);
  const tagMatch =
    !normalizedTag || post.tags.some((candidate) => normalizeSearchText(candidate) === normalizedTag);
  return queryMatch && tagMatch;
}
```

- [ ] **Step 4: Run and confirm GREEN**

Run: `node scripts/verify-archive-filter.mjs`

Expected: PASS with `Archive filter checks passed.`.

- [ ] **Step 5: Render filter controls and compact cards**

The archive page must derive sorted unique tags and render:

```astro
<section class="archive-tools" data-archive-tools>
  <label for="archive-search">搜索文章</label>
  <input id="archive-search" type="search" data-archive-search autocomplete="off" />
  <div class="archive-tags" aria-label="按标签筛选">
    <button type="button" data-archive-tag="" aria-pressed="true">全部</button>
    {tags.map((tag) => <button type="button" data-archive-tag={tag} aria-pressed="false">{tag}</button>)}
  </div>
  <p data-archive-count aria-live="polite">共 {posts.length} 篇文章</p>
</section>
```

Each card gets normalized search and tag data, displays only `post.data.tags.slice(0, 3)`, and includes `+{post.data.tags.length - 3}` when more tags exist. The empty state includes a real reset button and is hidden by default.

- [ ] **Step 6: Add progressive browser filtering**

Initialize from `?q=` and `?tag=`, ignore unknown tags, debounce search by `150ms`, set `hidden` on unmatched cards, update `aria-pressed`, live count, no-results visibility, and URL parameters with `history.replaceState`. The reset button clears the input, selected tag, URL parameters, and all hidden states.

- [ ] **Step 7: Register and run the package verifier**

Add `"verify:archive-filter": "node scripts/verify-archive-filter.mjs"`, then run it.

Expected: PASS.

---

### Task 3: Content-led homepage data and components

**Files:**
- Create: `src/lib/homeContent.mjs`
- Create: `scripts/verify-home-content.mjs`
- Create: `src/components/RecentPosts.astro`
- Create: `src/components/TopicGrid.astro`
- Modify: `src/components/HomeHero.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/site.config.ts`
- Modify: `scripts/verify-home-config.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: sorted published posts and exact topic configuration `{ tag, description }[]`.
- Produces: `getRecentPosts(posts, limit)`, `getFeaturedTopics(posts, topicConfig)`, homepage props, and exact `/blog/?tag=` links.

- [ ] **Step 1: Write failing homepage-data tests**

```js
import assert from 'node:assert/strict';
import { getFeaturedTopics, getRecentPosts } from '../src/lib/homeContent.mjs';

const posts = [
  { id: 'new', data: { pubDate: new Date('2026-07-10'), tags: ['安全'] } },
  { id: 'old', data: { pubDate: new Date('2026-07-01'), tags: ['云原生', '安全'] } },
];
assert.deepEqual(getRecentPosts(posts, 1).map((post) => post.id), ['new']);
assert.deepEqual(
  getFeaturedTopics(posts, [
    { tag: '安全', description: '身份与边界' },
    { tag: '数据库', description: '数据基础' },
  ]),
  [{ tag: '安全', description: '身份与边界', count: 2, href: '/blog/?tag=%E5%AE%89%E5%85%A8' }],
);
```

- [ ] **Step 2: Run and confirm RED**

Run: `node scripts/verify-home-content.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the homepage helpers**

`getRecentPosts` sorts a copy by descending `pubDate` and slices to the requested limit. `getFeaturedTopics` counts exact tag matches, drops zero-count topics, and generates encoded archive URLs.

- [ ] **Step 4: Run and confirm GREEN**

Run: `node scripts/verify-home-content.mjs`

Expected: PASS with `Homepage content checks passed.`.

- [ ] **Step 5: Update homepage copy and dynamic hero action**

Use:

```ts
eyebrow: 'Frontend / Cloud / Data / Security',
title: '把复杂技术整理成可以随时回看的清晰笔记。',
description: '记录前端工程、云基础设施、数据库与安全实践，把学习过程沉淀成可检索、可复用的个人知识库。',
```

Pass the latest-post URL into `HomeHero` so the primary action reads `阅读最新文章`; secondary action reads `浏览全部文章`.

- [ ] **Step 6: Replace project-oriented sections**

Render `<RecentPosts posts={getRecentPosts(posts, 3)} />` and `<TopicGrid topics={getFeaturedTopics(posts, home.topics)} />`. Remove `LearningPath` and `ImageStrip` from `src/pages/index.astro` only; leave their files untouched because the removal is not required for correctness.

- [ ] **Step 7: Update and run homepage verifiers**

Update `scripts/verify-home-config.mjs` to require `RecentPosts`, `TopicGrid`, the new copy, and absence of those legacy imports in the homepage. Add and run `verify:home-content`.

Expected: both homepage verification scripts PASS.

---

### Task 4: Navigation state, metadata wrapping, and UI structure checks

**Files:**
- Create: `scripts/verify-content-first-ui.mjs`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/pages/blog/[...slug].astro`
- Modify: `package.json`

**Interfaces:**
- Consumes: `Astro.url.pathname`.
- Produces: exact active-state booleans, `aria-current="page"`, structural assertions covering the three priority areas.

- [ ] **Step 1: Write a failing structural verifier**

The verifier reads source files and asserts:

```js
assert.match(layout, /const isHome = pathname === '\/'/);
assert.match(layout, /const isBlog = pathname\.startsWith\('\/blog\/'\)/);
assert.match(layout, /aria-current=\{isHome \? 'page' : undefined\}/);
assert.match(layout, /aria-current=\{isBlog \? 'page' : undefined\}/);
assert.match(articlePage, /<ArticleToc items=\{toc\}/);
assert.match(blogIndex, /data-archive-search/);
assert.match(homePage, /RecentPosts/);
assert.match(homePage, /TopicGrid/);
```

- [ ] **Step 2: Run and confirm RED**

Run: `node scripts/verify-content-first-ui.mjs`

Expected: FAIL because active navigation and new components are not yet present.

- [ ] **Step 3: Implement route-derived navigation state**

```astro
const pathname = Astro.url.pathname;
const isHome = pathname === '/';
const isBlog = pathname.startsWith('/blog/');
```

Set `aria-current={isHome ? 'page' : undefined}` and `aria-current={isBlog ? 'page' : undefined}` on the two internal navigation links.

- [ ] **Step 4: Run and confirm GREEN**

Run: `node scripts/verify-content-first-ui.mjs`

Expected: PASS with `Content-first UI checks passed.`.

- [ ] **Step 5: Register the verifier**

Add `"verify:content-first-ui": "node scripts/verify-content-first-ui.mjs"` to `package.json`.

---

### Task 5: Responsive visual system and long-guide heading semantics

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/content/blog/linux-export-mysql-postgresql-beginner-checklist.md`

**Interfaces:**
- Consumes: component classes and data attributes from Tasks 1–4.
- Produces: stable desktop/mobile layouts with no page-level overflow.

- [ ] **Step 1: Add a failing style-contract assertion**

Extend `scripts/verify-content-first-ui.mjs` to require `.archive-tools`, `.archive-search`, `.recent-posts`, `.topic-grid`, `.toc[open]`, `[aria-current='page']`, `[aria-current='location']`, `max-height:calc(100vh - 128px)`, and the mobile archive title selector.

- [ ] **Step 2: Run and confirm RED**

Run: `npm run verify:content-first-ui`

Expected: FAIL on the first missing style contract.

- [ ] **Step 3: Implement desktop styles**

Add exact component selectors using existing color, radius, shadow, and spacing variables. Guide directories use `max-height: calc(100vh - 128px); overflow-y: auto;`. Archive controls use a bordered warm surface; filter buttons meet `44px` height. Recent content uses one emphasized row and a two-column remainder. Active navigation uses background plus an inset bottom indicator.

- [ ] **Step 4: Implement responsive styles**

At `<=980px`, directory disclosures are static and recent-post grids collapse. At `<=640px`, archive `h2` uses `font-size: 1.45rem; line-height: 1.22;`, descriptions clamp to two lines, topic cards become one column, metadata separators are hidden, and all controls stay at least `44px` high.

- [ ] **Step 5: Normalize the long guide's child headings**

Change only headings that are clearly numbered children of an immediately preceding section from `##` to `###`. Preserve all heading text and paragraph content. Rebuild the generated TOC and ensure no duplicate IDs are introduced.

- [ ] **Step 6: Run the style and TOC verifiers**

Run: `npm run verify:content-first-ui && npm run verify:toc`.

Expected: PASS.

---

### Task 6: Full verification and local preview

**Files:**
- Modify only if verification reveals a defect in scoped implementation files.

**Interfaces:**
- Consumes: completed implementation.
- Produces: fresh test/build evidence and a running local preview for user review.

- [ ] **Step 1: Install exact locked dependencies**

Run: `npm ci`

Expected: exit code `0` with no lockfile change.

- [ ] **Step 2: Run all repository verification scripts**

Run each `verify:*` script from `package.json`, including the four new scripts.

Expected: every script exits `0` and prints its success message.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: `astro check` reports zero errors and `astro build` exits `0`.

- [ ] **Step 4: Start the preview server**

Run: `npm run preview -- --host 127.0.0.1`

Expected: local site is reachable at the printed port.

- [ ] **Step 5: Inspect the required routes and viewports**

Check `/`, `/blog/`, `/blog/linux-export-mysql-postgresql-beginner-checklist/`, and `/blog/cloud-object-storage-basics/` at `1440×900`, `768×900`, and `375×812`. Verify search, tag selection, URL restoration, reset, no-results state, TOC disclosure, TOC link navigation, active navigation, metadata wrapping, and absence of horizontal page overflow.

- [ ] **Step 6: Audit the uncommitted change set**

Run: `git status --short`, `git diff --check`, and `git diff --stat`.

Expected: only scoped source, verifier, spec, and plan files are modified or untracked; no commit exists beyond the cloned `origin/main` HEAD.

- [ ] **Step 7: Hand off the preview**

Provide the local preview URL, a concise change summary, test/build evidence, and explicit confirmation that nothing has been committed. Wait for user review before any commit.
