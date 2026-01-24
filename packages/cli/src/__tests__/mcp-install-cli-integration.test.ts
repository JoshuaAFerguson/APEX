/**
 * Integration Tests for MCP Server Install Command (CLI Focus)
 *
 * This test focuses on the CLI behavior and error handling without heavy orchestrator mocking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { CliContext } from '../index.js';
import type { MCPTemplate, ApexConfig } from '@apexcli/core';
import { commands } from '../index.js';

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

import inquirer from 'inquirer';
import { getMCPTemplate, loadConfig, saveConfig, getMCPServers } from '@apexcli/core';

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

describe('MCP Install Command CLI Integration Tests', () => {
  let mockContext: CliContext;
  let mockGetMCPTemplate: any;
  let mockLoadConfig: any;
  let mockSaveConfig: any;
  let mockGetMCPServers: any;
  let mockInquirerPrompt: any;
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

    // Create temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-install-cli-test-'));

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

  describe('Acceptance Criteria: Invalid Server Name Errors Handled', () => {
    it('should handle missing server name gracefully', async () => {
      await mcpCommand.handler(mockContext, ['install']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error: Server name is required')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Usage: /mcp install <server-name>')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Available servers: /mcp list')
      );

      // Verify no config changes were attempted
      expect(mockSaveConfig).not.toHaveBeenCalled();
    });

    it('should handle empty/whitespace server names', async () => {
      const emptyNames = ['', '   ', '\\t', '\\n'];

      for (const emptyName of emptyNames) {
        mockConsoleLog.mockClear();
        await mcpCommand.handler(mockContext, ['install', emptyName]);

        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('RED:❌ Error: Server name is required')
        );
        expect(mockSaveConfig).not.toHaveBeenCalled();
      }
    });

    it('should handle non-existent server templates with helpful message', async () => {
      mockGetMCPTemplate.mockResolvedValue(null);

      await mcpCommand.handler(mockContext, ['install', 'non-existent-server']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ MCP template \\'non-existent-server\\' not found')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Available servers: /mcp list')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Search for servers: /mcp search')
      );

      expect(mockSaveConfig).not.toHaveBeenCalled();
    });

    it('should handle invalid characters in server names', async () => {
      const invalidNames = [
        'server@invalid',
        'server with spaces',
        'server\\n',
        '../malicious-path',
        'server\\"quote',
      ];

      for (const invalidName of invalidNames) {
        mockConsoleLog.mockClear();
        mockGetMCPTemplate.mockResolvedValue(null);

        await mcpCommand.handler(mockContext, ['install', invalidName]);

        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('RED:❌ MCP template')
        );
        expect(mockSaveConfig).not.toHaveBeenCalled();
      }
    });
  });

  describe('Acceptance Criteria: Reinstall/Upgrade Scenarios Handled', () => {
    it('should detect already installed servers and warn user', async () => {
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
        expect.stringContaining('YELLOW:⚠️  Server \\'filesystem\\' already exists')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:Use "force" to overwrite:')
      );

      // Should not attempt to save config when server already exists
      expect(mockSaveConfig).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive duplicate detection', async () => {
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

      // Test with different cases
      const variations = ['FILESYSTEM', 'FileSystem', 'fileSYSTEM'];

      for (const variation of variations) {
        mockConsoleLog.mockClear();
        await mcpCommand.handler(mockContext, ['install', variation]);

        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('YELLOW:⚠️  Server')
        );
        expect(mockSaveConfig).not.toHaveBeenCalled();
      }
    });
  });

  describe('Acceptance Criteria: Successful Server Installation Creates Expected Files/Config', () => {
    it('should successfully process template and update configuration', async () => {
      mockGetMCPTemplate.mockResolvedValue(filesystemTemplate);
      mockGetMCPServers.mockReturnValue({});

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      // Verify config was updated and saved
      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];

      expect(savedConfig.mcp.enabled).toBe(true);
      expect(savedConfig.mcp.servers['filesystem']).toEqual(filesystemTemplate.config);

      // Verify success messages
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GREEN:✅ Successfully added MCP server')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Filesystem Server')
      );
    });

    it('should preserve existing config structure when adding server', async () => {
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

    it('should handle missing MCP section in config', async () => {
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

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error adding MCP server: Permission denied')
      );
    });

    it('should handle template loading failures gracefully', async () => {
      mockGetMCPTemplate.mockRejectedValue(new Error('Template service unavailable'));

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error adding MCP server: Template service unavailable')
      );
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle extremely long server names', async () => {
      const longName = 'a'.repeat(300);
      mockGetMCPTemplate.mockResolvedValue(null);

      await mcpCommand.handler(mockContext, ['install', longName]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(`RED:❌ MCP template '${longName}' not found`)
      );
    });

    it('should handle malformed template configurations', async () => {
      const malformedTemplate = {
        ...filesystemTemplate,
        config: {
          name: 'filesystem',
          // Missing required fields like type, command
        } as any,
      };

      mockGetMCPTemplate.mockResolvedValue(malformedTemplate);
      mockGetMCPServers.mockReturnValue({});

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      // Should still attempt to save the config (the CLI layer doesn't validate)
      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];
      expect(savedConfig.mcp.servers['filesystem']).toEqual(malformedTemplate.config);
    });

    it('should handle null/undefined template responses', async () => {
      mockGetMCPTemplate.mockResolvedValue(undefined as any);

      await mcpCommand.handler(mockContext, ['install', 'filesystem']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ MCP template \\'filesystem\\' not found')
      );
    });
  });

  describe('Version Specification (Basic CLI Behavior)', () => {
    it('should handle server names with version specifications', async () => {
      const versionedTemplate = {
        ...filesystemTemplate,
        id: 'filesystem@1.2.3',
      };

      mockGetMCPTemplate.mockImplementation(async (id: string) => {
        if (id === 'filesystem' || id === 'filesystem@1.2.3') {
          return versionedTemplate;
        }
        return null;
      });
      mockGetMCPServers.mockReturnValue({});

      await mcpCommand.handler(mockContext, ['install', 'filesystem@1.2.3']);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][1];
      expect(savedConfig.mcp.servers['filesystem@1.2.3']).toBeDefined();
    });

    it('should handle various version formats gracefully', async () => {
      const versionFormats = [
        'server@1.0.0',
        'server@^1.0.0',
        'server@~1.2.3',
        'server@latest',
        'server@beta',
      ];

      for (const versionFormat of versionFormats) {
        mockConsoleLog.mockClear();
        mockGetMCPTemplate.mockResolvedValue(null); // All will be "not found"

        await mcpCommand.handler(mockContext, ['install', versionFormat]);

        // Should attempt to lookup and show "not found" rather than crashing
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining(`RED:❌ MCP template '${versionFormat}' not found`)
        );
      }
    });
  });
});