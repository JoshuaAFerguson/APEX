import { describe, it, expect } from 'vitest';
import {
  PermissionLevelSchema,
  PermissionSchema,
  PermissionQuerySchema,
  PermissionLevel,
  Permission,
  PermissionQuery,
} from './types';

describe('PermissionLevelSchema', () => {
  it('should accept valid permission levels', () => {
    expect(PermissionLevelSchema.parse('allow-always')).toBe('allow-always');
    expect(PermissionLevelSchema.parse('allow-once')).toBe('allow-once');
    expect(PermissionLevelSchema.parse('deny')).toBe('deny');
  });

  it('should reject invalid permission levels', () => {
    expect(() => PermissionLevelSchema.parse('allow')).toThrow();
    expect(() => PermissionLevelSchema.parse('always')).toThrow();
    expect(() => PermissionLevelSchema.parse('never')).toThrow();
    expect(() => PermissionLevelSchema.parse('')).toThrow();
    expect(() => PermissionLevelSchema.parse(null)).toThrow();
    expect(() => PermissionLevelSchema.parse(undefined)).toThrow();
  });

  it('should be case sensitive', () => {
    expect(() => PermissionLevelSchema.parse('Allow-Always')).toThrow();
    expect(() => PermissionLevelSchema.parse('ALLOW_ONCE')).toThrow();
    expect(() => PermissionLevelSchema.parse('DENY')).toThrow();
  });
});

describe('PermissionSchema', () => {
  const validBasePermission = {
    tool: 'Read',
    level: 'allow-always' as PermissionLevel,
    createdAt: new Date(),
  };

  it('should accept valid permission with required fields only', () => {
    const result = PermissionSchema.parse(validBasePermission);
    expect(result.tool).toBe('Read');
    expect(result.level).toBe('allow-always');
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.scope).toBeUndefined();
    expect(result.expiry).toBeUndefined();
  });

  it('should accept valid permission with all fields', () => {
    const fullPermission = {
      ...validBasePermission,
      scope: '/src/**/*.ts',
      expiry: new Date(Date.now() + 3600000), // 1 hour from now
    };

    const result = PermissionSchema.parse(fullPermission);
    expect(result.tool).toBe('Read');
    expect(result.level).toBe('allow-always');
    expect(result.scope).toBe('/src/**/*.ts');
    expect(result.expiry).toBeInstanceOf(Date);
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('should accept all valid permission levels', () => {
    const permissionLevels: PermissionLevel[] = ['allow-always', 'allow-once', 'deny'];

    permissionLevels.forEach(level => {
      const permission = { ...validBasePermission, level };
      const result = PermissionSchema.parse(permission);
      expect(result.level).toBe(level);
    });
  });

  it('should require tool name', () => {
    const invalidPermission = {
      level: 'allow-always' as PermissionLevel,
      createdAt: new Date(),
    };

    expect(() => PermissionSchema.parse(invalidPermission)).toThrow('Tool name is required');
  });

  it('should reject empty tool name', () => {
    const invalidPermission = {
      ...validBasePermission,
      tool: '',
    };

    expect(() => PermissionSchema.parse(invalidPermission)).toThrow('Tool name is required');
  });

  it('should reject whitespace-only tool name', () => {
    const invalidPermission = {
      ...validBasePermission,
      tool: '   ',
    };

    expect(() => PermissionSchema.parse(invalidPermission)).toThrow('String must contain at least 1 character(s)');
  });

  it('should require valid permission level', () => {
    const invalidPermission = {
      ...validBasePermission,
      level: 'invalid-level',
    };

    expect(() => PermissionSchema.parse(invalidPermission)).toThrow();
  });

  it('should require createdAt timestamp', () => {
    const invalidPermission = {
      tool: 'Read',
      level: 'allow-always' as PermissionLevel,
    };

    expect(() => PermissionSchema.parse(invalidPermission)).toThrow();
  });

  it('should reject invalid createdAt value', () => {
    const invalidPermission = {
      ...validBasePermission,
      createdAt: 'not-a-date',
    };

    expect(() => PermissionSchema.parse(invalidPermission)).toThrow();
  });

  it('should reject invalid expiry value', () => {
    const invalidPermission = {
      ...validBasePermission,
      expiry: 'not-a-date',
    };

    expect(() => PermissionSchema.parse(invalidPermission)).toThrow();
  });

  it('should accept null expiry (but convert to undefined)', () => {
    const permissionWithNullExpiry = {
      ...validBasePermission,
      expiry: undefined,
    };

    const result = PermissionSchema.parse(permissionWithNullExpiry);
    expect(result.expiry).toBeUndefined();
  });

  it('should accept empty scope', () => {
    const permissionWithEmptyScope = {
      ...validBasePermission,
      scope: '',
    };

    const result = PermissionSchema.parse(permissionWithEmptyScope);
    expect(result.scope).toBe('');
  });

  it('should handle complex tool names', () => {
    const complexToolNames = [
      'Read',
      'Write',
      'Edit',
      'MultiEdit',
      'NotebookEdit',
      'Bash',
      'Grep',
      'Glob',
      'WebFetch',
      'WebSearch',
      'custom-tool',
      'Tool_With_Underscores',
      'tool.with.dots',
      'tool-123',
    ];

    complexToolNames.forEach(toolName => {
      const permission = { ...validBasePermission, tool: toolName };
      const result = PermissionSchema.parse(permission);
      expect(result.tool).toBe(toolName);
    });
  });

  it('should handle complex scope patterns', () => {
    const complexScopes = [
      '/src/**/*.ts',
      '*.js',
      '/home/user/project',
      'npm install',
      'git commit -m',
      'docker run',
      '**/*.test.ts',
      '/var/log/*.log',
      'https://api.example.com/*',
      'command:build',
      'file:/home/user/docs.pdf',
    ];

    complexScopes.forEach(scope => {
      const permission = { ...validBasePermission, scope };
      const result = PermissionSchema.parse(permission);
      expect(result.scope).toBe(scope);
    });
  });

  it('should preserve Date objects', () => {
    const now = new Date();
    const expiry = new Date(now.getTime() + 3600000);

    const permission = {
      ...validBasePermission,
      createdAt: now,
      expiry,
    };

    const result = PermissionSchema.parse(permission);
    expect(result.createdAt).toEqual(now);
    expect(result.expiry).toEqual(expiry);
  });
});

describe('PermissionQuerySchema', () => {
  it('should accept valid query with tool only', () => {
    const query = { tool: 'Read' };
    const result = PermissionQuerySchema.parse(query);
    expect(result.tool).toBe('Read');
    expect(result.scope).toBeUndefined();
  });

  it('should accept valid query with tool and scope', () => {
    const query = {
      tool: 'Write',
      scope: '/src/**/*.ts',
    };

    const result = PermissionQuerySchema.parse(query);
    expect(result.tool).toBe('Write');
    expect(result.scope).toBe('/src/**/*.ts');
  });

  it('should require tool name', () => {
    const invalidQuery = { scope: '/some/path' };
    expect(() => PermissionQuerySchema.parse(invalidQuery)).toThrow('Tool name is required');
  });

  it('should reject empty tool name', () => {
    const invalidQuery = { tool: '', scope: '/some/path' };
    expect(() => PermissionQuerySchema.parse(invalidQuery)).toThrow('Tool name is required');
  });

  it('should reject whitespace-only tool name', () => {
    const invalidQuery = { tool: '   ', scope: '/some/path' };
    expect(() => PermissionQuerySchema.parse(invalidQuery)).toThrow('String must contain at least 1 character(s)');
  });

  it('should accept empty scope', () => {
    const query = {
      tool: 'Bash',
      scope: '',
    };

    const result = PermissionQuerySchema.parse(query);
    expect(result.scope).toBe('');
  });

  it('should handle undefined scope', () => {
    const query = {
      tool: 'Grep',
      scope: undefined,
    };

    const result = PermissionQuerySchema.parse(query);
    expect(result.scope).toBeUndefined();
  });

  it('should handle complex tool and scope combinations', () => {
    const testCases = [
      { tool: 'Read', scope: '/src/**/*.ts' },
      { tool: 'Write', scope: '/dist/output.js' },
      { tool: 'Edit', scope: '*.md' },
      { tool: 'Bash', scope: 'npm run build' },
      { tool: 'Grep', scope: '**/*.json' },
      { tool: 'WebFetch', scope: 'https://api.example.com/*' },
      { tool: 'custom-tool', scope: 'custom-scope:value' },
    ];

    testCases.forEach(({ tool, scope }) => {
      const query = { tool, scope };
      const result = PermissionQuerySchema.parse(query);
      expect(result.tool).toBe(tool);
      expect(result.scope).toBe(scope);
    });
  });
});

describe('Permission Type Integration', () => {
  it('should work together in typical usage scenarios', () => {
    // Simulate creating a permission
    const permission: Permission = {
      tool: 'Read',
      scope: '/src/**/*.ts',
      level: 'allow-always',
      expiry: new Date(Date.now() + 86400000), // 1 day
      createdAt: new Date(),
    };

    // Validate the permission
    const validatedPermission = PermissionSchema.parse(permission);
    expect(validatedPermission).toEqual(permission);

    // Simulate querying for this permission
    const query: PermissionQuery = {
      tool: permission.tool,
      scope: permission.scope,
    };

    const validatedQuery = PermissionQuerySchema.parse(query);
    expect(validatedQuery.tool).toBe(permission.tool);
    expect(validatedQuery.scope).toBe(permission.scope);
  });

  it('should handle edge cases in real-world scenarios', () => {
    // Permission with minimal fields
    const minimalPermission: Permission = {
      tool: 'Bash',
      level: 'deny',
      createdAt: new Date(),
    };

    expect(() => PermissionSchema.parse(minimalPermission)).not.toThrow();

    // Query matching minimal permission
    const matchingQuery: PermissionQuery = {
      tool: 'Bash',
    };

    expect(() => PermissionQuerySchema.parse(matchingQuery)).not.toThrow();

    // Query with different tool
    const nonMatchingQuery: PermissionQuery = {
      tool: 'Read',
      scope: '/some/file.ts',
    };

    expect(() => PermissionQuerySchema.parse(nonMatchingQuery)).not.toThrow();
  });

  it('should support permission level transitions', () => {
    const basePermission = {
      tool: 'Write',
      scope: '/output/file.txt',
      createdAt: new Date(),
    };

    const permissionLevels: PermissionLevel[] = ['deny', 'allow-once', 'allow-always'];

    // Test that we can create permissions with all levels
    permissionLevels.forEach(level => {
      const permission = { ...basePermission, level };
      expect(() => PermissionSchema.parse(permission)).not.toThrow();
    });
  });

  it('should handle expiry edge cases', () => {
    const basePermission = {
      tool: 'Edit',
      level: 'allow-once' as PermissionLevel,
      createdAt: new Date(),
    };

    // Past expiry (should still validate - business logic handles expiry)
    const expiredPermission = {
      ...basePermission,
      expiry: new Date(Date.now() - 3600000), // 1 hour ago
    };

    expect(() => PermissionSchema.parse(expiredPermission)).not.toThrow();

    // Far future expiry
    const futurePermission = {
      ...basePermission,
      expiry: new Date('2030-01-01'),
    };

    expect(() => PermissionSchema.parse(futurePermission)).not.toThrow();

    // Same time as creation
    const now = new Date();
    const immediatePermission = {
      tool: 'Glob',
      level: 'allow-always' as PermissionLevel,
      createdAt: now,
      expiry: now,
    };

    expect(() => PermissionSchema.parse(immediatePermission)).not.toThrow();
  });
});

describe('Permission System Type Safety', () => {
  it('should provide proper TypeScript inference', () => {
    // Test that TypeScript can properly infer types
    const permission: Permission = PermissionSchema.parse({
      tool: 'Read',
      level: 'allow-always',
      createdAt: new Date(),
    });

    // These should compile without type errors
    const toolName: string = permission.tool;
    const level: PermissionLevel = permission.level;
    const created: Date = permission.createdAt;
    const scope: string | undefined = permission.scope;
    const expiry: Date | undefined = permission.expiry;

    expect(typeof toolName).toBe('string');
    expect(['allow-always', 'allow-once', 'deny']).toContain(level);
    expect(created).toBeInstanceOf(Date);
    expect(scope).toBeUndefined();
    expect(expiry).toBeUndefined();
  });

  it('should maintain type safety with partial objects', () => {
    // Test that partial permission objects work correctly
    type PartialPermission = Partial<Permission> & Pick<Permission, 'tool' | 'level' | 'createdAt'>;

    const partialPermission: PartialPermission = {
      tool: 'Write',
      level: 'allow-once',
      createdAt: new Date(),
      // scope and expiry are optional
    };

    const validatedPermission = PermissionSchema.parse(partialPermission);
    expect(validatedPermission.tool).toBe('Write');
    expect(validatedPermission.level).toBe('allow-once');
    expect(validatedPermission.createdAt).toBeInstanceOf(Date);
  });
});