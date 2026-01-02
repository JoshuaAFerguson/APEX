/**
 * ErrorFeedbackLoop Unit Tests
 *
 * Tests for the ErrorFeedbackLoop class covering:
 * - Error reception and event emission
 * - In-memory storage and querying
 * - Error resolution and clearing
 * - Event payloads and timing
 *
 * @module error-feedback.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStructuredError } from '@apexcli/core';
import {
  ErrorFeedbackLoop,
  CompilerError,
  ErrorReceivedEvent,
  ErrorResolvedEvent,
  ErrorsClearedEvent,
} from './error-feedback';

describe('ErrorFeedbackLoop', () => {
  let errorLoop: ErrorFeedbackLoop;

  beforeEach(() => {
    errorLoop = new ErrorFeedbackLoop();
    // Clear any listeners and reset state
    errorLoop.removeAllListeners();
  });

  describe('Error Reception', () => {
    it('should receive a single error and store it in memory', () => {
      const structuredError = createStructuredError('Test error message', {
        severity: 'error',
        category: 'syntax',
        code: 'TS2339',
      });

      const compilerError = errorLoop.receiveError(structuredError, 'task-123');

      expect(compilerError.id).toBeDefined();
      expect(compilerError.error).toBe(structuredError);
      expect(compilerError.taskId).toBe('task-123');
      expect(compilerError.resolved).toBe(false);
      expect(compilerError.receivedAt).toBeInstanceOf(Date);
      expect(compilerError.resolvedAt).toBeUndefined();
    });

    it('should receive an error without taskId', () => {
      const structuredError = createStructuredError('Test error');

      const compilerError = errorLoop.receiveError(structuredError);

      expect(compilerError.taskId).toBeUndefined();
      expect(compilerError.error).toBe(structuredError);
      expect(compilerError.resolved).toBe(false);
    });

    it('should receive multiple errors at once', () => {
      const errors = [
        createStructuredError('Error 1'),
        createStructuredError('Error 2'),
        createStructuredError('Error 3'),
      ];

      const compilerErrors = errorLoop.receiveErrors(errors, 'task-456');

      expect(compilerErrors).toHaveLength(3);
      expect(compilerErrors[0].error.message).toBe('Error 1');
      expect(compilerErrors[1].error.message).toBe('Error 2');
      expect(compilerErrors[2].error.message).toBe('Error 3');
      expect(compilerErrors.every(e => e.taskId === 'task-456')).toBe(true);
      expect(compilerErrors.every(e => !e.resolved)).toBe(true);
    });

    it('should generate unique IDs for each error', () => {
      const error1 = errorLoop.receiveError(createStructuredError('Error 1'));
      const error2 = errorLoop.receiveError(createStructuredError('Error 2'));

      expect(error1.id).not.toBe(error2.id);
      expect(error1.id).toMatch(/^err-[a-z0-9]+-[a-z0-9]+$/);
      expect(error2.id).toMatch(/^err-[a-z0-9]+-[a-z0-9]+$/);
    });
  });

  describe('Event Emission', () => {
    it('should emit error:received event when receiving an error', () => {
      const eventHandler = vi.fn();
      errorLoop.on('error:received', eventHandler);

      const structuredError = createStructuredError('Test error', {
        severity: 'warning',
        category: 'lint',
      });

      const compilerError = errorLoop.receiveError(structuredError, 'task-123');

      expect(eventHandler).toHaveBeenCalledTimes(1);
      const event: ErrorReceivedEvent = eventHandler.mock.calls[0][0];

      expect(event.error).toBe(compilerError);
      expect(event.unresolvedCount).toBe(1);
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should emit error:received events for each error in receiveErrors', () => {
      const eventHandler = vi.fn();
      errorLoop.on('error:received', eventHandler);

      const errors = [
        createStructuredError('Error 1'),
        createStructuredError('Error 2'),
      ];

      errorLoop.receiveErrors(errors);

      expect(eventHandler).toHaveBeenCalledTimes(2);
      expect(eventHandler.mock.calls[0][0].unresolvedCount).toBe(1);
      expect(eventHandler.mock.calls[1][0].unresolvedCount).toBe(2);
    });

    it('should emit error:resolved event when resolving an error', () => {
      const receivedHandler = vi.fn();
      const resolvedHandler = vi.fn();

      errorLoop.on('error:received', receivedHandler);
      errorLoop.on('error:resolved', resolvedHandler);

      const compilerError = errorLoop.receiveError(
        createStructuredError('Test error'),
        'task-123'
      );

      const resolved = errorLoop.resolveError(compilerError.id);

      expect(resolved).toBe(true);
      expect(resolvedHandler).toHaveBeenCalledTimes(1);

      const event: ErrorResolvedEvent = resolvedHandler.mock.calls[0][0];
      expect(event.error.id).toBe(compilerError.id);
      expect(event.error.resolved).toBe(true);
      expect(event.error.resolvedAt).toBeInstanceOf(Date);
      expect(event.remainingCount).toBe(0);
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should emit errors:cleared event when clearing errors', () => {
      const clearedHandler = vi.fn();
      errorLoop.on('errors:cleared', clearedHandler);

      // Add some errors
      errorLoop.receiveError(createStructuredError('Error 1'), 'task-123');
      errorLoop.receiveError(createStructuredError('Error 2'), 'task-123');
      errorLoop.receiveError(createStructuredError('Error 3'), 'task-456');

      // Clear errors for task-123
      const clearedCount = errorLoop.clearErrors('task-123');

      expect(clearedCount).toBe(2);
      expect(clearedHandler).toHaveBeenCalledTimes(1);

      const event: ErrorsClearedEvent = clearedHandler.mock.calls[0][0];
      expect(event.clearedCount).toBe(2);
      expect(event.taskId).toBe('task-123');
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should not emit errors:cleared event when no errors are cleared', () => {
      const clearedHandler = vi.fn();
      errorLoop.on('errors:cleared', clearedHandler);

      // Try to clear errors for non-existent task
      const clearedCount = errorLoop.clearErrors('non-existent-task');

      expect(clearedCount).toBe(0);
      expect(clearedHandler).not.toHaveBeenCalled();
    });
  });

  describe('Storage and Querying', () => {
    beforeEach(() => {
      // Setup test data
      errorLoop.receiveError(
        createStructuredError('Error 1', { category: 'syntax' }),
        'task-123'
      );
      errorLoop.receiveError(
        createStructuredError('Error 2', { category: 'type' }),
        'task-123'
      );
      errorLoop.receiveError(
        createStructuredError('Error 3', { category: 'lint' }),
        'task-456'
      );
    });

    it('should return all errors when no filter is applied', () => {
      const allErrors = errorLoop.getErrors();
      expect(allErrors).toHaveLength(3);
    });

    it('should filter errors by taskId', () => {
      const task123Errors = errorLoop.getErrors('task-123');
      const task456Errors = errorLoop.getErrors('task-456');

      expect(task123Errors).toHaveLength(2);
      expect(task456Errors).toHaveLength(1);
      expect(task123Errors.every(e => e.taskId === 'task-123')).toBe(true);
      expect(task456Errors.every(e => e.taskId === 'task-456')).toBe(true);
    });

    it('should return empty array for non-existent taskId', () => {
      const errors = errorLoop.getErrors('non-existent');
      expect(errors).toHaveLength(0);
    });

    it('should get unresolved errors', () => {
      const unresolved = errorLoop.getUnresolvedErrors();
      expect(unresolved).toHaveLength(3);
      expect(unresolved.every(e => !e.resolved)).toBe(true);
    });

    it('should get resolved errors', () => {
      // Initially no resolved errors
      expect(errorLoop.getResolvedErrors()).toHaveLength(0);

      // Resolve one error
      const allErrors = errorLoop.getErrors();
      errorLoop.resolveError(allErrors[0].id);

      const resolved = errorLoop.getResolvedErrors();
      expect(resolved).toHaveLength(1);
      expect(resolved[0].resolved).toBe(true);
    });

    it('should filter resolved/unresolved errors by taskId', () => {
      const task123Errors = errorLoop.getErrors('task-123');
      errorLoop.resolveError(task123Errors[0].id);

      const unresolvedTask123 = errorLoop.getUnresolvedErrors('task-123');
      const resolvedTask123 = errorLoop.getResolvedErrors('task-123');

      expect(unresolvedTask123).toHaveLength(1);
      expect(resolvedTask123).toHaveLength(1);
    });
  });

  describe('Error Resolution', () => {
    it('should mark an error as resolved', () => {
      const compilerError = errorLoop.receiveError(
        createStructuredError('Test error')
      );

      expect(compilerError.resolved).toBe(false);
      expect(compilerError.resolvedAt).toBeUndefined();

      const resolved = errorLoop.resolveError(compilerError.id);

      expect(resolved).toBe(true);
      expect(compilerError.resolved).toBe(true);
      expect(compilerError.resolvedAt).toBeInstanceOf(Date);
    });

    it('should return false when trying to resolve non-existent error', () => {
      const resolved = errorLoop.resolveError('non-existent-id');
      expect(resolved).toBe(false);
    });

    it('should handle resolving the same error multiple times', () => {
      const compilerError = errorLoop.receiveError(
        createStructuredError('Test error')
      );

      const resolved1 = errorLoop.resolveError(compilerError.id);
      const resolved2 = errorLoop.resolveError(compilerError.id);

      expect(resolved1).toBe(true);
      expect(resolved2).toBe(true);
      expect(compilerError.resolved).toBe(true);
    });
  });

  describe('Error Clearing', () => {
    beforeEach(() => {
      errorLoop.receiveError(createStructuredError('Error 1'), 'task-123');
      errorLoop.receiveError(createStructuredError('Error 2'), 'task-123');
      errorLoop.receiveError(createStructuredError('Error 3'), 'task-456');
    });

    it('should clear all errors when no taskId is provided', () => {
      expect(errorLoop.getErrors()).toHaveLength(3);

      const clearedCount = errorLoop.clearErrors();

      expect(clearedCount).toBe(3);
      expect(errorLoop.getErrors()).toHaveLength(0);
    });

    it('should clear errors for specific task only', () => {
      const clearedCount = errorLoop.clearErrors('task-123');

      expect(clearedCount).toBe(2);
      expect(errorLoop.getErrors()).toHaveLength(1);
      expect(errorLoop.getErrors()[0].taskId).toBe('task-456');
    });

    it('should return 0 when clearing non-existent task', () => {
      const clearedCount = errorLoop.clearErrors('non-existent');
      expect(clearedCount).toBe(0);
      expect(errorLoop.getErrors()).toHaveLength(3);
    });
  });

  describe('Count and Status Methods', () => {
    beforeEach(() => {
      errorLoop.receiveError(createStructuredError('Error 1'), 'task-123');
      errorLoop.receiveError(createStructuredError('Error 2'), 'task-123');
      errorLoop.receiveError(createStructuredError('Error 3'), 'task-456');
    });

    it('should get unresolved count for all tasks', () => {
      expect(errorLoop.getUnresolvedCount()).toBe(3);

      // Resolve one error
      const errors = errorLoop.getErrors();
      errorLoop.resolveError(errors[0].id);

      expect(errorLoop.getUnresolvedCount()).toBe(2);
    });

    it('should get unresolved count for specific task', () => {
      expect(errorLoop.getUnresolvedCount('task-123')).toBe(2);
      expect(errorLoop.getUnresolvedCount('task-456')).toBe(1);
      expect(errorLoop.getUnresolvedCount('non-existent')).toBe(0);
    });

    it('should check if there are unresolved errors', () => {
      expect(errorLoop.hasUnresolvedErrors()).toBe(true);
      expect(errorLoop.hasUnresolvedErrors('task-123')).toBe(true);
      expect(errorLoop.hasUnresolvedErrors('non-existent')).toBe(false);

      // Clear all errors
      errorLoop.clearErrors();
      expect(errorLoop.hasUnresolvedErrors()).toBe(false);
    });
  });

  describe('Error Statistics', () => {
    beforeEach(() => {
      errorLoop.receiveError(
        createStructuredError('Syntax error', {
          severity: 'error',
          category: 'syntax',
        }),
        'task-123'
      );
      errorLoop.receiveError(
        createStructuredError('Type error', {
          severity: 'error',
          category: 'type',
        }),
        'task-123'
      );
      errorLoop.receiveError(
        createStructuredError('Lint warning', {
          severity: 'warning',
          category: 'lint',
        }),
        'task-456'
      );

      // Resolve one error
      const errors = errorLoop.getErrors();
      errorLoop.resolveError(errors[0].id);
    });

    it('should get statistics for all errors', () => {
      const stats = errorLoop.getErrorStats();

      expect(stats.total).toBe(3);
      expect(stats.unresolved).toBe(2);
      expect(stats.resolved).toBe(1);
      expect(stats.byCategory).toEqual({
        syntax: 1,
        type: 1,
        lint: 1,
      });
      expect(stats.bySeverity).toEqual({
        error: 2,
        warning: 1,
      });
    });

    it('should get statistics filtered by task', () => {
      const stats = errorLoop.getErrorStats('task-123');

      expect(stats.total).toBe(2);
      expect(stats.unresolved).toBe(1); // One was resolved
      expect(stats.resolved).toBe(1);
    });

    it('should return empty statistics for non-existent task', () => {
      const stats = errorLoop.getErrorStats('non-existent');

      expect(stats.total).toBe(0);
      expect(stats.unresolved).toBe(0);
      expect(stats.resolved).toBe(0);
      expect(stats.byCategory).toEqual({});
      expect(stats.bySeverity).toEqual({});
    });
  });

  describe('Event Timing and Payload Validation', () => {
    it('should include accurate timestamps in events', () => {
      const receivedHandler = vi.fn();
      const resolvedHandler = vi.fn();

      errorLoop.on('error:received', receivedHandler);
      errorLoop.on('error:resolved', resolvedHandler);

      const beforeReceive = new Date();
      const compilerError = errorLoop.receiveError(createStructuredError('Test'));
      const afterReceive = new Date();

      const receivedEvent: ErrorReceivedEvent = receivedHandler.mock.calls[0][0];
      expect(receivedEvent.timestamp.getTime()).toBeGreaterThanOrEqual(beforeReceive.getTime());
      expect(receivedEvent.timestamp.getTime()).toBeLessThanOrEqual(afterReceive.getTime());

      const beforeResolve = new Date();
      errorLoop.resolveError(compilerError.id);
      const afterResolve = new Date();

      const resolvedEvent: ErrorResolvedEvent = resolvedHandler.mock.calls[0][0];
      expect(resolvedEvent.timestamp.getTime()).toBeGreaterThanOrEqual(beforeResolve.getTime());
      expect(resolvedEvent.timestamp.getTime()).toBeLessThanOrEqual(afterResolve.getTime());
    });

    it('should update unresolved counts correctly in events', () => {
      const eventHandler = vi.fn();
      errorLoop.on('error:received', eventHandler);

      // Add three errors
      errorLoop.receiveError(createStructuredError('Error 1'));
      errorLoop.receiveError(createStructuredError('Error 2'));
      errorLoop.receiveError(createStructuredError('Error 3'));

      expect(eventHandler).toHaveBeenCalledTimes(3);
      expect(eventHandler.mock.calls[0][0].unresolvedCount).toBe(1);
      expect(eventHandler.mock.calls[1][0].unresolvedCount).toBe(2);
      expect(eventHandler.mock.calls[2][0].unresolvedCount).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty error arrays in receiveErrors', () => {
      const compilerErrors = errorLoop.receiveErrors([]);
      expect(compilerErrors).toHaveLength(0);
      expect(errorLoop.getErrors()).toHaveLength(0);
    });

    it('should handle errors with undefined taskId consistently', () => {
      const error1 = errorLoop.receiveError(createStructuredError('Error 1'));
      const error2 = errorLoop.receiveError(createStructuredError('Error 2'), undefined);

      expect(error1.taskId).toBeUndefined();
      expect(error2.taskId).toBeUndefined();

      const errors = errorLoop.getErrors(undefined);
      expect(errors).toHaveLength(2);
    });

    it('should preserve error object references', () => {
      const originalError = createStructuredError('Test error');
      const compilerError = errorLoop.receiveError(originalError);

      expect(compilerError.error).toBe(originalError);
      expect(errorLoop.getErrors()[0].error).toBe(originalError);
    });
  });
});