/**
 * @fileoverview Security and error boundary tests for GrepTool
 *
 * Tests security-related functionality and error handling edge cases:
 * - Security validation
 * - Error handling scenarios
 * - Cancellation behavior
 * - Resource limits
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GrepTool } from '../grep-tool.js';
import type { ToolExecutionContext } from '../../base-tool.js';

describe('GrepTool Security and Error Boundary Tests', () => {
  let tool: GrepTool;

  beforeEach(() => {
    tool = new GrepTool();
  });

  describe('Security Validation', () => {
    it('should warn about potentially dangerous regex patterns', () => {
      const dangerousPatterns = [
        '.*',
        '.+',
        '.*.*',
        '.+.+',
        '(a+)+b',
        '(a|a)*',
        'a*a*a*a*b',
      ];

      for (const pattern of dangerousPatterns) {
        const result = tool.validate({ pattern });
        expect(result.valid).toBe(true); // Should be valid but with warnings
        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/catastrophic backtracking|very broad pattern/)
          ])
        );
      }
    });

    it('should warn about system directory access', () => {
      const systemPaths = [
        '/etc/passwd',
        '/proc/version',
        '/sys/class/net',
        '/dev/random',
        'C:\\Windows\\System32',
        'C:\\System32\\drivers',
      ];

      for (const path of systemPaths) {
        const result = tool.validate({ pattern: 'test', path });
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('accessing system directories - use caution');
      }
    });

    it('should warn about path traversal attempts', () => {
      const traversalPaths = [
        '../../../etc',
        '../../home/user',
        '../../../root',
        '../../../../etc/passwd',
      ];

      for (const path of traversalPaths) {
        const result = tool.validate({ pattern: 'test', path });
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('relative path contains ".." - ensure this is intentional');
      }
    });

    it('should warn when search path is outside working directory', () => {
      const context: ToolExecutionContext = {
        workingDirectory: '/home/user/project',
      };

      const result = tool.validate(
        { pattern: 'test', path: '/home/user/other-project' },
        context
      );

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('search path is outside the working directory');
    });

    it('should reject completely invalid regex patterns', () => {
      const invalidPatterns = [
        '[',
        '(',
        '*',
        '?',
        '+',
        '{',
        '(?',
        '[abc',
        '(abc',
        '[a-z',
        '(?P<',
      ];

      for (const pattern of invalidPatterns) {
        const result = tool.validate({ pattern });
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/invalid regular expression/)
          ])
        );
      }
    });
  });

  describe('Error Handling Scenarios', () => {
    it('should handle filesystem errors gracefully', async () => {
      const { promises: fs } = await import('node:fs');

      // Mock fs.stat to throw ENOENT error
      vi.spyOn(fs, 'stat').mockRejectedValue(
        Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
      );

      const result = await tool.execute({
        pattern: 'test',
        path: '/nonexistent/path',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Search path not found');
    });

    it('should handle permission denied errors', async () => {
      const { promises: fs } = await import('node:fs');

      // Mock fs.stat to throw EACCES error
      vi.spyOn(fs, 'stat').mockRejectedValue(
        Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
      );

      const result = await tool.execute({
        pattern: 'test',
        path: '/restricted/path',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied accessing search path');
    });

    it('should handle EPERM errors', async () => {
      const { promises: fs } = await import('node:fs');

      // Mock fs.stat to throw EPERM error
      vi.spyOn(fs, 'stat').mockRejectedValue(
        Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' })
      );

      const result = await tool.execute({
        pattern: 'test',
        path: '/some/path',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied accessing search path');
    });

    it('should handle unknown filesystem errors', async () => {
      const { promises: fs } = await import('node:fs');

      // Mock fs.stat to throw an unknown error
      vi.spyOn(fs, 'stat').mockRejectedValue(new Error('Unknown filesystem error'));

      const result = await tool.execute({
        pattern: 'test',
        path: '/some/path',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to access search path');
    });

    it('should handle ripgrep not available', async () => {
      vi.spyOn(tool as any, 'checkRipgrepAvailability').mockResolvedValue(false);

      const result = await tool.execute({
        pattern: 'test',
        path: '/valid/path',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Ripgrep (rg) is not available');
    });

    it('should handle ripgrep execution failure', async () => {
      vi.spyOn(tool as any, 'checkRipgrepAvailability').mockResolvedValue(true);
      vi.spyOn(tool as any, 'resolveSearchPath').mockReturnValue('/test/path');

      const { promises: fs } = await import('node:fs');
      vi.spyOn(fs, 'stat').mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      } as any);

      // Mock executeRipgrep to throw an error
      vi.spyOn(tool as any, 'executeRipgrep').mockRejectedValue(
        new Error('ripgrep execution failed')
      );

      const result = await tool.execute({
        pattern: 'test',
        path: '/test/path',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Ripgrep execution failed');
    });

    it('should handle invalid path types (not file or directory)', async () => {
      const { promises: fs } = await import('node:fs');
      vi.spyOn(fs, 'stat').mockResolvedValue({
        isDirectory: () => false,
        isFile: () => false,
      } as any);

      const result = await tool.execute({
        pattern: 'test',
        path: '/dev/null',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Search path must be a file or directory');
    });
  });

  describe('Cancellation and Abort Handling', () => {
    it('should handle early cancellation before execution', async () => {
      const abortController = new AbortController();
      abortController.abort(); // Cancel immediately

      const context: ToolExecutionContext = {
        signal: abortController.signal,
      };

      const result = await tool.execute({
        pattern: 'test',
        path: '/test/path',
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });

    it('should handle cancellation during ripgrep execution', async () => {
      const abortController = new AbortController();
      const context: ToolExecutionContext = {
        signal: abortController.signal,
      };

      vi.spyOn(tool as any, 'checkRipgrepAvailability').mockResolvedValue(true);
      vi.spyOn(tool as any, 'resolveSearchPath').mockReturnValue('/test/path');

      const { promises: fs } = await import('node:fs');
      vi.spyOn(fs, 'stat').mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      } as any);

      // Mock executeRipgrep to simulate cancellation
      vi.spyOn(tool as any, 'executeRipgrep').mockImplementation(
        async (args: string[], signal?: AbortSignal) => {
          return new Promise((resolve, reject) => {
            if (signal?.aborted) {
              reject(new Error('Ripgrep operation was cancelled'));
              return;
            }

            signal?.addEventListener('abort', () => {
              reject(new Error('Ripgrep operation was cancelled'));
            });

            // Simulate some delay
            setTimeout(() => {
              resolve('{"type":"match","data":{"path":{"text":"test.js"},"line_number":1}}');
            }, 100);
          });
        }
      );

      // Cancel after a short delay
      setTimeout(() => abortController.abort(), 50);

      const result = await tool.execute({
        pattern: 'test',
        path: '/test/path',
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });
  });

  describe('Resource Limits and Performance Safeguards', () => {
    it('should respect MAX_RESULTS limit in content mode', async () => {
      const originalMaxResults = (GrepTool as any).MAX_RESULTS;
      (GrepTool as any).MAX_RESULTS = 5; // Set a low limit for testing

      // Create output with more matches than the limit
      const matches = Array.from({ length: 10 }, (_, i) =>
        `{"type":"match","data":{"path":{"text":"test${i}.js"},"line_number":${i + 1},"lines":{"text":"match ${i}"}}}`
      ).join('\n');

      vi.spyOn(tool as any, 'checkRipgrepAvailability').mockResolvedValue(true);
      vi.spyOn(tool as any, 'resolveSearchPath').mockReturnValue('/test/path');
      vi.spyOn(tool as any, 'executeRipgrep').mockResolvedValue(matches);

      const { promises: fs } = await import('node:fs');
      vi.spyOn(fs, 'stat').mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      } as any);

      const result = await tool.execute({
        pattern: 'test',
        path: '/test/path',
        output_mode: 'content',
      });

      expect(result.success).toBe(true);
      expect(result.output?.matches).toHaveLength(5); // Should be limited
      expect(result.output?.truncated).toBe(true);

      // Restore original limit
      (GrepTool as any).MAX_RESULTS = originalMaxResults;
    });

    it('should respect MAX_RESULTS limit in files_with_matches mode', async () => {
      const originalMaxResults = (GrepTool as any).MAX_RESULTS;
      (GrepTool as any).MAX_RESULTS = 3; // Set a low limit for testing

      // Create output with more unique files than the limit
      const matches = Array.from({ length: 6 }, (_, i) =>
        `{"type":"match","data":{"path":{"text":"file${i}.js"},"line_number":1}}`
      ).join('\n');

      vi.spyOn(tool as any, 'checkRipgrepAvailability').mockResolvedValue(true);
      vi.spyOn(tool as any, 'resolveSearchPath').mockReturnValue('/test/path');
      vi.spyOn(tool as any, 'executeRipgrep').mockResolvedValue(matches);

      const { promises: fs } = await import('node:fs');
      vi.spyOn(fs, 'stat').mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      } as any);

      const result = await tool.execute({
        pattern: 'test',
        path: '/test/path',
        output_mode: 'files_with_matches',
      });

      expect(result.success).toBe(true);
      expect(result.output?.files).toHaveLength(3); // Should be limited
      expect(result.output?.truncated).toBe(true);

      // Restore original limit
      (GrepTool as any).MAX_RESULTS = originalMaxResults;
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle null and undefined inputs gracefully', () => {
      // Test with null pattern
      const result1 = tool.validate({ pattern: null as any });
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('pattern cannot be empty');

      // Test with undefined pattern
      const result2 = tool.validate({ pattern: undefined as any });
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('pattern cannot be empty');

      // Test with null inputs object
      const result3 = tool.validate(null as any);
      expect(result3.valid).toBe(false);
      expect(result3.errors).toContain('Parameters must be an object');
    });

    it('should handle extreme numeric values for context parameters', () => {
      // Test with very large context values
      const result1 = tool.validate({ pattern: 'test', '-A': Number.MAX_SAFE_INTEGER });
      expect(result1.valid).toBe(true);
      expect(result1.warnings).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/very large and may impact performance/)
        ])
      );

      // Test with non-finite values
      const result2 = tool.validate({ pattern: 'test', '-B': Infinity });
      expect(result2.valid).toBe(false);
      expect(result2.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/-B must be a non-negative integer/)
        ])
      );

      // Test with NaN
      const result3 = tool.validate({ pattern: 'test', '-C': NaN });
      expect(result3.valid).toBe(false);
      expect(result3.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/-C must be a non-negative integer/)
        ])
      );
    });

    it('should validate output_mode type safety', () => {
      // Test with invalid output mode (string, but not enum value)
      const result = tool.validate({
        pattern: 'test',
        output_mode: 'invalid_mode' as any
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('output_mode must be one of: content, files_with_matches, count');
    });

    it('should handle whitespace-only patterns', () => {
      const whitespacePatterns = ['   ', '\t', '\n', '\r\n', '\t\n  \r'];

      for (const pattern of whitespacePatterns) {
        const result = tool.validate({ pattern });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('pattern cannot be empty');
      }
    });
  });

  describe('Build Ripgrep Args Edge Cases', () => {
    it('should build correct args for different parameter combinations', () => {
      const buildMethod = (tool as any).buildRipgrepArgs;

      // Test content mode with all options
      const args1 = buildMethod({
        pattern: 'test',
        output_mode: 'content',
        '-A': 2,
        '-B': 1,
        '-C': 3, // Should override -A and -B
        '-i': true,
        '-n': true,
        multiline: true,
        type: 'js',
        glob: '*.ts',
      }, '/test/path');

      expect(args1).toContain('--json');
      expect(args1).toContain('-C');
      expect(args1).toContain('3');
      expect(args1).not.toContain('-A'); // Should be overridden by -C
      expect(args1).not.toContain('-B'); // Should be overridden by -C
      expect(args1).toContain('-i');
      expect(args1).toContain('-n');
      expect(args1).toContain('-U');
      expect(args1).toContain('--multiline-dotall');
      expect(args1).toContain('--type');
      expect(args1).toContain('js');
      expect(args1).toContain('--glob');
      expect(args1).toContain('*.ts');
      expect(args1).toContain('test');
      expect(args1).toContain('/test/path');

      // Test files_with_matches mode
      const args2 = buildMethod({
        pattern: 'search',
        output_mode: 'files_with_matches',
        '-A': 5, // Should be ignored
      }, '/path');

      expect(args2).toContain('--json');
      expect(args2).toContain('--files-with-matches');
      expect(args2).not.toContain('-A'); // Should be ignored for this mode
      expect(args2).toContain('search');
      expect(args2).toContain('/path');

      // Test count mode
      const args3 = buildMethod({
        pattern: 'count',
        output_mode: 'count',
      }, '/count/path');

      expect(args3).toContain('--json');
      expect(args3).toContain('--count');
      expect(args3).toContain('count');
      expect(args3).toContain('/count/path');

      // Test -n false option
      const args4 = buildMethod({
        pattern: 'test',
        output_mode: 'content',
        '-n': false,
      }, '/test');

      expect(args4).not.toContain('-n'); // Should not include line numbers
    });
  });
});