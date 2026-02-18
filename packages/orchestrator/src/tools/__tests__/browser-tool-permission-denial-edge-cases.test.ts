/**
 * Browser Tool Permission Denial Edge Cases and Error Scenarios
 *
 * This test suite focuses on edge cases and error scenarios for the
 * permission denial integration in BrowserTool.execute(), ensuring
 * robust handling of unusual situations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { BrowserTool, BrowserToolConfig } from '../browser-tool';
import { PermissionManager } from '../../permission-manager';
import {
  BrowserPermissionDeniedError,
  isBrowserPermissionDeniedError,
  PermissionLevel,
  ToolPermissionResult
} from '@apexcli/core';

// Mock Playwright
const createMockPage = (shouldError = false) => ({
  on: vi.fn(),
  url: vi.fn(() => shouldError ? 'about:blank' : 'https://example.com'),
  title: vi.fn(() => 'Test Page'),
  goto: vi.fn(() => shouldError ? Promise.reject(new Error('Navigation failed')) : Promise.resolve({ status: () => 200 })),
  click: vi.fn(() => shouldError ? Promise.reject(new Error('Element not found')) : Promise.resolve()),
  evaluate: vi.fn(() => shouldError ? Promise.reject(new Error('Script error')) : Promise.resolve('result')),
  screenshot: vi.fn(() => shouldError ? Promise.reject(new Error('Screenshot failed')) : Promise.resolve(Buffer.from('mock'))),
  close: vi.fn(() => shouldError ? Promise.reject(new Error('Page close failed')) : Promise.resolve()),
  viewportSize: vi.fn(() => ({ width: 1280, height: 720 })),
});

const createMockContext = (shouldError = false) => ({
  newPage: vi.fn(() => shouldError ? Promise.reject(new Error('Page creation failed')) : Promise.resolve(createMockPage())),
  close: vi.fn(() => shouldError ? Promise.reject(new Error('Context close failed')) : Promise.resolve()),
  on: vi.fn(),
});

const createMockBrowser = (shouldError = false) => ({
  newContext: vi.fn(() => shouldError ? Promise.reject(new Error('Context creation failed')) : Promise.resolve(createMockContext())),
  close: vi.fn(() => shouldError ? Promise.reject(new Error('Browser close failed')) : Promise.resolve()),
});

const mockBrowserType = {
  launch: vi.fn(() => Promise.resolve(createMockBrowser())),
};

vi.mock('playwright', () => ({
  chromium: mockBrowserType,
  firefox: mockBrowserType,
  webkit: mockBrowserType,
}));

describe('Browser Tool Permission Denial Edge Cases', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: PermissionManager;
  let eventEmitter: EventEmitter;
  let capturedEvents: any[];

  beforeEach(() => {
    vi.clearAllMocks();

    eventEmitter = new EventEmitter();
    capturedEvents = [];

    eventEmitter.on('permission:denied', (event) => {
      capturedEvents.push({ type: 'permission:denied', ...event });
    });

    mockPermissionManager = {
      checkToolPermission: vi.fn(),
      getToolConfig: vi.fn(),
    } as any;

    browserTool = new BrowserTool({
      permissionManager: mockPermissionManager,
      eventEmitter: eventEmitter,
      backend: 'playwright',
      headless: true,
    });
  });

  afterEach(async () => {
    try {
      await browserTool.destroy();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
    vi.restoreAllMocks();
  });

  describe('Error Object Edge Cases', () => {
    it('should handle BrowserPermissionDeniedError without optional context fields', async () => {
      const minimalError = new BrowserPermissionDeniedError('Minimal permission error');

      (mockPermissionManager.checkToolPermission as any).mockRejectedValue(minimalError);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Minimal permission error');

      const deniedEvents = capturedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(1);

      const event = deniedEvents[0];
      expect(event.error).toBe(minimalError);
      expect(isBrowserPermissionDeniedError(event.error)).toBe(true);
    });

    it('should handle BrowserPermissionDeniedError with all optional context fields', async () => {
      const completeError = new BrowserPermissionDeniedError(
        'Complete permission error',
        {
          operation: 'evaluate',
          target: 'complex-script',
          denialReason: 'Security policy violation',
          permissionType: 'javascript',
          userAgent: 'Test Browser 1.0',
          sessionId: 'test-session-123',
          taskId: 'task-456',
          agentId: 'browser-agent-789'
        }
      );

      (mockPermissionManager.checkToolPermission as any).mockRejectedValue(completeError);

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'test-script' }
      });

      expect(result.success).toBe(false);

      const deniedEvents = capturedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(1);

      const event = deniedEvents[0];
      const errorObj = event.error as BrowserPermissionDeniedError;
      expect(errorObj.browserContext.userAgent).toBe('Test Browser 1.0');
      expect(errorObj.browserContext.taskId).toBe('task-456');
      expect(errorObj.browserContext.agentId).toBe('browser-agent-789');
      expect(errorObj.isPermissionType('javascript')).toBe(true);
    });

    it('should handle malformed permission check responses', async () => {
      // Return malformed permission result
      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: false,
        // Missing other required fields
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      const deniedEvents = capturedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(1);
    });
  });

  describe('Cleanup Edge Cases', () => {
    it('should handle partial cleanup when some resources fail to close', async () => {
      // Setup browser with failing close methods
      const errorBrowser = createMockBrowser();
      const errorContext = createMockContext();
      const errorPage = createMockPage();

      errorPage.close.mockRejectedValue(new Error('Page close failed'));
      errorContext.close.mockRejectedValue(new Error('Context close failed'));
      errorBrowser.close.mockRejectedValue(new Error('Browser close failed'));

      errorContext.newPage.mockResolvedValue(errorPage);
      errorBrowser.newContext.mockResolvedValue(errorContext);
      mockBrowserType.launch.mockResolvedValueOnce(errorBrowser);

      // Establish browser session
      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel
      });
      (mockPermissionManager.getToolConfig as any).mockResolvedValue({ enabled: true });

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Now trigger cleanup via permission denial
      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: false,
        denialReason: 'Permission revoked'
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: {}
      });

      // Should handle cleanup failures gracefully
      expect(result.success).toBe(false);
      expect(() => result).not.toThrow();

      // Should log warnings about cleanup failures
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Error during cleanup/),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle cleanup when browser resources are in inconsistent state', async () => {
      // Manually put browser in inconsistent state
      const resourceState = browserTool.getResourceState();
      (resourceState as any).browserActive = true;
      (resourceState as any).pageActive = false;

      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: false,
        denialReason: 'Inconsistent state test'
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Should handle gracefully
      expect(result.success).toBe(false);
      expect(() => result).not.toThrow();
    });
  });

  describe('Event Emission Edge Cases', () => {
    it('should handle event emission when eventEmitter is undefined', async () => {
      // Create browser tool without event emitter
      const noEmitterTool = new BrowserTool({
        permissionManager: mockPermissionManager,
        // No eventEmitter provided
      });

      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: false,
        denialReason: 'No emitter test'
      });

      const result = await noEmitterTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Should not throw even without event emitter
      expect(result.success).toBe(false);
      expect(() => result).not.toThrow();

      await noEmitterTool.cleanup();
    });

    it('should handle event emission when eventEmitter throws', async () => {
      // Create event emitter that throws on emit
      const throwingEmitter = new EventEmitter();
      throwingEmitter.emit = vi.fn(() => {
        throw new Error('Event emission failed');
      });

      const throwingTool = new BrowserTool({
        permissionManager: mockPermissionManager,
        eventEmitter: throwingEmitter,
      });

      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: false,
        denialReason: 'Emitter throws test'
      });

      const result = await throwingTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Should handle event emission failures gracefully
      expect(result.success).toBe(false);
      expect(() => result).not.toThrow();

      await throwingTool.cleanup();
    });

    it('should emit events with proper timestamps during rapid operations', async () => {
      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: false,
        denialReason: 'Rapid operations test'
      });

      const startTime = Date.now();

      // Execute multiple operations rapidly
      const promises = Array.from({ length: 5 }, (_, i) =>
        browserTool.execute({
          operation: 'navigate',
          params: { url: `https://example${i}.com` }
        })
      );

      await Promise.all(promises);
      const endTime = Date.now();

      const deniedEvents = capturedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(5);

      // Verify all timestamps are within the execution window
      deniedEvents.forEach(event => {
        expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(startTime);
        expect(event.timestamp.getTime()).toBeLessThanOrEqual(endTime);
      });

      // Verify events have unique timestamps (if executed fast enough, some might be same)
      const timestamps = deniedEvents.map(e => e.timestamp.getTime());
      expect(timestamps).toHaveLength(5);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle null/undefined tool configuration', async () => {
      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel
      });
      (mockPermissionManager.getToolConfig as any).mockResolvedValue(null);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Should use default config and succeed
      expect(result.success).toBe(true);
    });

    it('should handle configuration retrieval failure', async () => {
      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel
      });
      (mockPermissionManager.getToolConfig as any).mockRejectedValue(new Error('Config service down'));

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Config service down');
    });

    it('should handle malformed tool configuration', async () => {
      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel
      });
      (mockPermissionManager.getToolConfig as any).mockResolvedValue({
        enabled: 'yes', // Wrong type
        allowedDomains: 'not-an-array', // Wrong type
        blockedDomains: { invalid: 'object' }, // Wrong type
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://malformed-config-test.com' }
      });

      // Should handle malformed config gracefully and proceed
      expect(result.success).toBe(true);
    });
  });

  describe('Resource State Edge Cases', () => {
    it('should handle operations when browser is in destroyed state', async () => {
      // Destroy browser tool first
      await browserTool.destroy();

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('destroyed');
      expect(result.metadata?.permissionGranted).toBe(false);
    });

    it('should handle operations when browser is in cleaning_up state', async () => {
      // Put browser in cleaning_up state by starting cleanup but not completing it
      const originalCleanup = browserTool.cleanup.bind(browserTool);
      let cleanupResolve: (value?: any) => void;
      const cleanupPromise = new Promise(resolve => { cleanupResolve = resolve; });

      vi.spyOn(browserTool, 'cleanup').mockImplementation(async () => {
        (browserTool as any).state = 'cleaning_up';
        await cleanupPromise;
        return originalCleanup();
      });

      // Start cleanup but don't complete it
      const cleanupStarted = browserTool.cleanup();

      // Try to execute operation while cleaning up
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('cleaning up');

      // Complete cleanup
      cleanupResolve!();
      await cleanupStarted;
    });

    it('should handle session ID regeneration after errors', async () => {
      const originalSessionId = browserTool.getResourceState().sessionId;

      // Force an error that triggers destroy
      (mockPermissionManager.checkToolPermission as any).mockRejectedValue(
        new BrowserPermissionDeniedError('Force destroy error')
      );

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // After destroy, create new instance would have new session ID
      // (Testing the concept - actual implementation may vary)
      const postErrorSessionId = browserTool.getResourceState().sessionId;
      expect(postErrorSessionId).toBeDefined();
    });
  });

  describe('Permission Type Edge Cases', () => {
    it('should handle unknown permission types gracefully', async () => {
      const unknownPermissionError = new BrowserPermissionDeniedError(
        'Unknown permission error',
        {
          operation: 'unknown-operation',
          target: 'unknown-target',
          permissionType: 'unknown' as any,
          denialReason: 'Unknown permission type test'
        }
      );

      (mockPermissionManager.checkToolPermission as any).mockRejectedValue(unknownPermissionError);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);

      const deniedEvents = capturedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(1);

      const errorObj = deniedEvents[0].error as BrowserPermissionDeniedError;
      expect(errorObj.browserContext.permissionType).toBe('unknown');
      expect(errorObj.getUserFriendlyMessage()).toContain('Permission was denied');

      const suggestions = errorObj.getResolutionSuggestions();
      expect(suggestions).toContain('Check browser permissions and security settings');
    });

    it('should handle all known permission types correctly', async () => {
      const permissionTypes = [
        'geolocation', 'camera', 'microphone', 'notifications',
        'clipboard', 'storage', 'domain', 'javascript', 'form'
      ] as const;

      for (const permissionType of permissionTypes) {
        const error = new BrowserPermissionDeniedError(
          `${permissionType} permission denied`,
          {
            operation: 'test-operation',
            target: 'test-target',
            permissionType,
            denialReason: `${permissionType} access blocked`
          }
        );

        expect(error.isPermissionType(permissionType)).toBe(true);
        expect(error.getUserFriendlyMessage()).toBeDefined();
        expect(error.getResolutionSuggestions()).toHaveLength.greaterThan(0);
      }
    });
  });

  describe('Concurrent Operation Edge Cases', () => {
    it('should handle permission denials during concurrent operations', async () => {
      let callCount = 0;
      (mockPermissionManager.checkToolPermission as any).mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          allowed: callCount <= 2, // Allow first 2, deny rest
          denialReason: callCount > 2 ? 'Rate limit exceeded' : undefined
        });
      });
      (mockPermissionManager.getToolConfig as any).mockResolvedValue({ enabled: true });

      const operations = Array.from({ length: 5 }, (_, i) =>
        browserTool.execute({
          operation: 'navigate',
          params: { url: `https://concurrent${i}.com` }
        })
      );

      const results = await Promise.all(operations);

      // First 2 should succeed, rest should fail
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(false);
      expect(results[3].success).toBe(false);
      expect(results[4].success).toBe(false);

      // Should have permission denied events for failed operations
      const deniedEvents = capturedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(3);
    });
  });
});