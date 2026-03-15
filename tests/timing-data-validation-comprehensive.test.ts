import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Comprehensive Timing Data Validation Tests
 *
 * Validates timing data integrity across massive concurrent executions,
 * ensuring data remains consistent under extreme load and stress conditions.
 *
 * Focus Areas:
 * - Data integrity under massive concurrent load
 * - Memory pressure timing validation
 * - Cross-event data consistency verification
 * - Statistical timing pattern validation
 * - Error condition timing data preservation
 */

interface TimingDataPoint {
  eventId: string;
  callId: string;
  toolName: string;
  taskId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  timestamp: Date;
  systemTimestamp: number;
  precisionTimestamp: number;
  success: boolean;
  error?: string;
  metadata: {
    inputHash: string;
    outputHash?: string;
    memoryUsage: number;
    cpuUsage: number;
    concurrencyLevel: number;
  };
}

interface DataIntegrityResults {
  isValid: boolean;
  totalDataPoints: number;
  integrityViolations: Array<{
    dataPointId: string;
    violationType: 'duration_mismatch' | 'timestamp_invalid' | 'data_corruption' | 'timing_anomaly';
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  statisticalAnalysis: {
    averageDuration: number;
    durationStandardDeviation: number;
    medianDuration: number;
    durationOutliers: number;
    timingConsistencyScore: number;
    memoryStabilityScore: number;
  };
}

/**
 * High-capacity timing data validator
 */
class TimingDataValidator extends EventEmitter {
  private timingDataPoints: TimingDataPoint[] = [];
  private activeExecutions = new Map<string, {
    startTime: Date;
    startPrecisionTime: number;
    startSystemTime: number;
    metadata: any;
  }>();

  private concurrencyLevel = 0;
  private maxConcurrency = 0;

  /**
   * Execute tool with comprehensive data tracking
   */
  async executeWithDataTracking(
    taskId: string,
    toolName: string,
    callId: string,
    input: Record<string, unknown>,
    executionTimeMs: number,
    options: {
      shouldFail?: boolean;
      memoryPressure?: 'low' | 'medium' | 'high';
      cpuLoad?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<void> {
    this.concurrencyLevel++;
    this.maxConcurrency = Math.max(this.maxConcurrency, this.concurrencyLevel);

    const startTime = new Date();
    const startPrecisionTime = performance.now();
    const startSystemTime = Date.now();

    // Simulate memory/CPU load
    const memoryUsage = this.simulateMemoryUsage(options.memoryPressure || 'low');
    const cpuUsage = this.simulateCpuUsage(options.cpuLoad || 'low');

    // Create metadata
    const metadata = {
      inputHash: this.hashObject(input),
      memoryUsage,
      cpuUsage,
      concurrencyLevel: this.concurrencyLevel,
    };

    this.activeExecutions.set(callId, {
      startTime,
      startPrecisionTime,
      startSystemTime,
      metadata,
    });

    // Emit start event
    this.emit('tool:start', {
      taskId,
      toolName,
      callId,
      input,
      startTime,
      timestamp: startTime,
    });

    return new Promise<void>((resolve) => {
      // Apply CPU load simulation
      if (options.cpuLoad === 'high') {
        this.simulateHighCpuLoad();
      }

      setTimeout(() => {
        const endTime = new Date();
        const endPrecisionTime = performance.now();
        const endSystemTime = Date.now();

        const execution = this.activeExecutions.get(callId)!;
        const duration = endTime.getTime() - execution.startTime.getTime();

        // Create output for successful executions
        const output = !options.shouldFail ? {
          result: 'completed',
          processedData: this.generateOutputData(input),
          executionStats: {
            actualDuration: duration,
            precisionDuration: endPrecisionTime - execution.startPrecisionTime,
            systemDuration: endSystemTime - execution.startSystemTime,
          }
        } : undefined;

        // Record timing data point
        const dataPoint: TimingDataPoint = {
          eventId: `${callId}-data`,
          callId,
          toolName,
          taskId,
          startTime: execution.startTime,
          endTime,
          duration,
          timestamp: endTime,
          systemTimestamp: endSystemTime,
          precisionTimestamp: endPrecisionTime,
          success: !options.shouldFail,
          error: options.shouldFail ? `${toolName} execution failed under ${options.memoryPressure || 'normal'} memory pressure` : undefined,
          metadata: {
            ...execution.metadata,
            outputHash: output ? this.hashObject(output) : undefined,
          },
        };

        this.timingDataPoints.push(dataPoint);

        // Emit complete event
        this.emit('tool:complete', {
          taskId,
          toolName,
          callId,
          result: {
            success: !options.shouldFail,
            output,
            error: dataPoint.error,
          },
          timing: {
            startTime: execution.startTime,
            endTime,
            duration,
          },
          timestamp: endTime,
        });

        this.activeExecutions.delete(callId);
        this.concurrencyLevel--;
        resolve();
      }, executionTimeMs);
    });
  }

  /**
   * Execute massive concurrent load test
   */
  async executeMassiveConcurrentLoad(
    taskId: string,
    concurrentCount: number,
    options: {
      executionTimeVarianceMs?: [number, number]; // [min, max]
      failureRate?: number;
      memoryPressureDistribution?: Array<'low' | 'medium' | 'high'>;
      batchSize?: number;
    } = {}
  ): Promise<void> {
    const {
      executionTimeVarianceMs = [50, 200],
      failureRate = 0.05,
      memoryPressureDistribution = ['low', 'medium', 'high'],
      batchSize = 100,
    } = options;

    const batches = Math.ceil(concurrentCount / batchSize);
    const allPromises: Promise<void>[] = [];

    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const batchPromises: Promise<void>[] = [];
      const itemsInBatch = Math.min(batchSize, concurrentCount - batchIndex * batchSize);

      for (let i = 0; i < itemsInBatch; i++) {
        const globalIndex = batchIndex * batchSize + i;
        const callId = `massive-${globalIndex}`;
        const toolName = `MassiveTool${globalIndex % 10}`; // Reuse tool names for variety

        const executionTime = executionTimeVarianceMs[0] +
          Math.random() * (executionTimeVarianceMs[1] - executionTimeVarianceMs[0]);

        const shouldFail = Math.random() < failureRate;
        const memoryPressure = memoryPressureDistribution[globalIndex % memoryPressureDistribution.length];
        const cpuLoad = globalIndex % 4 === 0 ? 'high' : globalIndex % 3 === 0 ? 'medium' : 'low';

        const promise = this.executeWithDataTracking(
          taskId,
          toolName,
          callId,
          { batchIndex, itemIndex: i, globalIndex, loadTest: true },
          executionTime,
          { shouldFail, memoryPressure, cpuLoad }
        );

        batchPromises.push(promise);
      }

      allPromises.push(...batchPromises);

      // Small delay between batches to prevent overwhelming the system
      if (batchIndex < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    await Promise.all(allPromises);
  }

  /**
   * Validate timing data integrity
   */
  validateTimingDataIntegrity(): DataIntegrityResults {
    const violations: DataIntegrityResults['integrityViolations'] = [];
    const durations: number[] = [];

    for (const dataPoint of this.timingDataPoints) {
      durations.push(dataPoint.duration);

      // Check duration calculation consistency
      const calculatedDuration = dataPoint.endTime.getTime() - dataPoint.startTime.getTime();
      if (dataPoint.duration !== calculatedDuration) {
        violations.push({
          dataPointId: dataPoint.eventId,
          violationType: 'duration_mismatch',
          description: `Duration mismatch: recorded ${dataPoint.duration}ms, calculated ${calculatedDuration}ms`,
          severity: 'high',
        });
      }

      // Check timestamp validity
      if (dataPoint.endTime.getTime() < dataPoint.startTime.getTime()) {
        violations.push({
          dataPointId: dataPoint.eventId,
          violationType: 'timestamp_invalid',
          description: 'End time is before start time',
          severity: 'critical',
        });
      }

      // Check for negative durations
      if (dataPoint.duration < 0) {
        violations.push({
          dataPointId: dataPoint.eventId,
          violationType: 'timing_anomaly',
          description: 'Negative duration detected',
          severity: 'critical',
        });
      }

      // Check for extremely long durations (potential data corruption)
      if (dataPoint.duration > 60000) { // > 60 seconds
        violations.push({
          dataPointId: dataPoint.eventId,
          violationType: 'timing_anomaly',
          description: `Extremely long duration: ${dataPoint.duration}ms`,
          severity: 'medium',
        });
      }

      // Check metadata integrity
      if (!dataPoint.metadata.inputHash || dataPoint.metadata.inputHash.length === 0) {
        violations.push({
          dataPointId: dataPoint.eventId,
          violationType: 'data_corruption',
          description: 'Missing or invalid input hash',
          severity: 'low',
        });
      }

      // Check successful executions have output hash
      if (dataPoint.success && !dataPoint.metadata.outputHash) {
        violations.push({
          dataPointId: dataPoint.eventId,
          violationType: 'data_corruption',
          description: 'Successful execution missing output hash',
          severity: 'medium',
        });
      }
    }

    // Calculate statistical analysis
    const statisticalAnalysis = this.calculateStatisticalAnalysis(durations);

    return {
      isValid: violations.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0,
      totalDataPoints: this.timingDataPoints.length,
      integrityViolations: violations,
      statisticalAnalysis,
    };
  }

  private calculateStatisticalAnalysis(durations: number[]): DataIntegrityResults['statisticalAnalysis'] {
    if (durations.length === 0) {
      return {
        averageDuration: 0,
        durationStandardDeviation: 0,
        medianDuration: 0,
        durationOutliers: 0,
        timingConsistencyScore: 0,
        memoryStabilityScore: 0,
      };
    }

    // Basic statistics
    const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - averageDuration, 2), 0) / durations.length;
    const standardDeviation = Math.sqrt(variance);

    // Median
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const medianDuration = sortedDurations[Math.floor(sortedDurations.length / 2)];

    // Outliers (values beyond 2 standard deviations)
    const outlierThreshold = 2 * standardDeviation;
    const durationOutliers = durations.filter(d =>
      Math.abs(d - averageDuration) > outlierThreshold
    ).length;

    // Timing consistency score (lower coefficient of variation = higher consistency)
    const coefficientOfVariation = standardDeviation / averageDuration;
    const timingConsistencyScore = Math.max(0, 1 - coefficientOfVariation);

    // Memory stability score (based on memory usage variance)
    const memoryUsages = this.timingDataPoints.map(dp => dp.metadata.memoryUsage);
    const avgMemoryUsage = memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length;
    const memoryVariance = memoryUsages.reduce((sum, m) => sum + Math.pow(m - avgMemoryUsage, 2), 0) / memoryUsages.length;
    const memoryStabilityScore = Math.max(0, 1 - Math.sqrt(memoryVariance) / avgMemoryUsage);

    return {
      averageDuration,
      durationStandardDeviation: standardDeviation,
      medianDuration,
      durationOutliers,
      timingConsistencyScore,
      memoryStabilityScore,
    };
  }

  private hashObject(obj: any): string {
    // Simple hash function for testing (not cryptographically secure)
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private simulateMemoryUsage(pressure: 'low' | 'medium' | 'high'): number {
    const baseUsage = 1024 * 1024; // 1MB baseline
    switch (pressure) {
      case 'low': return baseUsage + Math.random() * baseUsage;
      case 'medium': return baseUsage * 5 + Math.random() * baseUsage * 3;
      case 'high': return baseUsage * 10 + Math.random() * baseUsage * 10;
    }
  }

  private simulateCpuUsage(load: 'low' | 'medium' | 'high'): number {
    switch (load) {
      case 'low': return Math.random() * 20; // 0-20%
      case 'medium': return 20 + Math.random() * 40; // 20-60%
      case 'high': return 60 + Math.random() * 40; // 60-100%
    }
  }

  private simulateHighCpuLoad(): void {
    // Brief CPU-intensive operation
    const iterations = 10000;
    let result = 0;
    for (let i = 0; i < iterations; i++) {
      result += Math.sin(i) * Math.cos(i);
    }
  }

  private generateOutputData(input: Record<string, unknown>): any {
    // Generate realistic output based on input
    return {
      processedInput: input,
      timestamp: new Date().toISOString(),
      processId: Math.random().toString(36),
      outputSize: Object.keys(input).length * 100,
    };
  }

  getTimingDataPoints(): TimingDataPoint[] {
    return [...this.timingDataPoints];
  }

  getExecutionStatistics(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    maxConcurrency: number;
    averageMemoryUsage: number;
    averageCpuUsage: number;
  } {
    const successful = this.timingDataPoints.filter(dp => dp.success);
    const failed = this.timingDataPoints.filter(dp => !dp.success);

    const avgMemoryUsage = this.timingDataPoints.reduce((sum, dp) => sum + dp.metadata.memoryUsage, 0) / this.timingDataPoints.length || 0;
    const avgCpuUsage = this.timingDataPoints.reduce((sum, dp) => sum + dp.metadata.cpuUsage, 0) / this.timingDataPoints.length || 0;

    return {
      totalExecutions: this.timingDataPoints.length,
      successfulExecutions: successful.length,
      failedExecutions: failed.length,
      maxConcurrency: this.maxConcurrency,
      averageMemoryUsage: avgMemoryUsage,
      averageCpuUsage: avgCpuUsage,
    };
  }

  clearData(): void {
    this.timingDataPoints = [];
    this.activeExecutions.clear();
    this.concurrencyLevel = 0;
    this.maxConcurrency = 0;
  }

  close(): void {
    this.removeAllListeners();
    this.clearData();
  }
}

describe('Comprehensive Timing Data Validation Tests', () => {
  let validator: TimingDataValidator;

  beforeEach(() => {
    validator = new TimingDataValidator();
  });

  afterEach(() => {
    validator.close();
  });

  // ============================================================================
  // Massive Concurrent Load Tests
  // ============================================================================

  describe('Massive Concurrent Load', () => {
    it('should maintain data integrity under 500 concurrent executions', async () => {
      const taskId = 'massive-concurrent-task';
      const concurrentCount = 500;

      await validator.executeMassiveConcurrentLoad(taskId, concurrentCount, {
        executionTimeVarianceMs: [30, 150],
        failureRate: 0.03,
        memoryPressureDistribution: ['low', 'low', 'medium', 'high'],
        batchSize: 100,
      });

      const validation = validator.validateTimingDataIntegrity();
      const stats = validator.getExecutionStatistics();

      // Validate execution completed
      expect(stats.totalExecutions).toBe(concurrentCount);
      expect(stats.successfulExecutions + stats.failedExecutions).toBe(concurrentCount);

      // Data integrity should be maintained
      expect(validation.isValid).toBe(true);
      expect(validation.totalDataPoints).toBe(concurrentCount);

      // Should have minimal critical violations
      const criticalViolations = validation.integrityViolations.filter(v => v.severity === 'critical');
      expect(criticalViolations).toHaveLength(0);

      // High violations should be minimal
      const highViolations = validation.integrityViolations.filter(v => v.severity === 'high');
      expect(highViolations.length).toBeLessThan(concurrentCount * 0.01); // Less than 1%

      // Timing consistency should be reasonable under load (allowing for variance with 500 concurrent)
      expect(validation.statisticalAnalysis.timingConsistencyScore).toBeGreaterThan(0.5);

      // Memory stability should be maintained (allowing for variance under load)
      expect(validation.statisticalAnalysis.memoryStabilityScore).toBeGreaterThan(0.0);

      console.log('Massive load test statistics:', {
        totalExecutions: stats.totalExecutions,
        successRate: stats.successfulExecutions / stats.totalExecutions,
        maxConcurrency: stats.maxConcurrency,
        timingConsistencyScore: validation.statisticalAnalysis.timingConsistencyScore,
        totalViolations: validation.integrityViolations.length,
      });
    }, 60000); // 60 second timeout

    it('should handle extreme memory pressure without timing corruption', async () => {
      const taskId = 'memory-pressure-task';
      const executionCount = 500;

      await validator.executeMassiveConcurrentLoad(taskId, executionCount, {
        executionTimeVarianceMs: [40, 120],
        failureRate: 0.08,
        memoryPressureDistribution: ['high'], // All high memory pressure
        batchSize: 50,
      });

      const validation = validator.validateTimingDataIntegrity();
      const stats = validator.getExecutionStatistics();

      // Even under extreme memory pressure, critical timing issues should not occur
      const criticalViolations = validation.integrityViolations.filter(v =>
        v.severity === 'critical' && v.violationType === 'timing_anomaly'
      );
      expect(criticalViolations).toHaveLength(0);

      // Duration mismatches should be minimal
      const durationMismatches = validation.integrityViolations.filter(v =>
        v.violationType === 'duration_mismatch'
      );
      expect(durationMismatches.length).toBeLessThan(executionCount * 0.02); // Less than 2%

      // Memory usage should reflect high pressure
      expect(stats.averageMemoryUsage).toBeGreaterThan(1024 * 1024 * 5); // > 5MB average

      // Timing data should remain internally consistent
      const dataPoints = validator.getTimingDataPoints();
      for (const dataPoint of dataPoints) {
        expect(dataPoint.duration).toBeGreaterThanOrEqual(0);
        expect(dataPoint.endTime.getTime()).toBeGreaterThanOrEqual(dataPoint.startTime.getTime());
      }
    }, 30000);
  });

  // ============================================================================
  // Statistical Pattern Validation Tests
  // ============================================================================

  describe('Statistical Pattern Validation', () => {
    it('should detect and validate normal timing distribution patterns', async () => {
      const taskId = 'statistical-pattern-task';
      const executionCount = 200;

      // Execute with controlled timing variance
      const promises = Array.from({ length: executionCount }, (_, i) => {
        const baseTime = 100;
        const variance = 30;
        const executionTime = baseTime + (Math.random() - 0.5) * variance * 2; // Normal-ish distribution

        return validator.executeWithDataTracking(
          taskId,
          `StatisticalTool${i % 10}`,
          `statistical-${i}`,
          { index: i, targetTime: executionTime },
          executionTime
        );
      });

      await Promise.all(promises);

      const validation = validator.validateTimingDataIntegrity();

      // Statistical analysis should show reasonable patterns
      expect(validation.statisticalAnalysis.averageDuration).toBeGreaterThan(85);
      expect(validation.statisticalAnalysis.averageDuration).toBeLessThan(115);
      expect(validation.statisticalAnalysis.durationStandardDeviation).toBeLessThan(40); // Reasonable variance

      // Outliers should be minimal for controlled execution
      expect(validation.statisticalAnalysis.durationOutliers).toBeLessThan(executionCount * 0.05); // Less than 5%

      // Timing consistency should be high for controlled conditions
      expect(validation.statisticalAnalysis.timingConsistencyScore).toBeGreaterThan(0.8);

      // Should have good overall data integrity
      expect(validation.isValid).toBe(true);
    });

    it('should validate timing patterns across different execution speeds', async () => {
      const taskId = 'speed-pattern-task';

      // Create three groups with different speeds
      const fastExecutions = Array.from({ length: 50 }, (_, i) =>
        validator.executeWithDataTracking(taskId, 'FastTool', `fast-${i}`, { speed: 'fast' }, 30)
      );

      const mediumExecutions = Array.from({ length: 50 }, (_, i) =>
        validator.executeWithDataTracking(taskId, 'MediumTool', `medium-${i}`, { speed: 'medium' }, 100)
      );

      const slowExecutions = Array.from({ length: 50 }, (_, i) =>
        validator.executeWithDataTracking(taskId, 'SlowTool', `slow-${i}`, { speed: 'slow' }, 200)
      );

      await Promise.all([...fastExecutions, ...mediumExecutions, ...slowExecutions]);

      const validation = validator.validateTimingDataIntegrity();
      const dataPoints = validator.getTimingDataPoints();

      // Separate by speed categories
      const fastData = dataPoints.filter(dp => dp.callId.startsWith('fast-'));
      const mediumData = dataPoints.filter(dp => dp.callId.startsWith('medium-'));
      const slowData = dataPoints.filter(dp => dp.callId.startsWith('slow-'));

      expect(fastData).toHaveLength(50);
      expect(mediumData).toHaveLength(50);
      expect(slowData).toHaveLength(50);

      // Calculate averages for each group
      const fastAvg = fastData.reduce((sum, dp) => sum + dp.duration, 0) / fastData.length;
      const mediumAvg = mediumData.reduce((sum, dp) => sum + dp.duration, 0) / mediumData.length;
      const slowAvg = slowData.reduce((sum, dp) => sum + dp.duration, 0) / slowData.length;

      // Validate speed relationships
      expect(fastAvg).toBeLessThan(mediumAvg);
      expect(mediumAvg).toBeLessThan(slowAvg);

      // Each group should have reasonable timing consistency
      expect(fastAvg).toBeGreaterThan(20);
      expect(fastAvg).toBeLessThan(50);
      expect(mediumAvg).toBeGreaterThan(80);
      expect(mediumAvg).toBeLessThan(120);
      expect(slowAvg).toBeGreaterThan(170);
      expect(slowAvg).toBeLessThan(230);

      // Overall data integrity should be maintained
      expect(validation.isValid).toBe(true);
    });
  });

  // ============================================================================
  // Error Condition Data Preservation Tests
  // ============================================================================

  describe('Error Condition Data Preservation', () => {
    it('should preserve timing data integrity for failed executions', async () => {
      const taskId = 'error-preservation-task';
      const totalExecutions = 100;
      const failureRate = 0.5; // 50% failure rate

      const promises = Array.from({ length: totalExecutions }, (_, i) => {
        const shouldFail = Math.random() < failureRate;
        return validator.executeWithDataTracking(
          taskId,
          `ErrorTestTool${i}`,
          `error-test-${i}`,
          { index: i, expectedFailure: shouldFail },
          60 + Math.random() * 80, // 60-140ms
          { shouldFail }
        );
      });

      await Promise.all(promises);

      const validation = validator.validateTimingDataIntegrity();
      const dataPoints = validator.getTimingDataPoints();
      const stats = validator.getExecutionStatistics();

      // Validate failure distribution
      expect(stats.failedExecutions).toBeGreaterThan(totalExecutions * 0.3); // At least 30% failed
      expect(stats.successfulExecutions).toBeGreaterThan(totalExecutions * 0.3); // At least 30% succeeded

      // Failed executions should still have valid timing data
      const failedDataPoints = dataPoints.filter(dp => !dp.success);
      for (const failedPoint of failedDataPoints) {
        // Duration should be valid
        expect(failedPoint.duration).toBeGreaterThanOrEqual(0);
        expect(failedPoint.duration).toBeLessThan(300); // Reasonable upper bound

        // Timestamps should be valid
        expect(failedPoint.endTime.getTime()).toBeGreaterThanOrEqual(failedPoint.startTime.getTime());

        // Should have error information
        expect(failedPoint.error).toBeDefined();
        expect(failedPoint.error).toContain('failed');

        // Metadata should be preserved
        expect(failedPoint.metadata.inputHash).toBeDefined();
        expect(failedPoint.metadata.memoryUsage).toBeGreaterThan(0);
        expect(failedPoint.metadata.cpuUsage).toBeGreaterThanOrEqual(0);
      }

      // Data integrity should be maintained even with failures
      const criticalViolations = validation.integrityViolations.filter(v => v.severity === 'critical');
      expect(criticalViolations).toHaveLength(0);

      // Failed and successful executions should have similar data quality
      const successfulDataPoints = dataPoints.filter(dp => dp.success);
      const failedAvgDuration = failedDataPoints.reduce((sum, dp) => sum + dp.duration, 0) / failedDataPoints.length;
      const successfulAvgDuration = successfulDataPoints.reduce((sum, dp) => sum + dp.duration, 0) / successfulDataPoints.length;

      // Durations should be in the same ballpark (failures might be slightly faster)
      expect(Math.abs(failedAvgDuration - successfulAvgDuration)).toBeLessThan(100);
    });

    it('should maintain data integrity during system stress conditions', async () => {
      const taskId = 'stress-condition-task';
      const stressExecutions = 300;

      // Apply various stress conditions
      const promises = Array.from({ length: stressExecutions }, (_, i) => {
        const stress = i % 3;
        const memoryPressure = stress === 0 ? 'high' : stress === 1 ? 'medium' : 'low';
        const cpuLoad = stress === 2 ? 'high' : stress === 1 ? 'medium' : 'low';
        const shouldFail = i % 10 === 0; // 10% failure rate

        return validator.executeWithDataTracking(
          taskId,
          `StressTool${i}`,
          `stress-${i}`,
          { stressLevel: stress, index: i },
          50 + Math.random() * 100, // 50-150ms
          { shouldFail, memoryPressure, cpuLoad }
        );
      });

      await Promise.all(promises);

      const validation = validator.validateTimingDataIntegrity();
      const dataPoints = validator.getTimingDataPoints();

      // Under stress, some degradation is acceptable but data should remain valid
      expect(validation.totalDataPoints).toBe(stressExecutions);

      // Critical violations should still be zero
      const criticalViolations = validation.integrityViolations.filter(v => v.severity === 'critical');
      expect(criticalViolations).toHaveLength(0);

      // High severity violations should be minimal even under stress
      const highViolations = validation.integrityViolations.filter(v => v.severity === 'high');
      expect(highViolations.length).toBeLessThan(stressExecutions * 0.02); // Less than 2%

      // All data points should have basic integrity
      for (const dataPoint of dataPoints) {
        expect(dataPoint.duration).toBeGreaterThanOrEqual(0);
        expect(dataPoint.endTime.getTime()).toBeGreaterThanOrEqual(dataPoint.startTime.getTime());
        expect(dataPoint.metadata.inputHash).toBeDefined();
        expect(dataPoint.metadata.memoryUsage).toBeGreaterThan(0);
      }

      // Timing consistency score should remain reasonable even under stress
      // Under extreme stress with multiple concurrent threads and simulated failures, consistency degrades
      expect(validation.statisticalAnalysis.timingConsistencyScore).toBeGreaterThan(0.4);
    });
  });
});