import { describe, it, expect } from 'vitest';
import {
  PermissionLevelSchema,
  PermissionSchema,
  PermissionQuerySchema,
  PermissionLevel,
  Permission,
  PermissionQuery,
} from './types';

describe('Permission Types Coverage Tests', () => {
  describe('PermissionLevelSchema - Exhaustive Coverage', () => {
    it('should cover all enum values', () => {
      const validValues = ['allow-always', 'allow-once', 'deny'] as const;

      // Test each valid value
      validValues.forEach(value => {
        const result = PermissionLevelSchema.parse(value);
        expect(result).toBe(value);
      });

      // Ensure we have complete coverage
      expect(validValues).toHaveLength(3);
    });

    it('should reject all invalid variations', () => {
      const invalidValues = [
        'allow', 'always', 'once', 'never', 'reject', 'accept',
        'ALLOW-ALWAYS', 'Allow-Always', 'allow_always', 'allowAlways',
        '', ' ', 'null', 'undefined', '0', '1', 'true', 'false'
      ];

      invalidValues.forEach(value => {
        expect(() => PermissionLevelSchema.parse(value)).toThrow();
      });
    });

    it('should reject non-string types', () => {
      const nonStringValues = [
        null, undefined, 0, 1, true, false, {}, [],
        Symbol('allow'), () => 'allow-always', new Date()
      ];

      nonStringValues.forEach(value => {
        expect(() => PermissionLevelSchema.parse(value)).toThrow();
      });
    });
  });

  describe('PermissionSchema - Field Coverage', () => {
    const baseValidPermission = {
      tool: 'TestTool',
      level: 'allow-always' as PermissionLevel,
      createdAt: new Date(),
    };

    describe('tool field validation', () => {
      it('should require tool field', () => {
        const { tool, ...withoutTool } = baseValidPermission;
        expect(() => PermissionSchema.parse(withoutTool)).toThrow();
      });

      it('should reject empty tool name', () => {
        expect(() => PermissionSchema.parse({
          ...baseValidPermission,
          tool: ''
        })).toThrow('Tool name is required');
      });

      it('should accept valid tool names', () => {
        const validToolNames = [
          'a', // minimum length
          'Read', 'Write', 'Edit', // built-in tools
          'custom-tool-123', // with hyphens and numbers
          'tool_with_underscores', // with underscores
          'tool.with.dots', // with dots
          'Tool With Spaces', // with spaces
          'УTool', // unicode characters
          '🔧', // emoji
        ];

        validToolNames.forEach(toolName => {
          const permission = { ...baseValidPermission, tool: toolName };
          const result = PermissionSchema.parse(permission);
          expect(result.tool).toBe(toolName);
        });
      });
    });

    describe('level field validation', () => {
      it('should require level field', () => {
        const { level, ...withoutLevel } = baseValidPermission;
        expect(() => PermissionSchema.parse(withoutLevel)).toThrow();
      });

      it('should accept all valid permission levels', () => {
        const levels: PermissionLevel[] = ['allow-always', 'allow-once', 'deny'];

        levels.forEach(level => {
          const permission = { ...baseValidPermission, level };
          const result = PermissionSchema.parse(permission);
          expect(result.level).toBe(level);
        });
      });

      it('should reject invalid levels', () => {
        const invalidLevels = [
          'invalid', null, undefined, '', 'ALLOW-ALWAYS'
        ];

        invalidLevels.forEach(level => {
          expect(() => PermissionSchema.parse({
            ...baseValidPermission,
            level
          })).toThrow();
        });
      });
    });

    describe('createdAt field validation', () => {
      it('should require createdAt field', () => {
        const { createdAt, ...withoutCreatedAt } = baseValidPermission;
        expect(() => PermissionSchema.parse(withoutCreatedAt)).toThrow();
      });

      it('should accept valid Date objects', () => {
        const dates = [
          new Date(), // current time
          new Date(0), // epoch
          new Date('2023-01-01'), // specific date
          new Date('2030-12-31T23:59:59.999Z'), // future date
        ];

        dates.forEach(createdAt => {
          const permission = { ...baseValidPermission, createdAt };
          const result = PermissionSchema.parse(permission);
          expect(result.createdAt).toEqual(createdAt);
        });
      });

      it('should reject non-Date values', () => {
        const invalidDates = [
          'not-a-date', null, undefined, 0, 1234567890,
          '2023-01-01', {}, [], true
        ];

        invalidDates.forEach(createdAt => {
          expect(() => PermissionSchema.parse({
            ...baseValidPermission,
            createdAt
          })).toThrow();
        });
      });
    });

    describe('scope field validation (optional)', () => {
      it('should accept undefined scope', () => {
        const permission = { ...baseValidPermission };
        const result = PermissionSchema.parse(permission);
        expect(result.scope).toBeUndefined();
      });

      it('should accept empty string scope', () => {
        const permission = { ...baseValidPermission, scope: '' };
        const result = PermissionSchema.parse(permission);
        expect(result.scope).toBe('');
      });

      it('should accept various scope patterns', () => {
        const scopes = [
          '/path/to/file',
          '*.js',
          '**/*.ts',
          'npm install',
          'git commit -m "message"',
          'https://api.example.com/*',
          'scope:value:sub',
          'complex/path/with spaces/file.ext',
        ];

        scopes.forEach(scope => {
          const permission = { ...baseValidPermission, scope };
          const result = PermissionSchema.parse(permission);
          expect(result.scope).toBe(scope);
        });
      });
    });

    describe('expiry field validation (optional)', () => {
      it('should accept undefined expiry', () => {
        const permission = { ...baseValidPermission };
        const result = PermissionSchema.parse(permission);
        expect(result.expiry).toBeUndefined();
      });

      it('should accept valid Date objects for expiry', () => {
        const now = new Date();
        const expiryDates = [
          new Date(now.getTime() + 1000), // 1 second in future
          new Date(now.getTime() + 86400000), // 1 day in future
          new Date(now.getTime() - 1000), // 1 second in past (expired)
          new Date('2030-01-01'), // far future
        ];

        expiryDates.forEach(expiry => {
          const permission = { ...baseValidPermission, expiry };
          const result = PermissionSchema.parse(permission);
          expect(result.expiry).toEqual(expiry);
        });
      });

      it('should reject non-Date values for expiry', () => {
        const invalidExpiry = [
          'not-a-date', null, 0, 1234567890,
          '2024-01-01', {}, [], true
        ];

        invalidExpiry.forEach(expiry => {
          expect(() => PermissionSchema.parse({
            ...baseValidPermission,
            expiry
          })).toThrow();
        });
      });
    });
  });

  describe('PermissionQuerySchema - Field Coverage', () => {
    describe('tool field validation', () => {
      it('should require tool field', () => {
        expect(() => PermissionQuerySchema.parse({})).toThrow('Tool name is required');
      });

      it('should reject empty tool name', () => {
        expect(() => PermissionQuerySchema.parse({ tool: '' })).toThrow('Tool name is required');
      });

      it('should accept valid tool names', () => {
        const validToolNames = [
          'a', 'Read', 'Write', 'custom-tool', 'tool_123', 'Tool With Spaces'
        ];

        validToolNames.forEach(tool => {
          const query = { tool };
          const result = PermissionQuerySchema.parse(query);
          expect(result.tool).toBe(tool);
        });
      });
    });

    describe('scope field validation (optional)', () => {
      it('should accept undefined scope', () => {
        const query = { tool: 'Test' };
        const result = PermissionQuerySchema.parse(query);
        expect(result.scope).toBeUndefined();
      });

      it('should accept empty string scope', () => {
        const query = { tool: 'Test', scope: '' };
        const result = PermissionQuerySchema.parse(query);
        expect(result.scope).toBe('');
      });

      it('should accept various scope patterns', () => {
        const scopes = [
          '/file.txt',
          '*.js',
          'command',
          'https://api.com/*',
          'scope:with:colons',
        ];

        scopes.forEach(scope => {
          const query = { tool: 'Test', scope };
          const result = PermissionQuerySchema.parse(query);
          expect(result.scope).toBe(scope);
        });
      });
    });
  });

  describe('TypeScript Type Coverage', () => {
    it('should properly infer PermissionLevel type', () => {
      const level: PermissionLevel = 'allow-always';
      expect(['allow-always', 'allow-once', 'deny']).toContain(level);
    });

    it('should properly infer Permission type', () => {
      const permission: Permission = {
        tool: 'Test',
        level: 'allow-once',
        createdAt: new Date(),
        scope: '/test',
        expiry: new Date(),
      };

      // Type assertions to ensure proper typing
      const tool: string = permission.tool;
      const level: PermissionLevel = permission.level;
      const createdAt: Date = permission.createdAt;
      const scope: string | undefined = permission.scope;
      const expiry: Date | undefined = permission.expiry;

      expect(tool).toBe('Test');
      expect(level).toBe('allow-once');
      expect(createdAt).toBeInstanceOf(Date);
      expect(scope).toBe('/test');
      expect(expiry).toBeInstanceOf(Date);
    });

    it('should properly infer PermissionQuery type', () => {
      const query: PermissionQuery = {
        tool: 'Test',
        scope: '/scope',
      };

      // Type assertions
      const tool: string = query.tool;
      const scope: string | undefined = query.scope;

      expect(tool).toBe('Test');
      expect(scope).toBe('/scope');
    });
  });

  describe('Schema Consistency and Completeness', () => {
    it('should have consistent validation between Permission and PermissionQuery tool fields', () => {
      const toolName = 'ConsistentTool';

      // Should work for Permission
      const permission = PermissionSchema.parse({
        tool: toolName,
        level: 'allow-always',
        createdAt: new Date(),
      });
      expect(permission.tool).toBe(toolName);

      // Should work for PermissionQuery
      const query = PermissionQuerySchema.parse({
        tool: toolName,
      });
      expect(query.tool).toBe(toolName);
    });

    it('should handle all edge cases for required vs optional fields', () => {
      // Test minimal valid Permission
      const minimalPermission = {
        tool: 'MinimalTool',
        level: 'deny' as const,
        createdAt: new Date(),
      };
      expect(() => PermissionSchema.parse(minimalPermission)).not.toThrow();

      // Test maximal valid Permission
      const maximalPermission = {
        tool: 'MaximalTool',
        scope: '/maximal/scope/**',
        level: 'allow-always' as const,
        expiry: new Date(Date.now() + 86400000),
        createdAt: new Date(),
      };
      expect(() => PermissionSchema.parse(maximalPermission)).not.toThrow();

      // Test minimal valid PermissionQuery
      const minimalQuery = { tool: 'MinimalQuery' };
      expect(() => PermissionQuerySchema.parse(minimalQuery)).not.toThrow();

      // Test maximal valid PermissionQuery
      const maximalQuery = { tool: 'MaximalQuery', scope: '/maximal/scope' };
      expect(() => PermissionQuerySchema.parse(maximalQuery)).not.toThrow();
    });
  });
});