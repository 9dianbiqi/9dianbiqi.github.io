export function getRecentPosts(posts, limit = 3) {
  return [...posts]
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
    .slice(0, limit);
}

export function getFeaturedTopics(posts, topicConfig) {
  return topicConfig.flatMap((topic) => {
    const count = posts.filter((post) => post.data.tags.includes(topic.tag)).length;
    if (count === 0) return [];

    return [{
      ...topic,
      count,
      href: `/blog/?tag=${encodeURIComponent(topic.tag)}`,
    }];
  });
}
