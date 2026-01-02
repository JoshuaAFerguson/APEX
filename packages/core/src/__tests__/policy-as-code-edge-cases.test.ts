import { describe, it, expect } from 'vitest';
import {
  PolicyConfigSchema,
  AllowedPathsConfigSchema,
  RequiredTestsConfigSchema,
  ApprovalRulesConfigSchema,
  ApprovalConditionSchema,
  TestRequirementRuleSchema,
  ApprovalRuleSchema,
} from '../types';

describe('Policy-as-Code Edge Cases', () => {
  describe('Input Validation Edge Cases', () => {
    it('should reject null and undefined values where required', () => {
      expect(() => PolicyConfigSchema.parse(null)).toThrow();
      expect(() => PolicyConfigSchema.parse(undefined)).toThrow();

      expect(() => AllowedPathsConfigSchema.parse(null)).toThrow();
      expect(() => RequiredTestsConfigSchema.parse(null)).toThrow();
      expect(() => ApprovalRulesConfigSchema.parse(null)).toThrow();
    });

    it('should handle empty objects gracefully', () => {
      expect(() => PolicyConfigSchema.parse({})).not.toThrow();
      expect(() => AllowedPathsConfigSchema.parse({})).not.toThrow();
      expect(() => RequiredTestsConfigSchema.parse({})).not.toThrow();
      expect(() => ApprovalRulesConfigSchema.parse({})).not.toThrow();
    });

    it('should reject invalid data types', () => {
      expect(() => PolicyConfigSchema.parse('not-an-object')).toThrow();
      expect(() => PolicyConfigSchema.parse(123)).toThrow();
      expect(() => PolicyConfigSchema.parse([])).toThrow();
      expect(() => PolicyConfigSchema.parse(true)).toThrow();
    });
  });

  describe('String Validation Edge Cases', () => {
    it('should handle whitespace-only strings', () => {
      expect(() => TestRequirementRuleSchema.parse({
        name: '   ', // whitespace only
        filePatterns: ['src/**/*.ts']
      })).toThrow();

      expect(() => ApprovalRuleSchema.parse({
        id: '\t\n', // tabs and newlines
        name: 'Test Rule',
        conditions: []
      })).toThrow();
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);

      expect(() => PolicyConfigSchema.parse({
        name: longString,
        description: longString
      })).not.toThrow();

      expect(() => TestRequirementRuleSchema.parse({
        name: longString,
        filePatterns: ['src/**/*.ts']
      })).not.toThrow();
    });

    it('should handle special characters in strings', () => {
      const specialChars = 'Special!@#$%^&*()_+-={}[]|\\:";\'<>?,./~`';

      expect(() => PolicyConfigSchema.parse({
        name: specialChars,
        description: specialChars
      })).not.toThrow();

      expect(() => ApprovalRuleSchema.parse({
        id: 'rule-with-special-chars',
        name: specialChars,
        conditions: []
      })).not.toThrow();
    });

    it('should handle unicode characters', () => {
      const unicode = '测试 👍 🚀 أهلا مرحبا Ελληνικά';

      expect(() => PolicyConfigSchema.parse({
        name: unicode
      })).not.toThrow();

      expect(() => TestRequirementRuleSchema.parse({
        name: unicode,
        filePatterns: ['src/**/*.ts']
      })).not.toThrow();
    });
  });

  describe('Array Validation Edge Cases', () => {
    it('should handle empty arrays', () => {
      expect(() => AllowedPathsConfigSchema.parse({
        allow: [],
        block: []
      })).not.toThrow();

      expect(() => RequiredTestsConfigSchema.parse({
        rules: []
      })).not.toThrow();

      expect(() => ApprovalRulesConfigSchema.parse({
        rules: [],
        globalApprovers: []
      })).not.toThrow();
    });

    it('should handle arrays with invalid elements', () => {
      expect(() => AllowedPathsConfigSchema.parse({
        allow: ['valid/**', '', 'another/**'] // empty string in array
      })).toThrow();

      expect(() => PolicyConfigSchema.parse({
        tags: ['valid-tag', '', 'another-tag'] // empty string in tags
      })).toThrow();
    });

    it('should handle large arrays', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => `pattern-${i}/**`);

      expect(() => AllowedPathsConfigSchema.parse({
        allow: largeArray
      })).not.toThrow();

      const largeTags = Array.from({ length: 100 }, (_, i) => `tag-${i}`);
      expect(() => PolicyConfigSchema.parse({
        tags: largeTags
      })).not.toThrow();
    });

    it('should reject non-array values for array fields', () => {
      expect(() => AllowedPathsConfigSchema.parse({
        allow: 'not-an-array'
      })).toThrow();

      expect(() => PolicyConfigSchema.parse({
        tags: 'not-an-array'
      })).toThrow();

      expect(() => RequiredTestsConfigSchema.parse({
        rules: 'not-an-array'
      })).toThrow();
    });
  });

  describe('Numeric Validation Edge Cases', () => {
    it('should handle boundary values for coverage percentages', () => {
      expect(() => TestRequirementRuleSchema.parse({
        name: 'test-rule',
        filePatterns: ['src/**/*.ts'],
        minCoverage: 0 // minimum valid value
      })).not.toThrow();

      expect(() => TestRequirementRuleSchema.parse({
        name: 'test-rule',
        filePatterns: ['src/**/*.ts'],
        minCoverage: 100 // maximum valid value
      })).not.toThrow();

      expect(() => TestRequirementRuleSchema.parse({
        name: 'test-rule',
        filePatterns: ['src/**/*.ts'],
        minCoverage: -0.1 // just below minimum
      })).toThrow();

      expect(() => TestRequirementRuleSchema.parse({
        name: 'test-rule',
        filePatterns: ['src/**/*.ts'],
        minCoverage: 100.1 // just above maximum
      })).toThrow();
    });

    it('should handle boundary values for timeout minutes', () => {
      expect(() => ApprovalRulesConfigSchema.parse({
        defaultTimeoutMinutes: 1 // minimum valid value
      })).not.toThrow();

      expect(() => ApprovalRuleSchema.parse({
        id: 'test-rule',
        name: 'Test Rule',
        conditions: [],
        timeoutMinutes: 1 // minimum valid value
      })).not.toThrow();

      expect(() => ApprovalRulesConfigSchema.parse({
        defaultTimeoutMinutes: 0 // below minimum
      })).toThrow();

      expect(() => ApprovalRuleSchema.parse({
        id: 'test-rule',
        name: 'Test Rule',
        conditions: [],
        timeoutMinutes: 0 // below minimum
      })).toThrow();
    });

    it('should handle floating point numbers correctly', () => {
      expect(() => TestRequirementRuleSchema.parse({
        name: 'test-rule',
        filePatterns: ['src/**/*.ts'],
        minCoverage: 85.5 // decimal value
      })).not.toThrow();

      expect(() => ApprovalConditionSchema.parse({
        type: 'cost_threshold',
        threshold: 10.99,
        operator: 'greater_than'
      })).not.toThrow();
    });

    it('should reject invalid number types', () => {
      expect(() => TestRequirementRuleSchema.parse({
        name: 'test-rule',
        filePatterns: ['src/**/*.ts'],
        minCoverage: 'not-a-number'
      })).toThrow();

      expect(() => ApprovalRuleSchema.parse({
        id: 'test-rule',
        name: 'Test Rule',
        conditions: [],
        priority: 'not-a-number'
      })).toThrow();

      expect(() => ApprovalRuleSchema.parse({
        id: 'test-rule',
        name: 'Test Rule',
        conditions: [],
        timeoutMinutes: 'not-a-number'
      })).toThrow();
    });

    it('should handle very large numbers', () => {
      expect(() => ApprovalRuleSchema.parse({
        id: 'test-rule',
        name: 'Test Rule',
        conditions: [],
        priority: Number.MAX_SAFE_INTEGER
      })).not.toThrow();

      expect(() => ApprovalConditionSchema.parse({
        type: 'cost_threshold',
        threshold: 999999.99,
        operator: 'greater_than'
      })).not.toThrow();
    });
  });

  describe('Boolean Validation Edge Cases', () => {
    it('should accept only true boolean values', () => {
      expect(() => PolicyConfigSchema.parse({ enabled: true })).not.toThrow();
      expect(() => PolicyConfigSchema.parse({ enabled: false })).not.toThrow();
    });

    it('should reject truthy/falsy values that are not booleans', () => {
      expect(() => PolicyConfigSchema.parse({ enabled: 1 })).toThrow();
      expect(() => PolicyConfigSchema.parse({ enabled: 0 })).toThrow();
      expect(() => PolicyConfigSchema.parse({ enabled: 'true' })).toThrow();
      expect(() => PolicyConfigSchema.parse({ enabled: 'false' })).toThrow();
      expect(() => PolicyConfigSchema.parse({ enabled: null })).toThrow();
      expect(() => PolicyConfigSchema.parse({ enabled: undefined })).toThrow();
    });
  });

  describe('Complex Nested Validation', () => {
    it('should validate deeply nested invalid configurations', () => {
      expect(() => PolicyConfigSchema.parse({
        allowedPaths: {
          mode: 'allowlist',
          allow: ['valid/**', '', 'another/**'] // invalid element in nested array
        }
      })).toThrow();

      expect(() => PolicyConfigSchema.parse({
        requiredTests: {
          rules: [
            {
              name: 'valid-rule',
              filePatterns: ['src/**/*.ts']
            },
            {
              name: '', // invalid nested rule
              filePatterns: ['src/**/*.ts']
            }
          ]
        }
      })).toThrow();

      expect(() => PolicyConfigSchema.parse({
        approvalRules: {
          rules: [
            {
              id: 'rule1',
              name: 'Rule 1',
              conditions: []
            },
            {
              id: 'rule2',
              name: 'Rule 2',
              conditions: [
                {
                  type: 'invalid_type', // invalid condition type
                  operator: 'equals'
                }
              ]
            }
          ]
        }
      })).toThrow();
    });

    it('should handle partial updates correctly', () => {
      // Test that partial configs with only some fields work
      expect(() => PolicyConfigSchema.parse({
        name: 'Partial Config',
        allowedPaths: {
          mode: 'blocklist',
          block: ['node_modules/**']
        }
        // Other fields should use defaults
      })).not.toThrow();

      expect(() => PolicyConfigSchema.parse({
        enforcement: 'strict',
        approvalRules: {
          enabled: false
        }
        // Other fields should use defaults
      })).not.toThrow();
    });
  });

  describe('Pattern Validation Edge Cases', () => {
    it('should handle complex glob patterns', () => {
      const complexPatterns = [
        'src/**/*.{ts,tsx,js,jsx}',
        '**/*@(test|spec).{ts,js}',
        'packages/*/src/**/*.ts',
        '!(node_modules|dist|build)/**',
        '{src,tests}/**/*.{ts,js}',
        'src/**/!(*.test|*.spec).ts'
      ];

      expect(() => AllowedPathsConfigSchema.parse({
        allow: complexPatterns
      })).not.toThrow();

      expect(() => TestRequirementRuleSchema.parse({
        name: 'complex-patterns',
        filePatterns: complexPatterns,
        testPatterns: complexPatterns
      })).not.toThrow();
    });

    it('should handle empty pattern arrays', () => {
      expect(() => TestRequirementRuleSchema.parse({
        name: 'empty-patterns',
        filePatterns: []
      })).toThrow(); // filePatterns is required and must not be empty

      expect(() => AllowedPathsConfigSchema.parse({
        allow: [], // empty is allowed
        block: []  // empty is allowed
      })).not.toThrow();
    });

    it('should handle patterns with special characters', () => {
      const specialPatterns = [
        'src/**/*[._-]*.ts',
        'tests/**/*.@(test|spec).{ts,js}',
        'packages/*/!(dist|node_modules)/**',
        'src/**/{components,utils,services}/**'
      ];

      expect(() => AllowedPathsConfigSchema.parse({
        allow: specialPatterns
      })).not.toThrow();
    });
  });

  describe('Metadata Validation Edge Cases', () => {
    it('should handle various metadata types', () => {
      const metadata = {
        stringValue: 'test',
        numberValue: 42,
        booleanValue: true,
        nullValue: null,
        arrayValue: [1, 2, 3],
        objectValue: { nested: 'value' }
      };

      expect(() => PolicyConfigSchema.parse({
        metadata
      })).not.toThrow();
    });

    it('should handle deeply nested metadata', () => {
      const deepMetadata = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: 'deep value'
              }
            }
          }
        }
      };

      expect(() => PolicyConfigSchema.parse({
        metadata: deepMetadata
      })).not.toThrow();
    });

    it('should handle metadata with special keys', () => {
      const metadataWithSpecialKeys = {
        'key-with-dashes': 'value',
        'key.with.dots': 'value',
        'key with spaces': 'value',
        'key_with_underscores': 'value',
        '123numeric-key': 'value',
        'unicode-key-测试': 'value'
      };

      expect(() => PolicyConfigSchema.parse({
        metadata: metadataWithSpecialKeys
      })).not.toThrow();
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle large configurations efficiently', () => {
      const largeConfig = {
        name: 'Large Configuration Test',
        allowedPaths: {
          allow: Array.from({ length: 1000 }, (_, i) => `path-${i}/**`),
          block: Array.from({ length: 500 }, (_, i) => `block-${i}/**`)
        },
        requiredTests: {
          rules: Array.from({ length: 100 }, (_, i) => ({
            name: `rule-${i}`,
            filePatterns: [`src/module-${i}/**/*.ts`],
            testPatterns: [`tests/module-${i}/**/*.test.ts`],
            minCoverage: Math.floor(Math.random() * 100)
          }))
        },
        approvalRules: {
          rules: Array.from({ length: 50 }, (_, i) => ({
            id: `approval-rule-${i}`,
            name: `Approval Rule ${i}`,
            conditions: [
              {
                type: 'cost_threshold',
                threshold: Math.random() * 100,
                operator: 'greater_than'
              }
            ]
          }))
        },
        tags: Array.from({ length: 200 }, (_, i) => `tag-${i}`),
        metadata: Object.fromEntries(
          Array.from({ length: 1000 }, (_, i) => [`key-${i}`, `value-${i}`])
        )
      };

      // This should complete without timeout or excessive memory usage
      const start = Date.now();
      expect(() => PolicyConfigSchema.parse(largeConfig)).not.toThrow();
      const duration = Date.now() - start;

      // Validation should be reasonably fast (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Cross-field Validation', () => {
    it('should validate relationships between fields', () => {
      // When enforcement is disabled, other rules should still be valid
      expect(() => PolicyConfigSchema.parse({
        enforcement: 'disabled',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**']
        }
      })).not.toThrow();

      // When approval rules are disabled, rules array can still exist
      expect(() => PolicyConfigSchema.parse({
        approvalRules: {
          enabled: false,
          rules: [
            {
              id: 'rule1',
              name: 'Rule 1',
              conditions: []
            }
          ]
        }
      })).not.toThrow();
    });

    it('should handle conflicting settings gracefully', () => {
      // Test that schemas don't enforce business logic conflicts (that's for runtime)
      expect(() => PolicyConfigSchema.parse({
        enforcement: 'disabled',
        requiredTests: {
          enforcement: 'require', // Conflicting with global disabled
          rules: []
        }
      })).not.toThrow(); // Schema validation allows this, business logic handles conflicts
    });
  });
});