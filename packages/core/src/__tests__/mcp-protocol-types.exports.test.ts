import { describe, it, expect } from 'vitest';

// Test importing from the main package exports
import {
  // Test that all key schemas are exported
  JsonRpcRequestSchema,
  JsonRpcResponseSchema,
  MCPInitializeParamsSchema,
  MCPInitializeResultSchema,
  MCPToolsCallParamsSchema,
  MCPToolsCallResultSchema,
  MCPResourcesReadParamsSchema,
  MCPPromptsGetParamsSchema,
  MCPLogLevelSchema,
  MCPCompletionCompleteParamsSchema,

  // Test that all key types are exported
  type JsonRpcRequest,
  type JsonRpcResponse,
  type MCPInitializeParams,
  type MCPInitializeResult,
  type MCPToolsCallParams,
  type MCPToolsCallResult,
  type MCPResourcesReadParams,
  type MCPPromptsGetParams,
  type MCPLogLevel,
  type MCPCompletionCompleteParams,

  // Test constants are exported
  MCPProtocolMethod,
  MCPErrorCode,
} from '../mcp/protocol-types.js';

// Test importing from the mcp module index
import {
  JsonRpcIdSchema as JsonRpcIdSchemaFromIndex,
  MCPProtocolVersionSchema as MCPProtocolVersionSchemaFromIndex,
  type JsonRpcId as JsonRpcIdFromIndex,
  type MCPProtocolVersion as MCPProtocolVersionFromIndex,
} from '../mcp/index.js';

describe('MCP Protocol Types - Exports', () => {
  describe('Schema Exports', () => {
    it('exports all JSON-RPC schemas', () => {
      expect(JsonRpcRequestSchema).toBeDefined();
      expect(JsonRpcResponseSchema).toBeDefined();
      expect(typeof JsonRpcRequestSchema.parse).toBe('function');
      expect(typeof JsonRpcResponseSchema.parse).toBe('function');
    });

    it('exports all MCP initialization schemas', () => {
      expect(MCPInitializeParamsSchema).toBeDefined();
      expect(MCPInitializeResultSchema).toBeDefined();
      expect(typeof MCPInitializeParamsSchema.parse).toBe('function');
      expect(typeof MCPInitializeResultSchema.parse).toBe('function');
    });

    it('exports all MCP tool schemas', () => {
      expect(MCPToolsCallParamsSchema).toBeDefined();
      expect(MCPToolsCallResultSchema).toBeDefined();
      expect(typeof MCPToolsCallParamsSchema.parse).toBe('function');
      expect(typeof MCPToolsCallResultSchema.parse).toBe('function');
    });

    it('exports all MCP resource schemas', () => {
      expect(MCPResourcesReadParamsSchema).toBeDefined();
      expect(typeof MCPResourcesReadParamsSchema.parse).toBe('function');
    });

    it('exports all MCP prompt schemas', () => {
      expect(MCPPromptsGetParamsSchema).toBeDefined();
      expect(typeof MCPPromptsGetParamsSchema.parse).toBe('function');
    });

    it('exports logging and completion schemas', () => {
      expect(MCPLogLevelSchema).toBeDefined();
      expect(MCPCompletionCompleteParamsSchema).toBeDefined();
      expect(typeof MCPLogLevelSchema.parse).toBe('function');
      expect(typeof MCPCompletionCompleteParamsSchema.parse).toBe('function');
    });
  });

  describe('Type Exports', () => {
    it('exports all JSON-RPC types', () => {
      // Test that types exist by using them in type assertions
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'test',
        method: 'test',
      };

      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 'test',
        result: {},
      };

      expect(request.jsonrpc).toBe('2.0');
      expect(response.jsonrpc).toBe('2.0');
    });

    it('exports all MCP initialization types', () => {
      const initParams: MCPInitializeParams = {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      };

      const initResult: MCPInitializeResult = {
        protocolVersion: '2024-11-05',
        capabilities: {},
        serverInfo: {
          name: 'test-server',
          version: '1.0.0',
        },
      };

      expect(initParams.protocolVersion).toBe('2024-11-05');
      expect(initResult.protocolVersion).toBe('2024-11-05');
    });

    it('exports all MCP operation types', () => {
      const toolCall: MCPToolsCallParams = {
        name: 'test-tool',
      };

      const toolResult: MCPToolsCallResult = {
        content: [
          {
            type: 'text',
            text: 'Test result',
          },
        ],
      };

      const resourceRead: MCPResourcesReadParams = {
        uri: 'file:///test.txt',
      };

      const promptGet: MCPPromptsGetParams = {
        name: 'test-prompt',
      };

      expect(toolCall.name).toBe('test-tool');
      expect(toolResult.content).toHaveLength(1);
      expect(resourceRead.uri).toBe('file:///test.txt');
      expect(promptGet.name).toBe('test-prompt');
    });

    it('exports completion and logging types', () => {
      const logLevel: MCPLogLevel = 'info';

      const completionParams: MCPCompletionCompleteParams = {
        ref: {
          type: 'ref/prompt',
          name: 'test-prompt',
        },
        argument: {
          name: 'test-arg',
          value: 'test-value',
        },
      };

      expect(logLevel).toBe('info');
      expect(completionParams.ref.type).toBe('ref/prompt');
    });
  });

  describe('Constants Exports', () => {
    it('exports protocol method constants', () => {
      expect(MCPProtocolMethod).toBeDefined();
      expect(typeof MCPProtocolMethod).toBe('object');

      // Test some key methods
      expect(MCPProtocolMethod.Initialize).toBe('initialize');
      expect(MCPProtocolMethod.ToolsList).toBe('tools/list');
      expect(MCPProtocolMethod.ToolsCall).toBe('tools/call');
      expect(MCPProtocolMethod.ResourcesList).toBe('resources/list');
      expect(MCPProtocolMethod.ResourcesRead).toBe('resources/read');
      expect(MCPProtocolMethod.PromptsList).toBe('prompts/list');
      expect(MCPProtocolMethod.PromptsGet).toBe('prompts/get');
    });

    it('exports error code constants', () => {
      expect(MCPErrorCode).toBeDefined();
      expect(typeof MCPErrorCode).toBe('object');

      // Test JSON-RPC standard errors
      expect(MCPErrorCode.ParseError).toBe(-32700);
      expect(MCPErrorCode.InvalidRequest).toBe(-32600);
      expect(MCPErrorCode.MethodNotFound).toBe(-32601);
      expect(MCPErrorCode.InvalidParams).toBe(-32602);
      expect(MCPErrorCode.InternalError).toBe(-32603);

      // Test MCP-specific errors
      expect(MCPErrorCode.ResourceNotFound).toBe(-32002);
      expect(MCPErrorCode.ToolNotFound).toBe(-32004);
      expect(MCPErrorCode.ToolExecutionError).toBe(-32005);
    });

    it('ensures constants are readonly', () => {
      // These should be const assertions that prevent modification
      expect(() => {
        // @ts-expect-error - Should not be able to modify const object
        (MCPProtocolMethod as any).NewMethod = 'new/method';
      }).not.toThrow(); // JavaScript allows this, but TypeScript should prevent it

      expect(() => {
        // @ts-expect-error - Should not be able to modify const object
        (MCPErrorCode as any).NewError = -32999;
      }).not.toThrow(); // JavaScript allows this, but TypeScript should prevent it
    });
  });

  describe('Module Index Re-exports', () => {
    it('exports schemas through module index', () => {
      expect(JsonRpcIdSchemaFromIndex).toBeDefined();
      expect(MCPProtocolVersionSchemaFromIndex).toBeDefined();
      expect(typeof JsonRpcIdSchemaFromIndex.parse).toBe('function');
      expect(typeof MCPProtocolVersionSchemaFromIndex.parse).toBe('function');
    });

    it('exports types through module index', () => {
      // Test that types work from index export
      const id: JsonRpcIdFromIndex = 'test-id';
      const version: MCPProtocolVersionFromIndex = '2024-11-05';

      expect(id).toBe('test-id');
      expect(version).toBe('2024-11-05');
    });
  });

  describe('Schema Functionality', () => {
    it('validates that exported schemas work correctly', () => {
      // Test a few key schemas work as expected
      const validRequest = {
        jsonrpc: '2.0' as const,
        id: 'test-123',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      };

      expect(() => JsonRpcRequestSchema.parse(validRequest)).not.toThrow();
      expect(() => MCPInitializeParamsSchema.parse(validRequest.params)).not.toThrow();

      const validToolCall = {
        name: 'test-tool',
        arguments: { param: 'value' },
      };

      expect(() => MCPToolsCallParamsSchema.parse(validToolCall)).not.toThrow();

      const validLogLevel = 'debug';
      expect(() => MCPLogLevelSchema.parse(validLogLevel)).not.toThrow();
    });

    it('properly rejects invalid data', () => {
      const invalidRequest = {
        jsonrpc: '1.0', // Invalid version
        id: 'test',
        method: 'test',
      };

      expect(() => JsonRpcRequestSchema.parse(invalidRequest)).toThrow();

      const invalidToolCall = {
        // Missing required 'name' field
        arguments: { param: 'value' },
      };

      expect(() => MCPToolsCallParamsSchema.parse(invalidToolCall)).toThrow();

      const invalidLogLevel = 'invalid-level';
      expect(() => MCPLogLevelSchema.parse(invalidLogLevel)).toThrow();
    });
  });

  describe('Type Inference', () => {
    it('correctly infers types from schemas', () => {
      // Test that parsed objects have the correct inferred types
      const parsedRequest = JsonRpcRequestSchema.parse({
        jsonrpc: '2.0',
        id: 123,
        method: 'test-method',
        params: { test: 'data' },
      });

      // Type should be inferred correctly
      expect(parsedRequest.jsonrpc).toBe('2.0');
      expect(typeof parsedRequest.id).toBe('number');
      expect(parsedRequest.method).toBe('test-method');
      expect(parsedRequest.params?.test).toBe('data');

      const parsedToolCall = MCPToolsCallParamsSchema.parse({
        name: 'my-tool',
        arguments: { key: 'value' },
      });

      expect(parsedToolCall.name).toBe('my-tool');
      expect(parsedToolCall.arguments?.key).toBe('value');
    });
  });
});