/**
 * @fileoverview Performance tests for GrepTool
 *
 * Tests the GrepTool performance characteristics including:
 * - Large directory search
 * - Many small files
 * - Large files with many matches
 * - Complex regex patterns
 * - Memory usage under limits
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { GrepTool } from '../grep-tool.js';

describe('GrepTool Performance Tests', () => {
  let tool: GrepTool;
  let tempDir: string;
  let testFiles: string[] = [];

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'grep-perf-test-'));
  });

  beforeEach(() => {
    tool = new GrepTool();
  });

  afterAll(async () => {
    // Clean up all test files
    for (const file of testFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    try {
      await fs.rmdir(tempDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  async function createTestFile(name: string, content: string): Promise<string> {
    const filePath = path.join(tempDir, name);
    await fs.writeFile(filePath, content, 'utf8');
    testFiles.push(filePath);
    return filePath;
  }

  describe('Large Directory Search', () => {
    beforeAll(async () => {
      // Create many small files with various content
      const filesPromises = [];
      for (let i = 0; i < 100; i++) {
        const content = `
File ${i} content
function test${i}() {
  return "test${i}";
}

// TODO: Implement feature ${i}
const value${i} = ${i * 10};

class Class${i} {
  constructor() {
    this.id = ${i};
    this.name = "Item ${i}";
  }

  async process() {
    // FIXME: Add error handling for ${i}
    await new Promise(resolve => setTimeout(resolve, ${i}));
    return this.name;
  }
}

export default Class${i};
`;
        filesPromises.push(createTestFile(`file${i}.js`, content));
      }
      await Promise.all(filesPromises);
    });

    it('should search across many files quickly', async () => {
      const startTime = performance.now();

      const result = await tool.execute({
        pattern: 'TODO',
        path: tempDir,
        output_mode: 'files_with_matches',
      });

      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.output?.files!.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.output?.searchTime).toBeGreaterThan(0);
      expect(result.output?.searchTime).toBeLessThan(1500);
    });

    it('should handle complex regex patterns efficiently', async () => {
      const complexPatterns = [
        'function\\s+test\\d+',
        'class\\s+Class\\d+\\s*\\{',
        'async\\s+\\w+\\s*\\(\\)',
        'const\\s+\\w+\\s*=\\s*\\d+',
        '//\\s*(TODO|FIXME).*\\d+',
      ];

      for (const pattern of complexPatterns) {
        const startTime = performance.now();

        const result = await tool.execute({
          pattern,
          path: tempDir,
          output_mode: 'count',
        });

        const duration = performance.now() - startTime;

        expect(result.success).toBe(true);
        expect(result.output?.totalMatches).toBeGreaterThan(0);
        expect(duration).toBeLessThan(3000); // Complex patterns may take longer
      }
    }, 20000); // Extended timeout for complex patterns
  });

  describe('Large File Handling', () => {
    beforeAll(async () => {
      // Create a large file with many matches
      const lines = [];
      for (let i = 0; i < 10000; i++) {
        lines.push(`Line ${i}: This is a test line with pattern${i % 100} and some other content.`);
        if (i % 100 === 0) {
          lines.push(`// TODO: Process line ${i}`);
        }
        if (i % 150 === 0) {
          lines.push(`function process${i}() { return "result${i}"; }`);
        }
        if (i % 200 === 0) {
          lines.push(`Error: Something went wrong at line ${i}`);
        }
      }
      await createTestFile('large-file.txt', lines.join('\n'));
    });

    it('should search large files efficiently', async () => {
      const startTime = performance.now();

      const result = await tool.execute({
        pattern: 'pattern\\d+',
        path: path.join(tempDir, 'large-file.txt'),
        output_mode: 'count',
      });

      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.output?.totalMatches).toBeGreaterThan(100);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle many matches in content mode', async () => {
      const startTime = performance.now();

      const result = await tool.execute({
        pattern: 'TODO',
        path: path.join(tempDir, 'large-file.txt'),
        output_mode: 'content',
        head_limit: 50, // Limit to avoid too much data
      });

      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.output?.matches!.length).toBeLessThanOrEqual(50);
      expect(result.output?.matches!.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(3000);

      // Verify content structure
      for (const match of result.output?.matches || []) {
        expect(match.path).toContain('large-file.txt');
        expect(match.line).toBeGreaterThan(0);
        expect(match.content).toContain('TODO');
      }
    });

    it('should respect safety limits', async () => {
      // Search for a very common pattern that would match many lines
      const result = await tool.execute({
        pattern: 'Line \\d+',
        path: path.join(tempDir, 'large-file.txt'),
        output_mode: 'content',
      });

      expect(result.success).toBe(true);

      // Should be limited by MAX_RESULTS (10000)
      expect(result.output?.matches!.length).toBeLessThanOrEqual(10000);

      if (result.output?.matches!.length === 10000) {
        expect(result.output?.truncated).toBe(true);
      }
    });
  });

  describe('Memory Usage', () => {
    beforeAll(async () => {
      // Create files with varying sizes
      const sizes = [1000, 5000, 10000, 50000];
      const promises = sizes.map(async (size, index) => {
        const lines = Array.from({ length: size }, (_, i) =>
          `Line ${i}: Content for file ${index} with data_${i % 10} and pattern_${i}`
        );
        return createTestFile(`memory-test-${index}.txt`, lines.join('\n'));
      });
      await Promise.all(promises);
    });

    it('should not consume excessive memory', async () => {
      const initialMemory = process.memoryUsage();

      const result = await tool.execute({
        pattern: 'pattern_\\d+',
        path: tempDir,
        glob: 'memory-test-*.txt',
        output_mode: 'content',
        head_limit: 1000, // Limit results to control memory
      });

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(result.success).toBe(true);
      expect(result.output?.matches!.length).toBeGreaterThan(0);

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    it('should handle files_with_matches mode efficiently for memory', async () => {
      const initialMemory = process.memoryUsage();

      const result = await tool.execute({
        pattern: 'Line',
        path: tempDir,
        glob: 'memory-test-*.txt',
        output_mode: 'files_with_matches',
      });

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(result.success).toBe(true);
      expect(result.output?.files!.length).toBeGreaterThan(0);

      // files_with_matches should use minimal memory
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
    });
  });

  describe('Pattern Complexity', () => {
    beforeAll(async () => {
      // Create file with various patterns for complexity testing
      const content = `
const patterns = {
  simple: "hello world",
  numbers: "value123",
  camelCase: "getCurrentUser",
  snakeCase: "get_current_user",
  kebabCase: "get-current-user",
  email: "user@example.com",
  url: "https://example.com/path",
  json: '{"key": "value", "number": 42}',
  multiline: \`
    This is a multiline
    string with various
    content types
  \`,
  regex: /^pattern.*end$/,
  complex: "prefix_123_suffix",
};

function processComplexData(data) {
  const result = data.map(item => {
    return {
      id: item.id || generateId(),
      name: item.name?.trim() || "default",
      value: parseInt(item.value) || 0,
    };
  });
  return result;
}
`;
      await createTestFile('complex-patterns.js', content);
    });

    it('should handle simple patterns quickly', async () => {
      const simplePatterns = [
        'hello',
        'world',
        'function',
        'const',
        'return',
      ];

      for (const pattern of simplePatterns) {
        const startTime = performance.now();

        const result = await tool.execute({
          pattern,
          path: path.join(tempDir, 'complex-patterns.js'),
          output_mode: 'count',
        });

        const duration = performance.now() - startTime;

        expect(result.success).toBe(true);
        expect(duration).toBeLessThan(100); // Very fast for simple patterns
      }
    });

    it('should handle complex regex patterns', async () => {
      const complexPatterns = [
        '\\w+@\\w+\\.\\w+', // Email pattern
        'https?://\\S+', // URL pattern
        '\\{[^}]*\\}', // JSON object pattern
        '\\w+[A-Z]\\w+', // camelCase pattern
        '\\w+_\\w+', // snake_case pattern
        '\\w+-\\w+', // kebab-case pattern
        'function\\s+\\w+\\s*\\([^)]*\\)', // Function definition
      ];

      for (const pattern of complexPatterns) {
        const startTime = performance.now();

        const result = await tool.execute({
          pattern,
          path: path.join(tempDir, 'complex-patterns.js'),
          output_mode: 'content',
        });

        const duration = performance.now() - startTime;

        expect(result.success).toBe(true);
        expect(duration).toBeLessThan(500); // Should handle complex patterns reasonably
      }
    }, 10000);

    it('should handle potentially problematic patterns safely', async () => {
      // These patterns could cause catastrophic backtracking
      const problematicPatterns = [
        '(a+)+b',
        '(a|a)*',
        'a*a*a*a*b',
      ];

      for (const pattern of problematicPatterns) {
        const startTime = performance.now();

        const result = await tool.execute({
          pattern,
          path: path.join(tempDir, 'complex-patterns.js'),
          output_mode: 'count',
        });

        const duration = performance.now() - startTime;

        // Should either succeed quickly or fail gracefully
        expect(duration).toBeLessThan(2000); // Should timeout/fail before becoming problematic

        if (!result.success) {
          // If it fails, it should be due to regex engine limits, not hanging
          expect(result.error).toBeDefined();
        }
      }
    }, 15000);
  });

  describe('Concurrent Operations', () => {
    beforeAll(async () => {
      // Create multiple files for concurrent testing
      const promises = Array.from({ length: 20 }, async (_, i) => {
        const content = Array.from({ length: 100 }, (_, j) =>
          `File ${i} Line ${j}: Content with pattern${i}_${j} and test data.`
        ).join('\n');
        return createTestFile(`concurrent-${i}.txt`, content);
      });
      await Promise.all(promises);
    });

    it('should handle multiple concurrent searches', async () => {
      const patterns = ['pattern\\d+_\\d+', 'File \\d+', 'Line \\d+', 'test data', 'Content'];

      const startTime = performance.now();

      const promises = patterns.map(pattern =>
        tool.execute({
          pattern,
          path: tempDir,
          glob: 'concurrent-*.txt',
          output_mode: 'count',
        })
      );

      const results = await Promise.all(promises);
      const duration = performance.now() - startTime;

      expect(results.every(r => r.success)).toBe(true);
      expect(results.every(r => r.output?.totalMatches! > 0)).toBe(true);

      // All searches should complete reasonably quickly even when concurrent
      expect(duration).toBeLessThan(5000);

      // Each search should have reasonable timing
      results.forEach(result => {
        expect(result.duration).toBeLessThan(3000);
        expect(result.output?.searchTime).toBeLessThan(2500);
      });
    }, 15000);
  });
});