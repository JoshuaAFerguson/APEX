import { describe, it, expect } from 'vitest';
import {
  EnforcementModeSchema,
  EnforcementMode
} from '../types';

describe('EnforcementMode Schema Tests', () => {
  describe('EnforcementModeSchema', () => {
    it('should accept valid enforcement modes', () => {
      const validModes = ['warn', 'block', 'audit'];

      for (const mode of validModes) {
        expect(() => EnforcementModeSchema.parse(mode)).not.toThrow();
        expect(EnforcementModeSchema.parse(mode)).toBe(mode);
      }
    });

    it('should reject invalid enforcement modes', () => {
      const invalidModes = [
        'strict',
        'disabled',
        'enforce',
        'require',
        'error',
        'fail',
        '',
        null,
        undefined,
        123,
        true,
        false,
        [],
        {},
        ['warn']
      ];

      for (const mode of invalidModes) {
        expect(() => EnforcementModeSchema.parse(mode)).toThrow();
      }
    });

    it('should be case-sensitive', () => {
      const caseSensitiveModes = ['WARN', 'Block', 'AUDIT', 'Warn', 'Warning', 'blocked'];

      for (const mode of caseSensitiveModes) {
        expect(() => EnforcementModeSchema.parse(mode)).toThrow();
      }
    });

    it('should not accept PolicyEnforcementMode values not in EnforcementMode', () => {
      // PolicyEnforcementMode includes 'strict' and 'disabled' which EnforcementMode does not
      const policyOnlyModes = ['strict', 'disabled'];

      for (const mode of policyOnlyModes) {
        expect(() => EnforcementModeSchema.parse(mode)).toThrow();
      }
    });
  });

  describe('EnforcementMode Type Integration', () => {
    it('should work with TypeScript type annotation', () => {
      const mode: EnforcementMode = 'warn';
      expect(EnforcementModeSchema.parse(mode)).toBe('warn');

      const blockMode: EnforcementMode = 'block';
      expect(EnforcementModeSchema.parse(blockMode)).toBe('block');

      const auditMode: EnforcementMode = 'audit';
      expect(EnforcementModeSchema.parse(auditMode)).toBe('audit');
    });

    it('should properly infer type from schema', () => {
      const parsedMode = EnforcementModeSchema.parse('warn');
      // TypeScript should infer this as EnforcementMode type
      const typedMode: EnforcementMode = parsedMode;
      expect(typedMode).toBe('warn');
    });
  });
});