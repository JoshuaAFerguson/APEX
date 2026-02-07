/**
 * @fileoverview Base Marketplace Fixtures
 *
 * Provides core marketplace entity fixtures for testing across the APEX system.
 * These are base building blocks that can be used by all packages for consistent testing.
 */

import type {
  MCPMarketplaceEntry,
  MCPServer,
  MCPServerConfig,
  MCPMarketplace,
  MCPMarketplaceSource,
} from '../types.js';

// ============================================================================
// Base Server Configurations
// ============================================================================

/**
 * Base server configuration for filesystem operations
 */
export const baseFilesystemServerConfig: MCPServerConfig = {
  name: 'filesystem-server',
  type: 'stdio',
  command: 'npx',
  args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
  autoStart: false,
};

/**
 * Base server configuration for memory operations
 */
export const baseMemoryServerConfig: MCPServerConfig = {
  name: 'memory-server',
  type: 'stdio',
  command: 'npx',
  args: ['@modelcontextprotocol/server-memory'],
  autoStart: false,
};

/**
 * Base server configuration for git operations
 */
export const baseGitServerConfig: MCPServerConfig = {
  name: 'git-server',
  type: 'stdio',
  command: 'npx',
  args: ['@modelcontextprotocol/server-git'],
  autoStart: false,
};

/**
 * Base server configuration for web fetch operations
 */
export const baseFetchServerConfig: MCPServerConfig = {
  name: 'fetch-server',
  type: 'stdio',
  command: 'npx',
  args: ['@modelcontextprotocol/server-fetch'],
  autoStart: false,
};

/**
 * Base server configuration for PostgreSQL database operations
 */
export const basePostgresServerConfig: MCPServerConfig = {
  name: 'postgres-server',
  type: 'stdio',
  command: 'npx',
  args: ['@modelcontextprotocol/server-postgres'],
  env: {
    POSTGRES_URL: 'postgresql://localhost:5432/testdb'
  },
  autoStart: false,
};

// ============================================================================
// Base MCP Server Definitions
// ============================================================================

/**
 * Base MCP Server definition for filesystem operations
 */
export const baseFilesystemServer: MCPServer = {
  name: 'filesystem-server',
  package: '@modelcontextprotocol/server-filesystem',
  command: 'npx',
  args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
  env: {},
  envVars: [],
  version: '1.0.0',
};

/**
 * Base MCP Server definition for memory operations
 */
export const baseMemoryServer: MCPServer = {
  name: 'memory-server',
  package: '@modelcontextprotocol/server-memory',
  command: 'npx',
  args: ['@modelcontextprotocol/server-memory'],
  env: {},
  envVars: [],
  version: '1.0.0',
};

/**
 * Base MCP Server definition for git operations
 */
export const baseGitServer: MCPServer = {
  name: 'git-server',
  package: '@modelcontextprotocol/server-git',
  command: 'npx',
  args: ['@modelcontextprotocol/server-git'],
  env: {},
  envVars: [],
  version: '1.0.0',
};

// ============================================================================
// Base Marketplace Entry Definitions
// ============================================================================

/**
 * Base marketplace entry for filesystem server
 */
export const baseFilesystemMarketplaceEntry: MCPMarketplaceEntry = {
  name: 'filesystem-server',
  description: 'MCP server for filesystem operations - read, write, and list files and directories',
  version: '1.0.0',
  author: 'Anthropic',
  homepage: 'https://github.com/modelcontextprotocol/servers',
  repository: 'https://github.com/modelcontextprotocol/servers',
  installCommand: 'npm install -g @modelcontextprotocol/server-filesystem',
  serverConfig: baseFilesystemServerConfig,
  capabilities: ['resources', 'tools'],
  verified: true,
};

/**
 * Base marketplace entry for memory server
 */
export const baseMemoryMarketplaceEntry: MCPMarketplaceEntry = {
  name: 'memory-server',
  description: 'MCP server providing persistent memory/knowledge capabilities across conversations',
  version: '1.0.0',
  author: 'Anthropic',
  homepage: 'https://github.com/modelcontextprotocol/servers',
  repository: 'https://github.com/modelcontextprotocol/servers',
  installCommand: 'npm install -g @modelcontextprotocol/server-memory',
  serverConfig: baseMemoryServerConfig,
  capabilities: ['resources', 'tools'],
  verified: true,
};

/**
 * Base marketplace entry for git server
 */
export const baseGitMarketplaceEntry: MCPMarketplaceEntry = {
  name: 'git-server',
  description: 'MCP server for git repository operations - clone, commit, push, pull, and branch management',
  version: '1.0.0',
  author: 'Anthropic',
  homepage: 'https://github.com/modelcontextprotocol/servers',
  repository: 'https://github.com/modelcontextprotocol/servers',
  installCommand: 'npm install -g @modelcontextprotocol/server-git',
  serverConfig: baseGitServerConfig,
  capabilities: ['tools'],
  verified: true,
};

/**
 * Base marketplace entry for fetch server
 */
export const baseFetchMarketplaceEntry: MCPMarketplaceEntry = {
  name: 'fetch-server',
  description: 'MCP server for making HTTP requests and fetching web content',
  version: '1.0.0',
  author: 'Anthropic',
  homepage: 'https://github.com/modelcontextprotocol/servers',
  repository: 'https://github.com/modelcontextprotocol/servers',
  installCommand: 'npm install -g @modelcontextprotocol/server-fetch',
  serverConfig: baseFetchServerConfig,
  capabilities: ['tools'],
  verified: true,
};

/**
 * Base marketplace entry for PostgreSQL server
 */
export const basePostgresMarketplaceEntry: MCPMarketplaceEntry = {
  name: 'postgres-server',
  description: 'MCP server for PostgreSQL database operations - query, insert, update, delete',
  version: '1.0.0',
  author: 'Anthropic',
  homepage: 'https://github.com/modelcontextprotocol/servers',
  repository: 'https://github.com/modelcontextprotocol/servers',
  installCommand: 'npm install -g @modelcontextprotocol/server-postgres',
  serverConfig: basePostgresServerConfig,
  capabilities: ['tools'],
  verified: true,
};

// ============================================================================
// Marketplace Source Configurations
// ============================================================================

/**
 * Default marketplace source configuration
 */
export const baseMarketplaceSource: MCPMarketplaceSource = {
  url: 'https://registry.modelcontextprotocol.io/catalog.json',
  enabled: true,
  refreshIntervalMinutes: 1440,
  allowUnverified: false,
};

/**
 * Development marketplace source configuration (allows unverified)
 */
export const baseDevelopmentMarketplaceSource: MCPMarketplaceSource = {
  url: 'https://dev.registry.modelcontextprotocol.io/catalog.json',
  enabled: true,
  refreshIntervalMinutes: 60,
  allowUnverified: true,
};

/**
 * Local marketplace source configuration for testing
 */
export const baseLocalMarketplaceSource: MCPMarketplaceSource = {
  url: 'file:///tmp/marketplace-catalog.json',
  enabled: true,
  refreshIntervalMinutes: 1,
  allowUnverified: true,
};

// ============================================================================
// Complete Marketplace Definitions
// ============================================================================

/**
 * Base marketplace with essential MCP servers
 */
export const baseMarketplace: MCPMarketplace = {
  name: 'MCP Registry',
  description: 'Official MCP server registry for discovering and installing Model Context Protocol servers',
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  servers: [
    baseFilesystemMarketplaceEntry,
    baseMemoryMarketplaceEntry,
    baseGitMarketplaceEntry,
    baseFetchMarketplaceEntry,
    basePostgresMarketplaceEntry,
  ],
  source: baseMarketplaceSource,
};

/**
 * Development marketplace with additional testing servers
 */
export const baseDevelopmentMarketplace: MCPMarketplace = {
  name: 'MCP Development Registry',
  description: 'Development registry for testing and experimental MCP servers',
  version: '0.1.0',
  lastUpdated: new Date().toISOString(),
  servers: [
    baseFilesystemMarketplaceEntry,
    baseMemoryMarketplaceEntry,
    {
      ...baseGitMarketplaceEntry,
      verified: false, // Testing unverified entry
    },
  ],
  source: baseDevelopmentMarketplaceSource,
};

// ============================================================================
// Fixture Collections
// ============================================================================

/**
 * Collection of all base server configurations
 */
export const baseServerConfigs = {
  filesystem: baseFilesystemServerConfig,
  memory: baseMemoryServerConfig,
  git: baseGitServerConfig,
  fetch: baseFetchServerConfig,
  postgres: basePostgresServerConfig,
} as const;

/**
 * Collection of all base MCP servers
 */
export const baseServers = {
  filesystem: baseFilesystemServer,
  memory: baseMemoryServer,
  git: baseGitServer,
} as const;

/**
 * Collection of all base marketplace entries
 */
export const baseMarketplaceEntries = {
  filesystem: baseFilesystemMarketplaceEntry,
  memory: baseMemoryMarketplaceEntry,
  git: baseGitMarketplaceEntry,
  fetch: baseFetchMarketplaceEntry,
  postgres: basePostgresMarketplaceEntry,
} as const;

/**
 * Collection of all marketplace sources
 */
export const baseMarketplaceSources = {
  default: baseMarketplaceSource,
  development: baseDevelopmentMarketplaceSource,
  local: baseLocalMarketplaceSource,
} as const;

/**
 * Collection of all complete marketplaces
 */
export const baseMarketplaces = {
  default: baseMarketplace,
  development: baseDevelopmentMarketplace,
} as const;

// ============================================================================
// Utility Functions for Fixture Creation
// ============================================================================

/**
 * Create a custom marketplace entry with overrides
 */
export function createMarketplaceEntry(
  baseEntry: MCPMarketplaceEntry,
  overrides: Partial<MCPMarketplaceEntry> = {}
): MCPMarketplaceEntry {
  return {
    ...baseEntry,
    ...overrides,
    serverConfig: {
      ...baseEntry.serverConfig,
      ...(overrides.serverConfig || {}),
    },
  };
}

/**
 * Create a custom server configuration with overrides
 */
export function createServerConfig(
  baseConfig: MCPServerConfig,
  overrides: Partial<MCPServerConfig> = {}
): MCPServerConfig {
  return {
    ...baseConfig,
    ...overrides,
  };
}

/**
 * Create a custom marketplace with overrides
 */
export function createMarketplace(
  baseMarketplace: MCPMarketplace,
  overrides: Partial<MCPMarketplace> = {}
): MCPMarketplace {
  return {
    ...baseMarketplace,
    ...overrides,
    servers: overrides.servers || baseMarketplace.servers,
    source: overrides.source || baseMarketplace.source,
  };
}

/**
 * Get all verified marketplace entries
 */
export function getVerifiedEntries(): MCPMarketplaceEntry[] {
  return Object.values(baseMarketplaceEntries).filter(entry => entry.verified);
}

/**
 * Get marketplace entries by capability
 */
export function getEntriesByCapability(capability: string): MCPMarketplaceEntry[] {
  return Object.values(baseMarketplaceEntries).filter(
    entry => entry.capabilities?.includes(capability)
  );
}

// ============================================================================
// Factory Function Types (ADR-002)
// ============================================================================

/**
 * Configuration options for MCPServer factory
 */
export interface MCPServerFactoryOptions {
  /** Include default environment variables */
  includeEnv?: boolean;
  /** Include structured envVars array */
  includeEnvVars?: boolean;
}

/**
 * Configuration options for MCPServerConfig factory
 */
export interface MCPServerConfigFactoryOptions {
  /** Connection type preset */
  type?: 'stdio' | 'http' | 'sse' | 'sdk';
  /** Whether to auto-start */
  autoStart?: boolean;
  /** Include environment variables */
  includeEnv?: boolean;
}

/**
 * Configuration options for MCPMarketplaceEntry factory
 */
export interface MCPMarketplaceEntryFactoryOptions {
  /** Set verified status */
  verified?: boolean;
  /** Include default capabilities */
  includeCapabilities?: boolean;
}

// ============================================================================
// Factory Functions (ADR-002)
// ============================================================================

/**
 * Creates an MCPServerConfig fixture with sensible defaults
 *
 * @param overrides - Partial MCPServerConfig properties to override defaults
 * @param options - Factory-level configuration options
 * @returns A fully-typed MCPServerConfig object
 *
 * @example
 * ```typescript
 * const config = createMCPServerConfig({
 *   name: 'my-server',
 *   autoStart: true
 * });
 * expect(config.name).toBe('my-server');
 * expect(config.type).toBe('stdio'); // default value
 * ```
 */
export function createMCPServerConfig(
  overrides: Partial<MCPServerConfig> = {},
  options: MCPServerConfigFactoryOptions = {}
): MCPServerConfig {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const defaults: MCPServerConfig = {
    name: `test-config-${uniqueId}`,
    type: options.type || 'stdio',
    command: 'npx',
    args: ['@apex/test-mcp-server'],
    autoStart: options.autoStart ?? false,
  };

  if (options.includeEnv) {
    defaults.env = {
      NODE_ENV: 'test',
    };
  }

  return {
    ...defaults,
    ...overrides,
  };
}

/**
 * Creates an MCPServer fixture with sensible defaults
 *
 * @param overrides - Partial MCPServer properties to override defaults
 * @param options - Factory-level configuration options
 * @returns A fully-typed MCPServer object
 *
 * @example
 * ```typescript
 * const server = createMCPServer({
 *   name: 'postgres-server',
 *   package: '@modelcontextprotocol/server-postgres'
 * });
 * expect(server.name).toBe('postgres-server');
 * expect(server.version).toBe('1.0.0'); // default value
 * ```
 */
export function createMCPServer(
  overrides: Partial<MCPServer> = {},
  options: MCPServerFactoryOptions = {}
): MCPServer {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const defaults: MCPServer = {
    name: `test-server-${uniqueId}`,
    package: '@apex/test-mcp-server',
    command: 'npx',
    args: ['@apex/test-mcp-server'],
    env: options.includeEnv ? { NODE_ENV: 'test' } : {},
    envVars: [],
    version: '1.0.0',
  };

  return {
    ...defaults,
    ...overrides,
  };
}

/**
 * Creates an MCPMarketplaceEntry fixture with sensible defaults
 *
 * @param overrides - Partial MCPMarketplaceEntry properties to override defaults
 * @param options - Factory-level configuration options
 * @returns A fully-typed MCPMarketplaceEntry object
 *
 * @example
 * ```typescript
 * const entry = createMCPMarketplaceEntry({
 *   name: 'filesystem-server',
 *   verified: true
 * });
 * expect(entry.name).toBe('filesystem-server');
 * expect(entry.verified).toBe(true);
 * expect(entry.serverConfig).toBeDefined(); // uses config factory
 * ```
 */
export function createMCPMarketplaceEntry(
  overrides: Partial<MCPMarketplaceEntry> = {},
  options: MCPMarketplaceEntryFactoryOptions = {}
): MCPMarketplaceEntry {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const defaults: MCPMarketplaceEntry = {
    name: `test-marketplace-entry-${uniqueId}`,
    description: 'Test MCP server for testing purposes',
    version: '1.0.0',
    author: 'Test Author',
    homepage: 'https://example.com/test-server',
    repository: 'https://github.com/test/test-server',
    installCommand: 'npm install -g @apex/test-mcp-server',
    serverConfig: createMCPServerConfig(
      { name: `test-marketplace-entry-${uniqueId}` },
      { type: 'stdio' }
    ),
    capabilities: options.includeCapabilities !== false ? ['tools'] : undefined,
    verified: options.verified ?? false,
  };

  const result = {
    ...defaults,
    ...overrides,
  };

  // If overrides includes serverConfig, merge it properly
  if (overrides.serverConfig) {
    result.serverConfig = {
      ...defaults.serverConfig,
      ...overrides.serverConfig,
    };
  }

  return result;
}

// ============================================================================
// Preset Collections (ADR-002)
// ============================================================================

/**
 * Preset collections for common marketplace testing scenarios
 */
export const MCPServerPresets = {
  /** Basic server configurations */
  basic: {
    filesystem: () => createMCPServer({
      name: 'filesystem-server',
      package: '@modelcontextprotocol/server-filesystem',
      args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
    }),
    memory: () => createMCPServer({
      name: 'memory-server',
      package: '@modelcontextprotocol/server-memory',
      args: ['@modelcontextprotocol/server-memory'],
    }),
    git: () => createMCPServer({
      name: 'git-server',
      package: '@modelcontextprotocol/server-git',
      args: ['@modelcontextprotocol/server-git'],
    }),
  },

  /** Server configuration presets */
  configs: {
    stdio: () => createMCPServerConfig({}, { type: 'stdio' }),
    http: () => createMCPServerConfig({}, { type: 'http' }),
    sse: () => createMCPServerConfig({}, { type: 'sse' }),
    sdk: () => createMCPServerConfig({}, { type: 'sdk' }),
    withEnv: () => createMCPServerConfig({}, { includeEnv: true }),
    autoStart: () => createMCPServerConfig({}, { autoStart: true }),
  },

  /** Marketplace entry presets */
  marketplace: {
    verified: () => createMCPMarketplaceEntry({}, { verified: true }),
    unverified: () => createMCPMarketplaceEntry({}, { verified: false }),
    withCapabilities: () => createMCPMarketplaceEntry({
      capabilities: ['tools', 'resources', 'prompts'],
    }),
    minimal: () => createMCPMarketplaceEntry({
      description: 'Minimal test server',
      capabilities: [],
    }),
  },
} as const;