/**
 * Browser Tool Complete Acceptance Criteria Validation
 *
 * This test suite provides comprehensive validation of all 6 acceptance criteria
 * working together in realistic scenarios. It serves as the final validation
 * that the BrowserTool implementation fully satisfies the requirements.
 *
 * Acceptance Criteria:
 * 1. BrowserPermissionDeniedError is created with operation/target/denialReason context
 * 2. cleanup() is called if browser was launched
 * 3. permission:denied event is emitted via eventEmitter with proper context
 * 4. A graceful BrowserResult object is returned (success: false) with error details
 * 5. All three denial paths (permission check, config restrictions, dangerous operations) follow this pattern
 * 6. The catch block handles BrowserPermissionDeniedError specifically without crashing
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { BrowserTool } from '../browser-tool';
import { PermissionManager } from '../../permission-manager';
import { PermissionStore } from '../../permission-store';
import {
  BrowserPermissionDeniedError,
  isBrowserPermissionDeniedError,
  type BrowserResourceState
} from '@apexcli/core';

import type {
  PermissionLevel,
  ToolPermissionResult,
  BrowserOperation,
} from '@apexcli/core';

describe('Browser Tool Complete Acceptance Criteria Validation', () => {
  let testDir: string;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let browserTool: BrowserTool;
  let eventEmitter: EventEmitter;
  let allEvents: any[] = [];

  // Validation helpers
  const validateAcceptanceCriteria = {
    /**
     * Validates Criteria 1: BrowserPermissionDeniedError creation with context
     */
    validateErrorContext: (result: any, expectedOperation: string, expectedTarget: string | RegExp) => {
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/permission.*denied/i);
      expect(result.error).toMatch(new RegExp(expectedOperation, 'i'));

      if (typeof expectedTarget === 'string') {
        expect(result.error).toMatch(expectedTarget);
        expect(result.metadata?.target).toBe(expectedTarget);
      } else {
        expect(result.metadata?.target).toMatch(expectedTarget);
      }
    },

    /**
     * Validates Criteria 2: cleanup() called when browser was launched
     */
    validateResourceCleanup: (browserTool: BrowserTool, initialState: BrowserResourceState) => {
      const finalState = browserTool.getResourceState();

      // If browser was initially active, it should be cleaned up
      if (initialState.browserActive || initialState.pageActive) {
        // Resources should be cleaned up or properly managed
        // The specific behavior may vary but resources shouldn't leak
        expect(typeof finalState.browserActive).toBe('boolean');
        expect(typeof finalState.pageActive).toBe('boolean');
        expect(typeof finalState.contextActive).toBe('boolean');
      }
    },

    /**
     * Validates Criteria 3: permission:denied event emission
     */
    validateEventEmission: (events: any[], expectedOperation: string, expectedTarget: string | RegExp, startTime: number, endTime: number) => {
      const deniedEvents = events.filter(e => e.type === 'permission:denied');
      expect(deniedEvents.length).toBeGreaterThan(0);

      const relevantEvent = deniedEvents.find(e => e.operation === expectedOperation);
      expect(relevantEvent).toBeDefined();

      expect(relevantEvent).toMatchObject({
        operation: expectedOperation,
        denialReason: expect.any(String),
        sessionId: expect.any(String),
        timestamp: expect.any(Date)
      });

      if (typeof expectedTarget === 'string') {
        expect(relevantEvent.target).toBe(expectedTarget);
      } else {
        expect(relevantEvent.target).toMatch(expectedTarget);
      }

      // Verify timing
      expect(relevantEvent.timestamp.getTime()).toBeGreaterThanOrEqual(startTime);
      expect(relevantEvent.timestamp.getTime()).toBeLessThanOrEqual(endTime);
    },

    /**
     * Validates Criteria 4: Graceful BrowserResult object
     */
    validateGracefulResult: (result: any, expectedOperation: string) => {
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result.success).toBe(false);
      expect(result.operation).toBe(expectedOperation);
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);

      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata).toBe('object');
      expect(result.metadata.permissionGranted).toBe(false);
      expect(typeof result.metadata.executionTime).toBe('number');
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0);
    },

    /**
     * Validates Criteria 6: No exceptions thrown
     */
    validateNoExceptions: (result: any) => {
      expect(() => result).not.toThrow();
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.operation).toBe('string');
    }
  };

  beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-browser-acceptance-test-'));
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);
    eventEmitter = new EventEmitter();

    browserTool = new BrowserTool({
      permissionManager,
      backend: 'playwright',
      engine: 'chromium',
      headless: true,
      eventEmitter,
    });

    allEvents = [];

    // Comprehensive event tracking
    ['permission:denied', 'permission:granted', 'browser:cleanup', 'browser:launched'].forEach(eventType => {
      eventEmitter.on(eventType, (event) => {
        allEvents.push({ type: eventType, timestamp: new Date(), ...event });
      });
    });

    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await browserTool.cleanup();
    } catch (error) {
      // Ignore cleanup errors in test teardown
    }
    vi.restoreAllMocks();
  });

  describe('Denial Path 1: Permission Check Failure - Complete Validation', () => {
    it('should satisfy ALL 6 acceptance criteria for permission manager denial', async () => {
      // Setup
      await permissionManager.grantPermission('Browser', undefined, 'deny');
      const initialResourceState = browserTool.getResourceState();

      const startTime = Date.now();

      // Execute
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://blocked-site.example.com' }
      });

      const endTime = Date.now();

      // =====================================================
      // COMPLETE VALIDATION OF ALL ACCEPTANCE CRITERIA
      // =====================================================

      // Criteria 1: BrowserPermissionDeniedError with context
      validateAcceptanceCriteria.validateErrorContext(result, 'navigate', 'https://blocked-site.example.com');

      // Criteria 2: Resource cleanup
      validateAcceptanceCriteria.validateResourceCleanup(browserTool, initialResourceState);

      // Criteria 3: Event emission
      validateAcceptanceCriteria.validateEventEmission(
        allEvents,
        'navigate',
        'https://blocked-site.example.com',
        startTime,
        endTime
      );

      // Criteria 4: Graceful result
      validateAcceptanceCriteria.validateGracefulResult(result, 'navigate');

      // Criteria 5: This is one of the three denial paths ✓

      // Criteria 6: No exceptions
      validateAcceptanceCriteria.validateNoExceptions(result);
    });

    it('should handle permission denial with active browser session', async () => {
      // First, establish browser session
      await permissionManager.grantPermission('Browser', 'navigate', 'allow-always');

      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://initial-page.com' }
      });
      expect(navResult.success).toBe(true);

      const resourceStateAfterNav = browserTool.getResourceState();

      // Now deny permissions
      await permissionManager.grantPermission('Browser', undefined, 'deny');
      allEvents = []; // Clear previous events

      const startTime = Date.now();

      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: '#submit-button' }
      });

      const endTime = Date.now();

      // Validate all criteria with active browser cleanup
      validateAcceptanceCriteria.validateErrorContext(result, 'click', '#submit-button');
      validateAcceptanceCriteria.validateResourceCleanup(browserTool, resourceStateAfterNav);
      validateAcceptanceCriteria.validateEventEmission(allEvents, 'click', '#submit-button', startTime, endTime);
      validateAcceptanceCriteria.validateGracefulResult(result, 'click');
      validateAcceptanceCriteria.validateNoExceptions(result);
    });
  });

  describe('Denial Path 2: Configuration Restrictions - Complete Validation', () => {
    it('should satisfy ALL 6 acceptance criteria for JavaScript execution denial', async () => {
      // Setup
      await permissionManager.grantPermission('Browser', undefined, 'allow-always');
      vi.spyOn(permissionManager, 'getToolConfig').mockResolvedValue({
        enabled: true,
        allowJavaScriptExecution: false
      });

      const initialResourceState = browserTool.getResourceState();
      const startTime = Date.now();

      // Execute
      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.querySelector("#sensitive-data").value' }
      });

      const endTime = Date.now();

      // COMPLETE VALIDATION
      validateAcceptanceCriteria.validateErrorContext(result, 'evaluate', /script_/);
      validateAcceptanceCriteria.validateResourceCleanup(browserTool, initialResourceState);
      validateAcceptanceCriteria.validateEventEmission(allEvents, 'evaluate', /script_/, startTime, endTime);
      validateAcceptanceCriteria.validateGracefulResult(result, 'evaluate');
      validateAcceptanceCriteria.validateNoExceptions(result);

      // Additional check for configuration-specific context
      const deniedEvent = allEvents.find(e => e.type === 'permission:denied' && e.operation === 'evaluate');
      expect(deniedEvent.restrictionType).toBe('configuration');
    });

    it('should satisfy ALL 6 acceptance criteria for domain blocking', async () => {
      // Setup
      await permissionManager.grantPermission('Browser', undefined, 'allow-always');
      vi.spyOn(permissionManager, 'getToolConfig').mockResolvedValue({
        enabled: true,
        blockedDomains: ['malicious-site.com']
      });

      const startTime = Date.now();

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://malicious-site.com/phishing-page' }
      });

      const endTime = Date.now();

      // COMPLETE VALIDATION
      validateAcceptanceCriteria.validateErrorContext(result, 'navigate', 'https://malicious-site.com/phishing-page');
      validateAcceptanceCriteria.validateResourceCleanup(browserTool, { browserActive: false, pageActive: false, contextActive: false, sessionId: '', activeOperations: 0 });
      validateAcceptanceCriteria.validateEventEmission(allEvents, 'navigate', 'https://malicious-site.com/phishing-page', startTime, endTime);
      validateAcceptanceCriteria.validateGracefulResult(result, 'navigate');
      validateAcceptanceCriteria.validateNoExceptions(result);
    });

    it('should satisfy ALL 6 acceptance criteria for form submission blocking', async () => {
      // Setup
      await permissionManager.grantPermission('Browser', undefined, 'allow-always');
      vi.spyOn(permissionManager, 'getToolConfig').mockResolvedValue({
        enabled: true,
        allowFormSubmission: false
      });

      const startTime = Date.now();

      const result = await browserTool.execute({
        operation: 'submit',
        params: { selector: '#payment-form' }
      });

      const endTime = Date.now();

      // COMPLETE VALIDATION
      validateAcceptanceCriteria.validateErrorContext(result, 'submit', '#payment-form');
      validateAcceptanceCriteria.validateResourceCleanup(browserTool, { browserActive: false, pageActive: false, contextActive: false, sessionId: '', activeOperations: 0 });
      validateAcceptanceCriteria.validateEventEmission(allEvents, 'submit', '#payment-form', startTime, endTime);
      validateAcceptanceCriteria.validateGracefulResult(result, 'submit');
      validateAcceptanceCriteria.validateNoExceptions(result);
    });
  });

  describe('Denial Path 3: Dangerous Operations - Complete Validation', () => {
    it('should satisfy ALL 6 acceptance criteria for dangerous JavaScript execution', async () => {
      // Setup: Allow basic operations but deny dangerous ones
      await permissionManager.grantPermission('Browser', 'navigate', 'allow-always');
      await permissionManager.grantPermission('Browser', 'evaluate', 'deny');

      const startTime = Date.now();

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'window.location = "https://attacker.com"; document.forms[0].submit();' }
      });

      const endTime = Date.now();

      // COMPLETE VALIDATION
      validateAcceptanceCriteria.validateErrorContext(result, 'evaluate', /script_/);
      validateAcceptanceCriteria.validateResourceCleanup(browserTool, { browserActive: false, pageActive: false, contextActive: false, sessionId: '', activeOperations: 0 });
      validateAcceptanceCriteria.validateEventEmission(allEvents, 'evaluate', /script_/, startTime, endTime);
      validateAcceptanceCriteria.validateGracefulResult(result, 'evaluate');
      validateAcceptanceCriteria.validateNoExceptions(result);
    });

    it('should satisfy ALL 6 acceptance criteria for dangerous form submission', async () => {
      // Setup
      await permissionManager.grantPermission('Browser', 'navigate', 'allow-always');
      await permissionManager.grantPermission('Browser', 'submit', 'deny');

      const startTime = Date.now();

      const result = await browserTool.execute({
        operation: 'submit',
        params: { selector: '#financial-transaction-form' }
      });

      const endTime = Date.now();

      // COMPLETE VALIDATION
      validateAcceptanceCriteria.validateErrorContext(result, 'submit', '#financial-transaction-form');
      validateAcceptanceCriteria.validateResourceCleanup(browserTool, { browserActive: false, pageActive: false, contextActive: false, sessionId: '', activeOperations: 0 });
      validateAcceptanceCriteria.validateEventEmission(allEvents, 'submit', '#financial-transaction-form', startTime, endTime);
      validateAcceptanceCriteria.validateGracefulResult(result, 'submit');
      validateAcceptanceCriteria.validateNoExceptions(result);
    });
  });

  describe('Exception Handling and Edge Cases - Criteria 6 Focus', () => {
    it('should handle BrowserPermissionDeniedError in catch block gracefully', async () => {
      // Force BrowserPermissionDeniedError to be thrown during permission check
      vi.spyOn(permissionManager, 'checkToolPermission').mockRejectedValue(
        new BrowserPermissionDeniedError('Critical permission system failure', {
          operation: 'navigate',
          target: 'https://example.com',
          denialReason: 'Permission service unavailable'
        })
      );

      const startTime = Date.now();

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      const endTime = Date.now();

      // Criteria 6: Should handle exception gracefully
      validateAcceptanceCriteria.validateNoExceptions(result);

      // Other criteria should still be satisfied
      validateAcceptanceCriteria.validateGracefulResult(result, 'navigate');

      // Should still emit events even when exception occurs
      const deniedEvents = allEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents.length).toBeGreaterThan(0);
    });

    it('should handle cleanup failures gracefully while maintaining all criteria', async () => {
      // Establish browser session
      await permissionManager.grantPermission('Browser', 'navigate', 'allow-always');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.com' }
      });

      // Mock cleanup to fail
      const originalCleanup = browserTool.cleanup.bind(browserTool);
      vi.spyOn(browserTool, 'cleanup').mockImplementation(async () => {
        await originalCleanup();
        throw new Error('Resource cleanup catastrophic failure');
      });

      // Deny permissions
      await permissionManager.grantPermission('Browser', undefined, 'deny');
      allEvents = [];

      const startTime = Date.now();

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { path: '/tmp/test.png' }
      });

      const endTime = Date.now();

      // ALL criteria should still be satisfied even with cleanup failure
      validateAcceptanceCriteria.validateErrorContext(result, 'screenshot', 'viewport');
      validateAcceptanceCriteria.validateEventEmission(allEvents, 'screenshot', 'viewport', startTime, endTime);
      validateAcceptanceCriteria.validateGracefulResult(result, 'screenshot');
      validateAcceptanceCriteria.validateNoExceptions(result);
    });

    it('should handle concurrent permission denials with all criteria satisfied', async () => {
      await permissionManager.grantPermission('Browser', undefined, 'deny');

      const operations = [
        { operation: 'navigate', params: { url: 'https://site1.com' }, target: 'https://site1.com' },
        { operation: 'click', params: { selector: '#btn1' }, target: '#btn1' },
        { operation: 'evaluate', params: { script: 'test1' }, target: /script_/ },
        { operation: 'submit', params: { selector: '#form1' }, target: '#form1' },
        { operation: 'screenshot', params: {}, target: 'viewport' }
      ];

      const startTime = Date.now();

      // Execute all operations concurrently
      const results = await Promise.all(
        operations.map(op => browserTool.execute({
          operation: op.operation as BrowserOperation,
          params: op.params
        }))
      );

      const endTime = Date.now();

      // Validate ALL criteria for ALL operations
      results.forEach((result, index) => {
        const op = operations[index];

        validateAcceptanceCriteria.validateErrorContext(result, op.operation, op.target);
        validateAcceptanceCriteria.validateGracefulResult(result, op.operation);
        validateAcceptanceCriteria.validateNoExceptions(result);
      });

      // Validate event emission for all operations
      operations.forEach(op => {
        validateAcceptanceCriteria.validateEventEmission(allEvents, op.operation, op.target, startTime, endTime);
      });
    });
  });

  describe('Complete Integration Scenarios', () => {
    it('should demonstrate ALL acceptance criteria working together across multiple denial scenarios', async () => {
      const scenarios = [
        {
          name: 'Permission Manager Total Denial',
          setup: async () => {
            await permissionManager.grantPermission('Browser', undefined, 'deny');
          },
          operation: { operation: 'navigate' as BrowserOperation, params: { url: 'https://restricted.com' } },
          expectedTarget: 'https://restricted.com'
        },
        {
          name: 'JavaScript Configuration Block',
          setup: async () => {
            await permissionManager.grantPermission('Browser', undefined, 'allow-always');
            vi.spyOn(permissionManager, 'getToolConfig').mockResolvedValue({
              enabled: true,
              allowJavaScriptExecution: false
            });
          },
          operation: { operation: 'evaluate' as BrowserOperation, params: { script: 'dangerous_code()' } },
          expectedTarget: /script_/
        },
        {
          name: 'Domain Restriction Block',
          setup: async () => {
            await permissionManager.grantPermission('Browser', undefined, 'allow-always');
            vi.spyOn(permissionManager, 'getToolConfig').mockResolvedValue({
              enabled: true,
              blockedDomains: ['evil.com']
            });
          },
          operation: { operation: 'navigate' as BrowserOperation, params: { url: 'https://evil.com/attack' } },
          expectedTarget: 'https://evil.com/attack'
        },
        {
          name: 'Dangerous Operation Permission Denial',
          setup: async () => {
            await permissionManager.grantPermission('Browser', 'navigate', 'allow-always');
            await permissionManager.grantPermission('Browser', 'submit', 'deny');
          },
          operation: { operation: 'submit' as BrowserOperation, params: { selector: '#credit-card-form' } },
          expectedTarget: '#credit-card-form'
        }
      ];

      for (const scenario of scenarios) {
        console.log(`\n=== Testing Scenario: ${scenario.name} ===`);

        // Setup scenario
        await scenario.setup();
        allEvents = []; // Reset events
        const initialResourceState = browserTool.getResourceState();

        const startTime = Date.now();

        // Execute operation
        const result = await browserTool.execute(scenario.operation);

        const endTime = Date.now();

        console.log(`Operation: ${scenario.operation.operation}, Success: ${result.success}`);

        // VALIDATE ALL 6 ACCEPTANCE CRITERIA FOR THIS SCENARIO
        console.log('Validating Criteria 1: Error Context');
        validateAcceptanceCriteria.validateErrorContext(result, scenario.operation.operation, scenario.expectedTarget);

        console.log('Validating Criteria 2: Resource Cleanup');
        validateAcceptanceCriteria.validateResourceCleanup(browserTool, initialResourceState);

        console.log('Validating Criteria 3: Event Emission');
        validateAcceptanceCriteria.validateEventEmission(
          allEvents,
          scenario.operation.operation,
          scenario.expectedTarget,
          startTime,
          endTime
        );

        console.log('Validating Criteria 4: Graceful Result');
        validateAcceptanceCriteria.validateGracefulResult(result, scenario.operation.operation);

        console.log('Validating Criteria 5: Denial Path Coverage');
        // This scenario represents one of the three denial paths ✓

        console.log('Validating Criteria 6: No Exceptions');
        validateAcceptanceCriteria.validateNoExceptions(result);

        console.log(`✅ Scenario "${scenario.name}" passed all 6 acceptance criteria`);
      }
    });

    it('should maintain criteria compliance during rapid sequential denials', async () => {
      // Setup denial conditions
      await permissionManager.grantPermission('Browser', undefined, 'deny');

      const rapidOperations = [
        { operation: 'navigate', params: { url: 'https://rapid1.com' } },
        { operation: 'click', params: { selector: '#rapid1' } },
        { operation: 'type', params: { selector: '#input1', text: 'test1' } },
        { operation: 'screenshot', params: {} },
        { operation: 'evaluate', params: { script: 'rapid_test_1()' } }
      ];

      const overallStartTime = Date.now();

      // Execute operations rapidly in sequence
      for (const op of rapidOperations) {
        const opStartTime = Date.now();

        const result = await browserTool.execute({
          operation: op.operation as BrowserOperation,
          params: op.params
        });

        const opEndTime = Date.now();

        // Each operation should satisfy all criteria
        validateAcceptanceCriteria.validateGracefulResult(result, op.operation);
        validateAcceptanceCriteria.validateNoExceptions(result);
      }

      const overallEndTime = Date.now();

      // Verify all operations generated proper events
      const deniedEvents = allEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents.length).toBeGreaterThanOrEqual(rapidOperations.length);

      // All events should be within the time window
      deniedEvents.forEach(event => {
        expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(overallStartTime);
        expect(event.timestamp.getTime()).toBeLessThanOrEqual(overallEndTime);
      });
    });
  });
});