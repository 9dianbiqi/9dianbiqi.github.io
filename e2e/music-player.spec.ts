import { expect, test } from '@playwright/test';

test('switches providers and persists the player through Astro navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('music-player')).toBeVisible();

  await page.getByRole('button', { name: '展开播放器' }).click();
  const qishuiTab = page.getByRole('tab', { name: '切换到汽水音乐' });
  await qishuiTab.click();
  await expect(qishuiTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('尚未配置汽水音乐歌曲。')).toBeVisible();

  await page.locator('header a[href="/blog/"]').click();
  await expect(page).toHaveURL(/\/blog\/$/);
  await expect(page.getByRole('tab', { name: '切换到汽水音乐' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('button', { name: '收起播放器' })).toBeVisible();
});

test('uses a full-width bottom sheet and touch-sized controls on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '展开播放器' }).click();

  const shell = page.locator('music-player').locator('.shell');
  const box = await shell.boundingBox();
  expect(box?.width).toBe(390);
  expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(844);

  const controls = page.locator('music-player').locator('button:visible');
  const count = await controls.count();
  for (let index = 0; index < count; index += 1) {
    const controlBox = await controls.nth(index).boundingBox();
    expect(controlBox?.height).toBeGreaterThanOrEqual(44);
  }
});
