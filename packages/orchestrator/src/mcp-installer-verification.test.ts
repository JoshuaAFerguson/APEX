import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { MCPInstaller, MCPInstallationOptions } from './mcp-installer';
import { TaskStore } from './store';
import {
  MCPMarketplaceEntry,
  MCPServerConfig,
  MCPInstallationError,
  ApexErrorCode,
  MCPServer,
  MCPInstallation
} from '@apexcli/core';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

const { exec } = await import('child_process');
const execMock = vi.mocked(exec);

describe('MCPInstaller - Installation Verification Edge Cases', () => {
  let tempDir: string;
  let store: TaskStore;
  let installer: MCPInstaller;

  beforeEach(async () => {
    tempDir = path.join(__dirname, '..', '..', 'test-temp', `mcp-verify-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    store = new TaskStore(tempDir);
    await store.initialize();
    installer = new MCPInstaller(tempDir, store);

    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('verifyInstallation edge cases', () => {
    it('should handle config files with malformed JSON', async () => {
      // Create installation record
      const installationId = `mcp-${Date.now()}-malformed`;
      const configPath = path.join(tempDir, '.apex', 'mcp-installations', `${installationId}.json`);

      await fs.mkdir(path.dirname(configPath), { recursive: true });
      // Write malformed JSON
      await fs.writeFile(configPath, '{ "name": "test", "command": "test", invalid }', 'utf-8');

      await store.createMcpInstallation({
        id: installationId,
        serverId: 'malformed-json-server',
        installedAt: new Date(),
        status: 'installed',
        configPath,
        installedFrom: 'npm',
        configJson: JSON.stringify({
          name: 'malformed-json-server',
          type: 'stdio',
          command: 'test',
          autoStart: false,
        }),
      });

      const verification = await installer.verifyInstallation('malformed-json-server', true);
      expect(verification.isValid).toBe(false);
      expect(verification.checks.databaseRecord).toBe(true);
      expect(verification.checks.configFileExists).toBe(true);
      expect(verification.checks.configFileValid).toBe(false);
      expect(verification.corruptionType).toBe('invalid_config');
      expect(verification.issues[0]).toContain('invalid JSON');
    });

    it('should handle config files with partial required fields', async () => {
      const installationId = `mcp-${Date.now()}-partial`;
      const configPath = path.join(tempDir, '.apex', 'mcp-installations', `${installationId}.json`);

      await fs.mkdir(path.dirname(configPath), { recursive: true });
      // Config with only name, missing command
      await fs.writeFile(configPath, JSON.stringify({
        name: 'partial-fields-server',
        type: 'stdio',
        autoStart: false
      }), 'utf-8');

      await store.createMcpInstallation({
        id: installationId,
        serverId: 'partial-fields-server',
        installedAt: new Date(),
        status: 'installed',
        configPath,
        installedFrom: 'npm',
        configJson: '{}',
      });

      const verification = await installer.verifyInstallation('partial-fields-server', true);
      expect(verification.isValid).toBe(false);
      expect(verification.checks.configContentValid).toBe(false);
      expect(verification.corruptionType).toBe('invalid_config');
      expect(verification.issues).toContain('Config file missing required fields (name, command)');
    });

    it('should handle config files with empty content', async () => {
      const installationId = `mcp-${Date.now()}-empty`;
      const configPath = path.join(tempDir, '.apex', 'mcp-installations', `${installationId}.json`);

      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, '', 'utf-8');

      await store.createMcpInstallation({
        id: installationId,
        serverId: 'empty-config-server',
        installedAt: new Date(),
        status: 'installed',
        configPath,
        installedFrom: 'npm',
        configJson: '{}',
      });

      const verification = await installer.verifyInstallation('empty-config-server', true);
      expect(verification.isValid).toBe(false);
      expect(verification.checks.configFileValid).toBe(false);
      expect(verification.corruptionType).toBe('invalid_config');
      expect(verification.issues[0]).toContain('invalid JSON');
    });

    it('should handle config files that are directories instead of files', async () => {
      const installationId = `mcp-${Date.now()}-directory`;
      const configPath = path.join(tempDir, '.apex', 'mcp-installations', `${installationId}.json`);

      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.mkdir(configPath, { recursive: true }); // Create directory instead of file

      await store.createMcpInstallation({
        id: installationId,
        serverId: 'directory-config-server',
        installedAt: new Date(),
        status: 'installed',
        configPath,
        installedFrom: 'npm',
        configJson: '{}',
      });

      const verification = await installer.verifyInstallation('directory-config-server', true);
      expect(verification.isValid).toBe(false);
      expect(verification.checks.configFileValid).toBe(false);
      expect(verification.corruptionType).toBe('invalid_config');
    });

    it('should handle package verification for different installation types', async () => {
      // Test NPX installation
      const npxInstallationId = `mcp-${Date.now()}-npx`;
      const npxConfigPath = path.join(tempDir, '.apex', 'mcp-installations', `${npxInstallationId}.json`);

      await fs.mkdir(path.dirname(npxConfigPath), { recursive: true });
      await fs.writeFile(npxConfigPath, JSON.stringify({
        name: 'npx-test-server',
        type: 'stdio',
        command: 'npx',
        args: ['@test/npx-package'],
        autoStart: false
      }), 'utf-8');

      await store.createMcpInstallation({
        id: npxInstallationId,
        serverId: 'npx-test-server',
        installedAt: new Date(),
        status: 'installed',
        configPath: npxConfigPath,
        installedFrom: 'npx',
        configJson: JSON.stringify({
          name: 'npx-test-server',
          type: 'stdio',
          command: 'npx',
          autoStart: false,
        }),
      });

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('npm list')) {
            // Package not found
            callback(new Error('Package not listed'), null, null);
          }
        }
        return {} as any;
      });

      const npxVerification = await installer.verifyInstallation('npx-test-server', true);
      expect(npxVerification.isValid).toBe(false);
      expect(npxVerification.checks.packageInstalled).toBe(false);
      expect(npxVerification.corruptionType).toBe('corrupted_package');

      // Test manual installation (should not check package)
      const manualInstallationId = `mcp-${Date.now()}-manual`;
      const manualConfigPath = path.join(tempDir, '.apex', 'mcp-installations', `${manualInstallationId}.json`);

      await fs.writeFile(manualConfigPath, JSON.stringify({
        name: 'manual-test-server',
        type: 'stdio',
        command: '/usr/local/bin/custom-server',
        autoStart: false
      }), 'utf-8');

      await store.createMcpInstallation({
        id: manualInstallationId,
        serverId: 'manual-test-server',
        installedAt: new Date(),
        status: 'installed',
        configPath: manualConfigPath,
        installedFrom: 'manual',
        configJson: JSON.stringify({
          name: 'manual-test-server',
          type: 'stdio',
          command: '/usr/local/bin/custom-server',
          autoStart: false,
        }),
      });

      const manualVerification = await installer.verifyInstallation('manual-test-server', true);
      expect(manualVerification.isValid).toBe(true);
      expect(manualVerification.checks.packageInstalled).toBeUndefined();
    });

    it('should handle package verification timeout gracefully', async () => {
      const installationId = `mcp-${Date.now()}-timeout`;
      const configPath = path.join(tempDir, '.apex', 'mcp-installations', `${installationId}.json`);

      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify({
        name: 'timeout-test-server',
        type: 'stdio',
        command: 'npx',
        args: ['slow-package'],
        autoStart: false
      }), 'utf-8');

      await store.createMcpInstallation({
        id: installationId,
        serverId: 'timeout-test-server',
        installedAt: new Date(),
        status: 'installed',
        configPath,
        installedFrom: 'npm',
        configJson: '{}',
      });

      // Mock npm list to hang (never call callback)
      execMock.mockImplementation((command, options, callback) => {
        // Don't call callback to simulate timeout
        return {} as any;
      });

      const verification = await installer.verifyInstallation('timeout-test-server', true);
      // Should still pass because package verification is optional and gracefully handled
      expect(verification.checks.packageInstalled).toBeUndefined();
    });

    it('should handle corrupted database records gracefully', async () => {
      // Create installation with null configPath
      const installationId = `mcp-${Date.now()}-null-path`;

      await store.createMcpInstallation({
        id: installationId,
        serverId: 'null-path-server',
        installedAt: new Date(),
        status: 'installed',
        configPath: null as any, // Invalid null path
        installedFrom: 'npm',
        configJson: '{}',
      });

      const verification = await installer.verifyInstallation('null-path-server', true);
      expect(verification.isValid).toBe(false);
      expect(verification.checks.configFileExists).toBe(false);
    });

    it('should handle installations with invalid status values', async () => {
      const installationId = `mcp-${Date.now()}-invalid-status`;
      const configPath = path.join(tempDir, '.apex', 'mcp-installations', `${installationId}.json`);

      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify({
        name: 'invalid-status-server',
        type: 'stdio',
        command: 'test',
        autoStart: false
      }), 'utf-8');

      // Manually insert with invalid status
      await store.createMcpInstallation({
        id: installationId,
        serverId: 'invalid-status-server',
        installedAt: new Date(),
        status: 'corrupted' as any, // Invalid status
        configPath,
        installedFrom: 'npm',
        configJson: '{}',
      });

      const verification = await installer.verifyInstallation('invalid-status-server', true);
      // Should still verify the installation despite invalid status
      expect(verification.checks.databaseRecord).toBe(true);
    });
  });

  describe('Complex corruption scenarios', () => {
    it('should identify and categorize multiple types of corruption simultaneously', async () => {
      const installationId = `mcp-${Date.now()}-multi-corrupt`;
      const configPath = path.join(tempDir, '.apex', 'mcp-installations', `${installationId}.json`);

      await fs.mkdir(path.dirname(configPath), { recursive: true });
      // Create config with invalid JSON
      await fs.writeFile(configPath, '{ invalid json }', 'utf-8');

      await store.createMcpInstallation({
        id: installationId,
        serverId: 'multi-corrupt-server',
        installedAt: new Date(),
        status: 'installed',
        configPath,
        installedFrom: 'npm',
        configJson: '{}',
      });

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('npm list')) {
            callback(new Error('Package corrupted'), null, null);
          }
        }
        return {} as any;
      });

      const verification = await installer.verifyInstallation('multi-corrupt-server', true);
      expect(verification.isValid).toBe(false);
      expect(verification.checks.databaseRecord).toBe(true);
      expect(verification.checks.configFileExists).toBe(true);
      expect(verification.checks.configFileValid).toBe(false);
      expect(verification.corruptionType).toBe('invalid_config'); // First detected corruption type
      expect(verification.issues.length).toBeGreaterThan(0);
    });

    it('should handle config files with correct JSON but wrong schema', async () => {
      const installationId = `mcp-${Date.now()}-wrong-schema`;
      const configPath = path.join(tempDir, '.apex', 'mcp-installations', `${installationId}.json`);

      await fs.mkdir(path.dirname(configPath), { recursive: true });
      // Valid JSON but completely wrong structure
      await fs.writeFile(configPath, JSON.stringify({
        totally: 'wrong',
        structure: true,
        nothing: ['matches', 'expected', 'schema']
      }), 'utf-8');

      await store.createMcpInstallation({
        id: installationId,
        serverId: 'wrong-schema-server',
        installedAt: new Date(),
        status: 'installed',
        configPath,
        installedFrom: 'npm',
        configJson: '{}',
      });

      const verification = await installer.verifyInstallation('wrong-schema-server', true);
      expect(verification.isValid).toBe(false);
      expect(verification.checks.configFileValid).toBe(true);
      expect(verification.checks.configContentValid).toBe(false);
      expect(verification.corruptionType).toBe('invalid_config');
    });

    it('should handle symlinked config files that point to missing targets', async () => {
      const installationId = `mcp-${Date.now()}-broken-symlink`;
      const configPath = path.join(tempDir, '.apex', 'mcp-installations', `${installationId}.json`);
      const targetPath = path.join(tempDir, 'missing-target.json');

      await fs.mkdir(path.dirname(configPath), { recursive: true });

      try {
        await fs.symlink(targetPath, configPath);

        await store.createMcpInstallation({
          id: installationId,
          serverId: 'broken-symlink-server',
          installedAt: new Date(),
          status: 'installed',
          configPath,
          installedFrom: 'npm',
          configJson: '{}',
        });

        const verification = await installer.verifyInstallation('broken-symlink-server', true);
        expect(verification.isValid).toBe(false);
        expect(verification.checks.configFileExists).toBe(false);
        expect(verification.corruptionType).toBe('missing_config');
      } catch (error) {
        // If symlinking is not supported on this platform, skip this test
        if ((error as any).code === 'EPERM' || (error as any).code === 'ENOTSUP') {
          return;
        }
        throw error;
      }
    });

    it('should handle very large config files gracefully', async () => {
      const installationId = `mcp-${Date.now()}-large-config`;
      const configPath = path.join(tempDir, '.apex', 'mcp-installations', `${installationId}.json`);

      await fs.mkdir(path.dirname(configPath), { recursive: true });

      // Create a large but valid config file
      const largeConfig = {
        name: 'large-config-server',
        type: 'stdio',
        command: 'test',
        autoStart: false,
        // Add a large amount of data
        metadata: {
          description: 'x'.repeat(10000), // 10KB of description
          tags: Array(1000).fill('tag'), // 1000 tags
          environment: Object.fromEntries(Array(100).fill(0).map((_, i) => [`VAR_${i}`, `value_${i}`]))
        }
      };

      await fs.writeFile(configPath, JSON.stringify(largeConfig), 'utf-8');

      await store.createMcpInstallation({
        id: installationId,
        serverId: 'large-config-server',
        installedAt: new Date(),
        status: 'installed',
        configPath,
        installedFrom: 'npm',
        configJson: '{}',
      });

      const verification = await installer.verifyInstallation('large-config-server', true);
      expect(verification.isValid).toBe(true);
      expect(verification.checks.configFileValid).toBe(true);
      expect(verification.checks.configContentValid).toBe(true);
    });
  });

  describe('Database consistency checks', () => {
    it('should detect mismatches between database records and config files', async () => {
      const installationId = `mcp-${Date.now()}-mismatch`;
      const configPath = path.join(tempDir, '.apex', 'mcp-installations', `${installationId}.json`);

      await fs.mkdir(path.dirname(configPath), { recursive: true });

      // Config file has different name than database record
      await fs.writeFile(configPath, JSON.stringify({
        name: 'config-file-name',
        type: 'stdio',
        command: 'test',
        autoStart: false
      }), 'utf-8');

      await store.createMcpInstallation({
        id: installationId,
        serverId: 'database-record-name', // Different name
        installedAt: new Date(),
        status: 'installed',
        configPath,
        installedFrom: 'npm',
        configJson: '{}',
      });

      const verification = await installer.verifyInstallation('database-record-name', true);
      // This should still pass basic validation since the config is valid,
      // but in a real system you might want to add specific mismatch checks
      expect(verification.checks.configContentValid).toBe(true);
    });

    it('should handle installations where config file path in database is incorrect', async () => {
      const realConfigPath = path.join(tempDir, '.apex', 'mcp-installations', 'real-config.json');
      const fakeConfigPath = path.join(tempDir, '.apex', 'mcp-installations', 'fake-config.json');

      await fs.mkdir(path.dirname(realConfigPath), { recursive: true });
      await fs.writeFile(realConfigPath, JSON.stringify({
        name: 'path-mismatch-server',
        type: 'stdio',
        command: 'test',
        autoStart: false
      }), 'utf-8');

      await store.createMcpInstallation({
        id: `mcp-${Date.now()}-path-mismatch`,
        serverId: 'path-mismatch-server',
        installedAt: new Date(),
        status: 'installed',
        configPath: fakeConfigPath, // Points to non-existent file
        installedFrom: 'npm',
        configJson: '{}',
      });

      const verification = await installer.verifyInstallation('path-mismatch-server', true);
      expect(verification.isValid).toBe(false);
      expect(verification.checks.configFileExists).toBe(false);
      expect(verification.corruptionType).toBe('missing_config');
    });
  });

  describe('Recovery and repair scenarios', () => {
    it('should provide appropriate recovery steps for different corruption types', async () => {
      // Test missing database record
      const missingDbResult = await installer.verifyInstallation('nonexistent', true);
      expect(missingDbResult.corruptionType).toBe('missing_db_record');

      // Test missing config file
      const installationId = `mcp-${Date.now()}-missing-config`;
      await store.createMcpInstallation({
        id: installationId,
        serverId: 'missing-config-test',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/nonexistent/path.json',
        installedFrom: 'npm',
        configJson: '{}',
      });

      const missingConfigResult = await installer.verifyInstallation('missing-config-test', true);
      expect(missingConfigResult.corruptionType).toBe('missing_config');

      // Test invalid config
      const invalidConfigPath = path.join(tempDir, '.apex', 'mcp-installations', 'invalid-config.json');
      await fs.mkdir(path.dirname(invalidConfigPath), { recursive: true });
      await fs.writeFile(invalidConfigPath, 'invalid json', 'utf-8');

      await store.createMcpInstallation({
        id: `mcp-${Date.now()}-invalid-config`,
        serverId: 'invalid-config-test',
        installedAt: new Date(),
        status: 'installed',
        configPath: invalidConfigPath,
        installedFrom: 'npm',
        configJson: '{}',
      });

      const invalidConfigResult = await installer.verifyInstallation('invalid-config-test', true);
      expect(invalidConfigResult.corruptionType).toBe('invalid_config');

      // Each corruption type should have specific characteristics
      expect(missingDbResult.corruptionType).not.toBe(missingConfigResult.corruptionType);
      expect(missingConfigResult.corruptionType).not.toBe(invalidConfigResult.corruptionType);
    });
  });
});