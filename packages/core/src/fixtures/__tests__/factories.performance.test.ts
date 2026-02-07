/**
 * @fileoverview Performance Tests for Marketplace Factory Functions
 *
 * Tests performance characteristics, memory usage, and scalability
 * of factory functions under various load conditions.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  MCPServerConfigSchema,
  MCPServerSchema,
  MCPMarketplaceEntrySchema,
} from '../../types.js';
import {
  createMCPServer,
  createMCPServerConfig,
  createMCPMarketplaceEntry,
  MCPServerPresets,
  type MCPServerFactoryOptions,
  type MCPServerConfigFactoryOptions,
  type MCPMarketplaceEntryFactoryOptions,
} from '../marketplace.js';

describe('Marketplace Factory Performance Tests', () => {
  let performanceData: Array<{
    operation: string;
    duration: number;
    itemCount: number;
    memoryBefore?: number;
    memoryAfter?: number;
  }> = [];

  beforeEach(() => {
    performanceData = [];
  });

  afterEach(() => {
    // Log performance data for analysis (can be extended with actual logging)
    if (performanceData.length > 0) {
      console.log('Performance Test Results:', performanceData);
    }
  });

  const measurePerformance = <T>(
    operation: string,
    fn: () => T,
    itemCount: number = 1
  ): T & { duration: number } => {
    const memoryBefore = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    const result = fn();

    const endTime = performance.now();
    const memoryAfter = process.memoryUsage().heapUsed;
    const duration = endTime - startTime;

    performanceData.push({
      operation,
      duration,
      itemCount,
      memoryBefore,
      memoryAfter,
    });

    return { ...result as any, duration };
  };

  describe('Single Factory Performance', () => {
    it('should create MCPServer instances efficiently', () => {
      const iterations = 1000;

      const { duration } = measurePerformance(
        'createMCPServer batch',
        () => {
          const servers = [];
          for (let i = 0; i < iterations; i++) {
            servers.push(createMCPServer({
              name: `perf-server-${i}`,
              package: `@test/server-${i}`,
            }));
          }
          return servers;
        },
        iterations
      );

      // Performance expectations
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds

      // Verify per-item performance
      const avgTimePerItem = duration / iterations;
      expect(avgTimePerItem).toBeLessThan(2); // Less than 2ms per item
    });

    it('should create MCPServerConfig instances efficiently', () => {
      const iterations = 1000;

      const { duration } = measurePerformance(
        'createMCPServerConfig batch',
        () => {
          const configs = [];
          for (let i = 0; i < iterations; i++) {
            configs.push(createMCPServerConfig({
              name: `perf-config-${i}`,
              type: i % 2 === 0 ? 'stdio' : 'http',
            }));
          }
          return configs;
        },
        iterations
      );

      expect(duration).toBeLessThan(2000);

      const avgTimePerItem = duration / iterations;
      expect(avgTimePerItem).toBeLessThan(2);
    });

    it('should create MCPMarketplaceEntry instances efficiently', () => {
      const iterations = 1000;

      const { duration } = measurePerformance(
        'createMCPMarketplaceEntry batch',
        () => {
          const entries = [];
          for (let i = 0; i < iterations; i++) {
            entries.push(createMCPMarketplaceEntry({
              name: `Performance Entry ${i}`,
              description: `Performance test entry number ${i}`,
            }));
          }
          return entries;
        },
        iterations
      );

      expect(duration).toBeLessThan(3000); // Slightly higher due to nested config creation

      const avgTimePerItem = duration / iterations;
      expect(avgTimePerItem).toBeLessThan(3);
    });
  });

  describe('Bulk Creation Performance', () => {
    it('should handle large batch creation efficiently', () => {
      const batchSizes = [100, 500, 1000, 2000];

      for (const batchSize of batchSizes) {
        const { duration } = measurePerformance(
          `bulk creation - ${batchSize} items`,
          () => {
            const items = [];
            for (let i = 0; i < batchSize; i++) {
              const server = createMCPServer({ name: `bulk-server-${i}` });
              const config = createMCPServerConfig({ name: `bulk-config-${i}` });
              const entry = createMCPMarketplaceEntry({
                name: `Bulk Entry ${i}`,
                serverConfig: config,
              });
              items.push({ server, config, entry });
            }
            return items;
          },
          batchSize
        );

        // Performance should scale roughly linearly
        const expectedMaxTime = batchSize * 5; // 5ms per set of items
        expect(duration).toBeLessThan(expectedMaxTime);

        // Verify scalability - larger batches shouldn't be exponentially slower
        if (batchSize > 100) {
          const timePerItem = duration / batchSize;
          expect(timePerItem).toBeLessThan(10); // 10ms per item set should be sufficient
        }
      }
    });

    it('should maintain performance with complex configurations', () => {
      const iterations = 500;
      const complexEnv = Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [`VAR_${i}`, `value-${i}`])
      );
      const complexArgs = Array.from({ length: 20 }, (_, i) => `arg-${i}`);
      const complexEnvVars = Array.from({ length: 10 }, (_, i) => ({
        name: `COMPLEX_VAR_${i}`,
        description: `Complex variable ${i}`,
        required: i % 2 === 0,
      }));

      const { duration } = measurePerformance(
        'complex configuration creation',
        () => {
          const items = [];
          for (let i = 0; i < iterations; i++) {
            const server = createMCPServer({
              name: `complex-server-${i}`,
              package: '@test/complex-server',
              env: complexEnv,
              args: complexArgs,
              envVars: complexEnvVars,
            });

            const config = createMCPServerConfig({
              name: `complex-config-${i}`,
              env: complexEnv,
              args: complexArgs,
              envVars: complexEnvVars,
            });

            const entry = createMCPMarketplaceEntry({
              name: `Complex Entry ${i}`,
              description: 'Entry with complex configuration',
              capabilities: ['tools', 'resources', 'prompts'],
              serverConfig: config,
            });

            items.push({ server, config, entry });
          }
          return items;
        },
        iterations
      );

      // Complex configurations should still be reasonably fast
      expect(duration).toBeLessThan(10000); // 10 seconds for 500 complex items

      const avgTimePerComplexItem = duration / iterations;
      expect(avgTimePerComplexItem).toBeLessThan(20); // 20ms per complex item
    });
  });

  describe('Concurrent Performance', () => {
    it('should handle concurrent factory calls efficiently', async () => {
      const concurrentBatches = 10;
      const itemsPerBatch = 100;

      const startTime = performance.now();

      const promises = Array.from({ length: concurrentBatches }, async (_, batchIndex) => {
        return Array.from({ length: itemsPerBatch }, (_, itemIndex) => {
          const id = batchIndex * itemsPerBatch + itemIndex;
          return {
            server: createMCPServer({ name: `concurrent-server-${id}` }),
            config: createMCPServerConfig({ name: `concurrent-config-${id}` }),
            entry: createMCPMarketplaceEntry({ name: `Concurrent Entry ${id}` }),
          };
        });
      });

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      // Verify all items were created
      const totalItems = results.flat().length;
      expect(totalItems).toBe(concurrentBatches * itemsPerBatch);

      // Performance should be good even with concurrency
      expect(totalDuration).toBeLessThan(5000); // 5 seconds for 1000 items concurrently

      // Verify all items are valid
      for (const batch of results) {
        for (const { server, config, entry } of batch) {
          expect(MCPServerSchema.safeParse(server).success).toBe(true);
          expect(MCPServerConfigSchema.safeParse(config).success).toBe(true);
          expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);
        }
      }

      performanceData.push({
        operation: 'concurrent creation',
        duration: totalDuration,
        itemCount: totalItems,
      });
    });

    it('should maintain unique ID generation under concurrent load', async () => {
      const concurrentCalls = 1000;

      const promises = Array.from({ length: concurrentCalls }, async () => {
        return {
          server: createMCPServer(),
          config: createMCPServerConfig(),
          entry: createMCPMarketplaceEntry(),
        };
      });

      const startTime = performance.now();
      const results = await Promise.all(promises);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Extract all names for uniqueness check
      const serverNames = results.map(r => r.server.name);
      const configNames = results.map(r => r.config.name);
      const entryNames = results.map(r => r.entry.name);

      // Verify uniqueness under concurrent load
      expect(new Set(serverNames).size).toBe(concurrentCalls);
      expect(new Set(configNames).size).toBe(concurrentCalls);
      expect(new Set(entryNames).size).toBe(concurrentCalls);

      // Performance under concurrent load
      expect(duration).toBeLessThan(3000); // 3 seconds for 1000 concurrent calls

      performanceData.push({
        operation: 'concurrent unique ID generation',
        duration,
        itemCount: concurrentCalls,
      });
    });
  });

  describe('Memory Usage', () => {
    it('should have reasonable memory footprint for large batches', () => {
      const batchSize = 1000;
      const memoryBefore = process.memoryUsage();

      const items = [];
      for (let i = 0; i < batchSize; i++) {
        items.push({
          server: createMCPServer({
            name: `memory-server-${i}`,
            package: '@test/memory-server',
            description: `Memory test server ${i}`,
          }),
          config: createMCPServerConfig({
            name: `memory-config-${i}`,
            type: 'stdio',
          }),
          entry: createMCPMarketplaceEntry({
            name: `Memory Entry ${i}`,
            description: `Memory test entry ${i}`,
          }),
        });
      }

      const memoryAfter = process.memoryUsage();
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;

      // Memory usage should be reasonable
      const bytesPerItem = memoryIncrease / batchSize;
      expect(bytesPerItem).toBeLessThan(10000); // Less than 10KB per item set

      // Total memory increase should be manageable
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB

      performanceData.push({
        operation: 'memory usage test',
        duration: 0,
        itemCount: batchSize,
        memoryBefore: memoryBefore.heapUsed,
        memoryAfter: memoryAfter.heapUsed,
      });

      // Cleanup to prevent memory leaks in test
      items.length = 0;
    });

    it('should not leak memory with repeated operations', () => {
      const iterations = 10;
      const itemsPerIteration = 100;
      const memorySnapshots: number[] = [];

      // Force initial GC if available
      if (global.gc) {
        global.gc();
      }

      for (let iter = 0; iter < iterations; iter++) {
        const items = [];

        for (let i = 0; i < itemsPerIteration; i++) {
          items.push({
            server: createMCPServer(),
            config: createMCPServerConfig(),
            entry: createMCPMarketplaceEntry(),
          });
        }

        // Clear items to simulate typical usage
        items.length = 0;

        // Take memory snapshot
        if (global.gc) {
          global.gc();
        }
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }

      // Memory should not continuously grow
      const firstSnapshot = memorySnapshots[0];
      const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowth = lastSnapshot - firstSnapshot;

      // Allow some growth but not excessive
      const allowedGrowthMB = 10;
      expect(memoryGrowth).toBeLessThan(allowedGrowthMB * 1024 * 1024);

      performanceData.push({
        operation: 'memory leak test',
        duration: 0,
        itemCount: iterations * itemsPerIteration,
        memoryBefore: firstSnapshot,
        memoryAfter: lastSnapshot,
      });
    });
  });

  describe('Preset Performance', () => {
    it('should have good performance for preset operations', () => {
      const iterations = 1000;

      const { duration } = measurePerformance(
        'preset operations',
        () => {
          const items = [];
          for (let i = 0; i < iterations; i++) {
            // Use different presets to test variety
            const presetType = i % 3;
            switch (presetType) {
              case 0:
                items.push(MCPServerPresets.basic.filesystem());
                break;
              case 1:
                items.push(MCPServerPresets.basic.memory());
                break;
              case 2:
                items.push(MCPServerPresets.basic.git());
                break;
            }

            // Also test config and marketplace presets
            items.push(MCPServerPresets.configs.stdio());
            items.push(MCPServerPresets.marketplace.verified());
          }
          return items;
        },
        iterations * 3 // 3 items per iteration
      );

      // Presets should be very fast since they use static data
      expect(duration).toBeLessThan(500); // 500ms for 3000 preset calls

      const avgTimePerPreset = duration / (iterations * 3);
      expect(avgTimePerPreset).toBeLessThan(1); // Less than 1ms per preset call
    });

    it('should maintain performance when combining presets with overrides', () => {
      const iterations = 500;

      const { duration } = measurePerformance(
        'preset with overrides',
        () => {
          const items = [];
          for (let i = 0; i < iterations; i++) {
            const baseServer = MCPServerPresets.basic.filesystem();
            const customServer = createMCPServer({
              ...baseServer,
              name: `custom-${i}`,
              env: { ...baseServer.env, CUSTOM: `value-${i}` },
            });

            const baseConfig = MCPServerPresets.configs.autoStart();
            const customConfig = createMCPServerConfig({
              ...baseConfig,
              name: `custom-config-${i}`,
            });

            items.push(customServer, customConfig);
          }
          return items;
        },
        iterations * 2
      );

      // Preset + override pattern should still be fast
      expect(duration).toBeLessThan(2000); // 2 seconds for 1000 items

      const avgTimePerItem = duration / (iterations * 2);
      expect(avgTimePerItem).toBeLessThan(4); // Less than 4ms per item
    });
  });

  describe('Validation Performance', () => {
    it('should validate created objects efficiently', () => {
      const iterations = 1000;

      // Create objects first
      const items = [];
      for (let i = 0; i < iterations; i++) {
        items.push({
          server: createMCPServer({ name: `validation-server-${i}` }),
          config: createMCPServerConfig({ name: `validation-config-${i}` }),
          entry: createMCPMarketplaceEntry({ name: `Validation Entry ${i}` }),
        });
      }

      // Measure validation performance
      const { duration } = measurePerformance(
        'schema validation',
        () => {
          const results = [];
          for (const { server, config, entry } of items) {
            results.push(
              MCPServerSchema.safeParse(server),
              MCPServerConfigSchema.safeParse(config),
              MCPMarketplaceEntrySchema.safeParse(entry)
            );
          }
          return results;
        },
        iterations * 3
      );

      // Validation should be fast
      expect(duration).toBeLessThan(1000); // 1 second for 3000 validations

      const avgValidationTime = duration / (iterations * 3);
      expect(avgValidationTime).toBeLessThan(1); // Less than 1ms per validation
    });
  });
});