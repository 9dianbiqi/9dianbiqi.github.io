import { expect, test } from '@playwright/test';

const articlePath = '/blog/linux-export-mysql-postgresql-beginner-checklist/';

test('shows the three-column reading workspace and updates progress', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(articlePath);

  await expect(page.locator('[data-article-toc]')).toBeVisible();
  await expect(page.locator('[data-reading-rail]')).toBeVisible();

  const columns = await page.locator('.article-layout').evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns,
  );
  expect(columns.split(' ')).toHaveLength(3);

  await page.evaluate(() => {
    const prose = document.querySelector<HTMLElement>('.prose');
    window.scrollTo(0, (prose?.offsetTop ?? 0) + 700);
  });
  await expect(page.locator('[data-reading-percent]')).not.toHaveText('0%');
  await expect(page.locator('[data-reading-current]')).not.toHaveText('文章开头');

  await page.getByRole('link', { name: '返回顶部' }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Math.abs(
          document.querySelector<HTMLElement>('#article-top')?.getBoundingClientRect().top ?? 999,
        ),
      ),
    )
    .toBeLessThan(2);
});

test('collapses the reading workspace to one column on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto(articlePath);

  const columns = await page.locator('.article-layout').evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns,
  );
  expect(columns.split(' ')).toHaveLength(1);

  const rail = page.locator('[data-reading-rail]');
  await expect(rail).toBeVisible();
  expect(await rail.evaluate((element) => getComputedStyle(element).position)).toBe('static');

  const actionLinks = rail.locator('.reading-actions a');
  const count = await actionLinks.count();
  expect(count).toBe(2);
  for (let index = 0; index < count; index += 1) {
    const box = await actionLinks.nth(index).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test('publishes the Spotify Embed implementation guide', async ({ page }) => {
  await page.goto('/blog/astro-free-spotify-embed-music-player-guide/');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: '从 Premium OAuth 到免费 Embed：在 Astro 博客实现多平台音乐播放器',
    }),
  ).toBeVisible();
  await expect(page.locator('[data-article-toc]')).toBeVisible();
  await expect(page.locator('[data-reading-rail]')).toBeVisible();
});
