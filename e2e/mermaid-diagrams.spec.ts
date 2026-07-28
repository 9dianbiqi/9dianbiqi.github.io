import { expect, test } from '@playwright/test';

const mcpArticle = '/blog/mcp-development-beginner-guide/';
const roadmapArticle = '/blog/feishu-operations-cli-optimization-roadmap/';
const migratedArticles = [
  ['/blog/feishu-operations-cli-architecture/', 4],
  ['/blog/codex-openclaw-billing-governance-native-status/', 3],
  ['/blog/codex-openclaw-dynamic-dashboard-technical-architecture/', 5],
  ['/blog/codex-openclaw-volcengine-billing-correctness/', 2],
  ['/blog/sso-authentication-flow-guide/', 5],
  ['/blog/vue-sso-third-party-integration-page/', 2],
  ['/blog/vpn-basics-for-beginners/', 3],
  ['/blog/helloagents-deepresearch-interview-qa/', 1],
  ['/blog/parallel-frontend-backend-development/', 3],
] as const;

test('renders Mermaid while preserving regular code blocks', async ({ page }) => {
  await page.goto(mcpArticle);

  await expect(page.locator('.mermaid-diagram svg')).toBeVisible();
  await expect(page.locator('pre[data-language="mermaid"]')).toHaveCount(0);
  await expect(page.locator('pre[data-language="python"]').first()).toBeVisible();
  await expect(page.locator('.mermaid-diagram')).toHaveAttribute('role', 'img');
});

test('renders plaintext as a light card while preserving dark source code', async ({ page }) => {
  await page.goto(mcpArticle);

  const plaintext = page.locator('pre[data-language="plaintext"]').first();
  const python = page.locator('pre[data-language="python"]').first();
  await expect(plaintext).toBeVisible();
  await expect(python).toBeVisible();

  const colors = await page.evaluate(() => {
    const plaintextStyle = getComputedStyle(
      document.querySelector<HTMLElement>('pre[data-language="plaintext"]')!,
    );
    const pythonStyle = getComputedStyle(
      document.querySelector<HTMLElement>('pre[data-language="python"]')!,
    );
    return {
      plaintextBackground: plaintextStyle.backgroundColor,
      plaintextColor: plaintextStyle.color,
      pythonBackground: pythonStyle.backgroundColor,
    };
  });

  expect(colors.plaintextBackground).toBe('rgb(255, 253, 248)');
  expect(colors.plaintextColor).toBe('rgb(20, 24, 23)');
  expect(colors.pythonBackground).toBe('rgb(36, 41, 46)');
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
    plaintextRight:
      document
        .querySelector<HTMLElement>('pre[data-language="plaintext"]')
        ?.getBoundingClientRect().right ?? 999,
  }));

  expect(dimensions.documentOverflow).toBeLessThanOrEqual(1);
  expect(dimensions.diagramOverflowMode).toBe('auto');
  expect(dimensions.diagramScrollable).toBe(true);
  expect(dimensions.diagramRight).toBeLessThanOrEqual(375);
  expect(dimensions.plaintextRight).toBeLessThanOrEqual(375);
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

for (const [article, expectedDiagrams] of migratedArticles) {
  test(`renders every migrated diagram on ${article}`, async ({ page }) => {
    await page.goto(article);

    await expect(
      page.locator('.mermaid-diagram, pre[data-mermaid-state="error"]'),
    ).toHaveCount(expectedDiagrams);
    const failedSources = await page
      .locator('pre[data-mermaid-state="error"]')
      .allTextContents();
    expect(failedSources, `Mermaid source failed on ${article}`).toEqual([]);
    await expect(page.locator('.mermaid-diagram')).toHaveCount(expectedDiagrams);
    await expect(page.locator('pre[data-language="mermaid"]')).toHaveCount(0);
  });
}
