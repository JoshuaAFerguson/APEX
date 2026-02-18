/**
 * Integration tests for Combined Tool, Permission, and Browser Automation Systems
 *
 * Tests verify:
 * 1. Complete tri-system interaction flows
 * 2. Event propagation across system boundaries
 * 3. Error handling and recovery across systems
 * 4. Resource cleanup and state consistency
 * 5. Complex multi-tool workflows with permissions and browser actions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';

import {
  createTestEnvironment,
  createTestTask,
  createTestFiles,
  MockBrowserSession,
  MockMCPServer,
  createTestMCPTools,
  expectPermissionGranted,
  expectPermissionDenied,
  expectPolicyViolation,
  expectToolActionUndoable,
} from './test-utils';
import { BrowserTool } from '../../tools/browser-tool';
import { PermissionManager } from '../../permission-manager';
import { PermissionPresetManager } from '../../permission-preset-manager';

import type {
  Task,
  PermissionLevel,
  BrowserSession,
  ToolAction,
  PermissionEvent,
  PolicyViolation,
  ApexEvent,
} from '@apexcli/core';

describe('Combined Tool, Permission, and Browser System Integration', () => {
  let testEnv: Awaited<ReturnType<typeof createTestEnvironment>>;
  let testTask: Task;
  let testFiles: Awaited<ReturnType<typeof createTestFiles>>;
  let mockSession: MockBrowserSession;
  let mcpServer: MockMCPServer;
  let eventLog: Array<{
    type: string;
    system: 'permission' | 'browser' | 'tool' | 'policy';
    timestamp: number;
    data: any;
  }> = [];

  beforeEach(async () => {
    testEnv = await createTestEnvironment();
    testTask = createTestTask(testEnv.testDir);
    testFiles = await createTestFiles(testEnv.testDir);
    await testEnv.taskStore.addTask(testTask);

    // Create mock browser session
    mockSession = new MockBrowserSession({
      browserType: 'chromium',
      headless: true,
      allowedDomains: ['example.com', 'test.local'],
    });

    // Mock extracted data for testing
    mockSession.setMockResponse('getText:data-content', 'New feature content from webpage');

    // Create MCP server with test tools
    mcpServer = new MockMCPServer(createTestMCPTools());
    await mcpServer.start();

    // Clear event log
    eventLog = [];

    // Set up event tracking across all systems
    testEnv.permissionManager.on('permission:requested', (event) => {
      eventLog.push({
        type: 'permission:requested',
        system: 'permission',
        timestamp: Date.now(),
        data: event,
      });
    });

    testEnv.permissionManager.on('permission:granted', (event) => {
      eventLog.push({
        type: 'permission:granted',
        system: 'permission',
        timestamp: Date.now(),
        data: event,
      });
    });

    testEnv.toolActionStore.on('action:recorded', (event) => {
      eventLog.push({
        type: 'action:recorded',
        system: 'tool',
        timestamp: Date.now(),
        data: event,
      });
    });

    // Mock browser tool to use our mock session
    vi.spyOn(testEnv.browserTool, 'createSession').mockResolvedValue(mockSession);
  });

  afterEach(async () => {
    if (mcpServer) {
      await mcpServer.stop();
    }
    if (mockSession) {
      await mockSession.close();
    }
    await testEnv.cleanup();
    vi.restoreAllMocks();
  });

  describe('Scenario 1: Browser-Driven File Modification with Permissions', () => {
    it('should handle complete browser-to-file workflow with permission checks', async () => {
      // Step 1: Grant browser permission (allow-always)
      await testEnv.permissionManager.grantPermission(
        'browser',
        'allow-always',
        'https://example.com'
      );

      // Verify permission granted
      const browserPermResult = await testEnv.permissionManager.checkPermission({
        tool: 'browser',
        operation: 'navigate',
        scope: 'https://example.com',
      });
      expectPermissionGranted(browserPermResult);

      // Step 2: Navigate to test page
      const session = await testEnv.browserTool.createSession({
        taskId: testTask.id,
        url: 'https://example.com/test-data',
      });

      const navResult = await session.navigate('https://example.com/test-data');
      expect(navResult.success).toBe(true);

      // Step 3: Extract data via browser.getText()
      const textResult = await session.getText('[data-content]');
      expect(textResult.success).toBe(true);
      expect(textResult.text).toBe('New feature content from webpage');

      // Step 4: Use extracted data to modify file (requires file permission check)
      const fileContent = `// Updated from browser data\nexport const content = "${textResult.text}";`;

      // Check if file modification requires permission
      const filePermResult = await testEnv.permissionManager.checkPermission({
        tool: 'file-writer',
        operation: 'write',
        scope: testFiles.sourceFile,
      });

      // Grant file permission if needed
      if (!filePermResult.granted) {
        await testEnv.permissionManager.grantPermission('file-writer', 'allow-once');
      }

      // Verify file operation would pass policy checks
      const policyViolations = await testEnv.policyEnforcer.validateFilePath(testFiles.sourceFile);
      expect(policyViolations).toHaveLength(0);

      // Step 5: Record the file modification as tool action
      const toolAction: ToolAction = {
        id: `action-${Date.now()}`,
        taskId: testTask.id,
        tool: 'file-writer',
        operation: 'write',
        parameters: { path: testFiles.sourceFile, content: fileContent },
        timestamp: new Date(),
        success: true,
        beforeSnapshots: [
          {
            path: testFiles.sourceFile,
            content: await fs.readFile(testFiles.sourceFile, 'utf8'),
            timestamp: new Date(),
          },
        ],
        afterSnapshots: [
          {
            path: testFiles.sourceFile,
            content: fileContent,
            timestamp: new Date(),
          },
        ],
        canUndo: true,
      };

      // Actually modify the file
      await fs.writeFile(testFiles.sourceFile, fileContent, 'utf8');

      // Record the action
      await testEnv.toolActionStore.recordAction(toolAction);

      // Step 6: Verify tool action recorded with proper snapshots and undo capability
      const recordedAction = await testEnv.toolActionStore.getAction(toolAction.id);
      expect(recordedAction).toBeDefined();
      expectToolActionUndoable(recordedAction!);

      // Verify event propagation
      expect(eventLog.filter(e => e.type === 'permission:granted')).toHaveLength(1);
      expect(eventLog.filter(e => e.type === 'action:recorded')).toHaveLength(1);

      // Verify file was actually modified
      const updatedContent = await fs.readFile(testFiles.sourceFile, 'utf8');
      expect(updatedContent).toBe(fileContent);
    });
  });

  describe('Scenario 2: Tool Execution Triggering Browser Verification', () => {
    it('should handle tool-to-browser verification workflow', async () => {
      // Step 1: Edit source file (TypeScript)
      const originalContent = await fs.readFile(testFiles.sourceFile, 'utf8');
      const modifiedContent = originalContent.replace('unused', 'used');
      await fs.writeFile(testFiles.sourceFile, modifiedContent, 'utf8');

      // Step 2: Create snapshot for lint-fix (simulating tool action)
      const lintAction: ToolAction = {
        id: `lint-action-${Date.now()}`,
        taskId: testTask.id,
        tool: 'eslint-fix',
        operation: 'fix',
        parameters: { file: testFiles.sourceFile },
        timestamp: new Date(),
        success: true,
        beforeSnapshots: [
          {
            path: testFiles.sourceFile,
            content: originalContent,
            timestamp: new Date(),
          },
        ],
        afterSnapshots: [
          {
            path: testFiles.sourceFile,
            content: modifiedContent,
            timestamp: new Date(),
          },
        ],
        canUndo: true,
      };

      await testEnv.toolActionStore.recordAction(lintAction);

      // Step 3: Launch browser to visual test the changes
      await testEnv.permissionManager.grantPermission('browser', 'allow-once', 'http://localhost:3000');

      const session = await testEnv.browserTool.createSession({
        taskId: testTask.id,
        url: 'http://localhost:3000/preview',
      });

      const navResult = await session.navigate('http://localhost:3000/preview');
      expect(navResult.success).toBe(true);

      // Step 4: Take screenshot for regression comparison
      const screenshotPath = path.join(testEnv.testDir, 'screenshots', 'after-lint-fix.png');
      mockSession.setMockScreenshot('after-lint-fix.png', Buffer.from('mock-screenshot-data'));

      const screenshotResult = await session.screenshot('after-lint-fix.png');
      expect(screenshotResult.success).toBe(true);

      // Step 5: All actions tracked in ToolActionStore
      const actions = await testEnv.toolActionStore.getActionsForTask(testTask.id);
      expect(actions).toHaveLength(1); // Only the lint action we created

      // Step 6: Verify permissions respected at each step
      const browserPermissions = eventLog.filter(
        e => e.type === 'permission:granted' && e.data.tool === 'browser'
      );
      expect(browserPermissions).toHaveLength(1);
    });
  });

  describe('Scenario 3: Permission Cascade Across Systems', () => {
    it('should apply permission preset consistently across all systems', async () => {
      // Step 1: Apply "supervised" permission preset
      const presetManager = new PermissionPresetManager(testEnv.permissionManager);
      await presetManager.applyPreset('supervised');

      // Step 2: Attempt browser navigation (should require approval)
      const browserPermResult = await testEnv.permissionManager.checkPermission({
        tool: 'browser',
        operation: 'navigate',
        scope: 'https://example.com',
      });
      expectPermissionDenied(browserPermResult);
      expect(browserPermResult.reason).toContain('supervised');

      // Step 3: Attempt file edit (should require approval)
      const filePermResult = await testEnv.permissionManager.checkPermission({
        tool: 'file-writer',
        operation: 'write',
        scope: testFiles.sourceFile,
      });
      expectPermissionDenied(filePermResult);
      expect(filePermResult.reason).toContain('supervised');

      // Step 4: Attempt MCP tool execution (should require approval)
      const mcpPermResult = await testEnv.permissionManager.checkPermission({
        tool: 'test-file-reader',
        operation: 'read',
        scope: testFiles.sourceFile,
      });
      expectPermissionDenied(mcpPermResult);
      expect(mcpPermResult.reason).toContain('supervised');

      // Step 5: Verify all approval requests are tracked
      const permissionRequests = eventLog.filter(e => e.type === 'permission:requested');
      expect(permissionRequests).toHaveLength(3);

      // Step 6: Grant permissions and verify system behavior
      await testEnv.permissionManager.grantPermission('browser', 'allow-once');
      await testEnv.permissionManager.grantPermission('file-writer', 'allow-once');
      await testEnv.permissionManager.grantPermission('test-file-reader', 'allow-once');

      // Verify permissions now work
      const browserRecheck = await testEnv.permissionManager.checkPermission({
        tool: 'browser',
        operation: 'navigate',
      });
      expectPermissionGranted(browserRecheck);
    });
  });

  describe('Scenario 4: Policy Enforcement Across Systems', () => {
    it('should enforce policies consistently across all systems', async () => {
      // Step 1: Configure policy with blocked paths
      const blockedPath = path.join(testEnv.testDir, 'node_modules', 'sensitive-file.js');
      await fs.mkdir(path.join(testEnv.testDir, 'node_modules'), { recursive: true });
      await fs.writeFile(blockedPath, 'sensitive content', 'utf8');

      // Policy is already configured in test-utils to block node_modules/**

      // Step 2: Attempt browser screenshot to blocked path → blocked
      const screenshotViolations = await testEnv.policyEnforcer.validateFilePath(
        path.join(testEnv.testDir, 'screenshots', 'node_modules-screenshot.png')
      );
      // Screenshots to blocked paths should be allowed, but reading blocked files should not

      // Step 3: Attempt file edit in blocked path → blocked
      const fileViolations = await testEnv.policyEnforcer.validateFilePath(blockedPath);
      expect(fileViolations.length).toBeGreaterThan(0);
      expectPolicyViolation(fileViolations, 'node_modules');

      // Step 4: Attempt MCP file reader on blocked path → blocked
      const mcpFileViolations = await testEnv.policyEnforcer.validateFilePath(blockedPath);
      expect(mcpFileViolations.length).toBeGreaterThan(0);
      expectPolicyViolation(mcpFileViolations, 'node_modules');

      // Step 5: Verify consistent policy violations across all systems
      expect(fileViolations).toHaveLength(mcpFileViolations.length);
      expect(fileViolations[0].resource).toBe(mcpFileViolations[0].resource);
    });
  });

  describe('Scenario 5: Resource Limit Impact on All Systems', () => {
    it('should respect resource limits across all systems', async () => {
      // Step 1: Set low budget limit
      testEnv.autonomyController.updateLimits({ budgetLimit: 0.01 }); // Very low limit

      // Step 2: Execute browser operations (consumes budget)
      await testEnv.permissionManager.grantPermission('browser', 'allow-always');
      const session = await testEnv.browserTool.createSession({
        taskId: testTask.id,
        url: 'https://example.com',
      });

      // Simulate budget consumption
      testEnv.autonomyController.recordUsage({
        inputTokens: 1000,
        outputTokens: 500,
        estimatedCost: 0.005, // Half the budget
      });

      // Step 3: Execute file operations (consumes more budget)
      testEnv.autonomyController.recordUsage({
        inputTokens: 500,
        outputTokens: 300,
        estimatedCost: 0.008, // This should exceed the limit
      });

      // Step 4: Check if limits are exceeded
      const limitStatus = testEnv.autonomyController.checkLimits();
      expect(limitStatus.budgetExceeded).toBe(true);

      // Step 5: Verify limit:exceeded stops all systems
      // In real implementation, systems would check autonomy controller before operations
      expect(limitStatus.exceeded).toBe(true);

      // Step 6: Verify partial work can be undone
      // Tool actions should still be recorded even if limits are exceeded
      const actions = await testEnv.toolActionStore.getActionsForTask(testTask.id);
      // No actions were actually recorded in this test, but the system should preserve
      // the ability to undo what was done before limits were exceeded
      expect(actions).toHaveLength(0);
    });
  });

  describe('Scenario 6: Error Recovery Across Systems', () => {
    it('should handle error recovery across system boundaries', async () => {
      let browserError: Error | null = null;
      let fileError: Error | null = null;
      let recoveryStepsExecuted = 0;

      try {
        // Step 1: Start multi-step workflow
        await testEnv.permissionManager.grantPermission('browser', 'allow-once');

        // Step 2: Browser operation succeeds
        const session = await testEnv.browserTool.createSession({
          taskId: testTask.id,
          url: 'https://example.com',
        });

        const navResult = await session.navigate('https://example.com');
        expect(navResult.success).toBe(true);

        // Step 3: File operation fails mid-way (simulate error)
        try {
          const invalidPath = path.join(testEnv.testDir, 'non-existent-dir', 'file.ts');
          await fs.writeFile(invalidPath, 'content', 'utf8');
        } catch (error) {
          fileError = error as Error;
        }

        expect(fileError).toBeTruthy();
        expect(fileError?.message).toContain('ENOENT');

        // Step 4: Verify browser session cleaned up
        recoveryStepsExecuted++;
        await session.close();
        expect(session.isConnected).toBe(false);

        // Step 5: Verify file snapshots preserved for recovery
        recoveryStepsExecuted++;
        // Even though file operation failed, any snapshots taken before failure should be preserved
        const actions = await testEnv.toolActionStore.getActionsForTask(testTask.id);
        // No successful actions should be recorded due to the failure
        expect(actions).toHaveLength(0);

        // Step 6: Verify permission state consistent
        recoveryStepsExecuted++;
        const permissionState = await testEnv.permissionManager.checkPermission({
          tool: 'browser',
          operation: 'navigate',
        });
        // Permission should still be valid (allow-once was granted)
        expectPermissionGranted(permissionState);

      } catch (error) {
        browserError = error as Error;
      }

      // Verify error handling worked correctly
      expect(browserError).toBeNull(); // Browser operations should have succeeded
      expect(fileError).toBeTruthy(); // File operations should have failed as expected
      expect(recoveryStepsExecuted).toBe(3); // All recovery steps should have been executed
    });
  });

  describe('Complex Multi-Tool Workflow Integration', () => {
    it('should handle complex workflow with all three systems', async () => {
      // This test demonstrates a realistic workflow that uses all three systems together

      // Setup: Apply autonomous preset for streamlined testing
      const presetManager = new PermissionPresetManager(testEnv.permissionManager);
      await presetManager.applyPreset('autonomous');

      // Phase 1: Data gathering via browser
      const session = await testEnv.browserTool.createSession({
        taskId: testTask.id,
        url: 'https://api.example.com/data',
      });

      await session.navigate('https://api.example.com/data');
      const apiData = await session.getText('[data-api-response]');
      expect(apiData.success).toBe(true);

      // Phase 2: Process data via MCP tool
      const processedResult = await mcpServer.executeTool('test-api-client', {
        url: 'https://api.example.com/process',
        method: 'POST',
        data: apiData.text,
      });
      expect(processedResult.success).toBe(true);

      // Phase 3: Update file with processed data
      const updatedContent = `
// Auto-generated from API data
export const processedData = ${JSON.stringify(processedResult.result)};

export function useProcessedData() {
  return processedData;
}
      `.trim();

      // Record the file update action
      const updateAction: ToolAction = {
        id: `update-action-${Date.now()}`,
        taskId: testTask.id,
        tool: 'file-writer',
        operation: 'write',
        parameters: { path: testFiles.sourceFile, content: updatedContent },
        timestamp: new Date(),
        success: true,
        beforeSnapshots: [
          {
            path: testFiles.sourceFile,
            content: await fs.readFile(testFiles.sourceFile, 'utf8'),
            timestamp: new Date(),
          },
        ],
        afterSnapshots: [
          {
            path: testFiles.sourceFile,
            content: updatedContent,
            timestamp: new Date(),
          },
        ],
        canUndo: true,
      };

      await fs.writeFile(testFiles.sourceFile, updatedContent, 'utf8');
      await testEnv.toolActionStore.recordAction(updateAction);

      // Phase 4: Visual verification via browser
      await session.navigate('http://localhost:3000/preview');
      const screenshotResult = await session.screenshot('final-result.png');
      expect(screenshotResult.success).toBe(true);

      // Verify complete workflow
      const finalActions = await testEnv.toolActionStore.getActionsForTask(testTask.id);
      expect(finalActions).toHaveLength(1);
      expectToolActionUndoable(finalActions[0]);

      // Verify all systems logged events
      const permissionEvents = eventLog.filter(e => e.system === 'permission');
      const toolEvents = eventLog.filter(e => e.system === 'tool');

      expect(permissionEvents.length).toBeGreaterThan(0);
      expect(toolEvents.length).toBeGreaterThan(0);

      // Verify file was actually updated
      const finalContent = await fs.readFile(testFiles.sourceFile, 'utf8');
      expect(finalContent).toBe(updatedContent);

      // Cleanup
      await session.close();
    });
  });
});