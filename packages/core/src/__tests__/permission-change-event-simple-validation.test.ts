/**
 * @fileoverview Simple validation test for PermissionChangeEvent schemas
 *
 * This test verifies that the schemas can be properly imported and basic validation works.
 */

import { describe, it, expect } from 'vitest';
import {
  PermissionChangeTypeSchema,
  PermissionDetailsSchema,
  PermissionChangeEventSchema,
} from '../types';

describe('PermissionChangeEvent Schema Validation', () => {
  it('should validate a basic permission change event', () => {
    const event = {
      changeType: 'granted',
      permission: {
        category: 'filesystem',
        permission: 'read',
        previousLevel: null,
        newLevel: 'allow-once',
      },
      timestamp: new Date(),
      message: 'Permission granted for testing',
    };

    expect(() => PermissionChangeEventSchema.parse(event)).not.toThrow();
    const parsed = PermissionChangeEventSchema.parse(event);

    expect(parsed.changeType).toBe('granted');
    expect(parsed.permission.category).toBe('filesystem');
    expect(parsed.message).toBe('Permission granted for testing');
  });

  it('should validate permission change types', () => {
    const validTypes = ['granted', 'revoked', 'modified'];

    validTypes.forEach(type => {
      expect(() => PermissionChangeTypeSchema.parse(type)).not.toThrow();
    });
  });

  it('should reject invalid change types', () => {
    const invalidTypes = ['invalid', 'expired', null, undefined];

    invalidTypes.forEach(type => {
      expect(() => PermissionChangeTypeSchema.parse(type)).toThrow();
    });
  });

  it('should validate permission details', () => {
    const details = {
      category: 'web',
      permission: 'network',
      previousLevel: 'deny',
      newLevel: 'allow-always',
      reason: 'User approved network access',
    };

    expect(() => PermissionDetailsSchema.parse(details)).not.toThrow();
    const parsed = PermissionDetailsSchema.parse(details);

    expect(parsed.category).toBe('web');
    expect(parsed.permission).toBe('network');
    expect(parsed.reason).toBe('User approved network access');
  });
});