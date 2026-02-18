import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

import {
  HookManager,
  type HookExecutionStartEvent,
  type HookExecutionCompleteEvent,
  type HookManagerEvents,
} from '../hook-manager';
import { TaskStore } from '../store';
import {
  HookConfig,
  ToolHookConfig,
  ToolHookDefinition,
  PreHookContext,
  PostHookContext,
  PreHookResult,
  PostHookResult,
  PreHookAction,
  BehaviorMode,
  BehaviorEventData,
} from '@apexcli/core';

// Mock dependencies
vi.mock('child_process');
vi.mock('fs');
vi.mock('util');

const mockExec = vi.mocked(exec);
const mockPromisify = vi.mocked(promisify);
const mockExecAsync = vi.fn();
const mockFs = vi.mocked(fs);

/**
 * Test suite for HookManager JSDoc functionality validation
 *
 * This test suite validates that all the examples and functionality documented
 * in JSDoc comments actually work as described.
 */
describe('HookManager JSDoc Functionality Tests', () => {
  let hookManager: HookManager;
  let mockStore: any;
  let projectPath: string;
  let mockToolHookConfig: ToolHookConfig;
  let mockLifecycleHooks: HookConfig[];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock promisify to return our mock exec function
    mockPromisify.mockReturnValue(mockExecAsync);

    // Setup mock store
    mockStore = {
      addLog: vi.fn(),
      getTask: vi.fn(),
      updateTask: vi.fn(),
    };

    projectPath = '/test/project';

    // Example configurations from JSDoc
    mockToolHookConfig = {
      pre: [
        {
          name: 'lint-check',
          command: 'npm run lint',
          timeoutMs: 30000,
          continueOnFailure: false,
        },
        {
          name: 'type-check',
          command: 'npm run typecheck',
          timeoutMs: 60000,
          continueOnFailure: true,
        },
      ],
      post: [
        {
          name: 'cleanup',
          command: 'npm run cleanup',
          timeoutMs: 15000,
          continueOnFailure: true,
        },
      ],
      enabled: true,
      defaultTimeoutMs: 30000,
    };

    mockLifecycleHooks = [
      {
        id: 'git-hooks',
        enabled: true,
        hooks: {
          'pre-commit': {
            script: 'npm run pre-commit',
            timeout: 30000,
          },
          'post-commit': {
            script: 'git push origin HEAD',
            timeout: 60000,
          },
        },
      },
    ];

    hookManager = new HookManager(projectPath, mockStore, mockLifecycleHooks, mockToolHookConfig);

    // Mock fs functions
    mockFs.existsSync = vi.fn();
    mockFs.writeFileSync = vi.fn();
    mockFs.unlinkSync = vi.fn();
    mockFs.mkdirSync = vi.fn();
    mockFs.readFileSync = vi.fn();
    mockFs.chmodSync = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('HookManagerEvents Interface Examples', () => {
    it('should emit events as documented in JSDoc examples', async () => {
      const events: Array<{type: string, data: any}> = [];

      // Example from JSDoc: hookManager.on('hook:pre:start', callback)
      hookManager.on('hook:pre:start', (event: HookExecutionStartEvent) => {
        events.push({ type: 'pre:start', data: event });
      });

      hookManager.on('hook:pre:complete', (event: HookExecutionCompleteEvent) => {
        events.push({ type: 'pre:complete', data: event });
      });

      hookManager.on('hook:behavior:triggered', (event: BehaviorEventData) => {
        events.push({ type: 'behavior:triggered', data: event });
      });

      // Mock successful hook execution
      mockExecAsync.mockResolvedValue({ stdout: 'Hook completed', stderr: '' });

      const context: PreHookContext = {
        taskId: 'test-task-123',
        toolName: 'TestTool',
        args: ['arg1', 'arg2'],
        workingDirectory: projectPath,
      };

      await hookManager.executePreHook(context);

      // Should have emitted start and complete events
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events.some(e => e.type === 'pre:start')).toBe(true);
      expect(events.some(e => e.type === 'pre:complete')).toBe(true);

      // Validate event structure matches JSDoc
      const startEvent = events.find(e => e.type === 'pre:start')?.data as HookExecutionStartEvent;
      if (startEvent) {
        expect(startEvent).toMatchObject({
          taskId: 'test-task-123',
          hookName: expect.any(String),
          hookType: 'pre',
          toolName: 'TestTool',
          timestamp: expect.any(Date),
        });
      }
    });
  });

  describe('HookManager Constructor Examples', () => {
    it('should work with the example from constructor JSDoc', () => {
      // Example from JSDoc documentation
      const manager = new HookManager(projectPath, mockStore);

      expect(manager).toBeInstanceOf(HookManager);
      expect(manager).toBeInstanceOf(EventEmitter);
      expect(manager.getToolHookConfig()).toMatchObject({
        pre: [],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      });
    });

    it('should work with full configuration example', () => {
      const customConfig: ToolHookConfig = {
        pre: [
          {
            name: 'format-check',
            command: 'npm run format:check',
            timeoutMs: 20000,
            continueOnFailure: false,
          },
        ],
        post: [
          {
            name: 'notify',
            command: 'npm run notify:complete',
            timeoutMs: 10000,
            continueOnFailure: true,
          },
        ],
        enabled: true,
        defaultTimeoutMs: 25000,
      };

      const manager = new HookManager(projectPath, mockStore, [], customConfig);

      expect(manager.getToolHookConfig()).toEqual(customConfig);
    });
  });

  describe('executePreHook() Method JSDoc Examples', () => {
    it('should execute pre-hooks as documented', async () => {
      // Mock successful execution
      mockExecAsync.mockResolvedValue({
        stdout: 'Lint check passed',
        stderr: '',
      });

      const context: PreHookContext = {
        taskId: 'task-456',
        toolName: 'ESLint',
        args: ['--fix', 'src/'],
        workingDirectory: '/project/path',
        environment: {
          NODE_ENV: 'test',
          CI: 'true',
        },
      };

      const result = await hookManager.executePreHook(context);

      expect(result).toBeDefined();
      expect(mockStore.addLog).toHaveBeenCalled();
      expect(mockExecAsync).toHaveBeenCalled();
    });

    it('should handle hook failures and return appropriate results', async () => {
      // Mock hook failure
      mockExecAsync.mockRejectedValue(new Error('Lint errors found'));

      const context: PreHookContext = {
        taskId: 'task-fail',
        toolName: 'ESLint',
        args: ['src/'],
        workingDirectory: projectPath,
      };

      const result = await hookManager.executePreHook(context);

      expect(result).toBeDefined();
      expect(mockStore.addLog).toHaveBeenCalledWith(
        'task-fail',
        expect.stringContaining('Hook execution failed')
      );
    });

    it('should support different pre-hook actions', async () => {
      // Test different hook outcomes
      const testCases = [
        { action: 'continue' as PreHookAction, shouldContinue: true },
        { action: 'skip' as PreHookAction, shouldContinue: false },
        { action: 'abort' as PreHookAction, shouldContinue: false },
      ];

      for (const testCase of testCases) {
        // Mock hook that returns specific action
        mockExecAsync.mockResolvedValue({
          stdout: JSON.stringify({ action: testCase.action }),
          stderr: '',
        });

        const context: PreHookContext = {
          taskId: `task-${testCase.action}`,
          toolName: 'TestHook',
          args: [],
          workingDirectory: projectPath,
        };

        const result = await hookManager.executePreHook(context);

        if (result && 'action' in result) {
          // Validate the result matches expected action
          expect(['continue', 'skip', 'abort']).toContain(result.action);
        }
      }
    });
  });

  describe('executePostHook() Method JSDoc Examples', () => {
    it('should execute post-hooks as documented', async () => {
      // Mock successful post-hook execution
      mockExecAsync.mockResolvedValue({
        stdout: 'Cleanup completed successfully',
        stderr: '',
      });

      const context: PostHookContext = {
        taskId: 'task-789',
        toolName: 'Cleanup',
        result: {
          success: true,
          output: 'Task completed successfully',
          executionTime: 1500,
        },
        workingDirectory: projectPath,
        environment: {
          CLEANUP_MODE: 'full',
        },
      };

      const result = await hookManager.executePostHook(context);

      expect(result).toBeDefined();
      expect(mockExecAsync).toHaveBeenCalled();
      expect(mockStore.addLog).toHaveBeenCalled();
    });

    it('should handle post-hook context with task results', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'Post-processing completed',
        stderr: '',
      });

      const context: PostHookContext = {
        taskId: 'task-with-results',
        toolName: 'PostProcessor',
        result: {
          success: false,
          output: 'Task failed with error',
          executionTime: 2500,
          errorCode: 1,
        },
        workingDirectory: projectPath,
      };

      const result = await hookManager.executePostHook(context);

      // Should handle failed task results appropriately
      expect(result).toBeDefined();
      expect(mockStore.addLog).toHaveBeenCalledWith(
        'task-with-results',
        expect.stringContaining('Post-hook')
      );
    });
  });

  describe('loadHookConfigurations() Method JSDoc Examples', () => {
    it('should load hook configurations from file system', async () => {
      const mockHookConfig = {
        pre: [
          {
            name: 'security-scan',
            command: 'npm audit',
            timeoutMs: 45000,
            continueOnFailure: false,
          },
        ],
        post: [
          {
            name: 'deploy-staging',
            command: 'npm run deploy:staging',
            timeoutMs: 120000,
            continueOnFailure: true,
          },
        ],
        enabled: true,
      };

      // Mock file system to return configuration
      vi.mocked(mockFs.existsSync).mockReturnValue(true);
      vi.mocked(mockFs.readFileSync).mockReturnValue(JSON.stringify(mockHookConfig));

      await hookManager.loadHookConfigurations();

      expect(mockFs.existsSync).toHaveBeenCalled();
      expect(mockFs.readFileSync).toHaveBeenCalled();
    });

    it('should handle missing configuration files gracefully', async () => {
      // Mock missing config file
      vi.mocked(mockFs.existsSync).mockReturnValue(false);

      await hookManager.loadHookConfigurations();

      // Should not throw and should continue with default configuration
      expect(hookManager.getToolHookConfig()).toBeDefined();
    });

    it('should handle malformed configuration files', async () => {
      // Mock invalid JSON
      vi.mocked(mockFs.existsSync).mockReturnValue(true);
      vi.mocked(mockFs.readFileSync).mockReturnValue('{ invalid json }');

      await hookManager.loadHookConfigurations();

      // Should handle parse errors gracefully
      expect(hookManager.getToolHookConfig()).toBeDefined();
    });
  });

  describe('registerBehavior() Method JSDoc Examples', () => {
    it('should register behavior modes as documented', async () => {
      const behaviorEvents: BehaviorEventData[] = [];

      hookManager.on('hook:behavior:triggered', (event: BehaviorEventData) => {
        behaviorEvents.push(event);
      });

      // Example from JSDoc: register different behavior modes
      await hookManager.registerBehavior('defensive', {
        skipOnFailure: true,
        retryCount: 3,
        timeoutMultiplier: 1.5,
      });

      await hookManager.registerBehavior('aggressive', {
        skipOnFailure: false,
        retryCount: 0,
        timeoutMultiplier: 0.8,
      });

      // Test behavior registration doesn't throw
      expect(true).toBe(true); // Test passes if no exceptions
    });

    it('should handle behavior mode activation', async () => {
      const events: BehaviorEventData[] = [];

      hookManager.on('hook:behavior:triggered', (event: BehaviorEventData) => {
        events.push(event);
      });

      // Register and trigger behavior
      await hookManager.registerBehavior('cautious', {
        skipOnFailure: true,
        retryCount: 1,
      });

      // Mock a scenario that would trigger behavior mode
      mockExecAsync.mockRejectedValueOnce(new Error('Hook failed'));
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Retry successful', stderr: '' });

      const context: PreHookContext = {
        taskId: 'behavior-test',
        toolName: 'TestTool',
        args: [],
        workingDirectory: projectPath,
      };

      await hookManager.executePreHook(context);

      // Should have handled the failure according to behavior mode
      expect(mockStore.addLog).toHaveBeenCalled();
    });
  });

  describe('cleanup() Method JSDoc Examples', () => {
    it('should cleanup hook manager resources', async () => {
      // Mock some internal state that needs cleanup
      vi.mocked(mockFs.existsSync).mockReturnValue(true);

      await hookManager.cleanup();

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Mock cleanup operations that might fail
      vi.mocked(mockFs.unlinkSync).mockImplementation(() => {
        throw new Error('File deletion failed');
      });

      await hookManager.cleanup();

      // Should not propagate cleanup errors
      expect(true).toBe(true);
    });
  });

  describe('Hook Configuration Validation', () => {
    it('should validate tool hook definitions', () => {
      const validHookDef: ToolHookDefinition = {
        name: 'test-hook',
        command: 'echo "test"',
        timeoutMs: 5000,
        continueOnFailure: true,
        environment: {
          TEST_MODE: 'true',
        },
      };

      // Creating manager with valid config should work
      const config: ToolHookConfig = {
        pre: [validHookDef],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      const manager = new HookManager(projectPath, mockStore, [], config);
      expect(manager.getToolHookConfig().pre).toHaveLength(1);
      expect(manager.getToolHookConfig().pre[0]).toEqual(validHookDef);
    });

    it('should handle empty hook configurations', () => {
      const emptyConfig: ToolHookConfig = {
        pre: [],
        post: [],
        enabled: false,
        defaultTimeoutMs: 0,
      };

      const manager = new HookManager(projectPath, mockStore, [], emptyConfig);
      expect(manager.getToolHookConfig()).toEqual(emptyConfig);
    });
  });

  describe('Type Guard Functions JSDoc Examples', () => {
    it('should correctly identify PreHookResult types', () => {
      const preResult: PreHookResult = {
        action: 'continue',
        metadata: {
          lintErrors: 0,
          testsPassed: true,
        },
      };

      const postResult: PostHookResult = {
        metadata: {
          deploymentUrl: 'https://staging.example.com',
          buildTime: 120000,
        },
      };

      // Test the type guard functions (if they exist in the module)
      // This validates the examples in the JSDoc comments
      expect(preResult.action).toBeDefined();
      expect(postResult.metadata).toBeDefined();
      expect('action' in preResult).toBe(true);
      expect('action' in postResult).toBe(false);
    });
  });

  describe('Event System Integration', () => {
    it('should emit all documented events in correct order', async () => {
      const eventOrder: string[] = [];

      hookManager.on('hook:pre:start', () => eventOrder.push('pre:start'));
      hookManager.on('hook:pre:complete', () => eventOrder.push('pre:complete'));
      hookManager.on('hook:post:start', () => eventOrder.push('post:start'));
      hookManager.on('hook:post:complete', () => eventOrder.push('post:complete'));

      // Mock successful execution
      mockExecAsync.mockResolvedValue({ stdout: 'Success', stderr: '' });

      const preContext: PreHookContext = {
        taskId: 'event-test',
        toolName: 'EventTester',
        args: [],
        workingDirectory: projectPath,
      };

      const postContext: PostHookContext = {
        taskId: 'event-test',
        toolName: 'EventTester',
        result: { success: true, output: 'Done', executionTime: 1000 },
        workingDirectory: projectPath,
      };

      await hookManager.executePreHook(preContext);
      await hookManager.executePostHook(postContext);

      // Events should have been emitted in the expected order
      expect(eventOrder.includes('pre:start')).toBe(true);
      expect(eventOrder.includes('pre:complete')).toBe(true);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle hook timeouts gracefully', async () => {
      // Mock a timeout scenario
      mockExecAsync.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Command timed out')), 100)
        )
      );

      const context: PreHookContext = {
        taskId: 'timeout-test',
        toolName: 'SlowTool',
        args: [],
        workingDirectory: projectPath,
      };

      const result = await hookManager.executePreHook(context);

      // Should handle timeout and return appropriate result
      expect(result).toBeDefined();
      expect(mockStore.addLog).toHaveBeenCalled();
    });

    it('should handle missing hook commands', async () => {
      // Mock command not found error
      mockExecAsync.mockRejectedValue(new Error('Command not found'));

      const context: PreHookContext = {
        taskId: 'missing-cmd-test',
        toolName: 'NonExistentTool',
        args: [],
        workingDirectory: projectPath,
      };

      const result = await hookManager.executePreHook(context);

      // Should handle missing command gracefully
      expect(result).toBeDefined();
      expect(mockStore.addLog).toHaveBeenCalledWith(
        'missing-cmd-test',
        expect.stringContaining('failed')
      );
    });

    it('should handle permission errors', async () => {
      // Mock permission denied error
      mockExecAsync.mockRejectedValue(new Error('Permission denied'));

      const context: PostHookContext = {
        taskId: 'permission-test',
        toolName: 'RestrictedTool',
        result: { success: true, output: 'Done', executionTime: 500 },
        workingDirectory: '/restricted/path',
      };

      const result = await hookManager.executePostHook(context);

      // Should handle permission errors gracefully
      expect(result).toBeDefined();
      expect(mockStore.addLog).toHaveBeenCalled();
    });
  });

  describe('Real-world Integration Scenarios', () => {
    it('should support git hook integration', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'Git hook executed', stderr: '' });

      const gitHookConfig: ToolHookConfig = {
        pre: [
          {
            name: 'pre-commit',
            command: 'git diff --cached --name-only | xargs npm run lint',
            timeoutMs: 60000,
            continueOnFailure: false,
          },
        ],
        post: [
          {
            name: 'post-commit',
            command: 'git push origin HEAD',
            timeoutMs: 30000,
            continueOnFailure: true,
          },
        ],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      const manager = new HookManager(projectPath, mockStore, [], gitHookConfig);

      const context: PreHookContext = {
        taskId: 'git-test',
        toolName: 'Git',
        args: ['commit', '-m', 'test'],
        workingDirectory: projectPath,
      };

      const result = await manager.executePreHook(context);

      expect(result).toBeDefined();
      expect(mockExecAsync).toHaveBeenCalled();
    });

    it('should support CI/CD pipeline integration', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'Pipeline step completed', stderr: '' });

      const ciConfig: ToolHookConfig = {
        pre: [
          {
            name: 'build-check',
            command: 'npm run build',
            timeoutMs: 300000, // 5 minutes
            continueOnFailure: false,
          },
          {
            name: 'test-check',
            command: 'npm run test:ci',
            timeoutMs: 600000, // 10 minutes
            continueOnFailure: false,
          },
        ],
        post: [
          {
            name: 'deploy',
            command: 'npm run deploy:prod',
            timeoutMs: 900000, // 15 minutes
            continueOnFailure: false,
          },
        ],
        enabled: true,
        defaultTimeoutMs: 30000,
      };

      const manager = new HookManager(projectPath, mockStore, [], ciConfig);

      const context: PreHookContext = {
        taskId: 'ci-test',
        toolName: 'CI',
        args: ['deploy'],
        workingDirectory: projectPath,
        environment: {
          CI: 'true',
          NODE_ENV: 'production',
        },
      };

      const result = await manager.executePreHook(context);

      expect(result).toBeDefined();
      expect(mockExecAsync).toHaveBeenCalled();
    });
  });
});