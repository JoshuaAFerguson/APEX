/**
 * @fileoverview Performance and stress tests for Mock Tool Types
 *
 * This test file focuses on:
 * - High-volume tool invocations
 * - Concurrent execution performance
 * - Memory usage and garbage collection
 * - Large data processing
 * - Performance regression detection
 * - Benchmarking and profiling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type {
  MockTool,
  MockToolResponse,
  ToolInvocation,
  ToolInvocationContext,
  MockToolExecutor,
  MockToolRegistryEntry,
} from '../test-utils/mock-tool-types.js';

import {
  MockToolResponseSchema,
  ToolInvocationSchema,
} from '../test-utils/mock-tool-types.js';

describe('Mock Tool Types Performance and Stress Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('High-volume invocations', () => {
    it('should handle thousands of tool invocations efficiently', async () => {
      class HighVolumeExecutor implements MockToolExecutor {
        private invocationCount = 0;
        private totalProcessingTime = 0;
        private startTime = Date.now();

        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          const invokeStart = process.hrtime.bigint();
          this.invocationCount++;

          // Simulate lightweight processing
          const input = params.input as string || '';
          const processed = input.toUpperCase().split('').reverse().join('');

          const invokeEnd = process.hrtime.bigint();
          const processingTime = Number(invokeEnd - invokeStart) / 1_000_000; // Convert to ms

          this.totalProcessingTime += processingTime;

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Processed: ${processed}`,
              },
            ],
            duration: processingTime,
            metadata: {
              invocationNumber: this.invocationCount,
              averageProcessingTime: this.totalProcessingTime / this.invocationCount,
              totalInvocations: this.invocationCount,
              uptime: Date.now() - this.startTime,
            },
          };
        }

        getMetrics() {
          return {
            totalInvocations: this.invocationCount,
            totalProcessingTime: this.totalProcessingTime,
            averageProcessingTime: this.totalProcessingTime / this.invocationCount,
            uptime: Date.now() - this.startTime,
          };
        }

        reset() {
          this.invocationCount = 0;
          this.totalProcessingTime = 0;
          this.startTime = Date.now();
        }
      }

      const executor = new HighVolumeExecutor();
      const invocationCount = 10000;

      const startTime = process.hrtime.bigint();

      // Execute many invocations sequentially
      const results: MockToolResponse[] = [];
      for (let i = 0; i < invocationCount; i++) {
        const result = await executor.execute({
          input: `test_input_${i}`,
          batch: Math.floor(i / 100),
        });
        results.push(result);

        // Advance timer slightly for each invocation
        vi.advanceTimersByTime(1);
      }

      const endTime = process.hrtime.bigint();
      const totalTime = Number(endTime - startTime) / 1_000_000;

      const metrics = executor.getMetrics();

      // Verify all invocations succeeded
      expect(results).toHaveLength(invocationCount);
      expect(results.every(r => r.success)).toBe(true);

      // Check performance metrics
      expect(metrics.totalInvocations).toBe(invocationCount);
      expect(metrics.averageProcessingTime).toBeLessThan(1); // Should be very fast
      expect(totalTime).toBeLessThan(invocationCount * 0.1); // Should be much faster than 0.1ms per invocation

      // Verify invocation numbering
      expect(results[0].metadata?.invocationNumber).toBe(1);
      expect(results[invocationCount - 1].metadata?.invocationNumber).toBe(invocationCount);
    });

    it('should maintain performance with concurrent invocations', async () => {
      class ConcurrentExecutor implements MockToolExecutor {
        private concurrentCount = 0;
        private maxConcurrent = 0;
        private totalInvocations = 0;
        private completedInvocations = 0;

        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          this.concurrentCount++;
          this.totalInvocations++;
          this.maxConcurrent = Math.max(this.maxConcurrent, this.concurrentCount);

          const workDuration = (params.workDuration as number) || 10;
          const startTime = Date.now();

          try {
            // Simulate async work
            await new Promise(resolve => setTimeout(resolve, workDuration));

            const endTime = Date.now();
            const actualDuration = endTime - startTime;

            this.completedInvocations++;

            return {
              success: true,
              content: [
                {
                  type: 'text',
                  text: `Concurrent work completed`,
                },
              ],
              duration: actualDuration,
              metadata: {
                concurrentCount: this.concurrentCount,
                maxConcurrentReached: this.maxConcurrent,
                completedInvocations: this.completedInvocations,
                workDuration,
              },
            };
          } finally {
            this.concurrentCount--;
          }
        }

        getStats() {
          return {
            totalInvocations: this.totalInvocations,
            completedInvocations: this.completedInvocations,
            currentConcurrent: this.concurrentCount,
            maxConcurrent: this.maxConcurrent,
          };
        }

        reset() {
          this.concurrentCount = 0;
          this.maxConcurrent = 0;
          this.totalInvocations = 0;
          this.completedInvocations = 0;
        }
      }

      const executor = new ConcurrentExecutor();
      const concurrentBatches = 100;
      const batchSize = 50;

      const startTime = Date.now();

      // Execute multiple concurrent batches
      const batchPromises: Promise<MockToolResponse[]>[] = [];

      for (let batch = 0; batch < concurrentBatches; batch++) {
        const batchPromise = Promise.all(
          Array(batchSize).fill(null).map((_, index) =>
            executor.execute({
              batchId: batch,
              itemId: index,
              workDuration: 5 + Math.random() * 10,
            })
          )
        );
        batchPromises.push(batchPromise);
      }

      // Advance timers to allow concurrent work to complete
      vi.advanceTimersByTime(20);

      const batchResults = await Promise.all(batchPromises);
      const allResults = batchResults.flat();

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      const stats = executor.getStats();

      // Verify all invocations completed
      expect(allResults).toHaveLength(concurrentBatches * batchSize);
      expect(allResults.every(r => r.success)).toBe(true);
      expect(stats.completedInvocations).toBe(concurrentBatches * batchSize);

      // Check concurrency metrics
      expect(stats.maxConcurrent).toBeGreaterThan(1);
      expect(stats.maxConcurrent).toBeLessThanOrEqual(concurrentBatches * batchSize);

      // Performance should be better than sequential execution
      const sequentialTime = (concurrentBatches * batchSize) * 10; // 10ms per invocation
      expect(totalTime).toBeLessThan(sequentialTime * 0.5); // At least 50% faster
    });

    it('should handle batched processing efficiently', async () => {
      class BatchProcessorExecutor implements MockToolExecutor {
        private batchStats = new Map<number, {
          batchId: number;
          itemCount: number;
          startTime: number;
          endTime?: number;
          processedItems: number;
        }>();

        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          const batchId = (params.batchId as number) || 0;
          const items = (params.items as unknown[]) || [];
          const processingMode = (params.mode as string) || 'standard';

          const startTime = Date.now();

          // Track batch processing
          this.batchStats.set(batchId, {
            batchId,
            itemCount: items.length,
            startTime,
            processedItems: 0,
          });

          const processed: any[] = [];

          // Process items based on mode
          switch (processingMode) {
            case 'fast':
              // Minimal processing
              for (const item of items) {
                processed.push({ original: item, processed: true });
                this.updateBatchProgress(batchId, 1);
              }
              break;

            case 'standard':
              // Standard processing with some computation
              for (const item of items) {
                const result = JSON.stringify(item).length;
                processed.push({ original: item, size: result });
                this.updateBatchProgress(batchId, 1);
                await new Promise(resolve => setTimeout(resolve, 1)); // Small delay
              }
              break;

            case 'intensive':
              // More intensive processing
              for (const item of items) {
                let hash = 0;
                const str = JSON.stringify(item);
                for (let i = 0; i < str.length; i++) {
                  const char = str.charCodeAt(i);
                  hash = ((hash << 5) - hash) + char;
                  hash = hash & hash; // Convert to 32-bit integer
                }
                processed.push({ original: item, hash });
                this.updateBatchProgress(batchId, 1);
                await new Promise(resolve => setTimeout(resolve, 2)); // Longer delay
              }
              break;
          }

          const endTime = Date.now();
          const batchStat = this.batchStats.get(batchId)!;
          batchStat.endTime = endTime;

          const duration = endTime - startTime;

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Batch ${batchId} processed ${items.length} items in ${duration}ms`,
              },
              {
                type: 'resource',
                uri: `batch://${batchId}`,
                mimeType: 'application/json',
                text: JSON.stringify(processed, null, 2),
              },
            ],
            duration,
            metadata: {
              batchId,
              itemCount: items.length,
              processingMode,
              itemsPerSecond: items.length / (duration / 1000),
              batchStats: Array.from(this.batchStats.values()),
            },
          };
        }

        private updateBatchProgress(batchId: number, increment: number) {
          const batch = this.batchStats.get(batchId);
          if (batch) {
            batch.processedItems += increment;
          }
        }

        getBatchMetrics() {
          return Array.from(this.batchStats.values()).map(batch => ({
            batchId: batch.batchId,
            itemCount: batch.itemCount,
            processedItems: batch.processedItems,
            duration: batch.endTime ? batch.endTime - batch.startTime : undefined,
            itemsPerSecond: batch.endTime
              ? batch.itemCount / ((batch.endTime - batch.startTime) / 1000)
              : undefined,
          }));
        }

        reset() {
          this.batchStats.clear();
        }
      }

      const executor = new BatchProcessorExecutor();

      const testBatches = [
        { batchId: 1, mode: 'fast', items: Array(100).fill(null).map((_, i) => ({ id: i, data: `item_${i}` })) },
        { batchId: 2, mode: 'standard', items: Array(50).fill(null).map((_, i) => ({ id: i, type: 'standard', value: Math.random() })) },
        { batchId: 3, mode: 'intensive', items: Array(25).fill(null).map((_, i) => ({ id: i, complex: { nested: true, value: i * 2 } })) },
      ];

      const results: MockToolResponse[] = [];

      for (const batch of testBatches) {
        vi.advanceTimersByTime(batch.items.length * (batch.mode === 'intensive' ? 2 : 1));
        const result = await executor.execute(batch);
        results.push(result);
      }

      const metrics = executor.getBatchMetrics();

      // Verify all batches processed successfully
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);

      // Check batch-specific performance
      const fastBatch = results.find(r => r.metadata?.processingMode === 'fast');
      const standardBatch = results.find(r => r.metadata?.processingMode === 'standard');
      const intensiveBatch = results.find(r => r.metadata?.processingMode === 'intensive');

      expect(fastBatch?.metadata?.itemsPerSecond).toBeGreaterThan(standardBatch?.metadata?.itemsPerSecond);
      expect(standardBatch?.metadata?.itemsPerSecond).toBeGreaterThan(intensiveBatch?.metadata?.itemsPerSecond);

      // Verify metrics tracking
      expect(metrics).toHaveLength(3);
      expect(metrics.every(m => m.processedItems === m.itemCount)).toBe(true);
      expect(metrics.every(m => m.duration !== undefined && m.duration > 0)).toBe(true);
    });
  });

  describe('Memory usage and optimization', () => {
    it('should manage memory efficiently with large data sets', async () => {
      class MemoryEfficientExecutor implements MockToolExecutor {
        private memorySnapshots: Array<{
          stage: string;
          heapUsed: number;
          heapTotal: number;
          external: number;
          timestamp: number;
        }> = [];

        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          this.takeMemorySnapshot('start');

          const dataSize = (params.dataSize as number) || 1000;
          const processInChunks = (params.chunked as boolean) || false;
          const chunkSize = (params.chunkSize as number) || 100;

          // Generate large dataset
          const largeData = Array(dataSize).fill(null).map((_, index) => ({
            id: index,
            data: `${'x'.repeat(50)}_${index}`,
            metadata: {
              timestamp: Date.now() + index,
              random: Math.random(),
              nested: {
                level1: {
                  level2: {
                    level3: `deep_data_${index}`,
                  },
                },
              },
            },
          }));

          this.takeMemorySnapshot('data_generated');

          let processedCount = 0;
          const results: any[] = [];

          if (processInChunks) {
            // Process in chunks to optimize memory usage
            for (let i = 0; i < largeData.length; i += chunkSize) {
              const chunk = largeData.slice(i, i + chunkSize);

              // Process chunk
              const chunkResults = chunk.map(item => ({
                id: item.id,
                processed: true,
                hash: this.simpleHash(JSON.stringify(item)),
              }));

              results.push(...chunkResults);
              processedCount += chunk.length;

              // Allow garbage collection between chunks
              if (global.gc && i % (chunkSize * 10) === 0) {
                global.gc();
                this.takeMemorySnapshot(`chunk_${Math.floor(i / chunkSize)}_gc`);
              }

              await new Promise(resolve => setTimeout(resolve, 1)); // Yield control
            }
          } else {
            // Process all at once
            for (const item of largeData) {
              results.push({
                id: item.id,
                processed: true,
                hash: this.simpleHash(JSON.stringify(item)),
              });
              processedCount++;
            }
          }

          this.takeMemorySnapshot('processing_complete');

          // Clean up large data to test garbage collection
          largeData.length = 0;

          if (global.gc) {
            global.gc();
            this.takeMemorySnapshot('after_gc');
          }

          const memoryAnalysis = this.analyzeMemoryUsage();

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Processed ${processedCount} items using ${processInChunks ? 'chunked' : 'batch'} processing`,
              },
            ],
            metadata: {
              dataSize,
              processedCount,
              processInChunks,
              chunkSize: processInChunks ? chunkSize : undefined,
              memoryAnalysis,
              memorySnapshots: this.memorySnapshots,
            },
          };
        }

        private takeMemorySnapshot(stage: string) {
          const usage = process.memoryUsage();
          this.memorySnapshots.push({
            stage,
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal,
            external: usage.external,
            timestamp: Date.now(),
          });
        }

        private analyzeMemoryUsage() {
          if (this.memorySnapshots.length === 0) return null;

          const first = this.memorySnapshots[0];
          const last = this.memorySnapshots[this.memorySnapshots.length - 1];
          const peak = this.memorySnapshots.reduce((max, snapshot) =>
            snapshot.heapUsed > max.heapUsed ? snapshot : max
          );

          return {
            initialMemory: first.heapUsed,
            finalMemory: last.heapUsed,
            peakMemory: peak.heapUsed,
            memoryGrowth: last.heapUsed - first.heapUsed,
            peakStage: peak.stage,
            totalDuration: last.timestamp - first.timestamp,
          };
        }

        private simpleHash(str: string): number {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
          }
          return hash;
        }

        reset() {
          this.memorySnapshots = [];
          if (global.gc) {
            global.gc();
          }
        }
      }

      const executor = new MemoryEfficientExecutor();

      // Test batch processing (memory intensive)
      vi.advanceTimersByTime(1000);
      const batchResult = await executor.execute({
        dataSize: 1000,
        chunked: false,
      });

      expect(batchResult.success).toBe(true);
      expect(batchResult.metadata?.processedCount).toBe(1000);

      const batchMemoryAnalysis = batchResult.metadata?.memoryAnalysis;
      expect(batchMemoryAnalysis?.peakMemory).toBeGreaterThan(batchMemoryAnalysis?.initialMemory);

      // Reset and test chunked processing (memory efficient)
      executor.reset();

      vi.advanceTimersByTime(1000);
      const chunkedResult = await executor.execute({
        dataSize: 1000,
        chunked: true,
        chunkSize: 50,
      });

      expect(chunkedResult.success).toBe(true);
      expect(chunkedResult.metadata?.processedCount).toBe(1000);

      const chunkedMemoryAnalysis = chunkedResult.metadata?.memoryAnalysis;

      // Chunked processing should use less peak memory
      if (batchMemoryAnalysis && chunkedMemoryAnalysis) {
        expect(chunkedMemoryAnalysis.peakMemory).toBeLessThanOrEqual(batchMemoryAnalysis.peakMemory * 1.1); // Allow 10% variance
      }
    });

    it('should detect and handle memory leaks', async () => {
      class LeakDetectionExecutor implements MockToolExecutor {
        private retainedData: Array<{ id: number; data: string; timestamp: number }> = [];
        private invocationCount = 0;

        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          this.invocationCount++;
          const simulateLeak = (params.simulateLeak as boolean) || false;

          // Take initial memory measurement
          const initialMemory = process.memoryUsage().heapUsed;

          // Process some data
          const workData = Array(100).fill(null).map((_, i) => ({
            id: this.invocationCount * 100 + i,
            data: `work_data_${'x'.repeat(100)}_${i}`,
            timestamp: Date.now(),
          }));

          // Simulate memory leak by retaining references
          if (simulateLeak) {
            this.retainedData.push(...workData); // This causes a memory leak
          }

          // Do some processing
          const processed = workData.map(item => item.data.length).reduce((a, b) => a + b, 0);

          // Clear local data (but not retained data if leak is simulated)
          workData.length = 0;

          const finalMemory = process.memoryUsage().heapUsed;
          const memoryDelta = finalMemory - initialMemory;

          // Detect potential memory leak
          const isLeakDetected = this.detectMemoryLeak(memoryDelta);

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Invocation ${this.invocationCount} completed. Processed ${processed} bytes.`,
              },
            ],
            metadata: {
              invocationCount: this.invocationCount,
              memoryDelta,
              retainedDataCount: this.retainedData.length,
              isLeakDetected,
              memoryPressure: this.getMemoryPressure(),
              simulateLeak,
            },
          };
        }

        private detectMemoryLeak(memoryDelta: number): boolean {
          // Simple heuristic: if memory grows significantly and retained data is accumulating
          return memoryDelta > 50 * 1024 * 1024 && this.retainedData.length > 1000; // 50MB growth + 1000 retained items
        }

        private getMemoryPressure(): 'low' | 'medium' | 'high' {
          const usage = process.memoryUsage();
          const heapRatio = usage.heapUsed / usage.heapTotal;

          if (heapRatio > 0.8) return 'high';
          if (heapRatio > 0.6) return 'medium';
          return 'low';
        }

        getLeakStatistics() {
          return {
            totalInvocations: this.invocationCount,
            retainedItems: this.retainedData.length,
            estimatedLeakSize: this.retainedData.length * 150, // Approximate size per item
          };
        }

        reset() {
          this.retainedData = [];
          this.invocationCount = 0;
          if (global.gc) {
            global.gc();
          }
        }
      }

      const executor = new LeakDetectionExecutor();

      // Test normal operation (no leak)
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(100);
        const result = await executor.execute({ simulateLeak: false });
        expect(result.success).toBe(true);
        expect(result.metadata?.isLeakDetected).toBe(false);
      }

      const normalStats = executor.getLeakStatistics();
      expect(normalStats.retainedItems).toBe(0);

      // Test with simulated leak
      executor.reset();

      for (let i = 0; i < 15; i++) {
        vi.advanceTimersByTime(100);
        const result = await executor.execute({ simulateLeak: true });
        expect(result.success).toBe(true);

        // Should detect leak after several iterations
        if (i > 10) {
          expect(result.metadata?.isLeakDetected).toBe(true);
        }
      }

      const leakStats = executor.getLeakStatistics();
      expect(leakStats.retainedItems).toBeGreaterThan(1000);
      expect(leakStats.estimatedLeakSize).toBeGreaterThan(100000);
    });
  });

  describe('Performance benchmarking', () => {
    it('should provide comprehensive performance benchmarks', async () => {
      class BenchmarkExecutor implements MockToolExecutor {
        private benchmarkResults: Array<{
          operation: string;
          duration: number;
          throughput: number;
          memoryUsed: number;
          timestamp: number;
        }> = [];

        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          const operation = (params.operation as string) || 'default';
          const iterations = (params.iterations as number) || 1000;

          const benchmarkResult = await this.runBenchmark(operation, iterations);
          this.benchmarkResults.push(benchmarkResult);

          const stats = this.calculateStatistics();

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Benchmark "${operation}" completed: ${benchmarkResult.throughput.toFixed(2)} ops/sec`,
              },
            ],
            metadata: {
              benchmark: benchmarkResult,
              statistics: stats,
              allResults: this.benchmarkResults,
            },
          };
        }

        private async runBenchmark(operation: string, iterations: number) {
          const startTime = process.hrtime.bigint();
          const startMemory = process.memoryUsage().heapUsed;

          // Different benchmark operations
          switch (operation) {
            case 'json_parse_stringify':
              await this.benchmarkJsonOperations(iterations);
              break;
            case 'array_operations':
              await this.benchmarkArrayOperations(iterations);
              break;
            case 'string_operations':
              await this.benchmarkStringOperations(iterations);
              break;
            case 'object_creation':
              await this.benchmarkObjectCreation(iterations);
              break;
            default:
              await this.benchmarkDefaultOperation(iterations);
          }

          const endTime = process.hrtime.bigint();
          const endMemory = process.memoryUsage().heapUsed;

          const duration = Number(endTime - startTime) / 1_000_000; // Convert to ms
          const throughput = iterations / (duration / 1000); // ops per second
          const memoryUsed = endMemory - startMemory;

          return {
            operation,
            duration,
            throughput,
            memoryUsed,
            timestamp: Date.now(),
          };
        }

        private async benchmarkJsonOperations(iterations: number) {
          const testObject = {
            id: 123,
            name: 'test',
            data: Array(10).fill(null).map((_, i) => ({ index: i, value: Math.random() })),
          };

          for (let i = 0; i < iterations; i++) {
            const json = JSON.stringify(testObject);
            const parsed = JSON.parse(json);
            // Use the result to prevent optimization
            if (parsed.id !== 123) throw new Error('Unexpected result');
          }
        }

        private async benchmarkArrayOperations(iterations: number) {
          for (let i = 0; i < iterations; i++) {
            const arr = Array(100).fill(null).map((_, index) => index);
            const filtered = arr.filter(x => x % 2 === 0);
            const mapped = filtered.map(x => x * 2);
            const reduced = mapped.reduce((sum, x) => sum + x, 0);
            // Use the result to prevent optimization
            if (reduced < 0) throw new Error('Unexpected result');
          }
        }

        private async benchmarkStringOperations(iterations: number) {
          const baseString = 'The quick brown fox jumps over the lazy dog';

          for (let i = 0; i < iterations; i++) {
            const upper = baseString.toUpperCase();
            const split = upper.split(' ');
            const joined = split.join('-');
            const reversed = joined.split('').reverse().join('');
            // Use the result to prevent optimization
            if (reversed.length !== joined.length) throw new Error('Unexpected result');
          }
        }

        private async benchmarkObjectCreation(iterations: number) {
          for (let i = 0; i < iterations; i++) {
            const obj = {
              id: i,
              timestamp: Date.now(),
              data: {
                nested: {
                  value: Math.random(),
                  array: [1, 2, 3, 4, 5],
                },
              },
            };
            // Use the object to prevent optimization
            if (obj.id !== i) throw new Error('Unexpected result');
          }
        }

        private async benchmarkDefaultOperation(iterations: number) {
          for (let i = 0; i < iterations; i++) {
            const result = Math.sin(i) * Math.cos(i);
            // Use the result to prevent optimization
            if (isNaN(result)) throw new Error('Unexpected result');
          }
        }

        private calculateStatistics() {
          if (this.benchmarkResults.length === 0) return null;

          const throughputs = this.benchmarkResults.map(r => r.throughput);
          const durations = this.benchmarkResults.map(r => r.duration);

          const avgThroughput = throughputs.reduce((sum, t) => sum + t, 0) / throughputs.length;
          const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;

          const minThroughput = Math.min(...throughputs);
          const maxThroughput = Math.max(...throughputs);

          // Calculate standard deviation
          const throughputVariance = throughputs.reduce((sum, t) => sum + Math.pow(t - avgThroughput, 2), 0) / throughputs.length;
          const throughputStdDev = Math.sqrt(throughputVariance);

          return {
            totalBenchmarks: this.benchmarkResults.length,
            averageThroughput: avgThroughput,
            averageDuration: avgDuration,
            minThroughput,
            maxThroughput,
            throughputStdDev,
            variabilityCoefficient: throughputStdDev / avgThroughput, // Lower is more consistent
          };
        }

        reset() {
          this.benchmarkResults = [];
        }
      }

      const executor = new BenchmarkExecutor();

      const operations = [
        'json_parse_stringify',
        'array_operations',
        'string_operations',
        'object_creation',
        'default',
      ];

      const results: MockToolResponse[] = [];

      for (const operation of operations) {
        vi.advanceTimersByTime(100);
        const result = await executor.execute({
          operation,
          iterations: 1000,
        });
        results.push(result);
      }

      // Verify all benchmarks completed
      expect(results).toHaveLength(operations.length);
      expect(results.every(r => r.success)).toBe(true);

      // Check benchmark results
      results.forEach((result, index) => {
        const benchmark = result.metadata?.benchmark;
        expect(benchmark.operation).toBe(operations[index]);
        expect(benchmark.throughput).toBeGreaterThan(0);
        expect(benchmark.duration).toBeGreaterThan(0);
      });

      // Verify statistics
      const finalStats = results[results.length - 1].metadata?.statistics;
      expect(finalStats?.totalBenchmarks).toBe(operations.length);
      expect(finalStats?.averageThroughput).toBeGreaterThan(0);
      expect(finalStats?.variabilityCoefficient).toBeGreaterThanOrEqual(0);
    });

    it('should detect performance regressions across runs', async () => {
      class RegressionTrackingExecutor implements MockToolExecutor {
        private performanceHistory: Array<{
          run: number;
          throughput: number;
          duration: number;
          timestamp: number;
        }> = [];

        private currentRun = 0;

        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          this.currentRun++;
          const workload = (params.workload as number) || 1000;

          // Simulate performance degradation over time
          const degradationFactor = Math.max(1, this.currentRun * 0.05); // 5% slower each run
          const baseProcessingTime = 1; // 1ms per item
          const actualProcessingTime = baseProcessingTime * degradationFactor;

          const startTime = process.hrtime.bigint();

          // Simulate work
          for (let i = 0; i < workload; i++) {
            // Simulate CPU work that gets slower over time
            const iterations = Math.floor(actualProcessingTime * 100);
            for (let j = 0; j < iterations; j++) {
              Math.random();
            }
          }

          const endTime = process.hrtime.bigint();
          const duration = Number(endTime - startTime) / 1_000_000;
          const throughput = workload / (duration / 1000);

          this.performanceHistory.push({
            run: this.currentRun,
            throughput,
            duration,
            timestamp: Date.now(),
          });

          const regressionAnalysis = this.analyzeRegression();

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Run ${this.currentRun} completed: ${throughput.toFixed(2)} ops/sec`,
              },
            ],
            metadata: {
              run: this.currentRun,
              throughput,
              duration,
              workload,
              regressionAnalysis,
              performanceHistory: this.performanceHistory,
            },
          };
        }

        private analyzeRegression() {
          if (this.performanceHistory.length < 3) {
            return { hasRegression: false, confidence: 'insufficient_data' };
          }

          // Compare recent performance with baseline
          const baseline = this.performanceHistory.slice(0, 3);
          const recent = this.performanceHistory.slice(-3);

          const baselineAvg = baseline.reduce((sum, h) => sum + h.throughput, 0) / baseline.length;
          const recentAvg = recent.reduce((sum, h) => sum + h.throughput, 0) / recent.length;

          const performanceDelta = (recentAvg - baselineAvg) / baselineAvg;
          const hasRegression = performanceDelta < -0.1; // 10% slower

          // Calculate trend
          const throughputs = this.performanceHistory.map(h => h.throughput);
          const trend = this.calculateTrend(throughputs);

          return {
            hasRegression,
            performanceDelta,
            baselineAverage: baselineAvg,
            recentAverage: recentAvg,
            trend,
            confidence: this.performanceHistory.length >= 10 ? 'high' : 'medium',
            totalRuns: this.performanceHistory.length,
          };
        }

        private calculateTrend(values: number[]): 'improving' | 'stable' | 'degrading' {
          if (values.length < 5) return 'stable';

          const recent = values.slice(-5);
          const older = values.slice(-10, -5);

          const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
          const olderAvg = older.reduce((sum, v) => sum + v, 0) / older.length;

          const change = (recentAvg - olderAvg) / olderAvg;

          if (change > 0.05) return 'improving';
          if (change < -0.05) return 'degrading';
          return 'stable';
        }

        reset() {
          this.performanceHistory = [];
          this.currentRun = 0;
        }
      }

      const executor = new RegressionTrackingExecutor();

      // Run multiple times to build performance history
      const results: MockToolResponse[] = [];
      for (let i = 0; i < 12; i++) {
        vi.advanceTimersByTime(10);
        const result = await executor.execute({ workload: 500 });
        results.push(result);
      }

      // Verify regression detection
      const lastResult = results[results.length - 1];
      const regressionAnalysis = lastResult.metadata?.regressionAnalysis;

      expect(regressionAnalysis.hasRegression).toBe(true);
      expect(regressionAnalysis.trend).toBe('degrading');
      expect(regressionAnalysis.performanceDelta).toBeLessThan(-0.1);
      expect(regressionAnalysis.confidence).toBe('high');

      // Verify throughput degraded over time
      const firstRun = results[0].metadata?.throughput;
      const lastRun = results[results.length - 1].metadata?.throughput;
      expect(lastRun).toBeLessThan(firstRun);
    });
  });
});