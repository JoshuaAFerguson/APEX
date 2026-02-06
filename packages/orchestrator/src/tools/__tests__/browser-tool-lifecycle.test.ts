/**
 * Browser Tool Lifecycle State Tests
 *
 * Tests the lifecycle state management functionality including:
 * - State transitions (idle → launching → active → cleaning_up → destroyed)
 * - State guards on ensurePage() and execute() methods
 * - Event emission for state transitions
 * - isActive() accessor method
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

describe('BrowserTool Lifecycle State Management', () => {
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

  describe('Initial State', () => {
    it('should start in idle state', () => {
      expect(browserTool.getState()).toBe('idle');
      expect(browserTool.isActive()).toBe(false);
    });

    it('should have valid lifecycle state type', () => {
      const state: BrowserToolLifecycleState = browserTool.getState();
      const validStates: BrowserToolLifecycleState[] = [
        'idle', 'launching', 'active', 'cleaning_up', 'destroyed'
      ];
      expect(validStates).toContain(state);
    });
  });

  describe('State Transitions', () => {
    it('should transition from idle to launching to active on first operation', async () => {
      expect(browserTool.getState()).toBe('idle');

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(true);
      expect(browserTool.getState()).toBe('active');
      expect(browserTool.isActive()).toBe(true);

      // Check that state transition events were emitted
      expect(stateTransitionEvents).toHaveLength(2);
      expect(stateTransitionEvents[0]).toMatchObject({
        previousState: 'idle',
        newState: 'launching',
        sessionId: expect.any(String),
        timestamp: expect.any(Date),
      });
      expect(stateTransitionEvents[1]).toMatchObject({
        previousState: 'launching',
        newState: 'active',
        sessionId: expect.any(String),
        timestamp: expect.any(Date),
      });
    });

    it('should remain active on subsequent operations', async () => {
      // First operation to activate
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(browserTool.getState()).toBe('active');
      const initialEventCount = stateTransitionEvents.length;

      // Second operation should not trigger additional state transitions
      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' },
      });

      expect(result.success).toBe(true);
      expect(browserTool.getState()).toBe('active');
      expect(browserTool.isActive()).toBe(true);
      expect(stateTransitionEvents).toHaveLength(initialEventCount); // No new transitions
    });

    it('should transition to cleaning_up then destroyed on cleanup', async () => {
      // Activate first
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(browserTool.getState()).toBe('active');
      stateTransitionEvents.length = 0; // Reset for this test

      await browserTool.cleanup();

      expect(browserTool.getState()).toBe('destroyed');
      expect(browserTool.isActive()).toBe(false);

      expect(stateTransitionEvents).toHaveLength(2);
      expect(stateTransitionEvents[0]).toMatchObject({
        previousState: 'active',
        newState: 'cleaning_up',
      });
      expect(stateTransitionEvents[1]).toMatchObject({
        previousState: 'cleaning_up',
        newState: 'destroyed',
      });
    });

    it('should transition directly to destroyed on destroy', async () => {
      // Activate first
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(browserTool.getState()).toBe('active');
      stateTransitionEvents.length = 0; // Reset for this test

      await browserTool.destroy();

      expect(browserTool.getState()).toBe('destroyed');
      expect(browserTool.isActive()).toBe(false);

      expect(stateTransitionEvents.length).toBeGreaterThan(0);
      expect(stateTransitionEvents[stateTransitionEvents.length - 1]).toMatchObject({
        newState: 'destroyed',
      });
    });
  });

  describe('State Guards', () => {
    it('should prevent operations on destroyed instances', async () => {
      // First destroy the instance
      await browserTool.destroy();
      expect(browserTool.getState()).toBe('destroyed');

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot execute operation: BrowserTool instance has been destroyed');
      expect(result.metadata?.permissionGranted).toBe(false);
    });

    it('should prevent operations during cleanup', async () => {
      // Activate first
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Mock cleanup to be slow so we can test mid-cleanup state
      let cleanupResolve: Function;
      const cleanupPromise = new Promise((resolve) => {
        cleanupResolve = resolve;
      });

      mockPage.close.mockImplementation(() => cleanupPromise);

      // Start cleanup but don't await it
      const cleanupInProgress = browserTool.cleanup();

      // Wait a bit to ensure cleanup has started
      await new Promise(resolve => setTimeout(resolve, 5));
      expect(browserTool.getState()).toBe('cleaning_up');

      // Try to execute an operation while cleaning up
      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot execute operation: BrowserTool instance is currently cleaning up');

      // Complete the cleanup
      cleanupResolve!();
      await cleanupInProgress;
    });

    it('should prevent page launch on destroyed instances', async () => {
      await browserTool.destroy();
      expect(browserTool.getState()).toBe('destroyed');

      // Try to execute an operation that would trigger ensurePage()
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot execute operation: BrowserTool instance has been destroyed');
    });

    it('should prevent page launch during cleanup', async () => {
      // Activate first
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Start a slow cleanup
      let cleanupResolve: Function;
      const cleanupPromise = new Promise((resolve) => {
        cleanupResolve = resolve;
      });

      mockPage.close.mockImplementation(() => cleanupPromise);
      const cleanupInProgress = browserTool.cleanup();

      // Wait for cleanup to start
      await new Promise(resolve => setTimeout(resolve, 5));
      expect(browserTool.getState()).toBe('cleaning_up');

      // Try to execute an operation
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot execute operation: BrowserTool instance is currently cleaning up');

      // Complete cleanup
      cleanupResolve!();
      await cleanupInProgress;
    });
  });

  describe('Multiple Cleanup Calls', () => {
    it('should handle multiple cleanup calls gracefully', async () => {
      // Activate first
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(browserTool.getState()).toBe('active');

      // First cleanup
      await browserTool.cleanup();
      expect(browserTool.getState()).toBe('destroyed');

      // Second cleanup should be a no-op
      await browserTool.cleanup();
      expect(browserTool.getState()).toBe('destroyed');
    });

    it('should handle multiple destroy calls gracefully', async () => {
      // Activate first
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(browserTool.getState()).toBe('active');

      // First destroy
      await browserTool.destroy();
      expect(browserTool.getState()).toBe('destroyed');

      // Second destroy should be a no-op
      await browserTool.destroy();
      expect(browserTool.getState()).toBe('destroyed');
    });
  });

  describe('Event Emission', () => {
    it('should emit state transition events with correct data', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(true);
      expect(stateTransitionEvents).toHaveLength(2);

      const launchingEvent = stateTransitionEvents[0];
      expect(launchingEvent).toMatchObject({
        sessionId: expect.any(String),
        previousState: 'idle',
        newState: 'launching',
        timestamp: expect.any(Date),
      });

      const activeEvent = stateTransitionEvents[1];
      expect(activeEvent).toMatchObject({
        sessionId: expect.any(String),
        previousState: 'launching',
        newState: 'active',
        timestamp: expect.any(Date),
      });

      expect(launchingEvent.sessionId).toBe(activeEvent.sessionId);
    });

    it('should work without event emitter', () => {
      const toolWithoutEvents = new BrowserTool({
        permissionManager: mockPermissionManager,
        // No eventEmitter provided
      });

      expect(toolWithoutEvents.getState()).toBe('idle');

      // Should not throw even without event emitter
      expect(async () => {
        await toolWithoutEvents.execute({
          operation: 'navigate',
          params: { url: 'https://example.com' },
        });
      }).not.toThrow();
    });
  });

  describe('Integration with Existing Methods', () => {
    it('should maintain existing functionality while adding state tracking', async () => {
      // Test that permissions still work
      const permissionResult = await browserTool.checkPermission('navigate', 'https://example.com');
      expect(permissionResult.allowed).toBe(true);

      // Test that operations still work
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.permissionGranted).toBe(true);
      expect(browserTool.isActive()).toBe(true);

      // Test that resource state is still tracked
      const resourceState = browserTool.getResourceState();
      expect(resourceState.sessionId).toBe(expect.any(String));
    });
  });
});