import { describe, expect, it } from 'vitest';
import { getRelatedPosts } from './relatedPosts.mjs';

const post = (id: string, tags: string[], date: string, draft = false) => ({
  id,
  data: {
    tags,
    pubDate: new Date(date),
    draft,
    title: id,
  },
});

describe('getRelatedPosts', () => {
  it('ranks shared tags, excludes current and drafts, then sorts by recency', () => {
    const current = post('current', ['Astro', 'Spotify'], '2026-07-12');
    const result = getRelatedPosts(
      [
        current,
        post('two-tags', ['Astro', 'Spotify'], '2026-07-01'),
        post('one-new', ['Astro'], '2026-07-10'),
        post('one-old', ['Spotify'], '2026-06-01'),
        post('draft', ['Astro', 'Spotify'], '2026-07-11', true),
      ],
      current,
      3,
    );

    expect(result.map(({ id }: { id: string }) => id)).toEqual([
      'two-tags',
      'one-new',
      'one-old',
    ]);
  });

  it('fills empty tag matches with the newest published posts', () => {
    const current = post('current', ['Spotify'], '2026-07-12');
    const result = getRelatedPosts(
      [
        current,
        post('older', ['Linux'], '2026-06-01'),
        post('newer', ['Database'], '2026-07-10'),
      ],
      current,
      2,
    );

    expect(result.map(({ id }: { id: string }) => id)).toEqual(['newer', 'older']);
  });
});
