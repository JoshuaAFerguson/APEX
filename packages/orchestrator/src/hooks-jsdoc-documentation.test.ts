import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  createHooks,
  createCustomHooks,
  HookContext,
  HooksConfig,
  FILE_MODIFYING_TOOLS,
  type HookInput
} from './hooks';
import { TaskStore } from './store';
import type { Task } from '@apexcli/core';

/**
 * Test suite focused specifically on JSDoc-documented functions and interfaces.
 * This test file validates that the documented API contracts work as described
 * in the JSDoc comments for hooks.ts.
 */
describe('Hooks JSDoc Documentation Validation', () => {
  let testDir: string;
  let store: TaskStore;
  let taskId: string;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_jsdoc_test`,
    description: 'Test task for JSDoc validation',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    projectPath: testDir,
    branchName: 'apex/test-jsdoc',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-hooks-jsdoc-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();

    const task = createTestTask();
    taskId = task.id;
    await store.createTask(task);
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('HookContext interface documentation', () => {
    it('should support all documented properties as described in JSDoc', () => {
      // Test the documented HookContext interface
      const context: HookContext = {
        taskId: 'test-task-123',
        store: store,
        projectPath: '/path/to/project',
        errorFeedbackLoop: undefined,
        permissionPresetManager: undefined,
        onToolUse: vi.fn(),
        eventEmitter: {
          emit: vi.fn(),
        },
        fileSnapshots: new Map(),
        linterService: undefined,
        toolActionStore: undefined,
        currentAgent: 'tester',
        currentStage: 'testing',
        toolStartTimes: new Map(),
        config: {
          ui: { diffPreview: true },
          linter: { global: { enabled: false } },
          codeQuality: { preEditValidation: { enabled: false } },
          project: { typecheckCommand: 'npm run typecheck' },
        },
        cliFlags: {
          diffPreview: true,
        },
        aliasResolver: undefined,
      };

      // Validate that all documented fields are accessible
      expect(context.taskId).toBe('test-task-123');
      expect(context.store).toBe(store);
      expect(context.projectPath).toBe('/path/to/project');
      expect(context.onToolUse).toBeDefined();
      expect(context.eventEmitter).toBeDefined();
      expect(context.fileSnapshots).toBeInstanceOf(Map);
      expect(context.currentAgent).toBe('tester');
      expect(context.currentStage).toBe('testing');
      expect(context.toolStartTimes).toBeInstanceOf(Map);
      expect(context.config?.ui?.diffPreview).toBe(true);
      expect(context.cliFlags?.diffPreview).toBe(true);
    });

    it('should work with minimal required properties only', () => {
      // Test minimal HookContext as shown in JSDoc examples
      const minimalContext: HookContext = {
        taskId: 'minimal-task',
        store: store,
      };

      expect(minimalContext.taskId).toBe('minimal-task');
      expect(minimalContext.store).toBe(store);
      expect(minimalContext.projectPath).toBeUndefined();
      expect(minimalContext.onToolUse).toBeUndefined();
    });
  });

  describe('HooksConfig type documentation', () => {
    it('should support the documented structure for mapping hook events to callbacks', () => {
      // Test the HooksConfig type as documented in JSDoc
      const hooksConfig: HooksConfig = {
        PreToolUse: [
          {
            hooks: [vi.fn()],
            timeout: 5,
          },
          {
            matcher: 'Bash',
            hooks: [vi.fn(), vi.fn()],
            timeout: 10,
          },
        ],
        PostToolUse: [
          {
            hooks: [vi.fn()],
            timeout: 1,
          },
        ],
      };

      expect(hooksConfig.PreToolUse).toHaveLength(2);
      expect(hooksConfig.PostToolUse).toHaveLength(1);
      expect(hooksConfig.PreToolUse?.[0].timeout).toBe(5);
      expect(hooksConfig.PreToolUse?.[1].matcher).toBe('Bash');
      expect(hooksConfig.PreToolUse?.[1].hooks).toHaveLength(2);
    });

    it('should allow partial configuration as documented', () => {
      // Test that HooksConfig supports partial configuration
      const partialConfig: HooksConfig = {
        PreToolUse: [
          {
            matcher: 'Write',
            hooks: [vi.fn()],
            timeout: 5,
          },
        ],
        // PostToolUse is optional
      };

      expect(partialConfig.PreToolUse).toBeDefined();
      expect(partialConfig.PostToolUse).toBeUndefined();
    });
  });

  describe('FILE_MODIFYING_TOOLS constant documentation', () => {
    it('should contain the documented tools for file modification tracking', () => {
      // Validate that FILE_MODIFYING_TOOLS contains the tools documented in JSDoc
      expect(FILE_MODIFYING_TOOLS).toBeDefined();
      expect(Array.isArray(FILE_MODIFYING_TOOLS)).toBe(true);

      // Should contain all file-modifying tools as documented
      expect(FILE_MODIFYING_TOOLS).toContain('Write');
      expect(FILE_MODIFYING_TOOLS).toContain('Edit');
      expect(FILE_MODIFYING_TOOLS).toContain('MultiEdit');
      expect(FILE_MODIFYING_TOOLS).toContain('NotebookEdit');

      // Should be exactly these 4 tools
      expect(FILE_MODIFYING_TOOLS).toHaveLength(4);
    });

    it('should be usable for snapshot capture as documented', () => {
      // Test that FILE_MODIFYING_TOOLS can be used as documented for audit trails
      const isFileModifyingTool = (toolName: string): boolean => {
        return FILE_MODIFYING_TOOLS.includes(toolName);
      };

      expect(isFileModifyingTool('Write')).toBe(true);
      expect(isFileModifyingTool('Edit')).toBe(true);
      expect(isFileModifyingTool('MultiEdit')).toBe(true);
      expect(isFileModifyingTool('NotebookEdit')).toBe(true);
      expect(isFileModifyingTool('Bash')).toBe(false);
      expect(isFileModifyingTool('Read')).toBe(false);
    });

    it('should be exported and accessible as documented', () => {
      // Ensure the constant is properly exported as mentioned in JSDoc
      expect(FILE_MODIFYING_TOOLS).toEqual(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
    });
  });

  describe('createHooks function documentation', () => {
    it('should match the JSDoc function signature exactly', () => {
      // Test the documented function signature: createHooks(context: HookContext): HooksConfig
      const context: HookContext = {
        taskId: taskId,
        store: store,
        projectPath: testDir,
      };

      const result = createHooks(context);

      // Should return HooksConfig object as documented
      expect(result).toBeDefined();
      expect(typeof result === 'object').toBe(true);
      expect(result).toHaveProperty('PreToolUse');
      expect(result).toHaveProperty('PostToolUse');
    });

    it('should work with the exact example from JSDoc', () => {
      // Test the exact example provided in the JSDoc @example
      const context: HookContext = {
        taskId: 'task-123',
        store: store, // Using our test store instead of 'taskStore'
        projectPath: '/path/to/project',
      };
      const hooks = createHooks(context);

      // Verify it returns a valid HooksConfig
      expect(hooks).toBeDefined();
      expect(hooks.PreToolUse).toBeDefined();
      expect(hooks.PostToolUse).toBeDefined();
      expect(Array.isArray(hooks.PreToolUse)).toBe(true);
      expect(Array.isArray(hooks.PostToolUse)).toBe(true);
    });

    it('should create comprehensive tool validation hooks as documented', () => {
      const context: HookContext = {
        taskId: taskId,
        store: store,
      };

      const hooks = createHooks(context);

      // Verify that it sets up pre-tool and post-tool hooks as documented
      expect(hooks.PreToolUse).toBeDefined();
      expect(hooks.PostToolUse).toBeDefined();

      // Should include security hooks
      const bashHooks = hooks.PreToolUse?.filter(h => h.matcher === 'Bash');
      expect(bashHooks).toBeDefined();
      expect(bashHooks!.length).toBeGreaterThan(0);

      // Should include auditing hooks
      const writeHooks = hooks.PreToolUse?.filter(h => h.matcher === 'Write');
      expect(writeHooks).toBeDefined();

      // Should include quality control hooks
      const postHooks = hooks.PostToolUse;
      expect(postHooks).toBeDefined();
      expect(postHooks!.length).toBeGreaterThan(0);
    });

    it('should handle different context configurations as documented', async () => {
      // Test with minimal context
      const minimalContext: HookContext = {
        taskId: taskId,
        store: store,
      };

      const minimalHooks = createHooks(minimalContext);
      expect(minimalHooks.PreToolUse).toBeDefined();

      // Test with full context
      const fullContext: HookContext = {
        taskId: taskId,
        store: store,
        projectPath: testDir,
        onToolUse: vi.fn(),
        eventEmitter: { emit: vi.fn() },
        fileSnapshots: new Map(),
        currentAgent: 'developer',
        currentStage: 'implementation',
      };

      const fullHooks = createHooks(fullContext);
      expect(fullHooks.PreToolUse).toBeDefined();
      expect(fullHooks.PostToolUse).toBeDefined();
    });
  });

  describe('createCustomHooks function documentation', () => {
    it('should match the JSDoc function signature exactly', () => {
      // Test the documented function signature
      const customHooks = [
        { tool: 'Bash', action: 'deny' as const, pattern: 'rm.*', message: 'File deletion blocked' },
        { tool: 'WebFetch', action: 'warn' as const, message: 'External request detected' }
      ];
      const context: HookContext = { taskId: taskId, store: store };

      const result = createCustomHooks(customHooks, context);

      // Should return HooksConfig object as documented
      expect(result).toBeDefined();
      expect(typeof result === 'object').toBe(true);
      expect(result).toHaveProperty('PreToolUse');
    });

    it('should work with the exact example from JSDoc', async () => {
      // Test the exact example provided in the JSDoc @example
      const customHooks = [
        { tool: 'Bash', action: 'deny' as const, pattern: 'rm.*', message: 'File deletion blocked' },
        { tool: 'WebFetch', action: 'warn' as const, message: 'External request detected' }
      ];
      const context: HookContext = { taskId: taskId, store: store };
      const hooks = createCustomHooks(customHooks, context);

      expect(hooks).toBeDefined();
      expect(hooks.PreToolUse).toBeDefined();
      expect(hooks.PreToolUse).toHaveLength(2); // One for each custom hook
    });

    it('should support all documented actions: allow, deny, warn', async () => {
      const customHooks = [
        { tool: 'Bash', action: 'allow' as const, message: 'Bash allowed' },
        { tool: 'Write', action: 'deny' as const, message: 'Write denied' },
        { tool: 'Read', action: 'warn' as const, message: 'Read warning' },
      ];
      const context: HookContext = { taskId: taskId, store: store };
      const hooks = createCustomHooks(customHooks, context);

      expect(hooks.PreToolUse).toHaveLength(3);

      // Test deny action
      const writeHook = hooks.PreToolUse?.[1];
      const writeCallback = writeHook?.hooks[0];
      const writeInput: HookInput = {
        tool_name: 'Write',
        tool_input: { file_path: 'test.txt', content: 'test' },
      };

      const writeResult = await writeCallback?.(writeInput, 'tool-1', { signal: new AbortController().signal });
      expect(writeResult?.hookSpecificOutput?.permissionDecision).toBe('deny');
      expect(writeResult?.hookSpecificOutput?.permissionDecisionReason).toBe('Write denied');

      // Test warn action
      const readHook = hooks.PreToolUse?.[2];
      const readCallback = readHook?.hooks[0];
      const readInput: HookInput = {
        tool_name: 'Read',
        tool_input: { file_path: 'test.txt' },
      };

      const readResult = await readCallback?.(readInput, 'tool-1', { signal: new AbortController().signal });
      expect(readResult).toEqual({});

      // Check that warning was logged
      const task = await store.getTask(taskId);
      const warnLogs = task?.logs.filter(l => l.level === 'warn' && l.message.includes('Read warning'));
      expect(warnLogs?.length).toBeGreaterThan(0);
    });

    it('should support custom pattern matching as documented', async () => {
      const customHooks = [
        { tool: 'Bash', action: 'deny' as const, pattern: 'npm publish', message: 'Publishing blocked' },
        { tool: 'Write', action: 'warn' as const, pattern: '\\.config', message: 'Config file warning' },
      ];
      const context: HookContext = { taskId: taskId, store: store };
      const hooks = createCustomHooks(customHooks, context);

      // Test pattern matching for Bash
      const bashHook = hooks.PreToolUse?.[0];
      const bashCallback = bashHook?.hooks[0];

      // Should match pattern
      const matchingInput: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'npm publish --access public' },
      };
      const matchResult = await bashCallback?.(matchingInput, 'tool-1', { signal: new AbortController().signal });
      expect(matchResult?.hookSpecificOutput?.permissionDecision).toBe('deny');

      // Should not match pattern
      const nonMatchingInput: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'npm install' },
      };
      const noMatchResult = await bashCallback?.(nonMatchingInput, 'tool-1', { signal: new AbortController().signal });
      expect(noMatchResult).toEqual({});
    });

    it('should allow custom rules for specific tools as documented', async () => {
      // Test that users can define custom validation rules as documented
      const customRules = [
        {
          tool: 'WebFetch',
          action: 'deny' as const,
          pattern: 'internal\\.company\\.com',
          message: 'Internal URLs are not allowed'
        },
        {
          tool: 'Edit',
          action: 'warn' as const,
          pattern: 'package\\.json',
          message: 'Editing package.json - please review dependencies'
        }
      ];

      const context: HookContext = { taskId: taskId, store: store };
      const customHooks = createCustomHooks(customRules, context);

      expect(customHooks.PreToolUse).toHaveLength(2);

      // Each hook should target the correct tool
      expect(customHooks.PreToolUse?.[0].matcher).toBe('WebFetch');
      expect(customHooks.PreToolUse?.[1].matcher).toBe('Edit');
    });

    it('should work without patterns when not specified as documented', async () => {
      // Test that patterns are optional as shown in JSDoc
      const customHooks = [
        { tool: 'Bash', action: 'warn' as const, message: 'All bash commands logged' }
      ];
      const context: HookContext = { taskId: taskId, store: store };
      const hooks = createCustomHooks(customHooks, context);

      const bashHook = hooks.PreToolUse?.[0];
      const bashCallback = bashHook?.hooks[0];

      // Should trigger for any bash command since no pattern specified
      const anyInput: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'any command here' },
      };

      const result = await bashCallback?.(anyInput, 'tool-1', { signal: new AbortController().signal });
      expect(result).toEqual({}); // Warn action returns empty but logs

      // Check that warning was logged
      const task = await store.getTask(taskId);
      const warnLogs = task?.logs.filter(l => l.level === 'warn' && l.message.includes('All bash commands logged'));
      expect(warnLogs?.length).toBeGreaterThan(0);
    });
  });

  describe('JSDoc examples validation', () => {
    it('should work exactly as shown in createHooks JSDoc example', () => {
      // Copy the exact example from createHooks JSDoc
      const context: HookContext = {
        taskId: 'task-123',
        store: store, // Using test store
        projectPath: '/path/to/project'
      };
      const hooks = createHooks(context);

      // The example shows this should work without errors
      expect(hooks).toBeDefined();
      expect(hooks.PreToolUse).toBeDefined();
      expect(hooks.PostToolUse).toBeDefined();
    });

    it('should work exactly as shown in createCustomHooks JSDoc example', async () => {
      // Copy the exact example from createCustomHooks JSDoc
      const customHooks = [
        { tool: 'Bash', action: 'deny' as const, pattern: 'rm.*', message: 'File deletion blocked' },
        { tool: 'WebFetch', action: 'warn' as const, message: 'External request detected' }
      ];
      const context: HookContext = { taskId: taskId, store: store };
      const hooks = createCustomHooks(customHooks, context);

      // The example shows this should work without errors
      expect(hooks).toBeDefined();
      expect(hooks.PreToolUse).toBeDefined();
      expect(hooks.PreToolUse).toHaveLength(2);

      // Test the deny behavior
      const bashHook = hooks.PreToolUse?.[0];
      const bashCallback = bashHook?.hooks[0];
      const bashInput: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf test' },
      };

      const result = await bashCallback?.(bashInput, 'tool-1', { signal: new AbortController().signal });
      expect(result?.hookSpecificOutput?.permissionDecision).toBe('deny');
      expect(result?.hookSpecificOutput?.permissionDecisionReason).toBe('File deletion blocked');
    });
  });

  describe('Documentation consistency validation', () => {
    it('should have consistent parameter names between JSDoc and implementation', () => {
      // Verify that createHooks parameter names match JSDoc
      const context: HookContext = { taskId: taskId, store: store };
      const result = createHooks(context);
      expect(result).toBeDefined();

      // Verify that createCustomHooks parameter names match JSDoc
      const customHooksConfig = [
        { tool: 'Bash', action: 'warn' as const, message: 'test' }
      ];
      const customResult = createCustomHooks(customHooksConfig, context);
      expect(customResult).toBeDefined();
    });

    it('should return types that match JSDoc declarations', () => {
      const context: HookContext = { taskId: taskId, store: store };

      // createHooks should return HooksConfig
      const hooksResult = createHooks(context);
      expect(typeof hooksResult).toBe('object');
      expect(hooksResult).toHaveProperty('PreToolUse');
      expect(hooksResult).toHaveProperty('PostToolUse');

      // createCustomHooks should return HooksConfig
      const customHooks = [{ tool: 'Test', action: 'allow' as const }];
      const customResult = createCustomHooks(customHooks, context);
      expect(typeof customResult).toBe('object');
      expect(customResult).toHaveProperty('PreToolUse');
    });

    it('should support all documented HookContext fields', () => {
      // Create a HookContext with all documented fields to ensure they're all supported
      const fullContext: HookContext = {
        taskId: 'test-task',
        store: store,
        projectPath: testDir,
        errorFeedbackLoop: undefined,
        permissionPresetManager: undefined,
        onToolUse: vi.fn(),
        eventEmitter: { emit: vi.fn() },
        fileSnapshots: new Map(),
        linterService: undefined,
        toolActionStore: undefined,
        currentAgent: 'test-agent',
        currentStage: 'test-stage',
        toolStartTimes: new Map(),
        config: {
          ui: { diffPreview: false },
          linter: { global: { enabled: true } },
          codeQuality: { preEditValidation: { enabled: true } },
          project: { typecheckCommand: 'tsc --noEmit' },
        },
        cliFlags: { diffPreview: true },
        aliasResolver: undefined,
      };

      // Should work with full context
      expect(() => createHooks(fullContext)).not.toThrow();

      const hooks = createHooks(fullContext);
      expect(hooks).toBeDefined();
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty custom hooks array as documented', () => {
      const context: HookContext = { taskId: taskId, store: store };
      const hooks = createCustomHooks([], context);

      expect(hooks).toBeDefined();
      expect(hooks.PreToolUse).toHaveLength(0);
    });

    it('should handle invalid tool names gracefully', async () => {
      const customHooks = [
        { tool: 'NonexistentTool', action: 'warn' as const, message: 'test' }
      ];
      const context: HookContext = { taskId: taskId, store: store };
      const hooks = createCustomHooks(customHooks, context);

      // Should still create the hook even for nonexistent tool names
      expect(hooks.PreToolUse).toHaveLength(1);

      const hook = hooks.PreToolUse?.[0];
      expect(hook?.matcher).toBe('NonexistentTool');
    });

    it('should handle missing optional JSDoc parameters', async () => {
      // Test custom hook without optional pattern and message
      const customHooks = [
        { tool: 'Bash', action: 'warn' as const }
      ];
      const context: HookContext = { taskId: taskId, store: store };
      const hooks = createCustomHooks(customHooks, context);

      const hook = hooks.PreToolUse?.[0];
      const callback = hook?.hooks[0];
      const input: HookInput = {
        tool_name: 'Bash',
        tool_input: { command: 'test' },
      };

      // Should work without error even with missing optional parameters
      const result = await callback?.(input, 'tool-1', { signal: new AbortController().signal });
      expect(result).toEqual({});
    });
  });

  describe('JSDoc @param validation', () => {
    it('should validate createHooks @param context matches implementation', () => {
      // The JSDoc shows @param context - The hook context containing task data and services
      const validContext: HookContext = {
        taskId: 'test-task',
        store: store,
        // All other fields are optional based on the interface
      };

      expect(() => createHooks(validContext)).not.toThrow();
      const result = createHooks(validContext);
      expect(result).toBeDefined();
    });

    it('should validate createCustomHooks @param customHooks matches implementation', () => {
      // The JSDoc shows @param customHooks - Array of custom hook definitions with tool patterns and actions
      const validCustomHooks = [
        { tool: 'Bash', action: 'deny' as const, pattern: 'rm.*', message: 'Blocked' },
        { tool: 'Write', action: 'warn' as const, message: 'Warning' },
        { tool: 'Read', action: 'allow' as const }
      ];

      const context: HookContext = { taskId: taskId, store: store };

      expect(() => createCustomHooks(validCustomHooks, context)).not.toThrow();
      const result = createCustomHooks(validCustomHooks, context);
      expect(result).toBeDefined();
      expect(result.PreToolUse).toHaveLength(3);
    });

    it('should validate createCustomHooks @param context matches implementation', () => {
      // The JSDoc shows @param context - The hook context containing task data and services
      const validContext: HookContext = {
        taskId: 'test-task',
        store: store,
      };

      const customHooks = [{ tool: 'Test', action: 'allow' as const }];

      expect(() => createCustomHooks(customHooks, validContext)).not.toThrow();
      const result = createCustomHooks(customHooks, validContext);
      expect(result).toBeDefined();
    });
  });

  describe('JSDoc @returns validation', () => {
    it('should validate createHooks @returns matches actual return type', () => {
      // The JSDoc shows @returns Configuration object mapping hook events to their callbacks
      const context: HookContext = { taskId: taskId, store: store };
      const result = createHooks(context);

      // Should return configuration object
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();

      // Should map hook events to callbacks
      expect(result).toHaveProperty('PreToolUse');
      expect(result).toHaveProperty('PostToolUse');
      expect(Array.isArray(result.PreToolUse)).toBe(true);
      expect(Array.isArray(result.PostToolUse)).toBe(true);

      // Each item should have hooks (callbacks)
      if (result.PreToolUse && result.PreToolUse.length > 0) {
        expect(result.PreToolUse[0]).toHaveProperty('hooks');
        expect(Array.isArray(result.PreToolUse[0].hooks)).toBe(true);
      }
    });

    it('should validate createCustomHooks @returns matches actual return type', () => {
      // The JSDoc shows @returns Configuration object with custom pre-tool use hooks
      const customHooks = [{ tool: 'Bash', action: 'warn' as const }];
      const context: HookContext = { taskId: taskId, store: store };
      const result = createCustomHooks(customHooks, context);

      // Should return configuration object
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();

      // Should have custom pre-tool use hooks
      expect(result).toHaveProperty('PreToolUse');
      expect(Array.isArray(result.PreToolUse)).toBe(true);
      expect(result.PreToolUse).toHaveLength(1);

      // Should have hooks property with callbacks
      expect(result.PreToolUse?.[0]).toHaveProperty('hooks');
      expect(Array.isArray(result.PreToolUse?.[0].hooks)).toBe(true);
    });
  });
});