import assert from 'node:assert/strict';
import { buildToc } from '../src/lib/toc.mjs';

const result = buildToc([
  { depth: 2, slug: 'alpha', text: 'Alpha' },
  { depth: 3, slug: 'alpha-one', text: 'Alpha one' },
  { depth: 3, slug: 'alpha-two', text: 'Alpha two' },
  { depth: 4, slug: 'ignored', text: 'Ignored' },
  { depth: 2, slug: 'beta', text: 'Beta' },
]);

assert.deepEqual(result, [
  {
    depth: 2,
    slug: 'alpha',
    text: 'Alpha',
    children: [
      { depth: 3, slug: 'alpha-one', text: 'Alpha one' },
      { depth: 3, slug: 'alpha-two', text: 'Alpha two' },
    ],
  },
  { depth: 2, slug: 'beta', text: 'Beta', children: [] },
]);

assert.deepEqual(buildToc([{ depth: 3, slug: 'solo', text: 'Solo' }]), [
  { depth: 2, slug: 'solo', text: 'Solo', children: [] },
]);

assert.deepEqual(buildToc([]), []);

console.log('TOC checks passed.');
