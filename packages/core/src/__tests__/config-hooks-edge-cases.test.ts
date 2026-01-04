import { describe, it, expect } from 'vitest';
import { HookConfigSchema, HookTypeSchema, HookHandlerSchema } from '../types';

describe('Hook Configuration Edge Cases and Error Handling', () => {
  describe('HookTypeSchema validation edge cases', () => {
    it('should reject invalid hook types', () => {
      const invalidTypes = [
        'invalid-type',
        'before-deploy', // Not a valid type
        'after-build',   // Not a valid type
        'on-failure',    // Should be 'on-error'
        'pre-commit',    // Should be 'before-commit'
        'post-commit',   // Should be 'after-commit'
        '',
        null,
        undefined,
        123,
        true,
        {},
        [],
      ];

      for (const invalidType of invalidTypes) {
        const result = HookTypeSchema.safeParse(invalidType);
        expect(result.success).toBe(false);
      }
    });

    it('should accept all valid hook types', () => {
      const validTypes = [
        'before-task',
        'after-task',
        'before-stage',
        'after-stage',
        'before-commit',
        'after-commit',
        'before-push',
        'after-push',
        'on-error',
        'on-success',
      ];

      for (const validType of validTypes) {
        const result = HookTypeSchema.safeParse(validType);
        expect(result.success).toBe(true);
        expect(result.data).toBe(validType);
      }
    });
  });

  describe('HookHandlerSchema validation edge cases', () => {
    it('should reject malformed file handlers', () => {
      const invalidFileHandlers = [
        // Missing path
        { type: 'file' },
        { type: 'file', path: '' },
        { type: 'file', path: null },
        { type: 'file', path: undefined },

        // Invalid args
        { type: 'file', path: '/valid/path.sh', args: 'not-an-array' },
        { type: 'file', path: '/valid/path.sh', args: [123, true] },
        { type: 'file', path: '/valid/path.sh', args: null },

        // Invalid type
        { type: 'not-file', path: '/valid/path.sh' },
      ];

      for (const handler of invalidFileHandlers) {
        const result = HookHandlerSchema.safeParse(handler);
        expect(result.success).toBe(false);
      }
    });

    it('should reject malformed inline handlers', () => {
      const invalidInlineHandlers = [
        // Missing code
        { type: 'inline' },
        { type: 'inline', code: '' },
        { type: 'inline', code: null },
        { type: 'inline', code: undefined },

        // Invalid language
        { type: 'inline', code: 'echo test', language: 'python' },
        { type: 'inline', code: 'echo test', language: 'invalid' },
        { type: 'inline', code: 'echo test', language: null },
        { type: 'inline', code: 'echo test', language: 123 },

        // Invalid type
        { type: 'not-inline', code: 'echo test' },
      ];

      for (const handler of invalidInlineHandlers) {
        const result = HookHandlerSchema.safeParse(handler);
        expect(result.success).toBe(false);
      }
    });

    it('should accept valid file handlers with various configurations', () => {
      const validFileHandlers = [
        { type: 'file', path: './script.sh' },
        { type: 'file', path: '/absolute/path/script.py' },
        { type: 'file', path: '~/home/script.js' },
        { type: 'file', path: '../relative/script.ts' },
        { type: 'file', path: './script.sh', args: [] },
        { type: 'file', path: './script.sh', args: ['--verbose'] },
        { type: 'file', path: './script.sh', args: ['--config', 'prod.json', '--force'] },
      ];

      for (const handler of validFileHandlers) {
        const result = HookHandlerSchema.safeParse(handler);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(handler);
      }
    });

    it('should accept valid inline handlers with language defaults', () => {
      const validInlineHandlers = [
        { type: 'inline', code: 'echo "test"' },
        { type: 'inline', code: 'console.log("test")', language: 'javascript' },
        { type: 'inline', code: 'console.log("test")', language: 'typescript' },
        { type: 'inline', code: '#!/bin/bash\necho "test"', language: 'bash' },
      ];

      for (const handler of validInlineHandlers) {
        const result = HookHandlerSchema.safeParse(handler);
        expect(result.success).toBe(true);

        if (!handler.language) {
          expect(result.data?.language).toBe('bash'); // default
        } else {
          expect(result.data?.language).toBe(handler.language);
        }
      }
    });

    it('should reject completely invalid handler structures', () => {
      const invalidHandlers = [
        null,
        undefined,
        'string',
        123,
        true,
        [],
        {},
        { invalidProperty: 'value' },
        { type: 'unknown', someOtherProp: 'value' },
      ];

      for (const handler of invalidHandlers) {
        const result = HookHandlerSchema.safeParse(handler);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('HookConfigSchema validation edge cases', () => {
    it('should reject hooks with invalid names', () => {
      const invalidNames = ['', '   ', null, undefined, 123, true, {}, []];

      for (const name of invalidNames) {
        const hookConfig = {
          name,
          type: 'before-task',
          handler: { type: 'inline', code: 'echo test' },
        };

        const result = HookConfigSchema.safeParse(hookConfig);
        expect(result.success).toBe(false);
      }
    });

    it('should handle extreme priority values', () => {
      const priorityTests = [
        { priority: Number.MAX_SAFE_INTEGER, shouldPass: true },
        { priority: Number.MIN_SAFE_INTEGER, shouldPass: true },
        { priority: 0, shouldPass: true },
        { priority: -1000000, shouldPass: true },
        { priority: 1.5, shouldPass: false }, // Not an integer
        { priority: Number.POSITIVE_INFINITY, shouldPass: false },
        { priority: Number.NEGATIVE_INFINITY, shouldPass: false },
        { priority: NaN, shouldPass: false },
        { priority: 'high', shouldPass: false },
        { priority: null, shouldPass: false },
      ];

      for (const test of priorityTests) {
        const hookConfig = {
          name: 'priority-test',
          type: 'before-task',
          handler: { type: 'inline', code: 'echo test' },
          priority: test.priority,
        };

        const result = HookConfigSchema.safeParse(hookConfig);
        expect(result.success).toBe(test.shouldPass);
      }
    });

    it('should handle invalid timeout values', () => {
      const timeoutTests = [
        { timeoutMs: 1000, shouldPass: true }, // Minimum valid
        { timeoutMs: 999, shouldPass: false }, // Below minimum
        { timeoutMs: 0, shouldPass: false },
        { timeoutMs: -1000, shouldPass: false },
        { timeoutMs: 1.5, shouldPass: false }, // Not an integer
        { timeoutMs: 'long', shouldPass: false },
        { timeoutMs: null, shouldPass: false },
        { timeoutMs: Number.MAX_SAFE_INTEGER, shouldPass: true },
      ];

      for (const test of timeoutTests) {
        const hookConfig = {
          name: 'timeout-test',
          type: 'before-task',
          handler: { type: 'inline', code: 'echo test' },
          timeoutMs: test.timeoutMs,
        };

        const result = HookConfigSchema.safeParse(hookConfig);
        expect(result.success).toBe(test.shouldPass);
      }
    });

    it('should handle invalid boolean values for enabled and failOnError', () => {
      const booleanTests = [
        { value: true, shouldPass: true },
        { value: false, shouldPass: true },
        { value: 'true', shouldPass: false },
        { value: 'false', shouldPass: false },
        { value: 1, shouldPass: false },
        { value: 0, shouldPass: false },
        { value: null, shouldPass: false },
        { value: undefined, shouldPass: false },
        { value: {}, shouldPass: false },
        { value: [], shouldPass: false },
      ];

      for (const test of booleanTests) {
        // Test enabled field
        const hookConfigEnabled = {
          name: 'enabled-test',
          type: 'before-task',
          handler: { type: 'inline', code: 'echo test' },
          enabled: test.value,
        };

        const resultEnabled = HookConfigSchema.safeParse(hookConfigEnabled);
        expect(resultEnabled.success).toBe(test.shouldPass);

        // Test failOnError field
        const hookConfigFailOnError = {
          name: 'fail-on-error-test',
          type: 'before-task',
          handler: { type: 'inline', code: 'echo test' },
          failOnError: test.value,
        };

        const resultFailOnError = HookConfigSchema.safeParse(hookConfigFailOnError);
        expect(resultFailOnError.success).toBe(test.shouldPass);
      }
    });

    it('should validate hook conditions with invalid values', () => {
      const invalidConditions = [
        // Invalid stages
        { stages: 'not-an-array' },
        { stages: [123, true] },
        { stages: null },

        // Invalid agents
        { agents: 'not-an-array' },
        { agents: [null, undefined] },
        { agents: {} },

        // Invalid filePatterns
        { filePatterns: 'not-an-array' },
        { filePatterns: [123] },
        { filePatterns: false },

        // Invalid env
        { env: 'not-an-object' },
        { env: [] },
        { env: null },
        { env: { key: 123 } }, // Values must be strings
        { env: { 123: 'value' } }, // Keys must be strings
      ];

      for (const conditions of invalidConditions) {
        const hookConfig = {
          name: 'conditions-test',
          type: 'before-task',
          handler: { type: 'inline', code: 'echo test' },
          conditions,
        };

        const result = HookConfigSchema.safeParse(hookConfig);
        expect(result.success).toBe(false);
      }
    });

    it('should accept valid complex conditions', () => {
      const validConditions = [
        // Empty conditions object
        {},

        // Individual properties
        { stages: ['planning', 'implementation'] },
        { agents: ['planner'] },
        { filePatterns: ['src/**/*.ts'] },
        { env: { NODE_ENV: 'development' } },

        // Combined properties
        {
          stages: ['testing', 'deployment'],
          agents: ['tester', 'devops'],
          filePatterns: ['tests/**/*.test.ts', 'deployment/**/*.yml'],
          env: {
            ENVIRONMENT: 'staging',
            BRANCH: 'develop',
            BUILD_TYPE: 'debug',
          },
        },

        // Empty arrays and objects
        { stages: [] },
        { agents: [] },
        { filePatterns: [] },
        { env: {} },
      ];

      for (const conditions of validConditions) {
        const hookConfig = {
          name: 'valid-conditions-test',
          type: 'before-task',
          handler: { type: 'inline', code: 'echo test' },
          conditions,
        };

        const result = HookConfigSchema.safeParse(hookConfig);
        expect(result.success).toBe(true);
        expect(result.data?.conditions).toEqual(conditions);
      }
    });

    it('should handle missing required fields', () => {
      const incompleteConfigs = [
        // Missing name
        {
          type: 'before-task',
          handler: { type: 'inline', code: 'echo test' },
        },

        // Missing type
        {
          name: 'test-hook',
          handler: { type: 'inline', code: 'echo test' },
        },

        // Missing handler
        {
          name: 'test-hook',
          type: 'before-task',
        },

        // Completely empty
        {},

        // Only optional fields
        {
          priority: 100,
          enabled: true,
          description: 'test',
        },
      ];

      for (const config of incompleteConfigs) {
        const result = HookConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }
    });

    it('should apply correct defaults for optional fields', () => {
      const minimalConfig = {
        name: 'minimal-hook',
        type: 'before-task',
        handler: {
          type: 'inline',
          code: 'echo minimal',
        },
      };

      const result = HookConfigSchema.safeParse(minimalConfig);
      expect(result.success).toBe(true);
      expect(result.data?.priority).toBe(100);
      expect(result.data?.enabled).toBe(true);
      expect(result.data?.timeoutMs).toBe(30000);
      expect(result.data?.failOnError).toBe(true);
      expect(result.data?.handler.language).toBe('bash');
      expect(result.data?.description).toBeUndefined();
      expect(result.data?.conditions).toBeUndefined();
    });

    it('should handle deeply nested malformed data', () => {
      const malformedConfigs = [
        // Circular reference (would cause JSON serialization issues)
        (() => {
          const circular: any = {
            name: 'circular',
            type: 'before-task',
            handler: { type: 'inline', code: 'echo test' },
          };
          circular.self = circular;
          return circular;
        })(),

        // Extremely deep nesting in conditions
        {
          name: 'deep-nest',
          type: 'before-task',
          handler: { type: 'inline', code: 'echo test' },
          conditions: {
            env: {
              DEEP: {
                NESTED: {
                  OBJECT: 'should-fail',
                },
              },
            },
          },
        },

        // Function in data
        {
          name: 'function-data',
          type: 'before-task',
          handler: { type: 'inline', code: 'echo test' },
          invalidFunc: () => console.log('test'),
        },

        // Symbol property
        {
          name: 'symbol-data',
          type: 'before-task',
          handler: { type: 'inline', code: 'echo test' },
          [Symbol('test')]: 'symbol-value',
        },
      ];

      for (const config of malformedConfigs) {
        const result = HookConfigSchema.safeParse(config);
        // Should either fail validation or ignore unknown properties
        expect(result.success).toBe(false);
      }
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000); // Very long string

      const longStringConfigs = [
        {
          name: longString,
          type: 'before-task',
          handler: { type: 'inline', code: 'echo test' },
        },
        {
          name: 'test',
          type: 'before-task',
          handler: { type: 'inline', code: longString },
        },
        {
          name: 'test',
          type: 'before-task',
          handler: { type: 'file', path: longString },
        },
        {
          name: 'test',
          type: 'before-task',
          handler: { type: 'inline', code: 'echo test' },
          description: longString,
        },
      ];

      for (const config of longStringConfigs) {
        const result = HookConfigSchema.safeParse(config);
        // Should succeed - Zod doesn't have max length restrictions by default
        expect(result.success).toBe(true);
      }
    });

    it('should handle empty arrays and objects in conditions', () => {
      const hookConfig = {
        name: 'empty-conditions-test',
        type: 'before-task',
        handler: { type: 'inline', code: 'echo test' },
        conditions: {
          stages: [],
          agents: [],
          filePatterns: [],
          env: {},
        },
      };

      const result = HookConfigSchema.safeParse(hookConfig);
      expect(result.success).toBe(true);
      expect(result.data?.conditions?.stages).toEqual([]);
      expect(result.data?.conditions?.agents).toEqual([]);
      expect(result.data?.conditions?.filePatterns).toEqual([]);
      expect(result.data?.conditions?.env).toEqual({});
    });

    it('should handle special characters in strings', () => {
      const specialChars = [
        '!@#$%^&*()_+-=[]{}|;:,.<>?',
        'unicode-test-🚀-🎉',
        'newlines\n\r\ntabs\t\tspaces   ',
        'quotes"and\'apostrophes`backticks',
        'path/with\\backslashes/and/forward/slashes',
        '../../dangerous/../paths',
        '${VARIABLE_INJECTION}',
        '$(command substitution)',
        '<script>alert("xss")</script>',
      ];

      for (const specialChar of specialChars) {
        const hookConfig = {
          name: `special-char-test-${Date.now()}`,
          type: 'before-task',
          handler: {
            type: 'inline',
            code: `echo "${specialChar}"`,
          },
          description: specialChar,
        };

        const result = HookConfigSchema.safeParse(hookConfig);
        expect(result.success).toBe(true);
        expect(result.data?.description).toBe(specialChar);
        expect(result.data?.handler.code).toBe(`echo "${specialChar}"`);
      }
    });
  });
});