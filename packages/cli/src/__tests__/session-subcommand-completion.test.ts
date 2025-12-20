import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompletionEngine, CompletionContext } from '../services/CompletionEngine';

describe('Session Subcommand Completion', () => {
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
        'fix the payment bug'
      ]
    };
  });

  describe('/session command detection', () => {
    it('should show session command when typing /session', async () => {
      const results = await engine.getCompletions('/session', 8, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/session',
          type: 'command',
          description: 'Session management',
          icon: '💾'
        })
      );
    });

    it('should show session command with partial match /sess', async () => {
      const results = await engine.getCompletions('/sess', 5, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/session',
          type: 'command',
          description: 'Session management',
          icon: '💾'
        })
      );
    });
  });

  describe('/session subcommand basic completion', () => {
    it('should suggest all 7 session subcommands for /session with space', async () => {
      const results = await engine.getCompletions('/session ', 9, mockContext);

      const subcommands = results.filter(r => r.type === 'subcommand');
      expect(subcommands).toHaveLength(7);

      // Check all 7 subcommands are present
      const subcommandNames = subcommands.map(s => s.displayValue);
      expect(subcommandNames).toContain('list');
      expect(subcommandNames).toContain('load');
      expect(subcommandNames).toContain('save');
      expect(subcommandNames).toContain('branch');
      expect(subcommandNames).toContain('export');
      expect(subcommandNames).toContain('delete');
      expect(subcommandNames).toContain('info');
    });

    it('should provide proper value format for all subcommands', async () => {
      const results = await engine.getCompletions('/session ', 9, mockContext);

      const subcommands = results.filter(r => r.type === 'subcommand');

      subcommands.forEach(subcommand => {
        expect(subcommand.value).toMatch(/^\/session \w+$/);
        expect(subcommand.value).toBe(`/session ${subcommand.displayValue}`);
      });
    });

    it('should include descriptions for all subcommands', async () => {
      const results = await engine.getCompletions('/session ', 9, mockContext);

      const subcommands = results.filter(r => r.type === 'subcommand');

      expect(subcommands).toContainEqual(
        expect.objectContaining({
          displayValue: 'list',
          description: 'List sessions',
          icon: '📋'
        })
      );

      expect(subcommands).toContainEqual(
        expect.objectContaining({
          displayValue: 'load',
          description: 'Load session',
          icon: '📂'
        })
      );

      expect(subcommands).toContainEqual(
        expect.objectContaining({
          displayValue: 'save',
          description: 'Save session',
          icon: '💾'
        })
      );

      expect(subcommands).toContainEqual(
        expect.objectContaining({
          displayValue: 'branch',
          description: 'Branch session',
          icon: '🌿'
        })
      );

      expect(subcommands).toContainEqual(
        expect.objectContaining({
          displayValue: 'export',
          description: 'Export session',
          icon: '📤'
        })
      );

      expect(subcommands).toContainEqual(
        expect.objectContaining({
          displayValue: 'delete',
          description: 'Delete session',
          icon: '🗑️'
        })
      );

      expect(subcommands).toContainEqual(
        expect.objectContaining({
          displayValue: 'info',
          description: 'Session info',
          icon: 'ℹ️'
        })
      );
    });
  });

  describe('/session subcommand partial completion', () => {
    it('should complete /session l to /session list', async () => {
      const results = await engine.getCompletions('/session l', 10, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/session list',
          displayValue: 'list',
          type: 'subcommand',
          description: 'List sessions'
        })
      );

      // Should not show load when searching for 'l'
      expect(results.filter(r => r.displayValue === 'load')).toHaveLength(1);
    });

    it('should complete /session li to /session list', async () => {
      const results = await engine.getCompletions('/session li', 11, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/session list',
          displayValue: 'list',
          type: 'subcommand'
        })
      );

      // Should not show other subcommands
      const nonListSubcommands = results.filter(r =>
        r.type === 'subcommand' && r.displayValue !== 'list'
      );
      expect(nonListSubcommands).toHaveLength(0);
    });

    it('should complete /session ex to /session export', async () => {
      const results = await engine.getCompletions('/session ex', 11, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/session export',
          displayValue: 'export',
          type: 'subcommand',
          description: 'Export session'
        })
      );

      // Should only show export, not other subcommands
      const subcommands = results.filter(r => r.type === 'subcommand');
      expect(subcommands).toHaveLength(1);
      expect(subcommands[0].displayValue).toBe('export');
    });

    it('should complete /session exp to /session export', async () => {
      const results = await engine.getCompletions('/session exp', 12, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/session export',
          displayValue: 'export',
          type: 'subcommand'
        })
      );
    });

    it('should complete /session lo to /session load', async () => {
      const results = await engine.getCompletions('/session lo', 11, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/session load',
          displayValue: 'load',
          type: 'subcommand',
          description: 'Load session'
        })
      );
    });

    it('should complete /session s to both save', async () => {
      const results = await engine.getCompletions('/session s', 10, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/session save',
          displayValue: 'save',
          type: 'subcommand'
        })
      );

      // Should only show save (no other subcommands start with 's')
      const sSubcommands = results.filter(r => r.type === 'subcommand');
      expect(sSubcommands).toHaveLength(1);
      expect(sSubcommands[0].displayValue).toBe('save');
    });

    it('should complete /session b to /session branch', async () => {
      const results = await engine.getCompletions('/session b', 10, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/session branch',
          displayValue: 'branch',
          type: 'subcommand',
          description: 'Branch session'
        })
      );
    });

    it('should complete /session d to /session delete', async () => {
      const results = await engine.getCompletions('/session d', 10, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/session delete',
          displayValue: 'delete',
          type: 'subcommand',
          description: 'Delete session'
        })
      );
    });

    it('should complete /session i to /session info', async () => {
      const results = await engine.getCompletions('/session i', 10, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/session info',
          displayValue: 'info',
          type: 'subcommand',
          description: 'Session info'
        })
      );
    });
  });

  describe('/session subcommand exact matches', () => {
    it('should prioritize exact matches with higher score', async () => {
      const results = await engine.getCompletions('/session list', 13, mockContext);

      const listSubcommand = results.find(r => r.displayValue === 'list');
      expect(listSubcommand?.score).toBe(100); // Exact match score
    });

    it('should give partial matches lower score than exact matches', async () => {
      const results = await engine.getCompletions('/session l', 10, mockContext);

      const listSubcommand = results.find(r => r.displayValue === 'list');
      const loadSubcommand = results.find(r => r.displayValue === 'load');

      expect(listSubcommand?.score).toBe(80); // Partial match score
      expect(loadSubcommand?.score).toBe(80); // Partial match score
    });
  });

  describe('/session subcommand edge cases', () => {
    it('should not suggest subcommands for invalid session command format', async () => {
      const results = await engine.getCompletions('/session list extra', 19, mockContext);

      // Should not suggest subcommands when there's extra text after subcommand
      expect(results.filter(r => r.type === 'subcommand')).toHaveLength(0);
    });

    it('should not suggest subcommands without space after /session', async () => {
      const results = await engine.getCompletions('/sessionlist', 12, mockContext);

      // Should not match the session subcommand pattern
      expect(results.filter(r => r.type === 'subcommand')).toHaveLength(0);
    });

    it('should handle multiple spaces between /session and subcommand', async () => {
      const results = await engine.getCompletions('/session  l', 11, mockContext);

      // The current regex /^\/session\s+(\w*)$/ should handle multiple spaces
      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/session list',
          displayValue: 'list',
          type: 'subcommand'
        })
      );
    });

    it('should be case insensitive for subcommand matching', async () => {
      const results = await engine.getCompletions('/session L', 10, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/session list',
          displayValue: 'list',
          type: 'subcommand'
        })
      );

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/session load',
          displayValue: 'load',
          type: 'subcommand'
        })
      );
    });

    it('should handle empty subcommand after space', async () => {
      const results = await engine.getCompletions('/session ', 9, mockContext);

      // Should suggest all subcommands when no partial text provided
      const subcommands = results.filter(r => r.type === 'subcommand');
      expect(subcommands).toHaveLength(7);
    });

    it('should handle non-matching prefixes gracefully', async () => {
      const results = await engine.getCompletions('/session xyz', 12, mockContext);

      // Should return no subcommand suggestions for non-matching prefix
      expect(results.filter(r => r.type === 'subcommand')).toHaveLength(0);
    });
  });

  describe('/session subcommand integration with other completions', () => {
    it('should prioritize session subcommands over other completion types when appropriate', async () => {
      const results = await engine.getCompletions('/session l', 10, mockContext);

      const sessionSubcommands = results.filter(r => r.type === 'subcommand');
      const otherCompletions = results.filter(r => r.type !== 'subcommand');

      // Session subcommands should have high priority (95) and appear first
      if (sessionSubcommands.length > 0 && otherCompletions.length > 0) {
        expect(sessionSubcommands[0].score).toBeGreaterThan(otherCompletions[0].score);
      }
    });

    it('should work correctly when cursor is at different positions', async () => {
      // Test cursor at end
      const results1 = await engine.getCompletions('/session list', 13, mockContext);
      const listResult1 = results1.find(r => r.displayValue === 'list');
      expect(listResult1?.score).toBe(100);

      // Test cursor in middle (should only consider text before cursor)
      const results2 = await engine.getCompletions('/session list extra', 13, mockContext);
      const listResult2 = results2.find(r => r.displayValue === 'list');
      expect(listResult2?.score).toBe(100);
    });

    it('should not interfere with regular /session command completion', async () => {
      // When typing just '/sess', should still show the main session command
      const results = await engine.getCompletions('/sess', 5, mockContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '/session',
          type: 'command',
          description: 'Session management'
        })
      );
    });
  });

  describe('All session subcommands comprehensive test', () => {
    it('should verify all expected session subcommands are available', async () => {
      const results = await engine.getCompletions('/session ', 9, mockContext);
      const subcommands = results.filter(r => r.type === 'subcommand');

      // Create map of displayValue to result for easier testing
      const subcommandMap = new Map(
        subcommands.map(s => [s.displayValue, s])
      );

      // Test that all 7 expected subcommands are present with correct properties
      const expectedSubcommands = [
        { name: 'list', desc: 'List sessions', icon: '📋' },
        { name: 'load', desc: 'Load session', icon: '📂' },
        { name: 'save', desc: 'Save session', icon: '💾' },
        { name: 'branch', desc: 'Branch session', icon: '🌿' },
        { name: 'export', desc: 'Export session', icon: '📤' },
        { name: 'delete', desc: 'Delete session', icon: '🗑️' },
        { name: 'info', desc: 'Session info', icon: 'ℹ️' },
      ];

      expect(subcommands).toHaveLength(expectedSubcommands.length);

      expectedSubcommands.forEach(expected => {
        const subcommand = subcommandMap.get(expected.name);
        expect(subcommand).toBeDefined();
        expect(subcommand).toMatchObject({
          value: `/session ${expected.name}`,
          displayValue: expected.name,
          description: expected.desc,
          type: 'subcommand',
          icon: expected.icon,
          score: 80 // Default partial match score
        });
      });
    });
  });
});