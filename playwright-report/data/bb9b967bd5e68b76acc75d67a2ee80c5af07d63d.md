# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication >> should login with existing user after logout
- Location: tests/auth.spec.ts:35:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('h2:has-text("Welcome back")')
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for locator('h2:has-text("Welcome back")')

```

```yaml
- heading "BlockVerse" [level=1]
- paragraph: Build. Play. Create. Together.
- tablist:
  - tab "Log In" [selected]
  - tab "Sign Up"
- text: Username
- textbox "Username":
  - /placeholder: Enter username
- text: Password
- textbox "Password":
  - /placeholder: Enter password
- text: Internal server error
- button "Log In"
- paragraph: BlockVerse v2.0 — A Roblox-like 3D multiplayer browser game
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  |
  3  | test.describe('Authentication', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('/');
  6  |   });
  7  |
  8  |   test('should show auth screen by default', async ({ page }) => {
  9  |     await expect(page.locator('h1:has-text("BlockVerse")')).toBeVisible();
  10 |   });
  11 |
  12 |   test('should show login form by default', async ({ page }) => {
  13 |     const usernameInput = page.locator('#username');
  14 |     const passwordInput = page.locator('#password');
  15 |     await expect(usernameInput).toBeVisible();
  16 |     await expect(passwordInput).toBeVisible();
  17 |   });
  18 |
  19 |   test('should switch to signup tab', async ({ page }) => {
  20 |     await page.getByRole('tab', { name: /sign up/i }).click();
  21 |     await expect(page.locator('button:has-text("Create Account")')).toBeVisible();
  22 |   });
  23 |
  24 |   test('should successfully sign up a new user', async ({ page }) => {
  25 |     const uniqueUsername = `testuser_${Date.now()}`;
  26 |     await page.getByRole('tab', { name: /sign up/i }).click();
  27 |     await page.locator('#username').fill(uniqueUsername);
  28 |     await page.locator('#password').fill('testpass123');
  29 |     await page.click('button:has-text("Create Account")');
  30 |
  31 |     // Should redirect to lobby after successful signup
  32 |     await expect(page.locator('h2:has-text("Welcome back")')).toBeVisible({ timeout: 15000 });
  33 |   });
  34 |
  35 |   test('should login with existing user after logout', async ({ page }) => {
  36 |     const uniqueUsername = `lgt${Date.now()}`;
  37 |     await page.getByRole('tab', { name: /sign up/i }).click();
  38 |     await page.locator('#username').fill(uniqueUsername);
  39 |     await page.locator('#password').fill('testpass123');
  40 |     await page.click('button:has-text("Create Account")');
> 41 |     await expect(page.locator('h2:has-text("Welcome back")')).toBeVisible({ timeout: 15000 });
     |                                                               ^ Error: expect(locator).toBeVisible() failed
  42 |
  43 |     // Logout
  44 |     await page.click('button:has-text("Log Out")');
  45 |     await expect(page.locator('h1:has-text("BlockVerse")')).toBeVisible({ timeout: 10000 });
  46 |
  47 |     // Login
  48 |     await page.locator('#username').fill(uniqueUsername);
  49 |     await page.locator('#password').fill('testpass123');
  50 |     await page.click('button:has-text("Log In")');
  51 |     await expect(page.locator('h2:has-text("Welcome back")')).toBeVisible({ timeout: 15000 });
  52 |   });
  53 | });
  54 |
```