/**
 * @fileoverview MCP Marketplace Test Fixture Data
 *
 * Provides static and factory-generated test data for MCP marketplace E2E tests.
 * Fixtures mirror the structure of the real catalog.json and MCPMarketplaceEntry types
 * to ensure realistic test scenarios.
 *
 * ## Architecture (ADR-071)
 *
 * This module provides:
 * - Static marketplace entries representing common server types
 * - Dynamic fixture factories for generating test-specific scenarios
 * - Catalog structures matching the real MCPCatalog format
 * - Configuration fragments for config.yaml verification
 *
 * @module tests/e2e/fixtures/marketplace-data
 */

// ============================================================================
// Types (mirroring @apex/core types without direct import for E2E isolation)
// ============================================================================

/**
 * Marketplace entry structure matching MCPMarketplaceEntry from @apex/core
 */
export interface MarketplaceEntry {
  name: string;
  description: string;
  version: string;
  author?: string;
  homepage?: string;
  repository?: string;
  installCommand?: string;
  serverConfig: ServerConfig;
  capabilities?: string[];
  verified?: boolean;
  category?: string;
  tags?: string[];
}

/**
 * Server configuration matching MCPServerConfig from @apex/core
 */
export interface ServerConfig {
  name: string;
  type?: 'stdio' | 'http' | 'sse' | 'sdk';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  autoStart?: boolean;
  capabilities?: string[];
}

/**
 * Catalog structure matching MCPCatalog from mcp-registry.ts
 */
export interface TestCatalog {
  version: string;
  updated: string;
  description: string;
  servers: MarketplaceEntry[];
  categories: Record<string, { name: string; description: string }>;
}

/**
 * Environment variable definition for templates
 */
export interface EnvVarDefinition {
  name: string;
  description: string;
  required: boolean;
  sensitive: boolean;
  defaultValue?: string;
  source?: string;
}

// ============================================================================
// Static Marketplace Entries
// ============================================================================

/**
 * Filesystem server - the most basic verified server
 */
export const FILESYSTEM_SERVER: MarketplaceEntry = {
  name: 'filesystem',
  description: 'Direct filesystem access for reading, writing, and managing files and directories',
  version: '1.0.0',
  author: 'ModelContextProtocol',
  repository: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
  homepage: 'https://modelcontextprotocol.io/servers/filesystem',
  verified: true,
  category: 'filesystem',
  capabilities: [
    'file:read',
    'file:write',
    'file:create',
    'file:delete',
    'directory:list',
    'directory:create',
  ],
  serverConfig: {
    name: 'filesystem',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/directory'],
    env: {},
    autoStart: true,
  },
};

/**
 * Memory server - verified, no auto-start
 */
export const MEMORY_SERVER: MarketplaceEntry = {
  name: 'memory',
  description: 'In-memory key-value store for temporary data persistence during sessions',
  version: '1.0.0',
  author: 'ModelContextProtocol',
  repository: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
  verified: true,
  category: 'database',
  capabilities: ['db:get', 'db:set', 'db:delete', 'db:list'],
  serverConfig: {
    name: 'memory',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    env: {},
    autoStart: false,
  },
};

/**
 * Fetch server - HTTP capabilities
 */
export const FETCH_SERVER: MarketplaceEntry = {
  name: 'fetch',
  description: 'HTTP fetch capabilities for making web requests and retrieving content',
  version: '1.0.0',
  author: 'ModelContextProtocol',
  verified: true,
  category: 'web',
  capabilities: ['http:get', 'http:post', 'http:put', 'http:delete'],
  serverConfig: {
    name: 'fetch',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    env: {},
    autoStart: false,
  },
};

/**
 * GitHub server - requires sensitive env vars
 */
export const GITHUB_SERVER: MarketplaceEntry = {
  name: 'github',
  description: 'GitHub integration for repository management, issues, and pull requests',
  version: '1.0.0',
  author: 'ModelContextProtocol',
  verified: true,
  category: 'development',
  capabilities: ['git:clone', 'git:commit', 'git:push', 'git:pull'],
  serverConfig: {
    name: 'github',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: '',
    },
    autoStart: false,
  },
};

/**
 * PostgreSQL server - requires database connection env vars
 */
export const POSTGRES_SERVER: MarketplaceEntry = {
  name: 'postgres',
  description: 'PostgreSQL database access for queries, schema management, and data operations',
  version: '1.0.0',
  author: 'ModelContextProtocol',
  verified: true,
  category: 'database',
  capabilities: ['db:query', 'db:schema', 'db:migrate'],
  serverConfig: {
    name: 'postgres',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    env: {
      POSTGRES_CONNECTION_STRING: '',
    },
    autoStart: false,
  },
};

/**
 * Brave Search server - requires API key
 */
export const BRAVE_SEARCH_SERVER: MarketplaceEntry = {
  name: 'brave-search',
  description: 'Web search capabilities using Brave Search API for current information retrieval',
  version: '1.0.0',
  author: 'ModelContextProtocol',
  verified: true,
  category: 'search',
  capabilities: ['search:web', 'search:current_events', 'search:real_time'],
  serverConfig: {
    name: 'brave-search',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: {
      BRAVE_API_KEY: '',
    },
    autoStart: false,
  },
};

/**
 * Unverified community server (for testing verified filter)
 */
export const COMMUNITY_SERVER: MarketplaceEntry = {
  name: 'community-tools',
  description: 'Community-maintained collection of utility tools',
  version: '0.3.0',
  author: 'community-contributor',
  verified: false,
  category: 'system',
  capabilities: ['shell:exec', 'process:list'],
  serverConfig: {
    name: 'community-tools',
    type: 'stdio',
    command: 'npx',
    args: ['-y', 'community-mcp-tools'],
    env: {},
    autoStart: false,
  },
};

/**
 * HTTP-based server (for testing non-stdio transports)
 */
export const HTTP_SERVER: MarketplaceEntry = {
  name: 'remote-api',
  description: 'Remote API server accessible via HTTP transport',
  version: '2.0.0',
  author: 'apex-team',
  verified: true,
  category: 'web',
  capabilities: ['http:proxy', 'http:cache'],
  serverConfig: {
    name: 'remote-api',
    type: 'http',
    url: 'http://localhost:3100/mcp',
    headers: {
      Authorization: 'Bearer ${API_TOKEN}',
    },
    autoStart: false,
  },
};

// ============================================================================
// Predefined Collections
// ============================================================================

/**
 * All static marketplace entries for use in test catalogs
 */
export const ALL_MARKETPLACE_ENTRIES: MarketplaceEntry[] = [
  FILESYSTEM_SERVER,
  MEMORY_SERVER,
  FETCH_SERVER,
  GITHUB_SERVER,
  POSTGRES_SERVER,
  BRAVE_SEARCH_SERVER,
  COMMUNITY_SERVER,
  HTTP_SERVER,
];

/**
 * Only verified servers
 */
export const VERIFIED_ENTRIES: MarketplaceEntry[] = ALL_MARKETPLACE_ENTRIES.filter(
  (e) => e.verified === true
);

/**
 * Servers requiring environment variables
 */
export const ENV_REQUIRING_ENTRIES: MarketplaceEntry[] = [
  GITHUB_SERVER,
  POSTGRES_SERVER,
  BRAVE_SEARCH_SERVER,
];

/**
 * Servers with auto-start enabled
 */
export const AUTO_START_ENTRIES: MarketplaceEntry[] = ALL_MARKETPLACE_ENTRIES.filter(
  (e) => e.serverConfig.autoStart === true
);

// ============================================================================
// Category Definitions
// ============================================================================

/**
 * Standard categories matching the real catalog.json
 */
export const STANDARD_CATEGORIES: Record<string, { name: string; description: string }> = {
  filesystem: {
    name: 'File System',
    description: 'Servers for file and directory operations',
  },
  web: {
    name: 'Web & HTTP',
    description: 'Servers for web browsing, HTTP requests, and API interactions',
  },
  development: {
    name: 'Development Tools',
    description: 'Servers for software development workflows and version control',
  },
  database: {
    name: 'Database',
    description: 'Servers for database operations and data management',
  },
  search: {
    name: 'Search & Information',
    description: 'Servers for searching and retrieving information',
  },
  system: {
    name: 'System & Infrastructure',
    description: 'Servers for system administration and infrastructure management',
  },
};

// ============================================================================
// Test Catalog Factories
// ============================================================================

/**
 * Creates a complete test catalog with all entries
 */
export function createTestCatalog(overrides?: Partial<TestCatalog>): TestCatalog {
  return {
    version: '1.0.0',
    updated: new Date().toISOString(),
    description: 'Test MCP Server Catalog for E2E tests',
    servers: [...ALL_MARKETPLACE_ENTRIES],
    categories: { ...STANDARD_CATEGORIES },
    ...overrides,
  };
}

/**
 * Creates a minimal test catalog with only filesystem and memory servers
 */
export function createMinimalCatalog(): TestCatalog {
  return createTestCatalog({
    servers: [FILESYSTEM_SERVER, MEMORY_SERVER],
    description: 'Minimal test catalog',
  });
}

/**
 * Creates a catalog with only verified servers
 */
export function createVerifiedOnlyCatalog(): TestCatalog {
  return createTestCatalog({
    servers: VERIFIED_ENTRIES,
    description: 'Verified-only test catalog',
  });
}

// ============================================================================
// Dynamic Fixture Factories
// ============================================================================

/**
 * Creates a marketplace entry with custom configuration
 */
export function createMarketplaceEntry(
  name: string,
  overrides?: Partial<MarketplaceEntry>
): MarketplaceEntry {
  return {
    name,
    description: `Test MCP server: ${name}`,
    version: '1.0.0',
    author: 'test-author',
    verified: true,
    category: 'system',
    capabilities: [],
    serverConfig: {
      name,
      type: 'stdio',
      command: 'npx',
      args: ['-y', `@test/${name}-server`],
      env: {},
      autoStart: false,
    },
    ...overrides,
  };
}

/**
 * Creates a server config for testing installation
 */
export function createServerConfig(
  name: string,
  overrides?: Partial<ServerConfig>
): ServerConfig {
  return {
    name,
    type: 'stdio',
    command: 'npx',
    args: ['-y', `@test/${name}-server`],
    env: {},
    autoStart: false,
    ...overrides,
  };
}

/**
 * Creates environment variable definitions for a server
 */
export function createEnvVarDefinitions(
  vars: Array<{ name: string; required?: boolean; sensitive?: boolean; defaultValue?: string }>
): EnvVarDefinition[] {
  return vars.map((v) => ({
    name: v.name,
    description: `Environment variable: ${v.name}`,
    required: v.required ?? false,
    sensitive: v.sensitive ?? false,
    defaultValue: v.defaultValue,
    source: 'config',
  }));
}

// ============================================================================
// Config Fragment Fixtures (for .apex/config.yaml verification)
// ============================================================================

/**
 * Expected config structure after installing filesystem server
 */
export const EXPECTED_FILESYSTEM_CONFIG = {
  mcp: {
    servers: {
      filesystem: {
        name: 'filesystem',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/directory'],
        autoStart: true,
      },
    },
  },
};

/**
 * Expected config structure after installing multiple servers
 */
export const EXPECTED_MULTI_SERVER_CONFIG = {
  mcp: {
    servers: {
      filesystem: EXPECTED_FILESYSTEM_CONFIG.mcp.servers.filesystem,
      memory: {
        name: 'memory',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
        autoStart: false,
      },
    },
  },
};

/**
 * Base APEX config structure with MCP section
 */
export function createBaseApexConfig(mcpServers?: Record<string, ServerConfig>): object {
  return {
    project: {
      name: 'e2e-mcp-test-project',
      language: 'typescript',
    },
    autonomy: {
      default: 'supervised',
    },
    models: {
      planning: 'sonnet',
      implementation: 'sonnet',
    },
    limits: {
      maxTokensPerTask: 100000,
      maxCostPerTask: 10,
    },
    ...(mcpServers
      ? {
          mcp: {
            servers: mcpServers,
          },
        }
      : {}),
  };
}

// ============================================================================
// Error Scenario Fixtures
// ============================================================================

/**
 * Invalid marketplace entry (missing required fields)
 */
export const INVALID_ENTRY_MISSING_NAME: Partial<MarketplaceEntry> = {
  description: 'Server with missing name',
  version: '1.0.0',
  serverConfig: {
    name: 'no-name',
    type: 'stdio',
    command: 'npx',
    args: [],
  },
};

/**
 * Invalid server config (missing command for stdio type)
 */
export const INVALID_CONFIG_NO_COMMAND: ServerConfig = {
  name: 'broken-server',
  type: 'stdio',
  // command intentionally missing
  args: [],
  env: {},
};

/**
 * Server with conflicting configuration
 */
export const CONFLICTING_SERVER: MarketplaceEntry = {
  name: 'conflicting',
  description: 'Server with conflicting type and config',
  version: '1.0.0',
  verified: false,
  serverConfig: {
    name: 'conflicting',
    type: 'http',
    command: 'should-not-be-here-for-http', // Conflict: command with http type
    url: 'http://localhost:3000',
    autoStart: false,
  },
};

// ============================================================================
// Search Test Data
// ============================================================================

/**
 * Search queries and expected results for testing marketplace search
 */
export const SEARCH_TEST_CASES = [
  {
    query: 'filesystem',
    description: 'Search by exact name',
    expectedMinResults: 1,
    expectedContains: ['filesystem'],
  },
  {
    query: 'file',
    description: 'Search by partial name',
    expectedMinResults: 1,
    expectedContains: ['filesystem'],
  },
  {
    query: 'database',
    description: 'Search by category keyword',
    expectedMinResults: 1,
    expectedContains: ['postgres'],
  },
  {
    query: 'search',
    description: 'Search for search-related servers',
    expectedMinResults: 1,
    expectedContains: ['brave-search'],
  },
  {
    query: 'nonexistent-server-xyz',
    description: 'Search with no results',
    expectedMinResults: 0,
    expectedContains: [],
  },
  {
    query: 'http',
    description: 'Search by capability keyword',
    expectedMinResults: 1,
    expectedContains: ['fetch'],
  },
] as const;

/**
 * Category filter test cases
 */
export const CATEGORY_FILTER_CASES = [
  {
    category: 'filesystem',
    expectedMinCount: 1,
    expectedServers: ['filesystem'],
  },
  {
    category: 'database',
    expectedMinCount: 1,
    expectedServers: ['memory', 'postgres'],
  },
  {
    category: 'web',
    expectedMinCount: 1,
    expectedServers: ['fetch'],
  },
  {
    category: 'nonexistent',
    expectedMinCount: 0,
    expectedServers: [],
  },
] as const;
