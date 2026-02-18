// Integration test to verify confirmation utilities can be imported and used
// This file exists to validate imports and basic functionality without executing dangerous operations

import { shouldShowConfirmation, DangerousOperation } from './confirmation.js';
import type { AutonomyLevel } from '@apexcli/core';

/**
 * Test function to validate the confirmation logic works as expected
 */
export function validateConfirmationLogic(): boolean {
  try {
    // Test basic functionality - this doesn't require user input
    const tests = [
      {
        operation: DangerousOperation.EMPTY_TRASH,
        autonomy: 'full' as AutonomyLevel,
        expected: true // High consequence irreversible operation should show confirmation
      },
      {
        operation: DangerousOperation.TRASH_TASK,
        autonomy: 'full' as AutonomyLevel,
        expected: false // Low consequence operation should not show confirmation in full autonomy
      },
      {
        operation: DangerousOperation.MERGE_TASK,
        autonomy: 'review-before-merge' as AutonomyLevel,
        expected: true // Merge operations should show confirmation in review-before-merge mode
      },
      {
        operation: DangerousOperation.CANCEL_TASK,
        autonomy: 'manual' as AutonomyLevel,
        expected: true // All operations should show confirmation in manual mode
      }
    ];

    for (const test of tests) {
      const result = shouldShowConfirmation(test.operation, test.autonomy);
      if (result !== test.expected) {
        console.error(`Test failed: ${test.operation} with ${test.autonomy} autonomy. Expected: ${test.expected}, Got: ${result}`);
        return false;
      }
    }

    console.log('✅ All confirmation logic tests passed');
    return true;

  } catch (error) {
    console.error('❌ Error validating confirmation logic:', error);
    return false;
  }
}

// Export types for verification
export { DangerousOperation } from './confirmation.js';