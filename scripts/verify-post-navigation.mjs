import assert from 'node:assert/strict';
import { getPostNavigation, sortPostsByPubDateDesc } from '../src/lib/postNavigation.mjs';

const posts = [
  {
    id: 'middle-post',
    data: {
      title: 'Middle Post',
      pubDate: new Date('2026-06-20'),
    },
  },
  {
    id: 'oldest-post',
    data: {
      title: 'Oldest Post',
      pubDate: new Date('2026-06-10'),
    },
  },
  {
    id: 'newest-post',
    data: {
      title: 'Newest Post',
      pubDate: new Date('2026-06-27'),
    },
  },
];

const sorted = sortPostsByPubDateDesc(posts);
assert.deepEqual(
  sorted.map((post) => post.id),
  ['newest-post', 'middle-post', 'oldest-post'],
  'Posts should be sorted from newest to oldest',
);

const middleNavigation = getPostNavigation(posts, 'middle-post');
assert.equal(middleNavigation.previousPost.id, 'newest-post', 'Previous post should be the newer neighbor');
assert.equal(middleNavigation.nextPost.id, 'oldest-post', 'Next post should be the older neighbor');

const newestNavigation = getPostNavigation(posts, 'newest-post');
assert.equal(newestNavigation.previousPost, null, 'Newest post should not have a previous newer neighbor');
assert.equal(newestNavigation.nextPost.id, 'middle-post', 'Newest post should link to the next older post');

const oldestNavigation = getPostNavigation(posts, 'oldest-post');
assert.equal(oldestNavigation.previousPost.id, 'middle-post', 'Oldest post should link back to the newer post');
assert.equal(oldestNavigation.nextPost, null, 'Oldest post should not have a next older neighbor');

assert.throws(
  () => getPostNavigation(posts, 'missing-post'),
  /Post not found/,
  'Missing current post should fail loudly during build-time checks',
);

console.log('Post navigation checks passed.');
