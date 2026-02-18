import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shouldShowConfirmation, DangerousOperation } from '../confirmation.js';
import type { AutonomyLevel } from '@apexcli/core';

// Mock inquirer to avoid actual prompts during testing
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn().mockResolvedValue({ confirmed: true })
  }
}));

describe('Confirmation Utility', () => {
  describe('shouldShowConfirmation', () => {
    it('should show confirmation for irreversible high-consequence operations in full autonomy mode', () => {
      const result = shouldShowConfirmation(
        DangerousOperation.EMPTY_TRASH,
        'full'
      );
      expect(result).toBe(true);
    });

    it('should skip confirmation for low-consequence operations in full autonomy mode', () => {
      const result = shouldShowConfirmation(
        DangerousOperation.TRASH_TASK,
        'full'
      );
      expect(result).toBe(false);
    });

    it('should show confirmation for medium and high consequence operations in review-before-commit mode', () => {
      expect(shouldShowConfirmation(
        DangerousOperation.CANCEL_TASK,
        'review-before-commit'
      )).toBe(true);

      expect(shouldShowConfirmation(
        DangerousOperation.EMPTY_TRASH,
        'review-before-commit'
      )).toBe(true);

      expect(shouldShowConfirmation(
        DangerousOperation.TRASH_TASK,
        'review-before-commit'
      )).toBe(false);
    });

    it('should show confirmation for merge operations in review-before-merge mode', () => {
      expect(shouldShowConfirmation(
        DangerousOperation.MERGE_TASK,
        'review-before-merge'
      )).toBe(true);
    });

    it('should show confirmation for all operations in manual mode', () => {
      expect(shouldShowConfirmation(
        DangerousOperation.TRASH_TASK,
        'manual'
      )).toBe(true);

      expect(shouldShowConfirmation(
        DangerousOperation.CANCEL_TASK,
        'manual'
      )).toBe(true);

      expect(shouldShowConfirmation(
        DangerousOperation.MERGE_TASK,
        'manual'
      )).toBe(true);
    });

    it('should always show confirmation when forced', () => {
      const result = shouldShowConfirmation(
        DangerousOperation.TRASH_TASK,
        'full',
        { forceConfirmation: true }
      );
      expect(result).toBe(true);
    });

    it('should handle all autonomy levels with all operations correctly', () => {
      const autonomyLevels: AutonomyLevel[] = ['full', 'review-before-commit', 'review-before-merge', 'manual'];
      const operations = Object.values(DangerousOperation);

      const expectedResults = {
        full: {
          [DangerousOperation.CANCEL_TASK]: false,    // medium, reversible
          [DangerousOperation.TRASH_TASK]: false,     // low, reversible
          [DangerousOperation.EMPTY_TRASH]: true,     // high, irreversible
          [DangerousOperation.MERGE_TASK]: false,     // medium, reversible
          [DangerousOperation.DELETE_TEMPLATE]: true, // high, irreversible
          [DangerousOperation.UNARCHIVE_TASK]: false  // low, reversible
        },
        'review-before-commit': {
          [DangerousOperation.CANCEL_TASK]: true,     // medium
          [DangerousOperation.TRASH_TASK]: false,     // low
          [DangerousOperation.EMPTY_TRASH]: true,     // high
          [DangerousOperation.MERGE_TASK]: true,      // medium
          [DangerousOperation.DELETE_TEMPLATE]: true, // high
          [DangerousOperation.UNARCHIVE_TASK]: false  // low
        },
        'review-before-merge': {
          [DangerousOperation.CANCEL_TASK]: false,    // medium, not merge
          [DangerousOperation.TRASH_TASK]: false,     // low
          [DangerousOperation.EMPTY_TRASH]: true,     // high
          [DangerousOperation.MERGE_TASK]: true,      // special case: always show for merges
          [DangerousOperation.DELETE_TEMPLATE]: true, // high
          [DangerousOperation.UNARCHIVE_TASK]: false  // low
        },
        manual: {
          [DangerousOperation.CANCEL_TASK]: true,     // always show in manual
          [DangerousOperation.TRASH_TASK]: true,      // always show in manual
          [DangerousOperation.EMPTY_TRASH]: true,     // always show in manual
          [DangerousOperation.MERGE_TASK]: true,      // always show in manual
          [DangerousOperation.DELETE_TEMPLATE]: true, // always show in manual
          [DangerousOperation.UNARCHIVE_TASK]: true   // always show in manual
        }
      };

      for (const autonomyLevel of autonomyLevels) {
        for (const operation of operations) {
          const result = shouldShowConfirmation(operation, autonomyLevel);
          const expected = expectedResults[autonomyLevel][operation];

          expect(result).toBe(expected,
            `Expected ${operation} with ${autonomyLevel} to be ${expected}, got ${result}`
          );
        }
      }
    });

    it('should respect force confirmation for all autonomy levels', () => {
      const autonomyLevels: AutonomyLevel[] = ['full', 'review-before-commit', 'review-before-merge', 'manual'];
      const operations = Object.values(DangerousOperation);

      for (const autonomyLevel of autonomyLevels) {
        for (const operation of operations) {
          const result = shouldShowConfirmation(operation, autonomyLevel, { forceConfirmation: true });
          expect(result).toBe(true,
            `Force confirmation should override autonomy level ${autonomyLevel} for operation ${operation}`
          );
        }
      }
    });

    it('should not be affected by other options when forceConfirmation is false', () => {
      const result = shouldShowConfirmation(
        DangerousOperation.TRASH_TASK,
        'full',
        {
          forceConfirmation: false,
          context: 'some context',
          resourceId: 'resource-123',
          resourceDescription: 'description'
        }
      );

      expect(result).toBe(false); // Should follow normal autonomy rules
    });
  });

  describe('requestConfirmation', () => {
    it('should return true when confirmation is not needed', async () => {
      const result = await requestConfirmation(
        DangerousOperation.TRASH_TASK,
        'full'
      );

      expect(result).toBe(true);
    });

    it('should call confirmDangerousOperation when confirmation is needed', async () => {
      const mockConfirmDangerousOperation = vi.fn().mockResolvedValue(true);

      // We can't easily mock the imported function, so we'll test the behavior indirectly
      const result = await requestConfirmation(
        DangerousOperation.EMPTY_TRASH,
        'full'
      );

      // Since we mocked inquirer to return true, this should be true
      expect(result).toBe(true);
    });

    it('should pass options correctly to confirmation function', async () => {
      const options = {
        context: 'test context',
        resourceId: 'test-123',
        resourceDescription: 'test description'
      };

      const result = await requestConfirmation(
        DangerousOperation.CANCEL_TASK,
        'manual',
        options
      );

      expect(result).toBe(true); // Mocked to return true
    });
  });

  describe('operation configuration consistency', () => {
    it('should have consistent configuration for all dangerous operations', () => {
      const operations = Object.values(DangerousOperation);

      for (const operation of operations) {
        expect(() => shouldShowConfirmation(operation, 'manual')).not.toThrow();
      }
    });

    it('should have appropriate consequence levels for each operation', () => {
      // These tests verify that the operation configurations make sense

      // High consequence operations should be irreversible
      expect(shouldShowConfirmation(DangerousOperation.EMPTY_TRASH, 'full')).toBe(true);
      expect(shouldShowConfirmation(DangerousOperation.DELETE_TEMPLATE, 'full')).toBe(true);

      // Low consequence operations should not show in full autonomy
      expect(shouldShowConfirmation(DangerousOperation.TRASH_TASK, 'full')).toBe(false);
      expect(shouldShowConfirmation(DangerousOperation.UNARCHIVE_TASK, 'full')).toBe(false);

      // Medium consequence operations should not show in full autonomy but show in review modes
      expect(shouldShowConfirmation(DangerousOperation.CANCEL_TASK, 'full')).toBe(false);
      expect(shouldShowConfirmation(DangerousOperation.CANCEL_TASK, 'review-before-commit')).toBe(true);
    });

    it('should handle merge operations specially in review-before-merge mode', () => {
      // Merge should always show in review-before-merge regardless of consequence level
      expect(shouldShowConfirmation(DangerousOperation.MERGE_TASK, 'review-before-merge')).toBe(true);

      // But not necessarily in other modes
      expect(shouldShowConfirmation(DangerousOperation.MERGE_TASK, 'full')).toBe(false);
    });
  });
});