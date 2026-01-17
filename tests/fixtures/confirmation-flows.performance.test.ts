/**
 * @fileoverview Performance tests for confirmation flow test fixtures
 *
 * This file contains performance benchmarks and stress tests to ensure
 * the fixtures can handle high-volume testing scenarios efficiently.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockPermissionRequest,
  createMockPermissionGranted,
  createMockPermissionDenied,
  createMockDangerousOperationDetected,
  createMockDangerousOperationConfirmed,
  createMockDangerousOperationBlocked,
  createMockApprovalRequired,
  createMockApprovalGranted,
  createMockApprovalDenied,
  createMockApprovalResolved,
  generatePermissionMatrix,
  generateRiskLevelScenarios,
  generateTimeoutScenarios
} from './confirmation-flows';

describe('Confirmation Flow Fixtures - Performance Tests', () => {

  describe('Factory Function Performance', () => {
    it('should create permission requests quickly at scale', () => {
      const iterations = 10000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        createMockPermissionRequest({
          tool: `Tool${i % 10}`,
          description: `Request ${i}`
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const requestsPerSecond = iterations / (duration / 1000);

      expect(requestsPerSecond).toBeGreaterThan(1000); // At least 1000 requests per second
      expect(duration).toBeLessThan(10000); // Complete within 10 seconds
    });

    it('should create dangerous operation events quickly at scale', () => {
      const iterations = 5000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        createMockDangerousOperationDetected({
          operation: `operation-${i}`,
          riskLevel: ['low', 'medium', 'high', 'critical'][i % 4] as any
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000); // Complete within 5 seconds
    });

    it('should create approval events quickly at scale', () => {
      const iterations = 5000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        createMockApprovalRequired({
          gateName: `gate-${i}`,
          description: `Approval ${i}`
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000); // Complete within 5 seconds
    });
  });

  describe('ID Generation Performance', () => {
    it('should generate unique IDs quickly under high load', () => {
      const iterations = 50000;
      const ids = new Set<string>();
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const request = createMockPermissionRequest();
        ids.add(request.requestId);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(ids.size).toBe(iterations); // All IDs should be unique
      expect(duration).toBeLessThan(15000); // Complete within 15 seconds
    });

    it('should handle concurrent ID generation without collisions', async () => {
      const concurrency = 10;
      const iterationsPerWorker = 1000;
      const startTime = performance.now();

      const workers = Array.from({ length: concurrency }, async () => {
        const ids = [];
        for (let i = 0; i < iterationsPerWorker; i++) {
          const request = createMockPermissionRequest();
          ids.push(request.requestId);
        }
        return ids;
      });

      const results = await Promise.all(workers);
      const allIds = results.flat();
      const uniqueIds = new Set(allIds);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(uniqueIds.size).toBe(concurrency * iterationsPerWorker);
      expect(duration).toBeLessThan(10000); // Complete within 10 seconds
    });
  });

  describe('Generator Function Performance', () => {
    it('should generate large permission matrices efficiently', () => {
      const tools = Array.from({ length: 100 }, (_, i) => `Tool${i}`);
      const startTime = performance.now();

      const matrix = generatePermissionMatrix(tools);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(matrix).toHaveLength(300); // 100 tools × 3 levels
      expect(duration).toBeLessThan(2000); // Complete within 2 seconds

      // Verify all entries are properly formed
      matrix.forEach(entry => {
        expect(entry.tool).toBeTruthy();
        expect(entry.request.requestId).toMatch(/^req_/);
        expect(entry.grantedResponse.requestId).toBe(entry.request.requestId);
        expect(entry.deniedResponse.requestId).toBe(entry.request.requestId);
      });
    });

    it('should generate risk scenarios efficiently', () => {
      const startTime = performance.now();

      // Generate scenarios multiple times to test consistency
      const scenarioSets = Array.from({ length: 1000 }, () =>
        generateRiskLevelScenarios()
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000); // Complete within 5 seconds

      // Verify consistency across generations
      scenarioSets.forEach(scenarios => {
        expect(scenarios).toHaveLength(4); // low, medium, high, critical
        scenarios.forEach(scenario => {
          expect(scenario.operation.operationId).toBeTruthy();
          expect(scenario.confirmedResponse.operationId).toBe(scenario.operation.operationId);
          expect(scenario.blockedResponse.operationId).toBe(scenario.operation.operationId);
        });
      });
    });

    it('should generate timeout scenarios efficiently', () => {
      const startTime = performance.now();

      const scenarioSets = Array.from({ length: 500 }, () =>
        generateTimeoutScenarios()
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(3000); // Complete within 3 seconds

      scenarioSets.forEach(scenarios => {
        scenarios.forEach(scenario => {
          expect(scenario.request.approvalId).toBeTruthy();
          expect(scenario.expectedResolution.approvalId).toBe(scenario.request.approvalId);
          expect(scenario.timeoutMinutes).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Memory Usage', () => {
    it('should not create excessive memory overhead', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create large number of fixtures
      const fixtures = Array.from({ length: 10000 }, () => ({
        permission: createMockPermissionRequest(),
        operation: createMockDangerousOperationDetected(),
        approval: createMockApprovalRequired()
      }));

      const afterCreationMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterCreationMemory - initialMemory;
      const averageMemoryPerFixture = memoryIncrease / fixtures.length;

      // Each fixture set should use reasonable memory (less than 10KB each)
      expect(averageMemoryPerFixture).toBeLessThan(10000);
    });

    it('should allow garbage collection of fixtures', () => {
      let fixtures: any[] = [];

      // Create fixtures
      for (let i = 0; i < 5000; i++) {
        fixtures.push(createMockPermissionRequest());
      }

      const memoryAfterCreation = process.memoryUsage().heapUsed;

      // Clear references
      fixtures = [];

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Wait a bit for GC
      setTimeout(() => {
        const memoryAfterCleanup = process.memoryUsage().heapUsed;

        // Memory should be reduced (allowing for some variance)
        expect(memoryAfterCleanup).toBeLessThan(memoryAfterCreation * 1.1);
      }, 100);
    });
  });

  describe('Stress Tests', () => {
    it('should handle rapid successive calls without degradation', () => {
      const iterations = 1000;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        createMockPermissionRequest();
        createMockDangerousOperationDetected();
        createMockApprovalRequired();

        const end = performance.now();
        times.push(end - start);
      }

      // Performance should be consistent (no significant degradation)
      const firstHalfAvg = times.slice(0, iterations / 2).reduce((a, b) => a + b) / (iterations / 2);
      const secondHalfAvg = times.slice(iterations / 2).reduce((a, b) => a + b) / (iterations / 2);

      // Second half should not be more than 50% slower than first half
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5);
    });

    it('should handle complex override scenarios efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        // Create complex overrides
        createMockPermissionRequest({
          tool: `ComplexTool_${i}`,
          scope: `/very/long/path/to/file/number/${i}/with/nested/directories/file.ts`,
          description: `Very detailed description for permission request number ${i} with lots of context and information`,
          metadata: {
            iteration: i,
            timestamp: new Date().toISOString(),
            complexity: 'high',
            nested: {
              level1: { level2: { level3: `value_${i}` } },
              array: Array.from({ length: 10 }, (_, j) => `item_${i}_${j}`)
            }
          }
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000); // Complex overrides should still be fast
    });
  });

  describe('Scalability Benchmarks', () => {
    it('should scale linearly with input size', () => {
      const sizes = [10, 50, 100, 500];
      const results: { size: number; duration: number }[] = [];

      sizes.forEach(size => {
        const tools = Array.from({ length: size }, (_, i) => `Tool${i}`);
        const startTime = performance.now();

        generatePermissionMatrix(tools);

        const endTime = performance.now();
        const duration = endTime - startTime;

        results.push({ size, duration });
      });

      // Check that duration scales roughly linearly (not exponentially)
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        const sizeRatio = curr.size / prev.size;
        const timeRatio = curr.duration / prev.duration;

        // Time ratio should not exceed size ratio by more than 2x
        expect(timeRatio).toBeLessThan(sizeRatio * 2);
      }
    });

    it('should maintain performance with large datasets', () => {
      const largeDatasetSize = 1000;
      const startTime = performance.now();

      // Create large dataset
      const permissionRequests = Array.from({ length: largeDatasetSize }, () =>
        createMockPermissionRequest()
      );

      const operations = Array.from({ length: largeDatasetSize }, () =>
        createMockDangerousOperationDetected()
      );

      const approvals = Array.from({ length: largeDatasetSize }, () =>
        createMockApprovalRequired()
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle 3000 total fixtures in reasonable time
      expect(duration).toBeLessThan(10000);

      // Verify data integrity at scale
      expect(permissionRequests.length).toBe(largeDatasetSize);
      expect(operations.length).toBe(largeDatasetSize);
      expect(approvals.length).toBe(largeDatasetSize);

      // Sample verification of uniqueness
      const requestIds = permissionRequests.map(r => r.requestId);
      const uniqueRequestIds = new Set(requestIds);
      expect(uniqueRequestIds.size).toBe(largeDatasetSize);
    });
  });
});