import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const requiredFiles = [
  'src/site.config.ts',
  'src/components/HomeHero.astro',
  'src/components/RecentPosts.astro',
  'src/components/TopicGrid.astro',
  'src/scripts/reveal.ts',
];

for (const file of requiredFiles) {
  assert.ok(existsSync(file), `Missing required configurable homepage file: ${file}`);
}

const config = readFileSync('src/site.config.ts', 'utf8');
assert.match(config, /export const home/, 'site.config.ts should export home configuration');
assert.match(config, /recent:/, 'home configuration should define recent-post copy');
assert.match(config, /topics:/, 'home configuration should define featured topics');
assert.match(config, /阅读最新文章/, 'home hero should point readers to the latest article');

const index = readFileSync('src/pages/index.astro', 'utf8');
for (const component of ['HomeHero', 'RecentPosts', 'TopicGrid']) {
  assert.match(index, new RegExp(component), `Homepage should use ${component}`);
}
for (const legacyComponent of ['FeaturedPost', 'LearningPath', 'ImageStrip']) {
  assert.doesNotMatch(index, new RegExp(legacyComponent), `Homepage should not use ${legacyComponent}`);
}

const layout = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
assert.match(layout, /astro:transitions/, 'BaseLayout should enable Astro view transitions');
assert.match(layout, /ClientRouter/, 'BaseLayout should render ClientRouter');

const styles = readFileSync('src/styles/global.css', 'utf8');
assert.match(styles, /\.reveal/, 'global.css should include reveal animation styles');
assert.match(styles, /prefers-reduced-motion/, 'global.css should respect reduced motion');

console.log('Homepage configuration checks passed.');
