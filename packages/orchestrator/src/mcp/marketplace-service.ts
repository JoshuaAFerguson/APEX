import { promises as fs } from 'fs';
import * as path from 'path';
import {
  MCPMarketplaceEntry,
  MCPServerConfig,
  MCPMarketplaceEntrySchema,
  ApexConfig,
  saveConfig,
} from '@apexcli/core';

export interface MarketplaceCategory {
  name: string;
  description: string;
  entries: string[]; // Entry names
}

export interface MarketplaceMetadata {
  entries: MCPMarketplaceEntry[];
  categories: string[];
  featured: string[];
}

export interface AutoConfigurationOptions {
  /** Auto-configure commonly used development tools */
  developmentTools?: boolean;
  /** Auto-configure productivity tools */
  productivityTools?: boolean;
  /** Auto-configure DevOps tools */
  devopsTools?: boolean;
  /** Custom server names to auto-configure */
  customServers?: string[];
}

/**
 * Enhanced MCP marketplace service that provides curated server discovery,
 * one-click installation, and auto-configuration for standard tools.
 */
export class MCPMarketplaceService {
  private projectPath: string;
  private config: ApexConfig;
  private marketplaceData: MarketplaceMetadata | null = null;

  // Predefined tool collections for auto-configuration
  private readonly toolCollections = {
    development: ['filesystem', 'git', 'github-integration', 'database'],
    productivity: ['time-tracking', 'calendar-integration', 'email-client', 'notion-integration'],
    devops: ['docker-management', 'kubernetes-operator', 'aws-integration'],
    communication: ['slack-integration', 'email-client'],
    webAutomation: ['browser-automation', 'web-search'],
  };

  constructor(projectPath: string, config: ApexConfig) {
    this.projectPath = projectPath;
    this.config = config;
  }

  /**
   * Load marketplace data from the bundled data file
   */
  async loadMarketplaceData(): Promise<MarketplaceMetadata> {
    if (this.marketplaceData) {
      return this.marketplaceData;
    }

    try {
      const dataPath = path.join(__dirname, 'marketplace-data.json');
      const content = await fs.readFile(dataPath, 'utf-8');
      const parsed = JSON.parse(content);

      // Validate the entries using Zod schema
      const validatedEntries = MCPMarketplaceEntrySchema.array().parse(parsed.entries);

      this.marketplaceData = {
        entries: validatedEntries,
        categories: parsed.categories || [],
        featured: parsed.featured || [],
      };

      return this.marketplaceData;
    } catch (error) {
      throw new Error(`Failed to load marketplace data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all marketplace entries with filtering and search capabilities
   */
  async getMarketplaceEntries(options?: {
    category?: string;
    search?: string;
    featured?: boolean;
    verified?: boolean;
  }): Promise<MCPMarketplaceEntry[]> {
    const data = await this.loadMarketplaceData();
    let entries = data.entries;

    // Apply filters
    if (options?.category && options.category !== 'all') {
      entries = entries.filter(entry =>
        entry.capabilities?.some(cap =>
          cap.toLowerCase().includes(options.category!.toLowerCase())
        )
      );
    }

    if (options?.search) {
      const searchTerm = options.search.toLowerCase();
      entries = entries.filter(entry =>
        entry.name.toLowerCase().includes(searchTerm) ||
        entry.description.toLowerCase().includes(searchTerm) ||
        entry.author?.toLowerCase().includes(searchTerm) ||
        entry.capabilities?.some(cap => cap.toLowerCase().includes(searchTerm))
      );
    }

    if (options?.featured) {
      entries = entries.filter(entry => data.featured.includes(entry.name));
    }

    if (options?.verified !== undefined) {
      entries = entries.filter(entry => entry.verified === options.verified);
    }

    return entries;
  }

  /**
   * Get marketplace entry by name
   */
  async getMarketplaceEntry(name: string): Promise<MCPMarketplaceEntry | null> {
    const data = await this.loadMarketplaceData();
    return data.entries.find(entry => entry.name === name) || null;
  }

  /**
   * Get marketplace categories with entry counts
   */
  async getCategories(): Promise<Array<{ name: string; count: number }>> {
    const data = await this.loadMarketplaceData();
    const categoryCounts = new Map<string, number>();

    // Count entries by capability tags
    for (const entry of data.entries) {
      if (entry.capabilities) {
        for (const capability of entry.capabilities) {
          const current = categoryCounts.get(capability) || 0;
          categoryCounts.set(capability, current + 1);
        }
      }
    }

    return Array.from(categoryCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get featured marketplace entries
   */
  async getFeaturedEntries(): Promise<MCPMarketplaceEntry[]> {
    const data = await this.loadMarketplaceData();
    return data.entries.filter(entry => data.featured.includes(entry.name));
  }

  /**
   * Auto-configure standard development tools based on project type detection
   */
  async autoConfigureStandardTools(options?: AutoConfigurationOptions): Promise<{
    configured: MCPServerConfig[];
    skipped: string[];
    errors: Array<{ name: string; error: string }>;
  }> {
    const configured: MCPServerConfig[] = [];
    const skipped: string[] = [];
    const errors: Array<{ name: string; error: string }> = [];

    let serversToInstall: string[] = [];

    // Determine which servers to install based on options
    if (options?.developmentTools) {
      serversToInstall.push(...this.toolCollections.development);
    }
    if (options?.productivityTools) {
      serversToInstall.push(...this.toolCollections.productivity);
    }
    if (options?.devopsTools) {
      serversToInstall.push(...this.toolCollections.devops);
    }
    if (options?.customServers) {
      serversToInstall.push(...options.customServers);
    }

    // Default auto-configuration if no options provided
    if (!options || Object.keys(options).length === 0) {
      serversToInstall = this.getRecommendedServersForProject();
    }

    // Remove duplicates
    serversToInstall = [...new Set(serversToInstall)];

    // Install each server
    for (const serverName of serversToInstall) {
      try {
        // Check if already installed
        const currentServers = this.config.mcp?.servers || {};
        if (currentServers[serverName]) {
          skipped.push(serverName);
          continue;
        }

        const entry = await this.getMarketplaceEntry(serverName);
        if (!entry) {
          errors.push({ name: serverName, error: 'Server not found in marketplace' });
          continue;
        }

        // Auto-configure with environment-specific settings
        const autoConfiguredServer = this.autoConfigureServer(entry.serverConfig);

        // Add to configuration
        const mcpConfig = this.config.mcp || { enabled: true, servers: {} };
        mcpConfig.servers = {
          ...mcpConfig.servers,
          [serverName]: autoConfiguredServer,
        };

        this.config.mcp = mcpConfig;
        configured.push(autoConfiguredServer);
      } catch (error) {
        errors.push({
          name: serverName,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Save configuration if any servers were configured
    if (configured.length > 0) {
      await saveConfig(this.projectPath, this.config);
    }

    return { configured, skipped, errors };
  }

  /**
   * Get recommended servers based on project analysis
   */
  private getRecommendedServersForProject(): string[] {
    const recommended = ['filesystem']; // Always recommend filesystem access

    try {
      // Detect Git repository
      const gitPath = path.join(this.projectPath, '.git');
      if (require('fs').existsSync(gitPath)) {
        recommended.push('git');
      }

      // Detect package.json (Node.js project)
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      if (require('fs').existsSync(packageJsonPath)) {
        recommended.push('github-integration');
      }

      // Detect Docker
      const dockerfilePath = path.join(this.projectPath, 'Dockerfile');
      if (require('fs').existsSync(dockerfilePath)) {
        recommended.push('docker-management');
      }

      // Detect Kubernetes
      const k8sPath = path.join(this.projectPath, 'k8s');
      if (require('fs').existsSync(k8sPath)) {
        recommended.push('kubernetes-operator');
      }

      // Always recommend web search for general productivity
      recommended.push('web-search');

    } catch (error) {
      // If detection fails, return basic set
      console.warn('Project detection failed:', error);
    }

    return recommended;
  }

  /**
   * Auto-configure server settings based on environment and project context
   */
  private autoConfigureServer(serverConfig: MCPServerConfig): MCPServerConfig {
    const configured = { ...serverConfig };

    // Auto-configure paths and arguments based on project
    switch (serverConfig.name) {
      case 'filesystem':
        // Configure with current project path
        configured.args = ['@modelcontextprotocol/server-filesystem', this.projectPath];
        break;

      case 'git':
        // Configure with current repository
        configured.args = ['@modelcontextprotocol/server-git', '--repository', this.projectPath];
        break;

      case 'docker-management':
        // Enable if Docker is available
        configured.autoStart = this.isDockerAvailable();
        break;

      case 'web-search':
        // Set up basic web search (without API key for now)
        configured.env = {
          ...configured.env,
          SEARCH_PROVIDER: 'duckduckgo', // Use free provider as default
        };
        break;

      default:
        // Keep default configuration
        break;
    }

    return configured;
  }

  /**
   * Check if Docker is available on the system
   */
  private isDockerAvailable(): boolean {
    try {
      require('child_process').execSync('docker --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate installation recommendations based on current setup
   */
  async getInstallationRecommendations(): Promise<{
    essential: MCPMarketplaceEntry[];
    recommended: MCPMarketplaceEntry[];
    optional: MCPMarketplaceEntry[];
  }> {
    const data = await this.loadMarketplaceData();
    const currentServers = Object.keys(this.config.mcp?.servers || {});

    // Essential tools for development
    const essentialNames = ['filesystem', 'git'];

    // Recommended based on project type
    const recommendedNames = this.getRecommendedServersForProject();

    // Optional tools that enhance productivity
    const optionalNames = ['web-search', 'time-tracking', 'slack-integration'];

    const essential = data.entries.filter(entry =>
      essentialNames.includes(entry.name) && !currentServers.includes(entry.name)
    );

    const recommended = data.entries.filter(entry =>
      recommendedNames.includes(entry.name) &&
      !essentialNames.includes(entry.name) &&
      !currentServers.includes(entry.name)
    );

    const optional = data.entries.filter(entry =>
      optionalNames.includes(entry.name) &&
      !recommendedNames.includes(entry.name) &&
      !currentServers.includes(entry.name)
    );

    return { essential, recommended, optional };
  }
}