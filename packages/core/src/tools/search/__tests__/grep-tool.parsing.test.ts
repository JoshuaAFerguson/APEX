/**
 * @fileoverview Additional edge case tests for GrepTool JSON parsing and output processing
 *
 * Tests specific aspects that might not be fully covered in the main test files:
 * - JSON parsing edge cases
 * - Malformed ripgrep output handling
 * - Empty result handling
 * - Truncation logic
 * - Search time reporting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GrepTool } from '../grep-tool.js';

describe('GrepTool JSON Parsing and Edge Cases', () => {
  let tool: GrepTool;

  beforeEach(() => {
    tool = new GrepTool();
  });

  describe('JSON Output Parsing Edge Cases', () => {
    it('should handle empty ripgrep output gracefully', async () => {
      // Mock the executeRipgrep method to return empty output
      const mockExecuteRipgrep = vi.spyOn(tool as any, 'executeRipgrep');
      mockExecuteRipgrep.mockResolvedValue('');

      // Mock other dependencies
      vi.spyOn(tool as any, 'checkRipgrepAvailability').mockResolvedValue(true);
      vi.spyOn(tool as any, 'resolveSearchPath').mockReturnValue('/test/path');

      // Mock fs.stat to return a valid directory
      const { promises: fs } = await import('node:fs');
      vi.spyOn(fs, 'stat').mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      } as any);

      const result = await tool.execute({
        pattern: 'nonexistent',
        path: '/test/path',
        output_mode: 'content',
      });

      expect(result.success).toBe(true);
      expect(result.output?.matches).toEqual([]);
      expect(result.output?.totalMatches).toBe(0);
      expect(result.output?.totalFiles).toBe(0);
      expect(result.output?.truncated).toBe(false);

      mockExecuteRipgrep.mockRestore();
    });

    it('should handle malformed JSON lines gracefully', async () => {
      // Mock ripgrep output with some malformed JSON
      const malformedOutput = `
{"type":"match","data":{"path":{"text":"test.js"},"line_number":1,"lines":{"text":"valid line"}}}
{invalid json here
{"type":"match","data":{"path":{"text":"test2.js"},"line_number":2,"lines":{"text":"another valid line"}}}
{
{"type":"end"}
`.trim();

      const mockExecuteRipgrep = vi.spyOn(tool as any, 'executeRipgrep');
      mockExecuteRipgrep.mockResolvedValue(malformedOutput);

      vi.spyOn(tool as any, 'checkRipgrepAvailability').mockResolvedValue(true);
      vi.spyOn(tool as any, 'resolveSearchPath').mockReturnValue('/test/path');

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
      // Should only process the valid JSON lines
      expect(result.output?.matches).toHaveLength(2);
      expect(result.output?.matches?.[0]?.path).toBe('test.js');
      expect(result.output?.matches?.[1]?.path).toBe('test2.js');

      mockExecuteRipgrep.mockRestore();
    });

    it('should handle JSON lines with missing data fields', async () => {
      const partialOutput = `
{"type":"match","data":{"path":{"text":"test.js"}}}
{"type":"match","data":{"line_number":5,"lines":{"text":"content without path"}}}
{"type":"match","data":{"path":{"text":"complete.js"},"line_number":10,"lines":{"text":"complete match"}}}
{"type":"match"}
`.trim();

      const mockExecuteRipgrep = vi.spyOn(tool as any, 'executeRipgrep');
      mockExecuteRipgrep.mockResolvedValue(partialOutput);

      vi.spyOn(tool as any, 'checkRipgrepAvailability').mockResolvedValue(true);
      vi.spyOn(tool as any, 'resolveSearchPath').mockReturnValue('/test/path');

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

      // Should handle partial data gracefully with defaults
      const matches = result.output?.matches || [];
      expect(matches.length).toBeGreaterThan(0);

      // Check that matches with missing fields get default values
      matches.forEach(match => {
        expect(match.path).toBeDefined();
        expect(match.line).toBeDefined();
        expect(match.column).toBeDefined();
        expect(match.content).toBeDefined();
      });

      mockExecuteRipgrep.mockRestore();
    });
  });

  describe('Output Mode Specific Edge Cases', () => {
    it('should handle files_with_matches mode with duplicate file paths', async () => {
      const outputWithDuplicates = `
{"type":"match","data":{"path":{"text":"test.js"},"line_number":1}}
{"type":"match","data":{"path":{"text":"test.js"},"line_number":5}}
{"type":"match","data":{"path":{"text":"other.js"},"line_number":1}}
{"type":"match","data":{"path":{"text":"test.js"},"line_number":10}}
`.trim();

      const mockExecuteRipgrep = vi.spyOn(tool as any, 'executeRipgrep');
      mockExecuteRipgrep.mockResolvedValue(outputWithDuplicates);

      vi.spyOn(tool as any, 'checkRipgrepAvailability').mockResolvedValue(true);
      vi.spyOn(tool as any, 'resolveSearchPath').mockReturnValue('/test/path');

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

      // Should deduplicate file paths
      const files = result.output?.files || [];
      expect(files).toEqual(['test.js', 'other.js']);
      expect(result.output?.totalFiles).toBe(2);

      mockExecuteRipgrep.mockRestore();
    });

    it('should handle count mode with complete begin/end blocks', async () => {
      const countOutput = `
{"type":"begin","data":{"path":{"text":"test.js"}}}
{"type":"match","data":{"path":{"text":"test.js"},"line_number":1}}
{"type":"match","data":{"path":{"text":"test.js"},"line_number":5}}
{"type":"end","data":{"path":{"text":"test.js"},"stats":{"matches":2}}}
{"type":"begin","data":{"path":{"text":"other.js"}}}
{"type":"match","data":{"path":{"text":"other.js"},"line_number":3}}
{"type":"end","data":{"path":{"text":"other.js"},"stats":{"matches":1}}}
`.trim();

      const mockExecuteRipgrep = vi.spyOn(tool as any, 'executeRipgrep');
      mockExecuteRipgrep.mockResolvedValue(countOutput);

      vi.spyOn(tool as any, 'checkRipgrepAvailability').mockResolvedValue(true);
      vi.spyOn(tool as any, 'resolveSearchPath').mockReturnValue('/test/path');

      const { promises: fs } = await import('node:fs');
      vi.spyOn(fs, 'stat').mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      } as any);

      const result = await tool.execute({
        pattern: 'test',
        path: '/test/path',
        output_mode: 'count',
      });

      expect(result.success).toBe(true);

      const counts = result.output?.counts || [];
      expect(counts).toHaveLength(2);
      expect(counts[0]).toEqual({ path: 'test.js', count: 2 });
      expect(counts[1]).toEqual({ path: 'other.js', count: 1 });
      expect(result.output?.totalMatches).toBe(3);
      expect(result.output?.totalFiles).toBe(2);

      mockExecuteRipgrep.mockRestore();
    });
  });

  describe('Limit and Truncation Logic', () => {
    it('should properly apply head_limit and offset to JSON lines', async () => {
      // Generate output with many lines
      const lines = [];
      for (let i = 1; i <= 20; i++) {
        lines.push(`{"type":"match","data":{"path":{"text":"test${i}.js"},"line_number":1,"lines":{"text":"line ${i}"}}}`);
      }
      const largeOutput = lines.join('\n');

      const mockExecuteRipgrep = vi.spyOn(tool as any, 'executeRipgrep');
      mockExecuteRipgrep.mockResolvedValue(largeOutput);

      vi.spyOn(tool as any, 'checkRipgrepAvailability').mockResolvedValue(true);
      vi.spyOn(tool as any, 'resolveSearchPath').mockReturnValue('/test/path');

      const { promises: fs } = await import('node:fs');
      vi.spyOn(fs, 'stat').mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      } as any);

      const result = await tool.execute({
        pattern: 'test',
        path: '/test/path',
        output_mode: 'files_with_matches',
        offset: 5,
        head_limit: 10,
      });

      expect(result.success).toBe(true);

      const files = result.output?.files || [];
      expect(files.length).toBeLessThanOrEqual(10);
      expect(result.output?.truncated).toBe(true);

      // Should start from offset (files 6-15 based on 0-indexed offset of 5)
      expect(files[0]).toBe('test6.js');

      mockExecuteRipgrep.mockRestore();
    });

    it('should handle MAX_RESULTS truncation correctly', async () => {
      // Mock the MAX_RESULTS constant to a smaller value for testing
      const originalMaxResults = (GrepTool as any).MAX_RESULTS;
      (GrepTool as any).MAX_RESULTS = 3;

      const largeOutput = `
{"type":"match","data":{"path":{"text":"test1.js"},"line_number":1,"lines":{"text":"line 1"}}}
{"type":"match","data":{"path":{"text":"test2.js"},"line_number":1,"lines":{"text":"line 2"}}}
{"type":"match","data":{"path":{"text":"test3.js"},"line_number":1,"lines":{"text":"line 3"}}}
{"type":"match","data":{"path":{"text":"test4.js"},"line_number":1,"lines":{"text":"line 4"}}}
{"type":"match","data":{"path":{"text":"test5.js"},"line_number":1,"lines":{"text":"line 5"}}}
`.trim();

      const mockExecuteRipgrep = vi.spyOn(tool as any, 'executeRipgrep');
      mockExecuteRipgrep.mockResolvedValue(largeOutput);

      vi.spyOn(tool as any, 'checkRipgrepAvailability').mockResolvedValue(true);
      vi.spyOn(tool as any, 'resolveSearchPath').mockReturnValue('/test/path');

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
      expect(result.output?.matches).toHaveLength(3);
      expect(result.output?.truncated).toBe(true);

      // Restore original value
      (GrepTool as any).MAX_RESULTS = originalMaxResults;
      mockExecuteRipgrep.mockRestore();
    });
  });

  describe('Search Time and Performance Metrics', () => {
    it('should report accurate search time', async () => {
      const mockExecuteRipgrep = vi.spyOn(tool as any, 'executeRipgrep');
      mockExecuteRipgrep.mockImplementation(async () => {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        return '{"type":"match","data":{"path":{"text":"test.js"},"line_number":1,"lines":{"text":"match"}}}';
      });

      vi.spyOn(tool as any, 'checkRipgrepAvailability').mockResolvedValue(true);
      vi.spyOn(tool as any, 'resolveSearchPath').mockReturnValue('/test/path');

      const { promises: fs } = await import('node:fs');
      vi.spyOn(fs, 'stat').mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      } as any);

      const startTime = Date.now();
      const result = await tool.execute({
        pattern: 'test',
        path: '/test/path',
      });
      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.output?.searchTime).toBeGreaterThan(0);
      expect(result.output?.searchTime).toBeLessThan(totalTime + 50); // Allow some margin
      expect(result.output?.searchTime).toBeGreaterThan(90); // Should be close to our 100ms delay

      mockExecuteRipgrep.mockRestore();
    });

    it('should mark as truncated if search exceeds MAX_SEARCH_TIME', async () => {
      // Mock a long search time
      const mockExecuteRipgrep = vi.spyOn(tool as any, 'executeRipgrep');
      mockExecuteRipgrep.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return '{"type":"match","data":{"path":{"text":"test.js"},"line_number":1,"lines":{"text":"match"}}}';
      });

      vi.spyOn(tool as any, 'checkRipgrepAvailability').mockResolvedValue(true);
      vi.spyOn(tool as any, 'resolveSearchPath').mockReturnValue('/test/path');

      const { promises: fs } = await import('node:fs');
      vi.spyOn(fs, 'stat').mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      } as any);

      // Temporarily lower the MAX_SEARCH_TIME for testing
      const originalMaxTime = (GrepTool as any).MAX_SEARCH_TIME;
      (GrepTool as any).MAX_SEARCH_TIME = 100;

      const result = await tool.execute({
        pattern: 'test',
        path: '/test/path',
      });

      expect(result.success).toBe(true);
      expect(result.output?.truncated).toBe(true);

      // Restore original value
      (GrepTool as any).MAX_SEARCH_TIME = originalMaxTime;
      mockExecuteRipgrep.mockRestore();
    });
  });

  describe('Path Resolution Edge Cases', () => {
    it('should handle path resolution with working directory context', () => {
      const resolveMethod = (tool as any).resolveSearchPath;

      // Test with absolute path
      expect(resolveMethod('/absolute/path', '/working/dir')).toBe('/absolute/path');

      // Test with relative path and working directory
      expect(resolveMethod('relative/path', '/working/dir')).toContain('relative/path');

      // Test with no input path
      expect(resolveMethod(undefined, '/working/dir')).toBe('/working/dir');

      // Test with no input path and no working directory
      const cwd = process.cwd();
      expect(resolveMethod(undefined, undefined)).toBe(cwd);
    });
  });

  describe('RipGep Availability Check Edge Cases', () => {
    it('should cache ripgrep availability check result', async () => {
      const tool = new GrepTool();

      // Mock spawn to simulate ripgrep available
      const { spawn } = await import('node:child_process');
      const mockSpawn = vi.fn(() => ({
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10); // Success code
          }
        }),
      }));
      vi.doMock('node:child_process', () => ({ spawn: mockSpawn }));

      // First call should check
      const firstResult = await (tool as any).checkRipgrepAvailability();
      expect(firstResult).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('rg', ['--version'], { stdio: 'ignore' });

      // Reset mock call count
      mockSpawn.mockClear();

      // Second call should use cache
      const secondResult = await (tool as any).checkRipgrepAvailability();
      expect(secondResult).toBe(true);
      expect(mockSpawn).not.toHaveBeenCalled(); // Should not call spawn again

      vi.doUnmock('node:child_process');
    });

    it('should handle spawn error gracefully', async () => {
      const tool = new GrepTool();

      // Mock spawn to throw an error
      const mockSpawn = vi.fn(() => ({
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Command not found')), 10);
          }
        }),
      }));
      vi.doMock('node:child_process', () => ({ spawn: mockSpawn }));

      const result = await (tool as any).checkRipgrepAvailability();
      expect(result).toBe(false);

      vi.doUnmock('node:child_process');
    });
  });
});