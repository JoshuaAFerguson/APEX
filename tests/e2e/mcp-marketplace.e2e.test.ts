/**
 * End-to-end tests for MCP Marketplace CLI happy path
 *
 * This test suite validates the complete MCP marketplace CLI workflow:
 * 1. Browse marketplace (list command)
 * 2. Search/select a server
 * 3. Install a server
 * 4. Configure server (validate configuration)
 * 5. Verify working (status/installed commands)
 *
 * Uses real CLI execution via child_process and actual filesystem operations
 * for true integration testing following patterns from cli.e2e.test.ts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';

const execAsync = promisify(exec);

// Path to the CLI binary
const CLI_PATH = path.join(__dirname, '../../packages/cli/dist/index.js');

// Types for better TypeScript support
interface ExecResult {
  stdout: string;
  stderr: string;
}

interface ApexConfig {
  version: string;
  project: {
    name: string;
    language: string;
  };
  mcp?: {
    servers?: Record<string, any>;
  };
  [key: string]: any;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Run CLI command with proper environment and error handling
 */
async function runCli(args: string, cwd: string): Promise<ExecResult> {
  try {
    const result = await execAsync(`node ${CLI_PATH} ${args}`, {
      cwd,
      env: { ...process.env, NO_COLOR: '1' },
      timeout: 30000,
    });
    return result;
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    // Return output even on error for inspection
    return {
      stdout: execError.stdout || '',
      stderr: execError.stderr || execError.message || '',
    };
  }
}

/**
 * Read and parse APEX config file
 */
async function readApexConfig(projectDir: string): Promise<ApexConfig> {
  const configPath = path.join(projectDir, '.apex', 'config.yaml');
  const configContent = await fs.readFile(configPath, 'utf-8');
  return yaml.parse(configContent) as ApexConfig;
}

/**
 * Assert that a server is properly configured in the config file
 */
function assertServerInConfig(
  config: ApexConfig,
  serverId: string,
  expectedFields?: Partial<any>
): void {
  expect(config.mcp).toBeDefined();
  expect(config.mcp!.servers).toBeDefined();
  expect(config.mcp!.servers![serverId]).toBeDefined();

  if (expectedFields) {
    const serverConfig = config.mcp!.servers![serverId];
    for (const [key, value] of Object.entries(expectedFields)) {
      expect(serverConfig).toHaveProperty(key, value);
    }
  }
}

/**
 * Parse JSON output safely
 */
function parseJsonOutput(output: string): any {
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`Invalid JSON output: ${output}`);
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('E2E: MCP Marketplace Happy Path', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create temp directory and initialize APEX project
    testDir = await globalThis.apexE2EHelpers.createTempDir('mcp-marketplace-');

    // Initialize APEX project non-interactively
    const { stdout, stderr } = await runCli('init --yes', testDir);

    // Verify initialization succeeded
    if (stderr && stderr.includes('error')) {
      throw new Error(`Failed to initialize APEX project: ${stderr}`);
    }

    // Verify .apex directory structure exists
    const apexDir = path.join(testDir, '.apex');
    const configFile = path.join(apexDir, 'config.yaml');

    expect(await fs.stat(apexDir).then(() => true).catch(() => false)).toBe(true);
    expect(await fs.stat(configFile).then(() => true).catch(() => false)).toBe(true);
  });

  afterEach(async () => {
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  describe('Browse Marketplace', () => {
    it('should list all available MCP servers with proper formatting', async () => {
      const { stdout, stderr } = await runCli('mcp list', testDir);

      expect(stderr).toBe('');
      expect(stdout).toContain('📦 MCP Marketplace');
      expect(stdout).toContain('Available Servers');

      // Should contain expected template servers
      expect(stdout).toContain('Filesystem Server');
      expect(stdout).toContain('Memory Server');
      expect(stdout).toContain('Fetch Server');

      // Should show categories
      expect(stdout).toContain('📁');

      // Should show verification badges for verified servers
      expect(stdout).toContain('✓');

      // Should show command guidance
      expect(stdout).toContain('Marketplace commands');
      expect(stdout).toContain('/mcp search');
      expect(stdout).toContain('/mcp install');
    });

    it('should list servers in JSON format', async () => {
      const { stdout, stderr } = await runCli('mcp list --json', testDir);

      expect(stderr).toBe('');

      const servers = parseJsonOutput(stdout);
      expect(Array.isArray(servers)).toBe(true);
      expect(servers.length).toBeGreaterThan(0);

      // Check structure of first server
      const firstServer = servers[0];
      expect(firstServer).toHaveProperty('id');
      expect(firstServer).toHaveProperty('name');
      expect(firstServer).toHaveProperty('description');
      expect(firstServer).toHaveProperty('config');
      expect(firstServer).toHaveProperty('capabilities');

      // Should include known template servers
      const serverIds = servers.map((s: any) => s.id);
      expect(serverIds).toContain('filesystem');
      expect(serverIds).toContain('memory');
    });

    it('should show server details with categories and tags', async () => {
      const { stdout } = await runCli('mcp list', testDir);

      // Should show tags section
      expect(stdout).toContain('Tags:');
      expect(stdout).toContain('#filesystem');
      expect(stdout).toContain('#files');

      // Should show server descriptions
      expect(stdout).toContain('secure filesystem access');
      expect(stdout).toContain('memory');
    });
  });

  describe('Search & Select Server', () => {
    it('should search by server name', async () => {
      const { stdout, stderr } = await runCli('mcp search filesystem', testDir);

      expect(stderr).toBe('');
      expect(stdout).toContain('🔍 Search Results');
      expect(stdout).toContain('Filesystem Server');
      expect(stdout).toContain('filesystem access');
    });

    it('should search by tag', async () => {
      const { stdout, stderr } = await runCli('mcp search files', testDir);

      expect(stderr).toBe('');
      expect(stdout).toContain('🔍 Search Results');
      expect(stdout).toContain('Filesystem Server');
    });

    it('should return JSON search results', async () => {
      const { stdout, stderr } = await runCli('mcp search filesystem --json', testDir);

      expect(stderr).toBe('');

      const results = parseJsonOutput(stdout);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      const filesystemServer = results.find((s: any) => s.id === 'filesystem');
      expect(filesystemServer).toBeDefined();
      expect(filesystemServer.name).toBe('Filesystem Server');
    });

    it('should handle no-match searches gracefully', async () => {
      const { stdout, stderr } = await runCli('mcp search nonexistentserver', testDir);

      expect(stderr).toBe('');
      expect(stdout).toContain('No servers found matching');
      expect(stdout).toContain('nonexistentserver');
    });

    it('should return empty JSON array for no-match searches', async () => {
      const { stdout, stderr } = await runCli('mcp search nonexistentserver --json', testDir);

      expect(stderr).toBe('');

      const results = parseJsonOutput(stdout);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('Install Server', () => {
    it('should install server from marketplace template', async () => {
      const { stdout, stderr } = await runCli('mcp install filesystem', testDir);

      expect(stderr).toBe('');
      expect(stdout).toContain('✅');
      expect(stdout).toContain('filesystem');
      expect(stdout).toContain('installed');

      // Verify server was added to config
      const config = await readApexConfig(testDir);
      assertServerInConfig(config, 'filesystem', {
        name: 'filesystem',
        type: 'stdio',
        command: 'npx'
      });

      // Verify the config has the proper structure
      expect(config.mcp!.servers!.filesystem.args).toContain('@modelcontextprotocol/server-filesystem');
    });

    it('should create proper config entry with environment variables', async () => {
      await runCli('mcp install filesystem', testDir);

      const config = await readApexConfig(testDir);
      const filesystemServer = config.mcp!.servers!.filesystem;

      // Should have autoStart setting from template
      expect(filesystemServer.autoStart).toBe(true);

      // Should have environment variables initialized
      expect(filesystemServer).toHaveProperty('env');
      expect(filesystemServer.env).toHaveProperty('ALLOWED_PATHS');
    });

    it('should detect duplicate installation', async () => {
      // Install first time
      await runCli('mcp install filesystem', testDir);

      // Install again
      const { stdout, stderr } = await runCli('mcp install filesystem', testDir);

      expect(stderr).toBe('');
      expect(stdout).toContain('already installed');
      expect(stdout).toContain('filesystem');
    });

    it('should handle non-existent template gracefully', async () => {
      const { stdout, stderr } = await runCli('mcp install nonexistentserver', testDir);

      expect(stderr).toBe('');
      expect(stdout).toContain('not found');
      expect(stdout).toContain('nonexistentserver');
    });

    it('should install multiple different servers', async () => {
      // Install filesystem server
      await runCli('mcp install filesystem', testDir);

      // Install memory server
      await runCli('mcp install memory', testDir);

      const config = await readApexConfig(testDir);

      // Both should be in config
      assertServerInConfig(config, 'filesystem');
      assertServerInConfig(config, 'memory');

      // Memory server should have different autoStart setting
      expect(config.mcp!.servers!.memory.autoStart).toBe(false);
    });
  });

  describe('Verify Configuration', () => {
    beforeEach(async () => {
      // Install a server for testing
      await runCli('mcp install filesystem', testDir);
    });

    it('should validate installed server config', async () => {
      const { stdout, stderr } = await runCli('mcp validate', testDir);

      expect(stderr).toBe('');
      expect(stdout).toContain('✅');
      expect(stdout).toContain('valid');
      expect(stdout).toContain('filesystem');
    });

    it('should show server in installed list', async () => {
      const { stdout, stderr } = await runCli('mcp installed', testDir);

      expect(stderr).toBe('');
      expect(stdout).toContain('Installed MCP Servers');
      expect(stdout).toContain('filesystem');
      expect(stdout).toContain('Filesystem Server');
      expect(stdout).toContain('auto-start: true');
    });

    it('should show server in status output', async () => {
      const { stdout, stderr } = await runCli('mcp status', testDir);

      expect(stderr).toBe('');
      expect(stdout).toContain('MCP Server Status');
      expect(stdout).toContain('filesystem');

      // Should show status (may be stopped, not connected, etc. - that's expected for E2E)
      expect(stdout).toMatch(/stopped|not connected|configured/i);
    });

    it('should show proper JSON output for installed servers', async () => {
      const { stdout, stderr } = await runCli('mcp installed --json', testDir);

      expect(stderr).toBe('');

      const servers = parseJsonOutput(stdout);
      expect(Array.isArray(servers)).toBe(true);
      expect(servers.length).toBe(1);

      const filesystemServer = servers[0];
      expect(filesystemServer.name).toBe('filesystem');
      expect(filesystemServer.autoStart).toBe(true);
    });
  });

  describe('Complete Happy Path Flow', () => {
    it('should complete: list → search → install → installed → validate → status', async () => {
      // Step 1: List marketplace
      const { stdout: listOutput } = await runCli('mcp list --json', testDir);
      const availableServers = parseJsonOutput(listOutput);
      expect(availableServers.length).toBeGreaterThan(0);

      // Step 2: Search for filesystem server
      const { stdout: searchOutput } = await runCli('mcp search filesystem --json', testDir);
      const searchResults = parseJsonOutput(searchOutput);
      expect(searchResults.length).toBeGreaterThan(0);

      const filesystemServer = searchResults.find((s: any) => s.id === 'filesystem');
      expect(filesystemServer).toBeDefined();

      // Step 3: Install filesystem server
      const { stdout: installOutput } = await runCli('mcp install filesystem', testDir);
      expect(installOutput).toContain('✅');
      expect(installOutput).toContain('installed');

      // Step 4: Check installed servers
      const { stdout: installedOutput } = await runCli('mcp installed --json', testDir);
      const installedServers = parseJsonOutput(installedOutput);
      expect(installedServers.length).toBe(1);
      expect(installedServers[0].name).toBe('filesystem');

      // Step 5: Validate configuration
      const { stdout: validateOutput } = await runCli('mcp validate', testDir);
      expect(validateOutput).toContain('✅');
      expect(validateOutput).toContain('valid');

      // Step 6: Check server status
      const { stdout: statusOutput } = await runCli('mcp status', testDir);
      expect(statusOutput).toContain('filesystem');
      expect(statusOutput).toMatch(/MCP Server Status/i);

      // Verify config file contains the server
      const config = await readApexConfig(testDir);
      assertServerInConfig(config, 'filesystem', {
        name: 'filesystem',
        type: 'stdio',
        autoStart: true
      });
    });

    it('should support installing multiple servers in sequence', async () => {
      // Install filesystem server
      await runCli('mcp install filesystem', testDir);

      // Install memory server
      await runCli('mcp install memory', testDir);

      // Install fetch server
      await runCli('mcp install fetch', testDir);

      // Verify all are installed
      const { stdout: installedOutput } = await runCli('mcp installed --json', testDir);
      const installedServers = parseJsonOutput(installedOutput);
      expect(installedServers.length).toBe(3);

      const serverNames = installedServers.map((s: any) => s.name);
      expect(serverNames).toContain('filesystem');
      expect(serverNames).toContain('memory');
      expect(serverNames).toContain('fetch');

      // Verify validation still passes
      const { stdout: validateOutput } = await runCli('mcp validate', testDir);
      expect(validateOutput).toContain('✅');
      expect(validateOutput).toContain('valid');

      // Verify config has all servers
      const config = await readApexConfig(testDir);
      assertServerInConfig(config, 'filesystem');
      assertServerInConfig(config, 'memory');
      assertServerInConfig(config, 'fetch');
    });

    it('should handle the full flow with error recovery', async () => {
      // Try to install non-existent server (should fail gracefully)
      const { stdout: errorOutput } = await runCli('mcp install badserver', testDir);
      expect(errorOutput).toContain('not found');

      // Should still be able to install valid server after error
      const { stdout: installOutput } = await runCli('mcp install filesystem', testDir);
      expect(installOutput).toContain('✅');
      expect(installOutput).toContain('installed');

      // Try to install the same server again (should warn)
      const { stdout: duplicateOutput } = await runCli('mcp install filesystem', testDir);
      expect(duplicateOutput).toContain('already installed');

      // Validation should still pass
      const { stdout: validateOutput } = await runCli('mcp validate', testDir);
      expect(validateOutput).toContain('✅');

      // Should show exactly one server installed
      const { stdout: installedOutput } = await runCli('mcp installed --json', testDir);
      const installedServers = parseJsonOutput(installedOutput);
      expect(installedServers.length).toBe(1);
      expect(installedServers[0].name).toBe('filesystem');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle MCP commands before project initialization', async () => {
      // Create a new temp directory without initializing APEX
      const uninitializedDir = await globalThis.apexE2EHelpers.createTempDir('uninitialized-');

      try {
        const { stdout, stderr } = await runCli('mcp list', uninitializedDir);
        const output = stdout + stderr;

        expect(output.toLowerCase()).toContain('not initialized');
      } finally {
        await fs.rm(uninitializedDir, { recursive: true, force: true });
      }
    });

    it('should handle invalid command arguments gracefully', async () => {
      const { stdout, stderr } = await runCli('mcp invalidcommand', testDir);
      const output = stdout + stderr;

      expect(output).toContain('Unknown');
      // Should show help or usage information
      expect(output).toMatch(/help|usage|command/i);
    });

    it('should preserve existing config when installing servers', async () => {
      // Modify config to add custom settings
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      let config = await readApexConfig(testDir);

      // Add custom setting
      config.customSetting = 'test-value';

      await fs.writeFile(configPath, yaml.stringify(config));

      // Install server
      await runCli('mcp install filesystem', testDir);

      // Verify custom setting is preserved
      const updatedConfig = await readApexConfig(testDir);
      expect(updatedConfig.customSetting).toBe('test-value');

      // And server is properly added
      assertServerInConfig(updatedConfig, 'filesystem');
    });
  });
});