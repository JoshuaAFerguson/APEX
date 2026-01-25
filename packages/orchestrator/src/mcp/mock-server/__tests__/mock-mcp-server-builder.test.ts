/**
 * @fileoverview Tests for MockMCPServerBuilder
 *
 * Comprehensive test suite covering all fluent API methods, integration
 * with MockMCPServer and MockMCPServerFacade, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockMCPServerBuilder, createMockServerBuilder } from '../mock-mcp-server-builder.js';
import { MockMCPServerFacade } from '../mock-server-facade.js';
import { MockMCPServer } from '../mock-mcp-server.js';
import type {
  MockMCPServerDefinition,
  MockToolResultContent,
} from '@apexcli/core';

describe('MockMCPServerBuilder', () => {
  let builder: MockMCPServerBuilder;

  beforeEach(() => {
    builder = new MockMCPServerBuilder();
  });

  describe('Basic Configuration', () => {
    it('should set server name and description', () => {
      const definition = builder
        .withName('test-server', 'A test server')
        .buildDefinition();

      expect(definition.serverConfig.name).toBe('test-server');
      expect(definition.serverConfig.description).toBe('A test server');
    });

    it('should set transport type', () => {
      const definition = builder
        .withName('test-server')
        .withTransport('http')
        .buildDefinition();

      expect(definition.serverConfig.transport).toBe('http');
    });

    it('should set capabilities', () => {
      const capabilities = {
        tools: { listChanged: true },
        resources: { subscribe: true },
      };

      const definition = builder
        .withName('test-server')
        .withCapabilities(capabilities)
        .buildDefinition();

      expect(definition.serverConfig.capabilities).toEqual(capabilities);
    });

    it('should throw error if name is not provided', () => {
      expect(() => {
        builder.buildDefinition();
      }).toThrow('Server name is required');
    });
  });

  describe('Tool Configuration', () => {
    it('should configure static response for a tool', () => {
      const content: MockToolResultContent[] = [
        { type: 'text', text: 'Hello, World!' }
      ];

      const definition = builder
        .withName('test-server')
        .withTool('greet')
        .withStaticResponse(content)
        .buildDefinition();

      expect(definition.defaultBehavior.toolHandlers).toHaveLength(1);
      expect(definition.defaultBehavior.toolHandlers[0]).toEqual({
        toolName: 'greet',
        response: { content, isError: false },
        priority: 50,
      });
    });

    it('should configure error response for a tool', () => {
      const content: MockToolResultContent[] = [
        { type: 'text', text: 'Error occurred' }
      ];

      const definition = builder
        .withName('test-server')
        .withTool('fail')
        .withStaticResponse(content, true)
        .buildDefinition();

      expect(definition.defaultBehavior.toolHandlers[0].response.isError).toBe(true);
    });

    it('should configure dynamic handler for a tool', async () => {
      const handler = async (toolName: string, args: Record<string, unknown>) => ({
        content: [{ type: 'text' as const, text: `Dynamic response for ${toolName}` }],
        isError: false,
      });

      const definition = builder
        .withName('test-server')
        .withTool('dynamic')
        .withDynamicHandler(handler, {
          matchArgs: { type: 'test' },
          delayMs: 100,
          maxInvocations: 5,
          priority: 75,
        })
        .buildDefinition();

      expect(definition.defaultBehavior.dynamicHandlers).toHaveLength(1);
      const dynamicHandler = definition.defaultBehavior.dynamicHandlers[0];
      expect(dynamicHandler.toolName).toBe('dynamic');
      expect(dynamicHandler.matchArgs).toEqual({ type: 'test' });
      expect(dynamicHandler.delayMs).toBe(100);
      expect(dynamicHandler.maxInvocations).toBe(5);
      expect(dynamicHandler.priority).toBe(75);

      // Test the handler function
      const result = await dynamicHandler.handler('dynamic', {}, {
        requestId: 'test',
        invocationCount: 1,
        timestamp: new Date(),
      });
      expect(result.content[0].text).toBe('Dynamic response for dynamic');
    });

    it('should configure response sequence for a tool', () => {
      const responses = [
        { content: [{ type: 'text' as const, text: 'First' }], isError: false },
        { content: [{ type: 'text' as const, text: 'Second' }], isError: false, delayMs: 100 },
        { content: [{ type: 'text' as const, text: 'Third' }], isError: true },
      ];

      const definition = builder
        .withName('test-server')
        .withTool('sequence')
        .withResponseSequence(responses, 'stop_at_end')
        .buildDefinition();

      expect(definition.defaultBehavior.responseSequences).toHaveLength(1);
      const sequence = definition.defaultBehavior.responseSequences[0];
      expect(sequence.toolName).toBe('sequence');
      expect(sequence.responses).toEqual(responses);
      expect(sequence.cycleMode).toBe('stop_at_end');
    });

    it('should configure multiple tools', () => {
      const definition = builder
        .withName('test-server')
        .withTool('tool1')
        .withStaticResponse([{ type: 'text', text: 'Response 1' }])
        .withTool('tool2')
        .withStaticResponse([{ type: 'text', text: 'Response 2' }])
        .withTool('tool3')
        .withDynamicHandler(async () => ({
          content: [{ type: 'text', text: 'Dynamic' }],
          isError: false,
        }))
        .buildDefinition();

      expect(definition.defaultBehavior.toolHandlers).toHaveLength(2);
      expect(definition.defaultBehavior.dynamicHandlers).toHaveLength(1);

      expect(definition.defaultBehavior.toolHandlers[0].toolName).toBe('tool1');
      expect(definition.defaultBehavior.toolHandlers[1].toolName).toBe('tool2');
      expect(definition.defaultBehavior.dynamicHandlers[0].toolName).toBe('tool3');
    });

    it('should throw error if static response called without withTool', () => {
      expect(() => {
        builder
          .withName('test-server')
          .withStaticResponse([{ type: 'text', text: 'test' }]);
      }).toThrow('withStaticResponse() must be called after withTool()');
    });

    it('should throw error if dynamic handler called without withTool', () => {
      expect(() => {
        builder
          .withName('test-server')
          .withDynamicHandler(async () => ({ content: [], isError: false }));
      }).toThrow('withDynamicHandler() must be called after withTool()');
    });

    it('should throw error if response sequence called without withTool', () => {
      expect(() => {
        builder
          .withName('test-server')
          .withResponseSequence([]);
      }).toThrow('withResponseSequence() must be called after withTool()');
    });

    it('should throw error if tool declared but no handler configured', () => {
      expect(() => {
        builder
          .withName('test-server')
          .withTool('incomplete')
          .buildDefinition();
      }).toThrow("Tool 'incomplete' was declared with withTool() but no handler was configured");
    });
  });

  describe('Delay Configuration', () => {
    it('should configure fixed delay', () => {
      const definition = builder
        .withName('test-server')
        .withDelay(100)
        .buildDefinition();

      expect(definition.defaultBehavior.responseDelay).toEqual({
        fixedMs: 100,
        jitter: false,
        perMethod: undefined,
        minMs: undefined,
        maxMs: undefined,
      });
    });

    it('should configure random delay range', () => {
      const definition = builder
        .withName('test-server')
        .withDelay(50, 150, true)
        .buildDefinition();

      expect(definition.defaultBehavior.responseDelay).toEqual({
        fixedMs: 0,
        minMs: 50,
        maxMs: 150,
        jitter: true,
        perMethod: undefined,
      });
    });

    it('should configure per-method delays', () => {
      const definition = builder
        .withName('test-server')
        .withDelay(100)
        .withDelayForMethod('tools/call', 200)
        .withDelayForMethod('initialize', 10)
        .buildDefinition();

      expect(definition.defaultBehavior.responseDelay?.perMethod).toEqual({
        'tools/call': 200,
        'initialize': 10,
      });
    });

    it('should create delay config if not exists when setting per-method delay', () => {
      const definition = builder
        .withName('test-server')
        .withDelayForMethod('tools/call', 150)
        .buildDefinition();

      expect(definition.defaultBehavior.responseDelay).toEqual({
        fixedMs: 0,
        jitter: false,
        perMethod: {
          'tools/call': 150,
        },
      });
    });
  });

  describe('Error Injection', () => {
    it('should configure error injection', () => {
      const errorConfig = {
        enabled: true,
        probability: 0.5,
        errorMessage: 'Test error',
        methods: ['tools/call'],
        afterRequestCount: 5,
      };

      const definition = builder
        .withName('test-server')
        .withErrorInjection(errorConfig)
        .buildDefinition();

      expect(definition.defaultBehavior.errorInjection).toEqual({
        enabled: true,
        probability: 0.5,
        errorCode: -32603,
        errorMessage: 'Test error',
        methods: ['tools/call'],
        afterRequestCount: 5,
        maxErrors: 0,
        simulateConnectionFailure: false,
        errorDelayMs: 0,
      });
    });
  });

  describe('Scenarios', () => {
    it('should configure scenarios', () => {
      const definition = builder
        .withName('test-server')
        .withScenario('error-mode', scenario =>
          scenario.withErrorInjection({ enabled: true, probability: 1.0 })
        )
        .withScenario('slow-mode', scenario =>
          scenario.withDelay(1000, 2000)
        )
        .buildDefinition();

      expect(definition.scenarios).toHaveLength(2);

      const errorScenario = definition.scenarios.find(s => s.name === 'error-mode');
      expect(errorScenario?.behaviorConfig.errorInjection?.enabled).toBe(true);
      expect(errorScenario?.behaviorConfig.errorInjection?.probability).toBe(1.0);

      const slowScenario = definition.scenarios.find(s => s.name === 'slow-mode');
      expect(slowScenario?.behaviorConfig.responseDelay?.minMs).toBe(1000);
      expect(slowScenario?.behaviorConfig.responseDelay?.maxMs).toBe(2000);
    });

    it('should set active scenario', () => {
      const definition = builder
        .withName('test-server')
        .withScenario('test-mode', scenario => scenario.withDelay(100))
        .withActiveScenario('test-mode')
        .buildDefinition();

      expect(definition.activeScenario).toBe('test-mode');
    });
  });

  describe('Building Different Server Types', () => {
    it('should build MockMCPServerFacade', () => {
      const server = builder
        .withName('test-server')
        .withTool('ping')
        .withStaticResponse([{ type: 'text', text: 'pong' }])
        .build();

      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should build MockMCPServer', () => {
      const server = builder
        .withName('test-server')
        .withTool('ping')
        .withStaticResponse([{ type: 'text', text: 'pong' }])
        .buildServer();

      expect(server).toBeInstanceOf(MockMCPServer);
    });

    it('should build MockMCPServerDefinition', () => {
      const definition = builder
        .withName('test-server')
        .withTool('ping')
        .withStaticResponse([{ type: 'text', text: 'pong' }])
        .buildDefinition();

      expect(definition).toHaveProperty('serverConfig');
      expect(definition).toHaveProperty('defaultBehavior');
      expect(definition).toHaveProperty('scenarios');
      expect(definition.serverConfig.name).toBe('test-server');
    });
  });

  describe('Factory Function', () => {
    it('should create builder via factory function', () => {
      const factoryBuilder = createMockServerBuilder();
      expect(factoryBuilder).toBeInstanceOf(MockMCPServerBuilder);
    });
  });

  describe('Integration Tests', () => {
    let server: MockMCPServerFacade;

    afterEach(async () => {
      if (server) {
        await server.stop();
      }
    });

    it('should create working server from builder', async () => {
      server = builder
        .withName('integration-test')
        .withTool('echo')
        .withDynamicHandler(async (toolName, args) => ({
          content: [{ type: 'text', text: `Echo: ${args.message}` }],
          isError: false,
        }))
        .build();

      await server.start();
      expect(server.isStarted()).toBe(true);
    });

    it('should handle scenario switching', async () => {
      server = builder
        .withName('scenario-test')
        .withTool('test')
        .withStaticResponse([{ type: 'text', text: 'normal' }])
        .withScenario('error-mode', scenario =>
          scenario
            .withTool('test')
            .withStaticResponse([{ type: 'text', text: 'error mode' }], true)
        )
        .build();

      await server.start();

      // Default behavior
      expect(server.getActiveScenario()).toBeUndefined();

      // Switch to error mode
      server.activateScenario('error-mode');
      expect(server.getActiveScenario()).toBe('error-mode');

      // Reset to default
      server.resetToDefault();
      expect(server.getActiveScenario()).toBeUndefined();
    });

    it('should create multi-client server', async () => {
      const mockServer = builder
        .withName('multi-client-test')
        .withTool('ping')
        .withStaticResponse([{ type: 'text', text: 'pong' }])
        .buildServer();

      await mockServer.start();
      expect(mockServer.isListening()).toBe(true);

      // Should support multiple client transports
      const transport1 = mockServer.createClientTransport();
      const transport2 = mockServer.createClientTransport();

      expect(transport1).toBeDefined();
      expect(transport2).toBeDefined();
      expect(transport1).not.toBe(transport2);

      await mockServer.stop();
    });
  });

  describe('Error Handling', () => {
    it('should maintain builder state correctly across method calls', () => {
      // This tests that intermediate state doesn't interfere
      const definition = builder
        .withName('state-test')
        .withTool('tool1')
        .withStaticResponse([{ type: 'text', text: 'first' }])
        .withDelay(100)
        .withTool('tool2') // This should not affect tool1
        .withStaticResponse([{ type: 'text', text: 'second' }])
        .buildDefinition();

      expect(definition.defaultBehavior.toolHandlers).toHaveLength(2);
      expect(definition.defaultBehavior.responseDelay?.fixedMs).toBe(100);
    });

    it('should handle complex builder chains', () => {
      const definition = builder
        .withName('complex-test')
        .withTransport('http')
        .withCapabilities({ tools: { listChanged: true } })
        .withTool('complex')
        .withResponseSequence([
          { content: [{ type: 'text', text: 'step1' }] },
          { content: [{ type: 'text', text: 'step2' }], delayMs: 50 },
        ])
        .withDelay(200, 400, true)
        .withDelayForMethod('initialize', 10)
        .withErrorInjection({
          enabled: true,
          probability: 0.1,
          methods: ['tools/call'],
        })
        .withScenario('test-scenario', scenario => scenario
          .withTool('scenario-tool')
          .withStaticResponse([{ type: 'text', text: 'scenario response' }])
        )
        .withActiveScenario('test-scenario')
        .buildDefinition();

      expect(definition.serverConfig.name).toBe('complex-test');
      expect(definition.serverConfig.transport).toBe('http');
      expect(definition.defaultBehavior.responseSequences).toHaveLength(1);
      expect(definition.defaultBehavior.responseDelay?.minMs).toBe(200);
      expect(definition.defaultBehavior.responseDelay?.maxMs).toBe(400);
      expect(definition.defaultBehavior.responseDelay?.jitter).toBe(true);
      expect(definition.defaultBehavior.responseDelay?.perMethod?.initialize).toBe(10);
      expect(definition.defaultBehavior.errorInjection?.enabled).toBe(true);
      expect(definition.scenarios).toHaveLength(1);
      expect(definition.activeScenario).toBe('test-scenario');
    });
  });
});

describe('MockMCPServerBuilder Usage Examples', () => {
  it('should support the README example pattern', () => {
    const server = new MockMCPServerBuilder()
      .withName('test-filesystem')
      .withTool('read_file')
      .withStaticResponse([{ type: 'text', text: 'file content' }])
      .withTool('write_file')
      .withDynamicHandler(async (toolName, args) => ({
        content: [{ type: 'text', text: `Wrote to ${args.path}` }],
        isError: false,
      }))
      .withDelay(100, 200)
      .build();

    expect(server).toBeInstanceOf(MockMCPServerFacade);
  });

  it('should support factory pattern', () => {
    const server = createMockServerBuilder()
      .withName('factory-test')
      .withTool('ping')
      .withStaticResponse([{ type: 'text', text: 'pong' }])
      .build();

    expect(server).toBeInstanceOf(MockMCPServerFacade);
  });
});