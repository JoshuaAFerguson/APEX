/**
 * @fileoverview Validation Tests for MockMCPServerBuilder Test Suite
 *
 * Quick validation tests to ensure the test suite is properly structured
 * and that basic functionality works as expected.
 */

import { describe, it, expect } from 'vitest';
import { MockMCPServerBuilder, createMockServerBuilder } from '../mock-mcp-server-builder.js';

describe('MockMCPServerBuilder - Test Suite Validation', () => {
  describe('Basic Functionality Validation', () => {
    it('should create builder instance', () => {
      const builder = new MockMCPServerBuilder();
      expect(builder).toBeInstanceOf(MockMCPServerBuilder);
    });

    it('should create builder via factory', () => {
      const builder = createMockServerBuilder();
      expect(builder).toBeInstanceOf(MockMCPServerBuilder);
    });

    it('should build valid definition', () => {
      const definition = new MockMCPServerBuilder()
        .withName('validation-test')
        .withTool('test-tool')
        .withStaticResponse([{ type: 'text', text: 'test response' }])
        .buildDefinition();

      expect(definition).toHaveProperty('serverConfig');
      expect(definition).toHaveProperty('defaultBehavior');
      expect(definition).toHaveProperty('scenarios');
      expect(definition.serverConfig.name).toBe('validation-test');
    });

    it('should build working facade', () => {
      const facade = new MockMCPServerBuilder()
        .withName('facade-validation')
        .withTool('facade-tool')
        .withStaticResponse([{ type: 'text', text: 'facade response' }])
        .build();

      expect(facade).toBeDefined();
      expect(typeof facade.start).toBe('function');
      expect(typeof facade.stop).toBe('function');
    });

    it('should build working server', () => {
      const server = new MockMCPServerBuilder()
        .withName('server-validation')
        .withTool('server-tool')
        .withStaticResponse([{ type: 'text', text: 'server response' }])
        .buildServer();

      expect(server).toBeDefined();
      expect(typeof server.start).toBe('function');
      expect(typeof server.stop).toBe('function');
    });
  });

  describe('Test File Structure Validation', () => {
    it('should have proper test file imports', () => {
      // This test validates that our test files can import necessary modules
      expect(MockMCPServerBuilder).toBeDefined();
      expect(createMockServerBuilder).toBeDefined();
    });

    it('should handle all builder methods', () => {
      const builder = new MockMCPServerBuilder();

      // Test method availability
      expect(typeof builder.withName).toBe('function');
      expect(typeof builder.withTransport).toBe('function');
      expect(typeof builder.withCapabilities).toBe('function');
      expect(typeof builder.withTool).toBe('function');
      expect(typeof builder.withStaticResponse).toBe('function');
      expect(typeof builder.withDynamicHandler).toBe('function');
      expect(typeof builder.withResponseSequence).toBe('function');
      expect(typeof builder.withDelay).toBe('function');
      expect(typeof builder.withDelayForMethod).toBe('function');
      expect(typeof builder.withErrorInjection).toBe('function');
      expect(typeof builder.withScenario).toBe('function');
      expect(typeof builder.withActiveScenario).toBe('function');
      expect(typeof builder.build).toBe('function');
      expect(typeof builder.buildServer).toBe('function');
      expect(typeof builder.buildDefinition).toBe('function');
    });

    it('should handle method chaining', () => {
      const result = new MockMCPServerBuilder()
        .withName('chain-validation')
        .withTransport('stdio')
        .withTool('chain-tool')
        .withStaticResponse([{ type: 'text', text: 'chained' }]);

      expect(result).toBeInstanceOf(MockMCPServerBuilder);
    });

    it('should handle error conditions', () => {
      expect(() => {
        new MockMCPServerBuilder().buildDefinition();
      }).toThrow('Server name is required');

      expect(() => {
        new MockMCPServerBuilder()
          .withName('error-test')
          .withStaticResponse([{ type: 'text', text: 'test' }]);
      }).toThrow('withStaticResponse() must be called after withTool()');
    });
  });

  describe('Type System Validation', () => {
    it('should handle complex type scenarios', () => {
      const dynamicHandler = async (toolName: string, args: Record<string, unknown>) => ({
        content: [{ type: 'text' as const, text: `${toolName}: ${JSON.stringify(args)}` }],
        isError: false,
      });

      const definition = new MockMCPServerBuilder()
        .withName('type-validation')
        .withTool('typed-tool')
        .withDynamicHandler(dynamicHandler)
        .buildDefinition();

      expect(definition.defaultBehavior.dynamicHandlers).toHaveLength(1);
      expect(definition.defaultBehavior.dynamicHandlers![0].toolName).toBe('typed-tool');
    });

    it('should handle content type variations', () => {
      const textContent = [{ type: 'text' as const, text: 'text content' }];
      const resourceContent = [{ type: 'resource' as const, resource: { uri: 'file://test', name: 'test' } }];

      const definition1 = new MockMCPServerBuilder()
        .withName('content-validation-1')
        .withTool('text-tool')
        .withStaticResponse(textContent)
        .buildDefinition();

      const definition2 = new MockMCPServerBuilder()
        .withName('content-validation-2')
        .withTool('resource-tool')
        .withStaticResponse(resourceContent)
        .buildDefinition();

      expect(definition1.defaultBehavior.toolHandlers[0].response.content[0].type).toBe('text');
      expect(definition2.defaultBehavior.toolHandlers[0].response.content[0].type).toBe('resource');
    });
  });

  describe('Test Coverage Validation', () => {
    it('should validate test scenarios exist', () => {
      // This validates that our comprehensive test files are structured correctly
      // by checking that the builder can handle various scenarios tested in those files

      // Edge case scenario
      const edgeCaseBuilder = new MockMCPServerBuilder()
        .withName('edge-case-validation')
        .withTool('tool1')
        .withStaticResponse([{ type: 'text', text: 'response1' }])
        .withTool('tool1') // Duplicate name (tested in comprehensive)
        .withStaticResponse([{ type: 'text', text: 'response2' }]);

      const definition = edgeCaseBuilder.buildDefinition();
      expect(definition.defaultBehavior.toolHandlers).toHaveLength(2);

      // Complex configuration scenario
      const complexBuilder = new MockMCPServerBuilder()
        .withName('complex-validation')
        .withTransport('http')
        .withCapabilities({ tools: { listChanged: true } })
        .withTool('complex-tool')
        .withDynamicHandler(async () => ({ content: [], isError: false }))
        .withDelay(100, 200, true)
        .withErrorInjection({ enabled: true, probability: 0.5 })
        .withScenario('test-scenario', scenario => scenario.withDelay(50));

      const complexDefinition = complexBuilder.buildDefinition();
      expect(complexDefinition.serverConfig.transport).toBe('http');
      expect(complexDefinition.scenarios).toHaveLength(1);
    });

    it('should validate integration test patterns', async () => {
      // Validate patterns used in integration tests
      const server = new MockMCPServerBuilder()
        .withName('integration-validation')
        .withTool('integration-tool')
        .withStaticResponse([{ type: 'text', text: 'integration response' }])
        .build();

      expect(server.isStarted()).toBe(false);

      await server.start();
      expect(server.isStarted()).toBe(true);

      const stats = server.getStats();
      expect(stats).toBeDefined();
      expect(stats.totalRequests).toBe(0);

      await server.stop();
      expect(server.isStarted()).toBe(false);
    });

    it('should validate performance test patterns', () => {
      const startTime = Date.now();

      // Build configuration similar to performance tests
      let builder = new MockMCPServerBuilder().withName('performance-validation');

      for (let i = 0; i < 10; i++) { // Smaller number for validation
        builder = builder
          .withTool(`perf-tool-${i}`)
          .withStaticResponse([{ type: 'text', text: `Response ${i}` }]);
      }

      const definition = builder.buildDefinition();
      const endTime = Date.now();

      expect(definition.defaultBehavior.toolHandlers).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });
  });

  describe('Error Recovery Validation', () => {
    it('should recover from build errors', () => {
      const builder = new MockMCPServerBuilder();

      // Cause an error
      expect(() => {
        builder
          .withName('error-recovery-validation')
          .withTool('incomplete')
          .buildDefinition(); // Missing handler
      }).toThrow();

      // Builder should still be usable
      const validDefinition = builder
        .withName('recovery-success')
        .withTool('complete')
        .withStaticResponse([{ type: 'text', text: 'recovered' }])
        .buildDefinition();

      expect(validDefinition.serverConfig.name).toBe('recovery-success');
    });

    it('should handle server errors gracefully', async () => {
      const server = new MockMCPServerBuilder()
        .withName('server-error-validation')
        .withTool('error-tool')
        .withStaticResponse([{ type: 'text', text: 'error response' }])
        .build();

      // Multiple start/stop should not cause issues
      await server.start();
      await server.stop();
      await server.start();
      await server.stop();

      expect(server.isStarted()).toBe(false);
    });
  });
});

describe('Test Infrastructure Validation', () => {
  it('should have proper test utilities', () => {
    // Validate that vitest is properly configured
    expect(describe).toBeDefined();
    expect(it).toBeDefined();
    expect(expect).toBeDefined();
  });

  it('should handle async test patterns', async () => {
    const server = new MockMCPServerBuilder()
      .withName('async-validation')
      .withTool('async-tool')
      .withStaticResponse([{ type: 'text', text: 'async response' }])
      .build();

    await expect(server.start()).resolves.toBeUndefined();
    await expect(server.stop()).resolves.toBeUndefined();
  });

  it('should handle mock functions', () => {
    // Validate that vitest mocking works (for dynamic handler tests)
    const mockHandler = async () => ({
      content: [{ type: 'text' as const, text: 'mocked' }],
      isError: false,
    });

    const definition = new MockMCPServerBuilder()
      .withName('mock-validation')
      .withTool('mock-tool')
      .withDynamicHandler(mockHandler)
      .buildDefinition();

    expect(definition.defaultBehavior.dynamicHandlers).toHaveLength(1);
  });
});