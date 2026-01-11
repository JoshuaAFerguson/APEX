/**
 * Integration tests for multi-tool workflows with policy enforcement
 *
 * Tests verify:
 * 1. Policy rules are evaluated for file operations before/after browser tests
 * 2. File snapshot creation respects policy path validation
 * 3. Browser screenshot operations integrate with allowed paths
 * 4. Tool action tracking works across tool types
 * 5. Policy violations block chained tool operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

import {
  createTestEnvironment,
  createTestTask,
  createTestFiles,
  MockBrowserSession,
  expectPolicyViolation,
} from './test-utils';

import type {
  Task,
  PolicyViolation,
  ToolAction,
} from '@apexcli/core';

describe('Tool System + Browser + Policy Integration', () => {
  let testEnv: Awaited<ReturnType<typeof createTestEnvironment>>;
  let testTask: Task;
  let mockSession: MockBrowserSession;
  let testFiles: Awaited<ReturnType<typeof createTestFiles>>;
  let policyViolations: PolicyViolation[] = [];

  beforeEach(async () => {
    testEnv = await createTestEnvironment();
    testTask = createTestTask(testEnv.testDir);
    await testEnv.taskStore.addTask(testTask);

    testFiles = await createTestFiles(testEnv.testDir);

    // Create mock browser session
    mockSession = new MockBrowserSession({
      browserType: 'chromium',
      headless: true,
      allowedDomains: ['localhost', '127.0.0.1'],
      blockedDomains: [],
    });

    // Override BrowserTool to use mock session
    vi.spyOn(testEnv.browserTool as any, 'createSession').mockResolvedValue(mockSession);

    // Grant all permissions for browser and file operations
    await testEnv.permissionManager.grantPermission('browser', 'allow-always');
    await testEnv.permissionManager.grantPermission('file', 'allow-always');
    await testEnv.permissionManager.grantPermission('edit', 'allow-always');

    // Track policy violations
    policyViolations = [];
    testEnv.policyEnforcer.on('policy:violation', (violation) => {
      policyViolations.push(violation);
    });
  });

  afterEach(async () => {
    await mockSession?.close();
    await testEnv.cleanup();
    vi.restoreAllMocks();
  });

  describe('Multi-Tool Workflow with Policy', () => {
    it('should validate paths before tool execution', async () => {
      // Try to create a file in blocked directory
      const blockedFile = path.join(testEnv.testDir, 'node_modules', 'malicious.js');
      await fs.mkdir(path.dirname(blockedFile), { recursive: true });

      // Policy enforcer should catch this
      const violations = testEnv.policyEnforcer.validateFilePath(blockedFile);
      expect(violations.length).toBeGreaterThan(0);
      expectPolicyViolation(violations, 'node_modules');
    });

    it('should block workflow when policy violation detected', async () => {
      const sensitiveFile = path.join(testEnv.testDir, 'scripts', 'deploy.sh');
      await fs.mkdir(path.dirname(sensitiveFile), { recursive: true });

      // Attempt to write to sensitive file should trigger policy check
      const violations = testEnv.policyEnforcer.validateFilePath(sensitiveFile);

      // Should have violation for sensitive file
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.severity === 'warning')).toBe(true);
    });

    it('should track tool actions across file and browser tools', async () => {
      const screenshotPath = path.join(testEnv.testDir, 'screenshots', 'test.png');

      // File operation: create a test file
      const testContent = 'console.log("test");';
      await fs.writeFile(testFiles.sourceFile, testContent, 'utf8');

      // Create file snapshot
      const beforeSnapshot = await testEnv.toolActionStore.createFileSnapshot(
        testFiles.sourceFile,
        { operation: 'edit', tool: 'file' }
      );

      // Browser operation: take screenshot
      mockSession.setMockScreenshot('test.png', Buffer.from('mock-image-data'));
      const screenshotResult = await testEnv.browserTool.screenshot({
        filename: screenshotPath,
      });

      expect(screenshotResult.success).toBe(true);

      // Record both actions
      const fileAction = await testEnv.toolActionStore.recordToolAction(
        testTask.id,
        {
          callId: 'file-edit-1',
          toolName: 'Edit',
          input: { filePath: testFiles.sourceFile, content: testContent },
          taskId: testTask.id,
          agentName: 'developer',
          stageName: 'implementation',
          startTime: new Date(),
          endTime: new Date(),
          duration: 50,
          result: { success: true },
          status: 'completed' as const,
        },
        [testFiles.sourceFile],
        [beforeSnapshot]
      );

      const browserAction = await testEnv.toolActionStore.recordToolAction(
        testTask.id,
        {
          callId: 'browser-screenshot-1',
          toolName: 'browser-screenshot',
          input: { filename: screenshotPath },
          taskId: testTask.id,
          agentName: 'developer',
          stageName: 'implementation',
          startTime: new Date(),
          endTime: new Date(),
          duration: 200,
          result: screenshotResult,
          status: 'completed' as const,
        }
      );

      // Verify both actions are tracked
      const taskActions = await testEnv.toolActionStore.getActionsForTask(testTask.id);
      expect(taskActions).toHaveLength(2);
      expect(taskActions.some(a => a.execution.toolName === 'Edit')).toBe(true);
      expect(taskActions.some(a => a.execution.toolName === 'browser-screenshot')).toBe(true);
    });

    it('should create snapshots only for allowed paths', async () => {
      const allowedFile = testFiles.sourceFile; // In src/ directory
      const blockedFile = path.join(testEnv.testDir, 'node_modules', 'package.json');

      // Create blocked file
      await fs.mkdir(path.dirname(blockedFile), { recursive: true });
      await fs.writeFile(blockedFile, '{}', 'utf8');

      // Snapshot of allowed file should work
      const allowedSnapshot = await testEnv.toolActionStore.createFileSnapshot(allowedFile);
      expect(allowedSnapshot.filePath).toBe(allowedFile);

      // Snapshot of blocked file should be prevented or flagged
      const blockedViolations = testEnv.policyEnforcer.validateFilePath(blockedFile);
      expect(blockedViolations.length).toBeGreaterThan(0);
    });

    it('should aggregate policy violations from chained operations', async () => {
      const files = [
        path.join(testEnv.testDir, 'node_modules', 'evil.js'), // Blocked
        path.join(testEnv.testDir, 'scripts', 'deploy.sh'),   // Sensitive
        testFiles.sourceFile,                                  // Allowed
      ];

      const allViolations: PolicyViolation[] = [];

      for (const file of files) {
        await fs.mkdir(path.dirname(file), { recursive: true });
        const violations = testEnv.policyEnforcer.validateFilePath(file);
        allViolations.push(...violations);
      }

      // Should have violations for blocked and sensitive files
      expect(allViolations.length).toBeGreaterThan(0);
      expect(allViolations.some(v => v.resource.includes('node_modules'))).toBe(true);
      expect(allViolations.some(v => v.resource.includes('scripts'))).toBe(true);
    });
  });

  describe('Browser Screenshot + File Policy', () => {
    it('should respect path allowlist for screenshot storage', async () => {
      const allowedScreenshotPath = path.join(testEnv.testDir, 'src', 'screenshot.png');
      const blockedScreenshotPath = path.join(testEnv.testDir, 'node_modules', 'screenshot.png');

      // Check policy for screenshot storage
      const allowedViolations = testEnv.policyEnforcer.validateFilePath(allowedScreenshotPath);
      const blockedViolations = testEnv.policyEnforcer.validateFilePath(blockedScreenshotPath);

      expect(allowedViolations.length).toBe(0);
      expect(blockedViolations.length).toBeGreaterThan(0);
    });

    it('should block screenshots to sensitive directories', async () => {
      const sensitiveScreenshotPath = path.join(testEnv.testDir, 'config', 'screenshot.png');

      // Create directory structure
      await fs.mkdir(path.dirname(sensitiveScreenshotPath), { recursive: true });

      const violations = testEnv.policyEnforcer.validateFilePath(sensitiveScreenshotPath);

      // Should flag as sensitive directory access
      expect(violations.some(v => v.type === 'file-access')).toBe(true);
    });

    it('should validate baseline paths in visual regression', async () => {
      const baselinePath = path.join(testEnv.testDir, 'test', 'baselines', 'page.png');
      const currentPath = path.join(testEnv.testDir, 'test', 'current', 'page.png');

      // Create directory structure
      await fs.mkdir(path.dirname(baselinePath), { recursive: true });
      await fs.mkdir(path.dirname(currentPath), { recursive: true });

      // Both paths should be allowed (in test/ directory)
      const baselineViolations = testEnv.policyEnforcer.validateFilePath(baselinePath);
      const currentViolations = testEnv.policyEnforcer.validateFilePath(currentPath);

      expect(baselineViolations.length).toBe(0);
      expect(currentViolations.length).toBe(0);

      // Mock visual regression test
      mockSession.setMockScreenshot('page.png', Buffer.from('current-image'));
      const result = await testEnv.browserTool.compareScreenshot({
        baseline: baselinePath,
        current: currentPath,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Policy Events During Tool Execution', () => {
    it('should emit policy:violation for blocked paths', async () => {
      const blockedFile = path.join(testEnv.testDir, 'node_modules', 'package.json');
      await fs.mkdir(path.dirname(blockedFile), { recursive: true });

      // Clear previous violations
      policyViolations.length = 0;

      // Trigger policy check
      testEnv.policyEnforcer.validateFilePath(blockedFile);

      // Should have emitted violation event
      expect(policyViolations.length).toBeGreaterThan(0);
      expect(policyViolations[0].type).toBe('file-access');
      expect(policyViolations[0].resource).toBe(blockedFile);
    });

    it('should continue execution in audit mode', async () => {
      // Set policy to audit mode
      const auditEnforcer = testEnv.policyEnforcer;
      auditEnforcer.setEnforcement('audit');

      const sensitiveFile = path.join(testEnv.testDir, 'scripts', 'deploy.sh');
      await fs.mkdir(path.dirname(sensitiveFile), { recursive: true });
      await fs.writeFile(sensitiveFile, '#!/bin/bash\necho "deploy"', 'utf8');

      const violations = auditEnforcer.validateFilePath(sensitiveFile);

      // Should record violation but not block execution
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].severity).toBe('warning'); // Audit mode
    });

    it('should block execution in strict mode', async () => {
      // Set policy to strict enforce mode
      testEnv.policyEnforcer.setEnforcement('enforce');

      const blockedFile = path.join(testEnv.testDir, 'node_modules', 'malicious.js');
      await fs.mkdir(path.dirname(blockedFile), { recursive: true });

      const violations = testEnv.policyEnforcer.validateFilePath(blockedFile);

      // Should block with error severity
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.severity === 'error')).toBe(true);
    });
  });

  describe('Complex Multi-Tool Scenarios', () => {
    it('should handle browser test + file edit + policy workflow', async () => {
      const testHtmlFile = path.join(testEnv.testDir, 'test', 'page.html');
      const testJsFile = path.join(testEnv.testDir, 'src', 'app.js');

      // 1. Create test HTML file
      await fs.mkdir(path.dirname(testHtmlFile), { recursive: true });
      await fs.writeFile(testHtmlFile, `
        <!DOCTYPE html>
        <html>
        <head><title>Test Page</title></head>
        <body>
          <h1 id="title">Hello World</h1>
          <button id="button">Click Me</button>
          <script src="../src/app.js"></script>
        </body>
        </html>
      `, 'utf8');

      // 2. Create JavaScript file
      await fs.writeFile(testJsFile, `
        document.getElementById('button').addEventListener('click', function() {
          document.getElementById('title').textContent = 'Button Clicked!';
        });
      `, 'utf8');

      // 3. Navigate to test page
      const navigateResult = await testEnv.browserTool.navigate({
        url: `file://${testHtmlFile}`,
      });
      expect(navigateResult.success).toBe(true);

      // 4. Interact with page
      const clickResult = await testEnv.browserTool.click({ selector: '#button' });
      expect(clickResult.success).toBe(true);

      // 5. Take screenshot
      const screenshotResult = await testEnv.browserTool.screenshot({
        filename: path.join(testEnv.testDir, 'test', 'result.png'),
      });
      expect(screenshotResult.success).toBe(true);

      // 6. Modify JavaScript based on test results
      const modifiedJs = `
        document.getElementById('button').addEventListener('click', function() {
          document.getElementById('title').textContent = 'Enhanced Button Clicked!';
          console.log('Button interaction logged');
        });
      `;

      const beforeSnapshot = await testEnv.toolActionStore.createFileSnapshot(testJsFile);
      await fs.writeFile(testJsFile, modifiedJs, 'utf8');
      const afterSnapshot = await testEnv.toolActionStore.createFileSnapshot(testJsFile);

      // 7. Record the complete workflow
      const workflowAction = await testEnv.toolActionStore.recordToolAction(
        testTask.id,
        {
          callId: 'workflow-browser-test',
          toolName: 'browser-test-workflow',
          input: {
            htmlFile: testHtmlFile,
            jsFile: testJsFile,
            interactions: ['navigate', 'click', 'screenshot', 'edit'],
          },
          taskId: testTask.id,
          agentName: 'developer',
          stageName: 'implementation',
          startTime: new Date(),
          endTime: new Date(),
          duration: 1500,
          result: {
            success: true,
            filesModified: [testJsFile],
            screenshotsTaken: 1,
            interactionsTested: 1,
          },
          status: 'completed' as const,
        },
        [testJsFile],
        [beforeSnapshot],
        [afterSnapshot],
        'browser-test-workflow'
      );

      // Verify workflow tracking
      expect(workflowAction.execution.toolName).toBe('browser-test-workflow');
      expect(workflowAction.modifiedFiles).toContain(testJsFile);
      expect(workflowAction.canUndo).toBe(true);
      expect(workflowAction.actionGroup).toBe('browser-test-workflow');

      // Verify no policy violations for allowed operations
      const jsFileViolations = testEnv.policyEnforcer.validateFilePath(testJsFile);
      const htmlFileViolations = testEnv.policyEnforcer.validateFilePath(testHtmlFile);

      expect(jsFileViolations.length).toBe(0);
      expect(htmlFileViolations.length).toBe(0);
    });

    it('should track resource usage across mixed tool operations', async () => {
      const startTime = Date.now();

      // Perform multiple operations
      await testEnv.browserTool.navigate({ url: 'https://example.com' });
      await testEnv.browserTool.screenshot();

      const content = 'const updated = "content";';
      await fs.writeFile(testFiles.sourceFile, content, 'utf8');

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify resource tracking
      expect(duration).toBeGreaterThan(0);

      // Check that autonomy controller tracks usage
      const usage = testEnv.autonomyController.getCurrentUsage();
      expect(usage.timeElapsed).toBeGreaterThan(0);
    });
  });
});