/**
 * Performance and stress tests for DependencyDetector
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import {
  DependencyDetector,
  dependencyDetector
} from '../dependency-detector';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe('DependencyDetector Performance', () => {
  let detector: DependencyDetector;

  beforeEach(() => {
    detector = new DependencyDetector();
    vi.clearAllMocks();
  });

  afterEach(() => {
    detector.clearCache();
  });

  // ============================================================================
  // Cache Performance Tests
  // ============================================================================

  describe('Cache Performance', () => {
    it('should provide significant performance benefit with caching', async () => {
      const projectPath = '/test/performance-project';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'performance-test',
        dependencies: Object.fromEntries(
          Array.from({ length: 500 }, (_, i) => [`dep-${i}`, `^${i}.0.0`])
        )
      }));

      // Measure time without cache (first call)
      const startUncached = performance.now();
      await detector.detectPackageManagers(projectPath);
      const uncachedTime = performance.now() - startUncached;

      // Measure time with cache
      const startCached = performance.now();
      await detector.detectPackageManagers(projectPath);
      const cachedTime = performance.now() - startCached;

      // Cached call should be significantly faster
      expect(cachedTime).toBeLessThan(uncachedTime / 10);
    });

    it('should handle cache invalidation efficiently', async () => {
      const projectPaths = Array.from(
        { length: 1000 },
        (_, i) => `/test/project-${i}`
      );

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{}');

      // Fill cache with many entries
      await Promise.all(
        projectPaths.map(path => detector.detectPackageManagers(path))
      );

      // Clear cache and measure performance impact
      const startClear = performance.now();
      detector.clearCache();
      const clearTime = performance.now() - startClear;

      // Cache clear should be fast even with many entries
      expect(clearTime).toBeLessThan(10); // Should take less than 10ms
    });

    it('should handle concurrent access to cache efficiently', async () => {
      const projectPath = '/test/concurrent-project';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{}');

      // Measure time for concurrent access
      const startTime = performance.now();

      const promises = Array.from({ length: 100 }, () =>
        detector.detectPackageManagers(projectPath)
      );

      await Promise.all(promises);
      const totalTime = performance.now() - startTime;

      // Should complete in reasonable time despite high concurrency
      expect(totalTime).toBeLessThan(1000); // Less than 1 second
    });
  });

  // ============================================================================
  // Large File Handling
  // ============================================================================

  describe('Large File Handling', () => {
    it('should handle extremely large package.json files', async () => {
      const projectPath = '/test/large-package-project';

      mockExistsSync.mockReturnValue(true);

      // Create very large package.json
      const largePackageJson = {
        name: 'large-project',
        version: '1.0.0',
        dependencies: Object.fromEntries(
          Array.from({ length: 5000 }, (_, i) => [`package-${i}`, `^${i % 10}.0.0`])
        ),
        devDependencies: Object.fromEntries(
          Array.from({ length: 2000 }, (_, i) => [`dev-package-${i}`, `^${i % 10}.0.0`])
        )
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(largePackageJson));

      const startTime = performance.now();
      const result = await detector.detectPackageManagers(projectPath);
      const processingTime = performance.now() - startTime;

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers[0].metadata?.dependencyCount).toBe(7000);
      expect(processingTime).toBeLessThan(100); // Should process in less than 100ms
    });

    it('should handle large requirements.txt files', async () => {
      const projectPath = '/test/large-requirements-project';

      mockExistsSync.mockReturnValue(true);

      // Create large requirements.txt
      const largeRequirements = Array.from(
        { length: 10000 },
        (_, i) => `package-${i}==${i % 100}.0.0`
      ).join('\n');

      mockReadFileSync.mockReturnValue(largeRequirements);

      const startTime = performance.now();
      const result = await detector.detectPackageManagers(projectPath);
      const processingTime = performance.now() - startTime;

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers[0].metadata?.requirementLines).toBe(10000);
      expect(processingTime).toBeLessThan(50); // Should process quickly
    });

    it('should handle very complex Cargo.toml files', async () => {
      const projectPath = '/test/complex-cargo-project';

      mockExistsSync.mockReturnValue(true);

      // Create complex Cargo.toml with many features and dependencies
      const complexCargoToml = `
[package]
name = "complex-project"
version = "0.1.0"
edition = "2021"

[features]
default = ["feature1", "feature2"]
${Array.from({ length: 100 }, (_, i) => `feature${i} = []`).join('\n')}

[dependencies]
${Array.from({ length: 500 }, (_, i) =>
  `dependency-${i} = { version = "${i % 10}.0.0", features = ["feature${i % 5}"] }`
).join('\n')}

[dev-dependencies]
${Array.from({ length: 200 }, (_, i) =>
  `dev-dependency-${i} = "${i % 10}.0.0"`
).join('\n')}

[build-dependencies]
${Array.from({ length: 50 }, (_, i) =>
  `build-dependency-${i} = "${i % 10}.0.0"`
).join('\n')}
      `;

      mockReadFileSync.mockReturnValue(complexCargoToml);

      const startTime = performance.now();
      const result = await detector.detectPackageManagers(projectPath);
      const processingTime = performance.now() - startTime;

      expect(result.hasPackageManagers).toBe(true);
      expect(result.detectedManagers[0].type).toBe('cargo');
      expect(processingTime).toBeLessThan(50);
    });
  });

  // ============================================================================
  // Memory Usage Tests
  // ============================================================================

  describe('Memory Usage', () => {
    it('should not leak memory with many cache entries', async () => {
      const projectPaths = Array.from(
        { length: 1000 },
        (_, i) => `/test/memory-project-${i}`
      );

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{}');

      // Check initial memory (rough approximation)
      const initialMemory = process.memoryUsage().heapUsed;

      // Create many cache entries
      await Promise.all(
        projectPaths.map(path => detector.detectPackageManagers(path))
      );

      const afterDetectionMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterDetectionMemory - initialMemory;

      // Clear cache
      detector.clearCache();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const afterClearMemory = process.memoryUsage().heapUsed;

      // Memory increase should be reasonable (less than 10MB for 1000 entries)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);

      // Memory should be mostly reclaimed after cache clear
      const memoryReclaimed = afterDetectionMemory - afterClearMemory;
      expect(memoryReclaimed).toBeGreaterThan(memoryIncrease * 0.5);
    });

    it('should handle repeated cache operations without accumulating memory', async () => {
      const projectPath = '/test/memory-repeated-project';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{}');

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many cache/clear cycles
      for (let i = 0; i < 100; i++) {
        await detector.detectPackageManagers(projectPath);
        detector.clearCache();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDelta = finalMemory - initialMemory;

      // Memory should not continuously grow
      expect(memoryDelta).toBeLessThan(1024 * 1024); // Less than 1MB increase
    });
  });

  // ============================================================================
  // Stress Tests
  // ============================================================================

  describe('Stress Tests', () => {
    it('should handle high-frequency detection requests', async () => {
      const projectPath = '/test/stress-project';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{}');

      const startTime = performance.now();

      // Make many rapid-fire requests
      const promises = Array.from({ length: 1000 }, () =>
        detector.detectPackageManagers(projectPath)
      );

      const results = await Promise.all(promises);
      const totalTime = performance.now() - startTime;

      // All requests should succeed
      expect(results.every(r => r.hasPackageManagers)).toBe(true);

      // Should complete efficiently due to caching
      expect(totalTime).toBeLessThan(100); // Less than 100ms for 1000 requests
    });

    it('should handle mixed workload efficiently', async () => {
      const projectPaths = Array.from(
        { length: 100 },
        (_, i) => `/test/mixed-project-${i}`
      );

      // Mix of file types
      mockExistsSync.mockImplementation((path: string) => {
        const filePath = path as string;
        const projectIndex = parseInt(filePath.match(/project-(\d+)/)?.[1] || '0');

        switch (projectIndex % 4) {
          case 0: return filePath.endsWith('package.json');
          case 1: return filePath.endsWith('requirements.txt');
          case 2: return filePath.endsWith('Cargo.toml');
          case 3: return filePath.endsWith('pyproject.toml');
          default: return false;
        }
      });

      mockReadFileSync.mockImplementation((path: string) => {
        const filePath = path as string;
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({ name: 'test', version: '1.0.0' });
        }
        if (filePath.endsWith('requirements.txt')) {
          return 'requests==2.28.0';
        }
        if (filePath.endsWith('Cargo.toml')) {
          return '[package]\nname = "test"\nversion = "0.1.0"';
        }
        if (filePath.endsWith('pyproject.toml')) {
          return '[tool.poetry]\nname = "test"\nversion = "1.0.0"';
        }
        return '';
      });

      const startTime = performance.now();

      // Mix of operations
      const operations = projectPaths.flatMap(path => [
        detector.detectPackageManagers(path),
        detector.getInstallCommand(path),
        detector.hasPackageManager(path, 'npm'),
        detector.getAllInstallCommands(path)
      ]);

      await Promise.all(operations);
      const totalTime = performance.now() - startTime;

      // Should handle mixed workload efficiently
      expect(totalTime).toBeLessThan(200); // Less than 200ms for 400 operations
    });

    it('should handle error conditions gracefully under load', async () => {
      const projectPaths = Array.from(
        { length: 100 },
        (_, i) => `/test/error-project-${i}`
      );

      let errorCount = 0;
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation((path: string) => {
        // Simulate random errors
        if (Math.random() < 0.3) {
          errorCount++;
          throw new Error('Simulated read error');
        }
        return '{}';
      });

      const results = await Promise.all(
        projectPaths.map(path =>
          detector.detectPackageManagers(path).catch(() => ({
            projectPath: path,
            detectedManagers: [],
            hasPackageManagers: false,
            installCommands: []
          }))
        )
      );

      // Should handle errors gracefully
      expect(results).toHaveLength(100);
      expect(errorCount).toBeGreaterThan(0); // Some errors should have occurred

      // Successful detections should still work
      const successfulResults = results.filter(r => r.hasPackageManagers);
      expect(successfulResults.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Global Instance Performance
  // ============================================================================

  describe('Global Instance Performance', () => {
    it('should maintain performance across global singleton usage', async () => {
      const projectPath = '/test/global-performance-project';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{}');

      // Test that global instance performs well
      const startTime = performance.now();

      const promises = Array.from({ length: 100 }, () =>
        dependencyDetector.detectPackageManagers(projectPath)
      );

      await Promise.all(promises);
      const totalTime = performance.now() - startTime;

      expect(totalTime).toBeLessThan(50); // Should be very fast due to caching
    });
  });
});