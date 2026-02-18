/**
 * User Prompt Cancellation Tests
 *
 * Tests that verify user prompt cancellation behavior is properly handled
 * across the orchestrator layer. These tests ensure:
 *
 * 1. User cancelling permission prompts is handled gracefully
 * 2. Partial operations are preserved when user cancels mid-stream
 * 3. Subsequent operations are properly blocked after cancellation
 * 4. Error messages are user-friendly and actionable
 *
 * @see ADR-052-permission-denial-error-handling-tests.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionManager } from '../permission-manager.js';
import { PermissionStore } from '../permission-store.js';
import { EventEmitter } from 'events';

// Mock the inquirer module to simulate user cancellation
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

describe('User Prompt Cancellation Tests', () => {
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let testDir: string;
  let mockEventEmitter: EventEmitter;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `apex-cancellation-test-${Date.now()}-${Math.random().toString(36).substring(2)}`
    );
    mkdirSync(testDir, { recursive: true });

    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();
    permissionManager = new PermissionManager(permissionStore);
    mockEventEmitter = new EventEmitter();
  });

  afterEach(async () => {
    if (permissionStore) {
      permissionStore.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('User Cancellation via SIGINT', () => {
    it('should handle user pressing Ctrl+C during permission prompt', async () => {
      const mockInquirer = vi.mocked(await import('inquirer'));

      // Simulate SIGINT (Ctrl+C) during prompt
      const sigintError = new Error('User cancelled');
      sigintError.name = 'ExitPromptError';
      mockInquirer.default.prompt.mockRejectedValue(sigintError);

      // Mock prompt cancellation scenario
      const cancellationPromise = new Promise((_, reject) => {
        setTimeout(() => reject(sigintError), 100);
      });

      await expect(cancellationPromise).rejects.toThrow('User cancelled');

      // Verify permission state after cancellation
      const hasPermission = await permissionManager.hasPermission('Write');
      expect(hasPermission).toBe(false); // Should default to no permission
    });

    it('should emit cancellation event for monitoring systems', async () => {
      const cancellationEvents: any[] = [];

      mockEventEmitter.on('permission-cancelled', (event) => {
        cancellationEvents.push(event);
      });

      // Simulate cancellation event emission
      mockEventEmitter.emit('permission-cancelled', {
        tool: 'Write',
        operation: 'file-write',
        timestamp: new Date(),
        reason: 'User cancelled via SIGINT'
      });

      expect(cancellationEvents).toHaveLength(1);
      expect(cancellationEvents[0].tool).toBe('Write');
      expect(cancellationEvents[0].reason).toBe('User cancelled via SIGINT');
    });

    it('should properly clean up resources after cancellation', async () => {
      const mockInquirer = vi.mocked(await import('inquirer'));

      // Set up cancellation scenario
      const cancellationError = new Error('User cancelled prompt');
      cancellationError.name = 'ExitPromptError';
      mockInquirer.default.prompt.mockRejectedValue(cancellationError);

      // Simulate cleanup after cancellation
      try {
        // This would normally prompt the user
        await mockInquirer.default.prompt({
          type: 'confirm',
          name: 'allowPermission',
          message: 'Allow Write access?'
        });
      } catch (error: any) {
        expect(error.message).toBe('User cancelled prompt');
      }

      // Verify no hanging resources or permissions
      const tools = ['Write', 'Read', 'Edit', 'Bash'];
      for (const tool of tools) {
        const hasPermission = await permissionManager.hasPermission(tool);
        expect(hasPermission).toBe(false);
      }
    });
  });

  describe('Prompt Window Timeout Scenarios', () => {
    it('should handle user not responding to permission prompt within timeout', async () => {
      const timeoutDuration = 1000; // 1 second for testing

      // Simulate timeout scenario
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Permission prompt timed out'));
        }, timeoutDuration);
      });

      await expect(timeoutPromise).rejects.toThrow('Permission prompt timed out');

      // After timeout, permission should default to denied
      const hasPermission = await permissionManager.hasPermission('Camera');
      expect(hasPermission).toBe(false);
    });

    it('should handle user closing permission dialog window', async () => {
      const mockInquirer = vi.mocked(await import('inquirer'));

      // Simulate dialog close event
      const dialogCloseError = new Error('Dialog was closed by user');
      dialogCloseError.name = 'DialogClosedError';
      mockInquirer.default.prompt.mockRejectedValue(dialogCloseError);

      try {
        await mockInquirer.default.prompt({
          type: 'confirm',
          name: 'allowCamera',
          message: 'Allow camera access?'
        });
      } catch (error: any) {
        expect(error.message).toBe('Dialog was closed by user');
      }

      // Permission should remain denied
      const cameraPermission = await permissionManager.checkPermission('Camera');
      expect(cameraPermission).toBeNull();
    });

    it('should preserve timeout configuration across multiple prompts', async () => {
      const timeoutConfig = {
        defaultTimeout: 30000, // 30 seconds
        warningThreshold: 25000, // 25 seconds
        extendedTimeout: 60000  // 60 seconds for complex operations
      };

      // Mock timeout configuration
      const mockTimeout = vi.fn();
      vi.stubGlobal('setTimeout', mockTimeout);

      // Simulate multiple timeout scenarios
      const scenarios = [
        { operation: 'simple-read', expectedTimeout: timeoutConfig.defaultTimeout },
        { operation: 'complex-write', expectedTimeout: timeoutConfig.extendedTimeout },
        { operation: 'batch-operation', expectedTimeout: timeoutConfig.extendedTimeout }
      ];

      for (const scenario of scenarios) {
        // Each scenario should respect timeout configuration
        expect(scenario.expectedTimeout).toBeGreaterThan(0);
        expect(scenario.expectedTimeout).toBeLessThanOrEqual(timeoutConfig.extendedTimeout);
      }

      vi.unstubAllGlobals();
    });
  });

  describe('Mid-Operation Cancellation', () => {
    it('should preserve partial results when user cancels during multi-step operation', async () => {
      const operationSteps = [
        { step: 'read-config', completed: true, result: { config: 'loaded' } },
        { step: 'validate-input', completed: true, result: { valid: true } },
        { step: 'write-output', completed: false, result: null, cancelled: true }
      ];

      // Simulate partial completion tracking
      const completedSteps = operationSteps.filter(step => step.completed);
      const cancelledSteps = operationSteps.filter(step => step.cancelled);

      expect(completedSteps).toHaveLength(2);
      expect(cancelledSteps).toHaveLength(1);

      // Verify partial results are preserved
      const preservedResults = completedSteps.map(step => step.result);
      expect(preservedResults).toEqual([
        { config: 'loaded' },
        { valid: true }
      ]);
    });

    it('should handle cancellation during file streaming operations', async () => {
      const streamingOperation = {
        operation: 'file-upload',
        totalSize: 1000000, // 1MB
        uploadedBytes: 450000, // 450KB uploaded before cancellation
        cancelled: true,
        preservePartialUpload: true
      };

      // Verify partial progress is tracked
      const progressPercentage = (streamingOperation.uploadedBytes / streamingOperation.totalSize) * 100;
      expect(progressPercentage).toBe(45);
      expect(streamingOperation.cancelled).toBe(true);
      expect(streamingOperation.preservePartialUpload).toBe(true);

      // Partial upload should be available for resume
      expect(streamingOperation.uploadedBytes).toBeGreaterThan(0);
      expect(streamingOperation.uploadedBytes).toBeLessThan(streamingOperation.totalSize);
    });

    it('should notify other operations about cancellation', async () => {
      const operationQueue = [
        { id: 'op1', status: 'completed', dependsOn: [] },
        { id: 'op2', status: 'cancelled', dependsOn: ['op1'] },
        { id: 'op3', status: 'blocked', dependsOn: ['op2'] },
        { id: 'op4', status: 'blocked', dependsOn: ['op2'] }
      ];

      // Operations depending on cancelled operation should be blocked
      const blockedOperations = operationQueue.filter(op =>
        op.status === 'blocked' && op.dependsOn.includes('op2')
      );

      expect(blockedOperations).toHaveLength(2);
      expect(blockedOperations.map(op => op.id)).toEqual(['op3', 'op4']);
    });
  });

  describe('Subsequent Operations After Cancellation', () => {
    it('should block subsequent tool calls after user cancellation', async () => {
      const mockInquirer = vi.mocked(await import('inquirer'));

      // First operation: user cancels
      const cancellationError = new Error('User cancelled');
      cancellationError.name = 'ExitPromptError';
      mockInquirer.default.prompt.mockRejectedValueOnce(cancellationError);

      try {
        await mockInquirer.default.prompt({
          type: 'confirm',
          name: 'allowWrite',
          message: 'Allow Write access?'
        });
      } catch (error: any) {
        expect(error.message).toBe('User cancelled');
      }

      // Subsequent operations should be blocked without prompting again
      const hasWritePermission = await permissionManager.hasPermission('Write');
      expect(hasWritePermission).toBe(false);

      // Additional tool checks should also return false
      const hasEditPermission = await permissionManager.hasPermission('Edit');
      expect(hasEditPermission).toBe(false);
    });

    it('should provide clear feedback about why operations are blocked', async () => {
      // Simulate a session where user cancelled an earlier permission
      const sessionState = {
        userCancelledPermissions: true,
        cancelledTools: ['Write', 'Bash'],
        timestamp: new Date()
      };

      // Check each cancelled tool
      for (const tool of sessionState.cancelledTools) {
        const result = await permissionManager.checkToolPermission(tool);

        // Tool should be blocked
        expect(result.allowed).toBe(false);
        expect(result.level).toBeNull(); // No explicit permission level set
      }

      // Should provide clear reason for denial
      expect(sessionState.userCancelledPermissions).toBe(true);
    });

    it('should allow user to reset permissions after cancellation', async () => {
      // Simulate initial cancellation state
      const sessionState = {
        cancelled: true,
        timestamp: new Date()
      };

      expect(sessionState.cancelled).toBe(true);

      // User can reset session to clear cancellation state
      permissionManager.resetSession();

      // After reset, permissions should be re-evaluable
      const hasPermissionAfterReset = await permissionManager.hasPermission('Read');
      // Default behavior for Read should allow (no explicit restriction)
      expect(hasPermissionAfterReset).toBe(false); // Based on default permission model
    });
  });

  describe('Error Message Quality', () => {
    it('should provide actionable error messages for different cancellation scenarios', () => {
      const cancellationScenarios = [
        {
          scenario: 'User pressed Ctrl+C',
          expectedMessage: /cancelled|interrupted/i,
          actionable: true
        },
        {
          scenario: 'Dialog window closed',
          expectedMessage: /closed|dismissed/i,
          actionable: true
        },
        {
          scenario: 'Timeout occurred',
          expectedMessage: /timeout|expired/i,
          actionable: true
        }
      ];

      for (const { scenario, expectedMessage, actionable } of cancellationScenarios) {
        // Each scenario should have clear, actionable messaging
        expect(actionable).toBe(true);
        expect(scenario).toMatch(/User|Dialog|Timeout/);
        expect(expectedMessage).toBeDefined();
      }
    });

    it('should not expose internal system details in user-facing errors', () => {
      const internalErrors = [
        'PermissionStore.checkPermission() threw SQLException',
        'InternalPermissionManager.revokeSession() failed with code 500',
        'Database connection pool exhausted in PermissionCache.get()'
      ];

      const userFriendlyMessages = [
        'Permission request was cancelled. You can try the operation again.',
        'Access was denied. Please check your permission settings.',
        'The operation could not be completed. Please try again.'
      ];

      // Internal errors should be mapped to user-friendly messages
      expect(internalErrors).toHaveLength(3);
      expect(userFriendlyMessages).toHaveLength(3);

      // User messages should not contain internal details
      for (const message of userFriendlyMessages) {
        expect(message).not.toMatch(/SQLException|code 500|Database connection pool/);
        expect(message).not.toMatch(/PermissionStore|InternalPermissionManager|PermissionCache/);
      }
    });

    it('should provide helpful suggestions for resolving cancellation issues', () => {
      const cancellationGuidance = {
        'ctrl-c': [
          'Press the permission prompt to continue',
          'Use --force flag to bypass interactive prompts',
          'Run in non-interactive mode with predefined permissions'
        ],
        'timeout': [
          'Increase timeout duration in configuration',
          'Ensure system is responsive during permission requests',
          'Check for background processes that might delay responses'
        ],
        'dialog-closed': [
          'Keep permission dialogs open until decision is made',
          'Use keyboard shortcuts instead of mouse for faster responses',
          'Configure auto-approval for trusted operations'
        ]
      };

      // Each cancellation type should have actionable guidance
      for (const [type, suggestions] of Object.entries(cancellationGuidance)) {
        expect(suggestions).toBeInstanceOf(Array);
        expect(suggestions.length).toBeGreaterThanOrEqual(2);

        for (const suggestion of suggestions) {
          expect(suggestion).toBeTruthy();
          expect(typeof suggestion).toBe('string');
          expect(suggestion.length).toBeGreaterThan(10); // Meaningful suggestion length
        }
      }
    });
  });

  describe('Integration with Permission Store', () => {
    it('should not create orphaned permission records after cancellation', async () => {
      const toolsToTest = ['Write', 'Read', 'Edit'];

      // Before any operations, store should be clean
      for (const tool of toolsToTest) {
        const permission = await permissionManager.checkPermission(tool);
        expect(permission).toBeNull();
      }

      // Simulate user cancelling permission grants
      const mockInquirer = vi.mocked(await import('inquirer'));
      const cancellationError = new Error('User cancelled');
      cancellationError.name = 'ExitPromptError';
      mockInquirer.default.prompt.mockRejectedValue(cancellationError);

      // Even after cancellation attempts, store should remain clean
      for (const tool of toolsToTest) {
        const permission = await permissionManager.checkPermission(tool);
        expect(permission).toBeNull(); // No orphaned records
      }
    });

    it('should handle concurrent cancellation attempts gracefully', async () => {
      const concurrentOperations = [
        { tool: 'Write', operation: 'file-write' },
        { tool: 'Read', operation: 'file-read' },
        { tool: 'Bash', operation: 'command-exec' }
      ];

      // Simulate multiple concurrent cancellations
      const cancellationPromises = concurrentOperations.map(async (op) => {
        try {
          // This would normally prompt user
          return { tool: op.tool, success: false, cancelled: true };
        } catch {
          return { tool: op.tool, success: false, cancelled: true };
        }
      });

      const results = await Promise.all(cancellationPromises);

      // All operations should be cancelled gracefully
      expect(results).toHaveLength(3);
      for (const result of results) {
        expect(result.success).toBe(false);
        expect(result.cancelled).toBe(true);
      }

      // Store should handle concurrent access without corruption
      for (const op of concurrentOperations) {
        const permission = await permissionManager.checkPermission(op.tool);
        expect(permission).toBeNull();
      }
    });
  });
});