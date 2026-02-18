/**
 * Comprehensive tests for custom tool registration and validation
 *
 * This test suite covers:
 * - Tool loading from configuration files and fixtures
 * - Schema validation for all parameter types
 * - Server construction with proper MCP integration
 * - Tool enablement and disablement
 * - Complex parameter schemas and validation
 * - Error handling for invalid configurations
 * - Tool server lifecycle management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildCustomToolsServer } from '../custom-tools';
import type { CustomToolConfig } from '@apexcli/core';
import {
  loadValidToolFixtures,
  loadInvalidToolFixtures,
  loadEdgeCaseFixtures,
  createTestToolConfig,
  validateToolConfig,
} from '../../../core/src/__tests__/fixtures/custom-tools/index.js';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

describe('Custom Tool Registration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-custom-tool-reg-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Tool Loading and Validation', () => {
    it('should load and validate all valid tool fixtures', async () => {
      const validTools = await loadValidToolFixtures();

      expect(validTools.length).toBeGreaterThan(0);

      for (const tool of validTools) {
        const result = validateToolConfig(tool);
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();

        // Validate required fields
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.name.length).toBeGreaterThan(0);
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
        expect(tool.command).toBeDefined();
        expect(typeof tool.command).toBe('string');
      }
    });

    it('should reject all invalid tool configurations', async () => {
      const invalidTools = await loadInvalidToolFixtures();

      expect(invalidTools.length).toBeGreaterThan(0);

      for (const tool of invalidTools) {
        const result = validateToolConfig(tool);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.data).toBeUndefined();
      }
    });

    it('should handle edge case configurations properly', async () => {
      const edgeTools = await loadEdgeCaseFixtures();

      expect(edgeTools.length).toBeGreaterThan(0);

      for (const tool of edgeTools) {
        const result = validateToolConfig(tool);
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();

        // Edge case tools should still be valid but test boundary conditions
        if (tool.name) {
          expect(tool.name.length).toBeGreaterThan(0);
          expect(tool.name.length).toBeLessThanOrEqual(64);
        }
      }
    });

    it('should validate tool name constraints', () => {
      // Valid names
      const validNames = [
        'MyTool',
        'tool123',
        'tool-with-dashes',
        'tool_with_underscores',
        'A'.repeat(64), // Maximum length
      ];

      for (const name of validNames) {
        const tool = createTestToolConfig({ name });
        const result = validateToolConfig(tool);
        expect(result.success).toBe(true);
      }

      // Invalid names
      const invalidTools = [
        createTestToolConfig({ name: '' }), // Empty name
        createTestToolConfig({ name: 'A'.repeat(65) }), // Too long
        { ...createTestToolConfig(), name: undefined }, // Missing name
      ];

      for (const tool of invalidTools) {
        const result = validateToolConfig(tool);
        expect(result.success).toBe(false);
      }
    });

    it('should validate command requirements', () => {
      // Valid commands
      const validCommands = [
        'echo',
        'node',
        '/usr/bin/python3',
        './scripts/my-script.sh',
      ];

      for (const command of validCommands) {
        const tool = createTestToolConfig({ command });
        const result = validateToolConfig(tool);
        expect(result.success).toBe(true);
      }

      // Invalid commands
      const invalidTools = [
        createTestToolConfig({ command: '' }), // Empty command
        { ...createTestToolConfig(), command: undefined }, // Missing command
      ];

      for (const tool of invalidTools) {
        const result = validateToolConfig(tool);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Parameter Schema Validation', () => {
    it('should validate string parameters with all constraints', () => {
      const stringParamTool = createTestToolConfig({
        name: 'StringParamTool',
        parameters: {
          type: 'object',
          properties: {
            simpleString: { type: 'string' },
            constrainedString: {
              type: 'string',
              minLength: 5,
              maxLength: 100,
              pattern: '^[A-Za-z0-9]+$',
            },
            enumString: {
              type: 'string',
              enum: ['debug', 'info', 'warn', 'error'],
            },
            defaultString: {
              type: 'string',
              default: 'default value',
            },
          },
          required: ['simpleString', 'constrainedString'],
          additionalProperties: false,
        },
      });

      const result = validateToolConfig(stringParamTool);
      expect(result.success).toBe(true);
      expect(result.data?.parameters?.properties).toBeDefined();
    });

    it('should validate numeric parameters with ranges', () => {
      const numericParamTool = createTestToolConfig({
        name: 'NumericParamTool',
        parameters: {
          type: 'object',
          properties: {
            simpleInteger: { type: 'integer' },
            constrainedInteger: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              multipleOf: 5,
            },
            simpleNumber: { type: 'number' },
            constrainedNumber: {
              type: 'number',
              minimum: 0.0,
              maximum: 1.0,
              exclusiveMinimum: true,
            },
            defaultNumber: {
              type: 'number',
              default: 42.5,
            },
          },
          required: ['simpleInteger'],
          additionalProperties: false,
        },
      });

      const result = validateToolConfig(numericParamTool);
      expect(result.success).toBe(true);
    });

    it('should validate boolean parameters', () => {
      const booleanParamTool = createTestToolConfig({
        name: 'BooleanParamTool',
        parameters: {
          type: 'object',
          properties: {
            simpleBoolean: { type: 'boolean' },
            defaultBoolean: {
              type: 'boolean',
              default: false,
            },
          },
          additionalProperties: false,
        },
      });

      const result = validateToolConfig(booleanParamTool);
      expect(result.success).toBe(true);
    });

    it('should validate array parameters with item constraints', () => {
      const arrayParamTool = createTestToolConfig({
        name: 'ArrayParamTool',
        parameters: {
          type: 'object',
          properties: {
            stringArray: {
              type: 'array',
              items: { type: 'string' },
            },
            constrainedArray: {
              type: 'array',
              items: {
                type: 'string',
                minLength: 1,
                maxLength: 20,
              },
              minItems: 1,
              maxItems: 10,
              uniqueItems: true,
            },
            mixedArray: {
              type: 'array',
              items: {
                oneOf: [
                  { type: 'string' },
                  { type: 'number' },
                  { type: 'boolean' },
                ],
              },
            },
          },
          additionalProperties: false,
        },
      });

      const result = validateToolConfig(arrayParamTool);
      expect(result.success).toBe(true);
    });

    it('should validate nested object parameters', () => {
      const nestedObjectTool = createTestToolConfig({
        name: 'NestedObjectTool',
        parameters: {
          type: 'object',
          properties: {
            config: {
              type: 'object',
              properties: {
                server: {
                  type: 'object',
                  properties: {
                    host: { type: 'string', default: 'localhost' },
                    port: { type: 'integer', minimum: 1, maximum: 65535 },
                    ssl: { type: 'boolean', default: false },
                  },
                  required: ['port'],
                  additionalProperties: false,
                },
                database: {
                  type: 'object',
                  properties: {
                    url: { type: 'string' },
                    timeout: { type: 'integer', minimum: 1000 },
                  },
                  required: ['url'],
                  additionalProperties: false,
                },
              },
              required: ['server'],
              additionalProperties: false,
            },
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  value: {
                    oneOf: [
                      { type: 'string' },
                      { type: 'number' },
                      { type: 'boolean' },
                    ],
                  },
                },
                required: ['name', 'value'],
                additionalProperties: false,
              },
            },
          },
          required: ['config'],
          additionalProperties: false,
        },
      });

      const result = validateToolConfig(nestedObjectTool);
      expect(result.success).toBe(true);
    });

    it('should validate conditional schemas with oneOf/anyOf', () => {
      const conditionalTool = createTestToolConfig({
        name: 'ConditionalTool',
        parameters: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['simple', 'advanced'],
            },
            config: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    simpleValue: { type: 'string' },
                  },
                  required: ['simpleValue'],
                  additionalProperties: false,
                },
                {
                  type: 'object',
                  properties: {
                    advancedSettings: {
                      type: 'object',
                      properties: {
                        timeout: { type: 'integer' },
                        retries: { type: 'integer' },
                        parallel: { type: 'boolean' },
                      },
                      additionalProperties: false,
                    },
                  },
                  required: ['advancedSettings'],
                  additionalProperties: false,
                },
              ],
            },
          },
          required: ['mode', 'config'],
          additionalProperties: false,
        },
      });

      const result = validateToolConfig(conditionalTool);
      expect(result.success).toBe(true);
    });
  });

  describe('Server Construction', () => {
    it('should return null for empty tool list', () => {
      const server = buildCustomToolsServer([], tempDir);
      expect(server).toBeNull();
    });

    it('should return null when all tools are disabled', () => {
      const disabledTools = [
        createTestToolConfig({ name: 'DisabledTool1', enabled: false }),
        createTestToolConfig({ name: 'DisabledTool2', enabled: false }),
      ];

      const server = buildCustomToolsServer(disabledTools, tempDir);
      expect(server).toBeNull();
    });

    it('should create server for enabled tools only', () => {
      const mixedTools = [
        createTestToolConfig({ name: 'EnabledTool1', enabled: true }),
        createTestToolConfig({ name: 'DisabledTool', enabled: false }),
        createTestToolConfig({ name: 'EnabledTool2' }), // enabled defaults to true
      ];

      const server = buildCustomToolsServer(mixedTools, tempDir);
      expect(server).not.toBeNull();
      expect(server?.name).toBe('custom-tools');
      expect(server?.config.type).toBe('sdk');
    });

    it('should handle duplicate tool names gracefully', () => {
      const duplicateNameTools = [
        createTestToolConfig({ name: 'SameName' }),
        createTestToolConfig({ name: 'SameName' }), // Duplicate name
        createTestToolConfig({ name: 'UniqueName' }),
      ];

      // Should either create server with deduplicated tools or handle gracefully
      const server = buildCustomToolsServer(duplicateNameTools, tempDir);

      if (server) {
        expect(server.config.tools).toBeDefined();
        expect(server.name).toBe('custom-tools');
      }
      // If server is null, that's also acceptable behavior for duplicate names
    });

    it('should create server with all valid fixture tools', async () => {
      const validTools = await loadValidToolFixtures();
      const enabledTools = validTools.filter(tool => tool.enabled !== false);

      if (enabledTools.length > 0) {
        const server = buildCustomToolsServer(enabledTools, tempDir);
        expect(server).not.toBeNull();
        expect(server?.config.type).toBe('sdk');
        expect(server?.config.tools).toBeDefined();
      }
    });

    it('should handle large numbers of tools efficiently', () => {
      const manyTools: CustomToolConfig[] = [];

      for (let i = 0; i < 100; i++) {
        manyTools.push(createTestToolConfig({
          name: `Tool${i}`,
          description: `Generated tool ${i}`,
        }));
      }

      const start = Date.now();
      const server = buildCustomToolsServer(manyTools, tempDir);
      const duration = Date.now() - start;

      expect(server).not.toBeNull();
      expect(duration).toBeLessThan(5000); // Should be fast
    });
  });

  describe('Tool Configuration Options', () => {
    it('should handle timeout configuration', () => {
      const timeoutTool = createTestToolConfig({
        name: 'TimeoutTool',
        timeoutMs: 30000,
      });

      const result = validateToolConfig(timeoutTool);
      expect(result.success).toBe(true);
      expect(result.data?.timeoutMs).toBe(30000);
    });

    it('should handle working directory configuration', () => {
      const workdirTool = createTestToolConfig({
        name: 'WorkdirTool',
        workingDirectory: './scripts',
      });

      const result = validateToolConfig(workdirTool);
      expect(result.success).toBe(true);
      expect(result.data?.workingDirectory).toBe('./scripts');
    });

    it('should handle environment variables configuration', () => {
      const envTool = createTestToolConfig({
        name: 'EnvTool',
        env: {
          NODE_ENV: 'test',
          DEBUG: 'true',
          API_KEY: 'secret',
        },
      });

      const result = validateToolConfig(envTool);
      expect(result.success).toBe(true);
      expect(result.data?.env).toEqual({
        NODE_ENV: 'test',
        DEBUG: 'true',
        API_KEY: 'secret',
      });
    });

    it('should handle output parser configuration', () => {
      const outputParsers = ['text', 'json', 'lines'] as const;

      for (const parser of outputParsers) {
        const tool = createTestToolConfig({
          name: `${parser}Tool`,
          outputParser: parser,
        });

        const result = validateToolConfig(tool);
        expect(result.success).toBe(true);
        expect(result.data?.outputParser).toBe(parser);
      }
    });

    it('should handle argument interpolation patterns', () => {
      const interpolationTool = createTestToolConfig({
        name: 'InterpolationTool',
        args: [
          '--input={{input.file}}',
          '--output={{input.output}}',
          '--config={{input.config.path}}',
          '--verbose={{input.options.verbose}}',
          '--format={{input.format}}',
        ],
        parameters: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            output: { type: 'string' },
            config: {
              type: 'object',
              properties: {
                path: { type: 'string' },
              },
              required: ['path'],
              additionalProperties: false,
            },
            options: {
              type: 'object',
              properties: {
                verbose: { type: 'boolean', default: false },
              },
              additionalProperties: false,
            },
            format: {
              type: 'string',
              enum: ['json', 'yaml', 'xml'],
              default: 'json',
            },
          },
          required: ['file', 'output', 'config'],
          additionalProperties: false,
        },
      });

      const result = validateToolConfig(interpolationTool);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing required fields', () => {
      const invalidConfigs = [
        { description: 'Missing name and command' },
        { name: 'Test', description: 'Missing command' },
        { name: 'Test', command: 'echo' }, // Missing description
      ];

      for (const config of invalidConfigs) {
        const result = validateToolConfig(config);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should handle invalid parameter schemas', () => {
      const invalidSchemaConfigs = [
        createTestToolConfig({
          name: 'InvalidSchema1',
          parameters: {
            type: 'object',
            properties: {
              invalidType: { type: 'invalid' as any },
            },
            additionalProperties: false,
          },
        }),
        createTestToolConfig({
          name: 'InvalidSchema2',
          parameters: {
            type: 'object',
            properties: {
              negativeMin: {
                type: 'string',
                minLength: -1, // Invalid negative minLength
              },
            },
            additionalProperties: false,
          },
        }),
      ];

      for (const config of invalidSchemaConfigs) {
        const result = validateToolConfig(config);
        expect(result.success).toBe(false);
      }
    });

    it('should handle boundary values correctly', () => {
      const boundaryTool = createTestToolConfig({
        name: 'A'.repeat(64), // Maximum name length
        description: 'Boundary test',
        timeoutMs: 1, // Minimum timeout
        parameters: {
          type: 'object',
          properties: {
            boundaryString: {
              type: 'string',
              minLength: 0,
              maxLength: 1000,
            },
            boundaryNumber: {
              type: 'number',
              minimum: 0,
              maximum: Number.MAX_SAFE_INTEGER,
            },
          },
          additionalProperties: false,
        },
      });

      const result = validateToolConfig(boundaryTool);
      expect(result.success).toBe(true);
    });

    it('should handle empty parameter objects', () => {
      const emptyParamTool = createTestToolConfig({
        name: 'EmptyParamTool',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      });

      const result = validateToolConfig(emptyParamTool);
      expect(result.success).toBe(true);

      const server = buildCustomToolsServer([emptyParamTool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should handle tools without parameters', () => {
      const noParamTool = createTestToolConfig({
        name: 'NoParamTool',
        description: 'Tool without parameters',
        command: 'echo',
        args: ['hello world'],
        parameters: undefined,
      });

      const result = validateToolConfig(noParamTool);
      expect(result.success).toBe(true);

      const server = buildCustomToolsServer([noParamTool], tempDir);
      expect(server).not.toBeNull();
    });
  });

  describe('Performance and Memory', () => {
    it('should handle tool creation without memory leaks', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const tools: CustomToolConfig[] = [];

      // Create many tools
      for (let i = 0; i < 1000; i++) {
        tools.push(createTestToolConfig({
          name: `MemoryTestTool${i}`,
          description: `Memory test tool ${i}`,
        }));
      }

      // Create server multiple times
      for (let i = 0; i < 10; i++) {
        const server = buildCustomToolsServer(tools, tempDir);
        expect(server).not.toBeNull();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should create servers efficiently for large tool sets', () => {
      const largeTool = createTestToolConfig({
        name: 'LargeTool',
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            Array.from({ length: 100 }, (_, i) => [
              `param${i}`,
              {
                type: 'string',
                description: `Parameter ${i}`,
                minLength: 1,
                maxLength: 100,
              },
            ])
          ),
          additionalProperties: false,
        },
      });

      const start = Date.now();
      const server = buildCustomToolsServer([largeTool], tempDir);
      const duration = Date.now() - start;

      expect(server).not.toBeNull();
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Real-world Integration', () => {
    it('should work with realistic file processing tools', () => {
      const fileProcessorTool = createTestToolConfig({
        name: 'FileProcessor',
        description: 'Process files with various options',
        command: 'node',
        args: ['./scripts/process-file.js', '--input={{input.inputFile}}', '--output={{input.outputFile}}'],
        workingDirectory: '.',
        env: {
          NODE_ENV: 'production',
        },
        parameters: {
          type: 'object',
          properties: {
            inputFile: {
              type: 'string',
              description: 'Path to input file',
              pattern: '\\.(txt|csv|json)$',
            },
            outputFile: {
              type: 'string',
              description: 'Path to output file',
            },
            options: {
              type: 'object',
              properties: {
                format: {
                  type: 'string',
                  enum: ['json', 'csv', 'txt'],
                  default: 'json',
                },
                compress: {
                  type: 'boolean',
                  default: false,
                },
                encoding: {
                  type: 'string',
                  enum: ['utf8', 'ascii', 'base64'],
                  default: 'utf8',
                },
              },
              additionalProperties: false,
            },
          },
          required: ['inputFile', 'outputFile'],
          additionalProperties: false,
        },
        timeoutMs: 300000, // 5 minutes
      });

      const result = validateToolConfig(fileProcessorTool);
      expect(result.success).toBe(true);

      const server = buildCustomToolsServer([fileProcessorTool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should work with API integration tools', () => {
      const apiTool = createTestToolConfig({
        name: 'APIClient',
        description: 'Make HTTP API calls with authentication',
        command: 'curl',
        args: [
          '-X', '{{input.method}}',
          '-H', 'Content-Type: application/json',
          '-H', 'Authorization: Bearer {{input.token}}',
          '--data', '{{input.body}}',
          '{{input.url}}'
        ],
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              pattern: '^https?://.+',
              description: 'API endpoint URL',
            },
            method: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
              default: 'GET',
            },
            token: {
              type: 'string',
              minLength: 10,
              description: 'Bearer token for authentication',
            },
            body: {
              type: 'string',
              description: 'JSON request body',
              default: '{}',
            },
            headers: {
              type: 'object',
              additionalProperties: {
                type: 'string',
              },
              description: 'Additional headers',
            },
          },
          required: ['url', 'token'],
          additionalProperties: false,
        },
        outputParser: 'json',
        timeoutMs: 60000,
      });

      const result = validateToolConfig(apiTool);
      expect(result.success).toBe(true);

      const server = buildCustomToolsServer([apiTool], tempDir);
      expect(server).not.toBeNull();
    });
  });
});