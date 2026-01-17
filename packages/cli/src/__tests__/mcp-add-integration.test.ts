import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, saveConfig } from '@apexcli/core';
import type { ApexConfig } from '@apexcli/core';

/**
 * Integration tests for MCP add command functionality
 * These tests validate the end-to-end behavior of adding MCP servers
 * using real file operations and configuration handling
 */
describe('MCP Add Command Integration Tests', () => {
  let testProjectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Store original working directory
    originalCwd = process.cwd();

    // Create temporary test project directory
    testProjectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-mcp-integration-'));

    // Change to test directory
    process.chdir(testProjectDir);

    // Create basic project structure
    await fs.mkdir('.apex', { recursive: true });
    await fs.mkdir(path.join('.apex', 'agents'), { recursive: true });
    await fs.mkdir(path.join('.apex', 'workflows'), { recursive: true });
  });

  afterEach(async () => {
    // Restore original working directory
    process.chdir(originalCwd);

    // Clean up test directory
    try {
      await fs.rm(testProjectDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Configuration File Handling', () => {
    it('should create valid config structure when adding MCP server', async () => {
      // Initialize basic config
      const initialConfig: ApexConfig = {
        agents: {},
        workflows: {},
        autonomyLevel: 'manual',
        budgets: {
          maxCostPerTask: 10,
          maxTokensPerTask: 100000,
        },
      };

      // Save initial config
      await saveConfig(testProjectDir, initialConfig);

      // Load and verify initial config
      const loadedConfig = await loadConfig(testProjectDir);
      expect(loadedConfig).toEqual(initialConfig);

      // Create mock MCP server config
      const mcpServerConfig = {
        name: 'test-server',
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@test/server'],
        autoStart: true,
      };

      // Add MCP server configuration
      const updatedConfig: ApexConfig = {
        ...loadedConfig,
        mcp: {
          servers: {
            'test-server': mcpServerConfig,
          },
        },
      };

      // Save updated config
      await saveConfig(testProjectDir, updatedConfig);

      // Verify config was saved correctly
      const finalConfig = await loadConfig(testProjectDir);
      expect(finalConfig.mcp).toBeDefined();
      expect(finalConfig.mcp!.servers).toBeDefined();
      expect(finalConfig.mcp!.servers!['test-server']).toEqual(mcpServerConfig);
    });

    it('should preserve existing MCP servers when adding new one', async () => {
      // Initialize config with existing MCP server
      const initialConfig: ApexConfig = {
        mcp: {
          servers: {
            'existing-server': {
              name: 'existing-server',
              type: 'stdio',
              command: 'existing-command',
              args: ['--existing'],
            },
          },
        },
        agents: {},
        workflows: {},
        autonomyLevel: 'manual',
        budgets: {
          maxCostPerTask: 10,
          maxTokensPerTask: 100000,
        },
      };

      await saveConfig(testProjectDir, initialConfig);

      // Add new MCP server
      const newServerConfig = {
        name: 'new-server',
        type: 'stdio' as const,
        command: 'new-command',
        args: ['--new'],
      };

      const updatedConfig: ApexConfig = {
        ...initialConfig,
        mcp: {
          servers: {
            ...initialConfig.mcp!.servers!,
            'new-server': newServerConfig,
          },
        },
      };

      await saveConfig(testProjectDir, updatedConfig);

      // Verify both servers exist
      const finalConfig = await loadConfig(testProjectDir);
      expect(Object.keys(finalConfig.mcp!.servers!)).toHaveLength(2);
      expect(finalConfig.mcp!.servers!['existing-server']).toBeDefined();
      expect(finalConfig.mcp!.servers!['new-server']).toEqual(newServerConfig);
    });

    it('should handle server replacement when server with same name exists', async () => {
      // Initial config with a server
      const initialConfig: ApexConfig = {
        mcp: {
          servers: {
            'replaceable-server': {
              name: 'replaceable-server',
              type: 'stdio',
              command: 'old-command',
              args: ['--old-config'],
            },
          },
        },
        agents: {},
        workflows: {},
        autonomyLevel: 'manual',
        budgets: {
          maxCostPerTask: 10,
          maxTokensPerTask: 100000,
        },
      };

      await saveConfig(testProjectDir, initialConfig);

      // Replace with new server configuration
      const replacementConfig = {
        name: 'replaceable-server',
        type: 'stdio' as const,
        command: 'new-command',
        args: ['--new-config', '--improved'],
        autoStart: true,
      };

      const updatedConfig: ApexConfig = {
        ...initialConfig,
        mcp: {
          servers: {
            'replaceable-server': replacementConfig,
          },
        },
      };

      await saveConfig(testProjectDir, updatedConfig);

      // Verify replacement
      const finalConfig = await loadConfig(testProjectDir);
      expect(finalConfig.mcp!.servers!['replaceable-server']).toEqual(replacementConfig);
      expect(finalConfig.mcp!.servers!['replaceable-server'].command).toBe('new-command');
    });

    it('should handle YAML formatting round-trip', async () => {
      // Create config and verify it can be round-tripped through YAML
      const testConfig: ApexConfig = {
        mcp: {
          servers: {
            'yaml-test': {
              name: 'yaml-test',
              type: 'stdio',
              command: 'test-command',
              args: ['--config', 'config.yaml', '--verbose'],
              autoStart: true,
            },
          },
        },
        agents: {},
        workflows: {},
        autonomyLevel: 'manual',
        budgets: {
          maxCostPerTask: 50,
          maxTokensPerTask: 500000,
        },
      };

      // Save and reload to test YAML round-trip
      await saveConfig(testProjectDir, testConfig);
      const reloadedConfig = await loadConfig(testProjectDir);

      // Verify deep equality
      expect(reloadedConfig).toEqual(testConfig);

      // Verify specific complex values
      expect(reloadedConfig.mcp!.servers!['yaml-test'].args).toEqual(['--config', 'config.yaml', '--verbose']);
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted config file gracefully', async () => {
      // Write corrupted YAML
      await fs.writeFile(path.join('.apex', 'config.yaml'), 'invalid: yaml: [content}');

      // Loading should throw an error
      await expect(loadConfig(testProjectDir)).rejects.toThrow();
    });

    it('should handle missing config file', async () => {
      // Ensure no config file exists
      try {
        await fs.unlink(path.join('.apex', 'config.yaml'));
      } catch {
        // File might not exist, that's ok
      }

      // Loading should throw an error
      await expect(loadConfig(testProjectDir)).rejects.toThrow();
    });

    it('should handle very large config files', async () => {
      // Create config with many MCP servers
      const servers: Record<string, any> = {};
      for (let i = 0; i < 50; i++) {
        servers[`server-${i}`] = {
          name: `server-${i}`,
          type: 'stdio',
          command: `command-${i}`,
          args: [`--arg-${i}`, `--value-${i}`],
        };
      }

      const largeConfig: ApexConfig = {
        mcp: { servers },
        agents: {},
        workflows: {},
        autonomyLevel: 'manual',
        budgets: {
          maxCostPerTask: 10,
          maxTokensPerTask: 100000,
        },
      };

      // Should handle large config without issues
      await expect(saveConfig(testProjectDir, largeConfig)).resolves.not.toThrow();
      const reloadedConfig = await loadConfig(testProjectDir);
      expect(Object.keys(reloadedConfig.mcp!.servers!)).toHaveLength(50);
      expect(reloadedConfig.mcp!.servers!['server-49']).toBeDefined();
    });
  });
});