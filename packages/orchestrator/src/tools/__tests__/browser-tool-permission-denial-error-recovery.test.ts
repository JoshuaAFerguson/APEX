/**
 * Browser Tool Permission Denial Error Recovery Test Suite
 *
 * This test suite focuses on error recovery and resilience scenarios
 * for permission denial handling, ensuring the system can recover
 * gracefully from various failure modes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { BrowserTool, BrowserToolConfig } from '../browser-tool';
import { PermissionManager } from '../../permission-manager';
import {
  BrowserPermissionDeniedError,
  isBrowserPermissionDeniedError,
  PermissionLevel,
  ToolPermissionResult,
  ApexError,
  ApexErrorCode
} from '@apexcli/core';

// Enhanced mocks for error scenarios
const createMockPage = (failureMode?: 'close' | 'operation') => ({
  on: vi.fn(),
  url: vi.fn(() => 'https://example.com'),
  title: vi.fn(() => 'Test Page'),
  goto: vi.fn(() => {
    if (failureMode === 'operation') {
      return Promise.reject(new Error('Page operation failed'));
    }
    return Promise.resolve({ status: () => 200 });
  }),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('screenshot'))),
  close: vi.fn(() => {
    if (failureMode === 'close') {
      return Promise.reject(new Error('Page close failed'));
    }
    return Promise.resolve();
  }),
  viewportSize: vi.fn(() => ({ width: 1280, height: 720 })),
});

const createMockContext = (failureMode?: 'close' | 'page') => ({
  newPage: vi.fn(() => {
    if (failureMode === 'page') {
      return Promise.reject(new Error('Page creation failed'));
    }
    return Promise.resolve(createMockPage());
  }),
  close: vi.fn(() => {
    if (failureMode === 'close') {
      return Promise.reject(new Error('Context close failed'));
    }
    return Promise.resolve();
  }),
  on: vi.fn(),
});

const createMockBrowser = (failureMode?: 'close' | 'context') => ({
  newContext: vi.fn(() => {
    if (failureMode === 'context') {
      return Promise.reject(new Error('Context creation failed'));
    }
    return Promise.resolve(createMockContext());
  }),
  close: vi.fn(() => {
    if (failureMode === 'close') {
      return Promise.reject(new Error('Browser close failed'));
    }
    return Promise.resolve();
  }),
});

const mockBrowserType = {
  launch: vi.fn(() => Promise.resolve(createMockBrowser())),
};

vi.mock('playwright', () => ({
  chromium: mockBrowserType,
  firefox: mockBrowserType,
  webkit: mockBrowserType,
}));

describe('Browser Tool Permission Denial Error Recovery', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: PermissionManager;
  let eventEmitter: EventEmitter;
  let capturedEvents: any[];
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    eventEmitter = new EventEmitter();
    capturedEvents = [];

    // Capture events
    eventEmitter.on('permission:denied', (event) => {
      capturedEvents.push({ type: 'permission:denied', ...event });
    });

    eventEmitter.on('browser:error', (event) => {
      capturedEvents.push({ type: 'browser:error', ...event });
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

    // Spy on console methods to verify error handling
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    try {
      await browserTool.destroy();
    } catch (error) {
      // Ignore cleanup errors in tests
    }

    vi.restoreAllMocks();
  });

  describe('Cleanup Failure Recovery', () => {
    it('should recover gracefully when cleanup fails during permission denial', async () => {
      // Setup: Establish browser session first
      (mockPermissionManager.checkToolPermission as any)
        .mockResolvedValueOnce({
          allowed: true,
          level: 'full' as PermissionLevel
        })
        .mockResolvedValueOnce({
          allowed: false,
          denialReason: 'Permission revoked'
        });

      (mockPermissionManager.getToolConfig as any).mockResolvedValue({ enabled: true });

      // Create browser with failing close methods
      const failingBrowser = createMockBrowser('close');
      const failingContext = createMockContext('close');
      const failingPage = createMockPage('close');

      failingContext.newPage.mockResolvedValue(failingPage);
      failingBrowser.newContext.mockResolvedValue(failingContext);
      mockBrowserType.launch.mockResolvedValueOnce(failingBrowser);

      // Establish session
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Clear events from successful operation
      capturedEvents.length = 0;

      // Trigger permission denial with cleanup failure
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: {}
      });

      // Should handle gracefully despite cleanup failures
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission revoked');
      expect(() => result).not.toThrow();

      // Should log warnings about cleanup failures
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error during cleanup'),
        expect.any(Error)
      );

      // Should still emit permission denied event
      const deniedEvents = capturedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents.length).toBeGreaterThan(0);
    });

    it('should handle cascading cleanup failures', async () => {
      // Setup browser session with all close methods failing
      const failingBrowser = createMockBrowser('close');
      const failingContext = createMockContext('close');
      const failingPage = createMockPage('close');

      failingPage.close.mockRejectedValue(new Error('Page close catastrophic failure'));
      failingContext.close.mockRejectedValue(new Error('Context close catastrophic failure'));
      failingBrowser.close.mockRejectedValue(new Error('Browser close catastrophic failure'));

      failingContext.newPage.mockResolvedValue(failingPage);
      failingBrowser.newContext.mockResolvedValue(failingContext);
      mockBrowserType.launch.mockResolvedValueOnce(failingBrowser);

      (mockPermissionManager.checkToolPermission as any)
        .mockResolvedValueOnce({ allowed: true, level: 'full' })
        .mockResolvedValueOnce({ allowed: false, denialReason: 'Cascade test' });

      (mockPermissionManager.getToolConfig as any).mockResolvedValue({ enabled: true });

      // Establish session then trigger denial
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      capturedEvents.length = 0;

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: {}
      });

      // Should survive cascading failures
      expect(result.success).toBe(false);
      expect(() => result).not.toThrow();

      // Should log multiple warnings for different cleanup failures
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('Event Emission Failure Recovery', () => {
    it('should continue operation when event emission fails', async () => {
      // Create event emitter that throws on specific events
      const faultyEmitter = new EventEmitter();
      faultyEmitter.emit = vi.fn((event, data) => {
        if (event === 'permission:denied') {
          throw new Error('Event emission critical failure');
        }
        return true;
      });

      const faultyTool = new BrowserTool({
        permissionManager: mockPermissionManager,
        eventEmitter: faultyEmitter,
      });

      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: false,
        denialReason: 'Event emission failure test'
      });

      const result = await faultyTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Should complete despite event emission failure
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Event emission failure test');
      expect(() => result).not.toThrow();

      await faultyTool.cleanup();
    });

    it('should handle event listener exceptions during emission', async () => {
      // Add event listener that throws
      eventEmitter.on('permission:denied', () => {
        throw new Error('Event listener processing error');
      });

      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: false,
        denialReason: 'Listener exception test'
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Should complete despite listener exceptions
      expect(result.success).toBe(false);
      expect(() => result).not.toThrow();
    });
  });

  describe('Permission Manager Failure Recovery', () => {
    it('should handle permission manager becoming unavailable', async () => {
      (mockPermissionManager.checkToolPermission as any).mockRejectedValue(
        new Error('Permission manager service unavailable')
      );

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission manager service unavailable');
      expect(result.metadata?.permissionGranted).toBe(false);
    });

    it('should handle permission manager returning invalid responses', async () => {
      // Return invalid permission result
      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        // Missing required 'allowed' field
        invalidField: 'invalid value'
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Should handle gracefully
      expect(result).toBeDefined();
      expect(() => result).not.toThrow();
    });

    it('should recover when permission manager throws non-standard errors', async () => {
      // Throw non-Error object
      (mockPermissionManager.checkToolPermission as any).mockRejectedValue('String error');

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });
  });

  describe('Browser Launch Failure Recovery', () => {
    it('should handle browser launch failure during permission denial', async () => {
      // Make browser launch fail
      mockBrowserType.launch.mockRejectedValue(new Error('Browser launch catastrophic failure'));

      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel
      });

      (mockPermissionManager.getToolConfig as any).mockResolvedValue({ enabled: true });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser launch catastrophic failure');
      expect(() => result).not.toThrow();
    });

    it('should handle browser resource allocation failure after permission grant', async () => {
      // Permission granted, but browser creation fails
      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel
      });

      (mockPermissionManager.getToolConfig as any).mockResolvedValue({ enabled: true });

      const failingBrowser = createMockBrowser('context');
      mockBrowserType.launch.mockResolvedValueOnce(failingBrowser);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Context creation failed');
    });
  });

  describe('Memory and Resource Leak Prevention', () => {
    it('should prevent resource leaks when permission denied before launch', async () => {
      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: false,
        denialReason: 'Early denial test'
      });

      const initialState = browserTool.getResourceState();

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      const finalState = browserTool.getResourceState();

      expect(result.success).toBe(false);
      expect(finalState.browserActive).toBe(false);
      expect(finalState.contextActive).toBe(false);
      expect(finalState.pageActive).toBe(false);
      expect(finalState.activeOperations).toBe(0);

      // Verify browser launch was not called
      expect(mockBrowserType.launch).not.toHaveBeenCalled();
    });

    it('should handle resource state corruption gracefully', async () => {
      // Manually corrupt resource state
      const resourceState = browserTool.getResourceState();
      (resourceState as any).browserActive = true;
      (resourceState as any).activeOperations = -1; // Invalid value

      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: false,
        denialReason: 'Corrupted state test'
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Should handle corrupted state without crashing
      expect(result.success).toBe(false);
      expect(() => result).not.toThrow();
    });
  });

  describe('State Machine Recovery', () => {
    it('should recover from destroyed state with proper error handling', async () => {
      // Destroy browser tool
      await browserTool.destroy();

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('destroyed');
      expect(result.operation).toBe('navigate');
      expect(result.metadata?.permissionGranted).toBe(false);
    });

    it('should handle rapid state transitions during permission denial', async () => {
      // Simulate rapid operations that cause state transitions
      (mockPermissionManager.checkToolPermission as any)
        .mockResolvedValueOnce({ allowed: true, level: 'full' })
        .mockResolvedValue({ allowed: false, denialReason: 'Rapid transition test' });

      (mockPermissionManager.getToolConfig as any).mockResolvedValue({ enabled: true });

      // Start operation that will succeed
      const successPromise = browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Start operation that will be denied while first is running
      const denialPromise = browserTool.execute({
        operation: 'screenshot',
        params: {}
      });

      const [successResult, denialResult] = await Promise.all([successPromise, denialPromise]);

      expect(successResult.success).toBe(true);
      expect(denialResult.success).toBe(false);
      expect(() => successResult).not.toThrow();
      expect(() => denialResult).not.toThrow();
    });
  });

  describe('Error Context Preservation', () => {
    it('should preserve error context through multiple failure layers', async () => {
      const originalError = new BrowserPermissionDeniedError(
        'Original permission failure',
        {
          operation: 'evaluate',
          target: 'dangerous-script',
          permissionType: 'javascript',
          denialReason: 'Security policy violation',
          sessionId: 'test-session-123'
        }
      );

      (mockPermissionManager.checkToolPermission as any).mockRejectedValue(originalError);

      // Mock cleanup to also fail
      const cleanupSpy = vi.spyOn(browserTool, 'cleanup').mockRejectedValue(
        new Error('Cleanup failure during error handling')
      );

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'dangerous code' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Original permission failure');
      expect(result.metadata?.target).toBe('dangerous-script');

      // Error context should be preserved in events
      const deniedEvents = capturedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents.length).toBeGreaterThan(0);

      const event = deniedEvents[0];
      expect(event.error).toBe(originalError);
      expect(event.operation).toBe('evaluate');
      expect(event.target).toBe('dangerous-script');

      cleanupSpy.mockRestore();
    });

    it('should handle error context when original error lacks context', async () => {
      const minimalError = new Error('Minimal error');
      (mockPermissionManager.checkToolPermission as any).mockRejectedValue(minimalError);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://minimal-error-test.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Minimal error');
      expect(result.metadata?.target).toBe('https://minimal-error-test.com');
      expect(result.metadata?.permissionGranted).toBe(false);
    });
  });

  describe('Recovery After Multiple Failures', () => {
    it('should maintain operational capability after series of permission denials', async () => {
      // Series of denials followed by successful operation
      (mockPermissionManager.checkToolPermission as any)
        .mockResolvedValueOnce({ allowed: false, denialReason: 'Denial 1' })
        .mockResolvedValueOnce({ allowed: false, denialReason: 'Denial 2' })
        .mockResolvedValueOnce({ allowed: false, denialReason: 'Denial 3' })
        .mockResolvedValueOnce({ allowed: true, level: 'full' });

      (mockPermissionManager.getToolConfig as any).mockResolvedValue({ enabled: true });

      // Execute multiple denied operations
      const denial1 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://denied1.com' }
      });

      const denial2 = await browserTool.execute({
        operation: 'screenshot',
        params: {}
      });

      const denial3 = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'denied script' }
      });

      // Then successful operation
      const success = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://allowed.com' }
      });

      expect(denial1.success).toBe(false);
      expect(denial2.success).toBe(false);
      expect(denial3.success).toBe(false);
      expect(success.success).toBe(true);

      // Should have denial events for each failure
      const deniedEvents = capturedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(3);

      // Browser should remain functional
      expect(browserTool.getState()).not.toBe('destroyed');
    });
  });
});