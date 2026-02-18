/**
 * MCP (Model Context Protocol) Module
 *
 * This module provides MCP transport implementations for communication
 * with MCP servers. It follows the JSON-RPC 2.0 protocol used by MCP.
 *
 * @module orchestrator/mcp
 *
 * @example
 * ```typescript
 * import { StdioTransport, JSONRPCMessage } from '@apexcli/orchestrator/mcp';
 *
 * // Create a stdio transport to communicate with an MCP server
 * const transport = new StdioTransport({
 *   command: 'node',
 *   args: ['./mcp-server.js'],
 * });
 *
 * // Listen for messages
 * transport.on('message', (message: JSONRPCMessage) => {
 *   console.log('Received:', message);
 * });
 *
 * // Connect and send a request
 * await transport.connect();
 * await transport.send({
 *   jsonrpc: '2.0',
 *   id: 1,
 *   method: 'tools/list',
 * });
 *
 * // Disconnect when done
 * await transport.disconnect();
 * ```
 */

// Types
export {
  // JSON-RPC message types
  type JSONRPCError,
  type JSONRPCRequest,
  type JSONRPCSuccessResponse,
  type JSONRPCErrorResponse,
  type JSONRPCResponse,
  type JSONRPCNotification,
  type JSONRPCMessage,

  // Error codes
  JSONRPCErrorCodes,

  // Transport error types
  type MCPTransportErrorCode,
  MCPTransportError,

  // Transport events
  type MCPTransportEvents,

  // Type guards
  isJSONRPCRequest,
  isJSONRPCResponse,
  isJSONRPCNotification,
  isJSONRPCErrorResponse,
  isJSONRPCSuccessResponse,

  // Factory functions
  createJSONRPCRequest,
  createJSONRPCNotification,
  createJSONRPCSuccessResponse,
  createJSONRPCErrorResponse,
} from './types.js';

// Transports
export {
  // Base transport
  MCPTransport,
  type TransportState,
  type MCPTransportBaseOptions,

  // Stdio transport
  StdioTransport,
  type StdioTransportOptions,
} from './transports/index.js';

// MCP Client
export {
  MCPClient,
  type MCPClientOptions,
  type MCPClientEvents,
  type MCPToolDefinition,
} from './client.js';

// Connection Manager
export {
  MCPConnectionManager,
  type MCPConnectionManagerOptions,
  type MCPConnectionManagerEvents,
} from './connection-manager.js';

// MCP Configurator
export {
  MCPConfigurator,
  MCPConfiguratorError,
  type MCPConfiguratorOptions,
  type MCPConfiguratorEvents,
  type MCPConfigFormat,
  type ClaudeDesktopConfig,
  type ClaudeDesktopServerConfig,
  type EnvVarDetectionResult,
  type ConfigValidationResult,
  type ConfigValidationErrorCode,
  type ConfigValidationWarningCode,
  type MCPServerTemplate,
} from './configurator.js';

// Environment Variable Detector
export {
  EnvVarDetector,
  type EnvVarSource,
  type EnvVarResolution,
} from './env-detector.js';

// Configuration Validator
export {
  ConfigValidator,
} from './config-validator.js';

// Built-in Templates
export {
  BUILTIN_TEMPLATES,
  getTemplatesByCategory,
  getVerifiedTemplates,
  getDefaultEnabledTemplates,
  findTemplateByPackage,
  searchTemplatesByCapabilities,
} from './templates.js';

// Mock MCP Server (for testing) - import directly from './mock-server/index.js' in test files
// These exports are excluded from the production build to avoid mock-server compilation issues
