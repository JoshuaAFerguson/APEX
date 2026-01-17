/**
 * @fileoverview End-to-end integration tests for MCP command workflow
 *
 * Tests the complete MCP command suite integration including:
 * - Full workflow: init -> add -> validate -> list
 * - Error handling across command boundaries
 * - State management between commands
 * - Configuration persistence
 * - User experience consistency
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import inquirer from 'inquirer';
import type { CliContext } from '../index.js';
import type { MCPTemplate, ApexConfig } from '@apexcli/core';

// Mock dependencies
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

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadMCPTemplates: vi.fn(),
    getMCPTemplate: vi.fn(),
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
    validateMCPConfig: vi.fn(),
  };
});

const mockConsoleLog = vi.spyOn(console, 'log');

describe('MCP Workflow Integration Tests', () => {
  let tempDir: string;
  let mockContext: CliContext;
  let mockLoadMCPTemplates: any;
  let mockGetMCPTemplate: any;
  let mockLoadConfig: any;
  let mockSaveConfig: any;
  let mockValidateMCPConfig: any;
  let mockInquirerPrompt: any;

  const sampleTemplates: Record<string, MCPTemplate> = {
    filesystem: {
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
      documentationUrl: 'https://modelcontextprotocol.io/servers/filesystem',
    },
    github: {
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
      envVars: [
        {
          name: 'GITHUB_TOKEN',
          description: 'GitHub personal access token',
          required: true,
          sensitive: true,
        },
      ],
      capabilities: ['git', 'api'],
      verified: true,
      defaultEnabled: false,
    },
    postgres: {
      id: 'postgres',
      name: 'PostgreSQL Server',
      description: 'MCP server for PostgreSQL database operations',
      package: '@modelcontextprotocol/server-postgres',
      config: {
        name: 'postgres',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        autoStart: false,
      },
      envVars: [
        {
          name: 'POSTGRES_CONNECTION_STRING',
          description: 'PostgreSQL connection string',
          required: true,
          sensitive: true,
        },
      ],
      capabilities: ['database', 'sql'],
      verified: false,
      defaultEnabled: false,
    },
  };

  const baseConfig: ApexConfig = {
    project: {
      name: 'Test Project',
      description: 'Integration test project',
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
  };

  beforeEach(async () => {
    // Create temporary directory for test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-mcp-integration-'));

    mockContext = {
      cwd: tempDir,
      initialized: true,
      config: baseConfig,
    } as CliContext;

    // Get mocked functions
    const coreModule = await import('@apexcli/core');
    mockLoadMCPTemplates = vi.mocked(coreModule.loadMCPTemplates);
    mockGetMCPTemplate = vi.mocked(coreModule.getMCPTemplate);
    mockLoadConfig = vi.mocked(coreModule.loadConfig);
    mockSaveConfig = vi.mocked(coreModule.saveConfig);
    mockValidateMCPConfig = vi.mocked(coreModule.validateMCPConfig);
    mockInquirerPrompt = vi.mocked(inquirer.prompt);

    // Clear all mocks
    vi.clearAllMocks();
    mockConsoleLog.mockClear();

    // Set default implementations
    mockLoadMCPTemplates.mockResolvedValue(sampleTemplates);
    mockSaveConfig.mockResolvedValue(undefined);
    mockValidateMCPConfig.mockResolvedValue({
      isValid: true,
      issues: [],
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
    });
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    vi.restoreAllMocks();
  });

  describe('Complete MCP Setup and Management Workflow', () => {
    it('should complete full workflow: init -> add -> validate -> list', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      if (!mcpCommand) {
        throw new Error('MCP command not found');
      }

      // Simulate state progression through commands
      let currentConfig = { ...baseConfig };

      // Step 1: mcp init - enable MCP and add filesystem server
      mockLoadConfig.mockResolvedValue(currentConfig);
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['filesystem'] });

      await mcpCommand.handler(mockContext, ['init']);

      // Verify init completed successfully
      expect(mockSaveConfig).toHaveBeenCalledWith(tempDir, expect.objectContaining({
        mcp: expect.objectContaining({
          enabled: true,
          servers: expect.objectContaining({
            filesystem: expect.objectContaining({
              name: 'Filesystem Server',
              autoStart: true,
            })
          })
        })
      }));

      // Update current config to reflect saved state
      currentConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            filesystem: {
              name: 'Filesystem Server',
              type: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem'],
              autoStart: true,
              capabilities: ['filesystem', 'read', 'write'],
            }
          }
        }
      };

      // Step 2: mcp add github - add another server
      mockConsoleLog.mockClear();
      mockLoadConfig.mockResolvedValue(currentConfig);
      mockGetMCPTemplate.mockResolvedValue(sampleTemplates.github);

      await mcpCommand.handler(mockContext, ['add', 'github']);

      // Verify add completed successfully
      expect(mockSaveConfig).toHaveBeenCalledWith(tempDir, expect.objectContaining({
        mcp: expect.objectContaining({
          servers: expect.objectContaining({
            filesystem: expect.anything(),
            github: expect.objectContaining({
              name: 'GitHub Server',
              autoStart: false,
            })
          })
        })
      }));

      // Update config to include github server
      currentConfig.mcp!.servers.github = {
        name: 'GitHub Server',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        autoStart: false,
        capabilities: ['git', 'api'],
        envVars: [
          {
            name: 'GITHUB_TOKEN',
            description: 'GitHub personal access token',
            required: true,
            sensitive: true,
            value: undefined,
          }
        ]
      };

      // Step 3: mcp validate - ensure configuration is valid
      mockConsoleLog.mockClear();
      mockLoadConfig.mockResolvedValue(currentConfig);

      await mcpCommand.handler(mockContext, ['validate']);

      // Verify validation was called with correct config
      expect(mockValidateMCPConfig).toHaveBeenCalledWith(currentConfig.mcp, {
        checkEnvironmentVars: true,
        checkCommandExistence: true,
        validateConnectionConfig: true,
        baseDirectory: tempDir,
      });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('CYAN:🔍 Validating MCP configuration...')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GREEN:✅ MCP configuration is valid!')
      );

      // Step 4: mcp list - show available templates
      mockConsoleLog.mockClear();

      await mcpCommand.handler(mockContext, ['list']);

      // Verify list shows all templates
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('CYAN:📦 Available MCP Server Templates:')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Filesystem Server')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GitHub Server')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('PostgreSQL Server')
      );
    });

    it('should handle workflow with validation errors and recovery', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp')!;

      // Step 1: Initialize with filesystem server
      let currentConfig = { ...baseConfig };
      mockLoadConfig.mockResolvedValue(currentConfig);
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['filesystem'] });

      await mcpCommand.handler(mockContext, ['init']);

      currentConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            filesystem: {
              name: 'Filesystem Server',
              type: 'stdio',
              // Missing command - will cause validation error
              args: ['-y', '@modelcontextprotocol/server-filesystem'],
            }
          }
        }
      };

      // Step 2: Validation should detect missing command
      mockConsoleLog.mockClear();
      mockLoadConfig.mockResolvedValue(currentConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: false,
        issues: [
          {
            code: 'MISSING_COMMAND',
            message: 'Server \'filesystem\' is missing required \'command\' field',
            severity: 'error' as const,
            path: 'servers.filesystem.command',
            suggestion: 'Specify the command to execute the MCP server',
          }
        ],
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
      });

      await mcpCommand.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ MCP configuration has validation errors')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:🚨 Errors (1):')
      );

      // Step 3: Fix the issue by re-adding the server correctly
      mockConsoleLog.mockClear();
      mockGetMCPTemplate.mockResolvedValue(sampleTemplates.filesystem);

      // Simulate user removing and re-adding the server
      currentConfig.mcp!.servers = {};
      mockLoadConfig.mockResolvedValue(currentConfig);

      await mcpCommand.handler(mockContext, ['add', 'filesystem']);

      // Step 4: Validation should now pass
      mockConsoleLog.mockClear();
      currentConfig.mcp!.servers.filesystem = {
        name: 'Filesystem Server',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        autoStart: true,
        capabilities: ['filesystem', 'read', 'write'],
      };
      mockLoadConfig.mockResolvedValue(currentConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });

      await mcpCommand.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GREEN:✅ MCP configuration is valid!')
      );
    });
  });

  describe('State Persistence and Configuration Management', () => {
    it('should maintain configuration state across multiple command invocations', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp')!;

      // Track configuration changes through a mock file system
      const configHistory: any[] = [];
      mockSaveConfig.mockImplementation((cwd, config) => {
        configHistory.push(JSON.parse(JSON.stringify(config)));
        return Promise.resolve();
      });

      // Start with empty config
      let currentConfig = { ...baseConfig };
      mockLoadConfig.mockResolvedValue(currentConfig);

      // Initialize with no servers selected
      mockInquirerPrompt
        .mockResolvedValueOnce({ enableMCP: true })
        .mockResolvedValueOnce({ selectedServers: ['none'] });

      await mcpCommand.handler(mockContext, ['init']);

      expect(configHistory[0]).toMatchObject({
        mcp: { enabled: true, servers: {} }
      });

      // Add filesystem server
      currentConfig = configHistory[configHistory.length - 1];
      mockLoadConfig.mockResolvedValue(currentConfig);
      mockGetMCPTemplate.mockResolvedValue(sampleTemplates.filesystem);

      await mcpCommand.handler(mockContext, ['add', 'filesystem']);

      expect(configHistory[1]).toMatchObject({
        mcp: {
          enabled: true,
          servers: {
            filesystem: expect.objectContaining({
              name: 'Filesystem Server'
            })
          }
        }
      });

      // Add github server
      currentConfig = configHistory[configHistory.length - 1];
      mockLoadConfig.mockResolvedValue(currentConfig);
      mockGetMCPTemplate.mockResolvedValue(sampleTemplates.github);

      await mcpCommand.handler(mockContext, ['add', 'github']);

      expect(configHistory[2]).toMatchObject({
        mcp: {
          enabled: true,
          servers: {
            filesystem: expect.objectContaining({
              name: 'Filesystem Server'
            }),
            github: expect.objectContaining({
              name: 'GitHub Server'
            })
          }
        }
      });

      // Verify filesystem server config was preserved
      expect(configHistory[2].mcp.servers.filesystem).toEqual(
        configHistory[1].mcp.servers.filesystem
      );
    });

    it('should handle concurrent access patterns correctly', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp')!;

      // Simulate two different processes accessing the same config
      const baseConfigState = {
        ...baseConfig,
        mcp: { enabled: true, servers: {} }
      };

      mockLoadConfig.mockResolvedValue(baseConfigState);
      mockGetMCPTemplate.mockImplementation((templateId) => {
        return Promise.resolve(sampleTemplates[templateId] || null);
      });

      // Simulate rapid sequential commands
      const results = await Promise.all([
        mcpCommand.handler(mockContext, ['add', 'filesystem']),
        mcpCommand.handler(mockContext, ['list']),
        mcpCommand.handler(mockContext, ['add', 'github'])
      ]);

      // All commands should complete without error
      expect(mockSaveConfig).toHaveBeenCalledTimes(2); // Two add operations
      expect(mockLoadMCPTemplates).toHaveBeenCalled(); // List operation
    });
  });

  describe('Error Propagation and Recovery', () => {
    it('should handle template loading failure gracefully across workflow', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp')!;

      // Step 1: Init should handle template loading failure
      mockLoadConfig.mockResolvedValue(baseConfig);
      mockInquirerPrompt.mockResolvedValue({ enableMCP: true });
      mockLoadMCPTemplates.mockRejectedValue(new Error('Network error'));

      await mcpCommand.handler(mockContext, ['init']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error during MCP setup: Network error')
      );

      // Step 2: List should also handle template loading failure
      mockConsoleLog.mockClear();

      await mcpCommand.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error loading MCP templates: Network error')
      );

      // Step 3: Add should handle individual template loading failure
      mockConsoleLog.mockClear();
      const configWithMCP = { ...baseConfig, mcp: { enabled: true, servers: {} } };
      mockLoadConfig.mockResolvedValue(configWithMCP);
      mockGetMCPTemplate.mockRejectedValue(new Error('Template not found'));

      await mcpCommand.handler(mockContext, ['add', 'nonexistent']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error adding MCP server: Template not found')
      );
    });

    it('should handle configuration file corruption and recovery', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp')!;

      // Simulate corrupted config file
      mockLoadConfig.mockRejectedValue(new Error('YAML parse error: Invalid syntax'));

      await mcpCommand.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error validating MCP configuration: YAML parse error: Invalid syntax')
      );

      // Recovery attempt should work once config is fixed
      mockConsoleLog.mockClear();
      mockLoadConfig.mockResolvedValue({
        ...baseConfig,
        mcp: { enabled: true, servers: {} }
      });

      await mcpCommand.handler(mockContext, ['validate']);

      expect(mockValidateMCPConfig).toHaveBeenCalled();
    });
  });

  describe('User Experience Consistency', () => {
    it('should maintain consistent output formatting across all commands', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp')!;

      const configWithServers = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {
            filesystem: {
              name: 'Filesystem Server',
              type: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem'],
            }
          }
        }
      };

      // Test that all commands use consistent emoji and color patterns
      const testCommands = [
        { subcommand: ['list'], expectPattern: 'CYAN:📦' },
        { subcommand: ['validate'], expectPattern: 'CYAN:🔍' },
      ];

      mockLoadConfig.mockResolvedValue(configWithServers);

      for (const { subcommand, expectPattern } of testCommands) {
        mockConsoleLog.mockClear();
        await mcpCommand.handler(mockContext, subcommand);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join(' ');
        expect(output).toContain(expectPattern);
      }
    });

    it('should provide helpful guidance across different error scenarios', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp')!;

      const testScenarios = [
        {
          command: ['add'],
          expectedGuidance: 'Usage: /mcp add <server-name>'
        },
        {
          command: ['add', 'nonexistent'],
          setup: () => mockGetMCPTemplate.mockResolvedValue(null),
          expectedGuidance: 'Run "/mcp list" to see available templates'
        },
        {
          command: ['unknown'],
          expectedGuidance: 'Usage: /mcp init | /mcp list | /mcp add <server-name> | /mcp validate'
        },
      ];

      for (const scenario of testScenarios) {
        mockConsoleLog.mockClear();
        if (scenario.setup) scenario.setup();

        await mcpCommand.handler(mockContext, scenario.command);

        const output = mockConsoleLog.mock.calls.map(call => call[0]).join(' ');
        expect(output).toContain(scenario.expectedGuidance);
      }
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle large numbers of templates efficiently', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp')!;

      // Create 100 templates
      const manyTemplates: Record<string, MCPTemplate> = {};
      for (let i = 0; i < 100; i++) {
        manyTemplates[`template${i}`] = {
          id: `template${i}`,
          name: `Template ${i}`,
          description: `Description for template ${i}`,
          package: `@test/template${i}`,
          config: { name: `template${i}`, command: 'node', args: ['server.js'] },
          capabilities: [`cap${i}`],
          verified: i % 2 === 0,
          defaultEnabled: false,
        };
      }

      mockLoadMCPTemplates.mockResolvedValue(manyTemplates);

      const startTime = performance.now();
      await mcpCommand.handler(mockContext, ['list']);
      const endTime = performance.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000);

      // Should display count
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join(' ');
      expect(output).toContain('Total: 100 templates available');
    });

    it('should handle memory efficiently during repeated operations', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp')!;

      // Perform many list operations
      for (let i = 0; i < 50; i++) {
        mockConsoleLog.mockClear();
        await mcpCommand.handler(mockContext, ['list']);
      }

      // Should complete without memory issues
      expect(mockLoadMCPTemplates).toHaveBeenCalledTimes(50);
    });
  });
});