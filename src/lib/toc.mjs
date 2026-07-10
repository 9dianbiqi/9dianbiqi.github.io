/**
 * @typedef {{ depth: 3; slug: string; text: string }} TocChild
 * @typedef {{ depth: 2; slug: string; text: string; children: TocChild[] }} TocItem
 * @typedef {{ depth: number; slug: string; text: string }} RenderedHeading
 */

/**
 * @param {RenderedHeading[]} headings
 * @returns {TocItem[]}
 */
export function buildToc(headings) {
  /** @type {TocItem[]} */
  const items = [];

  for (const heading of headings) {
    if (heading.depth === 2) {
      items.push({
        depth: 2,
        slug: heading.slug,
        text: heading.text,
        children: [],
      });
      continue;
    }

    if (heading.depth !== 3) continue;

    const parent = items.at(-1);
    if (parent) {
      parent.children.push({
        depth: 3,
        slug: heading.slug,
        text: heading.text,
      });
      continue;
    }

    items.push({
      depth: 2,
      slug: heading.slug,
      text: heading.text,
      children: [],
    });
  }

  return items;
}
