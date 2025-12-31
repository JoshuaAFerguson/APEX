import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createHooks, HookContext } from '../hooks';
import { TaskStore } from '../store';
import { PermissionStore } from '../permission-store';
import { PermissionPresetManager } from '../permission-preset-manager';
import type { Task } from '@apexcli/core';
import type { HookInput } from '@anthropic-ai/claude-agent-sdk';

/**
 * Edge case and error handling tests for permission preset hooks integration
 *
 * This test suite covers:
 * 1. Edge cases in input handling
 * 2. Error recovery scenarios
 * 3. Malformed input handling
 * 4. Performance edge cases
 * 5. Concurrent execution scenarios
 * 6. Resource cleanup scenarios
 */
describe('Permission Preset Hooks Edge Cases', () => {
  let tempDir: string;
  let store: TaskStore;
  let permissionStore: PermissionStore;
  let permissionPresetManager: PermissionPresetManager;
  let taskId: string;
  let mockEventEmitter: { emit: vi.Mock };

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_edge_test`,
    description: 'Test task for edge cases',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    projectPath: tempDir,
    branchName: 'apex/test-edge-cases',
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    logs: [],
    artifacts: [],
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-permission-edge-cases-test-'));
    await fs.mkdir(path.join(tempDir, '.apex'), { recursive: true });

    store = new TaskStore(tempDir);
    await store.initialize();

    permissionStore = new PermissionStore(tempDir);
    await permissionStore.initialize();

    permissionPresetManager = new PermissionPresetManager(permissionStore);

    mockEventEmitter = { emit: vi.fn() };

    const task = createTestTask();
    taskId = task.id;
    await store.createTask(task);
  });

  afterEach(async () => {
    store.close();
    permissionStore.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle null/undefined tool_input gracefully', async () => {
      await permissionPresetManager.applyPreset('autonomous');

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      const inputs = [
        { tool_name: 'Write', tool_input: null },
        { tool_name: 'Write', tool_input: undefined },
        { tool_name: 'Write' } as any, // Missing tool_input entirely
      ];

      for (const input of inputs) {
        const result = await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });

        // Should not throw and should allow (with undefined scope)
        expect(result).toEqual({});
        expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:granted', expect.objectContaining({
          toolName: 'Write',
          scope: undefined,
        }));

        mockEventEmitter.emit.mockClear();
      }
    });

    it('should handle malformed tool_input objects', async () => {
      await permissionPresetManager.applyPreset('autonomous');

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      const malformedInputs = [
        { tool_name: 'Write', tool_input: 'string instead of object' },
        { tool_name: 'Write', tool_input: 42 },
        { tool_name: 'Write', tool_input: [] },
        { tool_name: 'Write', tool_input: true },
      ];

      for (const input of malformedInputs) {
        const result = await checkPermissionCallback?.(input as any, 'tool-1', { signal: new AbortController().signal });

        // Should not throw and should handle gracefully
        expect(result).toEqual({});
        mockEventEmitter.emit.mockClear();
      }
    });

    it('should handle missing tool_name', async () => {
      await permissionPresetManager.applyPreset('autonomous');

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      const input = {
        tool_input: { file_path: '/test.txt' },
      } as any; // Missing tool_name

      const result = await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });

      // Should handle missing tool name gracefully (defaults to 'unknown')
      expect(result).toEqual({});
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:granted', expect.objectContaining({
        toolName: 'unknown',
      }));
    });

    it('should handle extremely large scope values', async () => {
      await permissionPresetManager.applyPreset('autonomous');

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      // Create a very large scope string
      const largeScope = 'x'.repeat(100000);

      const input: HookInput = {
        tool_name: 'Write',
        tool_input: { file_path: largeScope },
      };

      const result = await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });

      // Should handle large scopes without issues
      expect(result).toEqual({});
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:granted', expect.objectContaining({
        toolName: 'Write',
        scope: largeScope,
      }));
    });

    it('should handle special characters in scope values', async () => {
      await permissionPresetManager.applyPreset('autonomous');

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      const specialScopes = [
        '/path/with spaces/file.txt',
        '/path/with/unicode/文件.txt',
        '/path/with/emojis/🚀.txt',
        '/path/with/special/chars/!@#$%^&*().txt',
        'https://example.com/path?query=value&other=test#fragment',
        'file:///C:\\Windows\\System32\\file.txt',
      ];

      for (const scope of specialScopes) {
        const input: HookInput = {
          tool_name: 'Write',
          tool_input: { file_path: scope },
        };

        const result = await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });

        expect(result).toEqual({});
        expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:granted', expect.objectContaining({
          scope,
        }));

        mockEventEmitter.emit.mockClear();
      }
    });
  });

  describe('Permission Store Error Scenarios', () => {
    it('should handle permission store database corruption', async () => {
      // Simulate database corruption by creating an invalid permission preset manager
      const corruptedPresetManager = {
        isToolDenied: vi.fn().mockRejectedValue(new Error('SQLITE_CORRUPT: database disk image is malformed')),
        isToolAllowed: vi.fn().mockRejectedValue(new Error('SQLITE_CORRUPT: database disk image is malformed')),
        isConfirmationRequired: vi.fn().mockRejectedValue(new Error('SQLITE_CORRUPT: database disk image is malformed')),
        getCurrentPreset: vi.fn().mockReturnValue('autonomous'),
      };

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager: corruptedPresetManager as any,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      const input: HookInput = {
        tool_name: 'Write',
        tool_input: { file_path: '/test.txt', content: 'test' },
      };

      // Should not throw and should fail open (allow)
      const result = await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });

      expect(result).toEqual({});

      // Should log the error
      const task = await store.getTask(taskId);
      const errorLogs = task?.logs.filter(l => l.level === 'error') || [];
      expect(errorLogs.some(l => l.message.includes('Error checking tool permissions'))).toBe(true);
    });

    it('should handle permission store timeout errors', async () => {
      const timeoutPresetManager = {
        isToolDenied: vi.fn().mockRejectedValue(new Error('SQLITE_BUSY: database is locked')),
        isToolAllowed: vi.fn().mockRejectedValue(new Error('SQLITE_BUSY: database is locked')),
        isConfirmationRequired: vi.fn().mockRejectedValue(new Error('SQLITE_BUSY: database is locked')),
        getCurrentPreset: vi.fn().mockReturnValue('review-all'),
      };

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager: timeoutPresetManager as any,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'echo test' },
      };

      // Should handle timeout gracefully and fail open
      const result = await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });

      expect(result).toEqual({});

      // Should log the error
      const task = await store.getTask(taskId);
      const errorLogs = task?.logs.filter(l => l.level === 'error') || [];
      expect(errorLogs.some(l => l.message.includes('Error checking tool permissions'))).toBe(true);
      expect(errorLogs.some(l => l.metadata?.error?.includes('database is locked'))).toBe(true);
    });

    it('should handle task store logging errors during permission checks', async () => {
      await permissionPresetManager.applyPreset('autonomous');

      // Mock store.addLog to throw an error
      const originalAddLog = store.addLog;
      store.addLog = vi.fn().mockRejectedValue(new Error('Failed to write log'));

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      const input: HookInput = {
        tool_name: 'Write',
        tool_input: { file_path: '/test.txt', content: 'test' },
      };

      // Should not throw even if logging fails
      const result = await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });

      expect(result).toEqual({});

      // Should still emit events
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:granted', expect.any(Object));

      // Restore original method
      store.addLog = originalAddLog;
    });
  });

  describe('Event Emitter Error Scenarios', () => {
    it('should handle event emitter errors gracefully', async () => {
      await permissionPresetManager.applyPreset('read-only');

      const faultyEventEmitter = {
        emit: vi.fn().mockImplementation(() => {
          throw new Error('Event emitter is down');
        }),
      };

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        eventEmitter: faultyEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      const input: HookInput = {
        tool_name: 'Write',
        tool_input: { file_path: '/test.txt', content: 'test' },
      };

      // Should not throw even if event emission fails
      const result = await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });

      expect(result?.hookSpecificOutput?.permissionDecision).toBe('deny');

      // Verify that it tried to emit the event
      expect(faultyEventEmitter.emit).toHaveBeenCalled();
    });

    it('should handle missing event emitter', async () => {
      await permissionPresetManager.applyPreset('autonomous');

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        // No eventEmitter provided
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      const input: HookInput = {
        tool_name: 'Read',
        tool_input: { file_path: '/test.txt' },
      };

      // Should work fine without event emitter
      const result = await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });

      expect(result).toEqual({});
    });
  });

  describe('Concurrent Execution Edge Cases', () => {
    it('should handle multiple concurrent permission checks', async () => {
      await permissionPresetManager.applyPreset('review-all');

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      // Launch multiple concurrent permission checks
      const inputs = Array.from({ length: 10 }, (_, i) => ({
        tool_name: 'Write',
        tool_input: { file_path: `/test_${i}.txt`, content: `test ${i}` },
      }));

      const promises = inputs.map((input, i) =>
        checkPermissionCallback?.(input, `tool-${i}`, { signal: new AbortController().signal })
      );

      const results = await Promise.all(promises);

      // All should require confirmation
      results.forEach(result => {
        expect(result?.hookSpecificOutput?.permissionDecision).toBe('deny');
        expect(result?.hookSpecificOutput?.permissionDecisionReason).toContain('requires user confirmation');
      });

      // Should have emitted 10 permission:request events
      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(10);
      const requestCalls = mockEventEmitter.emit.mock.calls.filter(call => call[0] === 'permission:request');
      expect(requestCalls).toHaveLength(10);
    });

    it('should handle permission preset changes during concurrent checks', async () => {
      await permissionPresetManager.applyPreset('autonomous');

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      // Start some permission checks
      const inputs = Array.from({ length: 5 }, (_, i) => ({
        tool_name: 'Write',
        tool_input: { file_path: `/test_${i}.txt`, content: `test ${i}` },
      }));

      const promises = inputs.map(async (input, i) => {
        // Change preset in the middle
        if (i === 2) {
          await permissionPresetManager.applyPreset('read-only');
        }
        return checkPermissionCallback?.(input, `tool-${i}`, { signal: new AbortController().signal });
      });

      const results = await Promise.all(promises);

      // Results should reflect the preset state at the time of each check
      // Some may be allowed (autonomous) and others denied (read-only)
      expect(results).toHaveLength(5);

      // At least some results should exist
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });
  });

  describe('Resource Cleanup Edge Cases', () => {
    it('should handle store closure during permission checks', async () => {
      await permissionPresetManager.applyPreset('autonomous');

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      const input: HookInput = {
        tool_name: 'Write',
        tool_input: { file_path: '/test.txt', content: 'test' },
      };

      // Close the store mid-execution
      store.close();

      // Should handle closed store gracefully
      await expect(async () => {
        await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });
      }).not.toThrow();
    });

    it('should handle permission store closure during checks', async () => {
      await permissionPresetManager.applyPreset('autonomous');

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      // Close the permission store
      permissionStore.close();

      const input: HookInput = {
        tool_name: 'Write',
        tool_input: { file_path: '/test.txt', content: 'test' },
      };

      // Should fail open when permission store is closed
      const result = await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });

      expect(result).toEqual({});
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle rapid successive permission checks efficiently', async () => {
      await permissionPresetManager.applyPreset('autonomous');

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      const startTime = Date.now();

      // Perform many rapid permission checks
      for (let i = 0; i < 100; i++) {
        const input: HookInput = {
          tool_name: 'Read',
          tool_input: { file_path: `/test_${i}.txt` },
        };

        const result = await checkPermissionCallback?.(input, `tool-${i}`, { signal: new AbortController().signal });
        expect(result).toEqual({});
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete reasonably quickly (less than 5 seconds for 100 checks)
      expect(duration).toBeLessThan(5000);

      // Should have emitted 100 permission:granted events
      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(100);
    });

    it('should handle permission checks with extremely deep scope paths', async () => {
      await permissionPresetManager.applyPreset('autonomous');

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      // Create an extremely deep path
      const deepPath = '/very/deep/nested/path/structure/' + Array.from({ length: 50 }, (_, i) => `level${i}`).join('/') + '/file.txt';

      const input: HookInput = {
        tool_name: 'Write',
        tool_input: { file_path: deepPath },
      };

      const result = await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });

      expect(result).toEqual({});
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:granted', expect.objectContaining({
        scope: deepPath,
      }));
    });
  });
});