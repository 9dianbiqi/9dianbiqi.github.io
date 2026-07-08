# Blog UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the Astro blog UI and add per-article `essay`, `guide`, and `note` layout variants.

**Architecture:** Keep the existing single article renderer and drive variants from Markdown frontmatter. Add a focused verification script, validate the new `layout` field in the Astro content schema, emit a template class from the article page, and implement the refreshed visual language plus variant rules in global CSS.

**Tech Stack:** Astro 7, TypeScript, Astro content collections, plain CSS, Node assertion scripts.

## Global Constraints

- Do not add analytics, comments, search, a newsletter form, a theme switcher, or new dependencies.
- Existing posts must build without requiring every Markdown file to be edited.
- `layout` must support exactly `essay`, `guide`, and `note`, defaulting to `essay`.
- The implementation should be mostly CSS plus the minimum schema/page changes needed for layout variants.
- Preserve the skip link, visible keyboard focus states, reduced-motion handling, and static GitHub Pages output.

---

### Task 1: Article Layout Verification Script

**Files:**
- Create: `scripts/verify-article-layouts.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: current source files as text.
- Produces: `npm run verify:article-layouts`, a fast assertion script used before and after implementation.

- [ ] **Step 1: Write the failing verification script**

Create `scripts/verify-article-layouts.mjs` with assertions for:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(file, 'utf8');

const contentConfig = read('src/content.config.ts');
assert.match(
  contentConfig,
  /layout:\s*z\.enum\(\[\s*['"]essay['"],\s*['"]guide['"],\s*['"]note['"]\s*\]\)\.default\(['"]essay['"]\)/s,
  'Blog content schema should validate layout as essay, guide, or note with essay default',
);

const articlePage = read('src/pages/blog/[...slug].astro');
assert.match(
  articlePage,
  /post-template-\$\{post\.data\.layout\}/,
  'Article page should apply a post-template-${post.data.layout} class',
);

const styles = read('src/styles/global.css');
for (const selector of ['.post-template-essay', '.post-template-guide', '.post-template-note']) {
  assert.ok(styles.includes(selector), `global.css should define ${selector}`);
}
for (const selector of ['.prose blockquote', '.prose table', '.toc a']) {
  assert.ok(styles.includes(selector), `global.css should style ${selector}`);
}

const objectStoragePost = read('src/content/blog/cloud-object-storage-basics.md');
assert.match(
  objectStoragePost,
  /^layout:\s*guide$/m,
  'cloud-object-storage-basics should opt into the guide article layout',
);

const workflowPost = read('src/content/blog/codex-worktree-workflow.md');
assert.match(
  workflowPost,
  /^layout:\s*note$/m,
  'codex-worktree-workflow should opt into the note article layout',
);

console.log('Article layout checks passed.');
```

- [ ] **Step 2: Add package script**

Add this script entry:

```json
"verify:article-layouts": "node scripts/verify-article-layouts.mjs"
```

- [ ] **Step 3: Verify RED**

Run:

```bash
npm run verify:article-layouts
```

Expected: FAIL because the schema, article template class, CSS variants, and post frontmatter do not exist yet.

### Task 2: Schema And Article Template Wiring

**Files:**
- Modify: `src/content.config.ts`
- Modify: `src/pages/blog/[...slug].astro`

**Interfaces:**
- Consumes: `post.data.layout` from Astro content entries.
- Produces: `layout` frontmatter validation and article classes `article-shell post-template-${layout}`.

- [ ] **Step 1: Add schema field**

In `src/content.config.ts`, add:

```ts
layout: z.enum(['essay', 'guide', 'note']).default('essay'),
```

near the existing optional presentation metadata.

- [ ] **Step 2: Emit article class**

In `src/pages/blog/[...slug].astro`, change the article shell opening tag to:

```astro
<article class={`article-shell post-template-${post.data.layout}`}>
```

- [ ] **Step 3: Run focused verification**

Run:

```bash
npm run verify:article-layouts
```

Expected: still FAIL, now because CSS variants and sample post frontmatter are still missing.

### Task 3: Visual System And Article Variant CSS

**Files:**
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: existing HTML classes and `post-template-*` classes.
- Produces: refreshed warm editorial styling, article variants, and content element polish.

- [ ] **Step 1: Refresh global tokens and page background**

Update `:root`, `html`, and `body` so the site uses warmer paper surfaces, restrained ink colors, less dominant grid texture, consistent shadows, and readable Chinese typography.

- [ ] **Step 2: Polish navigation, cards, and home sections**

Update header, brand, navigation links, buttons, home cards, post rows, tags, image cards, and footer to match the warm editorial direction while keeping modest radii and clear hover/focus states.

- [ ] **Step 3: Polish article reading experience**

Update article header, metadata, TOC, prose typography, headings, links, lists, inline code, code blocks, blockquotes, tables, images, and previous/next navigation.

- [ ] **Step 4: Add variant rules**

Add CSS selectors for:

```css
.post-template-essay
.post-template-guide
.post-template-note
```

The `essay` variant should emphasize a calm centered reading column, `guide` should keep a strong desktop TOC and structured headings/code blocks, and `note` should be compact and narrower.

- [ ] **Step 5: Preserve responsive and reduced-motion behavior**

Keep mobile collapse at the existing breakpoints, ensure no horizontal overflow, and preserve the existing reduced-motion guard.

### Task 4: Sample Article Layout Assignments

**Files:**
- Modify: `src/content/blog/cloud-object-storage-basics.md`
- Modify: `src/content/blog/codex-worktree-workflow.md`

**Interfaces:**
- Consumes: new `layout` schema values.
- Produces: one `guide` example and one `note` example.

- [ ] **Step 1: Mark a guide post**

Add:

```md
layout: guide
```

to `cloud-object-storage-basics.md`.

- [ ] **Step 2: Mark a note post**

Add:

```md
layout: note
```

to `codex-worktree-workflow.md`.

- [ ] **Step 3: Verify GREEN for article layouts**

Run:

```bash
npm run verify:article-layouts
```

Expected: PASS with `Article layout checks passed.`

### Task 5: Build And Manual UI Verification

**Files:**
- No planned source edits unless verification finds a defect.

**Interfaces:**
- Consumes: completed implementation.
- Produces: build output and browser evidence for desktop and mobile.

- [ ] **Step 1: Run all relevant project checks**

Run:

```bash
npm run verify:home
npm run verify:post-nav
npm run verify:obsidian
npm run verify:article-layouts
npm run build
```

Expected: all commands PASS.

- [ ] **Step 2: Start local dev server**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Astro dev server prints a localhost URL.

- [ ] **Step 3: Browser-check target pages**

Open and inspect:

- `/`
- `/blog/`
- `/blog/cloud-object-storage-basics/`
- `/blog/codex-worktree-workflow/`

Check desktop and 375px mobile widths. There should be no horizontal page overflow; body text, TOC, code blocks, cards, and article navigation should fit cleanly.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add package.json scripts/verify-article-layouts.mjs src/content.config.ts src/pages/blog/[...slug].astro src/styles/global.css src/content/blog/cloud-object-storage-basics.md src/content/blog/codex-worktree-workflow.md docs/superpowers/plans/2026-07-08-blog-ui-refresh-implementation.md
git commit -m "feat: refresh blog ui and article layouts"
```

Expected: one implementation commit after the prior design commit.
