import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const contentDir = path.join('src', 'content', 'blog');
const posts = readdirSync(contentDir).filter((file) => /\.(md|mdx)$/.test(file));
const styles = readFileSync(path.join('src', 'styles', 'global.css'), 'utf8');

function collectFences(source) {
  return [...source.matchAll(/^```([a-zA-Z0-9_-]+)\s*$/gm)].map((match) => ({
    language: match[1],
    index: match.index,
  }));
}

function readPost(post) {
  return readFileSync(path.join(contentDir, post), 'utf8');
}

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
let plaintextCount = 0;

for (const post of posts) {
  const source = readPost(post);
  const fences = collectFences(source);
  if (fences.some(({ language }) => language === 'text')) postsWithTextBlocks.push(post);
  plaintextCount += fences.filter(({ language }) => language === 'plaintext').length;
  if (source.includes('<ArticleVisual')) {
    postsWithArticleVisual.push(post);
    assert.match(
      source,
      /import ArticleVisual from ['"]\.\.\/\.\.\/components\/ArticleVisual\.astro['"]/,
      `${post} should import ArticleVisual before using it`,
    );
  }
}

assert.match(
  styles,
  /\.prose pre\[data-language="plaintext"\]/,
  'Plaintext presentation must be scoped to its Shiki language attribute',
);
assert.match(
  styles,
  /pre\[data-language="plaintext"\][^{]*\{[^}]*overflow-x:\s*auto/s,
  'Plaintext cards must contain long lines instead of widening the document',
);
assert.match(
  styles,
  /pre\[data-language="plaintext"\][^{]*\{[^}]*background:/s,
  'Plaintext cards must override the generic dark code background',
);
assert.match(
  styles,
  /pre\[data-language="plaintext"\][^{]*code\s+span[^{]*\{[^}]*color:\s*inherit\s*!important/s,
  'Plaintext spans must inherit the light-card text color instead of Shiki inline colors',
);

assert.deepEqual(
  postsWithTextBlocks,
  [],
  `Legacy text fences remain: ${postsWithTextBlocks.join(', ')}`,
);

assert.ok(plaintextCount > 0, 'Literal content should remain as plaintext');

for (const post of [
  'feishu-operations-cli-architecture.md',
  'codex-openclaw-billing-governance-native-status.md',
  'sso-authentication-flow-guide.md',
  'vpn-basics-for-beginners.mdx',
]) {
  assert.match(
    readPost(post),
    /^```mermaid\s*$/m,
    `${post} should contain a migrated Mermaid diagram`,
  );
}

assert.ok(
  postsWithArticleVisual.length >= 6,
  'Most current blog posts should use ArticleVisual after replacing explanatory diagrams',
);

console.log('Article visual checks passed.');
