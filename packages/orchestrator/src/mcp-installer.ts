import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { promises as fs } from 'fs';
import {
  MCPServerConfig,
  MCPMarketplaceEntry,
  MCPInstallation,
  MCPInstallationStatus,
  MCPServer,
} from '@apexcli/core';
import { TaskStore } from './store';

const execAsync = promisify(exec);


export interface MCPInstallationOptions {
  /** Force reinstallation even if already installed */
  force?: boolean;
  /** Additional arguments to pass to npm/npx */
  args?: string[];
  /** Environment variables for the installation process */
  env?: Record<string, string>;
  /** Whether to install globally (npm -g flag) */
  global?: boolean;
}

/**
 * Enhanced MCP server installer that provides one-click installation with SQLite tracking
 * Supports npm/npx-based installations and marketplace installations
 */
export class MCPInstaller {
  private store: TaskStore;
  private projectPath: string;

  constructor(projectPath: string, store: TaskStore) {
    this.projectPath = projectPath;
    this.store = store;
  }

  /**
   * Install an MCP server from various sources
   */
  async install(
    server: MCPServer,
    options: MCPInstallationOptions = {}
  ): Promise<MCPInstallation> {
    // Check if already installed
    const existing = await this.getInstallation(server.name);
    if (existing && !options.force) {
      throw new Error(`MCP server '${server.name}' is already installed. Use force option to reinstall.`);
    }

    // Generate installation ID and install server
    const installationId = this.generateInstallationId();

    try {
      // Execute the installation command based on server config
      await this.executeInstallation(server, options);

      // Create the installation record
      const installation: MCPInstallation = {
        id: installationId,
        serverId: server.name,
        installedAt: new Date(),
        status: 'installed' as MCPInstallationStatus,
        configPath: await this.createConfigFile(server, installationId),
      };

      // Store the installation record
      await this.store.createMcpInstallation(installation);

      return installation;
    } catch (error) {
      throw new Error(`Failed to install MCP server '${server.name}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute the installation command for an MCP server
   */
  private async executeInstallation(
    server: MCPServer,
    options: MCPInstallationOptions = {}
  ): Promise<void> {
    // Build installation command based on server configuration
    const command = this.buildInstallCommand(server, options);
    const env = { ...process.env, ...options.env };

    await execAsync(command, {
      cwd: this.projectPath,
      env,
    });
  }

  /**
   * Create configuration file for installed server
   */
  private async createConfigFile(
    server: MCPServer,
    installationId: string
  ): Promise<string> {
    const apexDir = path.join(this.projectPath, '.apex');
    const configPath = path.join(apexDir, 'mcp-installations', `${installationId}.json`);

    // Ensure the mcp-installations directory exists
    const installationsDir = path.dirname(configPath);
    await fs.mkdir(installationsDir, { recursive: true });

    // Create server configuration based on MCPServer
    const serverConfig: MCPServerConfig = {
      name: server.name,
      type: 'stdio',
      command: server.command,
      args: server.args,
      autoStart: false,
    };

    // Write configuration file
    await fs.writeFile(configPath, JSON.stringify(serverConfig, null, 2), 'utf-8');

    return configPath;
  }

  /**
   * Uninstall an MCP server
   */
  async uninstall(serverId: string): Promise<void> {
    const installation = await this.getInstallation(serverId);
    if (!installation) {
      throw new Error(`MCP server '${serverId}' is not installed`);
    }

    try {
      // Remove configuration file
      await this.removeConfigFile(installation.configPath);

      // Remove installation record from SQLite
      await this.store.removeMcpInstallation(installation.id);

      // Note: We don't automatically uninstall npm packages as they might be used by other projects
      // Users would need to run npm uninstall manually if desired
    } catch (error) {
      throw new Error(`Failed to uninstall MCP server '${serverId}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List all installed MCP servers
   */
  async listInstalled(): Promise<MCPInstallation[]> {
    return this.store.listMcpInstallations();
  }

  /**
   * Get information about a specific installed server
   */
  async getInstallation(serverId: string): Promise<MCPInstallation | null> {
    return this.store.getMcpInstallation(serverId);
  }

  /**
   * Check if a server is installed
   */
  async isInstalled(serverId: string): Promise<boolean> {
    const installation = await this.getInstallation(serverId);
    return installation !== null;
  }

  /**
   * Update marketplace cache
   */
  async updateMarketplaceCache(entries: MCPMarketplaceEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.store.upsertMcpMarketplaceEntry(entry);
    }
  }

  /**
   * Get marketplace entries
   */
  async getMarketplaceEntries(): Promise<MCPMarketplaceEntry[]> {
    return this.store.listMcpMarketplaceEntries();
  }

  // Private helper methods

  /**
   * Generate a unique installation ID
   */
  private generateInstallationId(): string {
    return `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Build the installation command for an MCP server
   */
  private buildInstallCommand(server: MCPServer, options: MCPInstallationOptions): string {
    // For now, we assume the server has a package name that can be installed via npm/npx
    // In the future, this could be expanded to support other installation methods
    const parts = ['npm', 'install'];

    if (options.global) {
      parts.push('-g');
    }

    // Use the command as package name if it looks like a package
    const packageName = this.extractPackageName(server);
    parts.push(packageName);

    if (options.args && options.args.length > 0) {
      parts.push(...options.args);
    }

    return parts.join(' ');
  }

  /**
   * Extract a package name from an MCP server definition
   */
  private extractPackageName(server: MCPServer): string {
    // If args are provided and command is npx, use first arg as package name
    if (server.command === 'npx' && server.args && server.args.length > 0) {
      return server.args[0];
    }

    // If command looks like a scoped package, use it
    if (server.command.startsWith('@')) {
      return server.command;
    }

    // Default to server name
    return server.name;
  }

  /**
   * Remove configuration file for an uninstalled server
   */
  private async removeConfigFile(configPath: string): Promise<void> {
    try {
      await fs.unlink(configPath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as any)?.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}