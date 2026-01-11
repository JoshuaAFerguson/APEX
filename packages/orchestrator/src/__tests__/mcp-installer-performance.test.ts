import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { MCPInstaller } from '../mcp-installer';
import { TaskStore } from '../store';
import { MCPMarketplaceEntry, MCPServerConfig } from '@apexcli/core';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

const { exec } = await import('child_process');
const execMock = vi.mocked(exec);

describe('MCPInstaller Performance and Stress Tests', () => {
  let tempDir: string;
  let store: TaskStore;
  let installer: MCPInstaller;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = path.join(__dirname, '..', '..', 'test-temp', `mcp-perf-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Initialize store and installer
    store = new TaskStore(tempDir);
    await store.initialize();
    installer = new MCPInstaller(tempDir, store);

    // Mock exec to succeed quickly
    execMock.mockImplementation((command, options, callback) => {
      setTimeout(() => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
      }, 1); // 1ms delay to simulate real execution
      return {} as any;
    });

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Close database connection
    store.close();

    // Clean up temporary directory
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Installation Performance', () => {
    it('should handle rapid sequential installations efficiently', async () => {
      const startTime = Date.now();
      const serverCount = 50;

      // Sequential installations
      for (let i = 0; i < serverCount; i++) {
        await installer.installFromNpm(`test-package-${i}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      const avgTimePerInstall = duration / serverCount;

      // Should average less than 100ms per installation
      expect(avgTimePerInstall).toBeLessThan(100);

      // Verify all installations were tracked
      const installed = await installer.listInstalled();
      expect(installed).toHaveLength(serverCount);

      console.log(`Sequential installations: ${serverCount} servers in ${duration}ms (avg: ${avgTimePerInstall.toFixed(2)}ms per install)`);
    });

    it('should handle concurrent installations efficiently', async () => {
      const startTime = Date.now();
      const serverCount = 50;

      // Concurrent installations
      const promises = Array.from({ length: serverCount }, (_, i) =>
        installer.installFromNpm(`concurrent-package-${i}`)
      );

      const results = await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;
      const avgTimePerInstall = duration / serverCount;

      // Concurrent should be much faster than sequential
      expect(avgTimePerInstall).toBeLessThan(50);
      expect(results).toHaveLength(serverCount);

      // Verify all installations were tracked
      const installed = await installer.listInstalled();
      expect(installed).toHaveLength(serverCount);

      console.log(`Concurrent installations: ${serverCount} servers in ${duration}ms (avg: ${avgTimePerInstall.toFixed(2)}ms per install)`);
    });

    it('should handle mixed marketplace and npm installations concurrently', async () => {
      // Setup marketplace entries
      const marketplaceEntries: MCPMarketplaceEntry[] = Array.from({ length: 25 }, (_, i) => ({
        name: `marketplace-${i}`,
        description: `Marketplace server ${i}`,
        version: '1.0.0',
        installCommand: `npm install -g marketplace-${i}`,
        serverConfig: {
          name: `marketplace-${i}`,
          type: 'stdio',
          command: `marketplace-${i}`,
          autoStart: false,
        },
      }));

      // Populate marketplace cache
      for (const entry of marketplaceEntries) {
        await store.upsertMcpMarketplaceEntry(entry);
      }

      const startTime = Date.now();

      // Mix of marketplace and npm installations
      const marketplacePromises = marketplaceEntries.map(entry =>
        installer.install(entry.name)
      );

      const npmPromises = Array.from({ length: 25 }, (_, i) =>
        installer.installFromNpm(`npm-direct-${i}`)
      );

      const allResults = await Promise.all([...marketplacePromises, ...npmPromises]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(allResults).toHaveLength(50);

      // Verify installation sources are correct
      const installed = await installer.listInstalled();
      const marketplaceInstalled = installed.filter(s => s.installedFrom === 'marketplace');
      const npmInstalled = installed.filter(s => s.installedFrom === 'npx');

      expect(marketplaceInstalled).toHaveLength(25);
      expect(npmInstalled).toHaveLength(25);

      console.log(`Mixed installations: 50 servers (25 marketplace + 25 npm) in ${duration}ms`);
    });
  });

  describe('Database Performance Under Load', () => {
    it('should handle rapid database operations efficiently', async () => {
      const startTime = Date.now();
      const operationCount = 1000;

      // Rapid sequential operations
      for (let i = 0; i < operationCount; i++) {
        const config: MCPServerConfig = {
          name: `rapid-test-${i}`,
          type: 'stdio',
          command: `command-${i}`,
          args: [`--option-${i}`],
          env: { [`VAR_${i}`]: `value_${i}` },
          autoStart: i % 2 === 0,
        };

        await store.upsertMcpServerConfig(config.name, config);

        // Occasionally read data to test mixed operations
        if (i % 100 === 0) {
          await installer.listInstalled();
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      const avgTimePerOperation = duration / operationCount;

      // Should average less than 10ms per operation
      expect(avgTimePerOperation).toBeLessThan(10);

      console.log(`Rapid DB operations: ${operationCount} operations in ${duration}ms (avg: ${avgTimePerOperation.toFixed(2)}ms per op)`);
    });

    it('should handle concurrent database operations', async () => {
      const startTime = Date.now();
      const operationCount = 500;

      // Concurrent database operations
      const promises = Array.from({ length: operationCount }, async (_, i) => {
        const config: MCPServerConfig = {
          name: `concurrent-db-test-${i}`,
          type: 'stdio',
          command: `command-${i}`,
          args: [`--arg-${i}`],
          autoStart: false,
        };

        await store.upsertMcpServerConfig(config.name, config);

        // Mix in some read operations
        if (i % 10 === 0) {
          return installer.isInstalled(`concurrent-db-test-${i}`);
        }
        return true;
      });

      const results = await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(operationCount);

      console.log(`Concurrent DB operations: ${operationCount} operations in ${duration}ms`);
    });

    it('should maintain performance with large datasets', async () => {
      // Pre-populate with large dataset
      const largeDatasetSize = 1000;

      console.log(`Populating database with ${largeDatasetSize} entries...`);

      for (let i = 0; i < largeDatasetSize; i++) {
        const config: MCPServerConfig = {
          name: `large-dataset-${i}`,
          type: 'stdio',
          command: `command-${i}`,
          args: Array.from({ length: 10 }, (_, j) => `--option-${j}=value-${j}`),
          env: Object.fromEntries(
            Array.from({ length: 10 }, (_, j) => [`VAR_${j}`, `value_${j}`])
          ),
          autoStart: i % 2 === 0,
        };
        await store.upsertMcpServerConfig(config.name, config);
      }

      // Measure query performance on large dataset
      const queryStart = Date.now();

      // Perform various operations
      const listInstalled = await installer.listInstalled();
      const isInstalled = await installer.isInstalled('large-dataset-500');
      const getServer = await installer.getInstalledServer('large-dataset-750');

      const queryEnd = Date.now();
      const queryDuration = queryEnd - queryStart;

      expect(listInstalled).toHaveLength(largeDatasetSize);
      expect(isInstalled).toBe(true);
      expect(getServer).not.toBeNull();

      // Queries should still be fast with large dataset
      expect(queryDuration).toBeLessThan(500); // 500ms max

      console.log(`Large dataset queries: ${queryDuration}ms for ${largeDatasetSize} entries`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should handle memory-intensive operations efficiently', async () => {
      const initialMemory = process.memoryUsage();

      // Create large configurations
      const largeConfigs = Array.from({ length: 100 }, (_, i) => ({
        name: `memory-test-${i}`,
        type: 'stdio' as const,
        command: `command-${i}`,
        args: Array.from({ length: 100 }, (_, j) => `--very-long-argument-name-${j}=very-long-value-${j}-with-extra-data`),
        env: Object.fromEntries(
          Array.from({ length: 50 }, (_, j) => [
            `VERY_LONG_ENVIRONMENT_VARIABLE_NAME_${j}`,
            `very-long-environment-variable-value-${j}-with-extra-data-to-increase-memory-usage`
          ])
        ),
        autoStart: false,
      }));

      // Store all configurations
      for (const config of largeConfigs) {
        await store.upsertMcpServerConfig(config.name, config);
      }

      // Read back all configurations multiple times
      for (let i = 0; i < 10; i++) {
        const installed = await installer.listInstalled();
        expect(installed).toHaveLength(100);
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should handle rapid creation and cleanup cycles', async () => {
      const cycleCount = 100;

      for (let cycle = 0; cycle < cycleCount; cycle++) {
        // Install servers
        const installPromises = Array.from({ length: 10 }, (_, i) =>
          installer.installFromNpm(`cycle-${cycle}-package-${i}`)
        );
        await Promise.all(installPromises);

        // List servers
        const installed = await installer.listInstalled();
        expect(installed.length).toBeGreaterThanOrEqual(10);

        // Uninstall some servers
        const serversToRemove = installed.slice(0, 5);
        const uninstallPromises = serversToRemove.map(server =>
          installer.uninstall(server.name)
        );
        await Promise.all(uninstallPromises);

        // Verify cleanup
        const remaining = await installer.listInstalled();
        expect(remaining.length).toBe(installed.length - 5);
      }

      console.log(`Completed ${cycleCount} install/uninstall cycles`);
    });
  });

  describe('Error Recovery Performance', () => {
    it('should handle failed installations gracefully at scale', async () => {
      const totalAttempts = 100;
      let successCount = 0;
      let failureCount = 0;

      // Mock exec to fail randomly
      execMock.mockImplementation((command, options, callback) => {
        const shouldFail = Math.random() < 0.3; // 30% failure rate

        setTimeout(() => {
          if (typeof callback === 'function') {
            if (shouldFail) {
              callback(new Error('Random installation failure'), null, null);
            } else {
              callback(null, { stdout: 'installed', stderr: '' } as any);
            }
          }
        }, Math.random() * 10); // Random delay up to 10ms
        return {} as any;
      });

      const startTime = Date.now();

      // Attempt many installations with expected failures
      const results = await Promise.allSettled(
        Array.from({ length: totalAttempts }, (_, i) =>
          installer.installFromNpm(`failure-test-${i}`)
        )
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failureCount++;
        }
      });

      // Verify that successful installations were tracked
      const installed = await installer.listInstalled();
      expect(installed).toHaveLength(successCount);

      // Should handle failures efficiently
      expect(duration).toBeLessThan(2000); // Less than 2 seconds

      console.log(`Error recovery: ${totalAttempts} attempts, ${successCount} succeeded, ${failureCount} failed in ${duration}ms`);
    });

    it('should maintain performance during database error recovery', async () => {
      const operationCount = 200;
      let successCount = 0;

      const startTime = Date.now();

      // Mix valid and invalid operations
      for (let i = 0; i < operationCount; i++) {
        try {
          const config: MCPServerConfig = {
            name: `error-recovery-${i}`,
            type: 'stdio',
            command: `command-${i}`,
            autoStart: false,
          };

          await store.upsertMcpServerConfig(config.name, config);

          // Occasionally try to access a non-existent server
          if (i % 10 === 0) {
            await installer.getInstalledServer(`non-existent-${i}`);
          }

          successCount++;
        } catch (error) {
          // Expected for non-existent server access
          // Continue processing
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should still process quickly despite errors
      expect(duration).toBeLessThan(2000);
      expect(successCount).toBeGreaterThan(operationCount * 0.8); // At least 80% success

      console.log(`DB error recovery: ${successCount}/${operationCount} successful operations in ${duration}ms`);
    });
  });

  describe('Scalability Tests', () => {
    it('should scale linearly with dataset size', async () => {
      const testSizes = [100, 500, 1000];
      const results: Array<{ size: number; duration: number }> = [];

      for (const size of testSizes) {
        const startTime = Date.now();

        // Populate dataset
        const promises = Array.from({ length: size }, (_, i) =>
          installer.installFromNpm(`scalability-test-${size}-${i}`)
        );

        await Promise.all(promises);

        // Perform operations
        await installer.listInstalled();

        const endTime = Date.now();
        const duration = endTime - startTime;

        results.push({ size, duration });

        console.log(`Scalability test: ${size} servers processed in ${duration}ms`);

        // Clean up for next test
        const installed = await installer.listInstalled();
        for (const server of installed) {
          if (server.name.includes(`scalability-test-${size}`)) {
            await installer.uninstall(server.name);
          }
        }
      }

      // Verify roughly linear scaling (allowing for some variance)
      const smallestTest = results[0];
      const largestTest = results[results.length - 1];

      const expectedDuration = (smallestTest.duration * largestTest.size) / smallestTest.size;
      const actualDuration = largestTest.duration;

      // Actual duration should be within 3x of expected linear scaling
      expect(actualDuration).toBeLessThan(expectedDuration * 3);

      console.log(`Scalability verification: Expected ${expectedDuration}ms, actual ${actualDuration}ms`);
    });
  });
});