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
  describe('BenchmarkThreshold Interface Compliance', () => {
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
  });
});