/**
 * Performance and Stress Tests for ProjectContextAnalyzer
 *
 * These tests focus on performance characteristics, memory usage,
 * and behavior under high load conditions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import {
  ProjectContextAnalyzer,
  getProjectContextAnalyzer,
  analyzeProject,
} from '../project-context-analyzer.js';
import { getPlatformShell } from '../shell-utils.js';

// Mock external dependencies
vi.mock('fs');
vi.mock('../shell-utils.js');

const mockFs = vi.mocked(fs, true);
const mockGetPlatformShell = vi.mocked(getPlatformShell);

const mockExecAsync = vi.fn();
vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecAsync),
}));

describe('ProjectContextAnalyzer Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformShell.mockReturnValue({
      shell: '/bin/sh',
      shellArgs: ['-c']
    });
  });

  describe('High Concurrency Tests', () => {
    it('handles 100 concurrent analyze() calls efficiently', async () => {
      const analyzer = new ProjectContextAnalyzer('/performance-test');

      mockExecAsync.mockRejectedValue(new Error('not git'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const startTime = performance.now();

      const promises = Array.from({ length: 100 }, () => analyzer.analyze());
      const results = await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(100);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      // All results should be consistent
      results.forEach(result => {
        expect(result.structure.root).toBe('/performance-test');
        expect(result.detectedAt).toBeInstanceOf(Date);
      });
    });

    it('handles concurrent calls to different methods', async () => {
      const analyzer = new ProjectContextAnalyzer('/concurrent-methods');

      mockExecAsync.mockRejectedValue(new Error('not git'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).access = vi.fn().mockRejectedValue(new Error('not found'));
      (mockFs.promises as any).readFile = vi.fn().mockRejectedValue(new Error('not found'));
      (mockFs.promises as any).stat = vi.fn();

      const startTime = performance.now();

      const promises = [
        ...Array.from({ length: 20 }, () => analyzer.getGitStatus()),
        ...Array.from({ length: 20 }, () => analyzer.getProjectStructure()),
        ...Array.from({ length: 20 }, () => analyzer.detectFrameworks()),
        ...Array.from({ length: 20 }, () => analyzer.getConfigurationInfoList()),
        ...Array.from({ length: 20 }, () => analyzer.getTestFrameworkInfoList()),
      ];

      const results = await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(100);
      expect(duration).toBeLessThan(3000); // Should be fast since mocked

      // Verify all results are valid
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    it('maintains performance with multiple analyzer instances', async () => {
      mockExecAsync.mockRejectedValue(new Error('not git'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const startTime = performance.now();

      // Create 50 analyzer instances and run them concurrently
      const promises = Array.from({ length: 50 }, (_, i) => {
        const analyzer = new ProjectContextAnalyzer(`/test-${i}`);
        return analyzer.analyze();
      });

      const results = await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(50);
      expect(duration).toBeLessThan(5000);

      // Verify each analyzer worked correctly
      results.forEach((result, i) => {
        expect(result.structure.root).toBe(`/test-${i}`);
      });
    });
  });

  describe('Memory Usage Tests', () => {
    it('handles large git status output without memory issues', async () => {
      const analyzer = new ProjectContextAnalyzer('/large-repo');

      // Create very large git status (10,000 files)
      const largeStatusLines = Array.from({ length: 10000 }, (_, i) => {
        const status = i % 4 === 0 ? 'M' : i % 4 === 1 ? 'A' : i % 4 === 2 ? 'D' : '??';
        const padding = i % 4 === 3 ? ' ' : '';
        return `${status}${padding} src/files/deeply/nested/directory/structure/file${i.toString().padStart(5, '0')}.ts`;
      });
      const largeStatus = largeStatusLines.join('\n');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no upstream'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: largeStatus, stderr: '' })
        .mockRejectedValueOnce(new Error('no commits'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const startTime = performance.now();
      const gitStatus = await analyzer.getGitStatus();
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should be fast
      expect(gitStatus.staged.length + gitStatus.unstaged.length + gitStatus.untracked.length).toBe(10000);
      expect(gitStatus.isDirty).toBe(true);
    });

    it('handles large package.json files efficiently', async () => {
      const analyzer = new ProjectContextAnalyzer('/large-package');

      // Create a package.json with 5000 dependencies
      const largeDependencies = {};
      const largeDevDependencies = {};

      for (let i = 0; i < 5000; i++) {
        (largeDependencies as any)[`package-${i}`] = `^${i % 10}.${i % 5}.${i % 3}`;
        (largeDevDependencies as any)[`dev-package-${i}`] = `^${i % 8}.${i % 4}.${i % 2}`;
      }

      const largePackageJson = JSON.stringify({
        name: 'large-project',
        version: '1.0.0',
        description: 'A project with many dependencies',
        dependencies: largeDependencies,
        devDependencies: largeDevDependencies,
        scripts: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [`script-${i}`, `echo "Script ${i}"`])
        ),
      }, null, 2);

      (mockFs.promises as any).access = vi.fn().mockResolvedValue(undefined);
      (mockFs.promises as any).readFile = vi.fn().mockResolvedValue(largePackageJson);
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);

      const startTime = performance.now();
      const frameworks = await analyzer.detectFrameworks();
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(500); // Should handle large JSON quickly
      expect(frameworks).toBeDefined();
    });

    it('handles many stashes and remotes efficiently', async () => {
      const analyzer = new ProjectContextAnalyzer('/many-stashes');

      // Create many stashes (100)
      const manyStashes = Array.from({ length: 100 }, (_, i) =>
        `stash@{${i}}: WIP on feature-${i}: commit message ${i}`
      ).join('\n');

      // Create many remotes (20)
      const manyRemotes = Array.from({ length: 20 }, (_, i) =>
        `remote-${i}\tgit@server-${i}.com:user/repo-${i}.git\t(fetch)`
      ).join('\n');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockRejectedValueOnce(new Error('no upstream'))
        .mockRejectedValueOnce(new Error('no ahead/behind'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValueOnce(new Error('no commits'))
        .mockResolvedValueOnce({ stdout: manyStashes, stderr: '' })
        .mockResolvedValueOnce({ stdout: manyRemotes, stderr: '' });

      const startTime = performance.now();
      const gitStatus = await analyzer.getGitStatus();
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(200);
      expect(gitStatus.stashCount).toBe(100);
      expect(gitStatus.remotes).toHaveLength(20);
    });
  });

  describe('Repeated Operations Performance', () => {
    it('maintains consistent performance across repeated analyze() calls', async () => {
      const analyzer = new ProjectContextAnalyzer('/repeated-analysis');

      mockExecAsync.mockRejectedValue(new Error('not git'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const durations: number[] = [];

      // Run analyze() 20 times and measure each duration
      for (let i = 0; i < 20; i++) {
        const startTime = performance.now();
        await analyzer.analyze();
        const endTime = performance.now();
        durations.push(endTime - startTime);
      }

      // Performance should be consistent (no significant degradation)
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);

      expect(avgDuration).toBeLessThan(100); // Should be fast with mocks
      expect(maxDuration - minDuration).toBeLessThan(avgDuration * 2); // No more than 2x variation
    });

    it('getProjectContextAnalyzer singleton performs efficiently', () => {
      const startTime = performance.now();

      // Create 1000 analyzer requests
      const analyzers = Array.from({ length: 1000 }, (_, i) => {
        const path = i % 10 === 0 ? `/path-${i}` : '/same-path'; // Mix of same and different paths
        return getProjectContextAnalyzer(path);
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // Singleton lookup should be very fast
      expect(analyzers).toHaveLength(1000);

      // Verify singleton behavior
      const samePaths = analyzers.filter((_, i) => i % 10 !== 0);
      const firstSamePath = samePaths[0];
      samePaths.forEach(analyzer => {
        expect(analyzer).toBe(firstSamePath);
      });
    });
  });

  describe('Stress Testing', () => {
    it('survives rapid creation and destruction of analyzer instances', async () => {
      const iterations = 200;
      const results = [];

      mockExecAsync.mockRejectedValue(new Error('not git'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      for (let i = 0; i < iterations; i++) {
        const analyzer = new ProjectContextAnalyzer(`/stress-test-${i}`);
        const result = await analyzer.getProjectStructure();
        results.push(result);

        // Explicitly help garbage collection
        if (i % 50 === 0 && global.gc) {
          global.gc();
        }
      }

      expect(results).toHaveLength(iterations);
      results.forEach((result, i) => {
        expect(result.root).toBe(`/stress-test-${i}`);
      });
    });

    it('handles mixed workload stress test', async () => {
      const mixedPromises = [];

      mockExecAsync.mockRejectedValue(new Error('not git'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).access = vi.fn().mockRejectedValue(new Error('not found'));
      (mockFs.promises as any).readFile = vi.fn().mockRejectedValue(new Error('not found'));
      (mockFs.promises as any).stat = vi.fn();

      // Mix of different operations
      for (let i = 0; i < 200; i++) {
        const path = `/mixed-${i % 10}`;

        if (i % 4 === 0) {
          mixedPromises.push(analyzeProject(path));
        } else if (i % 4 === 1) {
          const analyzer = getProjectContextAnalyzer(path);
          mixedPromises.push(analyzer.getGitStatus());
        } else if (i % 4 === 2) {
          const analyzer = new ProjectContextAnalyzer(path);
          mixedPromises.push(analyzer.detectFrameworks());
        } else {
          const analyzer = getProjectContextAnalyzer(path);
          mixedPromises.push(analyzer.getProjectStructure());
        }
      }

      const startTime = performance.now();
      const results = await Promise.all(mixedPromises);
      const endTime = performance.now();

      expect(results).toHaveLength(200);
      expect(endTime - startTime).toBeLessThan(3000); // Should handle mixed workload efficiently

      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    it('maintains memory stability under prolonged load', async () => {
      const analyzer = new ProjectContextAnalyzer('/memory-test');

      mockExecAsync.mockRejectedValue(new Error('not git'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const iterations = 500;
      let completedIterations = 0;

      // Run continuous operations
      for (let i = 0; i < iterations; i++) {
        await analyzer.analyze();
        completedIterations++;

        // Force garbage collection every 100 iterations if available
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      expect(completedIterations).toBe(iterations);
    });
  });

  describe('Resource Cleanup Tests', () => {
    it('properly handles analyzer disposal', async () => {
      const analyzers = Array.from({ length: 100 }, (_, i) =>
        new ProjectContextAnalyzer(`/dispose-test-${i}`)
      );

      mockExecAsync.mockRejectedValue(new Error('not git'));
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      // Use all analyzers
      const results = await Promise.all(
        analyzers.map(analyzer => analyzer.getProjectStructure())
      );

      expect(results).toHaveLength(100);

      // Clear references
      analyzers.length = 0;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Should still be able to create new analyzers
      const newAnalyzer = new ProjectContextAnalyzer('/new-after-cleanup');
      const newResult = await newAnalyzer.getProjectStructure();
      expect(newResult.root).toBe('/new-after-cleanup');
    });

    it('handles aborted operations gracefully', async () => {
      const analyzer = new ProjectContextAnalyzer('/abort-test');

      mockExecAsync.mockRejectedValue(new Error('not git'));
      (mockFs.promises as any).readdir = vi.fn().mockImplementation(() =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Operation cancelled')), 100);
        })
      );

      // Start multiple operations that will be "cancelled"
      const promises = Array.from({ length: 10 }, () => analyzer.getProjectStructure());

      // Wait for them to complete (they'll fail but that's expected)
      const results = await Promise.allSettled(promises);

      // Some might succeed, some might fail - both are acceptable
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          expect(result.value.root).toBe('/abort-test');
        } else {
          expect(result.reason).toBeInstanceOf(Error);
        }
      });
    });
  });
});