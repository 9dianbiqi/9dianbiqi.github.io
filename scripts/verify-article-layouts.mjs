import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(file, 'utf8');

const contentConfig = read('src/content.config.ts');
assert.match(
  contentConfig,
  /articleLayout:\s*z\.enum\(\[\s*['"]essay['"],\s*['"]guide['"],\s*['"]note['"]\s*\]\)\.default\(['"]essay['"]\)/s,
  'Blog content schema should validate articleLayout as essay, guide, or note with essay default',
);

const articlePage = read('src/pages/blog/[...slug].astro');
assert.match(
  articlePage,
  /post-template-\$\{post\.data\.articleLayout\}/,
  'Article page should apply a post-template-${post.data.articleLayout} class',
);
assert.match(
  articlePage,
  /import ArticleReadingRail/,
  'Article page should import the reading rail',
);
assert.match(
  articlePage,
  /<ArticleReadingRail relatedPosts={relatedPosts}/,
  'Article page should render related posts in the reading rail',
);

const styles = read('src/styles/global.css');
for (const selector of ['.post-template-essay', '.post-template-guide', '.post-template-note']) {
  assert.ok(styles.includes(selector), `global.css should define ${selector}`);
}
assert.match(
  styles,
  /grid-template-columns:\s*220px minmax\(0,\s*720px\) 220px/,
  'Wide article layout should use the three-column reading workspace',
);

const readingRail = read('src/components/ArticleReadingRail.astro');
assert.match(readingRail, /data-reading-progress/, 'Reading rail should expose progress');
assert.match(readingRail, /相关文章/, 'Reading rail should include related articles');

const tocScript = read('src/scripts/article-toc.ts');
assert.match(
  tocScript,
  /toc\.dataset\.tocLayout !== 'note'/,
  'Essay and guide tables of contents should open on desktop',
);
for (const selector of ['.prose blockquote', '.prose table', '.toc a']) {
  assert.ok(styles.includes(selector), `global.css should style ${selector}`);
}

const objectStoragePost = read('src/content/blog/cloud-object-storage-basics.mdx');
assert.match(
  objectStoragePost,
  /^articleLayout:\s*["']?guide["']?$/m,
  'cloud-object-storage-basics should opt into the guide article layout',
);

const workflowPost = read('src/content/blog/codex-worktree-workflow.mdx');
assert.match(
  workflowPost,
  /^articleLayout:\s*["']?note["']?$/m,
  'codex-worktree-workflow should opt into the note article layout',
);

console.log('Article layout checks passed.');
