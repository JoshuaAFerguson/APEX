import { describe, it, expect } from 'vitest';
import {
  // Transport configuration schemas
  MockTransportTypeSchema,
  MockHttpTransportConfigSchema,
  MockSseTransportConfigSchema,
  MockStdioTransportConfigSchema,

  // Mock MCP server configuration
  MockMCPServerConfigSchema,

  // Response delay configuration
  MockResponseDelaySchema,

  // Error injection configuration
  MockErrorInjectionSchema,

  // Custom tool handlers
  MockToolResultContentSchema,
  MockToolHandlerSchema,

  // Notification triggers
  MockNotificationTriggerConditionSchema,
  MockNotificationTriggerSchema,

  // Stateful behavior
  MockStateTransitionSchema,
  MockStateBehaviorSchema,
  MockStatefulBehaviorConfigSchema,

  // Request/response pairs
  MockRequestMatcherSchema,
  MockResponseDefinitionSchema,
  MockRequestResponsePairSchema,

  // Mock behavior configuration
  MockBehaviorConfigSchema,

  // Mock scenarios
  MockScenarioSchema,

  // Complete mock server definition
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
  type MockToolHandler,
  type MockNotificationTriggerCondition,
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
} from '../mcp/mock-types.js';

describe('Mock MCP Server Types', () => {
  describe('Transport Configuration', () => {
    describe('MockTransportTypeSchema', () => {
      it('validates all supported transport types', () => {
        expect(MockTransportTypeSchema.parse('stdio')).toBe('stdio');
        expect(MockTransportTypeSchema.parse('http')).toBe('http');
        expect(MockTransportTypeSchema.parse('sse')).toBe('sse');
      });

      it('rejects invalid transport types', () => {
        expect(() => MockTransportTypeSchema.parse('websocket')).toThrow();
        expect(() => MockTransportTypeSchema.parse('tcp')).toThrow();
        expect(() => MockTransportTypeSchema.parse('')).toThrow();
      });
    });

    describe('MockHttpTransportConfigSchema', () => {
      it('validates basic HTTP configuration', () => {
        const config = {
          host: '127.0.0.1',
          port: 8080,
          basePath: '/api',
          tls: false,
        };
        expect(MockHttpTransportConfigSchema.parse(config)).toEqual(config);
      });

      it('applies default values', () => {
        const config = {};
        const result = MockHttpTransportConfigSchema.parse(config);
        expect(result.host).toBe('127.0.0.1');
        expect(result.port).toBe(0);
        expect(result.basePath).toBe('/');
        expect(result.tls).toBe(false);
      });

      it('validates TLS configuration', () => {
        const config = {
          tls: true,
          tlsCertPath: '/path/to/cert.pem',
          tlsKeyPath: '/path/to/key.pem',
        };
        expect(MockHttpTransportConfigSchema.parse(config)).toEqual(expect.objectContaining(config));
      });

      it('validates port ranges', () => {
        expect(MockHttpTransportConfigSchema.parse({ port: 0 })).toEqual(expect.objectContaining({ port: 0 }));
        expect(MockHttpTransportConfigSchema.parse({ port: 65535 })).toEqual(expect.objectContaining({ port: 65535 }));
        expect(() => MockHttpTransportConfigSchema.parse({ port: -1 })).toThrow();
        expect(() => MockHttpTransportConfigSchema.parse({ port: 65536 })).toThrow();
      });
    });

    describe('MockSseTransportConfigSchema', () => {
      it('validates SSE configuration', () => {
        const config = {
          host: 'localhost',
          port: 9090,
          endpoint: '/events',
          keepAliveMs: 30000,
        };
        expect(MockSseTransportConfigSchema.parse(config)).toEqual(config);
      });

      it('applies default values', () => {
        const config = {};
        const result = MockSseTransportConfigSchema.parse(config);
        expect(result.host).toBe('127.0.0.1');
        expect(result.port).toBe(0);
        expect(result.endpoint).toBe('/events');
        expect(result.keepAliveMs).toBe(15000);
      });

      it('validates keep-alive intervals', () => {
        expect(() => MockSseTransportConfigSchema.parse({ keepAliveMs: -1 })).toThrow();
        expect(MockSseTransportConfigSchema.parse({ keepAliveMs: 0 })).toEqual(expect.objectContaining({ keepAliveMs: 0 }));
      });
    });

    describe('MockStdioTransportConfigSchema', () => {
      it('validates stdio configuration', () => {
        const config = {
          bufferOutput: true,
          startupDelayMs: 1000,
        };
        expect(MockStdioTransportConfigSchema.parse(config)).toEqual(config);
      });

      it('applies default values', () => {
        const config = {};
        const result = MockStdioTransportConfigSchema.parse(config);
        expect(result.bufferOutput).toBe(false);
        expect(result.startupDelayMs).toBe(0);
      });

      it('validates startup delay ranges', () => {
        expect(() => MockStdioTransportConfigSchema.parse({ startupDelayMs: -1 })).toThrow();
        expect(MockStdioTransportConfigSchema.parse({ startupDelayMs: 0 })).toEqual(expect.objectContaining({ startupDelayMs: 0 }));
      });
    });
  });

  describe('Mock MCP Server Configuration', () => {
    describe('MockMCPServerConfigSchema', () => {
      it('validates minimal server configuration', () => {
        const config = {
          name: 'test-server',
        };
        const result = MockMCPServerConfigSchema.parse(config);
        expect(result.name).toBe('test-server');
        expect(result.transport).toBe('stdio'); // default
        expect(result.protocolVersion).toBe('2024-11-05'); // default
        expect(result.autoStart).toBe(true); // default
      });

      it('validates complete server configuration', () => {
        const config: MockMCPServerConfig = {
          name: 'comprehensive-server',
          description: 'A comprehensive mock server for testing',
          transport: 'http',
          httpConfig: {
            host: '0.0.0.0',
            port: 8080,
            basePath: '/mcp',
            tls: false,
          },
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: true },
            resources: { subscribe: true, listChanged: false },
          },
          serverInfo: {
            name: 'mock-server-v2',
            version: '2.0.0',
          },
          instructions: 'This is a mock server for testing purposes',
          autoStart: false,
          maxConnections: 50,
          shutdownTimeoutMs: 10000,
        };
        expect(MockMCPServerConfigSchema.parse(config)).toEqual(config);
      });

      it('validates server names', () => {
        expect(() => MockMCPServerConfigSchema.parse({ name: '' })).toThrow();
        expect(() => MockMCPServerConfigSchema.parse({ name: '   ' })).toThrow();
        expect(MockMCPServerConfigSchema.parse({ name: '  test-server  ' })).toEqual(
          expect.objectContaining({ name: 'test-server' })
        );
      });

      it('validates connection limits', () => {
        expect(() => MockMCPServerConfigSchema.parse({ name: 'test', maxConnections: 0 })).toThrow();
        expect(MockMCPServerConfigSchema.parse({ name: 'test', maxConnections: 1 })).toEqual(
          expect.objectContaining({ maxConnections: 1 })
        );
      });

      it('applies default server info', () => {
        const config = { name: 'test' };
        const result = MockMCPServerConfigSchema.parse(config);
        expect(result.serverInfo.name).toBe('apex-mock-mcp-server');
        expect(result.serverInfo.version).toBe('1.0.0');
      });
    });
  });

  describe('Response Delay Configuration', () => {
    describe('MockResponseDelaySchema', () => {
      it('validates fixed delay configuration', () => {
        const config = {
          fixedMs: 100,
          jitter: true,
        };
        expect(MockResponseDelaySchema.parse(config)).toEqual(config);
      });

      it('validates range delay configuration', () => {
        const config = {
          minMs: 50,
          maxMs: 200,
          jitter: false,
        };
        expect(MockResponseDelaySchema.parse(config)).toEqual(config);
      });

      it('validates per-method delay overrides', () => {
        const config = {
          fixedMs: 100,
          perMethod: {
            'tools/list': 50,
            'tools/call': 200,
            'resources/read': 500,
          },
        };
        expect(MockResponseDelaySchema.parse(config)).toEqual(config);
      });

      it('applies default values', () => {
        const config = {};
        const result = MockResponseDelaySchema.parse(config);
        expect(result.fixedMs).toBe(0);
        expect(result.jitter).toBe(false);
      });

      it('validates delay ranges', () => {
        expect(() => MockResponseDelaySchema.parse({ fixedMs: -1 })).toThrow();
        expect(() => MockResponseDelaySchema.parse({ minMs: -1 })).toThrow();
        expect(() => MockResponseDelaySchema.parse({ maxMs: -1 })).toThrow();
      });
    });
  });

  describe('Error Injection Configuration', () => {
    describe('MockErrorInjectionSchema', () => {
      it('validates basic error injection configuration', () => {
        const config = {
          enabled: true,
          probability: 0.1,
          errorCode: -32603,
          errorMessage: 'Mock server error',
        };
        expect(MockErrorInjectionSchema.parse(config)).toEqual(config);
      });

      it('validates advanced error injection configuration', () => {
        const config: MockErrorInjection = {
          enabled: true,
          probability: 0.2,
          errorCode: -32001,
          errorMessage: 'Custom error',
          errorData: { context: 'test scenario', requestId: '123' },
          methods: ['tools/call', 'resources/read'],
          afterRequestCount: 5,
          maxErrors: 3,
          simulateConnectionFailure: true,
          errorDelayMs: 1000,
        };
        expect(MockErrorInjectionSchema.parse(config)).toEqual(config);
      });

      it('applies default values', () => {
        const config = {};
        const result = MockErrorInjectionSchema.parse(config);
        expect(result.enabled).toBe(false);
        expect(result.probability).toBe(0);
        expect(result.errorCode).toBe(-32603);
        expect(result.errorMessage).toBe('Mock injected error');
        expect(result.methods).toEqual([]);
        expect(result.afterRequestCount).toBe(0);
        expect(result.maxErrors).toBe(0);
        expect(result.simulateConnectionFailure).toBe(false);
        expect(result.errorDelayMs).toBe(0);
      });

      it('validates probability ranges', () => {
        expect(() => MockErrorInjectionSchema.parse({ probability: -0.1 })).toThrow();
        expect(() => MockErrorInjectionSchema.parse({ probability: 1.1 })).toThrow();
        expect(MockErrorInjectionSchema.parse({ probability: 0 })).toEqual(expect.objectContaining({ probability: 0 }));
        expect(MockErrorInjectionSchema.parse({ probability: 1 })).toEqual(expect.objectContaining({ probability: 1 }));
      });
    });
  });

  describe('Custom Tool Handlers', () => {
    describe('MockToolResultContentSchema', () => {
      it('validates text content', () => {
        const content = {
          type: 'text' as const,
          text: 'This is mock content',
        };
        expect(MockToolResultContentSchema.parse(content)).toEqual(content);
      });

      it('validates image content', () => {
        const content = {
          type: 'image' as const,
          data: 'base64encodeddata',
          mimeType: 'image/png',
        };
        expect(MockToolResultContentSchema.parse(content)).toEqual(content);
      });

      it('validates resource content with text', () => {
        const content = {
          type: 'resource' as const,
          resource: {
            uri: 'file:///mock/file.txt',
            mimeType: 'text/plain',
            text: 'Mock file content',
          },
        };
        expect(MockToolResultContentSchema.parse(content)).toEqual(content);
      });

      it('validates resource content with blob', () => {
        const content = {
          type: 'resource' as const,
          resource: {
            uri: 'file:///mock/binary.bin',
            mimeType: 'application/octet-stream',
            blob: 'base64binarydata',
          },
        };
        expect(MockToolResultContentSchema.parse(content)).toEqual(content);
      });

      it('rejects invalid content types', () => {
        const invalidContent = {
          type: 'audio',
          data: 'audiodata',
        };
        expect(() => MockToolResultContentSchema.parse(invalidContent)).toThrow();
      });
    });

    describe('MockToolHandlerSchema', () => {
      it('validates basic tool handler', () => {
        const handler = {
          toolName: 'read_file',
          response: {
            content: [{ type: 'text' as const, text: 'Mock file content' }],
            isError: false,
          },
        };
        expect(MockToolHandlerSchema.parse(handler)).toEqual(handler);
      });

      it('validates tool handler with argument matching', () => {
        const handler: MockToolHandler = {
          toolName: 'search',
          response: {
            content: [{ type: 'text' as const, text: 'Search results' }],
            isError: false,
          },
          matchArgs: {
            query: 'specific search',
            limit: 10,
          },
          delayMs: 500,
          maxInvocations: 3,
        };
        expect(MockToolHandlerSchema.parse(handler)).toEqual(handler);
      });

      it('validates error response handlers', () => {
        const handler = {
          toolName: 'failing_tool',
          response: {
            content: [{ type: 'text' as const, text: 'Tool failed' }],
            isError: true,
          },
        };
        expect(MockToolHandlerSchema.parse(handler)).toEqual(handler);
      });

      it('applies default values', () => {
        const handler = {
          toolName: 'test_tool',
          response: {
            content: [{ type: 'text' as const, text: 'test' }],
          },
        };
        const result = MockToolHandlerSchema.parse(handler);
        expect(result.response.isError).toBe(false);
        expect(result.maxInvocations).toBe(0);
      });

      it('validates tool name requirements', () => {
        expect(() => MockToolHandlerSchema.parse({
          toolName: '',
          response: { content: [] },
        })).toThrow();
      });
    });
  });

  describe('Notification Triggers', () => {
    describe('MockNotificationTriggerConditionSchema', () => {
      it('validates all trigger conditions', () => {
        const conditions: MockNotificationTriggerCondition[] = [
          'after_request_count',
          'after_method',
          'after_delay',
          'periodic',
        ];
        conditions.forEach(condition => {
          expect(MockNotificationTriggerConditionSchema.parse(condition)).toBe(condition);
        });
      });

      it('rejects invalid conditions', () => {
        expect(() => MockNotificationTriggerConditionSchema.parse('on_startup')).toThrow();
        expect(() => MockNotificationTriggerConditionSchema.parse('manual')).toThrow();
      });
    });

    describe('MockNotificationTriggerSchema', () => {
      it('validates after_request_count trigger', () => {
        const trigger = {
          condition: 'after_request_count' as const,
          method: 'notifications/tools/list_changed',
          params: {},
          conditionValue: 5,
          once: true,
          delayMs: 0,
        };
        expect(MockNotificationTriggerSchema.parse(trigger)).toEqual(trigger);
      });

      it('validates after_method trigger', () => {
        const trigger: MockNotificationTrigger = {
          condition: 'after_method',
          method: 'notifications/resources/updated',
          params: { resource: 'test.txt' },
          conditionValue: 'tools/call',
          once: false,
          delayMs: 100,
        };
        expect(MockNotificationTriggerSchema.parse(trigger)).toEqual(trigger);
      });

      it('validates periodic trigger', () => {
        const trigger = {
          condition: 'periodic' as const,
          method: 'notifications/heartbeat',
          params: { timestamp: '2024-01-01T00:00:00Z' },
          conditionValue: 10, // every 10 requests
        };
        const result = MockNotificationTriggerSchema.parse(trigger);
        expect(result.once).toBe(true); // default
        expect(result.delayMs).toBe(0); // default
      });

      it('validates condition values with different types', () => {
        const stringCondition = {
          condition: 'after_method' as const,
          method: 'test',
          conditionValue: 'tools/list',
        };
        expect(MockNotificationTriggerSchema.parse(stringCondition)).toEqual(expect.objectContaining({ conditionValue: 'tools/list' }));

        const numberCondition = {
          condition: 'after_delay' as const,
          method: 'test',
          conditionValue: 5000,
        };
        expect(MockNotificationTriggerSchema.parse(numberCondition)).toEqual(expect.objectContaining({ conditionValue: 5000 }));
      });

      it('applies default values', () => {
        const trigger = {
          condition: 'after_request_count' as const,
          method: 'test',
          conditionValue: 1,
        };
        const result = MockNotificationTriggerSchema.parse(trigger);
        expect(result.params).toEqual({});
        expect(result.once).toBe(true);
        expect(result.delayMs).toBe(0);
      });
    });
  });

  describe('Stateful Behavior', () => {
    describe('MockStateTransitionSchema', () => {
      it('validates basic state transition', () => {
        const transition = {
          from: 'idle',
          to: 'active',
          onMethod: 'tools/call',
        };
        expect(MockStateTransitionSchema.parse(transition)).toEqual(transition);
      });

      it('validates transition with conditions', () => {
        const transition: MockStateTransition = {
          from: 'active',
          to: 'error',
          onMethod: 'tools/call',
          whenArgs: { action: 'fail' },
          emitNotification: {
            method: 'notifications/error',
            params: { error: 'Transition to error state' },
          },
        };
        expect(MockStateTransitionSchema.parse(transition)).toEqual(transition);
      });

      it('validates state names', () => {
        expect(() => MockStateTransitionSchema.parse({
          from: '',
          to: 'active',
          onMethod: 'test',
        })).toThrow();

        expect(() => MockStateTransitionSchema.parse({
          from: 'idle',
          to: '',
          onMethod: 'test',
        })).toThrow();
      });
    });

    describe('MockStateBehaviorSchema', () => {
      it('validates state behavior configuration', () => {
        const behavior: MockStateBehavior = {
          state: 'error_mode',
          toolHandlers: [
            {
              toolName: 'any_tool',
              response: {
                content: [{ type: 'text', text: 'Server in error mode' }],
                isError: true,
              },
            },
          ],
          errorInjection: {
            enabled: true,
            probability: 0.8,
          },
          responseDelay: {
            fixedMs: 2000,
          },
          capabilities: {
            tools: { listChanged: false },
          },
        };
        expect(MockStateBehaviorSchema.parse(behavior)).toEqual(behavior);
      });

      it('applies default values', () => {
        const behavior = {
          state: 'test_state',
        };
        const result = MockStateBehaviorSchema.parse(behavior);
        expect(result.toolHandlers).toEqual([]);
      });
    });

    describe('MockStatefulBehaviorConfigSchema', () => {
      it('validates complete stateful behavior configuration', () => {
        const config: MockStatefulBehaviorConfig = {
          initialState: 'starting',
          transitions: [
            { from: 'starting', to: 'ready', onMethod: 'initialize' },
            { from: 'ready', to: 'processing', onMethod: 'tools/call' },
            { from: 'processing', to: 'ready', onMethod: 'tools/call', whenArgs: { complete: true } },
          ],
          stateBehaviors: [
            {
              state: 'processing',
              responseDelay: { fixedMs: 1000 },
            },
          ],
          resetOnDisconnect: false,
        };
        expect(MockStatefulBehaviorConfigSchema.parse(config)).toEqual(config);
      });

      it('applies default values', () => {
        const config = {};
        const result = MockStatefulBehaviorConfigSchema.parse(config);
        expect(result.initialState).toBe('default');
        expect(result.transitions).toEqual([]);
        expect(result.stateBehaviors).toEqual([]);
        expect(result.resetOnDisconnect).toBe(true);
      });
    });
  });

  describe('Request/Response Pairs (Expectations)', () => {
    describe('MockRequestMatcherSchema', () => {
      it('validates basic request matcher', () => {
        const matcher = {
          method: 'tools/list',
        };
        expect(MockRequestMatcherSchema.parse(matcher)).toEqual(matcher);
      });

      it('validates request matcher with parameters', () => {
        const matcher: MockRequestMatcher = {
          method: 'tools/call',
          params: {
            name: 'search',
            arguments: { query: 'test' },
          },
          strictParamMatch: true,
        };
        expect(MockRequestMatcherSchema.parse(matcher)).toEqual(matcher);
      });

      it('applies default values', () => {
        const matcher = { method: 'test' };
        const result = MockRequestMatcherSchema.parse(matcher);
        expect(result.strictParamMatch).toBe(false);
      });
    });

    describe('MockResponseDefinitionSchema', () => {
      it('validates success response', () => {
        const response = {
          result: { tools: [] },
          delayMs: 100,
        };
        expect(MockResponseDefinitionSchema.parse(response)).toEqual(response);
      });

      it('validates error response', () => {
        const response: MockResponseDefinition = {
          error: {
            code: -32601,
            message: 'Method not found',
            data: { method: 'unknown_method' },
          },
          delayMs: 0,
        };
        expect(MockResponseDefinitionSchema.parse(response)).toEqual(response);
      });

      it('applies default delay', () => {
        const response = { result: 'test' };
        const result = MockResponseDefinitionSchema.parse(response);
        expect(result.delayMs).toBe(0);
      });
    });

    describe('MockRequestResponsePairSchema', () => {
      it('validates complete request/response pair', () => {
        const pair: MockRequestResponsePair = {
          name: 'list-tools-expectation',
          request: {
            method: 'tools/list',
            params: { cursor: null },
          },
          response: {
            result: {
              tools: [
                { name: 'test_tool', inputSchema: { type: 'object' } },
              ],
            },
          },
          expectedCallCount: 1,
          required: true,
          order: 1,
        };
        expect(MockRequestResponsePairSchema.parse(pair)).toEqual(pair);
      });

      it('validates minimal request/response pair', () => {
        const pair = {
          name: 'simple-test',
          request: { method: 'ping' },
          response: { result: 'pong' },
        };
        const result = MockRequestResponsePairSchema.parse(pair);
        expect(result.expectedCallCount).toBe(0);
        expect(result.required).toBe(false);
      });

      it('validates name requirements', () => {
        expect(() => MockRequestResponsePairSchema.parse({
          name: '',
          request: { method: 'test' },
          response: { result: 'test' },
        })).toThrow();
      });
    });
  });

  describe('Mock Behavior Configuration', () => {
    describe('MockBehaviorConfigSchema', () => {
      it('validates empty behavior configuration', () => {
        const config = {};
        const result = MockBehaviorConfigSchema.parse(config);
        expect(result.toolHandlers).toEqual([]);
        expect(result.notificationTriggers).toEqual([]);
        expect(result.expectations).toEqual([]);
        expect(result.recordRequests).toBe(true);
        expect(result.maxRecordedRequests).toBe(1000);
        expect(result.validateRequests).toBe(true);
        expect(result.enableDebugLogging).toBe(false);
      });

      it('validates comprehensive behavior configuration', () => {
        const config: MockBehaviorConfig = {
          responseDelay: {
            minMs: 100,
            maxMs: 500,
            jitter: true,
          },
          errorInjection: {
            enabled: true,
            probability: 0.05,
            errorCode: -32001,
            errorMessage: 'Random test error',
            methods: ['tools/call'],
          },
          toolHandlers: [
            {
              toolName: 'read_file',
              response: {
                content: [{ type: 'text', text: 'Mock file content' }],
              },
              matchArgs: { path: '/test/file.txt' },
            },
          ],
          notificationTriggers: [
            {
              condition: 'after_request_count',
              method: 'notifications/tools/list_changed',
              conditionValue: 3,
              params: {},
            },
          ],
          statefulBehavior: {
            initialState: 'idle',
            transitions: [
              { from: 'idle', to: 'busy', onMethod: 'tools/call' },
            ],
          },
          expectations: [
            {
              name: 'initialization',
              request: { method: 'initialize' },
              response: { result: { protocolVersion: '2024-11-05' } },
              required: true,
            },
          ],
          recordRequests: true,
          maxRecordedRequests: 500,
          defaultToolResponse: {
            content: [{ type: 'text', text: 'Default response' }],
            isError: false,
          },
          validateRequests: false,
          enableDebugLogging: true,
        };
        expect(MockBehaviorConfigSchema.parse(config)).toEqual(config);
      });

      it('validates default tool response', () => {
        const config = {
          defaultToolResponse: {
            content: [{ type: 'text' as const, text: 'Fallback response' }],
            isError: true,
          },
        };
        expect(MockBehaviorConfigSchema.parse(config)).toEqual(expect.objectContaining(config));
      });
    });
  });

  describe('Mock Scenarios', () => {
    describe('MockScenarioSchema', () => {
      it('validates basic mock scenario', () => {
        const scenario = {
          name: 'slow-server',
          description: 'Simulates a slow responding server',
          serverConfig: {
            name: 'slow-mock-server',
            transport: 'stdio' as const,
          },
          behaviorConfig: {
            responseDelay: { fixedMs: 2000 },
          },
        };
        expect(MockScenarioSchema.parse(scenario)).toEqual(expect.objectContaining(scenario));
      });

      it('validates scenario with hooks', () => {
        const scenario: MockScenario = {
          name: 'connection-test',
          description: 'Tests connection lifecycle',
          serverConfig: {
            name: 'lifecycle-server',
          },
          behaviorConfig: {},
          tags: ['lifecycle', 'integration'],
          onConnect: [
            {
              method: 'notifications/ready',
              params: { status: 'connected' },
              delayMs: 100,
            },
          ],
          onDisconnect: [
            {
              method: 'notifications/goodbye',
              params: { status: 'disconnected' },
            },
          ],
        };
        expect(MockScenarioSchema.parse(scenario)).toEqual(scenario);
      });

      it('applies default values', () => {
        const scenario = {
          name: 'minimal-scenario',
          serverConfig: { name: 'minimal-server' },
        };
        const result = MockScenarioSchema.parse(scenario);
        expect(result.behaviorConfig).toEqual({});
        expect(result.tags).toEqual([]);
        expect(result.onConnect).toEqual([]);
        expect(result.onDisconnect).toEqual([]);
      });

      it('validates scenario names', () => {
        expect(() => MockScenarioSchema.parse({
          name: '',
          serverConfig: { name: 'test' },
        })).toThrow();
      });
    });
  });

  describe('Complete Mock Server Definition', () => {
    describe('MockMCPServerDefinitionSchema', () => {
      it('validates minimal mock server definition', () => {
        const definition = {
          serverConfig: {
            name: 'test-mock-server',
          },
        };
        const result = MockMCPServerDefinitionSchema.parse(definition);
        expect(result.defaultBehavior).toEqual({});
        expect(result.scenarios).toEqual([]);
      });

      it('validates complete mock server definition', () => {
        const definition: MockMCPServerDefinition = {
          serverConfig: {
            name: 'comprehensive-mock',
            description: 'A comprehensive mock MCP server',
            transport: 'http',
            httpConfig: {
              port: 9000,
              basePath: '/mcp',
            },
            capabilities: {
              tools: { listChanged: true },
              resources: { subscribe: true },
            },
          },
          defaultBehavior: {
            responseDelay: { fixedMs: 50 },
            toolHandlers: [
              {
                toolName: 'default_tool',
                response: {
                  content: [{ type: 'text', text: 'Default tool response' }],
                },
              },
            ],
            recordRequests: true,
          },
          scenarios: [
            {
              name: 'error-mode',
              description: 'High error rate scenario',
              serverConfig: {
                name: 'error-mock',
              },
              behaviorConfig: {
                errorInjection: {
                  enabled: true,
                  probability: 0.3,
                },
              },
              tags: ['error-testing'],
            },
            {
              name: 'slow-mode',
              description: 'High latency scenario',
              serverConfig: {
                name: 'slow-mock',
              },
              behaviorConfig: {
                responseDelay: { minMs: 1000, maxMs: 3000 },
              },
              tags: ['performance-testing'],
            },
          ],
          activeScenario: 'error-mode',
        };
        expect(MockMCPServerDefinitionSchema.parse(definition)).toEqual(definition);
      });

      it('validates scenario activation', () => {
        const definition = {
          serverConfig: { name: 'test' },
          scenarios: [
            {
              name: 'scenario-1',
              serverConfig: { name: 'test-1' },
            },
          ],
          activeScenario: 'scenario-1',
        };
        expect(MockMCPServerDefinitionSchema.parse(definition)).toEqual(expect.objectContaining({ activeScenario: 'scenario-1' }));
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    describe('Type safety and discriminated unions', () => {
      it('ensures proper type discrimination for tool result content', () => {
        // Text content must have text field
        expect(() => MockToolResultContentSchema.parse({
          type: 'text',
          data: 'should not be here',
        })).toThrow();

        // Image content must have data and mimeType
        expect(() => MockToolResultContentSchema.parse({
          type: 'image',
          text: 'should not be here',
        })).toThrow();

        // Resource content must have resource field
        expect(() => MockToolResultContentSchema.parse({
          type: 'resource',
          text: 'should not be here',
        })).toThrow();
      });

      it('ensures proper type discrimination for notification conditions', () => {
        // All conditions should be from the enum
        const validConditions = ['after_request_count', 'after_method', 'after_delay', 'periodic'];
        validConditions.forEach(condition => {
          expect(() => MockNotificationTriggerConditionSchema.parse(condition)).not.toThrow();
        });

        expect(() => MockNotificationTriggerConditionSchema.parse('invalid_condition')).toThrow();
      });
    });

    describe('Default value application', () => {
      it('applies defaults consistently across all schemas', () => {
        // Server config defaults
        const serverResult = MockMCPServerConfigSchema.parse({ name: 'test' });
        expect(serverResult.transport).toBe('stdio');
        expect(serverResult.autoStart).toBe(true);

        // Behavior config defaults
        const behaviorResult = MockBehaviorConfigSchema.parse({});
        expect(behaviorResult.recordRequests).toBe(true);
        expect(behaviorResult.validateRequests).toBe(true);

        // Error injection defaults
        const errorResult = MockErrorInjectionSchema.parse({});
        expect(errorResult.enabled).toBe(false);
        expect(errorResult.probability).toBe(0);
      });
    });

    describe('Validation edge cases', () => {
      it('handles empty arrays and objects correctly', () => {
        expect(MockBehaviorConfigSchema.parse({
          toolHandlers: [],
          notificationTriggers: [],
          expectations: [],
        })).toEqual(expect.objectContaining({
          toolHandlers: [],
          notificationTriggers: [],
          expectations: [],
        }));
      });

      it('validates complex nested structures', () => {
        const complexConfig = {
          statefulBehavior: {
            initialState: 'complex',
            transitions: [
              {
                from: 'complex',
                to: 'simple',
                onMethod: 'tools/call',
                whenArgs: { complexity: 'reduce' },
                emitNotification: {
                  method: 'notifications/state_changed',
                  params: { from: 'complex', to: 'simple' },
                },
              },
            ],
            stateBehaviors: [
              {
                state: 'complex',
                toolHandlers: [
                  {
                    toolName: 'complex_operation',
                    response: {
                      content: [
                        { type: 'text', text: 'Complex operation result' },
                        {
                          type: 'resource',
                          resource: {
                            uri: 'file:///complex/result.json',
                            mimeType: 'application/json',
                            text: '{"result": "complex"}',
                          },
                        },
                      ],
                    },
                    delayMs: 1000,
                  },
                ],
                errorInjection: {
                  enabled: true,
                  probability: 0.1,
                },
              },
            ],
          },
        };
        expect(MockBehaviorConfigSchema.parse(complexConfig)).toEqual(expect.objectContaining(complexConfig));
      });

      it('validates string length and format requirements', () => {
        // Empty strings should be rejected where required
        expect(() => MockMCPServerConfigSchema.parse({ name: '' })).toThrow();
        expect(() => MockToolHandlerSchema.parse({
          toolName: '',
          response: { content: [] }
        })).toThrow();

        // Whitespace trimming
        const serverConfig = MockMCPServerConfigSchema.parse({ name: '  test-server  ' });
        expect(serverConfig.name).toBe('test-server');
      });
    });

    describe('Real-world usage patterns', () => {
      it('supports common testing scenarios', () => {
        // Error injection scenario
        const errorScenario: MockScenario = {
          name: 'error-injection',
          description: 'Tests error handling',
          serverConfig: { name: 'error-server' },
          behaviorConfig: {
            errorInjection: {
              enabled: true,
              probability: 0.2,
              methods: ['tools/call'],
              afterRequestCount: 2,
            },
          },
          tags: ['error-testing', 'resilience'],
        };
        expect(MockScenarioSchema.parse(errorScenario)).toEqual(errorScenario);

        // Performance testing scenario
        const performanceScenario: MockScenario = {
          name: 'high-latency',
          description: 'Tests performance under high latency',
          serverConfig: { name: 'slow-server' },
          behaviorConfig: {
            responseDelay: {
              minMs: 1000,
              maxMs: 5000,
              jitter: true,
              perMethod: {
                'tools/call': 2000,
                'resources/read': 3000,
              },
            },
          },
          tags: ['performance', 'latency'],
        };
        expect(MockScenarioSchema.parse(performanceScenario)).toEqual(performanceScenario);

        // State machine scenario
        const statefulScenario: MockScenario = {
          name: 'authentication-flow',
          description: 'Tests stateful authentication',
          serverConfig: { name: 'auth-server' },
          behaviorConfig: {
            statefulBehavior: {
              initialState: 'unauthenticated',
              transitions: [
                { from: 'unauthenticated', to: 'authenticated', onMethod: 'tools/call', whenArgs: { action: 'login' } },
                { from: 'authenticated', to: 'unauthenticated', onMethod: 'tools/call', whenArgs: { action: 'logout' } },
              ],
              stateBehaviors: [
                {
                  state: 'unauthenticated',
                  errorInjection: {
                    enabled: true,
                    probability: 1.0,
                    errorCode: -32001,
                    errorMessage: 'Authentication required',
                    methods: ['tools/call'],
                  },
                },
              ],
            },
            expectations: [
              {
                name: 'login-required',
                request: { method: 'tools/call', params: { action: 'login' } },
                response: { result: { status: 'authenticated' } },
                required: true,
                order: 1,
              },
            ],
          },
          tags: ['authentication', 'stateful'],
        };
        expect(MockScenarioSchema.parse(statefulScenario)).toEqual(statefulScenario);
      });
    });
  });

  describe('Type exports verification', () => {
    it('exports all expected types for runtime use', () => {
      // Verify that type annotations work as expected
      const transportType: MockTransportType = 'stdio';
      expect(transportType).toBe('stdio');

      const httpConfig: MockHttpTransportConfig = {
        host: '127.0.0.1',
        port: 8080,
        basePath: '/api',
        tls: false,
      };
      expect(httpConfig.host).toBe('127.0.0.1');

      const serverConfig: MockMCPServerConfig = {
        name: 'test-server',
        transport: 'http',
        capabilities: {
          tools: { listChanged: true },
        },
      };
      expect(serverConfig.name).toBe('test-server');

      const toolHandler: MockToolHandler = {
        toolName: 'test_tool',
        response: {
          content: [{ type: 'text', text: 'test' }],
          isError: false,
        },
      };
      expect(toolHandler.toolName).toBe('test_tool');

      const scenario: MockScenario = {
        name: 'test-scenario',
        serverConfig: { name: 'test' },
        behaviorConfig: {
          recordRequests: true,
        },
      };
      expect(scenario.name).toBe('test-scenario');

      const definition: MockMCPServerDefinition = {
        serverConfig: { name: 'test' },
        defaultBehavior: {},
        scenarios: [scenario],
      };
      expect(definition.scenarios).toHaveLength(1);
    });
  });
});