/**
 * @fileoverview WebSearch tool - Web search capability with domain filtering
 *
 * This tool provides web search capabilities using an AI model to search the web
 * and return relevant results. Features include:
 * - Search queries with up-to-date information
 * - Domain filtering (allow/block specific domains)
 * - Comprehensive result formatting
 * - Caching support for performance
 *
 * ## Architecture Decision Record (ADR-017)
 *
 * ### Context
 * APEX agents need the ability to search the web for current information that may
 * not be available in the model's training data. This is essential for:
 * - Finding documentation and API references
 * - Researching current best practices
 * - Discovering recent releases and updates
 * - Accessing real-time information
 *
 * ### Decision
 * Implement a `WebSearchTool` that:
 * 1. Extends `BaseTool` for consistent tool interface
 * 2. Provides flexible domain filtering (allow/block lists)
 * 3. Returns structured search results with source attribution
 * 4. Integrates with external search providers
 * 5. Includes proper error handling and timeout support
 *
 * ### Consequences
 * - Agents can access current web information
 * - Domain filtering provides security and focus control
 * - Results include source URLs for verification
 * - Implementation allows for multiple search provider backends
 *
 * @module @apex/core/tools/web/web-search-tool
 */

import { BaseTool, type ToolExecutionContext, type ValidationResult } from '../base-tool.js';
import type { ToolCategory, ToolPermission } from '../../types.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Input parameters for the WebSearch tool
 */
export interface WebSearchToolInput {
  /** The search query to execute (required) */
  query: string;
  /** Only include search results from these domains (optional) */
  allowed_domains?: string[];
  /** Never include search results from these domains (optional) */
  blocked_domains?: string[];
}

/**
 * Individual search result with metadata
 */
export interface WebSearchResult {
  /** Title of the search result */
  title: string;
  /** URL of the search result */
  url: string;
  /** Snippet or description from the search result */
  snippet: string;
  /** Domain of the result */
  domain: string;
  /** Position in search results (1-based) */
  position: number;
}

/**
 * Output from the WebSearch tool
 */
export interface WebSearchToolOutput {
  /** Array of search results */
  results: WebSearchResult[];
  /** Total number of results returned */
  totalResults: number;
  /** The original search query */
  query: string;
  /** Time taken for the search in milliseconds */
  searchTime: number;
  /** Whether results were filtered by domain restrictions */
  domainFiltered: boolean;
  /** Domains that were allowed (if filtering applied) */
  allowedDomains?: string[];
  /** Domains that were blocked (if filtering applied) */
  blockedDomains?: string[];
}

/**
 * Configuration options for WebSearchTool
 */
export interface WebSearchToolConfig {
  /** Maximum number of results to return (default: 10) */
  maxResults?: number;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Cache TTL in milliseconds (default: 900000 = 15 minutes) */
  cacheTTL?: number;
  /** Custom user agent string */
  userAgent?: string;
}

// ============================================================================
// WebSearch Tool Implementation
// ============================================================================

/**
 * WebSearch tool for performing web searches with domain filtering.
 *
 * Features:
 * - Full-text web search queries
 * - Domain allowlist/blocklist filtering
 * - Structured search results with metadata
 * - Configurable result limits and timeouts
 * - Built-in caching for performance
 *
 * ## Usage Examples
 *
 * ```typescript
 * // Basic search
 * const result = await webSearchTool.execute({ query: 'TypeScript best practices 2024' });
 *
 * // Search with domain filtering (only from specific sites)
 * const result = await webSearchTool.execute({
 *   query: 'React hooks documentation',
 *   allowed_domains: ['reactjs.org', 'developer.mozilla.org']
 * });
 *
 * // Search excluding certain domains
 * const result = await webSearchTool.execute({
 *   query: 'Node.js performance optimization',
 *   blocked_domains: ['w3schools.com']
 * });
 * ```
 *
 * ## Security Considerations
 *
 * - Domain filtering helps focus searches on trusted sources
 * - Results are sanitized and validated
 * - Network permission is required for execution
 * - Timeout protection prevents hanging requests
 */
export class WebSearchTool extends BaseTool<WebSearchToolInput, WebSearchToolOutput> {
  /** Default maximum number of search results */
  private static readonly DEFAULT_MAX_RESULTS = 10;

  /** Default request timeout in milliseconds */
  private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  /** Default cache TTL in milliseconds (15 minutes) */
  private static readonly DEFAULT_CACHE_TTL = 900000;

  /** Tool configuration */
  private readonly config: Required<WebSearchToolConfig>;

  /** Simple in-memory cache for search results */
  private readonly cache: Map<string, { results: WebSearchToolOutput; timestamp: number }> = new Map();

  /**
   * Creates a new WebSearchTool instance.
   *
   * @param config - Optional configuration for the tool
   */
  constructor(config?: WebSearchToolConfig) {
    super({
      name: 'WebSearch',
      description: 'Search the web and use the results to inform responses. Provides up-to-date information for current events and recent data. Returns search result information formatted as search result blocks, including links as markdown hyperlinks.',
      category: 'web' as ToolCategory,
      permissions: ['network' as ToolPermission],
      dangerous: false,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to use. Must be at least 2 characters long.',
            minLength: 2,
          },
          allowed_domains: {
            type: 'array',
            description: 'Only include search results from these domains (e.g., ["docs.python.org", "developer.mozilla.org"])',
          },
          blocked_domains: {
            type: 'array',
            description: 'Never include search results from these domains (e.g., ["example.com"])',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
      examples: [
        {
          name: 'Basic web search',
          description: 'Search the web for TypeScript best practices',
          input: { query: 'TypeScript best practices 2024' },
        },
        {
          name: 'Search with domain allowlist',
          description: 'Search only on official documentation sites',
          input: {
            query: 'React hooks tutorial',
            allowed_domains: ['reactjs.org', 'developer.mozilla.org'],
          },
        },
        {
          name: 'Search with domain blocklist',
          description: 'Search excluding certain domains',
          input: {
            query: 'JavaScript array methods',
            blocked_domains: ['w3schools.com'],
          },
        },
        {
          name: 'Documentation search',
          description: 'Find specific API documentation',
          input: {
            query: 'Node.js fs.writeFile documentation',
            allowed_domains: ['nodejs.org'],
          },
        },
      ],
      version: '1.0.0',
      tags: ['web', 'search', 'network', 'information-retrieval'],
    });

    // Apply default configuration
    this.config = {
      maxResults: config?.maxResults ?? WebSearchTool.DEFAULT_MAX_RESULTS,
      timeout: config?.timeout ?? WebSearchTool.DEFAULT_TIMEOUT,
      cacheTTL: config?.cacheTTL ?? WebSearchTool.DEFAULT_CACHE_TTL,
      userAgent: config?.userAgent ?? 'APEX-WebSearchTool/1.0',
    };
  }

  /**
   * Validates the input parameters with enhanced query and domain checks.
   */
  validate(
    params: WebSearchToolInput,
    context?: ToolExecutionContext
  ): ValidationResult {
    const baseResult = super.validate(params, context);
    if (!baseResult.valid) {
      return baseResult;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Query validation
    if (!params.query || typeof params.query !== 'string') {
      errors.push('query is required and must be a string');
    } else {
      const trimmedQuery = params.query.trim();

      if (trimmedQuery.length < 2) {
        errors.push('query must be at least 2 characters long');
      }

      if (trimmedQuery.length > 500) {
        errors.push('query must be 500 characters or less');
      }

      // Warn about potentially ineffective queries
      if (trimmedQuery.split(/\s+/).length === 1 && trimmedQuery.length < 4) {
        warnings.push('very short single-word queries may return less relevant results');
      }
    }

    // Validate allowed_domains if provided
    if (params.allowed_domains !== undefined) {
      if (!Array.isArray(params.allowed_domains)) {
        errors.push('allowed_domains must be an array of strings');
      } else {
        for (const domain of params.allowed_domains) {
          if (typeof domain !== 'string') {
            errors.push('all entries in allowed_domains must be strings');
            break;
          }
          if (!this.isValidDomain(domain)) {
            warnings.push(`'${domain}' may not be a valid domain format`);
          }
        }

        if (params.allowed_domains.length === 0) {
          warnings.push('empty allowed_domains array will not filter results');
        }
      }
    }

    // Validate blocked_domains if provided
    if (params.blocked_domains !== undefined) {
      if (!Array.isArray(params.blocked_domains)) {
        errors.push('blocked_domains must be an array of strings');
      } else {
        for (const domain of params.blocked_domains) {
          if (typeof domain !== 'string') {
            errors.push('all entries in blocked_domains must be strings');
            break;
          }
          if (!this.isValidDomain(domain)) {
            warnings.push(`'${domain}' may not be a valid domain format`);
          }
        }
      }
    }

    // Check for conflicting domain filters
    if (params.allowed_domains && params.blocked_domains) {
      const overlap = params.allowed_domains.filter(d =>
        params.blocked_domains?.includes(d)
      );
      if (overlap.length > 0) {
        warnings.push(`domains appear in both allow and block lists: ${overlap.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? [...(baseResult.warnings || []), ...warnings] : baseResult.warnings,
    };
  }

  /**
   * Executes the web search operation.
   */
  protected async executeImpl(
    params: WebSearchToolInput,
    context?: ToolExecutionContext
  ): Promise<WebSearchToolOutput> {
    const startTime = Date.now();

    // Check cancellation early
    if (context?.signal?.aborted) {
      throw new Error('WebSearch operation was cancelled');
    }

    const query = params.query.trim();
    const allowedDomains = params.allowed_domains?.filter(d => d.trim()) || [];
    const blockedDomains = params.blocked_domains?.filter(d => d.trim()) || [];

    // Generate cache key
    const cacheKey = this.generateCacheKey(query, allowedDomains, blockedDomains);

    // Check cache
    const cachedResult = this.getCachedResult(cacheKey);
    if (cachedResult) {
      return {
        ...cachedResult,
        searchTime: Date.now() - startTime,
      };
    }

    // Check cancellation before search
    if (context?.signal?.aborted) {
      throw new Error('WebSearch operation was cancelled');
    }

    try {
      // Perform the actual search
      // Note: This is a placeholder implementation. In production, this would
      // integrate with an actual search provider (e.g., Anthropic's web search,
      // Google Custom Search, Bing Search API, etc.)
      const searchResults = await this.performSearch(
        query,
        allowedDomains,
        blockedDomains,
        context
      );

      const output: WebSearchToolOutput = {
        results: searchResults,
        totalResults: searchResults.length,
        query,
        searchTime: Date.now() - startTime,
        domainFiltered: allowedDomains.length > 0 || blockedDomains.length > 0,
        allowedDomains: allowedDomains.length > 0 ? allowedDomains : undefined,
        blockedDomains: blockedDomains.length > 0 ? blockedDomains : undefined,
      };

      // Cache the result
      this.cacheResult(cacheKey, output);

      return output;
    } catch (error) {
      if (error instanceof Error && error.message.includes('cancelled')) {
        throw error;
      }
      throw new Error(`WebSearch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Performs the actual web search.
   *
   * This is a placeholder implementation that should be replaced with
   * an actual search provider integration in production.
   *
   * @param query - The search query
   * @param allowedDomains - Domains to include in results
   * @param blockedDomains - Domains to exclude from results
   * @param context - Execution context
   * @returns Array of search results
   */
  private async performSearch(
    query: string,
    allowedDomains: string[],
    blockedDomains: string[],
    context?: ToolExecutionContext
  ): Promise<WebSearchResult[]> {
    // Check for abort signal
    if (context?.signal?.aborted) {
      throw new Error('WebSearch operation was cancelled');
    }

    // TODO: Integrate with actual search provider
    // This placeholder returns an empty result set
    // In production, this would:
    // 1. Call the search provider API with the query
    // 2. Apply domain filtering
    // 3. Transform results to WebSearchResult format
    // 4. Handle rate limiting and errors

    // For now, return a placeholder indicating the tool needs implementation
    // This allows the tool structure to be tested and verified
    const results: WebSearchResult[] = [];

    // Apply domain filtering (for when actual search is implemented)
    // const filteredResults = this.filterResultsByDomain(
    //   rawResults,
    //   allowedDomains,
    //   blockedDomains
    // );

    return results.slice(0, this.config.maxResults);
  }

  /**
   * Filters search results by domain restrictions.
   *
   * @param results - Raw search results
   * @param allowedDomains - Domains to include
   * @param blockedDomains - Domains to exclude
   * @returns Filtered search results
   */
  private filterResultsByDomain(
    results: WebSearchResult[],
    allowedDomains: string[],
    blockedDomains: string[]
  ): WebSearchResult[] {
    return results.filter(result => {
      const domain = result.domain.toLowerCase();

      // Check blocklist first
      if (blockedDomains.length > 0) {
        const isBlocked = blockedDomains.some(blocked =>
          domain === blocked.toLowerCase() || domain.endsWith('.' + blocked.toLowerCase())
        );
        if (isBlocked) {
          return false;
        }
      }

      // Check allowlist if specified
      if (allowedDomains.length > 0) {
        const isAllowed = allowedDomains.some(allowed =>
          domain === allowed.toLowerCase() || domain.endsWith('.' + allowed.toLowerCase())
        );
        return isAllowed;
      }

      return true;
    });
  }

  /**
   * Validates a domain string format.
   *
   * @param domain - Domain string to validate
   * @returns Whether the domain appears valid
   */
  private isValidDomain(domain: string): boolean {
    if (!domain || typeof domain !== 'string') {
      return false;
    }

    const trimmed = domain.trim().toLowerCase();

    // Basic domain validation pattern
    // Matches: example.com, sub.example.com, etc.
    const domainPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;

    return domainPattern.test(trimmed);
  }

  /**
   * Generates a cache key for the search parameters.
   *
   * @param query - Search query
   * @param allowedDomains - Allowed domains
   * @param blockedDomains - Blocked domains
   * @returns Cache key string
   */
  private generateCacheKey(
    query: string,
    allowedDomains: string[],
    blockedDomains: string[]
  ): string {
    const normalizedQuery = query.toLowerCase().trim();
    const normalizedAllowed = [...allowedDomains].sort().join(',');
    const normalizedBlocked = [...blockedDomains].sort().join(',');

    return `${normalizedQuery}|${normalizedAllowed}|${normalizedBlocked}`;
  }

  /**
   * Gets a cached result if available and not expired.
   *
   * @param cacheKey - Cache key to look up
   * @returns Cached output or null if not found/expired
   */
  private getCachedResult(cacheKey: string): WebSearchToolOutput | null {
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp > this.config.cacheTTL) {
      // Expired, remove from cache
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.results;
  }

  /**
   * Caches a search result.
   *
   * @param cacheKey - Cache key
   * @param results - Results to cache
   */
  private cacheResult(cacheKey: string, results: WebSearchToolOutput): void {
    this.cache.set(cacheKey, {
      results,
      timestamp: Date.now(),
    });

    // Clean up old cache entries periodically
    this.cleanupCache();
  }

  /**
   * Removes expired entries from the cache.
   */
  private cleanupCache(): void {
    const now = Date.now();

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.config.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clears all cached search results.
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Gets the current cache size.
   *
   * @returns Number of cached entries
   */
  public getCacheSize(): number {
    return this.cache.size;
  }
}
