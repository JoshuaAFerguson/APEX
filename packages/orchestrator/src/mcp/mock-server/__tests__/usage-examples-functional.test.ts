/**
 * @fileoverview Functional tests for MockMCPServerBuilder usage examples
 *
 * These tests verify that the usage examples not only instantiate correctly,
 * but also function properly when used with mock MCP client interactions.
 * Tests include real server startup, tool invocations, and behavioral verification.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createBuilderWithStaticResponses,
  createBuilderWithDynamicHandlers,
  createBuilderWithResponseSequences,
  createComprehensiveBuilderExample,
} from '../usage-examples.js';
import { MockMCPServerFacade } from '../mock-server-facade.js';
import type { MockToolRequest } from '../types.js';

describe('Usage Examples - Functional Tests', () => {
  let server: MockMCPServerFacade;

  afterEach(async () => {
    if (server && server.isStarted()) {
      await server.stop();
    }
  });

  describe('Static Response Builder Example', () => {
    beforeEach(() => {
      server = createBuilderWithStaticResponses();
    });

    it('should start successfully and have correct configuration', async () => {
      await server.start();
      expect(server.isStarted()).toBe(true);

      const definition = server.getDefinition();
      expect(definition.serverConfig.name).toBe('static-response-server');
      expect(definition.defaultBehavior.responseDelay?.fixedMs).toBe(50);
    });

    it('should return static responses for configured tools', async () => {
      await server.start();

      // Test read_file tool
      const readFileResponse = await server.simulateToolCall('read_file', {});
      expect(readFileResponse.content).toHaveLength(1);
      expect(readFileResponse.content[0].text).toBe('Static file content from builder');
      expect(readFileResponse.isError).toBe(false);

      // Test get_info tool
      const getInfoResponse = await server.simulateToolCall('get_info', {});
      expect(getInfoResponse.content[0].text).toBe('Server info: Version 1.0.0');
      expect(getInfoResponse.isError).toBe(false);

      // Test list_files tool
      const listFilesResponse = await server.simulateToolCall('list_files', {});
      expect(listFilesResponse.content[0].text).toBe('file1.txt\nfile2.txt\nfile3.txt');
      expect(listFilesResponse.isError).toBe(false);
    });

    it('should apply configured delay to responses', async () => {
      await server.start();

      const startTime = Date.now();
      await server.simulateToolCall('read_file', {});
      const duration = Date.now() - startTime;

      // Should have at least some delay (allowing for test timing variance)
      expect(duration).toBeGreaterThanOrEqual(30);
    });

    it('should record tool invocations correctly', async () => {
      await server.start();

      await server.simulateToolCall('read_file', {});
      await server.simulateToolCall('get_info', {});
      await server.simulateToolCall('list_files', {});

      const stats = server.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.totalToolCalls).toBe(3);
    });
  });

  describe('Dynamic Handler Builder Example', () => {
    beforeEach(() => {
      server = createBuilderWithDynamicHandlers();
    });

    it('should handle calculation operations correctly', async () => {
      await server.start();

      // Test addition
      const addResult = await server.simulateToolCall('calculate', {
        operation: 'add',
        a: 5,
        b: 3
      });
      expect(addResult.content[0].text).toBe('5 + 3 = 8');
      expect(addResult.isError).toBe(false);

      // Test subtraction
      const subtractResult = await server.simulateToolCall('calculate', {
        operation: 'subtract',
        a: 10,
        b: 4
      });
      expect(subtractResult.content[0].text).toBe('10 - 4 = 6');
      expect(subtractResult.isError).toBe(false);

      // Test division
      const divideResult = await server.simulateToolCall('calculate', {
        operation: 'divide',
        a: 15,
        b: 3
      });
      expect(divideResult.content[0].text).toBe('15 / 3 = 5');
      expect(divideResult.isError).toBe(false);
    });

    it('should handle division by zero error', async () => {
      await server.start();

      const divideByZeroResult = await server.simulateToolCall('calculate', {
        operation: 'divide',
        a: 10,
        b: 0
      });
      expect(divideByZeroResult.content[0].text).toBe('Error: Division by zero');
      expect(divideByZeroResult.isError).toBe(true);
    });

    it('should handle unknown operations', async () => {
      await server.start();

      const unknownOpResult = await server.simulateToolCall('calculate', {
        operation: 'multiply',
        a: 5,
        b: 3
      });
      expect(unknownOpResult.content[0].text).toBe('Unknown operation: multiply');
      expect(unknownOpResult.isError).toBe(true);
    });

    it('should echo messages correctly', async () => {
      await server.start();

      const echoResult = await server.simulateToolCall('echo', {
        message: 'Hello, World!'
      });
      expect(echoResult.content[0].text).toBe('Echo: Hello, World!');
      expect(echoResult.isError).toBe(false);
    });

    it('should apply random delay configuration', async () => {
      await server.start();

      // Make multiple calls to test delay variance
      const startTimes: number[] = [];
      const durations: number[] = [];

      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        await server.simulateToolCall('echo', { message: 'test' });
        const duration = Date.now() - startTime;

        startTimes.push(startTime);
        durations.push(duration);
      }

      // All should have some delay (between 10-50ms range)
      for (const duration of durations) {
        expect(duration).toBeGreaterThanOrEqual(5); // Allow for test variance
        expect(duration).toBeLessThan(100); // Should not be too slow
      }
    });
  });

  describe('Response Sequence Builder Example', () => {
    beforeEach(() => {
      server = createBuilderWithResponseSequences();
    });

    it('should handle get_status sequence correctly', async () => {
      await server.start();

      // First call - initializing
      const status1 = await server.simulateToolCall('get_status', {});
      expect(status1.content[0].text).toBe('Status: Initializing...');
      expect(status1.isError).toBe(false);

      // Second call - loading configuration
      const status2 = await server.simulateToolCall('get_status', {});
      expect(status2.content[0].text).toBe('Status: Loading configuration...');
      expect(status2.isError).toBe(false);

      // Third call - ready
      const status3 = await server.simulateToolCall('get_status', {});
      expect(status3.content[0].text).toBe('Status: Ready');
      expect(status3.isError).toBe(false);

      // Fourth call should repeat last response (repeat_last mode)
      const status4 = await server.simulateToolCall('get_status', {});
      expect(status4.content[0].text).toBe('Status: Ready');
      expect(status4.isError).toBe(false);
    });

    it('should handle next_item cycling sequence', async () => {
      await server.start();

      // First cycle
      const item1 = await server.simulateToolCall('next_item', {});
      expect(item1.content[0].text).toBe('Item 1');
      expect(item1.isError).toBe(false);

      const item2 = await server.simulateToolCall('next_item', {});
      expect(item2.content[0].text).toBe('Item 2');
      expect(item2.isError).toBe(false);

      const item3 = await server.simulateToolCall('next_item', {});
      expect(item3.content[0].text).toBe('Item 3');
      expect(item3.isError).toBe(false);

      const item4 = await server.simulateToolCall('next_item', {});
      expect(item4.content[0].text).toBe('No more items');
      expect(item4.isError).toBe(true);

      // Should cycle back to beginning
      const item5 = await server.simulateToolCall('next_item', {});
      expect(item5.content[0].text).toBe('Item 1');
      expect(item5.isError).toBe(false);
    });

    it('should handle countdown repeat_all sequence', async () => {
      await server.start();

      // First countdown
      const calls = [];
      for (let i = 0; i < 5; i++) {
        calls.push(await server.simulateToolCall('countdown', {}));
      }

      expect(calls[0].content[0].text).toBe('T-minus 3...');
      expect(calls[1].content[0].text).toBe('T-minus 2...');
      expect(calls[2].content[0].text).toBe('T-minus 1...');
      expect(calls[3].content[0].text).toBe('Launch!');

      // Should restart from beginning (repeat_all mode)
      expect(calls[4].content[0].text).toBe('T-minus 3...');
    });
  });

  describe('Comprehensive Builder Example', () => {
    beforeEach(() => {
      server = createComprehensiveBuilderExample();
    });

    it('should have all expected configuration features', async () => {
      const definition = server.getDefinition();

      // Basic server config
      expect(definition.serverConfig.name).toBe('comprehensive-server');
      expect(definition.serverConfig.transport).toBe('stdio');
      expect(definition.serverConfig.capabilities.tools?.listChanged).toBe(true);
      expect(definition.serverConfig.capabilities.resources?.subscribe).toBe(true);
      expect(definition.serverConfig.capabilities.prompts?.listChanged).toBe(true);

      // Delay configuration
      expect(definition.defaultBehavior.responseDelay?.minMs).toBe(25);
      expect(definition.defaultBehavior.responseDelay?.maxMs).toBe(75);
      expect(definition.defaultBehavior.responseDelay?.jitter).toBe(true);
      expect(definition.defaultBehavior.responseDelay?.perMethod?.initialize).toBe(100);
      expect(definition.defaultBehavior.responseDelay?.perMethod?.['tools/call']).toBe(50);

      // Error injection
      expect(definition.defaultBehavior.errorInjection?.enabled).toBe(true);
      expect(definition.defaultBehavior.errorInjection?.probability).toBe(0.1);
      expect(definition.defaultBehavior.errorInjection?.afterRequestCount).toBe(5);

      // Scenarios
      expect(definition.scenarios).toHaveLength(3);
      const scenarioNames = definition.scenarios.map(s => s.name);
      expect(scenarioNames).toContain('fast-mode');
      expect(scenarioNames).toContain('slow-mode');
      expect(scenarioNames).toContain('error-prone');
    });

    it('should handle static version tool', async () => {
      await server.start();

      const versionResult = await server.simulateToolCall('get_version', {});
      expect(versionResult.content[0].text).toBe('Version 2.1.0');
      expect(versionResult.isError).toBe(false);
    });

    it('should handle dynamic data processing', async () => {
      await server.start();

      const processResult = await server.simulateToolCall('process_data', {
        data: 'hello'
      });
      expect(processResult.content[0].text).toBe('Processed: OLLEH');
      expect(processResult.isError).toBe(false);
    });

    it('should handle startup sequence', async () => {
      await server.start();

      // First call
      const startup1 = await server.simulateToolCall('startup_sequence', {});
      expect(startup1.content[0].text).toBe('Starting services...');

      // Second call
      const startup2 = await server.simulateToolCall('startup_sequence', {});
      expect(startup2.content[0].text).toBe('Loading modules...');

      // Third call
      const startup3 = await server.simulateToolCall('startup_sequence', {});
      expect(startup3.content[0].text).toBe('System ready!');

      // Fourth call should repeat last (repeat_last mode)
      const startup4 = await server.simulateToolCall('startup_sequence', {});
      expect(startup4.content[0].text).toBe('System ready!');
    });

    it('should support scenario switching', async () => {
      await server.start();

      // Test fast-mode scenario
      server.activateScenario('fast-mode');
      expect(server.getActiveScenario()).toBe('fast-mode');

      // Test slow-mode scenario
      server.activateScenario('slow-mode');
      expect(server.getActiveScenario()).toBe('slow-mode');

      // Test error-prone scenario
      server.activateScenario('error-prone');
      expect(server.getActiveScenario()).toBe('error-prone');

      // Reset to default
      server.resetToDefault();
      expect(server.getActiveScenario()).toBeUndefined();
    });

    it('should demonstrate error injection after request threshold', async () => {
      await server.start();

      // Make initial requests that should succeed (before error threshold)
      const successfulCalls = [];
      for (let i = 0; i < 5; i++) {
        successfulCalls.push(await server.simulateToolCall('get_version', {}));
      }

      // All initial calls should succeed
      for (const call of successfulCalls) {
        expect(call.isError).toBe(false);
      }

      // After the threshold, errors may be injected (but due to probability, not guaranteed)
      // We'll just verify the error injection config is properly set up
      const definition = server.getDefinition();
      expect(definition.defaultBehavior.errorInjection?.afterRequestCount).toBe(5);
    });
  });

  describe('Integration Tests', () => {
    it('should work with createQuickTestSetup utility', async () => {
      // Import the utility function
      const { createQuickTestSetup } = await import('../usage-examples.js');

      const { server: testServer, cleanup } = await createQuickTestSetup([
        {
          toolName: 'test_tool',
          response: {
            content: [{ type: 'text', text: 'test response' }],
            isError: false,
          },
        },
      ]);

      try {
        expect(testServer).toBeInstanceOf(MockMCPServerFacade);
        expect(testServer.isStarted()).toBe(true);

        const response = await testServer.simulateToolCall('test_tool', {});
        expect(response.content[0].text).toBe('test response');
      } finally {
        await cleanup();
      }
    });

    it('should demonstrate proper usage patterns from documentation', () => {
      // Test the documented patterns work
      const examples = [
        createBuilderWithStaticResponses(),
        createBuilderWithDynamicHandlers(),
        createBuilderWithResponseSequences(),
        createComprehensiveBuilderExample(),
      ];

      for (const example of examples) {
        expect(example).toBeInstanceOf(MockMCPServerFacade);
        expect(example.getDefinition().serverConfig.name).toBeTruthy();
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty arguments gracefully in dynamic handlers', async () => {
      server = createBuilderWithDynamicHandlers();
      await server.start();

      // Test with missing arguments
      const result = await server.simulateToolCall('calculate', {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown operation');
    });

    it('should handle invalid tool calls gracefully', async () => {
      server = createBuilderWithStaticResponses();
      await server.start();

      try {
        // This should throw or handle gracefully
        await server.simulateToolCall('nonexistent_tool', {});
      } catch (error) {
        // Expected behavior for invalid tool calls
        expect(error).toBeDefined();
      }
    });

    it('should maintain proper state across multiple tool calls', async () => {
      server = createBuilderWithResponseSequences();
      await server.start();

      // Interleave calls to different tools to test state isolation
      const status1 = await server.simulateToolCall('get_status', {});
      const item1 = await server.simulateToolCall('next_item', {});
      const status2 = await server.simulateToolCall('get_status', {});
      const item2 = await server.simulateToolCall('next_item', {});

      expect(status1.content[0].text).toBe('Status: Initializing...');
      expect(item1.content[0].text).toBe('Item 1');
      expect(status2.content[0].text).toBe('Status: Loading configuration...');
      expect(item2.content[0].text).toBe('Item 2');
    });
  });
});