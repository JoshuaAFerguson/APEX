import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { MCPInstaller, MCPInstallationOptions, InstalledMCPResult } from './mcp-installer';
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

describe('MCPInstaller - Error Handling and Rollback', () => {
  let tempDir: string;
  let store: TaskStore;
  let installer: MCPInstaller;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = path.join(__dirname, '..', '..', 'test-temp', `mcp-installer-error-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Initialize store and installer
    store = new TaskStore(tempDir);
    await store.initialize();
    installer = new MCPInstaller(tempDir, store);

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('npm installation failure and rollback', () => {
    it('should rollback when npm install fails', async () => {
      const server: MCPServer = {
        name: 'test-server',
        package: 'test-package',
        command: 'npx',
        args: ['test-package'],
        env: {},
        envVars: [],
        version: '1.0.0'
      };

      // Mock npm install to fail
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('npm install')) {
            callback(new Error('Network timeout during npm install'), null, null);
          }
        }
        return {} as any;
      });

      await expect(installer.install(server)).rejects.toThrow(MCPInstallationError);

      // Verify no installation record was created
      const installation = await installer.getInstallation('test-server');
      expect(installation).toBeNull();

      // Verify no config file was created
      const apexDir = path.join(tempDir, '.apex', 'mcp-installations');
      try {
        const files = await fs.readdir(apexDir);
        expect(files).toHaveLength(0);
      } catch (error: any) {
        // Directory not existing is also acceptable
        expect(error.code).toBe('ENOENT');
      }
    });

    it('should provide descriptive error with recovery steps for npm failures', async () => {
      const server: MCPServer = {
        name: 'failing-server',
        package: 'failing-package',
        command: 'npx',
        args: ['failing-package'],
        env: {},
        envVars: [],
        version: '1.0.0'
      };

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('ENOTFOUND registry.npmjs.org'), null, null);
        }
        return {} as any;
      });

      try {
        await installer.install(server);
        expect.fail('Expected MCPInstallationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPInstallationError);
        const mcpError = error as MCPInstallationError;

        expect(mcpError.code).toBe(ApexErrorCode.MCP_PACKAGE_INSTALL_FAILED);
        expect(mcpError.message).toContain("Failed to install npm package for MCP server 'failing-server'");
        expect(mcpError.installationContext.serverId).toBe('failing-server');
        expect(mcpError.installationContext.failedStep).toBe('npm_install');
        expect(mcpError.installationContext.recoverySteps).toContain('Check your network connection');
        expect(mcpError.installationContext.recoverySteps).toContain('Try running: npm cache clean --force');
      }
    });
  });

  describe('config file creation failure and rollback', () => {
    it('should rollback npm package when config creation fails', async () => {
      const server: MCPServer = {
        name: 'config-fail-server',
        package: 'config-fail-package',
        command: 'npx',
        args: ['config-fail-package'],
        env: {},
        envVars: [],
        version: '1.0.0'
      };

      let npmInstallCalled = false;
      let npmUninstallCalled = false;

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('npm install') && !command.includes('uninstall')) {
            npmInstallCalled = true;
            callback(null, { stdout: 'installed', stderr: '' } as any);
          } else if (command.includes('npm uninstall')) {
            npmUninstallCalled = true;
            callback(null, { stdout: 'uninstalled', stderr: '' } as any);
          }
        }
        return {} as any;
      });

      // Mock fs.mkdir to fail during config creation
      const originalMkdir = fs.mkdir;
      vi.mocked(fs).mkdir = vi.fn().mockImplementation((path, options) => {
        if (typeof path === 'string' && path.includes('mcp-installations')) {
          throw new Error('EACCES: permission denied');
        }
        return originalMkdir(path, options);
      });

      try {
        await installer.install(server);
        expect.fail('Expected MCPInstallationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPInstallationError);
        const mcpError = error as MCPInstallationError;

        expect(mcpError.code).toBe(ApexErrorCode.MCP_CONFIG_CREATION_FAILED);
        expect(mcpError.installationContext.failedStep).toBe('config_creation');
        expect(mcpError.installationContext.recoverySteps).toContain('Check disk space availability');
        expect(mcpError.installationContext.recoverySteps).toContain('Verify write permissions in .apex directory');
      }

      // Verify npm install was called but then rolled back
      expect(npmInstallCalled).toBe(true);
      expect(npmUninstallCalled).toBe(true);

      // Verify no installation record exists
      const installation = await installer.getInstallation('config-fail-server');
      expect(installation).toBeNull();

      // Restore fs.mkdir
      vi.mocked(fs).mkdir = originalMkdir;
    });
  });

  describe('database record failure and rollback', () => {
    it('should rollback package and config when database save fails', async () => {
      const server: MCPServer = {
        name: 'db-fail-server',
        package: 'db-fail-package',
        command: 'npx',
        args: ['db-fail-package'],
        env: {},
        envVars: [],
        version: '1.0.0'
      };

      let configFileCreated = false;
      let configFileRemoved = false;

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'success', stderr: '' } as any);
        }
        return {} as any;
      });

      // Mock store.createMcpInstallation to fail
      const originalCreate = store.createMcpInstallation.bind(store);
      vi.spyOn(store, 'createMcpInstallation').mockImplementation(async () => {
        throw new Error('Database connection lost');
      });

      // Track file operations
      const originalWriteFile = fs.writeFile;
      const originalUnlink = fs.unlink;

      vi.mocked(fs).writeFile = vi.fn().mockImplementation(async (path, data, options) => {
        if (typeof path === 'string' && path.includes('mcp-installations')) {
          configFileCreated = true;
        }
        return originalWriteFile(path, data, options);
      });

      vi.mocked(fs).unlink = vi.fn().mockImplementation(async (path) => {
        if (typeof path === 'string' && path.includes('mcp-installations')) {
          configFileRemoved = true;
        }
        return originalUnlink(path);
      });

      try {
        await installer.install(server);
        expect.fail('Expected MCPInstallationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPInstallationError);
        const mcpError = error as MCPInstallationError;

        expect(mcpError.code).toBe(ApexErrorCode.MCP_DATABASE_RECORD_FAILED);
        expect(mcpError.installationContext.failedStep).toBe('database_record');
        expect(mcpError.installationContext.recoverySteps).toContain('Check SQLite database integrity');
      }

      // Verify config file was created and then removed during rollback
      expect(configFileCreated).toBe(true);
      expect(configFileRemoved).toBe(true);

      // Restore mocks
      store.createMcpInstallation = originalCreate;
      vi.mocked(fs).writeFile = originalWriteFile;
      vi.mocked(fs).unlink = originalUnlink;
    });
  });

  describe('partial rollback failure handling', () => {
    it('should continue rollback even if some steps fail and report them', async () => {
      const server: MCPServer = {
        name: 'partial-rollback-server',
        package: 'partial-rollback-package',
        command: 'npx',
        args: ['partial-rollback-package'],
        env: {},
        envVars: [],
        version: '1.0.0'
      };

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('npm install') && !command.includes('uninstall')) {
            callback(null, { stdout: 'installed', stderr: '' } as any);
          } else if (command.includes('npm uninstall')) {
            // Simulate npm uninstall failure during rollback
            callback(new Error('Package locked by another process'), null, null);
          }
        }
        return {} as any;
      });

      // Mock config creation to fail
      vi.mocked(fs).mkdir = vi.fn().mockImplementation(() => {
        throw new Error('Config creation failed');
      });

      try {
        await installer.install(server);
        expect.fail('Expected MCPInstallationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPInstallationError);
        const mcpError = error as MCPInstallationError;

        expect(mcpError.message).toContain('Partial cleanup failed - manual intervention may be required');
        expect(mcpError.installationContext.rollbackAttempts).toBeDefined();

        const rollbackAttempts = mcpError.installationContext.rollbackAttempts!;
        expect(rollbackAttempts.some(attempt =>
          attempt.step === 'package' && !attempt.success
        )).toBe(true);
      }
    });
  });

  describe('installation verification', () => {
    it('should correctly identify corrupted installations', async () => {
      // Create a valid installation first
      const server: MCPServer = {
        name: 'verify-server',
        package: 'verify-package',
        command: 'npx',
        args: ['verify-package'],
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

      const result = await installer.install(server);
      expect(result.name).toBe('verify-server');

      // Verify it's initially valid
      const initialVerification = await installer.verifyInstallation('verify-server', true);
      expect(initialVerification.isValid).toBe(true);
      expect(initialVerification.checks.databaseRecord).toBe(true);
      expect(initialVerification.checks.configFileExists).toBe(true);
      expect(initialVerification.checks.configFileValid).toBe(true);
      expect(initialVerification.checks.configContentValid).toBe(true);

      // Corrupt the config file
      const installation = await installer.getInstallation('verify-server');
      await fs.writeFile(installation!.configPath, 'invalid json', 'utf-8');

      // Verify corruption is detected
      const corruptedVerification = await installer.verifyInstallation('verify-server', true);
      expect(corruptedVerification.isValid).toBe(false);
      expect(corruptedVerification.checks.configFileValid).toBe(false);
      expect(corruptedVerification.corruptionType).toBe('invalid_config');
      expect(corruptedVerification.issues).toContain(expect.stringContaining('invalid JSON'));
    });

    it('should detect missing config files', async () => {
      // Create installation record without config file
      const installationId = `mcp-${Date.now()}-test`;
      const configPath = path.join(tempDir, '.apex', 'mcp-installations', `${installationId}.json`);

      await store.createMcpInstallation({
        id: installationId,
        serverId: 'missing-config-server',
        installedAt: new Date(),
        status: 'installed',
        configPath,
        installedFrom: 'npm',
        configJson: JSON.stringify({
          name: 'missing-config-server',
          type: 'stdio',
          command: 'test',
          autoStart: false,
        }),
      });

      // Don't create the actual config file

      const verification = await installer.verifyInstallation('missing-config-server', true);
      expect(verification.isValid).toBe(false);
      expect(verification.checks.databaseRecord).toBe(true);
      expect(verification.checks.configFileExists).toBe(false);
      expect(verification.corruptionType).toBe('missing_config');
      expect(verification.issues).toContain(expect.stringContaining('Config file missing'));
    });

    it('should detect missing database records', async () => {
      const verification = await installer.verifyInstallation('nonexistent-server', true);
      expect(verification.isValid).toBe(false);
      expect(verification.checks.databaseRecord).toBe(false);
      expect(verification.corruptionType).toBe('missing_db_record');
      expect(verification.issues).toContain("No installation record found for server 'nonexistent-server'");
    });

    it('should detect config files with missing required fields', async () => {
      // Create installation with invalid config
      const installationId = `mcp-${Date.now()}-invalid`;
      const configPath = path.join(tempDir, '.apex', 'mcp-installations', `${installationId}.json`);

      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify({
        // Missing required fields: name, command
        type: 'stdio',
        autoStart: false
      }), 'utf-8');

      await store.createMcpInstallation({
        id: installationId,
        serverId: 'invalid-config-server',
        installedAt: new Date(),
        status: 'installed',
        configPath,
        installedFrom: 'npm',
        configJson: '{}',
      });

      const verification = await installer.verifyInstallation('invalid-config-server', true);
      expect(verification.isValid).toBe(false);
      expect(verification.checks.configContentValid).toBe(false);
      expect(verification.corruptionType).toBe('invalid_config');
      expect(verification.issues).toContain('Config file missing required fields (name, command)');
    });

    it('should handle package verification for npm installations', async () => {
      // Create npm-based installation
      const server: MCPServer = {
        name: 'npm-verify-server',
        package: 'npm-verify-package',
        command: 'npx',
        args: ['npm-verify-package'],
        env: {},
        envVars: [],
        version: '1.0.0'
      };

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('npm install')) {
            callback(null, { stdout: 'installed', stderr: '' } as any);
          } else if (command.includes('npm list')) {
            // Simulate package verification failure
            callback(new Error('Package not found'), null, null);
          }
        }
        return {} as any;
      });

      const result = await installer.install(server);

      // Mock the installation record to indicate it was installed via npm
      const installation = await installer.getInstallation('npm-verify-server');
      await store.updateMcpInstallation(installation!.id, {
        installedFrom: 'npm'
      });

      const verification = await installer.verifyInstallation('npm-verify-server', true);
      expect(verification.isValid).toBe(false);
      expect(verification.checks.packageInstalled).toBe(false);
      expect(verification.corruptionType).toBe('corrupted_package');
      expect(verification.issues).toContain('npm package appears to be missing or corrupted');
    });

    it('should provide backwards compatibility for simple boolean verification', async () => {
      // Test the backwards compatible boolean return
      const boolResult = await installer.verifyInstallation('nonexistent-server');
      expect(typeof boolResult).toBe('boolean');
      expect(boolResult).toBe(false);
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle already installed servers gracefully', async () => {
      const server: MCPServer = {
        name: 'already-installed',
        package: 'already-installed-package',
        command: 'npx',
        args: ['already-installed-package'],
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

      // Install once
      await installer.install(server);

      // Try to install again
      try {
        await installer.install(server);
        expect.fail('Expected MCPInstallationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPInstallationError);
        const mcpError = error as MCPInstallationError;

        expect(mcpError.code).toBe(ApexErrorCode.MCP_ALREADY_INSTALLED);
        expect(mcpError.message).toContain("already installed");
        expect(mcpError.installationContext.recoverySteps).toContain('Use the --force option to reinstall');
      }
    });

    it('should handle force reinstallation with proper cleanup', async () => {
      const server: MCPServer = {
        name: 'force-reinstall',
        package: 'force-reinstall-package',
        command: 'npx',
        args: ['force-reinstall-package'],
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

      // Install once
      const firstInstall = await installer.install(server);
      const firstInstallationId = (await installer.getInstallation('force-reinstall'))!.id;

      // Force reinstall
      const secondInstall = await installer.install(server, { force: true });
      const secondInstallationId = (await installer.getInstallation('force-reinstall'))!.id;

      expect(firstInstall.name).toBe('force-reinstall');
      expect(secondInstall.name).toBe('force-reinstall');
      expect(firstInstallationId).not.toBe(secondInstallationId);
    });

    it('should handle unexpected errors during installation', async () => {
      const server: MCPServer = {
        name: 'unexpected-error-server',
        package: 'unexpected-error-package',
        command: 'npx',
        args: ['unexpected-error-package'],
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

      // Mock an unexpected error during config creation
      const originalMkdir = fs.mkdir;
      vi.mocked(fs).mkdir = vi.fn().mockImplementation(() => {
        throw new TypeError('Unexpected type error');
      });

      try {
        await installer.install(server);
        expect.fail('Expected MCPInstallationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPInstallationError);
        const mcpError = error as MCPInstallationError;

        expect(mcpError.code).toBe(ApexErrorCode.MCP_INSTALLATION_FAILED);
        expect(mcpError.cause).toBeInstanceOf(TypeError);
      }

      // Restore fs.mkdir
      vi.mocked(fs).mkdir = originalMkdir;
    });
  });

  describe('marketplace installation error handling', () => {
    it('should handle marketplace installation with npm failure and rollback', async () => {
      const entry: MCPMarketplaceEntry = {
        name: 'marketplace-fail',
        description: 'Marketplace server that fails',
        version: '1.0.0',
        serverConfig: {
          name: 'marketplace-fail',
          type: 'stdio',
          command: 'npx',
          args: ['@marketplace/failing-server'],
          autoStart: false,
        },
      };

      await store.upsertMcpMarketplaceEntry(entry);

      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Registry error during marketplace install'), null, null);
        }
        return {} as any;
      });

      try {
        await installer.install('marketplace-fail');
        expect.fail('Expected MCPInstallationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPInstallationError);
        const mcpError = error as MCPInstallationError;

        expect(mcpError.code).toBe(ApexErrorCode.MCP_PACKAGE_INSTALL_FAILED);
        expect(mcpError.installationContext.serverId).toBe('marketplace-fail');
      }

      // Verify no installation record was created
      const installation = await installer.getInstallation('marketplace-fail');
      expect(installation).toBeNull();
    });
  });

  describe('installFromNpm error handling', () => {
    it('should handle installFromNpm with proper error context', async () => {
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Package not found in registry'), null, null);
        }
        return {} as any;
      });

      try {
        await installer.installFromNpm('nonexistent-npm-package');
        expect.fail('Expected MCPInstallationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPInstallationError);
        const mcpError = error as MCPInstallationError;

        expect(mcpError.code).toBe(ApexErrorCode.MCP_PACKAGE_INSTALL_FAILED);
        expect(mcpError.installationContext.serverId).toBe('nonexistent-npm-package');
        expect(mcpError.installationContext.failedStep).toBe('npm_install');
      }
    });

    it('should handle complex package name extraction in error scenarios', async () => {
      execMock.mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Installation timeout'), null, null);
        }
        return {} as any;
      });

      try {
        await installer.installFromNpm('@modelcontextprotocol/server-complex-name');
        expect.fail('Expected MCPInstallationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPInstallationError);
        const mcpError = error as MCPInstallationError;

        expect(mcpError.installationContext.serverId).toBe('complex-name');
      }
    });
  });
});