import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { promises as fs } from 'fs';
import {
  MCPServerConfig,
  MCPMarketplaceEntry,
} from '@apexcli/core';
import { TaskStore } from './store';

const execAsync = promisify(exec);

export interface InstallationResult {
  name: string;
  config: MCPServerConfig;
  installedFrom: 'marketplace' | 'npm' | 'npx' | 'manual';
  installedAt: Date;
}

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
    nameOrPackage: string,
    options: MCPInstallationOptions = {}
  ): Promise<InstallationResult> {
    // First try to find in marketplace
    const marketplaceEntry = await this.store.getMcpMarketplaceEntry(nameOrPackage);

    if (marketplaceEntry) {
      return this.installFromMarketplace(marketplaceEntry, options);
    }

    // If not in marketplace, try to install as npm package
    return this.installFromNpm(nameOrPackage, options);
  }

  /**
   * Install an MCP server from the marketplace
   */
  private async installFromMarketplace(
    entry: MCPMarketplaceEntry,
    options: MCPInstallationOptions = {}
  ): Promise<InstallationResult> {
    const { name, serverConfig, installCommand } = entry;

    // Check if already installed
    const existing = await this.getInstalledServer(name);
    if (existing && !options.force) {
      throw new Error(`MCP server '${name}' is already installed. Use force option to reinstall.`);
    }

    try {
      // Run the install command if provided
      if (installCommand) {
        const env = { ...process.env, ...options.env };
        await execAsync(installCommand, {
          cwd: this.projectPath,
          env,
        });
      }

      // Store the server config in SQLite
      await this.store.upsertMcpServerConfig(name, serverConfig);

      const result: InstallationResult = {
        name,
        config: serverConfig,
        installedFrom: 'marketplace',
        installedAt: new Date(),
      };

      return result;
    } catch (error) {
      throw new Error(`Failed to install MCP server '${name}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Install an MCP server from npm/npx
   */
  async installFromNpm(
    packageName: string,
    options: MCPInstallationOptions = {}
  ): Promise<InstallationResult> {
    const serverName = this.extractServerName(packageName);

    // Check if already installed
    const existing = await this.getInstalledServer(serverName);
    if (existing && !options.force) {
      throw new Error(`MCP server '${serverName}' is already installed. Use force option to reinstall.`);
    }

    try {
      // Install the npm package
      const installCommand = this.buildNpmInstallCommand(packageName, options);
      const env = { ...process.env, ...options.env };

      await execAsync(installCommand, {
        cwd: this.projectPath,
        env,
      });

      // Try to detect the server configuration
      const serverConfig = await this.detectServerConfig(packageName, serverName);

      // Store the server config in SQLite
      await this.store.upsertMcpServerConfig(serverName, serverConfig);

      const result: InstallationResult = {
        name: serverName,
        config: serverConfig,
        installedFrom: options.global ? 'npm' : 'npx',
        installedAt: new Date(),
      };

      return result;
    } catch (error) {
      throw new Error(`Failed to install MCP server from npm '${packageName}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Uninstall an MCP server
   */
  async uninstall(name: string): Promise<void> {
    const server = await this.getInstalledServer(name);
    if (!server) {
      throw new Error(`MCP server '${name}' is not installed`);
    }

    try {
      // Remove from SQLite tracking
      await this.removeInstalledServer(name);

      // Note: We don't automatically uninstall npm packages as they might be used by other projects
      // Users would need to run npm uninstall manually if desired
    } catch (error) {
      throw new Error(`Failed to uninstall MCP server '${name}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List all installed MCP servers
   */
  async listInstalled(): Promise<InstallationResult[]> {
    const servers = await this.store.listMcpServerConfigs();

    return servers.map(({ name, config }) => ({
      name,
      config,
      installedFrom: this.guessInstallationSource(config),
      installedAt: new Date(), // We don't have the actual install date in current schema
    }));
  }

  /**
   * Get information about a specific installed server
   */
  async getInstalledServer(name: string): Promise<InstallationResult | null> {
    const servers = await this.store.listMcpServerConfigs();
    const server = servers.find(s => s.name === name);

    if (!server) {
      return null;
    }

    return {
      name: server.name,
      config: server.config,
      installedFrom: this.guessInstallationSource(server.config),
      installedAt: new Date(),
    };
  }

  /**
   * Check if a server is installed
   */
  async isInstalled(name: string): Promise<boolean> {
    const server = await this.getInstalledServer(name);
    return server !== null;
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

  private async removeInstalledServer(name: string): Promise<void> {
    // Since the current SQLite schema doesn't have a direct delete method,
    // we'll need to use direct SQL
    const db = this.store.getDatabase();
    const stmt = db.prepare('DELETE FROM mcp_servers WHERE name = ?');
    stmt.run(name);
  }

  private extractServerName(packageName: string): string {
    // Extract a reasonable server name from npm package name
    // e.g., "@modelcontextprotocol/server-filesystem" -> "filesystem"
    if (packageName.startsWith('@modelcontextprotocol/server-')) {
      return packageName.replace('@modelcontextprotocol/server-', '');
    }
    if (packageName.includes('/')) {
      return packageName.split('/').pop() || packageName;
    }
    if (packageName.startsWith('mcp-server-')) {
      return packageName.replace('mcp-server-', '');
    }
    return packageName;
  }

  private buildNpmInstallCommand(packageName: string, options: MCPInstallationOptions): string {
    const parts = ['npm', 'install'];

    if (options.global) {
      parts.push('-g');
    }

    parts.push(packageName);

    if (options.args && options.args.length > 0) {
      parts.push(...options.args);
    }

    return parts.join(' ');
  }

  private async detectServerConfig(packageName: string, serverName: string): Promise<MCPServerConfig> {
    // Basic server configuration detection
    // This is a simple implementation - in practice, you might want to:
    // 1. Check package.json for MCP configuration
    // 2. Look for standard MCP server patterns
    // 3. Provide interactive configuration

    const config: MCPServerConfig = {
      name: serverName,
      type: 'stdio',
      autoStart: false,
    };

    // Try to detect if it's a global install or npx-based
    if (packageName.startsWith('@')) {
      // Scoped package, likely use npx
      config.command = 'npx';
      config.args = [packageName];
    } else {
      // Regular package, try to detect binary name
      try {
        const { stdout } = await execAsync(`npm list -g ${packageName} --depth=0`, {
          cwd: this.projectPath,
        });
        if (stdout.includes(packageName)) {
          // Globally installed
          config.command = serverName;
        } else {
          // Use npx
          config.command = 'npx';
          config.args = [packageName];
        }
      } catch {
        // Fallback to npx
        config.command = 'npx';
        config.args = [packageName];
      }
    }

    return config;
  }

  private guessInstallationSource(config: MCPServerConfig): 'marketplace' | 'npm' | 'npx' | 'manual' {
    if (config.command === 'npx') {
      return 'npx';
    }
    if (config.command && !config.command.includes('/') && !config.command.includes('\\')) {
      // Looks like a global npm install
      return 'npm';
    }
    // Default to manual for other configurations
    return 'manual';
  }
}