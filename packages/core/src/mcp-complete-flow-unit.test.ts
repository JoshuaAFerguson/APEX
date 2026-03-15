/**
 * @fileoverview MCP Complete Flow Unit Tests (CLI-Independent)
 *
 * Unit tests that verify MCP marketplace workflow logic without depending on
 * the CLI binary. These tests demonstrate the testing approach and can run
 * independently of the build system issues affecting the CLI.
 *
 * This serves as a proof-of-concept for the E2E test implementation and
 * validates the core testing logic.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

// ============================================================================
// Types (replicated from E2E implementation)
// ============================================================================

interface MCPServerConfig {
  name: string;
  type: string;
  command: string;
  args?: string[];
  autoStart?: boolean;
  env?: Record<string, string>;
}

interface ApexConfig {
  project?: {
    name: string;
    language: string;
  };
  autonomy?: {
    default: string;
  };
  models?: {
    planning: string;
    implementation: string;
  };
  limits?: {
    maxTokensPerTask: number;
    maxCostPerTask: number;
  };
  mcp?: {
    servers?: Record<string, MCPServerConfig>;
  };
}

interface MarketplaceEntry {
  id: string;
  name: string;
  description: string;
  package: string;
  category: string;
  tags: string[];
  verified: boolean;
  defaultEnabled: boolean;
}

interface MCPTestContext {
  projectDir: string;
  configPath: string;
  apexDir: string;
}

// ============================================================================
// Mock Data and Utilities
// ============================================================================

const MOCK_MARKETPLACE_CATALOG: MarketplaceEntry[] = [
  {
    id: 'filesystem',
    name: 'Filesystem Server',
    description: 'MCP server providing secure filesystem access with configurable path restrictions',
    package: '@modelcontextprotocol/server-filesystem',
    category: 'filesystem',
    tags: ['filesystem', 'files', 'workspace', 'io', 'local'],
    verified: true,
    defaultEnabled: true,
  },
  {
    id: 'memory',
    name: 'Memory Server',
    description: 'MCP server providing in-memory key-value storage and temporary data persistence',
    package: '@modelcontextprotocol/server-memory',
    category: 'storage',
    tags: ['memory', 'storage', 'cache', 'key-value', 'temporary', 'persistence'],
    verified: true,
    defaultEnabled: false,
  },
  {
    id: 'fetch',
    name: 'Fetch Server',
    description: 'MCP server for making HTTP requests and web scraping',
    package: '@modelcontextprotocol/server-fetch',
    category: 'network',
    tags: ['http', 'web', 'fetch', 'scraping', 'api'],
    verified: true,
    defaultEnabled: false,
  },
];

const MOCK_SERVER_TEMPLATES: Record<string, MCPServerConfig> = {
  filesystem: {
    name: 'filesystem',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    autoStart: true,
    env: {
      ALLOWED_PATHS: '.',
      FILE_SIZE_LIMIT: '10485760',
    },
  },
  memory: {
    name: 'memory',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    autoStart: true,
    env: {
      MAX_MEMORY_SIZE: '104857600',
      DEFAULT_TTL: '3600',
    },
  },
  fetch: {
    name: 'fetch',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    autoStart: false,
  },
};

// ============================================================================
// Helper Functions (Unit Test Versions)
// ============================================================================

/**
 * Create a test project with mock APEX configuration
 */
async function createTestProject(prefix = 'mcp-unit-'): Promise<MCPTestContext> {
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const apexDir = path.join(projectDir, '.apex');
  const configPath = path.join(apexDir, 'config.yaml');

  await fs.mkdir(apexDir, { recursive: true });

  const defaultConfig: ApexConfig = {
    project: {
      name: 'test-project',
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
    mcp: {
      servers: {},
    },
  };

  await writeApexConfig(configPath, defaultConfig);

  return {
    projectDir,
    configPath,
    apexDir,
  };
}

/**
 * Clean up test project
 */
async function cleanupTestProject(ctx: MCPTestContext): Promise<void> {
  try {
    await fs.rm(ctx.projectDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Read and parse APEX config file
 */
async function readApexConfig(configPath: string): Promise<ApexConfig> {
  const content = await fs.readFile(configPath, 'utf-8');
  return parseYaml(content) as ApexConfig;
}

/**
 * Write APEX config file
 */
async function writeApexConfig(configPath: string, config: ApexConfig): Promise<void> {
  const content = stringifyYaml(config);
  await fs.writeFile(configPath, content);
}

/**
 * Mock marketplace listing operation
 */
function mockListServers(json = false): { stdout: string; stderr: string; exitCode: number } {
  if (json) {
    return {
      stdout: JSON.stringify(MOCK_MARKETPLACE_CATALOG, null, 2),
      stderr: '',
      exitCode: 0,
    };
  }

  const output = [
    'MCP Marketplace - Available Servers',
    '',
    ...MOCK_MARKETPLACE_CATALOG.map(
      (server) =>
        `${server.name} (${server.id})\n  ${server.description}\n  Category: ${server.category}\n  Verified: ${server.verified ? '✅' : '❌'}\n`
    ),
  ].join('\n');

  return {
    stdout: output,
    stderr: '',
    exitCode: 0,
  };
}

/**
 * Mock server search operation
 */
function mockSearchServers(
  query: string,
  json = false
): { stdout: string; stderr: string; exitCode: number } {
  const filtered = MOCK_MARKETPLACE_CATALOG.filter(
    (server) =>
      server.id.includes(query.toLowerCase()) ||
      server.name.toLowerCase().includes(query.toLowerCase()) ||
      server.category.toLowerCase().includes(query.toLowerCase()) ||
      server.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
  );

  if (json) {
    return {
      stdout: JSON.stringify(filtered, null, 2),
      stderr: '',
      exitCode: 0,
    };
  }

  if (filtered.length === 0) {
    return {
      stdout: 'No servers found matching query: ' + query,
      stderr: '',
      exitCode: 0,
    };
  }

  const output = filtered
    .map(
      (server) =>
        `${server.name} (${server.id})\n  ${server.description}\n  Category: ${server.category}\n`
    )
    .join('\n');

  return {
    stdout: output,
    stderr: '',
    exitCode: 0,
  };
}

/**
 * Mock server installation
 */
async function mockInstallServer(
  ctx: MCPTestContext,
  serverId: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const template = MOCK_SERVER_TEMPLATES[serverId];
  if (!template) {
    return {
      stdout: '',
      stderr: `Server template not found: ${serverId}`,
      exitCode: 1,
    };
  }

  const config = await readApexConfig(ctx.configPath);
  if (!config.mcp) {
    config.mcp = { servers: {} };
  }
  if (!config.mcp.servers) {
    config.mcp.servers = {};
  }

  // Check for duplicate
  if (config.mcp.servers[serverId]) {
    return {
      stdout: `Server ${serverId} is already installed`,
      stderr: '',
      exitCode: 0,
    };
  }

  config.mcp.servers[serverId] = { ...template };
  await writeApexConfig(ctx.configPath, config);

  return {
    stdout: `✅ Successfully installed ${serverId} server`,
    stderr: '',
    exitCode: 0,
  };
}

/**
 * Mock validation operation
 */
async function mockValidateConfig(
  ctx: MCPTestContext
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const config = await readApexConfig(ctx.configPath);

    // Basic validation checks
    if (!config.project?.name) {
      return {
        stdout: '',
        stderr: 'Configuration error: project.name is required',
        exitCode: 1,
      };
    }

    if (!config.mcp) {
      return {
        stdout: '✅ Configuration is valid (no MCP servers configured)',
        stderr: '',
        exitCode: 0,
      };
    }

    const serverCount = Object.keys(config.mcp.servers || {}).length;
    return {
      stdout: `✅ Configuration is valid (${serverCount} MCP servers configured)`,
      stderr: '',
      exitCode: 0,
    };
  } catch (error) {
    return {
      stdout: '',
      stderr: `Configuration validation failed: ${(error as Error).message}`,
      exitCode: 1,
    };
  }
}

/**
 * Mock status operation
 */
async function mockStatus(
  ctx: MCPTestContext
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const config = await readApexConfig(ctx.configPath);

    if (!config.mcp?.servers || Object.keys(config.mcp.servers).length === 0) {
      return {
        stdout: 'MCP Server Status\n\nNo MCP servers configured.',
        stderr: '',
        exitCode: 0,
      };
    }

    const serverStatuses = Object.entries(config.mcp.servers).map(([id, serverConfig]) => {
      return `${id}:\n  Status: configured\n  Auto-start: ${serverConfig.autoStart ? 'enabled' : 'disabled'}\n  Command: ${serverConfig.command}\n`;
    });

    return {
      stdout: 'MCP Server Status\n\n' + serverStatuses.join('\n'),
      stderr: '',
      exitCode: 0,
    };
  } catch (error) {
    return {
      stdout: '',
      stderr: `Status check failed: ${(error as Error).message}`,
      exitCode: 1,
    };
  }
}

/**
 * Mock installed servers listing
 */
async function mockListInstalled(
  ctx: MCPTestContext,
  json = false
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const config = await readApexConfig(ctx.configPath);

    if (!config.mcp?.servers || Object.keys(config.mcp.servers).length === 0) {
      if (json) {
        return { stdout: '[]', stderr: '', exitCode: 0 };
      }
      return {
        stdout: 'No MCP servers installed.',
        stderr: '',
        exitCode: 0,
      };
    }

    if (json) {
      const installedServers = Object.entries(config.mcp.servers).map(([id, serverConfig]) => ({
        id,
        name: serverConfig.name,
        type: serverConfig.type,
        autoStart: serverConfig.autoStart,
        command: serverConfig.command,
        args: serverConfig.args,
      }));

      return {
        stdout: JSON.stringify(installedServers, null, 2),
        stderr: '',
        exitCode: 0,
      };
    }

    const output = Object.entries(config.mcp.servers)
      .map(([id, serverConfig]) => {
        const serverInfo = MOCK_MARKETPLACE_CATALOG.find((s) => s.id === id);
        const name = serverInfo?.name || serverConfig.name;
        return `${name} (${id})\n  auto-start: ${serverConfig.autoStart}\n  type: ${serverConfig.type}\n`;
      })
      .join('\n');

    return {
      stdout: 'Installed MCP Servers\n\n' + output,
      stderr: '',
      exitCode: 0,
    };
  } catch (error) {
    return {
      stdout: '',
      stderr: `Failed to list installed servers: ${(error as Error).message}`,
      exitCode: 1,
    };
  }
}

// ============================================================================
// Unit Tests
// ============================================================================

describe('MCP Complete Flow Unit Tests (CLI-Independent)', () => {
  let ctx: MCPTestContext;

  beforeEach(async () => {
    ctx = await createTestProject();
  });

  afterEach(async () => {
    await cleanupTestProject(ctx);
  });

  describe('1. Browse Catalog (Marketplace Listing)', () => {
    it('should list all available MCP servers', async () => {
      const result = mockListServers();

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('MCP Marketplace');
      expect(result.stdout).toContain('Filesystem Server');
      expect(result.stdout).toContain('Memory Server');
      expect(result.stdout).toContain('Fetch Server');
      expect(result.stdout).toContain('filesystem access');
    });

    it('should list servers in JSON format for machine processing', async () => {
      const result = mockListServers(true);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');

      const data = JSON.parse(result.stdout);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(3);

      const filesystemServer = data.find((server: MarketplaceEntry) => server.id === 'filesystem');
      expect(filesystemServer).toBeDefined();
      expect(filesystemServer.name).toBe('Filesystem Server');
      expect(filesystemServer.verified).toBe(true);
      expect(filesystemServer.category).toBe('filesystem');
      expect(Array.isArray(filesystemServer.tags)).toBe(true);
    });

    it('should show detailed server information', async () => {
      const result = mockListServers();

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Category:/);
      expect(result.stdout).toMatch(/Verified:/);
      expect(result.stdout).toContain('✅');
    });
  });

  describe('2. Search and Select Server', () => {
    it('should search servers by name', async () => {
      const result = mockSearchServers('filesystem');

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Filesystem Server');
      expect(result.stdout).not.toContain('Memory Server');
    });

    it('should search servers by category', async () => {
      const result = mockSearchServers('storage');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Memory Server');
      expect(result.stdout).not.toContain('Filesystem Server');
    });

    it('should search servers by tag', async () => {
      const result = mockSearchServers('cache');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Memory Server');
    });

    it('should return JSON search results', async () => {
      const result = mockSearchServers('filesystem', true);

      expect(result.exitCode).toBe(0);
      const data = JSON.parse(result.stdout);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0].id).toBe('filesystem');
    });

    it('should handle no-match searches gracefully', async () => {
      const result = mockSearchServers('nonexistent-server');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No servers found');
    });
  });

  describe('3. Install Server', () => {
    it('should install filesystem server from marketplace template', async () => {
      const installResult = await mockInstallServer(ctx, 'filesystem');

      expect(installResult.exitCode).toBe(0);
      expect(installResult.stdout).toContain('✅');
      expect(installResult.stdout).toContain('Successfully installed filesystem');

      // Verify server is in config
      const config = await readApexConfig(ctx.configPath);
      expect(config.mcp?.servers?.filesystem).toBeDefined();
      expect(config.mcp!.servers!.filesystem.name).toBe('filesystem');
      expect(config.mcp!.servers!.filesystem.type).toBe('stdio');
      expect(config.mcp!.servers!.filesystem.autoStart).toBe(true);
    });

    it('should install memory server with proper configuration', async () => {
      const installResult = await mockInstallServer(ctx, 'memory');

      expect(installResult.exitCode).toBe(0);

      const config = await readApexConfig(ctx.configPath);
      const serverConfig = config.mcp?.servers?.memory;
      expect(serverConfig).toBeDefined();
      expect(serverConfig!.name).toBe('memory');
      expect(serverConfig!.autoStart).toBe(true);
      expect(serverConfig!.env).toBeDefined();
      expect(serverConfig!.env!.MAX_MEMORY_SIZE).toBe('104857600');
    });

    it('should detect duplicate installation attempts', async () => {
      // Install first time
      const firstInstall = await mockInstallServer(ctx, 'filesystem');
      expect(firstInstall.exitCode).toBe(0);

      // Try to install again
      const secondInstall = await mockInstallServer(ctx, 'filesystem');
      expect(secondInstall.exitCode).toBe(0);
      expect(secondInstall.stdout).toContain('already installed');
    });

    it('should handle non-existent template gracefully', async () => {
      const result = await mockInstallServer(ctx, 'nonexistent-server');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Server template not found');
    });
  });

  describe('4. Auto-Configure and Verify Installation', () => {
    beforeEach(async () => {
      // Install filesystem server for verification tests
      await mockInstallServer(ctx, 'filesystem');
    });

    it('should validate installed server configuration', async () => {
      const result = await mockValidateConfig(ctx);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('✅');
      expect(result.stdout).toContain('valid');
      expect(result.stdout).toContain('1 MCP servers');
    });

    it('should show server in installed list', async () => {
      const result = await mockListInstalled(ctx);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Filesystem Server');
    });

    it('should show server in status output', async () => {
      const result = await mockStatus(ctx);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('MCP Server Status');
      expect(result.stdout).toContain('filesystem');
      expect(result.stdout).toContain('configured');
    });

    it('should show installed servers in JSON format', async () => {
      const result = await mockListInstalled(ctx, true);

      expect(result.exitCode).toBe(0);
      const data = JSON.parse(result.stdout);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);

      const filesystemServer = data[0];
      expect(filesystemServer.id).toBe('filesystem');
      expect(filesystemServer.name).toBe('filesystem');
      expect(filesystemServer.autoStart).toBe(true);
    });
  });

  describe('5. Complete Happy Path Flows', () => {
    it('should complete: list → search → install → installed → validate → status', async () => {
      // Step 1: List marketplace
      const listResult = mockListServers();
      expect(listResult.exitCode).toBe(0);
      expect(listResult.stdout).toContain('Filesystem Server');

      // Step 2: Search for server
      const searchResult = mockSearchServers('filesystem');
      expect(searchResult.exitCode).toBe(0);
      expect(searchResult.stdout).toContain('Filesystem Server');

      // Step 3: Install server
      const installResult = await mockInstallServer(ctx, 'filesystem');
      expect(installResult.exitCode).toBe(0);

      // Step 4: Verify in installed list
      const installedResult = await mockListInstalled(ctx);
      expect(installedResult.exitCode).toBe(0);
      expect(installedResult.stdout).toContain('Filesystem Server');

      // Step 5: Validate configuration
      const validateResult = await mockValidateConfig(ctx);
      expect(validateResult.exitCode).toBe(0);
      expect(validateResult.stdout).toContain('✅');

      // Step 6: Check status
      const statusResult = await mockStatus(ctx);
      expect(statusResult.exitCode).toBe(0);
      expect(statusResult.stdout).toContain('filesystem');
    });

    it('should support installing multiple servers', async () => {
      // Install filesystem server
      const fsInstall = await mockInstallServer(ctx, 'filesystem');
      expect(fsInstall.exitCode).toBe(0);

      // Install memory server
      const memInstall = await mockInstallServer(ctx, 'memory');
      expect(memInstall.exitCode).toBe(0);

      // Verify both are installed
      const installedResult = await mockListInstalled(ctx);
      expect(installedResult.exitCode).toBe(0);
      expect(installedResult.stdout).toContain('Filesystem Server');
      expect(installedResult.stdout).toContain('Memory Server');

      // Validate configuration with multiple servers
      const validateResult = await mockValidateConfig(ctx);
      expect(validateResult.exitCode).toBe(0);
      expect(validateResult.stdout).toContain('2 MCP servers');
    });
  });

  describe('6. Error Scenarios', () => {
    it('should handle corrupted configuration files', async () => {
      // Corrupt the config file
      await fs.writeFile(ctx.configPath, 'invalid: yaml: content: [');

      const result = await mockValidateConfig(ctx);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Configuration validation failed');
    });

    it('should handle missing configuration sections', async () => {
      // Create minimal config without project name
      await writeApexConfig(ctx.configPath, {} as ApexConfig);

      const result = await mockValidateConfig(ctx);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('project.name is required');
    });
  });

  describe('7. Configuration Management', () => {
    it('should maintain config file integrity after operations', async () => {
      // Perform multiple operations
      await mockInstallServer(ctx, 'filesystem');
      await mockInstallServer(ctx, 'memory');

      // Verify config is still valid YAML
      const config = await readApexConfig(ctx.configPath);
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');

      // Verify server entries
      expect(config.mcp?.servers?.filesystem).toBeDefined();
      expect(config.mcp?.servers?.memory).toBeDefined();

      // Verify other config sections are intact
      expect(config.project).toBeDefined();
      expect(config.project!.name).toBe('test-project');
    });

    it('should handle server removal from configuration', async () => {
      // Install server first
      await mockInstallServer(ctx, 'filesystem');

      // Verify installed
      const config = await readApexConfig(ctx.configPath);
      expect(config.mcp?.servers?.filesystem).toBeDefined();

      // Manually remove server (simulating uninstall)
      delete config.mcp!.servers!.filesystem;
      await writeApexConfig(ctx.configPath, config);

      // Verify server no longer appears in installed list
      const installedResult = await mockListInstalled(ctx);
      expect(installedResult.exitCode).toBe(0);
      expect(installedResult.stdout).not.toContain('Filesystem Server');
    });
  });

  describe('8. Edge Cases and Robustness', () => {
    it('should handle empty server configuration', async () => {
      const result = await mockListInstalled(ctx);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No MCP servers installed');
    });

    it('should handle empty server configuration in JSON', async () => {
      const result = await mockListInstalled(ctx, true);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('[]');
    });

    it('should handle status check with no servers', async () => {
      const result = await mockStatus(ctx);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('MCP Server Status');
      expect(result.stdout).toContain('No MCP servers configured');
    });

    it('should handle validation with no MCP configuration', async () => {
      // Remove MCP section from config
      const config = await readApexConfig(ctx.configPath);
      delete config.mcp;
      await writeApexConfig(ctx.configPath, config);

      const result = await mockValidateConfig(ctx);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('valid');
      expect(result.stdout).toContain('no MCP servers configured');
    });
  });
});