/**
 * @fileoverview Integration Tests for MockMCPServerBuilder
 *
 * Tests that verify the builder correctly integrates with MockMCPServer and MockMCPServerFacade,
 * ensuring the configurations translate to working server behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockMCPServerBuilder, createMockServerBuilder } from '../mock-mcp-server-builder.js';
import { MockMCPServerFacade } from '../mock-server-facade.js';
import { MockMCPServer } from '../mock-mcp-server.js';
import type {
  MockDynamicHandlerFunction,
} from '@apexcli/core';

describe('MockMCPServerBuilder - Real Integration Tests', () => {
  let server: MockMCPServerFacade | MockMCPServer | undefined;

  afterEach(async () => {
    if (server) {
      if ('stop' in server) {
        await server.stop();
      }
      server = undefined;
    }
  });

  describe('Facade Integration', () => {
    it('should create a working facade with static tool responses', async () => {
      server = new MockMCPServerBuilder()
        .withName('facade-static-test')
        .withTool('ping')
        .withStaticResponse([{ type: 'text', text: 'pong' }])
        .withTool('echo')
        .withStaticResponse([{ type: 'text', text: 'echo response' }])
        .build();

      expect(server).toBeInstanceOf(MockMCPServerFacade);

      await server.start();
      expect(server.isStarted()).toBe(true);

      // Test transport is created and accessible
      const transport = server.getTransport();
      expect(transport).toBeDefined();
      expect(transport.isConnected()).toBe(false); // Not connected initially

      // Test server stats
      const stats = server.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.currentState).toBeDefined();
    });

    it('should handle dynamic tool responses correctly', async () => {
      const dynamicHandler: MockDynamicHandlerFunction = vi.fn().mockImplementation(
        async (toolName: string, args: Record<string, unknown>) => ({
          content: [{ type: 'text', text: `Dynamic ${toolName}: ${JSON.stringify(args)}` }],
          isError: false,
        })
      );

      server = new MockMCPServerBuilder()
        .withName('facade-dynamic-test')
        .withTool('dynamic-tool')
        .withDynamicHandler(dynamicHandler, {
          maxInvocations: 3,
          priority: 75,
        })
        .build();

      await server.start();

      // Verify the handler is configured correctly in the facade
      const definition = (server as any).definition;
      expect(definition.defaultBehavior.dynamicHandlers).toHaveLength(1);
      expect(definition.defaultBehavior.dynamicHandlers[0].maxInvocations).toBe(3);
      expect(definition.defaultBehavior.dynamicHandlers[0].priority).toBe(75);
    });

    it('should manage scenarios correctly through facade', async () => {
      server = new MockMCPServerBuilder()
        .withName('facade-scenario-test')
        .withTool('normal-tool')
        .withStaticResponse([{ type: 'text', text: 'normal response' }])
        .withScenario('error-scenario', scenario =>
          scenario
            .withTool('error-tool')
            .withStaticResponse([{ type: 'text', text: 'error response' }], true)
            .withErrorInjection({ enabled: true, probability: 0.8 })
        )
        .withScenario('slow-scenario', scenario =>
          scenario
            .withDelay(500, 1000)
            .withTool('slow-tool')
            .withStaticResponse([{ type: 'text', text: 'slow response' }])
        )
        .withActiveScenario('slow-scenario')
        .build();

      await server.start();

      // Test initial active scenario
      expect(server.getActiveScenario()).toBe('slow-scenario');

      // Test scenario switching
      const availableScenarios = server.getAvailableScenarios();
      expect(availableScenarios).toContain('error-scenario');
      expect(availableScenarios).toContain('slow-scenario');

      server.activateScenario('error-scenario');
      expect(server.getActiveScenario()).toBe('error-scenario');

      server.resetToDefault();
      expect(server.getActiveScenario()).toBeUndefined();
    });

    it('should handle response sequences through facade', async () => {
      server = new MockMCPServerBuilder()
        .withName('facade-sequence-test')
        .withTool('sequence-tool')
        .withResponseSequence([
          { content: [{ type: 'text', text: 'First' }] },
          { content: [{ type: 'text', text: 'Second' }], delayMs: 100 },
          { content: [{ type: 'text', text: 'Third' }], isError: true },
        ], 'stop_at_end')
        .build();

      await server.start();

      const definition = (server as any).definition;
      expect(definition.defaultBehavior.responseSequences).toHaveLength(1);

      const sequence = definition.defaultBehavior.responseSequences[0];
      expect(sequence.toolName).toBe('sequence-tool');
      expect(sequence.responses).toHaveLength(3);
      expect(sequence.cycleMode).toBe('stop_at_end');
      expect(sequence.responses[2].isError).toBe(true);
    });

    it('should handle complex delay configurations through facade', async () => {
      server = new MockMCPServerBuilder()
        .withName('facade-delay-test')
        .withDelay(200, 400, true) // Random delay with jitter
        .withDelayForMethod('tools/call', 100)
        .withDelayForMethod('initialize', 50)
        .withTool('delayed-tool')
        .withStaticResponse([{ type: 'text', text: 'delayed response' }])
        .build();

      await server.start();

      const definition = (server as any).definition;
      const delayConfig = definition.defaultBehavior.responseDelay;

      expect(delayConfig.minMs).toBe(200);
      expect(delayConfig.maxMs).toBe(400);
      expect(delayConfig.jitter).toBe(true);
      expect(delayConfig.perMethod['tools/call']).toBe(100);
      expect(delayConfig.perMethod['initialize']).toBe(50);
    });

    it('should support facade assertions', async () => {
      server = new MockMCPServerBuilder()
        .withName('facade-assertion-test')
        .withTool('test-tool')
        .withStaticResponse([{ type: 'text', text: 'test response' }])
        .build();

      await server.start();

      // Test empty history initially
      const initialHistory = server.getRequestHistory();
      expect(initialHistory).toHaveLength(0);

      // Test stats
      const stats = server.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalErrorsInjected).toBe(0);
      expect(stats.uptimeMs).toBeGreaterThan(0);
    });

    it('should handle facade reset correctly', async () => {
      server = new MockMCPServerBuilder()
        .withName('facade-reset-test')
        .withTool('reset-tool')
        .withStaticResponse([{ type: 'text', text: 'reset response' }])
        .withScenario('test-scenario', scenario => scenario.withDelay(100))
        .build();

      await server.start();
      server.activateScenario('test-scenario');

      expect(server.getActiveScenario()).toBe('test-scenario');

      await server.reset();

      expect(server.isStarted()).toBe(false);
      expect(server.getActiveScenario()).toBeUndefined();
    });
  });

  describe('MockMCPServer Integration', () => {
    it('should create a working MockMCPServer', async () => {
      const mockServer = new MockMCPServerBuilder()
        .withName('server-test')
        .withTool('server-tool')
        .withStaticResponse([{ type: 'text', text: 'server response' }])
        .buildServer();

      server = mockServer;
      expect(mockServer).toBeInstanceOf(MockMCPServer);

      await mockServer.start();
      expect(mockServer.isListening()).toBe(true);

      // Test multiple client transports
      const transport1 = mockServer.createClientTransport();
      const transport2 = mockServer.createClientTransport();

      expect(transport1).toBeDefined();
      expect(transport2).toBeDefined();
      expect(transport1).not.toBe(transport2);
    });

    it('should handle server lifecycle correctly', async () => {
      const mockServer = new MockMCPServerBuilder()
        .withName('server-lifecycle-test')
        .withTool('lifecycle-tool')
        .withStaticResponse([{ type: 'text', text: 'lifecycle response' }])
        .buildServer();

      server = mockServer;

      // Initially not listening
      expect(mockServer.isListening()).toBe(false);

      // Start server
      await mockServer.start();
      expect(mockServer.isListening()).toBe(true);

      // Stop server
      await mockServer.stop();
      expect(mockServer.isListening()).toBe(false);
    });

    it('should handle complex server configurations', async () => {
      const complexHandler: MockDynamicHandlerFunction = async (toolName, args, context) => {
        return {
          content: [{
            type: 'text',
            text: `Complex: ${toolName}, Args: ${Object.keys(args).length}, Count: ${context.invocationCount}`
          }],
          isError: false,
        };
      };

      const mockServer = new MockMCPServerBuilder()
        .withName('complex-server-test')
        .withTransport('stdio')
        .withCapabilities({
          tools: { listChanged: true },
          resources: { subscribe: true },
        })
        .withTool('simple-tool')
        .withStaticResponse([{ type: 'text', text: 'simple' }])
        .withTool('complex-tool')
        .withDynamicHandler(complexHandler, {
          matchArgs: { type: 'complex' },
          priority: 90,
          maxInvocations: 10,
        })
        .withTool('sequence-tool')
        .withResponseSequence([
          { content: [{ type: 'text', text: 'seq1' }] },
          { content: [{ type: 'text', text: 'seq2' }], delayMs: 50 },
        ])
        .withDelay(100, 200)
        .withDelayForMethod('tools/call', 150)
        .withErrorInjection({
          enabled: true,
          probability: 0.1,
          methods: ['tools/call'],
          errorMessage: 'Complex server error',
        })
        .buildServer();

      server = mockServer;

      await mockServer.start();
      expect(mockServer.isListening()).toBe(true);

      // Verify complex configuration is applied
      const definition = (mockServer as any).definition;
      expect(definition.serverConfig.transport).toBe('stdio');
      expect(definition.serverConfig.capabilities.tools.listChanged).toBe(true);
      expect(definition.serverConfig.capabilities.resources.subscribe).toBe(true);

      expect(definition.defaultBehavior.toolHandlers).toHaveLength(2); // simple + sequence
      expect(definition.defaultBehavior.dynamicHandlers).toHaveLength(1);
      expect(definition.defaultBehavior.responseSequences).toHaveLength(1);

      expect(definition.defaultBehavior.responseDelay.minMs).toBe(100);
      expect(definition.defaultBehavior.responseDelay.maxMs).toBe(200);
      expect(definition.defaultBehavior.responseDelay.perMethod['tools/call']).toBe(150);

      expect(definition.defaultBehavior.errorInjection.enabled).toBe(true);
      expect(definition.defaultBehavior.errorInjection.probability).toBe(0.1);
    });

    it('should handle server with scenarios', async () => {
      const mockServer = new MockMCPServerBuilder()
        .withName('server-scenario-test')
        .withTool('base-tool')
        .withStaticResponse([{ type: 'text', text: 'base' }])
        .withScenario('error-mode', scenario =>
          scenario
            .withErrorInjection({ enabled: true, probability: 1.0 })
            .withTool('error-tool')
            .withStaticResponse([{ type: 'text', text: 'error mode' }], true)
        )
        .withScenario('fast-mode', scenario =>
          scenario
            .withDelay(10)
            .withTool('fast-tool')
            .withStaticResponse([{ type: 'text', text: 'fast mode' }])
        )
        .withActiveScenario('fast-mode')
        .buildServer();

      server = mockServer;

      await mockServer.start();

      const definition = (mockServer as any).definition;
      expect(definition.scenarios).toHaveLength(2);
      expect(definition.activeScenario).toBe('fast-mode');

      const errorScenario = definition.scenarios.find((s: any) => s.name === 'error-mode');
      expect(errorScenario.behaviorConfig.errorInjection.probability).toBe(1.0);

      const fastScenario = definition.scenarios.find((s: any) => s.name === 'fast-mode');
      expect(fastScenario.behaviorConfig.responseDelay.fixedMs).toBe(10);
    });
  });

  describe('Factory Functions Integration', () => {
    it('should work with createMockServerBuilder factory', async () => {
      server = createMockServerBuilder()
        .withName('factory-test')
        .withTool('factory-tool')
        .withStaticResponse([{ type: 'text', text: 'factory response' }])
        .build();

      expect(server).toBeInstanceOf(MockMCPServerFacade);

      await server.start();
      expect(server.isStarted()).toBe(true);

      const stats = server.getStats();
      expect(stats.currentState).toBeDefined();
    });

    it('should handle chained factory usage', async () => {
      const builder1 = createMockServerBuilder();
      const builder2 = createMockServerBuilder();

      server = builder1
        .withName('factory-chain-test-1')
        .withTool('tool1')
        .withStaticResponse([{ type: 'text', text: 'response1' }])
        .build();

      const server2 = builder2
        .withName('factory-chain-test-2')
        .withTool('tool2')
        .withStaticResponse([{ type: 'text', text: 'response2' }])
        .build();

      await Promise.all([server.start(), server2.start()]);

      expect(server.isStarted()).toBe(true);
      expect(server2.isStarted()).toBe(true);

      await server2.stop();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid scenario activation gracefully', async () => {
      server = new MockMCPServerBuilder()
        .withName('error-scenario-test')
        .withTool('test-tool')
        .withStaticResponse([{ type: 'text', text: 'test' }])
        .withScenario('valid-scenario', scenario => scenario.withDelay(100))
        .build();

      await server.start();

      expect(() => {
        server.activateScenario('nonexistent-scenario');
      }).toThrow(/Scenario 'nonexistent-scenario' not found/);

      // Server should still work after error
      expect(server.isStarted()).toBe(true);
    });

    it('should handle server stop with no start', async () => {
      server = new MockMCPServerBuilder()
        .withName('stop-without-start-test')
        .withTool('test-tool')
        .withStaticResponse([{ type: 'text', text: 'test' }])
        .build();

      // Stop without start should not throw
      await expect(server.stop()).resolves.toBeUndefined();
      expect(server.isStarted()).toBe(false);
    });

    it('should handle multiple stop calls', async () => {
      server = new MockMCPServerBuilder()
        .withName('multiple-stop-test')
        .withTool('test-tool')
        .withStaticResponse([{ type: 'text', text: 'test' }])
        .build();

      await server.start();
      expect(server.isStarted()).toBe(true);

      // Multiple stops should not throw
      await server.stop();
      await server.stop();
      await server.stop();

      expect(server.isStarted()).toBe(false);
    });
  });

  describe('Real-world Usage Patterns', () => {
    it('should support test setup and teardown patterns', async () => {
      // Simulate common test pattern
      const setupServer = () => new MockMCPServerBuilder()
        .withName('test-pattern-server')
        .withTool('read_file')
        .withDynamicHandler(async (toolName, args) => {
          const path = args.path as string;
          if (!path) {
            return {
              content: [{ type: 'text', text: 'Path required' }],
              isError: true,
            };
          }
          return {
            content: [{ type: 'text', text: `Content of ${path}` }],
            isError: false,
          };
        })
        .withTool('write_file')
        .withStaticResponse([{ type: 'text', text: 'File written successfully' }])
        .withScenario('error-mode', scenario =>
          scenario.withErrorInjection({ enabled: true, probability: 0.5 })
        );

      server = setupServer().build();

      await server.start();

      // Test normal operation
      expect(server.isStarted()).toBe(true);

      // Test scenario switching for different test cases
      server.activateScenario('error-mode');
      expect(server.getActiveScenario()).toBe('error-mode');

      server.resetToDefault();
      expect(server.getActiveScenario()).toBeUndefined();

      // Cleanup
      await server.stop();
    });

    it('should support mocking complex MCP server interactions', async () => {
      server = new MockMCPServerBuilder()
        .withName('complex-interaction-test')
        .withCapabilities({
          tools: { listChanged: true },
          resources: { subscribe: true, listChanged: true },
          prompts: { listChanged: true },
        })
        .withTool('list_files')
        .withDynamicHandler(async (toolName, args) => {
          const directory = args.directory as string || '/';
          const files = ['file1.txt', 'file2.txt', 'subdirectory/'];
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                directory,
                files: files.map(name => ({ name, type: name.endsWith('/') ? 'directory' : 'file' }))
              })
            }],
            isError: false,
          };
        })
        .withTool('read_file')
        .withResponseSequence([
          {
            content: [{ type: 'text', text: '# Loading file...' }],
            delayMs: 100
          },
          {
            content: [{ type: 'text', text: 'File content loaded successfully' }],
            delayMs: 50
          }
        ], 'repeat_last')
        .withTool('search')
        .withDynamicHandler(async (toolName, args) => {
          const query = args.query as string;
          const results = query ? [`Result 1 for "${query}"`, `Result 2 for "${query}"`] : [];
          return {
            content: [{ type: 'text', text: JSON.stringify({ query, results }) }],
            isError: !query,
          };
        })
        .withDelay(50, 150, true) // Realistic network latency
        .withDelayForMethod('initialize', 20) // Fast initialization
        .withScenario('slow-network', scenario =>
          scenario.withDelay(500, 2000)
        )
        .withScenario('unreliable-network', scenario =>
          scenario.withErrorInjection({
            enabled: true,
            probability: 0.3,
            methods: ['tools/call'],
            errorMessage: 'Network timeout',
          })
        )
        .build();

      await server.start();

      // Verify complex configuration
      expect(server.isStarted()).toBe(true);

      const stats = server.getStats();
      expect(stats.currentState).toBeDefined();

      // Test scenario switching for different network conditions
      server.activateScenario('slow-network');
      expect(server.getActiveScenario()).toBe('slow-network');

      server.activateScenario('unreliable-network');
      expect(server.getActiveScenario()).toBe('unreliable-network');
    });
  });
});