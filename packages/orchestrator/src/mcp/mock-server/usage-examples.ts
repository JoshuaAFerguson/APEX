/**
 * @fileoverview Mock MCP Server Usage Examples
 *
 * Demonstrates how to use mock MCP servers for testing MCP client interactions.
 *
 * @module orchestrator/mcp/mock-server/usage-examples
 */

import type {
  MockMCPServerDefinition,
  MockToolHandler,
} from '@apexcli/core';
import {
  MockMCPServerFacade,
  createSimpleMockServer,
  createErrorMockServer,
  createSlowMockServer,
} from './mock-server-facade.js';
import {
  MockMCPServerBuilder,
  createMockServerBuilder,
} from './mock-mcp-server-builder.js';

// ============================================================================
// Basic Examples
// ============================================================================

/**
 * Create a simple mock server with file system tools
 */
export function createFileSystemMockServer(): MockMCPServerFacade {
  const toolHandlers: MockToolHandler[] = [
    {
      toolName: 'read_file',
      response: {
        content: [
          {
            type: 'text',
            text: 'Mock file content',
          },
        ],
        isError: false,
      },
    },
    {
      toolName: 'write_file',
      response: {
        content: [
          {
            type: 'text',
            text: 'File written successfully',
          },
        ],
        isError: false,
      },
    },
  ];

  return createSimpleMockServer('filesystem-server', toolHandlers);
}

/**
 * Create a mock server with conditional responses
 */
export function createConditionalMockServer(): MockMCPServerFacade {
  const definition: MockMCPServerDefinition = {
    serverConfig: {
      name: 'conditional-server',
      transport: 'stdio',
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
      },
      serverInfo: {
        name: 'Conditional Mock Server',
        version: '1.0.0',
      },
      autoStart: true,
      maxConnections: 10,
      shutdownTimeoutMs: 5000,
    },
    defaultBehavior: {
      toolHandlers: [
        {
          toolName: 'read_file',
          matchArgs: { path: '/existing/file.txt' },
          response: {
            content: [{ type: 'text', text: 'File exists' }],
            isError: false,
          },
        },
        {
          toolName: 'read_file',
          response: {
            content: [{ type: 'text', text: 'File not found' }],
            isError: true,
          },
        },
      ],
      recordRequests: true,
      maxRecordedRequests: 1000,
      validateRequests: true,
      enableDebugLogging: false,
      notificationTriggers: [],
      expectations: [],
    },
    scenarios: [],
  };

  return new MockMCPServerFacade(definition);
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a quick test setup
 */
export async function createQuickTestSetup(
  toolHandlers: MockToolHandler[] = []
): Promise<{
  server: MockMCPServerFacade;
  cleanup: () => Promise<void>;
}> {
  const server = createSimpleMockServer('test-server', toolHandlers);
  await server.start();

  return {
    server,
    cleanup: async () => {
      await server.stop();
    },
  };
}

// ============================================================================
// Builder Pattern Examples
// ============================================================================

/**
 * Create a mock server with static responses using the builder pattern
 *
 * Demonstrates:
 * - Fluent API usage
 * - Static response configuration
 * - Basic tool setup
 */
export function createBuilderWithStaticResponses(): MockMCPServerFacade {
  return new MockMCPServerBuilder()
    .withName('static-response-server', 'Server with predefined static responses')
    .withTool('read_file')
      .withStaticResponse([
        { type: 'text', text: 'Static file content from builder' }
      ])
    .withTool('get_info')
      .withStaticResponse([
        { type: 'text', text: 'Server info: Version 1.0.0' }
      ])
    .withTool('list_files')
      .withStaticResponse([
        { type: 'text', text: 'file1.txt\nfile2.txt\nfile3.txt' }
      ])
    .withDelay(50) // Add 50ms delay to all responses
    .build();
}

/**
 * Create a mock server with dynamic handlers using the builder pattern
 *
 * Demonstrates:
 * - Dynamic response generation
 * - Access to request arguments
 * - Conditional logic in handlers
 * - Error handling in responses
 */
export function createBuilderWithDynamicHandlers(): MockMCPServerFacade {
  return createMockServerBuilder()
    .withName('dynamic-handler-server')
    .withTool('calculate')
      .withDynamicHandler(async (toolName, args) => {
        const operation = args.operation as string;
        const a = args.a as number;
        const b = args.b as number;

        switch (operation) {
          case 'add':
            return {
              content: [{ type: 'text', text: `${a} + ${b} = ${a + b}` }],
              isError: false,
            };
          case 'subtract':
            return {
              content: [{ type: 'text', text: `${a} - ${b} = ${a - b}` }],
              isError: false,
            };
          case 'divide':
            if (b === 0) {
              return {
                content: [{ type: 'text', text: 'Error: Division by zero' }],
                isError: true,
              };
            }
            return {
              content: [{ type: 'text', text: `${a} / ${b} = ${a / b}` }],
              isError: false,
            };
          default:
            return {
              content: [{ type: 'text', text: `Unknown operation: ${operation}` }],
              isError: true,
            };
        }
      })
    .withTool('echo')
      .withDynamicHandler(async (toolName, args) => {
        const message = args.message as string;
        return {
          content: [{ type: 'text', text: `Echo: ${message}` }],
          isError: false,
        };
      })
    .withDelay(10, 50) // Random delay between 10-50ms
    .build();
}

/**
 * Create a mock server with response sequences using the builder pattern
 *
 * Demonstrates:
 * - Sequential responses for stateful behavior
 * - Different response behaviors (cycle, repeat_last, repeat_all)
 * - Simulating state changes over multiple calls
 */
export function createBuilderWithResponseSequences(): MockMCPServerFacade {
  return new MockMCPServerBuilder()
    .withName('sequence-server', 'Server demonstrating response sequences')
    .withTool('get_status')
      .withResponseSequence([
        {
          content: [{ type: 'text', text: 'Status: Initializing...' }],
          isError: false
        },
        {
          content: [{ type: 'text', text: 'Status: Loading configuration...' }],
          isError: false,
          delayMs: 100
        },
        {
          content: [{ type: 'text', text: 'Status: Ready' }],
          isError: false
        },
      ], 'repeat_last') // Keep returning "Ready" after sequence completes
    .withTool('next_item')
      .withResponseSequence([
        { content: [{ type: 'text', text: 'Item 1' }], isError: false },
        { content: [{ type: 'text', text: 'Item 2' }], isError: false },
        { content: [{ type: 'text', text: 'Item 3' }], isError: false },
        { content: [{ type: 'text', text: 'No more items' }], isError: true },
      ], 'cycle') // Cycle through the sequence repeatedly
    .withTool('countdown')
      .withResponseSequence([
        { content: [{ type: 'text', text: 'T-minus 3...' }], isError: false },
        { content: [{ type: 'text', text: 'T-minus 2...' }], isError: false },
        { content: [{ type: 'text', text: 'T-minus 1...' }], isError: false },
        { content: [{ type: 'text', text: 'Launch!' }], isError: false },
      ], 'repeat_all') // Restart from beginning after completion
    .build();
}

/**
 * Create a comprehensive mock server demonstrating all builder features
 *
 * Demonstrates:
 * - Mixed response types (static, dynamic, sequences)
 * - Error injection for robustness testing
 * - Multiple scenarios for different test modes
 * - Advanced configuration options
 */
export function createComprehensiveBuilderExample(): MockMCPServerFacade {
  return new MockMCPServerBuilder()
    .withName('comprehensive-server', 'Full-featured server showcasing all builder capabilities')
    .withTransport('stdio')
    .withCapabilities({
      tools: { listChanged: true },
      resources: { subscribe: true },
      prompts: { listChanged: true }
    })

    // Static response tool
    .withTool('get_version')
      .withStaticResponse([
        { type: 'text', text: 'Version 2.1.0' }
      ])

    // Dynamic handler tool
    .withTool('process_data')
      .withDynamicHandler(async (toolName, args) => {
        const data = args.data as string;
        const processedData = data.toUpperCase().split('').reverse().join('');
        return {
          content: [{ type: 'text', text: `Processed: ${processedData}` }],
          isError: false,
        };
      }, { priority: 100, maxInvocations: 50 })

    // Response sequence tool
    .withTool('startup_sequence')
      .withResponseSequence([
        { content: [{ type: 'text', text: 'Starting services...' }], isError: false },
        { content: [{ type: 'text', text: 'Loading modules...' }], isError: false, delayMs: 200 },
        { content: [{ type: 'text', text: 'System ready!' }], isError: false },
      ], 'repeat_last')

    // Global delay configuration
    .withDelay(25, 75, true) // Random delay 25-75ms with jitter
    .withDelayForMethod('initialize', 100)
    .withDelayForMethod('tools/call', 50)

    // Error injection for testing robustness
    .withErrorInjection({
      enabled: true,
      probability: 0.1, // 10% chance of error
      errorMessage: 'Simulated server error for testing',
      methods: ['tools/call'],
      afterRequestCount: 5, // Start injecting errors after 5 requests
    })

    // Define test scenarios
    .withScenario('fast-mode', scenario => scenario
      .withDelay(5) // Very fast responses
      .withErrorInjection({ enabled: false }) // No errors
    )

    .withScenario('slow-mode', scenario => scenario
      .withDelay(500, 1000) // Slow responses
      .withErrorInjection({
        enabled: true,
        probability: 0.05, // Lower error rate
      })
    )

    .withScenario('error-prone', scenario => scenario
      .withErrorInjection({
        enabled: true,
        probability: 0.3, // High error rate for testing
        simulateConnectionFailure: true,
      })
    )

    .build();
}