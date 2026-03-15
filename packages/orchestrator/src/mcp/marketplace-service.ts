import { promises as fs, statSync, readdirSync, existsSync, readFileSync } from 'fs';
import * as path from 'path';
import {
  MCPMarketplaceEntry,
  MCPServerConfig,
  MCPMarketplaceEntrySchema,
  ApexConfig,
  saveConfig,
  getMCPServers,
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
   * Handles missing data file gracefully by returning empty marketplace data
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
      const validatedEntries = MCPMarketplaceEntrySchema.array().parse(parsed.entries || []);

      this.marketplaceData = {
        entries: validatedEntries,
        categories: parsed.categories || [],
        featured: parsed.featured || [],
      };

      return this.marketplaceData;
    } catch (error) {
      // Handle missing file or invalid data gracefully
      if (error instanceof Error && (error.message.includes('ENOENT') || error.message.includes('no such file'))) {
        console.warn('Marketplace data file not found, using empty marketplace data');
        this.marketplaceData = {
          entries: [],
          categories: [],
          featured: [],
        };
        return this.marketplaceData;
      }

      // Handle JSON parsing errors gracefully
      if (error instanceof SyntaxError) {
        console.warn('Invalid marketplace data format, using empty marketplace data');
        this.marketplaceData = {
          entries: [],
          categories: [],
          featured: [],
        };
        return this.marketplaceData;
      }

      // Re-throw validation errors and other unexpected errors
      throw new Error(`Failed to load marketplace data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all marketplace entries with filtering and search capabilities
   * Handles edge cases like empty data, null capabilities, and invalid filter values
   */
  async getMarketplaceEntries(options?: {
    category?: string;
    search?: string;
    featured?: boolean;
    verified?: boolean;
  }): Promise<MCPMarketplaceEntry[]> {
    const data = await this.loadMarketplaceData();
    let entries = data.entries || [];

    // Handle empty data gracefully
    if (entries.length === 0) {
      return [];
    }

    // Apply category filter with null safety
    if (options?.category && options.category !== 'all' && options.category.trim() !== '') {
      const categoryLower = options.category.toLowerCase();
      entries = entries.filter(entry => {
        // Handle null/undefined capabilities arrays
        if (!entry.capabilities || !Array.isArray(entry.capabilities)) {
          return false;
        }
        return entry.capabilities.some(cap =>
          cap && typeof cap === 'string' && cap.toLowerCase().includes(categoryLower)
        );
      });
    }

    // Apply search filter with null safety
    if (options?.search && options.search.trim() !== '') {
      const searchTerm = options.search.toLowerCase();
      entries = entries.filter(entry => {
        if (!entry.name && !entry.description) {
          return false;
        }

        // Search in name (required field)
        const nameMatch = entry.name?.toLowerCase().includes(searchTerm) || false;

        // Search in description (required field)
        const descriptionMatch = entry.description?.toLowerCase().includes(searchTerm) || false;

        // Search in author (optional field)
        const authorMatch = entry.author?.toLowerCase().includes(searchTerm) || false;

        // Search in capabilities (optional field)
        const capabilitiesMatch = entry.capabilities?.some(cap =>
          cap && typeof cap === 'string' && cap.toLowerCase().includes(searchTerm)
        ) || false;

        return nameMatch || descriptionMatch || authorMatch || capabilitiesMatch;
      });
    }

    // Apply featured filter with null safety
    if (options?.featured === true) {
      const featuredList = data.featured || [];
      entries = entries.filter(entry => entry.name && featuredList.includes(entry.name));
    }

    // Apply verified filter
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
   * Provides detailed error feedback and ensures accurate configured/skipped/errors arrays
   */
  async autoConfigureStandardTools(options?: AutoConfigurationOptions): Promise<{
    configured: MCPServerConfig[];
    skipped: string[];
    errors: Array<{ name: string; error: string }>;
  }> {
    const configured: MCPServerConfig[] = [];
    const skipped: string[] = [];
    const errors: Array<{ name: string; error: string }> = [];

    try {
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
      if (options?.customServers && Array.isArray(options.customServers)) {
        // Validate custom server names
        const validCustomServers = options.customServers.filter(name =>
          name && typeof name === 'string' && name.trim() !== ''
        );
        serversToInstall.push(...validCustomServers);
      }

      // Default auto-configuration if no options provided
      if (!options || Object.keys(options).length === 0) {
        try {
          serversToInstall = this.getRecommendedServersForProject();
        } catch (projectDetectionError) {
          errors.push({
            name: 'project-detection',
            error: `Project detection failed: ${projectDetectionError instanceof Error ? projectDetectionError.message : String(projectDetectionError)}`
          });
          // Fallback to minimal basic tools
          serversToInstall = ['filesystem'];
        }
      }

      // Remove duplicates and validate server names
      serversToInstall = [...new Set(serversToInstall.filter(name =>
        name && typeof name === 'string' && name.trim() !== ''
      ))];

      if (serversToInstall.length === 0) {
        return { configured, skipped, errors: [{ name: 'configuration', error: 'No valid servers to configure' }] };
      }

      // Install each server
      for (const serverName of serversToInstall) {
        try {
          // Validate server name
          if (!serverName || typeof serverName !== 'string' || serverName.trim() === '') {
            errors.push({ name: serverName || 'unknown', error: 'Invalid server name' });
            continue;
          }

          // Check if already installed
          let currentServers;
          try {
            currentServers = getMCPServers(this.config) || {};
          } catch (configError) {
            errors.push({
              name: serverName,
              error: `Failed to read current MCP configuration: ${configError instanceof Error ? configError.message : String(configError)}`
            });
            continue;
          }

          if (currentServers[serverName]) {
            skipped.push(serverName);
            continue;
          }

          // Get marketplace entry
          let entry;
          try {
            entry = await this.getMarketplaceEntry(serverName);
          } catch (marketplaceError) {
            errors.push({
              name: serverName,
              error: `Failed to fetch marketplace entry: ${marketplaceError instanceof Error ? marketplaceError.message : String(marketplaceError)}`
            });
            continue;
          }

          if (!entry) {
            errors.push({ name: serverName, error: 'Server not found in marketplace' });
            continue;
          }

          if (!entry.serverConfig) {
            errors.push({ name: serverName, error: 'Server configuration missing in marketplace entry' });
            continue;
          }

          // Auto-configure with environment-specific settings
          let autoConfiguredServer;
          try {
            autoConfiguredServer = this.autoConfigureServer(entry.serverConfig);
          } catch (configError) {
            errors.push({
              name: serverName,
              error: `Failed to auto-configure server: ${configError instanceof Error ? configError.message : String(configError)}`
            });
            continue;
          }

          // Add to configuration
          try {
            const mcpConfig = this.config.mcp || { enabled: true, servers: {} };
            mcpConfig.servers = {
              ...currentServers,
              [serverName]: autoConfiguredServer,
            };

            this.config.mcp = mcpConfig;
            configured.push(autoConfiguredServer);
          } catch (mergeError) {
            errors.push({
              name: serverName,
              error: `Failed to merge server configuration: ${mergeError instanceof Error ? mergeError.message : String(mergeError)}`
            });
            continue;
          }
        } catch (serverError) {
          errors.push({
            name: serverName,
            error: `Unexpected error during server configuration: ${serverError instanceof Error ? serverError.message : String(serverError)}`
          });
        }
      }

      // Save configuration if any servers were configured
      if (configured.length > 0) {
        try {
          await saveConfig(this.projectPath, this.config);
        } catch (saveError) {
          // Move configured servers to errors since the save failed
          const saveErrorMessage = `Failed to save configuration: ${saveError instanceof Error ? saveError.message : String(saveError)}`;
          for (const server of configured) {
            errors.push({
              name: server.name || 'unknown',
              error: saveErrorMessage
            });
          }
          // Clear configured array since save failed
          return { configured: [], skipped, errors };
        }
      }

    } catch (generalError) {
      errors.push({
        name: 'auto-configuration',
        error: `Auto-configuration failed: ${generalError instanceof Error ? generalError.message : String(generalError)}`
      });
    }

    return { configured, skipped, errors };
  }

  /**
   * Get recommended servers based on comprehensive project analysis
   * Supports detection for common project types and development patterns
   */
  private getRecommendedServersForProject(): string[] {
    const recommended = ['filesystem']; // Always recommend filesystem access

    try {
      const fs = require('fs');

      // Detect Git repository
      const gitPath = path.join(this.projectPath, '.git');
      if (existsSync(gitPath)) {
        recommended.push('git');
      }

      // Detect Node.js projects
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      if (existsSync(packageJsonPath)) {
        recommended.push('github-integration');

        // Try to read package.json for more specific recommendations
        try {
          const packageContent = readFileSync(packageJsonPath, 'utf-8');
          const packageJson = JSON.parse(packageContent);

          // Check for specific frameworks and tools
          const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

          // React/Frontend projects
          if (dependencies.react || dependencies.vue || dependencies.angular) {
            recommended.push('browser-automation');
          }

          // Testing frameworks
          if (dependencies.jest || dependencies.mocha || dependencies.vitest || dependencies.playwright) {
            recommended.push('time-tracking'); // For test timing and productivity
          }

          // Database projects
          if (dependencies.mongoose || dependencies.sequelize || dependencies.prisma || dependencies['pg'] || dependencies.mysql) {
            recommended.push('database');
          }
        } catch (parseError) {
          console.warn('Could not parse package.json for enhanced detection');
        }
      }

      // Detect Python projects
      const pythonFiles = [
        path.join(this.projectPath, 'requirements.txt'),
        path.join(this.projectPath, 'pyproject.toml'),
        path.join(this.projectPath, 'setup.py'),
        path.join(this.projectPath, 'Pipfile'),
        path.join(this.projectPath, 'environment.yml')
      ];

      if (pythonFiles.some(file => existsSync(file))) {
        recommended.push('github-integration');
      }

      // Detect Java projects
      const javaFiles = [
        path.join(this.projectPath, 'pom.xml'),
        path.join(this.projectPath, 'build.gradle'),
        path.join(this.projectPath, 'build.gradle.kts')
      ];

      if (javaFiles.some(file => existsSync(file))) {
        recommended.push('github-integration');
      }

      // Detect Go projects
      const goFiles = [
        path.join(this.projectPath, 'go.mod'),
        path.join(this.projectPath, 'go.sum'),
        path.join(this.projectPath, 'Gopkg.toml')
      ];

      if (goFiles.some(file => existsSync(file))) {
        recommended.push('github-integration');
      }

      // Detect Rust projects
      const rustFiles = [
        path.join(this.projectPath, 'Cargo.toml'),
        path.join(this.projectPath, 'Cargo.lock')
      ];

      if (rustFiles.some(file => existsSync(file))) {
        recommended.push('github-integration');
      }

      // Detect Docker
      const dockerFiles = [
        path.join(this.projectPath, 'Dockerfile'),
        path.join(this.projectPath, 'docker-compose.yml'),
        path.join(this.projectPath, 'docker-compose.yaml')
      ];

      if (dockerFiles.some(file => existsSync(file))) {
        recommended.push('docker-management');
      }

      // Detect Kubernetes
      const k8sPaths = [
        path.join(this.projectPath, 'k8s'),
        path.join(this.projectPath, 'kubernetes'),
        path.join(this.projectPath, '.kube'),
        path.join(this.projectPath, 'manifests')
      ];

      if (k8sPaths.some(pathName => existsSync(pathName))) {
        recommended.push('kubernetes-operator');
      }

      // Detect CI/CD configurations
      const cicdPaths = [
        path.join(this.projectPath, '.github', 'workflows'),
        path.join(this.projectPath, '.gitlab-ci.yml'),
        path.join(this.projectPath, 'jenkinsfile'),
        path.join(this.projectPath, '.travis.yml'),
        path.join(this.projectPath, '.circleci')
      ];

      if (cicdPaths.some(pathName => existsSync(pathName))) {
        recommended.push('github-integration');
      }

      // Detect infrastructure as code
      const iacFiles = [
        path.join(this.projectPath, 'terraform'),
        path.join(this.projectPath, 'main.tf'),
        path.join(this.projectPath, 'cloudformation.yml'),
        path.join(this.projectPath, 'pulumi'),
        path.join(this.projectPath, 'ansible')
      ];

      if (iacFiles.some(file => existsSync(file))) {
        recommended.push('aws-integration');
      }

      // Detect documentation projects
      const docFiles = [
        path.join(this.projectPath, 'docs'),
        path.join(this.projectPath, 'documentation'),
        path.join(this.projectPath, 'mkdocs.yml'),
        path.join(this.projectPath, 'docsify'),
        path.join(this.projectPath, '_config.yml'), // Jekyll
        path.join(this.projectPath, 'docusaurus.config.js')
      ];

      if (docFiles.some(file => existsSync(file))) {
        recommended.push('notion-integration'); // For knowledge management
      }

      // Always recommend web search for general productivity
      recommended.push('web-search');

      // Detect if this is a large project (likely needs time tracking)
      try {
        const stats = statSync(this.projectPath);
        if (stats.isDirectory()) {
          // Simple heuristic: if there are many subdirectories, it's likely a complex project
          const items = readdirSync(this.projectPath);
          const directories = items.filter(item => {
            try {
              return statSync(path.join(this.projectPath, item)).isDirectory() &&
                     !item.startsWith('.') &&
                     item !== 'node_modules';
            } catch {
              return false;
            }
          });

          if (directories.length >= 3) {
            recommended.push('time-tracking');
          }
        }
      } catch (error) {
        console.warn('Could not analyze project complexity');
      }

    } catch (error) {
      // If detection fails, return basic set
      console.warn('Project detection failed:', error);
      return ['filesystem', 'web-search']; // Minimal fallback
    }

    // Remove duplicates and return
    return [...new Set(recommended)];
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