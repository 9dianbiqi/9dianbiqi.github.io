const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));

export function calculateReadingProgress(
  scrollY,
  articleTop,
  articleHeight,
  viewportHeight,
) {
  const distance = Math.max(1, articleHeight - viewportHeight);
  return Math.round(
    clamp((scrollY - articleTop) / distance, 0, 1) * 100,
  );
}
