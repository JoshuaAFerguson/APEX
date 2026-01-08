/**
 * ImportAutoFixer Performance Tests
 *
 * Tests for performance characteristics, stress testing, and benchmarks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImportAutoFixer } from './import-auto-fixer';
import type {
  ImportAutoFixerOptions,
  MissingImport,
  ImportResolution,
} from './types';
import * as fs from 'fs/promises';

// Mock fs module
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

describe('ImportAutoFixer Performance Tests', () => {
  const projectPath = '/test/project';
  let fixer: ImportAutoFixer;

  beforeEach(() => {
    vi.clearAllMocks();

    const options: ImportAutoFixerOptions = {
      projectPath,
      detector: 'eslint',
      dryRun: true,
    };

    fixer = new ImportAutoFixer(options);

    // Mock basic project files
    mockFs.readFile.mockImplementation(async (filePath: any) => {
      if (filePath.includes('tsconfig.json')) {
        return JSON.stringify({
          compilerOptions: {
            baseUrl: './src',
            paths: { '@/*': ['*'] },
          },
        });
      }

      if (filePath.includes('package.json')) {
        return JSON.stringify({
          name: 'test-project',
          dependencies: {
            react: '^18.0.0',
            lodash: '^4.17.0',
            'date-fns': '^2.29.0',
          },
        });
      }

      return 'const x = 1;';
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Analysis Performance', () => {
    it('should analyze single file quickly', async () => {
      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([]);

      const startTime = Date.now();
      await fixer.analyze(['/test/file.ts']);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should handle multiple files efficiently', async () => {
      const fileCount = 50;
      const files = Array.from({ length: fileCount }, (_, i) => `/test/file${i}.ts`);

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([]);

      const startTime = Date.now();
      const analyses = await fixer.analyze(files);
      const endTime = Date.now();

      expect(analyses).toHaveLength(fileCount);

      const duration = endTime - startTime;
      const avgTimePerFile = duration / fileCount;

      expect(avgTimePerFile).toBeLessThan(50); // Average under 50ms per file
      expect(duration).toBeLessThan(3000); // Total under 3 seconds
    });

    it('should scale linearly with file count', async () => {
      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([]);

      const benchmarks: Array<{ files: number; duration: number }> = [];

      for (const fileCount of [10, 20, 40]) {
        const files = Array.from({ length: fileCount }, (_, i) => `/test/file${i}.ts`);

        const startTime = Date.now();
        await fixer.analyze(files);
        const endTime = Date.now();

        benchmarks.push({
          files: fileCount,
          duration: endTime - startTime,
        });
      }

      // Check that duration scales roughly linearly
      const timePerFile10 = benchmarks[0].duration / benchmarks[0].files;
      const timePerFile20 = benchmarks[1].duration / benchmarks[1].files;
      const timePerFile40 = benchmarks[2].duration / benchmarks[2].files;

      // Allow for some variance, but should be roughly similar
      const variance = 0.5; // 50% variance allowed
      expect(Math.abs(timePerFile20 - timePerFile10)).toBeLessThan(timePerFile10 * variance);
      expect(Math.abs(timePerFile40 - timePerFile10)).toBeLessThan(timePerFile10 * variance);
    });

    it('should handle large files efficiently', async () => {
      // Create a large file content (100KB+)
      const largeFileContent = 'const x = 1;\n'.repeat(10000);
      mockFs.readFile.mockResolvedValue(largeFileContent);

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([]);

      const startTime = Date.now();
      await fixer.analyze(['/test/large-file.ts']);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(500); // Should handle large files in under 500ms
    });
  });

  describe('Resolution Performance', () => {
    it('should resolve imports quickly', async () => {
      const missingImports: MissingImport[] = Array.from({ length: 20 }, (_, i) => ({
        identifier: `function${i}`,
        line: i + 1,
        column: 1,
      }));

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue(missingImports);

      // Mock fast resolver
      vi.spyOn(fixer['resolvers'][0], 'canResolve').mockResolvedValue(true);
      vi.spyOn(fixer['resolvers'][0], 'resolve').mockImplementation(async (identifier) => ({
        source: `./modules/${identifier}`,
        importType: 'named' as const,
        isTypeOnly: false,
        confidence: 1.0,
        resolvedBy: 'local-resolver',
      }));

      const startTime = Date.now();
      const result = await fixer.fixFile('/test/file.ts');
      const endTime = Date.now();

      expect(result.importsAdded).toHaveLength(20);

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000); // Should resolve 20 imports in under 1 second
    });

    it('should cache resolution results effectively', async () => {
      const missingImports: MissingImport[] = [
        { identifier: 'React', line: 1, column: 1 },
        { identifier: 'React', line: 5, column: 1 }, // Duplicate
        { identifier: 'useState', line: 2, column: 1 },
        { identifier: 'React', line: 10, column: 1 }, // Another duplicate
      ];

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue(missingImports);

      let resolveCallCount = 0;
      vi.spyOn(fixer['resolvers'][2], 'canResolve').mockResolvedValue(true);
      vi.spyOn(fixer['resolvers'][2], 'resolve').mockImplementation(async (identifier) => {
        resolveCallCount++;
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate slow resolution

        return {
          source: 'react',
          importType: identifier === 'React' ? 'default' : 'named',
          isTypeOnly: false,
          confidence: 0.9,
          resolvedBy: 'package-resolver',
        } as ImportResolution;
      });

      const startTime = Date.now();
      await fixer.fixFile('/test/file.ts');
      const endTime = Date.now();

      const duration = endTime - startTime;

      // Should be faster than resolving each duplicate separately
      // Without caching: 4 × 100ms = 400ms minimum
      // With caching: should be much less
      expect(duration).toBeLessThan(350);

      // Should only resolve unique identifiers
      expect(resolveCallCount).toBeLessThanOrEqual(2); // React and useState
    });

    it('should timeout long-running resolutions', async () => {
      const missingImports: MissingImport[] = [
        { identifier: 'slowFunction', line: 1, column: 1 },
      ];

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue(missingImports);

      // Mock very slow resolver
      vi.spyOn(fixer['resolvers'][0], 'canResolve').mockResolvedValue(true);
      vi.spyOn(fixer['resolvers'][0], 'resolve').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
        return null;
      });

      const startTime = Date.now();
      const result = await fixer.fixFile('/test/file.ts');
      const endTime = Date.now();

      const duration = endTime - startTime;

      // Should timeout and not wait the full 10 seconds
      expect(duration).toBeLessThan(8000);
      expect(result.errors).toHaveLength(1);
    }, 15000); // Increase test timeout
  });

  describe('Memory Performance', () => {
    it('should not leak memory during repeated operations', async () => {
      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([]);

      const initialMemory = process.memoryUsage();

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await fixer.analyze([`/test/file${i}.ts`]);
      }

      const finalMemory = process.memoryUsage();

      // Memory usage shouldn't grow significantly
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const maxGrowthMB = 50; // Allow up to 50MB growth

      expect(memoryGrowth).toBeLessThan(maxGrowthMB * 1024 * 1024);
    });

    it('should handle large numbers of missing imports without memory issues', async () => {
      const largeImportList: MissingImport[] = Array.from({ length: 10000 }, (_, i) => ({
        identifier: `function${i}`,
        line: i + 1,
        column: 1,
      }));

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue(largeImportList);

      // Mock resolver that always fails (to avoid actual resolution overhead)
      vi.spyOn(fixer['resolvers'][0], 'canResolve').mockResolvedValue(false);
      vi.spyOn(fixer['resolvers'][1], 'canResolve').mockResolvedValue(false);
      vi.spyOn(fixer['resolvers'][2], 'canResolve').mockResolvedValue(false);

      const initialMemory = process.memoryUsage();

      const result = await fixer.fixFile('/test/file.ts');

      const finalMemory = process.memoryUsage();

      expect(result.errors).toHaveLength(10000);

      // Memory shouldn't grow excessively
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const maxGrowthMB = 100; // Allow up to 100MB for 10k items

      expect(memoryGrowth).toBeLessThan(maxGrowthMB * 1024 * 1024);
    });

    it('should cleanup after file processing', async () => {
      const missingImports: MissingImport[] = Array.from({ length: 100 }, (_, i) => ({
        identifier: `function${i}`,
        line: i + 1,
        column: 1,
      }));

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue(missingImports);
      vi.spyOn(fixer['resolvers'][2], 'canResolve').mockResolvedValue(true);
      vi.spyOn(fixer['resolvers'][2], 'resolve').mockResolvedValue({
        source: 'test-package',
        importType: 'named',
        isTypeOnly: false,
        confidence: 0.9,
        resolvedBy: 'package-resolver',
      } as ImportResolution);

      const baselineMemory = process.memoryUsage();

      // Process file
      await fixer.fixFile('/test/file.ts');

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const afterMemory = process.memoryUsage();

      // Memory usage should return close to baseline
      const memoryGrowth = afterMemory.heapUsed - baselineMemory.heapUsed;
      const maxGrowthMB = 20; // Allow small growth for normal operations

      expect(memoryGrowth).toBeLessThan(maxGrowthMB * 1024 * 1024);
    });
  });

  describe('Configuration Performance', () => {
    it('should handle frequent configuration changes efficiently', async () => {
      const startTime = Date.now();

      // Make many configuration changes
      for (let i = 0; i < 1000; i++) {
        fixer.configure({
          style: {
            quoteStyle: i % 2 === 0 ? 'single' : 'double',
          },
        });
      }

      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100); // Should handle 1000 config changes in under 100ms
    });

    it('should not degrade performance with complex configurations', async () => {
      // Set up complex configuration
      fixer.configure({
        resolvers: {
          local: {
            enabled: true,
            searchPaths: Array.from({ length: 50 }, (_, i) => `path${i}`),
            excludePatterns: Array.from({ length: 100 }, (_, i) => `**/*.exclude${i}.*`),
          },
          package: {
            enabled: true,
            preferredPackages: Object.fromEntries(
              Array.from({ length: 1000 }, (_, i) => [`function${i}`, `package${i}`])
            ),
            excludePackages: Array.from({ length: 50 }, (_, i) => `excluded-package${i}`),
          },
        },
      });

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([]);

      const startTime = Date.now();
      await fixer.analyze(['/test/file.ts']);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(200); // Should still be fast with complex config
    });
  });

  describe('Concurrent Operation Performance', () => {
    it('should handle concurrent analyses efficiently', async () => {
      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([]);

      const concurrentCount = 10;
      const filesPerAnalysis = 5;

      const analyses = Array.from({ length: concurrentCount }, (_, i) => {
        const files = Array.from({ length: filesPerAnalysis }, (_, j) =>
          `/test/concurrent${i}/file${j}.ts`
        );
        return fixer.analyze(files);
      });

      const startTime = Date.now();
      const results = await Promise.all(analyses);
      const endTime = Date.now();

      expect(results).toHaveLength(concurrentCount);
      results.forEach(result => {
        expect(result).toHaveLength(filesPerAnalysis);
      });

      const duration = endTime - startTime;
      const totalFiles = concurrentCount * filesPerAnalysis;
      const avgTimePerFile = duration / totalFiles;

      // Concurrent operations should be more efficient than sequential
      expect(avgTimePerFile).toBeLessThan(20); // Under 20ms per file on average
    });

    it('should handle mixed operation types concurrently', async () => {
      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([
        { identifier: 'testFunction', line: 1, column: 1 } as MissingImport,
      ]);

      vi.spyOn(fixer['resolvers'][2], 'canResolve').mockResolvedValue(true);
      vi.spyOn(fixer['resolvers'][2], 'resolve').mockResolvedValue({
        source: 'test-package',
        importType: 'named',
        isTypeOnly: false,
        confidence: 0.9,
        resolvedBy: 'package-resolver',
      } as ImportResolution);

      const operations = [
        fixer.analyze(['/test/file1.ts', '/test/file2.ts']),
        fixer.fixFile('/test/file3.ts'),
        fixer.fix(['/test/file4.ts', '/test/file5.ts']),
        fixer.analyze(['/test/file6.ts']),
      ];

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const endTime = Date.now();

      expect(results).toHaveLength(4);

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000); // Should handle mixed operations quickly
    });
  });

  describe('Stress Tests', () => {
    it('should survive extreme file counts', async () => {
      const extremeFileCount = 500;
      const files = Array.from({ length: extremeFileCount }, (_, i) => `/test/extreme${i}.ts`);

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([]);

      const startTime = Date.now();
      const analyses = await fixer.analyze(files);
      const endTime = Date.now();

      expect(analyses).toHaveLength(extremeFileCount);

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    }, 40000); // Increase test timeout

    it('should handle extreme import counts per file', async () => {
      const extremeImportCount = 2000;
      const missingImports: MissingImport[] = Array.from({ length: extremeImportCount }, (_, i) => ({
        identifier: `extremeFunction${i}`,
        line: i + 1,
        column: 1,
      }));

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue(missingImports);

      // Mock resolver that fails quickly to avoid actual resolution overhead
      vi.spyOn(fixer['resolvers'][0], 'canResolve').mockResolvedValue(false);
      vi.spyOn(fixer['resolvers'][1], 'canResolve').mockResolvedValue(false);
      vi.spyOn(fixer['resolvers'][2], 'canResolve').mockResolvedValue(false);

      const startTime = Date.now();
      const result = await fixer.fixFile('/test/extreme-file.ts');
      const endTime = Date.now();

      expect(result.errors).toHaveLength(extremeImportCount);

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000); // Should handle extreme counts within 10 seconds
    }, 15000); // Increase test timeout

    it('should maintain performance under continuous load', async () => {
      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([]);

      const iterations = 200;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await fixer.analyze([`/test/continuous${i}.ts`]);
        const endTime = Date.now();

        durations.push(endTime - startTime);
      }

      // Performance shouldn't degrade significantly over time
      const firstQuarter = durations.slice(0, Math.floor(iterations / 4));
      const lastQuarter = durations.slice(Math.floor(iterations * 3 / 4));

      const avgFirstQuarter = firstQuarter.reduce((a, b) => a + b) / firstQuarter.length;
      const avgLastQuarter = lastQuarter.reduce((a, b) => a + b) / lastQuarter.length;

      // Allow for some variance but performance shouldn't degrade more than 50%
      expect(avgLastQuarter).toBeLessThan(avgFirstQuarter * 1.5);
    }, 30000); // Increase test timeout
  });
});