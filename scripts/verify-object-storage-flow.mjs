import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (file) => readFileSync(file, 'utf8');

assert.ok(
  existsSync('src/components/ObjectStorageFlow.astro'),
  'ObjectStorageFlow.astro component should exist',
);
assert.ok(
  existsSync('src/components/ObjectStorageVisual.astro'),
  'ObjectStorageVisual.astro component should exist',
);

const articlePage = read('src/pages/blog/[...slug].astro');
assert.match(articlePage, /<Content \/>/, 'Article page should render content normally');

const astroConfig = read('astro.config.mjs');
assert.match(
  astroConfig,
  /import mdx from ['"]@astrojs\/mdx['"]/,
  'Astro config should import the official MDX integration',
);
assert.match(astroConfig, /integrations:\s*\[\s*mdx\(\)\s*\]/, 'Astro config should enable MDX');

const contentConfig = read('src/content.config.ts');
assert.match(
  contentConfig,
  /\*\*\/\*\.\{md,mdx\}/,
  'Blog content loader should include both Markdown and MDX posts',
);

const post = read('src/content/blog/cloud-object-storage-basics.mdx');
assert.match(
  post,
  /import ObjectStorageFlow from ['"]\.\.\/\.\.\/components\/ObjectStorageFlow\.astro['"]/,
  'Cloud object storage MDX post should import ObjectStorageFlow',
);
assert.match(
  post,
  /import ObjectStorageVisual from ['"]\.\.\/\.\.\/components\/ObjectStorageVisual\.astro['"]/,
  'Cloud object storage MDX post should import ObjectStorageVisual',
);
assert.match(
  post,
  /<ObjectStorageFlow \/>/,
  'Cloud object storage post should use the ObjectStorageFlow component',
);
for (const variant of [
  'storage-roles',
  'object-formula',
  'object-key',
  'key-prefix',
  'cdn-analogy',
  'cloud-native',
  'summary-map',
]) {
  assert.match(
    post,
    new RegExp(`<ObjectStorageVisual variant=["']${variant}["'] \\/>`),
    `Cloud object storage post should use ObjectStorageVisual variant "${variant}"`,
  );
}
assert.ok(
  !post.includes('```text'),
  'Cloud object storage post should no longer use black text code blocks for explanatory visuals',
);
assert.ok(
  !post.includes('用户 / 浏览器 / App\n        |\n        v'),
  'Cloud object storage post should no longer use the ASCII flow diagram block',
);

const component = read('src/components/ObjectStorageFlow.astro');
for (const text of [
  '用户端',
  '业务系统',
  '上传凭证',
  '对象存储 Bucket',
  'CDN 加速',
  '访问资源',
]) {
  assert.ok(component.includes(text), `ObjectStorageFlow should include "${text}"`);
}

const visualComponent = read('src/components/ObjectStorageVisual.astro');
for (const text of [
  '数据库存“业务数据”',
  '文件内容',
  'bucket: user-avatar',
  '对象存储 = 仓库',
  '域名 / CDN / 负载均衡',
  '对象存储的核心要点',
]) {
  assert.ok(component.includes(text) || visualComponent.includes(text), `Object storage visuals should include "${text}"`);
}

assert.match(
  visualComponent,
  /\.summary-card\.is-featured\s+li\s*\{/,
  'Featured summary card list items should set an explicit readable color',
);
assert.match(
  visualComponent,
  /\.summary-card\.is-featured\s+li::marker\s*\{/,
  'Featured summary card list markers should set an explicit readable color',
);

console.log('Object storage visual checks passed.');
