/**
 * @fileoverview withMockMCP() Test Wrapper Function
 *
 * Provides test wrapper utilities for automatic MockMCPServer lifecycle
 * management. These functions handle server setup, cleanup, and error
 * recovery to reduce test boilerplate and ensure reliable test isolation.
 *
 * Key features:
 * - Automatic server start/stop lifecycle
 * - Guaranteed cleanup even on test failure (try/finally pattern)
 * - Support for both builder configuration and definition objects
 * - Optional behavior/state reset for test isolation
 * - Timeout protection for server operations
 * - Facade variant for single-client convenience
 *
 * @module orchestrator/mcp/mock-server/with-mock-mcp
 */

import type { MockMCPServerDefinition } from '@apexcli/core';
import { MockMCPServer } from './mock-mcp-server.js';
import { MockMCPServerBuilder } from './mock-mcp-server-builder.js';
import { MockMCPServerFacade } from './mock-server-facade.js';

// ============================================================================
// Types and Configuration
// ============================================================================

/**
 * Configuration options for withMockMCP() wrapper functions.
 */
export interface WithMockMCPOptions {
  /**
   * Whether to automatically start the server before calling the test.
   * @default true
   */
  autoStart?: boolean;

  /**
   * Whether to reset behavior/state after test completion.
   * @default true
   */
  resetOnCleanup?: boolean;

  /**
   * Timeout for server operations (start, stop) in milliseconds.
   * @default 5000
   */
  timeout?: number;

  /**
   * Custom cleanup logic to run before server stop.
   */
  beforeCleanup?: (server: MockMCPServer) => Promise<void> | void;
}

const DEFAULT_OPTIONS: Required<Omit<WithMockMCPOptions, 'beforeCleanup'>> = {
  autoStart: true,
  resetOnCleanup: true,
  timeout: 5000,
};

// Type guards for overload resolution
type ConfigureCallback = (builder: MockMCPServerBuilder) => MockMCPServerBuilder;

function isConfigureCallback(
  value: MockMCPServerDefinition | ConfigureCallback
): value is ConfigureCallback {
  return typeof value === 'function';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to create a timeout promise for racing against operations.
 */
function createTimeoutPromise(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

// ============================================================================
// Main Wrapper Functions
// ============================================================================

/**
 * Test wrapper that handles MockMCPServer lifecycle automatically.
 *
 * Provides automatic setup and cleanup of mock MCP servers for testing,
 * ensuring proper resource management even when tests fail.
 *
 * @example
 * ```typescript
 * // Using builder configuration
 * it('should handle tool calls', async () => {
 *   await withMockMCP(
 *     builder => builder
 *       .withName('test-server')
 *       .withTool('read_file')
 *       .withStaticResponse([{ type: 'text', text: 'content' }]),
 *     async (server) => {
 *       const transport = server.createClientTransport();
 *       await transport.connect();
 *       // ... test code
 *       server.assertToolCalled('read_file', 1);
 *     }
 *   );
 * });
 *
 * // Using MockMCPServerDefinition
 * it('should handle complex scenarios', async () => {
 *   await withMockMCP(
 *     myServerDefinition,
 *     async (server) => {
 *       await server.start();
 *       // ... test code
 *     },
 *     { autoStart: false }
 *   );
 * });
 * ```
 */
export async function withMockMCP<T>(
  definitionOrConfigure: MockMCPServerDefinition | ConfigureCallback,
  test: (server: MockMCPServer) => Promise<T> | T,
  options: WithMockMCPOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Build the server
  let server: MockMCPServer;

  if (isConfigureCallback(definitionOrConfigure)) {
    const builder = definitionOrConfigure(new MockMCPServerBuilder());
    server = builder.buildServer();
  } else {
    server = new MockMCPServer(definitionOrConfigure);
  }

  try {
    // Auto-start if configured
    if (opts.autoStart) {
      await Promise.race([
        server.start(),
        createTimeoutPromise(opts.timeout, 'Server start timed out'),
      ]);
    }

    // Run the test
    const result = await test(server);

    return result;
  } finally {
    // Cleanup - always runs even on test failure
    try {
      // Run custom cleanup if provided
      if (opts.beforeCleanup) {
        await opts.beforeCleanup(server);
      }

      // Reset behavior if configured
      if (opts.resetOnCleanup) {
        server.resetBehavior();
        server.resetToDefault();
        server.clearErrorMode();
        server.clearMalformedResponseMode();
      }

      // Stop the server if it's running
      if (server.isListening()) {
        await Promise.race([
          server.stop(),
          createTimeoutPromise(opts.timeout, 'Server stop timed out'),
        ]);
      }
    } catch (cleanupError) {
      // Log cleanup errors but don't override test failures
      console.error('Error during MockMCPServer cleanup:', cleanupError);
    }
  }
}

/**
 * Test wrapper for MockMCPServerFacade (single-client convenience API).
 *
 * Similar to withMockMCP but provides the facade API instead of the
 * raw server, which is more convenient for single-client test scenarios.
 *
 * @example
 * ```typescript
 * it('should work with facade API', async () => {
 *   await withMockMCPFacade(
 *     builder => builder
 *       .withName('test-server')
 *       .withTool('ping')
 *       .withStaticResponse([{ type: 'text', text: 'pong' }]),
 *     async (facade) => {
 *       const transport = facade.getTransport();
 *       await transport.connect();
 *       // ... test code
 *       facade.assertMethodCalled('tools/call', 1);
 *     }
 *   );
 * });
 * ```
 */
export async function withMockMCPFacade<T>(
  configure: ConfigureCallback,
  test: (facade: MockMCPServerFacade) => Promise<T> | T,
  options: WithMockMCPOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Build the facade
  const builder = configure(new MockMCPServerBuilder());
  const facade = builder.build();

  try {
    // Auto-start if configured
    if (opts.autoStart) {
      await Promise.race([
        facade.start(),
        createTimeoutPromise(opts.timeout, 'Server start timed out'),
      ]);
    }

    // Run the test
    const result = await test(facade);

    return result;
  } finally {
    // Cleanup - always runs even on test failure
    try {
      // Reset behavior if configured
      if (opts.resetOnCleanup) {
        facade.resetToDefault();
        facade.clearErrorMode();
        facade.clearMalformedResponseMode();
      }

      // Stop the server if it's running
      if (facade.isStarted()) {
        await Promise.race([
          facade.stop(),
          createTimeoutPromise(opts.timeout, 'Server stop timed out'),
        ]);
      }
    } catch (cleanupError) {
      console.error('Error during MockMCPServerFacade cleanup:', cleanupError);
    }
  }
}