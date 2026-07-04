import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show auth screen by default', async ({ page }) => {
    await expect(page.locator('h1:has-text("BlockVerse")')).toBeVisible();
  });

  test('should show login form by default', async ({ page }) => {
    const usernameInput = page.locator('#username');
    const passwordInput = page.locator('#password');
    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('should switch to signup tab', async ({ page }) => {
    await page.getByRole('tab', { name: /sign up/i }).click();
    await expect(page.locator('button:has-text("Create Account")')).toBeVisible();
  });

  test('should successfully sign up a new user', async ({ page }) => {
    const uniqueUsername = `testuser_${Date.now()}`;
    await page.getByRole('tab', { name: /sign up/i }).click();
    await page.locator('#username').fill(uniqueUsername);
    await page.locator('#password').fill('testpass123');
    await page.click('button:has-text("Create Account")');

    // Should redirect to lobby after successful signup
    await expect(page.locator('h2:has-text("Welcome back")')).toBeVisible({ timeout: 15000 });
  });

  test('should login with existing user after logout', async ({ page }) => {
    const uniqueUsername = `lgt${Date.now()}`;
    await page.getByRole('tab', { name: /sign up/i }).click();
    await page.locator('#username').fill(uniqueUsername);
    await page.locator('#password').fill('testpass123');
    await page.click('button:has-text("Create Account")');
    await expect(page.locator('h2:has-text("Welcome back")')).toBeVisible({ timeout: 15000 });

    // Logout
    await page.click('button:has-text("Log Out")');
    await expect(page.locator('h1:has-text("BlockVerse")')).toBeVisible({ timeout: 10000 });

    // Login
    await page.locator('#username').fill(uniqueUsername);
    await page.locator('#password').fill('testpass123');
    await page.click('button:has-text("Log In")');
    await expect(page.locator('h2:has-text("Welcome back")')).toBeVisible({ timeout: 15000 });
  });
});
