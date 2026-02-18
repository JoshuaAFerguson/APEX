import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';

// Import MCP configuration and tool schemas from main types
import {
  MCPServerConfigSchema,
  MCPConnectionConfigSchema,
  MCPToolSchemaSchema,
  MCPConfigSchema,
  MCPToolsConfigSchema,
  type MCPServerConfig,
  type MCPConnectionConfig,
  type MCPToolSchema,
  type MCPConfig,
  type MCPToolsConfig,
} from '../types.js';

// Import MCP protocol types (JsonRpc types)
import {
  JsonRpcRequestSchema,
  JsonRpcResponseSchema,
  JsonRpcSuccessResponseSchema,
  JsonRpcErrorResponseSchema,
  JsonRpcNotificationSchema,
  MCPInitializeParamsSchema,
  MCPInitializeResultSchema,
  MCPToolsListResultSchema,
  MCPToolsCallParamsSchema,
  MCPToolsCallResultSchema,
  MCPToolResultContentItemSchema,
  MCPPromptMessageContentSchema,
  MCPCompletionReferenceSchema,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcNotification,
  type MCPInitializeParams,
  type MCPInitializeResult,
  type MCPToolsListResult,
  type MCPToolsCallParams,
  type MCPToolsCallResult,
  type MCPToolResultContentItem,
  type MCPPromptMessageContent,
  type MCPCompletionReference,
} from '../mcp/protocol-types.js';

/**
 * @fileoverview MCP Zod Schema Validation Integration Tests
 *
 * Tests the complete MCP schema validation pipeline including:
 * - Configuration schemas (MCPServerConfig, MCPConnectionConfig, etc.)
 * - Protocol schemas (JsonRpc types, MCP message types)
 * - Tool schemas and their validation patterns
 * - Error handling with proper ZodError details
 * - Edge cases with optional fields, discriminated unions, and nested validation
 *
 * ## Architecture Decision Record (ADR-030)
 * These integration tests verify that all MCP-related Zod schemas work correctly
 * in combination, ensuring data integrity across the APEX MCP integration layer.
 */

describe('MCP Zod Schema Validation Integration Tests', () => {
  describe('Valid MCP Data Parsing', () => {
    describe('MCPServerConfig - Valid Cases', () => {
      it('parses valid server config with all required fields', () => {
        const validConfig: MCPServerConfig = {
          name: 'test-server',
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
          env: {
            NODE_ENV: 'production',
            TEST_VAR: 'test-value'
          }
        };

        const result = MCPServerConfigSchema.safeParse(validConfig);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validConfig);
          expect(result.data.name).toBe('test-server');
          expect(result.data.command).toBe('node');
          expect(result.data.args).toEqual(['server.js']);
          expect(result.data.env).toEqual({
            NODE_ENV: 'production',
            TEST_VAR: 'test-value'
          });
        }
      });

      it('parses server config with optional fields included', () => {
        const configWithOptionals: MCPServerConfig = {
          name: 'advanced-server',
          type: 'stdio',
          command: 'python',
          args: ['-m', 'mcp_server'],
          env: { PYTHONPATH: '/app' },
          autoStart: true,
          capabilities: ['tools', 'resources']
        };

        const result = MCPServerConfigSchema.safeParse(configWithOptionals);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.type).toBe('stdio');
          expect(result.data.autoStart).toBe(true);
          expect(result.data.capabilities).toEqual(['tools', 'resources']);
        }
      });
    });

    describe('MCPConnectionConfig - Valid Cases', () => {
      it('parses valid connection config with default values', () => {
        const validConnection = {
          maxRetries: 5,
          retryDelayMs: 2000,
          connectionTimeoutMs: 15000
        };

        const result = MCPConnectionConfigSchema.safeParse(validConnection);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.maxRetries).toBe(5);
          expect(result.data.retryDelayMs).toBe(2000);
          expect(result.data.connectionTimeoutMs).toBe(15000);
        }
      });

      it('parses connection config with all defaults (empty object)', () => {
        const emptyConnection = {};

        const result = MCPConnectionConfigSchema.safeParse(emptyConnection);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.maxRetries).toBe(3); // Default value
          expect(result.data.retryDelayMs).toBe(1000); // Default value
          expect(result.data.autoReconnect).toBe(true); // Default value
        }
      });
    });

    describe('MCPToolSchema - Valid Cases', () => {
      it('parses valid tool schema with comprehensive definition', () => {
        const validTool: MCPToolSchema = {
          name: 'file_reader',
          description: 'Reads file contents',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'File path to read'
              },
              encoding: {
                type: 'string',
                enum: ['utf8', 'ascii', 'binary'],
                default: 'utf8'
              }
            },
            required: ['path']
          }
        };

        const result = MCPToolSchemaSchema.safeParse(validTool);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe('file_reader');
          expect(result.data.description).toBe('Reads file contents');
          expect(result.data.inputSchema.type).toBe('object');
          expect(result.data.inputSchema.required).toEqual(['path']);
        }
      });

      it('parses tool schema without optional description', () => {
        const minimalTool: MCPToolSchema = {
          name: 'simple_tool',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        };

        const result = MCPToolSchemaSchema.safeParse(minimalTool);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe('simple_tool');
          expect(result.data.description).toBeUndefined();
        }
      });
    });

    describe('JsonRpc Protocol Types - Valid Cases', () => {
      it('parses valid JSON-RPC request', () => {
        const validRequest: JsonRpcRequest = {
          jsonrpc: '2.0',
          id: 'req-123',
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'apex-client',
              version: '1.0.0'
            }
          }
        };

        const result = JsonRpcRequestSchema.safeParse(validRequest);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.jsonrpc).toBe('2.0');
          expect(result.data.id).toBe('req-123');
          expect(result.data.method).toBe('initialize');
        }
      });

      it('parses valid JSON-RPC success response', () => {
        const successResponse: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 'req-123',
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: {
              name: 'test-server',
              version: '1.0.0'
            }
          }
        };

        const result = JsonRpcSuccessResponseSchema.safeParse(successResponse);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.jsonrpc).toBe('2.0');
          expect(result.data.id).toBe('req-123');
          expect(result.data.result).toBeDefined();
        }
      });

      it('parses valid JSON-RPC notification', () => {
        const notification: JsonRpcNotification = {
          jsonrpc: '2.0',
          method: 'notifications/initialized',
          params: {}
        };

        const result = JsonRpcNotificationSchema.safeParse(notification);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.method).toBe('notifications/initialized');
          expect('id' in result.data).toBe(false); // Notifications don't have IDs
        }
      });
    });

    describe('MCP Protocol Messages - Valid Cases', () => {
      it('parses valid MCP initialize params', () => {
        const initParams: MCPInitializeParams = {
          protocolVersion: '2024-11-05',
          capabilities: {
            roots: { listChanged: true },
            sampling: {}
          },
          clientInfo: {
            name: 'apex-mcp-client',
            version: '1.0.0'
          }
        };

        const result = MCPInitializeParamsSchema.safeParse(initParams);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.protocolVersion).toBe('2024-11-05');
          expect(result.data.clientInfo.name).toBe('apex-mcp-client');
        }
      });

      it('parses valid MCP tools list result', () => {
        const toolsResult: MCPToolsListResult = {
          tools: [
            {
              name: 'file_search',
              description: 'Search for files',
              inputSchema: {
                type: 'object',
                properties: {
                  pattern: { type: 'string' }
                },
                required: ['pattern']
              }
            }
          ]
        };

        const result = MCPToolsListResultSchema.safeParse(toolsResult);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.tools).toHaveLength(1);
          expect(result.data.tools[0].name).toBe('file_search');
        }
      });
    });
  });

  describe('Invalid Data Rejection with ZodError Verification', () => {
    describe('MCPServerConfig - Invalid Cases', () => {
      it('rejects server config with missing required name field', () => {
        const invalidConfig = {
          command: 'node',
          args: ['server.js'],
          env: {}
        };

        const result = MCPServerConfigSchema.safeParse(invalidConfig);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
          expect(result.error.issues).toHaveLength(1);
          expect(result.error.issues[0].path).toEqual(['name']);
          expect(result.error.issues[0].code).toBe('invalid_type');
          expect(result.error.issues[0].message).toContain('Required');
        }
      });

      it('rejects server config with invalid command type', () => {
        const invalidConfig = {
          name: 'test-server',
          command: 123, // Should be string
          args: ['server.js'],
          env: {}
        };

        const result = MCPServerConfigSchema.safeParse(invalidConfig);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
          const commandError = result.error.issues.find(issue => issue.path.includes('command'));
          expect(commandError).toBeDefined();
          expect(commandError?.code).toBe('invalid_type');
          expect(commandError?.message).toContain('Expected string, received number');
        }
      });

      it('rejects server config with invalid args array', () => {
        const invalidConfig = {
          name: 'test-server',
          command: 'node',
          args: 'not-an-array', // Should be string[]
          env: {}
        };

        const result = MCPServerConfigSchema.safeParse(invalidConfig);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
          const argsError = result.error.issues.find(issue => issue.path.includes('args'));
          expect(argsError).toBeDefined();
          expect(argsError?.code).toBe('invalid_type');
          expect(argsError?.message).toContain('Expected array, received string');
        }
      });
    });

    describe('MCPConnectionConfig - Invalid Cases', () => {
      it('rejects connection config with invalid retry count', () => {
        const invalidConnection = {
          maxRetries: -1, // Invalid - must be >= 0
          retryDelayMs: 1000
        };

        const result = MCPConnectionConfigSchema.safeParse(invalidConnection);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
          const retryError = result.error.issues.find(issue =>
            issue.path.includes('maxRetries')
          );
          expect(retryError).toBeDefined();
          expect(retryError?.code).toBe('too_small');
        }
      });

      it('rejects connection config with invalid pool size', () => {
        const invalidConnection = {
          poolSize: 101 // Invalid - max is 100
        };

        const result = MCPConnectionConfigSchema.safeParse(invalidConnection);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
          const poolError = result.error.issues.find(issue =>
            issue.path.includes('poolSize')
          );
          expect(poolError).toBeDefined();
          expect(poolError?.code).toBe('too_big');
        }
      });
    });

    describe('JsonRpc Types - Invalid Cases', () => {
      it('rejects JSON-RPC request with invalid jsonrpc version', () => {
        const invalidRequest = {
          jsonrpc: '1.0', // Must be '2.0'
          id: 'req-123',
          method: 'test',
          params: {}
        };

        const result = JsonRpcRequestSchema.safeParse(invalidRequest);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
          const versionError = result.error.issues.find(issue => issue.path.includes('jsonrpc'));
          expect(versionError).toBeDefined();
          expect(versionError?.code).toBe('invalid_literal');
          expect(versionError?.message).toContain('Invalid literal value, expected "2.0"');
        }
      });

      it('rejects JSON-RPC request with missing required method', () => {
        const invalidRequest = {
          jsonrpc: '2.0',
          id: 'req-123',
          // Missing method field
          params: {}
        };

        const result = JsonRpcRequestSchema.safeParse(invalidRequest);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
          const methodError = result.error.issues.find(issue => issue.path.includes('method'));
          expect(methodError).toBeDefined();
          expect(methodError?.code).toBe('invalid_type');
          expect(methodError?.message).toContain('Required');
        }
      });

      it('rejects JSON-RPC response with invalid id type', () => {
        const invalidResponse = {
          jsonrpc: '2.0',
          id: true, // Invalid type - should be string or number
          result: {}
        };

        const result = JsonRpcSuccessResponseSchema.safeParse(invalidResponse);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
          const idError = result.error.issues.find(issue => issue.path.includes('id'));
          expect(idError).toBeDefined();
          expect(idError?.code).toBe('invalid_union');
        }
      });
    });

    describe('MCP Tool Schema - Invalid Cases', () => {
      it('rejects tool schema with invalid inputSchema structure', () => {
        const invalidTool = {
          name: 'test-tool',
          description: 'A test tool',
          inputSchema: {
            type: 'array', // MCP tools must have object type
            items: { type: 'string' }
          }
        };

        const result = MCPToolSchemaSchema.safeParse(invalidTool);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
          const schemaError = result.error.issues.find(issue =>
            issue.path.includes('inputSchema') && issue.path.includes('type')
          );
          expect(schemaError).toBeDefined();
          expect(schemaError?.code).toBe('invalid_literal');
          expect(schemaError?.message).toContain('Invalid literal value, expected "object"');
        }
      });

      it('rejects tool schema with empty name', () => {
        const invalidTool = {
          name: '', // Empty name should be rejected
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        };

        const result = MCPToolSchemaSchema.safeParse(invalidTool);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
          const nameError = result.error.issues.find(issue => issue.path.includes('name'));
          expect(nameError).toBeDefined();
          expect(nameError?.code).toBe('too_small');
          expect(nameError?.message).toContain('String must contain at least 1 character(s)');
        }
      });
    });
  });

  describe('Edge Cases - Optional Fields, Discriminated Unions, Nested Objects', () => {
    describe('Optional Field Handling', () => {
      it('handles MCPServerConfig with missing optional fields gracefully', () => {
        const minimalConfig = {
          name: 'minimal-server'
          // All other fields are optional
        };

        const result = MCPServerConfigSchema.safeParse(minimalConfig);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.type).toBe('stdio'); // Default value
          expect(result.data.command).toBeUndefined();
          expect(result.data.args).toBeUndefined();
          expect(result.data.autoStart).toBe(false); // Default value
        }
      });

      it('validates optional fields when present', () => {
        const configWithInvalidOptional = {
          name: 'test-server',
          type: 'invalid-type', // Invalid enum value
          command: 'node',
          args: ['server.js']
        };

        const result = MCPServerConfigSchema.safeParse(configWithInvalidOptional);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
          const typeError = result.error.issues.find(issue => issue.path.includes('type'));
          expect(typeError).toBeDefined();
          expect(typeError?.code).toBe('invalid_enum_value');
        }
      });

      it('handles MCP tool schema with optional description correctly', () => {
        const toolWithoutDescription = {
          name: 'test-tool',
          // description omitted
          inputSchema: {
            type: 'object',
            properties: { param: { type: 'string' } },
            required: ['param']
          }
        };

        const result = MCPToolSchemaSchema.safeParse(toolWithoutDescription);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.description).toBeUndefined();
          expect(result.data.name).toBe('test-tool');
        }
      });
    });

    describe('Discriminated Union Edge Cases', () => {
      it('correctly validates different content types in MCPToolResultContentItem', () => {
        // Test text content
        const textContent: MCPToolResultContentItem = {
          type: 'text',
          text: 'Some text content'
        };

        let result = MCPToolResultContentItemSchema.safeParse(textContent);
        expect(result.success).toBe(true);

        // Test image content
        const imageContent: MCPToolResultContentItem = {
          type: 'image',
          data: 'base64imagedata',
          mimeType: 'image/png'
        };

        result = MCPToolResultContentItemSchema.safeParse(imageContent);
        expect(result.success).toBe(true);

        // Test resource content
        const resourceContent: MCPToolResultContentItem = {
          type: 'resource',
          resource: {
            uri: 'file:///example.txt',
            mimeType: 'text/plain',
            text: 'Resource content'
          }
        };

        result = MCPToolResultContentItemSchema.safeParse(resourceContent);
        expect(result.success).toBe(true);
      });

      it('rejects content with mismatched discriminator and fields', () => {
        // Text content with missing text field
        const invalidTextContent = {
          type: 'text'
          // Missing required text field
        };

        const result = MCPToolResultContentItemSchema.safeParse(invalidTextContent);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
          expect(result.error.issues.some(issue =>
            issue.path.includes('text') && issue.code === 'invalid_type'
          )).toBe(true);
        }
      });

      it('validates completion reference discriminated union', () => {
        // Test prompt reference
        const promptRef: MCPCompletionReference = {
          type: 'ref/prompt',
          name: 'code_review'
        };

        let result = MCPCompletionReferenceSchema.safeParse(promptRef);
        expect(result.success).toBe(true);

        // Test resource reference
        const resourceRef: MCPCompletionReference = {
          type: 'ref/resource',
          uri: 'file:///example.txt'
        };

        result = MCPCompletionReferenceSchema.safeParse(resourceRef);
        expect(result.success).toBe(true);
      });

      it('rejects completion reference with invalid discriminator', () => {
        const invalidRef = {
          type: 'ref/invalid', // Invalid discriminator
          name: 'test'
        };

        const result = MCPCompletionReferenceSchema.safeParse(invalidRef);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
          expect(result.error.issues.some(issue =>
            issue.code === 'invalid_discriminator_value'
          )).toBe(true);
        }
      });
    });

    describe('Nested Object Validation', () => {
      it('validates deeply nested inputSchema in MCPToolSchema', () => {
        const toolWithNestedSchema = {
          name: 'complex-tool',
          description: 'A tool with complex nested schema',
          inputSchema: {
            type: 'object',
            properties: {
              config: {
                type: 'object',
                properties: {
                  database: {
                    type: 'object',
                    properties: {
                      host: { type: 'string' },
                      port: { type: 'number' },
                      credentials: {
                        type: 'object',
                        properties: {
                          username: { type: 'string' },
                          password: { type: 'string' }
                        },
                        required: ['username', 'password']
                      }
                    },
                    required: ['host', 'port', 'credentials']
                  }
                },
                required: ['database']
              }
            },
            required: ['config']
          }
        };

        const result = MCPToolSchemaSchema.safeParse(toolWithNestedSchema);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.inputSchema.properties).toBeDefined();
          expect(result.data.inputSchema.required).toEqual(['config']);
        }
      });

      it('validates nested capabilities in MCPInitializeResult', () => {
        const complexInitResult: MCPInitializeResult = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: true },
            resources: {
              subscribe: true,
              listChanged: false
            },
            prompts: { listChanged: true },
            logging: {},
            experimental: {
              'custom-feature': { enabled: true },
              'beta-apis': { version: '0.1.0' }
            }
          },
          serverInfo: {
            name: 'advanced-mcp-server',
            version: '2.1.0'
          },
          instructions: 'Advanced server with experimental features enabled.'
        };

        const result = MCPInitializeResultSchema.safeParse(complexInitResult);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.capabilities.tools?.listChanged).toBe(true);
          expect(result.data.capabilities.resources?.subscribe).toBe(true);
          expect(result.data.capabilities.experimental).toBeDefined();
        }
      });

      it('rejects nested object with invalid structure', () => {
        const invalidNestedConfig = {
          name: 'invalid-tool',
          inputSchema: {
            type: 'object',
            properties: {
              nested: {
                type: 'object',
                properties: 'invalid-properties-value', // Should be object
                required: ['field']
              }
            },
            required: ['nested']
          }
        };

        const result = MCPToolSchemaSchema.safeParse(invalidNestedConfig);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
          // The error might be deep in the nested validation
          expect(result.error.issues.length).toBeGreaterThan(0);
        }
      });
    });

    describe('Default Value Verification', () => {
      it('applies default values correctly in complex schemas', () => {
        const configWithDefaults = {
          servers: {
            'test-server': {
              name: 'test-server',
              command: 'node',
              args: ['server.js'],
              env: {}
            }
          }
          // tools section omitted, should get default
        };

        const result = MCPConfigSchema.safeParse(configWithDefaults);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.servers).toBeDefined();
          expect(result.data.tools).toBeDefined(); // Should have default value
          expect(result.data.tools).toEqual({}); // Default is empty object
        }
      });

      it('preserves explicitly provided values over defaults', () => {
        const explicitConfig: MCPConfig = {
          servers: {
            'test-server': {
              name: 'test-server',
              command: 'node',
              args: ['server.js'],
              env: {}
            }
          },
          tools: {
            'custom-tool': {
              server: 'test-server',
              name: 'custom-tool'
            }
          }
        };

        const result = MCPConfigSchema.safeParse(explicitConfig);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.tools).toEqual({
            'custom-tool': {
              server: 'test-server',
              name: 'custom-tool'
            }
          });
        }
      });
    });

    describe('Complex Integration Scenarios', () => {
      it('validates complete MCP configuration with all components', () => {
        const fullConfig: MCPConfig = {
          servers: {
            'fs-server': {
              name: 'fs-server',
              command: 'npx',
              args: ['@modelcontextprotocol/server-filesystem', '/workspace'],
              env: { NODE_ENV: 'production' },
              cwd: '/workspace',
              timeout: 10000
            },
            'db-server': {
              name: 'db-server',
              command: 'python',
              args: ['-m', 'db_mcp_server'],
              env: {
                DB_HOST: 'localhost',
                DB_PORT: '5432'
              }
            }
          },
          tools: {
            'read-file': {
              server: 'fs-server',
              name: 'read_file'
            },
            'sql-query': {
              server: 'db-server',
              name: 'execute_query'
            }
          }
        };

        const result = MCPConfigSchema.safeParse(fullConfig);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(Object.keys(result.data.servers)).toHaveLength(2);
          expect(Object.keys(result.data.tools)).toHaveLength(2);
          expect(result.data.servers['fs-server'].timeout).toBe(10000);
          expect(result.data.servers['db-server'].timeout).toBeUndefined();
        }
      });

      it('validates tools list result with multiple content types', () => {
        const multiModalResult: MCPToolsCallResult = {
          content: [
            {
              type: 'text',
              text: 'Analysis complete'
            },
            {
              type: 'image',
              data: 'base64encodedimagedata',
              mimeType: 'image/png'
            },
            {
              type: 'resource',
              resource: {
                uri: 'file:///results/output.json',
                mimeType: 'application/json',
                text: '{"status": "success", "results": []}'
              }
            }
          ],
          isError: false
        };

        const result = MCPToolsCallResultSchema.safeParse(multiModalResult);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.content).toHaveLength(3);
          expect(result.data.content[0].type).toBe('text');
          expect(result.data.content[1].type).toBe('image');
          expect(result.data.content[2].type).toBe('resource');
          expect(result.data.isError).toBe(false);
        }
      });
    });
  });
});