# Obsidian publishing workspace

This folder keeps only reusable publishing assets for the blog. Do not put your full private Vault in Git.

Recommended local layout:

```text
obsidian/
  templates/
    blog-post.md
  vault/          # ignored by Git
    00 Inbox/
    10 Notes/
    20 Projects/
    30 Drafts/
    40 Published/
    assets/
  private/        # ignored by Git
```

The blog imports only notes with `publish: true` and `draft: false`.

Run:

```bash
npm run import:obsidian -- --source "obsidian/vault/30 Drafts"
```

Images referenced by `heroImage` or `![[image.png]]` are copied to `public/images/blog/<slug>/`.
Use normal Markdown links in publishable posts. Plain Obsidian wikilinks such as `[[Private Note]]` are blocked before import.
