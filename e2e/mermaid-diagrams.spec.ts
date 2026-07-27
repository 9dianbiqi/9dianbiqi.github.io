import { expect, test } from '@playwright/test';

const mcpArticle = '/blog/mcp-development-beginner-guide/';
const roadmapArticle = '/blog/feishu-operations-cli-optimization-roadmap/';

test('renders Mermaid while preserving regular code blocks', async ({ page }) => {
  await page.goto(mcpArticle);

  await expect(page.locator('.mermaid-diagram svg')).toBeVisible();
  await expect(page.locator('pre[data-language="mermaid"]')).toHaveCount(0);
  await expect(page.locator('pre[data-language="python"]').first()).toBeVisible();
  await expect(page.locator('.mermaid-diagram')).toHaveAttribute('role', 'img');
});

test('contains wide diagrams without document overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(mcpArticle);

  await expect(page.locator('.mermaid-diagram svg')).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    documentOverflow: document.documentElement.scrollWidth - innerWidth,
    diagramOverflowMode: getComputedStyle(
      document.querySelector<HTMLElement>('.mermaid-diagram__canvas')!,
    ).overflowX,
    diagramScrollable:
      document.querySelector<HTMLElement>('.mermaid-diagram__canvas')!.scrollWidth >
      document.querySelector<HTMLElement>('.mermaid-diagram__canvas')!.clientWidth,
    diagramRight:
      document.querySelector<HTMLElement>('.mermaid-diagram')?.getBoundingClientRect().right ?? 999,
  }));

  expect(dimensions.documentOverflow).toBeLessThanOrEqual(1);
  expect(dimensions.diagramOverflowMode).toBe('auto');
  expect(dimensions.diagramScrollable).toBe(true);
  expect(dimensions.diagramRight).toBeLessThanOrEqual(375);
});

test('renders diagrams after Astro client navigation', async ({ page }) => {
  await page.goto('/blog/');
  await page.getByRole('link', { name: '从零开发 MCP：新手完整实战指南' }).click();
  await expect(page).toHaveURL(mcpArticle);
  await expect(page.locator('.mermaid-diagram')).toHaveCount(1);

  await page.getByRole('link', { name: '文章', exact: true }).click();
  await page.getByRole('link', { name: '飞书运维 CLI：稳定性与安全优化路线图' }).click();
  await expect(page).toHaveURL(roadmapArticle);
  await expect(page.locator('.mermaid-diagram')).toHaveCount(2);
  await expect(page.locator('pre[data-language="mermaid"]')).toHaveCount(0);
});
