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
  MCPServer
} from '@apexcli/core';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

const { exec } = await import('child_process');
const execMock = vi.mocked(exec);

describe('MCPInstaller - Rollback Integration Tests', () => {
  let tempDir: string;
  let store: TaskStore;
  let installer: MCPInstaller;

  beforeEach(async () => {
    tempDir = path.join(__dirname, '..', '..', 'test-temp', `mcp-rollback-${Date.now()}`);
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

  describe('Complete installation rollback workflow', () => {
    it('should perform complete rollback when all steps fail in reverse order', async () => {
      const server: MCPServer = {
        name: 'rollback-test-server',
        package: 'rollback-test-package',
        command: 'npx',
        args: ['rollback-test-package'],
        env: {},
        envVars: [],
        version: '1.0.0'
      };

      let installCalls: string[] = [];
      let uninstallCalls: string[] = [];
      let createdConfigPath: string | null = null;
      let removedConfigPath: string | null = null;
      let databaseRecordCreated = false;
      let databaseRecordRemoved = false;

      // Track npm operations
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('npm install') && !command.includes('uninstall')) {
            installCalls.push(command);
            callback(null, { stdout: 'package installed', stderr: '' } as any);
          } else if (command.includes('npm uninstall')) {
            uninstallCalls.push(command);
            callback(null, { stdout: 'package uninstalled', stderr: '' } as any);
          }
        }
        return {} as any;
      });

      // Track file operations
      const originalWriteFile = fs.writeFile;
      const originalUnlink = fs.unlink;
      const originalMkdir = fs.mkdir;

      vi.mocked(fs).writeFile = vi.fn().mockImplementation(async (path, data, options) => {
        if (typeof path === 'string' && path.includes('mcp-installations')) {
          createdConfigPath = path;
        }
        return originalWriteFile(path, data, options);
      });

      vi.mocked(fs).unlink = vi.fn().mockImplementation(async (path) => {
        if (typeof path === 'string' && path.includes('mcp-installations')) {
          removedConfigPath = path;
        }
        return originalUnlink(path);
      });

      // Track database operations
      const originalCreateInstallation = store.createMcpInstallation.bind(store);
      const originalRemoveInstallation = store.removeMcpInstallation.bind(store);
      const originalUpdateStatus = store.updateMcpInstallationStatus.bind(store);

      vi.spyOn(store, 'createMcpInstallation').mockImplementation(async (installation) => {
        databaseRecordCreated = true;
        // Fail database record creation to trigger rollback
        throw new Error('Database constraint violation');
      });

      vi.spyOn(store, 'removeMcpInstallation').mockImplementation(async (id) => {
        databaseRecordRemoved = true;
        return originalRemoveInstallation(id);
      });

      vi.spyOn(store, 'updateMcpInstallationStatus').mockImplementation(async (id, status) => {
        return originalUpdateStatus(id, status);
      });

      try {
        await installer.install(server);
        expect.fail('Expected installation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPInstallationError);
      }

      // Verify rollback sequence
      expect(installCalls).toHaveLength(1);
      expect(uninstallCalls).toHaveLength(1);
      expect(createdConfigPath).toBeTruthy();
      expect(removedConfigPath).toBe(createdConfigPath);
      expect(databaseRecordCreated).toBe(true);

      // Verify no traces remain
      const installation = await installer.getInstallation('rollback-test-server');
      expect(installation).toBeNull();

      // Restore mocks
      vi.mocked(fs).writeFile = originalWriteFile;
      vi.mocked(fs).unlink = originalUnlink;
      store.createMcpInstallation = originalCreateInstallation;
      store.removeMcpInstallation = originalRemoveInstallation;
      store.updateMcpInstallationStatus = originalUpdateStatus;
    });

    it('should track rollback attempts and partial failures correctly', async () => {
      const server: MCPServer = {
        name: 'partial-rollback-server',
        package: 'partial-rollback-package',
        command: 'npx',
        args: ['partial-rollback-package'],
        env: {},
        envVars: [],
        version: '1.0.0'
      };

      let rollbackFailures: string[] = [];

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('npm install') && !command.includes('uninstall')) {
            callback(null, { stdout: 'installed', stderr: '' } as any);
          } else if (command.includes('npm uninstall')) {
            rollbackFailures.push('package');
            callback(new Error('Package is locked by another process'), null, null);
          }
        }
        return {} as any;
      });

      // Mock config file creation to succeed but deletion to fail
      const originalUnlink = fs.unlink;
      vi.mocked(fs).unlink = vi.fn().mockImplementation(async (path) => {
        if (typeof path === 'string' && path.includes('mcp-installations')) {
          rollbackFailures.push('config');
          throw new Error('File is locked and cannot be deleted');
        }
        return originalUnlink(path);
      });

      // Mock database operations to fail at record creation
      vi.spyOn(store, 'createMcpInstallation').mockImplementation(async () => {
        throw new Error('Database is read-only');
      });

      // Mock database rollback to also fail
      vi.spyOn(store, 'removeMcpInstallation').mockImplementation(async (id) => {
        rollbackFailures.push('database');
        throw new Error('Cannot delete from read-only database');
      });

      try {
        await installer.install(server);
        expect.fail('Expected installation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPInstallationError);
        const mcpError = error as MCPInstallationError;

        expect(mcpError.message).toContain('Partial cleanup failed - manual intervention may be required');
        expect(mcpError.installationContext.rollbackAttempts).toBeDefined();

        const rollbackAttempts = mcpError.installationContext.rollbackAttempts!;
        expect(rollbackAttempts).toHaveLength(3); // database, config, package
        expect(rollbackAttempts.every(attempt => !attempt.success)).toBe(true);

        const failedSteps = rollbackAttempts.map(attempt => attempt.step);
        expect(failedSteps).toContain('package');
        expect(failedSteps).toContain('config');
        expect(failedSteps).toContain('database');
      }

      expect(rollbackFailures).toHaveLength(3);

      // Restore mocks
      vi.mocked(fs).unlink = originalUnlink;
    });
  });

  describe('Concurrent installation handling', () => {
    it('should handle concurrent installation attempts with proper isolation', async () => {
      const server1: MCPServer = {
        name: 'concurrent-server-1',
        package: 'concurrent-package-1',
        command: 'npx',
        args: ['concurrent-package-1'],
        env: {},
        envVars: [],
        version: '1.0.0'
      };

      const server2: MCPServer = {
        name: 'concurrent-server-2',
        package: 'concurrent-package-2',
        command: 'npx',
        args: ['concurrent-package-2'],
        env: {},
        envVars: [],
        version: '1.0.0'
      };

      let installationAttempts = 0;

      execMock.mockImplementation((command, options, callback) => {
        installationAttempts++;
        setTimeout(() => {
          if (typeof callback === 'function') {
            if (installationAttempts === 1) {
              // First installation succeeds
              callback(null, { stdout: 'installed', stderr: '' } as any);
            } else {
              // Second installation fails
              callback(new Error('Concurrent installation conflict'), null, null);
            }
          }
        }, 50);
        return {} as any;
      });

      const [result1, result2] = await Promise.allSettled([
        installer.install(server1),
        installer.install(server2),
      ]);

      // One should succeed, one should fail
      const succeeded = result1.status === 'fulfilled' ? result1.value : result2.status === 'fulfilled' ? (result2 as any).value : null;
      const failed = result1.status === 'rejected' ? result1.reason : result2.status === 'rejected' ? (result2 as any).reason : null;

      expect(succeeded).toBeTruthy();
      expect(failed).toBeTruthy();
      expect(failed).toBeInstanceOf(MCPInstallationError);

      // Verify only one installation exists
      const installations = await installer.listInstalled();
      expect(installations).toHaveLength(1);
    });
  });

  describe('Filesystem edge cases in rollback', () => {
    it('should handle rollback when .apex directory becomes read-only', async () => {
      const server: MCPServer = {
        name: 'readonly-test-server',
        package: 'readonly-test-package',
        command: 'npx',
        args: ['readonly-test-package'],
        env: {},
        envVars: [],
        version: '1.0.0'
      };

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      // Create the config successfully first
      const apexDir = path.join(tempDir, '.apex', 'mcp-installations');
      await fs.mkdir(apexDir, { recursive: true });

      // Mock database creation to fail
      vi.spyOn(store, 'createMcpInstallation').mockImplementation(async () => {
        throw new Error('Database write failed');
      });

      // Mock config file deletion to fail due to read-only directory
      const originalUnlink = fs.unlink;
      vi.mocked(fs).unlink = vi.fn().mockImplementation(async (path) => {
        if (typeof path === 'string' && path.includes('mcp-installations')) {
          const error = new Error('EACCES: permission denied') as any;
          error.code = 'EACCES';
          throw error;
        }
        return originalUnlink(path);
      });

      try {
        await installer.install(server);
        expect.fail('Expected installation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPInstallationError);
        const mcpError = error as MCPInstallationError;

        expect(mcpError.installationContext.rollbackAttempts).toBeDefined();
        const configRollback = mcpError.installationContext.rollbackAttempts!.find(
          attempt => attempt.step === 'config'
        );
        expect(configRollback?.success).toBe(false);
        expect(configRollback?.error).toContain('EACCES');
      }

      // Restore mock
      vi.mocked(fs).unlink = originalUnlink;
    });

    it('should handle rollback when config file is locked by another process', async () => {
      const server: MCPServer = {
        name: 'locked-file-server',
        package: 'locked-file-package',
        command: 'npx',
        args: ['locked-file-package'],
        env: {},
        envVars: [],
        version: '1.0.0'
      };

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      // Mock database creation to fail
      vi.spyOn(store, 'createMcpInstallation').mockImplementation(async () => {
        throw new Error('Database constraint violation');
      });

      // Mock file deletion to fail with lock error
      const originalUnlink = fs.unlink;
      vi.mocked(fs).unlink = vi.fn().mockImplementation(async (path) => {
        if (typeof path === 'string' && path.includes('mcp-installations')) {
          const error = new Error('EBUSY: resource busy or locked') as any;
          error.code = 'EBUSY';
          throw error;
        }
        return originalUnlink(path);
      });

      try {
        await installer.install(server);
        expect.fail('Expected installation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPInstallationError);
        const mcpError = error as MCPInstallationError;

        const configRollback = mcpError.installationContext.rollbackAttempts!.find(
          attempt => attempt.step === 'config'
        );
        expect(configRollback?.success).toBe(false);
        expect(configRollback?.error).toContain('EBUSY');
      }

      // Restore mock
      vi.mocked(fs).unlink = originalUnlink;
    });
  });

  describe('Database rollback edge cases', () => {
    it('should handle database rollback when database is corrupted', async () => {
      const server: MCPServer = {
        name: 'corrupted-db-server',
        package: 'corrupted-db-package',
        command: 'npx',
        args: ['corrupted-db-package'],
        env: {},
        envVars: [],
        version: '1.0.0'
      };

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'installed', stderr: '' } as any);
        }
        return {} as any;
      });

      // Mock database operations to fail
      vi.spyOn(store, 'createMcpInstallation').mockImplementation(async () => {
        throw new Error('Database file is corrupted');
      });

      vi.spyOn(store, 'removeMcpInstallation').mockImplementation(async () => {
        throw new Error('Cannot connect to corrupted database');
      });

      try {
        await installer.install(server);
        expect.fail('Expected installation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPInstallationError);
        const mcpError = error as MCPInstallationError;

        const dbRollback = mcpError.installationContext.rollbackAttempts!.find(
          attempt => attempt.step === 'database'
        );
        expect(dbRollback?.success).toBe(false);
        expect(dbRollback?.error).toContain('corrupted database');
      }
    });
  });

  describe('Network-related rollback scenarios', () => {
    it('should handle npm install failure due to network timeout with proper rollback', async () => {
      const server: MCPServer = {
        name: 'network-timeout-server',
        package: 'network-timeout-package',
        command: 'npx',
        args: ['network-timeout-package'],
        env: {},
        envVars: [],
        version: '1.0.0'
      };

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('npm install') && !command.includes('uninstall')) {
            const timeoutError = new Error('npm ERR! network timeout');
            (timeoutError as any).code = 'ENOTFOUND';
            callback(timeoutError, null, null);
          }
        }
        return {} as any;
      });

      try {
        await installer.install(server);
        expect.fail('Expected installation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPInstallationError);
        const mcpError = error as MCPInstallationError;

        expect(mcpError.code).toBe(ApexErrorCode.MCP_PACKAGE_INSTALL_FAILED);
        expect(mcpError.installationContext.failedStep).toBe('npm_install');
        expect(mcpError.installationContext.recoverySteps).toContain('Check your network connection');
      }

      // Verify no partial state exists
      const installation = await installer.getInstallation('network-timeout-server');
      expect(installation).toBeNull();
    });

    it('should handle npm uninstall failure during rollback due to network issues', async () => {
      const server: MCPServer = {
        name: 'network-uninstall-fail-server',
        package: 'network-uninstall-fail-package',
        command: 'npx',
        args: ['network-uninstall-fail-package'],
        env: {},
        envVars: [],
        version: '1.0.0'
      };

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('npm install') && !command.includes('uninstall')) {
            callback(null, { stdout: 'installed', stderr: '' } as any);
          } else if (command.includes('npm uninstall')) {
            const networkError = new Error('npm ERR! network failure during uninstall');
            (networkError as any).code = 'ENETUNREACH';
            callback(networkError, null, null);
          }
        }
        return {} as any;
      });

      // Fail at config creation to trigger rollback
      vi.spyOn(store, 'createMcpInstallation').mockImplementation(async () => {
        throw new Error('Database save failed');
      });

      try {
        await installer.install(server);
        expect.fail('Expected installation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPInstallationError);
        const mcpError = error as MCPInstallationError;

        expect(mcpError.message).toContain('Partial cleanup failed');
        const packageRollback = mcpError.installationContext.rollbackAttempts!.find(
          attempt => attempt.step === 'package'
        );
        expect(packageRollback?.success).toBe(false);
        expect(packageRollback?.error).toContain('network failure');
      }
    });
  });

  describe('Complex rollback scenarios with marketplace', () => {
    it('should handle marketplace installation rollback with complex server configuration', async () => {
      const entry: MCPMarketplaceEntry = {
        name: 'complex-marketplace-server',
        description: 'Complex marketplace server with detailed config',
        version: '2.1.0',
        serverConfig: {
          name: 'complex-marketplace-server',
          type: 'stdio',
          command: 'npx',
          args: ['@complex/marketplace-server', '--config', 'production'],
          env: {
            NODE_ENV: 'production',
            LOG_LEVEL: 'info'
          },
          autoStart: true,
        },
      };

      await store.upsertMcpMarketplaceEntry(entry);

      let packageInstalled = false;
      let packageUninstalled = false;

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('npm install') && !command.includes('uninstall')) {
            packageInstalled = true;
            callback(null, { stdout: 'marketplace package installed', stderr: '' } as any);
          } else if (command.includes('npm uninstall')) {
            packageUninstalled = true;
            callback(null, { stdout: 'marketplace package uninstalled', stderr: '' } as any);
          }
        }
        return {} as any;
      });

      // Fail at database record creation
      vi.spyOn(store, 'createMcpInstallation').mockImplementation(async () => {
        throw new Error('Marketplace database constraint violation');
      });

      try {
        await installer.install('complex-marketplace-server');
        expect.fail('Expected marketplace installation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPInstallationError);
        const mcpError = error as MCPInstallationError;

        expect(mcpError.installationContext.serverId).toBe('complex-marketplace-server');
        expect(mcpError.installationContext.failedStep).toBe('database_record');
      }

      expect(packageInstalled).toBe(true);
      expect(packageUninstalled).toBe(true);

      // Verify no installation record exists
      const installation = await installer.getInstallation('complex-marketplace-server');
      expect(installation).toBeNull();
    });
  });

  describe('Rollback logging and debugging support', () => {
    it('should provide detailed logging information for debugging rollback issues', async () => {
      const server: MCPServer = {
        name: 'debug-rollback-server',
        package: 'debug-rollback-package',
        command: 'npx',
        args: ['debug-rollback-package'],
        env: {},
        envVars: [],
        version: '1.0.0'
      };

      const consoleLogs: string[] = [];
      const originalConsole = console.warn;
      console.warn = (...args: any[]) => {
        consoleLogs.push(args.join(' '));
      };

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('npm install') && !command.includes('uninstall')) {
            callback(null, { stdout: 'installed', stderr: '' } as any);
          } else if (command.includes('npm uninstall')) {
            callback(new Error('Uninstall failed for debugging'), null, null);
          }
        }
        return {} as any;
      });

      // Fail at database creation to trigger rollback
      vi.spyOn(store, 'createMcpInstallation').mockImplementation(async () => {
        throw new Error('Database debug error');
      });

      try {
        await installer.install(server);
        expect.fail('Expected installation to fail');
      } catch (error) {
        // Error is expected
      }

      // Verify debug logging occurred
      const rollbackLogs = consoleLogs.filter(log => log.includes('Rollback'));
      expect(rollbackLogs.length).toBeGreaterThan(0);

      // Restore console
      console.warn = originalConsole;
    });
  });
});