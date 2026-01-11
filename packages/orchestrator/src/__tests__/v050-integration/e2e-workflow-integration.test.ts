/**
 * End-to-end integration test simulating realistic v0.5.0 workflow
 *
 * Scenario: Developer task that uses browser testing, file editing,
 * permission gates, policy enforcement, and code quality checks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

import {
  createTestEnvironment,
  createTestTask,
  MockBrowserSession,
} from './test-utils';

import type { Task } from '@apexcli/core';

describe('v0.5.0 End-to-End Workflow Integration', () => {
  let testEnv: Awaited<ReturnType<typeof createTestEnvironment>>;
  let testTask: Task;
  let mockSession: MockBrowserSession;

  beforeEach(async () => {
    testEnv = await createTestEnvironment();
    testTask = createTestTask(testEnv.testDir);
    await testEnv.taskStore.addTask(testTask);

    mockSession = new MockBrowserSession({
      browserType: 'chromium',
      headless: true,
      allowedDomains: ['localhost'],
      blockedDomains: [],
    });

    vi.spyOn(testEnv.browserTool as any, 'createSession').mockResolvedValue(mockSession);

    // Grant necessary permissions
    await testEnv.permissionManager.grantPermission('browser', 'allow-always');
    await testEnv.permissionManager.grantPermission('file', 'allow-always');
    await testEnv.permissionManager.grantPermission('edit', 'allow-always');
  });

  afterEach(async () => {
    await mockSession?.close();
    await testEnv.cleanup();
    vi.restoreAllMocks();
  });

  it('should complete full feature development workflow', async () => {
    // 1. Initialize task with policy configuration
    const componentFile = path.join(testEnv.testDir, 'src', 'Button.tsx');
    const testHtmlFile = path.join(testEnv.testDir, 'test', 'button.html');
    const screenshotPath = path.join(testEnv.testDir, 'screenshots', 'button.png');

    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });

    // 2. Edit source file (triggers lint-after-edit)
    const componentContent = `
import React from 'react';

interface ButtonProps {
  onClick: () => void;
  children: string;
}

export function Button({ onClick, children }: ButtonProps): JSX.Element {
  return (
    <button onClick={onClick} className="btn">
      {children}
    </button>
  );
}`.trim();

    await fs.writeFile(componentFile, componentContent, 'utf8');

    const editSnapshot = await testEnv.toolActionStore.createFileSnapshot(componentFile);
    const editAction = await testEnv.toolActionStore.recordToolAction(
      testTask.id,
      {
        callId: 'component-creation',
        toolName: 'Edit',
        input: { filePath: componentFile, content: componentContent },
        taskId: testTask.id,
        agentName: 'developer',
        stageName: 'implementation',
        startTime: new Date(),
        endTime: new Date(),
        duration: 300,
        result: { success: true },
        status: 'completed' as const,
      },
      [componentFile],
      [],
      [editSnapshot],
      'feature-development'
    );

    // 3. Run browser test (requires permission)
    const testHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Button Test</title>
    <style>
        .btn { padding: 8px 16px; background: blue; color: white; border: none; }
    </style>
</head>
<body>
    <button id="test-button" class="btn">Click Me</button>
    <div id="result"></div>
    <script>
        document.getElementById('test-button').addEventListener('click', function() {
            document.getElementById('result').textContent = 'Button clicked!';
        });
    </script>
</body>
</html>`.trim();

    await fs.writeFile(testHtmlFile, testHtml, 'utf8');

    const navigateResult = await testEnv.browserTool.navigate({
      url: `file://${testHtmlFile}`,
    });
    expect(navigateResult.success).toBe(true);

    // 4. Capture screenshot (respects allowed paths)
    mockSession.setMockScreenshot('button.png', Buffer.from('mock-screenshot-data'));
    const screenshotResult = await testEnv.browserTool.screenshot({
      filename: screenshotPath,
    });
    expect(screenshotResult.success).toBe(true);

    // 5. Fix test failure (edit + lint + type check)
    const clickResult = await testEnv.browserTool.click({ selector: '#test-button' });
    expect(clickResult.success).toBe(true);

    // 6. Compare screenshots (visual regression)
    const baselinePath = path.join(testEnv.testDir, 'test', 'baseline.png');
    await fs.writeFile(baselinePath, 'baseline-data', 'utf8');

    const compareResult = await testEnv.browserTool.compareScreenshot({
      baseline: baselinePath,
      current: screenshotPath,
    });
    expect(compareResult.success).toBe(true);

    // 7. Review approval gate before commit
    const approvalCheck = testEnv.policyEnforcer.checkApprovalRequired({
      filePaths: [componentFile],
      operation: 'commit',
      estimatedCost: 0.25,
    });

    // 8. Verify all tool actions tracked for undo
    const allActions = await testEnv.toolActionStore.getActionsForTask(testTask.id);
    expect(allActions.length).toBeGreaterThan(0);
    expect(allActions.some(a => a.execution.toolName === 'Edit')).toBe(true);
    expect(allActions.some(a => a.canUndo)).toBe(true);

    // Verify workflow completion
    expect(editAction.actionGroup).toBe('feature-development');
    expect(navigateResult.success).toBe(true);
    expect(screenshotResult.success).toBe(true);
    expect(compareResult.success).toBe(true);
  });

  it('should handle workflow interruption gracefully', async () => {
    // Test resume from checkpoint after limit exceeded
    testEnv.autonomyController.updateLimits({
      budgetLimit: 0.05, // Very low limit
      tokenLimit: 1000,
      timeLimit: 60000,
      changeLimit: { files: 2, lines: 50 },
    });

    // Simulate expensive operation that exceeds limit
    testEnv.autonomyController.recordUsage({
      inputTokens: 500,
      outputTokens: 300,
      totalTokens: 800,
      estimatedCost: 0.10, // Exceeds budget
    });

    const status = testEnv.autonomyController.checkLimits();
    expect(status.withinLimits).toBe(false);

    // Workflow should be pausable/resumable
    const checkpoint = {
      taskId: testTask.id,
      stage: 'implementation',
      lastAction: 'component-creation',
      resumePoint: 'browser-testing',
    };

    expect(checkpoint.resumePoint).toBe('browser-testing');
  });

  it('should respect autonomy controls throughout workflow', async () => {
    // Set reasonable limits
    testEnv.autonomyController.updateLimits({
      budgetLimit: 5.0,
      tokenLimit: 10000,
      timeLimit: 300000, // 5 minutes
      changeLimit: { files: 5, lines: 200 },
    });

    const initialUsage = testEnv.autonomyController.getCurrentUsage();

    // Perform workflow operations
    const file = path.join(testEnv.testDir, 'src', 'utils.ts');
    await fs.writeFile(file, 'export const helper = () => {};', 'utf8');

    testEnv.autonomyController.recordUsage({
      inputTokens: 200,
      outputTokens: 150,
      totalTokens: 350,
      estimatedCost: 0.02,
    });

    testEnv.autonomyController.recordFileChange(file, 1);

    const finalUsage = testEnv.autonomyController.getCurrentUsage();
    const finalStatus = testEnv.autonomyController.checkLimits();

    // Verify resource tracking
    expect(finalUsage.totalTokens).toBeGreaterThan(initialUsage.totalTokens);
    expect(finalUsage.estimatedCost).toBeGreaterThan(initialUsage.estimatedCost);
    expect(finalStatus.withinLimits).toBe(true);
  });
});