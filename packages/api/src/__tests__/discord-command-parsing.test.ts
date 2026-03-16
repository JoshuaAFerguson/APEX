/**
 * Discord Command Parsing Test Suite for @apexcli/api Package
 *
 * Tests for parsing Discord slash command arguments and validation.
 */

import { describe, it, expect } from 'vitest';
import { parseDiscordCommand } from '../services/discord-service.js';

describe('parseDiscordCommand', () => {
  describe('Basic Command Parsing', () => {
    it('should parse simple command with args', () => {
      const result = parseDiscordCommand('run', 'Create a new feature');

      expect(result).toEqual({
        command: 'run',
        args: 'Create a new feature',
      });
    });

    it('should parse command without args', () => {
      const result = parseDiscordCommand('status');

      expect(result).toEqual({
        command: 'status',
        args: '',
      });
    });

    it('should handle empty args', () => {
      const result = parseDiscordCommand('help', '');

      expect(result).toEqual({
        command: 'help',
        args: '',
      });
    });

    it('should handle undefined args', () => {
      const result = parseDiscordCommand('status', undefined as any);

      expect(result).toEqual({
        command: 'status',
        args: '',
      });
    });

    it('should trim whitespace from args', () => {
      const result = parseDiscordCommand('think', '  My idea here  ');

      expect(result).toEqual({
        command: 'think',
        args: 'My idea here',
      });
    });
  });

  describe('Case Handling', () => {
    it('should convert command to lowercase', () => {
      const result = parseDiscordCommand('RUN', 'Test task');

      expect(result).toEqual({
        command: 'run',
        args: 'Test task',
      });
    });

    it('should convert mixed case command to lowercase', () => {
      const result = parseDiscordCommand('StAtUs', '');

      expect(result).toEqual({
        command: 'status',
        args: '',
      });
    });

    it('should preserve case in arguments', () => {
      const result = parseDiscordCommand('run', 'Create API endpoint for UserProfile');

      expect(result).toEqual({
        command: 'run',
        args: 'Create API endpoint for UserProfile',
      });
    });
  });

  describe('Special Characters and Edge Cases', () => {
    it('should handle args with quotes', () => {
      const result = parseDiscordCommand('run', 'Create "special feature" with quotes');

      expect(result).toEqual({
        command: 'run',
        args: 'Create "special feature" with quotes',
      });
    });

    it('should handle args with newlines', () => {
      const result = parseDiscordCommand('think', 'Multi-line\nthought here');

      expect(result).toEqual({
        command: 'think',
        args: 'Multi-line\nthought here',
      });
    });

    it('should handle args with special characters', () => {
      const result = parseDiscordCommand('run', 'Fix bug #123 & improve @mentions');

      expect(result).toEqual({
        command: 'run',
        args: 'Fix bug #123 & improve @mentions',
      });
    });

    it('should handle very long arguments', () => {
      const longArgs = 'A'.repeat(1000);
      const result = parseDiscordCommand('run', longArgs);

      expect(result).toEqual({
        command: 'run',
        args: longArgs,
      });
    });

    it('should handle Unicode characters in args', () => {
      const result = parseDiscordCommand('think', '🤔 Consider adding emoji support 🚀');

      expect(result).toEqual({
        command: 'think',
        args: '🤔 Consider adding emoji support 🚀',
      });
    });
  });

  describe('All Supported Commands', () => {
    it('should parse run command', () => {
      const result = parseDiscordCommand('run', 'Build new feature');

      expect(result.command).toBe('run');
      expect(result.args).toBe('Build new feature');
    });

    it('should parse think command', () => {
      const result = parseDiscordCommand('think', 'Great idea for improvement');

      expect(result.command).toBe('think');
      expect(result.args).toBe('Great idea for improvement');
    });

    it('should parse status command', () => {
      const result = parseDiscordCommand('status');

      expect(result.command).toBe('status');
      expect(result.args).toBe('');
    });

    it('should parse report command', () => {
      const result = parseDiscordCommand('report', 'task-123');

      expect(result.command).toBe('report');
      expect(result.args).toBe('task-123');
    });

    it('should parse cancel command', () => {
      const result = parseDiscordCommand('cancel', 'task-456');

      expect(result.command).toBe('cancel');
      expect(result.args).toBe('task-456');
    });

    it('should parse help command', () => {
      const result = parseDiscordCommand('help');

      expect(result.command).toBe('help');
      expect(result.args).toBe('');
    });
  });

  describe('Error Resilience', () => {
    it('should handle null command gracefully', () => {
      const result = parseDiscordCommand(null as any, 'some args');

      expect(result.command).toBe('');
      expect(result.args).toBe('some args');
    });

    it('should handle empty command', () => {
      const result = parseDiscordCommand('', 'some args');

      expect(result.command).toBe('');
      expect(result.args).toBe('some args');
    });

    it('should handle command with only whitespace', () => {
      const result = parseDiscordCommand('   ', 'some args');

      expect(result.command).toBe('');
      expect(result.args).toBe('some args');
    });
  });

  describe('Argument Validation Scenarios', () => {
    it('should preserve exact spacing in task descriptions', () => {
      const result = parseDiscordCommand('run', 'Fix   spacing    issues   here');

      expect(result.args).toBe('Fix   spacing    issues   here');
    });

    it('should handle task IDs with special formats', () => {
      const result = parseDiscordCommand('cancel', 'task-uuid-1234-5678-9012');

      expect(result.args).toBe('task-uuid-1234-5678-9012');
    });

    it('should handle complex task descriptions', () => {
      const complexDescription = 'Implement OAuth2 flow with PKCE, handle edge cases (timeout, network errors), and add comprehensive tests';
      const result = parseDiscordCommand('run', complexDescription);

      expect(result.args).toBe(complexDescription);
    });

    it('should handle markdown-like formatting in descriptions', () => {
      const result = parseDiscordCommand('think', '**Bold idea**: Add *italic* support and `code` blocks');

      expect(result.args).toBe('**Bold idea**: Add *italic* support and `code` blocks');
    });

    it('should handle URLs in arguments', () => {
      const result = parseDiscordCommand('run', 'Integrate with https://api.example.com/v2/endpoints');

      expect(result.args).toBe('Integrate with https://api.example.com/v2/endpoints');
    });
  });
});