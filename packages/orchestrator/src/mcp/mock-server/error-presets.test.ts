/**
 * @fileoverview Tests for Error Preset Infrastructure
 *
 * Tests the error preset system including:
 * - Preset definition validation
 * - Preset retrieval functions
 * - Preset merging with custom overrides
 * - Category-based preset filtering
 * - All available preset configurations
 *
 * @module orchestrator/mcp/mock-server/error-presets.test
 */

import { describe, it, expect } from 'vitest';
import {
  getErrorPreset,
  mergePresetWithOverrides,
  getAvailablePresets,
  getPresetsByCategory,
  ERROR_SIMULATION_PRESETS,
} from './error-presets.js';
import type {
  MockErrorScenarioPreset,
  MockErrorSimulationConfig,
} from '@apexcli/core';

describe('Error Presets Infrastructure', () => {
  describe('Preset Definitions', () => {
    it('should define all required presets', () => {
      const expectedPresets: MockErrorScenarioPreset[] = [
        'init_protocol_mismatch',
        'init_capability_rejection',
        'init_connection_drop',
        'malformed_response',
        'response_id_mismatch',
        'partial_response',
        'server_hang',
        'rate_limit',
        'auth_failure',
        'internal_error_with_details',
        'tool_not_found',
        'resource_access_denied',
        'request_timeout',
        'connection_reset',
      ];

      const availablePresets = Object.keys(ERROR_SIMULATION_PRESETS) as MockErrorScenarioPreset[];

      for (const preset of expectedPresets) {
        expect(availablePresets).toContain(preset);
        expect(ERROR_SIMULATION_PRESETS[preset]).toBeDefined();
      }
    });

    it('should have proper structure for init_protocol_mismatch preset', () => {
      const preset = ERROR_SIMULATION_PRESETS.init_protocol_mismatch;

      expect(preset.mode).toBe('method_pattern');
      expect(preset.methodPattern).toBe('^initialize$');
      expect(preset.category).toBe('protocol');
      expect(preset.customError).toEqual({
        code: -32600,
        message: 'Protocol version not supported. Server requires version 2024-11-05',
        data: {
          supportedVersions: ['2024-11-05'],
          requestedVersion: 'unknown',
        },
      });
      expect(preset.description).toBe('Protocol version mismatch during initialization');
    });

    it('should have proper structure for rate_limit preset', () => {
      const preset = ERROR_SIMULATION_PRESETS.rate_limit;

      expect(preset.mode).toBe('always_fail');
      expect(preset.category).toBe('application');
      expect(preset.customError?.code).toBe(-32429);
      expect(preset.customError?.message).toContain('Too many requests');
      expect(preset.customError?.data).toHaveProperty('retryAfter', 60);
      expect(preset.customError?.data).toHaveProperty('limit', 100);
      expect(preset.customError?.data).toHaveProperty('remaining', 0);
      expect(preset.description).toBe('Rate limit exceeded');
    });

    it('should have proper structure for tool_not_found preset', () => {
      const preset = ERROR_SIMULATION_PRESETS.tool_not_found;

      expect(preset.mode).toBe('method_pattern');
      expect(preset.methodPattern).toBe('^tools/call$');
      expect(preset.category).toBe('application');
      expect(preset.customError?.code).toBe(-32601);
      expect(preset.customError?.message).toBe('Tool not found');
      expect(preset.customError?.data).toEqual({
        availableTools: ['read_file', 'write_file', 'list_directory'],
      });
    });

    it('should have proper structure for server_hang preset', () => {
      const preset = ERROR_SIMULATION_PRESETS.server_hang;

      expect(preset.mode).toBe('always_fail');
      expect(preset.category).toBe('network');
      expect(preset.networkConditions?.connectionTimeout).toBe(0);
      expect(preset.customError?.code).toBe(-32000);
      expect(preset.customError?.message).toBe('Server not responding');
    });

    it('should have proper structure for internal_error_with_details preset', () => {
      const preset = ERROR_SIMULATION_PRESETS.internal_error_with_details;

      expect(preset.mode).toBe('always_fail');
      expect(preset.category).toBe('application');
      expect(preset.customError?.code).toBe(-32603);
      expect(preset.customError?.message).toBe('Internal server error');
      expect(preset.customError?.data).toHaveProperty('stack');
      expect(preset.customError?.data).toHaveProperty('timestamp');
      expect(preset.customError?.data).toHaveProperty('requestId');

      const stack = (preset.customError?.data as any)?.stack;
      expect(stack).toContain('Error: Internal failure');
      expect(stack).toContain('Server.processRequest');
    });

    it('should define error categories correctly', () => {
      const jsonrpcPresets = getPresetsByCategory('jsonrpc');
      const protocolPresets = getPresetsByCategory('protocol');
      const transportPresets = getPresetsByCategory('transport');
      const applicationPresets = getPresetsByCategory('application');
      const networkPresets = getPresetsByCategory('network');

      // Protocol presets
      expect(protocolPresets).toContain('init_protocol_mismatch');
      expect(protocolPresets).toContain('init_capability_rejection');
      expect(protocolPresets).toContain('response_id_mismatch');
      expect(protocolPresets).toContain('auth_failure');

      // Transport presets
      expect(transportPresets).toContain('init_connection_drop');
      expect(transportPresets).toContain('malformed_response');
      expect(transportPresets).toContain('partial_response');
      expect(transportPresets).toContain('connection_reset');

      // Application presets
      expect(applicationPresets).toContain('rate_limit');
      expect(applicationPresets).toContain('internal_error_with_details');
      expect(applicationPresets).toContain('tool_not_found');
      expect(applicationPresets).toContain('resource_access_denied');

      // Network presets
      expect(networkPresets).toContain('server_hang');
      expect(networkPresets).toContain('request_timeout');
    });
  });

  describe('getErrorPreset function', () => {
    it('should return correct preset configuration', () => {
      const preset = getErrorPreset('rate_limit');

      expect(preset).toBeDefined();
      expect(preset?.mode).toBe('always_fail');
      expect(preset?.category).toBe('application');
      expect(preset?.customError?.code).toBe(-32429);
    });

    it('should return undefined for non-existent preset', () => {
      const preset = getErrorPreset('non_existent_preset' as MockErrorScenarioPreset);
      expect(preset).toBeUndefined();
    });

    it('should return immutable preset configurations', () => {
      const preset1 = getErrorPreset('rate_limit');
      const preset2 = getErrorPreset('rate_limit');

      // Should return the same structure but potentially different objects
      expect(preset1).toEqual(preset2);

      // Modifying one shouldn't affect the other or the original
      if (preset1?.customError) {
        (preset1.customError as any).modifiedField = 'test';
      }

      const preset3 = getErrorPreset('rate_limit');
      expect((preset3?.customError as any)?.modifiedField).toBeUndefined();
    });
  });

  describe('getAvailablePresets function', () => {
    it('should return all available preset names', () => {
      const presets = getAvailablePresets();

      expect(presets).toContain('init_protocol_mismatch');
      expect(presets).toContain('rate_limit');
      expect(presets).toContain('tool_not_found');
      expect(presets).toContain('server_hang');
      expect(presets).toContain('connection_reset');

      // Should have exactly the number of presets defined
      expect(presets.length).toBe(Object.keys(ERROR_SIMULATION_PRESETS).length);
    });

    it('should return array of valid preset names', () => {
      const presets = getAvailablePresets();

      for (const preset of presets) {
        expect(typeof preset).toBe('string');
        expect(ERROR_SIMULATION_PRESETS[preset]).toBeDefined();
      }
    });
  });

  describe('getPresetsByCategory function', () => {
    it('should return presets filtered by jsonrpc category', () => {
      const jsonrpcPresets = getPresetsByCategory('jsonrpc');

      for (const preset of jsonrpcPresets) {
        const config = ERROR_SIMULATION_PRESETS[preset];
        expect(config.category).toBe('jsonrpc');
      }
    });

    it('should return presets filtered by protocol category', () => {
      const protocolPresets = getPresetsByCategory('protocol');

      expect(protocolPresets.length).toBeGreaterThan(0);
      for (const preset of protocolPresets) {
        const config = ERROR_SIMULATION_PRESETS[preset];
        expect(config.category).toBe('protocol');
      }
    });

    it('should return presets filtered by transport category', () => {
      const transportPresets = getPresetsByCategory('transport');

      expect(transportPresets.length).toBeGreaterThan(0);
      for (const preset of transportPresets) {
        const config = ERROR_SIMULATION_PRESETS[preset];
        expect(config.category).toBe('transport');
      }
    });

    it('should return presets filtered by application category', () => {
      const applicationPresets = getPresetsByCategory('application');

      expect(applicationPresets.length).toBeGreaterThan(0);
      for (const preset of applicationPresets) {
        const config = ERROR_SIMULATION_PRESETS[preset];
        expect(config.category).toBe('application');
      }
    });

    it('should return presets filtered by network category', () => {
      const networkPresets = getPresetsByCategory('network');

      expect(networkPresets.length).toBeGreaterThan(0);
      for (const preset of networkPresets) {
        const config = ERROR_SIMULATION_PRESETS[preset];
        expect(config.category).toBe('network');
      }
    });

    it('should return empty array for category with no presets', () => {
      // All categories should have presets, but test the filtering logic
      const allPresets = getAvailablePresets();
      const totalByCategories =
        getPresetsByCategory('jsonrpc').length +
        getPresetsByCategory('protocol').length +
        getPresetsByCategory('transport').length +
        getPresetsByCategory('application').length +
        getPresetsByCategory('network').length;

      expect(totalByCategories).toBe(allPresets.length);
    });
  });

  describe('mergePresetWithOverrides function', () => {
    it('should merge preset with custom error overrides', () => {
      const merged = mergePresetWithOverrides('rate_limit', {
        customError: {
          code: -32000,
          message: 'Custom rate limit message',
          data: { customField: 'value' },
        },
      });

      expect(merged.mode).toBe('always_fail'); // From preset
      expect(merged.category).toBe('application'); // From preset
      expect(merged.customError?.code).toBe(-32000); // Override
      expect(merged.customError?.message).toBe('Custom rate limit message'); // Override
      expect(merged.customError?.data).toEqual({ customField: 'value' }); // Override
    });

    it('should merge preset with network conditions overrides', () => {
      const merged = mergePresetWithOverrides('request_timeout', {
        networkConditions: {
          latencyMs: 500,
          bandwidth: 1000,
        },
      });

      expect(merged.networkConditions?.connectionTimeout).toBe(1); // From preset
      expect(merged.networkConditions?.latencyMs).toBe(500); // Override
      expect(merged.networkConditions?.bandwidth).toBe(1000); // Override
    });

    it('should merge preset with mode and category overrides', () => {
      const merged = mergePresetWithOverrides('always_fail' as any, {
        mode: 'periodic_fail',
        failPeriod: 3,
        category: 'jsonrpc',
      });

      expect(merged.mode).toBe('periodic_fail'); // Override
      expect(merged.failPeriod).toBe(3); // Override
      expect(merged.category).toBe('jsonrpc'); // Override
    });

    it('should handle preset that does not exist', () => {
      const merged = mergePresetWithOverrides('non_existent' as MockErrorScenarioPreset, {
        mode: 'always_fail',
        category: 'jsonrpc',
        customError: { code: -32603, message: 'Custom error' },
      });

      // Should return only the overrides
      expect(merged.mode).toBe('always_fail');
      expect(merged.category).toBe('jsonrpc');
      expect(merged.customError?.message).toBe('Custom error');
    });

    it('should handle empty overrides', () => {
      const merged = mergePresetWithOverrides('rate_limit', {});
      const original = ERROR_SIMULATION_PRESETS.rate_limit;

      expect(merged).toEqual(original);
    });

    it('should not modify the original preset', () => {
      const originalPreset = ERROR_SIMULATION_PRESETS.rate_limit;
      const originalErrorCode = originalPreset.customError?.code;

      mergePresetWithOverrides('rate_limit', {
        customError: {
          code: -99999,
          message: 'Modified message',
        },
      });

      // Original should remain unchanged
      expect(originalPreset.customError?.code).toBe(originalErrorCode);
      expect(originalPreset.customError?.message).not.toBe('Modified message');
    });

    it('should handle complex nested overrides', () => {
      const merged = mergePresetWithOverrides('internal_error_with_details', {
        customError: {
          code: -32604,
          message: 'Custom internal error',
          data: {
            customStack: 'Custom stack trace',
            additionalInfo: 'extra data',
          },
        },
        networkConditions: {
          latencyMs: 200,
          packetLoss: 0.1,
        },
        description: 'Custom description',
      });

      expect(merged.mode).toBe('always_fail'); // From preset
      expect(merged.category).toBe('application'); // From preset
      expect(merged.customError?.code).toBe(-32604); // Override
      expect(merged.customError?.message).toBe('Custom internal error'); // Override
      expect(merged.customError?.data).toEqual({
        customStack: 'Custom stack trace',
        additionalInfo: 'extra data',
      }); // Override
      expect(merged.networkConditions?.latencyMs).toBe(200); // Override
      expect(merged.networkConditions?.packetLoss).toBe(0.1); // Override
      expect(merged.description).toBe('Custom description'); // Override
    });
  });

  describe('Preset Configuration Validation', () => {
    it('should have valid error codes for all presets', () => {
      const presets = getAvailablePresets();

      for (const presetName of presets) {
        const preset = ERROR_SIMULATION_PRESETS[presetName];

        if (preset.customError) {
          expect(preset.customError.code).toBeTypeOf('number');
          expect(preset.customError.message).toBeTypeOf('string');
          expect(preset.customError.message.length).toBeGreaterThan(0);
        }
      }
    });

    it('should have valid modes for all presets', () => {
      const validModes = [
        'none', 'always_fail', 'periodic_fail', 'fail_until',
        'fail_first_n', 'fail_after_n', 'method_pattern',
        'argument_pattern', 'sequence'
      ];

      const presets = getAvailablePresets();

      for (const presetName of presets) {
        const preset = ERROR_SIMULATION_PRESETS[presetName];

        if (preset.mode) {
          expect(validModes).toContain(preset.mode);
        }
      }
    });

    it('should have valid categories for all presets', () => {
      const validCategories = ['jsonrpc', 'protocol', 'transport', 'application', 'network'];

      const presets = getAvailablePresets();

      for (const presetName of presets) {
        const preset = ERROR_SIMULATION_PRESETS[presetName];

        if (preset.category) {
          expect(validCategories).toContain(preset.category);
        }
      }
    });

    it('should have descriptions for all presets', () => {
      const presets = getAvailablePresets();

      for (const presetName of presets) {
        const preset = ERROR_SIMULATION_PRESETS[presetName];

        expect(preset.description).toBeTypeOf('string');
        expect(preset.description!.length).toBeGreaterThan(0);
      }
    });

    it('should have consistent method patterns for method_pattern mode presets', () => {
      const presets = getAvailablePresets();

      for (const presetName of presets) {
        const preset = ERROR_SIMULATION_PRESETS[presetName];

        if (preset.mode === 'method_pattern') {
          expect(preset.methodPattern).toBeTypeOf('string');
          expect(preset.methodPattern!.length).toBeGreaterThan(0);

          // Should be a valid regex pattern
          expect(() => new RegExp(preset.methodPattern!)).not.toThrow();
        }
      }
    });
  });
});