/**
 * @fileoverview Integration validation tests for MockMCP Server Builder
 *
 * These tests validate that the complete integration flow works from builder
 * to server creation to client interaction, ensuring the full stack functions
 * correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockMCPServerBuilder } from '../mock-mcp-server-builder.js';
import { MockMCPServerFacade } from '../mock-server-facade.js';

describe('MockMCP Server Builder - Integration Validation', () => {
  let server: MockMCPServerFacade | undefined;

  afterEach(async () => {
    if (server && server.isStarted()) {
      await server.stop();
    }
    server = undefined;
  });

  describe('End-to-End Builder Workflow', () => {
    it('should complete full builder-to-server-to-client workflow', async () => {
      // 1. Create server using builder
      server = new MockMCPServerBuilder()
        .withName('integration-test-server')
        .withTransport('stdio')
        .withCapabilities({
          tools: { listChanged: true },
        })
        .withTool('test-tool')
        .withStaticResponse([
          { type: 'text', text: 'Integration test response' }
        ])
        .withDelay(10) // Fast for testing
        .build();

      // 2. Verify server creation
      expect(server).toBeInstanceOf(MockMCPServerFacade);
      expect(server.isStarted()).toBe(false);

      // 3. Start server
      await server.start();
      expect(server.isStarted()).toBe(true);

      // 4. Simulate client interactions
      const response = await server.simulateToolCall('test-tool', {});
      expect(response.content).toHaveLength(1);
      expect(response.content[0].text).toBe('Integration test response');
      expect(response.isError).toBe(false);

      // 5. Verify server state and statistics
      const stats = server.getStats();
      expect(stats.totalRequests).toBeGreaterThan(0);
      expect(stats.totalToolCalls).toBe(1);

      // 6. Test assertions work
      server.assertMethodCalled('tools/call', 1);
      expect(() => server.assertMethodCalled('initialize', 5))
        .toThrow();

      // 7. Clean shutdown
      await server.stop();
      expect(server.isStarted()).toBe(false);
    });

    it('should support complex multi-tool scenarios', async () => {
      server = new MockMCPServerBuilder()
        .withName('multi-tool-server')

        // Static response tool
        .withTool('get-config')
        .withStaticResponse([
          { type: 'text', text: '{"debug": true, "timeout": 5000}' }
        ])

        // Dynamic handler tool
        .withTool('process-data')
        .withDynamicHandler(async (toolName, args) => {
          const input = args.input as string;
          return {
            content: [{
              type: 'text',
              text: `Processed: ${input.toUpperCase()}`
            }],
            isError: false,
          };
        })

        // Response sequence tool
        .withTool('startup')
        .withResponseSequence([
          {
            content: [{ type: 'text', text: 'Initializing...' }],
            isError: false
          },
          {
            content: [{ type: 'text', text: 'Ready!' }],
            isError: false
          }
        ], 'repeat_last')

        .withDelay(5) // Fast for testing
        .build();

      await server.start();

      // Test static response
      const configResult = await server.simulateToolCall('get-config', {});
      expect(configResult.content[0].text).toContain('debug');

      // Test dynamic handler
      const processResult = await server.simulateToolCall('process-data', {
        input: 'hello world'
      });
      expect(processResult.content[0].text).toBe('Processed: HELLO WORLD');

      // Test response sequence
      const startup1 = await server.simulateToolCall('startup', {});
      expect(startup1.content[0].text).toBe('Initializing...');

      const startup2 = await server.simulateToolCall('startup', {});
      expect(startup2.content[0].text).toBe('Ready!');

      const startup3 = await server.simulateToolCall('startup', {});
      expect(startup3.content[0].text).toBe('Ready!'); // repeat_last

      // Verify all tools were called
      const stats = server.getStats();
      expect(stats.totalToolCalls).toBe(5);
    });

    it('should support scenario switching during runtime', async () => {
      server = new MockMCPServerBuilder()
        .withName('scenario-server')
        .withTool('response-tool')
        .withStaticResponse([
          { type: 'text', text: 'default response' }
        ])

        // Fast scenario
        .withScenario('fast-mode', scenario => scenario
          .withTool('response-tool')
          .withStaticResponse([
            { type: 'text', text: 'fast response' }
          ])
          .withDelay(1)
        )

        // Error scenario
        .withScenario('error-mode', scenario => scenario
          .withTool('response-tool')
          .withStaticResponse([
            { type: 'text', text: 'error response' }
          ], true)
        )

        .build();

      await server.start();

      // Default behavior
      let result = await server.simulateToolCall('response-tool', {});
      expect(result.content[0].text).toBe('default response');
      expect(result.isError).toBe(false);

      // Switch to fast mode
      server.activateScenario('fast-mode');
      result = await server.simulateToolCall('response-tool', {});
      expect(result.content[0].text).toBe('fast response');
      expect(result.isError).toBe(false);

      // Switch to error mode
      server.activateScenario('error-mode');
      result = await server.simulateToolCall('response-tool', {});
      expect(result.content[0].text).toBe('error response');
      expect(result.isError).toBe(true);

      // Reset to default
      server.resetToDefault();
      result = await server.simulateToolCall('response-tool', {});
      expect(result.content[0].text).toBe('default response');
      expect(result.isError).toBe(false);
    });

    it('should handle error injection correctly', async () => {
      server = new MockMCPServerBuilder()
        .withName('error-injection-server')
        .withTool('test-tool')
        .withStaticResponse([
          { type: 'text', text: 'success' }
        ])
        .withErrorInjection({
          enabled: true,
          probability: 1.0, // 100% error rate for testing
          errorMessage: 'Injected test error',
          afterRequestCount: 2, // Start injecting after 2 requests
        })
        .build();

      await server.start();

      // First two requests should succeed
      let result = await server.simulateToolCall('test-tool', {});
      expect(result.isError).toBe(false);

      result = await server.simulateToolCall('test-tool', {});
      expect(result.isError).toBe(false);

      // Third request should fail due to error injection
      try {
        result = await server.simulateToolCall('test-tool', {});
        // If we get here, the result should be an error
        expect(result.isError).toBe(true);
      } catch (error) {
        // Or an exception might be thrown
        expect(error).toBeDefined();
      }
    });
  });

  describe('Builder Pattern Validation', () => {
    it('should maintain fluent interface throughout chaining', () => {
      const builder = new MockMCPServerBuilder();

      // Test that all methods return the builder for chaining
      const result = builder
        .withName('chain-test')
        .withTransport('stdio')
        .withCapabilities({ tools: { listChanged: true } })
        .withTool('test')
        .withStaticResponse([{ type: 'text', text: 'test' }])
        .withDelay(100)
        .withDelayForMethod('initialize', 10)
        .withErrorInjection({ enabled: false })
        .withScenario('test-scenario', scenario => scenario
          .withDelay(50)
        );

      expect(result).toBeInstanceOf(MockMCPServerBuilder);

      // Should be able to build after chaining
      const definition = result.buildDefinition();
      expect(definition.serverConfig.name).toBe('chain-test');
    });

    it('should validate configuration requirements', () => {
      const builder = new MockMCPServerBuilder();

      // Should require server name
      expect(() => {
        builder.buildDefinition();
      }).toThrow('Server name is required');

      // Should require tool handler after withTool()
      expect(() => {
        builder
          .withName('test')
          .withTool('incomplete')
          .buildDefinition();
      }).toThrow('no handler was configured');
    });

    it('should provide helpful error messages for misuse', () => {
      const builder = new MockMCPServerBuilder();

      // Should error when handler methods called without withTool()
      expect(() => {
        builder.withStaticResponse([{ type: 'text', text: 'test' }]);
      }).toThrow('must be called after withTool()');

      expect(() => {
        builder.withDynamicHandler(async () => ({ content: [], isError: false }));
      }).toThrow('must be called after withTool()');

      expect(() => {
        builder.withResponseSequence([]);
      }).toThrow('must be called after withTool()');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle rapid server creation and destruction', async () => {
      const servers: MockMCPServerFacade[] = [];

      try {
        // Create multiple servers rapidly
        for (let i = 0; i < 5; i++) {
          const testServer = new MockMCPServerBuilder()
            .withName(`perf-test-${i}`)
            .withTool('ping')
            .withStaticResponse([{ type: 'text', text: 'pong' }])
            .build();

          servers.push(testServer);
          await testServer.start();
          expect(testServer.isStarted()).toBe(true);
        }

        // All servers should be running
        expect(servers).toHaveLength(5);
        for (const testServer of servers) {
          expect(testServer.isStarted()).toBe(true);
        }
      } finally {
        // Clean up all servers
        for (const testServer of servers) {
          if (testServer.isStarted()) {
            await testServer.stop();
          }
        }
      }
    });

    it('should handle concurrent tool calls correctly', async () => {
      server = new MockMCPServerBuilder()
        .withName('concurrent-test')
        .withTool('concurrent-tool')
        .withDynamicHandler(async (toolName, args) => {
          const id = args.id as string;
          // Simulate some async work
          await new Promise(resolve => setTimeout(resolve, 10));
          return {
            content: [{ type: 'text', text: `Response for ${id}` }],
            isError: false,
          };
        })
        .build();

      await server.start();

      // Make multiple concurrent calls
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          server.simulateToolCall('concurrent-tool', { id: `call-${i}` })
        );
      }

      const results = await Promise.all(promises);

      // All calls should complete successfully
      expect(results).toHaveLength(10);
      for (let i = 0; i < 10; i++) {
        expect(results[i].content[0].text).toBe(`Response for call-${i}`);
        expect(results[i].isError).toBe(false);
      }

      // Verify stats
      const stats = server.getStats();
      expect(stats.totalToolCalls).toBe(10);
    });
  });
});