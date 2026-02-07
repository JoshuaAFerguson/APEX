/**
 * @fileoverview Performance and Stress Tests for Marketplace Fixtures
 *
 * Tests performance characteristics, memory usage, and scalability
 * of marketplace types and fixture operations.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  MCPMarketplaceEntrySchema,
  MCPMarketplaceSchema,
  MCPMarketplaceSourceSchema,
  MCPServerConfigSchema,
} from '../../types.js';
import {
  baseFilesystemMarketplaceEntry,
  baseMarketplace,
  createMarketplaceEntry,
  createServerConfig,
  createMarketplace,
  getVerifiedEntries,
  getEntriesByCapability,
  baseMarketplaceEntries,
} from '../marketplace.js';

// Performance test configuration
const PERFORMANCE_THRESHOLDS = {
  FAST_OPERATION_MS: 1,
  MEDIUM_OPERATION_MS: 10,
  SLOW_OPERATION_MS: 100,
  LARGE_DATASET_SIZE: 1000,
  STRESS_DATASET_SIZE: 10000,
};

// Helper function to measure execution time
function measureTime<T>(fn: () => T): { result: T; timeMs: number } {
  const start = performance.now();
  const result = fn();
  const timeMs = performance.now() - start;
  return { result, timeMs };
}

// Helper function to estimate memory usage
function estimateMemoryUsage<T>(fn: () => T): { result: T; estimatedBytes: number } {
  const initialHeap = (performance as any).memory?.usedJSHeapSize || 0;
  const result = fn();
  const finalHeap = (performance as any).memory?.usedJSHeapSize || 0;
  const estimatedBytes = Math.max(0, finalHeap - initialHeap);
  return { result, estimatedBytes };
}

describe('Marketplace Performance Tests', () => {
  describe('Fixture creation performance', () => {
    it('should create marketplace entries quickly', () => {
      const { result, timeMs } = measureTime(() => {
        return Array.from({ length: 1000 }, (_, i) =>
          createMarketplaceEntry(baseFilesystemMarketplaceEntry, {
            name: `server-${i}`,
            verified: i % 2 === 0,
          })
        );
      });

      expect(result).toHaveLength(1000);
      expect(timeMs).toBeLessThan(PERFORMANCE_THRESHOLDS.MEDIUM_OPERATION_MS);
    });

    it('should create server configs efficiently', () => {
      const { result, timeMs } = measureTime(() => {
        return Array.from({ length: 1000 }, (_, i) =>
          createServerConfig(baseFilesystemMarketplaceEntry.serverConfig, {
            name: `server-config-${i}`,
            autoStart: i % 2 === 0,
          })
        );
      });

      expect(result).toHaveLength(1000);
      expect(timeMs).toBeLessThan(PERFORMANCE_THRESHOLDS.MEDIUM_OPERATION_MS);
    });

    it('should create large marketplaces efficiently', () => {
      const { result, timeMs } = measureTime(() => {
        const largeServerList = Array.from({ length: 100 }, (_, i) => ({
          ...baseFilesystemMarketplaceEntry,
          name: `performance-server-${i}`,
        }));

        return createMarketplace(baseMarketplace, {
          name: 'Performance Test Marketplace',
          servers: largeServerList,
        });
      });

      expect(result.servers).toHaveLength(100);
      expect(timeMs).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW_OPERATION_MS);
    });
  });

  describe('Schema validation performance', () => {
    it('should validate marketplace entries quickly at scale', () => {
      const entries = Array.from({ length: 1000 }, (_, i) => ({
        ...baseFilesystemMarketplaceEntry,
        name: `validation-test-${i}`,
        description: `Performance validation test entry ${i}`,
      }));

      const { result, timeMs } = measureTime(() => {
        return entries.map(entry => MCPMarketplaceEntrySchema.parse(entry));
      });

      expect(result).toHaveLength(1000);
      expect(result.every(entry => entry.name.startsWith('validation-test-'))).toBe(true);
      expect(timeMs).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW_OPERATION_MS);
    });

    it('should validate server configs quickly at scale', () => {
      const configs = Array.from({ length: 1000 }, (_, i) => ({
        ...baseFilesystemMarketplaceEntry.serverConfig,
        name: `validation-config-${i}`,
        args: [`arg-${i}`, `option-${i}`],
      }));

      const { result, timeMs } = measureTime(() => {
        return configs.map(config => MCPServerConfigSchema.parse(config));
      });

      expect(result).toHaveLength(1000);
      expect(timeMs).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW_OPERATION_MS);
    });

    it('should validate large marketplace quickly', () => {
      const largeMarketplace = {
        ...baseMarketplace,
        servers: Array.from({ length: 500 }, (_, i) => ({
          ...baseFilesystemMarketplaceEntry,
          name: `large-marketplace-server-${i}`,
        })),
      };

      const { result, timeMs } = measureTime(() => {
        return MCPMarketplaceSchema.parse(largeMarketplace);
      });

      expect(result.servers).toHaveLength(500);
      expect(timeMs).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW_OPERATION_MS);
    });
  });

  describe('Filtering operation performance', () => {
    let originalMarketplaceEntries: any;

    beforeEach(() => {
      // Mock marketplace entries with a large dataset
      originalMarketplaceEntries = Object.values;
      Object.values = () => Array.from({ length: 1000 }, (_, i) => ({
        ...baseFilesystemMarketplaceEntry,
        name: `performance-server-${i}`,
        verified: i % 3 === 0, // Every third entry is verified
        capabilities: i % 2 === 0 ? ['tools', 'resources'] : ['tools'],
      }));
    });

    afterEach(() => {
      Object.values = originalMarketplaceEntries;
    });

    it('should filter verified entries quickly', () => {
      const { result, timeMs } = measureTime(() => getVerifiedEntries());

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(300); // Approximately 1/3 should be verified
      expect(timeMs).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_OPERATION_MS);
    });

    it('should filter by capability quickly', () => {
      const { result, timeMs } = measureTime(() => getEntriesByCapability('tools'));

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(1000); // All entries have 'tools' capability
      expect(timeMs).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_OPERATION_MS);
    });

    it('should handle multiple concurrent filtering operations', async () => {
      const operations = Array.from({ length: 100 }, () => ({
        verified: () => getVerifiedEntries(),
        tools: () => getEntriesByCapability('tools'),
        resources: () => getEntriesByCapability('resources'),
      }));

      const { result, timeMs } = measureTime(() => {
        return Promise.all(operations.flatMap(op => [
          Promise.resolve(op.verified()),
          Promise.resolve(op.tools()),
          Promise.resolve(op.resources()),
        ]));
      });

      const results = await result;
      expect(results).toHaveLength(300); // 100 operations * 3 each
      expect(timeMs).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW_OPERATION_MS);
    });
  });

  describe('Memory usage tests', () => {
    // Note: Memory tests may not be reliable in all environments
    it('should not leak memory when creating many entries', () => {
      if (typeof (performance as any).memory === 'undefined') {
        console.warn('Memory monitoring not available, skipping memory test');
        return;
      }

      const { result, estimatedBytes } = estimateMemoryUsage(() => {
        const entries = Array.from({ length: 1000 }, (_, i) =>
          createMarketplaceEntry(baseFilesystemMarketplaceEntry, {
            name: `memory-test-${i}`,
            description: `Memory test description ${i}`.repeat(10), // Make it substantial
          })
        );
        return entries;
      });

      expect(result).toHaveLength(1000);

      // Estimate reasonable memory usage (this is approximate)
      const estimatedPerEntry = estimatedBytes / 1000;
      expect(estimatedPerEntry).toBeLessThan(10000); // Less than 10KB per entry seems reasonable
    });

    it('should handle garbage collection during large operations', () => {
      // Force garbage collection if available
      if (typeof global !== 'undefined' && (global as any).gc) {
        (global as any).gc();
      }

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Create and discard many objects
      for (let batch = 0; batch < 10; batch++) {
        const entries = Array.from({ length: 100 }, (_, i) =>
          createMarketplaceEntry(baseFilesystemMarketplaceEntry, {
            name: `gc-test-batch-${batch}-entry-${i}`,
            description: `Large description ${'x'.repeat(1000)}`,
          })
        );

        // Validate to ensure objects are fully created
        entries.forEach(entry => MCPMarketplaceEntrySchema.parse(entry));
      }

      // Force garbage collection again if available
      if (typeof global !== 'undefined' && (global as any).gc) {
        (global as any).gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be reasonable (less than 50MB for this test)
      if (initialMemory > 0 && finalMemory > 0) {
        expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
      }
    });
  });

  describe('Stress tests', () => {
    it('should handle extremely large marketplace creation', () => {
      const startTime = performance.now();

      const hugeMarketplace = createMarketplace(baseMarketplace, {
        name: 'Stress Test Marketplace',
        servers: Array.from({ length: PERFORMANCE_THRESHOLDS.STRESS_DATASET_SIZE }, (_, i) => ({
          ...baseFilesystemMarketplaceEntry,
          name: `stress-server-${i}`,
          description: `Stress test server ${i} with longer description to test memory usage`,
          capabilities: [
            'tools',
            'resources',
            `custom-capability-${i % 10}`,
            `specialized-feature-${i % 20}`,
          ],
        })),
      });

      const endTime = performance.now();
      const timeMs = endTime - startTime;

      expect(hugeMarketplace.servers).toHaveLength(PERFORMANCE_THRESHOLDS.STRESS_DATASET_SIZE);
      expect(timeMs).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle rapid successive operations without degradation', () => {
      const operationTimes: number[] = [];

      for (let i = 0; i < 100; i++) {
        const { timeMs } = measureTime(() => {
          const entry = createMarketplaceEntry(baseFilesystemMarketplaceEntry, {
            name: `rapid-test-${i}`,
            verified: i % 2 === 0,
          });
          MCPMarketplaceEntrySchema.parse(entry);
          return entry;
        });

        operationTimes.push(timeMs);
      }

      // Check that performance doesn't degrade significantly over iterations
      const firstTenAvg = operationTimes.slice(0, 10).reduce((a, b) => a + b) / 10;
      const lastTenAvg = operationTimes.slice(-10).reduce((a, b) => a + b) / 10;

      // Last operations shouldn't be more than 3x slower than first operations
      expect(lastTenAvg).toBeLessThan(firstTenAvg * 3);
    });

    it('should handle complex nested data structures efficiently', () => {
      const complexEnvironment: Record<string, string> = {};

      // Create complex environment with many variables
      for (let i = 0; i < 1000; i++) {
        complexEnvironment[`VAR_${i}`] = JSON.stringify({
          index: i,
          data: Array.from({ length: 10 }, (_, j) => `value-${i}-${j}`),
          metadata: {
            created: new Date().toISOString(),
            type: `complex-${i % 5}`,
            tags: [`tag-${i % 3}`, `category-${i % 7}`, `group-${i % 11}`],
          },
        });
      }

      const { result, timeMs } = measureTime(() => {
        const complexConfig = createServerConfig(baseFilesystemMarketplaceEntry.serverConfig, {
          env: complexEnvironment,
        });

        return MCPServerConfigSchema.parse(complexConfig);
      });

      expect(Object.keys(result.env!)).toHaveLength(1000);
      expect(timeMs).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW_OPERATION_MS);
    });

    it('should handle concurrent schema validation', async () => {
      const validationPromises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve().then(() => {
          const entry = createMarketplaceEntry(baseFilesystemMarketplaceEntry, {
            name: `concurrent-validation-${i}`,
            description: `Concurrent validation test ${i}`,
          });

          return MCPMarketplaceEntrySchema.parse(entry);
        })
      );

      const startTime = performance.now();
      const results = await Promise.all(validationPromises);
      const endTime = performance.now();

      expect(results).toHaveLength(100);
      expect(results.every(entry => entry.name.startsWith('concurrent-validation-'))).toBe(true);
      expect(endTime - startTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW_OPERATION_MS);
    });
  });

  describe('Scalability characteristics', () => {
    it('should show linear performance scaling for marketplace creation', () => {
      const sizes = [10, 50, 100, 500];
      const performanceData = sizes.map(size => {
        const { timeMs } = measureTime(() => {
          return createMarketplace(baseMarketplace, {
            servers: Array.from({ length: size }, (_, i) => ({
              ...baseFilesystemMarketplaceEntry,
              name: `scaling-test-${i}`,
            })),
          });
        });

        return { size, timeMs };
      });

      // Check that performance scales roughly linearly
      // (Each doubling in size should not increase time by more than 3x)
      for (let i = 1; i < performanceData.length; i++) {
        const current = performanceData[i];
        const previous = performanceData[i - 1];
        const sizeRatio = current.size / previous.size;
        const timeRatio = current.timeMs / Math.max(previous.timeMs, 0.1); // Avoid division by very small numbers

        expect(timeRatio).toBeLessThan(sizeRatio * 3);
      }
    });

    it('should maintain performance with deep object nesting', () => {
      const createNestedEnv = (depth: number): Record<string, string> => {
        const env: Record<string, string> = {};

        for (let i = 0; i < depth; i++) {
          const nestedData = Array.from({ length: depth }, (_, j) => ({
            [`level_${i}_item_${j}`]: `value_${i}_${j}`,
          }));

          env[`NESTED_VAR_${i}`] = JSON.stringify(nestedData);
        }

        return env;
      };

      const depths = [1, 5, 10, 20];
      const performanceData = depths.map(depth => {
        const { timeMs } = measureTime(() => {
          const complexEnv = createNestedEnv(depth);
          const config = createServerConfig(baseFilesystemMarketplaceEntry.serverConfig, {
            env: complexEnv,
          });
          return MCPServerConfigSchema.parse(config);
        });

        return { depth, timeMs };
      });

      // Performance should not degrade exponentially with nesting depth
      const maxTime = Math.max(...performanceData.map(p => p.timeMs));
      expect(maxTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW_OPERATION_MS);
    });
  });
});