/**
 * Unit tests for the /think command functionality
 * Tests the thought capture, list, search, and promotion features
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import type { CliContext } from '../index.js';
import type { ThoughtCapture } from '@apexcli/core';

// Mock chalk to avoid color codes in tests
vi.mock('chalk', () => ({
  default: {
    blue: (str: string) => str,
    red: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    gray: (str: string) => str,
    cyan: (str: string) => str,
    bold: (str: string) => str,
    magenta: { bold: (str: string) => str },
  },
}));

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

describe('Think Command', () => {
  let mockContext: CliContext;
  let mockOrchestrator: any;

  beforeEach(() => {
    // Create mock orchestrator
    mockOrchestrator = {
      captureThought: vi.fn(),
      getAllThoughts: vi.fn(),
      searchThoughts: vi.fn(),
      promoteThought: vi.fn(),
      getThoughtStats: vi.fn(),
      exportThoughtsToMarkdown: vi.fn(),
    };

    mockContext = {
      cwd: '/test/project',
      initialized: true,
      config: {
        project: {
          name: 'Test Project',
          description: 'Test project',
        },
        agents: {},
        workflows: {},
        limits: {
          maxTokensPerTask: 100000,
          maxCostPerTask: 10.0,
          dailyBudget: 100.0,
          timeoutMs: 300000,
        },
        autonomy: {
          default: 'medium',
          autoApprove: false,
        },
        api: {
          url: 'http://localhost:3000',
          port: 3000,
        },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
          review: 'haiku',
        },
      },
      orchestrator: mockOrchestrator,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };

    mockConsoleLog.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Command registration', () => {
    it('should have think command registered with correct properties', async () => {
      const { commands } = await import('../index.js');

      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      expect(thinkCommand).toBeDefined();
      expect(thinkCommand?.name).toBe('think');
      expect(thinkCommand?.aliases).toEqual(['t']);
      expect(thinkCommand?.description).toBe('Thought capture system - capture, list, search, and promote thoughts');
      expect(thinkCommand?.usage).toBe('/think <thought> | /think --list | /think --search <query> | /think --promote <id>');
    });

    it('should be accessible via alias "t"', async () => {
      const { commands } = await import('../index.js');

      const thinkCommand = commands.find(cmd => cmd.name === 'think');
      expect(thinkCommand?.aliases).toContain('t');
    });
  });

  describe('Thought capture', () => {
    it('should capture a basic thought', async () => {
      const mockThought: ThoughtCapture = {
        id: 'thought-123',
        content: 'Add dark mode support',
        tags: [],
        priority: 'medium',
        status: 'captured',
        createdAt: new Date(),
      };

      mockOrchestrator.captureThought.mockResolvedValue(mockThought);

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['Add dark mode support']);

      expect(mockOrchestrator.captureThought).toHaveBeenCalledWith(
        'Add dark mode support',
        { priority: 'medium', tags: [] }
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Thought captured successfully!')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('ID: thought-123')
      );
    });

    it('should capture thought with high priority', async () => {
      const mockThought: ThoughtCapture = {
        id: 'thought-456',
        content: 'Fix security vulnerability',
        tags: [],
        priority: 'high',
        status: 'captured',
        createdAt: new Date(),
      };

      mockOrchestrator.captureThought.mockResolvedValue(mockThought);

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['Fix security vulnerability', '--priority', 'high']);

      expect(mockOrchestrator.captureThought).toHaveBeenCalledWith(
        'Fix security vulnerability',
        { priority: 'high', tags: [] }
      );
    });

    it('should capture thought with tags', async () => {
      const mockThought: ThoughtCapture = {
        id: 'thought-789',
        content: 'Implement caching',
        tags: ['performance', 'optimization'],
        priority: 'medium',
        status: 'captured',
        createdAt: new Date(),
      };

      mockOrchestrator.captureThought.mockResolvedValue(mockThought);

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['Implement caching', '--tag', 'performance,optimization']);

      expect(mockOrchestrator.captureThought).toHaveBeenCalledWith(
        'Implement caching',
        { priority: 'medium', tags: ['performance', 'optimization'] }
      );
    });

    it('should handle capture errors gracefully', async () => {
      mockOrchestrator.captureThought.mockRejectedValue(new Error('Failed to save thought'));

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['Test thought']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Error: Failed to save thought')
      );
    });

    it('should require non-empty content', async () => {
      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['--priority', 'high']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Please provide thought content')
      );
      expect(mockOrchestrator.captureThought).not.toHaveBeenCalled();
    });
  });

  describe('List thoughts', () => {
    it('should list captured thoughts', async () => {
      const mockThoughts: ThoughtCapture[] = [
        {
          id: 'thought-1',
          content: 'Add authentication',
          tags: ['security'],
          priority: 'high',
          status: 'captured',
          createdAt: new Date('2023-01-01'),
        },
        {
          id: 'thought-2',
          content: 'Implement dark mode',
          tags: ['ui'],
          priority: 'medium',
          status: 'captured',
          createdAt: new Date('2023-01-02'),
        },
      ];

      mockOrchestrator.getAllThoughts.mockResolvedValue(mockThoughts);

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['--list']);

      expect(mockOrchestrator.getAllThoughts).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Captured Thoughts (2)')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Add authentication')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Implement dark mode')
      );
    });

    it('should handle empty thoughts list', async () => {
      mockOrchestrator.getAllThoughts.mockResolvedValue([]);

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['--list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No thoughts captured yet')
      );
    });

    it('should limit list to 20 thoughts and show count', async () => {
      const mockThoughts = Array.from({ length: 25 }, (_, i) => ({
        id: `thought-${i}`,
        content: `Thought ${i}`,
        tags: [],
        priority: 'medium' as const,
        status: 'captured' as const,
        createdAt: new Date(),
      }));

      mockOrchestrator.getAllThoughts.mockResolvedValue(mockThoughts);

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['--list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('... and 5 more')
      );
    });
  });

  describe('Search thoughts', () => {
    it('should search thoughts by query', async () => {
      const mockSearchResults: ThoughtCapture[] = [
        {
          id: 'thought-1',
          content: 'Add authentication system',
          tags: ['security'],
          priority: 'high',
          status: 'captured',
          createdAt: new Date(),
        },
      ];

      mockOrchestrator.searchThoughts.mockResolvedValue(mockSearchResults);

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['--search', 'authentication']);

      expect(mockOrchestrator.searchThoughts).toHaveBeenCalledWith({
        query: 'authentication',
      });
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Search Results for "authentication" (1)')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Add authentication system')
      );
    });

    it('should handle empty search results', async () => {
      mockOrchestrator.searchThoughts.mockResolvedValue([]);

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['--search', 'nonexistent']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No thoughts found matching: "nonexistent"')
      );
    });

    it('should require search query', async () => {
      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['--search']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /think --search <query>')
      );
    });
  });

  describe('Promote thoughts', () => {
    it('should promote thought to task', async () => {
      const mockThoughts: ThoughtCapture[] = [
        {
          id: 'thought-promote-123',
          content: 'Add user registration',
          tags: [],
          priority: 'high',
          status: 'captured',
          createdAt: new Date(),
        },
      ];

      mockOrchestrator.getAllThoughts.mockResolvedValue(mockThoughts);
      mockOrchestrator.promoteThought.mockResolvedValue('task-456');

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['--promote', 'thought-promote']);

      expect(mockOrchestrator.promoteThought).toHaveBeenCalledWith('thought-promote-123');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Thought promoted successfully!')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('New task ID: task-456')
      );
    });

    it('should handle promoting non-existent thought', async () => {
      mockOrchestrator.getAllThoughts.mockResolvedValue([]);

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['--promote', 'nonexistent']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Thought not found: nonexistent')
      );
    });

    it('should handle already implemented thought', async () => {
      const mockThoughts: ThoughtCapture[] = [
        {
          id: 'thought-implemented-123',
          content: 'Already done',
          tags: [],
          priority: 'medium',
          status: 'implemented',
          createdAt: new Date(),
          taskId: 'task-123',
        },
      ];

      mockOrchestrator.getAllThoughts.mockResolvedValue(mockThoughts);

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['--promote', 'thought-implemented']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('has already been implemented')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task ID: task-123')
      );
    });

    it('should require promotion ID', async () => {
      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['--promote']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /think --promote <thought_id>')
      );
    });
  });

  describe('Statistics', () => {
    it('should display thought statistics', async () => {
      const mockStats = {
        total: 10,
        implementationRate: 0.3,
        byStatus: {
          captured: 5,
          planned: 2,
          implemented: 3,
          discarded: 0,
        },
        byPriority: {
          high: 2,
          medium: 6,
          low: 2,
        },
        byTag: {
          performance: 3,
          ui: 4,
        },
        avgTimeToImplementation: 86400000,
      };

      mockOrchestrator.getThoughtStats.mockResolvedValue(mockStats);

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['--stats']);

      expect(mockOrchestrator.getThoughtStats).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Thought Statistics')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Total thoughts: 10')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Implementation rate: 30.0%')
      );
    });

    it('should handle empty statistics', async () => {
      const mockStats = {
        total: 0,
        implementationRate: 0,
        byStatus: {
          captured: 0,
          planned: 0,
          implemented: 0,
          discarded: 0,
        },
        byPriority: {
          high: 0,
          medium: 0,
          low: 0,
        },
        byTag: {},
        avgTimeToImplementation: 0,
      };

      mockOrchestrator.getThoughtStats.mockResolvedValue(mockStats);

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['--stats']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Total thoughts: 0')
      );
    });
  });

  describe('Export', () => {
    it('should export thoughts to markdown without file', async () => {
      const mockMarkdown = '# Captured Thoughts\n\n## Statistics\n...';
      mockOrchestrator.exportThoughtsToMarkdown.mockResolvedValue(mockMarkdown);

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['--export']);

      expect(mockOrchestrator.exportThoughtsToMarkdown).toHaveBeenCalledWith(undefined);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Thoughts exported:')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(mockMarkdown)
      );
    });

    it('should export thoughts to specified file', async () => {
      const mockMarkdown = '# Captured Thoughts\n\n## Statistics\n...';
      mockOrchestrator.exportThoughtsToMarkdown.mockResolvedValue(mockMarkdown);

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['--export', 'thoughts.md']);

      expect(mockOrchestrator.exportThoughtsToMarkdown).toHaveBeenCalledWith('thoughts.md');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Thoughts exported to: thoughts.md')
      );
    });
  });

  describe('Error handling', () => {
    it('should handle uninitialized context', async () => {
      const uninitializedContext = { ...mockContext, initialized: false, orchestrator: null };

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(uninitializedContext, ['test thought']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized. Run /init first.')
      );
    });

    it('should handle missing orchestrator', async () => {
      const contextWithoutOrchestrator = { ...mockContext, orchestrator: null };

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(contextWithoutOrchestrator, ['test thought']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized. Run /init first.')
      );
    });

    it('should handle no arguments', async () => {
      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /think <thought>')
      );
    });

    it('should handle unknown action', async () => {
      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['--unknown', 'action']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Unknown action: --unknown')
      );
    });
  });

  describe('Integration', () => {
    it('should work with different priority levels', async () => {
      const mockThought: ThoughtCapture = {
        id: 'thought-priority-test',
        content: 'Test priority',
        tags: [],
        priority: 'low',
        status: 'captured',
        createdAt: new Date(),
      };

      mockOrchestrator.captureThought.mockResolvedValue(mockThought);

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      // Test low priority
      await thinkCommand?.handler(mockContext, ['Test priority', '--priority', 'low']);

      expect(mockOrchestrator.captureThought).toHaveBeenCalledWith(
        'Test priority',
        { priority: 'low', tags: [] }
      );
    });

    it('should handle multiple tag values correctly', async () => {
      const mockThought: ThoughtCapture = {
        id: 'thought-tags-test',
        content: 'Test tags',
        tags: ['tag1', 'tag2', 'tag3'],
        priority: 'medium',
        status: 'captured',
        createdAt: new Date(),
      };

      mockOrchestrator.captureThought.mockResolvedValue(mockThought);

      const { commands } = await import('../index.js');
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      await thinkCommand?.handler(mockContext, ['Test tags', '--tag', 'tag1,tag2,tag3']);

      expect(mockOrchestrator.captureThought).toHaveBeenCalledWith(
        'Test tags',
        { priority: 'medium', tags: ['tag1', 'tag2', 'tag3'] }
      );
    });
  });
});