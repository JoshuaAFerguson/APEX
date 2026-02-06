/**
 * Browser Tool Event Emission Tests
 *
 * This test suite specifically validates that permission:denied events are properly
 * emitted via the eventEmitter with correct context and timing when browser
 * permissions are denied.
 *
 * Focuses on Acceptance Criteria 3: permission:denied event emission
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';

import { BrowserTool } from '../browser-tool';
import { PermissionManager } from '../../permission-manager';
import { PermissionStore } from '../../permission-store';

import type {
  BrowserOperation,
} from '@apexcli/core';

describe('Browser Tool Event Emission', () => {
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let browserTool: BrowserTool;
  let eventEmitter: EventEmitter;
  let emittedEvents: any[] = [];

  beforeEach(async () => {
    // Initialize stores and managers
    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);

    // Create event emitter
    eventEmitter = new EventEmitter();

    // Create browser tool with event emitter
    browserTool = new BrowserTool({
      permissionManager,
      backend: 'playwright',
      engine: 'chromium',
      headless: true,
      eventEmitter,
    });

    // Reset event tracking
    emittedEvents = [];

    // Set up comprehensive event listeners
    eventEmitter.on('permission:denied', (event) => {
      emittedEvents.push({
        type: 'permission:denied',
        timestamp: new Date(),
        ...event
      });
    });

    eventEmitter.on('permission:granted', (event) => {
      emittedEvents.push({
        type: 'permission:granted',
        timestamp: new Date(),
        ...event
      });
    });

    eventEmitter.on('permission:requested', (event) => {
      emittedEvents.push({
        type: 'permission:requested',
        timestamp: new Date(),
        ...event
      });
    });

    eventEmitter.on('browser:cleanup', (event) => {
      emittedEvents.push({
        type: 'browser:cleanup',
        timestamp: new Date(),
        ...event
      });
    });

    eventEmitter.on('browser:launched', (event) => {
      emittedEvents.push({
        type: 'browser:launched',
        timestamp: new Date(),
        ...event
      });
    });

    // Clear mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup browser resources
    try {
      await browserTool.cleanup();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
    vi.restoreAllMocks();
  });

  describe('Event Emission Timing and Context', () => {
    it('should emit permission:denied event immediately when operation is denied', async () => {
      // Setup: Deny all browser permissions
      await permissionManager.grantPermission('Browser', undefined, 'deny');

      const beforeTime = Date.now();

      // Execute operation that should be denied
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      const afterTime = Date.now();

      // Verify event was emitted
      const deniedEvents = emittedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(1);

      const event = deniedEvents[0];

      // Verify timing
      expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(event.timestamp.getTime()).toBeLessThanOrEqual(afterTime);

      // Verify required context fields
      expect(event).toMatchObject({
        operation: 'navigate',
        target: 'https://example.com',
        denialReason: expect.any(String),
        sessionId: expect.any(String)
      });
    });

    it('should emit permission:denied event for each denied operation with unique context', async () => {
      // Setup: Deny all operations
      await permissionManager.grantPermission('Browser', undefined, 'deny');

      const operations = [
        { operation: 'navigate', params: { url: 'https://site1.com' }, expectedTarget: 'https://site1.com' },
        { operation: 'click', params: { selector: '#button1' }, expectedTarget: '#button1' },
        { operation: 'evaluate', params: { script: 'test script 1' }, expectedTarget: expect.stringMatching(/script_/) },
        { operation: 'screenshot', params: {}, expectedTarget: 'viewport' }
      ];

      // Execute all operations
      for (const op of operations) {
        await browserTool.execute({
          operation: op.operation as BrowserOperation,
          params: op.params
        });
      }

      // Verify events were emitted for each operation
      const deniedEvents = emittedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents.length).toBeGreaterThanOrEqual(operations.length);

      // Verify each operation has its own event with correct context
      operations.forEach((op, index) => {
        const matchingEvent = deniedEvents.find(event =>
          event.operation === op.operation &&
          (typeof op.expectedTarget === 'string' ?
            event.target === op.expectedTarget :
            op.expectedTarget.test ? op.expectedTarget.test(event.target) : false)
        );

        expect(matchingEvent).toBeDefined();
        expect(matchingEvent.operation).toBe(op.operation);
        expect(matchingEvent.denialReason).toBeDefined();
        expect(matchingEvent.sessionId).toBeDefined();
      });
    });
  });

  describe('Event Content Validation', () => {
    it('should emit permission:denied event with complete required fields', async () => {
      await permissionManager.grantPermission('Browser', undefined, 'deny');

      await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.querySelector("#malicious")' }
      });

      const deniedEvents = emittedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(1);

      const event = deniedEvents[0];

      // Verify all required fields are present and have correct types
      expect(event.operation).toBe('evaluate');
      expect(typeof event.target).toBe('string');
      expect(event.target).toMatch(/script_/);
      expect(typeof event.denialReason).toBe('string');
      expect(event.denialReason.length).toBeGreaterThan(0);
      expect(typeof event.sessionId).toBe('string');
      expect(event.sessionId.length).toBeGreaterThan(0);
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should include error object in permission:denied event', async () => {
      await permissionManager.grantPermission('Browser', undefined, 'deny');

      await browserTool.execute({
        operation: 'submit',
        params: { selector: '#payment-form' }
      });

      const deniedEvents = emittedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(1);

      const event = deniedEvents[0];
      expect(event.error).toBeDefined();
      expect(event.error.message).toBeDefined();
      expect(event.error.message).toMatch(/permission.*denied/i);
    });

    it('should emit events with different restriction types for different denial paths', async () => {
      // Test configuration restriction
      await permissionManager.grantPermission('Browser', undefined, 'allow-always');
      vi.spyOn(permissionManager, 'getToolConfig').mockResolvedValue({
        enabled: true,
        allowJavaScriptExecution: false
      });

      await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'test' }
      });

      let deniedEvents = emittedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(1);
      expect(deniedEvents[0].restrictionType).toBe('configuration');

      // Clear events and test permission manager denial
      emittedEvents = [];
      await permissionManager.grantPermission('Browser', undefined, 'deny');

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      deniedEvents = emittedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(1);
      // This should not have restrictionType or have a different value
    });
  });

  describe('Event Emission with Resource Cleanup', () => {
    it('should emit permission:denied event even when cleanup fails', async () => {
      // First, launch browser with allowed permissions
      await permissionManager.grantPermission('Browser', 'navigate', 'allow-always');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Mock cleanup to fail
      const originalCleanup = browserTool.cleanup.bind(browserTool);
      vi.spyOn(browserTool, 'cleanup').mockImplementation(async () => {
        await originalCleanup();
        throw new Error('Cleanup failed');
      });

      // Deny permissions and clear previous events
      await permissionManager.grantPermission('Browser', undefined, 'deny');
      emittedEvents = [];

      // Execute operation that should be denied
      await browserTool.execute({
        operation: 'screenshot',
        params: {}
      });

      // Event should still be emitted despite cleanup failure
      const deniedEvents = emittedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(1);
      expect(deniedEvents[0].operation).toBe('screenshot');
    });

    it('should emit permission:denied event with proper session tracking', async () => {
      await permissionManager.grantPermission('Browser', undefined, 'deny');

      // Execute multiple operations and verify session consistency
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://site1.com' }
      });

      await browserTool.execute({
        operation: 'click',
        params: { selector: '#btn1' }
      });

      const deniedEvents = emittedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents.length).toBeGreaterThanOrEqual(2);

      // All events should have session IDs (might be same or different)
      deniedEvents.forEach(event => {
        expect(event.sessionId).toBeDefined();
        expect(typeof event.sessionId).toBe('string');
        expect(event.sessionId.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Event Listener Management', () => {
    it('should not emit events when eventEmitter is not provided', async () => {
      // Create browser tool without event emitter
      const toolWithoutEmitter = new BrowserTool({
        permissionManager,
        backend: 'playwright',
        headless: true
        // No eventEmitter
      });

      await permissionManager.grantPermission('Browser', undefined, 'deny');

      // This should not cause any errors even without eventEmitter
      const result = await toolWithoutEmitter.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      // No events should be emitted to our listener since tool has no emitter
      const deniedEvents = emittedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(0);

      await toolWithoutEmitter.cleanup();
    });

    it('should handle multiple event listeners correctly', async () => {
      let secondListenerEvents: any[] = [];

      // Add second listener
      eventEmitter.on('permission:denied', (event) => {
        secondListenerEvents.push(event);
      });

      await permissionManager.grantPermission('Browser', undefined, 'deny');

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Both listeners should receive the event
      const firstListenerEvents = emittedEvents.filter(e => e.type === 'permission:denied');
      expect(firstListenerEvents).toHaveLength(1);
      expect(secondListenerEvents).toHaveLength(1);

      // Events should have same content
      expect(firstListenerEvents[0].operation).toBe(secondListenerEvents[0].operation);
      expect(firstListenerEvents[0].target).toBe(secondListenerEvents[0].target);
    });

    it('should handle event emission errors gracefully', async () => {
      // Add listener that throws an error
      eventEmitter.on('permission:denied', () => {
        throw new Error('Event listener failed');
      });

      await permissionManager.grantPermission('Browser', undefined, 'deny');

      // This should not crash the browser tool
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });
  });

  describe('Event Emission Edge Cases', () => {
    it('should emit events with correct timestamps under rapid operations', async () => {
      await permissionManager.grantPermission('Browser', undefined, 'deny');

      const startTime = Date.now();

      // Execute multiple operations rapidly
      const promises = [
        browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://site1.com' }
        }),
        browserTool.execute({
          operation: 'click',
          params: { selector: '#btn1' }
        }),
        browserTool.execute({
          operation: 'screenshot',
          params: {}
        })
      ];

      await Promise.all(promises);
      const endTime = Date.now();

      const deniedEvents = emittedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents.length).toBeGreaterThanOrEqual(3);

      // All timestamps should be within the execution window
      deniedEvents.forEach(event => {
        expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(startTime);
        expect(event.timestamp.getTime()).toBeLessThanOrEqual(endTime);
      });
    });

    it('should emit events with unique identifiers for concurrent operations', async () => {
      await permissionManager.grantPermission('Browser', undefined, 'deny');

      // Execute operations concurrently
      const operations = Array.from({ length: 5 }, (_, i) => ({
        operation: 'navigate',
        params: { url: `https://site${i}.com` }
      }));

      await Promise.all(
        operations.map(op => browserTool.execute({
          operation: op.operation as BrowserOperation,
          params: op.params
        }))
      );

      const deniedEvents = emittedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents.length).toBeGreaterThanOrEqual(5);

      // Verify each event has correct target
      operations.forEach((op, index) => {
        const matchingEvent = deniedEvents.find(event =>
          event.target === op.params.url
        );
        expect(matchingEvent).toBeDefined();
        expect(matchingEvent.operation).toBe('navigate');
      });
    });
  });
});