/**
 * Teams Command Parsing Test Suite for @apexcli/api Package
 *
 * Comprehensive tests for parsing Teams bot command text and extracting
 * command, arguments, and mentions from Teams message format.
 */

import { describe, it, expect } from 'vitest';
import { parseTeamsCommandText } from '../services/teams-service.js';

describe('parseTeamsCommandText', () => {
  describe('Basic Command Parsing', () => {
    it('returns help for empty input', () => {
      expect(parseTeamsCommandText('')).toEqual({
        command: 'help',
        args: '',
        mentions: undefined
      });
      expect(parseTeamsCommandText('   ')).toEqual({
        command: 'help',
        args: '',
        mentions: undefined
      });
    });

    it('parses command and args without mentions', () => {
      expect(parseTeamsCommandText('run ship the feature')).toEqual({
        command: 'run',
        args: 'ship the feature',
        mentions: undefined,
      });
    });

    it('parses single command without args', () => {
      expect(parseTeamsCommandText('status')).toEqual({
        command: 'status',
        args: '',
        mentions: undefined,
      });
    });

    it('normalizes command casing', () => {
      expect(parseTeamsCommandText('RuN do thing')).toEqual({
        command: 'run',
        args: 'do thing',
        mentions: undefined,
      });
    });
  });

  describe('Bot Mention Handling', () => {
    it('removes bot mention from the beginning', () => {
      expect(parseTeamsCommandText('<at>APEX</at> run create task')).toEqual({
        command: 'run',
        args: 'create task',
        mentions: undefined,
      });
    });

    it('handles bot mention with different case', () => {
      expect(parseTeamsCommandText('<at>apex</at> status')).toEqual({
        command: 'status',
        args: '',
        mentions: undefined,
      });
    });

    it('handles bot mention with extra spaces', () => {
      expect(parseTeamsCommandText('<at>APEX</at>   think   this is an idea')).toEqual({
        command: 'think',
        args: 'this is an idea',
        mentions: undefined,
      });
    });

    it('returns help when only bot mention present', () => {
      expect(parseTeamsCommandText('<at>APEX</at>')).toEqual({
        command: 'help',
        args: '',
        mentions: undefined,
      });
    });

    it('returns help when only bot mention with spaces', () => {
      expect(parseTeamsCommandText('<at>APEX</at>   ')).toEqual({
        command: 'help',
        args: '',
        mentions: undefined,
      });
    });
  });

  describe('User Mention Parsing', () => {
    it('extracts single user mention', () => {
      expect(parseTeamsCommandText('run assign to <at>John Doe</at>')).toEqual({
        command: 'run',
        args: 'assign to',
        mentions: ['John Doe'],
      });
    });

    it('extracts multiple user mentions', () => {
      expect(parseTeamsCommandText('run collaborate with <at>Alice</at> and <at>Bob</at>')).toEqual({
        command: 'run',
        args: 'collaborate with and',
        mentions: ['Alice', 'Bob'],
      });
    });

    it('handles mentions with bot mention removed first', () => {
      expect(parseTeamsCommandText('<at>APEX</at> run notify <at>Jane Smith</at>')).toEqual({
        command: 'run',
        args: 'notify',
        mentions: ['Jane Smith'],
      });
    });

    it('handles mentions in middle of args', () => {
      expect(parseTeamsCommandText('run tell <at>Manager</at> about progress')).toEqual({
        command: 'run',
        args: 'tell about progress',
        mentions: ['Manager'],
      });
    });

    it('handles empty mention tags', () => {
      expect(parseTeamsCommandText('run notify <at></at> about task')).toEqual({
        command: 'run',
        args: 'notify about task',
        mentions: [''],
      });
    });
  });

  describe('Complex Command Scenarios', () => {
    it('handles complex command with quotes in args', () => {
      expect(parseTeamsCommandText('run "Implement user authentication"')).toEqual({
        command: 'run',
        args: '"Implement user authentication"',
        mentions: undefined,
      });
    });

    it('handles multi-word command args with mentions', () => {
      expect(parseTeamsCommandText('<at>APEX</at> run create feature for <at>Product Team</at> with high priority')).toEqual({
        command: 'run',
        args: 'create feature for with high priority',
        mentions: ['Product Team'],
      });
    });

    it('handles report command with task ID', () => {
      expect(parseTeamsCommandText('report task-123')).toEqual({
        command: 'report',
        args: 'task-123',
        mentions: undefined,
      });
    });

    it('handles cancel command with task ID', () => {
      expect(parseTeamsCommandText('cancel apex-456')).toEqual({
        command: 'cancel',
        args: 'apex-456',
        mentions: undefined,
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles malformed mention tags', () => {
      expect(parseTeamsCommandText('run notify <at>User about task')).toEqual({
        command: 'run',
        args: 'notify <at>User about task',
        mentions: undefined,
      });
    });

    it('handles nested angle brackets', () => {
      expect(parseTeamsCommandText('run process <data>value</data> content')).toEqual({
        command: 'run',
        args: 'process <data>value</data> content',
        mentions: undefined,
      });
    });

    it('handles special characters in args', () => {
      expect(parseTeamsCommandText('run handle @special #tags & symbols')).toEqual({
        command: 'run',
        args: 'handle @special #tags & symbols',
        mentions: undefined,
      });
    });

    it('handles very long command text', () => {
      const longArgs = 'a'.repeat(1000);
      expect(parseTeamsCommandText(`run ${longArgs}`)).toEqual({
        command: 'run',
        args: longArgs,
        mentions: undefined,
      });
    });

    it('handles unicode characters in mentions', () => {
      expect(parseTeamsCommandText('run notify <at>用户</at> about update')).toEqual({
        command: 'run',
        args: 'notify about update',
        mentions: ['用户'],
      });
    });

    it('handles mentions with special characters', () => {
      expect(parseTeamsCommandText('run assign to <at>John O\'Connor</at>')).toEqual({
        command: 'run',
        args: 'assign to',
        mentions: ['John O\'Connor'],
      });
    });
  });

  describe('Known Commands Validation', () => {
    const knownCommands = ['run', 'think', 'status', 'report', 'cancel', 'help'];

    knownCommands.forEach(command => {
      it(`correctly parses ${command} command`, () => {
        const result = parseTeamsCommandText(`${command} test args`);
        expect(result.command).toBe(command);
        expect(result.args).toBe('test args');
      });
    });

    it('handles unknown commands by preserving them', () => {
      expect(parseTeamsCommandText('unknowncommand test')).toEqual({
        command: 'unknowncommand',
        args: 'test',
        mentions: undefined,
      });
    });
  });

  describe('Whitespace Handling', () => {
    it('handles tabs and mixed whitespace', () => {
      expect(parseTeamsCommandText('\t\nrun\t\tcreate\n\ttask\t')).toEqual({
        command: 'run',
        args: 'create task',
        mentions: undefined,
      });
    });

    it('handles multiple spaces between words', () => {
      expect(parseTeamsCommandText('run    create     task    now')).toEqual({
        command: 'run',
        args: 'create task now',
        mentions: undefined,
      });
    });

    it('handles leading and trailing whitespace in args', () => {
      expect(parseTeamsCommandText('run   task description   ')).toEqual({
        command: 'run',
        args: 'task description',
        mentions: undefined,
      });
    });
  });
});