/**
 * @fileoverview Usage Example for MockMCPServerBuilder
 *
 * Demonstrates the fluent API and integration with existing mock server infrastructure.
 * This file serves as both documentation and verification of the implementation.
 */

import { MockMCPServerBuilder, createMockServerBuilder } from './mock-mcp-server-builder.js';

// Example 1: Simple server with static responses
export function createSimpleFileServer() {
  return new MockMCPServerBuilder()
    .withName('file-server', 'A simple file system server')
    .withTransport('stdio')
    .withCapabilities({
      tools: { listChanged: true },
      resources: { subscribe: true }
    })
    .withTool('read_file')
      .withStaticResponse([{ type: 'text', text: 'File contents here' }])
    .withTool('write_file')
      .withStaticResponse([{ type: 'text', text: 'File written successfully' }])
    .withDelay(50, 100) // Random delay between 50-100ms
    .build();
}

// Example 2: Dynamic server with handler functions
export function createDynamicCalculatorServer() {
  return createMockServerBuilder()
    .withName('calculator')
    .withTool('add')
      .withDynamicHandler(async (toolName, args) => {
        const a = args.a as number;
        const b = args.b as number;
        return {
          content: [{ type: 'text', text: `${a} + ${b} = ${a + b}` }],
          isError: false,
        };
      })
    .withTool('divide')
      .withDynamicHandler(async (toolName, args) => {
        const a = args.a as number;
        const b = args.b as number;
        if (b === 0) {
          return {
            content: [{ type: 'text', text: 'Division by zero!' }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text', text: `${a} / ${b} = ${a / b}` }],
          isError: false,
        };
      }, { priority: 100 })
    .build();
}

// Example 3: Stateful server with response sequences
export function createStatusServer() {
  return new MockMCPServerBuilder()
    .withName('status-server')
    .withTool('get_status')
      .withResponseSequence([
        { content: [{ type: 'text', text: 'initializing' }], isError: false },
        { content: [{ type: 'text', text: 'loading' }], isError: false, delayMs: 100 },
        { content: [{ type: 'text', text: 'ready' }], isError: false },
      ], 'repeat_last')
    .build();
}

// Example 4: Server with scenarios for testing
export function createTestingServer() {
  return new MockMCPServerBuilder()
    .withName('testing-server')
    .withTool('ping')
      .withStaticResponse([{ type: 'text', text: 'pong' }])

    // Normal scenario (default)
    .withDelay(10)

    // Error scenario for testing failure handling
    .withScenario('error-mode', scenario => scenario
      .withErrorInjection({
        enabled: true,
        probability: 1.0,
        errorMessage: 'Simulated server error',
        methods: ['tools/call'],
      })
    )

    // Slow scenario for timeout testing
    .withScenario('slow-mode', scenario => scenario
      .withDelay(2000, 5000)
      .withDelayForMethod('initialize', 500)
    )

    // Can activate a scenario on creation
    .withActiveScenario('error-mode')
    .build();
}

// Example 5: Multi-client server using buildServer()
export async function createMultiClientServer() {
  const server = new MockMCPServerBuilder()
    .withName('multi-client-server')
    .withTool('shared_resource')
      .withDynamicHandler(async (toolName, args, context) => {
        const clientId = context.requestId.split('-')[0];
        return {
          content: [{ type: 'text', text: `Resource accessed by client ${clientId}` }],
          isError: false,
        };
      })
    .buildServer();

  await server.start();

  // Create multiple client transports
  const client1Transport = server.createClientTransport();
  const client2Transport = server.createClientTransport();

  return { server, client1Transport, client2Transport };
}

// Example 6: Complex configuration with all features
export function createComplexServer() {
  return new MockMCPServerBuilder()
    .withName('complex-server', 'Demonstrates all builder features')
    .withTransport('http')
    .withCapabilities({
      tools: { listChanged: true },
      resources: { subscribe: true },
      prompts: { listChanged: true }
    })

    // Multiple tools with different handler types
    .withTool('static_tool')
      .withStaticResponse([{ type: 'text', text: 'Static response' }])

    .withTool('dynamic_tool')
      .withDynamicHandler(async (name, args) => ({
        content: [{ type: 'text', text: `Dynamic: ${JSON.stringify(args)}` }],
        isError: false,
      }), { maxInvocations: 10, priority: 75 })

    .withTool('sequence_tool')
      .withResponseSequence([
        { content: [{ type: 'text', text: 'First call' }] },
        { content: [{ type: 'text', text: 'Second call' }] },
        { content: [{ type: 'text', text: 'Subsequent calls' }] },
      ], 'repeat_last')

    // Global delay configuration
    .withDelay(100, 200, true) // Random 100-200ms with jitter
    .withDelayForMethod('initialize', 50) // Fast init
    .withDelayForMethod('tools/call', 150) // Slower tool calls

    // Error injection for robustness testing
    .withErrorInjection({
      enabled: true,
      probability: 0.05, // 5% failure rate
      methods: ['tools/call'],
      afterRequestCount: 10, // Start failing after 10 requests
    })

    // Multiple scenarios for different test modes
    .withScenario('reliable', scenario => scenario
      .withErrorInjection({ enabled: false })
      .withDelay(50) // Fast and reliable
    )

    .withScenario('unreliable', scenario => scenario
      .withErrorInjection({
        enabled: true,
        probability: 0.3, // 30% failure rate
        simulateConnectionFailure: true
      })
      .withDelay(500, 2000) // Slow and unreliable
    )

    .buildDefinition(); // Return raw definition for advanced usage
}

// Usage demonstration
export async function demonstrateUsage() {
  // Create a simple server
  const fileServer = createSimpleFileServer();
  await fileServer.start();

  // The server is ready to use with MCPClient
  const transport = fileServer.getTransport();

  // Switch scenarios during testing
  fileServer.activateScenario('error-mode'); // if it had scenarios

  // Make assertions
  fileServer.assertToolCalled('read_file', 0); // Should pass initially

  await fileServer.stop();
}