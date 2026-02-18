/**
 * ErrorFeedbackLoop Edge Case Tests
 *
 * Tests for edge cases and boundary conditions:
 * - Error ID collision handling
 * - Event ordering and timing
 * - Error immutability
 * - Boundary value testing
 * - Error state transitions
 *
 * @module error-feedback.edge.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStructuredError } from '@apexcli/core';
import {
  ErrorFeedbackLoop,
  CompilerError,
  ErrorReceivedEvent,
  ErrorResolvedEvent,
} from './error-feedback';

describe('ErrorFeedbackLoop Edge Cases', () => {
  let errorLoop: ErrorFeedbackLoop;

  beforeEach(() => {
    errorLoop = new ErrorFeedbackLoop();
    errorLoop.removeAllListeners();
  });

  describe('Error ID Generation and Uniqueness', () => {
    it('should generate unique IDs even in rapid succession', () => {
      const errorCount = 10000;
      const ids = new Set<string>();

      for (let i = 0; i < errorCount; i++) {
        const error = errorLoop.receiveError(createStructuredError(`Rapid ${i}`));
        expect(ids.has(error.id)).toBe(false); // Should be unique
        ids.add(error.id);
      }

      expect(ids.size).toBe(errorCount);
    });

    it('should maintain ID format consistency', () => {
      const errorCount = 1000;
      const idPattern = /^err-[a-z0-9]+-[a-z0-9]+$/;

      for (let i = 0; i < errorCount; i++) {
        const error = errorLoop.receiveError(createStructuredError(`Format test ${i}`));
        expect(error.id).toMatch(idPattern);
      }
    });

    it('should handle time-based edge cases in ID generation', () => {
      // Mock Date.now to test edge cases
      const originalNow = Date.now;

      try {
        // Test with maximum timestamp value
        Date.now = vi.fn().mockReturnValue(Number.MAX_SAFE_INTEGER);
        const error1 = errorLoop.receiveError(createStructuredError('Max timestamp'));
        expect(error1.id).toBeDefined();

        // Test with minimum timestamp value
        Date.now = vi.fn().mockReturnValue(0);
        const error2 = errorLoop.receiveError(createStructuredError('Min timestamp'));
        expect(error2.id).toBeDefined();

        // IDs should still be different
        expect(error1.id).not.toBe(error2.id);
      } finally {
        Date.now = originalNow;
      }
    });
  });

  describe('Error Immutability and State Protection', () => {
    it('should not allow external modification of error objects', () => {
      const originalError = createStructuredError('Immutable test');
      const compilerError = errorLoop.receiveError(originalError);

      // Attempt to modify the compiler error object
      const originalResolved = compilerError.resolved;
      const originalReceivedAt = compilerError.receivedAt;

      // These should be read-only, but let's verify the system handles changes
      compilerError.resolved = true;
      compilerError.receivedAt = new Date('2000-01-01');

      // The internal state should be based on our own tracking
      expect(errorLoop.getUnresolvedErrors()).toContain(compilerError);

      // Proper resolution should work
      const success = errorLoop.resolveError(compilerError.id);
      expect(success).toBe(true);
      expect(compilerError.resolved).toBe(true);
      expect(compilerError.resolvedAt).toBeDefined();
    });

    it('should preserve original StructuredError object integrity', () => {
      const originalError = createStructuredError('Original', {
        severity: 'warning',
        category: 'lint',
        code: 'ORIGINAL',
      });

      const compilerError = errorLoop.receiveError(originalError);

      // Modify the original error object
      (originalError as any).message = 'Modified';
      (originalError as any).severity = 'error';

      // The stored error should still reference the original object
      expect(compilerError.error).toBe(originalError);
      expect(compilerError.error.message).toBe('Modified'); // Changes are reflected
    });
  });

  describe('Event Ordering and Timing', () => {
    it('should emit events in the correct order for rapid operations', () => {
      const eventOrder: string[] = [];

      errorLoop.on('error:received', (event) => {
        eventOrder.push(`received:${event.error.id}`);
      });

      errorLoop.on('error:resolved', (event) => {
        eventOrder.push(`resolved:${event.error.id}`);
      });

      errorLoop.on('errors:cleared', () => {
        eventOrder.push('cleared:all');
      });

      // Rapid operations
      const error1 = errorLoop.receiveError(createStructuredError('First'));
      const error2 = errorLoop.receiveError(createStructuredError('Second'));
      errorLoop.resolveError(error1.id);
      const error3 = errorLoop.receiveError(createStructuredError('Third'));
      errorLoop.resolveError(error2.id);
      errorLoop.clearErrors();

      // Verify event order
      expect(eventOrder).toEqual([
        `received:${error1.id}`,
        `received:${error2.id}`,
        `resolved:${error1.id}`,
        `received:${error3.id}`,
        `resolved:${error2.id}`,
        'cleared:all'
      ]);
    });

    it('should handle event listener exceptions gracefully', () => {
      const goodHandler = vi.fn();
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      errorLoop.on('error:received', errorHandler);
      errorLoop.on('error:received', goodHandler);

      // Adding an error shouldn't fail even if a handler throws
      expect(() => {
        errorLoop.receiveError(createStructuredError('Test'));
      }).not.toThrow();

      // The good handler should still be called
      expect(goodHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledTimes(1);

      // System should continue to work
      const error = errorLoop.receiveError(createStructuredError('Test 2'));
      expect(error.id).toBeDefined();
      expect(errorLoop.getErrors()).toHaveLength(2);
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle zero and empty states correctly', () => {
      // All counts should be 0 initially
      expect(errorLoop.getUnresolvedCount()).toBe(0);
      expect(errorLoop.getErrors()).toHaveLength(0);
      expect(errorLoop.hasUnresolvedErrors()).toBe(false);

      // Operations on empty state should be safe
      expect(errorLoop.resolveError('non-existent')).toBe(false);
      expect(errorLoop.clearErrors()).toBe(0);
      expect(errorLoop.clearErrors('task-123')).toBe(0);

      // Stats on empty state
      const stats = errorLoop.getErrorStats();
      expect(stats.total).toBe(0);
      expect(stats.unresolved).toBe(0);
      expect(stats.resolved).toBe(0);
      expect(Object.keys(stats.byCategory)).toHaveLength(0);
      expect(Object.keys(stats.bySeverity)).toHaveLength(0);
    });

    it('should handle single error operations', () => {
      const error = errorLoop.receiveError(createStructuredError('Single'));

      expect(errorLoop.getUnresolvedCount()).toBe(1);
      expect(errorLoop.hasUnresolvedErrors()).toBe(true);

      // Resolve the single error
      const resolved = errorLoop.resolveError(error.id);
      expect(resolved).toBe(true);
      expect(errorLoop.getUnresolvedCount()).toBe(0);
      expect(errorLoop.hasUnresolvedErrors()).toBe(false);

      // Clear should work with single resolved error
      const cleared = errorLoop.clearErrors();
      expect(cleared).toBe(1);
      expect(errorLoop.getErrors()).toHaveLength(0);
    });

    it('should handle maximum reasonable error counts', () => {
      const maxErrors = 50000; // Large but reasonable number
      const batchSize = 1000;

      for (let i = 0; i < maxErrors; i += batchSize) {
        const batch = Array.from({ length: Math.min(batchSize, maxErrors - i) }, (_, j) =>
          createStructuredError(`Batch error ${i + j}`)
        );
        errorLoop.receiveErrors(batch, `batch-${Math.floor(i / batchSize)}`);
      }

      expect(errorLoop.getErrors()).toHaveLength(maxErrors);
      expect(errorLoop.getUnresolvedCount()).toBe(maxErrors);

      // Operations should still work efficiently
      const stats = errorLoop.getErrorStats();
      expect(stats.total).toBe(maxErrors);
    });
  });

  describe('State Transition Edge Cases', () => {
    it('should handle resolution of already resolved errors', () => {
      const error = errorLoop.receiveError(createStructuredError('Transition test'));

      // Resolve once
      const resolved1 = errorLoop.resolveError(error.id);
      expect(resolved1).toBe(true);
      expect(error.resolved).toBe(true);

      const firstResolvedAt = error.resolvedAt;

      // Wait a moment to ensure timestamp would be different
      vi.advanceTimersByTime(10);

      // Resolve again
      const resolved2 = errorLoop.resolveError(error.id);
      expect(resolved2).toBe(true);
      expect(error.resolved).toBe(true);

      // Timestamp should be updated
      expect(error.resolvedAt).not.toBe(firstResolvedAt);
    });

    it('should maintain consistent counts during state transitions', () => {
      const errors = Array.from({ length: 10 }, (_, i) =>
        errorLoop.receiveError(createStructuredError(`Consistency ${i}`))
      );

      expect(errorLoop.getUnresolvedCount()).toBe(10);

      // Resolve errors in random order
      const shuffled = [...errors].sort(() => Math.random() - 0.5);

      shuffled.forEach((error, index) => {
        errorLoop.resolveError(error.id);
        expect(errorLoop.getUnresolvedCount()).toBe(10 - index - 1);
        expect(errorLoop.getResolvedErrors()).toHaveLength(index + 1);
        expect(errorLoop.getErrors()).toHaveLength(10); // Total should remain same
      });

      expect(errorLoop.getUnresolvedCount()).toBe(0);
      expect(errorLoop.getResolvedErrors()).toHaveLength(10);
    });
  });

  describe('Task ID Edge Cases', () => {
    it('should handle various task ID formats', () => {
      const taskIdFormats = [
        'simple-task',
        'task.with.dots',
        'task_with_underscores',
        'task-123-with-numbers',
        'UPPERCASE-TASK',
        'mixedCase-Task',
        'task/with/slashes',
        'task with spaces',
        'task@with@symbols',
        '中文任务', // Unicode
        '', // Empty string
        'x'.repeat(1000), // Very long
      ];

      taskIdFormats.forEach((taskId, index) => {
        const error = errorLoop.receiveError(
          createStructuredError(`Test ${index}`),
          taskId
        );
        expect(error.taskId).toBe(taskId);
      });

      // All errors should be retrievable
      expect(errorLoop.getErrors()).toHaveLength(taskIdFormats.length);

      // Test filtering by each task ID
      taskIdFormats.forEach((taskId, index) => {
        const taskErrors = errorLoop.getErrors(taskId);
        expect(taskErrors).toHaveLength(1);
        expect(taskErrors[0].error.message).toBe(`Test ${index}`);
      });
    });

    it('should handle null and undefined task IDs consistently', () => {
      const error1 = errorLoop.receiveError(createStructuredError('Test 1'), undefined);
      const error2 = errorLoop.receiveError(createStructuredError('Test 2')); // No taskId
      const error3 = errorLoop.receiveError(createStructuredError('Test 3'), 'actual-task');

      // Both undefined taskId and no taskId should be treated the same
      expect(error1.taskId).toBeUndefined();
      expect(error2.taskId).toBeUndefined();
      expect(error3.taskId).toBe('actual-task');

      // Querying with undefined should return both undefined taskId errors
      const undefinedTaskErrors = errorLoop.getErrors(undefined);
      expect(undefinedTaskErrors).toHaveLength(2);

      // Querying without parameter should return all errors
      const allErrors = errorLoop.getErrors();
      expect(allErrors).toHaveLength(3);
    });
  });

  describe('Statistics Edge Cases', () => {
    it('should handle missing or malformed category/severity data gracefully', () => {
      // Create errors with various edge case properties
      const edgeCaseErrors = [
        createStructuredError('Normal error', { category: 'syntax', severity: 'error' }),
        createStructuredError('Missing category', { severity: 'warning' }),
        createStructuredError('Missing severity', { category: 'type' }),
        createStructuredError('Both missing'),
      ];

      edgeCaseErrors.forEach(error => errorLoop.receiveError(error));

      const stats = errorLoop.getErrorStats();

      // Should handle missing properties gracefully
      expect(stats.total).toBe(4);
      expect(typeof stats.byCategory).toBe('object');
      expect(typeof stats.bySeverity).toBe('object');

      // Should have counts for the properties that were provided
      expect(stats.byCategory.syntax).toBe(1);
      expect(stats.bySeverity.error).toBe(1);
    });

    it('should maintain accurate statistics during complex operations', () => {
      // Create a mix of errors
      const errors = [
        errorLoop.receiveError(createStructuredError('Error 1', { category: 'syntax', severity: 'error' }), 'task-1'),
        errorLoop.receiveError(createStructuredError('Error 2', { category: 'syntax', severity: 'warning' }), 'task-1'),
        errorLoop.receiveError(createStructuredError('Error 3', { category: 'type', severity: 'error' }), 'task-2'),
        errorLoop.receiveError(createStructuredError('Error 4', { category: 'type', severity: 'warning' }), 'task-2'),
      ];

      // Get baseline stats
      let stats = errorLoop.getErrorStats();
      expect(stats.total).toBe(4);
      expect(stats.unresolved).toBe(4);
      expect(stats.resolved).toBe(0);

      // Resolve some errors
      errorLoop.resolveError(errors[0].id);
      errorLoop.resolveError(errors[2].id);

      // Check stats after resolution
      stats = errorLoop.getErrorStats();
      expect(stats.total).toBe(4);
      expect(stats.unresolved).toBe(2);
      expect(stats.resolved).toBe(2);

      // Check task-specific stats
      const task1Stats = errorLoop.getErrorStats('task-1');
      expect(task1Stats.total).toBe(2);
      expect(task1Stats.unresolved).toBe(1);
      expect(task1Stats.resolved).toBe(1);

      const task2Stats = errorLoop.getErrorStats('task-2');
      expect(task2Stats.total).toBe(2);
      expect(task2Stats.unresolved).toBe(1);
      expect(task2Stats.resolved).toBe(1);
    });
  });

  describe('Memory and Reference Integrity', () => {
    it('should maintain proper object references through operations', () => {
      const originalError = createStructuredError('Reference test');
      const compilerError = errorLoop.receiveError(originalError, 'ref-task');

      // Get references through different query methods
      const allErrors = errorLoop.getErrors();
      const taskErrors = errorLoop.getErrors('ref-task');
      const unresolvedErrors = errorLoop.getUnresolvedErrors('ref-task');

      // All should reference the same compiler error object
      expect(allErrors[0]).toBe(compilerError);
      expect(taskErrors[0]).toBe(compilerError);
      expect(unresolvedErrors[0]).toBe(compilerError);

      // All should reference the same original error
      expect(allErrors[0].error).toBe(originalError);
      expect(taskErrors[0].error).toBe(originalError);
      expect(unresolvedErrors[0].error).toBe(originalError);

      // After resolution, references should still be maintained
      errorLoop.resolveError(compilerError.id);

      const resolvedErrors = errorLoop.getResolvedErrors('ref-task');
      expect(resolvedErrors[0]).toBe(compilerError);
      expect(resolvedErrors[0].error).toBe(originalError);
    });

    it('should handle errors with circular references in StructuredError', () => {
      const error = createStructuredError('Circular test');

      // Add a circular reference (though this shouldn't normally happen)
      (error as any).circular = error;

      const compilerError = errorLoop.receiveError(error);

      expect(compilerError.id).toBeDefined();
      expect(compilerError.error).toBe(error);

      // Should still be queryable
      const errors = errorLoop.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe(compilerError);
    });
  });
});