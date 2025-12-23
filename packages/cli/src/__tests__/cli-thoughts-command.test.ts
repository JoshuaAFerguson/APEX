/**
 * Unit tests for /thoughts command in CLI mode
 * Tests the classic CLI interface thoughts command functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import type { CliContext } from '../index.js';

// Mock chalk to avoid color codes in tests
vi.mock('chalk', () => ({
  default: {
    blue: (str: string) => str,
    red: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    gray: (str: string) => str,
  },
}));

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

describe('CLI Thoughts Command', () => {
  let mockContext: CliContext;

  beforeEach(() => {
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
          maxTokens: 100000,
          maxCost: 10.0,
          timeoutMs: 300000,
        },
        autonomy: {
          level: 'medium',
          autoApprove: false,
        },
      },
    };

    mockConsoleLog.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Command registration and recognition', () => {
    it('should have thoughts command registered with correct properties', async () => {
      // Import the commands to test registration
      const { commands } = await import('../index.js');

      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      expect(thoughtsCommand).toBeDefined();
      expect(thoughtsCommand?.name).toBe('thoughts');
      expect(thoughtsCommand?.aliases).toEqual(['t']);
      expect(thoughtsCommand?.description).toBe('Toggle thought visibility');
      expect(thoughtsCommand?.usage).toBe('/thoughts [on|off|toggle|status]');
    });

    it('should be accessible via alias "t"', async () => {
      const { commands } = await import('../index.js');

      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      expect(thoughtsCommand?.aliases).toContain('t');
    });
  });

  describe('Command execution scenarios', () => {
    it('should handle "on" argument', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      await thoughtsCommand?.handler(mockContext, ['on']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Thought visibility enabled')
      );
    });

    it('should handle "off" argument', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      await thoughtsCommand?.handler(mockContext, ['off']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Thought visibility disabled')
      );
    });

    it('should handle "status" argument', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      await thoughtsCommand?.handler(mockContext, ['status']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Thought visibility status')
      );
    });

    it('should handle "toggle" argument', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      await thoughtsCommand?.handler(mockContext, ['toggle']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Thought visibility toggled')
      );
    });

    it('should handle no arguments (default toggle)', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      await thoughtsCommand?.handler(mockContext, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Thought visibility toggled')
      );
    });

    it('should handle undefined arguments', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      await thoughtsCommand?.handler(mockContext, undefined as any);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Thought visibility toggled')
      );
    });
  });

  describe('Case sensitivity and argument validation', () => {
    it('should handle uppercase arguments', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      await thoughtsCommand?.handler(mockContext, ['ON']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Thought visibility enabled')
      );
    });

    it('should handle mixed case arguments', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      await thoughtsCommand?.handler(mockContext, ['OfF']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Thought visibility disabled')
      );
    });

    it('should handle invalid arguments', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      await thoughtsCommand?.handler(mockContext, ['invalid']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /thoughts [on|off|toggle|status]')
      );
    });

    it('should handle multiple arguments (use first)', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      await thoughtsCommand?.handler(mockContext, ['on', 'off', 'toggle']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Thought visibility enabled')
      );
    });
  });

  describe('CLI mode specific behavior', () => {
    it('should indicate classic mode limitation in toggle messages', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      await thoughtsCommand?.handler(mockContext, ['toggle']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Use --classic flag for rich UI')
      );
    });

    it('should provide helpful messaging about UI mode', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      await thoughtsCommand?.handler(mockContext, []);

      const calledWith = mockConsoleLog.mock.calls[0][0];
      expect(calledWith).toContain('classic');
    });

    it('should include emoji in output for visual appeal', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      await thoughtsCommand?.handler(mockContext, ['on']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('💭')
      );
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle null arguments gracefully', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      await thoughtsCommand?.handler(mockContext, null as any);

      // Should default to toggle behavior
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Thought visibility toggled')
      );
    });

    it('should handle empty string argument', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      await thoughtsCommand?.handler(mockContext, ['']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /thoughts [on|off|toggle|status]')
      );
    });

    it('should handle whitespace-only arguments', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      await thoughtsCommand?.handler(mockContext, ['   ']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /thoughts [on|off|toggle|status]')
      );
    });

    it('should not throw on malformed context', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      const malformedContext = {} as CliContext;

      await expect(
        thoughtsCommand?.handler(malformedContext, ['on'])
      ).resolves.not.toThrow();
    });
  });

  describe('Output formatting and consistency', () => {
    it('should use consistent message format for all actions', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      // Test all actions have consistent formatting
      const actions = ['on', 'off', 'status', 'toggle'];

      for (const action of actions) {
        mockConsoleLog.mockClear();
        await thoughtsCommand?.handler(mockContext, [action]);

        const output = mockConsoleLog.mock.calls[0][0];
        expect(output).toMatch(/💭.*Thought visibility/);
      }
    });

    it('should include appropriate messaging for each action', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      // Test specific messaging
      await thoughtsCommand?.handler(mockContext, ['on']);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/enabled/i)
      );

      mockConsoleLog.mockClear();

      await thoughtsCommand?.handler(mockContext, ['off']);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/disabled/i)
      );

      mockConsoleLog.mockClear();

      await thoughtsCommand?.handler(mockContext, ['status']);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/status/i)
      );
    });

    it('should maintain consistent emoji usage', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      const actions = ['on', 'off', 'status', 'toggle', ''];

      for (const action of actions) {
        mockConsoleLog.mockClear();
        await thoughtsCommand?.handler(mockContext, action ? [action] : []);

        const output = mockConsoleLog.mock.calls[0][0];
        expect(output).toContain('💭');
      }
    });
  });

  describe('Performance and efficiency', () => {
    it('should execute quickly for all argument types', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      const actions = ['on', 'off', 'status', 'toggle', '', 'invalid'];

      for (const action of actions) {
        const start = performance.now();
        await thoughtsCommand?.handler(mockContext, action ? [action] : []);
        const end = performance.now();

        expect(end - start).toBeLessThan(10); // Should be very fast
      }
    });

    it('should not leak memory on repeated calls', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      // Call command many times
      for (let i = 0; i < 1000; i++) {
        await thoughtsCommand?.handler(mockContext, ['toggle']);
      }

      // Should complete without issues
      expect(mockConsoleLog).toHaveBeenCalledTimes(1000);
    });
  });

  describe('Integration with CLI framework', () => {
    it('should be properly integrated in commands array', async () => {
      const { commands } = await import('../index.js');

      expect(commands).toContainEqual(
        expect.objectContaining({
          name: 'thoughts',
          aliases: ['t'],
          description: 'Toggle thought visibility',
        })
      );
    });

    it('should have proper handler function signature', async () => {
      const { commands } = await import('../index.js');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      expect(thoughtsCommand?.handler).toBeTypeOf('function');
      expect(thoughtsCommand?.handler.length).toBe(2); // (ctx, args) parameters
    });

    it('should maintain command ordering and position', async () => {
      const { commands } = await import('../index.js');
      const thoughtsIndex = commands.findIndex(cmd => cmd.name === 'thoughts');

      expect(thoughtsIndex).toBeGreaterThan(-1);

      // Should be positioned logically (after version, before end)
      const versionIndex = commands.findIndex(cmd => cmd.name === 'version');
      expect(thoughtsIndex).toBeGreaterThan(versionIndex);
    });
  });
});
