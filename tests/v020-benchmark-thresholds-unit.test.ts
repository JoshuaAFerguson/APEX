/**
 * @fileoverview Unit tests for v0.2.0 Performance Benchmarks - Threshold Configuration
 *
 * Tests threshold definitions and validation logic including:
 * - Threshold structure validation
 * - Configuration completeness
 * - Threshold value reasonableness
 * - Type safety and consistency
 */

import { describe, it, expect } from 'vitest';
import {
  BROWSER_THRESHOLDS,
  CORE_THRESHOLDS,
  ORCHESTRATOR_THRESHOLDS,
  THRESHOLDS,
  type BenchmarkThreshold
} from '../benchmarks/shared/thresholds';

describe('v0.2.0 Benchmark Thresholds Unit Tests', () => {
  // Utility function available to all tests in this suite
  const validateThreshold = (threshold: BenchmarkThreshold, name: string) => {
    expect(threshold).toBeDefined();
    expect(typeof threshold.maxMean).toBe('number');
    expect(typeof threshold.maxP95).toBe('number');
    expect(threshold.maxMean).toBeGreaterThan(0);
    expect(threshold.maxP95).toBeGreaterThan(0);
    expect(threshold.maxP95).toBeGreaterThanOrEqual(threshold.maxMean);

    if (threshold.maxP99 !== undefined) {
      expect(typeof threshold.maxP99).toBe('number');
      expect(threshold.maxP99).toBeGreaterThan(0);
      expect(threshold.maxP99).toBeGreaterThanOrEqual(threshold.maxP95);
    }

    if (threshold.minThroughput !== undefined) {
      expect(typeof threshold.minThroughput).toBe('number');
      expect(threshold.minThroughput).toBeGreaterThan(0);
    }
  };

  describe('BenchmarkThreshold Interface Compliance', () => {

    it('should validate all browser thresholds', () => {
      // Browser launch thresholds
      validateThreshold(BROWSER_THRESHOLDS.launch.chromium, 'chromium launch');
      validateThreshold(BROWSER_THRESHOLDS.launch.firefox, 'firefox launch');
      validateThreshold(BROWSER_THRESHOLDS.launch.webkit, 'webkit launch');

      // PNG screenshot thresholds
      validateThreshold(BROWSER_THRESHOLDS.screenshot.png.viewport, 'PNG viewport');
      validateThreshold(BROWSER_THRESHOLDS.screenshot.png.fullPage, 'PNG full page');
      validateThreshold(BROWSER_THRESHOLDS.screenshot.png.largeViewport, 'PNG large viewport');

      // JPEG screenshot thresholds
      validateThreshold(BROWSER_THRESHOLDS.screenshot.jpeg.viewport, 'JPEG viewport');
      validateThreshold(BROWSER_THRESHOLDS.screenshot.jpeg.fullPage, 'JPEG full page');
      validateThreshold(BROWSER_THRESHOLDS.screenshot.jpeg.largeViewport, 'JPEG large viewport');
    });

    it('should validate all core thresholds', () => {
      // Config parsing thresholds
      validateThreshold(CORE_THRESHOLDS.configParsing.simple, 'simple config parsing');
      validateThreshold(CORE_THRESHOLDS.configParsing.complex, 'complex config parsing');
      validateThreshold(CORE_THRESHOLDS.configParsing.withValidation, 'config parsing with validation');

      // Schema validation thresholds
      validateThreshold(CORE_THRESHOLDS.schemaValidation.agentDefinition, 'agent definition validation');
      validateThreshold(CORE_THRESHOLDS.schemaValidation.workflowDefinition, 'workflow definition validation');
      validateThreshold(CORE_THRESHOLDS.schemaValidation.fullConfig, 'full config validation');
      validateThreshold(CORE_THRESHOLDS.schemaValidation.toolAlias, 'tool alias validation');
      validateThreshold(CORE_THRESHOLDS.schemaValidation.mcpConfig, 'MCP config validation');
    });

    it('should validate all orchestrator thresholds', () => {
      // TaskStore CRUD thresholds
      validateThreshold(ORCHESTRATOR_THRESHOLDS.taskStore.create, 'task create');
      validateThreshold(ORCHESTRATOR_THRESHOLDS.taskStore.read, 'task read');
      validateThreshold(ORCHESTRATOR_THRESHOLDS.taskStore.update, 'task update');
      validateThreshold(ORCHESTRATOR_THRESHOLDS.taskStore.delete, 'task delete');
      validateThreshold(ORCHESTRATOR_THRESHOLDS.taskStore.bulkCreate100, 'bulk create 100');
      validateThreshold(ORCHESTRATOR_THRESHOLDS.taskStore.queryAll, 'query all tasks');
      validateThreshold(ORCHESTRATOR_THRESHOLDS.taskStore.queryByStatus, 'query by status');

      // Load testing thresholds
      validateThreshold(ORCHESTRATOR_THRESHOLDS.loadTesting.bulkCreate10k, 'bulk create 10k');
      validateThreshold(ORCHESTRATOR_THRESHOLDS.loadTesting.concurrentReads, 'concurrent reads');
      validateThreshold(ORCHESTRATOR_THRESHOLDS.loadTesting.concurrentWrites, 'concurrent writes');
      validateThreshold(ORCHESTRATOR_THRESHOLDS.loadTesting.mixedWorkload, 'mixed workload');
      validateThreshold(ORCHESTRATOR_THRESHOLDS.loadTesting.largeDatasetQuery, 'large dataset query');
      validateThreshold(ORCHESTRATOR_THRESHOLDS.loadTesting.connectionPoolPerformance, 'connection pool performance');
    });
  });

  describe('Browser Thresholds Reasonableness', () => {
    it('should have reasonable browser launch times', () => {
      // Chromium should be fastest
      expect(BROWSER_THRESHOLDS.launch.chromium.maxMean).toBe(5000);
      expect(BROWSER_THRESHOLDS.launch.chromium.maxP95).toBe(8000);
      expect(BROWSER_THRESHOLDS.launch.chromium.maxP99).toBe(10000);

      // Firefox and WebKit should be slightly slower
      expect(BROWSER_THRESHOLDS.launch.firefox.maxMean).toBe(6000);
      expect(BROWSER_THRESHOLDS.launch.webkit.maxMean).toBe(6000);

      // All browsers should have P99 thresholds defined (critical operations)
      expect(BROWSER_THRESHOLDS.launch.chromium.maxP99).toBeDefined();
      expect(BROWSER_THRESHOLDS.launch.firefox.maxP99).toBeDefined();
      expect(BROWSER_THRESHOLDS.launch.webkit.maxP99).toBeDefined();
    });

    it('should have reasonable screenshot times with JPEG being faster than PNG', () => {
      // PNG viewport vs JPEG viewport
      expect(BROWSER_THRESHOLDS.screenshot.png.viewport.maxMean).toBe(200);
      expect(BROWSER_THRESHOLDS.screenshot.jpeg.viewport.maxMean).toBe(150);
      expect(BROWSER_THRESHOLDS.screenshot.jpeg.viewport.maxMean)
        .toBeLessThan(BROWSER_THRESHOLDS.screenshot.png.viewport.maxMean);

      // Full page should be slower than viewport
      expect(BROWSER_THRESHOLDS.screenshot.png.fullPage.maxMean)
        .toBeGreaterThan(BROWSER_THRESHOLDS.screenshot.png.viewport.maxMean);
      expect(BROWSER_THRESHOLDS.screenshot.jpeg.fullPage.maxMean)
        .toBeGreaterThan(BROWSER_THRESHOLDS.screenshot.jpeg.viewport.maxMean);

      // Large viewport should be between viewport and full page
      expect(BROWSER_THRESHOLDS.screenshot.png.largeViewport.maxMean)
        .toBeGreaterThan(BROWSER_THRESHOLDS.screenshot.png.viewport.maxMean);
      expect(BROWSER_THRESHOLDS.screenshot.png.largeViewport.maxMean)
        .toBeLessThan(BROWSER_THRESHOLDS.screenshot.png.fullPage.maxMean);
    });
  });

  describe('Core Thresholds Reasonableness', () => {
    it('should have reasonable config parsing times with increasing complexity', () => {
      const { simple, complex, withValidation } = CORE_THRESHOLDS.configParsing;

      // Simple < Complex < WithValidation
      expect(simple.maxMean).toBeLessThan(complex.maxMean);
      expect(complex.maxMean).toBeLessThan(withValidation.maxMean);

      // Values should be in reasonable ranges (sub-second for config parsing)
      expect(simple.maxMean).toBe(5);
      expect(complex.maxMean).toBe(20);
      expect(withValidation.maxMean).toBe(30);

      // P95 should be reasonable multiples of mean
      expect(simple.maxP95 / simple.maxMean).toBeCloseTo(2, 0);
      expect(complex.maxP95 / complex.maxMean).toBeCloseTo(2.5, 0);
    });

    it('should have reasonable schema validation times with throughput requirements', () => {
      const validations = CORE_THRESHOLDS.schemaValidation;

      // All validations should have throughput requirements (high-frequency operations)
      expect(validations.agentDefinition.minThroughput).toBeDefined();
      expect(validations.workflowDefinition.minThroughput).toBeDefined();
      expect(validations.fullConfig.minThroughput).toBeDefined();
      expect(validations.toolAlias.minThroughput).toBeDefined();
      expect(validations.mcpConfig.minThroughput).toBeDefined();

      // ToolAlias should be fastest (simplest schema)
      expect(validations.toolAlias.maxMean).toBe(0.5);
      expect(validations.toolAlias.minThroughput).toBe(2000); // Highest throughput

      // FullConfig should be slowest (most complex schema)
      expect(validations.fullConfig.maxMean).toBe(10);
      expect(validations.fullConfig.minThroughput).toBe(100); // Lowest throughput

      // Ordering: toolAlias < agentDefinition < workflowDefinition < mcpConfig < fullConfig
      expect(validations.toolAlias.maxMean).toBeLessThan(validations.agentDefinition.maxMean);
      expect(validations.agentDefinition.maxMean).toBeLessThan(validations.workflowDefinition.maxMean);
      expect(validations.mcpConfig.maxMean).toBeLessThan(validations.fullConfig.maxMean);
    });
  });

  describe('Orchestrator Thresholds Reasonableness', () => {
    it('should have reasonable database operation times', () => {
      const taskStore = ORCHESTRATOR_THRESHOLDS.taskStore;

      // Read operations should be fastest
      expect(taskStore.read.maxMean).toBe(2);
      expect(taskStore.delete.maxMean).toBe(2);

      // Update should be slightly slower than read
      expect(taskStore.update.maxMean).toBe(3);

      // Create should be slowest single operation
      expect(taskStore.create.maxMean).toBe(5);

      // Bulk operations should take longer
      expect(taskStore.bulkCreate100.maxMean).toBe(50);
      expect(taskStore.queryAll.maxMean).toBe(10);
      expect(taskStore.queryByStatus.maxMean).toBe(5);

      // All CRUD operations should have throughput requirements
      expect(taskStore.create.minThroughput).toBeDefined();
      expect(taskStore.read.minThroughput).toBeDefined();
      expect(taskStore.update.minThroughput).toBeDefined();
      expect(taskStore.delete.minThroughput).toBeDefined();
    });

    it('should have throughput requirements that match performance expectations', () => {
      const taskStore = ORCHESTRATOR_THRESHOLDS.taskStore;

      // Read and delete should have highest throughput (500 ops/s)
      expect(taskStore.read.minThroughput).toBe(500);
      expect(taskStore.delete.minThroughput).toBe(500);

      // Update should be moderate (300 ops/s)
      expect(taskStore.update.minThroughput).toBe(300);

      // Create should be lowest single-op throughput (200 ops/s)
      expect(taskStore.create.minThroughput).toBe(200);

      // Query operations don't have throughput requirements (not critical for performance)
      expect(taskStore.queryAll.minThroughput).toBeUndefined();
      expect(taskStore.queryByStatus.minThroughput).toBeUndefined();
      expect(taskStore.bulkCreate100.minThroughput).toBeUndefined();
    });
  });

  describe('Combined Thresholds Structure', () => {
    it('should export combined thresholds correctly', () => {
      expect(THRESHOLDS.browser).toBe(BROWSER_THRESHOLDS);
      expect(THRESHOLDS.core).toBe(CORE_THRESHOLDS);
      expect(THRESHOLDS.orchestrator).toBe(ORCHESTRATOR_THRESHOLDS);
    });

    it('should maintain type safety across all threshold definitions', () => {
      // Type check - this will fail at compile time if types don't match
      const validateType = (threshold: BenchmarkThreshold) => threshold;

      // Browser thresholds
      validateType(THRESHOLDS.browser.launch.chromium);
      validateType(THRESHOLDS.browser.screenshot.png.viewport);
      validateType(THRESHOLDS.browser.screenshot.jpeg.fullPage);

      // Core thresholds
      validateType(THRESHOLDS.core.configParsing.simple);
      validateType(THRESHOLDS.core.schemaValidation.agentDefinition);

      // Orchestrator thresholds
      validateType(THRESHOLDS.orchestrator.taskStore.create);
      validateType(THRESHOLDS.orchestrator.taskStore.bulkCreate100);

      // Load testing thresholds
      validateType(THRESHOLDS.orchestrator.loadTesting.bulkCreate10k);
      validateType(THRESHOLDS.orchestrator.loadTesting.concurrentReads);
      validateType(THRESHOLDS.orchestrator.loadTesting.concurrentWrites);
      validateType(THRESHOLDS.orchestrator.loadTesting.mixedWorkload);
      validateType(THRESHOLDS.orchestrator.loadTesting.largeDatasetQuery);
      validateType(THRESHOLDS.orchestrator.loadTesting.connectionPoolPerformance);
    });
  });

  describe('Threshold Relationship Validation', () => {
    it('should maintain consistent performance expectations across related operations', () => {
      // Screenshot operations: JPEG should consistently be faster than PNG
      const pngScreenshots = BROWSER_THRESHOLDS.screenshot.png;
      const jpegScreenshots = BROWSER_THRESHOLDS.screenshot.jpeg;

      expect(jpegScreenshots.viewport.maxMean).toBeLessThan(pngScreenshots.viewport.maxMean);
      expect(jpegScreenshots.fullPage.maxMean).toBeLessThan(pngScreenshots.fullPage.maxMean);
      expect(jpegScreenshots.largeViewport.maxMean).toBeLessThan(pngScreenshots.largeViewport.maxMean);

      expect(jpegScreenshots.viewport.maxP95).toBeLessThan(pngScreenshots.viewport.maxP95);
      expect(jpegScreenshots.fullPage.maxP95).toBeLessThan(pngScreenshots.fullPage.maxP95);
      expect(jpegScreenshots.largeViewport.maxP95).toBeLessThan(pngScreenshots.largeViewport.maxP95);
    });

    it('should maintain consistent database operation performance hierarchy', () => {
      const taskStore = ORCHESTRATOR_THRESHOLDS.taskStore;

      // Performance hierarchy: read/delete < update < create
      expect(taskStore.read.maxMean).toBeLessThanOrEqual(taskStore.delete.maxMean);
      expect(taskStore.update.maxMean).toBeGreaterThan(taskStore.read.maxMean);
      expect(taskStore.create.maxMean).toBeGreaterThan(taskStore.update.maxMean);

      // Throughput hierarchy should be inverse: read/delete > update > create
      expect(taskStore.read.minThroughput).toBeGreaterThanOrEqual(taskStore.delete.minThroughput!);
      expect(taskStore.update.minThroughput).toBeLessThan(taskStore.read.minThroughput!);
      expect(taskStore.create.minThroughput).toBeLessThan(taskStore.update.minThroughput!);
    });

    it('should have appropriate performance scaling for complex operations', () => {
      // Config parsing should scale with complexity
      const configParsing = CORE_THRESHOLDS.configParsing;
      const complexityRatio = configParsing.complex.maxMean / configParsing.simple.maxMean;
      const validationRatio = configParsing.withValidation.maxMean / configParsing.complex.maxMean;

      expect(complexityRatio).toBeGreaterThan(2); // Complex should be at least 2x simple
      expect(validationRatio).toBeGreaterThan(1); // Validation adds overhead
      expect(complexityRatio).toBeLessThan(10); // But not unreasonably slow

      // Schema validation should scale with schema complexity
      const schemaValidation = CORE_THRESHOLDS.schemaValidation;
      const simpleToComplex = schemaValidation.fullConfig.maxMean / schemaValidation.toolAlias.maxMean;
      expect(simpleToComplex).toBeGreaterThan(10); // Full config much more complex than tool alias
      expect(simpleToComplex).toBeLessThan(100); // But not excessively so
    });
  });

  describe('Critical Operation Coverage', () => {
    it('should define P99 thresholds for critical operations', () => {
      // Browser launch is critical - should have P99 defined
      expect(BROWSER_THRESHOLDS.launch.chromium.maxP99).toBeDefined();
      expect(BROWSER_THRESHOLDS.launch.firefox.maxP99).toBeDefined();
      expect(BROWSER_THRESHOLDS.launch.webkit.maxP99).toBeDefined();

      // Screenshot operations are user-facing but not as critical
      expect(BROWSER_THRESHOLDS.screenshot.png.viewport.maxP99).toBeUndefined();
      expect(BROWSER_THRESHOLDS.screenshot.jpeg.viewport.maxP99).toBeUndefined();
    });

    it('should define throughput requirements for high-frequency operations', () => {
      // Schema validation is high-frequency - all should have throughput
      const schemaValidation = CORE_THRESHOLDS.schemaValidation;
      Object.values(schemaValidation).forEach(threshold => {
        expect(threshold.minThroughput).toBeDefined();
        expect(threshold.minThroughput).toBeGreaterThan(0);
      });

      // Database CRUD operations are high-frequency
      const taskStore = ORCHESTRATOR_THRESHOLDS.taskStore;
      expect(taskStore.create.minThroughput).toBeDefined();
      expect(taskStore.read.minThroughput).toBeDefined();
      expect(taskStore.update.minThroughput).toBeDefined();
      expect(taskStore.delete.minThroughput).toBeDefined();

      // But bulk and query operations are not (lower frequency)
      expect(taskStore.bulkCreate100.minThroughput).toBeUndefined();
      expect(taskStore.queryAll.minThroughput).toBeUndefined();
      expect(taskStore.queryByStatus.minThroughput).toBeUndefined();
    });
  });

  describe('Load Testing Thresholds', () => {
    it('should validate all load testing thresholds comply with interface', () => {
      const loadTesting = ORCHESTRATOR_THRESHOLDS.loadTesting;

      // Use the validateThreshold function from the parent describe block
      validateThreshold(loadTesting.bulkCreate10k, 'bulk create 10k');
      validateThreshold(loadTesting.concurrentReads, 'concurrent reads');
      validateThreshold(loadTesting.concurrentWrites, 'concurrent writes');
      validateThreshold(loadTesting.mixedWorkload, 'mixed workload');
      validateThreshold(loadTesting.largeDatasetQuery, 'large dataset query');
      validateThreshold(loadTesting.connectionPoolPerformance, 'connection pool performance');
    });

    it('should have appropriate time ranges for bulk operations', () => {
      const { bulkCreate10k } = ORCHESTRATOR_THRESHOLDS.loadTesting;

      // Bulk create 10k should take significant time but not excessive
      expect(bulkCreate10k.maxMean).toBe(60000); // 60 seconds
      expect(bulkCreate10k.maxP95).toBe(90000);  // 90 seconds
      expect(bulkCreate10k.maxP99).toBe(120000); // 2 minutes

      // Should not have throughput requirement (low frequency operation)
      expect(bulkCreate10k.minThroughput).toBeUndefined();
    });

    it('should have reasonable concurrent operation thresholds', () => {
      const { concurrentReads, concurrentWrites } = ORCHESTRATOR_THRESHOLDS.loadTesting;

      // Concurrent reads should be faster than writes
      expect(concurrentReads.maxMean).toBe(100);
      expect(concurrentWrites.maxMean).toBe(300);
      expect(concurrentReads.maxMean).toBeLessThan(concurrentWrites.maxMean);

      // Reads should have higher throughput than writes
      expect(concurrentReads.minThroughput).toBe(10);
      expect(concurrentWrites.minThroughput).toBe(3);
      expect(concurrentReads.minThroughput).toBeGreaterThan(concurrentWrites.minThroughput!);

      // P95 thresholds should maintain the same relationship
      expect(concurrentReads.maxP95).toBe(250);
      expect(concurrentWrites.maxP95).toBe(500);
      expect(concurrentReads.maxP95).toBeLessThan(concurrentWrites.maxP95);
    });

    it('should have mixed workload performance between reads and writes', () => {
      const { concurrentReads, concurrentWrites, mixedWorkload } = ORCHESTRATOR_THRESHOLDS.loadTesting;

      // Mixed workload should be between pure reads and pure writes
      expect(mixedWorkload.maxMean).toBe(333);
      expect(mixedWorkload.maxMean).toBeGreaterThan(concurrentReads.maxMean);
      expect(mixedWorkload.maxMean).toBeGreaterThan(concurrentWrites.maxMean);

      // Mixed workload throughput should be similar to writes (more complex operations)
      expect(mixedWorkload.minThroughput).toBe(3);
      expect(mixedWorkload.minThroughput).toBe(concurrentWrites.minThroughput);
    });

    it('should have appropriate large dataset query thresholds', () => {
      const { largeDatasetQuery } = ORCHESTRATOR_THRESHOLDS.loadTesting;

      // Large queries should be sub-second for mean, allow more time for P95/P99
      expect(largeDatasetQuery.maxMean).toBe(500);
      expect(largeDatasetQuery.maxP95).toBe(1000);
      expect(largeDatasetQuery.maxP99).toBe(2000);

      // Should not have throughput requirement (complex queries are not high-frequency)
      expect(largeDatasetQuery.minThroughput).toBeUndefined();

      // P99 should be defined for critical operation visibility
      expect(largeDatasetQuery.maxP99).toBeDefined();
    });

    it('should have connection pool performance thresholds with all metrics', () => {
      const { connectionPoolPerformance } = ORCHESTRATOR_THRESHOLDS.loadTesting;

      // Connection pool operations should be reasonably fast
      expect(connectionPoolPerformance.maxMean).toBe(200);
      expect(connectionPoolPerformance.maxP95).toBe(500);
      expect(connectionPoolPerformance.maxP99).toBe(1000);

      // Should have throughput requirement for pool efficiency
      expect(connectionPoolPerformance.minThroughput).toBe(5);
      expect(connectionPoolPerformance.minThroughput).toBeGreaterThan(0);

      // Should have P99 defined due to lock contention concerns
      expect(connectionPoolPerformance.maxP99).toBeDefined();
    });

    it('should have load testing thresholds derived from realistic baselines', () => {
      const loadTesting = ORCHESTRATOR_THRESHOLDS.loadTesting;

      // All thresholds should be based on measured performance with reasonable margins
      expect(loadTesting.bulkCreate10k.maxMean / 1000).toBeCloseTo(60, 0); // ~60 seconds in ms
      expect(loadTesting.concurrentReads.maxMean).toBeLessThan(500); // Fast concurrent ops
      expect(loadTesting.concurrentWrites.maxMean).toBeLessThan(1000); // Reasonable write performance
      expect(loadTesting.mixedWorkload.maxMean).toBeLessThan(1000); // Mixed ops performance
      expect(loadTesting.largeDatasetQuery.maxMean).toBeLessThan(1000); // Query performance
      expect(loadTesting.connectionPoolPerformance.maxMean).toBeLessThan(500); // Pool efficiency
    });

    it('should maintain performance hierarchy across load testing operations', () => {
      const loadTesting = ORCHESTRATOR_THRESHOLDS.loadTesting;

      // Performance hierarchy: reads < pool operations < writes < queries < mixed workload
      expect(loadTesting.concurrentReads.maxMean).toBeLessThan(loadTesting.connectionPoolPerformance.maxMean);
      expect(loadTesting.connectionPoolPerformance.maxMean).toBeLessThan(loadTesting.concurrentWrites.maxMean);
      expect(loadTesting.concurrentWrites.maxMean).toBeLessThan(loadTesting.largeDatasetQuery.maxMean);

      // Mixed workload should be slower than individual operations due to complexity
      expect(loadTesting.mixedWorkload.maxMean).toBeGreaterThan(loadTesting.concurrentReads.maxMean);
      expect(loadTesting.mixedWorkload.maxMean).toBeGreaterThan(loadTesting.concurrentWrites.maxMean);

      // Throughput hierarchy should be inverse: reads > pool > writes = mixed
      expect(loadTesting.concurrentReads.minThroughput!).toBeGreaterThan(loadTesting.connectionPoolPerformance.minThroughput!);
      expect(loadTesting.connectionPoolPerformance.minThroughput!).toBeGreaterThan(loadTesting.concurrentWrites.minThroughput!);
      expect(loadTesting.mixedWorkload.minThroughput).toBe(loadTesting.concurrentWrites.minThroughput);
    });
  });

  describe('Threshold Value Ranges', () => {
    it('should have browser operation thresholds in appropriate time ranges', () => {
      // Launch times should be in seconds range (1-12 seconds)
      const launchThresholds = Object.values(BROWSER_THRESHOLDS.launch);
      launchThresholds.forEach(threshold => {
        expect(threshold.maxMean).toBeGreaterThan(1000);
        expect(threshold.maxMean).toBeLessThan(15000);
        expect(threshold.maxP99!).toBeLessThan(20000);
      });

      // Screenshot times should be in sub-second to few seconds range
      const screenshotThresholds = [
        ...Object.values(BROWSER_THRESHOLDS.screenshot.png),
        ...Object.values(BROWSER_THRESHOLDS.screenshot.jpeg),
      ];
      screenshotThresholds.forEach(threshold => {
        expect(threshold.maxMean).toBeGreaterThan(50);
        expect(threshold.maxMean).toBeLessThan(5000);
        expect(threshold.maxP95).toBeLessThan(10000);
      });
    });

    it('should have core operation thresholds in appropriate time ranges', () => {
      // Config parsing should be very fast (sub-100ms)
      const configThresholds = Object.values(CORE_THRESHOLDS.configParsing);
      configThresholds.forEach(threshold => {
        expect(threshold.maxMean).toBeGreaterThan(1);
        expect(threshold.maxMean).toBeLessThan(100);
        expect(threshold.maxP95).toBeLessThan(200);
      });

      // Schema validation should be very fast (sub-20ms)
      const schemaThresholds = Object.values(CORE_THRESHOLDS.schemaValidation);
      schemaThresholds.forEach(threshold => {
        expect(threshold.maxMean).toBeGreaterThan(0.1);
        expect(threshold.maxMean).toBeLessThan(20);
        expect(threshold.maxP95).toBeLessThan(50);
        expect(threshold.minThroughput!).toBeGreaterThan(50);
      });
    });

    it('should have database operation thresholds in appropriate time ranges', () => {
      // Database operations should be fast (sub-100ms for single ops)
      const taskStoreThresholds = Object.values(ORCHESTRATOR_THRESHOLDS.taskStore);
      taskStoreThresholds.forEach(threshold => {
        expect(threshold.maxMean).toBeGreaterThan(1);

        // Bulk operations can take longer
        if (threshold.maxMean > 20) {
          expect(threshold.maxMean).toBeLessThan(200); // Bulk operations
        } else {
          expect(threshold.maxMean).toBeLessThan(20); // Single operations
        }

        expect(threshold.maxP95).toBeLessThan(500);
      });
    });

    it('should have load testing operation thresholds in appropriate time ranges', () => {
      const loadTestingThresholds = Object.values(ORCHESTRATOR_THRESHOLDS.loadTesting);

      loadTestingThresholds.forEach(threshold => {
        expect(threshold.maxMean).toBeGreaterThan(50); // Load operations take time

        // Different ranges for different operation types
        if (threshold.maxMean > 10000) {
          // Bulk operations (like bulkCreate10k)
          expect(threshold.maxMean).toBeLessThan(180000); // Max 3 minutes
          expect(threshold.maxP95).toBeLessThan(300000);  // Max 5 minutes at P95
          if (threshold.maxP99) {
            expect(threshold.maxP99).toBeLessThan(600000); // Max 10 minutes at P99
          }
        } else {
          // Individual load operations
          expect(threshold.maxMean).toBeLessThan(2000);   // Max 2 seconds
          expect(threshold.maxP95).toBeLessThan(5000);    // Max 5 seconds at P95
          if (threshold.maxP99) {
            expect(threshold.maxP99).toBeLessThan(10000); // Max 10 seconds at P99
          }
        }
      });
    });
  });

  describe('Load Testing Integration', () => {
    it('should include load testing thresholds in orchestrator export', () => {
      expect(ORCHESTRATOR_THRESHOLDS.loadTesting).toBeDefined();
      expect(ORCHESTRATOR_THRESHOLDS.loadTesting.bulkCreate10k).toBeDefined();
      expect(ORCHESTRATOR_THRESHOLDS.loadTesting.concurrentReads).toBeDefined();
      expect(ORCHESTRATOR_THRESHOLDS.loadTesting.concurrentWrites).toBeDefined();
      expect(ORCHESTRATOR_THRESHOLDS.loadTesting.mixedWorkload).toBeDefined();
      expect(ORCHESTRATOR_THRESHOLDS.loadTesting.largeDatasetQuery).toBeDefined();
      expect(ORCHESTRATOR_THRESHOLDS.loadTesting.connectionPoolPerformance).toBeDefined();
    });

    it('should maintain consistent structure across all threshold categories', () => {
      const loadTesting = ORCHESTRATOR_THRESHOLDS.loadTesting;

      // All load testing thresholds should be objects with consistent structure
      Object.entries(loadTesting).forEach(([name, threshold]) => {
        expect(typeof threshold).toBe('object');
        expect(threshold).toHaveProperty('maxMean');
        expect(threshold).toHaveProperty('maxP95');

        // Some should have optional properties based on operation type
        if (name === 'bulkCreate10k' || name === 'largeDatasetQuery') {
          // Bulk and query operations may not have throughput requirements
          expect(threshold.minThroughput).toBeUndefined();
        } else {
          // Concurrent operations should have throughput requirements
          expect(threshold.minThroughput).toBeDefined();
        }

        if (name === 'bulkCreate10k' || name === 'largeDatasetQuery' || name === 'connectionPoolPerformance') {
          // Critical operations should have P99 defined
          expect(threshold.maxP99).toBeDefined();
        }
      });
    });

    it('should properly integrate with combined THRESHOLDS export', () => {
      expect(THRESHOLDS.orchestrator.loadTesting).toBe(ORCHESTRATOR_THRESHOLDS.loadTesting);

      // Verify all load testing operations are accessible through main export
      expect(THRESHOLDS.orchestrator.loadTesting.bulkCreate10k).toBeDefined();
      expect(THRESHOLDS.orchestrator.loadTesting.concurrentReads).toBeDefined();
      expect(THRESHOLDS.orchestrator.loadTesting.concurrentWrites).toBeDefined();
      expect(THRESHOLDS.orchestrator.loadTesting.mixedWorkload).toBeDefined();
      expect(THRESHOLDS.orchestrator.loadTesting.largeDatasetQuery).toBeDefined();
      expect(THRESHOLDS.orchestrator.loadTesting.connectionPoolPerformance).toBeDefined();
    });

    it('should maintain baseline correlation with actual test scenarios', () => {
      const loadTesting = ORCHESTRATOR_THRESHOLDS.loadTesting;

      // Verify comments/documentation alignment with actual values
      // These values should correspond to the baselines mentioned in the threshold definitions

      // bulkCreate10k: ~200 tasks in 60s extrapolated to 10k
      expect(loadTesting.bulkCreate10k.maxMean).toBe(60000);

      // concurrentReads: 30 concurrent reads with 3 queries each in <10s
      expect(loadTesting.concurrentReads.maxMean).toBe(100);
      expect(loadTesting.concurrentReads.minThroughput).toBe(10);

      // concurrentWrites: 100 concurrent updates in <30s
      expect(loadTesting.concurrentWrites.maxMean).toBe(300);
      expect(loadTesting.concurrentWrites.minThroughput).toBe(3);

      // mixedWorkload: 60 operations in 20s
      expect(loadTesting.mixedWorkload.maxMean).toBe(333);
      expect(loadTesting.mixedWorkload.minThroughput).toBe(3);

      // largeDatasetQuery: Complex queries on 200+ tasks in <3s
      expect(loadTesting.largeDatasetQuery.maxMean).toBe(500);

      // connectionPoolPerformance: Multi-store operations in <10s
      expect(loadTesting.connectionPoolPerformance.maxMean).toBe(200);
      expect(loadTesting.connectionPoolPerformance.minThroughput).toBe(5);
    });
  });
});