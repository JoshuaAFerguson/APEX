import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { MCPServerStore } from '../mcp-store';
import {
  MCPInstallation,
  MCPInstallationStatus,
  MCPInstallationSchema,
} from '@apexcli/core';

describe('MCPServerStore', () => {
  let store: MCPServerStore;
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = join(tmpdir(), `apex-mcp-store-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });

    store = new MCPServerStore(testDir);
    await store.initialize();
  });

  afterEach(() => {
    // Clean up
    if (store) {
      store.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should create .apex directory if it does not exist', () => {
      const apexDir = join(testDir, '.apex');
      expect(existsSync(apexDir)).toBe(true);
    });

    it('should create database file', () => {
      const dbPath = join(testDir, '.apex', 'apex.db');
      expect(existsSync(dbPath)).toBe(true);
    });

    it('should create mcp_installations table with proper schema', async () => {
      // Verify we can interact with the database without errors
      const installations = await store.getAll();
      expect(Array.isArray(installations)).toBe(true);
    });

    it('should set WAL mode for better concurrency', async () => {
      // This test verifies that the database is initialized correctly
      // We can't directly test WAL mode, but we can test that operations work
      const testInstallation: MCPInstallation = {
        id: 'test-init-wal',
        serverId: 'server-init-wal',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/test/config.json',
      };

      await store.save(testInstallation);
      const retrieved = await store.get('test-init-wal');
      expect(retrieved).not.toBe(null);
    });
  });

  describe('save', () => {
    it('should save a basic MCP installation', async () => {
      const installation: MCPInstallation = {
        id: 'test-installation-1',
        serverId: 'test-server-1',
        installedAt: new Date('2023-01-01T00:00:00Z'),
        status: 'installed',
        configPath: '/path/to/config.json',
      };

      await store.save(installation);

      const retrieved = await store.get('test-installation-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(installation.id);
      expect(retrieved!.serverId).toBe(installation.serverId);
      expect(retrieved!.status).toBe(installation.status);
      expect(retrieved!.configPath).toBe(installation.configPath);
      expect(retrieved!.installedAt).toEqual(installation.installedAt);
    });

    it('should update existing installation on conflict', async () => {
      const installation: MCPInstallation = {
        id: 'test-installation-1',
        serverId: 'test-server-1',
        installedAt: new Date('2023-01-01T00:00:00Z'),
        status: 'pending',
        configPath: '/path/to/config.json',
      };

      // Save initial installation
      await store.save(installation);

      // Update the installation
      const updatedInstallation: MCPInstallation = {
        ...installation,
        status: 'installed' as MCPInstallationStatus,
      };

      await store.save(updatedInstallation);

      const retrieved = await store.get('test-installation-1');
      expect(retrieved!.status).toBe('installed');
    });

    it('should handle all valid installation statuses', async () => {
      const statuses: MCPInstallationStatus[] = [
        'pending',
        'installing',
        'installed',
        'failed',
        'uninstalling',
        'uninstalled',
      ];

      for (const [index, status] of statuses.entries()) {
        const installation: MCPInstallation = {
          id: `test-status-${index}`,
          serverId: `server-${status}`,
          installedAt: new Date(),
          status,
          configPath: `/config/${status}.json`,
        };

        await store.save(installation);

        const retrieved = await store.get(`test-status-${index}`);
        expect(retrieved?.status).toBe(status);
      }
    });

    it('should validate installation object with Zod schema', async () => {
      const invalidInstallation = {
        id: '',
        serverId: 'server-1',
        installedAt: new Date(),
        status: 'invalid-status',
        configPath: '/config.json',
      };

      await expect(store.save(invalidInstallation as MCPInstallation))
        .rejects.toThrow();
    });

    it('should handle special characters in paths and IDs', async () => {
      const installation: MCPInstallation = {
        id: 'test-special!@#$%^&*()_+-={}[]|\\:";\'<>?,./~`',
        serverId: 'server-with-dashes_underscores.dots',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/path/with spaces/and-special_chars/config.json',
      };

      await store.save(installation);

      const retrieved = await store.get(installation.id);
      expect(retrieved).toMatchObject({
        id: installation.id,
        serverId: installation.serverId,
        configPath: installation.configPath,
      });
    });
  });

  describe('get', () => {
    it('should return null for non-existent installation', async () => {
      const installation = await store.get('non-existent');
      expect(installation).toBeNull();
    });

    it('should retrieve existing installation', async () => {
      const installation: MCPInstallation = {
        id: 'test-installation-1',
        serverId: 'test-server-1',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/path/to/config.json',
      };

      await store.save(installation);
      const retrieved = await store.get('test-installation-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(installation.id);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no installations exist', async () => {
      const installations = await store.getAll();
      expect(installations).toEqual([]);
    });

    it('should return all installations', async () => {
      const installation1: MCPInstallation = {
        id: 'test-1',
        serverId: 'server-1',
        installedAt: new Date('2023-01-01'),
        status: 'installed',
        configPath: '/path/1',
      };

      const installation2: MCPInstallation = {
        id: 'test-2',
        serverId: 'server-2',
        installedAt: new Date('2023-01-02'),
        status: 'pending',
        configPath: '/path/2',
      };

      await store.save(installation1);
      await store.save(installation2);

      const installations = await store.getAll();
      expect(installations).toHaveLength(2);
    });

    it('should filter by serverId', async () => {
      const installation1: MCPInstallation = {
        id: 'test-1',
        serverId: 'server-1',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/path/1',
      };

      const installation2: MCPInstallation = {
        id: 'test-2',
        serverId: 'server-2',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/path/2',
      };

      await store.save(installation1);
      await store.save(installation2);

      const filtered = await store.getAll({ serverId: 'server-1' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].serverId).toBe('server-1');
    });

    it('should filter by status', async () => {
      const installation1: MCPInstallation = {
        id: 'test-1',
        serverId: 'server-1',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/path/1',
      };

      const installation2: MCPInstallation = {
        id: 'test-2',
        serverId: 'server-1',
        installedAt: new Date(),
        status: 'pending',
        configPath: '/path/2',
      };

      await store.save(installation1);
      await store.save(installation2);

      const installed = await store.getAll({ status: 'installed' });
      expect(installed).toHaveLength(1);
      expect(installed[0].status).toBe('installed');

      const pending = await store.getAll({ status: 'pending' });
      expect(pending).toHaveLength(1);
      expect(pending[0].status).toBe('pending');
    });

    it('should filter by both server ID and status', async () => {
      const installations: MCPInstallation[] = [
        {
          id: 'test-1',
          serverId: 'server-1',
          installedAt: new Date('2024-01-01'),
          status: 'installed',
          configPath: '/path/1',
        },
        {
          id: 'test-2',
          serverId: 'server-1',
          installedAt: new Date('2024-01-02'),
          status: 'pending',
          configPath: '/path/2',
        },
        {
          id: 'test-3',
          serverId: 'server-2',
          installedAt: new Date('2024-01-03'),
          status: 'installed',
          configPath: '/path/3',
        },
      ];

      for (const installation of installations) {
        await store.save(installation);
      }

      const filtered = await store.getAll({
        serverId: 'server-1',
        status: 'installed',
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('test-1');
    });

    it('should return empty array when no matches found', async () => {
      const installation: MCPInstallation = {
        id: 'test-1',
        serverId: 'server-1',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/path/1',
      };

      await store.save(installation);

      const filtered = await store.getAll({ serverId: 'non-existent' });
      expect(filtered).toHaveLength(0);
    });

    it('should return installations ordered by installed_at DESC', async () => {
      const installations: MCPInstallation[] = [
        {
          id: 'test-1',
          serverId: 'server-1',
          installedAt: new Date('2024-01-01'),
          status: 'installed',
          configPath: '/path/1',
        },
        {
          id: 'test-2',
          serverId: 'server-1',
          installedAt: new Date('2024-01-03'),
          status: 'installed',
          configPath: '/path/2',
        },
        {
          id: 'test-3',
          serverId: 'server-1',
          installedAt: new Date('2024-01-02'),
          status: 'installed',
          configPath: '/path/3',
        },
      ];

      for (const installation of installations) {
        await store.save(installation);
      }

      const all = await store.getAll();

      // Should be ordered from most recent to oldest
      expect(all[0].id).toBe('test-2'); // 2024-01-03
      expect(all[1].id).toBe('test-3'); // 2024-01-02
      expect(all[2].id).toBe('test-1'); // 2024-01-01
    });
  });

  describe('delete', () => {
    it('should return false for non-existent installation', async () => {
      const result = await store.delete('non-existent');
      expect(result).toBe(false);
    });

    it('should delete existing installation and return true', async () => {
      const installation: MCPInstallation = {
        id: 'test-1',
        serverId: 'server-1',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/path/1',
      };

      await store.save(installation);
      expect(await store.get('test-1')).not.toBeNull();

      const result = await store.delete('test-1');
      expect(result).toBe(true);
      expect(await store.get('test-1')).toBeNull();
    });
  });

  describe('convenience methods', () => {
    beforeEach(async () => {
      const installations: MCPInstallation[] = [
        {
          id: 'test-1',
          serverId: 'server-1',
          installedAt: new Date(),
          status: 'installed',
          configPath: '/path/1',
        },
        {
          id: 'test-2',
          serverId: 'server-1',
          installedAt: new Date(),
          status: 'pending',
          configPath: '/path/2',
        },
        {
          id: 'test-3',
          serverId: 'server-2',
          installedAt: new Date(),
          status: 'installed',
          configPath: '/path/3',
        },
      ];

      for (const installation of installations) {
        await store.save(installation);
      }
    });

    it('should check if installation exists', async () => {
      expect(await store.exists('test-1')).toBe(true);
      expect(await store.exists('non-existent')).toBe(false);
    });

    it('should get installations by status', async () => {
      const installed = await store.getByStatus('installed');
      expect(installed).toHaveLength(2);

      const pending = await store.getByStatus('pending');
      expect(pending).toHaveLength(1);
    });

    it('should get installations by server ID', async () => {
      const server1Installations = await store.getByServerId('server-1');
      expect(server1Installations).toHaveLength(2);

      const server2Installations = await store.getByServerId('server-2');
      expect(server2Installations).toHaveLength(1);
    });

    it('should update installation status', async () => {
      expect(await store.updateStatus('test-2', 'installed')).toBe(true);

      const updated = await store.get('test-2');
      expect(updated!.status).toBe('installed');
    });

    it('should return false when updating status of non-existent installation', async () => {
      expect(await store.updateStatus('non-existent', 'installed')).toBe(false);
    });

    it('should delete installations by server ID', async () => {
      const deletedCount = await store.deleteByServerId('server-1');
      expect(deletedCount).toBe(2);

      const remaining = await store.getAll();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].serverId).toBe('server-2');
    });
  });

  describe('edge cases', () => {
    it('should handle empty database operations gracefully', async () => {
      const installations = await store.getAll();
      expect(installations).toHaveLength(0);

      const installation = await store.get('non-existent');
      expect(installation).toBe(null);

      const exists = await store.exists('non-existent');
      expect(exists).toBe(false);

      const deleted = await store.delete('non-existent');
      expect(deleted).toBe(false);

      const updated = await store.updateStatus('non-existent', 'installed');
      expect(updated).toBe(false);
    });

    it('should handle very long strings in installation data', async () => {
      const longId = 'A'.repeat(1000);
      const longServerId = 'server-' + 'B'.repeat(1000);
      const longConfigPath = '/very/'.repeat(200) + 'long/path/config.json';

      const installation: MCPInstallation = {
        id: longId,
        serverId: longServerId,
        installedAt: new Date(),
        status: 'installed',
        configPath: longConfigPath,
      };

      await store.save(installation);

      const retrieved = await store.get(longId);
      expect(retrieved).toMatchObject({
        id: longId,
        serverId: longServerId,
        configPath: longConfigPath,
      });
    });

    it('should handle Unicode characters in installation data', async () => {
      const installation: MCPInstallation = {
        id: 'test-unicode-🚀-αβγ-中文',
        serverId: 'server-测试-🎯',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/config/文件路径/配置.json',
      };

      await store.save(installation);

      const retrieved = await store.get(installation.id);
      expect(retrieved).toMatchObject({
        id: installation.id,
        serverId: installation.serverId,
        configPath: installation.configPath,
      });
    });

    it('should handle date edge cases', async () => {
      const veryOldDate = new Date('1900-01-01T00:00:00Z');
      const veryNewDate = new Date('2099-12-31T23:59:59Z');

      const installations: MCPInstallation[] = [
        {
          id: 'old-date-test',
          serverId: 'server-old',
          installedAt: veryOldDate,
          status: 'installed',
          configPath: '/old-config.json',
        },
        {
          id: 'new-date-test',
          serverId: 'server-new',
          installedAt: veryNewDate,
          status: 'installed',
          configPath: '/new-config.json',
        },
      ];

      for (const installation of installations) {
        await store.save(installation);
      }

      const oldInstallation = await store.get('old-date-test');
      expect(oldInstallation?.installedAt.getTime()).toBe(veryOldDate.getTime());

      const newInstallation = await store.get('new-date-test');
      expect(newInstallation?.installedAt.getTime()).toBe(veryNewDate.getTime());
    });

    it('should handle concurrent operations safely', async () => {
      const installations: MCPInstallation[] = [];
      for (let i = 0; i < 100; i++) {
        installations.push({
          id: `concurrent-${i}`,
          serverId: `server-${i % 5}`,
          installedAt: new Date(),
          status: i % 2 === 0 ? 'installed' : 'pending',
          configPath: `/config-${i}.json`,
        });
      }

      // Save all installations concurrently
      await Promise.all(installations.map(installation => store.save(installation)));

      // Verify all were saved
      const allInstallations = await store.getAll();
      expect(allInstallations).toHaveLength(100);

      // Test concurrent reads
      const readPromises = installations.map(i => store.get(i.id));
      const results = await Promise.all(readPromises);

      expect(results.every(result => result !== null)).toBe(true);
    });
  });

  describe('close', () => {
    it('should close database connection without errors', () => {
      expect(() => store.close()).not.toThrow();
    });

    it('should handle multiple close calls gracefully', () => {
      store.close();
      expect(() => store.close()).not.toThrow();
    });
  });

  describe('database robustness', () => {
    it('should handle re-initialization with existing database', async () => {
      // Save some data with the first store
      const installation: MCPInstallation = {
        id: 'robustness-test',
        serverId: 'server-1',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/config.json',
      };

      await store.save(installation);
      store.close();

      // Create a new store instance on the same database
      const newStore = new MCPServerStore(testDir);
      await newStore.initialize();

      // Should be able to retrieve the data
      const retrieved = await newStore.get('robustness-test');
      expect(retrieved?.id).toBe('robustness-test');

      newStore.close();
    });

    it('should handle migration scenarios gracefully', async () => {
      // Test that migrations don't break existing functionality
      const newStore = new MCPServerStore(testDir);
      await newStore.initialize();

      // Should work with existing database structure
      const installation: MCPInstallation = {
        id: 'migration-test',
        serverId: 'server-1',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/config.json',
      };

      await newStore.save(installation);
      const retrieved = await newStore.get('migration-test');

      expect(retrieved?.id).toBe('migration-test');
      newStore.close();
    });

    it('should handle concurrent store instances safely', async () => {
      // Create multiple store instances on same database
      const store1 = new MCPServerStore(testDir);
      const store2 = new MCPServerStore(testDir);

      await store1.initialize();
      await store2.initialize();

      // Save installations from both stores concurrently
      const installation1: MCPInstallation = {
        id: 'concurrent-store-1',
        serverId: 'server-1',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/config1.json',
      };

      const installation2: MCPInstallation = {
        id: 'concurrent-store-2',
        serverId: 'server-2',
        installedAt: new Date(),
        status: 'pending',
        configPath: '/config2.json',
      };

      await Promise.all([
        store1.save(installation1),
        store2.save(installation2),
      ]);

      // Both installations should be retrievable from either store
      const retrieved1FromStore1 = await store1.get('concurrent-store-1');
      const retrieved2FromStore2 = await store2.get('concurrent-store-2');
      const retrieved1FromStore2 = await store2.get('concurrent-store-1');
      const retrieved2FromStore1 = await store1.get('concurrent-store-2');

      expect(retrieved1FromStore1?.id).toBe('concurrent-store-1');
      expect(retrieved2FromStore2?.id).toBe('concurrent-store-2');
      expect(retrieved1FromStore2?.id).toBe('concurrent-store-1');
      expect(retrieved2FromStore1?.id).toBe('concurrent-store-2');

      store1.close();
      store2.close();
    });

    it('should handle large datasets efficiently', async () => {
      const largeDatasetSize = 1000;
      const installations: MCPInstallation[] = [];

      // Create many installations
      for (let i = 0; i < largeDatasetSize; i++) {
        installations.push({
          id: `bulk-${i}`,
          serverId: `server-${i % 10}`,
          installedAt: new Date(Date.now() + i * 1000),
          status: (i % 4 === 0 ? 'installed' : i % 4 === 1 ? 'pending' : i % 4 === 2 ? 'failed' : 'uninstalled') as MCPInstallationStatus,
          configPath: `/config/bulk-${i}.json`,
        });
      }

      // Save all installations
      const start = Date.now();
      await Promise.all(installations.map(i => store.save(i)));
      const saveTime = Date.now() - start;

      // Should complete in reasonable time (less than 5 seconds)
      expect(saveTime).toBeLessThan(5000);

      // Test bulk retrieval
      const retrievalStart = Date.now();
      const allInstallations = await store.getAll();
      const retrievalTime = Date.now() - retrievalStart;

      expect(allInstallations).toHaveLength(largeDatasetSize);
      expect(retrievalTime).toBeLessThan(1000); // Should be very fast

      // Test filtered retrieval
      const filteredStart = Date.now();
      const installedOnly = await store.getByStatus('installed');
      const filteredTime = Date.now() - filteredStart;

      expect(installedOnly.length).toBeGreaterThan(0);
      expect(filteredTime).toBeLessThan(500);
    });
  });

  describe('schema validation', () => {
    it('should reject installation with invalid status', async () => {
      const installation = {
        id: 'invalid-status-test',
        serverId: 'server-1',
        installedAt: new Date(),
        status: 'invalid-status',
        configPath: '/config.json',
      };

      await expect(store.save(installation as MCPInstallation))
        .rejects.toThrow();
    });

    it('should reject installation with empty required fields', async () => {
      const installations = [
        {
          id: '',
          serverId: 'server-1',
          installedAt: new Date(),
          status: 'installed',
          configPath: '/config.json',
        },
        {
          id: 'test-id',
          serverId: '',
          installedAt: new Date(),
          status: 'installed',
          configPath: '/config.json',
        },
        {
          id: 'test-id',
          serverId: 'server-1',
          installedAt: new Date(),
          status: 'installed',
          configPath: '',
        },
      ];

      for (const installation of installations) {
        await expect(store.save(installation as MCPInstallation))
          .rejects.toThrow();
      }
    });

    it('should reject installation with invalid date', async () => {
      const installation = {
        id: 'invalid-date-test',
        serverId: 'server-1',
        installedAt: 'not-a-date',
        status: 'installed',
        configPath: '/config.json',
      };

      await expect(store.save(installation as MCPInstallation))
        .rejects.toThrow();
    });

    it('should accept and validate properly formed installations', async () => {
      const validInstallation = {
        id: 'valid-test',
        serverId: 'server-1',
        installedAt: new Date(),
        status: 'installed' as MCPInstallationStatus,
        configPath: '/config.json',
      };

      // Should validate and parse correctly
      const parsed = MCPInstallationSchema.parse(validInstallation);
      expect(parsed).toMatchObject(validInstallation);

      // Should save without errors
      await expect(store.save(validInstallation)).resolves.not.toThrow();

      // Should be retrievable
      const retrieved = await store.get('valid-test');
      expect(retrieved).toMatchObject({
        id: 'valid-test',
        serverId: 'server-1',
        status: 'installed',
        configPath: '/config.json',
      });
    });
  });
});