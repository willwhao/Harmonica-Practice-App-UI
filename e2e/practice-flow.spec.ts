import { expect, test } from '@playwright/test';

test('guest can search a song and enter practice preparation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '先以游客身份体验' }).click();
  await page.getByPlaceholder('搜索歌曲、歌手...').fill('月亮');
  await expect(page.getByRole('button', { name: /月亮代表我的心/ })).toBeVisible();
  await page.getByRole('button', { name: /月亮代表我的心/ }).click();
  await expect(page.getByRole('button', { name: '开始练习' })).toBeVisible();
  await expect(page.getByText('72 BPM')).toBeVisible();
});

test('guest can open a chromatic chart with the correct default instrument', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '先以游客身份体验' }).click();
  await page.getByPlaceholder('搜索歌曲、歌手...').fill('故乡的原风景');
  await page.getByRole('button', { name: /故乡的原风景/ }).click();
  await expect(page.getByRole('button', { name: /半音阶/ })).toHaveAttribute('aria-pressed', 'true');
});
