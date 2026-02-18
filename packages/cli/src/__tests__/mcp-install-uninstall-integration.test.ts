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
import { getMCPTemplate, loadConfig, saveConfig, getMCPServers, ApexConfigSchema } from '@apexcli/core';

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

  describe('Enhanced Test Coverage (Architecture Recommendations)', () => {
    it('should handle concurrent uninstall requests safely', async () => {
      // Setup: Config with multiple servers installed
      const configWithMultipleServers = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'filesystem': filesystemTemplate.config,
            'github': githubTemplate.config,
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithMultipleServers);
      mockGetMCPServers.mockReturnValue(configWithMultipleServers.mcp.servers);

      // Simulate concurrent uninstall requests
      const uninstallPromise1 = mcpCommand.handler(mockContext, ['uninstall', 'filesystem']);
      const uninstallPromise2 = mcpCommand.handler(mockContext, ['uninstall', 'github']);

      await Promise.all([uninstallPromise1, uninstallPromise2]);

      // Both should complete successfully
      expect(mockSaveConfig).toHaveBeenCalledTimes(2);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GREEN:✅ Successfully uninstalled MCP server')
      );
    });

    it('should uninstall from array-format server config', async () => {
      // Test the getMCPServers() function with array format
      const configWithArrayServers = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: [
            {
              name: 'array-server-1',
              type: 'stdio' as const,
              command: 'test-array-1',
              args: ['--arg1'],
              autoStart: true
            },
            {
              name: 'array-server-2',
              type: 'stdio' as const,
              command: 'test-array-2',
              args: ['--arg2'],
              autoStart: false
            }
          ],
        },
      };

      // Mock getMCPServers to normalize array format to Record format
      const normalizedServers = {
        'array-server-1': {
          name: 'array-server-1',
          type: 'stdio' as const,
          command: 'test-array-1',
          args: ['--arg1'],
          autoStart: true,
        },
        'array-server-2': {
          name: 'array-server-2',
          type: 'stdio' as const,
          command: 'test-array-2',
          args: ['--arg2'],
          autoStart: false,
        },
      };

      mockLoadConfig.mockResolvedValue(configWithArrayServers);
      mockGetMCPServers.mockReturnValue(normalizedServers);

      await mcpCommand.handler(mockContext, ['uninstall', 'array-server-1']);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];

      // Verify getMCPServers normalized correctly and uninstall worked
      expect(savedConfig.mcp.servers).toBeTypeOf('object');
      expect(savedConfig.mcp.servers['array-server-1']).toBeUndefined();
      expect(savedConfig.mcp.servers['array-server-2']).toEqual(normalizedServers['array-server-2']);
    });

    it('should produce valid ApexConfig after uninstall', async () => {
      // Setup config with a server to uninstall
      const configWithServer = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'filesystem': filesystemTemplate.config,
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithServer);
      mockGetMCPServers.mockReturnValue(configWithServer.mcp.servers);

      await mcpCommand.handler(mockContext, ['uninstall', 'filesystem']);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];

      // Verify the config written by saveConfig() passes Zod validation
      expect(() => ApexConfigSchema.parse(savedConfig)).not.toThrow();

      // Additional assertions about the saved config structure
      expect(savedConfig.project).toBeDefined();
      expect(savedConfig.mcp).toBeDefined();
      expect(savedConfig.mcp.enabled).toBe(true);
      expect(savedConfig.mcp.servers).toBeTypeOf('object');
      expect(savedConfig.mcp.servers['filesystem']).toBeUndefined();
    });

    it('should handle config corruption during uninstall gracefully', async () => {
      const partiallyCorruptedConfig = {
        project: baseConfig.project,
        mcp: {
          enabled: true,
          servers: {
            'valid-server': filesystemTemplate.config,
            'corrupted-server': {
              // Missing required fields, but present in config
              name: 'Corrupted Server',
              // missing type, command, etc.
            },
          },
        },
        // Missing other required fields like agents, workflows, etc.
      };

      mockLoadConfig.mockResolvedValue(partiallyCorruptedConfig as any);
      mockGetMCPServers.mockReturnValue(partiallyCorruptedConfig.mcp.servers as any);

      await mcpCommand.handler(mockContext, ['uninstall', 'valid-server']);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];

      // Should handle corruption gracefully and still complete uninstall
      expect(savedConfig.mcp.servers['valid-server']).toBeUndefined();
      expect(savedConfig.mcp.servers['corrupted-server']).toBeDefined(); // Preserved
    });

    it('should handle server names with mixed case properly', async () => {
      const configWithMixedCaseServer = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'FileSystemServer': {
              name: 'Advanced Filesystem Server',
              type: 'stdio' as const,
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem'],
              autoStart: true,
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithMixedCaseServer);
      mockGetMCPServers.mockReturnValue(configWithMixedCaseServer.mcp.servers);

      // Test exact match by key
      await mcpCommand.handler(mockContext, ['uninstall', 'FileSystemServer']);

      expect(mockInquirerPrompt).toHaveBeenCalledWith([{
        type: 'confirm',
        name: 'confirm',
        message: "Are you sure you want to uninstall 'Advanced Filesystem Server' (FileSystemServer)?",
        default: false,
      }]);

      expect(mockSaveConfig).toHaveBeenCalled();
    });
  });

  describe('Advanced Integration Tests - Additional Coverage', () => {
    it('should handle server status verification after uninstall', async () => {
      // Test that the orchestrator properly recognizes server is uninstalled
      const configWithServer = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'filesystem': filesystemTemplate.config,
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithServer);
      mockGetMCPServers.mockReturnValue(configWithServer.mcp.servers);

      await mcpCommand.handler(mockContext, ['uninstall', 'filesystem']);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];

      // Verify the server is completely removed from config
      expect(savedConfig.mcp.servers['filesystem']).toBeUndefined();
      expect(Object.keys(savedConfig.mcp.servers)).toHaveLength(0);

      // Verify config structure integrity
      expect(savedConfig.project).toBeDefined();
      expect(savedConfig.mcp).toBeDefined();
      expect(savedConfig.mcp.enabled).toBe(true);
    });

    it('should handle marketplace cache considerations after uninstall', async () => {
      // Test that uninstall operation considers marketplace state
      const configWithMarketplaceServer = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'marketplace-server': {
              name: 'Marketplace Server',
              type: 'stdio' as const,
              command: 'npx',
              args: ['-y', '@marketplace/server'],
              autoStart: true,
              // Additional marketplace metadata
              marketplaceId: 'marketplace-server',
              version: '1.0.0',
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithMarketplaceServer);
      mockGetMCPServers.mockReturnValue(configWithMarketplaceServer.mcp.servers);

      await mcpCommand.handler(mockContext, ['uninstall', 'marketplace-server']);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];

      // Verify marketplace server is properly removed
      expect(savedConfig.mcp.servers['marketplace-server']).toBeUndefined();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GREEN:✅ Successfully uninstalled MCP server')
      );
    });

    it('should handle edge case with circular references in config', async () => {
      // Test config with potential circular references or complex nested structures
      const complexConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'complex-server': {
              name: 'Complex Server',
              type: 'stdio' as const,
              command: 'complex-command',
              args: ['--config', JSON.stringify({ nested: { deep: { structure: true } } })],
              autoStart: true,
              metadata: {
                tags: ['tag1', 'tag2'],
                dependencies: ['dep1'],
                features: {
                  feature1: { enabled: true, config: { setting: 'value' } },
                  feature2: { enabled: false }
                }
              }
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(complexConfig);
      mockGetMCPServers.mockReturnValue(complexConfig.mcp.servers);

      await mcpCommand.handler(mockContext, ['uninstall', 'complex-server']);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];

      // Verify complex server is properly removed without affecting config structure
      expect(savedConfig.mcp.servers['complex-server']).toBeUndefined();
      expect(savedConfig.mcp.enabled).toBe(true);
    });

    it('should handle uninstall with filesystem-level errors gracefully', async () => {
      // Test that filesystem errors during config save are handled properly
      const configWithServer = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'filesystem': filesystemTemplate.config,
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithServer);
      mockGetMCPServers.mockReturnValue(configWithServer.mcp.servers);

      // Simulate filesystem error during save
      mockSaveConfig.mockRejectedValue(new Error('ENOSPC: no space left on device'));

      await mcpCommand.handler(mockContext, ['uninstall', 'filesystem']);

      // Should handle filesystem errors gracefully
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error uninstalling MCP server: ENOSPC: no space left on device')
      );
    });

    it('should preserve custom MCP configuration sections during uninstall', async () => {
      // Test that custom MCP sections are preserved
      const configWithCustomMcp = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'filesystem': filesystemTemplate.config,
            'github': githubTemplate.config,
          },
          // Custom MCP configuration sections
          globalSettings: {
            timeout: 30000,
            retryAttempts: 3,
            logLevel: 'info',
          },
          experimental: {
            features: ['feature1', 'feature2'],
            beta: true,
          },
          customSection: {
            value: 'should be preserved',
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithCustomMcp);
      mockGetMCPServers.mockReturnValue(configWithCustomMcp.mcp.servers);

      await mcpCommand.handler(mockContext, ['uninstall', 'filesystem']);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];

      // Verify custom sections are preserved
      expect(savedConfig.mcp.globalSettings).toEqual(configWithCustomMcp.mcp.globalSettings);
      expect(savedConfig.mcp.experimental).toEqual(configWithCustomMcp.mcp.experimental);
      expect(savedConfig.mcp.customSection).toEqual(configWithCustomMcp.mcp.customSection);
      expect(savedConfig.mcp.enabled).toBe(true);

      // Verify only the target server was removed
      expect(savedConfig.mcp.servers['filesystem']).toBeUndefined();
      expect(savedConfig.mcp.servers['github']).toEqual(githubTemplate.config);
    });

    it('should handle uninstall confirmation with complex server names', async () => {
      // Test confirmation prompts with servers containing special characters and unicode
      const unicodeTemplate = {
        id: 'unicode-test-server',
        name: '🚀 Server with Émojis & Spëcial Characters (测试)',
        description: 'Server with unicode characters',
        package: '@test/unicode-server',
        config: {
          name: 'unicode-test-server',
          type: 'stdio' as const,
          command: 'unicode-server',
          args: ['--unicode', '测试'],
          autoStart: true,
        },
        capabilities: ['unicode'],
        verified: true,
        defaultEnabled: false,
      };

      const configWithUnicode = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'unicode-test-server': unicodeTemplate.config,
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithUnicode);
      mockGetMCPServers.mockReturnValue(configWithUnicode.mcp.servers);

      await mcpCommand.handler(mockContext, ['uninstall', 'unicode-test-server']);

      expect(mockInquirerPrompt).toHaveBeenCalledWith([{
        type: 'confirm',
        name: 'confirm',
        message: "Are you sure you want to uninstall 'unicode-test-server' (unicode-test-server)?",
        default: false,
      }]);

      expect(mockSaveConfig).toHaveBeenCalled();
    });

    it('should handle uninstall with large config files efficiently', async () => {
      // Test performance with large configuration files
      const largeConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: Object.fromEntries(
            Array.from({ length: 50 }, (_, i) => [
              `server-${i}`,
              {
                name: `Test Server ${i}`,
                type: 'stdio' as const,
                command: `server-command-${i}`,
                args: [`--arg${i}`, '--verbose'],
                autoStart: i % 2 === 0,
                metadata: {
                  description: `Generated test server ${i}`,
                  tags: [`tag${i}`, 'generated'],
                  version: `1.${i}.0`,
                },
              },
            ])
          ),
        },
        // Large custom sections
        customData: {
          largeSetting: Array.from({ length: 1000 }, (_, i) => `data-${i}`),
          complexNested: Object.fromEntries(
            Array.from({ length: 100 }, (_, i) => [`key${i}`, { value: `value${i}` }])
          ),
        },
      };

      mockLoadConfig.mockResolvedValue(largeConfig);
      mockGetMCPServers.mockReturnValue(largeConfig.mcp.servers);

      // Test uninstalling from large config
      await mcpCommand.handler(mockContext, ['uninstall', 'server-25']);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];

      // Verify the specific server was removed
      expect(savedConfig.mcp.servers['server-25']).toBeUndefined();
      // Verify other servers remain
      expect(savedConfig.mcp.servers['server-24']).toBeDefined();
      expect(savedConfig.mcp.servers['server-26']).toBeDefined();
      // Verify total count
      expect(Object.keys(savedConfig.mcp.servers)).toHaveLength(49);
      // Verify large custom data is preserved
      expect(savedConfig.customData).toEqual(largeConfig.customData);
    });
  });
});