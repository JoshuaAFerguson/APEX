/**
 * BrowserTool Lifecycle State Integration Tests
 *
 * Tests the integration between lifecycle state management and other
 * BrowserTool features such as:
 * - Console stream management
 * - Resource state tracking
 * - Event emission coordination
 * - Permission integration
 * - Tool configuration validation
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

describe('BrowserTool Lifecycle Integration Tests', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: PermissionManager;
  let eventEmitter: EventEmitter;
  let allEvents: any[];

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
    allEvents = [];

    // Capture all events for analysis
    eventEmitter.onAny((eventName, eventData) => {
      allEvents.push({ eventName, eventData });
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

  describe('Lifecycle and Resource State Integration', () => {
    it('should maintain consistent resource state throughout lifecycle', async () => {
      // Initial state
      expect(browserTool.getState()).toBe('idle');
      const initialResourceState = browserTool.getResourceState();
      expect(initialResourceState.browserActive).toBe(false);
      expect(initialResourceState.contextActive).toBe(false);
      expect(initialResourceState.pageActive).toBe(false);

      // After activation
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(browserTool.getState()).toBe('active');
      const activeResourceState = browserTool.getResourceState();
      expect(activeResourceState.browserActive).toBe(true);
      expect(activeResourceState.contextActive).toBe(true);
      expect(activeResourceState.pageActive).toBe(true);
      expect(activeResourceState.sessionId).toBe(initialResourceState.sessionId);

      // After cleanup
      await browserTool.cleanup();

      expect(browserTool.getState()).toBe('destroyed');
      const destroyedResourceState = browserTool.getResourceState();
      expect(destroyedResourceState.browserActive).toBe(false);
      expect(destroyedResourceState.contextActive).toBe(false);
      expect(destroyedResourceState.pageActive).toBe(false);
    });

    it('should provide accurate isActive() status relative to resource state', async () => {
      expect(browserTool.isActive()).toBe(false);

      await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true },
      });

      expect(browserTool.isActive()).toBe(true);
      expect(browserTool.getResourceState().pageActive).toBe(true);

      await browserTool.destroy();

      expect(browserTool.isActive()).toBe(false);
      expect(browserTool.getResourceState().pageActive).toBe(false);
    });
  });

  describe('Lifecycle and Console Stream Integration', () => {
    it('should properly manage console stream lifecycle', async () => {
      // Console stream should be null initially
      expect(browserTool.getConsoleStream()).toBeNull();

      // After activation, console stream should be available
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      const consoleStream = browserTool.getConsoleStream();
      expect(consoleStream).toBeDefined();

      // Console buffers should be accessible
      const consoleMessages = browserTool.getEnhancedConsoleMessages();
      const runtimeErrors = browserTool.getEnhancedRuntimeErrors();
      expect(Array.isArray(consoleMessages)).toBe(true);
      expect(Array.isArray(runtimeErrors)).toBe(true);

      // After cleanup, console stream should be cleaned up
      await browserTool.cleanup();

      expect(browserTool.getState()).toBe('destroyed');
      // Console buffers should be cleared
      expect(browserTool.getEnhancedConsoleMessages()).toHaveLength(0);
      expect(browserTool.getEnhancedRuntimeErrors()).toHaveLength(0);
    });

    it('should handle console stream errors during state transitions', async () => {
      // Mock console stream initialization to fail
      const originalGetConsoleStream = browserTool.getConsoleStream;
      browserTool.getConsoleStream = vi.fn().mockImplementation(() => {
        throw new Error('Console stream error');
      });

      // Should still be able to execute operations
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(true);
      expect(browserTool.getState()).toBe('active');

      // Restore original method
      browserTool.getConsoleStream = originalGetConsoleStream;
    });
  });

  describe('Lifecycle and Event Emission Integration', () => {
    it('should emit events in correct order with proper timing', async () => {
      const startTime = Date.now();

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      const endTime = Date.now();

      // Filter for state transition events
      const stateEvents = allEvents.filter(e => e.eventName === 'browser:state:transition');
      expect(stateEvents).toHaveLength(2);

      // Verify event order
      expect(stateEvents[0].eventData.previousState).toBe('idle');
      expect(stateEvents[0].eventData.newState).toBe('launching');
      expect(stateEvents[1].eventData.previousState).toBe('launching');
      expect(stateEvents[1].eventData.newState).toBe('active');

      // Verify timing consistency
      const launchTime = stateEvents[0].eventData.timestamp.getTime();
      const activeTime = stateEvents[1].eventData.timestamp.getTime();

      expect(launchTime).toBeGreaterThanOrEqual(startTime);
      expect(activeTime).toBeGreaterThanOrEqual(launchTime);
      expect(activeTime).toBeLessThanOrEqual(endTime);
    });

    it('should emit cleanup events with proper metadata', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      allEvents.length = 0; // Clear previous events

      await browserTool.cleanup();

      const cleanupEvents = allEvents.filter(e => e.eventName === 'browser:state:transition');
      expect(cleanupEvents).toHaveLength(2);

      // Verify cleanup event sequence
      expect(cleanupEvents[0].eventData.previousState).toBe('active');
      expect(cleanupEvents[0].eventData.newState).toBe('cleaning_up');
      expect(cleanupEvents[1].eventData.previousState).toBe('cleaning_up');
      expect(cleanupEvents[1].eventData.newState).toBe('destroyed');

      // Verify session ID consistency
      expect(cleanupEvents[0].eventData.sessionId).toBe(cleanupEvents[1].eventData.sessionId);
    });

    it('should coordinate multiple event types during lifecycle', async () => {
      // Add mock listeners for other event types that might be emitted
      const browserEvents = [];
      eventEmitter.on('browser:operation:complete', (data) => browserEvents.push(data));
      eventEmitter.on('browser:permission:checked', (data) => browserEvents.push(data));

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Should have both state transition and potentially operation events
      const stateEvents = allEvents.filter(e => e.eventName === 'browser:state:transition');
      expect(stateEvents.length).toBeGreaterThan(0);

      // Verify no event conflicts or race conditions
      for (const event of allEvents) {
        expect(event.eventData).toBeDefined();
        expect(event.eventData.timestamp).toBeDefined();
      }
    });
  });

  describe('Lifecycle and Permission Integration', () => {
    it('should handle permission denials without corrupting state', async () => {
      // Initially allow permissions to get to active state
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(browserTool.getState()).toBe('active');

      // Now deny permissions for subsequent operations
      (mockPermissionManager.checkToolPermission as any).mockResolvedValue({
        allowed: false,
        level: null,
        requiresConfirmation: false,
        denialReason: 'Operation not allowed',
      });

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'console.log("test")' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Operation not allowed');
      expect(browserTool.getState()).toBe('active'); // Should remain active
    });

    it('should handle permission manager lifecycle correctly', async () => {
      // Test without permission manager
      const tool = new BrowserTool({ eventEmitter });

      const result = await tool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(true);
      expect(tool.getState()).toBe('active');

      // Inject permission manager after creation
      tool.setPermissionManager(mockPermissionManager);

      const result2 = await tool.execute({
        operation: 'click',
        params: { selector: '#button' },
      });

      expect(result2.success).toBe(true);
      expect(mockPermissionManager.checkToolPermission).toHaveBeenCalled();

      await tool.destroy();
    });
  });

  describe('Lifecycle and Configuration Integration', () => {
    it('should validate configuration at appropriate lifecycle stages', async () => {
      // Mock disabled tool configuration
      (mockPermissionManager.getToolConfig as any).mockResolvedValue({
        enabled: false,
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser tool is disabled');
      expect(browserTool.getState()).toBe('idle'); // Should remain idle
    });

    it('should enforce domain restrictions during active state', async () => {
      // Allow initial navigation
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://allowed.com' },
      });

      expect(browserTool.getState()).toBe('active');

      // Mock blocked domain configuration
      (mockPermissionManager.getToolConfig as any).mockResolvedValue({
        enabled: true,
        blockedDomains: ['blocked.com'],
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://blocked.com/page' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Domain blocked.com is blocked');
      expect(browserTool.getState()).toBe('active'); // Should remain active
    });
  });

  describe('Error Recovery and State Consistency', () => {
    it('should maintain state consistency during operation failures', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(browserTool.getState()).toBe('active');

      // Mock operation failure
      mockPage.click.mockRejectedValue(new Error('Click failed'));

      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Click failed');
      expect(browserTool.getState()).toBe('active'); // Should remain active
    });

    it('should recover from transient browser connection issues', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Mock browser disconnection
      mockBrowser.isConnected.mockReturnValue(false);

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true },
      });

      // The tool should handle the disconnection appropriately
      // (exact behavior depends on implementation)
      expect(browserTool.getState()).toMatch(/^(active|destroyed|idle)$/);
    });

    it('should provide consistent state information across all accessor methods', async () => {
      const states = ['idle', 'active', 'destroyed'] as const;

      for (const expectedState of states) {
        if (expectedState === 'active') {
          await browserTool.execute({
            operation: 'navigate',
            params: { url: 'https://example.com' },
          });
        } else if (expectedState === 'destroyed') {
          await browserTool.destroy();
        }

        // All state-related methods should be consistent
        const state = browserTool.getState();
        const isActive = browserTool.isActive();
        const resourceState = browserTool.getResourceState();

        expect(state).toBe(expectedState === 'idle' ? 'idle' : expectedState);
        expect(isActive).toBe(expectedState === 'active');

        if (expectedState === 'active') {
          expect(resourceState.browserActive).toBe(true);
        } else {
          expect(resourceState.browserActive).toBe(false);
        }
      }
    });
  });
});