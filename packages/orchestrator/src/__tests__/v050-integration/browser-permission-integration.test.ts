/**
 * Integration tests for Browser Automation with Permission System
 *
 * Tests verify:
 * 1. Browser operations require correct permissions
 * 2. Permission levels (allow-always, allow-once, deny) are respected
 * 3. Domain-based access control with permission manager
 * 4. Dangerous operations (evaluate, submit) require elevated permissions
 * 5. Permission events are emitted correctly during browser operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';

import {
  createTestEnvironment,
  createTestTask,
  MockBrowserSession,
  expectPermissionGranted,
  expectPermissionDenied,
} from './test-utils';
import { BrowserTool } from '../../tools/browser-tool';
import { PermissionManager } from '../../permission-manager';
import { PermissionStore } from '../../permission-store';
import { PermissionPresetManager } from '../../permission-preset-manager';

import type {
  Task,
  PermissionLevel,
  BrowserSession,
  BrowserSessionConfig,
} from '@apexcli/core';

describe('Browser + Permission System Integration', () => {
  let testEnv: Awaited<ReturnType<typeof createTestEnvironment>>;
  let testTask: Task;
  let mockSession: MockBrowserSession;
  let browserTool: BrowserTool;
  let permissionEvents: any[] = [];

  beforeEach(async () => {
    testEnv = await createTestEnvironment();
    testTask = createTestTask(testEnv.testDir);
    await testEnv.taskStore.addTask(testTask);

    // Create mock browser session
    mockSession = new MockBrowserSession({
      browserType: 'chromium',
      headless: true,
      allowedDomains: ['example.com', 'test.local'],
      blockedDomains: ['blocked.com', 'malicious.site'],
    });

    // Override BrowserTool to use mock session
    browserTool = testEnv.browserTool;
    vi.spyOn(browserTool as any, 'createSession').mockResolvedValue(mockSession);

    // Capture permission events
    permissionEvents = [];
    testEnv.permissionManager.store.on('permission:requested', (event) => {
      permissionEvents.push({ type: 'requested', ...event });
    });
    testEnv.permissionManager.store.on('permission:granted', (event) => {
      permissionEvents.push({ type: 'granted', ...event });
    });
    testEnv.permissionManager.store.on('permission:denied', (event) => {
      permissionEvents.push({ type: 'denied', ...event });
    });
  });

  afterEach(async () => {
    await mockSession?.close();
    await testEnv.cleanup();
    vi.restoreAllMocks();
  });

  describe('Permission Gate Integration', () => {
    it('should block navigate without permission', async () => {
      // Ensure no existing permission
      await testEnv.permissionManager.denyPermission('browser', 'navigate');

      const result = await browserTool.navigate({
        url: 'https://example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('permission');
      expect(permissionEvents.some(e => e.type === 'denied')).toBe(true);
    });

    it('should allow navigate with allow-always permission', async () => {
      // Grant permanent permission
      await testEnv.permissionManager.grantPermission('browser', 'allow-always', 'navigate');

      const result = await browserTool.navigate({
        url: 'https://example.com',
      });

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://example.com');
      expect(mockSession.url).toBe('https://example.com');
      expect(permissionEvents.some(e => e.type === 'granted')).toBe(true);
    });

    it('should consume allow-once permission on single navigation', async () => {
      // Grant one-time permission
      await testEnv.permissionManager.grantPermission('browser', 'allow-once', 'navigate');

      // First navigation should succeed
      const result1 = await browserTool.navigate({
        url: 'https://example.com',
      });
      expect(result1.success).toBe(true);

      // Reset mock for second attempt
      vi.clearAllMocks();
      permissionEvents.length = 0;

      // Second navigation should be denied (permission consumed)
      const result2 = await browserTool.navigate({
        url: 'https://test.local',
      });
      expect(result2.success).toBe(false);
      expect(permissionEvents.some(e => e.type === 'denied')).toBe(true);
    });

    it('should emit permission:request event for unpermitted operations', async () => {
      permissionEvents.length = 0;

      // Attempt operation without permission
      await browserTool.click({ selector: '#button' });

      expect(permissionEvents).toContainEqual(
        expect.objectContaining({
          type: 'requested',
          tool: 'browser',
          scope: 'click',
        })
      );
    });

    it('should respect domain blocklist from BrowserToolConfig', async () => {
      // Grant browser permission
      await testEnv.permissionManager.grantPermission('browser', 'allow-always');

      const result = await browserTool.navigate({
        url: 'https://blocked.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Domain blocked');
    });

    it('should require elevated permission for evaluate operation', async () => {
      // Grant basic browser permission
      await testEnv.permissionManager.grantPermission('browser', 'allow-always');

      // Evaluate should still be blocked as dangerous operation
      const result = await browserTool.evaluate({
        expression: 'document.title',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('permission');
      expect(permissionEvents.some(e =>
        e.type === 'requested' && e.scope === 'evaluate'
      )).toBe(true);
    });

    it('should require elevated permission for form submission', async () => {
      // Grant basic browser permission
      await testEnv.permissionManager.grantPermission('browser', 'allow-always');

      // Submit should require elevated permission
      const result = await browserTool.submit({
        selector: '#form',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('permission');
      expect(permissionEvents.some(e =>
        e.type === 'requested' && e.scope === 'submit'
      )).toBe(true);
    });
  });

  describe('Session Permission Lifecycle', () => {
    it('should persist allow-always across browser sessions', async () => {
      // Grant permanent permission
      await testEnv.permissionManager.grantPermission('browser', 'allow-always', 'navigate');

      // First session
      const result1 = await browserTool.navigate({ url: 'https://example.com' });
      expect(result1.success).toBe(true);

      // Close session and create new one
      await mockSession.close();
      mockSession = new MockBrowserSession({
        browserType: 'chromium',
        headless: true,
        allowedDomains: ['example.com'],
        blockedDomains: [],
      });
      vi.spyOn(browserTool as any, 'createSession').mockResolvedValue(mockSession);

      // Second session should still work
      const result2 = await browserTool.navigate({ url: 'https://example.com' });
      expect(result2.success).toBe(true);
    });

    it('should clear session cache on resetSession()', async () => {
      // Grant one-time permission
      await testEnv.permissionManager.grantPermission('browser', 'allow-once', 'navigate');

      // Reset session (clears allow-once cache)
      testEnv.permissionManager.resetSession();

      // Navigation should be denied
      const result = await browserTool.navigate({ url: 'https://example.com' });
      expect(result.success).toBe(false);
    });

    it('should track permission decisions in PermissionStore', async () => {
      const tool = 'browser';
      const scope = 'navigate';

      // Grant permission and verify it's stored
      await testEnv.permissionManager.grantPermission(tool, 'allow-always', scope);

      const storedPermission = testEnv.permissionManager.getPermission(tool, scope);
      expect(storedPermission).toBe('allow-always');

      // Deny permission and verify update
      await testEnv.permissionManager.denyPermission(tool, scope);

      const updatedPermission = testEnv.permissionManager.getPermission(tool, scope);
      expect(updatedPermission).toBe('deny');
    });
  });

  describe('Permission Preset Behavior', () => {
    it('should allow all operations with autonomous preset', async () => {
      const presetManager = new PermissionPresetManager(testEnv.permissionManager);
      presetManager.applyPreset('autonomous');

      // All operations should be allowed
      const navigateResult = await browserTool.navigate({ url: 'https://example.com' });
      expect(navigateResult.success).toBe(true);

      const clickResult = await browserTool.click({ selector: '#button' });
      expect(clickResult.success).toBe(true);

      const screenshotResult = await browserTool.screenshot();
      expect(screenshotResult.success).toBe(true);
    });

    it('should prompt for each operation with review-all preset', async () => {
      const presetManager = new PermissionPresetManager(testEnv.permissionManager);
      presetManager.applyPreset('reviewAll');

      // Mock user denying permission
      vi.spyOn(testEnv.permissionManager, 'checkToolPermission')
        .mockResolvedValue({ granted: false, level: 'deny', reason: 'User denied' });

      const result = await browserTool.navigate({ url: 'https://example.com' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('permission');
    });

    it('should block write operations with read-only preset', async () => {
      const presetManager = new PermissionPresetManager(testEnv.permissionManager);
      presetManager.applyPreset('readOnly');

      // Read-like operations should work
      const screenshotResult = await browserTool.screenshot();
      expect(screenshotResult.success).toBe(true);

      const getTextResult = await browserTool.getText({ selector: 'h1' });
      expect(getTextResult.success).toBe(true);

      // Write-like operations should be blocked
      const clickResult = await browserTool.click({ selector: '#button' });
      expect(clickResult.success).toBe(false);

      const typeResult = await browserTool.type({ selector: '#input', text: 'test' });
      expect(typeResult.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle permission denial gracefully', async () => {
      // Deny permission
      await testEnv.permissionManager.denyPermission('browser');

      const result = await browserTool.navigate({ url: 'https://example.com' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('permission');
      expect(result.url).toBeUndefined();
    });

    it('should return permission error in BrowserResult metadata', async () => {
      await testEnv.permissionManager.denyPermission('browser', 'navigate');

      const result = await browserTool.navigate({ url: 'https://example.com' });

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('permission'),
        metadata: expect.objectContaining({
          operation: 'navigate',
          permissionDenied: true,
        }),
      });
    });

    it('should not execute browser action when permission denied', async () => {
      const navigateSpy = vi.spyOn(mockSession, 'navigate');
      await testEnv.permissionManager.denyPermission('browser');

      await browserTool.navigate({ url: 'https://example.com' });

      // Mock browser session should not have been called
      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Advanced Permission Scenarios', () => {
    it('should handle mixed permission levels for different operations', async () => {
      // Allow navigation but deny clicking
      await testEnv.permissionManager.grantPermission('browser', 'allow-always', 'navigate');
      await testEnv.permissionManager.denyPermission('browser', 'click');

      const navigateResult = await browserTool.navigate({ url: 'https://example.com' });
      expect(navigateResult.success).toBe(true);

      const clickResult = await browserTool.click({ selector: '#button' });
      expect(clickResult.success).toBe(false);
    });

    it('should respect scope-specific permissions', async () => {
      // Allow screenshots but deny evaluate
      await testEnv.permissionManager.grantPermission('browser', 'allow-always', 'screenshot');
      await testEnv.permissionManager.denyPermission('browser', 'evaluate');

      const screenshotResult = await browserTool.screenshot();
      expect(screenshotResult.success).toBe(true);

      const evaluateResult = await browserTool.evaluate({ expression: 'window.location' });
      expect(evaluateResult.success).toBe(false);
    });

    it('should handle permission inheritance from parent scopes', async () => {
      // Grant general browser permission
      await testEnv.permissionManager.grantPermission('browser', 'allow-always');

      // Specific scopes should inherit permission
      const navigateResult = await browserTool.navigate({ url: 'https://example.com' });
      expect(navigateResult.success).toBe(true);

      const clickResult = await browserTool.click({ selector: '#button' });
      expect(clickResult.success).toBe(true);
    });

    it('should track usage metadata for permission decisions', async () => {
      await testEnv.permissionManager.grantPermission('browser', 'allow-always');

      const startTime = Date.now();
      await browserTool.navigate({ url: 'https://example.com' });
      await browserTool.screenshot();
      const endTime = Date.now();

      // Check that usage was tracked
      const grantedEvents = permissionEvents.filter(e => e.type === 'granted');
      expect(grantedEvents.length).toBeGreaterThan(0);

      grantedEvents.forEach(event => {
        expect(event.timestamp).toBeGreaterThanOrEqual(startTime);
        expect(event.timestamp).toBeLessThanOrEqual(endTime);
        expect(event.tool).toBe('browser');
      });
    });
  });
});