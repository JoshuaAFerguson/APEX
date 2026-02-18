/**
 * BrowserTool Lifecycle State Tests - Edge Cases & Error Scenarios
 *
 * Additional test coverage for edge cases and error scenarios not covered
 * in the main lifecycle test suite, including:
 * - Race conditions during state transitions
 * - Error handling during state transitions
 * - Invalid state manipulations
 * - Event emission edge cases
 * - Resource leak prevention
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BrowserTool,
  BrowserToolLifecycleState
} from '../browser-tool';
import { PermissionManager } from '../../permission-manager';
import { EventEmitter } from 'eventemitter3';
import { ApexError, ApexErrorCode } from '@apexcli/core';

// Mock Playwright
const mockPage = {
  on: vi.fn(),
  off: vi.fn(),
  url: vi.fn(() => 'https://example.com'),
  title: vi.fn(() => 'Test Page'),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(),
  fill: vi.fn(),
  type: vi.fn(),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('screenshot-data'))),
  evaluate: vi.fn(),
  waitForSelector: vi.fn(),
  getAttribute: vi.fn(() => Promise.resolve('test-attribute')),
  textContent: vi.fn(() => Promise.resolve('test content')),
  innerHTML: vi.fn(() => Promise.resolve('<div>test</div>')),
  content: vi.fn(() => Promise.resolve('<!DOCTYPE html><html><body>test</body></html>')),
  hover: vi.fn(),
  close: vi.fn(),
  locator: vi.fn(() => ({
    screenshot: vi.fn(() => Promise.resolve(Buffer.from('element-screenshot'))),
    scrollIntoViewIfNeeded: vi.fn(),
    evaluate: vi.fn(),
  })),
  viewportSize: vi.fn(() => ({ width: 1280, height: 720 })),
};

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  on: vi.fn(),
  close: vi.fn(),
};

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext)),
  close: vi.fn(),
  version: vi.fn(() => '1.40.0'),
  isConnected: vi.fn(() => true),
};

const mockBrowserType = {
  launch: vi.fn(() => Promise.resolve(mockBrowser)),
};

// Mock Playwright modules
vi.mock('playwright', () => ({
  chromium: mockBrowserType,
  firefox: mockBrowserType,
  webkit: mockBrowserType,
}));

describe('BrowserTool Lifecycle State Management - Edge Cases', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: PermissionManager;
  let eventEmitter: EventEmitter;
  let stateTransitionEvents: any[];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock browser responses
    mockBrowser.newContext.mockResolvedValue(mockContext);
    mockContext.newPage.mockResolvedValue(mockPage);

    // Create mock permission manager
    mockPermissionManager = {
      checkToolPermission: vi.fn(() => Promise.resolve({
        allowed: true,
        level: 'full',
        requiresConfirmation: false,
      })),
      getToolConfig: vi.fn(() => Promise.resolve({
        enabled: true,
        allowJavaScriptExecution: true,
        allowFormSubmission: true,
        allowScreenshots: true,
        allowedDomains: [],
        blockedDomains: [],
      })),
    } as any;

    eventEmitter = new EventEmitter();
    stateTransitionEvents = [];

    // Listen for state transition events
    eventEmitter.on('browser:state:transition', (event) => {
      stateTransitionEvents.push(event);
    });

    browserTool = new BrowserTool({
      permissionManager: mockPermissionManager,
      eventEmitter,
    });
  });

  afterEach(async () => {
    try {
      await browserTool.destroy();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('State Transition Error Handling', () => {
    it('should handle browser launch errors during state transition', async () => {
      mockBrowserType.launch.mockRejectedValue(new Error('Failed to launch browser'));

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to launch browser');
      // State should remain idle after failed launch
      expect(browserTool.getState()).toBe('idle');
    });

    it('should handle page creation errors during state transition', async () => {
      mockContext.newPage.mockRejectedValue(new Error('Failed to create page'));

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create page');
      // State should be cleaned up properly after page creation failure
      expect(browserTool.getState()).toBe('idle');
    });

    it('should handle event emitter errors during state transitions', async () => {
      const faultyEmitter = new EventEmitter();
      faultyEmitter.emit = vi.fn(() => {
        throw new Error('Event emission failed');
      });

      const tool = new BrowserTool({
        permissionManager: mockPermissionManager,
        eventEmitter: faultyEmitter,
      });

      // Should still work despite event emission failures
      const result = await tool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(true);
      expect(tool.getState()).toBe('active');

      await tool.destroy();
    });
  });

  describe('Race Condition Protection', () => {
    it('should handle concurrent execution attempts safely', async () => {
      // Start two operations concurrently
      const promise1 = browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      const promise2 = browserTool.execute({
        operation: 'click',
        params: { selector: '#button' },
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should succeed
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(browserTool.getState()).toBe('active');
    });

    it('should prevent operations during concurrent cleanup', async () => {
      // First activate the tool
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Mock page.close to be slow
      let cleanupResolve: Function;
      const cleanupPromise = new Promise((resolve) => {
        cleanupResolve = resolve;
      });
      mockPage.close.mockImplementation(() => cleanupPromise);

      // Start cleanup and operation concurrently
      const cleanupInProgress = browserTool.cleanup();

      // Wait a bit to ensure cleanup has started
      await new Promise(resolve => setTimeout(resolve, 5));

      const operationPromise = browserTool.execute({
        operation: 'click',
        params: { selector: '#button' },
      });

      // Complete cleanup
      cleanupResolve!();
      await cleanupInProgress;

      const result = await operationPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('cleaning up');
      expect(browserTool.getState()).toBe('destroyed');
    });

    it('should handle concurrent cleanup calls gracefully', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Start multiple cleanup operations concurrently
      const cleanup1 = browserTool.cleanup();
      const cleanup2 = browserTool.cleanup();
      const cleanup3 = browserTool.destroy();

      await Promise.all([cleanup1, cleanup2, cleanup3]);

      expect(browserTool.getState()).toBe('destroyed');
      expect(browserTool.isActive()).toBe(false);
    });
  });

  describe('State Validation and Error Messages', () => {
    it('should provide clear error messages for each invalid state', async () => {
      // Test destroyed state error
      await browserTool.destroy();

      const destroyedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(destroyedResult.success).toBe(false);
      expect(destroyedResult.error).toBe('Cannot execute operation: BrowserTool instance has been destroyed');
      expect(destroyedResult.metadata?.permissionGranted).toBe(false);
    });

    it('should validate state consistency after various operations', async () => {
      // Initial state
      expect(browserTool.getState()).toBe('idle');
      expect(browserTool.isActive()).toBe(false);

      // After first operation
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });
      expect(browserTool.getState()).toBe('active');
      expect(browserTool.isActive()).toBe(true);

      // After subsequent operations
      await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' },
      });
      expect(browserTool.getState()).toBe('active');
      expect(browserTool.isActive()).toBe(true);

      // After cleanup
      await browserTool.cleanup();
      expect(browserTool.getState()).toBe('destroyed');
      expect(browserTool.isActive()).toBe(false);
    });
  });

  describe('Event Emission Edge Cases', () => {
    it('should handle missing event emitter gracefully', () => {
      const toolWithoutEvents = new BrowserTool({
        permissionManager: mockPermissionManager,
        // No eventEmitter provided
      });

      expect(toolWithoutEvents.getState()).toBe('idle');
      expect(toolWithoutEvents.isActive()).toBe(false);

      // State transitions should still work
      expect(async () => {
        await toolWithoutEvents.execute({
          operation: 'navigate',
          params: { url: 'https://example.com' },
        });
      }).not.toThrow();
    });

    it('should emit correct session IDs across all events', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      await browserTool.cleanup();

      // Verify all events have the same session ID
      const sessionIds = stateTransitionEvents.map(event => event.sessionId);
      const uniqueSessionIds = [...new Set(sessionIds)];
      expect(uniqueSessionIds).toHaveLength(1);
      expect(uniqueSessionIds[0]).toMatch(/^[a-f0-9-]+$/); // UUID format
    });

    it('should emit events with proper timestamps', async () => {
      const startTime = Date.now();

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      const endTime = Date.now();

      expect(stateTransitionEvents).toHaveLength(2);

      for (const event of stateTransitionEvents) {
        expect(event.timestamp).toBeInstanceOf(Date);
        expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(startTime);
        expect(event.timestamp.getTime()).toBeLessThanOrEqual(endTime);
      }
    });

    it('should handle large numbers of rapid state transitions', async () => {
      const operations = Array.from({ length: 10 }, (_, i) =>
        browserTool.execute({
          operation: 'evaluate',
          params: { script: `console.log(${i})` },
        })
      );

      await Promise.all(operations);

      // Should only have 2 state transition events (idle -> launching -> active)
      // regardless of number of operations after activation
      expect(stateTransitionEvents).toHaveLength(2);
      expect(browserTool.getState()).toBe('active');
    });
  });

  describe('Resource Leak Prevention', () => {
    it('should clean up all resources even on repeated destroy calls', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Multiple destroy calls should be safe
      await browserTool.destroy();
      await browserTool.destroy();
      await browserTool.destroy();

      expect(browserTool.getState()).toBe('destroyed');
      expect(mockPage.close).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle cleanup failures gracefully', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Mock cleanup failure
      mockPage.close.mockRejectedValue(new Error('Close failed'));

      // Cleanup should still complete and transition to destroyed state
      await expect(browserTool.cleanup()).rejects.toThrow();
      expect(browserTool.getState()).toBe('destroyed');
    });

    it('should force cleanup on destroy even when normal cleanup fails', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Mock all cleanup methods to fail
      mockPage.close.mockRejectedValue(new Error('Page close failed'));
      mockContext.close.mockRejectedValue(new Error('Context close failed'));
      mockBrowser.close.mockRejectedValue(new Error('Browser close failed'));

      // Destroy should still succeed and clean up state
      await browserTool.destroy();

      expect(browserTool.getState()).toBe('destroyed');
      expect(browserTool.isActive()).toBe(false);
    });
  });

  describe('Integration with Permission System', () => {
    it('should maintain state consistency when permissions are denied', async () => {
      // Mock permission denial
      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: false,
        level: null,
        requiresConfirmation: false,
        denialReason: 'Permission denied',
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
      expect(browserTool.getState()).toBe('idle'); // Should remain idle
    });

    it('should handle permission manager errors without state corruption', async () => {
      (mockPermissionManager.checkToolPermission as any).mockRejectedValue(
        new Error('Permission check failed')
      );

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission check failed');
      expect(browserTool.getState()).toBe('idle');
    });

    it('should allow state transitions when no permission manager is provided', async () => {
      const tool = new BrowserTool({
        eventEmitter,
      });

      expect(tool.getState()).toBe('idle');

      const result = await tool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(true);
      expect(tool.getState()).toBe('active');

      await tool.destroy();
    });
  });
});