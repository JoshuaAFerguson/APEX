import { describe, it, expect } from 'vitest';
import {
  MCPToolSchemaSchema,
  MCPToolCapabilitiesSchema,
  MCPToolSchema,
  MCPToolRegistryEntrySchema,
  MCPToolInvocationRequestSchema,
  MCPToolInvocationResponseSchema,
  MCPToolResultContentSchema,
  MCPToolResultContentTypeSchema,
  UnifiedToolRegistryEntrySchema,
  ToolRegistryStateSchema,
  ToolDiscoveryEventSchema,
  ToolSourceTypeSchema,
  ToolSourceSchema,
  type MCPToolSchema as MCPToolSchemaType,
  type MCPToolCapabilities,
  type MCPTool,
  type MCPToolRegistryEntry,
  type MCPToolInvocationRequest,
  type MCPToolInvocationResponse,
  type MCPToolResultContent,
  type MCPToolResultContentType,
  type UnifiedToolRegistryEntry,
  type ToolRegistryState,
  type ToolDiscoveryEvent,
  type ToolSourceType,
  type ToolSource,
} from '../types.js';

/**
 * Comprehensive test suite for MCP Tool types and schemas
 * Tests validation, edge cases, and TypeScript type inference for MCP tool-related functionality
 */
describe('MCP Tool Types and Schemas', () => {
  describe('MCPToolSchemaSchema', () => {
    it('should accept minimal tool schema', () => {
      const minimalSchema = {
        type: 'object' as const,
      };

      const result = MCPToolSchemaSchema.parse(minimalSchema);
      expect(result.type).toBe('object');
      expect(result.properties).toEqual({}); // default
      expect(result.required).toEqual([]); // default
      expect(result.additionalProperties).toBe(true); // default
    });

    it('should accept complete tool schema with all fields', () => {
      const completeSchema: MCPToolSchemaType = {
        type: 'object',
        title: 'Test Tool Schema',
        description: 'Schema for testing tool parameters',
        properties: {
          input: {
            type: 'string',
            description: 'Input parameter',
            minLength: 1,
            maxLength: 255,
          },
          options: {
            type: 'object',
            properties: {
              verbose: { type: 'boolean' },
              timeout: { type: 'number', minimum: 0 },
            },
            additionalProperties: false,
          },
          items: {
            type: 'array',
            items: { type: 'string' },
            minItems: 0,
            maxItems: 100,
          },
        },
        required: ['input'],
        additionalProperties: false,
        examples: [
          {
            input: 'test',
            options: { verbose: true },
            items: ['item1', 'item2'],
          },
        ],
        $schema: 'https://json-schema.org/draft/2020-12/schema',
      };

      const result = MCPToolSchemaSchema.parse(completeSchema);
      expect(result.title).toBe('Test Tool Schema');
      expect(result.properties!.input.type).toBe('string');
      expect(result.required).toContain('input');
      expect(result.examples).toHaveLength(1);
    });

    it('should handle nested object properties', () => {
      const nestedSchema = {
        type: 'object' as const,
        properties: {
          config: {
            type: 'object' as const,
            properties: {
              database: {
                type: 'object' as const,
                properties: {
                  host: { type: 'string' as const },
                  port: { type: 'number' as const, minimum: 1, maximum: 65535 },
                  credentials: {
                    type: 'object' as const,
                    properties: {
                      username: { type: 'string' as const },
                      password: { type: 'string' as const },
                    },
                    required: ['username', 'password'],
                  },
                },
                required: ['host', 'port'],
              },
            },
            required: ['database'],
          },
        },
        required: ['config'],
      };

      const result = MCPToolSchemaSchema.parse(nestedSchema);
      expect(result.properties!.config.properties!.database.properties!.port.maximum).toBe(65535);
      expect(result.properties!.config.properties!.database.required).toContain('host');
    });

    it('should handle array schemas with complex items', () => {
      const arraySchema = {
        type: 'object' as const,
        properties: {
          items: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                id: { type: 'integer' as const, minimum: 1 },
                name: { type: 'string' as const, pattern: '^[a-zA-Z]+$' },
                tags: {
                  type: 'array' as const,
                  items: { type: 'string' as const },
                  uniqueItems: true,
                },
              },
              required: ['id', 'name'],
            },
            minItems: 1,
            maxItems: 50,
          },
        },
        required: ['items'],
      };

      const result = MCPToolSchemaSchema.parse(arraySchema);
      expect(result.properties!.items.items!.properties!.tags.uniqueItems).toBe(true);
      expect(result.properties!.items.minItems).toBe(1);
    });

    it('should reject invalid type values', () => {
      const invalidTypes = ['invalid', 'any', 'mixed', 123, null, undefined];

      invalidTypes.forEach(type => {
        const schema = { type };
        expect(() => MCPToolSchemaSchema.parse(schema)).toThrow();
      });
    });
  });

  describe('MCPToolCapabilitiesSchema', () => {
    it('should accept minimal capabilities with defaults', () => {
      const minimalCapabilities = {};

      const result = MCPToolCapabilitiesSchema.parse(minimalCapabilities);
      expect(result.streaming).toBe(false); // default
      expect(result.cancellable).toBe(false); // default
      expect(result.readOnly).toBe(false); // default
      expect(result.hasSideEffects).toBe(true); // default
    });

    it('should accept all capabilities set to true', () => {
      const allTrueCapabilities: MCPToolCapabilities = {
        streaming: true,
        cancellable: true,
        readOnly: true,
        hasSideEffects: true,
      };

      const result = MCPToolCapabilitiesSchema.parse(allTrueCapabilities);
      expect(result.streaming).toBe(true);
      expect(result.cancellable).toBe(true);
      expect(result.readOnly).toBe(true);
      expect(result.hasSideEffects).toBe(true);
    });

    it('should accept mixed capabilities', () => {
      const mixedCapabilities: MCPToolCapabilities = {
        streaming: true,
        cancellable: false,
        readOnly: true,
        hasSideEffects: false,
      };

      const result = MCPToolCapabilitiesSchema.parse(mixedCapabilities);
      expect(result.streaming).toBe(true);
      expect(result.cancellable).toBe(false);
      expect(result.readOnly).toBe(true);
      expect(result.hasSideEffects).toBe(false);
    });

    it('should reject non-boolean values', () => {
      const invalidCapabilities = [
        { streaming: 'true' },
        { cancellable: 1 },
        { readOnly: null },
        { hasSideEffects: undefined },
      ];

      invalidCapabilities.forEach(capabilities => {
        expect(() => MCPToolCapabilitiesSchema.parse(capabilities)).toThrow();
      });
    });
  });

  describe('MCPToolSchema', () => {
    const baseToolSchema = {
      name: 'test-tool',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: { type: 'string' as const },
        },
      },
      serverId: 'test-server',
    };

    it('should accept minimal MCP tool definition', () => {
      const result = MCPToolSchema.parse(baseToolSchema);
      expect(result.name).toBe('test-tool');
      expect(result.serverId).toBe('test-server');
      expect(result.available).toBe(true); // default
      expect(result.tags).toEqual([]); // default
    });

    it('should accept complete MCP tool definition', () => {
      const completeTool: MCPTool = {
        name: 'comprehensive-tool',
        description: 'A comprehensive tool for testing',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Input parameter' },
            options: {
              type: 'object',
              properties: {
                timeout: { type: 'number', minimum: 0 },
                retries: { type: 'integer', minimum: 0, maximum: 10 },
              },
            },
          },
          required: ['input'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            result: { type: 'string' },
            metadata: {
              type: 'object',
              properties: {
                executionTime: { type: 'number' },
                cached: { type: 'boolean' },
              },
            },
          },
          required: ['result'],
        },
        serverId: 'comprehensive-server',
        serverName: 'Comprehensive MCP Server',
        capabilities: {
          streaming: true,
          cancellable: true,
          readOnly: false,
          hasSideEffects: true,
        },
        available: true,
        version: '2.1.0',
        tags: ['testing', 'comprehensive'],
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      };

      const result = MCPToolSchema.parse(completeTool);
      expect(result.description).toBe('A comprehensive tool for testing');
      expect(result.outputSchema?.required).toContain('result');
      expect(result.capabilities?.streaming).toBe(true);
      expect(result.tags).toContain('testing');
      expect(result.version).toBe('2.1.0');
    });

    it('should accept tool with unavailable status', () => {
      const unavailableTool = {
        ...baseToolSchema,
        available: false,
        unavailableReason: 'Server is down for maintenance',
      };

      const result = MCPToolSchema.parse(unavailableTool);
      expect(result.available).toBe(false);
      expect(result.unavailableReason).toBe('Server is down for maintenance');
    });

    it('should reject tool with empty name', () => {
      const invalidTool = {
        ...baseToolSchema,
        name: '',
      };

      expect(() => MCPToolSchema.parse(invalidTool)).toThrow();
    });

    it('should reject tool with empty serverId', () => {
      const invalidTool = {
        ...baseToolSchema,
        serverId: '',
      };

      expect(() => MCPToolSchema.parse(invalidTool)).toThrow();
    });
  });

  describe('ToolSourceTypeSchema', () => {
    it('should accept all valid source types', () => {
      const validSourceTypes: ToolSourceType[] = ['builtin', 'custom', 'mcp', 'plugin'];

      validSourceTypes.forEach(sourceType => {
        const result = ToolSourceTypeSchema.parse(sourceType);
        expect(result).toBe(sourceType);
      });
    });

    it('should reject invalid source types', () => {
      const invalidSourceTypes = ['invalid', 'external', 'api', 123, null, undefined];

      invalidSourceTypes.forEach(sourceType => {
        expect(() => ToolSourceTypeSchema.parse(sourceType)).toThrow();
      });
    });
  });

  describe('ToolSourceSchema', () => {
    it('should accept minimal tool source', () => {
      const minimalSource: ToolSource = {
        type: 'builtin',
      };

      const result = ToolSourceSchema.parse(minimalSource);
      expect(result.type).toBe('builtin');
    });

    it('should accept complete tool source', () => {
      const completeSource: ToolSource = {
        type: 'mcp',
        sourceId: 'filesystem-server',
        sourceName: 'Filesystem MCP Server',
      };

      const result = ToolSourceSchema.parse(completeSource);
      expect(result.type).toBe('mcp');
      expect(result.sourceId).toBe('filesystem-server');
      expect(result.sourceName).toBe('Filesystem MCP Server');
    });

    it('should handle different source types with appropriate metadata', () => {
      const sources = [
        { type: 'builtin' as const },
        { type: 'custom' as const, sourceId: 'user-config', sourceName: 'User Configuration' },
        { type: 'mcp' as const, sourceId: 'api-server', sourceName: 'API MCP Server' },
        { type: 'plugin' as const, sourceId: 'plugin-123', sourceName: 'Test Plugin' },
      ];

      sources.forEach(source => {
        const result = ToolSourceSchema.parse(source);
        expect(result.type).toBe(source.type);
        if ('sourceId' in source) {
          expect(result.sourceId).toBe(source.sourceId);
        }
      });
    });
  });

  describe('MCPToolRegistryEntrySchema', () => {
    const baseMCPTool: MCPTool = {
      name: 'registry-tool',
      inputSchema: { type: 'object', properties: {} },
      serverId: 'registry-server',
    };

    const baseSource: ToolSource = {
      type: 'mcp',
      sourceId: 'registry-server',
    };

    it('should accept minimal MCP tool registry entry', () => {
      const minimalEntry: MCPToolRegistryEntry = {
        tool: baseMCPTool,
        source: baseSource,
      };

      const result = MCPToolRegistryEntrySchema.parse(minimalEntry);
      expect(result.tool.name).toBe('registry-tool');
      expect(result.source.type).toBe('mcp');
      expect(result.available).toBe(true); // default
      expect(result.stats.invocationCount).toBe(0); // default
    });

    it('should accept complete MCP tool registry entry', () => {
      const completeEntry: MCPToolRegistryEntry = {
        tool: {
          ...baseMCPTool,
          description: 'Registry tool for testing',
          capabilities: { streaming: true, cancellable: false },
        },
        source: {
          type: 'mcp',
          sourceId: 'registry-server',
          sourceName: 'Registry MCP Server',
        },
        available: true,
        stats: {
          invocationCount: 150,
          successCount: 145,
          failureCount: 5,
          lastInvoked: new Date('2024-01-15T10:00:00Z'),
          averageDuration: 1250,
          lastSuccess: new Date('2024-01-15T09:30:00Z'),
          lastFailure: new Date('2024-01-14T15:00:00Z'),
        },
        registeredAt: new Date('2024-01-01T00:00:00Z'),
        lastSeen: new Date('2024-01-15T10:00:00Z'),
      };

      const result = MCPToolRegistryEntrySchema.parse(completeEntry);
      expect(result.tool.description).toBe('Registry tool for testing');
      expect(result.stats.invocationCount).toBe(150);
      expect(result.stats.averageDuration).toBe(1250);
      expect(result.registeredAt).toEqual(new Date('2024-01-01T00:00:00Z'));
    });

    it('should handle unavailable tool with reason', () => {
      const unavailableEntry: MCPToolRegistryEntry = {
        tool: baseMCPTool,
        source: baseSource,
        available: false,
        unavailableReason: 'MCP server connection lost',
        stats: { invocationCount: 0, successCount: 0, failureCount: 0 },
      };

      const result = MCPToolRegistryEntrySchema.parse(unavailableEntry);
      expect(result.available).toBe(false);
      expect(result.unavailableReason).toBe('MCP server connection lost');
    });
  });

  describe('UnifiedToolRegistryEntrySchema', () => {
    it('should accept minimal unified tool registry entry', () => {
      const minimalEntry: UnifiedToolRegistryEntry = {
        id: 'unified-tool',
        name: 'unified-tool',
        description: 'A unified tool for testing',
        source: { type: 'builtin' },
        inputSchema: { type: 'object', properties: {} },
      };

      const result = UnifiedToolRegistryEntrySchema.parse(minimalEntry);
      expect(result.id).toBe('unified-tool');
      expect(result.available).toBe(true); // default
      expect(result.stats.invocationCount).toBe(0); // default
    });

    it('should accept complete unified tool registry entry', () => {
      const completeEntry: UnifiedToolRegistryEntry = {
        id: 'comprehensive-unified-tool',
        name: 'comprehensive-tool',
        description: 'A comprehensive unified tool',
        source: {
          type: 'mcp',
          sourceId: 'comprehensive-server',
          sourceName: 'Comprehensive MCP Server',
        },
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Input parameter' },
          },
          required: ['input'],
        },
        available: true,
        capabilities: {
          streaming: true,
          cancellable: true,
          readOnly: false,
          hasSideEffects: true,
        },
        stats: {
          invocationCount: 200,
          successCount: 190,
          failureCount: 10,
          lastInvoked: new Date('2024-01-20T10:00:00Z'),
          averageDuration: 800,
          lastSuccess: new Date('2024-01-20T09:45:00Z'),
          lastFailure: new Date('2024-01-19T14:30:00Z'),
        },
        tags: ['comprehensive', 'unified'],
        version: '3.0.0',
        registeredAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-20T00:00:00Z'),
      };

      const result = UnifiedToolRegistryEntrySchema.parse(completeEntry);
      expect(result.description).toBe('A comprehensive unified tool');
      expect(result.capabilities?.streaming).toBe(true);
      expect(result.stats.averageDuration).toBe(800);
      expect(result.tags).toContain('unified');
    });

    it('should reject entry with empty id or name', () => {
      const invalidEntries = [
        {
          id: '',
          name: 'test',
          description: 'Test',
          source: { type: 'builtin' as const },
          inputSchema: { type: 'object' as const, properties: {} },
        },
        {
          id: 'test',
          name: '',
          description: 'Test',
          source: { type: 'builtin' as const },
          inputSchema: { type: 'object' as const, properties: {} },
        },
      ];

      invalidEntries.forEach(entry => {
        expect(() => UnifiedToolRegistryEntrySchema.parse(entry)).toThrow();
      });
    });
  });

  describe('ToolRegistryStateSchema', () => {
    it('should accept minimal registry state', () => {
      const minimalState: ToolRegistryState = {
        tools: {},
        bySource: {
          builtin: [],
          custom: [],
          mcp: [],
          plugin: [],
        },
        lastUpdated: new Date(),
        totalCount: 0,
        availableCount: 0,
      };

      const result = ToolRegistryStateSchema.parse(minimalState);
      expect(result.tools).toEqual({});
      expect(result.totalCount).toBe(0);
      expect(result.availableCount).toBe(0);
    });

    it('should accept complete registry state with tools', () => {
      const tool1: UnifiedToolRegistryEntry = {
        id: 'tool-1',
        name: 'tool-1',
        description: 'First tool',
        source: { type: 'builtin' },
        inputSchema: { type: 'object', properties: {} },
        available: true,
      };

      const tool2: UnifiedToolRegistryEntry = {
        id: 'tool-2',
        name: 'tool-2',
        description: 'Second tool',
        source: { type: 'mcp', sourceId: 'server-1' },
        inputSchema: { type: 'object', properties: {} },
        available: false,
        unavailableReason: 'Server offline',
      };

      const completeState: ToolRegistryState = {
        tools: {
          'tool-1': tool1,
          'tool-2': tool2,
        },
        bySource: {
          builtin: ['tool-1'],
          custom: [],
          mcp: ['tool-2'],
          plugin: [],
        },
        byMCPServer: {
          'server-1': ['tool-2'],
        },
        lastUpdated: new Date('2024-01-20T12:00:00Z'),
        totalCount: 2,
        availableCount: 1,
      };

      const result = ToolRegistryStateSchema.parse(completeState);
      expect(result.tools['tool-1'].available).toBe(true);
      expect(result.tools['tool-2'].available).toBe(false);
      expect(result.bySource.builtin).toContain('tool-1');
      expect(result.bySource.mcp).toContain('tool-2');
      expect(result.totalCount).toBe(2);
      expect(result.availableCount).toBe(1);
    });
  });

  describe('MCPToolInvocationRequestSchema', () => {
    it('should accept minimal invocation request', () => {
      const minimalRequest: MCPToolInvocationRequest = {
        toolName: 'test-tool',
        serverId: 'test-server',
      };

      const result = MCPToolInvocationRequestSchema.parse(minimalRequest);
      expect(result.toolName).toBe('test-tool');
      expect(result.serverId).toBe('test-server');
      expect(result.arguments).toEqual({}); // default
      expect(result.stream).toBe(false); // default
    });

    it('should accept complete invocation request', () => {
      const completeRequest: MCPToolInvocationRequest = {
        toolName: 'comprehensive-tool',
        serverId: 'comprehensive-server',
        arguments: {
          input: 'test data',
          options: { verbose: true, timeout: 5000 },
          items: ['item1', 'item2', 'item3'],
        },
        requestId: 'req-12345',
        timeout: 30000,
        stream: true,
      };

      const result = MCPToolInvocationRequestSchema.parse(completeRequest);
      expect(result.arguments.input).toBe('test data');
      expect(result.arguments.options.verbose).toBe(true);
      expect(result.timeout).toBe(30000);
      expect(result.stream).toBe(true);
    });

    it('should reject request with empty tool name or server ID', () => {
      const invalidRequests = [
        { toolName: '', serverId: 'test-server' },
        { toolName: 'test-tool', serverId: '' },
        { serverId: 'test-server' }, // missing toolName
        { toolName: 'test-tool' }, // missing serverId
      ];

      invalidRequests.forEach(request => {
        expect(() => MCPToolInvocationRequestSchema.parse(request)).toThrow();
      });
    });
  });

  describe('MCPToolResultContentSchema', () => {
    it('should accept text content', () => {
      const textContent: MCPToolResultContent = {
        type: 'text',
        text: 'This is the result text',
      };

      const result = MCPToolResultContentSchema.parse(textContent);
      expect(result.type).toBe('text');
      expect(result.text).toBe('This is the result text');
    });

    it('should accept image content', () => {
      const imageContent: MCPToolResultContent = {
        type: 'image',
        data: 'base64encodedimagdata...',
        mimeType: 'image/png',
        alt: 'Generated chart image',
      };

      const result = MCPToolResultContentSchema.parse(imageContent);
      expect(result.type).toBe('image');
      expect(result.data).toBe('base64encodedimagdata...');
      expect(result.mimeType).toBe('image/png');
    });

    it('should accept resource content', () => {
      const resourceContent: MCPToolResultContent = {
        type: 'resource',
        uri: 'file:///path/to/resource.txt',
        mimeType: 'text/plain',
      };

      const result = MCPToolResultContentSchema.parse(resourceContent);
      expect(result.type).toBe('resource');
      expect(result.uri).toBe('file:///path/to/resource.txt');
    });

    it('should accept error content', () => {
      const errorContent: MCPToolResultContent = {
        type: 'error',
        error: 'Tool execution failed: Invalid input parameter',
      };

      const result = MCPToolResultContentSchema.parse(errorContent);
      expect(result.type).toBe('error');
      expect(result.error).toBe('Tool execution failed: Invalid input parameter');
    });

    it('should reject invalid content type', () => {
      const invalidContent = {
        type: 'invalid',
        text: 'Some text',
      };

      expect(() => MCPToolResultContentSchema.parse(invalidContent)).toThrow();
    });
  });

  describe('MCPToolInvocationResponseSchema', () => {
    it('should accept minimal successful response', () => {
      const minimalResponse: MCPToolInvocationResponse = {
        success: true,
      };

      const result = MCPToolInvocationResponseSchema.parse(minimalResponse);
      expect(result.success).toBe(true);
      expect(result.content).toEqual([]); // default
      expect(result.isPartial).toBe(false); // default
    });

    it('should accept complete successful response', () => {
      const completeResponse: MCPToolInvocationResponse = {
        requestId: 'req-12345',
        success: true,
        content: [
          {
            type: 'text',
            text: 'Operation completed successfully',
          },
          {
            type: 'image',
            data: 'base64imagedata...',
            mimeType: 'image/png',
            alt: 'Result visualization',
          },
        ],
        isPartial: false,
        metadata: {
          executionTime: 1500,
          resourcesUsed: ['cpu', 'memory'],
          cacheHit: false,
        },
        usage: {
          inputTokens: 150,
          outputTokens: 300,
          totalTokens: 450,
        },
      };

      const result = MCPToolInvocationResponseSchema.parse(completeResponse);
      expect(result.success).toBe(true);
      expect(result.content).toHaveLength(2);
      expect(result.content[0].type).toBe('text');
      expect(result.metadata?.executionTime).toBe(1500);
      expect(result.usage?.totalTokens).toBe(450);
    });

    it('should accept failed response with error', () => {
      const failedResponse: MCPToolInvocationResponse = {
        success: false,
        error: {
          code: 'TOOL_EXECUTION_ERROR',
          message: 'Tool failed to execute: Invalid parameters',
          details: { parameter: 'input', value: 'invalid' },
        },
      };

      const result = MCPToolInvocationResponseSchema.parse(failedResponse);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOOL_EXECUTION_ERROR');
      expect(result.error?.message).toContain('Invalid parameters');
    });

    it('should accept streaming partial response', () => {
      const streamingResponse: MCPToolInvocationResponse = {
        requestId: 'stream-req-123',
        success: true,
        content: [
          {
            type: 'text',
            text: 'Partial result chunk 1...',
          },
        ],
        isPartial: true,
      };

      const result = MCPToolInvocationResponseSchema.parse(streamingResponse);
      expect(result.isPartial).toBe(true);
      expect(result.content[0].text).toContain('Partial result');
    });
  });

  describe('Integration and Edge Cases', () => {
    it('should handle complex tool registry workflow', () => {
      // 1. Create a tool with complex schema
      const complexTool: MCPTool = {
        name: 'data-processor',
        description: 'Processes complex data structures',
        inputSchema: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer', minimum: 1 },
                  payload: {
                    type: 'object',
                    properties: {
                      content: { type: 'string', minLength: 1 },
                      metadata: {
                        type: 'object',
                        additionalProperties: true,
                      },
                    },
                    required: ['content'],
                  },
                },
                required: ['id', 'payload'],
              },
              minItems: 1,
              maxItems: 1000,
            },
            options: {
              type: 'object',
              properties: {
                format: { type: 'string', enum: ['json', 'xml', 'csv'] },
                compress: { type: 'boolean' },
                timeout: { type: 'number', minimum: 1000, maximum: 300000 },
              },
            },
          },
          required: ['data'],
        },
        serverId: 'data-server',
        serverName: 'Data Processing MCP Server',
        capabilities: {
          streaming: true,
          cancellable: true,
          readOnly: false,
          hasSideEffects: true,
        },
        available: true,
        version: '2.1.0',
        tags: ['data', 'processing', 'transform'],
      };

      // 2. Register in tool registry
      const registryEntry: MCPToolRegistryEntry = {
        tool: complexTool,
        source: {
          type: 'mcp',
          sourceId: 'data-server',
          sourceName: 'Data Processing MCP Server',
        },
        available: true,
        stats: {
          invocationCount: 0,
          successCount: 0,
          failureCount: 0,
        },
        registeredAt: new Date(),
      };

      // 3. Create invocation request
      const invocationRequest: MCPToolInvocationRequest = {
        toolName: 'data-processor',
        serverId: 'data-server',
        arguments: {
          data: [
            {
              id: 1,
              payload: {
                content: 'Test content 1',
                metadata: { source: 'test', priority: 1 },
              },
            },
            {
              id: 2,
              payload: {
                content: 'Test content 2',
                metadata: { source: 'test', priority: 2 },
              },
            },
          ],
          options: {
            format: 'json',
            compress: false,
            timeout: 30000,
          },
        },
        requestId: 'workflow-test-123',
        timeout: 60000,
        stream: true,
      };

      // 4. Process response
      const invocationResponse: MCPToolInvocationResponse = {
        requestId: 'workflow-test-123',
        success: true,
        content: [
          {
            type: 'text',
            text: '{"processed_items": 2, "format": "json", "compressed": false}',
          },
        ],
        metadata: {
          executionTime: 2500,
          itemsProcessed: 2,
          cacheUsed: false,
        },
      };

      // Validate all components
      const validTool = MCPToolSchema.parse(complexTool);
      const validRegistry = MCPToolRegistryEntrySchema.parse(registryEntry);
      const validRequest = MCPToolInvocationRequestSchema.parse(invocationRequest);
      const validResponse = MCPToolInvocationResponseSchema.parse(invocationResponse);

      expect(validTool.name).toBe('data-processor');
      expect(validRegistry.tool.capabilities?.streaming).toBe(true);
      expect(validRequest.arguments.data).toHaveLength(2);
      expect(validResponse.success).toBe(true);
    });

    it('should handle Unicode and special characters in tool names', () => {
      const unicodeTool: MCPTool = {
        name: 'тест-инструмент-测试工具-🔧',
        description: 'Unicode test tool тест 测试 🚀',
        inputSchema: { type: 'object', properties: {} },
        serverId: 'unicode-server-测试',
        serverName: 'Unicode MCP Server тест',
        tags: ['unicode', 'тест', '测试', '🏷️'],
      };

      const result = MCPToolSchema.parse(unicodeTool);
      expect(result.name).toBe('тест-инструмент-测试工具-🔧');
      expect(result.tags).toContain('🏷️');
    });

    it('should handle very large tool schemas', () => {
      const properties: any = {};
      for (let i = 0; i < 100; i++) {
        properties[`param_${i}`] = {
          type: 'string',
          description: `Parameter ${i} for testing`,
          pattern: '^[a-zA-Z0-9_]+$',
        };
      }

      const largeTool: MCPTool = {
        name: 'large-schema-tool',
        description: 'Tool with a very large parameter schema',
        inputSchema: {
          type: 'object',
          properties,
          additionalProperties: false,
        },
        serverId: 'large-server',
      };

      const result = MCPToolSchema.parse(largeTool);
      expect(Object.keys(result.inputSchema.properties!)).toHaveLength(100);
    });

    it('should handle tool with empty arrays and null values appropriately', () => {
      const edgeTool: MCPTool = {
        name: 'edge-case-tool',
        description: 'Tool for testing edge cases',
        inputSchema: {
          type: 'object',
          properties: {
            optionalArray: {
              type: 'array',
              items: { type: 'string' },
              default: [],
            },
            nullableField: {
              type: ['string', 'null'],
              default: null,
            },
          },
        },
        serverId: 'edge-server',
        tags: [], // Empty array
        capabilities: {
          streaming: false,
          cancellable: false,
          readOnly: true,
          hasSideEffects: false,
        },
      };

      const result = MCPToolSchema.parse(edgeTool);
      expect(result.tags).toEqual([]);
      expect(result.capabilities?.readOnly).toBe(true);
      expect(result.capabilities?.hasSideEffects).toBe(false);
    });
  });
});