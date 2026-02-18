import * as path from 'path';
import { loadConfig, getMCPServers } from '@apexcli/core';
import { MCPServerConfig, ApexConfig } from '@apexcli/core';

/**
 * Service layer for MCP (Model Context Protocol) operations
 * Provides high-level functions for managing MCP server configurations
 */
export class McpService {
  private projectPath: string;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = path.resolve(projectPath);
  }

  /**
   * Get all installed MCP servers from the project configuration
   *
   * @returns Record of server configurations keyed by server name
   * @throws Error if APEX is not initialized or config loading fails
   */
  async getInstalledServers(): Promise<Record<string, MCPServerConfig>> {
    try {
      // Load the APEX configuration from .apex/config.yaml
      const config: ApexConfig = await loadConfig(this.projectPath);

      // Use the existing getMCPServers helper to normalize the server configs
      // This handles both array and record formats and returns an empty object if no servers
      return getMCPServers(config);
    } catch (error) {
      // If the error is about APEX not being initialized, re-throw with context
      if (error instanceof Error && error.message.includes('APEX not initialized')) {
        throw new Error(`Cannot read MCP servers: APEX not initialized in ${this.projectPath}. Run 'apex init' first.`);
      }

      // For other errors, wrap with context about MCP server reading
      throw new Error(`Failed to read MCP server configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if MCP is enabled in the project configuration
   *
   * @returns True if MCP is enabled (default), false if explicitly disabled
   * @throws Error if APEX is not initialized or config loading fails
   */
  async isMcpEnabled(): Promise<boolean> {
    try {
      const config: ApexConfig = await loadConfig(this.projectPath);
      // MCP is enabled by default if not specified
      return config.mcp?.enabled ?? true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('APEX not initialized')) {
        throw new Error(`Cannot check MCP status: APEX not initialized in ${this.projectPath}. Run 'apex init' first.`);
      }

      throw new Error(`Failed to check MCP configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a specific MCP server configuration by name
   *
   * @param serverName The name of the server to retrieve
   * @returns The server configuration if found, null otherwise
   * @throws Error if APEX is not initialized or config loading fails
   */
  async getServerConfig(serverName: string): Promise<MCPServerConfig | null> {
    const servers = await this.getInstalledServers();
    return servers[serverName] || null;
  }

  /**
   * Check if a specific MCP server is installed
   *
   * @param serverName The name of the server to check
   * @returns True if the server is configured, false otherwise
   * @throws Error if APEX is not initialized or config loading fails
   */
  async isServerInstalled(serverName: string): Promise<boolean> {
    const servers = await this.getInstalledServers();
    return serverName in servers;
  }

  /**
   * Get list of server names that are configured
   *
   * @returns Array of server names
   * @throws Error if APEX is not initialized or config loading fails
   */
  async getInstalledServerNames(): Promise<string[]> {
    const servers = await this.getInstalledServers();
    return Object.keys(servers);
  }
}