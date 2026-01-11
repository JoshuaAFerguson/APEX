import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { promises as fs } from 'fs';
import {
  MCPMarketplaceEntrySchema,
  MCPServerConfig,
  MCPConfig,
  type ApexConfig,
  saveConfig,
} from '@apexcli/core';
const execAsync = promisify(exec);

export interface MCPMarketplaceCache {
  entries: ReturnType<typeof MCPMarketplaceEntrySchema.array>['_type'];
  fetchedAt: number;
}

export class MCPServerManager {
  private projectPath: string;
  private config: ApexConfig;
  private marketplaceCache: MCPMarketplaceCache | null = null;

  constructor(projectPath: string, config: ApexConfig) {
    this.projectPath = projectPath;
    this.config = config;
  }

  updateConfig(config: ApexConfig): void {
    this.config = config;
  }

  listServers(): MCPServerConfig[] {
    const servers = this.config.mcp?.servers || {};
    return Object.values(servers);
  }

  getSdkServerConfigs(): Record<string, MCPServerConfig> {
    if (!this.config.mcp?.enabled) {
      return {};
    }
    const servers = this.config.mcp?.servers || {};
    const sdkConfigs: Record<string, MCPServerConfig> = {};
    for (const [name, serverConfig] of Object.entries(servers)) {
      const type = serverConfig.type ?? 'stdio';
      if (type === 'stdio' && !serverConfig.command) {
        continue;
      }
      if ((type === 'http' || type === 'sse') && !serverConfig.url) {
        continue;
      }
      if (type === 'sdk') {
        continue;
      }

      sdkConfigs[name] = {
        type,
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
        url: serverConfig.url,
        headers: serverConfig.headers,
        autoStart: serverConfig.autoStart,
        capabilities: serverConfig.capabilities,
        name: serverConfig.name ?? name,
      };
    }
    return sdkConfigs;
  }

  async listMarketplaceEntries(): Promise<ReturnType<typeof MCPMarketplaceEntrySchema.array>['_type']> {
    const source = this.config.mcp?.marketplace;
    if (!source?.enabled || !source.url) {
      return [];
    }

    const now = Date.now();
    if (this.marketplaceCache && (now - this.marketplaceCache.fetchedAt) < source.refreshIntervalMinutes * 60 * 1000) {
      return this.marketplaceCache.entries;
    }

    const entries = await this.fetchMarketplaceEntries(source.url);
    this.marketplaceCache = { entries, fetchedAt: now };
    return entries;
  }

  async installServer(name: string): Promise<MCPServerConfig> {
    const entries = await this.listMarketplaceEntries();
    const entry = entries.find(candidate => candidate.name === name);
    if (!entry) {
      throw new Error(`Marketplace entry not found: ${name}`);
    }

    if (entry.installCommand) {
      await execAsync(entry.installCommand, {
        cwd: this.projectPath,
        env: process.env,
      });
    }

    const mcpConfig: MCPConfig = this.config.mcp || { enabled: true, servers: {} };
    const updatedServers = {
      ...mcpConfig.servers,
      [entry.name]: entry.serverConfig,
    };
    const updatedConfig: ApexConfig = {
      ...this.config,
      mcp: {
        ...mcpConfig,
        servers: updatedServers,
      },
    };

    await saveConfig(this.projectPath, updatedConfig);
    this.config = updatedConfig;

    return entry.serverConfig;
  }

  private async fetchMarketplaceEntries(sourceUrl: string): Promise<ReturnType<typeof MCPMarketplaceEntrySchema.array>['_type']> {
    if (sourceUrl.startsWith('file://')) {
      const filePath = sourceUrl.replace('file://', '');
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parseMarketplaceEntries(content);
    }

    if (!sourceUrl.includes('://')) {
      const resolvedPath = path.resolve(this.projectPath, sourceUrl);
      const content = await fs.readFile(resolvedPath, 'utf-8');
      return this.parseMarketplaceEntries(content);
    }

    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Marketplace fetch failed (${response.status}): ${response.statusText}`);
    }
    const content = await response.text();
    return this.parseMarketplaceEntries(content);
  }

  private parseMarketplaceEntries(rawContent: string): ReturnType<typeof MCPMarketplaceEntrySchema.array>['_type'] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch (error) {
      throw new Error(`Invalid marketplace JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    const entries = Array.isArray(parsed) ? parsed : (parsed as any)?.entries;
    return MCPMarketplaceEntrySchema.array().parse(entries || []);
  }

  async uninstallServer(name: string): Promise<void> {
    const mcpConfig: MCPConfig = this.config.mcp || { enabled: true, servers: {} };

    if (!mcpConfig.servers || !mcpConfig.servers[name]) {
      throw new Error(`MCP server '${name}' is not installed`);
    }

    // Remove from configuration
    const { [name]: _, ...remainingServers } = mcpConfig.servers;

    const updatedConfig: ApexConfig = {
      ...this.config,
      mcp: {
        ...mcpConfig,
        servers: remainingServers,
      },
    };

    await saveConfig(this.projectPath, updatedConfig);
    this.config = updatedConfig;
  }

  async getServerStatus(name: string): Promise<{
    name: string;
    status: 'running' | 'stopped' | 'error';
    lastError?: string;
  }> {
    const servers = this.config.mcp?.servers || {};
    const serverConfig = servers[name];

    if (!serverConfig) {
      throw new Error(`MCP server '${name}' is not installed`);
    }

    // For now, return a basic status since we don't have runtime tracking
    // In a full implementation, this would check if the server process is running
    return {
      name,
      status: 'stopped', // Default to stopped until we have process management
    };
  }

  async startServer(name: string): Promise<void> {
    const servers = this.config.mcp?.servers || {};
    const serverConfig = servers[name];

    if (!serverConfig) {
      throw new Error(`MCP server '${name}' is not installed`);
    }

    // For now, this is a no-op since we don't have runtime server management
    // In a full implementation, this would start the server process
    console.log(`Starting MCP server: ${name}`);
  }

  async stopServer(name: string): Promise<void> {
    const servers = this.config.mcp?.servers || {};
    const serverConfig = servers[name];

    if (!serverConfig) {
      throw new Error(`MCP server '${name}' is not installed`);
    }

    // For now, this is a no-op since we don't have runtime server management
    // In a full implementation, this would stop the server process
    console.log(`Stopping MCP server: ${name}`);
  }
}
