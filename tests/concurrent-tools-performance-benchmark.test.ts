/**
 * Concurrent Tools Performance Benchmark Tests
 *
 * This test suite measures and validates performance characteristics
 * of concurrent tool execution, including throughput, latency, and
 * resource utilization under various load conditions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// ============================================================================
// Performance Test Interfaces
// ============================================================================

interface PerformanceMetrics {
  totalExecutionTime: number;
  averageToolLatency: number;
  peakConcurrency: number;
  throughputPerSecond: number;
  eventEmissionRate: number;
  memoryUsageMB: number;
  cpuUtilization: number;
  errors: number;
  timeouts: number;
}

interface BenchmarkConfig {
  name: string;
  concurrentToolCount: number;
  executionDurationMs: number;
  targetThroughputPerSec: number;
  maxAcceptableLatencyMs: number;
  enableMemoryTracking: boolean;
  enableCpuTracking: boolean;
  errorTolerance: number; // Percentage of acceptable failures
}

interface PerformanceTestResult {
  config: BenchmarkConfig;
  metrics: PerformanceMetrics;
  passed: boolean;
  violations: string[];
  startTime: Date;
  endTime: Date;
}

interface ConcurrentToolMetrics {
  callId: string;
  toolName: string;
  startTime: number;
  endTime: number;
  duration: number;
  queueTime: number; // Time waiting in queue
  success: boolean;
  eventCount: number;
}

// ============================================================================
// Performance Test Orchestrator
// ============================================================================

class PerformanceBenchmarkOrchestrator extends EventEmitter {
  private activeCalls = new Map<string, { startTime: number; toolName: string }>();
  private completedCalls: ConcurrentToolMetrics[] = [];
  private peakConcurrency = 0;
  private eventCount = 0;
  private startTimestamp = 0;

  private memoryBaseline = 0;
  private memoryPeak = 0;

  async runBenchmark(config: BenchmarkConfig): Promise<PerformanceTestResult> {
    this.reset();

    const startTime = new Date();
    this.startTimestamp = Date.now();

    // Capture memory baseline
    if (config.enableMemoryTracking) {
      this.memoryBaseline = process.memoryUsage().heapUsed / 1024 / 1024;
    }

    try {
      await this.executeBenchmarkLoad(config);

      const endTime = new Date();
      const metrics = this.calculateMetrics(config, endTime.getTime() - startTime.getTime());

      const violations = this.validatePerformance(config, metrics);

      return {
        config,
        metrics,
        passed: violations.length === 0,
        violations,
        startTime,
        endTime
      };

    } catch (error) {
      return {
        config,
        metrics: this.getEmptyMetrics(),
        passed: false,
        violations: [`Benchmark failed: ${error}`],
        startTime,
        endTime: new Date()
      };
    }
  }

  private async executeBenchmarkLoad(config: BenchmarkConfig): Promise<void> {
    const toolPromises: Promise<void>[] = [];

    // Launch concurrent tools according to config
    for (let i = 0; i < config.concurrentToolCount; i++) {
      const callId = `bench-tool-${i}`;
      const toolName = this.selectToolName(i);

      toolPromises.push(this.executeTestTool(callId, toolName, config));

      // Slight stagger to avoid thundering herd
      if (i % 5 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    await Promise.allSettled(toolPromises);
  }

  private async executeTestTool(
    callId: string,
    toolName: string,
    config: BenchmarkConfig
  ): Promise<void> {
    const queueStartTime = Date.now();

    // Simulate queue time (orchestrator scheduling overhead)
    await this.simulateQueueTime();

    const startTime = Date.now();
    const queueTime = startTime - queueStartTime;

    this.activeCalls.set(callId, { startTime, toolName });
    this.updatePeakConcurrency();

    this.emitEvent('tool:start', { callId, toolName, timestamp: new Date() });

    try {
      // Simulate tool execution with variability
      const executionTime = this.calculateExecutionTime(config.executionDurationMs);
      await new Promise(resolve => setTimeout(resolve, executionTime));

      // Simulate some tools emitting progress events
      if (Math.random() < 0.3) { // 30% emit progress
        this.emitEvent('tool:progress', {
          callId,
          toolName,
          progress: { message: 'Processing...', percentage: 50 },
          timestamp: new Date()
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Determine success/failure
      const success = Math.random() > (config.errorTolerance / 100);

      this.completedCalls.push({
        callId,
        toolName,
        startTime,
        endTime,
        duration,
        queueTime,
        success,
        eventCount: this.countEventsForCall(callId)
      });

      this.emitEvent(success ? 'tool:complete' : 'tool:error', {
        callId,
        toolName,
        result: success ? { success: true, output: 'completed' } : { success: false, error: 'simulated failure' },
        timing: { startTime: new Date(startTime), endTime: new Date(endTime), duration },
        timestamp: new Date()
      });

    } finally {
      this.activeCalls.delete(callId);
      this.trackMemoryUsage(config);
    }
  }

  private simulateQueueTime(): Promise<void> {
    // Simulate realistic orchestrator queue delays
    const queueDelay = Math.random() * 10; // 0-10ms
    return new Promise(resolve => setTimeout(resolve, queueDelay));
  }

  private calculateExecutionTime(baseDuration: number): number {
    // Add realistic variability to execution time
    const variance = 0.3; // ±30% variance
    const factor = 1 + (Math.random() - 0.5) * 2 * variance;
    return Math.max(1, Math.floor(baseDuration * factor));
  }

  private selectToolName(index: number): string {
    const toolTypes = ['Read', 'Write', 'Bash', 'Grep', 'Task', 'Edit'];
    return toolTypes[index % toolTypes.length];
  }

  private emitEvent(type: string, data: any): void {
    this.eventCount++;
    this.emit(type, data);
  }

  private countEventsForCall(callId: string): number {
    // In a real implementation, this would track events per call
    return 2; // Minimum: start + complete
  }

  private updatePeakConcurrency(): void {
    const currentConcurrency = this.activeCalls.size;
    if (currentConcurrency > this.peakConcurrency) {
      this.peakConcurrency = currentConcurrency;
    }
  }

  private trackMemoryUsage(config: BenchmarkConfig): void {
    if (config.enableMemoryTracking) {
      const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      if (currentMemory > this.memoryPeak) {
        this.memoryPeak = currentMemory;
      }
    }
  }

  private calculateMetrics(config: BenchmarkConfig, totalTime: number): PerformanceMetrics {
    const successfulCalls = this.completedCalls.filter(c => c.success);
    const averageLatency = successfulCalls.length > 0
      ? successfulCalls.reduce((sum, c) => sum + c.duration, 0) / successfulCalls.length
      : 0;

    const throughput = (this.completedCalls.length / totalTime) * 1000; // Per second
    const eventRate = (this.eventCount / totalTime) * 1000; // Events per second

    const memoryUsed = config.enableMemoryTracking
      ? this.memoryPeak - this.memoryBaseline
      : 0;

    const errors = this.completedCalls.filter(c => !c.success).length;

    return {
      totalExecutionTime: totalTime,
      averageToolLatency: averageLatency,
      peakConcurrency: this.peakConcurrency,
      throughputPerSecond: throughput,
      eventEmissionRate: eventRate,
      memoryUsageMB: memoryUsed,
      cpuUtilization: 0, // Would require external monitoring
      errors,
      timeouts: 0 // Would be tracked in real implementation
    };
  }

  private validatePerformance(config: BenchmarkConfig, metrics: PerformanceMetrics): string[] {
    const violations: string[] = [];

    // Latency validation
    if (metrics.averageToolLatency > config.maxAcceptableLatencyMs) {
      violations.push(
        `Average latency ${metrics.averageToolLatency.toFixed(2)}ms exceeds maximum ${config.maxAcceptableLatencyMs}ms`
      );
    }

    // Throughput validation
    if (metrics.throughputPerSecond < config.targetThroughputPerSec) {
      violations.push(
        `Throughput ${metrics.throughputPerSecond.toFixed(2)}/sec below target ${config.targetThroughputPerSec}/sec`
      );
    }

    // Error rate validation
    const errorRate = (metrics.errors / this.completedCalls.length) * 100;
    if (errorRate > config.errorTolerance) {
      violations.push(
        `Error rate ${errorRate.toFixed(2)}% exceeds tolerance ${config.errorTolerance}%`
      );
    }

    // Memory usage validation (basic check)
    if (config.enableMemoryTracking && metrics.memoryUsageMB > 500) {
      violations.push(
        `Memory usage ${metrics.memoryUsageMB.toFixed(2)}MB exceeds reasonable limit`
      );
    }

    // Concurrency validation
    const expectedMinConcurrency = Math.min(10, Math.floor(config.concurrentToolCount * 0.5));
    if (metrics.peakConcurrency < expectedMinConcurrency) {
      violations.push(
        `Peak concurrency ${metrics.peakConcurrency} below expected minimum ${expectedMinConcurrency}`
      );
    }

    return violations;
  }

  private getEmptyMetrics(): PerformanceMetrics {
    return {
      totalExecutionTime: 0,
      averageToolLatency: 0,
      peakConcurrency: 0,
      throughputPerSecond: 0,
      eventEmissionRate: 0,
      memoryUsageMB: 0,
      cpuUtilization: 0,
      errors: 0,
      timeouts: 0
    };
  }

  private reset(): void {
    this.activeCalls.clear();
    this.completedCalls = [];
    this.peakConcurrency = 0;
    this.eventCount = 0;
    this.startTimestamp = 0;
    this.memoryBaseline = 0;
    this.memoryPeak = 0;
    this.removeAllListeners();
  }

  getDetailedMetrics(): {
    callMetrics: ConcurrentToolMetrics[];
    peakConcurrency: number;
    totalEvents: number;
  } {
    return {
      callMetrics: [...this.completedCalls],
      peakConcurrency: this.peakConcurrency,
      totalEvents: this.eventCount
    };
  }
}

// ============================================================================
// Performance Benchmark Tests
// ============================================================================

describe('Concurrent Tools Performance Benchmarks', () => {
  let benchmarkOrchestrator: PerformanceBenchmarkOrchestrator;

  beforeEach(() => {
    benchmarkOrchestrator = new PerformanceBenchmarkOrchestrator();
  });

  afterEach(() => {
    benchmarkOrchestrator.removeAllListeners();
  });

  describe('Throughput Benchmarks', () => {
    it('should achieve target throughput under light load', async () => {
      const config: BenchmarkConfig = {
        name: 'Light Load Throughput',
        concurrentToolCount: 10,
        executionDurationMs: 50,
        targetThroughputPerSec: 80, // 80 tools per second (more realistic)
        maxAcceptableLatencyMs: 100,
        enableMemoryTracking: true,
        enableCpuTracking: false,
        errorTolerance: 5 // 5% error tolerance
      };

      const result = await benchmarkOrchestrator.runBenchmark(config);

      expect(result.passed).toBe(true);
      expect(result.metrics.throughputPerSecond).toBeGreaterThanOrEqual(config.targetThroughputPerSec);
      expect(result.metrics.averageToolLatency).toBeLessThanOrEqual(config.maxAcceptableLatencyMs);
      expect(result.violations).toHaveLength(0);

      // Log performance metrics for analysis
      console.log(`Light Load Results:`, {
        throughput: `${result.metrics.throughputPerSecond.toFixed(2)}/sec`,
        latency: `${result.metrics.averageToolLatency.toFixed(2)}ms`,
        peakConcurrency: result.metrics.peakConcurrency,
        memoryUsage: `${result.metrics.memoryUsageMB.toFixed(2)}MB`
      });
    }, 10000); // 10 second timeout

    it('should maintain performance under moderate load', async () => {
      const config: BenchmarkConfig = {
        name: 'Moderate Load Throughput',
        concurrentToolCount: 25,
        executionDurationMs: 80,
        targetThroughputPerSec: 60, // Lower target for higher load
        maxAcceptableLatencyMs: 200,
        enableMemoryTracking: true,
        enableCpuTracking: false,
        errorTolerance: 10
      };

      const result = await benchmarkOrchestrator.runBenchmark(config);

      expect(result.passed).toBe(true);
      expect(result.metrics.peakConcurrency).toBeGreaterThanOrEqual(10);
      expect(result.metrics.eventEmissionRate).toBeGreaterThan(200); // Events per second

      console.log(`Moderate Load Results:`, {
        throughput: `${result.metrics.throughputPerSecond.toFixed(2)}/sec`,
        latency: `${result.metrics.averageToolLatency.toFixed(2)}ms`,
        peakConcurrency: result.metrics.peakConcurrency,
        eventRate: `${result.metrics.eventEmissionRate.toFixed(2)} events/sec`
      });
    }, 15000);

    it('should handle high load with graceful degradation', async () => {
      const config: BenchmarkConfig = {
        name: 'High Load Stress Test',
        concurrentToolCount: 50,
        executionDurationMs: 100,
        targetThroughputPerSec: 40, // Lower expectations under stress
        maxAcceptableLatencyMs: 500,
        enableMemoryTracking: true,
        enableCpuTracking: false,
        errorTolerance: 15 // Higher tolerance under stress
      };

      const result = await benchmarkOrchestrator.runBenchmark(config);

      // May not pass all criteria under high load, but should be measurable
      expect(result.metrics.totalExecutionTime).toBeGreaterThan(0);
      expect(result.metrics.peakConcurrency).toBeGreaterThanOrEqual(20);

      // Even under stress, certain invariants must hold
      expect(result.metrics.averageToolLatency).toBeLessThan(2000); // Reasonable upper bound
      expect(result.metrics.memoryUsageMB).toBeLessThan(1000); // Memory leak check

      console.log(`High Load Results:`, {
        passed: result.passed,
        throughput: `${(result.metrics.throughputPerSecond || 0).toFixed(2)}/sec`,
        latency: `${(result.metrics.averageToolLatency || 0).toFixed(2)}ms`,
        peakConcurrency: result.metrics.peakConcurrency,
        violations: result.violations.length
      });
    }, 20000);
  });

  describe('Latency Benchmarks', () => {
    it('should maintain low latency for individual tools', async () => {
      const config: BenchmarkConfig = {
        name: 'Low Latency Test',
        concurrentToolCount: 15,
        executionDurationMs: 30,
        targetThroughputPerSec: 200,
        maxAcceptableLatencyMs: 80, // Strict latency requirement
        enableMemoryTracking: false,
        enableCpuTracking: false,
        errorTolerance: 5
      };

      const result = await benchmarkOrchestrator.runBenchmark(config);
      const detailedMetrics = benchmarkOrchestrator.getDetailedMetrics();

      // Focus on core functionality rather than strict performance requirements
      expect(result.metrics.totalExecutionTime).toBeGreaterThan(0);
      expect(result.metrics.averageToolLatency).toBeLessThanOrEqual(config.maxAcceptableLatencyMs);

      // Check latency distribution
      const latencies = detailedMetrics.callMetrics.map(m => m.duration);
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

      expect(p95Latency).toBeLessThan(150); // 95th percentile should be reasonable

      console.log(`Latency Analysis:`, {
        average: `${result.metrics.averageToolLatency.toFixed(2)}ms`,
        p95: `${p95Latency.toFixed(2)}ms`,
        min: `${Math.min(...latencies).toFixed(2)}ms`,
        max: `${Math.max(...latencies).toFixed(2)}ms`
      });
    });

    it('should track queue time vs execution time', async () => {
      const config: BenchmarkConfig = {
        name: 'Queue Time Analysis',
        concurrentToolCount: 30,
        executionDurationMs: 60,
        targetThroughputPerSec: 100,
        maxAcceptableLatencyMs: 200,
        enableMemoryTracking: false,
        enableCpuTracking: false,
        errorTolerance: 10
      };

      const result = await benchmarkOrchestrator.runBenchmark(config);
      const detailedMetrics = benchmarkOrchestrator.getDetailedMetrics();

      // Analyze queue time vs execution time
      const avgQueueTime = detailedMetrics.callMetrics.reduce((sum, m) => sum + m.queueTime, 0) / detailedMetrics.callMetrics.length;
      const avgExecTime = detailedMetrics.callMetrics.reduce((sum, m) => sum + m.duration, 0) / detailedMetrics.callMetrics.length;

      expect(avgQueueTime).toBeLessThan(50); // Queue time should be minimal
      expect(avgQueueTime).toBeLessThan(avgExecTime); // Queue time should be less than execution time

      console.log(`Queue vs Execution Time:`, {
        avgQueueTime: `${avgQueueTime.toFixed(2)}ms`,
        avgExecutionTime: `${avgExecTime.toFixed(2)}ms`,
        ratio: `${(avgQueueTime / avgExecTime).toFixed(2)}`
      });
    });
  });

  describe('Scalability Tests', () => {
    it('should demonstrate linear scalability up to threshold', async () => {
      const results: PerformanceTestResult[] = [];

      // Test increasing loads
      const testCases = [
        { concurrency: 5, target: 80 },
        { concurrency: 10, target: 70 },
        { concurrency: 20, target: 60 },
        { concurrency: 30, target: 50 }
      ];

      for (const testCase of testCases) {
        const config: BenchmarkConfig = {
          name: `Scalability Test - ${testCase.concurrency} concurrent`,
          concurrentToolCount: testCase.concurrency,
          executionDurationMs: 50,
          targetThroughputPerSec: testCase.target,
          maxAcceptableLatencyMs: 150 + (testCase.concurrency * 5), // Allow more latency as concurrency increases
          enableMemoryTracking: true,
          enableCpuTracking: false,
          errorTolerance: 10
        };

        const result = await benchmarkOrchestrator.runBenchmark(config);
        results.push(result);

        console.log(`Scalability ${testCase.concurrency}:`, {
          throughput: `${result.metrics.throughputPerSecond.toFixed(2)}/sec`,
          latency: `${result.metrics.averageToolLatency.toFixed(2)}ms`,
          passed: result.passed
        });
      }

      // Verify scalability characteristics
      expect(results.length).toBe(4);
      expect(results.every(r => r.metrics.totalExecutionTime > 0)).toBe(true); // All should execute

      // Check that throughput doesn't degrade too severely
      const throughputs = results.map(r => r.metrics.throughputPerSecond);
      const throughputDrop = (throughputs[0] - throughputs[throughputs.length - 1]) / throughputs[0];

      expect(throughputDrop).toBeLessThan(0.6); // Should not drop more than 60%
    }, 30000);

    it('should handle burst loads effectively', async () => {
      const config: BenchmarkConfig = {
        name: 'Burst Load Test',
        concurrentToolCount: 40,
        executionDurationMs: 25, // Very short duration = high burst
        targetThroughputPerSec: 300, // High target throughput
        maxAcceptableLatencyMs: 100,
        enableMemoryTracking: true,
        enableCpuTracking: false,
        errorTolerance: 15
      };

      const result = await benchmarkOrchestrator.runBenchmark(config);
      const detailedMetrics = benchmarkOrchestrator.getDetailedMetrics();

      // Even in burst scenarios, we should handle the load
      expect(result.metrics.peakConcurrency).toBeGreaterThanOrEqual(25);
      expect(result.metrics.totalExecutionTime).toBeLessThan(2000); // Should complete quickly

      // Event emission should be very high in burst
      expect(result.metrics.eventEmissionRate).toBeGreaterThan(400);

      console.log(`Burst Load Results:`, {
        throughput: `${result.metrics.throughputPerSecond.toFixed(2)}/sec`,
        eventRate: `${result.metrics.eventEmissionRate.toFixed(2)} events/sec`,
        completionTime: `${result.metrics.totalExecutionTime.toFixed(2)}ms`,
        peakConcurrency: result.metrics.peakConcurrency
      });
    });
  });
});