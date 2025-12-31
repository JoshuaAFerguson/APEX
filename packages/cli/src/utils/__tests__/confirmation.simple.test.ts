/**
 * @fileoverview Simple test to validate confirmation functionality
 * This test ensures basic imports and functions work correctly
 */

import { describe, it, expect } from 'vitest';
import { shouldShowConfirmation, DangerousOperation } from '../confirmation.js';
import type { AutonomyLevel } from '@apexcli/core';

describe('Confirmation Simple Validation', () => {
  it('should import confirmation functions successfully', () => {
    expect(shouldShowConfirmation).toBeDefined();
    expect(typeof shouldShowConfirmation).toBe('function');
  });

  it('should import dangerous operations enum successfully', () => {
    expect(DangerousOperation).toBeDefined();
    expect(DangerousOperation.EMPTY_TRASH).toBe('empty_trash');
    expect(DangerousOperation.CANCEL_TASK).toBe('cancel_task');
  });

  it('should handle basic shouldShowConfirmation calls', () => {
    const result1 = shouldShowConfirmation(DangerousOperation.TRASH_TASK, 'full');
    expect(typeof result1).toBe('boolean');
    expect(result1).toBe(false); // Low consequence in full autonomy

    const result2 = shouldShowConfirmation(DangerousOperation.EMPTY_TRASH, 'full');
    expect(typeof result2).toBe('boolean');
    expect(result2).toBe(true); // High consequence irreversible in full autonomy

    const result3 = shouldShowConfirmation(DangerousOperation.CANCEL_TASK, 'manual');
    expect(typeof result3).toBe('boolean');
    expect(result3).toBe(true); // Always true in manual mode
  });

  it('should respect forceConfirmation option', () => {
    const result = shouldShowConfirmation(
      DangerousOperation.TRASH_TASK,
      'full',
      { forceConfirmation: true }
    );
    expect(result).toBe(true);
  });

  it('should validate all operation types exist', () => {
    const operations = Object.values(DangerousOperation);
    expect(operations.length).toBeGreaterThan(0);

    // Ensure all operations are handled without throwing
    const autonomyLevels: AutonomyLevel[] = ['full', 'manual', 'review-before-commit', 'review-before-merge'];

    for (const operation of operations) {
      for (const autonomy of autonomyLevels) {
        expect(() => shouldShowConfirmation(operation, autonomy)).not.toThrow();
      }
    }
  });
});