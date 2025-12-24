/**
 * Test for command alias resolution and conflict prevention
 * Ensures that the think command and thoughts command don't conflict
 */

import { describe, it, expect } from 'vitest';
import { commands } from '../index.js';

describe('Command Alias Resolution', () => {
  describe('Think vs Thoughts commands', () => {
    it('should have separate commands for think and thoughts', () => {
      const thinkCommand = commands.find(cmd => cmd.name === 'think');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      expect(thinkCommand).toBeDefined();
      expect(thoughtsCommand).toBeDefined();
      expect(thinkCommand?.name).toBe('think');
      expect(thoughtsCommand?.name).toBe('thoughts');
    });

    it('should have distinct functionality descriptions', () => {
      const thinkCommand = commands.find(cmd => cmd.name === 'think');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      expect(thinkCommand?.description).toContain('capture');
      expect(thoughtsCommand?.description).toContain('Toggle');
    });

    it('should resolve alias "t" to think command only', () => {
      const thinkCommand = commands.find(cmd => cmd.name === 'think');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      expect(thinkCommand?.aliases).toContain('t');
      expect(thoughtsCommand?.aliases).not.toContain('t');
      expect(thoughtsCommand?.aliases).toEqual([]);
    });

    it('should have no duplicate aliases across all commands', () => {
      const aliasMap = new Map<string, string[]>();

      for (const command of commands) {
        for (const alias of command.aliases) {
          if (!aliasMap.has(alias)) {
            aliasMap.set(alias, []);
          }
          aliasMap.get(alias)!.push(command.name);
        }
      }

      // Check for conflicts
      const conflicts: string[] = [];
      for (const [alias, commandNames] of aliasMap.entries()) {
        if (commandNames.length > 1) {
          conflicts.push(`Alias '${alias}' conflicts: ${commandNames.join(', ')}`);
        }
      }

      expect(conflicts).toEqual([]);
    });

    it('should find think command by alias', () => {
      const commandByAlias = commands.find(cmd =>
        cmd.name === 't' || cmd.aliases.includes('t')
      );

      expect(commandByAlias).toBeDefined();
      expect(commandByAlias?.name).toBe('think');
    });

    it('should have correct usage patterns', () => {
      const thinkCommand = commands.find(cmd => cmd.name === 'think');
      const thoughtsCommand = commands.find(cmd => cmd.name === 'thoughts');

      expect(thinkCommand?.usage).toContain('--list');
      expect(thinkCommand?.usage).toContain('--search');
      expect(thinkCommand?.usage).toContain('--promote');

      expect(thoughtsCommand?.usage).toContain('on|off|toggle|status');
    });
  });

  describe('Global alias uniqueness', () => {
    it('should have unique command names', () => {
      const names = commands.map(cmd => cmd.name);
      const uniqueNames = new Set(names);

      expect(names.length).toBe(uniqueNames.size);
    });

    it('should validate all command structures', () => {
      for (const command of commands) {
        expect(command.name).toBeTruthy();
        expect(command.description).toBeTruthy();
        expect(command.handler).toBeTypeOf('function');
        expect(Array.isArray(command.aliases)).toBe(true);
      }
    });

    it('should have expected think command properties', () => {
      const thinkCommand = commands.find(cmd => cmd.name === 'think');

      expect(thinkCommand).toMatchObject({
        name: 'think',
        aliases: ['t'],
        description: expect.stringContaining('Thought capture system'),
        usage: expect.stringContaining('/think <thought>'),
      });
    });
  });

  describe('Command resolution logic', () => {
    it('should find command by name correctly', () => {
      const findCommand = (nameOrAlias: string) => {
        return commands.find(c => c.name === nameOrAlias || c.aliases.includes(nameOrAlias));
      };

      expect(findCommand('think')?.name).toBe('think');
      expect(findCommand('t')?.name).toBe('think');
      expect(findCommand('thoughts')?.name).toBe('thoughts');
    });

    it('should distinguish between similar command names', () => {
      const thinkCommands = commands.filter(cmd =>
        cmd.name.includes('think') || cmd.description.toLowerCase().includes('think')
      );

      // Should include both 'think' (capture) and 'thoughts' (toggle)
      expect(thinkCommands.length).toBeGreaterThanOrEqual(2);

      const captureCommand = thinkCommands.find(cmd =>
        cmd.description.toLowerCase().includes('capture')
      );
      const toggleCommand = thinkCommands.find(cmd =>
        cmd.description.toLowerCase().includes('toggle')
      );

      expect(captureCommand?.name).toBe('think');
      expect(toggleCommand?.name).toBe('thoughts');
    });
  });

  describe('Command ordering and positioning', () => {
    it('should have think command in a logical position', () => {
      const thinkIndex = commands.findIndex(cmd => cmd.name === 'think');
      const thoughtsIndex = commands.findIndex(cmd => cmd.name === 'thoughts');

      expect(thinkIndex).toBeGreaterThan(-1);
      expect(thoughtsIndex).toBeGreaterThan(-1);
      expect(thinkIndex).not.toBe(thoughtsIndex);
    });

    it('should maintain consistent command ordering', () => {
      // Basic commands should come before advanced ones
      const helpIndex = commands.findIndex(cmd => cmd.name === 'help');
      const initIndex = commands.findIndex(cmd => cmd.name === 'init');
      const thinkIndex = commands.findIndex(cmd => cmd.name === 'think');

      expect(helpIndex).toBeGreaterThan(-1);
      expect(initIndex).toBeGreaterThan(-1);
      expect(initIndex).toBeGreaterThan(helpIndex);
    });
  });
});