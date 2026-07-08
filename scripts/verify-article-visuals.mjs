import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const contentDir = path.join('src', 'content', 'blog');
const posts = readdirSync(contentDir).filter((file) => /\.(md|mdx)$/.test(file));

assert.ok(existsSync('src/components/ArticleVisual.astro'), 'ArticleVisual.astro component should exist');

const visualComponent = readFileSync('src/components/ArticleVisual.astro', 'utf8');
assert.match(
  visualComponent,
  /overflow-wrap:\s*anywhere/,
  'ArticleVisual should wrap long URLs and technical identifiers instead of causing horizontal overflow',
);
assert.match(
  visualComponent,
  /white-space:\s*pre-wrap/,
  'ArticleVisual diagrams should wrap safely on narrow mobile screens',
);

const postsWithTextBlocks = [];
const postsWithArticleVisual = [];

for (const post of posts) {
  const source = readFileSync(path.join(contentDir, post), 'utf8');
  if (source.includes('```text')) postsWithTextBlocks.push(post);
  if (source.includes('<ArticleVisual')) {
    postsWithArticleVisual.push(post);
    assert.match(
      source,
      /import ArticleVisual from ['"]\.\.\/\.\.\/components\/ArticleVisual\.astro['"]/,
      `${post} should import ArticleVisual before using it`,
    );
  }
}

assert.deepEqual(
  postsWithTextBlocks,
  [],
  `All explanatory text code blocks should be converted to visual components. Remaining: ${postsWithTextBlocks.join(', ')}`,
);

assert.ok(
  postsWithArticleVisual.length >= 6,
  'Most current blog posts should use ArticleVisual after replacing explanatory diagrams',
);

console.log('Article visual checks passed.');
