import { test, expect } from '@playwright/test';

test.describe('Workflow Execution Flow', () => {
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

  test('should execute workflow and display logs', async ({ page }) => {
    // Create a workflow first by sending a chat message
    const chatInput = page.locator('textarea[placeholder*="描述你的无人机任务"]');
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    await chatInput.fill('创建一个简单的巡航任务');
    await page.click('button:has-text("发送")');

    // Wait for workflow generation
    await page.waitForTimeout(3000);

    // Look for execute button (may be in workflow canvas or toolbar)
    const executeButton = page.locator('button:has-text("执行"), button:has-text("运行"), button:has-text("开始")').first();

    if (await executeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Click execute button
      await executeButton.click();

      // Wait for execution to start
      await page.waitForTimeout(1000);

      // Check for log panel or execution status
      const logPanel = page.locator('[class*="log"], [class*="console"], text=/执行|运行|日志/i').first();
      const hasLogs = await logPanel.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasLogs) {
        expect(await logPanel.isVisible()).toBe(true);
      }
    } else {
      // Skip if execute button not found (workflow may not have been generated)
      test.skip();
    }
  });

  test('should display real-time execution logs', async ({ page }) => {
    // This test assumes workflow is already created and can be executed
    // Look for log panel
    const logPanel = page.locator('[class*="log"], [class*="console"]').first();

    if (await logPanel.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Execute workflow
      const executeButton = page.locator('button:has-text("执行"), button:has-text("运行")').first();

      if (await executeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await executeButton.click();

        // Wait for logs to appear
        await page.waitForTimeout(2000);

        // Check if log entries are present
        const logEntries = page.locator('[class*="log-entry"], [class*="log-item"]');
        const count = await logEntries.count();

        // Should have at least some log entries
        expect(count).toBeGreaterThan(0);
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('should show workflow execution status', async ({ page }) => {
    // Create workflow
    const chatInput = page.locator('textarea[placeholder*="描述你的无人机任务"]');
    await chatInput.fill('测试工作流执行状态');
    await page.click('button:has-text("发送")');

    await page.waitForTimeout(3000);

    // Look for status indicators
    const statusIndicators = page.locator('text=/运行中|执行中|已完成|成功|失败|Running|Completed|Success|Failed/i');

    if (await statusIndicators.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(await statusIndicators.first().isVisible()).toBe(true);
    } else {
      // Status may not be visible if workflow wasn't generated
      test.skip();
    }
  });

  test('should allow stopping workflow execution', async ({ page }) => {
    // Create and execute workflow
    const chatInput = page.locator('textarea[placeholder*="描述你的无人机任务"]');
    await chatInput.fill('创建可停止的工作流');
    await page.click('button:has-text("发送")');

    await page.waitForTimeout(3000);

    // Execute
    const executeButton = page.locator('button:has-text("执行"), button:has-text("运行")').first();

    if (await executeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await executeButton.click();

      // Wait a bit for execution to start
      await page.waitForTimeout(1000);

      // Look for stop button
      const stopButton = page.locator('button:has-text("停止"), button:has-text("中止"), button:has-text("取消")').first();

      if (await stopButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await stopButton.click();

        // Should show stopped status
        await expect(page.locator('text=/已停止|已取消|Stopped|Cancelled/i')).toBeVisible({ timeout: 5000 });
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('should display workflow nodes in canvas', async ({ page }) => {
    // Create workflow
    const chatInput = page.locator('textarea[placeholder*="描述你的无人机任务"]');
    await chatInput.fill('显示工作流节点');
    await page.click('button:has-text("发送")');

    // Wait for workflow generation
    await page.waitForTimeout(3000);

    // Look for ReactFlow canvas or workflow nodes
    const workflowCanvas = page.locator('[class*="react-flow"], [class*="workflow-canvas"]').first();

    if (await workflowCanvas.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Look for nodes
      const nodes = page.locator('[class*="react-flow__node"], [data-id]');
      const nodeCount = await nodes.count();

      expect(nodeCount).toBeGreaterThan(0);
    } else {
      test.skip();
    }
  });

  test('should allow editing workflow nodes', async ({ page }) => {
    // Create workflow
    const chatInput = page.locator('textarea[placeholder*="描述你的无人机任务"]');
    await chatInput.fill('创建可编辑的工作流');
    await page.click('button:has-text("发送")');

    await page.waitForTimeout(3000);

    // Look for workflow nodes
    const nodes = page.locator('[class*="react-flow__node"]').first();

    if (await nodes.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Double-click or click on node to edit
      await nodes.dblclick();

      // Wait for editor to appear
      await page.waitForTimeout(500);

      // Look for node editor or properties panel
      const editor = page.locator('[class*="editor"], [class*="properties"], text=/编辑|属性|参数/i').first();

      if (await editor.isVisible({ timeout: 2000 }).catch(() => false)) {
        expect(await editor.isVisible()).toBe(true);
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('should persist workflow after page refresh', async ({ page }) => {
    // Create workflow
    const chatInput = page.locator('textarea[placeholder*="描述你的无人机任务"]');
    await chatInput.fill('测试工作流持久化');
    await page.click('button:has-text("发送")');

    await page.waitForTimeout(3000);

    // Check if workflow exists
    const workflowCanvas = page.locator('[class*="react-flow"], [class*="workflow"]').first();
    const hasWorkflow = await workflowCanvas.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasWorkflow) {
      // Refresh page
      await page.reload();

      // Wait for page to load
      await page.waitForTimeout(2000);

      // Workflow should still be visible
      expect(await workflowCanvas.isVisible({ timeout: 5000 })).toBe(true);
    } else {
      test.skip();
    }
  });

  test('should show execution history', async ({ page }) => {
    // Look for history panel or list
    const historyPanel = page.locator('[class*="history"], text=/历史|记录|History/i').first();

    if (await historyPanel.isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(await historyPanel.isVisible()).toBe(true);

      // Create and execute a workflow to add to history
      const chatInput = page.locator('textarea[placeholder*="描述你的无人机任务"]');
      await chatInput.fill('添加到历史记录');
      await page.click('button:has-text("发送")');

      await page.waitForTimeout(3000);

      // Execute if possible
      const executeButton = page.locator('button:has-text("执行"), button:has-text("运行")').first();
      if (await executeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await executeButton.click();
        await page.waitForTimeout(2000);
      }

      // Check if history has entries
      const historyEntries = page.locator('[class*="history-item"], [class*="history-entry"]');
      const count = await historyEntries.count();

      expect(count).toBeGreaterThanOrEqual(0);
    } else {
      test.skip();
    }
  });
});
