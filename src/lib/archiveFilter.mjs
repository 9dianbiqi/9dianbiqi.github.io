export const normalizeSearchText = (value = '') =>
  value.trim().toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ');

export function matchesArchivePost(post, { query = '', tag = '' } = {}) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedTag = normalizeSearchText(tag);
  const queryMatch = !normalizedQuery || normalizeSearchText(post.searchText).includes(normalizedQuery);
  const tagMatch =
    !normalizedTag || post.tags.some((candidate) => normalizeSearchText(candidate) === normalizedTag);

  return queryMatch && tagMatch;
}

export function getArchiveTagGroups(posts, preferredTags = [], primaryLimit = 10) {
  const counts = new Map();
  for (const post of posts) {
    for (const tag of post.data.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  const preferred = preferredTags.filter((tag) => counts.has(tag));
  const preferredSet = new Set(preferred);
  const ranked = [...counts.keys()]
    .filter((tag) => !preferredSet.has(tag))
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b, 'zh-CN'));
  const ordered = [...preferred, ...ranked];

  return {
    primary: ordered.slice(0, primaryLimit),
    secondary: ordered.slice(primaryLimit).sort((a, b) => a.localeCompare(b, 'zh-CN')),
  };
}
