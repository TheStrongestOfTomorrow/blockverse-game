import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show auth screen by default', async ({ page }) => {
    await expect(page.locator('text=BlockVerse').first()).toBeVisible();
  });

  test('should show login form by default', async ({ page }) => {
    // Should show username and password inputs
    const usernameInput = page.locator('input[id="username"], input[placeholder*="username" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('should switch to signup tab', async ({ page }) => {
    await page.getByRole('tab', { name: /sign up/i }).click();
    await expect(page.locator('button:has-text("Create Account")')).toBeVisible();
  });

  test('should validate username pattern on signup', async ({ page }) => {
    await page.getByRole('tab', { name: /sign up/i }).click();
    const usernameInput = page.locator('input[id="username"], input[placeholder*="username" i]').first();
    await usernameInput.fill('invalid username!');
    // HTML5 pattern validation should prevent submission
    const isValid = await usernameInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValid).toBe(false);
  });

  test('should validate password minimum length on signup', async ({ page }) => {
    await page.getByRole('tab', { name: /sign up/i }).click();
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('12345'); // 5 chars, min is 6
    const isValid = await passwordInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValid).toBe(false);
  });

  test('should successfully sign up a new user', async ({ page }) => {
    const uniqueUsername = `testuser_${Date.now()}`;
    await page.getByRole('tab', { name: /sign up/i }).click();
    await page.locator('input[id="username"], input[placeholder*="username" i]').first().fill(uniqueUsername);
    await page.locator('input[type="password"]').first().fill('testpass123');
    await page.click('button:has-text("Create Account")');

    // Should redirect to lobby after successful signup
    await expect(page.locator('text=Welcome back')).toBeVisible({ timeout: 10000 });
  });

  test('should show error for duplicate username signup', async ({ page }) => {
    // First signup
    const uniqueUsername = `duplicate_${Date.now()}`;
    await page.getByRole('tab', { name: /sign up/i }).click();
    await page.locator('input[id="username"], input[placeholder*="username" i]').first().fill(uniqueUsername);
    await page.locator('input[type="password"]').first().fill('testpass123');
    await page.click('button:has-text("Create Account")');
    await expect(page.locator('text=Welcome back')).toBeVisible({ timeout: 10000 });

    // Logout
    await page.click('text=Log Out');
    await expect(page.locator('text=BlockVerse').first()).toBeVisible({ timeout: 5000 });

    // Try to signup with same username
    await page.getByRole('tab', { name: /sign up/i }).click();
    await page.locator('input[id="username"], input[placeholder*="username" i]').first().fill(uniqueUsername);
    await page.locator('input[type="password"]').first().fill('testpass123');
    await page.click('button:has-text("Create Account")');

    // Should show error about existing username
    await page.waitForTimeout(2000);
    // The error message might vary - check for any error display
    const errorVisible = await page.locator('text=/already|taken|exists/i').isVisible().catch(() => false);
    expect(errorVisible || await page.locator('[class*="error"], [class*="red"]').isVisible().catch(() => false)).toBeTruthy();
  });

  test('should login with existing user after logout', async ({ page }) => {
    // First create a user via signup
    const uniqueUsername = `lgt${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
    await page.getByRole('tab', { name: /sign up/i }).click();
    await page.locator('input[id="username"], input[placeholder*="username" i]').first().fill(uniqueUsername);
    await page.locator('input[type="password"]').first().fill('testpass123');
    await page.click('button:has-text("Create Account")');
    await expect(page.locator('text=Welcome back')).toBeVisible({ timeout: 10000 });

    // Wait a bit then logout
    await page.waitForTimeout(1000);
    await page.locator('button').filter({ hasText: /log.?out/i }).first().click();

    // Wait for auth screen
    await page.waitForTimeout(2000);
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(passwordInput).toBeVisible({ timeout: 8000 });

    // Login with same credentials
    await page.locator('input[id="username"], input[placeholder*="username" i]').first().fill(uniqueUsername);
    await passwordInput.fill('testpass123');
    // Click the submit button (not the tab)
    await page.locator('button[type="submit"]:has-text("Log In")').click();
    await expect(page.locator('text=Welcome back')).toBeVisible({ timeout: 10000 });
  });
});
