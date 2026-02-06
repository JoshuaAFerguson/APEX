/**
 * @fileoverview Unit Tests for Permission Test Helpers
 *
 * Comprehensive test suite for permission testing utilities including:
 * - Mock permission manager functionality
 * - Permission test context management
 * - Browser resource tracking and cleanup
 * - Permission event assertion helpers
 * - Permission denial scenario testing
 *
 * @module tests/test-utils/__tests__/permission-test-helpers.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import {
  createMockPermissionManager,
  createTrackedMockBrowser,
  createPermissionTestContext,
  createPermissionDenialScenarios,
  assertCleanResourceState,
  assertPermissionDeniedResponse,
  assertPermissionEventsEmitted,
  assertNoCrashes,
  assertErrorMessageQuality,
  collectPermissionEvents,
  type MockPermissionManagerConfig,
  type PermissionTestContext,
  type MockPermissionManager,
  type MockTrackedBrowser,
  type PermissionEvent,
  type ExpectedPermissionDeniedResponse,
} from '../permission-test-helpers.js';
import type { PermissionLevel } from '../../../packages/core/src/types.js';

describe('Permission Test Helpers', () => {
  describe('createMockPermissionManager', () => {
    it('should create mock permission manager with default config', () => {
      const manager = createMockPermissionManager();

      expect(manager).toBeDefined();
      expect(manager.checkToolPermission).toBeDefined();
      expect(manager.getToolConfig).toBeDefined();
      expect(manager.denyPermission).toBeDefined();
      expect(manager.grantPermission).toBeDefined();
      expect(manager.setToolConfig).toBeDefined();
      expect(vi.isMockFunction(manager.checkToolPermission)).toBe(true);
    });

    it('should create manager with custom configuration', () => {
      const config: MockPermissionManagerConfig = {
        denyOperations: ['screenshot', 'evaluate'],
        blockedDomains: ['malicious.com'],
        defaultPermissionLevel: 'read',
        simulateFailures: true,
      };

      const manager = createMockPermissionManager(config);
      expect(manager).toBeDefined();
    });

    it('should allow operations by default', async () => {
      const manager = createMockPermissionManager();

      const result = await manager.checkToolPermission('Browser', { scope: 'navigate' });

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('full');
      expect(result.requiresConfirmation).toBe(false);
      expect(result.denialReason).toBeUndefined();
    });

    it('should deny operations in deny list', async () => {
      const config: MockPermissionManagerConfig = {
        denyOperations: ['screenshot', 'evaluate'],
      };

      const manager = createMockPermissionManager(config);

      const result = await manager.checkToolPermission('Browser', { scope: 'screenshot' });

      expect(result.allowed).toBe(false);
      expect(result.level).toBe(null);
      expect(result.denialReason).toContain("Operation 'screenshot' denied by test policy");
    });

    it('should deny operations for blocked domains', async () => {
      const config: MockPermissionManagerConfig = {
        blockedDomains: ['dangerous.com'],
      };

      const manager = createMockPermissionManager(config);

      const result = await manager.checkToolPermission('Browser', { scope: 'navigate:dangerous.com' });

      expect(result.allowed).toBe(false);
      expect(result.denialReason).toContain('Domain blocked by test policy');
    });

    it('should simulate permission check failures', async () => {
      const config: MockPermissionManagerConfig = {
        simulateFailures: true,
      };

      const manager = createMockPermissionManager(config);

      await expect(manager.checkToolPermission('Browser', { scope: 'test' }))
        .rejects.toThrow('Permission database connection lost');
    });

    it('should provide tool configuration', async () => {
      const config: MockPermissionManagerConfig = {
        denyOperations: ['evaluate'],
        blockedDomains: ['blocked.com'],
      };

      const manager = createMockPermissionManager(config);

      const toolConfig = await manager.getToolConfig('Browser');

      expect(toolConfig).toBeDefined();
      expect(toolConfig.enabled).toBe(true);
      expect(toolConfig.allowedDomains).toContain('example.com');
      expect(toolConfig.blockedDomains).toContain('blocked.com');
      expect(toolConfig.allowJavaScriptExecution).toBe(false); // Because 'evaluate' is denied
      expect(toolConfig.allowScreenshots).toBe(true); // Because 'screenshot' is not denied
    });

    it('should handle permission granting and denial', async () => {
      const manager = createMockPermissionManager();

      // Initially allowed
      let result = await manager.checkToolPermission('Browser', { scope: 'test-operation' });
      expect(result.allowed).toBe(true);

      // Deny permission
      await manager.denyPermission('Browser', 'test-operation');
      result = await manager.checkToolPermission('Browser', { scope: 'test-operation' });
      expect(result.allowed).toBe(false);

      // Grant permission back
      await manager.grantPermission('Browser', 'full', 'test-operation');
      result = await manager.checkToolPermission('Browser', { scope: 'test-operation' });
      expect(result.allowed).toBe(true);
    });

    it('should handle tool configuration updates', async () => {
      const manager = createMockPermissionManager();

      const newConfig = {
        blockedDomains: ['new-blocked.com', 'another-blocked.com'],
      };

      await manager.setToolConfig('Browser', newConfig);

      const result = await manager.checkToolPermission('Browser', { scope: 'navigate:new-blocked.com' });
      expect(result.allowed).toBe(false);
    });

    it('should handle wildcard denials', async () => {
      const config: MockPermissionManagerConfig = {
        denyOperations: ['*'],
      };

      const manager = createMockPermissionManager(config);

      const result = await manager.checkToolPermission('Browser', { scope: 'any-operation' });

      expect(result.allowed).toBe(false);
      expect(result.denialReason).toContain("Operation 'any-operation' denied by test policy");
    });
  });

  describe('createTrackedMockBrowser', () => {
    let mockBrowser: MockTrackedBrowser;

    beforeEach(() => {
      mockBrowser = createTrackedMockBrowser();
    });

    afterEach(async () => {
      await mockBrowser.close();
    });

    it('should create tracked mock browser', () => {
      expect(mockBrowser).toBeDefined();
      expect(mockBrowser.browser).toBeDefined();
      expect(mockBrowser.context).toBeDefined();
      expect(mockBrowser.page).toBeDefined();
      expect(mockBrowser.state).toBeDefined();
      expect(mockBrowser.verifyCleanup).toBeDefined();
      expect(mockBrowser.markOperationStart).toBeDefined();
      expect(mockBrowser.markOperationEnd).toBeDefined();
      expect(mockBrowser.close).toBeDefined();
    });

    it('should initialize with proper resource state', () => {
      const { state } = mockBrowser;

      expect(state.browserActive).toBe(false);
      expect(state.contextActive).toBe(false);
      expect(state.pageActive).toBe(false);
      expect(state.activeOperations).toBe(0);
      expect(state.lifecycleState).toBe('idle');
      expect(state.sessionId).toMatch(/^test-session-\d+$/);
    });

    it('should track browser lifecycle operations', async () => {
      const { browser, context, state } = mockBrowser;

      // Create context
      await browser.newContext();
      expect(state.browserActive).toBe(true);
      expect(state.lifecycleState).toBe('launching');

      // Create page
      await context.newPage();
      expect(state.contextActive).toBe(true);
      expect(state.lastAllocation).toBeInstanceOf(Date);

      // Navigate (activates page)
      await mockBrowser.page.goto('https://example.com');
      expect(state.pageActive).toBe(true);
      expect(state.lifecycleState).toBe('active');
    });

    it('should track operation counts', () => {
      const { state } = mockBrowser;

      expect(state.activeOperations).toBe(0);

      mockBrowser.markOperationStart();
      expect(state.activeOperations).toBe(1);

      mockBrowser.markOperationStart();
      expect(state.activeOperations).toBe(2);

      mockBrowser.markOperationEnd();
      expect(state.activeOperations).toBe(1);

      mockBrowser.markOperationEnd();
      expect(state.activeOperations).toBe(0);

      // Should not go below 0
      mockBrowser.markOperationEnd();
      expect(state.activeOperations).toBe(0);
    });

    it('should handle resource cleanup', async () => {
      const { browser, context, page, state } = mockBrowser;

      // Start with resources active
      await browser.newContext();
      await context.newPage();
      await page.goto('https://example.com');

      expect(state.browserActive).toBe(true);
      expect(state.contextActive).toBe(true);
      expect(state.pageActive).toBe(true);

      // Close resources
      await mockBrowser.close();

      expect(state.browserActive).toBe(false);
      expect(state.contextActive).toBe(false);
      expect(state.pageActive).toBe(false);
      expect(state.lifecycleState).toBe('destroyed');
    });

    it('should provide mock page operations', async () => {
      const { page } = mockBrowser;

      // Test page methods
      expect(page.url()).toBe('about:blank');
      const title = await page.title();
      expect(title).toBe('Test Page');

      const response = await page.goto('https://test.com');
      expect(response.status()).toBe(200);

      await page.click('.button');
      expect(page.click).toHaveBeenCalledWith('.button');

      await page.type('.input', 'test text');
      expect(page.type).toHaveBeenCalledWith('.input', 'test text');

      const screenshot = await page.screenshot();
      expect(screenshot).toBeInstanceOf(Buffer);

      const evaluationResult = await page.evaluate('document.title');
      expect(evaluationResult).toBe('mock-evaluation-result');
    });

    it('should verify cleanup state', async () => {
      const { state } = mockBrowser;

      // Initially clean
      mockBrowser.verifyCleanup();

      // After creating resources, should fail verification
      await mockBrowser.browser.newContext();
      state.browserActive = true;

      expect(() => mockBrowser.verifyCleanup()).toThrow();

      // After cleanup, should pass
      await mockBrowser.close();
      mockBrowser.verifyCleanup();
    });
  });

  describe('createPermissionTestContext', () => {
    let context: PermissionTestContext;

    beforeEach(() => {
      context = createPermissionTestContext();
    });

    afterEach(async () => {
      await context.browserTool.cleanup();
    });

    it('should create complete permission test context', () => {
      expect(context).toBeDefined();
      expect(context.browserTool).toBeDefined();
      expect(context.permissionManager).toBeDefined();
      expect(context.eventEmitter).toBeDefined();
      expect(context.events).toEqual([]);
      expect(context.mockBrowser).toBeDefined();
      expect(context.resourceState).toBeDefined();
    });

    it('should integrate browser tool with permission manager', async () => {
      const params = {
        operation: 'navigate',
        params: { url: 'https://example.com' },
      };

      const result = await context.browserTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('navigate');
      expect(result.data).toBeDefined();
      expect(context.permissionManager.checkToolPermission).toHaveBeenCalled();
    });

    it('should handle permission denials in browser tool', async () => {
      // Configure to deny navigation
      const deniedContext = createPermissionTestContext({ denyOperations: ['navigate'] });

      const params = {
        operation: 'navigate',
        params: { url: 'https://example.com' },
      };

      const result = await deniedContext.browserTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.permissionDenied).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.permissionDenied).toBe(true);

      await deniedContext.browserTool.cleanup();
    });

    it('should emit permission events', async () => {
      const grantedSpy = vi.fn();
      const deniedSpy = vi.fn();

      context.eventEmitter.on('permission:granted', grantedSpy);
      context.eventEmitter.on('permission:denied', deniedSpy);

      // Execute allowed operation
      await context.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(grantedSpy).toHaveBeenCalled();
      expect(deniedSpy).not.toHaveBeenCalled();

      // Configure for denied operation
      await context.permissionManager.denyPermission('Browser', 'screenshot');

      // Execute denied operation
      await context.browserTool.execute({
        operation: 'screenshot',
        params: {},
      });

      expect(deniedSpy).toHaveBeenCalled();
    });

    it('should track resource state during operations', async () => {
      const { mockBrowser } = context;

      expect(mockBrowser.state.activeOperations).toBe(0);

      const executePromise = context.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      await executePromise;

      // After completion, operations should be back to 0
      expect(mockBrowser.state.activeOperations).toBe(0);
    });

    it('should handle different browser operations', async () => {
      const operations = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'click', params: { selector: '.button' } },
        { operation: 'screenshot', params: {} },
        { operation: 'evaluate', params: { script: 'document.title' } },
      ];

      for (const op of operations) {
        const result = await context.browserTool.execute(op);
        expect(result.success).toBe(true);
        expect(result.operation).toBe(op.operation);
      }
    });

    it('should collect permission events', () => {
      const events = context.events;

      // Initially empty
      expect(events).toEqual([]);

      // Emit some events
      context.eventEmitter.emit('permission:requested', {
        tool: 'Browser',
        scope: 'navigate',
      });

      context.eventEmitter.emit('permission:granted', {
        tool: 'Browser',
        scope: 'navigate',
        level: 'full',
      });

      context.eventEmitter.emit('permission:denied', {
        tool: 'Browser',
        scope: 'screenshot',
        denialReason: 'Not allowed',
      });

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('requested');
      expect(events[1].type).toBe('granted');
      expect(events[2].type).toBe('denied');
    });

    it('should provide resource state access', () => {
      const resourceState = context.browserTool.getResourceState();

      expect(resourceState).toBeDefined();
      expect(resourceState.sessionId).toBeDefined();
      expect(resourceState.browserActive).toBeDefined();
      expect(resourceState.currentUrl).toBeDefined();
    });
  });

  describe('Assertion Helpers', () => {
    describe('assertCleanResourceState', () => {
      it('should pass for clean resource state', () => {
        const context = createPermissionTestContext();

        // Should not throw for clean state
        assertCleanResourceState(context);
      });

      it('should fail for dirty resource state', async () => {
        const context = createPermissionTestContext();

        // Make resources dirty
        await context.mockBrowser.browser.newContext();
        context.mockBrowser.state.browserActive = true;

        expect(() => assertCleanResourceState(context)).toThrow();

        await context.browserTool.cleanup();
      });
    });

    describe('assertPermissionDeniedResponse', () => {
      it('should validate proper permission denied response', () => {
        const response: ExpectedPermissionDeniedResponse = {
          success: false,
          operation: 'navigate' as any,
          error: 'Navigation permission denied.',
          permissionDenied: true,
          metadata: {
            permissionDenied: true,
            deniedBy: 'test-policy',
            timestamp: new Date().toISOString(),
            suggestions: ['Contact administrator', 'Request elevated permissions'],
          },
        };

        // Should not throw
        assertPermissionDeniedResponse(response, 'navigate' as any);
      });

      it('should fail for invalid permission denied response', () => {
        const invalidResponse = {
          success: true, // Wrong - should be false
          operation: 'navigate',
          error: 'Some error',
          permissionDenied: false, // Wrong - should be true
        };

        expect(() => assertPermissionDeniedResponse(invalidResponse, 'navigate' as any))
          .toThrow();
      });

      it('should validate error message quality in response', () => {
        const responseWithBadError = {
          success: false,
          operation: 'navigate',
          error: 'undefined', // Bad error message
          permissionDenied: true,
          metadata: {
            permissionDenied: true,
            deniedBy: 'test',
            timestamp: '2023-01-01',
            suggestions: [],
          },
        };

        expect(() => assertPermissionDeniedResponse(responseWithBadError, 'navigate' as any))
          .toThrow();
      });

      it('should validate metadata structure', () => {
        const responseWithoutMetadata = {
          success: false,
          operation: 'navigate',
          error: 'Permission denied.',
          permissionDenied: true,
          // Missing metadata
        };

        expect(() => assertPermissionDeniedResponse(responseWithoutMetadata, 'navigate' as any))
          .toThrow();
      });
    });

    describe('assertPermissionEventsEmitted', () => {
      it('should validate permission events', () => {
        const events: PermissionEvent[] = [
          {
            type: 'granted',
            tool: 'Browser',
            scope: 'navigate',
            level: 'full',
            timestamp: new Date(),
          },
          {
            type: 'denied',
            tool: 'Browser',
            scope: 'screenshot',
            denialReason: 'Not allowed',
            timestamp: new Date(),
          },
        ];

        // Should not throw
        assertPermissionEventsEmitted(events, 'granted', 'Browser');
        assertPermissionEventsEmitted(events, 'denied', 'Browser');
      });

      it('should fail when no matching events found', () => {
        const events: PermissionEvent[] = [
          {
            type: 'granted',
            tool: 'Browser',
            timestamp: new Date(),
          },
        ];

        expect(() => assertPermissionEventsEmitted(events, 'denied', 'Browser'))
          .toThrow();
      });

      it('should validate denial reason for denied events', () => {
        const events: PermissionEvent[] = [
          {
            type: 'denied',
            tool: 'Browser',
            timestamp: new Date(),
            // Missing denialReason
          },
        ];

        expect(() => assertPermissionEventsEmitted(events, 'denied', 'Browser'))
          .toThrow();
      });
    });

    describe('assertNoCrashes', () => {
      it('should pass in stable environment', () => {
        // Should not throw
        assertNoCrashes();
      });
    });

    describe('assertErrorMessageQuality', () => {
      it('should pass for well-formatted error messages', () => {
        const goodMessages = [
          'Permission denied for navigation operation.',
          'Browser automation is not allowed on this domain.',
          'Screenshot capture requires elevated permissions.',
        ];

        goodMessages.forEach(message => {
          // Should not throw
          assertErrorMessageQuality(message);
        });
      });

      it('should fail for poor quality error messages', () => {
        const badMessages = [
          'undefined',
          'TypeError: Cannot read property',
          'Error: something went wrong',
          'bad error', // Too short and no punctuation
          'packages/browser/src/tool.ts:123', // Contains file paths
        ];

        badMessages.forEach(message => {
          expect(() => assertErrorMessageQuality(message)).toThrow();
        });
      });

      it('should validate message structure', () => {
        const message = 'Permission denied for browser automation.';

        // Should not throw
        assertErrorMessageQuality(message);

        expect(() => assertErrorMessageQuality('')).toThrow(); // Empty message
        expect(() => assertErrorMessageQuality('short')).toThrow(); // Too short
      });
    });
  });

  describe('collectPermissionEvents', () => {
    let emitter: EventEmitter;

    beforeEach(() => {
      emitter = new EventEmitter();
    });

    it('should collect permission events over time', async () => {
      const collectPromise = collectPermissionEvents(emitter, 200);

      // Emit some events during collection
      setTimeout(() => {
        emitter.emit('permission:requested', { tool: 'Browser', scope: 'navigate' });
        emitter.emit('permission:granted', { tool: 'Browser', scope: 'navigate' });
      }, 50);

      setTimeout(() => {
        emitter.emit('permission:denied', { tool: 'Browser', scope: 'screenshot' });
      }, 100);

      const events = await collectPromise;

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('requested');
      expect(events[1].type).toBe('granted');
      expect(events[2].type).toBe('denied');
      events.forEach(event => {
        expect(event.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should handle timeout correctly', async () => {
      const events = await collectPermissionEvents(emitter, 50);
      expect(events).toEqual([]);
    });

    it('should clean up event listeners', async () => {
      const initialListenerCount = emitter.listenerCount('permission:requested');

      await collectPermissionEvents(emitter, 50);

      const finalListenerCount = emitter.listenerCount('permission:requested');
      expect(finalListenerCount).toBe(initialListenerCount);
    });
  });

  describe('createPermissionDenialScenarios', () => {
    let scenarios: ReturnType<typeof createPermissionDenialScenarios>;

    beforeEach(() => {
      scenarios = createPermissionDenialScenarios();
    });

    it('should provide various denial scenario factories', () => {
      expect(scenarios.denyAllOperations).toBeDefined();
      expect(scenarios.denyNavigation).toBeDefined();
      expect(scenarios.denyInteraction).toBeDefined();
      expect(scenarios.denyDataExtraction).toBeDefined();
      expect(scenarios.denyScreenshots).toBeDefined();
      expect(scenarios.denyJavaScript).toBeDefined();
      expect(scenarios.blockDomains).toBeDefined();
      expect(scenarios.blockDangerous).toBeDefined();
      expect(scenarios.simulateFailure).toBeDefined();
      expect(scenarios.partialDenial).toBeDefined();
    });

    it('should create contexts that deny all operations', async () => {
      const context = scenarios.denyAllOperations();

      const result = await context.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.permissionDenied).toBe(true);

      await context.browserTool.cleanup();
    });

    it('should create contexts that deny specific operations', async () => {
      const context = scenarios.denyNavigation();

      // Navigation should be denied
      const navResult = await context.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });
      expect(navResult.success).toBe(false);

      // Other operations should be allowed
      const clickResult = await context.browserTool.execute({
        operation: 'click',
        params: { selector: '.button' },
      });
      expect(clickResult.success).toBe(true);

      await context.browserTool.cleanup();
    });

    it('should create contexts that block specific domains', async () => {
      const context = scenarios.blockDomains(['blocked.com']);

      const result = await context.permissionManager.checkToolPermission('Browser', {
        scope: 'navigate:blocked.com',
      });

      expect(result.allowed).toBe(false);
      expect(result.denialReason).toContain('Domain blocked');

      await context.browserTool.cleanup();
    });

    it('should create contexts that simulate failures', async () => {
      const context = scenarios.simulateFailure();

      await expect(context.permissionManager.checkToolPermission('Browser', { scope: 'test' }))
        .rejects.toThrow();

      await context.browserTool.cleanup();
    });

    it('should create contexts with partial denials', async () => {
      const context = scenarios.partialDenial();

      // Should deny JavaScript evaluation
      const evalResult = await context.browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' },
      });
      expect(evalResult.success).toBe(false);

      // Should allow navigation (not in deny list)
      const navResult = await context.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://allowed.com' },
      });
      expect(navResult.success).toBe(true);

      await context.browserTool.cleanup();
    });

    it('should create contexts that block dangerous domains', async () => {
      const context = scenarios.blockDangerous();

      const result = await context.permissionManager.checkToolPermission('Browser', {
        scope: 'navigate:malicious.com',
      });

      expect(result.allowed).toBe(false);
      expect(result.denialReason).toContain('Domain blocked');

      await context.browserTool.cleanup();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete permission workflow', async () => {
      const context = createPermissionTestContext();

      // Track events
      const events: PermissionEvent[] = [];
      context.eventEmitter.on('permission:granted', (event) => {
        events.push({ type: 'granted', timestamp: new Date(), ...event });
      });
      context.eventEmitter.on('permission:denied', (event) => {
        events.push({ type: 'denied', timestamp: new Date(), ...event });
      });

      // Execute allowed operation
      const allowedResult = await context.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(allowedResult.success).toBe(true);
      assertPermissionEventsEmitted(events, 'granted');

      // Deny operation
      await context.permissionManager.denyPermission('Browser', 'screenshot');

      // Execute denied operation
      const deniedResult = await context.browserTool.execute({
        operation: 'screenshot',
        params: {},
      });

      expect(deniedResult.success).toBe(false);
      assertPermissionDeniedResponse(deniedResult, 'screenshot' as any);
      assertPermissionEventsEmitted(events, 'denied');

      // Verify clean resource state
      assertCleanResourceState(context);

      await context.browserTool.cleanup();
    });

    it('should handle error scenarios gracefully', async () => {
      const context = createPermissionTestContext({ simulateFailures: true });

      // Permission check should fail
      await expect(
        context.browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com' },
        })
      ).rejects.toThrow();

      await context.browserTool.cleanup();
    });

    it('should maintain resource tracking throughout operations', async () => {
      const context = createPermissionTestContext();

      expect(context.mockBrowser.state.activeOperations).toBe(0);

      const operations = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'click', params: { selector: '.button' } },
        { operation: 'screenshot', params: {} },
      ];

      for (const op of operations) {
        await context.browserTool.execute(op);
        // After each operation, should be back to 0
        expect(context.mockBrowser.state.activeOperations).toBe(0);
      }

      assertCleanResourceState(context);
      await context.browserTool.cleanup();
    });
  });
});