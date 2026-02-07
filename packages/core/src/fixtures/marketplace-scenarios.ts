/**
 * @fileoverview Marketplace Scenario Fixtures
 *
 * Provides comprehensive marketplace fixtures covering all scenarios defined in acceptance criteria:
 * - Empty marketplace
 * - Single server marketplace
 * - Multiple servers marketplace
 * - Various package states (published, deprecated, alpha/beta versions)
 * - Different configuration options
 */

import type {
  MCPMarketplaceEntry,
  MCPServer,
  MCPServerConfig,
  MCPMarketplace,
  MCPMarketplaceSource,
  MCPInstallationStatus,
} from '../types.js';

// ============================================================================
// Package State Variations
// ============================================================================

/**
 * Deprecated filesystem server entry
 */
export const deprecatedFilesystemEntry: MCPMarketplaceEntry = {
  name: 'filesystem-server-v1',
  description: '[DEPRECATED] Legacy MCP server for filesystem operations. Use filesystem-server-v2 instead.',
  version: '1.0.0',
  author: 'Anthropic',
  homepage: 'https://github.com/modelcontextprotocol/servers',
  repository: 'https://github.com/modelcontextprotocol/servers',
  installCommand: 'npm install -g @modelcontextprotocol/server-filesystem@1.0.0',
  serverConfig: {
    name: 'filesystem-server-v1',
    type: 'stdio',
    command: 'npx',
    args: ['@modelcontextprotocol/server-filesystem@1.0.0', '/tmp'],
    autoStart: false,
  },
  capabilities: ['resources', 'tools'],
  verified: true,
};

/**
 * Alpha/beta version server entry (unverified)
 */
export const alphaBrowserEntry: MCPMarketplaceEntry = {
  name: 'browser-automation-alpha',
  description: 'Alpha version of browser automation server with experimental features',
  version: '0.1.0-alpha.3',
  author: 'Community',
  homepage: 'https://github.com/community/mcp-browser-alpha',
  repository: 'https://github.com/community/mcp-browser-alpha',
  installCommand: 'npm install -g @community/mcp-browser-automation@alpha',
  serverConfig: {
    name: 'browser-automation-alpha',
    type: 'stdio',
    command: 'npx',
    args: ['@community/mcp-browser-automation@alpha'],
    autoStart: false,
    env: {
      BROWSER_HEADLESS: 'true',
      BROWSER_TIMEOUT: '30000',
    },
  },
  capabilities: ['tools'],
  verified: false,
};

/**
 * Draft/development server entry (unverified)
 */
export const draftDatabaseEntry: MCPMarketplaceEntry = {
  name: 'database-draft',
  description: 'Draft database server in development - may have breaking changes',
  version: '0.0.1-dev',
  author: 'Developer Team',
  homepage: 'https://github.com/dev-team/mcp-database-draft',
  repository: 'https://github.com/dev-team/mcp-database-draft',
  installCommand: 'npm install -g @dev/mcp-database@dev',
  serverConfig: {
    name: 'database-draft',
    type: 'stdio',
    command: 'npx',
    args: ['@dev/mcp-database@dev'],
    autoStart: false,
    env: {
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_SSL: 'false',
    },
  },
  capabilities: ['tools', 'resources'],
  verified: false,
};

// ============================================================================
// Configuration Variations
// ============================================================================

/**
 * Server with HTTP configuration
 */
export const httpServerEntry: MCPMarketplaceEntry = {
  name: 'api-gateway',
  description: 'HTTP-based MCP server for API gateway operations',
  version: '2.1.0',
  author: 'Enterprise Team',
  homepage: 'https://enterprise.com/api-gateway',
  repository: 'https://github.com/enterprise/mcp-api-gateway',
  installCommand: 'npm install -g @enterprise/mcp-api-gateway',
  serverConfig: {
    name: 'api-gateway',
    type: 'http',
    url: 'http://localhost:3000/mcp',
    autoStart: false,
    env: {
      RATE_LIMIT: '1000',
      REQUEST_TIMEOUT: '5000',
    },
  },
  capabilities: ['tools', 'resources'],
  verified: true,
};

/**
 * Server with SSE configuration
 */
export const sseServerEntry: MCPMarketplaceEntry = {
  name: 'realtime-updates',
  description: 'Server-Sent Events MCP server for real-time data streams',
  version: '1.5.2',
  author: 'Streaming Corp',
  homepage: 'https://streaming.corp/realtime',
  repository: 'https://github.com/streaming/mcp-realtime',
  installCommand: 'npm install -g @streaming/mcp-realtime',
  serverConfig: {
    name: 'realtime-updates',
    type: 'sse',
    url: 'http://localhost:8080/events',
    autoStart: true,
    env: {
      STREAM_BUFFER_SIZE: '1024',
      HEARTBEAT_INTERVAL: '30',
    },
  },
  capabilities: ['tools'],
  verified: true,
};

/**
 * Server with complex environment configuration
 */
export const complexConfigEntry: MCPMarketplaceEntry = {
  name: 'ml-processor',
  description: 'Machine learning processing server with GPU acceleration',
  version: '3.0.0',
  author: 'AI Research Lab',
  homepage: 'https://ailab.org/ml-processor',
  repository: 'https://github.com/ailab/mcp-ml-processor',
  installCommand: 'pip install ml-processor-mcp',
  serverConfig: {
    name: 'ml-processor',
    type: 'stdio',
    command: 'python',
    args: ['-m', 'ml_processor.mcp_server'],
    autoStart: false,
    env: {
      CUDA_VISIBLE_DEVICES: '0,1',
      MODEL_CACHE_DIR: '/tmp/models',
      BATCH_SIZE: '32',
      GPU_MEMORY_FRACTION: '0.8',
      LOG_LEVEL: 'INFO',
    },
  },
  capabilities: ['tools', 'resources'],
  verified: true,
};

// ============================================================================
// Marketplace Source Variations
// ============================================================================

/**
 * Testing marketplace source with fast refresh
 */
export const testingMarketplaceSource: MCPMarketplaceSource = {
  url: 'https://test.registry.modelcontextprotocol.io/catalog.json',
  enabled: true,
  refreshIntervalMinutes: 5,
  allowUnverified: true,
};

/**
 * Enterprise marketplace source
 */
export const enterpriseMarketplaceSource: MCPMarketplaceSource = {
  url: 'https://enterprise.internal/mcp/catalog.json',
  enabled: true,
  refreshIntervalMinutes: 120,
  allowUnverified: false,
};

/**
 * Disabled marketplace source
 */
export const disabledMarketplaceSource: MCPMarketplaceSource = {
  url: 'https://old.registry.example.com/catalog.json',
  enabled: false,
  refreshIntervalMinutes: 1440,
  allowUnverified: false,
};

// ============================================================================
// Scenario-Specific Marketplaces
// ============================================================================

/**
 * Empty marketplace - no servers available
 */
export const emptyMarketplace: MCPMarketplace = {
  name: 'Empty MCP Registry',
  description: 'Registry with no available servers',
  version: '1.0.0',
  lastUpdated: new Date('2024-01-01T00:00:00Z').toISOString(),
  servers: [],
  source: testingMarketplaceSource,
};

/**
 * Single server marketplace
 */
export const singleServerMarketplace: MCPMarketplace = {
  name: 'Basic MCP Registry',
  description: 'Registry with a single filesystem server',
  version: '1.0.0',
  lastUpdated: new Date('2024-02-01T10:00:00Z').toISOString(),
  servers: [
    {
      name: 'filesystem-basic',
      description: 'Simple filesystem operations server',
      version: '1.0.0',
      author: 'Anthropic',
      homepage: 'https://github.com/modelcontextprotocol/servers',
      repository: 'https://github.com/modelcontextprotocol/servers',
      installCommand: 'npm install -g @modelcontextprotocol/server-filesystem',
      serverConfig: {
        name: 'filesystem-basic',
        type: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', '/home/user'],
        autoStart: false,
      },
      capabilities: ['resources', 'tools'],
      verified: true,
    },
  ],
  source: {
    url: 'https://basic.registry.modelcontextprotocol.io/catalog.json',
    enabled: true,
    refreshIntervalMinutes: 1440,
    allowUnverified: false,
  },
};

/**
 * Multiple servers marketplace with mixed states
 */
export const multiServerMarketplace: MCPMarketplace = {
  name: 'Comprehensive MCP Registry',
  description: 'Full registry with servers in various states and configurations',
  version: '2.1.0',
  lastUpdated: new Date('2024-03-15T14:30:00Z').toISOString(),
  servers: [
    // Verified and stable
    {
      name: 'filesystem-server',
      description: 'Production-ready filesystem operations server',
      version: '2.0.0',
      author: 'Anthropic',
      homepage: 'https://github.com/modelcontextprotocol/servers',
      repository: 'https://github.com/modelcontextprotocol/servers',
      installCommand: 'npm install -g @modelcontextprotocol/server-filesystem',
      serverConfig: {
        name: 'filesystem-server',
        type: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', '/workspace'],
        autoStart: false,
      },
      capabilities: ['resources', 'tools'],
      verified: true,
    },

    // Deprecated entry
    deprecatedFilesystemEntry,

    // Alpha/beta version
    alphaBrowserEntry,

    // HTTP configuration
    httpServerEntry,

    // SSE configuration
    sseServerEntry,

    // Complex configuration
    complexConfigEntry,

    // Draft/development
    draftDatabaseEntry,

    // Memory server
    {
      name: 'memory-server',
      description: 'Persistent memory and knowledge management',
      version: '1.3.0',
      author: 'Anthropic',
      homepage: 'https://github.com/modelcontextprotocol/servers',
      repository: 'https://github.com/modelcontextprotocol/servers',
      installCommand: 'npm install -g @modelcontextprotocol/server-memory',
      serverConfig: {
        name: 'memory-server',
        type: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-memory'],
        autoStart: true,
        env: {
          MEMORY_PERSISTENCE: 'true',
          MEMORY_DB_PATH: '/tmp/mcp-memory.db',
        },
      },
      capabilities: ['resources', 'tools'],
      verified: true,
    },
  ],
  source: {
    url: 'https://registry.modelcontextprotocol.io/v2/catalog.json',
    enabled: true,
    refreshIntervalMinutes: 360,
    allowUnverified: true,
  },
};

/**
 * Development marketplace with unverified servers
 */
export const developmentMarketplace: MCPMarketplace = {
  name: 'Development MCP Registry',
  description: 'Testing and development server registry',
  version: '0.9.0',
  lastUpdated: new Date().toISOString(),
  servers: [
    alphaBrowserEntry,
    draftDatabaseEntry,
    {
      name: 'experimental-ai',
      description: 'Experimental AI assistance server with bleeding-edge features',
      version: '0.2.0-beta.1',
      author: 'Research Team',
      homepage: 'https://research.example.com/ai-server',
      repository: 'https://github.com/research/mcp-ai-experimental',
      installCommand: 'npm install -g @research/mcp-ai@beta',
      serverConfig: {
        name: 'experimental-ai',
        type: 'stdio',
        command: 'npx',
        args: ['@research/mcp-ai@beta'],
        autoStart: false,
        env: {
          AI_MODEL: 'experimental-v2',
          CONTEXT_WINDOW: '32000',
          ENABLE_PLUGINS: 'true',
        },
      },
      capabilities: ['tools', 'resources', 'prompts'],
      verified: false,
    },
  ],
  source: testingMarketplaceSource,
};

/**
 * Enterprise marketplace with private servers
 */
export const enterpriseMarketplace: MCPMarketplace = {
  name: 'Enterprise MCP Registry',
  description: 'Private enterprise server registry',
  version: '1.0.0',
  lastUpdated: new Date('2024-03-01T09:00:00Z').toISOString(),
  servers: [
    httpServerEntry,
    {
      name: 'auth-server',
      description: 'Enterprise authentication and authorization server',
      version: '2.5.0',
      author: 'Enterprise Security',
      homepage: 'https://enterprise.internal/auth-server',
      repository: 'https://git.enterprise.internal/mcp/auth-server',
      installCommand: 'npm install -g @enterprise/mcp-auth',
      serverConfig: {
        name: 'auth-server',
        type: 'http',
        url: 'https://auth.enterprise.internal/mcp',
        autoStart: true,
        env: {
          AUTH_DOMAIN: 'enterprise.internal',
          TOKEN_EXPIRY: '3600',
          LDAP_URL: 'ldaps://ldap.enterprise.internal',
        },
      },
      capabilities: ['tools'],
      verified: true,
    },
  ],
  source: enterpriseMarketplaceSource,
};

// ============================================================================
// Fixture Collections for Testing
// ============================================================================

/**
 * All package state variations
 */
export const packageStates = {
  deprecated: deprecatedFilesystemEntry,
  alpha: alphaBrowserEntry,
  draft: draftDatabaseEntry,
} as const;

/**
 * All configuration variations
 */
export const configurationVariations = {
  http: httpServerEntry,
  sse: sseServerEntry,
  complex: complexConfigEntry,
} as const;

/**
 * All marketplace source variations
 */
export const marketplaceSources = {
  testing: testingMarketplaceSource,
  enterprise: enterpriseMarketplaceSource,
  disabled: disabledMarketplaceSource,
} as const;

/**
 * All scenario marketplaces
 */
export const scenarioMarketplaces = {
  empty: emptyMarketplace,
  single: singleServerMarketplace,
  multi: multiServerMarketplace,
  development: developmentMarketplace,
  enterprise: enterpriseMarketplace,
} as const;

// ============================================================================
// Utility Functions for Scenario Testing
// ============================================================================

/**
 * Get all verified marketplace entries across all scenarios
 */
export function getAllVerifiedEntries(): MCPMarketplaceEntry[] {
  const allEntries: MCPMarketplaceEntry[] = [];

  Object.values(scenarioMarketplaces).forEach(marketplace => {
    allEntries.push(...marketplace.servers.filter(server => server.verified));
  });

  return allEntries;
}

/**
 * Get all unverified marketplace entries across all scenarios
 */
export function getAllUnverifiedEntries(): MCPMarketplaceEntry[] {
  const allEntries: MCPMarketplaceEntry[] = [];

  Object.values(scenarioMarketplaces).forEach(marketplace => {
    allEntries.push(...marketplace.servers.filter(server => !server.verified));
  });

  return allEntries;
}

/**
 * Get entries by configuration type
 */
export function getEntriesByConfigType(type: 'stdio' | 'http' | 'sse' | 'sdk'): MCPMarketplaceEntry[] {
  const allEntries: MCPMarketplaceEntry[] = [];

  Object.values(scenarioMarketplaces).forEach(marketplace => {
    allEntries.push(...marketplace.servers.filter(server => server.serverConfig.type === type));
  });

  return allEntries;
}

/**
 * Get entries with environment variables
 */
export function getEntriesWithEnvironment(): MCPMarketplaceEntry[] {
  const allEntries: MCPMarketplaceEntry[] = [];

  Object.values(scenarioMarketplaces).forEach(marketplace => {
    allEntries.push(...marketplace.servers.filter(server =>
      server.serverConfig.env && Object.keys(server.serverConfig.env).length > 0
    ));
  });

  return allEntries;
}

/**
 * Get entries by auto-start configuration
 */
export function getAutoStartEntries(): MCPMarketplaceEntry[] {
  const allEntries: MCPMarketplaceEntry[] = [];

  Object.values(scenarioMarketplaces).forEach(marketplace => {
    allEntries.push(...marketplace.servers.filter(server => server.serverConfig.autoStart));
  });

  return allEntries;
}

/**
 * Create a custom marketplace scenario with specific filters
 */
export function createScenario(options: {
  verified?: boolean;
  configType?: 'stdio' | 'http' | 'sse' | 'sdk';
  hasEnvironment?: boolean;
  autoStart?: boolean;
  name?: string;
  description?: string;
}): MCPMarketplace {
  let servers: MCPMarketplaceEntry[] = [];

  // Gather all servers from all scenarios
  Object.values(scenarioMarketplaces).forEach(marketplace => {
    servers.push(...marketplace.servers);
  });

  // Apply filters
  if (options.verified !== undefined) {
    servers = servers.filter(server => server.verified === options.verified);
  }

  if (options.configType) {
    servers = servers.filter(server => server.serverConfig.type === options.configType);
  }

  if (options.hasEnvironment !== undefined) {
    servers = servers.filter(server => {
      const hasEnv = server.serverConfig.env && Object.keys(server.serverConfig.env).length > 0;
      return hasEnv === options.hasEnvironment;
    });
  }

  if (options.autoStart !== undefined) {
    servers = servers.filter(server => server.serverConfig.autoStart === options.autoStart);
  }

  return {
    name: options.name || 'Custom Test Scenario',
    description: options.description || 'Custom marketplace scenario for testing',
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    servers,
    source: testingMarketplaceSource,
  };
}