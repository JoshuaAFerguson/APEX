/**
 * Comprehensive unit tests for ApprovalCheckpointTypeSchema validation
 * Ensures all valid approval types pass validation and invalid types are rejected
 */

import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { ApprovalCheckpointTypeSchema, ApprovalCheckpointType } from '../types';

describe('ApprovalCheckpointTypeSchema', () => {
  describe('Valid approval types', () => {
    it('should accept all 7 valid approval checkpoint types', () => {
      const validTypes: ApprovalCheckpointType[] = [
        'before-commit',
        'before-deploy',
        'before-destructive',
        'before-network',
        'before-file-write',
        'deployment',
        'custom',
      ];

      validTypes.forEach((type) => {
        expect(() => ApprovalCheckpointTypeSchema.parse(type)).not.toThrow();
        expect(ApprovalCheckpointTypeSchema.parse(type)).toBe(type);
      });
    });

    it('should validate individual approval types correctly', () => {
      expect(ApprovalCheckpointTypeSchema.parse('before-commit')).toBe('before-commit');
      expect(ApprovalCheckpointTypeSchema.parse('before-deploy')).toBe('before-deploy');
      expect(ApprovalCheckpointTypeSchema.parse('before-destructive')).toBe('before-destructive');
      expect(ApprovalCheckpointTypeSchema.parse('before-network')).toBe('before-network');
      expect(ApprovalCheckpointTypeSchema.parse('before-file-write')).toBe('before-file-write');
      expect(ApprovalCheckpointTypeSchema.parse('deployment')).toBe('deployment');
      expect(ApprovalCheckpointTypeSchema.parse('custom')).toBe('custom');
    });

    it('should return success result for safeParse with valid types', () => {
      const validTypes = ['before-commit', 'deployment', 'custom'];

      validTypes.forEach((type) => {
        const result = ApprovalCheckpointTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(type);
        }
      });
    });
  });

  describe('Invalid approval types', () => {
    it('should reject null and undefined values', () => {
      expect(() => ApprovalCheckpointTypeSchema.parse(null)).toThrow(ZodError);
      expect(() => ApprovalCheckpointTypeSchema.parse(undefined)).toThrow(ZodError);

      const nullResult = ApprovalCheckpointTypeSchema.safeParse(null);
      const undefinedResult = ApprovalCheckpointTypeSchema.safeParse(undefined);

      expect(nullResult.success).toBe(false);
      expect(undefinedResult.success).toBe(false);
    });

    it('should reject empty and whitespace strings', () => {
      const invalidStrings = ['', ' ', '\t', '\n', '   '];

      invalidStrings.forEach((str) => {
        expect(() => ApprovalCheckpointTypeSchema.parse(str)).toThrow(ZodError);
        const result = ApprovalCheckpointTypeSchema.safeParse(str);
        expect(result.success).toBe(false);
      });
    });

    it('should reject non-string types', () => {
      const nonStringTypes = [
        123,
        true,
        false,
        {},
        [],
        Symbol('test'),
        new Date(),
        /regex/,
        () => {},
      ];

      nonStringTypes.forEach((value) => {
        expect(() => ApprovalCheckpointTypeSchema.parse(value)).toThrow(ZodError);
        const result = ApprovalCheckpointTypeSchema.safeParse(value);
        expect(result.success).toBe(false);
      });
    });

    it('should reject similar but invalid approval type strings', () => {
      const invalidTypes = [
        'beforecommit',           // missing hyphen
        'before_commit',          // underscore instead of hyphen
        'before-commits',         // plural
        'pre-commit',            // different prefix
        'commit',                // missing prefix
        'before-merge',          // invalid operation
        'after-commit',          // wrong timing
        'before-push',           // invalid operation
        'before-pull',           // invalid operation
        'before-test',           // invalid operation
        'before-build',          // invalid operation
        'beforedeploy',          // missing hyphen
        'before_deploy',         // underscore instead of hyphen
        'before-deploys',        // plural
        'pre-deploy',           // different prefix
        'deploy',               // missing prefix (note: 'deployment' is valid)
        'after-deploy',         // wrong timing
        'before-release',       // invalid operation
        'beforedestructive',    // missing hyphen
        'before_destructive',   // underscore instead of hyphen
        'before-destructives',  // plural
        'pre-destructive',      // different prefix
        'destructive',          // missing prefix
        'after-destructive',    // wrong timing
        'before-delete',        // more specific but invalid
        'beforenetwork',        // missing hyphen
        'before_network',       // underscore instead of hyphen
        'before-networks',      // plural
        'pre-network',          // different prefix
        'network',              // missing prefix
        'after-network',        // wrong timing
        'before-api',           // more specific but invalid
        'beforefilewrite',      // missing hyphens
        'before_file_write',    // underscores instead of hyphens
        'before-file-writes',   // plural
        'pre-file-write',       // different prefix
        'file-write',           // missing prefix
        'after-file-write',     // wrong timing
        'before-write',         // less specific but invalid
        'deployments',          // plural
        'deploy',               // similar but different
        'deployment-approval',  // extra suffix
        'pre-deployment',       // different prefix
        'after-deployment',     // wrong timing
        'customs',              // plural
        'custom-approval',      // extra suffix
        'pre-custom',           // different prefix
        'after-custom',         // wrong timing
        'user-custom',          // extra prefix
      ];

      invalidTypes.forEach((type) => {
        expect(() => ApprovalCheckpointTypeSchema.parse(type)).toThrow(ZodError);
        const result = ApprovalCheckpointTypeSchema.safeParse(type);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
          expect(result.error.issues[0].code).toBe('invalid_enum_value');
        }
      });
    });

    it('should reject case variations of valid types', () => {
      const caseVariations = [
        'Before-Commit',
        'BEFORE-COMMIT',
        'before-Commit',
        'Before-commit',
        'BEFORE-DEPLOY',
        'Before-Deploy',
        'before-Deploy',
        'BEFORE-DESTRUCTIVE',
        'Before-Destructive',
        'before-Destructive',
        'BEFORE-NETWORK',
        'Before-Network',
        'before-Network',
        'BEFORE-FILE-WRITE',
        'Before-File-Write',
        'before-File-Write',
        'DEPLOYMENT',
        'Deployment',
        'CUSTOM',
        'Custom',
      ];

      caseVariations.forEach((type) => {
        expect(() => ApprovalCheckpointTypeSchema.parse(type)).toThrow(ZodError);
        const result = ApprovalCheckpointTypeSchema.safeParse(type);
        expect(result.success).toBe(false);
      });
    });

    it('should provide meaningful error messages for invalid values', () => {
      const invalidValue = 'invalid-approval-type';

      try {
        ApprovalCheckpointTypeSchema.parse(invalidValue);
        fail('Expected ZodError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        const zodError = error as ZodError;
        expect(zodError.issues).toHaveLength(1);
        expect(zodError.issues[0].code).toBe('invalid_enum_value');
        expect(zodError.issues[0].received).toBe(invalidValue);
        expect(zodError.issues[0].options).toEqual([
          'before-commit',
          'before-deploy',
          'before-destructive',
          'before-network',
          'before-file-write',
          'deployment',
          'custom',
        ]);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle string objects vs primitive strings', () => {
      const stringObject = new String('before-commit');
      const primitiveString = 'before-commit';

      // Primitive string should work
      expect(ApprovalCheckpointTypeSchema.parse(primitiveString)).toBe('before-commit');

      // String object should be rejected (Zod typically expects primitive strings)
      expect(() => ApprovalCheckpointTypeSchema.parse(stringObject)).toThrow(ZodError);
    });

    it('should handle arrays containing valid approval types', () => {
      const arrayWithValidType = ['before-commit'];
      const arrayWithMultipleTypes = ['before-commit', 'deployment'];

      // Arrays should be rejected even if they contain valid strings
      expect(() => ApprovalCheckpointTypeSchema.parse(arrayWithValidType)).toThrow(ZodError);
      expect(() => ApprovalCheckpointTypeSchema.parse(arrayWithMultipleTypes)).toThrow(ZodError);
    });

    it('should handle objects with valid approval type properties', () => {
      const objectWithValidType = { type: 'before-commit' };
      const objectWithValidString = { toString: () => 'before-commit' };

      // Objects should be rejected even if they contain valid approval types
      expect(() => ApprovalCheckpointTypeSchema.parse(objectWithValidType)).toThrow(ZodError);
      expect(() => ApprovalCheckpointTypeSchema.parse(objectWithValidString)).toThrow(ZodError);
    });
  });

  describe('TypeScript type integration', () => {
    it('should properly infer ApprovalCheckpointType', () => {
      // Type check: this should compile without errors
      const validType: ApprovalCheckpointType = 'before-commit';
      const parsedType = ApprovalCheckpointTypeSchema.parse('deployment');

      expect(validType).toBe('before-commit');
      expect(parsedType).toBe('deployment');

      // Type should be inferred correctly
      const allValidTypes: ApprovalCheckpointType[] = [
        'before-commit',
        'before-deploy',
        'before-destructive',
        'before-network',
        'before-file-write',
        'deployment',
        'custom'
      ];

      expect(allValidTypes).toHaveLength(7);
    });
  });

  describe('Performance and behavior', () => {
    it('should validate types efficiently in batch', () => {
      const validTypes = [
        'before-commit',
        'before-deploy',
        'before-destructive',
        'before-network',
        'before-file-write',
        'deployment',
        'custom',
      ];

      const start = performance.now();
      validTypes.forEach(type => {
        ApprovalCheckpointTypeSchema.parse(type);
      });
      const end = performance.now();

      // Should complete quickly (arbitrary threshold, adjust as needed)
      expect(end - start).toBeLessThan(10);
    });

    it('should be reusable and not maintain state', () => {
      // Parse different types in sequence to ensure no state pollution
      expect(ApprovalCheckpointTypeSchema.parse('before-commit')).toBe('before-commit');
      expect(ApprovalCheckpointTypeSchema.parse('deployment')).toBe('deployment');
      expect(ApprovalCheckpointTypeSchema.parse('custom')).toBe('custom');
      expect(ApprovalCheckpointTypeSchema.parse('before-network')).toBe('before-network');

      // Invalid values should still throw
      expect(() => ApprovalCheckpointTypeSchema.parse('invalid')).toThrow(ZodError);

      // Valid values should still work after invalid attempts
      expect(ApprovalCheckpointTypeSchema.parse('before-file-write')).toBe('before-file-write');
    });
  });
});