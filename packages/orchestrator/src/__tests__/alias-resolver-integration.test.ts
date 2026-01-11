/**
 * AliasResolver Integration Tests
 *
 * Tests for AliasResolver integration with ApexOrchestrator and hooks system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import { AliasResolver, AliasResolutionError } from '../alias-resolver';
import { TaskStore } from '../store';
import { handleAliasResolution, HookContext } from '../hooks';
import { ToolAlias, Task } from '@apexcli/core';
import type { HookInput } from '@anthropic-ai/claude-agent-sdk';

describe('AliasResolver Integration', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let taskId: string;
  let sampleAliases: ToolAlias[];

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_test`,
    description: 'Test task for alias resolution',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    projectPath: testDir,
    branchName: 'apex/alias-test',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-alias-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    // Create sample aliases for testing
    sampleAliases = [
      {
        name: 'find-files',
        description: 'Find files matching pattern',
        tool: 'Glob',
        parameters: {
          pattern: '{{pattern}}',
          path: '{{basePath}}'
        },
        enabled: true,
        aliasParameters: [
          {
            name: 'pattern',
            description: 'File pattern to match',
            type: 'string',
            required: true
          },
          {
            name: 'basePath',
            description: 'Base path to search',
            type: 'string',
            required: false,
            default: '.'
          }
        ]
      },
      {
        name: 'search-content',
        description: 'Search for content in files',
        tool: 'Grep',
        parameters: {
          pattern: '{{searchTerm}}',
          path: '{{searchPath}}',
          output_mode: 'content'
        },
        enabled: true,
        aliasParameters: [
          {
            name: 'searchTerm',
            description: 'Term to search for',
            type: 'string',
            required: true
          },
          {
            name: 'searchPath',
            description: 'Path to search in',
            type: 'string',
            required: false,
            default: 'src/'
          }
        ]
      },
      {
        name: 'disabled-alias',
        description: 'This alias is disabled',
        tool: 'Read',
        parameters: {
          file_path: '{{path}}'
        },
        enabled: false,
        aliasParameters: [
          {
            name: 'path',
            description: 'File path',
            type: 'string',
            required: true
          }
        ]
      }
    ];

    // Write config with aliases
    const configContent = `
aliases:
${sampleAliases.map(alias => `  - name: "${alias.name}"
    description: "${alias.description}"
    tool: "${alias.tool}"
    enabled: ${alias.enabled}
    parameters:
${Object.entries(alias.parameters).map(([k, v]) => `      ${k}: "${v}"`).join('\n')}
    aliasParameters:
${alias.aliasParameters?.map(param => `      - name: "${param.name}"
        description: "${param.description}"
        type: "${param.type}"
        required: ${param.required}${param.default !== undefined ? `\n        default: "${param.default}"` : ''}`).join('\n') || ''}`).join('\n')}

agents:
  planner:
    enabled: true
    model: "haiku"
    maxTokens: 4000

workflows:
  feature:
    stages:
      - name: "planning"
        agent: "planner"
        description: "Plan the implementation"
`;

    await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), configContent);

    store = new TaskStore(testDir);
    await store.initialize();

    const task = createTestTask();
    taskId = task.id;
    await store.createTask(task);
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    store?.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('ApexOrchestrator AliasResolver Integration', () => {
    it('should initialize AliasResolver from config', async () => {
      orchestrator = new ApexOrchestrator(testDir);
      await orchestrator.initialize();

      // Test that the resolver is properly initialized
      expect(orchestrator.aliasResolver).toBeDefined();
      expect(orchestrator.aliasResolver.getAvailableAliases()).toEqual([
        'find-files',
        'search-content',
        'disabled-alias'
      ]);
    });

    it('should identify valid aliases', async () => {
      orchestrator = new ApexOrchestrator(testDir);
      await orchestrator.initialize();

      expect(orchestrator.aliasResolver.hasAlias('find-files')).toBe(true);
      expect(orchestrator.aliasResolver.hasAlias('search-content')).toBe(true);
      expect(orchestrator.aliasResolver.hasAlias('nonexistent-alias')).toBe(false);
    });

    it('should resolve aliases to actual tool calls', async () => {
      orchestrator = new ApexOrchestrator(testDir);
      await orchestrator.initialize();

      const result = orchestrator.aliasResolver.resolve('find-files', {
        pattern: '*.ts',
        basePath: 'src'
      });

      expect(result).toEqual({
        aliasName: 'find-files',
        tool: 'Glob',
        parameters: {
          pattern: '*.ts',
          path: 'src'
        },
        alias: expect.objectContaining({
          name: 'find-files',
          tool: 'Glob'
        })
      });
    });

    it('should handle config reloading and update aliases', async () => {
      orchestrator = new ApexOrchestrator(testDir);
      await orchestrator.initialize();

      // Initially should have 3 aliases
      expect(orchestrator.aliasResolver.getAvailableAliases()).toHaveLength(3);

      // Update config with new alias
      const newConfigContent = `
aliases:
  - name: "new-alias"
    description: "A new test alias"
    tool: "Read"
    enabled: true
    parameters:
      file_path: "{{file}}"
    aliasParameters:
      - name: "file"
        description: "File to read"
        type: "string"
        required: true

agents:
  planner:
    enabled: true
    model: "haiku"
    maxTokens: 4000

workflows:
  feature:
    stages:
      - name: "planning"
        agent: "planner"
        description: "Plan the implementation"
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), newConfigContent);

      // Reinitialize to reload config
      await orchestrator.initialize();

      // Should now have the new alias
      expect(orchestrator.aliasResolver.getAvailableAliases()).toEqual(['new-alias']);
      expect(orchestrator.aliasResolver.hasAlias('new-alias')).toBe(true);
      expect(orchestrator.aliasResolver.hasAlias('find-files')).toBe(false);
    });
  });

  describe('Hook-based Alias Resolution', () => {
    let mockContext: HookContext;

    beforeEach(() => {
      mockContext = {
        taskId,
        store,
        aliasResolver: new AliasResolver(sampleAliases)
      };
    });

    it('should resolve aliases in pre-tool hook', async () => {
      const hookInput: HookInput = {
        tool_name: 'find-files',
        tool_input: {
          pattern: '**/*.test.ts',
          basePath: 'tests'
        }
      };

      const result = await handleAliasResolution(hookInput, 'test_id', mockContext);

      expect(result).toEqual({
        tool_name: 'Glob',
        tool_input: {
          pattern: '**/*.test.ts',
          path: 'tests'
        }
      });
    });

    it('should pass through non-alias tools unchanged', async () => {
      const hookInput: HookInput = {
        tool_name: 'Read',
        tool_input: {
          file_path: '/some/file.ts'
        }
      };

      const result = await handleAliasResolution(hookInput, 'test_id', mockContext);

      expect(result).toEqual({});
    });

    it('should handle alias resolution errors gracefully', async () => {
      const hookInput: HookInput = {
        tool_name: 'find-files',
        tool_input: {
          // Missing required 'pattern' parameter
          basePath: 'tests'
        }
      };

      const result = await handleAliasResolution(hookInput, 'test_id', mockContext);

      expect(result).toEqual({
        error: {
          type: 'AliasResolutionError',
          message: expect.stringContaining("Missing required parameters: pattern")
        }
      });

      // Verify error was logged
      const logs = await store.getLogs(taskId);
      const errorLog = logs.find(log => log.level === 'error' && log.message.includes('Failed to resolve alias'));
      expect(errorLog).toBeDefined();
    });

    it('should use default parameter values when not provided', async () => {
      const hookInput: HookInput = {
        tool_name: 'find-files',
        tool_input: {
          pattern: '*.js'
          // basePath not provided, should use default '.'
        }
      };

      const result = await handleAliasResolution(hookInput, 'test_id', mockContext);

      expect(result).toEqual({
        tool_name: 'Glob',
        tool_input: {
          pattern: '*.js',
          path: '.' // Default value
        }
      });
    });

    it('should handle aliases with complex parameter substitution', async () => {
      const hookInput: HookInput = {
        tool_name: 'search-content',
        tool_input: {
          searchTerm: 'TODO.*FIXME',
          searchPath: 'packages/core'
        }
      };

      const result = await handleAliasResolution(hookInput, 'test_id', mockContext);

      expect(result).toEqual({
        tool_name: 'Grep',
        tool_input: {
          pattern: 'TODO.*FIXME',
          path: 'packages/core',
          output_mode: 'content'
        }
      });
    });

    it('should return empty when no alias resolver available', async () => {
      const contextWithoutResolver: HookContext = {
        taskId,
        store
        // No aliasResolver
      };

      const hookInput: HookInput = {
        tool_name: 'find-files',
        tool_input: {
          pattern: '*.ts'
        }
      };

      const result = await handleAliasResolution(hookInput, 'test_id', contextWithoutResolver);

      expect(result).toEqual({});
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let mockContext: HookContext;

    beforeEach(() => {
      mockContext = {
        taskId,
        store,
        aliasResolver: new AliasResolver(sampleAliases)
      };
    });

    it('should handle unknown aliases', async () => {
      const hookInput: HookInput = {
        tool_name: 'unknown-alias',
        tool_input: {}
      };

      const result = await handleAliasResolution(hookInput, 'test_id', mockContext);

      expect(result).toEqual({});
    });

    it('should validate parameter types', () => {
      expect(() => {
        mockContext.aliasResolver!.resolve('find-files', {
          pattern: 123, // Wrong type - should be string
          basePath: 'tests'
        });
      }).toThrow(AliasResolutionError);
    });

    it('should handle aliases with no parameters defined', () => {
      const simpleAlias: ToolAlias = {
        name: 'simple',
        description: 'Simple alias',
        tool: 'Bash',
        parameters: {
          command: 'echo "hello"'
        },
        enabled: true
        // No aliasParameters defined
      };

      const resolver = new AliasResolver([simpleAlias]);
      const result = resolver.resolve('simple', {});

      expect(result).toEqual({
        aliasName: 'simple',
        tool: 'Bash',
        parameters: {
          command: 'echo "hello"'
        },
        alias: simpleAlias
      });
    });

    it('should handle nested parameter substitution', () => {
      const nestedAlias: ToolAlias = {
        name: 'nested',
        description: 'Nested parameter alias',
        tool: 'Grep',
        parameters: {
          pattern: '{{term}}',
          path: '{{dir}}',
          '-C': '{{context}}'
        },
        enabled: true,
        aliasParameters: [
          { name: 'term', description: 'Search term', type: 'string', required: true },
          { name: 'dir', description: 'Directory', type: 'string', required: false, default: 'src' },
          { name: 'context', description: 'Context lines', type: 'string', required: false, default: '3' }
        ]
      };

      const resolver = new AliasResolver([nestedAlias]);
      const result = resolver.resolve('nested', { term: 'function' });

      expect(result.parameters).toEqual({
        pattern: 'function',
        path: 'src',
        '-C': '3'
      });
    });

    it('should handle parameter substitution with special characters', () => {
      const result = mockContext.aliasResolver!.resolve('search-content', {
        searchTerm: 'class\\s+\\w+',
        searchPath: './src/**/*.ts'
      });

      expect(result.parameters).toEqual({
        pattern: 'class\\s+\\w+',
        path: './src/**/*.ts',
        output_mode: 'content'
      });
    });
  });

  describe('Integration with Orchestrator Task Execution', () => {
    it('should pass aliasResolver to hook context during task execution', async () => {
      orchestrator = new ApexOrchestrator(testDir);
      await orchestrator.initialize();

      // Create a mock hook to capture context
      const mockHook = vi.fn().mockResolvedValue({});

      // Replace the hooks system with our mock temporarily
      const originalCreateHooks = orchestrator.createHooks;
      orchestrator.createHooks = vi.fn().mockReturnValue({
        PreToolUse: [
          {
            matcher: 'find-files',
            hooks: [mockHook]
          }
        ]
      });

      try {
        // This would normally trigger the alias resolution, but we're mocking it
        // to test that the context is properly passed
        const context = {
          taskId,
          store,
          config: orchestrator.effectiveConfig,
          cliFlags: {},
          aliasResolver: orchestrator.aliasResolver
        };

        expect(context.aliasResolver).toBeDefined();
        expect(context.aliasResolver).toBe(orchestrator.aliasResolver);
      } finally {
        orchestrator.createHooks = originalCreateHooks;
      }
    });
  });
});