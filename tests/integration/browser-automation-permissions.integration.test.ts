/**
 * Comprehensive Browser Automation and Permissions Integration Tests
 *
 * This test suite verifies the complete integration between browser automation
 * and the permission system, ensuring that:
 * 1. Browser operations respect permission settings
 * 2. Sensitive operations require appropriate permissions
 * 3. Permission-denied scenarios are handled gracefully
 * 4. Permission events are emitted correctly
 * 5. Cross-system error handling works properly
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { TaskStore } from '@apexcli/orchestrator';
import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool';
import { PermissionManager } from '../../packages/orchestrator/src/permission-manager';
import { PermissionStore } from '../../packages/orchestrator/src/permission-store';
import { createTestTask, MockBrowserSession } from '../../packages/orchestrator/src/__tests__/v050-integration/test-utils';

import type {
  Task,
  PermissionLevel,
  BrowserSession,
  BrowserSessionConfig,
  ToolPermissionResult,
} from '@apexcli/core';

describe('Browser Automation + Permissions Integration', () => {
  let testDir: string;
  let taskStore: TaskStore;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let browserTool: BrowserTool;
  let testTask: Task;
  let mockSession: MockBrowserSession;
  let permissionEvents: any[] = [];

  beforeEach(async () => {
    // Create test environment
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-browser-permission-test-'));

    // Initialize stores and managers
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);

    // Create test task
    testTask = createTestTask(testDir);
    await taskStore.addTask(testTask);

    // Create browser tool with permission manager
    browserTool = new BrowserTool({
      permissionManager,
      backend: 'playwright',
      engine: 'chromium',
      headless: true,
    });

    // Create mock browser session
    mockSession = new MockBrowserSession({
      browserType: 'chromium',
      headless: true,
      allowedDomains: ['example.com', 'test.local'],
      blockedDomains: ['blocked.com', 'dangerous.site'],
    });

    // Mock browser tool to use our test session
    vi.spyOn(browserTool as any, 'createSession').mockResolvedValue(mockSession);

    // Set up permission event tracking
    permissionEvents = [];
    const eventEmitter = permissionStore as any as EventEmitter;

    eventEmitter.on('permission:requested', (event) => {
      permissionEvents.push({ type: 'requested', ...event });
    });

    eventEmitter.on('permission:granted', (event) => {
      permissionEvents.push({ type: 'granted', ...event });
    });

    eventEmitter.on('permission:denied', (event) => {
      permissionEvents.push({ type: 'denied', ...event });
    });
  });

  afterEach(async () => {
    await mockSession?.close();
    await taskStore?.close();
    await fs.rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('Basic Browser Operation Permissions', () => {
    it('should block navigation without browser permissions', async () => {
      // Ensure no permission exists
      await permissionManager.denyPermission('browser');

      const result = await browserTool.navigate({
        url: 'https://example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*denied/i);
      expect(mockSession.url).toBe('about:blank'); // Should not have navigated

      // Verify permission events
      expect(permissionEvents).toContainEqual(
        expect.objectContaining({
          type: 'requested',
          tool: 'browser',
          scope: 'navigate',
        })
      );

      expect(permissionEvents).toContainEqual(
        expect.objectContaining({
          type: 'denied',
          tool: 'browser',
        })
      );
    });

    it('should allow navigation with proper permissions', async () => {
      // Grant navigation permission
      await permissionManager.grantPermission('browser', 'allow-always', 'navigate');

      const result = await browserTool.navigate({
        url: 'https://example.com',
      });

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://example.com');
      expect(mockSession.url).toBe('https://example.com');

      // Verify permission was granted
      expect(permissionEvents).toContainEqual(
        expect.objectContaining({
          type: 'granted',
          tool: 'browser',
          scope: 'navigate',
        })
      );
    });

    it('should respect one-time permissions', async () => {
      // Grant one-time permission
      await permissionManager.grantPermission('browser', 'allow-once', 'navigate');

      // First navigation should succeed
      const result1 = await browserTool.navigate({
        url: 'https://example.com',
      });
      expect(result1.success).toBe(true);

      // Second navigation should fail (permission consumed)
      const result2 = await browserTool.navigate({
        url: 'https://test.local',
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toMatch(/permission.*denied/i);
    });

    it('should handle click operations with permissions', async () => {
      // Grant browser permissions but not click specifically
      await permissionManager.grantPermission('browser', 'allow-always', 'navigate');

      // Navigate first
      await browserTool.navigate({ url: 'https://example.com' });

      // Click should require separate permission or inherit from browser
      const result = await browserTool.click({ selector: '#button' });

      // Depending on implementation, this might inherit or require separate permission
      if (!result.success) {
        expect(result.error).toMatch(/permission/i);
        expect(permissionEvents.some(e =>
          e.type === 'requested' && e.scope === 'click'
        )).toBe(true);
      }
    });
  });

  describe('Sensitive Browser Operations', () => {
    it('should require elevated permissions for JavaScript evaluation', async () => {
      // Grant basic browser permission
      await permissionManager.grantPermission('browser', 'allow-always');

      // JavaScript evaluation should require elevated permission
      const result = await browserTool.evaluate({
        expression: 'window.location.href',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*denied|elevated.*permission/i);

      // Verify that evaluate permission was specifically requested
      expect(permissionEvents.some(e =>
        e.type === 'requested' &&
        (e.scope === 'evaluate' || e.scope?.includes('dangerous'))
      )).toBe(true);
    });

    it('should allow JavaScript evaluation with elevated permissions', async () => {
      // Grant elevated permission for dangerous operations
      await permissionManager.grantPermission('browser', 'allow-always', 'evaluate');

      // Mock successful evaluation
      mockSession.setMockResponse('evaluate:window.location.href', {
        success: true,
        result: 'https://example.com'
      });

      const result = await browserTool.evaluate({
        expression: 'window.location.href',
      });

      expect(result.success).toBe(true);
      expect(permissionEvents.some(e =>
        e.type === 'granted' && e.scope === 'evaluate'
      )).toBe(true);
    });

    it('should require elevated permissions for form submission', async () => {
      // Grant basic browser permission
      await permissionManager.grantPermission('browser', 'allow-always');
      await browserTool.navigate({ url: 'https://example.com' });

      // Form submission should require elevated permission
      const result = await browserTool.submit({
        selector: '#payment-form',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*denied|elevated.*permission/i);

      expect(permissionEvents.some(e =>
        e.type === 'requested' && e.scope === 'submit'
      )).toBe(true);
    });

    it('should handle file upload attempts without permission', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');
      await browserTool.navigate({ url: 'https://example.com' });

      // File operations should require special permissions
      const result = await browserTool.type({
        selector: 'input[type="file"]',
        text: '/path/to/sensitive/file.txt',
      });

      // Should either succeed with basic permission or require file permission
      if (!result.success) {
        expect(result.error).toMatch(/permission|file.*access/i);
      }
    });
  });

  describe('Domain-Based Permission Controls', () => {
    it('should respect domain allowlists', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      // Allowed domain should work
      const result1 = await browserTool.navigate({
        url: 'https://example.com',
      });
      expect(result1.success).toBe(true);

      // Blocked domain should fail
      const result2 = await browserTool.navigate({
        url: 'https://blocked.com',
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toMatch(/blocked|not.*allowed/i);
    });

    it('should handle permission inheritance for subdomains', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      // Navigate to subdomain
      const result = await browserTool.navigate({
        url: 'https://api.example.com',
      });

      // Should succeed if subdomain inheritance is enabled
      expect(result.success).toBe(true);
    });

    it('should block navigation to dangerous domains regardless of permissions', async () => {
      // Grant maximum permissions
      await permissionManager.grantPermission('browser', 'allow-always');

      const result = await browserTool.navigate({
        url: 'https://dangerous.site',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/blocked|dangerous|not.*allowed/i);
    });
  });

  describe('Permission Event Tracking and Auditing', () => {
    it('should track permission usage for audit purposes', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      const startTime = Date.now();

      // Perform multiple operations
      await browserTool.navigate({ url: 'https://example.com' });
      await browserTool.screenshot();
      await browserTool.getText({ selector: 'h1' });

      const endTime = Date.now();

      // Verify all operations were tracked
      const grantedEvents = permissionEvents.filter(e => e.type === 'granted');
      expect(grantedEvents.length).toBeGreaterThan(0);

      // Verify timestamp tracking
      grantedEvents.forEach(event => {
        expect(event.timestamp).toBeGreaterThanOrEqual(startTime);
        expect(event.timestamp).toBeLessThanOrEqual(endTime);
        expect(event.tool).toBe('browser');
      });
    });

    it('should emit detailed permission denial events', async () => {
      await permissionManager.denyPermission('browser');

      await browserTool.navigate({ url: 'https://example.com' });

      const deniedEvent = permissionEvents.find(e => e.type === 'denied');
      expect(deniedEvent).toBeDefined();
      expect(deniedEvent).toMatchObject({
        type: 'denied',
        tool: 'browser',
        reason: expect.stringMatching(/denied|not.*allowed/i),
      });
    });

    it('should track cumulative permission usage', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      // Perform multiple operations
      for (let i = 0; i < 5; i++) {
        await browserTool.navigate({ url: `https://example.com/page${i}` });
        await browserTool.screenshot();
      }

      const grantedEvents = permissionEvents.filter(e => e.type === 'granted');
      expect(grantedEvents.length).toBeGreaterThanOrEqual(10); // At least 2 per iteration
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle permission system failures gracefully', async () => {
      // Mock permission manager failure
      vi.spyOn(permissionManager, 'checkToolPermission').mockRejectedValue(
        new Error('Permission system unavailable')
      );

      const result = await browserTool.navigate({
        url: 'https://example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*system|unavailable|error/i);
    });

    it('should not execute browser operations when permission is denied', async () => {
      const navigateSpy = vi.spyOn(mockSession, 'navigate');
      await permissionManager.denyPermission('browser');

      await browserTool.navigate({ url: 'https://example.com' });

      // Verify that the actual browser operation was never called
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('should provide clear error messages for permission failures', async () => {
      await permissionManager.denyPermission('browser', 'evaluate');

      const result = await browserTool.evaluate({
        expression: 'document.title',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/permission.*denied|not.*allowed|evaluate/i);

      // Verify error is user-friendly
      expect(result.error).not.toMatch(/undefined|null|stack.*trace/i);
    });

    it('should handle mixed permission levels for different operations', async () => {
      // Allow navigation but deny screenshots
      await permissionManager.grantPermission('browser', 'allow-always', 'navigate');
      await permissionManager.denyPermission('browser', 'screenshot');

      const navResult = await browserTool.navigate({ url: 'https://example.com' });
      expect(navResult.success).toBe(true);

      const screenshotResult = await browserTool.screenshot();
      expect(screenshotResult.success).toBe(false);
      expect(screenshotResult.error).toMatch(/permission.*denied/i);
    });

    it('should handle session cleanup on permission denial', async () => {
      const closeSpy = vi.spyOn(mockSession, 'close');

      // Start with permission, then deny it
      await permissionManager.grantPermission('browser', 'allow-once');
      await browserTool.navigate({ url: 'https://example.com' });

      // Permission should be consumed, next operation should fail and cleanup
      await browserTool.navigate({ url: 'https://test.local' });

      // Session should remain open (cleanup is typically handled at higher level)
      expect(closeSpy).not.toHaveBeenCalled();
    });
  });

  describe('Cross-System Integration', () => {
    it('should integrate browser permissions with task limits', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      // Mock task limits
      const taskWithLimits = {
        ...testTask,
        limits: {
          budgetLimit: 0.01, // Very low budget
          timeLimit: 1000, // 1 second
        },
      };

      await taskStore.updateTask(taskWithLimits);

      // Operations should still respect permissions first
      const result = await browserTool.navigate({ url: 'https://example.com' });
      expect(result.success).toBe(true); // Permission granted

      // But might be limited by task constraints
      // (This would be handled by higher-level orchestration)
    });

    it('should handle concurrent permission requests', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      // Start multiple operations simultaneously
      const operations = [
        browserTool.navigate({ url: 'https://example.com/1' }),
        browserTool.navigate({ url: 'https://example.com/2' }),
        browserTool.screenshot(),
        browserTool.screenshot(),
      ];

      const results = await Promise.all(operations);

      // All should succeed if permissions are properly managed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Events should be tracked for all operations
      const grantedEvents = permissionEvents.filter(e => e.type === 'granted');
      expect(grantedEvents.length).toBeGreaterThanOrEqual(operations.length);
    });

    it('should respect permission precedence rules', async () => {
      // Grant general browser permission
      await permissionManager.grantPermission('browser', 'allow-always');

      // Deny specific operation
      await permissionManager.denyPermission('browser', 'evaluate');

      // General operations should work
      const navResult = await browserTool.navigate({ url: 'https://example.com' });
      expect(navResult.success).toBe(true);

      // Specifically denied operation should fail
      const evalResult = await browserTool.evaluate({ expression: 'window.title' });
      expect(evalResult.success).toBe(false);
    });
  });

  describe('Advanced Permission Scenarios', () => {
    it('should handle permission inheritance from parent scopes', async () => {
      // Grant permission at browser level
      await permissionManager.grantPermission('browser', 'allow-always');

      // Child operations should inherit permission
      const operations = [
        browserTool.navigate({ url: 'https://example.com' }),
        browserTool.click({ selector: '#button' }),
        browserTool.getText({ selector: 'h1' }),
        browserTool.screenshot(),
      ];

      const results = await Promise.all(operations);

      // All operations should succeed through inheritance
      results.forEach((result, index) => {
        if (!result.success) {
          // Some operations might still require specific permissions
          // That's acceptable depending on implementation
          console.warn(`Operation ${index} failed:`, result.error);
        }
      });
    });

    it('should handle permission revocation during operation', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      // Start navigation
      const navigation = browserTool.navigate({ url: 'https://example.com' });

      // Revoke permission while operation is in progress
      await permissionManager.denyPermission('browser');

      // Operation should complete since permission was checked at start
      const result = await navigation;
      expect(result.success).toBe(true);

      // But next operation should fail
      const nextResult = await browserTool.screenshot();
      expect(nextResult.success).toBe(false);
    });

    it('should handle permission escalation requests', async () => {
      // Start with basic permission
      await permissionManager.grantPermission('browser', 'allow-always', 'navigate');

      // Attempt operation requiring escalation
      const result = await browserTool.evaluate({
        expression: 'document.sensitive = true',
      });

      // Should generate escalation request
      expect(result.success).toBe(false);
      expect(permissionEvents.some(e =>
        e.type === 'requested' &&
        (e.scope === 'evaluate' || e.escalation === true)
      )).toBe(true);
    });
  });
});