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
  /** Specific version to install (e.g., "1.2.3", "^1.0.0", "latest") */
  version?: string;
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

  /**
   * Parse a semantic version string into its components
   */
  parseVersion(version: string): { major: number; minor: number; patch: number; prerelease?: string } {
    // Remove leading 'v' if present
    const cleanVersion = version.replace(/^v/, '');

    // Handle version ranges and special cases
    if (cleanVersion === 'latest' || cleanVersion === '*') {
      return { major: Infinity, minor: Infinity, patch: Infinity };
    }

    // Remove range prefixes (^, ~, >=, etc.)
    const versionCore = cleanVersion.replace(/^[\^~>=<]+/, '');

    // Parse semantic version (major.minor.patch[-prerelease][+build])
    // Build metadata is ignored for comparison per SemVer spec
    const match = versionCore.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([a-zA-Z0-9\-.]+))?(?:\+.*)?$/);
    if (!match) {
      throw new Error(`Invalid version format: ${version}`);
    }

    const [, majorStr, minorStr = '0', patchStr = '0', prerelease] = match;

    // Validate prerelease format if present
    if (prerelease && (prerelease.endsWith('.') || prerelease.endsWith('-'))) {
      throw new Error(`Invalid version format: ${version}`);
    }

    return {
      major: parseInt(majorStr, 10),
      minor: parseInt(minorStr, 10),
      patch: parseInt(patchStr, 10),
      prerelease: prerelease || undefined,
    };
  }

  /**
   * Compare two version strings using semantic versioning rules
   */
  compareVersions(version1: string, version2: string): number {
    const v1 = this.parseVersion(version1);
    const v2 = this.parseVersion(version2);

    // Compare major versions
    if (v1.major !== v2.major) {
      return v1.major - v2.major;
    }

    // Compare minor versions
    if (v1.minor !== v2.minor) {
      return v1.minor - v2.minor;
    }

    // Compare patch versions
    if (v1.patch !== v2.patch) {
      return v1.patch - v2.patch;
    }

    // Compare prerelease versions
    if (v1.prerelease && !v2.prerelease) {
      return -1; // Prerelease versions are less than normal versions
    }
    if (!v1.prerelease && v2.prerelease) {
      return 1;
    }
    if (v1.prerelease && v2.prerelease) {
      return v1.prerelease.localeCompare(v2.prerelease);
    }

    return 0; // Versions are equal
  }

  /**
   * Check if a version satisfies a version range
   */
  satisfiesRange(version: string, range: string): boolean {
    if (range === 'latest' || range === '*') {
      return true;
    }

    // Handle exact match
    if (!range.match(/^[\^~>=<]/)) {
      return this.compareVersions(version, range) === 0;
    }

    const rangeType = range.charAt(0);
    const targetVersion = range.slice(1);
    const comparison = this.compareVersions(version, targetVersion);

    switch (rangeType) {
      case '^': // Compatible release (same major version)
        const targetMajor = this.parseVersion(targetVersion).major;
        const versionMajor = this.parseVersion(version).major;
        return versionMajor === targetMajor && comparison >= 0;

      case '~': // Approximately equivalent (same major.minor)
        const targetParsed = this.parseVersion(targetVersion);
        const versionParsed = this.parseVersion(version);
        return versionParsed.major === targetParsed.major &&
               versionParsed.minor === targetParsed.minor &&
               comparison >= 0;

      case '>':
        if (range.startsWith('>=')) {
          const targetVersionForGte = range.slice(2);
          return this.compareVersions(version, targetVersionForGte) >= 0;
        }
        return comparison > 0;

      case '<':
        if (range.startsWith('<=')) {
          const targetVersionForLte = range.slice(2);
          return this.compareVersions(version, targetVersionForLte) <= 0;
        }
        return comparison < 0;

      default:
        return comparison === 0;
    }
  }

  /**
   * Resolve the latest version for a package
   */
  async resolveLatestVersion(packageName: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`npm view ${packageName} version --json`, {
        cwd: this.projectPath,
      });

      const result = JSON.parse(stdout.trim());
      return typeof result === 'string' ? result : result[result.length - 1];
    } catch (error) {
      throw new Error(`Failed to resolve latest version for ${packageName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get available versions for a package
   */
  async getAvailableVersions(packageName: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`npm view ${packageName} versions --json`, {
        cwd: this.projectPath,
      });

      const result = JSON.parse(stdout.trim());
      return Array.isArray(result) ? result : [result];
    } catch (error) {
      throw new Error(`Failed to get available versions for ${packageName}: ${error instanceof Error ? error.message : String(error)}`);
    }
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

    // Add version specification if provided
    const versionToInstall = options.version || server.version;
    if (versionToInstall && versionToInstall !== 'latest' && versionToInstall.trim() !== '') {
      parts.push(`${packageName}@${versionToInstall}`);
    } else {
      parts.push(packageName);
    }

    if (options.args && options.args.length > 0) {
      parts.push(...options.args);
    }

    return parts.join(' ');
  }

  /**
   * Extract a package name from an MCP server definition
   */
  private extractPackageName(server: MCPServer): string {
    // First priority: use the package field if available
    if ('package' in server && server.package) {
      return server.package;
    }

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