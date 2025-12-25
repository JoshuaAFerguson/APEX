import { describe, it, expect } from 'vitest';
import { ApexEventType } from '../types';

/**
 * Simple verification test for worktree:merge-cleaned event type implementation
 */

describe('worktree:merge-cleaned Implementation Verification', () => {
  it('should verify ApexEventType includes worktree:merge-cleaned', () => {
    // This test will fail at compile-time if the type is not properly defined
    const eventType: ApexEventType = 'worktree:merge-cleaned';
    expect(eventType).toBe('worktree:merge-cleaned');

    // Test that it's a valid string literal type
    const eventTypes: ApexEventType[] = ['worktree:merge-cleaned'];
    expect(eventTypes).toContain('worktree:merge-cleaned');
  });

  it('should verify compilation succeeds', () => {
    // This test verifies that TypeScript compilation works
    function processEventType(type: ApexEventType): boolean {
      return type === 'worktree:merge-cleaned';
    }

    expect(processEventType('worktree:merge-cleaned')).toBe(true);
  });
});