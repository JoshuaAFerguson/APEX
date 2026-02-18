/**
 * Example usage of McpService
 *
 * This file demonstrates how to use the McpService class to interact with
 * MCP server configurations in an APEX project.
 */

import { McpService } from './mcp-service.js';

async function exampleUsage() {
  // Create service instance - defaults to current working directory
  const mcpService = new McpService();

  // Or specify a custom project path
  // const mcpService = new McpService('/path/to/apex/project');

  try {
    // Check if MCP is enabled
    const isEnabled = await mcpService.isMcpEnabled();
    console.log('MCP enabled:', isEnabled);

    if (isEnabled) {
      // Get all configured MCP servers
      const servers = await mcpService.getInstalledServers();
      console.log('Configured servers:', Object.keys(servers));

      // Get server names as an array
      const serverNames = await mcpService.getInstalledServerNames();
      console.log('Server names:', serverNames);

      // Check if a specific server is installed
      const hasFileSystem = await mcpService.isServerInstalled('filesystem');
      console.log('Filesystem server installed:', hasFileSystem);

      // Get configuration for a specific server
      if (serverNames.length > 0) {
        const firstServerConfig = await mcpService.getServerConfig(serverNames[0]);
        console.log('First server config:', firstServerConfig);
      }

      // Handle case where no servers are configured
      if (serverNames.length === 0) {
        console.log('No MCP servers are currently configured.');
        console.log('You can add servers to .apex/config.yaml under the mcp.servers section.');
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('APEX not initialized')) {
      console.log('APEX project not found. Run "apex init" to initialize.');
    } else {
      console.error('Error accessing MCP configuration:', error);
    }
  }
}

// Example MCP server configuration that could be added to .apex/config.yaml:
/*
mcp:
  enabled: true
  servers:
    filesystem:
      name: filesystem
      type: stdio
      command: npx
      args: ['@modelcontextprotocol/server-filesystem']
      capabilities: ['read', 'write']
    git:
      name: git
      type: stdio
      command: mcp-server-git
      capabilities: ['git']
*/

export { exampleUsage };