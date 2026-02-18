import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs';

import { HookManager } from './hook-manager';
import { TaskStore } from './store';
import {
  ToolHookConfig,
  PostHookContext,
  PostHookResult,
  BehaviorMode,
  BehaviorEventData,
} from '@apexcli/core';

// Mock dependencies
vi.mock('child_process');
vi.mock('fs');
vi.mock('util');

const mockFs = vi.mocked(fs);

describe('HookManager - Behavior Modes', () => {
  let hookManager: HookManager;
  let mockStore: ReturnType<typeof vi.mocked<TaskStore>>;
  let projectPath: string;
  let behaviorEvents: BehaviorEventData[];

  beforeEach(() => {
    vi.clearAllMocks();
    behaviorEvents = [];

    // Setup mock store
    mockStore = {
      addLog: vi.fn(),
    } as unknown as ReturnType<typeof vi.mocked<TaskStore>>;

    projectPath = '/test/project';

    // Create hook manager instance
    hookManager = new HookManager(projectPath, mockStore, [], {
      pre: [],
      post: [
        {
          name: 'security-hook',
          handlerPath: './hooks/security.js',
          enabled: true,
          tools: [],
          priority: 100,
          timeoutMs: 5000,
        },
      ],
      enabled: true,
      defaultTimeoutMs: 30000,
    });

    // Listen for behavior events
    hookManager.on('hook:behavior:triggered', (event: BehaviorEventData) => {
      behaviorEvents.push(event);
    });

    // Mock file system checks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockImplementation(() => '');
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.unlinkSync.mockImplementation(() => {});
  });

  describe('warn behavior mode', () => {
    it('should emit event and pass through output unchanged', async () => {
      const originalOutput = { data: 'test information', key: 'test-value' };
      const context: PostHookContext = {
        taskId: 'test-task',
        toolName: 'read-tool',
        result: originalOutput,
        executionTime: 100,
      };

      // Mock hook execution to return warn behavior
      const mockExecAsync = vi.fn().mockResolvedValue({
        stdout: JSON.stringify({
          behaviorMode: 'warn',
          behaviorReason: 'Test warning triggered',
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
      expect(result.blocked).toBeUndefined();

      // Check that behavior event was emitted
      expect(behaviorEvents).toHaveLength(1);
      expect(behaviorEvents[0]).toMatchObject({
        behaviorMode: 'warn',
        toolName: 'read-tool',
        reason: 'Test warning triggered',
        originalOutput,
        modifiedOutput: originalOutput,
        taskId: 'test-task',
      });
    });
  });

  describe('block behavior mode', () => {
    it('should emit event and block output with error', async () => {
      const originalOutput = { data: 'blocked content' };
      const context: PostHookContext = {
        taskId: 'test-task',
        toolName: 'bash-tool',
        result: originalOutput,
        executionTime: 50,
      };

      // Mock hook execution to return block behavior
      const mockExecAsync = vi.fn().mockResolvedValue({
        stdout: JSON.stringify({
          behaviorMode: 'block',
          behaviorReason: 'Content blocked for testing',
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
      expect(result.cancelReason).toBe('Tool execution blocked: Content blocked for testing');
      expect(result.cancelResult).toEqual({
        success: false,
        error: 'Tool execution blocked by security hook: Content blocked for testing',
        output: null,
      });

      // Check that behavior event was emitted
      expect(behaviorEvents).toHaveLength(1);
      expect(behaviorEvents[0]).toMatchObject({
        behaviorMode: 'block',
        toolName: 'bash-tool',
        reason: 'Content blocked for testing',
        originalOutput,
        taskId: 'test-task',
      });
    });
  });

  describe('redact behavior mode', () => {
    it('should redact content and emit event', async () => {
      const originalOutput = {
        message: 'Test message with redactable content',
        testValue: 'some-long-test-value-that-matches-pattern',
      };

      const context: PostHookContext = {
        taskId: 'test-task',
        toolName: 'api-tool',
        result: originalOutput,
        executionTime: 200,
      };

      // Mock hook execution to return redact behavior
      const mockExecAsync = vi.fn().mockResolvedValue({
        stdout: JSON.stringify({
          behaviorMode: 'redact',
          behaviorReason: 'Test redaction triggered',
        } as PostHookResult),
        stderr: '',
      });

      vi.doMock('util', () => ({
        promisify: () => mockExecAsync,
      }));

      const result = await hookManager.executePostHooks(context);

      expect(result.success).toBe(true);
      expect(result.behaviorMode).toBe('redact');
      expect(result.blocked).toBeUndefined();

      // Check that behavior event was emitted
      expect(behaviorEvents).toHaveLength(1);
      expect(behaviorEvents[0].behaviorMode).toBe('redact');
      expect(behaviorEvents[0].originalOutput).toEqual(originalOutput);
    });

    it('should handle nested objects and arrays for redaction', () => {
      const hookManagerPrivate = hookManager as any;

      const input = {
        user: {
          testField: 'test-value',
          nestedData: ['item1', 'item2'],
        },
        normalValue: 'unchanged',
      };

      const result = hookManagerPrivate.redactSensitiveContent(input);
      expect(typeof result).toBe('object');
      expect(result.normalValue).toBe('unchanged');
    });
  });

  describe('error handling', () => {
    it('should throw error for unknown behavior mode', async () => {
      const hookManagerPrivate = hookManager as any;
      const context: PostHookContext = {
        taskId: 'test-task',
        toolName: 'test-tool',
        result: {},
        executionTime: 100,
      };

      await expect(
        hookManagerPrivate.handleBehaviorMode(
          'invalid-mode' as BehaviorMode,
          context,
          { name: 'test-hook' },
          'test reason',
          {}
        )
      ).rejects.toThrow('Unknown behavior mode: invalid-mode');
    });
  });
});