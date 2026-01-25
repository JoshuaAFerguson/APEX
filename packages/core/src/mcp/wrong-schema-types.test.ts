/**
 * @fileoverview Tests for wrong_schema Type Definitions and Schema Validation
 *
 * Validates that the new wrong_schema presets:
 * - Are properly defined in TypeScript types
 * - Pass Zod schema validation
 * - Work correctly with type inference
 * - Maintain type safety across the system
 *
 * @module @apex/core/mcp/wrong-schema-types.test
 */

import { describe, it, expect } from 'vitest';
import {
  MockErrorScenarioPresetSchema,
  MockErrorSimulationConfigSchema,
  type MockErrorScenarioPreset,
  type MockErrorSimulationConfig,
} from './mock-types.js';

describe('wrong_schema Type Definitions', () => {
  describe('MockErrorScenarioPreset Type', () => {
    it('should include all wrong_schema preset variants', () => {
      const wrongSchemaPresets: MockErrorScenarioPreset[] = [
        'wrong_schema_missing_id',
        'wrong_schema_invalid_result',
        'wrong_schema_extra_fields',
      ];

      // These should all be valid types without compilation errors
      for (const preset of wrongSchemaPresets) {
        expect(typeof preset).toBe('string');
        expect(preset.startsWith('wrong_schema_')).toBe(true);
      }
    });

    it('should allow wrong_schema presets in type guards', () => {
      const testPreset = 'wrong_schema_missing_id' as MockErrorScenarioPreset;

      const isWrongSchemaPreset = (preset: MockErrorScenarioPreset): boolean => {
        return preset.startsWith('wrong_schema_');
      };

      expect(isWrongSchemaPreset(testPreset)).toBe(true);
      expect(isWrongSchemaPreset('rate_limit')).toBe(false);
    });
  });

  describe('Schema Validation', () => {
    it('should validate wrong_schema_missing_id preset configuration', () => {
      const config: MockErrorSimulationConfig = {
        mode: 'always_fail',
        category: 'transport',
        preset: 'wrong_schema_missing_id',
        customError: {
          code: -32700,
          message: 'Response missing required field: id',
          data: {
            invalidResponse: { jsonrpc: '2.0', result: {} },
            missingFields: ['id'],
            specification: 'JSON-RPC 2.0',
          },
        },
      };

      const result = MockErrorSimulationConfigSchema.safeParse(config);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.preset).toBe('wrong_schema_missing_id');
        expect(result.data.category).toBe('transport');
        expect(result.data.customError?.code).toBe(-32700);
      }
    });

    it('should validate wrong_schema_invalid_result preset configuration', () => {
      const config: MockErrorSimulationConfig = {
        mode: 'method_pattern',
        methodPattern: '^tools/',
        category: 'transport',
        preset: 'wrong_schema_invalid_result',
        customError: {
          code: -32700,
          message: 'Response result field has invalid structure',
          data: {
            invalidResponse: {
              jsonrpc: '2.0',
              id: 1,
              result: 'should be object or null',
            },
            expectedTypes: ['object', 'null'],
            receivedType: 'string',
            specification: 'JSON-RPC 2.0',
          },
        },
      };

      const result = MockErrorSimulationConfigSchema.safeParse(config);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.preset).toBe('wrong_schema_invalid_result');
        expect(result.data.methodPattern).toBe('^tools/');
      }
    });

    it('should validate wrong_schema_extra_fields preset configuration', () => {
      const config: MockErrorSimulationConfig = {
        mode: 'fail_first_n',
        failCount: 3,
        category: 'transport',
        preset: 'wrong_schema_extra_fields',
        customError: {
          code: -32700,
          message: 'Response contains unexpected fields',
          data: {
            invalidResponse: {
              jsonrpc: '2.0',
              id: 1,
              result: {},
              unexpectedField: 'not allowed',
              anotherExtra: 123,
            },
            extraFields: ['unexpectedField', 'anotherExtra'],
            allowedFields: ['jsonrpc', 'id', 'result', 'error'],
            specification: 'JSON-RPC 2.0',
          },
        },
      };

      const result = MockErrorSimulationConfigSchema.safeParse(config);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.preset).toBe('wrong_schema_extra_fields');
        expect(result.data.failCount).toBe(3);
      }
    });

    it('should reject invalid wrong_schema preset names', () => {
      const config = {
        mode: 'always_fail',
        category: 'transport',
        preset: 'wrong_schema_invalid_variant', // Invalid
      };

      const result = MockErrorSimulationConfigSchema.safeParse(config);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.some(issue =>
          issue.path.includes('preset') &&
          issue.message.includes('Invalid enum value')
        )).toBe(true);
      }
    });

    it('should validate preset enum values directly', () => {
      const validPresets = [
        'wrong_schema_missing_id',
        'wrong_schema_invalid_result',
        'wrong_schema_extra_fields',
      ];

      const invalidPresets = [
        'wrong_schema',
        'wrong_schema_',
        'wrong_schema_unknown',
        'schema_wrong',
      ];

      for (const preset of validPresets) {
        const result = MockErrorScenarioPresetSchema.safeParse(preset);
        expect(result.success).toBe(true);
      }

      for (const preset of invalidPresets) {
        const result = MockErrorScenarioPresetSchema.safeParse(preset);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Type Inference and Safety', () => {
    it('should provide proper type inference for wrong_schema configurations', () => {
      // This test verifies that TypeScript correctly infers types
      const createConfig = (preset: MockErrorScenarioPreset): MockErrorSimulationConfig => {
        return {
          mode: 'always_fail',
          category: 'transport',
          preset,
          customError: {
            code: -32700,
            message: `Test error for ${preset}`,
          },
        };
      };

      const missingIdConfig = createConfig('wrong_schema_missing_id');
      const invalidResultConfig = createConfig('wrong_schema_invalid_result');
      const extraFieldsConfig = createConfig('wrong_schema_extra_fields');

      expect(missingIdConfig.preset).toBe('wrong_schema_missing_id');
      expect(invalidResultConfig.preset).toBe('wrong_schema_invalid_result');
      expect(extraFieldsConfig.preset).toBe('wrong_schema_extra_fields');
    });

    it('should support union types with wrong_schema presets', () => {
      type WrongSchemaPreset = Extract<MockErrorScenarioPreset, `wrong_schema_${string}`>;

      const wrongSchemaPresets: WrongSchemaPreset[] = [
        'wrong_schema_missing_id',
        'wrong_schema_invalid_result',
        'wrong_schema_extra_fields',
      ];

      expect(wrongSchemaPresets).toHaveLength(3);

      for (const preset of wrongSchemaPresets) {
        expect(preset.startsWith('wrong_schema_')).toBe(true);
      }
    });

    it('should work with generic type constraints', () => {
      function createWrongSchemaConfig<T extends MockErrorScenarioPreset>(
        preset: T extends `wrong_schema_${string}` ? T : never,
        errorMessage: string
      ): MockErrorSimulationConfig {
        return {
          mode: 'always_fail',
          category: 'transport',
          preset,
          customError: {
            code: -32700,
            message: errorMessage,
          },
        };
      }

      // These should compile without errors
      const missingIdConfig = createWrongSchemaConfig('wrong_schema_missing_id', 'Missing ID');
      const invalidResultConfig = createWrongSchemaConfig('wrong_schema_invalid_result', 'Invalid result');
      const extraFieldsConfig = createWrongSchemaConfig('wrong_schema_extra_fields', 'Extra fields');

      expect(missingIdConfig.preset).toBe('wrong_schema_missing_id');
      expect(invalidResultConfig.preset).toBe('wrong_schema_invalid_result');
      expect(extraFieldsConfig.preset).toBe('wrong_schema_extra_fields');

      // This would cause a TypeScript compilation error if uncommented:
      // const invalidConfig = createWrongSchemaConfig('rate_limit', 'Should not work');
    });
  });

  describe('Schema Data Structure Validation', () => {
    it('should validate complex nested error data structures', () => {
      const complexConfig: MockErrorSimulationConfig = {
        mode: 'sequence',
        sequence: [
          {
            outcome: 'error',
            error: {
              code: -32700,
              message: 'First wrong schema error',
              data: {
                invalidResponse: { jsonrpc: '2.0', result: {} },
                missingFields: ['id'],
                specification: 'JSON-RPC 2.0',
              },
            },
          },
          {
            outcome: 'error',
            error: {
              code: -32700,
              message: 'Second wrong schema error',
              data: {
                invalidResponse: {
                  jsonrpc: '2.0',
                  id: 1,
                  result: 'invalid type',
                },
                expectedTypes: ['object', 'null'],
                receivedType: 'string',
                specification: 'JSON-RPC 2.0',
              },
            },
          },
          {
            outcome: 'success',
          },
        ],
        category: 'transport',
        preset: 'wrong_schema_missing_id',
      };

      const result = MockErrorSimulationConfigSchema.safeParse(complexConfig);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.sequence).toHaveLength(3);
        expect(result.data.sequence![0].outcome).toBe('error');
        expect(result.data.sequence![2].outcome).toBe('success');
      }
    });

    it('should validate network conditions with wrong_schema presets', () => {
      const configWithNetwork: MockErrorSimulationConfig = {
        mode: 'periodic_fail',
        failPeriod: 3,
        category: 'transport',
        preset: 'wrong_schema_extra_fields',
        networkConditions: {
          latencyMs: 100,
          latencyJitter: 50,
          packetLoss: 0.1,
          bandwidth: 1000,
          connectionTimeout: 30000,
        },
        customError: {
          code: -32700,
          message: 'Network-affected schema error',
          data: {
            networkConditions: 'simulated',
            specification: 'JSON-RPC 2.0',
          },
        },
      };

      const result = MockErrorSimulationConfigSchema.safeParse(configWithNetwork);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.networkConditions?.latencyMs).toBe(100);
        expect(result.data.networkConditions?.packetLoss).toBe(0.1);
        expect(result.data.preset).toBe('wrong_schema_extra_fields');
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing preset system', () => {
      const existingPresets: MockErrorScenarioPreset[] = [
        'init_protocol_mismatch',
        'rate_limit',
        'tool_not_found',
        'connection_reset',
      ];

      const wrongSchemaPresets: MockErrorScenarioPreset[] = [
        'wrong_schema_missing_id',
        'wrong_schema_invalid_result',
        'wrong_schema_extra_fields',
      ];

      // All presets should be valid in the same type
      const allPresets: MockErrorScenarioPreset[] = [
        ...existingPresets,
        ...wrongSchemaPresets,
      ];

      for (const preset of allPresets) {
        const config: MockErrorSimulationConfig = {
          mode: 'always_fail',
          preset,
        };

        const result = MockErrorSimulationConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }
    });

    it('should work in arrays with mixed preset types', () => {
      const configs: MockErrorSimulationConfig[] = [
        {
          mode: 'always_fail',
          preset: 'rate_limit',
          category: 'application',
        },
        {
          mode: 'method_pattern',
          methodPattern: '^initialize$',
          preset: 'wrong_schema_missing_id',
          category: 'transport',
        },
        {
          mode: 'fail_first_n',
          failCount: 2,
          preset: 'wrong_schema_invalid_result',
          category: 'transport',
        },
      ];

      for (const config of configs) {
        const result = MockErrorSimulationConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }
    });
  });
});