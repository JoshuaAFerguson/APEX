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
import { resolve } from 'path';
import type { MCPMarketplaceEntry, MCPServerConfig } from '../types.js';

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error codes for specific MCP catalog failure scenarios
 */
export enum MCPCatalogErrorCode {
  FILE_NOT_FOUND = 'MCP_CATALOG_FILE_NOT_FOUND',
  FILE_READ_ERROR = 'MCP_CATALOG_FILE_READ_ERROR',
  JSON_PARSE_ERROR = 'MCP_CATALOG_JSON_PARSE_ERROR',
  SCHEMA_VALIDATION_ERROR = 'MCP_CATALOG_SCHEMA_VALIDATION_ERROR',
  SERVER_VALIDATION_ERROR = 'MCP_CATALOG_SERVER_VALIDATION_ERROR',
}

/**
 * Detailed validation error structure
 */
export interface ValidationErrorDetail {
  /** Path to invalid field (e.g., "servers[2].name") */
  field: string;
  /** Human-readable description */
  message: string;
  /** Whether it blocks loading */
  severity: 'error' | 'warning';
  /** How to fix it */
  suggestion?: string;
  /** Affected server (if applicable) */
  serverName?: string;
}

/**
 * Error thrown when the MCP catalog cannot be loaded
 */
export class MCPCatalogLoadError extends Error {
  /** Path to the catalog file that failed to load */
  readonly catalogPath: string;
  /** Original error that caused the failure */
  readonly cause?: Error;
  /** Specific error code for programmatic handling */
  readonly errorCode: MCPCatalogErrorCode;
  /** Actionable suggestions for fixing the error */
  readonly suggestions: string[];

  constructor(
    catalogPath: string,
    errorCodeOrCause?: MCPCatalogErrorCode | Error,
    cause?: Error,
    suggestions?: string[]
  ) {
    // Backward compatibility: support old constructor signature
    let errorCode: MCPCatalogErrorCode;
    let actualCause: Error | undefined;

    if (errorCodeOrCause === undefined) {
      // Old signature: (catalogPath) - no cause provided
      errorCode = MCPCatalogErrorCode.FILE_READ_ERROR;
      actualCause = undefined;
    } else if (typeof errorCodeOrCause === 'object' && errorCodeOrCause instanceof Error) {
      // Old signature: (catalogPath, cause)
      errorCode = MCPCatalogErrorCode.FILE_READ_ERROR;
      actualCause = errorCodeOrCause;
    } else {
      // New signature: (catalogPath, errorCode, cause?, suggestions?)
      errorCode = errorCodeOrCause;
      actualCause = cause;
    }

    const message = buildActionableErrorMessage(catalogPath, errorCode, actualCause);
    super(message);
    this.name = 'MCPCatalogLoadError';
    this.catalogPath = catalogPath;
    this.errorCode = errorCode;
    this.cause = actualCause;
    this.suggestions = suggestions ?? getDefaultSuggestions(errorCode);
  }
}

/**
 * Error thrown when MCP catalog validation fails
 */
export class MCPCatalogValidationError extends Error {
  /** Detailed validation errors */
  readonly details: ValidationErrorDetail[] | string[];
  /** Number of valid servers */
  readonly validServers: number;
  /** Number of invalid servers */
  readonly invalidServers: number;

  /** Internal enhanced details */
  private _enhancedDetails?: ValidationErrorDetail[];

  constructor(details: ValidationErrorDetail[] | string[], validServers: number = 0) {
    // Check if this is the old string[] format or new ValidationErrorDetail[] format
    const isLegacyFormat = details.length > 0 && typeof details[0] === 'string';

    if (isLegacyFormat) {
      // Old signature: string array - use legacy formatting
      super(`MCP catalog validation failed: ${(details as string[]).join('; ')}`);
      this.details = details as string[];
      this._enhancedDetails = (details as string[]).map((message, index) => ({
        field: `unknown[${index}]`,
        message,
        severity: 'error' as const,
      }));
    } else {
      // New signature: ValidationErrorDetail array
      super(formatValidationErrors(details as ValidationErrorDetail[]));
      this.details = details as ValidationErrorDetail[];
      this._enhancedDetails = details as ValidationErrorDetail[];
    }

    this.name = 'MCPCatalogValidationError';
    this.validServers = validServers;
    this.invalidServers = this._enhancedDetails.filter(d => d.severity === 'error').length;
  }

  /**
   * Gets the enhanced details regardless of constructor format
   */
  get enhancedDetails(): ValidationErrorDetail[] {
    return this._enhancedDetails || [];
  }
}

/**
 * Builds an actionable error message for catalog loading failures
 */
function buildActionableErrorMessage(
  catalogPath: string,
  errorCode: MCPCatalogErrorCode,
  cause?: Error
): string {
  const baseMessage = `Failed to load MCP catalog from ${catalogPath}`;

  switch (errorCode) {
    case MCPCatalogErrorCode.FILE_NOT_FOUND:
      return `${baseMessage}: File not found`;
    case MCPCatalogErrorCode.FILE_READ_ERROR:
      // For backward compatibility, when no cause is provided, use "Unknown error"
      if (!cause) {
        return `${baseMessage}: Unknown error`;
      }
      return `${baseMessage}: ${cause.message}`;
    case MCPCatalogErrorCode.JSON_PARSE_ERROR:
      return `${baseMessage}: Invalid JSON syntax${cause?.message ? ` - ${cause.message}` : ''}`;
    case MCPCatalogErrorCode.SCHEMA_VALIDATION_ERROR:
      return `${baseMessage}: Catalog structure is invalid`;
    case MCPCatalogErrorCode.SERVER_VALIDATION_ERROR:
      return `${baseMessage}: One or more servers have invalid configurations`;
    default:
      // For backward compatibility, match the old error format when no cause is provided
      if (!cause) {
        return `${baseMessage}: Unknown error`;
      }
      return `${baseMessage}: ${cause.message}`;
  }
}

/**
 * Gets default suggestions for common error scenarios
 */
function getDefaultSuggestions(errorCode: MCPCatalogErrorCode): string[] {
  switch (errorCode) {
    case MCPCatalogErrorCode.FILE_NOT_FOUND:
      return [
        'Verify the catalog file exists at the specified path',
        'Check file permissions (requires read access)',
        'Ensure the file path is correct in your configuration',
        "Run 'npm run build' to ensure catalog.json is copied to dist/",
      ];
    case MCPCatalogErrorCode.FILE_READ_ERROR:
      return [
        'Check file permissions (requires read access)',
        'Verify the file is not corrupted or in use by another process',
        'Try running with elevated permissions if needed',
      ];
    case MCPCatalogErrorCode.JSON_PARSE_ERROR:
      return [
        'Validate JSON syntax using a JSON validator (e.g., jsonlint.com)',
        'Check for trailing commas after the last item in arrays/objects',
        'Ensure all strings are properly quoted',
        'Look for unescaped special characters in string values',
      ];
    case MCPCatalogErrorCode.SCHEMA_VALIDATION_ERROR:
      return [
        'Ensure the catalog has required fields: version, servers, categories',
        'Verify that servers is an array and categories is an object',
        'Check the catalog structure against the schema documentation',
      ];
    case MCPCatalogErrorCode.SERVER_VALIDATION_ERROR:
      return [
        'Review server configurations for required fields: name, description, serverConfig',
        'Ensure serverConfig has a valid command field',
        'Check that all server names are unique',
      ];
    default:
      return ['Check the catalog file structure and content'];
  }
}

/**
 * Formats validation errors into a readable message
 */
function formatValidationErrors(details: ValidationErrorDetail[]): string {
  const errorCount = details.filter(d => d.severity === 'error').length;
  const warningCount = details.filter(d => d.severity === 'warning').length;

  let message = `MCP catalog validation failed with ${errorCount} error(s)`;
  if (warningCount > 0) {
    message += ` and ${warningCount} warning(s)`;
  }
  message += ':\n\n';

  details.forEach(detail => {
    const level = detail.severity === 'error' ? '[ERROR]' : '[WARNING]';
    message += `  ${level} ${detail.field}: ${detail.message}\n`;
    if (detail.suggestion) {
      message += `          Suggestion: ${detail.suggestion}\n`;
    }
    if (detail.serverName) {
      message += `          Server: ${detail.serverName}\n`;
    }
    message += '\n';
  });

  return message.trim();
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
 * Default empty catalog for graceful degradation when actual catalog fails to load
 */
export const DEFAULT_EMPTY_CATALOG: MCPCatalog = Object.freeze({
  version: '0.0.0',
  updated: new Date().toISOString(),
  description: 'Default empty catalog (actual catalog failed to load)',
  categories: Object.freeze({}),
  servers: Object.freeze([]),
});

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
  /** Use empty catalog if load fails (default: false) */
  fallbackOnError?: boolean;
  /** Log warnings vs throw for non-critical errors (default: false) */
  warnOnValidationErrors?: boolean;
  /** Load valid servers, skip invalid ones (default: false) */
  skipInvalidServers?: boolean;
  /** Error callback for handling load/validation errors */
  onError?: (error: MCPCatalogLoadError | MCPCatalogValidationError) => void;
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
      fallbackOnError: options.fallbackOnError ?? false,
      warnOnValidationErrors: options.warnOnValidationErrors ?? false,
      skipInvalidServers: options.skipInvalidServers ?? false,
      onError: options.onError,
    };

    // Load and validate catalog
    this.catalog = this.loadCatalog();

    // For backward compatibility, run legacy validation only if using old behavior
    if (this.options.validateOnLoad &&
        !this.options.fallbackOnError &&
        !this.options.skipInvalidServers &&
        !this.options.warnOnValidationErrors &&
        !this.options.onError) {
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

  /**
   * Creates a new MCPRegistry instance asynchronously.
   * Useful for environments where blocking I/O should be avoided.
   *
   * @param options - Registry configuration options
   * @returns Promise resolving to the registry instance
   *
   * @example
   * ```typescript
   * try {
   *   const registry = await MCPRegistry.createAsync({ fallbackOnError: true });
   *   console.log(`Loaded ${registry.size} servers`);
   * } catch (error) {
   *   console.error('Failed to create registry:', error);
   * }
   * ```
   */
  static async createAsync(options?: MCPRegistryOptions): Promise<MCPRegistry> {
    // Reset singleton for async creation if options provided
    if (options) {
      MCPRegistry.resetInstance();
    }

    return new Promise((resolve, reject) => {
      try {
        const registry = MCPRegistry.getInstance(options);
        resolve(registry);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Safely gets or creates the registry instance.
   * Returns null if loading fails instead of throwing.
   *
   * @param options - Registry configuration options
   * @returns The registry instance or null on failure
   *
   * @example
   * ```typescript
   * const registry = MCPRegistry.tryGetInstance({ fallbackOnError: true });
   * if (registry) {
   *   const servers = registry.listServers();
   * } else {
   *   console.warn('Registry failed to load');
   * }
   * ```
   */
  static tryGetInstance(options?: MCPRegistryOptions): MCPRegistry | null {
    try {
      return MCPRegistry.getInstance(options);
    } catch {
      return null;
    }
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
    // Use __dirname which is available in CommonJS output
    return resolve(__dirname, 'catalog.json');
  }

  /**
   * Loads the MCP catalog from the specified file with enhanced error handling.
   *
   * @returns The loaded catalog data
   * @throws {MCPCatalogLoadError} If the catalog cannot be loaded or parsed (unless fallbackOnError is true)
   */
  private loadCatalog(): MCPCatalog {
    const path = this.options.catalogPath;

    try {
      // Step 1: Read file
      let catalogData: string;
      try {
        catalogData = readFileSync(path, 'utf-8');
      } catch (error) {
        const errorCode = error instanceof Error && error.message.includes('ENOENT')
          ? MCPCatalogErrorCode.FILE_NOT_FOUND
          : MCPCatalogErrorCode.FILE_READ_ERROR;

        throw new MCPCatalogLoadError(
          path,
          errorCode,
          error instanceof Error ? error : new Error(String(error))
        );
      }

      // Step 2: Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(catalogData);
      } catch (error) {
        throw new MCPCatalogLoadError(
          path,
          MCPCatalogErrorCode.JSON_PARSE_ERROR,
          error instanceof Error ? error : new Error(String(error))
        );
      }

      // Step 3: Validate and normalize structure (only if validation is enabled)
      if (this.options.validateOnLoad) {
        return this.validateAndNormalize(parsed, path);
      } else {
        // Return catalog as-is without validation when validateOnLoad is false
        return parsed as MCPCatalog;
      }

    } catch (error) {
      const mcpError = error as MCPCatalogLoadError | MCPCatalogValidationError;

      // Handle fallback if enabled
      if (this.options.fallbackOnError) {
        // Notify error handler if provided
        this.options.onError?.(mcpError);

        // Log warning and return empty catalog
        console.warn(`[MCPRegistry] Falling back to empty catalog: ${mcpError.message}`);
        return { ...DEFAULT_EMPTY_CATALOG };
      }

      // Re-throw error if not using fallback
      throw error;
    }
  }

  /**
   * Validates and normalizes the loaded catalog structure with detailed error reporting.
   *
   * @param parsed - The parsed JSON object
   * @param catalogPath - Path to the catalog file for error context
   * @returns Normalized catalog with valid servers only
   * @throws {MCPCatalogValidationError} If validation fails and not skipping invalid servers
   */
  private validateAndNormalize(parsed: unknown, catalogPath: string): MCPCatalog {
    const errors: ValidationErrorDetail[] = [];
    const warnings: ValidationErrorDetail[] = [];

    // Type guard
    if (typeof parsed !== 'object' || parsed === null) {
      errors.push({
        field: 'root',
        message: 'Catalog must be a JSON object',
        severity: 'error',
        suggestion: 'Ensure the catalog file contains a valid JSON object with version, servers, and categories',
      });
      throw new MCPCatalogValidationError(errors);
    }

    const catalog = parsed as Record<string, unknown>;

    // Validate required top-level fields
    if (!catalog.version || typeof catalog.version !== 'string') {
      errors.push({
        field: 'version',
        message: 'Catalog version is required and must be a string',
        severity: 'error',
        suggestion: 'Add "version": "1.0.0" to the catalog root',
      });
    }

    if (!catalog.categories || typeof catalog.categories !== 'object') {
      errors.push({
        field: 'categories',
        message: 'Catalog must have a categories object',
        severity: 'error',
        suggestion: 'Add "categories": {} to the catalog (can be empty)',
      });
    }

    if (!Array.isArray(catalog.servers)) {
      errors.push({
        field: 'servers',
        message: 'Catalog must have a servers array',
        severity: 'error',
        suggestion: 'Add "servers": [] to the catalog',
      });
      throw new MCPCatalogValidationError(errors);
    }

    // Validate each server (with skipInvalidServers support)
    const validServers: MCPMarketplaceEntry[] = [];

    catalog.servers.forEach((server: unknown, index: number) => {
      const serverErrors = this.validateServer(server, index);

      if (serverErrors.length === 0) {
        validServers.push(server as MCPMarketplaceEntry);
      } else {
        const hasErrors = serverErrors.some(e => e.severity === 'error');

        if (hasErrors) {
          if (this.options.skipInvalidServers) {
            // Convert errors to warnings when skipping
            warnings.push(...serverErrors.map(e => ({ ...e, severity: 'warning' as const })));
          } else {
            errors.push(...serverErrors);
          }
        } else {
          warnings.push(...serverErrors);
          validServers.push(server as MCPMarketplaceEntry);
        }
      }
    });

    // Report warnings if enabled
    if (warnings.length > 0 && this.options.warnOnValidationErrors) {
      console.warn('[MCPRegistry] Validation warnings:', formatValidationErrors(warnings));
    }

    // Throw if critical errors and not skipping
    if (errors.length > 0 && !this.options.skipInvalidServers) {
      throw new MCPCatalogValidationError(errors, validServers.length);
    }

    // Return normalized catalog
    return {
      version: String(catalog.version ?? '0.0.0'),
      updated: String(catalog.updated ?? new Date().toISOString()),
      description: String(catalog.description ?? ''),
      categories: catalog.categories as MCPCatalog['categories'] ?? {},
      servers: validServers,
    };
  }

  /**
   * Validates an individual server entry with detailed error reporting.
   *
   * @param server - The server object to validate
   * @param index - Index of the server in the array
   * @returns Array of validation errors
   */
  private validateServer(server: unknown, index: number): ValidationErrorDetail[] {
    const errors: ValidationErrorDetail[] = [];
    const prefix = `servers[${index}]`;

    if (typeof server !== 'object' || server === null) {
      return [{
        field: prefix,
        message: 'Server entry must be an object',
        severity: 'error',
        suggestion: `Ensure servers[${index}] is a valid object with name, description, and serverConfig`,
      }];
    }

    const s = server as Record<string, unknown>;
    const serverName = typeof s.name === 'string' ? s.name : `index ${index}`;

    // Required: name
    if (!s.name || typeof s.name !== 'string' || s.name.trim() === '') {
      errors.push({
        field: `${prefix}.name`,
        message: 'Server name is required and must be a non-empty string',
        severity: 'error',
        suggestion: 'Add a unique "name" field to identify the server',
        serverName,
      });
    }

    // Required: description
    if (!s.description || typeof s.description !== 'string' || s.description.trim() === '') {
      errors.push({
        field: `${prefix}.description`,
        message: 'Server description is required and must be a non-empty string',
        severity: 'error',
        suggestion: `Add a "description" field explaining what "${serverName}" does`,
        serverName,
      });
    }

    // Required: serverConfig
    if (!s.serverConfig || typeof s.serverConfig !== 'object') {
      errors.push({
        field: `${prefix}.serverConfig`,
        message: 'Server configuration is required',
        severity: 'error',
        suggestion: `Add a "serverConfig" object with at least "name" and "command" fields for "${serverName}"`,
        serverName,
      });
    } else {
      // Validate serverConfig structure
      const config = s.serverConfig as Record<string, unknown>;

      if (!config.command || typeof config.command !== 'string') {
        errors.push({
          field: `${prefix}.serverConfig.command`,
          message: 'Server config must have a command string',
          severity: 'error',
          suggestion: `Add "command" (e.g., "npx", "node") to serverConfig for "${serverName}"`,
          serverName,
        });
      }
    }

    // Optional but recommended: capabilities
    if (s.capabilities !== undefined && !Array.isArray(s.capabilities)) {
      errors.push({
        field: `${prefix}.capabilities`,
        message: 'Capabilities must be an array of strings',
        severity: 'warning',
        suggestion: `Change capabilities to an array, e.g., ["file:read", "file:write"] for "${serverName}"`,
        serverName,
      });
    }

    return errors;
  }

  /**
   * Validates the loaded catalog structure (legacy method kept for backward compatibility).
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
        const matchedCategories: string[] = [];
        if (server.capabilities.some(cap => cap.startsWith('file:') || cap.startsWith('directory:'))) {
          matchedCategories.push('filesystem');
        }
        if (server.capabilities.some(cap => cap.startsWith('http:') || cap.startsWith('browser:'))) {
          matchedCategories.push('web');
        }
        if (server.capabilities.some(cap => cap.startsWith('git:'))) {
          matchedCategories.push('development');
        }
        if (server.capabilities.some(cap => cap.startsWith('db:') || cap.startsWith('sql:'))) {
          matchedCategories.push('database');
        }
        if (server.capabilities.some(cap => cap.startsWith('shell:') || cap.startsWith('process:') || cap.startsWith('docker:'))) {
          matchedCategories.push('system');
        }
        if (server.capabilities.some(cap => cap.startsWith('search:'))) {
          matchedCategories.push('search');
        }
        // Only infer category if exactly one matches; multiple matches means uncategorized
        if (matchedCategories.length === 1) {
          inferredCategory = matchedCategories[0];
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
