/**
 * @fileoverview MCPRegistry - Centralized registry for MCP (Model Context Protocol) server management
 *
 * This module provides a centralized registry for discovering, filtering, and managing
 * MCP servers in the APEX platform. It follows the established patterns from ToolRegistry
 * while being specifically designed for MCP server catalog management.
 *
 * ## Architecture Decision Record (ADR-024)
 *
 * ### Context
 * APEX needs to discover and manage MCP servers that provide additional capabilities
 * to agents. The system requires:
 * - Bundled server catalog with popular MCP servers
 * - Category-based filtering (filesystem, web, database, etc.)
 * - Capability-based searching
 * - Server configuration management
 * - Fast lookup and enumeration
 *
 * ### Decision
 * Implement an `MCPRegistry` class that:
 * 1. Loads server catalog from bundled JSON file
 * 2. Provides filtering by category and capabilities
 * 3. Supports search functionality across names and descriptions
 * 4. Uses the existing `MCPMarketplaceEntry` type for consistency
 * 5. Follows singleton pattern like ToolRegistry for consistency
 * 6. Supports both synchronous and asynchronous loading
 *
 * ### Consequences
 * - Centralized MCP server discovery and management
 * - Consistent API with existing registry patterns
 * - Easy integration with existing MCP configuration types
 * - Extensible for future marketplace integration
 *
 * @module @apex/core/mcp/mcp-registry
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { MCPMarketplaceEntry, MCPServerConfig } from '../types.js';

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when the MCP catalog cannot be loaded
 */
export class MCPCatalogLoadError extends Error {
  /** Path to the catalog file that failed to load */
  readonly catalogPath: string;
  /** Original error that caused the failure */
  readonly cause?: Error;

  constructor(catalogPath: string, cause?: Error) {
    super(`Failed to load MCP catalog from ${catalogPath}: ${cause?.message || 'Unknown error'}`);
    this.name = 'MCPCatalogLoadError';
    this.catalogPath = catalogPath;
    this.cause = cause;
  }
}

/**
 * Error thrown when MCP catalog validation fails
 */
export class MCPCatalogValidationError extends Error {
  /** Validation error details */
  readonly details: string[];

  constructor(details: string[]) {
    super(`MCP catalog validation failed: ${details.join('; ')}`);
    this.name = 'MCPCatalogValidationError';
    this.details = details;
  }
}

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Structure of the bundled MCP server catalog
 */
export interface MCPCatalog {
  /** Catalog version */
  version: string;
  /** Last updated timestamp */
  updated: string;
  /** Catalog description */
  description: string;
  /** Array of MCP server entries */
  servers: MCPMarketplaceEntry[];
  /** Category definitions */
  categories: Record<string, { name: string; description: string }>;
}

/**
 * Options for filtering MCP servers
 */
export interface MCPFilterOptions {
  /** Filter by category */
  category?: string;
  /** Filter by capabilities (all must be present) */
  capabilities?: string[];
  /** Filter by verification status */
  verified?: boolean;
  /** Search text (matches name or description) */
  search?: string;
}

/**
 * Options for creating MCPRegistry instance
 */
export interface MCPRegistryOptions {
  /** Custom path to catalog file */
  catalogPath?: string;
  /** Whether to validate catalog on load (default: true) */
  validateOnLoad?: boolean;
}

// ============================================================================
// MCPRegistry Class
// ============================================================================

/**
 * Centralized registry for MCP server discovery and management.
 *
 * The MCPRegistry provides a unified interface for discovering and filtering
 * MCP servers from a bundled catalog. It supports:
 * - Loading from bundled or custom catalog files
 * - Filtering by category, capabilities, and verification status
 * - Text search across server names and descriptions
 * - Fast lookup operations
 *
 * ## Usage
 *
 * ```typescript
 * // Get the singleton instance
 * const registry = MCPRegistry.getInstance();
 *
 * // List all servers
 * const allServers = registry.listServers();
 *
 * // Filter by category
 * const fileServers = registry.listServers({ category: 'filesystem' });
 *
 * // Search for servers
 * const gitServers = registry.listServers({ search: 'git' });
 *
 * // Find servers by capability
 * const httpServers = registry.listServers({ capabilities: ['http:get'] });
 *
 * // Get server configuration
 * const config = registry.getServerConfig('filesystem');
 * ```
 *
 * ## Thread Safety
 * The registry is designed for single-threaded Node.js environments.
 * The catalog is loaded once during initialization and remains immutable.
 */
export class MCPRegistry {
  /** Singleton instance */
  private static instance: MCPRegistry | null = null;

  /** Loaded catalog data */
  private readonly catalog: MCPCatalog;

  /** Map for fast server lookup by name */
  private readonly serversByName: Map<string, MCPMarketplaceEntry>;

  /** Map for servers grouped by category */
  private readonly serversByCategory: Map<string, MCPMarketplaceEntry[]>;

  /** Registry options */
  private readonly options: Required<MCPRegistryOptions>;

  /**
   * Private constructor to enforce singleton pattern.
   * Use `MCPRegistry.getInstance()` to get the singleton instance.
   *
   * @param options - Optional configuration options
   */
  private constructor(options: MCPRegistryOptions = {}) {
    this.options = {
      catalogPath: options.catalogPath ?? this.getDefaultCatalogPath(),
      validateOnLoad: options.validateOnLoad ?? true,
    };

    // Load and validate catalog
    this.catalog = this.loadCatalog();
    if (this.options.validateOnLoad) {
      this.validateCatalog();
    }

    // Build lookup maps
    this.serversByName = new Map();
    this.serversByCategory = new Map();
    this.buildLookupMaps();
  }

  /**
   * Gets the singleton instance of MCPRegistry.
   *
   * @param options - Optional configuration options (only used on first call)
   * @returns The singleton MCPRegistry instance
   *
   * @example
   * ```typescript
   * const registry = MCPRegistry.getInstance();
   * ```
   */
  static getInstance(options?: MCPRegistryOptions): MCPRegistry {
    if (MCPRegistry.instance === null) {
      MCPRegistry.instance = new MCPRegistry(options);
    }
    return MCPRegistry.instance;
  }

  /**
   * Resets the singleton instance.
   *
   * **Warning**: This should only be used in testing scenarios.
   * Calling this in production code may lead to inconsistent state.
   */
  static resetInstance(): void {
    MCPRegistry.instance = null;
  }

  // ==========================================================================
  // Core Registry Methods
  // ==========================================================================

  /**
   * Lists all MCP servers matching the given filter criteria.
   *
   * @param filter - Optional filter criteria
   * @returns Array of matching MCP server entries
   *
   * @example
   * ```typescript
   * // List all servers
   * const allServers = registry.listServers();
   *
   * // Filter by category
   * const webServers = registry.listServers({ category: 'web' });
   *
   * // Search by name/description
   * const gitServers = registry.listServers({ search: 'git' });
   *
   * // Filter by capabilities
   * const httpServers = registry.listServers({ capabilities: ['http:get', 'http:post'] });
   * ```
   */
  listServers(filter: MCPFilterOptions = {}): MCPMarketplaceEntry[] {
    let servers = this.catalog.servers;

    // Filter by category
    if (filter.category) {
      const categoryServers = this.serversByCategory.get(filter.category);
      if (!categoryServers) {
        return [];
      }
      servers = categoryServers;
    }

    // Filter by verification status
    if (filter.verified !== undefined) {
      servers = servers.filter(server => server.verified === filter.verified);
    }

    // Filter by capabilities
    if (filter.capabilities && filter.capabilities.length > 0) {
      servers = servers.filter(server => {
        const serverCapabilities = server.capabilities || [];
        return filter.capabilities!.every(cap => serverCapabilities.includes(cap));
      });
    }

    // Filter by search text
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      servers = servers.filter(
        server =>
          server.name.toLowerCase().includes(searchLower) ||
          server.description.toLowerCase().includes(searchLower)
      );
    }

    return servers;
  }

  /**
   * Gets a specific MCP server by name.
   *
   * @param name - Name of the server to retrieve
   * @returns The server entry, or null if not found
   *
   * @example
   * ```typescript
   * const fileServer = registry.getServer('filesystem');
   * if (fileServer) {
   *   console.log(fileServer.description);
   * }
   * ```
   */
  getServer(name: string): MCPMarketplaceEntry | null {
    return this.serversByName.get(name) || null;
  }

  /**
   * Gets the server configuration for a specific MCP server.
   *
   * @param name - Name of the server
   * @returns The server configuration, or null if not found
   *
   * @example
   * ```typescript
   * const config = registry.getServerConfig('filesystem');
   * if (config) {
   *   // Use config to start the server
   *   console.log(`Command: ${config.command} ${config.args?.join(' ')}`);
   * }
   * ```
   */
  getServerConfig(name: string): MCPServerConfig | null {
    const server = this.getServer(name);
    return server ? server.serverConfig : null;
  }

  /**
   * Checks if a server exists in the registry.
   *
   * @param name - Name of the server to check
   * @returns True if the server exists, false otherwise
   *
   * @example
   * ```typescript
   * if (registry.hasServer('filesystem')) {
   *   // Server is available
   * }
   * ```
   */
  hasServer(name: string): boolean {
    return this.serversByName.has(name);
  }

  /**
   * Gets all available categories.
   *
   * @returns Array of category names with their metadata
   *
   * @example
   * ```typescript
   * const categories = registry.getCategories();
   * categories.forEach(cat => {
   *   console.log(`${cat.name}: ${cat.description}`);
   * });
   * ```
   */
  getCategories(): Array<{ id: string; name: string; description: string }> {
    return Object.entries(this.catalog.categories).map(([id, category]) => ({
      id,
      name: category.name,
      description: category.description,
    }));
  }

  /**
   * Gets servers by category.
   *
   * @param category - The category to retrieve servers for
   * @returns Array of servers in the specified category
   *
   * @example
   * ```typescript
   * const webServers = registry.getServersByCategory('web');
   * ```
   */
  getServersByCategory(category: string): MCPMarketplaceEntry[] {
    return this.serversByCategory.get(category) || [];
  }

  /**
   * Searches for servers by capability.
   *
   * @param capability - The capability to search for
   * @returns Array of servers that have the specified capability
   *
   * @example
   * ```typescript
   * const fileServers = registry.getServersByCapability('file:read');
   * ```
   */
  getServersByCapability(capability: string): MCPMarketplaceEntry[] {
    return this.catalog.servers.filter(server => server.capabilities?.includes(capability));
  }

  /**
   * Gets all unique capabilities across all servers.
   *
   * @returns Sorted array of all available capabilities
   *
   * @example
   * ```typescript
   * const capabilities = registry.getAllCapabilities();
   * console.log('Available capabilities:', capabilities.join(', '));
   * ```
   */
  getAllCapabilities(): string[] {
    const capabilities = new Set<string>();
    this.catalog.servers.forEach(server => {
      server.capabilities?.forEach(cap => capabilities.add(cap));
    });
    return Array.from(capabilities).sort();
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Gets the count of registered servers.
   *
   * @returns The number of servers in the catalog
   */
  get size(): number {
    return this.catalog.servers.length;
  }

  /**
   * Gets catalog metadata.
   *
   * @returns Catalog version and update information
   */
  getCatalogInfo(): { version: string; updated: string; description: string } {
    return {
      version: this.catalog.version,
      updated: this.catalog.updated,
      description: this.catalog.description,
    };
  }

  /**
   * Gets all server names.
   *
   * @returns Array of all server names in the catalog
   */
  getServerNames(): string[] {
    return Array.from(this.serversByName.keys()).sort();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Gets the default path to the bundled catalog file.
   *
   * @returns Absolute path to the catalog.json file
   */
  private getDefaultCatalogPath(): string {
    // ES module equivalent of __dirname
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    return resolve(__dirname, 'catalog.json');
  }

  /**
   * Loads the MCP catalog from the specified file.
   *
   * @returns The loaded catalog data
   * @throws {MCPCatalogLoadError} If the catalog cannot be loaded or parsed
   */
  private loadCatalog(): MCPCatalog {
    try {
      const catalogData = readFileSync(this.options.catalogPath, 'utf-8');
      return JSON.parse(catalogData) as MCPCatalog;
    } catch (error) {
      throw new MCPCatalogLoadError(
        this.options.catalogPath,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Validates the loaded catalog structure.
   *
   * @throws {MCPCatalogValidationError} If validation fails
   */
  private validateCatalog(): void {
    const errors: string[] = [];

    // Validate required fields
    if (!this.catalog.version) {
      errors.push('Catalog version is required');
    }
    if (!this.catalog.servers || !Array.isArray(this.catalog.servers)) {
      errors.push('Catalog must have a servers array');
    }
    if (!this.catalog.categories) {
      errors.push('Catalog must have categories object');
    }

    // Validate servers
    if (Array.isArray(this.catalog.servers)) {
      this.catalog.servers.forEach((server, index) => {
        if (!server.name) {
          errors.push(`Server at index ${index} missing name`);
        }
        if (!server.description) {
          errors.push(`Server ${server.name || index} missing description`);
        }
        if (!server.serverConfig) {
          errors.push(`Server ${server.name || index} missing serverConfig`);
        }
      });
    }

    if (errors.length > 0) {
      throw new MCPCatalogValidationError(errors);
    }
  }

  /**
   * Builds lookup maps for fast access.
   */
  private buildLookupMaps(): void {
    // Build name lookup map
    this.catalog.servers.forEach(server => {
      this.serversByName.set(server.name, server);
    });

    // Build category lookup map
    this.catalog.servers.forEach(server => {
      // Use the serverConfig category or fall back to a default/inferred category
      const category = server.serverConfig.name || 'uncategorized';

      // Infer category from capabilities if not explicitly set
      let inferredCategory = 'uncategorized';
      if (server.capabilities) {
        if (server.capabilities.some(cap => cap.startsWith('file:') || cap.startsWith('directory:'))) {
          inferredCategory = 'filesystem';
        } else if (server.capabilities.some(cap => cap.startsWith('http:') || cap.startsWith('browser:'))) {
          inferredCategory = 'web';
        } else if (server.capabilities.some(cap => cap.startsWith('git:'))) {
          inferredCategory = 'development';
        } else if (server.capabilities.some(cap => cap.startsWith('db:') || cap.startsWith('sql:'))) {
          inferredCategory = 'database';
        } else if (server.capabilities.some(cap => cap.startsWith('shell:') || cap.startsWith('process:') || cap.startsWith('docker:'))) {
          inferredCategory = 'system';
        } else if (server.capabilities.some(cap => cap.startsWith('search:'))) {
          inferredCategory = 'search';
        }
      }

      const serverCategory = (server as MCPMarketplaceEntry & { category?: string }).category || inferredCategory;

      if (!this.serversByCategory.has(serverCategory)) {
        this.serversByCategory.set(serverCategory, []);
      }
      this.serversByCategory.get(serverCategory)!.push(server);
    });
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Gets the global MCPRegistry instance.
 *
 * This is a convenience function equivalent to `MCPRegistry.getInstance()`.
 *
 * @returns The singleton MCPRegistry instance
 */
export function getMCPRegistry(): MCPRegistry {
  return MCPRegistry.getInstance();
}

/**
 * Lists MCP servers with optional filtering.
 *
 * This is a convenience function equivalent to `MCPRegistry.getInstance().listServers(filter)`.
 *
 * @param filter - Optional filter criteria
 * @returns Array of matching MCP server entries
 */
export function listMCPServers(filter?: MCPFilterOptions): MCPMarketplaceEntry[] {
  return getMCPRegistry().listServers(filter);
}

/**
 * Gets a specific MCP server by name.
 *
 * This is a convenience function equivalent to `MCPRegistry.getInstance().getServer(name)`.
 *
 * @param name - Name of the server to retrieve
 * @returns The server entry, or null if not found
 */
export function getMCPServer(name: string): MCPMarketplaceEntry | null {
  return getMCPRegistry().getServer(name);
}

/**
 * Gets server configuration by name.
 *
 * This is a convenience function equivalent to `MCPRegistry.getInstance().getServerConfig(name)`.
 *
 * @param name - Name of the server
 * @returns The server configuration, or null if not found
 */
export function getMCPServerConfig(name: string): MCPServerConfig | null {
  return getMCPRegistry().getServerConfig(name);
}
