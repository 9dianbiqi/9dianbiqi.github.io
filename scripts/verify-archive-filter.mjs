import assert from 'node:assert/strict';
import {
  getArchiveTagGroups,
  matchesArchivePost,
  normalizeSearchText,
} from '../src/lib/archiveFilter.mjs';

assert.equal(normalizeSearchText('  Astro   前端  '), 'astro 前端');
assert.equal(normalizeSearchText(), '');

const post = {
  searchText: 'VPN 入门 网络 安全',
  tags: ['VPN', '安全'],
};

assert.equal(matchesArchivePost(post, { query: 'vpn', tag: '' }), true);
assert.equal(matchesArchivePost(post, { query: '入门', tag: '安全' }), true);
assert.equal(matchesArchivePost(post, { query: '数据库', tag: '' }), false);
assert.equal(matchesArchivePost(post, { query: '', tag: '数据库' }), false);
assert.equal(matchesArchivePost(post), true);

const tagGroups = getArchiveTagGroups(
  [
    { data: { tags: ['安全', '云原生', 'VPN'] } },
    { data: { tags: ['安全', '数据库'] } },
    { data: { tags: ['云原生', 'Kubernetes'] } },
  ],
  ['数据库', '安全'],
  3,
);
assert.deepEqual(tagGroups.primary, ['数据库', '安全', '云原生']);
assert.deepEqual(tagGroups.secondary, ['Kubernetes', 'VPN']);

console.log('Archive filter checks passed.');
