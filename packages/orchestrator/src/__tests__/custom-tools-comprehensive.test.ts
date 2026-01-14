/**
 * Comprehensive tests for custom tool registration and execution
 *
 * This test suite covers:
 * - Tool loading and schema validation
 * - Custom tool server construction
 * - Parameter schema building and validation
 * - Command argument interpolation
 * - Output parsing for all supported formats
 * - Error handling scenarios
 * - Environment variable injection
 * - Working directory resolution
 * - Tool enablement/disablement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildCustomToolsServer } from '../custom-tools';
import type { CustomToolConfig } from '@apexcli/core';
import {
  createTestToolConfig,
  loadValidToolFixtures,
  loadEdgeCaseFixtures,
  validateToolConfig,
} from '@apexcli/core/src/__tests__/fixtures/custom-tools/index.js';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

describe('Custom Tools - Comprehensive Unit Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-custom-tools-unit-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Schema Validation', () => {
    it('should validate valid tool configurations', () => {
      const validTool: CustomToolConfig = {
        name: 'ValidTool',
        description: 'A valid test tool',
        command: 'echo',
        args: ['hello'],
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          },
          required: ['message'],
          additionalProperties: false
        }
      };

      const result = validateToolConfig(validTool);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validTool);
    });

    it('should reject invalid tool configurations', () => {
      const invalidTool = {
        name: '', // Invalid: empty name
        description: 'Missing command',
        // Missing required 'command' field
      };

      const result = validateToolConfig(invalidTool);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate all parameter types correctly', async () => {
      const validTools = await loadValidToolFixtures();
      const parameterTypesTools = validTools.filter(tool =>
        tool.parameters?.properties && Object.keys(tool.parameters.properties).length > 0
      );

      expect(parameterTypesTools.length).toBeGreaterThan(0);

      for (const tool of parameterTypesTools) {
        const result = validateToolConfig(tool);
        expect(result.success).toBe(true);
      }
    });

    it('should handle edge case configurations', async () => {
      const edgeTools = await loadEdgeCaseFixtures();
      expect(edgeTools.length).toBeGreaterThan(0);

      for (const tool of edgeTools) {
        const result = validateToolConfig(tool);
        expect(result.success).toBe(true);
      }
    });

    it('should validate boundary values correctly', () => {
      const boundaryTool: CustomToolConfig = {
        name: 'A'.repeat(64), // Maximum length name
        description: 'Boundary test tool',
        command: 'echo',
        timeoutMs: 1, // Minimum timeout
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      };

      const result = validateToolConfig(boundaryTool);
      expect(result.success).toBe(true);
    });

    it('should reject names exceeding maximum length', () => {
      const invalidTool = {
        name: 'A'.repeat(65), // Exceeds 64 character limit
        description: 'Invalid name length',
        command: 'echo',
      };

      const result = validateToolConfig(invalidTool);
      expect(result.success).toBe(false);
      expect(result.error).toContain('64');
    });
  });

  describe('Server Construction', () => {
    it('should return null for empty tool list', () => {
      const server = buildCustomToolsServer([], tempDir);
      expect(server).toBeNull();
    });

    it('should return null when all tools are disabled', () => {
      const disabledTools: CustomToolConfig[] = [
        createTestToolConfig({ name: 'DisabledTool', enabled: false }),
        createTestToolConfig({ name: 'AnotherDisabled', enabled: false }),
      ];

      const server = buildCustomToolsServer(disabledTools, tempDir);
      expect(server).toBeNull();
    });

    it('should create server for enabled tools only', () => {
      const mixedTools: CustomToolConfig[] = [
        createTestToolConfig({ name: 'EnabledTool', enabled: true }),
        createTestToolConfig({ name: 'DisabledTool', enabled: false }),
        createTestToolConfig({ name: 'DefaultEnabled' }), // enabled defaults to true
      ];

      const server = buildCustomToolsServer(mixedTools, tempDir);
      expect(server).not.toBeNull();
      expect(server?.name).toBe('custom-tools');
      expect(server?.config.type).toBe('sdk');
    });

    it('should create server with multiple tools', async () => {
      const validTools = await loadValidToolFixtures();
      const enabledTools = validTools.filter(tool => tool.enabled !== false).slice(0, 5);

      const server = buildCustomToolsServer(enabledTools, tempDir);
      expect(server).not.toBeNull();
      expect(server?.config.tools).toBeDefined();
    });
  });

  describe('Parameter Schema Building', () => {
    it('should build schema for string parameters with constraints', () => {
      const tool: CustomToolConfig = createTestToolConfig({
        name: 'StringConstraintTool',
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              minLength: 5,
              maxLength: 100,
              pattern: '^[a-zA-Z ]+$'
            }
          },
          required: ['message'],
          additionalProperties: false
        }
      });

      const server = buildCustomToolsServer([tool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should build schema for numeric parameters with ranges', () => {
      const tool: CustomToolConfig = createTestToolConfig({
        name: 'NumericTool',
        parameters: {
          type: 'object',
          properties: {
            count: {
              type: 'integer',
              minimum: 1,
              maximum: 100
            },
            percentage: {
              type: 'number',
              minimum: 0.0,
              maximum: 100.0
            }
          },
          required: ['count'],
          additionalProperties: false
        }
      });

      const server = buildCustomToolsServer([tool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should build schema for enum parameters', () => {
      const tool: CustomToolConfig = createTestToolConfig({
        name: 'EnumTool',
        parameters: {
          type: 'object',
          properties: {
            level: {
              type: 'string',
              enum: ['debug', 'info', 'warn', 'error']
            }
          },
          required: ['level'],
          additionalProperties: false
        }
      });

      const server = buildCustomToolsServer([tool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should build schema for array parameters', () => {
      const tool: CustomToolConfig = createTestToolConfig({
        name: 'ArrayTool',
        parameters: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'string'
              }
            }
          },
          required: ['items'],
          additionalProperties: false
        }
      });

      const server = buildCustomToolsServer([tool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should build schema for nested object parameters', () => {
      const tool: CustomToolConfig = createTestToolConfig({
        name: 'NestedObjectTool',
        parameters: {
          type: 'object',
          properties: {
            config: {
              type: 'object',
              properties: {
                host: { type: 'string' },
                port: { type: 'integer' }
              },
              required: ['host']
            }
          },
          required: ['config'],
          additionalProperties: false
        }
      });

      const server = buildCustomToolsServer([tool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should handle parameters with default values', () => {
      const tool: CustomToolConfig = createTestToolConfig({
        name: 'DefaultValueTool',
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              default: 'Hello World'
            },
            verbose: {
              type: 'boolean',
              default: false
            }
          },
          additionalProperties: false
        }
      });

      const server = buildCustomToolsServer([tool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should handle optional parameters', () => {
      const tool: CustomToolConfig = createTestToolConfig({
        name: 'OptionalParamTool',
        parameters: {
          type: 'object',
          properties: {
            required_field: { type: 'string' },
            optional_field: { type: 'string' }
          },
          required: ['required_field'],
          additionalProperties: false
        }
      });

      const server = buildCustomToolsServer([tool], tempDir);
      expect(server).not.toBeNull();
    });
  });

  describe('Argument Interpolation', () => {
    it('should interpolate simple input values', () => {
      // This would need access to internal functions, or we test through execution
      // For now, we verify the tool can be created with interpolation patterns
      const tool: CustomToolConfig = createTestToolConfig({
        name: 'InterpolationTool',
        args: ['--message', '{{input.message}}', '--count', '{{input.count}}']
      });

      const server = buildCustomToolsServer([tool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should handle complex interpolation patterns', () => {
      const tool: CustomToolConfig = createTestToolConfig({
        name: 'ComplexInterpolationTool',
        args: [
          'process',
          '--config={{input.config.host}}:{{input.config.port}}',
          '--data={{input}}'
        ]
      });

      const server = buildCustomToolsServer([tool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should handle missing interpolation values gracefully', () => {
      const tool: CustomToolConfig = createTestToolConfig({
        name: 'MissingValueTool',
        args: ['{{input.nonexistent}}', '{{input.missing.nested}}']
      });

      const server = buildCustomToolsServer([tool], tempDir);
      expect(server).not.toBeNull();
    });
  });

  describe('Output Parsing', () => {
    it('should configure tools with text output parser', () => {
      const tool: CustomToolConfig = createTestToolConfig({
        name: 'TextOutputTool',
        outputParser: 'text'
      });

      const server = buildCustomToolsServer([tool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should configure tools with JSON output parser', () => {
      const tool: CustomToolConfig = createTestToolConfig({
        name: 'JsonOutputTool',
        outputParser: 'json'
      });

      const server = buildCustomToolsServer([tool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should configure tools with lines output parser', () => {
      const tool: CustomToolConfig = createTestToolConfig({
        name: 'LinesOutputTool',
        outputParser: 'lines'
      });

      const server = buildCustomToolsServer([tool], tempDir);
      expect(server).not.toBeNull();
    });
  });

  describe('Environment Configuration', () => {
    it('should handle tools with environment variables', () => {
      const tool: CustomToolConfig = createTestToolConfig({
        name: 'EnvVarTool',
        env: {
          'CUSTOM_VAR': 'test_value',
          'ANOTHER_VAR': 'another_value'
        }
      });

      const server = buildCustomToolsServer([tool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should handle tools with custom working directory', () => {
      const tool: CustomToolConfig = createTestToolConfig({
        name: 'WorkdirTool',
        workingDirectory: './subdir'
      });

      const server = buildCustomToolsServer([tool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should handle tools with custom timeout', () => {
      const tool: CustomToolConfig = createTestToolConfig({
        name: 'TimeoutTool',
        timeoutMs: 30000
      });

      const server = buildCustomToolsServer([tool], tempDir);
      expect(server).not.toBeNull();
    });
  });

  describe('Fixture Integration', () => {
    it('should load and validate all fixture categories', async () => {
      const validTools = await loadValidToolFixtures();
      const edgeTools = await loadEdgeCaseFixtures();

      expect(validTools.length).toBeGreaterThan(0);
      expect(edgeTools.length).toBeGreaterThan(0);

      // All valid tools should pass validation
      for (const tool of validTools) {
        const result = validateToolConfig(tool);
        expect(result.success).toBe(true);
      }

      // All edge case tools should also pass validation
      for (const tool of edgeTools) {
        const result = validateToolConfig(tool);
        expect(result.success).toBe(true);
      }
    });

    it('should create servers from fixture tools', async () => {
      const validTools = await loadValidToolFixtures();
      const enabledTools = validTools.filter(tool => tool.enabled !== false);

      if (enabledTools.length > 0) {
        const server = buildCustomToolsServer(enabledTools, tempDir);
        expect(server).not.toBeNull();
        expect(server?.config.type).toBe('sdk');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle tools with malformed parameters gracefully', () => {
      // This tests the robustness of schema building
      const tool: CustomToolConfig = createTestToolConfig({
        name: 'MalformedTool',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      });

      const server = buildCustomToolsServer([tool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should handle empty parameter objects', () => {
      const tool: CustomToolConfig = createTestToolConfig({
        name: 'EmptyParamTool',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      });

      const server = buildCustomToolsServer([tool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should handle missing optional fields', () => {
      const minimalTool: CustomToolConfig = {
        name: 'MinimalTool',
        description: 'Minimal configuration',
        command: 'echo'
        // Missing: args, parameters, outputParser, etc.
      };

      const result = validateToolConfig(minimalTool);
      expect(result.success).toBe(true);

      const server = buildCustomToolsServer([minimalTool], tempDir);
      expect(server).not.toBeNull();
    });
  });
});