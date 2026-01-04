import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HookManager } from '../hook-manager';
import { TaskStore } from '../store';
import {
  ToolHookConfig,
  PostHookContext,
  PostHookResult,
  BehaviorEventData,
} from '@apexcli/core';
import * as fs from 'fs';

// Mock dependencies
vi.mock('child_process');
vi.mock('fs');
vi.mock('util');

const mockFs = vi.mocked(fs);

describe('HookManager - Redaction Edge Cases', () => {
  let hookManager: HookManager;
  let mockStore: ReturnType<typeof vi.mocked<TaskStore>>;
  let projectPath: string;
  let behaviorEvents: BehaviorEventData[];

  beforeEach(() => {
    vi.clearAllMocks();
    behaviorEvents = [];

    mockStore = {
      addLog: vi.fn(),
    } as unknown as ReturnType<typeof vi.mocked<TaskStore>>;

    projectPath = '/test/project';

    hookManager = new HookManager(projectPath, mockStore, [], {
      pre: [],
      post: [{
        name: 'redaction-hook',
        handlerPath: './hooks/redaction.js',
        enabled: true,
        tools: [],
        priority: 100,
        timeoutMs: 5000,
      }],
      enabled: true,
      defaultTimeoutMs: 30000,
    });

    hookManager.on('hook:behavior:triggered', (event: BehaviorEventData) => {
      behaviorEvents.push(event);
    });

    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockImplementation(() => '');
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.unlinkSync.mockImplementation(() => {});
  });

  describe('Redaction Input Types', () => {
    it('should handle null and undefined inputs', () => {
      const hookManagerPrivate = hookManager as any;

      expect(hookManagerPrivate.redactSensitiveContent(null)).toBeNull();
      expect(hookManagerPrivate.redactSensitiveContent(undefined)).toBeUndefined();
    });

    it('should handle primitive types', () => {
      const hookManagerPrivate = hookManager as any;

      expect(hookManagerPrivate.redactSensitiveContent(42)).toBe(42);
      expect(hookManagerPrivate.redactSensitiveContent(true)).toBe(true);
      expect(hookManagerPrivate.redactSensitiveContent(false)).toBe(false);
      expect(hookManagerPrivate.redactSensitiveContent(0)).toBe(0);
    });

    it('should handle empty arrays and objects', () => {
      const hookManagerPrivate = hookManager as any;

      expect(hookManagerPrivate.redactSensitiveContent([])).toEqual([]);
      expect(hookManagerPrivate.redactSensitiveContent({})).toEqual({});
    });

    it('should handle arrays with mixed types', () => {
      const hookManagerPrivate = hookManager as any;

      const input = [1, 'text', true, null, undefined, { key: 'value' }];
      const result = hookManagerPrivate.redactSensitiveContent(input);

      expect(result).toEqual([1, 'text', true, null, undefined, { key: 'value' }]);
    });
  });

  describe('Object Structure Preservation', () => {
    it('should preserve object structure with nested objects', () => {
      const hookManagerPrivate = hookManager as any;

      const input = {
        level1: {
          level2: {
            level3: {
              value: 'test',
              number: 123
            }
          }
        }
      };

      const result = hookManagerPrivate.redactSensitiveContent(input);
      expect(result).toEqual(input);
    });

    it('should preserve arrays in objects', () => {
      const hookManagerPrivate = hookManager as any;

      const input = {
        data: {
          items: ['item1', 'item2', 'item3'],
          counts: [1, 2, 3],
          flags: [true, false, true]
        }
      };

      const result = hookManagerPrivate.redactSensitiveContent(input);
      expect(result).toEqual(input);
    });
  });

  describe('String Pattern Testing', () => {
    it('should preserve normal text content', () => {
      const hookManagerPrivate = hookManager as any;

      const normalTexts = [
        'hello world',
        'user name',
        'port number',
        'config value',
        'short'
      ];

      normalTexts.forEach(text => {
        const result = hookManagerPrivate.redactSensitiveString(text);
        expect(result).toBe(text);
      });
    });

    it('should handle empty and whitespace strings', () => {
      const hookManagerPrivate = hookManager as any;

      expect(hookManagerPrivate.redactSensitiveString('')).toBe('');
      expect(hookManagerPrivate.redactSensitiveString('   ')).toBe('   ');
      expect(hookManagerPrivate.redactSensitiveString('\n')).toBe('\n');
      expect(hookManagerPrivate.redactSensitiveString('\t')).toBe('\t');
    });
  });

  describe('Behavior Event Integration', () => {
    it('should emit correct event structure for redaction', async () => {
      const originalOutput = { message: 'test output' };

      const context: PostHookContext = {
        taskId: 'test-task',
        toolName: 'test-tool',
        result: originalOutput,
        executionTime: 100,
      };

      const mockExecAsync = vi.fn().mockResolvedValue({
        stdout: JSON.stringify({
          behaviorMode: 'redact',
          behaviorReason: 'test redaction',
        } as PostHookResult),
        stderr: '',
      });

      vi.doMock('util', () => ({
        promisify: () => mockExecAsync,
      }));

      const result = await hookManager.executePostHooks(context);

      expect(result.success).toBe(true);
      expect(result.behaviorMode).toBe('redact');

      expect(behaviorEvents).toHaveLength(1);
      const event = behaviorEvents[0];
      expect(event.behaviorMode).toBe('redact');
      expect(event.toolName).toBe('test-tool');
      expect(event.reason).toBe('test redaction');
      expect(event.taskId).toBe('test-task');
      expect(event.originalOutput).toEqual(originalOutput);
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should handle warn behavior mode correctly', async () => {
      const originalOutput = { data: 'test data' };

      const context: PostHookContext = {
        taskId: 'warn-task',
        toolName: 'warn-tool',
        result: originalOutput,
        executionTime: 50,
      };

      const mockExecAsync = vi.fn().mockResolvedValue({
        stdout: JSON.stringify({
          behaviorMode: 'warn',
          behaviorReason: 'warning message',
        } as PostHookResult),
        stderr: '',
      });

      vi.doMock('util', () => ({
        promisify: () => mockExecAsync,
      }));

      const result = await hookManager.executePostHooks(context);

      expect(result.success).toBe(true);
      expect(result.behaviorMode).toBe('warn');
      expect(result.modifiedResult).toEqual(originalOutput);

      expect(behaviorEvents).toHaveLength(1);
      expect(behaviorEvents[0].behaviorMode).toBe('warn');
    });

    it('should handle block behavior mode correctly', async () => {
      const originalOutput = { data: 'blocked data' };

      const context: PostHookContext = {
        taskId: 'block-task',
        toolName: 'block-tool',
        result: originalOutput,
        executionTime: 75,
      };

      const mockExecAsync = vi.fn().mockResolvedValue({
        stdout: JSON.stringify({
          behaviorMode: 'block',
          behaviorReason: 'operation blocked',
        } as PostHookResult),
        stderr: '',
      });

      vi.doMock('util', () => ({
        promisify: () => mockExecAsync,
      }));

      const result = await hookManager.executePostHooks(context);

      expect(result.success).toBe(false);
      expect(result.behaviorMode).toBe('block');
      expect(result.blocked).toBe(true);
      expect(result.cancelReason).toBe('Tool execution blocked: operation blocked');

      expect(behaviorEvents).toHaveLength(1);
      expect(behaviorEvents[0].behaviorMode).toBe('block');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unknown behavior mode', async () => {
      const hookManagerPrivate = hookManager as any;
      const context: PostHookContext = {
        taskId: 'error-task',
        toolName: 'error-tool',
        result: {},
        executionTime: 100,
      };

      await expect(
        hookManagerPrivate.handleBehaviorMode(
          'unknown-mode',
          context,
          { name: 'test-hook' },
          'test reason',
          {}
        )
      ).rejects.toThrow('Unknown behavior mode: unknown-mode');
    });

    it('should handle hook execution errors gracefully', async () => {
      const context: PostHookContext = {
        taskId: 'error-task',
        toolName: 'error-tool',
        result: {},
        executionTime: 100,
      };

      const mockExecAsync = vi.fn().mockRejectedValue(new Error('Hook execution failed'));

      vi.doMock('util', () => ({
        promisify: () => mockExecAsync,
      }));

      const result = await hookManager.executePostHooks(context);

      expect(result.success).toBe(true);
      expect(mockStore.addLog).toHaveBeenCalledWith('error-task', expect.objectContaining({
        level: 'error',
        message: expect.stringContaining('failed'),
      }));
    });
  });
});