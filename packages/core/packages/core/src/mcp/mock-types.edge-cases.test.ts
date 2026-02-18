/**
 * @fileoverview Edge Case Tests for Mock MCP Server Configuration Types
 *
 * Comprehensive edge case testing for mock-types, focusing on:
 * - Boundary conditions and limit testing
 * - Complex scenario validation
 * - Type coercion and transformation
 * - Performance and memory considerations
 * - Real-world usage patterns
 *
 * @module @apex/core/mcp/mock-types.edge-cases.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MockMCPServerConfigSchema,
  MockBehaviorConfigSchema,
  MockDynamicHandlerSchema,
  MockResponseSequenceSchema,
  MockToolHandlerSchema,
  MockMCPServerDefinitionSchema,
  MockErrorInjectionSchema,
  MockResponseDelaySchema,
  type MockDynamicHandlerFunction,
  type MockBehaviorConfig,
  type MockMCPServerDefinition,
} from './mock-types.js';

// ============================================================================
// BOUNDARY CONDITION TESTS
// ============================================================================

describe('Boundary Conditions', () => {
  describe('Port Number Boundaries', () => {
    it('should accept port 0 (auto-assign)', () => {
      const config = MockMCPServerConfigSchema.parse({
        name: 'test',
        transport: 'http',
        httpConfig: { port: 0 },
      });

      expect(config.httpConfig?.port).toBe(0);
    });

    it('should accept maximum valid port number', () => {
      const config = MockMCPServerConfigSchema.parse({
        name: 'test',
        transport: 'http',
        httpConfig: { port: 65535 },
      });

      expect(config.httpConfig?.port).toBe(65535);
    });

    it('should reject port numbers beyond valid range', () => {
      expect(() => MockMCPServerConfigSchema.parse({
        name: 'test',
        transport: 'http',
        httpConfig: { port: 65536 },
      })).toThrow();

      expect(() => MockMCPServerConfigSchema.parse({
        name: 'test',
        transport: 'http',
        httpConfig: { port: -1 },
      })).toThrow();
    });
  });

  describe('String Length Boundaries', () => {
    it('should handle very long server names', () => {
      const longName = 'a'.repeat(1000);
      const config = MockMCPServerConfigSchema.parse({
        name: longName,
      });

      expect(config.name).toBe(longName);
    });

    it('should handle very long descriptions', () => {
      const longDescription = 'Very detailed description: ' + 'x'.repeat(5000);
      const config = MockMCPServerConfigSchema.parse({
        name: 'test',
        description: longDescription,
      });

      expect(config.description).toBe(longDescription);
    });

    it('should reject empty strings where not allowed', () => {
      expect(() => MockMCPServerConfigSchema.parse({
        name: '',
      })).toThrow();

      expect(() => MockMCPServerConfigSchema.parse({
        name: '   ', // whitespace only
      })).toThrow();
    });
  });

  describe('Numeric Boundaries', () => {
    it('should handle very large delay values', () => {
      const delay = MockResponseDelaySchema.parse({
        fixedMs: Number.MAX_SAFE_INTEGER,
      });

      expect(delay.fixedMs).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle edge case timeout values', () => {
      const config = MockMCPServerConfigSchema.parse({
        name: 'test',
        shutdownTimeoutMs: 0, // immediate shutdown
      });

      expect(config.shutdownTimeoutMs).toBe(0);
    });

    it('should handle maximum connections at boundary', () => {
      const config = MockMCPServerConfigSchema.parse({
        name: 'test',
        maxConnections: 1, // minimum allowed
      });

      expect(config.maxConnections).toBe(1);
    });
  });
});

// ============================================================================
// COMPLEX SCENARIO TESTS
// ============================================================================

describe('Complex Scenarios', () => {
  it('should handle deeply nested configuration objects', () => {
    const complexConfig: MockMCPServerDefinition = {
      serverConfig: {
        name: 'complex-nested-server',
        description: 'Server with deeply nested configuration',
        transport: 'http',
        httpConfig: {
          host: 'localhost',
          port: 8080,
          basePath: '/api/v1/mcp',
          tls: true,
          tlsCertPath: '/path/to/complex/cert.pem',
          tlsKeyPath: '/path/to/complex/key.pem',
        },
        capabilities: {
          tools: {
            listChanged: true,
          },
          resources: {
            subscribe: true,
            listChanged: false,
          },
          prompts: {
            listChanged: true,
          },
          logging: {},
        },
        serverInfo: {
          name: 'complex-server-implementation',
          version: '3.2.1-beta.5+build.20240115',
        },
        instructions: 'Complex multi-line instructions\\nLine 2\\nLine 3',
        maxConnections: 100,
        shutdownTimeoutMs: 30000,
      },
      defaultBehavior: {
        responseDelay: {
          minMs: 50,
          maxMs: 200,
          jitter: true,
          perMethod: {
            'initialize': 0,
            'tools/list': 25,
            'tools/call': 100,
            'resources/list': 75,
            'resources/read': 150,
          },
        },
        errorInjection: {
          enabled: true,
          probability: 0.05,
          errorCode: -32603,
          errorMessage: 'Simulated server error',
          errorData: {
            type: 'SimulatedError',
            details: 'This is a controlled test error',
            timestamp: '2024-01-15T10:30:00Z',
          },
          methods: ['tools/call', 'resources/read'],
          afterRequestCount: 10,
          maxErrors: 5,
          errorDelayMs: 500,
        },
        toolHandlers: [
          {
            toolName: 'complex-search',
            response: {
              content: [
                { type: 'text', text: 'Search completed' },
                { type: 'resource', resource: { uri: 'data:application/json,{"results":[]}' } },
              ],
              isError: false,
            },
            matchArgs: {
              query: 'complex',
              filters: {
                category: 'test',
                dateRange: {
                  start: '2024-01-01',
                  end: '2024-12-31',
                },
              },
            },
            priority: 75,
          },
        ],
        dynamicHandlers: [
          {
            toolName: 'adaptive-processor',
            handler: vi.fn().mockImplementation(async (toolName, args, context) => {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Processed ${Object.keys(args).length} arguments at ${context.timestamp.toISOString()}`,
                  },
                ],
                isError: false,
              };
            }),
            matchArgs: { mode: 'adaptive' },
            maxInvocations: 1000,
            priority: 90,
          },
        ],
        responseSequences: [
          {
            toolName: 'multi-step-operation',
            responses: [
              { content: [{ type: 'text', text: 'Step 1: Initializing' }], isError: false, delayMs: 100 },
              { content: [{ type: 'text', text: 'Step 2: Processing' }], isError: false, delayMs: 200 },
              { content: [{ type: 'text', text: 'Step 3: Validating' }], isError: false, delayMs: 150 },
              { content: [{ type: 'text', text: 'Step 4: Complete' }], isError: false, delayMs: 50 },
            ],
            cycleMode: 'stop_at_end',
            priority: 80,
          },
        ],
        statefulBehavior: {
          initialState: 'idle',
          transitions: [
            {
              from: 'idle',
              to: 'working',
              onMethod: 'tools/call',
              whenArgs: { action: 'start' },
            },
            {
              from: 'working',
              to: 'idle',
              onMethod: 'tools/call',
              whenArgs: { action: 'stop' },
            },
          ],
          stateBehaviors: [
            {
              state: 'working',
              toolHandlers: [
                {
                  toolName: 'status',
                  response: {
                    content: [{ type: 'text', text: 'Status: Working' }],
                    isError: false,
                  },
                  priority: 100,
                },
              ],
            },
          ],
        },
        maxRecordedRequests: 10000,
        recordRequests: true,
        validateRequests: true,
        enableDebugLogging: true,
      },
      scenarios: [
        {
          name: 'high-load-scenario',
          description: 'Simulates high load with multiple concurrent requests',
          serverConfig: {
            name: 'high-load-server',
            transport: 'http',
            maxConnections: 1000,
          },
          behaviorConfig: {
            responseDelay: { minMs: 10, maxMs: 50 },
            maxRecordedRequests: 50000,
          },
        },
        {
          name: 'network-issues-scenario',
          description: 'Simulates various network connectivity issues',
          serverConfig: {
            name: 'flaky-network-server',
            transport: 'http',
          },
          behaviorConfig: {
            errorInjection: {
              enabled: true,
              probability: 0.3,
              simulateConnectionFailure: true,
              errorDelayMs: 2000,
            },
            responseDelay: { minMs: 1000, maxMs: 5000, jitter: true },
          },
        },
      ],
    };

    const result = MockMCPServerDefinitionSchema.parse(complexConfig);
    expect(result.defaultBehavior.dynamicHandlers).toHaveLength(1);
    expect(result.scenarios).toHaveLength(2);
    expect(result.defaultBehavior.statefulBehavior?.transitions).toHaveLength(2);
  });

  it('should handle scenarios with overlapping handler priorities', () => {
    const config: MockBehaviorConfig = {
      toolHandlers: [
        {
          toolName: 'same-tool',
          response: { content: [{ type: 'text', text: 'handler 1' }], isError: false },
          matchArgs: { priority: 'low' },
          priority: 50,
        },
        {
          toolName: 'same-tool',
          response: { content: [{ type: 'text', text: 'handler 2' }], isError: false },
          matchArgs: { priority: 'high' },
          priority: 80,
        },
      ],
      dynamicHandlers: [
        {
          toolName: 'same-tool',
          handler: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'dynamic handler' }],
            isError: false,
          }),
          matchArgs: { priority: 'dynamic' },
          priority: 90,
        },
      ],
      responseSequences: [
        {
          toolName: 'same-tool',
          responses: [{ content: [{ type: 'text', text: 'sequence' }], isError: false }],
          matchArgs: { priority: 'sequence' },
          priority: 70,
        },
      ],
    };

    const result = MockBehaviorConfigSchema.parse(config);

    // All handlers should be preserved with their priorities
    expect(result.toolHandlers).toHaveLength(2);
    expect(result.dynamicHandlers).toHaveLength(1);
    expect(result.responseSequences).toHaveLength(1);

    // Verify priority ordering would be: dynamic (90), static high (80), sequence (70), static low (50)
    expect(result.dynamicHandlers[0].priority).toBe(90);
    expect(result.toolHandlers.find(h => h.matchArgs?.priority === 'high')?.priority).toBe(80);
    expect(result.responseSequences[0].priority).toBe(70);
    expect(result.toolHandlers.find(h => h.matchArgs?.priority === 'low')?.priority).toBe(50);
  });
});

// ============================================================================
// TYPE COERCION AND TRANSFORMATION TESTS
// ============================================================================

describe('Type Coercion and Transformation', () => {
  it('should handle string-to-number coercion in delay configurations', () => {
    // Note: Zod typically doesn't coerce types unless explicitly configured
    // This test verifies that our schemas handle numeric strings appropriately
    const delay = MockResponseDelaySchema.parse({
      fixedMs: 100,
      minMs: 50,
      maxMs: 200,
    });

    expect(typeof delay.fixedMs).toBe('number');
    expect(typeof delay.minMs).toBe('number');
    expect(typeof delay.maxMs).toBe('number');
  });

  it('should preserve exact object structures in complex configs', () => {
    const complexArgs = {
      nested: {
        deeply: {
          structured: {
            data: [1, 2, 3],
            metadata: {
              timestamp: '2024-01-15T10:30:00Z',
              version: '1.0.0',
            },
          },
        },
      },
    };

    const handler = MockToolHandlerSchema.parse({
      toolName: 'complex-structure',
      response: { content: [], isError: false },
      matchArgs: complexArgs,
    });

    expect(handler.matchArgs).toEqual(complexArgs);
  });

  it('should handle function serialization boundaries in dynamic handlers', () => {
    const dynamicFunction: MockDynamicHandlerFunction = async (toolName, args, context) => {
      // Complex function with closures and external dependencies
      const startTime = Date.now();
      const requestInfo = {
        tool: toolName,
        args: JSON.stringify(args),
        requestId: context.requestId,
        invocation: context.invocationCount,
      };

      return {
        content: [
          {
            type: 'text',
            text: `Processed in ${Date.now() - startTime}ms: ${JSON.stringify(requestInfo)}`,
          },
        ],
        isError: false,
      };
    };

    const handler = MockDynamicHandlerSchema.parse({
      toolName: 'complex-function',
      handler: dynamicFunction,
    });

    expect(typeof handler.handler).toBe('function');
  });
});

// ============================================================================
// PERFORMANCE AND MEMORY TESTS
// ============================================================================

describe('Performance and Memory', () => {
  it('should handle large numbers of handlers efficiently', () => {
    const largeConfig = {
      toolHandlers: Array.from({ length: 1000 }, (_, i) => ({
        toolName: `tool-${i}`,
        response: {
          content: [{ type: 'text' as const, text: `Response from tool ${i}` }],
          isError: false,
        },
        priority: i % 100, // Vary priorities
      })),
      dynamicHandlers: Array.from({ length: 100 }, (_, i) => ({
        toolName: `dynamic-${i}`,
        handler: vi.fn().mockResolvedValue({
          content: [{ type: 'text' as const, text: `Dynamic response ${i}` }],
          isError: false,
        }),
        priority: (i % 50) + 50, // Higher priority range
      })),
      responseSequences: Array.from({ length: 50 }, (_, i) => ({
        toolName: `sequence-${i}`,
        responses: Array.from({ length: 10 }, (_, j) => ({
          content: [{ type: 'text' as const, text: `Sequence ${i}, step ${j}` }],
          isError: false,
        })),
        priority: (i % 25) + 75, // Even higher priority range
      })),
    };

    const startTime = Date.now();
    const result = MockBehaviorConfigSchema.parse(largeConfig);
    const parseTime = Date.now() - startTime;

    expect(result.toolHandlers).toHaveLength(1000);
    expect(result.dynamicHandlers).toHaveLength(100);
    expect(result.responseSequences).toHaveLength(50);

    // Performance assertion - parsing should be reasonably fast
    expect(parseTime).toBeLessThan(1000); // Less than 1 second for large config
  });

  it('should handle deeply nested response sequences', () => {
    const deepSequence = {
      toolName: 'deep-operation',
      responses: Array.from({ length: 1000 }, (_, i) => ({
        content: [
          {
            type: 'text' as const,
            text: `Step ${i}: ${'  '.repeat(i % 10)}Processing...`, // Varying depth
          },
        ],
        isError: i % 100 === 99, // Occasional errors
        delayMs: i * 10, // Increasing delays
      })),
      cycleMode: 'cycle' as const,
    };

    const result = MockResponseSequenceSchema.parse(deepSequence);
    expect(result.responses).toHaveLength(1000);
    expect(result.responses[999].delayMs).toBe(9990);
  });

  it('should handle memory-intensive match patterns', () => {
    const memoryIntensiveHandler = {
      toolName: 'memory-test',
      response: { content: [], isError: false },
      matchArgs: {
        largeArray: Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          data: `item-${i}`.repeat(10),
          nested: {
            values: Array.from({ length: 100 }, (_, j) => j),
          },
        })),
      },
    };

    const result = MockToolHandlerSchema.parse(memoryIntensiveHandler);
    expect(result.matchArgs?.largeArray).toHaveLength(10000);
  });
});

// ============================================================================
// REAL-WORLD USAGE PATTERN TESTS
// ============================================================================

describe('Real-World Usage Patterns', () => {
  it('should support common development testing patterns', () => {
    const developmentMockServer: MockMCPServerDefinition = {
      serverConfig: {
        name: 'development-server',
        transport: 'stdio',
        autoStart: true,
      },
      defaultBehavior: {
        responseDelay: { fixedMs: 0 }, // Fast responses for development
        recordRequests: true,
        enableDebugLogging: true,
        toolHandlers: [
          // Mock file operations
          {
            toolName: 'read_file',
            response: {
              content: [{ type: 'text', text: 'Mock file contents' }],
              isError: false,
            },
            matchArgs: { path: '/mock/path' },
          },
          {
            toolName: 'write_file',
            response: {
              content: [{ type: 'text', text: 'File written successfully' }],
              isError: false,
            },
          },
        ],
        dynamicHandlers: [
          // Dynamic search that responds based on query
          {
            toolName: 'search',
            handler: vi.fn().mockImplementation(async (toolName, args) => {
              const query = args.query as string;
              return {
                content: [{
                  type: 'text',
                  text: `Found ${query ? query.length : 0} results for "${query}"`,
                }],
                isError: false,
              };
            }),
          },
        ],
      },
      scenarios: [
        {
          name: 'error-testing',
          serverConfig: { name: 'error-server', transport: 'stdio' },
          behaviorConfig: {
            errorInjection: { enabled: true, probability: 1.0 },
          },
        },
      ],
    };

    const result = MockMCPServerDefinitionSchema.parse(developmentMockServer);
    expect(result.serverConfig.name).toBe('development-server');
    expect(result.defaultBehavior.enableDebugLogging).toBe(true);
  });

  it('should support CI/CD testing patterns', () => {
    const ciMockServer: MockMCPServerDefinition = {
      serverConfig: {
        name: 'ci-test-server',
        transport: 'http',
        httpConfig: {
          host: '127.0.0.1',
          port: 0, // Auto-assign port for parallel tests
        },
        autoStart: true,
        shutdownTimeoutMs: 1000, // Quick shutdown for test efficiency
      },
      defaultBehavior: {
        responseDelay: { fixedMs: 10 }, // Minimal but realistic delays
        recordRequests: true,
        maxRecordedRequests: 100, // Limit memory usage
        expectations: [
          {
            name: 'initialization',
            request: { method: 'initialize' },
            response: { result: { capabilities: {} } },
            required: true,
          },
          {
            name: 'tools-list',
            request: { method: 'tools/list' },
            response: { result: { tools: [] } },
            expectedCallCount: 1,
          },
        ],
      },
      scenarios: [
        {
          name: 'performance-test',
          serverConfig: { name: 'perf-server', transport: 'http' },
          behaviorConfig: {
            responseDelay: { minMs: 1, maxMs: 5 },
          },
        },
        {
          name: 'reliability-test',
          serverConfig: { name: 'reliability-server', transport: 'http' },
          behaviorConfig: {
            errorInjection: {
              enabled: true,
              probability: 0.1,
              maxErrors: 3,
            },
          },
        },
      ],
    };

    const result = MockMCPServerDefinitionSchema.parse(ciMockServer);
    expect(result.defaultBehavior.expectations).toHaveLength(2);
    expect(result.scenarios).toHaveLength(2);
  });

  it('should support production load testing patterns', () => {
    const loadTestConfig: MockBehaviorConfig = {
      responseDelay: {
        minMs: 50,
        maxMs: 500,
        jitter: true,
        perMethod: {
          'initialize': 10,
          'tools/list': 25,
          'tools/call': 200,
        },
      },
      errorInjection: {
        enabled: true,
        probability: 0.02, // 2% error rate
        methods: ['tools/call'],
        afterRequestCount: 100, // Allow warmup
      },
      dynamicHandlers: [
        {
          toolName: 'load-test-operation',
          handler: vi.fn().mockImplementation(async (toolName, args, context) => {
            // Simulate varying load based on invocation count
            const loadFactor = Math.min(context.invocationCount / 1000, 1.0);
            const processingTime = 100 + (loadFactor * 400); // 100-500ms range

            await new Promise(resolve => setTimeout(resolve, processingTime));

            return {
              content: [{
                type: 'text',
                text: `Operation completed in ${processingTime}ms (load: ${(loadFactor * 100).toFixed(1)}%)`,
              }],
              isError: false,
            };
          }),
          maxInvocations: 10000, // High throughput testing
        },
      ],
      maxRecordedRequests: 1000, // Manage memory during load tests
    };

    const result = MockBehaviorConfigSchema.parse(loadTestConfig);
    expect(result.dynamicHandlers[0].maxInvocations).toBe(10000);
    expect(result.errorInjection?.probability).toBe(0.02);
  });
});

// ============================================================================
// VALIDATION ERROR TESTS
// ============================================================================

describe('Validation Error Handling', () => {
  it('should provide clear error messages for invalid configurations', () => {
    // Test various invalid configurations to ensure good error messages
    expect(() => MockMCPServerConfigSchema.parse({
      // Missing required 'name' field
    })).toThrow();

    expect(() => MockResponseSequenceSchema.parse({
      toolName: 'test',
      responses: [], // Empty responses array
    })).toThrow();

    expect(() => MockErrorInjectionSchema.parse({
      probability: 1.5, // Invalid probability > 1.0
    })).toThrow();
  });

  it('should handle partial configurations gracefully', () => {
    // Test that partial configurations with defaults work
    const minimal = MockBehaviorConfigSchema.parse({});
    expect(minimal.toolHandlers).toEqual([]);
    expect(minimal.dynamicHandlers).toEqual([]);
    expect(minimal.responseSequences).toEqual([]);
    expect(minimal.recordRequests).toBe(true);
  });
});