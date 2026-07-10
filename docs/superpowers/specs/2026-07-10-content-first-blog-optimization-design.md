# Content-First Blog Optimization Design

## Goal

Upgrade the existing Astro blog from a project-oriented showcase into a content-first technical knowledge base without replacing its established warm editorial visual language. The work must improve the three highest-priority areas identified in the live-site review: long article tables of contents, dense archive cards and content discovery, and an outdated homepage information structure.

The implementation remains local and uncommitted until the user reviews the running preview and explicitly approves a commit.

## Design Direction

Keep the current restrained palette, typography, paper-like background, modest corner radius, and lightweight motion. The redesign should make content easier to reach and scan instead of adding decoration.

- Preserve deep teal, warm white, ink, muted gray-green, and clay accent tokens.
- Keep the existing `16px` body baseline, comfortable Chinese line height, visible focus states, skip link, reduced-motion behavior, and responsive image pipeline.
- Reduce visual density by shortening archive cards, limiting secondary copy, and avoiding long rows of tags.
- Use spacing, type scale, and active states to communicate hierarchy; do not introduce gradients, glass effects, large floating shadows, or a new icon system.
- Add no third-party runtime dependency and no server-side service.

## Scope

### Included

1. A compact, accessible table of contents for long articles.
2. A denser archive with client-side text search and tag filtering.
3. A content-led homepage with recent posts, topic entry points, and clearer copy.
4. Active primary navigation state.
5. A mobile metadata separator fix and responsive typography refinements.
6. Automated structural checks plus desktop and narrow-mobile preview verification.

### Excluded

- Dark mode.
- Comments, analytics, newsletter forms, authentication, or a search backend.
- Pagination in this pass; the current archive contains twelve posts and can remain a single static page.
- Content rewrites inside existing articles except where heading semantics must be corrected for a usable table of contents.
- A visual rebrand or replacement of the existing hero image.
- Any Git commit, push, pull request, or deployment before preview approval.

## Architecture

The existing Astro content collection remains the source of truth. All pages stay statically generated.

- `src/pages/blog/[...slug].astro` prepares a normalized table-of-contents tree containing level-two headings and their level-three children.
- `src/components/ArticleToc.astro` renders the responsive directory and owns its small client-side behavior: mobile disclosure, nested-section disclosure, and active-section highlighting.
- `src/pages/blog/index.astro` prepares the archive data and renders search/filter controls and compact post cards.
- `src/scripts/archive-filter.ts` performs local filtering against normalized title, description, and tag text already rendered in the page.
- `src/pages/index.astro` selects the latest posts and derives topic summaries from existing tags.
- Focused homepage components render recent content and topic entry points without duplicating archive filtering logic.
- `src/layouts/BaseLayout.astro` derives active navigation state from `Astro.url.pathname` and adds `aria-current="page"`.
- `src/styles/global.css` continues to own visual tokens, breakpoints, focus styles, and component layout.

No remote request is made after page load. Filtering updates only visibility, result count, and the empty state in the already-rendered archive.

## Article Table of Contents

### Data Model

Only heading depths two and three participate. A level-three heading belongs to the nearest preceding level-two heading. Orphaned level-three headings are promoted to top-level items so the navigation remains complete and valid.

The renderer receives this shape:

```ts
interface TocItem {
  depth: 2;
  slug: string;
  text: string;
  children: Array<{
    depth: 3;
    slug: string;
    text: string;
  }>;
}
```

### Desktop Behavior

- Guide posts keep a sticky side directory.
- The directory has a viewport-relative maximum height and its own vertical scroll when necessary.
- Top-level entries are always visible.
- Child entries are grouped under their parent and may be collapsed when a section contains many children.
- An `IntersectionObserver` highlights the section currently being read and updates `aria-current="location"` on the matching link.
- The directory does not cover content or widen the page.

### Mobile And Essay Behavior

- The whole directory uses a native `<details>` disclosure and is closed by default.
- Its summary reads `文章目录` and includes the number of top-level sections.
- Top-level entries appear first. Child entries are available within their parent group rather than rendering all entries as one long flat list.
- Following a directory link closes the mobile disclosure so the target heading is immediately visible.
- The reading content begins without forcing the user to pass a permanently expanded directory.

### Content Semantics

The Linux export guide currently contains numbered subsections authored as `h2` even when they belong under an introductory section. Those headings will be normalized to `h3` only where the document structure clearly indicates a child relationship. The wording and technical content remain unchanged.

## Archive And Content Discovery

### Controls

The archive header is followed by a compact filter panel containing:

- A visible-label search input with `type="search"`.
- Tag filter buttons generated from all published-post tags.
- An `全部` control that clears tag selection.
- A live result count using `aria-live="polite"`.
- A clear empty state when no post matches.

Search matches normalized title, description, and tags. Matching is case-insensitive and trims surrounding whitespace. Search text and tag selection combine with AND logic: a post must match the query and the selected tag. One tag can be selected at a time to keep the interaction predictable.

Filtering is an enhancement. With JavaScript unavailable, every article remains visible and every link remains usable.

### Post Cards

- Keep one-column rows on wide screens for readable technical titles.
- Make the entire card visually coherent while preserving a single semantic title link rather than nesting links.
- Limit archive descriptions to three lines on desktop and two lines on narrow mobile.
- Show at most three tags and render a `+N` text indicator for the remainder.
- Reduce archive title size independently from page and article headings, especially below `640px`.
- Preserve date and reading time while reducing excess vertical padding.

## Homepage Information Architecture

The homepage moves from explaining the Astro project to helping readers discover content.

### Hero

- Keep the existing image and two-column layout.
- Change the eyebrow to represent the blog's broader subject range.
- Replace the Astro-specific description with a concise statement about practical notes covering frontend engineering, cloud infrastructure, databases, and security.
- Primary action becomes `阅读最新文章` and links to the latest published post.
- Secondary action remains `浏览全部文章` and links to the archive.
- Reduce the desktop hero minimum height so recent content enters the first scroll sooner.

### Latest Posts

- Replace `第一条博客` with `最近更新`.
- Render the three latest published posts.
- Each item shows date, reading time, title, compact description, and up to three tags.
- The first item receives slightly stronger emphasis, but all three use the same component family.

### Topic Entry Points

- Replace the fixed Astro learning path with topic cards derived from existing post tags.
- Configure four exact featured tags: `云原生`, `数据库`, `前端工程`, and `安全`.
- Each card shows the exact tag label, a short editorial description, and the number of published posts carrying that tag.
- Selecting a topic opens `/blog/?tag=<encoded-tag>`; the archive preselects the matching tag button and applies the same filter used by a direct button press.
- A configured tag with zero published posts is not rendered.

### Removed Homepage Section

The `第一版首页配置` image strip is removed from the homepage because it explains implementation details rather than helping readers find articles. The reusable component and image asset may remain in the codebase if another page still references them; otherwise they can be removed only when tests prove they are unused.

## Navigation And Metadata

- `首页` receives `aria-current="page"` only on `/`.
- `文章` receives `aria-current="page"` on `/blog/` and every article route.
- The active item uses text weight, foreground color, and a subtle background so state is not communicated by color alone.
- The GitHub external link does not receive an active state.
- Article metadata separators become real decorative elements controlled by CSS rather than pseudo-content attached to wrapping spans. On narrow screens metadata wraps cleanly without an orphaned slash.

## Accessibility

- Preserve the skip link, sequential content order, descriptive image alternatives, and visible keyboard focus.
- Search has a persistent label; tag controls are real buttons with `aria-pressed`.
- Result updates use a polite live region without moving focus.
- Native `<details>` supplies keyboard and screen-reader semantics for the mobile directory.
- Active directory and navigation locations use `aria-current`.
- All controls retain a minimum `44px` interaction height and at least `8px` separation.
- Reduced-motion mode disables directory and filtering transitions that are not necessary for comprehension.
- Filtering never removes articles from the source HTML and therefore does not reduce no-script access.

## Responsive Behavior

### Wide Desktop (`> 980px`)

- Homepage hero remains two columns with a reduced vertical footprint.
- Latest posts use one featured row followed by a balanced two-column pair when space permits.
- Guide articles use reading column plus sticky directory.
- Archive controls align search and tag filters without overflowing.

### Tablet (`641px–980px`)

- Homepage and article layouts collapse to one column.
- Directory becomes a static disclosure above content.
- Archive controls wrap and keep full-width search.

### Narrow Mobile (`<= 640px`)

- Page gutters remain `14px` on each side.
- Archive titles use approximately `1.45rem` with controlled line height.
- Hero buttons remain full width.
- Latest-post descriptions and archive descriptions clamp to two lines.
- Topic cards form a single column.
- No page-level horizontal overflow is allowed; code blocks retain local horizontal scrolling.

## Error And Empty States

- A query with no matches displays `没有找到匹配的文章` and a `清除筛选` button.
- Clearing resets the search field, active tag, result visibility, result count, and URL query parameters.
- Unknown tag query parameters are ignored and show the full archive.
- Missing JavaScript leaves the unfiltered archive visible.
- An article with no eligible headings omits the directory entirely.

## Testing Strategy

Add focused Node verification scripts following the repository's existing assertion-based pattern.

1. Article directory checks verify normalized nested data, native disclosure markup, active-section hook, and omission when no headings exist.
2. Archive checks verify visible search labeling, tag controls, compact tag limits, empty state, and progressive-enhancement defaults.
3. Homepage checks verify latest-post selection, topic mapping, updated copy, and removal of implementation-focused sections from the rendered page.
4. Navigation checks verify route-derived `aria-current` behavior and metadata separator markup.
5. Existing verification scripts continue to pass or are updated only where an intentionally replaced homepage contract makes their assertions obsolete.
6. `npm run build` must complete successfully.
7. Local browser preview must be inspected at approximately `1440×900` and `375×812` for `/`, `/blog/`, the long Linux export post, and a guide-layout post.

## Acceptance Criteria

- Long article content begins behind a collapsed directory on narrow screens instead of a permanently expanded list.
- Desktop directories remain reachable and scrollable even when the article has dozens of headings.
- The archive can be searched and filtered without a dependency or backend, and all posts remain available without JavaScript.
- Archive cards are materially shorter and mobile titles no longer dominate an entire screen.
- The homepage prioritizes latest posts and established topic areas rather than describing how the site was built.
- Primary navigation clearly communicates the current section.
- Article metadata wraps without orphaned separators.
- The site builds successfully and has no page-level horizontal overflow in the tested desktop and mobile viewports.
- No commit is created until the user approves the local preview.
