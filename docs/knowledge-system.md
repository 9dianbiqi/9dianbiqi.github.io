# Obsidian + Astro knowledge system

## Scope

Obsidian is the private thinking space. Astro is the public publishing system.

```text
Obsidian: collect, connect, draft, revise
Astro: render public posts, homepage, design, SEO
GitHub: version and deploy the public site
```

The first-stage rule is simple: a note is allowed into the blog only when it has `publish: true` and `draft: false`.

## Recommended Vault structure

```text
00 Inbox       quick capture
10 Notes       evergreen notes and atomic knowledge cards
20 Projects    project logs and working notes
30 Drafts      posts preparing for publication
40 Published   source copies of published posts
assets         images and attachments
```

The repository ignores `obsidian/vault/`, `obsidian/private/`, and `.obsidian/`, so private notes do not get committed by accident.

## Publishing frontmatter

Start from `obsidian/templates/blog-post.md`.

Required fields for import:

```yaml
title: "Post title"
slug: "ascii-url-slug"
description: "Short summary"
pubDate: 2026-06-27
tags: ["Astro", "Obsidian"]
draft: false
publish: true
```

Optional fields:

```yaml
updatedDate: 2026-06-28
heroImage: "assets/cover.png"
heroAlt: "Cover image description"
readingTime: "5 min"
```

`slug` should be ASCII. It becomes the blog filename and URL path.

## Image rules

Put Obsidian attachments in the Vault `assets` folder or next to the note.

Supported image forms:

```md
heroImage: "../assets/cover.png"
![[cover.png]]
![[cover.png|Cover image]]
```

During import, local images are copied to:

```text
public/images/blog/<slug>/
```

The published Markdown uses public paths such as:

```md
![Cover image](/images/blog/my-post/cover.png)
```

## Link rules

Private Obsidian notes can use backlinks freely.

Publishable posts should use standard Markdown links:

```md
[Astro documentation](https://docs.astro.build/)
```

Plain wikilinks such as `[[Private Note]]` are blocked by the import script. This keeps public articles portable and prevents private note names from leaking.

## Commands

Import publishable Obsidian notes:

```bash
npm run import:obsidian -- --source "obsidian/vault/30 Drafts"
```

Check the Obsidian workflow:

```bash
npm run verify:obsidian
```

Check the homepage config:

```bash
npm run verify:home
```

Build the public site:

```bash
npm run build
```

## First-stage publishing checklist

1. Write in Obsidian.
2. Move mature drafts to `30 Drafts`.
3. Add complete frontmatter.
4. Set `publish: true` and `draft: false`.
5. Replace plain wikilinks with Markdown links.
6. Run `npm run import:obsidian -- --source "obsidian/vault/30 Drafts"`.
7. Run `npm run build`.
8. Commit and push the Astro blog repository.
