/**
 * @fileoverview Permission Prompt Timeout Tests (GAP-006)
 *
 * High priority gap identified in permission audit documentation.
 * Tests permission prompt timeout scenarios in CLI environment.
 *
 * Gap Reference: docs/permission-audit-documentation.md - GAP-006
 * Priority: High (Security/Reliability Impact)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { ApexOrchestrator } from '@apex/orchestrator';

describe('Permission Prompt Timeout (GAP-006)', () => {
  let orchestrator: ApexOrchestrator;
  let testDir: string;
  let mockSetTimeout: vi.SpyInstance;
  let mockClearTimeout: vi.SpyInstance;

  beforeEach(async () => {
    // Create test directory
    testDir = join(tmpdir(), `apex-permission-timeout-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });

    // Create minimal .apex config
    const apexDir = join(testDir, '.apex');
    mkdirSync(apexDir, { recursive: true });

    const config = `
project:
  name: permission-timeout-test
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: review-all
  timeout:
    enabled: true
    defaultTimeoutMs: 5000
    retryAttempts: 3

agents:
  test-agent:
    role: "Test agent for timeout testing"
    model: sonnet
    tools: [Read, Write, Edit, Bash]
`;

    writeFileSync(join(apexDir, 'config.yaml'), config);

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();

    // Mock timeout functions for controlled testing
    mockSetTimeout = vi.spyOn(global, 'setTimeout');
    mockClearTimeout = vi.spyOn(global, 'clearTimeout');
  });

  afterEach(() => {
    // Cleanup
    if (orchestrator) {
      orchestrator.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }

    // Restore mocks
    mockSetTimeout.mockRestore();
    mockClearTimeout.mockRestore();
  });

  describe('Basic Timeout Functionality', () => {
    it('should timeout after configured duration', async () => {
      const timeoutMs = 5000;
      const timeoutListener = vi.fn();

      // Set timeout configuration
      process.env.APEX_PERMISSION_TIMEOUT = timeoutMs.toString();

      try {
        orchestrator.on('permission:timeout', timeoutListener);

        // Request permission but don't respond
        const permissionRequest = orchestrator.requestPermission({
          tool: 'Write',
          scope: '/sensitive/file.txt',
          operation: 'file-write'
        });

        // Advance timer past timeout
        vi.advanceTimersByTime(timeoutMs + 100);

        // Verify timeout was set
        expect(mockSetTimeout).toHaveBeenCalledWith(
          expect.any(Function),
          timeoutMs
        );

        // Wait for timeout to process
        await new Promise(resolve => setTimeout(resolve, 100));

        // Expect timeout event
        expect(timeoutListener).toHaveBeenCalledWith({
          tool: 'Write',
          scope: '/sensitive/file.txt',
          timeoutMs,
          timestamp: expect.any(Date)
        });
      } finally {
        delete process.env.APEX_PERMISSION_TIMEOUT;
      }
    });

    it('should emit timeout event when prompt expires', async () => {
      const timeoutListener = vi.fn();
      const timeoutMs = 3000;

      orchestrator.on('permission:timeout', timeoutListener);

      // Request dangerous operation that should require confirmation
      const request = orchestrator.requestPermission({
        tool: 'Bash',
        scope: 'rm -rf /',
        operation: 'dangerous-command'
      });

      // Advance time past default timeout
      vi.advanceTimersByTime(timeoutMs + 100);

      // Process timeout
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(timeoutListener).toHaveBeenCalledWith({
        tool: 'Bash',
        scope: 'rm -rf /',
        timeoutMs: expect.any(Number),
        timestamp: expect.any(Date)
      });
    });

    it('should clear timeout when permission is granted before expiry', async () => {
      const timeoutListener = vi.fn();

      orchestrator.on('permission:timeout', timeoutListener);

      // Request permission
      const requestPromise = orchestrator.requestPermission({
        tool: 'Read',
        scope: '/safe/file.txt'
      });

      // Grant permission before timeout
      setTimeout(async () => {
        await orchestrator.grantPermissionConfirmation(
          'mock-permission-id',
          'allow-once'
        );
      }, 1000);

      // Advance time past timeout
      vi.advanceTimersByTime(6000);

      // Timeout should not have fired
      expect(timeoutListener).not.toHaveBeenCalled();
      expect(mockClearTimeout).toHaveBeenCalled();
    });
  });

  describe('Task State Preservation During Timeout', () => {
    it('should preserve task state during timeout', async () => {
      const taskManager = orchestrator.getTaskManager();

      // Create task
      const task = await taskManager.createTask({
        type: 'feature',
        description: 'test feature requiring permissions',
        agentId: 'test-agent'
      });

      // Start task execution
      const executionPromise = orchestrator.executeTask(task.id);

      // Simulate permission timeout during task execution
      const permissionRequest = orchestrator.requestPermission({
        tool: 'Write',
        scope: '/test/file.txt',
        operation: 'file-write',
        taskId: task.id
      });

      // Advance time to trigger timeout
      vi.advanceTimersByTime(6000);

      // Wait for timeout processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Task should remain in consistent state
      const updatedTask = await taskManager.getTask(task.id);
      expect(updatedTask.status).toBe('waiting-for-permission');
      expect(updatedTask.metadata?.lastPermissionRequest).toBeDefined();
      expect(updatedTask.metadata?.permissionTimeouts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tool: 'Write',
            scope: '/test/file.txt',
            timestamp: expect.any(Date)
          })
        ])
      );
    });

    it('should allow task resumption after timeout resolution', async () => {
      const taskManager = orchestrator.getTaskManager();

      const task = await taskManager.createTask({
        type: 'feature',
        description: 'test feature with timeout recovery',
        agentId: 'test-agent'
      });

      // Simulate timeout
      const permissionRequest = orchestrator.requestPermission({
        tool: 'Edit',
        scope: '/test/config.yaml',
        taskId: task.id
      });

      // Trigger timeout
      vi.advanceTimersByTime(6000);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Manually resolve permission after timeout
      await orchestrator.grantPermission('Edit', '/test/config.yaml', 'allow-always');

      // Task should be resumable
      const updatedTask = await taskManager.getTask(task.id);
      expect(updatedTask.status).toBe('pending'); // Should transition back to pending
    });
  });

  describe('Retry Behavior After Timeout', () => {
    it('should support retry after timeout', async () => {
      const retryListener = vi.fn();
      const timeoutListener = vi.fn();

      orchestrator.on('permission:retry', retryListener);
      orchestrator.on('permission:timeout', timeoutListener);

      // Request with retry configuration
      const request = orchestrator.requestPermission({
        tool: 'Bash',
        scope: 'dangerous-operation',
        options: {
          allowRetry: true,
          maxRetries: 3
        }
      });

      // First timeout
      vi.advanceTimersByTime(6000);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(timeoutListener).toHaveBeenCalledTimes(1);
      expect(retryListener).toHaveBeenCalledWith({
        tool: 'Bash',
        scope: 'dangerous-operation',
        attempt: 1,
        maxRetries: 3
      });

      // Second timeout (retry)
      vi.advanceTimersByTime(6000);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(timeoutListener).toHaveBeenCalledTimes(2);
      expect(retryListener).toHaveBeenCalledTimes(2);
    });

    it('should limit number of retries', async () => {
      const maxRetries = 2;
      const finalFailureListener = vi.fn();

      orchestrator.on('permission:final-failure', finalFailureListener);

      const request = orchestrator.requestPermission({
        tool: 'Write',
        scope: '/restricted/file.txt',
        options: {
          allowRetry: true,
          maxRetries
        }
      });

      // Trigger max retries + 1 timeouts
      for (let i = 0; i <= maxRetries; i++) {
        vi.advanceTimersByTime(6000);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      expect(finalFailureListener).toHaveBeenCalledWith({
        tool: 'Write',
        scope: '/restricted/file.txt',
        reason: 'max-retries-exceeded',
        attempts: maxRetries + 1
      });
    });
  });

  describe('Timeout Notification to User', () => {
    it('should provide clear timeout notification to user', async () => {
      const notificationListener = vi.fn();

      orchestrator.on('permission:notification', notificationListener);

      const request = orchestrator.requestPermission({
        tool: 'Edit',
        scope: '/important/config.json'
      });

      // Trigger timeout
      vi.advanceTimersByTime(6000);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(notificationListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'timeout',
          message: expect.stringContaining('Permission request timed out'),
          tool: 'Edit',
          scope: '/important/config.json',
          actions: expect.arrayContaining([
            expect.objectContaining({ label: 'Retry' }),
            expect.objectContaining({ label: 'Grant Always' }),
            expect.objectContaining({ label: 'Deny' })
          ])
        })
      );
    });

    it('should include helpful context in timeout notifications', async () => {
      const notificationListener = vi.fn();

      orchestrator.on('permission:notification', notificationListener);

      // Request with additional context
      const request = orchestrator.requestPermission({
        tool: 'Bash',
        scope: 'potentially dangerous command',
        context: {
          command: 'rm -rf /tmp/cache',
          reason: 'Cleanup old cache files',
          safety: 'low-risk'
        }
      });

      vi.advanceTimersByTime(6000);
      await new Promise(resolve => setTimeout(resolve, 100));

      const notification = notificationListener.mock.calls[0][0];
      expect(notification.context).toEqual(
        expect.objectContaining({
          command: 'rm -rf /tmp/cache',
          reason: 'Cleanup old cache files',
          safety: 'low-risk'
        })
      );
    });
  });

  describe('Integration with Permission Presets', () => {
    it('should respect preset timeout configurations', async () => {
      // Apply autonomous preset (should have shorter timeout)
      await orchestrator.setPreset('autonomous');

      const timeoutListener = vi.fn();
      orchestrator.on('permission:timeout', timeoutListener);

      const request = orchestrator.requestPermission({
        tool: 'Read',
        scope: '/data/file.txt'
      });

      // Autonomous preset should have different timeout behavior
      vi.advanceTimersByTime(2000); // Shorter timeout for autonomous
      await new Promise(resolve => setTimeout(resolve, 100));

      // In autonomous mode, should auto-grant rather than timeout for safe operations
      expect(timeoutListener).not.toHaveBeenCalled();
    });

    it('should handle timeout differently for read-only preset', async () => {
      await orchestrator.setPreset('read-only');

      const denialListener = vi.fn();
      orchestrator.on('permission:denied', denialListener);

      // Request write permission in read-only mode
      const request = orchestrator.requestPermission({
        tool: 'Write',
        scope: '/data/file.txt'
      });

      // Should be denied immediately, not timeout
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(denialListener).toHaveBeenCalledWith(
        expect.objectContaining({
          tool: 'Write',
          scope: '/data/file.txt',
          reason: 'read-only-preset'
        })
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid timeout configuration gracefully', async () => {
      // Set invalid timeout
      process.env.APEX_PERMISSION_TIMEOUT = 'invalid';

      try {
        const timeoutListener = vi.fn();
        orchestrator.on('permission:timeout', timeoutListener);

        const request = orchestrator.requestPermission({
          tool: 'Write',
          scope: '/test.txt'
        });

        // Should use default timeout when config is invalid
        vi.advanceTimersByTime(30000); // Default timeout
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(timeoutListener).toHaveBeenCalledWith(
          expect.objectContaining({
            timeoutMs: 30000 // Default value
          })
        );
      } finally {
        delete process.env.APEX_PERMISSION_TIMEOUT;
      }
    });

    it('should handle concurrent timeouts correctly', async () => {
      const timeoutListener = vi.fn();
      orchestrator.on('permission:timeout', timeoutListener);

      // Create multiple concurrent permission requests
      const requests = [
        orchestrator.requestPermission({ tool: 'Write', scope: '/file1.txt' }),
        orchestrator.requestPermission({ tool: 'Edit', scope: '/file2.txt' }),
        orchestrator.requestPermission({ tool: 'Bash', scope: 'command1' })
      ];

      // Trigger timeouts for all
      vi.advanceTimersByTime(6000);
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(timeoutListener).toHaveBeenCalledTimes(3);
      expect(timeoutListener).toHaveBeenNthCalledWith(1, expect.objectContaining({ tool: 'Write' }));
      expect(timeoutListener).toHaveBeenNthCalledWith(2, expect.objectContaining({ tool: 'Edit' }));
      expect(timeoutListener).toHaveBeenNthCalledWith(3, expect.objectContaining({ tool: 'Bash' }));
    });
  });
});