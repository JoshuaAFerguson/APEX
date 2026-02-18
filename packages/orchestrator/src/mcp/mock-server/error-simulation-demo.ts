/**
 * @fileoverview Error Simulation Demo for MockMCPServer
 *
 * Demonstrates the complete error simulation infrastructure in action.
 * This file shows how to use the various error simulation modes and presets
 * for testing MCP client resilience.
 *
 * @module orchestrator/mcp/mock-server/error-simulation-demo
 */

import { MockMCPServer } from './mock-mcp-server.js';
import { MockMCPServerBuilder } from './mock-mcp-server-builder.js';
import type { MockMCPServerDefinition, MockErrorSimulationConfig } from '@apexcli/core';

/**
 * Demo 1: Basic Error Simulation Modes
 *
 * Shows how to configure different error modes for deterministic testing.
 */
export async function demonstrateErrorModes() {
  console.log('🎯 Demo 1: Basic Error Simulation Modes\n');

  const serverDef: MockMCPServerDefinition = {
    serverConfig: {
      name: 'error-demo-server',
      transport: 'stdio',
      capabilities: { tools: {} },
    },
    defaultBehavior: {
      toolHandlers: [{
        toolName: 'demo_tool',
        response: { content: [{ type: 'text', text: 'Success!' }] },
      }],
    },
    scenarios: [],
  };

  const server = new MockMCPServer(serverDef);

  // Mode 1: Always fail
  console.log('Setting error mode: always_fail');
  server.setErrorMode({
    mode: 'always_fail',
    category: 'jsonrpc',
    customError: { code: -32603, message: 'Simulated failure' },
  });

  // Mode 2: Fail first 3 requests
  console.log('Setting error mode: fail_first_n (3 requests)');
  server.setErrorMode({
    mode: 'fail_first_n',
    failCount: 3,
    category: 'network',
    customError: { code: -32000, message: 'Service starting up' },
  });

  // Mode 3: Periodic failures (every 3rd request)
  console.log('Setting error mode: periodic_fail (every 3rd request)');
  server.setErrorMode({
    mode: 'periodic_fail',
    failPeriod: 3,
    category: 'application',
    customError: { code: -32001, message: 'Resource temporarily unavailable' },
  });

  // Mode 4: Method pattern matching
  console.log('Setting error mode: method_pattern (initialize only)');
  server.setErrorMode({
    mode: 'method_pattern',
    methodPattern: '^initialize$',
    category: 'protocol',
    customError: { code: -32600, message: 'Initialization failed' },
  });

  console.log('✅ Error modes configured successfully\n');
}

/**
 * Demo 2: Error Sequence Simulation
 *
 * Shows how to define specific sequences of outcomes for predictable testing.
 */
export async function demonstrateErrorSequences() {
  console.log('🎯 Demo 2: Error Sequence Simulation\n');

  const server = new MockMCPServerBuilder()
    .withName('sequence-demo-server')
    .withTool('test_tool')
      .withStaticResponse([{ type: 'text', text: 'Default response' }])
    .build();

  // Define a specific sequence: error, success, error, success
  server.setErrorMode({
    mode: 'sequence',
    sequence: [
      {
        outcome: 'error',
        error: { code: -32603, message: 'First failure' },
        delayMs: 100,
      },
      {
        outcome: 'success',
        delayMs: 50,
      },
      {
        outcome: 'error',
        error: { code: -32001, message: 'Second failure' },
        delayMs: 200,
      },
      {
        outcome: 'success',
        delayMs: 25,
      },
    ],
    description: 'Alternating success/failure pattern for retry testing',
  });

  console.log('✅ Error sequence configured successfully\n');
}

/**
 * Demo 3: Error Presets Usage
 *
 * Shows how to use predefined error scenarios for common test cases.
 */
export async function demonstrateErrorPresets() {
  console.log('🎯 Demo 3: Error Presets Usage\n');

  const server = new MockMCPServerBuilder()
    .withName('preset-demo-server')
    .build();

  // Use predefined presets for common scenarios
  const presetDemos = [
    'init_protocol_mismatch',
    'init_connection_drop',
    'malformed_response',
    'rate_limit',
    'auth_failure',
    'tool_not_found',
    'request_timeout',
    'connection_reset',
  ] as const;

  for (const preset of presetDemos) {
    console.log(`Applying preset: ${preset}`);
    server.applyErrorPreset(preset);

    const errorMode = server.getErrorMode();
    console.log(`  Mode: ${errorMode?.mode}, Category: ${errorMode?.category}`);
    console.log(`  Description: ${errorMode?.description}\n`);
  }

  console.log('✅ Error presets demonstrated successfully\n');
}

/**
 * Demo 4: Network Conditions Simulation
 *
 * Shows how to simulate various network conditions alongside errors.
 */
export async function demonstrateNetworkConditions() {
  console.log('🎯 Demo 4: Network Conditions Simulation\n');

  const server = new MockMCPServerBuilder()
    .withName('network-demo-server')
    .build();

  // Simulate high latency with occasional failures
  server.setErrorMode({
    mode: 'periodic_fail',
    failPeriod: 5, // Fail every 5th request
    category: 'network',
    customError: { code: -32000, message: 'Network timeout' },
    networkConditions: {
      latencyMs: 2000,        // 2 second base latency
      latencyJitter: 500,     // +/- 500ms jitter
      connectionTimeout: 30000, // 30 second timeout
    },
    description: 'Simulating slow, unreliable network conditions',
  });

  console.log('Network conditions configured:');
  console.log('  Base latency: 2000ms');
  console.log('  Jitter: ±500ms');
  console.log('  Connection timeout: 30s');
  console.log('  Failure rate: Every 5th request');
  console.log('✅ Network conditions configured successfully\n');
}

/**
 * Demo 5: Error Simulation State Tracking
 *
 * Shows how to monitor and inspect error simulation state.
 */
export async function demonstrateStateTracking() {
  console.log('🎯 Demo 5: Error Simulation State Tracking\n');

  const server = new MockMCPServerBuilder()
    .withName('state-demo-server')
    .build();

  // Configure a simple error mode
  server.setErrorMode({
    mode: 'fail_first_n',
    failCount: 2,
    category: 'testing',
    customError: { code: -32999, message: 'Test error' },
  });

  // Get initial state
  const initialState = server.getErrorSimulationState();
  console.log('Initial error simulation state:');
  console.log(`  Request count: ${initialState.requestCount}`);
  console.log(`  Error count: ${initialState.errorCount}`);
  console.log(`  Success count: ${initialState.successCount}`);
  console.log(`  Start time: ${new Date(initialState.startTime).toISOString()}`);

  // Clear error mode and show state reset
  server.clearErrorMode();
  const clearedState = server.getErrorSimulationState();
  console.log('\nAfter clearing error mode:');
  console.log(`  Request count: ${clearedState.requestCount}`);
  console.log(`  Error count: ${clearedState.errorCount}`);
  console.log(`  Success count: ${clearedState.successCount}`);

  console.log('✅ State tracking demonstrated successfully\n');
}

/**
 * Run all error simulation demos
 */
export async function runAllDemos() {
  console.log('🚀 MockMCPServer Error Simulation Infrastructure Demo\n');
  console.log('=' .repeat(60) + '\n');

  await demonstrateErrorModes();
  await demonstrateErrorSequences();
  await demonstrateErrorPresets();
  await demonstrateNetworkConditions();
  await demonstrateStateTracking();

  console.log('🎉 All demos completed successfully!');
  console.log('\nThe MockMCPServer error simulation infrastructure is fully');
  console.log('operational and ready for comprehensive MCP client testing.');
}

// Auto-run demos if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllDemos().catch(console.error);
}