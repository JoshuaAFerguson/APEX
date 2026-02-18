import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { MCPInstaller } from '../mcp-installer';
import { TaskStore } from '../store';
import { MCPMarketplaceEntry, MCPServerConfig } from '@apexcli/core';

describe('MCPInstaller Database Operations and Persistence', () => {
  let tempDir: string;
  let store: TaskStore;
  let installer: MCPInstaller;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = path.join(__dirname, '..', '..', 'test-temp', `mcp-db-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Initialize store and installer
    store = new TaskStore(tempDir);
    await store.initialize();
    installer = new MCPInstaller(tempDir, store);
  });

  afterEach(async () => {
    // Close database connection
    store.close();

    // Clean up temporary directory
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('MCP Server Configuration Persistence', () => {
    it('should persist server configuration correctly', async () => {
      const config: MCPServerConfig = {
        name: 'test-persistence',
        type: 'stdio',
        command: 'test-command',
        args: ['--config', 'test.json'],
        env: {
          NODE_ENV: 'test',
          DEBUG: 'true'
        },
        autoStart: true,
      };

      // Store configuration
      await store.upsertMcpServerConfig('test-persistence', config);

      // Retrieve and verify
      const servers = await store.listMcpServerConfigs();
      const persistedServer = servers.find(s => s.name === 'test-persistence');

      expect(persistedServer).toBeDefined();
      expect(persistedServer!.config).toEqual(config);
      expect(persistedServer!.config.env).toEqual({
        NODE_ENV: 'test',
        DEBUG: 'true'
      });
    });

    it('should handle server configuration updates', async () => {
      const originalConfig: MCPServerConfig = {
        name: 'test-update',
        type: 'stdio',
        command: 'original-command',
        autoStart: false,
      };

      const updatedConfig: MCPServerConfig = {
        name: 'test-update',
        type: 'stdio',
        command: 'updated-command',
        args: ['--verbose'],
        autoStart: true,
      };

      // Store original configuration
      await store.upsertMcpServerConfig('test-update', originalConfig);

      // Update configuration
      await store.upsertMcpServerConfig('test-update', updatedConfig);

      // Verify update
      const servers = await store.listMcpServerConfigs();
      const updatedServer = servers.find(s => s.name === 'test-update');

      expect(updatedServer!.config.command).toBe('updated-command');
      expect(updatedServer!.config.args).toEqual(['--verbose']);
      expect(updatedServer!.config.autoStart).toBe(true);

      // Should only have one entry
      const testServers = servers.filter(s => s.name === 'test-update');
      expect(testServers).toHaveLength(1);
    });

    it('should handle complex server configurations', async () => {
      const complexConfig: MCPServerConfig = {
        name: 'complex-server',
        type: 'stdio',
        command: 'node',
        args: [
          'server.js',
          '--port', '3000',
          '--config', '/path/with spaces/config.json',
          '--feature-flags', 'a,b,c'
        ],
        env: {
          NODE_ENV: 'production',
          LOG_LEVEL: 'info',
          DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
          'SPECIAL-VAR': 'value with spaces and symbols !@#$%'
        },
        autoStart: true,
      };

      await store.upsertMcpServerConfig('complex-server', complexConfig);

      const servers = await store.listMcpServerConfigs();
      const complexServer = servers.find(s => s.name === 'complex-server');

      expect(complexServer!.config).toEqual(complexConfig);
      expect(complexServer!.config.args).toHaveLength(7);
      expect(complexServer!.config.env!['SPECIAL-VAR']).toBe('value with spaces and symbols !@#$%');
    });

    it('should handle server configurations with undefined/null fields', async () => {
      const minimalConfig: MCPServerConfig = {
        name: 'minimal-server',
        type: 'stdio',
        command: 'minimal',
        autoStart: false,
        // args and env are undefined
      };

      await store.upsertMcpServerConfig('minimal-server', minimalConfig);

      const servers = await store.listMcpServerConfigs();
      const minimalServer = servers.find(s => s.name === 'minimal-server');

      expect(minimalServer!.config.name).toBe('minimal-server');
      expect(minimalServer!.config.args).toBeUndefined();
      expect(minimalServer!.config.env).toBeUndefined();
    });
  });

  describe('Marketplace Entry Persistence', () => {
    it('should persist marketplace entries with all fields', async () => {
      const fullEntry: MCPMarketplaceEntry = {
        name: 'full-marketplace-entry',
        description: 'A comprehensive test entry with all fields',
        version: '2.1.0',
        author: 'Test Author <test@example.com>',
        homepage: 'https://example.com/homepage',
        repository: 'https://github.com/test/repo',
        installCommand: 'npm install -g @test/full-marketplace-entry',
        capabilities: ['filesystem', 'database', 'network'],
        verified: true,
        serverConfig: {
          name: 'full-marketplace-entry',
          type: 'stdio',
          command: 'full-entry',
          args: ['--production'],
          env: { MODE: 'production' },
          autoStart: false,
        },
      };

      await store.upsertMcpMarketplaceEntry(fullEntry);

      const entries = await store.listMcpMarketplaceEntries();
      const persistedEntry = entries.find(e => e.name === 'full-marketplace-entry');

      expect(persistedEntry).toBeDefined();
      expect(persistedEntry!.author).toBe('Test Author <test@example.com>');
      expect(persistedEntry!.homepage).toBe('https://example.com/homepage');
      expect(persistedEntry!.repository).toBe('https://github.com/test/repo');
      expect(persistedEntry!.capabilities).toEqual(['filesystem', 'database', 'network']);
      expect(persistedEntry!.verified).toBe(true);
      expect(persistedEntry!.serverConfig.env).toEqual({ MODE: 'production' });
    });

    it('should persist marketplace entries with minimal fields', async () => {
      const minimalEntry: MCPMarketplaceEntry = {
        name: 'minimal-entry',
        description: 'Minimal test entry',
        version: '1.0.0',
        serverConfig: {
          name: 'minimal-entry',
          type: 'stdio',
          command: 'minimal',
          autoStart: false,
        },
      };

      await store.upsertMcpMarketplaceEntry(minimalEntry);

      const entries = await store.listMcpMarketplaceEntries();
      const persistedEntry = entries.find(e => e.name === 'minimal-entry');

      expect(persistedEntry).toBeDefined();
      expect(persistedEntry!.author).toBeUndefined();
      expect(persistedEntry!.homepage).toBeUndefined();
      expect(persistedEntry!.repository).toBeUndefined();
      expect(persistedEntry!.installCommand).toBeUndefined();
      expect(persistedEntry!.capabilities).toBeUndefined();
      expect(persistedEntry!.verified).toBe(false); // Should default to false
    });

    it('should handle marketplace entry updates', async () => {
      const originalEntry: MCPMarketplaceEntry = {
        name: 'update-test',
        description: 'Original description',
        version: '1.0.0',
        verified: false,
        serverConfig: {
          name: 'update-test',
          type: 'stdio',
          command: 'original',
          autoStart: false,
        },
      };

      const updatedEntry: MCPMarketplaceEntry = {
        name: 'update-test',
        description: 'Updated description',
        version: '2.0.0',
        author: 'New Author',
        verified: true,
        serverConfig: {
          name: 'update-test',
          type: 'stdio',
          command: 'updated',
          autoStart: true,
        },
      };

      // Store original
      await store.upsertMcpMarketplaceEntry(originalEntry);

      // Update
      await store.upsertMcpMarketplaceEntry(updatedEntry);

      // Verify update
      const entries = await store.listMcpMarketplaceEntries();
      const persistedEntry = entries.find(e => e.name === 'update-test');

      expect(persistedEntry!.description).toBe('Updated description');
      expect(persistedEntry!.version).toBe('2.0.0');
      expect(persistedEntry!.author).toBe('New Author');
      expect(persistedEntry!.verified).toBe(true);
      expect(persistedEntry!.serverConfig.command).toBe('updated');

      // Should only have one entry
      const testEntries = entries.filter(e => e.name === 'update-test');
      expect(testEntries).toHaveLength(1);
    });

    it('should handle special characters in marketplace entries', async () => {
      const specialEntry: MCPMarketplaceEntry = {
        name: 'special-chars-测试',
        description: 'Entry with émojis 🚀 and spéciäl characters',
        version: '1.0.0-beta.1+build.123',
        author: 'Autör with Ümlauts <test@tëst.com>',
        homepage: 'https://example.com/pâth?query=valüe&foo=bär',
        repository: 'https://github.com/test/repö',
        serverConfig: {
          name: 'special-chars-测试',
          type: 'stdio',
          command: 'spëcial-çommand',
          args: ['--config', '/pàth/with/spëcial/chars.json'],
          env: {
            'SPËCIAL_VAR': 'valüe with émojis 🎉',
            '测试': '测试值'
          },
          autoStart: false,
        },
      };

      await store.upsertMcpMarketplaceEntry(specialEntry);

      const entries = await store.listMcpMarketplaceEntries();
      const persistedEntry = entries.find(e => e.name === 'special-chars-测试');

      expect(persistedEntry).toBeDefined();
      expect(persistedEntry!.description).toBe('Entry with émojis 🚀 and spéciäl characters');
      expect(persistedEntry!.author).toBe('Autör with Ümlauts <test@tëst.com>');
      expect(persistedEntry!.serverConfig.env!['SPËCIAL_VAR']).toBe('valüe with émojis 🎉');
      expect(persistedEntry!.serverConfig.env!['测试']).toBe('测试值');
    });
  });

  describe('Database Transaction and Consistency', () => {
    it('should maintain data consistency during concurrent operations', async () => {
      const serverConfigs: MCPServerConfig[] = Array.from({ length: 10 }, (_, i) => ({
        name: `concurrent-server-${i}`,
        type: 'stdio',
        command: `command-${i}`,
        autoStart: i % 2 === 0,
      }));

      const marketplaceEntries: MCPMarketplaceEntry[] = Array.from({ length: 10 }, (_, i) => ({
        name: `concurrent-marketplace-${i}`,
        description: `Concurrent test entry ${i}`,
        version: `1.${i}.0`,
        serverConfig: {
          name: `concurrent-marketplace-${i}`,
          type: 'stdio',
          command: `marketplace-command-${i}`,
          autoStart: false,
        },
      }));

      // Perform concurrent operations
      const serverPromises = serverConfigs.map(config =>
        store.upsertMcpServerConfig(config.name, config)
      );

      const marketplacePromises = marketplaceEntries.map(entry =>
        store.upsertMcpMarketplaceEntry(entry)
      );

      await Promise.all([...serverPromises, ...marketplacePromises]);

      // Verify all data was stored correctly
      const storedServers = await store.listMcpServerConfigs();
      const storedEntries = await store.listMcpMarketplaceEntries();

      expect(storedServers).toHaveLength(10);
      expect(storedEntries).toHaveLength(10);

      // Verify data integrity
      serverConfigs.forEach((originalConfig, i) => {
        const storedServer = storedServers.find(s => s.name === `concurrent-server-${i}`);
        expect(storedServer!.config).toEqual(originalConfig);
      });

      marketplaceEntries.forEach((originalEntry, i) => {
        const storedEntry = storedEntries.find(e => e.name === `concurrent-marketplace-${i}`);
        expect(storedEntry!.serverConfig).toEqual(originalEntry.serverConfig);
      });
    });

    it('should handle database operations across installer instances', async () => {
      // Create first installer instance
      const installer1 = new MCPInstaller(tempDir, store);

      const config1: MCPServerConfig = {
        name: 'multi-instance-test',
        type: 'stdio',
        command: 'test1',
        autoStart: false,
      };

      // Create an installation record (not just a server config)
      const configPath = path.join(tempDir, '.apex', 'mcp-installations', 'multi-inst.json');
      await store.createMcpInstallation({
        id: 'multi-inst',
        serverId: 'multi-instance-test',
        installedAt: new Date(),
        status: 'installed' as any,
        configPath,
        installedFrom: 'npm',
        configJson: JSON.stringify(config1),
      });

      // Create second installer instance with same store
      const installer2 = new MCPInstaller(tempDir, store);

      // Both should see the same data
      const isInstalled1 = await installer1.isInstalled('multi-instance-test');
      const isInstalled2 = await installer2.isInstalled('multi-instance-test');

      expect(isInstalled1).toBe(true);
      expect(isInstalled2).toBe(true);

      // Uninstall through second instance
      await installer2.uninstall('multi-instance-test');

      // Both should reflect the change
      const isInstalledAfter1 = await installer1.isInstalled('multi-instance-test');
      const isInstalledAfter2 = await installer2.isInstalled('multi-instance-test');

      expect(isInstalledAfter1).toBe(false);
      expect(isInstalledAfter2).toBe(false);
    });
  });

  describe('Database Schema and Data Types', () => {
    it('should handle large configuration data', async () => {
      const largeArgs = Array.from({ length: 100 }, (_, i) => `--option-${i}=value-${i}`);
      const largeEnv = Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [`VAR_${i}`, `value_${i}`])
      );

      const largeConfig: MCPServerConfig = {
        name: 'large-config-test',
        type: 'stdio',
        command: 'large-command',
        args: largeArgs,
        env: largeEnv,
        autoStart: false,
      };

      await store.upsertMcpServerConfig('large-config-test', largeConfig);

      const servers = await store.listMcpServerConfigs();
      const largeServer = servers.find(s => s.name === 'large-config-test');

      expect(largeServer!.config.args).toHaveLength(100);
      expect(Object.keys(largeServer!.config.env!)).toHaveLength(50);
      expect(largeServer!.config.args![99]).toBe('--option-99=value-99');
      expect(largeServer!.config.env!['VAR_49']).toBe('value_49');
    });

    it('should handle edge case data types', async () => {
      const edgeCaseConfig: MCPServerConfig = {
        name: 'edge-case-test',
        type: 'stdio',
        command: '',  // Empty command
        args: [],     // Empty array
        env: {},      // Empty object
        autoStart: false,
      };

      await store.upsertMcpServerConfig('edge-case-test', edgeCaseConfig);

      const servers = await store.listMcpServerConfigs();
      const edgeServer = servers.find(s => s.name === 'edge-case-test');

      expect(edgeServer!.config.command).toBe('');
      expect(edgeServer!.config.args).toEqual([]);
      expect(edgeServer!.config.env).toEqual({});
    });
  });

  describe('Database Error Handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      // This test verifies the store handles malformed data gracefully
      const db = store.getDatabase();

      // Insert malformed JSON directly into database
      const stmt = db.prepare(`
        INSERT INTO mcp_servers (name, config, installed_at, updated_at)
        VALUES (?, ?, ?, ?)
      `);

      const now = new Date().toISOString();
      stmt.run('invalid-json-test', 'invalid-json{', now, now);

      // Should handle the error when listing
      await expect(store.listMcpServerConfigs()).rejects.toThrow();
    });

    it('should handle database constraints', async () => {
      const config: MCPServerConfig = {
        name: 'constraint-test',
        type: 'stdio',
        command: 'test',
        autoStart: false,
      };

      // First insert should succeed
      await store.upsertMcpServerConfig('constraint-test', config);

      // Second insert with same name should update, not error
      const updatedConfig: MCPServerConfig = {
        name: 'constraint-test',
        type: 'stdio',
        command: 'updated-test',
        autoStart: true,
      };

      await store.upsertMcpServerConfig('constraint-test', updatedConfig);

      const servers = await store.listMcpServerConfigs();
      const constraintServers = servers.filter(s => s.name === 'constraint-test');

      expect(constraintServers).toHaveLength(1);
      expect(constraintServers[0].config.command).toBe('updated-test');
    });
  });

  describe('Database Performance', () => {
    it('should handle bulk operations efficiently', async () => {
      const startTime = Date.now();

      // Insert 100 server configurations
      const promises = Array.from({ length: 100 }, async (_, i) => {
        const config: MCPServerConfig = {
          name: `bulk-test-${i}`,
          type: 'stdio',
          command: `command-${i}`,
          args: [`--option-${i}`],
          env: { [`VAR_${i}`]: `value_${i}` },
          autoStart: i % 2 === 0,
        };
        return store.upsertMcpServerConfig(config.name, config);
      });

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);

      // Verify all data was stored
      const servers = await store.listMcpServerConfigs();
      const bulkServers = servers.filter(s => s.name.startsWith('bulk-test-'));

      expect(bulkServers).toHaveLength(100);
    });
  });
});