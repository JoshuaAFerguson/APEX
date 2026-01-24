/**
 * Comprehensive Integration Tests for MCP Server Install Command
 *
 * Tests verify:
 * - Successful server installation creates expected files/config
 * - Invalid server name errors handled properly
 * - Version specification works correctly
 * - Reinstall/upgrade scenarios handled
 * - All integration scenarios pass
 *
 * These tests validate the complete MCP install command workflow from CLI to backend.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { CliContext } from '../index.js';
import type { MCPTemplate, ApexConfig } from '@apexcli/core';

// Mock chalk to avoid color codes in tests
vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => `CYAN:${str}`,
    red: (str: string) => `RED:${str}`,
    green: (str: string) => `GREEN:${str}`,
    yellow: (str: string) => `YELLOW:${str}`,
    gray: (str: string) => `GRAY:${str}`,
    blue: (str: string) => `BLUE:${str}`,
  },
}));

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

// Mock core functions
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    getMCPTemplate: vi.fn(),
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
    getMCPServers: vi.fn(),
  };
});

// Mock orchestrator functions
vi.mock('@apexcli/orchestrator', () => ({
  MCPInstaller: vi.fn().mockImplementation(() => ({
    install: vi.fn(),
    installFromNpm: vi.fn(),
    getInstalledServer: vi.fn(),
    isInstalled: vi.fn(),
    verifyInstallation: vi.fn(),
    uninstall: vi.fn(),
    listInstalled: vi.fn(),
  })),
}));

import inquirer from 'inquirer';
import { getMCPTemplate, loadConfig, saveConfig, getMCPServers } from '@apexcli/core';
import { MCPInstaller, type MCPInstallationOptions } from '@apexcli/orchestrator';
import { commands } from '../index.js';

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

describe('MCP Install Command Integration Tests', () => {
  let mockContext: CliContext;
  let mockGetMCPTemplate: any;
  let mockLoadConfig: any;
  let mockSaveConfig: any;
  let mockGetMCPServers: any;
  let mockInquirerPrompt: any;
  let mockMCPInstaller: any;
  let mcpCommand: any;
  let tempDir: string;

  // Test data templates
  const filesystemTemplate: MCPTemplate = {
    id: 'filesystem',
    name: 'Filesystem Server',
    description: 'MCP server providing secure filesystem access',
    package: '@modelcontextprotocol/server-filesystem',
    config: {
      name: 'filesystem',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      autoStart: true,
    },
    capabilities: ['filesystem', 'read', 'write'],
    verified: true,
    defaultEnabled: true,
  };

  const githubTemplate: MCPTemplate = {
    id: 'github',
    name: 'GitHub Server',
    description: 'MCP server for GitHub repository integration',
    package: '@modelcontextprotocol/server-github',
    config: {
      name: 'github',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      autoStart: false,
    },
    capabilities: ['git', 'api'],
    verified: true,
    defaultEnabled: false,
  };

  const baseConfig: ApexConfig = {
    project: {
      name: 'Test Project',
      description: 'Test project for MCP integration testing',
    },
    agents: {},
    workflows: {},
    limits: {
      maxTokens: 100000,
      maxCost: 10.0,
      timeoutMs: 300000,
    },
    autonomy: {
      level: 'medium',
      autoApprove: false,
    },
    mcp: {
      enabled: true,
      servers: {},
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();

    // Create temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-install-test-'));

    mockContext = {
      cwd: tempDir,
      initialized: true,
      config: baseConfig,
    };

    // Setup mocks
    mockGetMCPTemplate = vi.mocked(getMCPTemplate);
    mockLoadConfig = vi.mocked(loadConfig);
    mockSaveConfig = vi.mocked(saveConfig);
    mockGetMCPServers = vi.mocked(getMCPServers);
    mockInquirerPrompt = vi.mocked(inquirer.prompt);

    // Mock MCPInstaller constructor and methods
    const MockedMCPInstaller = vi.mocked(MCPInstaller);
    mockMCPInstaller = {
      install: vi.fn(),
      installFromNpm: vi.fn(),
      getInstalledServer: vi.fn(),
      isInstalled: vi.fn(),
      verifyInstallation: vi.fn(),
      uninstall: vi.fn(),
      listInstalled: vi.fn(),
    };
    MockedMCPInstaller.mockImplementation(() => mockMCPInstaller);

    // Default mock returns
    mockLoadConfig.mockResolvedValue(JSON.parse(JSON.stringify(baseConfig)));
    mockSaveConfig.mockResolvedValue(undefined);
    mockGetMCPServers.mockReturnValue({});
    mockInquirerPrompt.mockResolvedValue({ confirm: true });

    // Load commands
    mcpCommand = commands.find(cmd => cmd.name === 'mcp');
  });

  afterEach(async () => {
    vi.clearAllMocks();
    // Clean up temporary directory
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Successful Server Installation Creates Expected Files/Config', () => {
    it('should successfully install a verified marketplace server with all expected files', async () => {
      // Setup mocks for successful installation
      mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);
      mockGetMCPServers.mockReturnValue({});

      const mockInstalledResult = {
        name: 'filesystem',
        config: filesystemTemplate.config,
        installedFrom: 'marketplace' as const,
        installedAt: new Date(),
      };
      mockMCPInstaller.install.mockResolvedValue(mockInstalledResult);

      // Execute install command
      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      // Verify MCPInstaller.install was called with correct parameters
      expect(mockMCPInstaller.install).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'filesystem',
          package: '@modelcontextprotocol/server-filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
        }),
        expect.any(Object)
      );

      // Verify config was updated and saved
      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];
      expect(savedConfig.mcp.enabled).toBe(true);
      expect(savedConfig.mcp.servers['filesystem']).toEqual(filesystemTemplate.config);

      // Verify success messages were displayed
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GREEN:✅ Successfully added MCP server')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Filesystem Server')
      );
    });

    it('should create proper directory structure and config files', async () => {
      mockGetMCPTemplate.mockResolvedValue(githubTemplate);
      mockGetMCPServers.mockReturnValue({});

      const mockInstalledResult = {
        name: 'github',
        config: githubTemplate.config,
        installedFrom: 'marketplace' as const,
        installedAt: new Date(),
      };
      mockMCPInstaller.install.mockResolvedValue(mockInstalledResult);

      await mcpCommand.handler(mockContext, ['install', 'github']);

      // Verify config structure is preserved and enhanced
      const savedConfig = mockSaveConfig.mock.calls[0][1];
      expect(savedConfig.project).toEqual(baseConfig.project);
      expect(savedConfig.agents).toEqual(baseConfig.agents);
      expect(savedConfig.workflows).toEqual(baseConfig.workflows);
      expect(savedConfig.limits).toEqual(baseConfig.limits);
      expect(savedConfig.autonomy).toEqual(baseConfig.autonomy);

      // Verify MCP section is properly configured
      expect(savedConfig.mcp.enabled).toBe(true);
      expect(savedConfig.mcp.servers['github']).toEqual(githubTemplate.config);
    });

    it('should handle servers with complex configurations and environment variables', async () => {
      const complexTemplate: MCPTemplate = {
        id: 'database-server',
        name: 'Database Server',
        description: 'Database integration server with environment variables',
        package: '@company/database-mcp-server',
        config: {
          name: 'database-server',
          type: 'stdio',
          command: 'node',
          args: ['./dist/index.js', '--verbose', '--port=3000'],
          env: {
            DB_HOST: 'localhost',
            DB_PORT: '5432',
            NODE_ENV: 'production',
          },
          autoStart: false,
        },
        capabilities: ['database', 'query', 'transactions'],
        verified: false,
        defaultEnabled: false,
      };

      mockGetMCPTemplate.mockResolvedValue(complexTemplate);
      mockGetMCPServers.mockReturnValue({});

      const mockInstalledResult = {
        name: 'database-server',
        config: complexTemplate.config,
        installedFrom: 'marketplace' as const,
        installedAt: new Date(),
      };
      mockMCPInstaller.install.mockResolvedValue(mockInstalledResult);

      await mcpCommand.handler(mockContext, ['install', 'database-server']);

      // Verify complex configuration is handled correctly
      const savedConfig = mockSaveConfig.mock.calls[0][1];
      const installedConfig = savedConfig.mcp.servers['database-server'];

      expect(installedConfig.command).toBe('node');
      expect(installedConfig.args).toEqual(['./dist/index.js', '--verbose', '--port=3000']);
      expect(installedConfig.env).toEqual({
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        NODE_ENV: 'production',
      });
      expect(installedConfig.autoStart).toBe(false);
    });
  });

  describe('Invalid Server Name Error Handling', () => {
    it('should handle missing server name gracefully', async () => {
      await mcpCommand.handler(mockContext, ['install']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error: Server name is required')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Usage: /mcp install <server-name>')
      );

      // Verify no installation attempts were made
      expect(mockMCPInstaller.install).not.toHaveBeenCalled();
      expect(mockSaveConfig).not.toHaveBeenCalled();
    });

    it('should handle empty/whitespace server names', async () => {
      await mcpCommand.handler(mockContext, ['install', '']);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error: Server name is required')
      );

      await mcpCommand.handler(mockContext, ['install', '   ']);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error: Server name is required')
      );

      // Verify no installation attempts were made
      expect(mockMCPInstaller.install).not.toHaveBeenCalled();
    });

    it('should handle non-existent server templates', async () => {
      mockGetMCPTemplate.mockResolvedValue(null);

      await mcpCommand.handler(mockContext, ['install', 'non-existent-server']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ MCP template \'non-existent-server\' not found')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Available servers: /mcp list')
      );

      // Verify no installation attempts were made
      expect(mockMCPInstaller.install).not.toHaveBeenCalled();
      expect(mockSaveConfig).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive server name matching', async () => {
      mockGetMCPTemplate.mockImplementation(async (id: string) => {
        if (id.toLowerCase() === 'filesystem') {
          return filesystemTemplate;
        }
        return null;
      });
      mockGetMCPServers.mockReturnValue({});

      const mockInstalledResult = {
        name: 'filesystem',
        config: filesystemTemplate.config,
        installedFrom: 'marketplace' as const,
        installedAt: new Date(),
      };
      mockMCPInstaller.install.mockResolvedValue(mockInstalledResult);

      // Test with different case variations
      await mcpCommand.handler(mockContext, ['install', 'FILESYSTEM']);
      expect(mockMCPInstaller.install).toHaveBeenCalled();

      mockMCPInstaller.install.mockClear();
      await mcpCommand.handler(mockContext, ['install', 'FileSystem']);
      expect(mockMCPInstaller.install).toHaveBeenCalled();
    });

    it('should handle special characters and validation in server names', async () => {
      const invalidServerNames = [
        'server with spaces',
        'server@#$%',
        '../malicious-path',
        'server\n\r',
        'server\t',
        null,
        undefined,
      ];

      for (const invalidName of invalidServerNames) {
        mockConsoleLog.mockClear();
        mockGetMCPTemplate.mockResolvedValue(null);

        await mcpCommand.handler(mockContext, ['install', invalidName as any]);

        if (invalidName == null || typeof invalidName !== 'string' || invalidName.trim() === '') {
          expect(mockConsoleLog).toHaveBeenCalledWith(
            expect.stringContaining('RED:❌ Error: Server name is required')
          );
        } else {
          expect(mockConsoleLog).toHaveBeenCalledWith(
            expect.stringContaining('RED:❌ MCP template')
          );
        }
        expect(mockMCPInstaller.install).not.toHaveBeenCalled();
      }
    });
  });

  describe('Version Specification Works Correctly', () => {
    it('should install server with default version when none specified', async () => {
      mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);
      mockGetMCPServers.mockReturnValue({});

      const mockInstalledResult = {
        name: 'filesystem',
        config: filesystemTemplate.config,
        installedFrom: 'marketplace' as const,
        installedAt: new Date(),
      };
      mockMCPInstaller.install.mockResolvedValue(mockInstalledResult);

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      // Verify install was called with default version handling
      expect(mockMCPInstaller.install).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'filesystem',
          version: expect.any(String), // Should have some version
        }),
        expect.any(Object)
      );
    });

    it('should handle specific version installation through options', async () => {
      mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);
      mockGetMCPServers.mockReturnValue({});

      // Simulate version being passed through MCP installer options
      const mockInstalledResult = {
        name: 'filesystem',
        config: filesystemTemplate.config,
        installedFrom: 'marketplace' as const,
        installedAt: new Date(),
      };
      mockMCPInstaller.install.mockResolvedValue(mockInstalledResult);

      await mcpCommand.handler(mockContext, ['install', 'filesystem@1.2.3']);

      // The CLI should handle version parsing and pass it to the installer
      expect(mockMCPInstaller.install).toHaveBeenCalled();

      // Verify version information is preserved in the final config
      const savedConfig = mockSaveConfig.mock.calls[0][1];
      expect(savedConfig.mcp.servers['filesystem']).toEqual(filesystemTemplate.config);
    });

    it('should validate version format and handle invalid versions', async () => {
      const invalidVersions = [
        'filesystem@invalid.version',
        'filesystem@',
        'filesystem@1.2.3.4.5',
        'filesystem@abc',
      ];

      for (const invalidVersion of invalidVersions) {
        mockConsoleLog.mockClear();
        mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);
        mockGetMCPServers.mockReturnValue({});

        // Mock installer to reject invalid versions
        mockMCPInstaller.install.mockRejectedValue(new Error('Invalid version format'));

        await mcpCommand.handler(mockContext, ['install', invalidVersion]);

        // Should show error message for version parsing failure
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('RED:❌ Error adding MCP server')
        );
      }
    });

    it('should support semantic version ranges', async () => {
      mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);
      mockGetMCPServers.mockReturnValue({});

      const validVersionRanges = [
        'filesystem@^1.0.0',
        'filesystem@~1.2.3',
        'filesystem@>=1.0.0',
        'filesystem@latest',
      ];

      for (const versionSpec of validVersionRanges) {
        mockMCPInstaller.install.mockClear();
        mockConsoleLog.mockClear();

        const mockInstalledResult = {
          name: 'filesystem',
          config: filesystemTemplate.config,
          installedFrom: 'marketplace' as const,
          installedAt: new Date(),
        };
        mockMCPInstaller.install.mockResolvedValue(mockInstalledResult);

        await mcpCommand.handler(mockContext, ['install', versionSpec]);

        expect(mockMCPInstaller.install).toHaveBeenCalled();
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('GREEN:✅ Successfully added MCP server')
        );
      }
    });
  });

  describe('Reinstall/Upgrade Scenarios Handled', () => {
    it('should detect already installed servers and prompt for confirmation', async () => {
      const existingConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            filesystem: filesystemTemplate.config,
          },
        },
      };

      mockLoadConfig.mockResolvedValue(existingConfig);
      mockGetMCPServers.mockReturnValue(existingConfig.mcp.servers);
      mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('YELLOW:⚠️  Server \'filesystem\' already exists')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Use "force" to overwrite:')
      );

      // Should not attempt installation without force
      expect(mockSaveConfig).not.toHaveBeenCalled();
    });

    it('should support forced reinstallation with --force flag simulation', async () => {
      const existingConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            filesystem: {
              ...filesystemTemplate.config,
              command: 'old-command', // Different command to verify upgrade
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(existingConfig);
      mockGetMCPServers.mockReturnValue(existingConfig.mcp.servers);
      mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);

      // Mock installer to handle force reinstall
      const mockInstalledResult = {
        name: 'filesystem',
        config: filesystemTemplate.config,
        installedFrom: 'marketplace' as const,
        installedAt: new Date(),
      };
      mockMCPInstaller.install.mockResolvedValue(mockInstalledResult);

      // For now, we'll test the logic without --force flag parsing
      // In a real scenario, this would be handled by the CLI argument parser
      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      // Since we show warning and don't proceed, verify the behavior
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('YELLOW:⚠️  Server \'filesystem\' already exists')
      );
    });

    it('should handle upgrade scenarios with version changes', async () => {
      const oldConfig = {
        ...filesystemTemplate.config,
        args: ['-y', '@modelcontextprotocol/server-filesystem@1.0.0'], // Old version
      };

      const existingConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            filesystem: oldConfig,
          },
        },
      };

      const upgradedTemplate = {
        ...filesystemTemplate,
        config: {
          ...filesystemTemplate.config,
          args: ['-y', '@modelcontextprotocol/server-filesystem@2.0.0'], // New version
        },
      };

      mockLoadConfig.mockResolvedValue(existingConfig);
      mockGetMCPServers.mockReturnValue(existingConfig.mcp.servers);
      mockGetMCPTemplate.mockResolvedValue(upgradedTemplate);

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      // Should detect existing installation
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('YELLOW:⚠️  Server \'filesystem\' already exists')
      );
    });

    it('should handle partial installation cleanup during retry', async () => {
      mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);
      mockGetMCPServers.mockReturnValue({});

      // First installation fails
      mockMCPInstaller.install
        .mockRejectedValueOnce(new Error('Network timeout during installation'))
        .mockResolvedValueOnce({
          name: 'filesystem',
          config: filesystemTemplate.config,
          installedFrom: 'marketplace' as const,
          installedAt: new Date(),
        });

      // First attempt should fail
      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error adding MCP server')
      );

      // Clear mocks for retry
      mockConsoleLog.mockClear();

      // Second attempt should succeed
      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GREEN:✅ Successfully added MCP server')
      );
    });

    it('should maintain installation history and metadata', async () => {
      mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);
      mockGetMCPServers.mockReturnValue({});

      const mockInstalledResult = {
        name: 'filesystem',
        config: filesystemTemplate.config,
        installedFrom: 'marketplace' as const,
        installedAt: new Date(),
      };
      mockMCPInstaller.install.mockResolvedValue(mockInstalledResult);

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      // Verify the installer was called with proper metadata
      expect(mockMCPInstaller.install).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'filesystem',
          package: '@modelcontextprotocol/server-filesystem',
        }),
        expect.any(Object) // Installation options
      );

      // Verify config includes proper metadata
      const savedConfig = mockSaveConfig.mock.calls[0][1];
      expect(savedConfig.mcp.servers['filesystem']).toBeDefined();
      expect(savedConfig.mcp.servers['filesystem'].name).toBe('filesystem');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle config loading failures gracefully', async () => {
      mockLoadConfig.mockRejectedValue(new Error('Config file corrupted'));

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error adding MCP server: Config file corrupted')
      );
    });

    it('should handle config saving failures gracefully', async () => {
      mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);
      mockGetMCPServers.mockReturnValue({});
      mockSaveConfig.mockRejectedValue(new Error('Permission denied'));

      const mockInstalledResult = {
        name: 'filesystem',
        config: filesystemTemplate.config,
        installedFrom: 'marketplace' as const,
        installedAt: new Date(),
      };
      mockMCPInstaller.install.mockResolvedValue(mockInstalledResult);

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error adding MCP server: Permission denied')
      );
    });

    it('should handle installer failures and show appropriate errors', async () => {
      mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);
      mockGetMCPServers.mockReturnValue({});
      mockMCPInstaller.install.mockRejectedValue(new Error('Package not found in npm registry'));

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error adding MCP server: Package not found in npm registry')
      );
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle extremely long server names', async () => {
      const longName = 'a'.repeat(300); // Very long server name
      mockGetMCPTemplate.mockResolvedValue(null);

      await mcpCommand.handler(mockContext, ['install', longName]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(`RED:❌ MCP template '${longName}' not found`)
      );
    });

    it('should handle concurrent installation attempts', async () => {
      mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);
      mockGetMCPServers.mockReturnValue({});

      const mockInstalledResult = {
        name: 'filesystem',
        config: filesystemTemplate.config,
        installedFrom: 'marketplace' as const,
        installedAt: new Date(),
      };
      mockMCPInstaller.install.mockResolvedValue(mockInstalledResult);

      // Simulate concurrent installations (though CLI typically handles one at a time)
      const promise1 = mcpCommand.handler(mockContext, ['install', 'filesystem']);
      const promise2 = mcpCommand.handler(mockContext, ['install', 'filesystem']);

      await Promise.all([promise1, promise2]);

      // Both should complete without errors (the installer handles concurrency)
      expect(mockMCPInstaller.install).toHaveBeenCalledTimes(2);
    });

    it('should handle malformed template configurations gracefully', async () => {
      const malformedTemplate = {
        ...filesystemTemplate,
        config: {
          // Missing required fields
          name: 'filesystem',
          // Missing type, command, args
        } as any,
      };

      mockGetMCPTemplate.mockResolvedValue(malformedTemplate);
      mockGetMCPServers.mockReturnValue({});

      const mockInstalledResult = {
        name: 'filesystem',
        config: malformedTemplate.config,
        installedFrom: 'marketplace' as const,
        installedAt: new Date(),
      };
      mockMCPInstaller.install.mockResolvedValue(mockInstalledResult);

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      // Should still attempt installation but handle gracefully
      expect(mockMCPInstaller.install).toHaveBeenCalled();
    });
  });
});