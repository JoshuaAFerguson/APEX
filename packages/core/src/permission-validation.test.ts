import { describe, it, expect } from 'vitest';
import {
  PermissionLevelSchema,
  PermissionSchema,
  PermissionQuerySchema,
} from './types';

/**
 * Simple validation tests to ensure the permission schemas work as expected
 * These tests focus on the basic functionality and integration
 */
describe('Permission System Validation', () => {
  describe('Basic Schema Functionality', () => {
    it('should validate PermissionLevelSchema correctly', () => {
      // Valid cases
      expect(PermissionLevelSchema.parse('allow-always')).toBe('allow-always');
      expect(PermissionLevelSchema.parse('allow-once')).toBe('allow-once');
      expect(PermissionLevelSchema.parse('deny')).toBe('deny');

      // Invalid cases
      expect(() => PermissionLevelSchema.parse('invalid')).toThrow();
      expect(() => PermissionLevelSchema.parse('')).toThrow();
      expect(() => PermissionLevelSchema.parse(null)).toThrow();
    });

    it('should validate PermissionSchema correctly', () => {
      const validPermission = {
        tool: 'Read',
        level: 'allow-always',
        createdAt: new Date(),
      };

      const result = PermissionSchema.parse(validPermission);
      expect(result.tool).toBe('Read');
      expect(result.level).toBe('allow-always');
      expect(result.createdAt).toBeInstanceOf(Date);

      // Should fail without required fields
      expect(() => PermissionSchema.parse({})).toThrow();
      expect(() => PermissionSchema.parse({ tool: 'Read' })).toThrow();
    });

    it('should validate PermissionQuerySchema correctly', () => {
      const validQuery = { tool: 'Write', scope: '/path' };
      const result = PermissionQuerySchema.parse(validQuery);
      expect(result.tool).toBe('Write');
      expect(result.scope).toBe('/path');

      // Should fail without tool
      expect(() => PermissionQuerySchema.parse({})).toThrow();
      expect(() => PermissionQuerySchema.parse({ scope: '/path' })).toThrow();
    });
  });

  describe('Type Inference Validation', () => {
    it('should correctly infer types from schemas', () => {
      // Test that the schemas produce the expected TypeScript types
      const permission = PermissionSchema.parse({
        tool: 'Edit',
        level: 'allow-once',
        createdAt: new Date(),
        scope: '/test/**',
        expiry: new Date(Date.now() + 3600000),
      });

      // These should all pass TypeScript compilation
      expect(typeof permission.tool).toBe('string');
      expect(['allow-always', 'allow-once', 'deny']).toContain(permission.level);
      expect(permission.createdAt).toBeInstanceOf(Date);
      expect(typeof permission.scope).toBe('string');
      expect(permission.expiry).toBeInstanceOf(Date);
    });

    it('should handle optional fields correctly', () => {
      const minimalPermission = PermissionSchema.parse({
        tool: 'Bash',
        level: 'deny',
        createdAt: new Date(),
      });

      expect(minimalPermission.scope).toBeUndefined();
      expect(minimalPermission.expiry).toBeUndefined();

      const minimalQuery = PermissionQuerySchema.parse({
        tool: 'Grep',
      });

      expect(minimalQuery.scope).toBeUndefined();
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should support typical permission creation workflow', () => {
      // Simulate creating a permission for file reading
      const fileReadPermission = {
        tool: 'Read',
        scope: '/src/**/*.ts',
        level: 'allow-always',
        createdAt: new Date(),
      };

      const validatedPermission = PermissionSchema.parse(fileReadPermission);
      expect(validatedPermission).toMatchObject(fileReadPermission);

      // Simulate querying for this permission
      const query = {
        tool: 'Read',
        scope: '/src/**/*.ts',
      };

      const validatedQuery = PermissionQuerySchema.parse(query);
      expect(validatedQuery.tool).toBe(fileReadPermission.tool);
      expect(validatedQuery.scope).toBe(fileReadPermission.scope);
    });

    it('should support temporary permissions with expiry', () => {
      const temporaryPermission = {
        tool: 'Write',
        scope: '/tmp/output.log',
        level: 'allow-once',
        createdAt: new Date(),
        expiry: new Date(Date.now() + 300000), // 5 minutes
      };

      const result = PermissionSchema.parse(temporaryPermission);
      expect(result.level).toBe('allow-once');
      expect(result.expiry).toBeInstanceOf(Date);
      expect(result.expiry!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should support blanket denials', () => {
      const denialPermission = {
        tool: 'Bash',
        level: 'deny',
        createdAt: new Date(),
        // No scope = applies to all uses of this tool
      };

      const result = PermissionSchema.parse(denialPermission);
      expect(result.level).toBe('deny');
      expect(result.scope).toBeUndefined();
    });
  });
});