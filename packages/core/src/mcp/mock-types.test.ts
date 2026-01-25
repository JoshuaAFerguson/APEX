/**
 * @fileoverview Tests for Mock MCP Server Configuration Types
 *
 * Comprehensive test suite for the mock-types module, covering:
 * - All Zod schema validation
 * - Type inference and validation
 * - Edge cases and error scenarios
 * - Schema composition and defaults
 * - MockDynamicHandler functionality
 * - MockResponseSequence behavior
 * - Integration between different mock types
 *
 * @module @apex/core/mcp/mock-types.test
 */

import { describe, it, expect, vi } from 'vitest';
import {
  // Schema exports
  MockTransportTypeSchema,
  MockHttpTransportConfigSchema,
  MockSseTransportConfigSchema,
  MockStdioTransportConfigSchema,
  MockMCPServerConfigSchema,
  MockResponseDelaySchema,
  MockErrorInjectionSchema,
  MockToolResultContentSchema,
  MockDynamicHandlerSchema,
  MockResponseSequenceSchema,
  MockToolHandlerSchema,
  MockNotificationTriggerSchema,
  MockStateTransitionSchema,
  MockStateBehaviorSchema,
  MockStatefulBehaviorConfigSchema,
  MockRequestMatcherSchema,
  MockResponseDefinitionSchema,
  MockRequestResponsePairSchema,
  MockBehaviorConfigSchema,
  MockScenarioSchema,
  MockMCPServerDefinitionSchema,

  // Type exports
  type MockTransportType,
  type MockHttpTransportConfig,
  type MockSseTransportConfig,
  type MockStdioTransportConfig,
  type MockMCPServerConfig,
  type MockResponseDelay,
  type MockErrorInjection,
  type MockToolResultContent,
  type MockDynamicHandler,
  type MockDynamicHandlerFunction,
  type MockResponseSequence,
  type MockToolHandler,
  type MockNotificationTrigger,
  type MockStateTransition,
  type MockStateBehavior,
  type MockStatefulBehaviorConfig,
  type MockRequestMatcher,
  type MockResponseDefinition,
  type MockRequestResponsePair,
  type MockBehaviorConfig,
  type MockScenario,
  type MockMCPServerDefinition,
} from './mock-types.js';

// ============================================================================
// TRANSPORT CONFIGURATION TESTS
// ============================================================================

describe('MockTransportType', () => {
  it('should accept valid transport types', () => {
    expect(MockTransportTypeSchema.parse('stdio')).toBe('stdio');
    expect(MockTransportTypeSchema.parse('http')).toBe('http');
    expect(MockTransportTypeSchema.parse('sse')).toBe('sse');
  });

  it('should reject invalid transport types', () => {
    expect(() => MockTransportTypeSchema.parse('tcp')).toThrow();
    expect(() => MockTransportTypeSchema.parse('ws')).toThrow();
    expect(() => MockTransportTypeSchema.parse('')).toThrow();
  });

  it('should have correct TypeScript type', () => {
    const transport: MockTransportType = 'stdio';
    expect(transport).toBe('stdio');
  });
});

describe('MockHttpTransportConfig', () => {
  it('should parse valid HTTP config with defaults', () => {
    const result = MockHttpTransportConfigSchema.parse({});
    expect(result).toEqual({
      host: '127.0.0.1',
      port: 0,
      basePath: '/',
      tls: false,
    });
  });

  it('should accept custom values', () => {
    const config = {
      host: 'localhost',
      port: 8080,
      basePath: '/api',
      tls: true,
      tlsCertPath: '/path/to/cert.pem',
      tlsKeyPath: '/path/to/key.pem',
    };

    const result = MockHttpTransportConfigSchema.parse(config);
    expect(result).toEqual(config);
  });

  it('should validate port range', () => {
    expect(() => MockHttpTransportConfigSchema.parse({ port: -1 })).toThrow();
    expect(() => MockHttpTransportConfigSchema.parse({ port: 65536 })).toThrow();
    expect(MockHttpTransportConfigSchema.parse({ port: 3000 }).port).toBe(3000);
    expect(MockHttpTransportConfigSchema.parse({ port: 65535 }).port).toBe(65535);
  });

  it('should ensure TypeScript type compatibility', () => {
    const config: MockHttpTransportConfig = {
      host: '0.0.0.0',
      port: 3000,
      basePath: '/mcp',
      tls: false,
    };
    expect(config.host).toBe('0.0.0.0');
  });
});

describe('MockSseTransportConfig', () => {
  it('should parse with defaults', () => {
    const result = MockSseTransportConfigSchema.parse({});
    expect(result).toEqual({
      host: '127.0.0.1',
      port: 0,
      endpoint: '/events',
      keepAliveMs: 15000,
    });
  });

  it('should validate keepAliveMs is non-negative', () => {
    expect(() => MockSseTransportConfigSchema.parse({ keepAliveMs: -1 })).toThrow();
    expect(MockSseTransportConfigSchema.parse({ keepAliveMs: 0 }).keepAliveMs).toBe(0);
  });

  it('should ensure type compatibility', () => {
    const config: MockSseTransportConfig = {
      host: '127.0.0.1',
      port: 8080,
      endpoint: '/stream',
      keepAliveMs: 30000,
    };
    expect(config.endpoint).toBe('/stream');
  });
});

describe('MockStdioTransportConfig', () => {
  it('should parse with defaults', () => {
    const result = MockStdioTransportConfigSchema.parse({});
    expect(result).toEqual({
      bufferOutput: false,
      startupDelayMs: 0,
    });
  });

  it('should validate startupDelayMs is non-negative', () => {
    expect(() => MockStdioTransportConfigSchema.parse({ startupDelayMs: -1 })).toThrow();
    expect(MockStdioTransportConfigSchema.parse({ startupDelayMs: 100 }).startupDelayMs).toBe(100);
  });

  it('should ensure type compatibility', () => {
    const config: MockStdioTransportConfig = {
      bufferOutput: true,
      startupDelayMs: 500,
    };
    expect(config.bufferOutput).toBe(true);
  });
});

// ============================================================================
// MOCK MCP SERVER CONFIGURATION TESTS
// ============================================================================

describe('MockMCPServerConfig', () => {
  it('should require name field', () => {
    expect(() => MockMCPServerConfigSchema.parse({})).toThrow();
    expect(() => MockMCPServerConfigSchema.parse({ name: '' })).toThrow();
    expect(() => MockMCPServerConfigSchema.parse({ name: '   ' })).toThrow();
  });

  it('should parse minimal valid config', () => {
    const result = MockMCPServerConfigSchema.parse({ name: 'test-server' });

    expect(result).toMatchObject({
      name: 'test-server',
      transport: 'stdio',
      protocolVersion: '2024-11-05',
      capabilities: {},
      serverInfo: {
        name: 'apex-mock-mcp-server',
        version: '1.0.0',
      },
      autoStart: true,
      maxConnections: 10,
      shutdownTimeoutMs: 5000,
    });
  });

  it('should parse complete config with all optional fields', () => {
    const fullConfig = {
      name: 'comprehensive-server',
      description: 'A fully featured mock server',
      transport: 'http' as const,
      httpConfig: {
        host: 'localhost',
        port: 8080,
        basePath: '/api',
        tls: true,
        tlsCertPath: '/cert.pem',
        tlsKeyPath: '/key.pem',
      },
      protocolVersion: '2024-11-05' as const,
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true },
      },
      serverInfo: {
        name: 'custom-server',
        version: '2.0.0',
      },
      instructions: 'Custom server instructions',
      autoStart: false,
      maxConnections: 50,
      shutdownTimeoutMs: 10000,
    };

    const result = MockMCPServerConfigSchema.parse(fullConfig);
    expect(result).toEqual(fullConfig);
  });

  it('should validate maxConnections minimum', () => {
    expect(() => MockMCPServerConfigSchema.parse({
      name: 'test',
      maxConnections: 0,
    })).toThrow();

    expect(MockMCPServerConfigSchema.parse({
      name: 'test',
      maxConnections: 1,
    }).maxConnections).toBe(1);
  });

  it('should ensure type compatibility', () => {
    const config: MockMCPServerConfig = {
      name: 'typed-server',
      description: 'Type-safe configuration',
      transport: 'sse',
      sseConfig: {
        host: '0.0.0.0',
        port: 3000,
        endpoint: '/events',
        keepAliveMs: 20000,
      },
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: { subscribe: false },
      },
      serverInfo: {
        name: 'my-server',
        version: '1.5.0',
      },
      autoStart: true,
      maxConnections: 25,
      shutdownTimeoutMs: 3000,
    };

    expect(config.name).toBe('typed-server');
    expect(config.sseConfig?.endpoint).toBe('/events');
  });
});

// ============================================================================
// RESPONSE DELAY CONFIGURATION TESTS
// ============================================================================

describe('MockResponseDelay', () => {
  it('should parse with defaults', () => {
    const result = MockResponseDelaySchema.parse({});
    expect(result).toEqual({
      fixedMs: 0,
      jitter: false,
    });
  });

  it('should accept range configuration', () => {
    const config = {
      minMs: 100,
      maxMs: 500,
      jitter: true,
    };

    const result = MockResponseDelaySchema.parse(config);
    expect(result).toMatchObject(config);
  });

  it('should accept per-method overrides', () => {
    const config = {
      fixedMs: 100,
      perMethod: {
        'tools/list': 50,
        'resources/list': 200,
      },
    };

    const result = MockResponseDelaySchema.parse(config);
    expect(result.perMethod).toEqual(config.perMethod);
  });

  it('should validate non-negative delays', () => {
    expect(() => MockResponseDelaySchema.parse({ fixedMs: -1 })).toThrow();
    expect(() => MockResponseDelaySchema.parse({ minMs: -1 })).toThrow();
    expect(() => MockResponseDelaySchema.parse({ maxMs: -1 })).toThrow();
  });

  it('should ensure type compatibility', () => {
    const delay: MockResponseDelay = {
      fixedMs: 250,
      minMs: 100,
      maxMs: 500,
      perMethod: {
        'tools/call': 100,
      },
      jitter: true,
    };

    expect(delay.fixedMs).toBe(250);
    expect(delay.perMethod?.['tools/call']).toBe(100);
  });
});

// ============================================================================
// ERROR INJECTION TESTS
// ============================================================================

describe('MockErrorInjection', () => {
  it('should parse with defaults', () => {
    const result = MockErrorInjectionSchema.parse({});
    expect(result).toEqual({
      enabled: false,
      probability: 0,
      errorCode: -32603,
      errorMessage: 'Mock injected error',
      methods: [],
      afterRequestCount: 0,
      maxErrors: 0,
      simulateConnectionFailure: false,
      errorDelayMs: 0,
    });
  });

  it('should validate probability range', () => {
    expect(() => MockErrorInjectionSchema.parse({ probability: -0.1 })).toThrow();
    expect(() => MockErrorInjectionSchema.parse({ probability: 1.1 })).toThrow();

    expect(MockErrorInjectionSchema.parse({ probability: 0 }).probability).toBe(0);
    expect(MockErrorInjectionSchema.parse({ probability: 1 }).probability).toBe(1);
    expect(MockErrorInjectionSchema.parse({ probability: 0.5 }).probability).toBe(0.5);
  });

  it('should accept custom error configuration', () => {
    const config = {
      enabled: true,
      probability: 0.3,
      errorCode: -32602,
      errorMessage: 'Invalid params',
      errorData: { detail: 'Missing required parameter' },
      methods: ['tools/call', 'resources/read'],
      afterRequestCount: 5,
      maxErrors: 10,
      simulateConnectionFailure: true,
      errorDelayMs: 1000,
    };

    const result = MockErrorInjectionSchema.parse(config);
    expect(result).toEqual(config);
  });

  it('should ensure type compatibility', () => {
    const injection: MockErrorInjection = {
      enabled: true,
      probability: 0.2,
      errorCode: -32600,
      errorMessage: 'Invalid Request',
      methods: ['tools/list'],
      afterRequestCount: 0,
      maxErrors: 5,
      simulateConnectionFailure: false,
      errorDelayMs: 500,
    };

    expect(injection.enabled).toBe(true);
    expect(injection.methods).toContain('tools/list');
  });
});

// ============================================================================
// TOOL RESULT CONTENT TESTS
// ============================================================================

describe('MockToolResultContent', () => {
  it('should parse text content', () => {
    const content = {
      type: 'text' as const,
      text: 'Hello, world!',
    };

    const result = MockToolResultContentSchema.parse(content);
    expect(result).toEqual(content);
  });

  it('should parse image content', () => {
    const content = {
      type: 'image' as const,
      data: 'base64encodeddata',
      mimeType: 'image/png',
    };

    const result = MockToolResultContentSchema.parse(content);
    expect(result).toEqual(content);
  });

  it('should parse resource content', () => {
    const content = {
      type: 'resource' as const,
      resource: {
        uri: 'file:///path/to/file.txt',
        mimeType: 'text/plain',
        text: 'File contents',
      },
    };

    const result = MockToolResultContentSchema.parse(content);
    expect(result).toEqual(content);
  });

  it('should parse resource with blob', () => {
    const content = {
      type: 'resource' as const,
      resource: {
        uri: 'file:///path/to/binary.dat',
        mimeType: 'application/octet-stream',
        blob: 'base64binarydata',
      },
    };

    const result = MockToolResultContentSchema.parse(content);
    expect(result).toEqual(content);
  });

  it('should reject invalid discriminated union', () => {
    expect(() => MockToolResultContentSchema.parse({
      type: 'invalid',
      text: 'test',
    })).toThrow();
  });

  it('should ensure type compatibility', () => {
    const textContent: MockToolResultContent = {
      type: 'text',
      text: 'Typed content',
    };

    const imageContent: MockToolResultContent = {
      type: 'image',
      data: 'imagedata',
      mimeType: 'image/jpeg',
    };

    const resourceContent: MockToolResultContent = {
      type: 'resource',
      resource: {
        uri: 'http://example.com/resource',
        mimeType: 'application/json',
        text: '{"key": "value"}',
      },
    };

    expect(textContent.type).toBe('text');
    expect(imageContent.type).toBe('image');
    expect(resourceContent.type).toBe('resource');
  });
});

// ============================================================================
// DYNAMIC HANDLER TESTS (NEW FUNCTIONALITY)
// ============================================================================

describe('MockDynamicHandler', () => {
  it('should parse valid dynamic handler', async () => {
    const handler = {
      toolName: 'test-tool',
      handler: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'dynamic response' }],
        isError: false,
      }),
      priority: 100,
    };

    const result = MockDynamicHandlerSchema.parse(handler);
    expect(result.toolName).toBe('test-tool');
    expect(result.priority).toBe(100);
    expect(typeof result.handler).toBe('function');

    // Test that the function signature is enforced
    const response = await result.handler(
      'test-tool',
      { arg1: 'value1' },
      {
        requestId: 'req-123',
        invocationCount: 1,
        timestamp: new Date(),
      }
    );

    expect(response).toEqual({
      content: [{ type: 'text', text: 'dynamic response' }],
      isError: false,
    });
  });

  it('should parse with optional fields', () => {
    const handler = {
      toolName: 'search',
      handler: vi.fn().mockResolvedValue({
        content: [],
        isError: false,
      }),
      matchArgs: { type: 'web' },
      delayMs: 500,
      maxInvocations: 5,
      priority: 75,
    };

    const result = MockDynamicHandlerSchema.parse(handler);
    expect(result.matchArgs).toEqual({ type: 'web' });
    expect(result.delayMs).toBe(500);
    expect(result.maxInvocations).toBe(5);
  });

  it('should use default values', () => {
    const handler = {
      toolName: 'basic-tool',
      handler: vi.fn().mockResolvedValue({
        content: [],
        isError: false,
      }),
    };

    const result = MockDynamicHandlerSchema.parse(handler);
    expect(result.maxInvocations).toBe(0);
    expect(result.priority).toBe(50);
  });

  it('should validate handler function signature', () => {
    // This test ensures the Zod function schema is properly validating
    const validHandler = {
      toolName: 'valid',
      handler: async (toolName: string, args: Record<string, unknown>, context: any) => ({
        content: [],
        isError: false,
      }),
    };

    expect(() => MockDynamicHandlerSchema.parse(validHandler)).not.toThrow();
  });

  it('should ensure type compatibility', () => {
    const mockHandler: MockDynamicHandlerFunction = async (toolName, args, context) => {
      return {
        content: [{ type: 'text', text: `Processed ${toolName}` }],
        isError: false,
      };
    };

    const handler: MockDynamicHandler = {
      toolName: 'process-data',
      handler: mockHandler,
      matchArgs: { format: 'json' },
      delayMs: 100,
      maxInvocations: 10,
      priority: 80,
    };

    expect(handler.toolName).toBe('process-data');
    expect(typeof handler.handler).toBe('function');
  });

  it('should validate non-negative delayMs', () => {
    const handler = {
      toolName: 'test',
      handler: vi.fn().mockResolvedValue({ content: [], isError: false }),
      delayMs: -1,
    };

    expect(() => MockDynamicHandlerSchema.parse(handler)).toThrow();
  });

  it('should validate non-negative maxInvocations', () => {
    const handler = {
      toolName: 'test',
      handler: vi.fn().mockResolvedValue({ content: [], isError: false }),
      maxInvocations: -1,
    };

    expect(() => MockDynamicHandlerSchema.parse(handler)).toThrow();
  });

  it('should validate non-negative priority', () => {
    const handler = {
      toolName: 'test',
      handler: vi.fn().mockResolvedValue({ content: [], isError: false }),
      priority: -1,
    };

    expect(() => MockDynamicHandlerSchema.parse(handler)).toThrow();
  });
});

// ============================================================================
// RESPONSE SEQUENCE TESTS (NEW FUNCTIONALITY)
// ============================================================================

describe('MockResponseSequence', () => {
  it('should parse basic response sequence', () => {
    const sequence = {
      toolName: 'status-check',
      responses: [
        {
          content: [{ type: 'text', text: 'initializing' }],
          isError: false,
        },
        {
          content: [{ type: 'text', text: 'ready' }],
          isError: false,
        },
      ],
    };

    const result = MockResponseSequenceSchema.parse(sequence);
    expect(result.toolName).toBe('status-check');
    expect(result.responses).toHaveLength(2);
    expect(result.cycleMode).toBe('cycle');
    expect(result.priority).toBe(50);
  });

  it('should parse with all optional fields', () => {
    const sequence = {
      toolName: 'paginated-search',
      responses: [
        {
          content: [{ type: 'text', text: 'page 1' }],
          isError: false,
          delayMs: 100,
        },
        {
          content: [{ type: 'text', text: 'page 2' }],
          isError: false,
          delayMs: 150,
        },
        {
          content: [{ type: 'text', text: 'no more results' }],
          isError: true,
        },
      ],
      matchArgs: { pageSize: 10 },
      cycleMode: 'stop_at_end' as const,
      priority: 90,
    };

    const result = MockResponseSequenceSchema.parse(sequence);
    expect(result.matchArgs).toEqual({ pageSize: 10 });
    expect(result.cycleMode).toBe('stop_at_end');
    expect(result.responses[0].delayMs).toBe(100);
    expect(result.responses[2].isError).toBe(true);
  });

  it('should validate cycle mode options', () => {
    const baseSequence = {
      toolName: 'test',
      responses: [{ content: [], isError: false }],
    };

    expect(() => MockResponseSequenceSchema.parse({
      ...baseSequence,
      cycleMode: 'invalid',
    })).toThrow();

    // Valid cycle modes
    ['cycle', 'repeat_last', 'stop_at_end'].forEach(mode => {
      expect(MockResponseSequenceSchema.parse({
        ...baseSequence,
        cycleMode: mode,
      }).cycleMode).toBe(mode);
    });
  });

  it('should require at least one response', () => {
    expect(() => MockResponseSequenceSchema.parse({
      toolName: 'test',
      responses: [],
    })).toThrow();
  });

  it('should validate response delay is non-negative', () => {
    expect(() => MockResponseSequenceSchema.parse({
      toolName: 'test',
      responses: [
        {
          content: [],
          isError: false,
          delayMs: -1,
        },
      ],
    })).toThrow();
  });

  it('should ensure type compatibility', () => {
    const sequence: MockResponseSequence = {
      toolName: 'file-processor',
      responses: [
        {
          content: [{ type: 'text', text: 'processing...' }],
          isError: false,
          delayMs: 500,
        },
        {
          content: [
            { type: 'text', text: 'complete' },
            { type: 'resource', resource: { uri: 'file:///output.txt', text: 'result data' } },
          ],
          isError: false,
        },
      ],
      matchArgs: { inputType: 'csv' },
      cycleMode: 'repeat_last',
      priority: 70,
    };

    expect(sequence.responses).toHaveLength(2);
    expect(sequence.cycleMode).toBe('repeat_last');
  });
});

// ============================================================================
// UPDATED MOCK TOOL HANDLER TESTS
// ============================================================================

describe('MockToolHandler', () => {
  it('should parse basic tool handler', () => {
    const handler = {
      toolName: 'read-file',
      response: {
        content: [{ type: 'text', text: 'file contents' }],
        isError: false,
      },
    };

    const result = MockToolHandlerSchema.parse(handler);
    expect(result.toolName).toBe('read-file');
    expect(result.response.isError).toBe(false);
    expect(result.priority).toBe(50); // default
  });

  it('should parse with all optional fields including priority', () => {
    const handler = {
      toolName: 'complex-operation',
      response: {
        content: [
          { type: 'text', text: 'Operation result' },
          { type: 'image', data: 'base64data', mimeType: 'image/png' },
        ],
        isError: false,
      },
      matchArgs: { operation: 'analyze', format: 'detailed' },
      delayMs: 1000,
      maxInvocations: 3,
      priority: 85, // NEW: priority field
    };

    const result = MockToolHandlerSchema.parse(handler);
    expect(result.matchArgs).toEqual({ operation: 'analyze', format: 'detailed' });
    expect(result.delayMs).toBe(1000);
    expect(result.maxInvocations).toBe(3);
    expect(result.priority).toBe(85); // NEW: verify priority field
  });

  it('should use default values', () => {
    const handler = {
      toolName: 'simple-tool',
      response: {
        content: [{ type: 'text', text: 'result' }],
      },
    };

    const result = MockToolHandlerSchema.parse(handler);
    expect(result.response.isError).toBe(false); // default
    expect(result.maxInvocations).toBe(0); // default
    expect(result.priority).toBe(50); // default
  });

  it('should validate priority field', () => {
    const handler = {
      toolName: 'test',
      response: { content: [], isError: false },
      priority: -1,
    };

    expect(() => MockToolHandlerSchema.parse(handler)).toThrow();

    // Valid priority values
    expect(MockToolHandlerSchema.parse({
      ...handler,
      priority: 0,
    }).priority).toBe(0);

    expect(MockToolHandlerSchema.parse({
      ...handler,
      priority: 100,
    }).priority).toBe(100);
  });

  it('should ensure type compatibility with updated schema', () => {
    const handler: MockToolHandler = {
      toolName: 'typed-tool',
      response: {
        content: [{ type: 'text', text: 'typed response' }],
        isError: false,
      },
      matchArgs: { param: 'value' },
      delayMs: 200,
      maxInvocations: 5,
      priority: 75, // NEW: type includes priority field
    };

    expect(handler.priority).toBe(75);
    expect(handler.toolName).toBe('typed-tool');
  });
});

// ============================================================================
// BEHAVIOR CONFIGURATION TESTS
// ============================================================================

describe('MockBehaviorConfig', () => {
  it('should parse with defaults', () => {
    const result = MockBehaviorConfigSchema.parse({});
    expect(result).toEqual({
      toolHandlers: [],
      dynamicHandlers: [],
      responseSequences: [],
      notificationTriggers: [],
      expectations: [],
      recordRequests: true,
      maxRecordedRequests: 1000,
      validateRequests: true,
      enableDebugLogging: false,
    });
  });

  it('should parse complete behavior config with new handler types', () => {
    const mockHandler = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'dynamic' }],
      isError: false,
    });

    const config = {
      responseDelay: { fixedMs: 100 },
      errorInjection: { enabled: true, probability: 0.1 },
      toolHandlers: [
        {
          toolName: 'static-tool',
          response: {
            content: [{ type: 'text', text: 'static response' }],
            isError: false,
          },
          priority: 60,
        },
      ],
      dynamicHandlers: [
        {
          toolName: 'dynamic-tool',
          handler: mockHandler,
          matchArgs: { type: 'special' },
          priority: 80,
        },
      ],
      responseSequences: [
        {
          toolName: 'sequence-tool',
          responses: [
            { content: [{ type: 'text', text: 'step 1' }], isError: false },
            { content: [{ type: 'text', text: 'step 2' }], isError: false },
          ],
          cycleMode: 'cycle',
          priority: 70,
        },
      ],
      notificationTriggers: [
        {
          condition: 'after_request_count',
          method: 'notifications/test',
          params: {},
          conditionValue: 5,
        },
      ],
      expectations: [
        {
          name: 'init-expectation',
          request: { method: 'initialize' },
          response: { result: { capabilities: {} } },
        },
      ],
      defaultToolResponse: {
        content: [{ type: 'text', text: 'default response' }],
        isError: false,
      },
    };

    const result = MockBehaviorConfigSchema.parse(config);
    expect(result.toolHandlers).toHaveLength(1);
    expect(result.dynamicHandlers).toHaveLength(1);
    expect(result.responseSequences).toHaveLength(1);
    expect(result.toolHandlers[0].priority).toBe(60);
    expect(result.dynamicHandlers[0].priority).toBe(80);
    expect(result.responseSequences[0].priority).toBe(70);
  });

  it('should ensure type compatibility with new fields', () => {
    const mockDynamicHandler = vi.fn().mockResolvedValue({
      content: [],
      isError: false,
    });

    const config: MockBehaviorConfig = {
      responseDelay: { fixedMs: 250, jitter: true },
      toolHandlers: [
        {
          toolName: 'legacy-tool',
          response: { content: [], isError: false },
          priority: 50,
        },
      ],
      dynamicHandlers: [
        {
          toolName: 'new-dynamic-tool',
          handler: mockDynamicHandler,
          priority: 90,
        },
      ],
      responseSequences: [
        {
          toolName: 'sequence-tool',
          responses: [{ content: [], isError: false }],
          priority: 60,
        },
      ],
      recordRequests: true,
    };

    expect(config.dynamicHandlers).toHaveLength(1);
    expect(config.responseSequences).toHaveLength(1);
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration Tests', () => {
  it('should create a complete mock server definition with new handler types', () => {
    const mockDynamicHandler = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'integrated response' }],
      isError: false,
    });

    const definition: MockMCPServerDefinition = {
      serverConfig: {
        name: 'integration-test-server',
        transport: 'stdio',
        capabilities: {
          tools: { listChanged: true },
        },
      },
      defaultBehavior: {
        toolHandlers: [
          {
            toolName: 'static-handler',
            response: { content: [{ type: 'text', text: 'static' }], isError: false },
            priority: 50,
          },
        ],
        dynamicHandlers: [
          {
            toolName: 'dynamic-handler',
            handler: mockDynamicHandler,
            matchArgs: { mode: 'smart' },
            priority: 80,
          },
        ],
        responseSequences: [
          {
            toolName: 'sequential-handler',
            responses: [
              { content: [{ type: 'text', text: 'first' }], isError: false },
              { content: [{ type: 'text', text: 'second' }], isError: false },
            ],
            cycleMode: 'repeat_last',
            priority: 70,
          },
        ],
        recordRequests: true,
      },
      scenarios: [
        {
          name: 'error-scenario',
          serverConfig: {
            name: 'error-test-server',
            transport: 'stdio',
          },
          behaviorConfig: {
            errorInjection: {
              enabled: true,
              probability: 1.0,
            },
          },
        },
      ],
    };

    const result = MockMCPServerDefinitionSchema.parse(definition);
    expect(result.defaultBehavior.dynamicHandlers).toHaveLength(1);
    expect(result.defaultBehavior.responseSequences).toHaveLength(1);
    expect(result.scenarios).toHaveLength(1);
  });

  it('should validate handler priority ordering in behavior config', () => {
    const config = {
      toolHandlers: [
        {
          toolName: 'low-priority',
          response: { content: [], isError: false },
          priority: 10,
        },
        {
          toolName: 'high-priority',
          response: { content: [], isError: false },
          priority: 90,
        },
      ],
      dynamicHandlers: [
        {
          toolName: 'medium-dynamic',
          handler: vi.fn().mockResolvedValue({ content: [], isError: false }),
          priority: 50,
        },
      ],
      responseSequences: [
        {
          toolName: 'high-sequence',
          responses: [{ content: [], isError: false }],
          priority: 95,
        },
      ],
    };

    const result = MockBehaviorConfigSchema.parse(config);

    // Verify priorities are preserved
    expect(result.toolHandlers[0].priority).toBe(10);
    expect(result.toolHandlers[1].priority).toBe(90);
    expect(result.dynamicHandlers[0].priority).toBe(50);
    expect(result.responseSequences[0].priority).toBe(95);
  });
});

// ============================================================================
// ERROR SCENARIO TESTS
// ============================================================================

describe('Error Scenarios', () => {
  it('should reject invalid function in dynamic handler', () => {
    expect(() => MockDynamicHandlerSchema.parse({
      toolName: 'test',
      handler: 'not-a-function',
    })).toThrow();
  });

  it('should reject empty responses array in sequence', () => {
    expect(() => MockResponseSequenceSchema.parse({
      toolName: 'test',
      responses: [],
    })).toThrow();
  });

  it('should reject invalid cycle mode', () => {
    expect(() => MockResponseSequenceSchema.parse({
      toolName: 'test',
      responses: [{ content: [], isError: false }],
      cycleMode: 'invalid-mode',
    })).toThrow();
  });

  it('should reject negative priority values', () => {
    expect(() => MockToolHandlerSchema.parse({
      toolName: 'test',
      response: { content: [], isError: false },
      priority: -5,
    })).toThrow();

    expect(() => MockDynamicHandlerSchema.parse({
      toolName: 'test',
      handler: vi.fn().mockResolvedValue({ content: [], isError: false }),
      priority: -1,
    })).toThrow();

    expect(() => MockResponseSequenceSchema.parse({
      toolName: 'test',
      responses: [{ content: [], isError: false }],
      priority: -10,
    })).toThrow();
  });
});