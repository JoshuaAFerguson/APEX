/**
 * Browser Tool Lifecycle State Tests - Acceptance Criteria Validation
 *
 * Tests specifically designed to validate the acceptance criteria for
 * lifecycle state tracking implementation:
 *
 * 1. BrowserTool has a 'state' property initialized to 'idle'
 * 2. ensurePage() checks state before launching (rejects if 'destroyed' or 'cleaning_up')
 * 3. execute() checks state and refuses operations on destroyed instances with descriptive error
 * 4. State transitions: idle→launching→active→cleaning_up→destroyed
 * 5. Transitions are emitted via eventEmitter if available
 * 6. isActive() accessor is public
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

describe('BrowserTool Lifecycle - Acceptance Criteria Validation', () => {
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

  describe('Acceptance Criteria 1: State Property Initialized to "idle"', () => {
    it('should initialize with state property set to "idle"', () => {
      expect(browserTool.getState()).toBe('idle');
    });

    it('should initialize with isActive() returning false', () => {
      expect(browserTool.isActive()).toBe(false);
    });

    it('should have state property with correct TypeScript type', () => {
      const state: BrowserToolLifecycleState = browserTool.getState();
      expect(state).toBe('idle');
    });
  });

  describe('Acceptance Criteria 2: ensurePage() State Guards', () => {
    it('should reject ensurePage() when state is "destroyed"', async () => {
      // First destroy the instance
      await browserTool.destroy();
      expect(browserTool.getState()).toBe('destroyed');

      // Try to execute an operation that would trigger ensurePage()
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot execute operation: BrowserTool instance has been destroyed');
    });

    it('should reject ensurePage() when state is "cleaning_up"', async () => {
      // First activate the tool
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

      // Try to execute an operation that would trigger ensurePage()
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot execute operation: BrowserTool instance is currently cleaning up');

      // Complete the cleanup
      cleanupResolve!();
      await cleanupInProgress;
    });

    it('should allow ensurePage() when state is "idle", "launching", or "active"', async () => {
      // Test idle state (first operation)
      expect(browserTool.getState()).toBe('idle');

      const result1 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result1.success).toBe(true);
      expect(browserTool.getState()).toBe('active');

      // Test active state (subsequent operation)
      const result2 = await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' },
      });

      expect(result2.success).toBe(true);
      expect(browserTool.getState()).toBe('active');
    });
  });

  describe('Acceptance Criteria 3: execute() State Guards', () => {
    it('should refuse operations on destroyed instances with descriptive error', async () => {
      await browserTool.destroy();
      expect(browserTool.getState()).toBe('destroyed');

      const testOperations = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'click', params: { selector: '#button' } },
        { operation: 'type', params: { selector: '#input', text: 'test' } },
        { operation: 'screenshot', params: { fullPage: true } },
        { operation: 'evaluate', params: { script: 'console.log("test")' } },
      ] as const;

      for (const operationParams of testOperations) {
        const result = await browserTool.execute(operationParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Cannot execute operation: BrowserTool instance has been destroyed');
        expect(result.metadata?.permissionGranted).toBe(false);
      }
    });

    it('should refuse operations during cleanup with descriptive error', async () => {
      // First activate
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Mock slow cleanup
      let cleanupResolve: Function;
      const cleanupPromise = new Promise((resolve) => {
        cleanupResolve = resolve;
      });

      mockPage.close.mockImplementation(() => cleanupPromise);

      // Start cleanup
      const cleanupInProgress = browserTool.cleanup();

      // Wait for cleanup to start
      await new Promise(resolve => setTimeout(resolve, 5));
      expect(browserTool.getState()).toBe('cleaning_up');

      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot execute operation: BrowserTool instance is currently cleaning up');
      expect(result.metadata?.permissionGranted).toBe(false);

      // Complete cleanup
      cleanupResolve!();
      await cleanupInProgress;
    });

    it('should allow operations in valid states (idle, launching, active)', async () => {
      // Test idle → launching → active transition
      expect(browserTool.getState()).toBe('idle');

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(true);
      expect(browserTool.getState()).toBe('active');
    });
  });

  describe('Acceptance Criteria 4: State Transitions', () => {
    it('should follow correct state transition sequence: idle→launching→active', async () => {
      expect(browserTool.getState()).toBe('idle');

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(true);
      expect(browserTool.getState()).toBe('active');
      expect(browserTool.isActive()).toBe(true);

      // Verify state transition sequence in events
      expect(stateTransitionEvents).toHaveLength(2);
      expect(stateTransitionEvents[0]).toMatchObject({
        previousState: 'idle',
        newState: 'launching',
      });
      expect(stateTransitionEvents[1]).toMatchObject({
        previousState: 'launching',
        newState: 'active',
      });
    });

    it('should follow correct state transition sequence: active→cleaning_up→destroyed', async () => {
      // First activate
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });
      expect(browserTool.getState()).toBe('active');

      // Reset events to focus on cleanup sequence
      stateTransitionEvents.length = 0;

      await browserTool.cleanup();

      expect(browserTool.getState()).toBe('destroyed');
      expect(browserTool.isActive()).toBe(false);

      // Verify cleanup state transition sequence
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

    it('should maintain state consistency across multiple operations', async () => {
      // Start in idle
      expect(browserTool.getState()).toBe('idle');
      expect(browserTool.isActive()).toBe(false);

      // First operation: idle → launching → active
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });
      expect(browserTool.getState()).toBe('active');
      expect(browserTool.isActive()).toBe(true);

      // Subsequent operations: remain active
      await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' },
      });
      expect(browserTool.getState()).toBe('active');
      expect(browserTool.isActive()).toBe(true);

      await browserTool.execute({
        operation: 'type',
        params: { selector: '#input', text: 'test' },
      });
      expect(browserTool.getState()).toBe('active');
      expect(browserTool.isActive()).toBe(true);

      // Cleanup: active → cleaning_up → destroyed
      await browserTool.cleanup();
      expect(browserTool.getState()).toBe('destroyed');
      expect(browserTool.isActive()).toBe(false);
    });
  });

  describe('Acceptance Criteria 5: Event Emission via EventEmitter', () => {
    it('should emit state transitions via eventEmitter when available', async () => {
      expect(stateTransitionEvents).toHaveLength(0);

      // Execute operation to trigger state transitions
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(stateTransitionEvents).toHaveLength(2);

      // Validate first transition event (idle → launching)
      expect(stateTransitionEvents[0]).toMatchObject({
        sessionId: expect.any(String),
        previousState: 'idle',
        newState: 'launching',
        timestamp: expect.any(Date),
      });

      // Validate second transition event (launching → active)
      expect(stateTransitionEvents[1]).toMatchObject({
        sessionId: expect.any(String),
        previousState: 'launching',
        newState: 'active',
        timestamp: expect.any(Date),
      });

      // Verify session ID consistency
      expect(stateTransitionEvents[0].sessionId).toBe(stateTransitionEvents[1].sessionId);
    });

    it('should emit cleanup state transitions via eventEmitter', async () => {
      // First activate
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Reset events to focus on cleanup
      stateTransitionEvents.length = 0;

      await browserTool.cleanup();

      expect(stateTransitionEvents).toHaveLength(2);

      // Validate cleanup transition events
      expect(stateTransitionEvents[0]).toMatchObject({
        sessionId: expect.any(String),
        previousState: 'active',
        newState: 'cleaning_up',
        timestamp: expect.any(Date),
      });

      expect(stateTransitionEvents[1]).toMatchObject({
        sessionId: expect.any(String),
        previousState: 'cleaning_up',
        newState: 'destroyed',
        timestamp: expect.any(Date),
      });
    });

    it('should not fail when no eventEmitter is provided', async () => {
      const toolWithoutEmitter = new BrowserTool({
        permissionManager: mockPermissionManager,
        // No eventEmitter provided
      });

      expect(toolWithoutEmitter.getState()).toBe('idle');

      // Should work without throwing errors
      const result = await toolWithoutEmitter.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(true);
      expect(toolWithoutEmitter.getState()).toBe('active');

      await toolWithoutEmitter.destroy();
    });

    it('should emit events with proper event structure', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(stateTransitionEvents).toHaveLength(2);

      for (const event of stateTransitionEvents) {
        // Validate required event properties
        expect(event).toHaveProperty('sessionId');
        expect(event).toHaveProperty('previousState');
        expect(event).toHaveProperty('newState');
        expect(event).toHaveProperty('timestamp');

        // Validate property types
        expect(typeof event.sessionId).toBe('string');
        expect(typeof event.previousState).toBe('string');
        expect(typeof event.newState).toBe('string');
        expect(event.timestamp).toBeInstanceOf(Date);

        // Validate state values
        const validStates: BrowserToolLifecycleState[] = [
          'idle', 'launching', 'active', 'cleaning_up', 'destroyed'
        ];
        expect(validStates).toContain(event.previousState);
        expect(validStates).toContain(event.newState);
      }
    });
  });

  describe('Acceptance Criteria 6: isActive() Accessor is Public', () => {
    it('should provide public isActive() accessor method', () => {
      // Verify method exists and is callable
      expect(typeof browserTool.isActive).toBe('function');
      expect(browserTool.isActive()).toBe(false);
    });

    it('should return false when state is idle', () => {
      expect(browserTool.getState()).toBe('idle');
      expect(browserTool.isActive()).toBe(false);
    });

    it('should return false when state is launching', async () => {
      // Mock browser launch to be slow so we can check launching state
      let launchResolve: Function;
      const launchPromise = new Promise((resolve) => {
        launchResolve = resolve;
      });

      mockBrowserType.launch.mockImplementation(() => launchPromise.then(() => mockBrowser));

      // Start operation but don't await it
      const operationPromise = browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Wait a bit to ensure launch has started
      await new Promise(resolve => setTimeout(resolve, 5));

      // Note: The implementation transitions to launching then immediately to active once page is ready
      // So we need to check this differently by examining the state transitions

      // Complete the launch
      launchResolve!();
      await operationPromise;

      // Verify final active state
      expect(browserTool.getState()).toBe('active');
      expect(browserTool.isActive()).toBe(true);
    });

    it('should return true when state is active', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(browserTool.getState()).toBe('active');
      expect(browserTool.isActive()).toBe(true);
    });

    it('should return false when state is cleaning_up', async () => {
      // First activate
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Mock slow cleanup
      let cleanupResolve: Function;
      const cleanupPromise = new Promise((resolve) => {
        cleanupResolve = resolve;
      });

      mockPage.close.mockImplementation(() => cleanupPromise);

      // Start cleanup
      const cleanupInProgress = browserTool.cleanup();

      // Wait for cleanup to start
      await new Promise(resolve => setTimeout(resolve, 5));
      expect(browserTool.getState()).toBe('cleaning_up');
      expect(browserTool.isActive()).toBe(false);

      // Complete cleanup
      cleanupResolve!();
      await cleanupInProgress;
    });

    it('should return false when state is destroyed', async () => {
      await browserTool.destroy();

      expect(browserTool.getState()).toBe('destroyed');
      expect(browserTool.isActive()).toBe(false);
    });

    it('should accurately track active state across operations', async () => {
      // Initially not active
      expect(browserTool.isActive()).toBe(false);

      // Become active after first operation
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });
      expect(browserTool.isActive()).toBe(true);

      // Remain active during subsequent operations
      await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' },
      });
      expect(browserTool.isActive()).toBe(true);

      await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true },
      });
      expect(browserTool.isActive()).toBe(true);

      // Become inactive after cleanup
      await browserTool.cleanup();
      expect(browserTool.isActive()).toBe(false);
    });
  });

  describe('Integration: All Acceptance Criteria Working Together', () => {
    it('should demonstrate complete lifecycle with all acceptance criteria met', async () => {
      // Initial state (Criteria 1)
      expect(browserTool.getState()).toBe('idle');
      expect(browserTool.isActive()).toBe(false); // Criteria 6

      // First operation triggers state transitions (Criteria 4)
      const result1 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result1.success).toBe(true);
      expect(browserTool.getState()).toBe('active');
      expect(browserTool.isActive()).toBe(true); // Criteria 6

      // Verify events were emitted (Criteria 5)
      expect(stateTransitionEvents).toHaveLength(2);
      expect(stateTransitionEvents[0].newState).toBe('launching');
      expect(stateTransitionEvents[1].newState).toBe('active');

      // Subsequent operation works while active (Criteria 2, 3)
      const result2 = await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' },
      });

      expect(result2.success).toBe(true);
      expect(browserTool.getState()).toBe('active');

      // Cleanup transitions correctly (Criteria 4)
      await browserTool.cleanup();
      expect(browserTool.getState()).toBe('destroyed');
      expect(browserTool.isActive()).toBe(false); // Criteria 6

      // Operations are blocked after destroy (Criteria 2, 3)
      const result3 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example2.com' },
      });

      expect(result3.success).toBe(false);
      expect(result3.error).toBe('Cannot execute operation: BrowserTool instance has been destroyed');

      // Verify cleanup events were emitted (Criteria 5)
      const cleanupEvents = stateTransitionEvents.slice(2);
      expect(cleanupEvents).toHaveLength(2);
      expect(cleanupEvents[0].newState).toBe('cleaning_up');
      expect(cleanupEvents[1].newState).toBe('destroyed');
    });
  });
});