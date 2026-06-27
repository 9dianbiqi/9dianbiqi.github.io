import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const fromRoot = (...segments) => path.join(root, ...segments);

const requiredFiles = [
  'docs/knowledge-system.md',
  'obsidian/README.md',
  'obsidian/templates/blog-post.md',
  'scripts/import-obsidian.mjs',
];

for (const file of requiredFiles) {
  assert.ok(existsSync(fromRoot(file)), `Missing required Obsidian workflow file: ${file}`);
}

const packageJson = JSON.parse(readFileSync(fromRoot('package.json'), 'utf8'));
assert.equal(
  packageJson.scripts['import:obsidian'],
  'node scripts/import-obsidian.mjs',
  'package.json must expose npm run import:obsidian',
);
assert.equal(
  packageJson.scripts['verify:obsidian'],
  'node scripts/verify-obsidian-workflow.mjs',
  'package.json must expose npm run verify:obsidian',
);

const gitignore = readFileSync(fromRoot('.gitignore'), 'utf8');
for (const pattern of ['obsidian/vault/', 'obsidian/private/', '.obsidian/']) {
  assert.ok(gitignore.includes(pattern), `.gitignore must protect ${pattern}`);
}

const template = readFileSync(fromRoot('obsidian/templates/blog-post.md'), 'utf8');
for (const snippet of ['publish: false', 'draft: true', 'title:', 'description:', 'pubDate:', 'tags:']) {
  assert.ok(template.includes(snippet), `Obsidian blog template is missing "${snippet}"`);
}

const tempRoot = mkdtempSync(path.join(tmpdir(), 'obsidian-blog-workflow-'));

try {
  const source = path.join(tempRoot, 'vault');
  const output = path.join(tempRoot, 'blog');
  const assets = path.join(tempRoot, 'images');
  mkdirSync(path.join(source, '30 Drafts'), { recursive: true });
  mkdirSync(path.join(source, 'assets'), { recursive: true });

  writeFileSync(path.join(source, 'assets', 'cover.png'), 'fake-image-bytes');
  writeFileSync(
    path.join(source, '30 Drafts', 'publish-me.md'),
    `---
title: "Publish Me"
description: "A publishable Obsidian note"
pubDate: 2026-06-27
tags: ["Astro", "Obsidian"]
draft: false
publish: true
readingTime: "3 min"
heroImage: "../assets/cover.png"
heroAlt: "Cover image"
---

# Publish Me

![[cover.png]]

Use a normal [Markdown link](https://example.com) before publishing.
`,
  );

  writeFileSync(
    path.join(source, '30 Drafts', 'private-note.md'),
    `---
title: "Private Note"
description: "This should stay in Obsidian"
pubDate: 2026-06-27
tags: ["Private"]
draft: false
publish: false
---

Private thinking.
`,
  );

  const importResult = spawnSync(
    process.execPath,
    [
      fromRoot('scripts/import-obsidian.mjs'),
      '--source',
      source,
      '--output',
      output,
      '--assets-output',
      assets,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(importResult.status, 0, importResult.stdout + importResult.stderr);

  const importedPost = path.join(output, 'publish-me.md');
  assert.ok(existsSync(importedPost), 'publish: true note should be imported');
  assert.ok(!existsSync(path.join(output, 'private-note.md')), 'publish: false note must not be imported');

  const importedContent = readFileSync(importedPost, 'utf8');
  assert.ok(!importedContent.includes('publish:'), 'publish flag must not be copied into Astro content');
  assert.ok(
    importedContent.includes('heroImage: /images/blog/publish-me/cover.png'),
    'local hero image should be normalized to the public blog image path',
  );
  assert.ok(
    importedContent.includes('![cover.png](/images/blog/publish-me/cover.png)'),
    'Obsidian image embeds should become Markdown image links',
  );
  assert.ok(existsSync(path.join(assets, 'publish-me', 'cover.png')), 'local image should be copied');

  const badSource = path.join(tempRoot, 'bad-vault');
  mkdirSync(badSource, { recursive: true });
  writeFileSync(
    path.join(badSource, 'bad-wikilink.md'),
    `---
title: "Bad Wikilink"
description: "This should fail before publishing"
pubDate: 2026-06-27
tags: ["Obsidian"]
draft: false
publish: true
---

This still points to [[Private Note]].
`,
  );

  const badResult = spawnSync(
    process.execPath,
    [
      fromRoot('scripts/import-obsidian.mjs'),
      '--source',
      badSource,
      '--output',
      path.join(tempRoot, 'bad-blog'),
      '--assets-output',
      path.join(tempRoot, 'bad-images'),
    ],
    { encoding: 'utf8' },
  );
  assert.notEqual(badResult.status, 0, 'plain Obsidian wikilinks should fail publishing');
  assert.ok(
    `${badResult.stdout}${badResult.stderr}`.includes('Markdown link'),
    'wikilink failure should tell the writer to use Markdown links',
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log('Obsidian workflow checks passed.');
