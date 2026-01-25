/**
 * @fileoverview Mock MCP Server Module
 *
 * Provides comprehensive mock MCP server infrastructure for testing
 * MCP client interactions without requiring real MCP servers.
 *
 * ## Components
 *
 * - **MockTransport**: In-process MCPTransport implementation for testing
 * - **MockBehaviorEngine**: Configurable behavior simulation (delays, errors, state)
 * - **MockMCPProtocolHandler**: MCP protocol routing and lifecycle management
 * - **MockMCPServerFacade**: Top-level API for test authors
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   MockMCPServerFacade,
 *   createSimpleMockServer,
 *   createErrorMockServer,
 *   createSlowMockServer,
 * } from '@apexcli/orchestrator/mcp/mock-server';
 * import { MCPClient } from '@apexcli/orchestrator/mcp';
 *
 * // Simple usage with factory
 * const server = createSimpleMockServer('test', [
 *   {
 *     toolName: 'read_file',
 *     response: { content: [{ type: 'text', text: 'hello' }] },
 *   },
 * ]);
 *
 * const client = new MCPClient({ transport: server.getTransport() });
 * await client.connect();
 * const tools = await client.listTools();
 *
 * server.assertMethodCalled('tools/list', 1);
 * ```
 *
 * @module orchestrator/mcp/mock-server
 */

// Types
export type {
  RecordedRequest,
  RecordedNotification,
  MockTransportOptions,
  ProtocolState,
  MethodHandler,
  RegisteredHandler,
  ErrorInjectionResult,
  ComputedDelay,
  MockServerFacadeEvents,
  MockServerStats,
} from './types.js';

export { MockAssertionError } from './types.js';

// MockTransport
export { MockTransport } from './mock-transport.js';

// MockBehaviorEngine
export { MockBehaviorEngine } from './mock-behavior-engine.js';

// MockMCPProtocolHandler
export { MockMCPProtocolHandler } from './mock-protocol-handler.js';

// MockMCPServer (multi-client server with connection lifecycle)
export {
  MockMCPServer,
  type ConnectedClient,
  type MockServerState,
} from './mock-mcp-server.js';

// MockMCPServerFacade (single-client convenience API)
export {
  MockMCPServerFacade,
  createSimpleMockServer,
  createErrorMockServer,
  createSlowMockServer,
} from './mock-server-facade.js';
