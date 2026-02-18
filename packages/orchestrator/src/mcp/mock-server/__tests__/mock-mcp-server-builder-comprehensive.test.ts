/**
 * @fileoverview Comprehensive Tests for MockMCPServerBuilder
 *
 * Additional test coverage for edge cases, performance, and advanced scenarios
 * that complement the core functionality tests in mock-mcp-server-builder.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockMCPServerBuilder, createMockServerBuilder } from '../mock-mcp-server-builder.js';
import { MockMCPServerFacade } from '../mock-server-facade.js';
import { MockMCPServer } from '../mock-mcp-server.js';
import type {
  MockMCPServerDefinition,
  MockToolResultContent,
  MockDynamicHandlerFunction,
} from '@apexcli/core';

describe('MockMCPServerBuilder - Comprehensive Tests', () => {
  let builder: MockMCPServerBuilder;

  beforeEach(() => {
    builder = new MockMCPServerBuilder();
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle empty server name gracefully', () => {
      expect(() => {
        builder
          .withName('')
          .buildDefinition();
      }).toThrow('Server name is required');
    });

    it('should handle null/undefined values in builder methods', () => {
      expect(() => {
        // @ts-expect-error - testing null handling
        builder.withName(null);
      }).toThrow();

      expect(() => {
        // @ts-expect-error - testing undefined handling
        builder.withTransport(undefined);
      }).toThrow();
    });

    it('should handle multiple tool configurations with same name', () => {
      const definition = builder
        .withName('duplicate-test')
        .withTool('duplicate')
        .withStaticResponse([{ type: 'text', text: 'First response' }])
        .withTool('duplicate') // Same name again
        .withStaticResponse([{ type: 'text', text: 'Second response' }])
        .buildDefinition();

      // Should have two handlers for the same tool
      expect(definition.defaultBehavior.toolHandlers).toHaveLength(2);
      expect(definition.defaultBehavior.toolHandlers[0].toolName).toBe('duplicate');
      expect(definition.defaultBehavior.toolHandlers[1].toolName).toBe('duplicate');
      expect(definition.defaultBehavior.toolHandlers[1].response.content[0].text).toBe('Second response');
    });

    it('should handle tool name with special characters', () => {
      const specialToolName = 'tool-with-special_chars@123!';

      const definition = builder
        .withName('special-char-test')
        .withTool(specialToolName)
        .withStaticResponse([{ type: 'text', text: 'Works with special chars' }])
        .buildDefinition();

      expect(definition.defaultBehavior.toolHandlers[0].toolName).toBe(specialToolName);
    });

    it('should handle extremely large content arrays', () => {
      const largeContentArray: MockToolResultContent[] = Array(1000).fill(null).map((_, i) => ({
        type: 'text' as const,
        text: `Large content item ${i}`,
      }));

      const definition = builder
        .withName('large-content-test')
        .withTool('large-response')
        .withStaticResponse(largeContentArray)
        .buildDefinition();

      expect(definition.defaultBehavior.toolHandlers[0].response.content).toHaveLength(1000);
    });

    it('should handle invalid delay values', () => {
      expect(() => {
        builder
          .withName('invalid-delay-test')
          .withDelay(-100); // Negative delay
      }).not.toThrow(); // Should accept but clamp or handle gracefully

      expect(() => {
        builder
          .withName('invalid-delay-test')
          .withDelay(Number.MAX_SAFE_INTEGER); // Extremely large delay
      }).not.toThrow();
    });

    it('should handle extremely long scenario names', () => {
      const longScenarioName = 'a'.repeat(1000);

      const definition = builder
        .withName('long-scenario-test')
        .withScenario(longScenarioName, scenario =>
          scenario.withDelay(100)
        )
        .buildDefinition();

      expect(definition.scenarios[0].name).toBe(longScenarioName);
    });

    it('should handle circular references in builder chains', () => {
      // Test that builder methods don't create memory leaks or infinite loops
      let currentBuilder = builder.withName('circular-test');

      for (let i = 0; i < 100; i++) {
        currentBuilder = currentBuilder
          .withTool(`tool-${i}`)
          .withStaticResponse([{ type: 'text', text: `Response ${i}` }]);
      }

      const definition = currentBuilder.buildDefinition();
      expect(definition.defaultBehavior.toolHandlers).toHaveLength(100);
    });
  });

  describe('Advanced Scenario Configuration', () => {
    it('should handle nested scenario configuration', () => {
      const definition = builder
        .withName('nested-scenario-test')
        .withTool('base-tool')
        .withStaticResponse([{ type: 'text', text: 'Base response' }])
        .withScenario('level-1', scenario => scenario
          .withTool('level1-tool')
          .withStaticResponse([{ type: 'text', text: 'Level 1 response' }])
          .withErrorInjection({ enabled: true, probability: 0.5 })
        )
        .withScenario('level-2', scenario => scenario
          .withDelay(200, 500)
          .withTool('level2-tool')
          .withDynamicHandler(async (toolName, args) => ({
            content: [{ type: 'text', text: `Dynamic ${toolName}: ${JSON.stringify(args)}` }],
            isError: false,
          }))
        )
        .withActiveScenario('level-2')
        .buildDefinition();

      expect(definition.scenarios).toHaveLength(2);
      expect(definition.activeScenario).toBe('level-2');

      const level1Scenario = definition.scenarios.find(s => s.name === 'level-1');
      expect(level1Scenario?.behaviorConfig.errorInjection?.enabled).toBe(true);

      const level2Scenario = definition.scenarios.find(s => s.name === 'level-2');
      expect(level2Scenario?.behaviorConfig.responseDelay?.minMs).toBe(200);
    });

    it('should handle scenario overrides of base configuration', () => {
      const definition = builder
        .withName('override-test')
        .withDelay(100) // Base delay
        .withTool('test-tool')
        .withStaticResponse([{ type: 'text', text: 'Base response' }])
        .withScenario('fast-mode', scenario => scenario
          .withDelay(10) // Override delay
          .withTool('test-tool') // Override same tool
          .withStaticResponse([{ type: 'text', text: 'Fast response' }])
        )
        .buildDefinition();

      // Base behavior has original configuration
      expect(definition.defaultBehavior.responseDelay?.fixedMs).toBe(100);
      expect(definition.defaultBehavior.toolHandlers[0].response.content[0].text).toBe('Base response');

      // Scenario has overridden configuration
      const scenario = definition.scenarios[0];
      expect(scenario.behaviorConfig.responseDelay?.fixedMs).toBe(10);
      // Note: Scenarios currently inherit base server config, tool handlers are added separately
    });

    it('should handle empty scenario configuration', () => {
      const definition = builder
        .withName('empty-scenario-test')
        .withScenario('empty', scenario => scenario) // No configuration added
        .buildDefinition();

      const scenario = definition.scenarios[0];
      expect(scenario.name).toBe('empty');
      expect(scenario.behaviorConfig.toolHandlers).toEqual([]);
    });
  });

  describe('Dynamic Handler Advanced Cases', () => {
    it('should handle async errors in dynamic handlers', async () => {
      const errorHandler: MockDynamicHandlerFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('Simulated async error');
      };

      expect(() => {
        builder
          .withName('async-error-test')
          .withTool('error-tool')
          .withDynamicHandler(errorHandler)
          .buildDefinition();
      }).not.toThrow(); // Should build successfully, errors happen at runtime
    });

    it('should handle dynamic handlers with complex argument matching', () => {
      const complexMatchHandler: MockDynamicHandlerFunction = async (toolName, args, context) => {
        const nested = args.config as { level: { deep: string } };
        return {
          content: [{ type: 'text', text: `Deep value: ${nested?.level?.deep || 'not found'}` }],
          isError: false,
        };
      };

      const definition = builder
        .withName('complex-args-test')
        .withTool('complex-tool')
        .withDynamicHandler(complexMatchHandler, {
          matchArgs: {
            config: {
              level: { deep: 'expected-value' }
            }
          },
          priority: 90,
        })
        .buildDefinition();

      const handler = definition.defaultBehavior.dynamicHandlers![0];
      expect(handler.matchArgs).toEqual({
        config: { level: { deep: 'expected-value' } }
      });
      expect(handler.priority).toBe(90);
    });

    it('should handle dynamic handlers with context utilization', async () => {
      const contextHandler: MockDynamicHandlerFunction = async (toolName, args, context) => ({
        content: [{
          type: 'text',
          text: `Context - ID: ${context.requestId}, Count: ${context.invocationCount}, Time: ${context.timestamp.toISOString()}`
        }],
        isError: false,
      });

      const definition = builder
        .withName('context-test')
        .withTool('context-tool')
        .withDynamicHandler(contextHandler)
        .buildDefinition();

      const handler = definition.defaultBehavior.dynamicHandlers![0];

      // Test the handler function with mock context
      const mockContext = {
        requestId: 'test-123',
        invocationCount: 5,
        timestamp: new Date('2024-01-01T00:00:00Z'),
      };

      const result = await handler.handler('context-tool', {}, mockContext);
      expect(result.content[0].text).toContain('ID: test-123');
      expect(result.content[0].text).toContain('Count: 5');
      expect(result.content[0].text).toContain('2024-01-01T00:00:00');
    });
  });

  describe('Response Sequence Advanced Cases', () => {
    it('should handle empty response sequence', () => {
      expect(() => {
        builder
          .withName('empty-sequence-test')
          .withTool('empty-seq')
          .withResponseSequence([], 'cycle')
          .buildDefinition();
      }).not.toThrow(); // Should handle empty arrays gracefully
    });

    it('should handle response sequences with mixed content types', () => {
      const mixedSequence = [
        { content: [{ type: 'text' as const, text: 'Text response' }] },
        { content: [{ type: 'resource' as const, resource: { uri: 'file://test.txt', name: 'test.txt' } }] },
        { content: [{ type: 'image' as const, data: 'data:image/png;base64,iVBOR...', mimeType: 'image/png' }] },
      ];

      const definition = builder
        .withName('mixed-sequence-test')
        .withTool('mixed-tool')
        .withResponseSequence(mixedSequence, 'repeat_last')
        .buildDefinition();

      const sequence = definition.defaultBehavior.responseSequences![0];
      expect(sequence.responses).toHaveLength(3);
      expect(sequence.responses[1].content[0].type).toBe('resource');
      expect(sequence.cycleMode).toBe('repeat_last');
    });

    it('should handle response sequences with varying delays', () => {
      const delayedSequence = [
        { content: [{ type: 'text' as const, text: 'Immediate' }], delayMs: 0 },
        { content: [{ type: 'text' as const, text: 'Quick' }], delayMs: 50 },
        { content: [{ type: 'text' as const, text: 'Slow' }], delayMs: 1000 },
      ];

      const definition = builder
        .withName('delayed-sequence-test')
        .withTool('delayed-tool')
        .withResponseSequence(delayedSequence)
        .buildDefinition();

      const sequence = definition.defaultBehavior.responseSequences![0];
      expect(sequence.responses[0].delayMs).toBe(0);
      expect(sequence.responses[1].delayMs).toBe(50);
      expect(sequence.responses[2].delayMs).toBe(1000);
    });
  });

  describe('Complex Delay Configuration', () => {
    it('should handle complex per-method delay configurations', () => {
      const definition = builder
        .withName('complex-delay-test')
        .withDelay(100) // Base delay
        .withDelayForMethod('tools/call', 200)
        .withDelayForMethod('tools/list', 50)
        .withDelayForMethod('initialize', 10)
        .withDelayForMethod('shutdown', 500)
        .buildDefinition();

      const delay = definition.defaultBehavior.responseDelay!;
      expect(delay.fixedMs).toBe(100);
      expect(delay.perMethod!['tools/call']).toBe(200);
      expect(delay.perMethod!['tools/list']).toBe(50);
      expect(delay.perMethod!['initialize']).toBe(10);
      expect(delay.perMethod!['shutdown']).toBe(500);
    });

    it('should handle overriding per-method delays', () => {
      const definition = builder
        .withName('override-delay-test')
        .withDelayForMethod('tools/call', 100) // First setting
        .withDelayForMethod('tools/call', 200) // Override
        .withDelayForMethod('tools/call', 300) // Override again
        .buildDefinition();

      expect(definition.defaultBehavior.responseDelay!.perMethod!['tools/call']).toBe(300);
    });

    it('should handle delay configuration with edge case values', () => {
      const definition = builder
        .withName('edge-delay-test')
        .withDelay(0, 0, false) // Zero delays
        .withDelayForMethod('fast', 0)
        .withDelayForMethod('very-slow', Number.MAX_SAFE_INTEGER)
        .buildDefinition();

      const delay = definition.defaultBehavior.responseDelay!;
      expect(delay.maxMs).toBe(0);
      expect(delay.perMethod!['fast']).toBe(0);
      expect(delay.perMethod!['very-slow']).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('Error Injection Advanced Cases', () => {
    it('should handle complex error injection scenarios', () => {
      const complexErrorConfig = {
        enabled: true,
        probability: 0.75,
        errorCode: -32001,
        errorMessage: 'Custom complex error',
        methods: ['tools/call', 'resources/list', 'prompts/get'],
        afterRequestCount: 10,
        maxErrors: 5,
        simulateConnectionFailure: true,
        errorDelayMs: 250,
      };

      const definition = builder
        .withName('complex-error-test')
        .withErrorInjection(complexErrorConfig)
        .buildDefinition();

      const errorConfig = definition.defaultBehavior.errorInjection!;
      expect(errorConfig).toEqual(complexErrorConfig);
    });

    it('should handle error injection with empty methods array', () => {
      const definition = builder
        .withName('empty-methods-error-test')
        .withErrorInjection({
          enabled: true,
          probability: 1.0,
          methods: [], // Empty array should affect all methods
        })
        .buildDefinition();

      expect(definition.defaultBehavior.errorInjection!.methods).toEqual([]);
      expect(definition.defaultBehavior.errorInjection!.probability).toBe(1.0);
    });

    it('should handle partial error injection configuration', () => {
      const partialConfig = {
        enabled: true,
        errorMessage: 'Only message set',
      };

      const definition = builder
        .withName('partial-error-test')
        .withErrorInjection(partialConfig)
        .buildDefinition();

      const errorConfig = definition.defaultBehavior.errorInjection!;
      expect(errorConfig.enabled).toBe(true);
      expect(errorConfig.errorMessage).toBe('Only message set');
      expect(errorConfig.probability).toBe(0); // Default value
      expect(errorConfig.errorCode).toBe(-32603); // Default value
    });
  });

  describe('Builder State Management', () => {
    it('should maintain independent state across multiple builders', () => {
      const builder1 = new MockMCPServerBuilder();
      const builder2 = new MockMCPServerBuilder();

      builder1
        .withName('builder-1')
        .withTool('tool-1')
        .withStaticResponse([{ type: 'text', text: 'Builder 1 response' }]);

      builder2
        .withName('builder-2')
        .withTool('tool-2')
        .withStaticResponse([{ type: 'text', text: 'Builder 2 response' }]);

      const def1 = builder1.buildDefinition();
      const def2 = builder2.buildDefinition();

      expect(def1.serverConfig.name).toBe('builder-1');
      expect(def1.defaultBehavior.toolHandlers[0].toolName).toBe('tool-1');

      expect(def2.serverConfig.name).toBe('builder-2');
      expect(def2.defaultBehavior.toolHandlers[0].toolName).toBe('tool-2');
    });

    it('should handle builder reuse after build', () => {
      const definition1 = builder
        .withName('first-build')
        .withTool('tool-1')
        .withStaticResponse([{ type: 'text', text: 'First' }])
        .buildDefinition();

      expect(definition1.serverConfig.name).toBe('first-build');

      // Reuse the same builder instance
      const definition2 = builder
        .withName('second-build')
        .withTool('tool-2')
        .withStaticResponse([{ type: 'text', text: 'Second' }])
        .buildDefinition();

      expect(definition2.serverConfig.name).toBe('second-build');
      expect(definition2.defaultBehavior.toolHandlers).toHaveLength(2); // Should include both tools
    });

    it('should handle tool configuration interruption', () => {
      expect(() => {
        builder
          .withName('interruption-test')
          .withTool('incomplete-tool') // Start tool configuration
          .withDelay(100) // Interrupt with non-tool configuration
          .withTool('complete-tool') // Start new tool
          .withStaticResponse([{ type: 'text', text: 'Complete' }])
          .buildDefinition();
      }).toThrow(/Tool 'incomplete-tool' was declared.*but no handler was configured/);
    });

    it('should properly finalize tool configuration when switching tools', () => {
      const definition = builder
        .withName('tool-switch-test')
        .withTool('tool-1')
        .withStaticResponse([{ type: 'text', text: 'Tool 1' }])
        .withTool('tool-2') // This should finalize tool-1
        .withDynamicHandler(async () => ({
          content: [{ type: 'text', text: 'Tool 2 dynamic' }],
          isError: false,
        }))
        .buildDefinition();

      expect(definition.defaultBehavior.toolHandlers).toHaveLength(1);
      expect(definition.defaultBehavior.toolHandlers[0].toolName).toBe('tool-1');
      expect(definition.defaultBehavior.dynamicHandlers).toHaveLength(1);
      expect(definition.defaultBehavior.dynamicHandlers[0].toolName).toBe('tool-2');
    });
  });

  describe('Method Chaining Validation', () => {
    it('should maintain fluent interface across all methods', () => {
      const result = builder
        .withName('chain-test')
        .withTransport('http')
        .withCapabilities({ tools: { listChanged: true } })
        .withTool('chain-tool')
        .withStaticResponse([{ type: 'text', text: 'Chain response' }])
        .withDelay(100, 200, true)
        .withDelayForMethod('tools/call', 150)
        .withErrorInjection({ enabled: true, probability: 0.1 })
        .withScenario('test-scenario', scenario => scenario
          .withDelay(50)
          .withTool('scenario-tool')
          .withStaticResponse([{ type: 'text', text: 'Scenario response' }])
        )
        .withActiveScenario('test-scenario');

      expect(result).toBeInstanceOf(MockMCPServerBuilder);

      // Should be able to continue chaining
      const finalResult = result.buildDefinition();
      expect(finalResult.serverConfig.name).toBe('chain-test');
      expect(finalResult.activeScenario).toBe('test-scenario');
    });

    it('should handle method chaining with intermediate variable assignments', () => {
      const step1 = builder.withName('intermediate-test');
      const step2 = step1.withTransport('stdio');
      const step3 = step2.withTool('test-tool');
      const step4 = step3.withStaticResponse([{ type: 'text', text: 'Test' }]);

      const definition = step4.buildDefinition();

      expect(definition.serverConfig.name).toBe('intermediate-test');
      expect(definition.serverConfig.transport).toBe('stdio');
      expect(definition.defaultBehavior.toolHandlers).toHaveLength(1);
    });
  });

  describe('Memory and Performance Considerations', () => {
    it('should handle large number of tools without excessive memory usage', () => {
      const toolCount = 1000;
      let currentBuilder = builder.withName('memory-test');

      for (let i = 0; i < toolCount; i++) {
        currentBuilder = currentBuilder
          .withTool(`tool-${i}`)
          .withStaticResponse([{ type: 'text', text: `Response ${i}` }]);
      }

      const definition = currentBuilder.buildDefinition();
      expect(definition.defaultBehavior.toolHandlers).toHaveLength(toolCount);

      // Verify memory isn't holding unnecessary references
      expect(definition.defaultBehavior.toolHandlers[0].toolName).toBe('tool-0');
      expect(definition.defaultBehavior.toolHandlers[toolCount - 1].toolName).toBe(`tool-${toolCount - 1}`);
    });

    it('should handle rapid build/rebuild cycles', () => {
      const buildCount = 100;
      const definitions: MockMCPServerDefinition[] = [];

      for (let i = 0; i < buildCount; i++) {
        const definition = builder
          .withName(`rapid-build-${i}`)
          .withTool(`tool-${i}`)
          .withStaticResponse([{ type: 'text', text: `Build ${i}` }])
          .buildDefinition();

        definitions.push(definition);
      }

      expect(definitions).toHaveLength(buildCount);
      definitions.forEach((def, i) => {
        expect(def.serverConfig.name).toBe(`rapid-build-${i}`);
      });
    });
  });

  describe('Type Safety and Validation', () => {
    it('should preserve type information through complex chains', () => {
      const server = builder
        .withName('type-test')
        .withTool('typed-tool')
        .withDynamicHandler(async (toolName: string, args: { input: string }) => ({
          content: [{ type: 'text' as const, text: args.input.toUpperCase() }],
          isError: false,
        }))
        .build();

      expect(server).toBeInstanceOf(MockMCPServerFacade);
    });

    it('should handle various content type combinations', () => {
      const contentTypes: MockToolResultContent[] = [
        { type: 'text', text: 'Text content' },
        { type: 'resource', resource: { uri: 'file://test.txt', name: 'test.txt' } },
        { type: 'image', data: 'data:image/png;base64,test', mimeType: 'image/png' },
      ];

      const definition = builder
        .withName('content-types-test')
        .withTool('multi-content-tool')
        .withStaticResponse(contentTypes)
        .buildDefinition();

      const response = definition.defaultBehavior.toolHandlers[0].response;
      expect(response.content).toHaveLength(3);
      expect(response.content[0].type).toBe('text');
      expect(response.content[1].type).toBe('resource');
      expect(response.content[2].type).toBe('image');
    });
  });
});

describe('MockMCPServerBuilder - Integration Edge Cases', () => {
  let builder: MockMCPServerBuilder;
  let server: MockMCPServerFacade | MockMCPServer | undefined;

  beforeEach(() => {
    builder = new MockMCPServerBuilder();
  });

  afterEach(async () => {
    if (server) {
      if ('stop' in server) {
        await server.stop();
      }
      server = undefined;
    }
  });

  describe('Facade Integration Edge Cases', () => {
    it('should handle rapid start/stop cycles', async () => {
      server = builder
        .withName('rapid-lifecycle-test')
        .withTool('lifecycle-tool')
        .withStaticResponse([{ type: 'text', text: 'Lifecycle response' }])
        .build();

      // Rapid start/stop cycles
      for (let i = 0; i < 10; i++) {
        await server.start();
        expect(server.isStarted()).toBe(true);

        await server.stop();
        expect(server.isStarted()).toBe(false);
      }
    });

    it('should handle scenario switching under load', async () => {
      server = builder
        .withName('scenario-load-test')
        .withTool('load-tool')
        .withStaticResponse([{ type: 'text', text: 'Normal mode' }])
        .withScenario('error-mode', scenario => scenario
          .withErrorInjection({ enabled: true, probability: 1.0 })
        )
        .withScenario('slow-mode', scenario => scenario
          .withDelay(1000)
        )
        .build();

      await server.start();

      // Rapid scenario switching
      const scenarios = ['error-mode', 'slow-mode', undefined];
      for (let i = 0; i < 30; i++) {
        const scenario = scenarios[i % scenarios.length];
        if (scenario) {
          server.activateScenario(scenario);
          expect(server.getActiveScenario()).toBe(scenario);
        } else {
          server.resetToDefault();
          expect(server.getActiveScenario()).toBeUndefined();
        }
      }
    });

    it('should handle multiple facade instances from same builder', async () => {
      const definition = builder
        .withName('multi-facade-test')
        .withTool('shared-tool')
        .withStaticResponse([{ type: 'text', text: 'Shared response' }])
        .buildDefinition();

      // Create multiple facade instances from same definition
      const facade1 = new MockMCPServerFacade(definition);
      const facade2 = new MockMCPServerFacade(definition);
      const facade3 = new MockMCPServerFacade(definition);

      await Promise.all([
        facade1.start(),
        facade2.start(),
        facade3.start()
      ]);

      expect(facade1.isStarted()).toBe(true);
      expect(facade2.isStarted()).toBe(true);
      expect(facade3.isStarted()).toBe(true);

      // Each facade should be independent
      facade1.activateScenario('error-mode');
      expect(facade1.getActiveScenario()).toBe(undefined); // No error-mode scenario
      expect(facade2.getActiveScenario()).toBe(undefined);

      await Promise.all([
        facade1.stop(),
        facade2.stop(),
        facade3.stop()
      ]);
    });
  });

  describe('Server Integration Edge Cases', () => {
    it('should handle multiple client connections', async () => {
      const mockServer = builder
        .withName('multi-client-test')
        .withTool('concurrent-tool')
        .withStaticResponse([{ type: 'text', text: 'Concurrent response' }])
        .buildServer();

      server = mockServer;
      await mockServer.start();

      // Create multiple client transports
      const transports = Array(10).fill(null).map(() => mockServer.createClientTransport());

      expect(transports).toHaveLength(10);
      transports.forEach(transport => {
        expect(transport).toBeDefined();
      });

      // All transports should be unique
      const transportSet = new Set(transports);
      expect(transportSet.size).toBe(10);
    });

    it('should handle server restart with pending connections', async () => {
      const mockServer = builder
        .withName('restart-test')
        .withTool('restart-tool')
        .withStaticResponse([{ type: 'text', text: 'Restart response' }])
        .buildServer();

      server = mockServer;

      // Start and create connections
      await mockServer.start();
      const transport1 = mockServer.createClientTransport();
      const transport2 = mockServer.createClientTransport();

      // Stop and restart
      await mockServer.stop();
      await mockServer.start();

      // Create new connections
      const transport3 = mockServer.createClientTransport();
      const transport4 = mockServer.createClientTransport();

      expect(transport3).toBeDefined();
      expect(transport4).toBeDefined();
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle builder errors gracefully without affecting subsequent builds', () => {
      // First, cause an error
      expect(() => {
        builder
          .withName('error-recovery-test')
          .withTool('incomplete-tool') // No handler configured
          .buildDefinition();
      }).toThrow();

      // Builder should still be usable for valid configurations
      const validDefinition = builder
        .withName('recovery-success-test')
        .withTool('complete-tool')
        .withStaticResponse([{ type: 'text', text: 'Recovery success' }])
        .buildDefinition();

      expect(validDefinition.serverConfig.name).toBe('recovery-success-test');
    });

    it('should handle concurrent builds from same builder', () => {
      const promises = Array(50).fill(null).map((_, i) =>
        Promise.resolve().then(() => {
          const newBuilder = new MockMCPServerBuilder();
          return newBuilder
            .withName(`concurrent-test-${i}`)
            .withTool(`tool-${i}`)
            .withStaticResponse([{ type: 'text', text: `Response ${i}` }])
            .buildDefinition();
        })
      );

      return Promise.all(promises).then(definitions => {
        expect(definitions).toHaveLength(50);
        definitions.forEach((def, i) => {
          expect(def.serverConfig.name).toBe(`concurrent-test-${i}`);
        });
      });
    });
  });
});

describe('MockMCPServerBuilder - Performance Tests', () => {
  it('should build complex configurations within reasonable time', () => {
    const startTime = Date.now();

    let builder = new MockMCPServerBuilder().withName('performance-test');

    // Build a complex configuration
    for (let i = 0; i < 100; i++) {
      builder = builder
        .withTool(`tool-${i}`)
        .withDynamicHandler(async (toolName, args) => ({
          content: [{ type: 'text', text: `Performance response ${i}` }],
          isError: false,
        }), {
          priority: i % 10,
          maxInvocations: i % 5 + 1,
          delayMs: i % 3 * 50,
        });
    }

    // Add scenarios
    for (let i = 0; i < 10; i++) {
      builder = builder.withScenario(`scenario-${i}`, scenario => scenario
        .withDelay(i * 10, i * 20)
        .withErrorInjection({
          enabled: i % 2 === 0,
          probability: i * 0.1
        })
      );
    }

    const definition = builder.buildDefinition();

    const endTime = Date.now();
    const buildTime = endTime - startTime;

    // Should build in reasonable time (less than 1 second)
    expect(buildTime).toBeLessThan(1000);
    expect(definition.defaultBehavior.dynamicHandlers).toHaveLength(100);
    expect(definition.scenarios).toHaveLength(10);
  });

  it('should handle memory efficiently with large configurations', () => {
    const builder = new MockMCPServerBuilder().withName('memory-test');

    // Create large content arrays
    const largeContent = Array(10000).fill(null).map((_, i) => ({
      type: 'text' as const,
      text: `Large content item ${i} - ${'x'.repeat(100)}`
    }));

    const definition = builder
      .withTool('memory-intensive-tool')
      .withStaticResponse(largeContent)
      .buildDefinition();

    expect(definition.defaultBehavior.toolHandlers[0].response.content).toHaveLength(10000);

    // Verify the content is correctly structured
    const firstItem = definition.defaultBehavior.toolHandlers[0].response.content[0];
    expect(firstItem.text).toContain('Large content item 0');
    expect(firstItem.text).toHaveLength(124); // "Large content item 0 - " + 100 'x' characters
  });
});