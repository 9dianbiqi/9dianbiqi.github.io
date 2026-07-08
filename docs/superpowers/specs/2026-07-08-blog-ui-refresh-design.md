# Blog UI Refresh Design

## Goal

Refresh the 9dianbiqi Astro blog so it feels like a warm Chinese reading space with a small amount of Swiss editorial discipline. The site should remain lightweight, readable, and easy to maintain, while improving the current article page hierarchy, table of contents, code blocks, cards, and responsive polish.

## Design Direction

The visual tone should combine a soft reading surface with precise technical structure:

- Use a warmer paper-like background instead of a dominant grid.
- Keep the palette restrained: ink, muted gray-green, deep teal or near-black, and one warm accent.
- Make typography the main visual asset: larger but calmer headings, comfortable Chinese body text, and clearer metadata.
- Avoid heavy decorative effects, saturated gradients, rounded pill-heavy styling, or marketing-page composition.
- Keep cards at a modest radius and use borders, shadows, and spacing only where they improve scanability.

## Article Layout Variants

Add an `articleLayout` frontmatter field to blog posts. It will default to `essay` so existing posts continue to work.

```md
---
title: Example Post
description: Example description
pubDate: 2026-07-08
articleLayout: guide
---
```

Supported values:

- `essay`: Default long-form reading layout. The article feels calm and centered, with a softer title block and reduced chrome. Best for reflections, summaries, and narrative posts.
- `guide`: Technical tutorial layout. The table of contents stays prominent on desktop, headings and code blocks get stronger structure, and step-by-step content is easier to scan. Best for cloud, data, and engineering explainers.
- `note`: Compact knowledge note layout. Header spacing is tighter, reading width is narrower, and secondary elements are quieter. Best for short workflow notes and quick references.

## Architecture

Keep the current Astro structure:

- `src/content.config.ts` owns the blog content schema and validates the new `articleLayout` field.
- `src/pages/blog/[...slug].astro` remains the single article renderer and emits a template class such as `post-template-guide`.
- `src/styles/global.css` owns the visual system and variant-specific layout rules.
- Existing components for home, featured post, learning path, and image strip remain in place.

This first pass should use CSS variants rather than separate article components. That keeps the change small and makes it easy to migrate later if a layout becomes structurally different enough to deserve its own Astro component.

## Components And Styling Scope

The implementation should focus on:

- Global color tokens, surfaces, borders, shadows, typography, and spacing.
- Header and navigation polish, including hover and focus states.
- Home sections and post-list cards, keeping them editorial rather than promotional.
- Article header hierarchy, metadata, tags, and hero image treatment.
- Article body readability, including paragraphs, headings, lists, inline code, code blocks, blockquotes, links, tables, and images.
- Table of contents visual hierarchy and mobile behavior.
- Previous/next article navigation.

The implementation should not add analytics, comments, search, a newsletter form, a theme switcher, or new dependencies unless a dependency is already required by the local codebase.

## Data Flow

1. Markdown frontmatter is validated by the Astro content collection schema.
2. The article page reads `post.data.articleLayout`.
3. The page applies `post-template-${post.data.articleLayout}` to the article shell.
4. CSS uses that class to adjust layout, width, spacing, table of contents behavior, and article chrome.

When `articleLayout` is omitted, the schema default keeps the post on `essay`.

## Responsive Behavior

Desktop:

- `guide` can use a two-column article layout with a sticky table of contents.
- `essay` and `note` should place more emphasis on the reading column.
- Article lines should remain comfortable rather than stretching across the page.

Tablet and mobile:

- All layouts collapse to a single column.
- The table of contents becomes static and visually compact.
- Code blocks must scroll horizontally without widening the page.
- Navigation links, tags, and buttons must meet comfortable touch sizing.

## Accessibility

- Preserve the skip link and visible keyboard focus states.
- Maintain readable contrast for body text, metadata, links, code, and tags.
- Keep sequential heading hierarchy from Markdown content.
- Do not rely on color alone to express article categories or link states.
- Respect `prefers-reduced-motion` for reveal effects and transitions.

## Testing

Run:

```bash
npm run build
```

Then preview locally and check at least:

- Home page `/`
- Blog archive `/blog/`
- Guide-style post `/blog/cloud-object-storage-basics/`
- A post without an explicit layout, confirming it falls back to `essay`

Manual viewport checks should include desktop, tablet, and a narrow mobile width around 375px. The acceptance bar is no horizontal page overflow, readable body text, stable article navigation, visible focus states, and code blocks contained inside the article column.

## Acceptance Criteria

- The site looks warmer, more polished, and less visually noisy than the current screenshot.
- Existing posts build without requiring every Markdown file to be edited.
- Authors can opt into `essay`, `guide`, or `note` per article via frontmatter.
- Article pages remain lightweight and static.
- The implementation is mostly CSS plus the minimum schema/page changes needed for layout variants.
