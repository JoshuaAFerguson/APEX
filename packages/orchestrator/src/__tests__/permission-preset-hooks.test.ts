import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createHooks, HookContext } from '../hooks';
import { TaskStore } from '../store';
import { PermissionStore } from '../permission-store';
import { PermissionPresetManager } from '../permission-preset-manager';
import type { Task } from '@apexcli/core';
import type { HookInput, HookJSONOutput } from '@anthropic-ai/claude-agent-sdk';

/**
 * Tests for permission preset integration with PreToolUse hooks
 *
 * This test suite validates that the permission preset manager is properly
 * integrated into the PreToolUse hooks workflow and that all expected events
 * are emitted with correct behaviors per preset configuration.
 */
describe('Permission Preset Hooks Integration', () => {
  let tempDir: string;
  let store: TaskStore;
  let permissionStore: PermissionStore;
  let permissionPresetManager: PermissionPresetManager;
  let taskId: string;
  let mockEventEmitter: {
    emit: Mock;
  };

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_test`,
    description: 'Test task for permission preset hooks',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    projectPath: tempDir,
    branchName: 'apex/test-permission-preset-hooks',
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-permission-preset-hooks-test-'));
    await fs.mkdir(path.join(tempDir, '.apex'), { recursive: true });

    // Initialize stores
    store = new TaskStore(tempDir);
    await store.initialize();

    permissionStore = new PermissionStore(tempDir);
    await permissionStore.initialize();

    permissionPresetManager = new PermissionPresetManager(permissionStore);

    // Create mock event emitter
    mockEventEmitter = {
      emit: vi.fn(),
    };

    const task = createTestTask();
    taskId = task.id;
    await store.createTask(task);
  });

  afterEach(async () => {
    store.close();
    permissionStore.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('checkToolPermissions function', () => {
    it('should skip permission checks when no permission preset manager is provided', async () => {
      const context: HookContext = {
        taskId,
        store,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      const input: HookInput = {
        tool_name: 'Write',
        tool_input: { file_path: '/tmp/test.txt', content: 'test content' },
      };

      const result = await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });

      expect(result).toEqual({});
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should allow tools when permission preset allows them', async () => {
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
        tool_input: { file_path: '/src/app.ts', content: 'const app = {};' },
      };

      const result = await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });

      expect(result).toEqual({});
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:granted', {
        taskId,
        toolName: 'Write',
        scope: '/src/app.ts',
        timestamp: expect.any(Date),
        level: 'allow-always',
        grantedBy: 'permission-preset:autonomous',
        grantReason: 'Tool Write is automatically allowed by permission preset',
      });
    });

    it('should deny tools when permission preset denies them', async () => {
      await permissionPresetManager.applyPreset('read-only');

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
        tool_input: { file_path: '/src/app.ts', content: 'const app = {};' },
      };

      const result = await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });

      expect(result).toEqual({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Tool Write is not allowed by current permission preset',
        },
      });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:denied', {
        taskId,
        toolName: 'Write',
        scope: '/src/app.ts',
        timestamp: expect.any(Date),
        denialReason: 'Tool Write is not allowed by current permission preset: read-only',
        deniedBy: 'permission-preset:read-only',
      });
    });

    it('should request confirmation when permission preset requires it', async () => {
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

      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'npm install' },
      };

      const result = await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });

      expect(result).toEqual({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Tool Bash requires user confirmation before execution',
        },
      });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:request', {
        taskId,
        toolName: 'Bash',
        scope: 'npm install',
        timestamp: expect.any(Date),
        reason: 'Tool Bash requires user confirmation under current permission preset: review-all',
        agentName: 'orchestrator',
      });
    });

    it('should handle different scope types correctly', async () => {
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

      // Test file_path scope
      const fileInput: HookInput = {
        tool_name: 'Read',
        tool_input: { file_path: '/src/index.ts' },
      };

      await checkPermissionCallback?.(fileInput, 'tool-1', { signal: new AbortController().signal });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:granted', expect.objectContaining({
        scope: '/src/index.ts',
      }));

      mockEventEmitter.emit.mockClear();

      // Test path scope
      const pathInput: HookInput = {
        tool_name: 'Glob',
        tool_input: { path: '/src', pattern: '*.ts' },
      };

      await checkPermissionCallback?.(pathInput, 'tool-2', { signal: new AbortController().signal });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:granted', expect.objectContaining({
        scope: '/src',
      }));

      mockEventEmitter.emit.mockClear();

      // Test URL scope
      const urlInput: HookInput = {
        tool_name: 'WebFetch',
        tool_input: { url: 'https://api.example.com' },
      };

      await checkPermissionCallback?.(urlInput, 'tool-3', { signal: new AbortController().signal });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:granted', expect.objectContaining({
        scope: 'https://api.example.com',
      }));

      mockEventEmitter.emit.mockClear();

      // Test command scope
      const commandInput: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'echo hello' },
      };

      await checkPermissionCallback?.(commandInput, 'tool-4', { signal: new AbortController().signal });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:granted', expect.objectContaining({
        scope: 'echo hello',
      }));
    });

    it('should log permission decisions correctly', async () => {
      await permissionPresetManager.applyPreset('read-only');

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      // Test allowed tool
      const readInput: HookInput = {
        tool_name: 'Read',
        tool_input: { file_path: '/src/app.ts' },
      };

      await checkPermissionCallback?.(readInput, 'tool-1', { signal: new AbortController().signal });

      // Test denied tool
      const writeInput: HookInput = {
        tool_name: 'Write',
        tool_input: { file_path: '/src/app.ts', content: 'test' },
      };

      await checkPermissionCallback?.(writeInput, 'tool-2', { signal: new AbortController().signal });

      // Verify logs were created
      const task = await store.getTask(taskId);
      const logs = task?.logs || [];

      const debugLogs = logs.filter(l => l.level === 'debug');
      const warnLogs = logs.filter(l => l.level === 'warn');

      expect(debugLogs.some(l => l.message.includes('Tool usage allowed by permission preset: Read'))).toBe(true);
      expect(warnLogs.some(l => l.message.includes('Tool usage denied by permission preset: Write'))).toBe(true);
    });

    it('should handle permission check errors gracefully', async () => {
      // Create a mock permission preset manager that throws an error
      const erroringPermissionPresetManager = {
        ...permissionPresetManager,
        isToolDenied: vi.fn().mockRejectedValue(new Error('Permission store error')),
        getCurrentPreset: vi.fn().mockReturnValue('read-only'),
      };

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager: erroringPermissionPresetManager as any,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      const input: HookInput = {
        tool_name: 'Write',
        tool_input: { file_path: '/src/app.ts', content: 'test' },
      };

      // Should not throw and should allow the tool (fail open)
      const result = await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });

      expect(result).toEqual({});

      // Should log the error
      const task = await store.getTask(taskId);
      const errorLogs = task?.logs.filter(l => l.level === 'error') || [];

      expect(errorLogs.some(l => l.message.includes('Error checking tool permissions'))).toBe(true);
      expect(errorLogs.some(l => l.metadata?.error === 'Error: Permission store error')).toBe(true);
    });

    it('should work with tools that have no input parameters', async () => {
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
        tool_name: 'CustomTool',
        tool_input: {},
      };

      const result = await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });

      expect(result).toEqual({});
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:granted', {
        taskId,
        toolName: 'CustomTool',
        scope: undefined,
        timestamp: expect.any(Date),
        level: 'allow-always',
        grantedBy: 'permission-preset:autonomous',
        grantReason: 'Tool CustomTool is automatically allowed by permission preset',
      });
    });
  });

  describe('Hook execution order', () => {
    it('should execute permission checks before dangerous operation detection', async () => {
      await permissionPresetManager.applyPreset('read-only');

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const preToolUseHooks = hooks.PreToolUse || [];

      // Permission check hook should be first (no matcher)
      const permissionHookIndex = preToolUseHooks.findIndex(hook => !('matcher' in hook));
      expect(permissionHookIndex).toBe(0);

      // Dangerous operation hook should be second (also no matcher)
      expect(preToolUseHooks[1]).toBeDefined();
      expect(preToolUseHooks[1]).not.toHaveProperty('matcher');
    });

    it('should deny via permission preset before dangerous operation check', async () => {
      await permissionPresetManager.applyPreset('read-only');

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.[0];
      const checkPermissionCallback = permissionHook?.hooks[0];

      // Try to execute a dangerous command that would be blocked by both permission preset and dangerous operation detector
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf /' },
      };

      const result = await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });

      // Should be denied by permission preset (Write tools not allowed in read-only)
      expect(result).toEqual({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Tool Bash is not allowed by current permission preset',
        },
      });

      // Should emit permission:denied event
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:denied', expect.objectContaining({
        toolName: 'Bash',
        denialReason: expect.stringContaining('not allowed by current permission preset'),
      }));
    });
  });

  describe('Preset-specific behavior', () => {
    it('should allow all tools with autonomous preset', async () => {
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

      const tools = ['Read', 'Write', 'Edit', 'Bash', 'WebFetch', 'Grep', 'Glob'];

      for (const toolName of tools) {
        mockEventEmitter.emit.mockClear();

        const input: HookInput = {
          tool_name: toolName,
          tool_input: { test: 'data' },
        };

        const result = await checkPermissionCallback?.(input, `tool-${toolName}`, { signal: new AbortController().signal });

        expect(result).toEqual({});
        expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:granted', expect.objectContaining({
          toolName,
          level: 'allow-always',
        }));
      }
    });

    it('should only allow read-only tools with read-only preset', async () => {
      await permissionPresetManager.applyPreset('read-only');

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      const checkPermissionCallback = permissionHook?.hooks[0];

      // Read-only tools should be allowed
      const readOnlyTools = ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'];

      for (const toolName of readOnlyTools) {
        mockEventEmitter.emit.mockClear();

        const input: HookInput = {
          tool_name: toolName,
          tool_input: { test: 'data' },
        };

        const result = await checkPermissionCallback?.(input, `tool-${toolName}`, { signal: new AbortController().signal });

        expect(result).toEqual({});
        expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:granted', expect.objectContaining({
          toolName,
        }));
      }

      // Write tools should be denied
      const writeTools = ['Write', 'Edit', 'Bash', 'MultiEdit'];

      for (const toolName of writeTools) {
        mockEventEmitter.emit.mockClear();

        const input: HookInput = {
          tool_name: toolName,
          tool_input: { test: 'data' },
        };

        const result = await checkPermissionCallback?.(input, `tool-${toolName}`, { signal: new AbortController().signal });

        expect(result?.hookSpecificOutput?.permissionDecision).toBe('deny');
        expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:denied', expect.objectContaining({
          toolName,
        }));
      }
    });

    it('should require confirmation for all tools with review-all preset', async () => {
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

      const tools = ['Read', 'Write', 'Edit', 'Bash', 'WebFetch', 'Grep', 'Glob'];

      for (const toolName of tools) {
        mockEventEmitter.emit.mockClear();

        const input: HookInput = {
          tool_name: toolName,
          tool_input: { test: 'data' },
        };

        const result = await checkPermissionCallback?.(input, `tool-${toolName}`, { signal: new AbortController().signal });

        expect(result?.hookSpecificOutput?.permissionDecision).toBe('deny');
        expect(result?.hookSpecificOutput?.permissionDecisionReason).toContain('requires user confirmation');

        expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:request', expect.objectContaining({
          toolName,
          reason: expect.stringContaining('requires user confirmation'),
        }));
      }
    });
  });

  describe('Integration with existing hooks', () => {
    it('should not interfere with specific tool hooks when permission is granted', async () => {
      await permissionPresetManager.applyPreset('autonomous');

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);

      // Verify that permission hooks exist alongside tool-specific hooks
      const bashMatchers = hooks.PreToolUse?.filter(hook => 'matcher' in hook && hook.matcher === 'Bash') || [];
      expect(bashMatchers.length).toBeGreaterThan(0);

      const writeMatchers = hooks.PreToolUse?.filter(hook => 'matcher' in hook && hook.matcher === 'Write') || [];
      expect(writeMatchers.length).toBeGreaterThan(0);

      const webFetchMatchers = hooks.PreToolUse?.filter(hook => 'matcher' in hook && hook.matcher === 'WebFetch') || [];
      expect(webFetchMatchers.length).toBeGreaterThan(0);

      // Permission hook should exist without interfering
      const permissionHook = hooks.PreToolUse?.find(hook => !('matcher' in hook));
      expect(permissionHook).toBeDefined();
    });

    it('should work correctly when both permission and dangerous operation hooks deny', async () => {
      await permissionPresetManager.applyPreset('read-only');

      const context: HookContext = {
        taskId,
        store,
        permissionPresetManager,
        eventEmitter: mockEventEmitter,
      };

      const hooks = createHooks(context);
      const permissionHook = hooks.PreToolUse?.[0];
      const checkPermissionCallback = permissionHook?.hooks[0];

      // Command that would be blocked by both permission preset and dangerous operation detector
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf /' },
      };

      const result = await checkPermissionCallback?.(input, 'tool-1', { signal: new AbortController().signal });

      // Should be denied by permission preset first
      expect(result?.hookSpecificOutput?.permissionDecision).toBe('deny');
      expect(result?.hookSpecificOutput?.permissionDecisionReason).toContain('not allowed by current permission preset');

      // Should emit permission:denied event
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:denied', expect.objectContaining({
        toolName: 'Bash',
        denialReason: expect.stringContaining('not allowed by current permission preset'),
      }));
    });
  });
});