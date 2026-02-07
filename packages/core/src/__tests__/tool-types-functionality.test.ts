/**
 * @fileoverview Tool Types Functionality Tests
 *
 * Tests the functionality and validation behavior of the tool-related types
 * that were documented in the implementation phase.
 */

import { describe, it, expect } from 'vitest';
import {
  ToolConfigSchema,
  CustomToolOutputParserSchema,
  ToolRegistryStateSchema,
  type ToolConfig,
  type CustomToolOutputParser,
  type ToolRegistryState,
} from '../types';

describe('Tool Types Functionality Tests', () => {
  describe('ToolConfigSchema', () => {
    it('should parse empty configuration correctly', () => {
      const result = ToolConfigSchema.parse({});
      expect(result).toEqual({});
    });

    it('should parse valid tool configurations', () => {
      const config: ToolConfig = {
        'filesystem': {
          enabled: true,
          maxFileSize: 1048576,
          allowedExtensions: ['.ts', '.js'],
        },
        'web': {
          enabled: false,
          allowedDomains: ['example.com'],
        },
      };

      const result = ToolConfigSchema.parse(config);
      expect(result).toEqual(config);
    });

    it('should use default empty object when undefined', () => {
      const result = ToolConfigSchema.parse(undefined);
      expect(result).toEqual({});
    });

    it('should reject invalid tool configurations', () => {
      const invalidConfig = {
        'filesystem': {
          enabled: 'yes', // Should be boolean
        },
      };

      expect(() => ToolConfigSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('CustomToolOutputParserSchema', () => {
    it('should accept valid parser types', () => {
      const validParsers: CustomToolOutputParser[] = ['json', 'text', 'lines'];

      validParsers.forEach(parser => {
        const result = CustomToolOutputParserSchema.parse(parser);
        expect(result).toBe(parser);
      });
    });

    it('should reject invalid parser types', () => {
      const invalidParsers = ['xml', 'html', 'binary', 123, null, undefined];

      invalidParsers.forEach(parser => {
        expect(() => CustomToolOutputParserSchema.parse(parser)).toThrow();
      });
    });

    it('should work in enum context', () => {
      const parser = CustomToolOutputParserSchema.parse('json');
      expect(['json', 'text', 'lines']).toContain(parser);
    });
  });

  describe('ToolRegistryStateSchema', () => {
    it('should parse valid registry state', () => {
      const validState: ToolRegistryState = {
        tools: {
          'test-tool': {
            id: 'test-tool',
            name: 'Test Tool',
            description: 'A test tool',
            source: 'builtin',
            type: 'builtin',
            config: { enabled: true },
            isAvailable: true,
            lastUsed: new Date().toISOString(),
          },
        },
        bySource: {
          builtin: ['test-tool'],
          custom: [],
          mcp: [],
        },
        byType: {
          builtin: ['test-tool'],
          custom: [],
          mcp: [],
        },
        metadata: {
          lastUpdated: new Date().toISOString(),
          version: '1.0.0',
        },
        totalCount: 1,
        availableCount: 1,
      };

      const result = ToolRegistryStateSchema.parse(validState);
      expect(result).toEqual(validState);
    });

    it('should handle empty registry state', () => {
      const emptyState: ToolRegistryState = {
        tools: {},
        bySource: { builtin: [], custom: [], mcp: [] },
        byType: { builtin: [], custom: [], mcp: [] },
        metadata: {
          lastUpdated: new Date().toISOString(),
          version: '1.0.0',
        },
        totalCount: 0,
        availableCount: 0,
      };

      const result = ToolRegistryStateSchema.parse(emptyState);
      expect(result).toEqual(emptyState);
    });

    it('should reject invalid count values', () => {
      const invalidState = {
        tools: {},
        bySource: { builtin: [], custom: [], mcp: [] },
        byType: { builtin: [], custom: [], mcp: [] },
        metadata: {
          lastUpdated: new Date().toISOString(),
          version: '1.0.0',
        },
        totalCount: -1, // Invalid negative count
        availableCount: 0,
      };

      expect(() => ToolRegistryStateSchema.parse(invalidState)).toThrow();
    });

    it('should require all mandatory fields', () => {
      const incompleteState = {
        tools: {},
        // Missing other required fields
      };

      expect(() => ToolRegistryStateSchema.parse(incompleteState)).toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should work together in realistic scenarios', () => {
      // Test a realistic scenario where all types work together
      const toolConfig: ToolConfig = {
        'custom-analyzer': {
          enabled: true,
          timeout: 30000,
        },
      };

      const outputParser: CustomToolOutputParser = 'json';

      const registryState: ToolRegistryState = {
        tools: {
          'custom-analyzer': {
            id: 'custom-analyzer',
            name: 'Custom Analyzer',
            description: 'Analyzes code and returns JSON results',
            source: 'custom',
            type: 'custom',
            config: {
              ...toolConfig['custom-analyzer'],
              outputParser,
              command: 'python analyze.py',
            },
            isAvailable: true,
            lastUsed: new Date().toISOString(),
          },
        },
        bySource: {
          builtin: [],
          custom: ['custom-analyzer'],
          mcp: [],
        },
        byType: {
          builtin: [],
          custom: ['custom-analyzer'],
          mcp: [],
        },
        metadata: {
          lastUpdated: new Date().toISOString(),
          version: '1.0.0',
        },
        totalCount: 1,
        availableCount: 1,
      };

      // All schemas should validate successfully
      expect(() => ToolConfigSchema.parse(toolConfig)).not.toThrow();
      expect(() => CustomToolOutputParserSchema.parse(outputParser)).not.toThrow();
      expect(() => ToolRegistryStateSchema.parse(registryState)).not.toThrow();

      // Values should be preserved correctly
      const parsedConfig = ToolConfigSchema.parse(toolConfig);
      const parsedParser = CustomToolOutputParserSchema.parse(outputParser);
      const parsedState = ToolRegistryStateSchema.parse(registryState);

      expect(parsedConfig).toEqual(toolConfig);
      expect(parsedParser).toBe(outputParser);
      expect(parsedState).toEqual(registryState);
    });
  });
});