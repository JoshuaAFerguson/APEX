/**
 * Integration tests for MCP install and uninstall commands
 * Tests the complete workflow and edge cases for config file handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Mock MCP and config functions
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

import inquirer from 'inquirer';
import { getMCPTemplate, loadConfig, saveConfig, getMCPServers } from '@apexcli/core';

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

describe('MCP Install/Uninstall Integration Tests', () => {
  let mockContext: CliContext;
  let mockGetMCPTemplate: any;
  let mockLoadConfig: any;
  let mockSaveConfig: any;
  let mockGetMCPServers: any;
  let mockInquirerPrompt: any;
  let mcpCommand: any;

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
      description: 'Test project for MCP testing',
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

    mockContext = {
      cwd: '/test/project',
      initialized: true,
      config: baseConfig,
    };

    // Setup mocks
    mockGetMCPTemplate = vi.mocked(getMCPTemplate);
    mockLoadConfig = vi.mocked(loadConfig);
    mockSaveConfig = vi.mocked(saveConfig);
    mockGetMCPServers = vi.mocked(getMCPServers);
    mockInquirerPrompt = vi.mocked(inquirer.prompt);

    // Default mock returns
    mockLoadConfig.mockResolvedValue(JSON.parse(JSON.stringify(baseConfig)));
    mockSaveConfig.mockResolvedValue(undefined);
    mockGetMCPServers.mockReturnValue({});
    mockInquirerPrompt.mockResolvedValue({ confirm: true });

    const { commands } = await import('../index.js');
    mcpCommand = commands.find(cmd => cmd.name === 'mcp');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Config File Integrity Tests', () => {
    it('should preserve existing config structure when adding MCP server', async () => {
      const configWithExistingData = {
        ...baseConfig,
        customProperty: 'should not be lost',
        mcp: {
          enabled: false,
          servers: {
            'existing-server': {
              name: 'Existing Server',
              type: 'stdio',
              command: 'existing',
              args: [],
              autoStart: true,
            },
          },
          customMcpProperty: 'should be preserved',
        },
      };

      mockLoadConfig.mockResolvedValue(configWithExistingData);
      mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);
      mockGetMCPServers.mockReturnValue(configWithExistingData.mcp.servers);

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];

      // Verify existing properties are preserved
      expect(savedConfig.customProperty).toBe('should not be lost');
      expect(savedConfig.mcp.customMcpProperty).toBe('should be preserved');
      expect(savedConfig.mcp.enabled).toBe(true); // Should be enabled when installing
      expect(savedConfig.mcp.servers['existing-server']).toEqual(configWithExistingData.mcp.servers['existing-server']);
      expect(savedConfig.mcp.servers['filesystem']).toEqual(filesystemTemplate.config);
    });

    it('should preserve existing config structure when removing MCP server', async () => {
      const configWithMultipleServers = {
        ...baseConfig,
        customProperty: 'should not be lost',
        mcp: {
          enabled: true,
          servers: {
            'filesystem': filesystemTemplate.config,
            'github': githubTemplate.config,
          },
          customMcpProperty: 'should be preserved',
        },
      };

      mockLoadConfig.mockResolvedValue(configWithMultipleServers);
      mockGetMCPServers.mockReturnValue(configWithMultipleServers.mcp.servers);

      await mcpCommand.handler(mockContext, ['uninstall', 'filesystem']);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];

      // Verify existing properties are preserved
      expect(savedConfig.customProperty).toBe('should not be lost');
      expect(savedConfig.mcp.customMcpProperty).toBe('should be preserved');
      expect(savedConfig.mcp.enabled).toBe(true);
      expect(savedConfig.mcp.servers['github']).toEqual(githubTemplate.config);
      expect(savedConfig.mcp.servers['filesystem']).toBeUndefined();
    });

    it('should handle malformed MCP config gracefully during install', async () => {
      const configWithMalformedMcp = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: 'this should be an object', // Invalid servers format
        },
      };

      mockLoadConfig.mockResolvedValue(configWithMalformedMcp);
      mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);
      mockGetMCPServers.mockReturnValue({});

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];

      // Should fix the malformed config
      expect(savedConfig.mcp.servers).toBeTypeOf('object');
      expect(savedConfig.mcp.servers['filesystem']).toEqual(filesystemTemplate.config);
    });

    it('should handle missing MCP section in config during install', async () => {
      const configWithoutMcp = {
        project: baseConfig.project,
        agents: baseConfig.agents,
        workflows: baseConfig.workflows,
        limits: baseConfig.limits,
        autonomy: baseConfig.autonomy,
      };

      mockLoadConfig.mockResolvedValue(configWithoutMcp);
      mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);
      mockGetMCPServers.mockReturnValue({});

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];

      // Should create MCP section
      expect(savedConfig.mcp).toEqual({
        enabled: true,
        servers: {
          'filesystem': filesystemTemplate.config,
        },
      });
    });
  });

  describe('Install/Uninstall Workflow Tests', () => {
    it('should complete full install-then-uninstall workflow', async () => {
      // Step 1: Install filesystem server
      mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);
      mockGetMCPServers.mockReturnValue({});

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      expect(mockSaveConfig).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GREEN:✅ Successfully added MCP server')
      );

      // Update config state for uninstall
      const configAfterInstall = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'filesystem': filesystemTemplate.config,
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configAfterInstall);
      mockGetMCPServers.mockReturnValue(configAfterInstall.mcp.servers);
      mockConsoleLog.mockClear();

      // Step 2: Uninstall filesystem server
      await mcpCommand.handler(mockContext, ['uninstall', 'filesystem']);

      expect(mockSaveConfig).toHaveBeenCalledTimes(2);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GREEN:✅ Successfully uninstalled MCP server')
      );
    });

    it('should handle installing multiple servers sequentially', async () => {
      // Install first server
      mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);
      mockGetMCPServers.mockReturnValue({});

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      const firstInstallConfig = mockSaveConfig.mock.calls[0][1];
      expect(firstInstallConfig.mcp.servers['filesystem']).toEqual(filesystemTemplate.config);

      // Update state for second install
      mockLoadConfig.mockResolvedValue(firstInstallConfig);
      mockGetMCPServers.mockReturnValue(firstInstallConfig.mcp.servers);
      mockGetMCPTemplate.mockResolvedValue(githubTemplate);

      // Install second server
      await mcpCommand.handler(mockContext, ['install', 'github']);

      const secondInstallConfig = mockSaveConfig.mock.calls[1][1];
      expect(secondInstallConfig.mcp.servers['filesystem']).toEqual(filesystemTemplate.config);
      expect(secondInstallConfig.mcp.servers['github']).toEqual(githubTemplate.config);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle config save failures gracefully', async () => {
      mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);
      mockGetMCPServers.mockReturnValue({});
      mockSaveConfig.mockRejectedValue(new Error('Permission denied'));

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error adding MCP server: Permission denied')
      );
    });

    it('should handle config load failures gracefully', async () => {
      mockLoadConfig.mockRejectedValue(new Error('File not found'));

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error adding MCP server: File not found')
      );
    });

    it('should handle case-insensitive server name matching', async () => {
      const configWithServer = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'filesystem': {
              name: 'Filesystem Server',
              type: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem'],
              autoStart: true,
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithServer);
      mockGetMCPServers.mockReturnValue(configWithServer.mcp.servers);

      // Try to uninstall using different case variations
      await mcpCommand.handler(mockContext, ['uninstall', 'FILESYSTEM']);

      expect(mockInquirerPrompt).toHaveBeenCalledWith([{
        type: 'confirm',
        name: 'confirm',
        message: "Are you sure you want to uninstall 'Filesystem Server' (filesystem)?",
        default: false,
      }]);
    });

    it('should handle server names with special characters', async () => {
      const specialTemplate: MCPTemplate = {
        id: 'server-with-special-chars',
        name: 'Server with Special @#$% Characters',
        description: 'Test server with special characters',
        package: '@test/special-server',
        config: {
          name: 'server-with-special-chars',
          type: 'stdio',
          command: 'special-server',
          args: ['--special', '--chars'],
          autoStart: false,
        },
        capabilities: ['special'],
        verified: true,
        defaultEnabled: false,
      };

      mockGetMCPTemplate.mockResolvedValue(specialTemplate);
      mockGetMCPServers.mockReturnValue({});

      await mcpCommand.handler(mockContext, ['install', 'server-with-special-chars']);

      expect(mockSaveConfig).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GREEN:✅ Successfully added MCP server')
      );
    });

    it('should handle extremely long server names gracefully', async () => {
      const longTemplate: MCPTemplate = {
        id: 'very-long-server-name-that-exceeds-normal-length-limits-and-might-cause-display-issues',
        name: 'Very Long Server Name That Exceeds Normal Length Limits And Might Cause Display Issues In Terminal Windows With Limited Width',
        description: 'Test server with very long name',
        package: '@test/long-name-server',
        config: {
          name: 'very-long-server-name-that-exceeds-normal-length-limits-and-might-cause-display-issues',
          type: 'stdio',
          command: 'long-server',
          args: [],
          autoStart: true,
        },
        capabilities: ['long'],
        verified: true,
        defaultEnabled: false,
      };

      mockGetMCPTemplate.mockResolvedValue(longTemplate);
      mockGetMCPServers.mockReturnValue({});

      await mcpCommand.handler(mockContext, ['install', longTemplate.id]);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];
      expect(savedConfig.mcp.servers[longTemplate.id]).toEqual(longTemplate.config);
    });
  });

  describe('Validation and Data Integrity Tests', () => {
    it('should validate server configuration during install', async () => {
      const invalidTemplate = {
        id: 'invalid-server',
        name: 'Invalid Server',
        description: 'Server with invalid config',
        package: '@test/invalid',
        config: {
          // Missing required fields like 'name', 'type', 'command'
          args: ['--invalid'],
          autoStart: true,
        },
        capabilities: [],
        verified: false,
        defaultEnabled: false,
      };

      mockGetMCPTemplate.mockResolvedValue(invalidTemplate);
      mockGetMCPServers.mockReturnValue({});

      // Should still install but with potentially incomplete config
      await mcpCommand.handler(mockContext, ['install', 'invalid-server']);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];
      expect(savedConfig.mcp.servers['invalid-server']).toEqual(invalidTemplate.config);
    });

    it('should prevent installation of duplicate servers', async () => {
      const configWithExisting = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'filesystem': filesystemTemplate.config,
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithExisting);
      mockGetMCPServers.mockReturnValue(configWithExisting.mcp.servers);
      mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('YELLOW:⚠️  Server \'filesystem\' already exists')
      );
      expect(mockSaveConfig).not.toHaveBeenCalled();
    });

    it('should handle empty server name gracefully', async () => {
      await mcpCommand.handler(mockContext, ['install', '']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error: Server name is required')
      );
    });

    it('should handle whitespace-only server name', async () => {
      await mcpCommand.handler(mockContext, ['install', '   ']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error: Server name is required')
      );
    });
  });
});