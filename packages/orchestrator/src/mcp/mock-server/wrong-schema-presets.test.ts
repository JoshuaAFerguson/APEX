/**
 * @fileoverview Comprehensive Tests for wrong_schema Error Presets
 *
 * Tests the wrong_schema error presets including:
 * - Preset configuration validation
 * - Error message accuracy and consistency
 * - JSON-RPC specification compliance
 * - Integration with MockMCPServer
 * - Edge cases and error scenarios
 *
 * @module orchestrator/mcp/mock-server/wrong-schema-presets.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockMCPServer } from './mock-mcp-server.js';
import {
  getErrorPreset,
  mergePresetWithOverrides,
  ERROR_SIMULATION_PRESETS,
} from './error-presets.js';
import type {
  MockErrorScenarioPreset,
  MockErrorSimulationConfig,
} from '@apexcli/core';

describe('wrong_schema Error Presets', () => {
  describe('Preset Configuration Validation', () => {
    it('should have consistent error codes for all wrong_schema presets', () => {
      const wrongSchemaPresets = [
        'wrong_schema_missing_id',
        'wrong_schema_invalid_result',
        'wrong_schema_extra_fields',
      ] as const;

      for (const presetName of wrongSchemaPresets) {
        const preset = ERROR_SIMULATION_PRESETS[presetName];

        expect(preset.customError?.code).toBe(-32700);
        expect(preset.category).toBe('transport');
        expect(preset.mode).toBe('always_fail');
        expect(preset.description).toBeTruthy();
        expect(preset.description!.length).toBeGreaterThan(0);
      }
    });

    it('should have JSON-RPC specification references', () => {
      const wrongSchemaPresets = [
        'wrong_schema_missing_id',
        'wrong_schema_invalid_result',
        'wrong_schema_extra_fields',
      ] as const;

      for (const presetName of wrongSchemaPresets) {
        const preset = ERROR_SIMULATION_PRESETS[presetName];
        const data = preset.customError?.data as any;

        expect(data?.specification).toBe('JSON-RPC 2.0');
      }
    });

    it('should provide detailed error information in data field', () => {
      const missingIdPreset = ERROR_SIMULATION_PRESETS.wrong_schema_missing_id;
      const invalidResultPreset = ERROR_SIMULATION_PRESETS.wrong_schema_invalid_result;
      const extraFieldsPreset = ERROR_SIMULATION_PRESETS.wrong_schema_extra_fields;

      // Missing ID preset should specify what's missing
      expect(missingIdPreset.customError?.data).toHaveProperty('invalidResponse');
      expect(missingIdPreset.customError?.data).toHaveProperty('missingFields');
      expect((missingIdPreset.customError?.data as any)?.missingFields).toEqual(['id']);

      // Invalid result preset should specify type expectations
      expect(invalidResultPreset.customError?.data).toHaveProperty('expectedTypes');
      expect(invalidResultPreset.customError?.data).toHaveProperty('receivedType');
      expect((invalidResultPreset.customError?.data as any)?.expectedTypes).toEqual(['object', 'null']);

      // Extra fields preset should list unexpected fields
      expect(extraFieldsPreset.customError?.data).toHaveProperty('extraFields');
      expect(extraFieldsPreset.customError?.data).toHaveProperty('allowedFields');
      expect((extraFieldsPreset.customError?.data as any)?.extraFields).toContain('unexpectedField');
      expect((extraFieldsPreset.customError?.data as any)?.allowedFields).toContain('jsonrpc');
    });
  });

  describe('wrong_schema_missing_id preset', () => {
    it('should simulate missing id field correctly', () => {
      const preset = getErrorPreset('wrong_schema_missing_id');

      expect(preset?.customError?.message).toBe('Response missing required field: id');

      const data = preset?.customError?.data as any;
      expect(data?.invalidResponse).toEqual({
        jsonrpc: '2.0',
        result: {}
      });
      expect(data?.missingFields).toEqual(['id']);
    });

    it('should be categorized as transport error', () => {
      const preset = getErrorPreset('wrong_schema_missing_id');
      expect(preset?.category).toBe('transport');
    });

    it('should use proper JSON-RPC error code for parse errors', () => {
      const preset = getErrorPreset('wrong_schema_missing_id');
      expect(preset?.customError?.code).toBe(-32700);
    });

    it('should support configuration overrides', () => {
      const merged = mergePresetWithOverrides('wrong_schema_missing_id', {
        customError: {
          message: 'Custom missing ID message',
          data: {
            customField: 'custom value',
          },
        },
      });

      expect(merged.customError?.message).toBe('Custom missing ID message');
      expect(merged.customError?.data).toEqual({ customField: 'custom value' });
      expect(merged.mode).toBe('always_fail'); // Should preserve other preset properties
    });
  });

  describe('wrong_schema_invalid_result preset', () => {
    it('should simulate invalid result field structure', () => {
      const preset = getErrorPreset('wrong_schema_invalid_result');

      expect(preset?.customError?.message).toBe('Response result field has invalid structure');

      const data = preset?.customError?.data as any;
      expect(data?.invalidResponse).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: 'should be object or null'
      });
      expect(data?.expectedTypes).toEqual(['object', 'null']);
      expect(data?.receivedType).toBe('string');
    });

    it('should provide type validation information', () => {
      const preset = getErrorPreset('wrong_schema_invalid_result');
      const data = preset?.customError?.data as any;

      expect(data?.expectedTypes).toBeInstanceOf(Array);
      expect(data?.expectedTypes.length).toBeGreaterThan(0);
      expect(data?.receivedType).toBeTruthy();
    });

    it('should support configuration overrides for type information', () => {
      const merged = mergePresetWithOverrides('wrong_schema_invalid_result', {
        customError: {
          data: {
            expectedTypes: ['object'],
            receivedType: 'number',
            invalidResponse: {
              jsonrpc: '2.0',
              id: 2,
              result: 42
            }
          },
        },
      });

      const data = merged.customError?.data as any;
      expect(data?.expectedTypes).toEqual(['object']);
      expect(data?.receivedType).toBe('number');
      expect(data?.invalidResponse?.result).toBe(42);
    });
  });

  describe('wrong_schema_extra_fields preset', () => {
    it('should simulate unexpected extra fields in response', () => {
      const preset = getErrorPreset('wrong_schema_extra_fields');

      expect(preset?.customError?.message).toBe('Response contains unexpected fields');

      const data = preset?.customError?.data as any;
      expect(data?.invalidResponse).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: {},
        unexpectedField: 'not allowed',
        anotherExtra: 123
      });
      expect(data?.extraFields).toEqual(['unexpectedField', 'anotherExtra']);
      expect(data?.allowedFields).toContain('jsonrpc');
      expect(data?.allowedFields).toContain('id');
      expect(data?.allowedFields).toContain('result');
      expect(data?.allowedFields).toContain('error');
    });

    it('should list both detected extra fields and allowed fields', () => {
      const preset = getErrorPreset('wrong_schema_extra_fields');
      const data = preset?.customError?.data as any;

      expect(data?.extraFields).toBeInstanceOf(Array);
      expect(data?.extraFields.length).toBeGreaterThan(0);
      expect(data?.allowedFields).toBeInstanceOf(Array);
      expect(data?.allowedFields.length).toBeGreaterThan(0);
    });

    it('should support configuration overrides for field validation', () => {
      const merged = mergePresetWithOverrides('wrong_schema_extra_fields', {
        customError: {
          data: {
            extraFields: ['customExtra'],
            allowedFields: ['jsonrpc', 'id', 'result'],
            invalidResponse: {
              jsonrpc: '2.0',
              id: 3,
              result: null,
              customExtra: 'forbidden'
            }
          },
        },
      });

      const data = merged.customError?.data as any;
      expect(data?.extraFields).toEqual(['customExtra']);
      expect(data?.allowedFields).toEqual(['jsonrpc', 'id', 'result']);
      expect(data?.invalidResponse?.customExtra).toBe('forbidden');
    });
  });

  describe('Error Message Clarity and Usefulness', () => {
    it('should provide actionable error messages', () => {
      const missingIdPreset = ERROR_SIMULATION_PRESETS.wrong_schema_missing_id;
      const invalidResultPreset = ERROR_SIMULATION_PRESETS.wrong_schema_invalid_result;
      const extraFieldsPreset = ERROR_SIMULATION_PRESETS.wrong_schema_extra_fields;

      // Messages should be specific and actionable
      expect(missingIdPreset.customError?.message).toContain('missing required field');
      expect(invalidResultPreset.customError?.message).toContain('invalid structure');
      expect(extraFieldsPreset.customError?.message).toContain('unexpected fields');

      // Should identify the specific issue
      expect(missingIdPreset.customError?.message).toContain('id');
      expect(invalidResultPreset.customError?.message).toContain('result');
      expect(extraFieldsPreset.customError?.message).toContain('fields');
    });

    it('should follow consistent error message patterns', () => {
      const wrongSchemaPresets = [
        'wrong_schema_missing_id',
        'wrong_schema_invalid_result',
        'wrong_schema_extra_fields',
      ] as const;

      for (const presetName of wrongSchemaPresets) {
        const preset = ERROR_SIMULATION_PRESETS[presetName];
        const message = preset.customError?.message;

        expect(message).toBeTruthy();
        expect(message!.length).toBeGreaterThan(10); // Should be descriptive
        expect(message!.charAt(0).toUpperCase()).toBe(message!.charAt(0)); // Should be properly capitalized
        expect(message!.endsWith('.')).toBeFalsy(); // Should not end with period (JSON-RPC convention)
      }
    });

    it('should provide debugging context in data fields', () => {
      const wrongSchemaPresets = [
        'wrong_schema_missing_id',
        'wrong_schema_invalid_result',
        'wrong_schema_extra_fields',
      ] as const;

      for (const presetName of wrongSchemaPresets) {
        const preset = ERROR_SIMULATION_PRESETS[presetName];
        const data = preset.customError?.data as any;

        expect(data?.invalidResponse).toBeTruthy();
        expect(data?.specification).toBe('JSON-RPC 2.0');

        // Should provide specific diagnostic information
        if (presetName === 'wrong_schema_missing_id') {
          expect(data?.missingFields).toBeInstanceOf(Array);
        } else if (presetName === 'wrong_schema_invalid_result') {
          expect(data?.expectedTypes).toBeInstanceOf(Array);
          expect(data?.receivedType).toBeTruthy();
        } else if (presetName === 'wrong_schema_extra_fields') {
          expect(data?.extraFields).toBeInstanceOf(Array);
          expect(data?.allowedFields).toBeInstanceOf(Array);
        }
      }
    });
  });

  describe('JSON-RPC Specification Compliance', () => {
    it('should use appropriate error codes for schema violations', () => {
      const wrongSchemaPresets = [
        'wrong_schema_missing_id',
        'wrong_schema_invalid_result',
        'wrong_schema_extra_fields',
      ] as const;

      // All schema violations should use parse error code (-32700)
      // according to JSON-RPC 2.0 specification
      for (const presetName of wrongSchemaPresets) {
        const preset = ERROR_SIMULATION_PRESETS[presetName];
        expect(preset.customError?.code).toBe(-32700);
      }
    });

    it('should maintain JSON-RPC response structure in examples', () => {
      const wrongSchemaPresets = [
        'wrong_schema_missing_id',
        'wrong_schema_invalid_result',
        'wrong_schema_extra_fields',
      ] as const;

      for (const presetName of wrongSchemaPresets) {
        const preset = ERROR_SIMULATION_PRESETS[presetName];
        const data = preset.customError?.data as any;
        const invalidResponse = data?.invalidResponse;

        expect(invalidResponse).toBeTruthy();

        // Should contain jsonrpc field (except for missing_id case where it's intentionally missing)
        if (presetName !== 'wrong_schema_missing_id' || invalidResponse.jsonrpc) {
          expect(invalidResponse.jsonrpc).toBe('2.0');
        }

        // Should demonstrate the specific schema violation
        if (presetName === 'wrong_schema_missing_id') {
          expect(invalidResponse.id).toBeUndefined();
        } else if (presetName === 'wrong_schema_invalid_result') {
          expect(typeof invalidResponse.result).toBe('string'); // Should be invalid type
        } else if (presetName === 'wrong_schema_extra_fields') {
          expect(invalidResponse.unexpectedField).toBeTruthy();
          expect(invalidResponse.anotherExtra).toBeTruthy();
        }
      }
    });

    it('should reference correct JSON-RPC specification version', () => {
      const wrongSchemaPresets = [
        'wrong_schema_missing_id',
        'wrong_schema_invalid_result',
        'wrong_schema_extra_fields',
      ] as const;

      for (const presetName of wrongSchemaPresets) {
        const preset = ERROR_SIMULATION_PRESETS[presetName];
        const data = preset.customError?.data as any;

        expect(data?.specification).toBe('JSON-RPC 2.0');
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle preset merging with partial overrides', () => {
      // Test merging with only message override
      const merged1 = mergePresetWithOverrides('wrong_schema_missing_id', {
        customError: {
          message: 'Custom message only',
        },
      });

      expect(merged1.customError?.message).toBe('Custom message only');
      expect(merged1.customError?.code).toBe(-32700); // Should preserve original code
      expect(merged1.customError?.data).toBeTruthy(); // Should preserve original data

      // Test merging with only data override
      const merged2 = mergePresetWithOverrides('wrong_schema_invalid_result', {
        customError: {
          data: {
            customField: 'test',
          },
        },
      });

      expect(merged2.customError?.data).toEqual({ customField: 'test' });
      expect(merged2.customError?.message).toBe('Response result field has invalid structure');
      expect(merged2.customError?.code).toBe(-32700);
    });

    it('should maintain immutability of original presets', () => {
      const originalPreset = ERROR_SIMULATION_PRESETS.wrong_schema_missing_id;
      const originalMessage = originalPreset.customError?.message;
      const originalData = originalPreset.customError?.data;

      // Perform merge with overrides
      mergePresetWithOverrides('wrong_schema_missing_id', {
        customError: {
          message: 'Modified message',
          data: { modified: true },
        },
      });

      // Original should be unchanged
      expect(originalPreset.customError?.message).toBe(originalMessage);
      expect(originalPreset.customError?.data).toEqual(originalData);
    });

    it('should handle complex nested data overrides', () => {
      const merged = mergePresetWithOverrides('wrong_schema_extra_fields', {
        customError: {
          data: {
            invalidResponse: {
              jsonrpc: '2.0',
              id: 999,
              result: { custom: true },
              forbiddenField: 'not allowed',
            },
            extraFields: ['forbiddenField'],
            allowedFields: ['jsonrpc', 'id', 'result'],
            specification: 'JSON-RPC 2.0',
            additionalContext: 'Custom context',
          },
        },
      });

      const data = merged.customError?.data as any;
      expect(data?.invalidResponse?.id).toBe(999);
      expect(data?.invalidResponse?.forbiddenField).toBe('not allowed');
      expect(data?.extraFields).toEqual(['forbiddenField']);
      expect(data?.additionalContext).toBe('Custom context');
    });
  });
});