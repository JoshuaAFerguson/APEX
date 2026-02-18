import { describe, it, expect } from 'vitest';
import {
  // JSON-RPC base types
  JsonRpcIdSchema,
  JsonRpcErrorSchema,
  JsonRpcRequestSchema,
  JsonRpcNotificationSchema,
  JsonRpcSuccessResponseSchema,
  JsonRpcErrorResponseSchema,
  JsonRpcResponseSchema,

  // MCP protocol version and capabilities
  MCPProtocolVersionSchema,
  MCPServerCapabilitiesSchema,
  MCPClientCapabilitiesSchema,
  MCPImplementationInfoSchema,

  // Initialize/Initialized
  MCPInitializeParamsSchema,
  MCPInitializeResultSchema,
  MCPInitializedNotificationParamsSchema,

  // Tools
  MCPProtocolToolInputSchemaSchema,
  MCPProtocolToolDefinitionSchema,
  MCPToolsListParamsSchema,
  MCPToolsListResultSchema,
  MCPToolResultContentItemSchema,
  MCPToolsCallParamsSchema,
  MCPToolsCallResultSchema,

  // Resources
  MCPProtocolResourceDefinitionSchema,
  MCPProtocolResourceTemplateSchema,
  MCPResourcesListParamsSchema,
  MCPResourcesListResultSchema,
  MCPResourceContentSchema,
  MCPResourcesReadParamsSchema,
  MCPResourcesReadResultSchema,

  // Prompts
  MCPProtocolPromptArgumentSchema,
  MCPProtocolPromptDefinitionSchema,
  MCPPromptsListParamsSchema,
  MCPPromptsListResultSchema,
  MCPPromptMessageRoleSchema,
  MCPPromptMessageContentSchema,
  MCPPromptMessageSchema,
  MCPPromptsGetParamsSchema,
  MCPPromptsGetResultSchema,

  // Logging
  MCPLogLevelSchema,
  MCPLoggingSetLevelParamsSchema,
  MCPLogMessageNotificationParamsSchema,

  // Completion
  MCPCompletionReferenceSchema,
  MCPCompletionCompleteParamsSchema,
  MCPCompletionCompleteResultSchema,

  // Constants
  MCPProtocolMethod,
  MCPErrorCode,
} from '../mcp/protocol-types.js';

describe('MCP Protocol Types', () => {
  describe('JSON-RPC 2.0 Base Types', () => {
    describe('JsonRpcIdSchema', () => {
      it('accepts string IDs', () => {
        expect(JsonRpcIdSchema.parse('test-id-123')).toBe('test-id-123');
        expect(JsonRpcIdSchema.parse('')).toBe('');
        expect(JsonRpcIdSchema.parse('uuid-4f4c7e77-9f1a-4b7f-b5c4-9e8a3d2c1b0a')).toBe('uuid-4f4c7e77-9f1a-4b7f-b5c4-9e8a3d2c1b0a');
      });

      it('accepts number IDs', () => {
        expect(JsonRpcIdSchema.parse(123)).toBe(123);
        expect(JsonRpcIdSchema.parse(0)).toBe(0);
        expect(JsonRpcIdSchema.parse(-1)).toBe(-1);
        expect(JsonRpcIdSchema.parse(1.5)).toBe(1.5);
      });

      it('rejects invalid types', () => {
        expect(() => JsonRpcIdSchema.parse(null)).toThrow();
        expect(() => JsonRpcIdSchema.parse(undefined)).toThrow();
        expect(() => JsonRpcIdSchema.parse({})).toThrow();
        expect(() => JsonRpcIdSchema.parse([])).toThrow();
        expect(() => JsonRpcIdSchema.parse(true)).toThrow();
      });
    });

    describe('JsonRpcErrorSchema', () => {
      it('validates error objects', () => {
        const validError = {
          code: -32600,
          message: 'Invalid Request',
        };
        expect(JsonRpcErrorSchema.parse(validError)).toEqual(validError);
      });

      it('accepts optional data field', () => {
        const errorWithData = {
          code: -32700,
          message: 'Parse error',
          data: { line: 1, column: 5 },
        };
        expect(JsonRpcErrorSchema.parse(errorWithData)).toEqual(errorWithData);
      });

      it('requires code and message', () => {
        expect(() => JsonRpcErrorSchema.parse({ code: 123 })).toThrow();
        expect(() => JsonRpcErrorSchema.parse({ message: 'test' })).toThrow();
        expect(() => JsonRpcErrorSchema.parse({})).toThrow();
      });
    });

    describe('JsonRpcRequestSchema', () => {
      it('validates request objects', () => {
        const validRequest = {
          jsonrpc: '2.0',
          id: 'test-123',
          method: 'initialize',
        };
        expect(JsonRpcRequestSchema.parse(validRequest)).toEqual(validRequest);
      });

      it('accepts optional params', () => {
        const requestWithParams = {
          jsonrpc: '2.0',
          id: 42,
          method: 'tools/call',
          params: { name: 'test-tool', arguments: {} },
        };
        expect(JsonRpcRequestSchema.parse(requestWithParams)).toEqual(requestWithParams);
      });

      it('requires jsonrpc version 2.0', () => {
        const invalidVersion = {
          jsonrpc: '1.0',
          id: 'test',
          method: 'test',
        };
        expect(() => JsonRpcRequestSchema.parse(invalidVersion)).toThrow();
      });

      it('requires id and method', () => {
        expect(() => JsonRpcRequestSchema.parse({
          jsonrpc: '2.0',
          method: 'test',
        })).toThrow();

        expect(() => JsonRpcRequestSchema.parse({
          jsonrpc: '2.0',
          id: 'test',
        })).toThrow();
      });
    });

    describe('JsonRpcNotificationSchema', () => {
      it('validates notification objects', () => {
        const validNotification = {
          jsonrpc: '2.0',
          method: 'notifications/message',
        };
        expect(JsonRpcNotificationSchema.parse(validNotification)).toEqual(validNotification);
      });

      it('accepts optional params', () => {
        const notificationWithParams = {
          jsonrpc: '2.0',
          method: 'notifications/initialized',
          params: {},
        };
        expect(JsonRpcNotificationSchema.parse(notificationWithParams)).toEqual(notificationWithParams);
      });

      it('does not require id (unlike requests)', () => {
        const notification = {
          jsonrpc: '2.0',
          method: 'test',
        };
        expect(JsonRpcNotificationSchema.parse(notification)).toEqual(notification);
      });
    });

    describe('JsonRpcResponseSchema', () => {
      it('validates success responses', () => {
        const successResponse = {
          jsonrpc: '2.0',
          id: 'test-123',
          result: { success: true },
        };
        expect(JsonRpcResponseSchema.parse(successResponse)).toEqual(successResponse);
      });

      it('validates error responses', () => {
        const errorResponse = {
          jsonrpc: '2.0',
          id: 'test-123',
          error: {
            code: -32600,
            message: 'Invalid Request',
          },
        };
        expect(JsonRpcResponseSchema.parse(errorResponse)).toEqual(errorResponse);
      });

      it('allows null id in error responses', () => {
        const errorResponseWithNullId = {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error',
          },
        };
        expect(JsonRpcResponseSchema.parse(errorResponseWithNullId)).toEqual(errorResponseWithNullId);
      });
    });
  });

  describe('MCP Protocol Version & Capabilities', () => {
    describe('MCPProtocolVersionSchema', () => {
      it('validates date-format version strings', () => {
        expect(MCPProtocolVersionSchema.parse('2024-11-05')).toBe('2024-11-05');
        expect(MCPProtocolVersionSchema.parse('2023-01-01')).toBe('2023-01-01');
        expect(MCPProtocolVersionSchema.parse('1999-12-31')).toBe('1999-12-31');
      });

      it('rejects invalid version formats', () => {
        expect(() => MCPProtocolVersionSchema.parse('v1.0.0')).toThrow();
        expect(() => MCPProtocolVersionSchema.parse('2024-1-1')).toThrow();
        expect(() => MCPProtocolVersionSchema.parse('24-11-05')).toThrow();
        expect(() => MCPProtocolVersionSchema.parse('2024/11/05')).toThrow();
        expect(() => MCPProtocolVersionSchema.parse('')).toThrow();
      });
    });

    describe('MCPServerCapabilitiesSchema', () => {
      it('validates empty capabilities', () => {
        expect(MCPServerCapabilitiesSchema.parse({})).toEqual({});
      });

      it('validates tools capabilities', () => {
        const capabilities = {
          tools: {
            listChanged: true,
          },
        };
        expect(MCPServerCapabilitiesSchema.parse(capabilities)).toEqual(capabilities);
      });

      it('validates all capability types', () => {
        const fullCapabilities = {
          tools: { listChanged: false },
          resources: { subscribe: true, listChanged: true },
          prompts: { listChanged: false },
          logging: {},
          experimental: { customFeature: 'enabled' },
        };
        expect(MCPServerCapabilitiesSchema.parse(fullCapabilities)).toEqual(fullCapabilities);
      });

      it('allows optional properties to be undefined', () => {
        const capabilities = {
          tools: {},
          resources: { subscribe: false },
        };
        expect(MCPServerCapabilitiesSchema.parse(capabilities)).toEqual(capabilities);
      });
    });

    describe('MCPClientCapabilitiesSchema', () => {
      it('validates client capabilities', () => {
        const capabilities = {
          roots: { listChanged: true },
          sampling: {},
          experimental: { feature: 'test' },
        };
        expect(MCPClientCapabilitiesSchema.parse(capabilities)).toEqual(capabilities);
      });
    });

    describe('MCPImplementationInfoSchema', () => {
      it('validates implementation info', () => {
        const info = {
          name: 'apex-mcp-client',
          version: '1.0.0',
        };
        expect(MCPImplementationInfoSchema.parse(info)).toEqual(info);
      });

      it('requires both name and version', () => {
        expect(() => MCPImplementationInfoSchema.parse({ name: 'test' })).toThrow();
        expect(() => MCPImplementationInfoSchema.parse({ version: '1.0.0' })).toThrow();
      });
    });
  });

  describe('Initialize/Initialized Protocol', () => {
    describe('MCPInitializeParamsSchema', () => {
      it('validates initialization parameters', () => {
        const params = {
          protocolVersion: '2024-11-05',
          capabilities: {
            roots: { listChanged: true },
          },
          clientInfo: {
            name: 'apex-client',
            version: '1.0.0',
          },
        };
        expect(MCPInitializeParamsSchema.parse(params)).toEqual(params);
      });
    });

    describe('MCPInitializeResultSchema', () => {
      it('validates initialization result', () => {
        const result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: true },
            resources: { subscribe: false },
          },
          serverInfo: {
            name: 'test-server',
            version: '2.0.0',
          },
          instructions: 'Use this server for testing purposes.',
        };
        expect(MCPInitializeResultSchema.parse(result)).toEqual(result);
      });

      it('allows optional instructions', () => {
        const result = {
          protocolVersion: '2024-11-05',
          capabilities: {},
          serverInfo: {
            name: 'test-server',
            version: '2.0.0',
          },
        };
        expect(MCPInitializeResultSchema.parse(result)).toEqual(result);
      });
    });

    describe('MCPInitializedNotificationParamsSchema', () => {
      it('validates empty initialized notification params', () => {
        expect(MCPInitializedNotificationParamsSchema.parse({})).toEqual({});
      });

      it('rejects non-empty objects', () => {
        expect(() => MCPInitializedNotificationParamsSchema.parse({ extra: true })).toThrow();
      });
    });
  });

  describe('Tools Protocol', () => {
    describe('MCPProtocolToolInputSchemaSchema', () => {
      it('validates tool input schema', () => {
        const schema = {
          type: 'object',
          properties: {
            query: { type: 'string' },
            limit: { type: 'number' },
          },
          required: ['query'],
          additionalProperties: false,
        };
        expect(MCPProtocolToolInputSchemaSchema.parse(schema)).toEqual(schema);
      });

      it('requires type to be object', () => {
        const invalidSchema = {
          type: 'string',
          properties: {},
        };
        expect(() => MCPProtocolToolInputSchemaSchema.parse(invalidSchema)).toThrow();
      });
    });

    describe('MCPProtocolToolDefinitionSchema', () => {
      it('validates tool definition', () => {
        const tool = {
          name: 'search',
          description: 'Search for information',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
            },
            required: ['query'],
          },
        };
        expect(MCPProtocolToolDefinitionSchema.parse(tool)).toEqual(tool);
      });

      it('allows optional description', () => {
        const tool = {
          name: 'simple-tool',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        };
        expect(MCPProtocolToolDefinitionSchema.parse(tool)).toEqual(tool);
      });
    });

    describe('MCPToolsListResultSchema', () => {
      it('validates tools list result', () => {
        const result = {
          tools: [
            {
              name: 'tool1',
              inputSchema: { type: 'object' },
            },
            {
              name: 'tool2',
              description: 'Second tool',
              inputSchema: { type: 'object', properties: {} },
            },
          ],
          nextCursor: 'cursor-123',
        };
        expect(MCPToolsListResultSchema.parse(result)).toEqual(result);
      });

      it('allows empty tools array', () => {
        const result = {
          tools: [],
        };
        expect(MCPToolsListResultSchema.parse(result)).toEqual(result);
      });
    });

    describe('MCPToolResultContentItemSchema', () => {
      it('validates text content', () => {
        const textContent = {
          type: 'text',
          text: 'This is the result text',
        };
        expect(MCPToolResultContentItemSchema.parse(textContent)).toEqual(textContent);
      });

      it('validates image content', () => {
        const imageContent = {
          type: 'image',
          data: 'base64encodeddata',
          mimeType: 'image/png',
        };
        expect(MCPToolResultContentItemSchema.parse(imageContent)).toEqual(imageContent);
      });

      it('validates resource content', () => {
        const resourceContent = {
          type: 'resource',
          resource: {
            uri: 'file:///path/to/file.txt',
            mimeType: 'text/plain',
            text: 'File contents here',
          },
        };
        expect(MCPToolResultContentItemSchema.parse(resourceContent)).toEqual(resourceContent);
      });

      it('validates resource with blob data', () => {
        const resourceContent = {
          type: 'resource',
          resource: {
            uri: 'file:///path/to/binary.bin',
            mimeType: 'application/octet-stream',
            blob: 'base64binarydata',
          },
        };
        expect(MCPToolResultContentItemSchema.parse(resourceContent)).toEqual(resourceContent);
      });
    });

    describe('MCPToolsCallParamsSchema', () => {
      it('validates tool call parameters', () => {
        const params = {
          name: 'search',
          arguments: {
            query: 'test query',
            limit: 10,
          },
        };
        expect(MCPToolsCallParamsSchema.parse(params)).toEqual(params);
      });

      it('allows optional arguments', () => {
        const params = {
          name: 'simple-tool',
        };
        expect(MCPToolsCallParamsSchema.parse(params)).toEqual(params);
      });
    });

    describe('MCPToolsCallResultSchema', () => {
      it('validates tool call result', () => {
        const result = {
          content: [
            { type: 'text', text: 'Result text' },
            { type: 'image', data: 'imagedata', mimeType: 'image/jpeg' },
          ],
          isError: false,
        };
        expect(MCPToolsCallResultSchema.parse(result)).toEqual(result);
      });

      it('allows error results', () => {
        const errorResult = {
          content: [
            { type: 'text', text: 'Error occurred: Invalid input' },
          ],
          isError: true,
        };
        expect(MCPToolsCallResultSchema.parse(errorResult)).toEqual(errorResult);
      });
    });
  });

  describe('Resources Protocol', () => {
    describe('MCPProtocolResourceDefinitionSchema', () => {
      it('validates resource definition', () => {
        const resource = {
          uri: 'file:///path/to/document.pdf',
          name: 'Important Document',
          description: 'A very important document',
          mimeType: 'application/pdf',
        };
        expect(MCPProtocolResourceDefinitionSchema.parse(resource)).toEqual(resource);
      });

      it('allows minimal resource definition', () => {
        const resource = {
          uri: 'https://example.com/data.json',
          name: 'Data File',
        };
        expect(MCPProtocolResourceDefinitionSchema.parse(resource)).toEqual(resource);
      });
    });

    describe('MCPProtocolResourceTemplateSchema', () => {
      it('validates resource template', () => {
        const template = {
          uriTemplate: 'file:///logs/{date}/{level}.log',
          name: 'Log Files',
          description: 'Daily log files by level',
          mimeType: 'text/plain',
        };
        expect(MCPProtocolResourceTemplateSchema.parse(template)).toEqual(template);
      });
    });

    describe('MCPResourcesListResultSchema', () => {
      it('validates resources list result', () => {
        const result = {
          resources: [
            {
              uri: 'file:///file1.txt',
              name: 'File 1',
            },
          ],
          resourceTemplates: [
            {
              uriTemplate: 'file:///template/{id}',
              name: 'Template',
            },
          ],
          nextCursor: 'cursor-456',
        };
        expect(MCPResourcesListResultSchema.parse(result)).toEqual(result);
      });
    });

    describe('MCPResourceContentSchema', () => {
      it('validates text resource content', () => {
        const content = {
          uri: 'file:///doc.txt',
          mimeType: 'text/plain',
          text: 'Document content here',
        };
        expect(MCPResourceContentSchema.parse(content)).toEqual(content);
      });

      it('validates binary resource content', () => {
        const content = {
          uri: 'file:///image.png',
          mimeType: 'image/png',
          blob: 'base64encodedimagedata',
        };
        expect(MCPResourceContentSchema.parse(content)).toEqual(content);
      });

      it('allows content without text or blob', () => {
        const content = {
          uri: 'file:///empty.txt',
          mimeType: 'text/plain',
        };
        expect(MCPResourceContentSchema.parse(content)).toEqual(content);
      });
    });

    describe('MCPResourcesReadParamsSchema', () => {
      it('validates read parameters', () => {
        const params = {
          uri: 'file:///path/to/file.txt',
        };
        expect(MCPResourcesReadParamsSchema.parse(params)).toEqual(params);
      });

      it('requires uri', () => {
        expect(() => MCPResourcesReadParamsSchema.parse({})).toThrow();
      });
    });

    describe('MCPResourcesReadResultSchema', () => {
      it('validates read result with single content', () => {
        const result = {
          contents: [
            {
              uri: 'file:///doc.txt',
              text: 'File content',
              mimeType: 'text/plain',
            },
          ],
        };
        expect(MCPResourcesReadResultSchema.parse(result)).toEqual(result);
      });

      it('validates read result with multiple contents', () => {
        const result = {
          contents: [
            {
              uri: 'file:///part1.txt',
              text: 'Part 1',
            },
            {
              uri: 'file:///part2.txt',
              text: 'Part 2',
            },
          ],
        };
        expect(MCPResourcesReadResultSchema.parse(result)).toEqual(result);
      });
    });
  });

  describe('Prompts Protocol', () => {
    describe('MCPProtocolPromptArgumentSchema', () => {
      it('validates prompt argument', () => {
        const arg = {
          name: 'user_query',
          description: 'The user query to process',
          required: true,
        };
        expect(MCPProtocolPromptArgumentSchema.parse(arg)).toEqual(arg);
      });

      it('allows optional properties', () => {
        const arg = {
          name: 'optional_param',
        };
        expect(MCPProtocolPromptArgumentSchema.parse(arg)).toEqual(arg);
      });
    });

    describe('MCPProtocolPromptDefinitionSchema', () => {
      it('validates prompt definition', () => {
        const prompt = {
          name: 'analyze-code',
          description: 'Analyze code for issues',
          arguments: [
            {
              name: 'code',
              description: 'The code to analyze',
              required: true,
            },
            {
              name: 'language',
              description: 'Programming language',
              required: false,
            },
          ],
        };
        expect(MCPProtocolPromptDefinitionSchema.parse(prompt)).toEqual(prompt);
      });
    });

    describe('MCPPromptMessageRoleSchema', () => {
      it('validates user and assistant roles', () => {
        expect(MCPPromptMessageRoleSchema.parse('user')).toBe('user');
        expect(MCPPromptMessageRoleSchema.parse('assistant')).toBe('assistant');
      });

      it('rejects invalid roles', () => {
        expect(() => MCPPromptMessageRoleSchema.parse('system')).toThrow();
        expect(() => MCPPromptMessageRoleSchema.parse('bot')).toThrow();
      });
    });

    describe('MCPPromptMessageContentSchema', () => {
      it('validates text content', () => {
        const content = {
          type: 'text',
          text: 'This is a text message',
        };
        expect(MCPPromptMessageContentSchema.parse(content)).toEqual(content);
      });

      it('validates image content', () => {
        const content = {
          type: 'image',
          data: 'base64imagedata',
          mimeType: 'image/png',
        };
        expect(MCPPromptMessageContentSchema.parse(content)).toEqual(content);
      });

      it('validates resource content', () => {
        const content = {
          type: 'resource',
          resource: {
            uri: 'file:///data.txt',
            text: 'Resource content',
          },
        };
        expect(MCPPromptMessageContentSchema.parse(content)).toEqual(content);
      });
    });

    describe('MCPPromptMessageSchema', () => {
      it('validates prompt message', () => {
        const message = {
          role: 'user',
          content: {
            type: 'text',
            text: 'Please analyze this code',
          },
        };
        expect(MCPPromptMessageSchema.parse(message)).toEqual(message);
      });
    });

    describe('MCPPromptsGetParamsSchema', () => {
      it('validates prompt get parameters', () => {
        const params = {
          name: 'analyze-code',
          arguments: {
            code: 'function test() { return true; }',
            language: 'javascript',
          },
        };
        expect(MCPPromptsGetParamsSchema.parse(params)).toEqual(params);
      });

      it('allows optional arguments', () => {
        const params = {
          name: 'simple-prompt',
        };
        expect(MCPPromptsGetParamsSchema.parse(params)).toEqual(params);
      });
    });

    describe('MCPPromptsGetResultSchema', () => {
      it('validates prompt get result', () => {
        const result = {
          description: 'Code analysis prompt instance',
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: 'Analyze this JavaScript code: function test() { return true; }',
              },
            },
          ],
        };
        expect(MCPPromptsGetResultSchema.parse(result)).toEqual(result);
      });
    });
  });

  describe('Logging Protocol', () => {
    describe('MCPLogLevelSchema', () => {
      it('validates all log levels', () => {
        const levels = ['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'];
        levels.forEach(level => {
          expect(MCPLogLevelSchema.parse(level)).toBe(level);
        });
      });

      it('rejects invalid log levels', () => {
        expect(() => MCPLogLevelSchema.parse('trace')).toThrow();
        expect(() => MCPLogLevelSchema.parse('warn')).toThrow();
        expect(() => MCPLogLevelSchema.parse('fatal')).toThrow();
      });
    });

    describe('MCPLoggingSetLevelParamsSchema', () => {
      it('validates set level parameters', () => {
        const params = {
          level: 'info',
        };
        expect(MCPLoggingSetLevelParamsSchema.parse(params)).toEqual(params);
      });
    });

    describe('MCPLogMessageNotificationParamsSchema', () => {
      it('validates log message notification', () => {
        const params = {
          level: 'error',
          logger: 'mcp-server',
          data: 'An error occurred in the tool execution',
        };
        expect(MCPLogMessageNotificationParamsSchema.parse(params)).toEqual(params);
      });

      it('allows complex data types', () => {
        const params = {
          level: 'debug',
          data: {
            operation: 'file-read',
            file: '/path/to/file.txt',
            timestamp: '2024-01-01T00:00:00Z',
          },
        };
        expect(MCPLogMessageNotificationParamsSchema.parse(params)).toEqual(params);
      });

      it('allows optional logger', () => {
        const params = {
          level: 'warning',
          data: 'Warning message',
        };
        expect(MCPLogMessageNotificationParamsSchema.parse(params)).toEqual(params);
      });
    });
  });

  describe('Completion Protocol', () => {
    describe('MCPCompletionReferenceSchema', () => {
      it('validates prompt reference', () => {
        const ref = {
          type: 'ref/prompt',
          name: 'analyze-code',
        };
        expect(MCPCompletionReferenceSchema.parse(ref)).toEqual(ref);
      });

      it('validates resource reference', () => {
        const ref = {
          type: 'ref/resource',
          uri: 'file:///data.json',
        };
        expect(MCPCompletionReferenceSchema.parse(ref)).toEqual(ref);
      });

      it('rejects invalid reference types', () => {
        const invalidRef = {
          type: 'ref/tool',
          name: 'search',
        };
        expect(() => MCPCompletionReferenceSchema.parse(invalidRef)).toThrow();
      });
    });

    describe('MCPCompletionCompleteParamsSchema', () => {
      it('validates completion parameters', () => {
        const params = {
          ref: {
            type: 'ref/prompt',
            name: 'analyze-code',
          },
          argument: {
            name: 'language',
            value: 'java',
          },
        };
        expect(MCPCompletionCompleteParamsSchema.parse(params)).toEqual(params);
      });
    });

    describe('MCPCompletionCompleteResultSchema', () => {
      it('validates completion result', () => {
        const result = {
          completion: {
            values: ['javascript', 'java', 'python'],
            total: 10,
            hasMore: true,
          },
        };
        expect(MCPCompletionCompleteResultSchema.parse(result)).toEqual(result);
      });

      it('allows minimal completion result', () => {
        const result = {
          completion: {
            values: ['option1', 'option2'],
          },
        };
        expect(MCPCompletionCompleteResultSchema.parse(result)).toEqual(result);
      });
    });
  });

  describe('Protocol Constants', () => {
    describe('MCPProtocolMethod', () => {
      it('contains all expected method names', () => {
        expect(MCPProtocolMethod.Initialize).toBe('initialize');
        expect(MCPProtocolMethod.Initialized).toBe('notifications/initialized');
        expect(MCPProtocolMethod.ToolsList).toBe('tools/list');
        expect(MCPProtocolMethod.ToolsCall).toBe('tools/call');
        expect(MCPProtocolMethod.ResourcesList).toBe('resources/list');
        expect(MCPProtocolMethod.ResourcesRead).toBe('resources/read');
        expect(MCPProtocolMethod.PromptsList).toBe('prompts/list');
        expect(MCPProtocolMethod.PromptsGet).toBe('prompts/get');
        expect(MCPProtocolMethod.LoggingSetLevel).toBe('logging/setLevel');
        expect(MCPProtocolMethod.CompletionComplete).toBe('completion/complete');
      });

      it('contains notification method names', () => {
        expect(MCPProtocolMethod.NotificationMessage).toBe('notifications/message');
        expect(MCPProtocolMethod.NotificationToolsListChanged).toBe('notifications/tools/list_changed');
        expect(MCPProtocolMethod.NotificationResourcesListChanged).toBe('notifications/resources/list_changed');
        expect(MCPProtocolMethod.NotificationPromptsListChanged).toBe('notifications/prompts/list_changed');
        expect(MCPProtocolMethod.NotificationResourcesUpdated).toBe('notifications/resources/updated');
      });

      it('is properly typed as const', () => {
        // TypeScript compilation ensures this, but let's verify the values are strings
        Object.values(MCPProtocolMethod).forEach(method => {
          expect(typeof method).toBe('string');
        });
      });
    });

    describe('MCPErrorCode', () => {
      it('contains JSON-RPC standard error codes', () => {
        expect(MCPErrorCode.ParseError).toBe(-32700);
        expect(MCPErrorCode.InvalidRequest).toBe(-32600);
        expect(MCPErrorCode.MethodNotFound).toBe(-32601);
        expect(MCPErrorCode.InvalidParams).toBe(-32602);
        expect(MCPErrorCode.InternalError).toBe(-32603);
      });

      it('contains MCP-specific error codes', () => {
        expect(MCPErrorCode.ResourceNotFound).toBe(-32002);
        expect(MCPErrorCode.ToolNotFound).toBe(-32004);
        expect(MCPErrorCode.ToolExecutionError).toBe(-32005);
      });

      it('all error codes are negative numbers', () => {
        Object.values(MCPErrorCode).forEach(code => {
          expect(typeof code).toBe('number');
          expect(code).toBeLessThan(0);
        });
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    describe('Complex nested validation', () => {
      it('validates complex tool call with multiple content types', () => {
        const complexResult = {
          content: [
            { type: 'text', text: 'Analysis complete' },
            { type: 'image', data: 'chart-data', mimeType: 'image/svg+xml' },
            {
              type: 'resource',
              resource: {
                uri: 'file:///report.pdf',
                mimeType: 'application/pdf',
                blob: 'pdf-data',
              },
            },
          ],
          isError: false,
        };
        expect(MCPToolsCallResultSchema.parse(complexResult)).toEqual(complexResult);
      });

      it('validates complex prompt with mixed content', () => {
        const complexPrompt = {
          description: 'Multi-modal analysis',
          messages: [
            {
              role: 'user',
              content: { type: 'text', text: 'Please analyze this image:' },
            },
            {
              role: 'user',
              content: {
                type: 'image',
                data: 'image-data',
                mimeType: 'image/png',
              },
            },
            {
              role: 'assistant',
              content: { type: 'text', text: 'I can see...' },
            },
          ],
        };
        expect(MCPPromptsGetResultSchema.parse(complexPrompt)).toEqual(complexPrompt);
      });
    });

    describe('Optional field handling', () => {
      it('handles undefined vs missing optional fields consistently', () => {
        const toolWithUndefinedDescription = {
          name: 'test',
          description: undefined,
          inputSchema: { type: 'object' },
        };

        const toolWithoutDescription = {
          name: 'test',
          inputSchema: { type: 'object' },
        };

        // Both should be valid but may produce different results
        expect(() => MCPProtocolToolDefinitionSchema.parse(toolWithUndefinedDescription)).not.toThrow();
        expect(() => MCPProtocolToolDefinitionSchema.parse(toolWithoutDescription)).not.toThrow();
      });

      it('handles empty vs undefined arrays/objects', () => {
        const listResultEmpty = {
          tools: [],
          nextCursor: undefined,
        };

        const listResultMinimal = {
          tools: [],
        };

        expect(() => MCPToolsListResultSchema.parse(listResultEmpty)).not.toThrow();
        expect(() => MCPToolsListResultSchema.parse(listResultMinimal)).not.toThrow();
      });
    });

    describe('Discriminated union edge cases', () => {
      it('rejects content with invalid discriminator', () => {
        const invalidContent = {
          type: 'invalid-type',
          text: 'test',
        };
        expect(() => MCPToolResultContentItemSchema.parse(invalidContent)).toThrow();
      });

      it('rejects mixed properties from different union members', () => {
        const mixedContent = {
          type: 'text',
          text: 'test text',
          data: 'should not be here for text type',
        };
        expect(() => MCPToolResultContentItemSchema.parse(mixedContent)).toThrow();
      });
    });

    describe('String pattern validation edge cases', () => {
      it('rejects protocol version with wrong separators', () => {
        expect(() => MCPProtocolVersionSchema.parse('2024.11.05')).toThrow();
        expect(() => MCPProtocolVersionSchema.parse('2024_11_05')).toThrow();
      });

      it('handles protocol version with leap year dates', () => {
        expect(MCPProtocolVersionSchema.parse('2024-02-29')).toBe('2024-02-29');
        expect(() => MCPProtocolVersionSchema.parse('2023-02-29')).toThrow(); // Not a leap year
      });
    });

    describe('Large data handling', () => {
      it('handles large text content', () => {
        const largeText = 'x'.repeat(10000);
        const content = {
          type: 'text',
          text: largeText,
        };
        expect(MCPToolResultContentItemSchema.parse(content)).toEqual(content);
      });

      it('handles many tools in list result', () => {
        const manyTools = Array.from({ length: 100 }, (_, i) => ({
          name: `tool${i}`,
          inputSchema: { type: 'object' },
        }));

        const result = {
          tools: manyTools,
        };
        expect(MCPToolsListResultSchema.parse(result)).toEqual(result);
      });
    });
  });
});