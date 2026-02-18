import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HookManager } from './hook-manager';
import { TaskStore } from './store';
import {
  ToolHookConfig,
  ToolHookDefinition,
  PreHookContext,
  PostHookContext,
  PreHookResult,
} from '@apexcli/core';

// Mock dependencies
vi.mock('child_process');
vi.mock('fs');
vi.mock('util');

const mockExecAsync = vi.fn();
vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecAsync),
}));

const mockFs = vi.mocked(require('fs'));

describe('HookManager Error Handling and Edge Cases', () => {
  let hookManager: HookManager;
  let mockStore: ReturnType<typeof vi.mocked<TaskStore>>;
  let projectPath: string;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Suppress console output during tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation();

    mockStore = {
      addLog: vi.fn(),
    } as unknown as ReturnType<typeof vi.mocked<TaskStore>>;

    projectPath = '/test/project';

    // Mock fs functions
    mockFs.existsSync = vi.fn();
    mockFs.writeFileSync = vi.fn();
    mockFs.unlinkSync = vi.fn();
    mockFs.mkdirSync = vi.fn();
    mockFs.realpathSync = vi.fn();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('Configuration edge cases', () => {
    it('should handle empty tool hooks configuration', async () => {
      const emptyConfig: ToolHookConfig = {
        pre: [],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], emptyConfig);

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      const result = await hookManager.executePreHooks(context);
      expect(result).toEqual({ success: true });
    });

    it('should handle invalid tool hook configuration gracefully', () => {
      // Test with malformed hook definitions
      const invalidHooks = [
        {
          name: '', // Empty name
          type: 'pre',
          handlerPath: '/hooks/invalid.js',
          tools: [],
          enabled: true,
        },
        {
          name: 'valid-name',
          type: 'invalid-type' as any, // Invalid type
          handlerPath: '/hooks/invalid.js',
          tools: [],
          enabled: true,
        },
        {
          name: 'missing-path',
          type: 'pre',
          handlerPath: '', // Empty path
          tools: [],
          enabled: true,
        },
      ] as ToolHookDefinition[];

      const invalidConfig: ToolHookConfig = {
        pre: invalidHooks,
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      // Should not throw during construction
      expect(() => {
        hookManager = new HookManager(projectPath, mockStore, [], invalidConfig);
      }).not.toThrow();
    });

    it('should handle undefined or null configuration values', () => {
      const nullConfig: any = {
        pre: null,
        post: undefined,
        enabled: null,
        defaultTimeoutMs: undefined,
      };

      expect(() => {
        hookManager = new HookManager(projectPath, mockStore, [], nullConfig);
      }).not.toThrow();

      // Should provide reasonable defaults
      const config = hookManager.getToolHookConfig();
      expect(Array.isArray(config.pre) || config.pre === null).toBe(true);
      expect(Array.isArray(config.post) || config.post === undefined).toBe(true);
    });

    it('should handle extremely large timeout values', async () => {
      const hook: ToolHookDefinition = {
        name: 'large-timeout-hook',
        type: 'pre',
        handlerPath: '/hooks/timeout.js',
        tools: [],
        enabled: true,
        timeoutMs: Number.MAX_SAFE_INTEGER,
      };

      const config: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], config);

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      await expect(hookManager.executePreHooks(context)).resolves.not.toThrow();
    });

    it('should handle negative timeout values', async () => {
      const hook: ToolHookDefinition = {
        name: 'negative-timeout-hook',
        type: 'pre',
        handlerPath: '/hooks/timeout.js',
        tools: [],
        enabled: true,
        timeoutMs: -1000,
      };

      const config: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], config);

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      // Should handle negative timeout gracefully (use default)
      await expect(hookManager.executePreHooks(context)).resolves.not.toThrow();
    });
  });

  describe('File system error handling', () => {
    it('should handle missing hook handler files', async () => {
      const hook: ToolHookDefinition = {
        name: 'missing-file-hook',
        type: 'pre',
        handlerPath: '/hooks/nonexistent.js',
        tools: [],
        enabled: true,
      };

      const config: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], config);

      mockFs.existsSync.mockReturnValue(false); // File doesn't exist

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      const result = await hookManager.executePreHooks(context);

      expect(result).toEqual({
        success: false,
        cancelled: true,
        cancelReason: 'Pre-hook failed: Hook handler not found: /test/project/hooks/nonexistent.js',
      });

      expect(mockStore.addLog).toHaveBeenCalledWith('task-123', {
        level: 'error',
        message: 'Pre-hook "missing-file-hook" failed: Hook handler not found: /test/project/hooks/nonexistent.js',
        metadata: { hook: 'missing-file-hook', tool: 'bash', error: 'Hook handler not found: /test/project/hooks/nonexistent.js' },
      });
    });

    it('should handle file permission errors', async () => {
      const hook: ToolHookDefinition = {
        name: 'permission-hook',
        type: 'pre',
        handlerPath: '/hooks/permission.js',
        tools: [],
        enabled: true,
      };

      const config: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], config);

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockRejectedValue(new Error('EACCES: permission denied'));

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      const result = await hookManager.executePreHooks(context);

      expect(result).toEqual({
        success: false,
        cancelled: true,
        cancelReason: 'Pre-hook failed: EACCES: permission denied',
      });
    });

    it('should handle temporary directory creation failures', async () => {
      const hook: ToolHookDefinition = {
        name: 'temp-dir-hook',
        type: 'pre',
        handlerPath: '/hooks/temp.js',
        tools: [],
        enabled: true,
      };

      const config: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], config);

      mockFs.existsSync.mockReturnValue(true);
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('ENOSPC: no space left on device');
      });

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      const result = await hookManager.executePreHooks(context);

      expect(result).toEqual({
        success: false,
        cancelled: true,
        cancelReason: 'Pre-hook failed: ENOSPC: no space left on device',
      });
    });

    it('should handle context file write failures', async () => {
      const hook: ToolHookDefinition = {
        name: 'write-fail-hook',
        type: 'pre',
        handlerPath: '/hooks/writefail.js',
        tools: [],
        enabled: true,
      };

      const config: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], config);

      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('ENOSPC: no space left on device');
      });

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      const result = await hookManager.executePreHooks(context);

      expect(result).toEqual({
        success: false,
        cancelled: true,
        cancelReason: 'Pre-hook failed: ENOSPC: no space left on device',
      });
    });

    it('should handle cleanup errors gracefully', async () => {
      const hook: ToolHookDefinition = {
        name: 'cleanup-error-hook',
        type: 'pre',
        handlerPath: '/hooks/cleanup.js',
        tools: [],
        enabled: true,
      };

      const config: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], config);

      mockFs.existsSync.mockReturnValue(true);
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      // Should succeed despite cleanup error
      const result = await hookManager.executePreHooks(context);
      expect(result).toEqual({ success: true });
    });
  });

  describe('Hook execution errors', () => {
    it('should handle hook timeout errors', async () => {
      const hook: ToolHookDefinition = {
        name: 'timeout-hook',
        type: 'pre',
        handlerPath: '/hooks/timeout.js',
        tools: [],
        enabled: true,
        timeoutMs: 100, // Very short timeout
      };

      const config: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], config);

      mockFs.existsSync.mockReturnValue(true);

      // Mock long-running execution
      mockExecAsync.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve({ stdout: '', stderr: '' }), 200);
        });
      });

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      const result = await hookManager.executePreHooks(context);

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
      expect(result.cancelReason).toContain('timeout');
    });

    it('should handle malformed JSON responses', async () => {
      const hook: ToolHookDefinition = {
        name: 'malformed-json-hook',
        type: 'pre',
        handlerPath: '/hooks/malformed.js',
        tools: [],
        enabled: true,
      };

      const config: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], config);

      mockFs.existsSync.mockReturnValue(true);

      const malformedResponses = [
        '{ invalid json',
        '{"action": "modify", }', // Trailing comma
        '{"action": modify}', // Unquoted value
        'not json at all',
        '{"action": "modify", "modifiedArguments": undefined}', // Undefined value
      ];

      for (const response of malformedResponses) {
        mockExecAsync.mockResolvedValue({ stdout: response, stderr: '' });

        const context: PreHookContext = {
          toolName: 'bash',
          arguments: { command: 'test' },
          taskId: 'task-123',
          invocationId: 'inv-456',
          timestamp: new Date(),
        };

        const result = await hookManager.executePreHooks(context);

        expect(result.success).toBe(false);
        expect(result.cancelled).toBe(true);
        expect(result.cancelReason).toContain('Invalid JSON response');
      }
    });

    it('should handle hook execution crashes', async () => {
      const hook: ToolHookDefinition = {
        name: 'crash-hook',
        type: 'pre',
        handlerPath: '/hooks/crash.js',
        tools: [],
        enabled: true,
      };

      const config: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], config);

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockRejectedValue(new Error('Process crashed with exit code 139 (SIGSEGV)'));

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      const result = await hookManager.executePreHooks(context);

      expect(result).toEqual({
        success: false,
        cancelled: true,
        cancelReason: 'Pre-hook failed: Process crashed with exit code 139 (SIGSEGV)',
      });
    });

    it('should handle non-Error exceptions', async () => {
      const hook: ToolHookDefinition = {
        name: 'non-error-hook',
        type: 'pre',
        handlerPath: '/hooks/non-error.js',
        tools: [],
        enabled: true,
      };

      const config: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], config);

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockRejectedValue('String error');

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      const result = await hookManager.executePreHooks(context);

      expect(result).toEqual({
        success: false,
        cancelled: true,
        cancelReason: 'Pre-hook failed: String error',
      });
    });
  });

  describe('Context validation edge cases', () => {
    it('should handle missing required context fields', async () => {
      const hook: ToolHookDefinition = {
        name: 'context-validation-hook',
        type: 'pre',
        handlerPath: '/hooks/validate.js',
        tools: [],
        enabled: true,
      };

      const config: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], config);

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      // Test with missing fields
      const invalidContexts = [
        {
          // Missing toolName
          arguments: { command: 'test' },
          taskId: 'task-123',
          invocationId: 'inv-456',
          timestamp: new Date(),
        },
        {
          toolName: '',
          // Missing arguments
          taskId: 'task-123',
          invocationId: 'inv-456',
          timestamp: new Date(),
        },
        {
          toolName: 'bash',
          arguments: { command: 'test' },
          taskId: '',
          // Missing invocationId
          timestamp: new Date(),
        },
      ];

      for (const context of invalidContexts) {
        // Should handle gracefully and not crash
        await expect(hookManager.executePreHooks(context as any)).resolves.not.toThrow();
      }
    });

    it('should handle extremely large context data', async () => {
      const hook: ToolHookDefinition = {
        name: 'large-context-hook',
        type: 'pre',
        handlerPath: '/hooks/large.js',
        tools: [],
        enabled: true,
      };

      const config: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], config);

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      // Create extremely large arguments object
      const largeArguments: Record<string, any> = {};
      for (let i = 0; i < 10000; i++) {
        largeArguments[`arg${i}`] = 'x'.repeat(1000);
      }

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: largeArguments,
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      // Should handle large data without crashing
      await expect(hookManager.executePreHooks(context)).resolves.not.toThrow();
    });

    it('should handle circular references in context data', async () => {
      const hook: ToolHookDefinition = {
        name: 'circular-context-hook',
        type: 'pre',
        handlerPath: '/hooks/circular.js',
        tools: [],
        enabled: true,
      };

      const config: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], config);

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      // Create circular reference
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { circular: circularObj },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      // Should handle circular references gracefully
      const result = await hookManager.executePreHooks(context);
      // Either succeeds with sanitized data or fails gracefully
      expect(typeof result).toBe('object');
    });
  });

  describe('Resource management edge cases', () => {
    it('should handle memory pressure during hook execution', async () => {
      const hooks: ToolHookDefinition[] = Array.from({ length: 100 }, (_, i) => ({
        name: `memory-hook-${i}`,
        type: 'pre',
        handlerPath: `/hooks/memory-${i}.js`,
        tools: [],
        enabled: true,
      }));

      const config: ToolHookConfig = {
        pre: hooks,
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], config);

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      // Should handle many hooks without memory issues
      const result = await hookManager.executePreHooks(context);
      expect(result.success).toBe(true);
    });

    it('should handle concurrent hook executions safely', async () => {
      const hook: ToolHookDefinition = {
        name: 'concurrent-hook',
        type: 'pre',
        handlerPath: '/hooks/concurrent.js',
        tools: [],
        enabled: true,
      };

      const config: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], config);

      mockFs.existsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      // Execute multiple hooks concurrently
      const contexts = Array.from({ length: 10 }, (_, i) => ({
        toolName: 'bash',
        arguments: { command: `test-${i}` },
        taskId: `task-${i}`,
        invocationId: `inv-${i}`,
        timestamp: new Date(),
      }));

      const promises = contexts.map(context =>
        hookManager.executePreHooks(context)
      );

      const results = await Promise.all(promises);

      // All executions should complete successfully
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Edge cases in hook result processing', () => {
    it('should handle null and undefined hook results', async () => {
      const hook: ToolHookDefinition = {
        name: 'null-result-hook',
        type: 'pre',
        handlerPath: '/hooks/null.js',
        tools: [],
        enabled: true,
      };

      const config: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], config);

      mockFs.existsSync.mockReturnValue(true);

      // Test various null/undefined scenarios
      const nullResponses = [
        { stdout: 'null', stderr: '' },
        { stdout: 'undefined', stderr: '' },
        { stdout: '', stderr: '' },
        { stdout: '{}', stderr: '' },
        { stdout: '{"result": null}', stderr: '' },
      ];

      for (const response of nullResponses) {
        mockExecAsync.mockResolvedValue(response);

        const context: PreHookContext = {
          toolName: 'bash',
          arguments: { command: 'test' },
          taskId: 'task-123',
          invocationId: 'inv-456',
          timestamp: new Date(),
        };

        const result = await hookManager.executePreHooks(context);
        expect(result.success).toBe(true);
      }
    });

    it('should handle invalid hook action types', async () => {
      const hook: ToolHookDefinition = {
        name: 'invalid-action-hook',
        type: 'pre',
        handlerPath: '/hooks/invalid-action.js',
        tools: [],
        enabled: true,
      };

      const config: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], config);

      mockFs.existsSync.mockReturnValue(true);

      const invalidActions = [
        '{"action": "invalid"}',
        '{"action": null}',
        '{"action": 123}',
        '{"action": []}',
        '{"action": {}}',
      ];

      for (const actionResponse of invalidActions) {
        mockExecAsync.mockResolvedValue({ stdout: actionResponse, stderr: '' });

        const context: PreHookContext = {
          toolName: 'bash',
          arguments: { command: 'test' },
          taskId: 'task-123',
          invocationId: 'inv-456',
          timestamp: new Date(),
        };

        const result = await hookManager.executePreHooks(context);
        // Should treat as no-op and continue
        expect(result.success).toBe(true);
      }
    });

    it('should handle hook results with missing required fields', async () => {
      const hook: ToolHookDefinition = {
        name: 'missing-fields-hook',
        type: 'pre',
        handlerPath: '/hooks/missing-fields.js',
        tools: [],
        enabled: true,
      };

      const config: ToolHookConfig = {
        pre: [hook],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      hookManager = new HookManager(projectPath, mockStore, [], config);

      mockFs.existsSync.mockReturnValue(true);

      // Test modify action without modifiedArguments
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify({ action: 'modify' }), // Missing modifiedArguments
        stderr: '',
      });

      const context: PreHookContext = {
        toolName: 'bash',
        arguments: { command: 'test' },
        taskId: 'task-123',
        invocationId: 'inv-456',
        timestamp: new Date(),
      };

      const result = await hookManager.executePreHooks(context);
      expect(result.success).toBe(true);
    });
  });
});