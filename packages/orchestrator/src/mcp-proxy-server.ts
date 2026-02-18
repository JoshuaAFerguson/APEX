/**
 * MCP Proxy Server for routing tool calls through MCPConnectionManager
 *
 * This module creates a SDK MCP server that proxies tool calls from
 * the Claude Agent SDK to external MCP servers through the connection manager.
 * This provides centralized error handling, observability, and metrics.
 *
 * @module orchestrator/mcp-proxy-server
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import type { MCPConnectionManager } from './mcp/connection-manager.js';
import type { MCPToolRegistry, MCPToolRegistryEntry } from './mcp-tool-registry.js';

/**
 * Options for configuring the MCP proxy server
 */
export interface MCPProxyServerOptions {
  /** Connection manager for routing tool calls */
  connectionManager: MCPConnectionManager;
  /** Tool registry for discovering available tools */
  toolRegistry: MCPToolRegistry;
  /** Name for this proxy server */
  name?: string;
}

/**
 * MCP proxy server configuration
 */
export interface MCPProxyServer {
  /** Proxy server name */
  name: string;
  /** SDK MCP server configuration */
  config: ReturnType<typeof createSdkMcpServer>;
}

/**
 * Build an SDK MCP server that proxies tool calls through MCPConnectionManager
 *
 * This server exposes tools discovered from external MCP servers but routes
 * all invocations through the MCPConnectionManager for centralized handling.
 * This provides:
 * - Centralized error handling and logging
 * - Event emission for tool execution observability
 * - Connection state validation
 * - Metrics tracking
 *
 * @param options - Configuration options
 * @returns SDK MCP server configuration
 */
export function buildMCPProxyServer(options: MCPProxyServerOptions): MCPProxyServer {
  const { connectionManager, toolRegistry, name = 'mcp-proxy' } = options;

  // Get all available tools from the registry
  const registryEntries = toolRegistry.getAvailableTools();

  // Create tool definitions that proxy through connectionManager
  const toolDefinitions = registryEntries.map(entry =>
    createProxiedTool(entry, connectionManager)
  );

  return {
    name,
    config: createSdkMcpServer({
      name,
      tools: toolDefinitions,
    }),
  };
}

/**
 * Create a proxied tool definition that routes through MCPConnectionManager
 *
 * Each tool discovered from external MCP servers is wrapped with a handler
 * that routes the call through the connection manager instead of direct
 * client invocation.
 *
 * @param entry - Tool registry entry containing MCP and Claude tool info
 * @param connectionManager - Connection manager for routing
 * @returns SDK tool definition
 */
function createProxiedTool(
  entry: MCPToolRegistryEntry,
  connectionManager: MCPConnectionManager
) {
  const { mcpTool, claudeTool, connectionId, serverName } = entry;

  return tool(
    // Use original tool name (may need namespacing for conflicts)
    claudeTool.name,
    // Use translated description
    claudeTool.description,
    // Use translated Zod schema - extract shape from ZodObject
    claudeTool.parameters.shape,
    // Handler routes through MCPConnectionManager
    async (args: unknown) => {
      try {
        const result = await connectionManager.executeTool(
          connectionId,
          mcpTool.name,
          args as Record<string, unknown>
        );

        // Format result for Claude Agent SDK
        return {
          content: [
            {
              type: 'text' as const,
              text: typeof result === 'string'
                ? result
                : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        // Return error in SDK format
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Dynamically update proxy server tools when registry changes
 *
 * Note: SDK MCP servers don't support dynamic tool updates after creation.
 * This function creates a new server config that replaces the existing one.
 *
 * @param currentServer - Current proxy server to refresh
 * @param options - Configuration options for the new server
 * @returns New proxy server configuration
 */
export function refreshMCPProxyServer(
  currentServer: MCPProxyServer,
  options: MCPProxyServerOptions
): MCPProxyServer {
  return buildMCPProxyServer({
    ...options,
    name: currentServer.name,
  });
}