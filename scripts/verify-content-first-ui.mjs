import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const layout = read('src/layouts/BaseLayout.astro');
const articlePage = read('src/pages/blog/[...slug].astro');
const blogIndex = read('src/pages/blog/index.astro');
const homePage = read('src/pages/index.astro');
const styles = read('src/styles/global.css');

assert.match(layout, /const isHome = pathname === '\/';/);
assert.match(layout, /const isBlog = pathname\.startsWith\('\/blog\/'\);/);
assert.match(layout, /aria-current=\{isHome \? 'page' : undefined\}/);
assert.match(layout, /aria-current=\{isBlog \? 'page' : undefined\}/);

assert.match(articlePage, /<ArticleToc items=\{toc\} layout=\{post\.data\.articleLayout\} \/>/);
assert.match(articlePage, /article-meta-separator/);
assert.match(blogIndex, /data-archive-search/);
assert.match(blogIndex, /data-archive-tag/);
assert.match(blogIndex, /data-archive-empty/);
assert.match(blogIndex, /data-archive-more/);
assert.match(homePage, /RecentPosts/);
assert.match(homePage, /TopicGrid/);

for (const selector of [
  '.archive-tools',
  '.archive-search',
  '.recent-posts',
  '.topic-grid',
  '.toc[open]',
  ".nav-links a[aria-current='page']",
  ".toc a[aria-current='location']",
]) {
  assert.ok(styles.includes(selector), `global.css should define ${selector}`);
}
assert.match(styles, /max-height:\s*calc\(100vh - 128px\)/);
assert.match(styles, /\.post-row h2\s*\{[^}]*font-size:\s*1\.45rem/s);

console.log('Content-first UI checks passed.');
