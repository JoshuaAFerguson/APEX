/**
 * @fileoverview MCP (Model Context Protocol) module for APEX
 *
 * This module provides MCP server registry functionality for discovering
 * and managing MCP servers within the APEX platform, as well as protocol
 * message type definitions for MCP communication.
 *
 * @module @apex/core/mcp
 */

export {
  MCPRegistry,
  MCPCatalogLoadError,
  MCPCatalogValidationError,
  getMCPRegistry,
  listMCPServers,
  getMCPServer,
  getMCPServerConfig,
  type MCPCatalog,
  type MCPFilterOptions,
  type MCPRegistryOptions,
} from './mcp-registry.js';

// MCP Protocol Types
export * from './protocol-types.js';

// MCP Mock Server Types
export * from './mock-types.js';
