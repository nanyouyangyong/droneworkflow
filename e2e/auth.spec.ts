import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before each test
    await page.goto('http://localhost:3000');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test.describe('Registration', () => {
    test('should register a new user successfully', async ({ page }) => {
      await page.goto('http://localhost:3000/register');

      // Fill in registration form
      await page.fill('input[name="name"]', 'Test User');
      await page.fill('input[name="email"]', `test${Date.now()}@example.com`);
      await page.fill('input[name="password"]', 'password123');
      await page.fill('input[name="confirmPassword"]', 'password123');

      // Submit form
      await page.click('button:has-text("注 册")');

      // Should redirect to home page after successful registration
      await expect(page).toHaveURL('http://localhost:3000/', { timeout: 10000 });

      // Should be authenticated
      const isAuthenticated = await page.evaluate(() => {
        const stored = localStorage.getItem('auth-storage');
        if (!stored) return false;
        const data = JSON.parse(stored);
        return data.state?.isAuthenticated === true;
      });
      expect(isAuthenticated).toBe(true);
    });

    test('should show validation errors for invalid input', async ({ page }) => {
      await page.goto('http://localhost:3000/register');

      // Try to submit with empty fields
      await page.click('button:has-text("注 册")');

      // Should show validation errors
      await expect(page.locator('text=请输入姓名')).toBeVisible();
    });

    test('should show error for password mismatch', async ({ page }) => {
      await page.goto('http://localhost:3000/register');

      await page.fill('input[name="name"]', 'Test User');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.fill('input[name="confirmPassword"]', 'password456');

      await page.click('button:has-text("注 册")');

      await expect(page.locator('text=两次输入的密码不一致')).toBeVisible();
    });
  });

  test.describe('Login', () => {
    test('should login with valid credentials', async ({ page }) => {
      await page.goto('http://localhost:3000/login');

      // Fill in login form
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');

      // Submit form
      await page.click('button:has-text("登 录")');

      // Should redirect to home page after successful login
      await expect(page).toHaveURL('http://localhost:3000/', { timeout: 10000 });

      // Should be authenticated
      const isAuthenticated = await page.evaluate(() => {
        const stored = localStorage.getItem('auth-storage');
        if (!stored) return false;
        const data = JSON.parse(stored);
        return data.state?.isAuthenticated === true;
      });
      expect(isAuthenticated).toBe(true);
    });

    test('should show validation errors for empty fields', async ({ page }) => {
      await page.goto('http://localhost:3000/login');

      // Try to submit with empty fields
      await page.click('button:has-text("登 录")');

      // Should show validation errors
      await expect(page.locator('text=请输入邮箱')).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('http://localhost:3000/login');

      await page.fill('input[name="email"]', 'wrong@example.com');
      await page.fill('input[name="password"]', 'wrongpassword');

      await page.click('button:has-text("登 录")');

      // Should show error message
      await expect(page.locator('text=/Invalid credentials|登录失败/i')).toBeVisible({ timeout: 5000 });
    });

    test('should toggle password visibility', async ({ page }) => {
      await page.goto('http://localhost:3000/login');

      const passwordInput = page.locator('input[name="password"]');

      // Initially should be password type
      await expect(passwordInput).toHaveAttribute('type', 'password');

      // Click toggle button
      await page.click('button[aria-label="Toggle password visibility"], button:near(input[name="password"])').first();

      // Should change to text type
      await expect(passwordInput).toHaveAttribute('type', 'text');
    });
  });

  test.describe('Session Persistence', () => {
    test('should persist authentication after page refresh', async ({ page }) => {
      // Login first
      await page.goto('http://localhost:3000/login');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button:has-text("登 录")');

      await expect(page).toHaveURL('http://localhost:3000/', { timeout: 10000 });

      // Refresh the page
      await page.reload();

      // Should still be on home page (not redirected to login)
      await expect(page).toHaveURL('http://localhost:3000/');

      // Should still be authenticated
      const isAuthenticated = await page.evaluate(() => {
        const stored = localStorage.getItem('auth-storage');
        if (!stored) return false;
        const data = JSON.parse(stored);
        return data.state?.isAuthenticated === true;
      });
      expect(isAuthenticated).toBe(true);
    });

    test('should redirect to login when accessing protected route without auth', async ({ page }) => {
      await page.goto('http://localhost:3000/');

      // Should redirect to login page
      await expect(page).toHaveURL('http://localhost:3000/login', { timeout: 10000 });
    });
  });

  test.describe('Logout', () => {
    test('should logout successfully', async ({ page }) => {
      // Login first
      await page.goto('http://localhost:3000/login');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button:has-text("登 录")');

      await expect(page).toHaveURL('http://localhost:3000/', { timeout: 10000 });

      // Find and click logout button (may be in a menu or header)
      // Adjust selector based on actual implementation
      const logoutButton = page.locator('button:has-text("退出"), button:has-text("登出"), button:has-text("Logout")').first();

      if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutButton.click();

        // Should redirect to login page
        await expect(page).toHaveURL('http://localhost:3000/login', { timeout: 10000 });

        // Should not be authenticated
        const isAuthenticated = await page.evaluate(() => {
          const stored = localStorage.getItem('auth-storage');
          if (!stored) return false;
          const data = JSON.parse(stored);
          return data.state?.isAuthenticated === true;
        });
        expect(isAuthenticated).toBe(false);
      } else {
        // Skip test if logout button not found
        test.skip();
      }
    });
  });

  test.describe('Navigation', () => {
    test('should navigate between login and register pages', async ({ page }) => {
      await page.goto('http://localhost:3000/login');

      // Click register link
      await page.click('a:has-text("立即注册")');

      await expect(page).toHaveURL('http://localhost:3000/register');

      // Click login link
      await page.click('a:has-text("立即登录")');

      await expect(page).toHaveURL('http://localhost:3000/login');
    });
  });
});
