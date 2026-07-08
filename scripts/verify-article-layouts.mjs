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
