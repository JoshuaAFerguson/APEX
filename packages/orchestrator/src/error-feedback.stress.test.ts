/**
 * ErrorFeedbackLoop Stress and Performance Tests
 *
 * Tests for high-volume scenarios, memory usage, and performance characteristics:
 * - High-volume error processing
 * - Memory leak detection
 * - Event listener management
 * - Large data set handling
 * - Concurrent operations
 *
 * @module error-feedback.stress.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStructuredError } from '@apexcli/core';
import {
  ErrorFeedbackLoop,
  CompilerError,
  ErrorReceivedEvent,
  ErrorResolvedEvent,
  ErrorsClearedEvent,
} from './error-feedback';

describe('ErrorFeedbackLoop Stress and Performance Tests', () => {
  let errorLoop: ErrorFeedbackLoop;
  let performanceTimings: number[] = [];

  beforeEach(() => {
    errorLoop = new ErrorFeedbackLoop();
    performanceTimings = [];
  });

  afterEach(() => {
    errorLoop.removeAllListeners();
    errorLoop.clearErrors();
  });

  describe('High-Volume Error Processing', () => {
    it('should handle 1000 errors efficiently', () => {
      const startTime = performance.now();
      const errorCount = 1000;
      const errors: CompilerError[] = [];

      // Generate 1000 different errors
      for (let i = 0; i < errorCount; i++) {
        const error = errorLoop.receiveError(
          createStructuredError(`Error ${i}`, {
            severity: i % 2 === 0 ? 'error' : 'warning',
            category: i % 3 === 0 ? 'syntax' : i % 3 === 1 ? 'type' : 'lint',
            code: `E${String(i).padStart(4, '0')}`,
          }),
          `task-${Math.floor(i / 100)}`
        );
        errors.push(error);
      }

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(errorLoop.getErrors()).toHaveLength(errorCount);
      expect(errorLoop.getUnresolvedCount()).toBe(errorCount);
      expect(processingTime).toBeLessThan(1000); // Should complete within 1 second

      // Verify performance statistics
      const stats = errorLoop.getErrorStats();
      expect(stats.total).toBe(errorCount);
      expect(Object.keys(stats.byCategory)).toContain('syntax');
      expect(Object.keys(stats.byCategory)).toContain('type');
      expect(Object.keys(stats.byCategory)).toContain('lint');
    });

    it('should handle rapid error resolution efficiently', () => {
      const errorCount = 500;
      const errors: CompilerError[] = [];

      // Add errors
      for (let i = 0; i < errorCount; i++) {
        const error = errorLoop.receiveError(
          createStructuredError(`Error ${i}`),
          `task-${i % 10}`
        );
        errors.push(error);
      }

      const startTime = performance.now();

      // Resolve all errors
      for (const error of errors) {
        errorLoop.resolveError(error.id);
      }

      const endTime = performance.now();
      const resolutionTime = endTime - startTime;

      expect(errorLoop.getUnresolvedCount()).toBe(0);
      expect(errorLoop.getResolvedErrors()).toHaveLength(errorCount);
      expect(resolutionTime).toBeLessThan(500); // Should complete within 500ms
    });

    it('should handle bulk error operations efficiently', () => {
      const batchSize = 100;
      const batches = 10;

      for (let batch = 0; batch < batches; batch++) {
        const batchErrors = Array.from({ length: batchSize }, (_, i) =>
          createStructuredError(`Batch ${batch} Error ${i}`)
        );

        const startTime = performance.now();
        errorLoop.receiveErrors(batchErrors, `batch-task-${batch}`);
        const endTime = performance.now();

        performanceTimings.push(endTime - startTime);
      }

      expect(errorLoop.getErrors()).toHaveLength(batchSize * batches);

      // Performance should be consistent across batches
      const avgTime = performanceTimings.reduce((a, b) => a + b, 0) / performanceTimings.length;
      const maxTime = Math.max(...performanceTimings);

      expect(maxTime).toBeLessThan(avgTime * 3); // Max time shouldn't be 3x average
      expect(avgTime).toBeLessThan(100); // Average should be under 100ms per batch
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory with many event listeners', () => {
      const listenerCount = 100;
      const handlers: Array<() => void> = [];

      // Add many event listeners
      for (let i = 0; i < listenerCount; i++) {
        const handler = vi.fn();
        handlers.push(handler);
        errorLoop.on('error:received', handler);
      }

      // Add some errors to trigger events
      for (let i = 0; i < 10; i++) {
        errorLoop.receiveError(createStructuredError(`Test ${i}`));
      }

      // Verify all handlers were called
      handlers.forEach(handler => {
        expect(handler).toHaveBeenCalledTimes(10);
      });

      // Remove listeners
      handlers.forEach(handler => {
        errorLoop.off('error:received', handler);
      });

      // Verify listeners were removed by adding another error
      errorLoop.receiveError(createStructuredError('Final test'));

      // Original handlers should not be called again
      handlers.forEach(handler => {
        expect(handler).toHaveBeenCalledTimes(10); // Still 10, not 11
      });
    });

    it('should handle large error messages efficiently', () => {
      const largeMessage = 'Large error message: ' + 'x'.repeat(10000); // 10KB message
      const errorCount = 50;

      const startTime = performance.now();

      for (let i = 0; i < errorCount; i++) {
        errorLoop.receiveError(
          createStructuredError(largeMessage + ` ${i}`, {
            rawText: 'y'.repeat(5000), // Additional large field
            stack: 'z'.repeat(2000),   // Large stack trace
          })
        );
      }

      const endTime = performance.now();

      expect(errorLoop.getErrors()).toHaveLength(errorCount);
      expect(endTime - startTime).toBeLessThan(1000); // Should handle large messages efficiently
    });

    it('should clear large numbers of errors efficiently', () => {
      const errorCount = 2000;
      const taskCount = 20;

      // Add errors across multiple tasks
      for (let i = 0; i < errorCount; i++) {
        errorLoop.receiveError(
          createStructuredError(`Error ${i}`),
          `task-${i % taskCount}`
        );
      }

      expect(errorLoop.getErrors()).toHaveLength(errorCount);

      // Clear by task
      const startTime = performance.now();
      for (let taskId = 0; taskId < taskCount; taskId++) {
        const cleared = errorLoop.clearErrors(`task-${taskId}`);
        expect(cleared).toBe(errorCount / taskCount);
      }
      const endTime = performance.now();

      expect(errorLoop.getErrors()).toHaveLength(0);
      expect(endTime - startTime).toBeLessThan(500); // Clearing should be fast
    });
  });

  describe('Concurrent Operation Simulation', () => {
    it('should handle simultaneous error addition and resolution', () => {
      const eventHandler = vi.fn();
      errorLoop.on('error:received', eventHandler);

      // Simulate concurrent operations
      const errors: CompilerError[] = [];

      // Add errors while resolving others
      for (let i = 0; i < 100; i++) {
        const error = errorLoop.receiveError(
          createStructuredError(`Concurrent error ${i}`)
        );
        errors.push(error);

        // Resolve every third error immediately
        if (i % 3 === 0 && i > 0) {
          errorLoop.resolveError(errors[i - 3].id);
        }
      }

      const unresolvedCount = errorLoop.getUnresolvedCount();
      const resolvedCount = errorLoop.getResolvedErrors().length;

      expect(unresolvedCount + resolvedCount).toBe(100);
      expect(eventHandler).toHaveBeenCalledTimes(100);
    });

    it('should maintain consistency during rapid operations', () => {
      const operations = 1000;
      let expectedUnresolved = 0;

      for (let i = 0; i < operations; i++) {
        if (i % 2 === 0) {
          // Add error
          errorLoop.receiveError(createStructuredError(`Op ${i}`));
          expectedUnresolved++;
        } else if (expectedUnresolved > 0) {
          // Resolve random error
          const errors = errorLoop.getUnresolvedErrors();
          if (errors.length > 0) {
            const randomError = errors[Math.floor(Math.random() * errors.length)];
            errorLoop.resolveError(randomError.id);
            expectedUnresolved--;
          }
        }

        // Verify consistency at random intervals
        if (i % 100 === 0) {
          const actualUnresolved = errorLoop.getUnresolvedCount();
          expect(actualUnresolved).toBe(expectedUnresolved);
        }
      }
    });
  });

  describe('Edge Case Stress Testing', () => {
    it('should handle errors with complex structured data', () => {
      const complexErrors = Array.from({ length: 100 }, (_, i) =>
        createStructuredError(`Complex error ${i}`, {
          severity: ['error', 'warning', 'info', 'hint'][i % 4] as any,
          category: ['syntax', 'type', 'lint', 'test', 'runtime'][i % 5] as any,
          code: `COMPLEX_${i}`,
          location: {
            filePath: `/path/to/file${i % 10}.ts`,
            line: i + 1,
            column: (i * 3) % 80,
            length: i % 20,
          },
          context: {
            tool: 'test-tool',
            timestamp: new Date().toISOString(),
            environment: 'test',
          },
          relatedErrors: i > 0 ? [`error-${i - 1}`] : undefined,
          suggestion: `Consider fixing issue ${i}`,
          helpUrl: `https://docs.example.com/error/${i}`,
          rawText: `Raw output for error ${i}`,
          stack: `Stack trace line 1\nStack trace line 2\nAt function ${i}`,
        })
      );

      const startTime = performance.now();
      const compilerErrors = errorLoop.receiveErrors(complexErrors, 'complex-task');
      const endTime = performance.now();

      expect(compilerErrors).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(500);

      // Verify complex data is preserved
      const stats = errorLoop.getErrorStats('complex-task');
      expect(stats.bySeverity.error).toBeGreaterThan(0);
      expect(stats.bySeverity.warning).toBeGreaterThan(0);
      expect(stats.byCategory.syntax).toBeGreaterThan(0);
      expect(stats.byCategory.type).toBeGreaterThan(0);
    });

    it('should handle rapid event listener changes during processing', () => {
      let receivedCount = 0;
      let resolvedCount = 0;
      let clearedCount = 0;

      // Start with initial listeners
      const initialReceivedHandler = () => receivedCount++;
      const initialResolvedHandler = () => resolvedCount++;
      const initialClearedHandler = () => clearedCount++;

      errorLoop.on('error:received', initialReceivedHandler);
      errorLoop.on('error:resolved', initialResolvedHandler);
      errorLoop.on('errors:cleared', initialClearedHandler);

      // Process errors while changing listeners
      const errors: CompilerError[] = [];

      for (let i = 0; i < 50; i++) {
        const error = errorLoop.receiveError(createStructuredError(`Dynamic ${i}`));
        errors.push(error);

        // Change listeners partway through
        if (i === 25) {
          errorLoop.removeAllListeners();

          const newReceivedHandler = () => receivedCount += 2; // Different behavior
          errorLoop.on('error:received', newReceivedHandler);
        }
      }

      // Resolve some errors
      for (let i = 0; i < 10; i++) {
        errorLoop.resolveError(errors[i].id);
      }

      // Clear remaining errors
      errorLoop.clearErrors();

      // Verify state consistency despite listener changes
      expect(errorLoop.getErrors()).toHaveLength(0);
      expect(receivedCount).toBeGreaterThan(25); // At least initial 25 + some from new handler
    });

    it('should handle malformed or extreme data gracefully', () => {
      // Test with various edge case inputs that shouldn't break the system
      const edgeCaseInputs = [
        '', // Empty string
        'x'.repeat(100000), // Very long string
        '🚀'.repeat(1000), // Unicode characters
        '\n'.repeat(500), // Many newlines
        '\t'.repeat(500), // Many tabs
        '\\'.repeat(1000), // Escape characters
      ];

      for (const input of edgeCaseInputs) {
        const error = errorLoop.receiveError(createStructuredError(input));
        expect(error.id).toBeDefined();
        expect(error.error.message).toBe(input);
      }

      expect(errorLoop.getErrors()).toHaveLength(edgeCaseInputs.length);
    });
  });

  describe('Performance Benchmarking', () => {
    it('should maintain acceptable performance across different scales', () => {
      const scales = [10, 100, 1000];
      const timingsByScale: Record<number, number> = {};

      for (const scale of scales) {
        const startTime = performance.now();

        // Add errors
        for (let i = 0; i < scale; i++) {
          errorLoop.receiveError(createStructuredError(`Scale ${scale} Error ${i}`));
        }

        // Query operations
        errorLoop.getErrors();
        errorLoop.getUnresolvedErrors();
        errorLoop.getErrorStats();

        // Clear errors
        errorLoop.clearErrors();

        const endTime = performance.now();
        timingsByScale[scale] = endTime - startTime;
      }

      // Performance should scale reasonably (not exponentially)
      // 1000 errors should take less than 100x the time of 10 errors
      const ratio1000to10 = timingsByScale[1000] / timingsByScale[10];
      expect(ratio1000to10).toBeLessThan(100);

      // All operations should complete within reasonable time
      Object.values(timingsByScale).forEach(time => {
        expect(time).toBeLessThan(2000); // 2 seconds max
      });
    });
  });
});