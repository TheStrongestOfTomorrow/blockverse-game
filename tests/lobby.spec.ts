import { test, expect } from '@playwright/test';

test.describe('Lobby', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    const uniqueUsername = `lobby_${Date.now()}`;
    await page.getByRole('tab', { name: /sign up/i }).click();
    await page.locator('input[id="username"], input[placeholder*="username" i]').first().fill(uniqueUsername);
    await page.locator('input[type="password"]').first().fill('testpass123');
    await page.click('button:has-text("Create Account")');
    await expect(page.locator('text=Welcome back')).toBeVisible({ timeout: 10000 });
  });

  test('should show home section with welcome message', async ({ page }) => {
    await expect(page.locator('text=Welcome back')).toBeVisible();
  });

  test('should show quick action cards', async ({ page }) => {
    await expect(page.locator('text=Play Now')).toBeVisible();
    await expect(page.locator('text=Create Game')).toBeVisible();
  });

  test('should navigate to Discover section', async ({ page }) => {
    await page.locator('button:has-text("Discover"), [class*="sidebar"] button:has(svg)').filter({ hasText: 'Discover' }).click();
    await expect(page.locator('text=Discover Games')).toBeVisible();
  });

  test('should navigate to Create section', async ({ page }) => {
    // Click Create in sidebar
    await page.locator('button, a').filter({ hasText: /^Create$/ }).first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Create a Game')).toBeVisible();
  });

  test('should navigate to Avatar section', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Avatar' }).first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Customize Avatar')).toBeVisible();
  });

  test('should navigate to Settings section', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Settings' }).first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Game Settings')).toBeVisible();
  });

  test('should show avatar color options', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Avatar' }).first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Body Color')).toBeVisible();
  });

  test('should show controls reference in settings', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Settings' }).first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Controls')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Log Out' }).first().click();
    // Should go back to auth screen
    await page.waitForTimeout(2000);
    const onAuthScreen = await page.locator('input[type="password"]').isVisible().catch(() => false);
    expect(onAuthScreen).toBeTruthy();
  });
});
