import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

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

test('guest can finish a short no-microphone practice flow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '先以游客身份体验' }).click();
  await page.getByRole('button', { name: /天空之城/ }).click();

  await page.getByRole('button', { name: /自定义/ }).click();
  await page.getByLabel('终点 B').selectOption('1');
  await page.getByRole('button', { name: '无伴奏' }).click();
  await page.getByRole('button', { name: '节拍器' }).click();
  await page.getByRole('button', { name: '开始练习' }).click();

  await page.getByRole('button', { name: '关闭麦克风音高识别' }).click();
  await expect(page.getByText('麦克风已关闭，本次练习将记录为未命中')).toBeVisible();
  await page.getByRole('button', { name: '开始练习' }).click();

  await expect(page).toHaveURL(/\/results/, { timeout: 15_000 });
  await expect(page.getByText(/命中 \d+\/\d+ 个音符 · 准确率/)).toBeVisible();
  await expect(page.getByRole('button', { name: '再练一次' })).toBeVisible();
});

test('local account registration reaches account sync settings', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto('/');
  await page.getByRole('button', { name: '注册' }).click();
  await page.getByPlaceholder('昵称').fill('测试用户');
  await page.getByPlaceholder('邮箱地址').fill(email);
  await page.getByPlaceholder('密码（至少 8 个字符）').fill('password123');
  await page.getByRole('button', { name: '创建本地账户' }).click();

  await page.getByRole('button', { name: /打开测试用户的账户设置/ }).click();
  await expect(page.getByText('账户与设置')).toBeVisible();
  await expect(page.getByText('云同步尚未连接')).toBeVisible();
  await page.getByRole('button', { name: /保存设置/ }).click();
  await expect(page.getByRole('button', { name: /已保存/ })).toBeVisible();
});
