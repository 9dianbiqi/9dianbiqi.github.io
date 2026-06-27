export function sortPostsByPubDateDesc(posts) {
  return [...posts].sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function getPostNavigation(posts, currentPostId) {
  const sortedPosts = sortPostsByPubDateDesc(posts);
  const currentIndex = sortedPosts.findIndex((post) => post.id === currentPostId);

  if (currentIndex === -1) {
    throw new Error(`Post not found: ${currentPostId}`);
  }

  return {
    previousPost: sortedPosts[currentIndex - 1] ?? null,
    nextPost: sortedPosts[currentIndex + 1] ?? null,
  };
}
