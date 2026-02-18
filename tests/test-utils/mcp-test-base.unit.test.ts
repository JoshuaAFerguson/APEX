/**
 * @fileoverview Unit tests for MCP Test Base Utilities
 *
 * Tests the core functionality of the MCP test utilities that work across
 * both unit and E2E test contexts. Focuses on testing the utility functions,
 * mocks, and environment detection logic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mcpTestBase,
  isUnitTestMode,
  getTestTimeout,
  isCI,
  createTestMarketplaceEntry,
  createTestServerConfig,
  createTestApexConfig,
  assertCommandSuccess,
  assertCommandFailure,
  assertOutputContains,
  type MCPTestContext,
  type MCPCommandResult,
} from './mcp-test-base.js';

describe('MCP Test Base Utilities', () => {
  let testContext: MCPTestContext;

  beforeEach(async () => {
    // Force unit test mode for these tests
    process.env.APEX_TEST_MODE = 'unit';
    testContext = await mcpTestBase.createTestContext({
      mode: 'unit',
      mockOptions: {
        enableFilesystem: true,
        enableCLI: true,
        enableConfig: true,
      },
    });
  });

  afterEach(async () => {
    if (testContext) {
      await mcpTestBase.cleanupTestContext(testContext);
    }
    delete process.env.APEX_TEST_MODE;
  });

  describe('Environment Detection', () => {
    it('should detect unit test mode correctly', () => {
      process.env.APEX_TEST_MODE = 'unit';
      expect(isUnitTestMode()).toBe(true);

      process.env.APEX_TEST_MODE = 'e2e';
      expect(isUnitTestMode()).toBe(false);

      delete process.env.APEX_TEST_MODE;
      // Should default to unit test mode for safety
      expect(isUnitTestMode()).toBe(true);
    });

    it('should return appropriate timeouts for different environments', () => {
      process.env.APEX_TEST_MODE = 'unit';
      expect(getTestTimeout()).toBe(5000);

      process.env.APEX_TEST_MODE = 'e2e';
      expect(getTestTimeout()).toBe(30000);
    });

    it('should detect CI environment', () => {
      const originalCI = process.env.CI;

      process.env.CI = 'true';
      expect(isCI()).toBe(true);

      process.env.CI = '1';
      expect(isCI()).toBe(true);

      delete process.env.CI;
      expect(isCI()).toBe(false);

      process.env.CI = originalCI;
    });
  });

  describe('Test Context Management', () => {
    it('should create unit test context with mocks', () => {
      expect(testContext.mode).toBe('unit');
      expect(testContext.projectDir).toBe('/tmp/mock-apex-project');
      expect(testContext.needsCleanup).toBe(false);
      expect(testContext.mocks).toBeDefined();
      expect(testContext.mocks!.size).toBeGreaterThan(0);
    });

    it('should provide filesystem mocks in unit test mode', () => {
      const mockFs = testContext.mocks!.get('filesystem');
      expect(mockFs).toBeDefined();
      expect(mockFs.files).toBeDefined();
      expect(typeof mockFs.readFile).toBe('function');
      expect(typeof mockFs.writeFile).toBe('function');
      expect(typeof mockFs.exists).toBe('function');
    });

    it('should provide CLI mocks in unit test mode', () => {
      const mockCLI = testContext.mocks!.get('cli');
      expect(mockCLI).toBeDefined();
      expect(mockCLI.execHistory).toBeDefined();
      expect(typeof mockCLI.exec).toBe('function');
      expect(typeof mockCLI.getLastExecution).toBe('function');
    });

    it('should provide config mocks in unit test mode', () => {
      const mockConfig = testContext.mocks!.get('config');
      expect(mockConfig).toBeDefined();
      expect(mockConfig.config).toBeDefined();
      expect(typeof mockConfig.read).toBe('function');
      expect(typeof mockConfig.write).toBe('function');
    });
  });

  describe('Command Execution', () => {
    it('should execute MCP list command via mocks', async () => {
      const result = await mcpTestBase.execMCPCommand('list', testContext);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('MCP Marketplace');
      expect(result.duration).toBeGreaterThan(0);

      // Verify CLI mock recorded the execution
      const mockCLI = testContext.mocks!.get('cli');
      const lastExecution = mockCLI.getLastExecution();
      expect(lastExecution.command).toContain('mcp list');
    });

    it('should execute MCP install command via mocks', async () => {
      const result = await mcpTestBase.execMCPCommand('install filesystem', testContext);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('installed successfully');

      // Verify execution was recorded
      const mockCLI = testContext.mocks!.get('cli');
      const executions = mockCLI.getAllExecutions();
      expect(executions.length).toBe(1);
      expect(executions[0].command).toContain('mcp install filesystem');
    });

    it('should handle JSON output in mocked commands', async () => {
      const result = await mcpTestBase.execMCPCommand('list', testContext, { json: true });

      expect(result.success).toBe(true);
      expect(result.json).toBeDefined();
      expect(Array.isArray(result.json)).toBe(true);

      const servers = result.json as any[];
      expect(servers.length).toBe(2); // filesystem and memory from mock
      expect(servers[0].name).toBe('filesystem');
    });
  });

  describe('Configuration Utilities', () => {
    it('should read config via mocks', async () => {
      const config = await mcpTestBase.readApexConfig(testContext);

      expect(config).toBeDefined();
      expect(config.project).toBeDefined();
      expect(config.project.name).toBe('test-project');
    });

    it('should write config via mocks', async () => {
      const newConfig = {
        project: { name: 'updated-project', language: 'javascript' },
        customSetting: 'test-value',
      };

      await mcpTestBase.writeApexConfig(testContext, newConfig);

      const readConfig = await mcpTestBase.readApexConfig(testContext);
      expect(readConfig.project.name).toBe('updated-project');
      expect(readConfig.customSetting).toBe('test-value');
    });

    it('should detect server installation status', async () => {
      // Initially no servers installed
      const notInstalled = await mcpTestBase.isServerInstalled(testContext, 'filesystem');
      expect(notInstalled).toBe(false);

      // Simulate installing a server
      const config = await mcpTestBase.readApexConfig(testContext);
      config.mcp = {
        servers: {
          filesystem: {
            name: 'filesystem',
            type: 'stdio',
            command: 'npx',
            args: ['@test/filesystem'],
            autoStart: true,
          },
        },
      };
      await mcpTestBase.writeApexConfig(testContext, config);

      const isInstalled = await mcpTestBase.isServerInstalled(testContext, 'filesystem');
      expect(isInstalled).toBe(true);
    });
  });

  describe('Data Factories', () => {
    it('should create test marketplace entries', () => {
      const entry = createTestMarketplaceEntry('test-server');

      expect(entry.name).toBe('test-server');
      expect(entry.description).toContain('test-server');
      expect(entry.version).toBe('1.0.0');
      expect(entry.author).toBe('test-author');
      expect(entry.verified).toBe(true);
      expect(entry.category).toBe('testing');
      expect(entry.capabilities).toEqual(['test:execute']);
      expect(entry.serverConfig.name).toBe('test-server');
    });

    it('should create test marketplace entries with overrides', () => {
      const entry = createTestMarketplaceEntry('custom-server', {
        version: '2.0.0',
        verified: false,
        category: 'development',
        capabilities: ['dev:tool1', 'dev:tool2'],
      });

      expect(entry.name).toBe('custom-server');
      expect(entry.version).toBe('2.0.0');
      expect(entry.verified).toBe(false);
      expect(entry.category).toBe('development');
      expect(entry.capabilities).toEqual(['dev:tool1', 'dev:tool2']);
    });

    it('should create test server configs', () => {
      const config = createTestServerConfig('test-server');

      expect(config.name).toBe('test-server');
      expect(config.type).toBe('stdio');
      expect(config.command).toBe('npx');
      expect(config.args).toEqual(['-y', '@test/test-server-server']);
      expect(config.autoStart).toBe(false);
    });

    it('should create test APEX configs', () => {
      const config = createTestApexConfig();

      expect(config.project.name).toBe('test-project');
      expect(config.project.language).toBe('typescript');
      expect(config.autonomy.default).toBe('supervised');
      expect(config.models.planning).toBe('sonnet');
      expect(config.limits.maxTokensPerTask).toBe(100000);
    });

    it('should create test APEX configs with overrides', () => {
      const config = createTestApexConfig({
        project: { name: 'custom-project' },
        customField: 'custom-value',
      });

      expect(config.project.name).toBe('custom-project');
      expect(config.customField).toBe('custom-value');
    });
  });

  describe('Assertion Helpers', () => {
    it('should assert command success correctly', () => {
      const successResult: MCPCommandResult = {
        success: true,
        stdout: 'Success output',
        stderr: '',
        exitCode: 0,
        duration: 100,
      };

      expect(() => assertCommandSuccess(successResult)).not.toThrow();

      const failureResult: MCPCommandResult = {
        success: false,
        stdout: '',
        stderr: 'Error output',
        exitCode: 1,
        duration: 100,
      };

      expect(() => assertCommandSuccess(failureResult)).toThrow(
        'Expected command to succeed'
      );
    });

    it('should assert command failure correctly', () => {
      const successResult: MCPCommandResult = {
        success: true,
        stdout: 'Success output',
        stderr: '',
        exitCode: 0,
        duration: 100,
      };

      expect(() => assertCommandFailure(successResult)).toThrow(
        'Expected command to fail'
      );

      const failureResult: MCPCommandResult = {
        success: false,
        stdout: '',
        stderr: 'Error output',
        exitCode: 1,
        duration: 100,
      };

      expect(() => assertCommandFailure(failureResult)).not.toThrow();
    });

    it('should assert output contains expected strings', () => {
      const result: MCPCommandResult = {
        success: true,
        stdout: 'This is the output',
        stderr: 'Some warnings',
        exitCode: 0,
        duration: 100,
      };

      expect(() => assertOutputContains(result, 'output')).not.toThrow();
      expect(() => assertOutputContains(result, ['This', 'is'])).not.toThrow();
      expect(() => assertOutputContains(result, 'warnings')).not.toThrow(); // Should check stderr too

      expect(() => assertOutputContains(result, 'not-present')).toThrow(
        'Expected output to contain "not-present"'
      );
    });

    it('should assert server installation correctly', async () => {
      // Install a server first
      const config = await mcpTestBase.readApexConfig(testContext);
      config.mcp = {
        servers: {
          filesystem: {
            name: 'filesystem',
            type: 'stdio',
            command: 'npx',
            args: ['@test/filesystem'],
            autoStart: true,
          },
        },
      };
      await mcpTestBase.writeApexConfig(testContext, config);

      // Should not throw for installed server
      await expect(
        mcpTestBase.assertServerInstalled(testContext, 'filesystem')
      ).resolves.not.toThrow();

      // Should throw for non-installed server
      await expect(
        mcpTestBase.assertServerInstalled(testContext, 'nonexistent')
      ).rejects.toThrow('Expected server "nonexistent" to be installed');

      // Should validate expected config
      await expect(
        mcpTestBase.assertServerInstalled(testContext, 'filesystem', {
          type: 'stdio',
          autoStart: true,
        })
      ).resolves.not.toThrow();

      // Should throw on config mismatch
      await expect(
        mcpTestBase.assertServerInstalled(testContext, 'filesystem', {
          type: 'http', // Wrong type
        })
      ).rejects.toThrow('config mismatch');
    });
  });

  describe('Mock Implementation Details', () => {
    it('should provide functional filesystem mocks', async () => {
      const mockFs = testContext.mocks!.get('filesystem');

      await mockFs.writeFile('/test/file.txt', 'test content');
      expect(mockFs.exists('/test/file.txt')).toBe(true);

      const content = await mockFs.readFile('/test/file.txt');
      expect(content).toBe('test content');

      await expect(mockFs.readFile('/nonexistent.txt')).rejects.toThrow(
        'File not found'
      );
    });

    it('should provide functional CLI mocks with realistic responses', () => {
      const mockCLI = testContext.mocks!.get('cli');

      // Test different command patterns
      const commands = [
        'mcp list',
        'mcp install filesystem',
        'mcp validate',
        'mcp unknown-command',
      ];

      for (const cmd of commands) {
        const result = mockCLI.exec(cmd, {});
        expect(result).toBeDefined();
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBeDefined();
        expect(result.stderr).toBeDefined();
      }

      // Verify execution history
      const executions = mockCLI.getAllExecutions();
      expect(executions.length).toBe(commands.length);
    });

    it('should provide functional config mocks', async () => {
      const mockConfig = testContext.mocks!.get('config');

      const initialConfig = mockConfig.read();
      expect(initialConfig.project.name).toBe('test-project');

      await mockConfig.update({ customSetting: 'test-value' });
      const updatedConfig = mockConfig.read();
      expect(updatedConfig.customSetting).toBe('test-value');
      expect(updatedConfig.project.name).toBe('test-project'); // Should preserve existing

      await mockConfig.write({ newConfig: true });
      const newConfig = mockConfig.read();
      expect(newConfig.newConfig).toBe(true);
      expect(newConfig.project).toBeUndefined(); // Should replace entirely

      await mockConfig.cleanup();
      const cleanConfig = mockConfig.read();
      expect(cleanConfig.project.name).toBe('test-project'); // Should reset to default
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing mocks gracefully', async () => {
      const contextWithoutMocks = await mcpTestBase.createTestContext({
        mode: 'unit',
        mockOptions: {}, // No mocks enabled
      });

      try {
        await expect(
          mcpTestBase.execMCPCommand('list', contextWithoutMocks)
        ).rejects.toThrow('CLI mock not available');

        await expect(
          mcpTestBase.readApexConfig(contextWithoutMocks)
        ).rejects.toThrow('Config mock not available');
      } finally {
        await mcpTestBase.cleanupTestContext(contextWithoutMocks);
      }
    });

    it('should handle cleanup of all mock types', async () => {
      const mocks = testContext.mocks!;
      expect(mocks.size).toBeGreaterThan(0);

      await mcpTestBase.cleanupTestContext(testContext);

      // Mocks should be cleared after cleanup
      expect(mocks.size).toBe(0);
    });

    it('should detect E2E mode when appropriate', async () => {
      // Simulate E2E environment
      process.env.APEX_TEST_MODE = 'e2e';

      // Mock the global E2E helpers to simulate E2E environment
      const mockE2EHelpers = { createMCPTestContext: vi.fn() };
      (globalThis as any).apexE2EHelpers = mockE2EHelpers;

      try {
        expect(isUnitTestMode()).toBe(false);
      } finally {
        delete (globalThis as any).apexE2EHelpers;
        process.env.APEX_TEST_MODE = 'unit';
      }
    });
  });
});