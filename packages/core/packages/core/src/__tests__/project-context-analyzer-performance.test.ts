/**
 * Performance and Load Testing for ProjectContextAnalyzer
 *
 * This test file focuses on:
 * - Performance benchmarks
 * - Memory usage validation
 * - Concurrent operation testing
 * - Large dataset handling
 * - Stress testing scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  ProjectContextAnalyzer,
  getProjectContextAnalyzer,
  analyzeProject,
  type ProjectContextAnalyzerOptions,
} from '../project-context-analyzer.js';
import { getPlatformShell } from '../shell-utils.js';

// Mock external dependencies
vi.mock('child_process');
vi.mock('fs');
vi.mock('path');
vi.mock('../shell-utils.js');

const mockExecAsync = vi.fn();
vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecAsync),
}));

const mockGetPlatformShell = vi.mocked(getPlatformShell);

describe('ProjectContextAnalyzer - Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformShell.mockReturnValue({
      shell: '/bin/sh',
      shellArgs: ['-c']
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Single Instance Performance', () => {
    it('performs analysis within acceptable time limits', async () => {
      const analyzer = new ProjectContextAnalyzer('/performance-test');

      // Mock fast git responses
      mockExecAsync
        .mockResolvedValue({ stdout: '.git', stderr: '' })
        .mockResolvedValue({ stdout: 'main\n', stderr: '' })
        .mockResolvedValue({ stdout: '', stderr: '' })
        .mockResolvedValue({ stdout: '0\t0\n', stderr: '' })
        .mockResolvedValue({ stdout: '', stderr: '' })
        .mockResolvedValue({ stdout: 'abc123|commit|1640995200\n', stderr: '' })
        .mockResolvedValue({ stdout: '', stderr: '' })
        .mockResolvedValue({ stdout: 'origin\tgit@example.com:test.git\t(fetch)\n', stderr: '' });

      const startTime = process.hrtime.bigint();
      const context = await analyzer.analyze();
      const endTime = process.hrtime.bigint();

      const durationMs = Number(endTime - startTime) / 1_000_000;

      expect(context).toBeDefined();
      expect(durationMs).toBeLessThan(100); // Should complete within 100ms
    });

    it('handles large git repositories efficiently', async () => {
      const analyzer = new ProjectContextAnalyzer('/large-repo');

      // Mock large repository with many files and commits
      const largeFileList = Array.from({ length: 10000 }, (_, i) =>
        `M  src/file${i}.ts`
      ).join('\n');

      const manyStashes = Array.from({ length: 1000 }, (_, i) =>
        `stash@{${i}}: WIP on feature-${i}`
      ).join('\n');

      const manyRemotes = Array.from({ length: 100 }, (_, i) =>
        `remote${i}\tgit@github.com:user/repo${i}.git\t(fetch)`
      ).join('\n');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '1000\t500\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: largeFileList, stderr: '' })
        .mockResolvedValueOnce({ stdout: 'abc123|Large repository commit|1640995200\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: manyStashes, stderr: '' })
        .mockResolvedValueOnce({ stdout: manyRemotes, stderr: '' });

      const startTime = process.hrtime.bigint();
      const context = await analyzer.analyze();
      const endTime = process.hrtime.bigint();

      const durationMs = Number(endTime - startTime) / 1_000_000;

      expect(context.gitStatus?.staged).toHaveLength(10000);
      expect(context.gitStatus?.stashCount).toBe(1000);
      expect(context.gitStatus?.remotes).toHaveLength(100);
      expect(durationMs).toBeLessThan(500); // Should handle large data within 500ms
    });

    it('maintains consistent performance across multiple calls', async () => {
      const analyzer = new ProjectContextAnalyzer('/consistent-test');

      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        mockExecAsync.mockRejectedValue(new Error('not a git repo'));

        const startTime = process.hrtime.bigint();
        await analyzer.analyze();
        const endTime = process.hrtime.bigint();

        times.push(Number(endTime - startTime) / 1_000_000);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const variance = times.reduce((acc, time) => acc + Math.pow(time - avgTime, 2), 0) / times.length;

      expect(avgTime).toBeLessThan(50); // Average should be under 50ms
      expect(maxTime).toBeLessThan(200); // No single call should exceed 200ms
      expect(variance).toBeLessThan(100); // Low variance indicates consistent performance
      expect(maxTime / minTime).toBeLessThan(5); // Max shouldn't be more than 5x min
    });
  });

  describe('Concurrent Operation Performance', () => {
    it('handles high concurrency load efficiently', async () => {
      const analyzer = new ProjectContextAnalyzer('/concurrency-test');

      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const concurrentOperations = 1000;
      const startTime = process.hrtime.bigint();

      const promises = Array.from({ length: concurrentOperations }, () =>
        analyzer.analyze()
      );

      const results = await Promise.all(promises);
      const endTime = process.hrtime.bigint();

      const totalTimeMs = Number(endTime - startTime) / 1_000_000;
      const avgTimePerOperation = totalTimeMs / concurrentOperations;

      expect(results).toHaveLength(concurrentOperations);
      expect(totalTimeMs).toBeLessThan(5000); // Should complete within 5 seconds
      expect(avgTimePerOperation).toBeLessThan(10); // Average per operation under 10ms

      // Verify all results are consistent
      const firstResult = results[0];
      results.forEach(result => {
        expect(result.structure.root).toBe(firstResult.structure.root);
        expect(result.frameworks).toEqual(firstResult.frameworks);
      });
    });

    it('maintains performance with mixed operation types', async () => {
      const analyzer = new ProjectContextAnalyzer('/mixed-ops');

      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const operations = [
        () => analyzer.analyze(),
        () => analyzer.getGitStatus(),
        () => analyzer.getProjectStructure(),
        () => analyzer.detectFrameworks(),
        () => analyzer.getConfigurationInfoList(),
        () => analyzer.getTestFrameworkInfoList(),
      ];

      const mixedOperations = Array.from({ length: 600 }, (_, i) =>
        operations[i % operations.length]()
      );

      const startTime = process.hrtime.bigint();
      const results = await Promise.all(mixedOperations);
      const endTime = process.hrtime.bigint();

      const totalTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(results).toHaveLength(600);
      expect(totalTimeMs).toBeLessThan(3000); // Mixed operations within 3 seconds
    });

    it('scales linearly with concurrent analyzers', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const testScales = [10, 50, 100, 200];
      const timings: { scale: number; time: number }[] = [];

      for (const scale of testScales) {
        const analyzers = Array.from({ length: scale }, (_, i) =>
          new ProjectContextAnalyzer(`/test-${i}`)
        );

        const startTime = process.hrtime.bigint();
        await Promise.all(analyzers.map(analyzer => analyzer.analyze()));
        const endTime = process.hrtime.bigint();

        const timeMs = Number(endTime - startTime) / 1_000_000;
        timings.push({ scale, time: timeMs });
      }

      // Performance should scale reasonably (not exponentially)
      const smallScale = timings.find(t => t.scale === 10)!;
      const largeScale = timings.find(t => t.scale === 200)!;

      const scaleFactor = largeScale.scale / smallScale.scale; // 20x
      const timeFactor = largeScale.time / smallScale.time;

      expect(timeFactor).toBeLessThan(scaleFactor * 2); // Should not be more than 2x the scale factor
    });
  });

  describe('Memory Usage and Resource Management', () => {
    it('maintains reasonable memory usage with large datasets', async () => {
      const analyzer = new ProjectContextAnalyzer('/memory-test');

      // Create very large mock responses
      const massiveFileList = Array.from({ length: 50000 }, (_, i) => {
        const types = ['M', 'A', 'D', 'R', 'C'];
        const status = types[i % types.length];
        return `${status}  src/large/directory/structure/file${i}.ts`;
      }).join('\n');

      const massiveCommitMessage = 'Detailed commit message: ' + 'Lorem ipsum '.repeat(10000);

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '0\t0\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: massiveFileList, stderr: '' })
        .mockResolvedValueOnce({
          stdout: `abc123|${massiveCommitMessage}|1640995200\n`,
          stderr: ''
        })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      // Check memory before
      const beforeMemory = process.memoryUsage();

      const context = await analyzer.analyze();

      // Check memory after
      const afterMemory = process.memoryUsage();

      expect(context.gitStatus?.staged).toHaveLength(50000);
      expect(context.gitStatus?.lastCommitMessage).toBe(massiveCommitMessage);

      // Memory usage should not grow excessively (less than 100MB increase)
      const memoryIncreaseMB = (afterMemory.heapUsed - beforeMemory.heapUsed) / (1024 * 1024);
      expect(memoryIncreaseMB).toBeLessThan(100);
    });

    it('does not leak memory across multiple operations', async () => {
      const analyzer = new ProjectContextAnalyzer('/leak-test');

      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const initialMemory = process.memoryUsage();

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        await analyzer.analyze();

        // Force garbage collection periodically if available
        if (global.gc && i % 100 === 0) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncreaseMB = (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024);

      // Memory should not significantly increase (less than 10MB for 1000 operations)
      expect(memoryIncreaseMB).toBeLessThan(10);
    });

    it('handles extremely deep directory structures efficiently', async () => {
      const analyzer = new ProjectContextAnalyzer('/deep/path/' + 'nested/'.repeat(1000) + 'final', {
        maxDepth: 50,
      });

      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const startTime = process.hrtime.bigint();
      const context = await analyzer.analyze();
      const endTime = process.hrtime.bigint();

      const durationMs = Number(endTime - startTime) / 1_000_000;

      expect(context.structure.root).toContain('nested/');
      expect(durationMs).toBeLessThan(100); // Should handle deep paths efficiently
    });
  });

  describe('Singleton Performance', () => {
    it('getProjectContextAnalyzer provides fast singleton access', () => {
      const iterations = 10000;
      const path = '/singleton-test';

      const startTime = process.hrtime.bigint();

      const analyzers = Array.from({ length: iterations }, () =>
        getProjectContextAnalyzer(path)
      );

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      // All should be the same instance
      const firstAnalyzer = analyzers[0];
      analyzers.forEach(analyzer => {
        expect(analyzer).toBe(firstAnalyzer);
      });

      // Should be very fast (< 10ms for 10k accesses)
      expect(durationMs).toBeLessThan(10);
    });

    it('handles rapid path switching efficiently', () => {
      const paths = Array.from({ length: 100 }, (_, i) => `/path-${i}`);
      const iterations = 1000;

      const startTime = process.hrtime.bigint();

      for (let i = 0; i < iterations; i++) {
        const path = paths[i % paths.length];
        getProjectContextAnalyzer(path);
      }

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      expect(durationMs).toBeLessThan(50); // Should handle path switching quickly
    });
  });

  describe('Stress Testing', () => {
    it('handles maximum realistic git repository complexity', async () => {
      const analyzer = new ProjectContextAnalyzer('/stress-test');

      // Create maximum complexity scenario
      const maxFiles = Array.from({ length: 100000 }, (_, i) => {
        const statuses = ['M', 'A', 'D', 'R', 'C', 'U'];
        const status = statuses[i % statuses.length];
        const path = `package${Math.floor(i / 1000)}/src/component${i % 1000}.${i % 2 === 0 ? 'ts' : 'js'}`;
        return `${status}  ${path}`;
      }).join('\n');

      const maxStashes = Array.from({ length: 10000 }, (_, i) =>
        `stash@{${i}}: WIP on feature-${Math.floor(i / 100)}-${i % 100}`
      ).join('\n');

      const maxRemotes = Array.from({ length: 1000 }, (_, i) =>
        `remote${i}\tgit@github.com:org${Math.floor(i / 10)}/repo${i % 10}.git\t(fetch)`
      ).join('\n');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '10000\t5000\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: maxFiles, stderr: '' })
        .mockResolvedValueOnce({ stdout: 'abc123|Massive repository update|1640995200\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: maxStashes, stderr: '' })
        .mockResolvedValueOnce({ stdout: maxRemotes, stderr: '' });

      const startTime = process.hrtime.bigint();
      const context = await analyzer.analyze();
      const endTime = process.hrtime.bigint();

      const durationMs = Number(endTime - startTime) / 1_000_000;

      expect(context.gitStatus?.staged.length).toBeGreaterThan(50000);
      expect(context.gitStatus?.stashCount).toBe(10000);
      expect(context.gitStatus?.remotes).toHaveLength(1000);
      expect(context.gitStatus?.ahead).toBe(10000);
      expect(context.gitStatus?.behind).toBe(5000);

      // Should handle maximum complexity within reasonable time (< 2 seconds)
      expect(durationMs).toBeLessThan(2000);
    });

    it('survives malicious or corrupted input gracefully', async () => {
      const analyzer = new ProjectContextAnalyzer('/malicious-test');

      // Test various malicious or corrupted inputs
      const maliciousInputs = [
        '\x00\x01\x02\x03\x04\x05malicious binary data',
        'M  ' + 'x'.repeat(1000000), // Extremely long path
        Array.from({ length: 1000000 }, () => 'invalid').join('\n'), // Massive invalid data
        '🚀💀🔥'.repeat(10000), // Unicode spam
        '\n'.repeat(1000000), // Newline spam
        ' '.repeat(1000000), // Whitespace spam
      ];

      for (const maliciousInput of maliciousInputs) {
        mockExecAsync
          .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
          .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
          .mockResolvedValueOnce({ stdout: '', stderr: '' })
          .mockResolvedValueOnce({ stdout: '0\t0\n', stderr: '' })
          .mockResolvedValueOnce({ stdout: maliciousInput, stderr: '' })
          .mockResolvedValueOnce({ stdout: '', stderr: '' })
          .mockResolvedValueOnce({ stdout: '', stderr: '' })
          .mockResolvedValueOnce({ stdout: '', stderr: '' });

        const startTime = Date.now();

        // Should not crash or hang
        const context = await analyzer.analyze();
        const endTime = Date.now();

        expect(context).toBeDefined();
        expect(endTime - startTime).toBeLessThan(5000); // Should not take more than 5 seconds

        vi.clearAllMocks();
        mockGetPlatformShell.mockReturnValue({
          shell: '/bin/sh',
          shellArgs: ['-c']
        });
      }
    });

    it('maintains stability under extreme concurrent load', async () => {
      const concurrentAnalyzers = 2000;
      const operationsPerAnalyzer = 5;

      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const allOperations = [];

      for (let i = 0; i < concurrentAnalyzers; i++) {
        const analyzer = new ProjectContextAnalyzer(`/stress-${i}`);

        for (let j = 0; j < operationsPerAnalyzer; j++) {
          allOperations.push(analyzer.analyze());
        }
      }

      const startTime = process.hrtime.bigint();
      const results = await Promise.all(allOperations);
      const endTime = process.hrtime.bigint();

      const totalTimeMs = Number(endTime - startTime) / 1_000_000;
      const totalOperations = concurrentAnalyzers * operationsPerAnalyzer;

      expect(results).toHaveLength(totalOperations);
      expect(totalTimeMs).toBeLessThan(10000); // Should complete within 10 seconds

      // Verify no operations failed
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.structure).toBeDefined();
      });
    });
  });

  describe('analyzeProject Function Performance', () => {
    it('maintains performance with different option combinations', async () => {
      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const optionCombinations = [
        {},
        { analyzeGit: false },
        { detectFrameworks: false },
        { analyzeConfiguration: false },
        { detectTests: false },
        { maxDepth: 1 },
        { excludeDirectories: ['node_modules', 'dist', 'build'] },
        { analyzeGit: false, detectFrameworks: false, maxDepth: 5 },
      ];

      const allPromises = [];

      const startTime = process.hrtime.bigint();

      for (let i = 0; i < 100; i++) {
        const options = optionCombinations[i % optionCombinations.length];
        allPromises.push(analyzeProject(`/perf-test-${i}`, options));
      }

      const results = await Promise.all(allPromises);
      const endTime = process.hrtime.bigint();

      const totalTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(results).toHaveLength(100);
      expect(totalTimeMs).toBeLessThan(2000); // Should complete within 2 seconds

      // Verify different configurations work
      results.forEach((result, i) => {
        expect(result).toBeDefined();
        const options = optionCombinations[i % optionCombinations.length];

        if (options.analyzeGit === false) {
          expect(result.gitStatus).toBeUndefined();
        }
      });
    });
  });

  describe('Performance Regression Prevention', () => {
    it('establishes baseline performance metrics', async () => {
      const analyzer = new ProjectContextAnalyzer('/baseline');

      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const iterations = 1000;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = process.hrtime.bigint();
        await analyzer.analyze();
        const endTime = process.hrtime.bigint();

        times.push(Number(endTime - startTime) / 1_000_000);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
      const maxTime = Math.max(...times);

      // Baseline expectations for regression testing
      expect(avgTime).toBeLessThan(5); // Average under 5ms
      expect(p95Time).toBeLessThan(20); // 95th percentile under 20ms
      expect(maxTime).toBeLessThan(50); // Max under 50ms

      // Log metrics for regression tracking
      console.log('Performance Baseline:', {
        avgTime: avgTime.toFixed(2) + 'ms',
        p95Time: p95Time.toFixed(2) + 'ms',
        maxTime: maxTime.toFixed(2) + 'ms',
      });
    });
  });
});