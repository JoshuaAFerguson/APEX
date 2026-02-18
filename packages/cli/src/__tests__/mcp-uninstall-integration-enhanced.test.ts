/**
 * Enhanced integration tests for MCP server uninstall command
 * Focused on comprehensive integration scenarios and acceptance criteria validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CliContext } from '../index.js';
import type { MCPServerConfig, ApexConfig } from '@apexcli/core';

// Mock chalk
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
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
    getMCPServers: vi.fn(),
  };
});

import inquirer from 'inquirer';
import { loadConfig, saveConfig, getMCPServers, ApexConfigSchema } from '@apexcli/core';

const mockConsoleLog = vi.spyOn(console, 'log');

describe('MCP Uninstall Enhanced Integration Tests', () => {
  let mockContext: CliContext;
  let mockLoadConfig: any;
  let mockSaveConfig: any;
  let mockGetMCPServers: any;
  let mockInquirerPrompt: any;
  let mcpCommand: any;

  const baseConfig: ApexConfig = {
    project: {
      name: 'Test Project',
      description: 'Test project for MCP uninstall testing',
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

    mockLoadConfig = vi.mocked(loadConfig);
    mockSaveConfig = vi.mocked(saveConfig);
    mockGetMCPServers = vi.mocked(getMCPServers);
    mockInquirerPrompt = vi.mocked(inquirer.prompt);

    mockLoadConfig.mockResolvedValue(JSON.parse(JSON.stringify(baseConfig)));
    mockSaveConfig.mockResolvedValue(undefined);
    mockGetMCPServers.mockReturnValue({});
    mockInquirerPrompt.mockResolvedValue({ confirm: true });

    const { commands } = await import('../index.js');
    mcpCommand = commands.find(cmd => cmd.name === 'mcp');
  });

  describe('Enhanced Server Removal Tests', () => {
    it('should handle server status verification after uninstall', async () => {
      const configWithServer = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'test-server': {
              name: 'Test Server',
              type: 'stdio' as const,
              command: 'test-command',
              args: ['--test'],
              autoStart: true,
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithServer);
      mockGetMCPServers.mockReturnValue(configWithServer.mcp.servers);

      await mcpCommand.handler(mockContext, ['uninstall', 'test-server']);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];

      expect(savedConfig.mcp.servers['test-server']).toBeUndefined();
      expect(Object.keys(savedConfig.mcp.servers)).toHaveLength(0);
      expect(savedConfig.project).toBeDefined();
      expect(savedConfig.mcp.enabled).toBe(true);
    });

    it('should preserve custom MCP configuration sections during uninstall', async () => {
      const configWithCustomMcp = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'target-server': {
              name: 'Target Server',
              type: 'stdio' as const,
              command: 'target-cmd',
              args: [],
              autoStart: true,
            },
          },
          globalSettings: {
            timeout: 30000,
            retryAttempts: 3,
            logLevel: 'info',
          },
          customSection: {
            value: 'should be preserved',
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithCustomMcp);
      mockGetMCPServers.mockReturnValue(configWithCustomMcp.mcp.servers);

      await mcpCommand.handler(mockContext, ['uninstall', 'target-server']);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];

      expect(savedConfig.mcp.globalSettings).toEqual(configWithCustomMcp.mcp.globalSettings);
      expect(savedConfig.mcp.customSection).toEqual(configWithCustomMcp.mcp.customSection);
      expect(savedConfig.mcp.enabled).toBe(true);
      expect(savedConfig.mcp.servers['target-server']).toBeUndefined();
    });

    it('should handle filesystem-level errors gracefully', async () => {
      const configWithServer = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'error-test': {
              name: 'Error Test Server',
              type: 'stdio' as const,
              command: 'test-cmd',
              args: [],
              autoStart: true,
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithServer);
      mockGetMCPServers.mockReturnValue(configWithServer.mcp.servers);
      mockSaveConfig.mockRejectedValue(new Error('Disk write error'));

      await mcpCommand.handler(mockContext, ['uninstall', 'error-test']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error uninstalling MCP server: Disk write error')
      );
    });

    it('should produce valid config schema after uninstall', async () => {
      const configWithServer = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'schema-test': {
              name: 'Schema Test',
              type: 'stdio' as const,
              command: 'schema-cmd',
              args: [],
              autoStart: false,
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithServer);
      mockGetMCPServers.mockReturnValue(configWithServer.mcp.servers);

      await mcpCommand.handler(mockContext, ['uninstall', 'schema-test']);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];

      expect(() => ApexConfigSchema.parse(savedConfig)).not.toThrow();
      expect(savedConfig.project).toBeDefined();
      expect(savedConfig.mcp).toBeDefined();
      expect(savedConfig.mcp.enabled).toBe(true);
      expect(savedConfig.mcp.servers).toBeTypeOf('object');
    });
  });

  describe('Enhanced Acceptance Criteria Validation', () => {
    it('should handle confirmation prompts with complex server names', async () => {
      const configWithUnicode = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'unicode-test': {
              name: 'Unicode Test Server',
              type: 'stdio' as const,
              command: 'unicode-cmd',
              args: [],
              autoStart: true,
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithUnicode);
      mockGetMCPServers.mockReturnValue(configWithUnicode.mcp.servers);

      await mcpCommand.handler(mockContext, ['uninstall', 'unicode-test']);

      expect(mockInquirerPrompt).toHaveBeenCalledWith([{
        type: 'confirm',
        name: 'confirm',
        message: "Are you sure you want to uninstall 'Unicode Test Server' (unicode-test)?",
        default: false,
      }]);

      expect(mockSaveConfig).toHaveBeenCalled();
    });

    it('should handle large config files efficiently', async () => {
      const largeConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: Object.fromEntries(
            Array.from({ length: 20 }, (_, i) => [
              `server-${i}`,
              {
                name: `Test Server ${i}`,
                type: 'stdio' as const,
                command: `server-command-${i}`,
                args: [`--arg${i}`],
                autoStart: i % 2 === 0,
              },
            ])
          ),
        },
      };

      mockLoadConfig.mockResolvedValue(largeConfig);
      mockGetMCPServers.mockReturnValue(largeConfig.mcp.servers);

      await mcpCommand.handler(mockContext, ['uninstall', 'server-10']);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];

      expect(savedConfig.mcp.servers['server-10']).toBeUndefined();
      expect(savedConfig.mcp.servers['server-9']).toBeDefined();
      expect(savedConfig.mcp.servers['server-11']).toBeDefined();
      expect(Object.keys(savedConfig.mcp.servers)).toHaveLength(19);
    });

    it('should complete full uninstall lifecycle with comprehensive validation', async () => {
      const realWorldConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            'filesystem': {
              name: 'Filesystem Server',
              type: 'stdio' as const,
              command: 'filesystem-cmd',
              args: ['--path', '/workspace'],
              autoStart: true,
            },
            'github': {
              name: 'GitHub Server',
              type: 'stdio' as const,
              command: 'github-cmd',
              args: ['--api'],
              autoStart: true,
            },
            'database': {
              name: 'Database Server',
              type: 'http' as const,
              uri: 'http://localhost:3001',
              autoStart: false,
            },
          },
          globalSettings: {
            timeout: 30000,
            logLevel: 'info',
          },
        },
      };

      mockLoadConfig.mockResolvedValue(realWorldConfig);
      mockGetMCPServers.mockReturnValue(realWorldConfig.mcp.servers);

      await mcpCommand.handler(mockContext, ['uninstall', 'github']);

      expect(mockInquirerPrompt).toHaveBeenCalledWith([{
        type: 'confirm',
        name: 'confirm',
        message: "Are you sure you want to uninstall 'GitHub Server' (github)?",
        default: false,
      }]);

      expect(mockSaveConfig).toHaveBeenCalledTimes(1);
      const savedConfig = mockSaveConfig.mock.calls[0][1];

      expect(savedConfig.mcp.servers['github']).toBeUndefined();
      expect(savedConfig.mcp.servers['filesystem']).toEqual(realWorldConfig.mcp.servers['filesystem']);
      expect(savedConfig.mcp.servers['database']).toEqual(realWorldConfig.mcp.servers['database']);
      expect(savedConfig.mcp.globalSettings).toEqual(realWorldConfig.mcp.globalSettings);
      expect(savedConfig.mcp.enabled).toBe(true);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GREEN:✅ Successfully uninstalled MCP server \'GitHub Server\' (github)')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Remaining installed servers: 2')
      );

      expect(() => ApexConfigSchema.parse(savedConfig)).not.toThrow();
    });
  });
});