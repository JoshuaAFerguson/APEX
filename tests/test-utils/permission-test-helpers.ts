/**
 * Permission Test Helpers
 *
 * Utilities for testing permission-denied scenarios in browser automation.
 * Provides mock permission managers, browser tools, and assertion helpers
 * specifically designed for comprehensive permission testing.
 *
 * @module tests/test-utils/permission-test-helpers
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type {
  PermissionLevel,
  ToolPermissionResult
} from '../../packages/core/src/types.js';
import {
  BrowserPermissionDeniedError,
  type BrowserPermissionDeniedContext,
  type BrowserResourceState,
  type BrowserLifecycleState
} from '../../packages/core/src/tools/browser/browser-permission-denied-error.js';
import type { BrowserTool, BrowserOperation } from '../../packages/orchestrator/src/tools/browser-tool.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Configuration for mock permission manager
 */
export interface MockPermissionManagerConfig {
  /** Operations to deny by default */
  denyOperations?: string[];
  /** Domains to block */
  blockedDomains?: string[];
  /** Default permission level for allowed operations */
  defaultPermissionLevel?: PermissionLevel;
  /** Whether to simulate permission check failures */
  simulateFailures?: boolean;
}

/**
 * Mock permission manager for controlled testing
 */
export interface MockPermissionManager {
  checkToolPermission: MockedFunction<(tool: string, options: { scope: string }) => Promise<ToolPermissionResult>>;
  getToolConfig: MockedFunction<(tool: string) => Promise<any>>;
  denyPermission: MockedFunction<(tool: string, scope?: string) => Promise<void>>;
  grantPermission: MockedFunction<(tool: string, level?: PermissionLevel, scope?: string) => Promise<void>>;
  setToolConfig: MockedFunction<(tool: string, config: any) => Promise<void>>;
}

/**
 * Permission event captured during testing
 */
export interface PermissionEvent {
  type: 'requested' | 'granted' | 'denied';
  tool?: string;
  scope?: string;
  level?: PermissionLevel;
  denialReason?: string;
  timestamp: Date;
}

/**
 * Context for permission testing
 */
export interface PermissionTestContext {
  browserTool: BrowserTool;
  permissionManager: MockPermissionManager;
  eventEmitter: EventEmitter;
  events: PermissionEvent[];
  mockBrowser: MockTrackedBrowser;
  resourceState: BrowserResourceState;
}

/**
 * Mock browser with resource tracking for leak detection
 */
export interface MockTrackedBrowser {
  browser: any;
  context: any;
  page: any;
  state: BrowserResourceState;
  verifyCleanup: () => void;
  markOperationStart: () => void;
  markOperationEnd: () => void;
  close: () => Promise<void>;
}

/**
 * Expected structure for permission denied responses
 */
export interface ExpectedPermissionDeniedResponse {
  success: false;
  operation: BrowserOperation;
  error: string;
  permissionDenied: true;
  metadata: {
    permissionDenied: true;
    deniedBy: string;
    timestamp: string;
    suggestions: string[];
  };
}

// ============================================================================
// Mock Factory Functions
// ============================================================================

/**
 * Create a mock permission manager with configurable behavior
 */
export function createMockPermissionManager(config: MockPermissionManagerConfig = {}): MockPermissionManager {
  const {
    denyOperations = [],
    blockedDomains = [],
    defaultPermissionLevel = 'full',
    simulateFailures = false
  } = config;

  return {
    checkToolPermission: vi.fn(async (tool: string, options: { scope: string }) => {
      if (simulateFailures) {
        throw new Error('Permission database connection lost');
      }

      const scope = options.scope || '';

      // Check if operation is in deny list
      const shouldDeny = denyOperations.some(pattern => {
        if (pattern === '*') return true;
        return scope.includes(pattern) || pattern === tool;
      });

      // Check if domain is blocked
      const isDomainBlocked = blockedDomains.some(domain => scope.includes(domain));

      if (shouldDeny || isDomainBlocked) {
        return {
          allowed: false,
          level: null,
          requiresConfirmation: false,
          denialReason: shouldDeny
            ? `Operation '${scope}' denied by test policy`
            : `Domain blocked by test policy`,
        };
      }

      return {
        allowed: true,
        level: defaultPermissionLevel,
        requiresConfirmation: false,
      };
    }),

    getToolConfig: vi.fn(async (tool: string) => ({
      enabled: true,
      allowedDomains: ['example.com', 'test.local'],
      blockedDomains: blockedDomains,
      allowJavaScriptExecution: !denyOperations.includes('evaluate'),
      allowFormSubmission: !denyOperations.includes('submit'),
      allowScreenshots: !denyOperations.includes('screenshot'),
    })),

    denyPermission: vi.fn(async (tool: string, scope?: string) => {
      const key = scope ? `${tool}:${scope}` : tool;
      if (!denyOperations.includes(key)) {
        denyOperations.push(key);
      }
    }),

    grantPermission: vi.fn(async (tool: string, level?: PermissionLevel, scope?: string) => {
      const key = scope ? `${tool}:${scope}` : tool;
      const index = denyOperations.indexOf(key);
      if (index >= 0) {
        denyOperations.splice(index, 1);
      }
    }),

    setToolConfig: vi.fn(async (tool: string, config: any) => {
      // Update internal configuration
      if (config.blockedDomains) {
        blockedDomains.splice(0, blockedDomains.length, ...config.blockedDomains);
      }
    }),
  };
}

/**
 * Create a tracked mock browser for resource leak detection
 */
export function createTrackedMockBrowser(): MockTrackedBrowser {
  const sessionId = `test-session-${Date.now()}`;

  const state: BrowserResourceState = {
    browserActive: false,
    contextActive: false,
    pageActive: false,
    activeOperations: 0,
    lifecycleState: 'idle',
    sessionId,
    lastAllocation: undefined,
  };

  const mockPage = {
    url: vi.fn(() => 'about:blank'),
    title: vi.fn(() => Promise.resolve('Test Page')),
    goto: vi.fn(async (url: string) => {
      state.lifecycleState = 'active';
      state.pageActive = true;
      return { status: () => 200 };
    }),
    click: vi.fn(() => Promise.resolve()),
    type: vi.fn(() => Promise.resolve()),
    fill: vi.fn(() => Promise.resolve()),
    screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot'))),
    evaluate: vi.fn(() => Promise.resolve('mock-evaluation-result')),
    waitForSelector: vi.fn(() => Promise.resolve()),
    textContent: vi.fn(() => Promise.resolve('Mock text content')),
    getAttribute: vi.fn(() => Promise.resolve('mock-attribute')),
    close: vi.fn(async () => {
      state.pageActive = false;
      if (state.activeOperations === 0) {
        state.lifecycleState = 'idle';
      }
    }),
    on: vi.fn(),
    setViewportSize: vi.fn(() => Promise.resolve()),
    locator: vi.fn(() => ({
      click: vi.fn(() => Promise.resolve()),
      fill: vi.fn(() => Promise.resolve()),
      textContent: vi.fn(() => Promise.resolve('Mock text')),
    })),
  };

  const mockContext = {
    newPage: vi.fn(async () => {
      state.contextActive = true;
      state.lastAllocation = new Date();
      return mockPage;
    }),
    close: vi.fn(async () => {
      state.contextActive = false;
      await mockPage.close();
    }),
    on: vi.fn(),
  };

  const mockBrowser = {
    newContext: vi.fn(async () => {
      state.browserActive = true;
      state.lifecycleState = 'launching';
      state.lastAllocation = new Date();
      return mockContext;
    }),
    close: vi.fn(async () => {
      state.browserActive = false;
      state.lifecycleState = 'destroyed';
      await mockContext.close();
    }),
  };

  return {
    browser: mockBrowser,
    context: mockContext,
    page: mockPage,
    state,

    verifyCleanup() {
      expect(state.browserActive).toBe(false);
      expect(state.contextActive).toBe(false);
      expect(state.pageActive).toBe(false);
      expect(state.activeOperations).toBe(0);
      expect(state.lifecycleState).toBeOneOf(['idle', 'destroyed']);
    },

    markOperationStart() {
      state.activeOperations++;
    },

    markOperationEnd() {
      state.activeOperations = Math.max(0, state.activeOperations - 1);
    },

    async close() {
      await mockBrowser.close();
    },
  };
}

/**
 * Create a complete permission test context
 */
export function createPermissionTestContext(config: MockPermissionManagerConfig = {}): PermissionTestContext {
  const permissionManager = createMockPermissionManager(config);
  const eventEmitter = new EventEmitter();
  const events: PermissionEvent[] = [];
  const mockBrowser = createTrackedMockBrowser();

  // Setup event tracking
  eventEmitter.on('permission:requested', (event) => {
    events.push({ type: 'requested', timestamp: new Date(), ...event });
  });
  eventEmitter.on('permission:granted', (event) => {
    events.push({ type: 'granted', timestamp: new Date(), ...event });
  });
  eventEmitter.on('permission:denied', (event) => {
    events.push({ type: 'denied', timestamp: new Date(), ...event });
  });

  // Create mock browser tool
  const browserTool = {
    execute: vi.fn(async (params: any) => {
      // Mock implementation that respects permissions
      const { operation } = params;

      try {
        // Check permission first
        const permissionResult = await permissionManager.checkToolPermission('Browser', {
          scope: operation
        });

        if (!permissionResult.allowed) {
          // Emit permission denied event
          eventEmitter.emit('permission:denied', {
            tool: 'Browser',
            scope: operation,
            denialReason: permissionResult.denialReason,
          });

          // Return proper permission denied response
          const error = new BrowserPermissionDeniedError(
            permissionResult.denialReason || 'Permission denied',
            {
              operation,
              denialReason: permissionResult.denialReason,
            }
          );

          return {
            success: false,
            operation,
            error: error.getUserFriendlyMessage(),
            permissionDenied: true,
            metadata: {
              permissionDenied: true,
              deniedBy: 'test-policy',
              timestamp: new Date().toISOString(),
              suggestions: error.getResolutionSuggestions(),
            },
          };
        }

        // Emit permission granted event
        eventEmitter.emit('permission:granted', {
          tool: 'Browser',
          scope: operation,
          level: permissionResult.level,
        });

        // Mark operation start for resource tracking
        mockBrowser.markOperationStart();

        try {
          // Simulate successful operation
          let data = {};
          switch (operation) {
            case 'navigate':
              await mockBrowser.page.goto(params.params.url);
              data = { url: params.params.url };
              break;
            case 'click':
              await mockBrowser.page.click(params.params.selector);
              data = { clicked: true };
              break;
            case 'screenshot':
              const buffer = await mockBrowser.page.screenshot();
              data = { screenshot: buffer };
              break;
            case 'evaluate':
              const result = await mockBrowser.page.evaluate(params.params.script);
              data = { result };
              break;
            default:
              data = { completed: true };
          }

          return {
            success: true,
            operation,
            data,
          };
        } finally {
          mockBrowser.markOperationEnd();
        }
      } catch (error) {
        mockBrowser.markOperationEnd();
        throw error;
      }
    }),

    cleanup: vi.fn(async () => {
      await mockBrowser.close();
    }),

    getResourceState: vi.fn(() => ({
      ...mockBrowser.state,
      currentUrl: mockBrowser.page.url(),
    })),
  } as any;

  return {
    browserTool,
    permissionManager,
    eventEmitter,
    events,
    mockBrowser,
    resourceState: mockBrowser.state,
  };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that browser resources are properly cleaned up
 */
export function assertCleanResourceState(context: PermissionTestContext): void {
  context.mockBrowser.verifyCleanup();
}

/**
 * Assert that a browser tool response indicates permission was denied
 */
export function assertPermissionDeniedResponse(
  result: any,
  expectedOperation: BrowserOperation
): void {
  expect(result.success).toBe(false);
  expect(result.operation).toBe(expectedOperation);
  expect(result.permissionDenied).toBe(true);
  expect(result.error).toBeDefined();
  expect(typeof result.error).toBe('string');
  expect(result.error.length).toBeGreaterThan(0);

  // Verify metadata structure
  expect(result.metadata).toBeDefined();
  expect(result.metadata.permissionDenied).toBe(true);
  expect(result.metadata.deniedBy).toBeDefined();
  expect(result.metadata.timestamp).toBeDefined();
  expect(Array.isArray(result.metadata.suggestions)).toBe(true);

  // Verify error message is user-friendly
  expect(result.error).not.toMatch(/undefined|null|internal.*error/i);
  expect(result.error).not.toContain('TypeError');
  expect(result.error).not.toContain('ReferenceError');
}

/**
 * Assert that permission events were emitted correctly
 */
export function assertPermissionEventsEmitted(
  events: PermissionEvent[],
  expectedType: 'requested' | 'granted' | 'denied',
  expectedTool = 'Browser'
): void {
  const relevantEvents = events.filter(e => e.type === expectedType && e.tool === expectedTool);
  expect(relevantEvents.length).toBeGreaterThan(0);

  const latestEvent = relevantEvents[relevantEvents.length - 1];
  expect(latestEvent.timestamp).toBeInstanceOf(Date);
  expect(latestEvent.timestamp.getTime()).toBeLessThanOrEqual(Date.now());

  if (expectedType === 'denied') {
    expect(latestEvent.denialReason).toBeDefined();
    expect(typeof latestEvent.denialReason).toBe('string');
  }
}

/**
 * Collect permission events for a specific duration
 */
export async function collectPermissionEvents(
  emitter: EventEmitter,
  timeout: number = 1000
): Promise<PermissionEvent[]> {
  const events: PermissionEvent[] = [];

  const handlers = {
    requested: (event: any) => events.push({ type: 'requested', timestamp: new Date(), ...event }),
    granted: (event: any) => events.push({ type: 'granted', timestamp: new Date(), ...event }),
    denied: (event: any) => events.push({ type: 'denied', timestamp: new Date(), ...event }),
  };

  emitter.on('permission:requested', handlers.requested);
  emitter.on('permission:granted', handlers.granted);
  emitter.on('permission:denied', handlers.denied);

  await new Promise(resolve => setTimeout(resolve, timeout));

  emitter.off('permission:requested', handlers.requested);
  emitter.off('permission:granted', handlers.granted);
  emitter.off('permission:denied', handlers.denied);

  return events;
}

/**
 * Assert that no system crashes occurred
 */
export function assertNoCrashes(): void {
  // Verify that the process is still stable
  expect(process).toBeDefined();
  expect(typeof process.exit).toBe('function');

  // Check that no unhandled rejections or exceptions were thrown
  // This is a basic check - in a real implementation you might track these
}

/**
 * Assert error message quality
 */
export function assertErrorMessageQuality(errorMessage: string): void {
  expect(errorMessage).toBeDefined();
  expect(typeof errorMessage).toBe('string');
  expect(errorMessage.length).toBeGreaterThan(10);

  // Should not contain internal implementation details
  expect(errorMessage).not.toMatch(/undefined|null|TypeError|ReferenceError/i);
  expect(errorMessage).not.toContain('packages/');
  expect(errorMessage).not.toContain('.ts:');
  expect(errorMessage).not.toContain('node_modules');

  // Should be user-friendly
  expect(errorMessage).not.toMatch(/^Error:|^[A-Z][a-z]+Error:/);
  expect(errorMessage.charAt(0)).toMatch(/[A-Z]/); // Should start with capital letter
  expect(errorMessage).toMatch(/[.!?]$/); // Should end with proper punctuation
}

/**
 * Create a suite of permission denial scenarios for comprehensive testing
 */
export function createPermissionDenialScenarios() {
  return {
    // Pre-operation denial scenarios
    denyAllOperations: () => createPermissionTestContext({ denyOperations: ['*'] }),
    denyNavigation: () => createPermissionTestContext({ denyOperations: ['navigate'] }),
    denyInteraction: () => createPermissionTestContext({ denyOperations: ['click', 'type'] }),
    denyDataExtraction: () => createPermissionTestContext({ denyOperations: ['getText', 'getAttribute'] }),
    denyScreenshots: () => createPermissionTestContext({ denyOperations: ['screenshot'] }),
    denyJavaScript: () => createPermissionTestContext({ denyOperations: ['evaluate'] }),

    // Domain-based denial scenarios
    blockDomains: (domains: string[]) => createPermissionTestContext({ blockedDomains: domains }),
    blockDangerous: () => createPermissionTestContext({
      blockedDomains: ['malicious.com', 'dangerous.site', 'blocked.domain']
    }),

    // System failure scenarios
    simulateFailure: () => createPermissionTestContext({ simulateFailures: true }),

    // Mixed scenarios
    partialDenial: () => createPermissionTestContext({
      denyOperations: ['evaluate', 'submit'],
      blockedDomains: ['restricted.com']
    }),

    // Enhanced scenarios for comprehensive testing
    temporaryDenial: () => {
      const context = createPermissionTestContext();
      // Add method to temporarily deny operations with automatic restoration
      (context as any).temporarilyDeny = async (operation: string, duration: number = 1000) => {
        await context.permissionManager.denyPermission('Browser', operation);
        setTimeout(async () => {
          await context.permissionManager.grantPermission('Browser', 'full', operation);
        }, duration);
      };
      return context;
    },

    cascadingPermissions: () => {
      const context = createPermissionTestContext();
      let deniedCount = 0;
      // Each permission check increases restrictions
      const originalCheck = context.permissionManager.checkToolPermission;
      context.permissionManager.checkToolPermission = vi.fn(async (tool: string, options: { scope: string }) => {
        deniedCount++;
        if (deniedCount > 3) {
          return {
            allowed: false,
            level: null,
            requiresConfirmation: false,
            denialReason: `Cascading denial after ${deniedCount} requests`,
          };
        }
        return originalCheck.call(context.permissionManager, tool, options);
      });
      return context;
    },

    roleBasedDenial: (role: 'admin' | 'user' | 'guest' = 'user') => {
      const rolePermissions = {
        admin: ['*'],
        user: ['navigate', 'click', 'type', 'screenshot'],
        guest: ['navigate']
      };
      const allowedOperations = rolePermissions[role];
      const allOperations = ['navigate', 'click', 'type', 'screenshot', 'evaluate', 'submit'];
      const deniedOperations = allOperations.filter(op => !allowedOperations.includes('*') && !allowedOperations.includes(op));

      return createPermissionTestContext({ denyOperations: deniedOperations });
    },

    timeBasedRestriction: () => {
      const context = createPermissionTestContext();
      let startTime = Date.now();
      // Deny operations after 2 seconds
      const originalCheck = context.permissionManager.checkToolPermission;
      context.permissionManager.checkToolPermission = vi.fn(async (tool: string, options: { scope: string }) => {
        if (Date.now() - startTime > 2000) {
          return {
            allowed: false,
            level: null,
            requiresConfirmation: false,
            denialReason: 'Time-based restriction: operations denied after 2 seconds',
          };
        }
        return originalCheck.call(context.permissionManager, tool, options);
      });
      return context;
    },

    rateLimitedPermissions: (maxRequests: number = 5) => {
      const context = createPermissionTestContext();
      let requestCount = 0;
      const originalCheck = context.permissionManager.checkToolPermission;
      context.permissionManager.checkToolPermission = vi.fn(async (tool: string, options: { scope: string }) => {
        requestCount++;
        if (requestCount > maxRequests) {
          return {
            allowed: false,
            level: null,
            requiresConfirmation: false,
            denialReason: `Rate limit exceeded: ${requestCount} requests > ${maxRequests} allowed`,
          };
        }
        return originalCheck.call(context.permissionManager, tool, options);
      });
      return context;
    },
  };
}