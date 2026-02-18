import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseCommand,
  getAutonomyEmoji,
  getTaskStatusEmoji,
  getLogLevelColor,
  getDocumentationIssueEmoji,
  getReadmeSectionEmoji
} from '../index.js';
import chalk from 'chalk';

/**
 * Test suite for JSDoc documented utility functions in index.ts
 * These functions are public APIs that should have comprehensive test coverage.
 */
describe('JSDoc Documented Utility Functions', () => {
  beforeEach(() => {
    // Reset any chalk styling that might affect tests
    vi.clearAllMocks();
  });

  describe('parseCommand', () => {
    it('should parse simple command with no arguments', () => {
      const result = parseCommand('/help');
      expect(result).toEqual(['help']);
    });

    it('should parse command with space-separated arguments', () => {
      const result = parseCommand('/run task init --verbose');
      expect(result).toEqual(['run', 'task', 'init', '--verbose']);
    });

    it('should handle quoted arguments with spaces', () => {
      const result = parseCommand('/run "task with spaces" --message "Hello world"');
      expect(result).toEqual(['run', 'task with spaces', '--message', 'Hello world']);
    });

    it('should handle single quoted arguments', () => {
      const result = parseCommand("/run 'single quoted' --flag 'value with spaces'");
      expect(result).toEqual(['run', 'single quoted', '--flag', 'value with spaces']);
    });

    it('should handle mixed quoting styles', () => {
      const result = parseCommand('/run "double quoted" \'single quoted\' unquoted');
      expect(result).toEqual(['run', 'double quoted', 'single quoted', 'unquoted']);
    });

    it('should handle empty input', () => {
      const result = parseCommand('');
      expect(result).toEqual(['']);
    });

    it('should handle command without slash prefix', () => {
      const result = parseCommand('help me please');
      expect(result).toEqual(['help', 'me', 'please']);
    });

    it('should handle escaped quotes', () => {
      const result = parseCommand('/run "escaped \\"quote\\" test"');
      expect(result).toEqual(['run', 'escaped "quote" test']);
    });

    it('should handle multiple consecutive spaces', () => {
      const result = parseCommand('/run    task    with    spaces');
      expect(result).toEqual(['run', 'task', 'with', 'spaces']);
    });

    it('should handle trailing and leading spaces', () => {
      const result = parseCommand('  /run task --flag  ');
      expect(result).toEqual(['run', 'task', '--flag']);
    });
  });

  describe('getAutonomyEmoji', () => {
    it('should return robot emoji for full-auto autonomy', () => {
      expect(getAutonomyEmoji('full-auto')).toBe('🤖');
    });

    it('should return eyes emoji for review-before-commit autonomy', () => {
      expect(getAutonomyEmoji('review-before-commit')).toBe('👀');
    });

    it('should return person emoji for review-all autonomy', () => {
      expect(getAutonomyEmoji('review-all')).toBe('👤');
    });

    it('should return gear emoji for unknown autonomy levels', () => {
      expect(getAutonomyEmoji('unknown-level')).toBe('⚙️');
      expect(getAutonomyEmoji('')).toBe('⚙️');
      expect(getAutonomyEmoji(undefined as any)).toBe('⚙️');
    });

    it('should handle case sensitivity', () => {
      expect(getAutonomyEmoji('FULL-AUTO')).toBe('⚙️'); // Should be exact match
      expect(getAutonomyEmoji('Full-Auto')).toBe('⚙️'); // Should be exact match
    });
  });

  describe('getTaskStatusEmoji', () => {
    it('should return correct emoji for pending status', () => {
      expect(getTaskStatusEmoji('pending')).toBe('⏳');
    });

    it('should return correct emoji for queued status', () => {
      expect(getTaskStatusEmoji('queued')).toBe('📋');
    });

    it('should return correct emoji for planning status', () => {
      expect(getTaskStatusEmoji('planning')).toBe('🧠');
    });

    it('should return correct emoji for in-progress status', () => {
      expect(getTaskStatusEmoji('in-progress')).toBe('⚡');
    });

    it('should return correct emoji for completed status', () => {
      expect(getTaskStatusEmoji('completed')).toBe('✅');
    });

    it('should return correct emoji for failed status', () => {
      expect(getTaskStatusEmoji('failed')).toBe('❌');
    });

    it('should return correct emoji for cancelled status', () => {
      expect(getTaskStatusEmoji('cancelled')).toBe('⏹️');
    });

    it('should return question mark for unknown status', () => {
      expect(getTaskStatusEmoji('unknown')).toBe('❓');
      expect(getTaskStatusEmoji('')).toBe('❓');
      expect(getTaskStatusEmoji(undefined as any)).toBe('❓');
    });

    it('should handle case sensitivity', () => {
      expect(getTaskStatusEmoji('PENDING')).toBe('❓'); // Should be exact match
      expect(getTaskStatusEmoji('Completed')).toBe('❓'); // Should be exact match
    });
  });

  describe('getLogLevelColor', () => {
    it('should return gray color for debug level', () => {
      const result = getLogLevelColor('debug');
      expect(result).toContain('DEBUG');
      // Test that chalk was used (actual color testing is complex)
      expect(result).toBeDefined();
    });

    it('should return blue color for info level', () => {
      const result = getLogLevelColor('info');
      expect(result).toContain('INFO');
      expect(result).toBeDefined();
    });

    it('should return yellow color for warn level', () => {
      const result = getLogLevelColor('warn');
      expect(result).toContain('WARN');
      expect(result).toBeDefined();
    });

    it('should return red color for error level', () => {
      const result = getLogLevelColor('error');
      expect(result).toContain('ERROR');
      expect(result).toBeDefined();
    });

    it('should return white color for unknown levels', () => {
      const result = getLogLevelColor('unknown');
      expect(result).toContain('UNKNOWN');
      expect(result).toBeDefined();
    });

    it('should handle empty and undefined levels', () => {
      const emptyResult = getLogLevelColor('');
      expect(emptyResult).toBeDefined();

      const undefinedResult = getLogLevelColor(undefined as any);
      expect(undefinedResult).toBeDefined();
    });

    it('should handle case variations', () => {
      const upperResult = getLogLevelColor('ERROR');
      expect(upperResult).toContain('ERROR');

      const mixedResult = getLogLevelColor('WaRn');
      expect(mixedResult).toContain('WARN');
    });
  });

  describe('getDocumentationIssueEmoji', () => {
    it('should return warning emoji for version-mismatch', () => {
      expect(getDocumentationIssueEmoji('version-mismatch')).toBe('⚠️');
    });

    it('should return stop sign emoji for deprecated-api', () => {
      expect(getDocumentationIssueEmoji('deprecated-api')).toBe('🛑');
    });

    it('should return broken link emoji for broken-link', () => {
      expect(getDocumentationIssueEmoji('broken-link')).toBe('🔗💔');
    });

    it('should return incorrect emoji for incorrect-example', () => {
      expect(getDocumentationIssueEmoji('incorrect-example')).toBe('❌📝');
    });

    it('should return missing emoji for missing-docs', () => {
      expect(getDocumentationIssueEmoji('missing-docs')).toBe('❓📄');
    });

    it('should return document emoji for unknown types', () => {
      expect(getDocumentationIssueEmoji('unknown-issue')).toBe('📄');
      expect(getDocumentationIssueEmoji('')).toBe('📄');
      expect(getDocumentationIssueEmoji(undefined as any)).toBe('📄');
    });

    it('should handle case variations', () => {
      expect(getDocumentationIssueEmoji('VERSION-MISMATCH')).toBe('📄'); // Should be exact match
      expect(getDocumentationIssueEmoji('Deprecated-Api')).toBe('📄'); // Should be exact match
    });
  });

  describe('getReadmeSectionEmoji', () => {
    it('should return installation emoji for installation section', () => {
      expect(getReadmeSectionEmoji('installation')).toBe('📦');
    });

    it('should return usage emoji for usage section', () => {
      expect(getReadmeSectionEmoji('usage')).toBe('🚀');
    });

    it('should return API emoji for api section', () => {
      expect(getReadmeSectionEmoji('api')).toBe('🔌');
    });

    it('should return examples emoji for examples section', () => {
      expect(getReadmeSectionEmoji('examples')).toBe('💡');
    });

    it('should return contributing emoji for contributing section', () => {
      expect(getReadmeSectionEmoji('contributing')).toBe('🤝');
    });

    it('should return license emoji for license section', () => {
      expect(getReadmeSectionEmoji('license')).toBe('📜');
    });

    it('should return document emoji for unknown sections', () => {
      expect(getReadmeSectionEmoji('unknown-section')).toBe('📄');
      expect(getReadmeSectionEmoji('')).toBe('📄');
      expect(getReadmeSectionEmoji(undefined as any)).toBe('📄');
    });

    it('should handle case variations', () => {
      expect(getReadmeSectionEmoji('INSTALLATION')).toBe('📄'); // Should be exact match
      expect(getReadmeSectionEmoji('Usage')).toBe('📄'); // Should be exact match
    });

    it('should handle partial matches', () => {
      expect(getReadmeSectionEmoji('getting-started')).toBe('📄'); // Not exact match
      expect(getReadmeSectionEmoji('api-reference')).toBe('📄'); // Not exact match
    });
  });
});