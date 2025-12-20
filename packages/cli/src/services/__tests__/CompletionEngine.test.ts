import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { CompletionEngine, CompletionProvider, CompletionContext, CompletionSuggestion } from '../CompletionEngine';

vi.mock('fs/promises');
vi.mock('os');

const mockFs = vi.mocked(fs);
const mockOs = vi.mocked(os);

describe('CompletionEngine', () => {
  let engine: CompletionEngine;
  let mockContext: CompletionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new CompletionEngine();

    mockContext = {
      projectPath: '/test/project',
      agents: ['planner', 'architect', 'developer', 'reviewer', 'tester', 'devops'],
      workflows: ['feature', 'bugfix', 'refactor'],
      recentTasks: [
        { id: 'task_123456', description: 'Implement user authentication' },
        { id: 'task_789012', description: 'Fix bug in payment processor' }
      ],
      inputHistory: [
        'add authentication to the login page',
        'fix the payment bug',
        'update documentation',
        'create new component'
      ]
    };

    // Mock OS
    mockOs.homedir.mockReturnValue('/home/user');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('provider registration', () => {
    it('should register custom providers', () => {
      const customProvider: CompletionProvider = {
        type: 'custom',
        trigger: /test/,
        priority: 50,
        async getSuggestions() {
          return [{ value: 'test', type: 'custom', score: 50 }];
        }
      };

      engine.registerProvider(customProvider);

      expect(engine).toBeDefined();
    });

    it('should sort providers by priority', async () => {
      const lowPriorityProvider: CompletionProvider = {
        type: 'low',
        trigger: /test/,
        priority: 10,
        async getSuggestions() {
          return [{ value: 'low', type: 'low', score: 10 }];
        }
      };

      const highPriorityProvider: CompletionProvider = {
        type: 'high',
        trigger: /test/,
        priority: 90,
        async getSuggestions() {
          return [{ value: 'high', type: 'high', score: 90 }];
        }
      };

      engine.registerProvider(lowPriorityProvider);
      engine.registerProvider(highPriorityProvider);

      const results = await engine.getCompletions('test', 4, mockContext);

      // High priority provider should be processed first
      expect(results[0]).toMatchObject({ value: 'high', type: 'high' });
    });
  });

  describe('command completion', () => {
    it('should complete slash commands', async () => {
      const results = await engine.getCompletions('/he', 3, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/help',
          type: 'command',
          description: 'Show help',
          icon: '?'
        })
      );
    });

    it('should complete exact command matches with higher score', async () => {
      const results = await engine.getCompletions('/help', 5, mockContext);

      const helpCommand = results.find(r => r.value === '/help');
      expect(helpCommand?.score).toBe(100);
    });

    it('should filter commands by prefix', async () => {
      const results = await engine.getCompletions('/sta', 4, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/status',
          description: 'Task status'
        })
      );

      expect(results).not.toContainEqual(
        expect.objectContaining({
          value: '/help'
        })
      );
    });

    it('should complete session subcommands', async () => {
      const results = await engine.getCompletions('/session li', 11, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/session list',
          displayValue: 'list',
          type: 'subcommand',
          description: 'List sessions'
        })
      );
    });

    it('should complete session subcommands with partial match', async () => {
      const results = await engine.getCompletions('/session exp', 12, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/session export',
          displayValue: 'export'
        })
      );
    });

    it('should not complete session subcommands for invalid format', async () => {
      const results = await engine.getCompletions('/session list extra', 19, mockContext);

      expect(results.filter(r => r.type === 'subcommand')).toHaveLength(0);
    });

    it('should complete compact command', async () => {
      const results = await engine.getCompletions('/comp', 5, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/compact',
          type: 'command',
          description: 'Toggle compact mode',
          icon: '📦'
        })
      );
    });

    it('should complete verbose command', async () => {
      const results = await engine.getCompletions('/verb', 5, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/verbose',
          type: 'command',
          description: 'Toggle verbose mode',
          icon: '📢'
        })
      );
    });

    it('should complete display mode commands with /c prefix', async () => {
      const results = await engine.getCompletions('/c', 2, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/compact'
        })
      );
      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/config'
        })
      );
      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/cancel'
        })
      );
      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/clear'
        })
      );
    });

    it('should complete display mode commands with /v prefix', async () => {
      const results = await engine.getCompletions('/v', 2, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/verbose'
        })
      );
    });
  });

  describe('file path completion', () => {
    beforeEach(() => {
      // Mock file system entries
      mockFs.readdir.mockResolvedValue([
        { name: 'src', isDirectory: () => true } as any,
        { name: 'package.json', isDirectory: () => false } as any,
        { name: 'README.md', isDirectory: () => false } as any,
        { name: '.git', isDirectory: () => true } as any,
      ]);
    });

    it('should complete relative paths', async () => {
      const results = await engine.getCompletions('edit ./src', 9, mockContext);

      expect(mockFs.readdir).toHaveBeenCalledWith(
        path.resolve(mockContext.projectPath, '.'),
        { withFileTypes: true }
      );

      expect(results).toContainEqual(
        expect.objectContaining({
          value: expect.stringContaining('src/'),
          displayValue: 'src/',
          type: 'directory',
          icon: '📁'
        })
      );
    });

    it('should complete files without trailing slash', async () => {
      const results = await engine.getCompletions('read package', 12, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          displayValue: 'package.json',
          type: 'file',
          icon: '📄'
        })
      );
    });

    it('should filter hidden files', async () => {
      const results = await engine.getCompletions('ls ./', 5, mockContext);

      expect(results).not.toContainEqual(
        expect.objectContaining({
          displayValue: '.git/'
        })
      );
    });

    it('should resolve home directory paths', async () => {
      const results = await engine.getCompletions('edit ~/doc', 9, mockContext);

      expect(mockFs.readdir).toHaveBeenCalledWith('/home/user', { withFileTypes: true });
    });

    it('should handle absolute paths', async () => {
      const results = await engine.getCompletions('read /etc/pas', 12, mockContext);

      expect(mockFs.readdir).toHaveBeenCalledWith('/etc', { withFileTypes: true });
    });

    it('should handle file system errors gracefully', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      const results = await engine.getCompletions('read ./secret', 13, mockContext);

      expect(results.filter(r => r.type === 'file' || r.type === 'directory')).toHaveLength(0);
    });

    it('should limit file suggestions to 20', async () => {
      // Create 25 mock entries
      const manyEntries = Array.from({ length: 25 }, (_, i) => ({
        name: `file${i}.txt`,
        isDirectory: () => false
      }));
      mockFs.readdir.mockResolvedValue(manyEntries as any);

      const results = await engine.getCompletions('read file', 9, mockContext);
      const fileResults = results.filter(r => r.type === 'file');

      expect(fileResults.length).toBeLessThanOrEqual(20);
    });
  });

  describe('agent completion', () => {
    it('should complete agent names with @ prefix', async () => {
      const results = await engine.getCompletions('ask @plan', 8, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '@planner',
          displayValue: '@planner',
          type: 'agent',
          description: 'Creates implementation plans',
          icon: '🤖'
        })
      );
    });

    it('should filter agents by partial match', async () => {
      const results = await engine.getCompletions('assign @dev', 10, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '@developer',
          description: 'Writes production code'
        })
      );

      expect(results).not.toContainEqual(
        expect.objectContaining({
          value: '@planner'
        })
      );
    });

    it('should provide exact match with higher score', async () => {
      const results = await engine.getCompletions('use @tester', 10, mockContext);

      const testerAgent = results.find(r => r.value === '@tester');
      expect(testerAgent?.score).toBe(100);
    });

    it('should handle agents not in predefined descriptions', async () => {
      const customContext = {
        ...mockContext,
        agents: ['planner', 'custom-agent']
      };

      const results = await engine.getCompletions('@custom', 7, customContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '@custom-agent',
          description: 'Agent: custom-agent'
        })
      );
    });

    it('should not complete without @ prefix', async () => {
      const results = await engine.getCompletions('planner help', 11, mockContext);

      expect(results.filter(r => r.type === 'agent')).toHaveLength(0);
    });
  });

  describe('workflow completion', () => {
    it('should complete workflow names with --workflow flag', async () => {
      const results = await engine.getCompletions('run --workflow fea', 18, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: 'feature',
          displayValue: 'feature',
          type: 'workflow',
          description: 'Full feature implementation',
          icon: '⚙️'
        })
      );
    });

    it('should filter workflows by prefix', async () => {
      const results = await engine.getCompletions('execute --workflow bug', 22, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: 'bugfix',
          description: 'Bug investigation and fix'
        })
      );

      expect(results).not.toContainEqual(
        expect.objectContaining({
          value: 'feature'
        })
      );
    });

    it('should handle custom workflows', async () => {
      const customContext = {
        ...mockContext,
        workflows: ['feature', 'custom-workflow']
      };

      const results = await engine.getCompletions('start --workflow custom', 23, customContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: 'custom-workflow',
          description: 'Workflow: custom-workflow'
        })
      );
    });
  });

  describe('task ID completion', () => {
    it('should complete task IDs', async () => {
      const results = await engine.getCompletions('retry task_123', 14, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: 'task_123456',
          displayValue: 'task_123456'.slice(0, 16),
          type: 'task',
          description: 'Implement user authentication'.slice(0, 50),
          icon: '📋'
        })
      );
    });

    it('should filter task IDs by prefix', async () => {
      const results = await engine.getCompletions('cancel task_789', 15, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: 'task_789012',
          description: 'Fix bug in payment processor'.slice(0, 50)
        })
      );

      expect(results).not.toContainEqual(
        expect.objectContaining({
          value: 'task_123456'
        })
      );
    });

    it('should limit task suggestions to 10', async () => {
      const manyTasks = Array.from({ length: 15 }, (_, i) => ({
        id: `task_${i.toString().padStart(6, '0')}`,
        description: `Task ${i}`
      }));

      const contextWithManyTasks = { ...mockContext, recentTasks: manyTasks };
      const results = await engine.getCompletions('task_', 5, contextWithManyTasks);
      const taskResults = results.filter(r => r.type === 'task');

      expect(taskResults.length).toBeLessThanOrEqual(10);
    });
  });

  describe('history completion', () => {
    it('should complete from input history', async () => {
      const results = await engine.getCompletions('add auth', 8, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: 'add authentication to the login page',
          type: 'history',
          description: 'From history',
          icon: '📝'
        })
      );
    });

    it('should not suggest exact matches', async () => {
      const results = await engine.getCompletions('fix the payment bug', 19, mockContext);

      // Should not suggest the exact same input
      expect(results.filter(r => r.type === 'history')).toHaveLength(0);
    });

    it('should limit to recent history', async () => {
      const longHistory = Array.from({ length: 100 }, (_, i) => `command ${i}`);
      const contextWithLongHistory = { ...mockContext, inputHistory: longHistory };

      const results = await engine.getCompletions('command', 7, contextWithLongHistory);
      const historyResults = results.filter(r => r.type === 'history');

      expect(historyResults.length).toBeLessThanOrEqual(5);
    });

    it('should score more recent history higher', async () => {
      const results = await engine.getCompletions('create', 6, mockContext);
      const historyResults = results.filter(r => r.type === 'history');

      // More recent entries should have higher scores
      if (historyResults.length > 1) {
        expect(historyResults[0].score).toBeGreaterThanOrEqual(historyResults[1].score);
      }
    });

    it('should truncate long suggestions', async () => {
      const longCommand = 'a'.repeat(100);
      const contextWithLongCommand = {
        ...mockContext,
        inputHistory: [longCommand]
      };

      const results = await engine.getCompletions('a', 1, contextWithLongCommand);
      const historyResult = results.find(r => r.type === 'history');

      expect(historyResult?.displayValue?.length).toBeLessThanOrEqual(60);
      expect(historyResult?.displayValue).toContain('...');
    });

    it('should require minimum input length', async () => {
      const results = await engine.getCompletions('a', 1, mockContext);

      expect(results.filter(r => r.type === 'history')).toHaveLength(0);
    });
  });

  describe('task pattern completion', () => {
    it('should complete common task patterns', async () => {
      const results = await engine.getCompletions('fix the', 7, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: 'fix the bug in',
          type: 'template',
          description: 'Common task pattern',
          icon: '✨'
        })
      );
    });

    it('should complete various action patterns', async () => {
      const patterns = [
        { input: 'add a', expected: 'add a new feature for' },
        { input: 'update the', expected: 'update the documentation for' },
        { input: 'implement', expected: 'implement the logic for' },
        { input: 'create a', expected: 'create a new component for' },
        { input: 'remove', expected: 'remove deprecated code from' },
        { input: 'refactor', expected: 'refactor the code in' },
        { input: 'test', expected: 'test the functionality of' },
        { input: 'document', expected: 'document the API for' }
      ];

      for (const { input, expected } of patterns) {
        const results = await engine.getCompletions(input, input.length, mockContext);
        expect(results).toContainEqual(
          expect.objectContaining({
            value: expected,
            type: 'template'
          })
        );
      }
    });

    it('should not complete patterns for non-matching input', async () => {
      const results = await engine.getCompletions('random text', 11, mockContext);

      expect(results.filter(r => r.type === 'template')).toHaveLength(0);
    });
  });

  describe('completion integration', () => {
    it('should deduplicate identical suggestions', async () => {
      // Create custom providers that might return duplicates
      const provider1: CompletionProvider = {
        type: 'test1',
        trigger: /test/,
        priority: 80,
        async getSuggestions() {
          return [{ value: 'duplicate', type: 'test', score: 80 }];
        }
      };

      const provider2: CompletionProvider = {
        type: 'test2',
        trigger: /test/,
        priority: 70,
        async getSuggestions() {
          return [{ value: 'duplicate', type: 'test', score: 70 }];
        }
      };

      engine.registerProvider(provider1);
      engine.registerProvider(provider2);

      const results = await engine.getCompletions('test', 4, mockContext);
      const duplicates = results.filter(r => r.value === 'duplicate');

      expect(duplicates).toHaveLength(1);
    });

    it('should sort by score descending', async () => {
      const results = await engine.getCompletions('/he', 3, mockContext);

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    it('should limit total results to 15', async () => {
      // Use input that matches multiple providers
      const results = await engine.getCompletions('/', 1, mockContext);

      expect(results.length).toBeLessThanOrEqual(15);
    });

    it('should handle provider errors gracefully', async () => {
      const errorProvider: CompletionProvider = {
        type: 'error',
        trigger: /test/,
        priority: 100,
        async getSuggestions() {
          throw new Error('Provider error');
        }
      };

      const workingProvider: CompletionProvider = {
        type: 'working',
        trigger: /test/,
        priority: 50,
        async getSuggestions() {
          return [{ value: 'working', type: 'test', score: 50 }];
        }
      };

      engine.registerProvider(errorProvider);
      engine.registerProvider(workingProvider);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const results = await engine.getCompletions('test', 4, mockContext);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Completion provider error failed:',
        expect.any(Error)
      );
      expect(results).toContainEqual(
        expect.objectContaining({ value: 'working' })
      );

      consoleSpy.mockRestore();
    });

    it('should handle cursor position correctly', async () => {
      const results = await engine.getCompletions('/help extra', 5, mockContext);

      // Should complete based on input up to cursor position
      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/help'
        })
      );
    });

    it('should work with empty input', async () => {
      const results = await engine.getCompletions('', 0, mockContext);

      // Should not crash and return empty results
      expect(results).toEqual([]);
    });

    it('should work with context missing optional fields', async () => {
      const minimalContext: CompletionContext = {
        projectPath: '/test',
        agents: [],
        workflows: [],
        recentTasks: [],
        inputHistory: []
      };

      const results = await engine.getCompletions('/help', 5, minimalContext);

      // Should still work with empty context
      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/help'
        })
      );
    });
  });
});