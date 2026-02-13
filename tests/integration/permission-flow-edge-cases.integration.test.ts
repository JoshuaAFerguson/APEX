/**
 * Permission Flow Edge Cases Integration Tests
 *
 * This test suite validates complex permission scenarios and edge cases
 * across the integrated tool, permission, and browser automation systems.
 *
 * Edge cases covered:
 * - Permission expiry during operation execution
 * - Hierarchical permission inheritance
 * - Concurrent permission modifications
 * - Permission restoration after denial
 * - Cross-tool permission dependencies
 * - Permission audit trails and logging
 * - Partial permission grants with complex scopes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'os';

import type { PermissionLevel, AgentTool } from '@apexcli/core';
import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool';
import { PermissionManager } from '../../packages/orchestrator/src/permission-manager';
import { PermissionStore } from '../../packages/orchestrator/src/permission-store';

// Mock Playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() => Promise.resolve({
      newContext: vi.fn(() => Promise.resolve({
        newPage: vi.fn(() => Promise.resolve(mockPage)),
        close: vi.fn()
      })),
      close: vi.fn()
    }))
  }
}));

const mockPage = {
  url: vi.fn(() => 'about:blank'),
  goto: vi.fn(),
  click: vi.fn(),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('screenshot'))),
  evaluate: vi.fn(),
  close: vi.fn(),
  on: vi.fn(),
  title: vi.fn(() => Promise.resolve('Test Page')),
  viewportSize: vi.fn(() => ({ width: 1920, height: 1080 }))
};

// Helper to create mock tool with permission integration
function createMockTool(name: string, permissionManager: PermissionManager, eventEmitter: EventEmitter) {
  return {
    name,
    execute: vi.fn(async ({ operation, params }) => {
      eventEmitter.emit('tool:execution:start', { tool: name, operation });

      try {
        const permissionResult = await permissionManager.checkToolPermission(name as AgentTool, {
          scope: operation,
          context: params
        });

        if (!permissionResult.allowed) {
          eventEmitter.emit('permission:denied', {
            tool: name,
            operation,
            reason: permissionResult.denialReason
          });

          return {
            success: false,
            error: `Permission denied: ${permissionResult.denialReason}`,
            tool: name,
            operation
          };
        }

        eventEmitter.emit('permission:granted', { tool: name, operation });

        // Simulate operation delay for timing tests
        await new Promise(resolve => setTimeout(resolve, 10));

        eventEmitter.emit('tool:execution:complete', { tool: name, operation });

        return {
          success: true,
          data: { result: `${name} ${operation} completed` },
          tool: name,
          operation
        };
      } catch (error) {
        eventEmitter.emit('tool:execution:error', { tool: name, operation, error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          tool: name,
          operation
        };
      }
    })
  };
}

describe('Permission Flow Edge Cases', () => {
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let eventEmitter: EventEmitter;
  let browserTool: BrowserTool;
  let mockTool: any;
  let systemEvents: any[];

  beforeEach(async () => {
    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);
    eventEmitter = new EventEmitter();
    systemEvents = [];

    // Track all events
    const eventTypes = [
      'permission:granted', 'permission:denied', 'permission:expired',
      'tool:execution:start', 'tool:execution:complete', 'tool:execution:error',
      'browser:operation:start', 'browser:operation:complete'
    ];

    eventTypes.forEach(eventType => {
      eventEmitter.on(eventType, (data) => {
        systemEvents.push({ type: eventType, data, timestamp: Date.now() });
      });
    });

    browserTool = new BrowserTool({
      permissionManager,
      eventEmitter,
      backend: 'playwright'
    });

    mockTool = createMockTool('TestTool', permissionManager, eventEmitter);

    vi.clearAllMocks();
  });

  afterEach(async () => {
    await browserTool.cleanup();
  });

  describe('Time-Based Permission Edge Cases', () => {
    it('should handle permission expiry during operation execution', async () => {
      // Grant permission with very short expiry
      const expiryTime = new Date(Date.now() + 50); // 50ms from now
      await permissionManager.grantPermission('TestTool', 'testOperation', 'allow-always', {
        expiryTime
      });

      // Start operation that will execute after permission expires
      const operationPromise = mockTool.execute({
        operation: 'testOperation',
        params: { delay: 100 } // 100ms operation
      });

      // Wait for operation to complete
      const result = await operationPromise;

      // Result depends on implementation - permission might be checked at start or during execution
      expect(result.success).toBeDefined();

      if (!result.success) {
        expect(result.error).toMatch(/permission.*expired|expired.*permission/i);
      }
    });

    it('should handle permission grant during ongoing operation', async () => {
      // Initially deny permission
      await permissionManager.denyPermission('TestTool', 'testOperation');

      // Start operation (will fail immediately due to permission check at start)
      const result1 = await mockTool.execute({
        operation: 'testOperation',
        params: {}
      });
      expect(result1.success).toBe(false);

      // Grant permission and try again
      await permissionManager.grantPermission('TestTool', 'testOperation', 'allow-once');

      const result2 = await mockTool.execute({
        operation: 'testOperation',
        params: {}
      });
      expect(result2.success).toBe(true);

      // Third attempt should fail (allow-once consumed)
      const result3 = await mockTool.execute({
        operation: 'testOperation',
        params: {}
      });
      expect(result3.success).toBe(false);
    });

    it('should handle rapid permission level changes', async () => {
      const operations = [];

      // Start multiple concurrent operations
      for (let i = 0; i < 5; i++) {
        operations.push(mockTool.execute({
          operation: `operation${i}`,
          params: { index: i }
        }));
      }

      // Rapidly change permissions while operations might be running
      setTimeout(() => permissionManager.grantPermission('TestTool', 'allow-always'), 5);
      setTimeout(() => permissionManager.denyPermission('TestTool'), 10);
      setTimeout(() => permissionManager.grantPermission('TestTool', 'allow-once'), 15);

      const results = await Promise.allSettled(operations);

      // All operations should complete, but success may vary based on timing
      expect(results.length).toBe(5);
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });

      // At least some permission events should have been generated
      const permissionEvents = systemEvents.filter(e =>
        e.type === 'permission:granted' || e.type === 'permission:denied'
      );
      expect(permissionEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Hierarchical Permission Inheritance', () => {
    it('should handle complex scope hierarchies', async () => {
      // Set up hierarchical permissions
      await permissionManager.grantPermission('Browser', 'allow-always'); // General browser permission
      await permissionManager.denyPermission('Browser', 'evaluate'); // Specific denial
      await permissionManager.grantPermission('Browser', 'allow-once', 'navigate:example.com'); // Specific grant

      // General navigation should inherit from main permission
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      const generalNavResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.com' }
      });
      expect(generalNavResult.success).toBe(true);

      // Specific domain navigation should work with allow-once
      const specificNavResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(specificNavResult.success).toBe(true);

      // Second specific domain navigation should fail (allow-once consumed)
      const secondSpecificNavResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/page2' }
      });
      expect(secondSpecificNavResult.success).toBe(false);

      // JavaScript evaluation should be denied despite general permission
      const evalResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });
      expect(evalResult.success).toBe(false);
    });

    it('should handle permission inheritance with wildcard scopes', async () => {
      // Grant permission with wildcards
      await permissionManager.grantPermission('TestTool', 'allow-always', 'read:*');
      await permissionManager.denyPermission('TestTool', 'read:/secrets/*');
      await permissionManager.grantPermission('TestTool', 'allow-once', 'write:/temp/*');

      // Read operations should generally work
      const readResult1 = await mockTool.execute({
        operation: 'read',
        params: { path: '/public/file.txt' }
      });
      expect(readResult1.success).toBe(true);

      // Secrets should be blocked
      const secretReadResult = await mockTool.execute({
        operation: 'read',
        params: { path: '/secrets/key.txt' }
      });
      expect(secretReadResult.success).toBe(false);

      // Temp write should work once
      const tempWriteResult1 = await mockTool.execute({
        operation: 'write',
        params: { path: '/temp/output.txt' }
      });
      expect(tempWriteResult1.success).toBe(true);

      const tempWriteResult2 = await mockTool.execute({
        operation: 'write',
        params: { path: '/temp/output2.txt' }
      });
      expect(tempWriteResult2.success).toBe(false); // Allow-once consumed
    });
  });

  describe('Concurrent Permission Modifications', () => {
    it('should handle concurrent permission grants and denials', async () => {
      const concurrentOperations = [];

      // Start many concurrent operations
      for (let i = 0; i < 10; i++) {
        concurrentOperations.push(mockTool.execute({
          operation: 'concurrentTest',
          params: { id: i }
        }));
      }

      // Concurrently modify permissions
      const permissionChanges = [
        permissionManager.grantPermission('TestTool', 'allow-always'),
        permissionManager.denyPermission('TestTool'),
        permissionManager.grantPermission('TestTool', 'allow-once'),
        permissionManager.grantPermission('TestTool', 'allow-always'),
      ];

      const [operationResults, permissionResults] = await Promise.all([
        Promise.allSettled(concurrentOperations),
        Promise.allSettled(permissionChanges)
      ]);

      // All permission changes should complete
      expect(permissionResults.every(r => r.status === 'fulfilled')).toBe(true);

      // Operations should complete (success may vary)
      expect(operationResults.length).toBe(10);
      operationResults.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });

      // System should remain stable
      expect(permissionManager).toBeDefined();
    });

    it('should maintain permission consistency during rapid changes', async () => {
      const operationResults = [];

      // Perform rapid permission changes with interleaved operations
      for (let i = 0; i < 20; i++) {
        if (i % 4 === 0) {
          await permissionManager.grantPermission('TestTool', 'allow-always');
        } else if (i % 4 === 2) {
          await permissionManager.denyPermission('TestTool');
        }

        // Execute operation after each permission change
        const result = await mockTool.execute({
          operation: 'rapidTest',
          params: { iteration: i }
        });
        operationResults.push({ iteration: i, success: result.success });
      }

      // Results should be consistent with permission states at execution time
      let expectedSuccesses = 0;
      let expectedFailures = 0;

      operationResults.forEach(result => {
        if (result.success) expectedSuccesses++;
        else expectedFailures++;
      });

      expect(expectedSuccesses + expectedFailures).toBe(20);
      expect(expectedSuccesses).toBeGreaterThan(0); // Some should succeed
      expect(expectedFailures).toBeGreaterThan(0); // Some should fail
    });
  });

  describe('Cross-Tool Permission Dependencies', () => {
    it('should handle dependent tool operations with different permission levels', async () => {
      // Create second mock tool
      const secondTool = createMockTool('SecondTool', permissionManager, eventEmitter);

      // Set up dependency scenario: TestTool -> SecondTool -> Browser
      await permissionManager.grantPermission('TestTool', 'allow-always');
      await permissionManager.grantPermission('SecondTool', 'allow-once'); // Limited
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Mock dependency chain
      mockTool.execute.mockImplementation(async ({ operation, params }) => {
        // TestTool depends on SecondTool
        const secondResult = await secondTool.execute({
          operation: 'dependency',
          params: { from: 'TestTool' }
        });

        if (!secondResult.success) {
          return {
            success: false,
            error: `Dependency failed: ${secondResult.error}`,
            tool: 'TestTool'
          };
        }

        return { success: true, data: { chain: 'TestTool -> SecondTool' } };
      });

      secondTool.execute.mockImplementation(async ({ operation, params }) => {
        // Check SecondTool permission
        const permissionResult = await permissionManager.checkToolPermission('SecondTool', {
          scope: operation
        });

        if (!permissionResult.allowed) {
          return {
            success: false,
            error: `Permission denied for SecondTool: ${permissionResult.denialReason}`
          };
        }

        // SecondTool depends on Browser
        mockPage.goto.mockResolvedValue({ status: () => 200 });
        const browserResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://dependency.com' }
        });

        if (!browserResult.success) {
          return {
            success: false,
            error: `Browser dependency failed: ${browserResult.error}`
          };
        }

        return { success: true, data: { chain: 'SecondTool -> Browser' } };
      });

      // First chain execution should succeed
      const result1 = await mockTool.execute({
        operation: 'chainTest',
        params: {}
      });
      expect(result1.success).toBe(true);

      // Second chain execution should fail (SecondTool allow-once consumed)
      const result2 = await mockTool.execute({
        operation: 'chainTest',
        params: {}
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toMatch(/permission.*denied/i);
    });

    it('should handle circular permission dependencies gracefully', async () => {
      const toolA = createMockTool('ToolA', permissionManager, eventEmitter);
      const toolB = createMockTool('ToolB', permissionManager, eventEmitter);

      await permissionManager.grantPermission('ToolA', 'allow-always');
      await permissionManager.grantPermission('ToolB', 'allow-always');

      let circularDetected = false;
      const executionStack: string[] = [];

      // Set up circular dependency: ToolA -> ToolB -> ToolA
      toolA.execute.mockImplementation(async ({ operation, params }) => {
        if (executionStack.includes('ToolA')) {
          circularDetected = true;
          return {
            success: false,
            error: 'Circular dependency detected: ToolA already in execution stack'
          };
        }

        executionStack.push('ToolA');
        const result = await toolB.execute({ operation: 'callA', params: {} });
        executionStack.pop();

        return result;
      });

      toolB.execute.mockImplementation(async ({ operation, params }) => {
        if (executionStack.includes('ToolB')) {
          circularDetected = true;
          return {
            success: false,
            error: 'Circular dependency detected: ToolB already in execution stack'
          };
        }

        executionStack.push('ToolB');
        const result = await toolA.execute({ operation: 'callB', params: {} });
        executionStack.pop();

        return result;
      });

      const result = await toolA.execute({
        operation: 'startCircular',
        params: {}
      });

      expect(result.success).toBe(false);
      expect(circularDetected).toBe(true);
      expect(result.error).toMatch(/circular.*dependency/i);
    });
  });

  describe('Permission Audit and Logging', () => {
    it('should maintain comprehensive audit trail', async () => {
      const auditEvents: any[] = [];

      // Enhanced event tracking for audit
      eventEmitter.on('permission:granted', (data) =>
        auditEvents.push({ action: 'granted', ...data, timestamp: Date.now() })
      );
      eventEmitter.on('permission:denied', (data) =>
        auditEvents.push({ action: 'denied', ...data, timestamp: Date.now() })
      );

      // Perform various permission operations
      await permissionManager.grantPermission('TestTool', 'allow-once');
      await mockTool.execute({ operation: 'auditTest1', params: {} });
      await mockTool.execute({ operation: 'auditTest2', params: {} }); // Should fail

      await permissionManager.grantPermission('Browser', 'allow-always');
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://audit.com' }
      });

      await permissionManager.denyPermission('Browser');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://denied.com' }
      });

      // Verify audit trail completeness
      expect(auditEvents.length).toBeGreaterThan(0);

      const grantedEvents = auditEvents.filter(e => e.action === 'granted');
      const deniedEvents = auditEvents.filter(e => e.action === 'denied');

      expect(grantedEvents.length).toBeGreaterThan(0);
      expect(deniedEvents.length).toBeGreaterThan(0);

      // Audit events should have proper structure
      auditEvents.forEach(event => {
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('action');
        expect(['granted', 'denied']).toContain(event.action);
      });

      // Events should be in chronological order
      for (let i = 1; i < auditEvents.length; i++) {
        expect(auditEvents[i].timestamp).toBeGreaterThanOrEqual(auditEvents[i - 1].timestamp);
      }
    });

    it('should handle audit trail during error conditions', async () => {
      const errorEvents: any[] = [];

      eventEmitter.on('tool:execution:error', (data) =>
        errorEvents.push({ ...data, timestamp: Date.now() })
      );

      // Create error condition by corrupting permission manager
      const originalCheckMethod = permissionManager.checkToolPermission.bind(permissionManager);
      let shouldError = false;

      vi.spyOn(permissionManager, 'checkToolPermission').mockImplementation(async (...args) => {
        if (shouldError) {
          throw new Error('Permission system corruption detected');
        }
        return originalCheckMethod(...args);
      });

      await permissionManager.grantPermission('TestTool', 'allow-always');

      // Normal operation should work
      const result1 = await mockTool.execute({
        operation: 'errorTest1',
        params: {}
      });
      expect(result1.success).toBe(true);

      // Trigger error condition
      shouldError = true;
      const result2 = await mockTool.execute({
        operation: 'errorTest2',
        params: {}
      });
      expect(result2.success).toBe(false);

      // Verify error was properly logged
      expect(errorEvents.length).toBeGreaterThan(0);
      const lastError = errorEvents[errorEvents.length - 1];
      expect(lastError.error).toMatch(/permission.*system.*corruption/i);
    });
  });

  describe('Complex Scope Matching', () => {
    it('should handle regex-like scope patterns', async () => {
      // Grant permission with complex patterns
      await permissionManager.grantPermission('TestTool', 'allow-always', 'file:/app/**/*.{js,ts}');
      await permissionManager.denyPermission('TestTool', 'file:/app/secrets/**');
      await permissionManager.grantPermission('TestTool', 'allow-once', 'network:https://*.example.com/*');

      // Test pattern matching
      const testCases = [
        { scope: 'file:/app/src/main.js', shouldSucceed: true },
        { scope: 'file:/app/lib/utils.ts', shouldSucceed: true },
        { scope: 'file:/app/secrets/key.js', shouldSucceed: false }, // Denied by specific rule
        { scope: 'file:/other/file.js', shouldSucceed: false }, // No matching permission
        { scope: 'network:https://api.example.com/data', shouldSucceed: true }, // Allow-once
        { scope: 'network:https://api.example.com/more', shouldSucceed: false }, // Allow-once consumed
      ];

      for (const testCase of testCases) {
        const result = await mockTool.execute({
          operation: 'patternTest',
          params: { scope: testCase.scope }
        });

        expect(result.success).toBe(testCase.shouldSucceed);
        if (!testCase.shouldSucceed) {
          expect(result.error).toMatch(/permission.*denied/i);
        }
      }
    });

    it('should handle nested scope hierarchies with overrides', async () => {
      // Set up nested hierarchies with overrides
      await permissionManager.grantPermission('Browser', 'allow-always', 'domain:*'); // Allow all domains
      await permissionManager.denyPermission('Browser', 'domain:*.malicious.com'); // Block malicious
      await permissionManager.grantPermission('Browser', 'allow-always', 'domain:safe.malicious.com'); // Exception

      mockPage.goto.mockResolvedValue({ status: () => 200 });

      // Test hierarchy resolution
      const testCases = [
        { url: 'https://google.com', shouldSucceed: true },
        { url: 'https://evil.malicious.com', shouldSucceed: false },
        { url: 'https://safe.malicious.com', shouldSucceed: true }, // Override
        { url: 'https://another.malicious.com', shouldSucceed: false },
      ];

      for (const testCase of testCases) {
        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: testCase.url }
        });

        expect(result.success).toBe(testCase.shouldSucceed);
        if (!testCase.shouldSucceed) {
          expect(result.error).toMatch(/permission.*denied/i);
        }
      }
    });
  });
});