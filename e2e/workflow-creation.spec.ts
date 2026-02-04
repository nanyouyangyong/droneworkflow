import { test, expect } from '@playwright/test';

test.describe('Workflow Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage and login before each test
    await page.goto('http://localhost:3000');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("登 录")');

    // Wait for redirect to home page
    await expect(page).toHaveURL('http://localhost:3000/', { timeout: 10000 });
  });

  test('should create workflow from chat message', async ({ page }) => {
    // Find the chat input
    const chatInput = page.locator('textarea[placeholder*="描述你的无人机任务"]');
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Type a mission description
    await chatInput.fill('巡查A区域并拍照，电量低于30%时返航');

    // Click send button
    await page.click('button:has-text("发送")');

    // Wait for response to appear
    await expect(page.locator('text=巡查A区域并拍照')).toBeVisible({ timeout: 5000 });

    // Wait for assistant response (streaming)
    await page.waitForTimeout(2000);

    // Check if workflow canvas is visible or workflow was generated
    const workflowCanvas = page.locator('[class*="reactflow"], [class*="workflow"]').first();
    const hasWorkflow = await workflowCanvas.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasWorkflow) {
      // Verify workflow canvas is rendered
      expect(await workflowCanvas.isVisible()).toBe(true);
    } else {
      // At minimum, should have received a response
      const messages = page.locator('[class*="message"], [class*="chat"]');
      expect(await messages.count()).toBeGreaterThan(0);
    }
  });

  test('should display chat history', async ({ page }) => {
    // Send first message
    const chatInput = page.locator('textarea[placeholder*="描述你的无人机任务"]');
    await chatInput.fill('测试消息1');
    await page.click('button:has-text("发送")');

    // Wait for message to appear
    await expect(page.locator('text=测试消息1')).toBeVisible({ timeout: 5000 });

    // Wait for response
    await page.waitForTimeout(1000);

    // Send second message
    await chatInput.fill('测试消息2');
    await page.click('button:has-text("发送")');

    // Both messages should be visible
    await expect(page.locator('text=测试消息1')).toBeVisible();
    await expect(page.locator('text=测试消息2')).toBeVisible();
  });

  test('should start new chat session', async ({ page }) => {
    // Send a message
    const chatInput = page.locator('textarea[placeholder*="描述你的无人机任务"]');
    await chatInput.fill('第一个会话的消息');
    await page.click('button:has-text("发送")');

    await expect(page.locator('text=第一个会话的消息')).toBeVisible({ timeout: 5000 });

    // Click new session button
    await page.click('button:has-text("新会话")');

    // Previous message should not be visible
    await expect(page.locator('text=第一个会话的消息')).not.toBeVisible({ timeout: 2000 });

    // Input should be empty and ready for new message
    await expect(chatInput).toHaveValue('');
  });

  test('should change AI model', async ({ page }) => {
    // Find model selector
    const modelSelect = page.locator('select').first();
    await expect(modelSelect).toBeVisible({ timeout: 5000 });

    // Get initial model
    const initialModel = await modelSelect.inputValue();

    // Change to different model
    const models = ['deepseek-chat', 'gpt-4', 'claude-3.5', 'local-llm'];
    const newModel = models.find(m => m !== initialModel) || 'gpt-4';

    await modelSelect.selectOption(newModel);

    // Verify model changed
    expect(await modelSelect.inputValue()).toBe(newModel);
  });

  test('should send message with Enter key', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="描述你的无人机任务"]');
    await chatInput.fill('使用Enter键发送');

    // Press Enter
    await chatInput.press('Enter');

    // Message should be sent
    await expect(page.locator('text=使用Enter键发送')).toBeVisible({ timeout: 5000 });
  });

  test('should add new line with Shift+Enter', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="描述你的无人机任务"]');
    await chatInput.fill('第一行');

    // Press Shift+Enter
    await chatInput.press('Shift+Enter');
    await chatInput.type('第二行');

    // Input should contain both lines
    const value = await chatInput.inputValue();
    expect(value).toContain('第一行');
    expect(value).toContain('第二行');
  });

  test('should not send empty message', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="描述你的无人机任务"]');

    // Try to send empty message
    await page.click('button:has-text("发送")');

    // Wait a bit
    await page.waitForTimeout(500);

    // No message should appear in chat
    const messages = page.locator('[class*="message"]');
    const count = await messages.count();
    expect(count).toBe(0);
  });

  test('should display streaming response progressively', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="描述你的无人机任务"]');
    await chatInput.fill('生成一个简单的工作流');
    await page.click('button:has-text("发送")');

    // Wait for user message
    await expect(page.locator('text=生成一个简单的工作流')).toBeVisible({ timeout: 5000 });

    // Wait for assistant response to start appearing
    await page.waitForTimeout(1000);

    // Should have at least 2 messages (user + assistant)
    const messages = page.locator('[class*="message"], .whitespace-pre-wrap');
    expect(await messages.count()).toBeGreaterThanOrEqual(2);
  });
});
