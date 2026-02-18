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

/**
 * Tracks the state of a partial installation for rollback purposes
 */
interface RollbackState {
  /** Whether the npm package was successfully installed */
  packageInstalled: boolean;
  /** Path to the config file if it was successfully created */
  configPath?: string;
  /** Installation ID if it was stored in the database */
  installationId?: string;
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
  /** Specific version to install (e.g., "1.2.3", "^1.0.0", "latest") */
  version?: string;
}

/**
 * Result returned from install operations, providing server details and config
 */
export interface InstalledMCPResult {
  /** Server name */
  name: string;
  /** Server configuration (command, args, env, etc.) */
  config: MCPServerConfig;
  /** How the server was installed */
  installedFrom: 'marketplace' | 'npx' | 'npm';
  /** When the server was installed */
  installedAt: Date;
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
   * Install an MCP server from various sources.
   * Accepts either an MCPServer object or a string name (for marketplace lookup).
   */
  async install(
    serverOrName: MCPServer | string,
    options: MCPInstallationOptions = {}
  ): Promise<InstalledMCPResult> {
    let server: MCPServer;
    let installedFrom: 'marketplace' | 'npx' | 'npm' = 'npm';

    if (typeof serverOrName === 'string') {
      // Lookup from marketplace
      const entry = await this.store.getMcpMarketplaceEntry(serverOrName);
      if (entry) {
        server = {
          name: entry.name,
          package: entry.serverConfig.command || entry.name,
          command: entry.serverConfig.command || 'npx',
          args: entry.serverConfig.args || [],
          env: entry.serverConfig.env || {},
          envVars: [],
          version: entry.version,
        };
        installedFrom = 'marketplace';
      } else {
        // Treat as npx package name
        server = {
          name: serverOrName,
          package: serverOrName,
          command: 'npx',
          args: [serverOrName],
          env: {},
          envVars: [],
          version: 'latest',
        };
        installedFrom = 'npx';
      }
    } else {
      server = serverOrName;
      installedFrom = 'npm';
    }

    // Check if already installed
    const existing = await this.getInstallation(server.name);
    if (existing && !options.force) {
      throw new Error(`MCP server '${server.name}' is already installed. Use force option to reinstall.`);
    }

    const installationId = this.generateInstallationId();
    const rollbackState: RollbackState = {
      packageInstalled: false,
      configPath: undefined,
      installationId: undefined,
    };

    const serverConfig: MCPServerConfig = {
      name: server.name,
      type: 'stdio',
      command: server.command,
      args: server.args,
      autoStart: false,
    };

    try {
      // Step 1: Execute npm install
      await this.executeInstallation(server, options);
      rollbackState.packageInstalled = true;

      // Step 2: Create config file
      const configPath = await this.createConfigFile(server, installationId);
      rollbackState.configPath = configPath;

      // Step 3: Store installation record
      const installation: MCPInstallation & { installedFrom: string; configJson: string } = {
        id: installationId,
        serverId: server.name,
        installedAt: new Date(),
        status: 'installed' as MCPInstallationStatus,
        configPath,
        installedFrom,
        configJson: JSON.stringify(serverConfig),
      };
      await this.store.createMcpInstallation(installation);
      rollbackState.installationId = installationId;

      return {
        name: server.name,
        config: serverConfig,
        installedFrom,
        installedAt: installation.installedAt,
      };
    } catch (error) {
      // Rollback any partial state
      await this.rollbackInstallation(server, options, rollbackState);
      throw new Error(
        `Failed to install MCP server '${server.name}': ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Install an MCP server directly from an npm package name.
   * Creates the server definition and installs via npx.
   */
  async installFromNpm(
    packageName: string,
    options: MCPInstallationOptions = {}
  ): Promise<InstalledMCPResult> {
    const serverName = this.extractServerName(packageName);
    const installedFrom: 'npm' | 'npx' = options.global ? 'npm' : 'npx';

    const server: MCPServer = {
      name: serverName,
      package: packageName,
      command: 'npx',
      args: [packageName],
      env: {},
      envVars: [],
      version: options.version || 'latest',
    };

    // Check if already installed
    const existing = await this.getInstallation(serverName);
    if (existing && !options.force) {
      throw new Error(`MCP server '${serverName}' is already installed. Use force option to reinstall.`);
    }

    const installationId = this.generateInstallationId();
    const rollbackState: RollbackState = {
      packageInstalled: false,
      configPath: undefined,
      installationId: undefined,
    };

    const serverConfig: MCPServerConfig = {
      name: serverName,
      type: 'stdio',
      command: 'npx',
      args: [packageName],
      autoStart: false,
    };

    try {
      await this.executeInstallation(server, options);
      rollbackState.packageInstalled = true;

      const configPath = await this.createConfigFile(server, installationId);
      rollbackState.configPath = configPath;

      const installation: MCPInstallation & { installedFrom: string; configJson: string } = {
        id: installationId,
        serverId: serverName,
        installedAt: new Date(),
        status: 'installed' as MCPInstallationStatus,
        configPath,
        installedFrom,
        configJson: JSON.stringify(serverConfig),
      };
      await this.store.createMcpInstallation(installation);
      rollbackState.installationId = installationId;

      return {
        name: serverName,
        config: serverConfig,
        installedFrom,
        installedAt: installation.installedAt,
      };
    } catch (error) {
      await this.rollbackInstallation(server, options, rollbackState);
      throw new Error(
        `Failed to install MCP server '${serverName}': ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Extract a short server name from a package name.
   * E.g., "@modelcontextprotocol/server-filesystem" → "filesystem"
   */
  private extractServerName(packageName: string): string {
    let name = packageName;
    // Remove scope (e.g., @scope/package → package)
    if (name.startsWith('@') && name.includes('/')) {
      name = name.split('/').pop()!;
    }
    // Remove common "server-" prefix
    if (name.startsWith('server-')) {
      name = name.substring('server-'.length);
    }
    // Remove common "mcp-server-" prefix
    if (name.startsWith('mcp-server-')) {
      name = name.substring('mcp-server-'.length);
    }
    return name;
  }

  /**
   * Get details about an installed server by name.
   */
  async getInstalledServer(name: string): Promise<InstalledMCPResult | null> {
    const installation = await this.store.getMcpInstallation(name);
    if (!installation) return null;

    let config: MCPServerConfig;
    if (installation.configJson) {
      config = JSON.parse(installation.configJson);
    } else {
      // Fallback: read from config file
      try {
        const content = await fs.readFile(installation.configPath, 'utf-8');
        config = JSON.parse(content);
      } catch {
        config = { name, type: 'stdio', command: name, autoStart: false };
      }
    }

    return {
      name: installation.serverId,
      config,
      installedFrom: (installation.installedFrom || 'npm') as 'marketplace' | 'npx' | 'npm',
      installedAt: installation.installedAt,
    };
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
  async listInstalled(): Promise<InstalledMCPResult[]> {
    const installations = await this.store.listMcpInstallations();
    return installations.map((inst) => {
      let config: MCPServerConfig;
      if (inst.configJson) {
        config = JSON.parse(inst.configJson);
      } else {
        config = { name: inst.serverId, type: 'stdio', command: inst.serverId, autoStart: false };
      }
      return {
        name: inst.serverId,
        config,
        installedFrom: (inst.installedFrom || 'npm') as 'marketplace' | 'npx' | 'npm',
        installedAt: inst.installedAt,
      };
    });
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
   * Verify that an installation is in a consistent state:
   * - Installation record exists in database
   * - Config file exists on disk
   * - Config file contains valid JSON
   */
  async verifyInstallation(serverId: string): Promise<boolean> {
    const installation = await this.getInstallation(serverId);
    if (!installation) return false;

    try {
      await fs.access(installation.configPath);
      const content = await fs.readFile(installation.configPath, 'utf-8');
      JSON.parse(content); // Verify valid JSON
      return true;
    } catch {
      return false;
    }
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
   * Rollback a partial installation by cleaning up state in reverse order.
   * This is best-effort: individual rollback steps may fail without
   * preventing other rollback steps from executing.
   */
  private async rollbackInstallation(
    server: MCPServer,
    options: MCPInstallationOptions,
    state: RollbackState
  ): Promise<void> {
    const errors: Error[] = [];

    // Step 3 rollback: Remove database record (reverse of step 4)
    if (state.installationId) {
      try {
        await this.store.removeMcpInstallation(state.installationId);
      } catch (e) {
        errors.push(e as Error);
      }
    }

    // Step 2 rollback: Remove config file (reverse of step 3)
    if (state.configPath) {
      try {
        await this.removeConfigFile(state.configPath);
      } catch (e) {
        errors.push(e as Error);
      }
    }

    // Step 1 rollback: Uninstall npm package (reverse of step 2)
    if (state.packageInstalled) {
      try {
        await this.executeUninstallCommand(server, options);
      } catch (e) {
        errors.push(e as Error);
      }
    }

    // Rollback errors are logged but not thrown - this is best-effort cleanup
    if (errors.length > 0) {
      // Future: could emit a warning event
      // For now, we silently swallow rollback errors to ensure original error propagates
    }
  }

  /**
   * Execute npm uninstall for the given server package.
   * Used during rollback to remove packages that were installed
   * before a subsequent step failed.
   */
  private async executeUninstallCommand(
    server: MCPServer,
    options: MCPInstallationOptions
  ): Promise<void> {
    const packageName = this.extractPackageName(server);
    const parts = ['npm', 'uninstall'];
    if (options.global) {
      parts.push('-g');
    }
    parts.push(packageName);

    await execAsync(parts.join(' '), {
      cwd: this.projectPath,
      env: { ...process.env, ...options.env },
    });
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