/**
 * Performance Tests for CodebaseIndexer
 *
 * Tests performance characteristics, memory usage, and scalability
 * of the indexing process under various conditions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { CodebaseIndexer, type IndexingOptions } from './indexer.js';

describe('CodebaseIndexer Performance', () => {
  let tempDir: string;
  let indexer: CodebaseIndexer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codebase-indexer-perf-'));
    indexer = CodebaseIndexer.getInstance();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    CodebaseIndexer.resetInstance();
  });

  describe('Scalability tests', () => {
    it('should handle large numbers of small files efficiently', async () => {
      // Create 100 small TypeScript files
      const fileCount = 100;
      const createFilePromises = Array.from({ length: fileCount }, async (_, i) => {
        const content = `
export const value${i} = ${i};
export function func${i}(): number { return ${i}; }
export class Class${i} {
  getValue(): number { return ${i}; }
}
        `;
        await fs.writeFile(path.join(tempDir, `file${i}.ts`), content);
      });

      await Promise.all(createFilePromises);

      const startTime = Date.now();
      const result = await indexer.indexDirectory(tempDir);
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      const timePerFile = processingTime / fileCount;

      // Performance assertions
      expect(result.files).toHaveLength(fileCount);
      expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(timePerFile).toBeLessThan(300); // Less than 300ms per file on average

      // Verify all files were processed correctly
      expect(result.stats!.totalFiles).toBe(fileCount);
      expect(result.stats!.totalSymbols).toBe(fileCount * 3); // 3 symbols per file
    }, 60000); // 60 second timeout

    it('should handle deeply nested directory structures efficiently', async () => {
      // Create a deep nested structure: 10 levels deep, 5 files per level
      const depth = 10;
      const filesPerLevel = 5;

      for (let level = 0; level < depth; level++) {
        const levelPath = path.join(tempDir, ...Array.from({ length: level + 1 }, (_, i) => `level${i}`));
        await fs.mkdir(levelPath, { recursive: true });

        for (let file = 0; file < filesPerLevel; file++) {
          const content = `
export const LEVEL = ${level};
export const FILE = ${file};

export function getInfo(): { level: number; file: number } {
  return { level: LEVEL, file: FILE };
}

export class Level${level}File${file} {
  getIdentifier(): string {
    return \`\${LEVEL}-\${FILE}\`;
  }
}
          `;
          await fs.writeFile(path.join(levelPath, `file${file}.ts`), content);
        }
      }

      const startTime = Date.now();
      const result = await indexer.indexDirectory(tempDir);
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      const expectedFiles = depth * filesPerLevel;

      expect(result.files).toHaveLength(expectedFiles);
      expect(processingTime).toBeLessThan(20000); // Should complete within 20 seconds

      // Verify deep nesting doesn't break symbol extraction
      const deepestFile = result.files.find(f =>
        f.path.split(path.sep).length === depth + 1 // +1 for the filename
      );
      expect(deepestFile).toBeDefined();
      expect(deepestFile!.symbols.length).toBeGreaterThan(0);
    }, 30000);

    it('should handle files with many symbols efficiently', async () => {
      // Create files with varying numbers of symbols
      const testCases = [
        { name: 'small.ts', symbolCount: 10 },
        { name: 'medium.ts', symbolCount: 50 },
        { name: 'large.ts', symbolCount: 200 },
        { name: 'xlarge.ts', symbolCount: 500 }
      ];

      for (const testCase of testCases) {
        const functions = Array.from({ length: testCase.symbolCount }, (_, i) =>
          `export function func${i}(param${i}: number): string { return param${i}.toString(); }`
        ).join('\n\n');

        await fs.writeFile(path.join(tempDir, testCase.name), functions);
      }

      const startTime = Date.now();
      const result = await indexer.indexDirectory(tempDir);
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      const totalSymbols = testCases.reduce((sum, tc) => sum + tc.symbolCount, 0);

      expect(result.files).toHaveLength(testCases.length);
      expect(result.stats!.totalSymbols).toBe(totalSymbols);
      expect(processingTime).toBeLessThan(15000); // Should complete within 15 seconds

      // Check that large files were processed correctly
      const xlargeFile = result.files.find(f => f.path === 'xlarge.ts');
      expect(xlargeFile!.symbols).toHaveLength(500);
    }, 20000);
  });

  describe('Memory efficiency tests', () => {
    it('should process large files without excessive memory usage', async () => {
      // Create a large file with repetitive content
      const linesPerFunction = 10;
      const functionCount = 100;

      const functions = Array.from({ length: functionCount }, (_, i) => {
        const functionBody = Array.from({ length: linesPerFunction }, (_, j) =>
          `  const var${i}_${j} = ${j};`
        ).join('\n');

        return `
export function largeFunction${i}(): number {
${functionBody}
  return ${i};
}`;
      }).join('\n\n');

      await fs.writeFile(path.join(tempDir, 'large-file.ts'), functions);

      // Monitor memory usage (basic check)
      const memBefore = process.memoryUsage();
      const result = await indexer.indexDirectory(tempDir);
      const memAfter = process.memoryUsage();

      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;
      const memoryPerMB = memoryIncrease / (1024 * 1024); // Convert to MB

      expect(result.files).toHaveLength(1);
      expect(result.files[0].symbols).toHaveLength(functionCount);

      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryPerMB).toBeLessThan(100);
    });

    it('should handle multiple concurrent indexing operations', async () => {
      // Create separate directories for concurrent operations
      const concurrentDirs = await Promise.all(
        Array.from({ length: 3 }, async (_, i) => {
          const dir = await fs.mkdtemp(path.join(os.tmpdir(), `concurrent-${i}-`));

          // Create files in each directory
          for (let j = 0; j < 10; j++) {
            const content = `
export const DIR = ${i};
export const FILE = ${j};
export function getInfo${i}_${j}(): string { return \`\${DIR}-\${FILE}\`; }
            `;
            await fs.writeFile(path.join(dir, `file${j}.ts`), content);
          }

          return dir;
        })
      );

      try {
        // Run indexing operations concurrently
        const startTime = Date.now();
        const results = await Promise.all(
          concurrentDirs.map(dir => indexer.indexDirectory(dir))
        );
        const endTime = Date.now();

        const processingTime = endTime - startTime;

        // All operations should complete successfully
        expect(results).toHaveLength(3);
        results.forEach((result, i) => {
          expect(result.files).toHaveLength(10);
          expect(result.stats!.totalSymbols).toBe(30); // 3 symbols per file * 10 files
        });

        // Concurrent processing should be reasonably efficient
        expect(processingTime).toBeLessThan(10000); // Within 10 seconds
      } finally {
        // Clean up concurrent directories
        await Promise.all(
          concurrentDirs.map(dir => fs.rm(dir, { recursive: true, force: true }))
        );
      }
    });
  });

  describe('Configuration performance impact', () => {
    beforeEach(async () => {
      // Create a standard set of test files
      const fileTypes = [
        { ext: '.ts', content: 'export const ts = true; export function tsFunc(): void {}' },
        { ext: '.js', content: 'const js = true; function jsFunc() {} module.exports = { js, jsFunc };' },
        { ext: '.py', content: 'def py_func(): pass\nclass PyClass: pass' }
      ];

      for (let i = 0; i < 20; i++) {
        for (const type of fileTypes) {
          await fs.writeFile(path.join(tempDir, `file${i}${type.ext}`), type.content);
        }
      }
    });

    it('should show performance difference with and without hashing', async () => {
      // Test with hashing enabled
      const startWithHashing = Date.now();
      const resultWithHashing = await indexer.indexDirectory(tempDir, { computeHashes: true });
      const endWithHashing = Date.now();

      // Test without hashing
      const startWithoutHashing = Date.now();
      const resultWithoutHashing = await indexer.indexDirectory(tempDir, { computeHashes: false });
      const endWithoutHashing = Date.now();

      const timeWithHashing = endWithHashing - startWithHashing;
      const timeWithoutHashing = endWithoutHashing - startWithoutHashing;

      // Both should process same number of files
      expect(resultWithHashing.files).toHaveLength(resultWithoutHashing.files.length);

      // Hashing should add some overhead, but not be dramatically slower
      expect(timeWithHashing).toBeGreaterThan(timeWithoutHashing);
      expect(timeWithHashing).toBeLessThan(timeWithoutHashing * 3); // No more than 3x slower

      // Verify hashing actually worked
      resultWithHashing.files.forEach(file => {
        expect(file.contentHash).toBeDefined();
        expect(file.contentHash).toHaveLength(64); // SHA-256
      });

      resultWithoutHashing.files.forEach(file => {
        expect(file.contentHash).toBeUndefined();
      });
    });

    it('should show performance scaling with different concurrency levels', async () => {
      const concurrencyLevels = [1, 2, 4, 8];
      const results: { concurrency: number; time: number; success: boolean }[] = [];

      for (const concurrency of concurrencyLevels) {
        const startTime = Date.now();
        try {
          const result = await indexer.indexDirectory(tempDir, { concurrency });
          const endTime = Date.now();

          results.push({
            concurrency,
            time: endTime - startTime,
            success: result.files.length > 0
          });
        } catch (error) {
          results.push({
            concurrency,
            time: Infinity,
            success: false
          });
        }
      }

      // All concurrency levels should work
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Higher concurrency should generally be faster (up to a point)
      const concurrency1Time = results.find(r => r.concurrency === 1)!.time;
      const concurrency4Time = results.find(r => r.concurrency === 4)!.time;

      // Concurrency should provide some benefit (allowing for system variation)
      expect(concurrency4Time).toBeLessThan(concurrency1Time * 1.2); // At most 20% slower
    });

    it('should handle file size limits efficiently', async () => {
      // Create files of different sizes
      const sizes = [100, 1000, 10000, 50000]; // bytes

      for (const size of sizes) {
        const content = `export const data = "${'x'.repeat(size - 25)}";`; // Approximately the target size
        await fs.writeFile(path.join(tempDir, `size${size}.ts`), content);
      }

      // Test with different size limits
      const sizeLimits = [500, 5000, 25000, 100000];

      for (const limit of sizeLimits) {
        const startTime = Date.now();
        const result = await indexer.indexDirectory(tempDir, { maxFileSize: limit });
        const endTime = Date.now();

        const processingTime = endTime - startTime;

        // Should complete quickly regardless of size limit
        expect(processingTime).toBeLessThan(5000);

        // Should only include files under the size limit
        result.files.forEach(file => {
          expect(file.size).toBeLessThanOrEqual(limit);
        });
      }
    });
  });

  describe('Progress tracking performance', () => {
    beforeEach(async () => {
      // Create files for progress tracking tests
      for (let i = 0; i < 30; i++) {
        const content = `export const file${i} = ${i}; export function func${i}(): number { return ${i}; }`;
        await fs.writeFile(path.join(tempDir, `progress${i}.ts`), content);
      }
    });

    it('should handle progress callbacks without significant overhead', async () => {
      const progressUpdates: any[] = [];

      const startWithProgress = Date.now();
      await indexer.indexDirectoryWithProgress(tempDir, {}, (progress) => {
        progressUpdates.push({ ...progress });
      });
      const endWithProgress = Date.now();

      const startWithoutProgress = Date.now();
      await indexer.indexDirectory(tempDir);
      const endWithoutProgress = Date.now();

      const timeWithProgress = endWithProgress - startWithProgress;
      const timeWithoutProgress = endWithoutProgress - startWithoutProgress;

      // Progress tracking should not add significant overhead
      expect(timeWithProgress).toBeLessThan(timeWithoutProgress * 2); // No more than 2x slower

      // Should have received progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);

      // Final progress should show completion
      const finalProgress = progressUpdates[progressUpdates.length - 1];
      expect(finalProgress.filesProcessed).toBe(finalProgress.totalFiles);
    });
  });
});