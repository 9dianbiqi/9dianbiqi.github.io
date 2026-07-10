import assert from 'node:assert/strict';
import { getFeaturedTopics, getRecentPosts } from '../src/lib/homeContent.mjs';

const posts = [
  { id: 'old', data: { pubDate: new Date('2026-07-01'), tags: ['云原生', '安全'] } },
  { id: 'new', data: { pubDate: new Date('2026-07-10'), tags: ['安全'] } },
  { id: 'middle', data: { pubDate: new Date('2026-07-05'), tags: ['数据库'] } },
];

assert.deepEqual(getRecentPosts(posts, 2).map((post) => post.id), ['new', 'middle']);
assert.deepEqual(posts.map((post) => post.id), ['old', 'new', 'middle']);

assert.deepEqual(
  getFeaturedTopics(posts, [
    { tag: '安全', description: '身份与边界' },
    { tag: '数据库', description: '数据基础' },
    { tag: '前端工程', description: '界面与工程化' },
  ]),
  [
    {
      tag: '安全',
      description: '身份与边界',
      count: 2,
      href: '/blog/?tag=%E5%AE%89%E5%85%A8',
    },
    {
      tag: '数据库',
      description: '数据基础',
      count: 1,
      href: '/blog/?tag=%E6%95%B0%E6%8D%AE%E5%BA%93',
    },
  ],
);

console.log('Homepage content checks passed.');
