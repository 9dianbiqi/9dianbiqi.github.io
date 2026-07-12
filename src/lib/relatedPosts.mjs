export function getRelatedPosts(posts, currentPost, limit = 3) {
  const currentTags = new Set(currentPost.data.tags ?? []);

  return posts
    .filter((post) => post.id !== currentPost.id && !post.data.draft)
    .map((post) => ({
      post,
      score: (post.data.tags ?? []).filter((tag) => currentTags.has(tag)).length,
      date: new Date(post.data.updatedDate ?? post.data.pubDate).getTime(),
    }))
    .sort((left, right) => right.score - left.score || right.date - left.date)
    .slice(0, Math.max(0, limit))
    .map(({ post }) => post);
}
