/**
 * Hooks Alias Resolution Tests
 *
 * Tests specifically for alias resolution functionality in the hooks system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { handleAliasResolution, createHooks, HookContext } from '../hooks';
import { AliasResolver } from '../alias-resolver';
import { TaskStore } from '../store';
import { ToolAlias, Task } from '@apexcli/core';
import type { HookInput } from '@anthropic-ai/claude-agent-sdk';

describe('Hooks Alias Resolution', () => {
  let testDir: string;
  let store: TaskStore;
  let taskId: string;
  let context: HookContext;
  let sampleAliases: ToolAlias[];

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_test`,
    description: 'Test task for hooks alias resolution',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    projectPath: testDir,
    branchName: 'apex/hooks-alias-test',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-hooks-alias-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    store = new TaskStore(testDir);
    await store.initialize();

    const task = createTestTask();
    taskId = task.id;
    await store.createTask(task);

    // Create sample aliases for testing
    sampleAliases = [
      {
        name: 'quick-search',
        description: 'Quick file search',
        tool: 'Grep',
        parameters: {
          pattern: '{{query}}',
          output_mode: 'files_with_matches'
        },
        enabled: true,
        aliasParameters: [
          {
            name: 'query',
            description: 'Search query',
            type: 'string',
            required: true
          }
        ]
      },
      {
        name: 'list-files',
        description: 'List files in directory',
        tool: 'Bash',
        parameters: {
          command: 'ls {{flags}} {{path}}'
        },
        enabled: true,
        aliasParameters: [
          {
            name: 'flags',
            description: 'ls flags',
            type: 'string',
            required: false,
            default: '-la'
          },
          {
            name: 'path',
            description: 'Directory path',
            type: 'string',
            required: false,
            default: '.'
          }
        ]
      },
      {
        name: 'disabled-tool',
        description: 'This tool is disabled',
        tool: 'Read',
        parameters: {
          file_path: '{{file}}'
        },
        enabled: false,
        aliasParameters: [
          {
            name: 'file',
            description: 'File to read',
            type: 'string',
            required: true
          }
        ]
      }
    ];

    context = {
      taskId,
      store,
      aliasResolver: new AliasResolver(sampleAliases)
    };
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('handleAliasResolution', () => {
    it('should resolve known aliases to their target tools', async () => {
      const input: HookInput = {
        tool_name: 'quick-search',
        tool_input: {
          query: 'function.*export'
        }
      };

      const result = await handleAliasResolution(input, 'hook_test_1', context);

      expect(result).toEqual({
        tool_name: 'Grep',
        tool_input: {
          pattern: 'function.*export',
          output_mode: 'files_with_matches'
        }
      });
    });

    it('should apply default parameter values', async () => {
      const input: HookInput = {
        tool_name: 'list-files',
        tool_input: {}
      };

      const result = await handleAliasResolution(input, 'hook_test_2', context);

      expect(result).toEqual({
        tool_name: 'Bash',
        tool_input: {
          command: 'ls -la .'
        }
      });
    });

    it('should override defaults with provided parameters', async () => {
      const input: HookInput = {
        tool_name: 'list-files',
        tool_input: {
          flags: '-lah',
          path: '/tmp'
        }
      };

      const result = await handleAliasResolution(input, 'hook_test_3', context);

      expect(result).toEqual({
        tool_name: 'Bash',
        tool_input: {
          command: 'ls -lah /tmp'
        }
      });
    });

    it('should return empty object for unknown tools', async () => {
      const input: HookInput = {
        tool_name: 'unknown-tool',
        tool_input: {
          someParam: 'value'
        }
      };

      const result = await handleAliasResolution(input, 'hook_test_4', context);

      expect(result).toEqual({});
    });

    it('should return empty object when no alias resolver available', async () => {
      const contextWithoutResolver: HookContext = {
        taskId,
        store
      };

      const input: HookInput = {
        tool_name: 'quick-search',
        tool_input: {
          query: 'test'
        }
      };

      const result = await handleAliasResolution(input, 'hook_test_5', contextWithoutResolver);

      expect(result).toEqual({});
    });

    it('should handle validation errors and log them', async () => {
      const input: HookInput = {
        tool_name: 'quick-search',
        tool_input: {
          // Missing required 'query' parameter
        }
      };

      const result = await handleAliasResolution(input, 'hook_test_6', context);

      expect(result).toEqual({
        error: {
          type: 'AliasResolutionError',
          message: expect.stringContaining('Missing required parameters: query')
        }
      });

      // Verify error was logged
      const logs = await store.getLogs(taskId);
      const errorLog = logs.find(log => log.level === 'error');
      expect(errorLog).toBeDefined();
      expect(errorLog?.message).toContain('Failed to resolve alias');
      expect(errorLog?.metadata?.aliasName).toBe('quick-search');
    });

    it('should handle parameter type validation errors', async () => {
      // Create alias with strict type checking
      const strictAlias: ToolAlias = {
        name: 'strict-tool',
        description: 'Tool with strict types',
        tool: 'TestTool',
        parameters: {
          number_param: '{{num}}',
          string_param: '{{str}}'
        },
        enabled: true,
        aliasParameters: [
          {
            name: 'num',
            description: 'A number',
            type: 'number',
            required: true
          },
          {
            name: 'str',
            description: 'A string',
            type: 'string',
            required: true
          }
        ]
      };

      const strictContext: HookContext = {
        taskId,
        store,
        aliasResolver: new AliasResolver([strictAlias])
      };

      const input: HookInput = {
        tool_name: 'strict-tool',
        tool_input: {
          num: 'not-a-number', // Wrong type
          str: 'valid-string'
        }
      };

      const result = await handleAliasResolution(input, 'hook_test_7', strictContext);

      expect(result).toEqual({
        error: {
          type: 'AliasResolutionError',
          message: expect.stringContaining('num (expected number, got string)')
        }
      });
    });

    it('should handle aliases with complex nested parameters', async () => {
      const complexAlias: ToolAlias = {
        name: 'complex-grep',
        description: 'Complex grep with multiple options',
        tool: 'Grep',
        parameters: {
          pattern: '{{term}}',
          path: '{{dir}}',
          '-A': '{{after}}',
          '-B': '{{before}}',
          '-i': true,
          output_mode: '{{mode}}'
        },
        enabled: true,
        aliasParameters: [
          {
            name: 'term',
            description: 'Search term',
            type: 'string',
            required: true
          },
          {
            name: 'dir',
            description: 'Search directory',
            type: 'string',
            required: false,
            default: '.'
          },
          {
            name: 'after',
            description: 'Lines after match',
            type: 'string',
            required: false,
            default: '2'
          },
          {
            name: 'before',
            description: 'Lines before match',
            type: 'string',
            required: false,
            default: '2'
          },
          {
            name: 'mode',
            description: 'Output mode',
            type: 'string',
            required: false,
            default: 'content'
          }
        ]
      };

      const complexContext: HookContext = {
        taskId,
        store,
        aliasResolver: new AliasResolver([complexAlias])
      };

      const input: HookInput = {
        tool_name: 'complex-grep',
        tool_input: {
          term: 'TODO',
          dir: 'src/',
          after: '5'
        }
      };

      const result = await handleAliasResolution(input, 'hook_test_8', complexContext);

      expect(result).toEqual({
        tool_name: 'Grep',
        tool_input: {
          pattern: 'TODO',
          path: 'src/',
          '-A': '5',
          '-B': '2', // Default value
          '-i': true,
          output_mode: 'content' // Default value
        }
      });
    });
  });

  describe('Integration with createHooks', () => {
    it('should include alias resolution in PreToolUse hooks', () => {
      const hooks = createHooks(context);

      expect(hooks.PreToolUse).toBeDefined();
      expect(Array.isArray(hooks.PreToolUse)).toBe(true);

      // Find the alias resolution hook - it should be applied to all tools
      const aliasHook = hooks.PreToolUse?.find(matcher =>
        matcher.matcher === '*' &&
        matcher.hooks.some(hook => hook.name === 'handleAliasResolution' || hook.toString().includes('aliasResolver'))
      );

      expect(aliasHook).toBeDefined();
    });

    it('should process aliases before other hooks', () => {
      const hooks = createHooks(context);

      // Alias resolution should be first in the PreToolUse hooks
      const firstMatcher = hooks.PreToolUse?.[0];
      expect(firstMatcher?.matcher).toBe('*');
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle alias resolver throwing unexpected errors', async () => {
      // Create a mock alias resolver that throws
      const mockResolver = {
        hasAlias: vi.fn().mockReturnValue(true),
        resolve: vi.fn().mockImplementation(() => {
          throw new Error('Unexpected resolver error');
        })
      } as any;

      const errorContext: HookContext = {
        taskId,
        store,
        aliasResolver: mockResolver
      };

      const input: HookInput = {
        tool_name: 'test-alias',
        tool_input: {}
      };

      const result = await handleAliasResolution(input, 'hook_test_9', errorContext);

      expect(result).toEqual({
        error: {
          type: 'AliasResolutionError',
          message: expect.stringContaining('Unexpected resolver error')
        }
      });
    });

    it('should handle malformed input gracefully', async () => {
      const input = {
        // Missing tool_name
        tool_input: {
          query: 'test'
        }
      } as HookInput;

      const result = await handleAliasResolution(input, 'hook_test_10', context);

      // Should return empty since getToolName will return undefined for malformed input
      expect(result).toEqual({});
    });

    it('should handle null/undefined tool_input', async () => {
      const input: HookInput = {
        tool_name: 'quick-search',
        tool_input: null as any
      };

      // This should not crash - the getToolInput function should handle null gracefully
      const result = await handleAliasResolution(input, 'hook_test_11', context);

      expect(result).toEqual({
        error: {
          type: 'AliasResolutionError',
          message: expect.stringContaining('Missing required parameters')
        }
      });
    });
  });

  describe('Performance and Caching', () => {
    it('should efficiently handle multiple alias resolutions', async () => {
      const startTime = Date.now();

      // Perform multiple resolutions
      for (let i = 0; i < 10; i++) {
        const input: HookInput = {
          tool_name: 'quick-search',
          tool_input: {
            query: `test-query-${i}`
          }
        };

        await handleAliasResolution(input, `hook_test_perf_${i}`, context);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete reasonably quickly (adjust threshold as needed)
      expect(duration).toBeLessThan(1000);
    });

    it('should not cache between different alias names', async () => {
      const input1: HookInput = {
        tool_name: 'quick-search',
        tool_input: { query: 'test1' }
      };

      const input2: HookInput = {
        tool_name: 'list-files',
        tool_input: { path: '/tmp' }
      };

      const result1 = await handleAliasResolution(input1, 'hook_test_12', context);
      const result2 = await handleAliasResolution(input2, 'hook_test_13', context);

      expect(result1.tool_name).toBe('Grep');
      expect(result2.tool_name).toBe('Bash');
    });
  });
});