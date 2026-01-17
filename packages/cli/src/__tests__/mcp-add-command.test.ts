import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, saveConfig, initializeApex, getMCPTemplate } from '@apexcli/core';
import type { ApexConfig, MCPTemplate, MCPServerConfig } from '@apexcli/core';
import { commands } from '../index.js';
import type { CliContext } from '../index.js';

// Mock the core module functions
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
    initializeApex: vi.fn(),
    getMCPTemplate: vi.fn(),
    isApexInitialized: vi.fn(),
  };
});

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');
const mockConsoleError = vi.spyOn(console, 'error');

describe('mcp add command', () => {
  let mockTempDir: string;
  let mockContext: CliContext;
  let mcpCommand: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockConsoleLog.mockImplementation(() => {});
    mockConsoleError.mockImplementation(() => {});

    // Create temporary directory for testing
    mockTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-cli-test-'));

    // Setup mock context
    mockContext = {
      cwd: mockTempDir,
      initialized: true,
      config: null,
      orchestrator: null,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };

    // Find the mcp command
    mcpCommand = commands.find(cmd => cmd.name === 'mcp');
    expect(mcpCommand).toBeDefined();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    // Clean up temp directory
    await fs.rm(mockTempDir, { recursive: true, force: true });
  });

  describe('mcp add subcommand', () => {
    it('should successfully add a valid MCP server to config', async () => {
      const mockTemplate: MCPTemplate = {
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

      const mockConfig: ApexConfig = {
        mcp: {
          servers: {},
        },
        agents: {},
        workflows: {},
        autonomyLevel: 'manual',
        budgets: {
          maxCostPerTask: 10,
          maxTokensPerTask: 100000,
        },
      };

      const expectedConfig: ApexConfig = {
        ...mockConfig,
        mcp: {
          servers: {
            filesystem: mockTemplate.config,
          },
        },
      };

      vi.mocked(getMCPTemplate).mockResolvedValue(mockTemplate);
      vi.mocked(loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(saveConfig).mockResolvedValue();

      await mcpCommand.handler(mockContext, ['add', 'filesystem']);

      expect(getMCPTemplate).toHaveBeenCalledWith('filesystem');
      expect(loadConfig).toHaveBeenCalledWith(mockTempDir);
      expect(saveConfig).toHaveBeenCalledWith(mockTempDir, expectedConfig);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ Successfully added MCP server')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('filesystem')
      );
    });

    it('should add server to existing mcp.servers config', async () => {
      const mockTemplate: MCPTemplate = {
        id: 'github',
        name: 'GitHub Server',
        description: 'MCP server for GitHub integration',
        package: '@modelcontextprotocol/server-github',
        config: {
          name: 'github',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
        },
        capabilities: ['github', 'api'],
        verified: true,
        defaultEnabled: false,
      };

      const mockConfig: ApexConfig = {
        mcp: {
          servers: {
            filesystem: {
              name: 'filesystem',
              type: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem'],
            },
          },
        },
        agents: {},
        workflows: {},
        autonomyLevel: 'manual',
        budgets: {
          maxCostPerTask: 10,
          maxTokensPerTask: 100000,
        },
      };

      const expectedConfig: ApexConfig = {
        ...mockConfig,
        mcp: {
          servers: {
            filesystem: mockConfig.mcp!.servers!.filesystem,
            github: mockTemplate.config,
          },
        },
      };

      vi.mocked(getMCPTemplate).mockResolvedValue(mockTemplate);
      vi.mocked(loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(saveConfig).mockResolvedValue();

      await mcpCommand.handler(mockContext, ['add', 'github']);

      expect(saveConfig).toHaveBeenCalledWith(mockTempDir, expectedConfig);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ Successfully added MCP server')
      );
    });

    it('should handle config with no mcp section', async () => {
      const mockTemplate: MCPTemplate = {
        id: 'postgres',
        name: 'PostgreSQL Server',
        description: 'MCP server for PostgreSQL database access',
        package: '@modelcontextprotocol/server-postgres',
        config: {
          name: 'postgres',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-postgres'],
        },
        capabilities: ['database', 'sql'],
        verified: true,
        defaultEnabled: false,
      };

      const mockConfig: ApexConfig = {
        agents: {},
        workflows: {},
        autonomyLevel: 'manual',
        budgets: {
          maxCostPerTask: 10,
          maxTokensPerTask: 100000,
        },
      };

      const expectedConfig: ApexConfig = {
        ...mockConfig,
        mcp: {
          servers: {
            postgres: mockTemplate.config,
          },
        },
      };

      vi.mocked(getMCPTemplate).mockResolvedValue(mockTemplate);
      vi.mocked(loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(saveConfig).mockResolvedValue();

      await mcpCommand.handler(mockContext, ['add', 'postgres']);

      expect(saveConfig).toHaveBeenCalledWith(mockTempDir, expectedConfig);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ Successfully added MCP server')
      );
    });

    it('should show error when server name is not provided', async () => {
      await mcpCommand.handler(mockContext, ['add']);

      expect(getMCPTemplate).not.toHaveBeenCalled();
      expect(loadConfig).not.toHaveBeenCalled();
      expect(saveConfig).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: Server name is required')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /mcp add <server-name>')
      );
    });

    it('should show error when template is not found', async () => {
      vi.mocked(getMCPTemplate).mockResolvedValue(null);

      await mcpCommand.handler(mockContext, ['add', 'nonexistent']);

      expect(getMCPTemplate).toHaveBeenCalledWith('nonexistent');
      expect(loadConfig).not.toHaveBeenCalled();
      expect(saveConfig).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("❌ Error: Template 'nonexistent' not found")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Available templates: /mcp list')
      );
    });

    it('should handle getMCPTemplate throwing an error', async () => {
      const error = new Error('Failed to load templates');
      vi.mocked(getMCPTemplate).mockRejectedValue(error);

      await mcpCommand.handler(mockContext, ['add', 'filesystem']);

      expect(getMCPTemplate).toHaveBeenCalledWith('filesystem');
      expect(loadConfig).not.toHaveBeenCalled();
      expect(saveConfig).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error adding MCP server: Failed to load templates')
      );
    });

    it('should handle loadConfig throwing an error', async () => {
      const mockTemplate: MCPTemplate = {
        id: 'filesystem',
        name: 'Filesystem Server',
        description: 'Test template',
        package: '@test/package',
        config: {
          name: 'filesystem',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@test/package'],
        },
        capabilities: ['filesystem'],
        verified: true,
        defaultEnabled: true,
      };

      const error = new Error('Failed to load config');
      vi.mocked(getMCPTemplate).mockResolvedValue(mockTemplate);
      vi.mocked(loadConfig).mockRejectedValue(error);

      await mcpCommand.handler(mockContext, ['add', 'filesystem']);

      expect(getMCPTemplate).toHaveBeenCalledWith('filesystem');
      expect(loadConfig).toHaveBeenCalledWith(mockTempDir);
      expect(saveConfig).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error adding MCP server: Failed to load config')
      );
    });

    it('should handle saveConfig throwing an error', async () => {
      const mockTemplate: MCPTemplate = {
        id: 'filesystem',
        name: 'Filesystem Server',
        description: 'Test template',
        package: '@test/package',
        config: {
          name: 'filesystem',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@test/package'],
        },
        capabilities: ['filesystem'],
        verified: true,
        defaultEnabled: true,
      };

      const mockConfig: ApexConfig = {
        agents: {},
        workflows: {},
        autonomyLevel: 'manual',
        budgets: {
          maxCostPerTask: 10,
          maxTokensPerTask: 100000,
        },
      };

      const error = new Error('Failed to save config');
      vi.mocked(getMCPTemplate).mockResolvedValue(mockTemplate);
      vi.mocked(loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(saveConfig).mockRejectedValue(error);

      await mcpCommand.handler(mockContext, ['add', 'filesystem']);

      expect(getMCPTemplate).toHaveBeenCalledWith('filesystem');
      expect(loadConfig).toHaveBeenCalledWith(mockTempDir);
      expect(saveConfig).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error adding MCP server: Failed to save config')
      );
    });

    it('should warn when server already exists in config', async () => {
      const mockTemplate: MCPTemplate = {
        id: 'filesystem',
        name: 'Filesystem Server',
        description: 'Test template',
        package: '@test/package',
        config: {
          name: 'filesystem',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@test/package'],
        },
        capabilities: ['filesystem'],
        verified: true,
        defaultEnabled: true,
      };

      const mockConfig: ApexConfig = {
        mcp: {
          servers: {
            filesystem: {
              name: 'filesystem',
              type: 'stdio',
              command: 'existing-command',
              args: ['existing-args'],
            },
          },
        },
        agents: {},
        workflows: {},
        autonomyLevel: 'manual',
        budgets: {
          maxCostPerTask: 10,
          maxTokensPerTask: 100000,
        },
      };

      const expectedConfig: ApexConfig = {
        ...mockConfig,
        mcp: {
          servers: {
            filesystem: mockTemplate.config,
          },
        },
      };

      vi.mocked(getMCPTemplate).mockResolvedValue(mockTemplate);
      vi.mocked(loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(saveConfig).mockResolvedValue();

      await mcpCommand.handler(mockContext, ['add', 'filesystem']);

      expect(saveConfig).toHaveBeenCalledWith(mockTempDir, expectedConfig);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Warning: Server')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('filesystem')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('already exists')
      );
    });

    it('should display template documentation URL when available', async () => {
      const mockTemplate: MCPTemplate = {
        id: 'filesystem',
        name: 'Filesystem Server',
        description: 'Test template',
        package: '@test/package',
        documentationUrl: 'https://example.com/docs',
        config: {
          name: 'filesystem',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@test/package'],
        },
        capabilities: ['filesystem'],
        verified: true,
        defaultEnabled: true,
      };

      const mockConfig: ApexConfig = {
        agents: {},
        workflows: {},
        autonomyLevel: 'manual',
        budgets: {
          maxCostPerTask: 10,
          maxTokensPerTask: 100000,
        },
      };

      vi.mocked(getMCPTemplate).mockResolvedValue(mockTemplate);
      vi.mocked(loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(saveConfig).mockResolvedValue();

      await mcpCommand.handler(mockContext, ['add', 'filesystem']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Documentation: https://example.com/docs')
      );
    });

    it('should handle template with complex configuration', async () => {
      const complexConfig: MCPServerConfig = {
        name: 'complex',
        type: 'stdio',
        command: 'node',
        args: ['server.js', '--port', '3000'],
        autoStart: false,
        env: {
          NODE_ENV: 'production',
          DEBUG: '1',
        },
      };

      const mockTemplate: MCPTemplate = {
        id: 'complex',
        name: 'Complex Server',
        description: 'A complex MCP server configuration',
        package: '@test/complex',
        config: complexConfig,
        capabilities: ['api', 'database'],
        verified: true,
        defaultEnabled: false,
        category: 'database',
        tags: ['sql', 'database'],
        minVersion: '2.0.0',
      };

      const mockConfig: ApexConfig = {
        agents: {},
        workflows: {},
        autonomyLevel: 'manual',
        budgets: {
          maxCostPerTask: 10,
          maxTokensPerTask: 100000,
        },
      };

      const expectedConfig: ApexConfig = {
        ...mockConfig,
        mcp: {
          servers: {
            complex: complexConfig,
          },
        },
      };

      vi.mocked(getMCPTemplate).mockResolvedValue(mockTemplate);
      vi.mocked(loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(saveConfig).mockResolvedValue();

      await mcpCommand.handler(mockContext, ['add', 'complex']);

      expect(saveConfig).toHaveBeenCalledWith(mockTempDir, expectedConfig);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ Successfully added MCP server')
      );
    });

    it('should handle empty server name argument', async () => {
      await mcpCommand.handler(mockContext, ['add', '']);

      expect(getMCPTemplate).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: Server name is required')
      );
    });

    it('should handle multiple add operations in sequence', async () => {
      const templates: MCPTemplate[] = [
        {
          id: 'server1',
          name: 'Server 1',
          description: 'First server',
          package: '@test/server1',
          config: { name: 'server1', type: 'stdio', command: 'npx', args: ['@test/server1'] },
          capabilities: ['test'],
          verified: true,
          defaultEnabled: true,
        },
        {
          id: 'server2',
          name: 'Server 2',
          description: 'Second server',
          package: '@test/server2',
          config: { name: 'server2', type: 'stdio', command: 'npx', args: ['@test/server2'] },
          capabilities: ['test'],
          verified: true,
          defaultEnabled: true,
        },
      ];

      let currentConfig: ApexConfig = {
        agents: {},
        workflows: {},
        autonomyLevel: 'manual',
        budgets: {
          maxCostPerTask: 10,
          maxTokensPerTask: 100000,
        },
      };

      // First add
      vi.mocked(getMCPTemplate).mockResolvedValueOnce(templates[0]);
      vi.mocked(loadConfig).mockResolvedValueOnce(currentConfig);
      vi.mocked(saveConfig).mockResolvedValueOnce();

      await mcpCommand.handler(mockContext, ['add', 'server1']);

      // Second add
      currentConfig = {
        ...currentConfig,
        mcp: {
          servers: {
            server1: templates[0].config,
          },
        },
      };

      vi.mocked(getMCPTemplate).mockResolvedValueOnce(templates[1]);
      vi.mocked(loadConfig).mockResolvedValueOnce(currentConfig);
      vi.mocked(saveConfig).mockResolvedValueOnce();

      await mcpCommand.handler(mockContext, ['add', 'server2']);

      expect(vi.mocked(saveConfig)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(saveConfig)).toHaveBeenLastCalledWith(mockTempDir, {
        ...currentConfig,
        mcp: {
          servers: {
            server1: templates[0].config,
            server2: templates[1].config,
          },
        },
      });
    });
  });

  describe('command validation', () => {
    it('should have correct command metadata', () => {
      expect(mcpCommand.name).toBe('mcp');
      expect(mcpCommand.aliases).toEqual([]);
      expect(mcpCommand.description).toContain('Manage MCP');
      expect(mcpCommand.usage).toContain('/mcp add <server-name>');
    });

    it('should handle unknown subcommands', async () => {
      await mcpCommand.handler(mockContext, ['unknown-subcommand']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Unknown subcommand: unknown-subcommand')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /mcp list | /mcp add <server-name>')
      );
    });

    it('should default to list when no subcommand provided', async () => {
      // Mock loadMCPTemplates for the list functionality
      const mockLoadMCPTemplates = vi.fn().mockResolvedValue({});
      vi.doMock('@apexcli/core', () => ({
        loadMCPTemplates: mockLoadMCPTemplates,
      }));

      await mcpCommand.handler(mockContext, []);

      // Should not call getMCPTemplate (which is used for add)
      expect(getMCPTemplate).not.toHaveBeenCalled();
      expect(loadConfig).not.toHaveBeenCalled();
      expect(saveConfig).not.toHaveBeenCalled();
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle server name with special characters', async () => {
      const serverName = 'server-with_special.chars';
      const mockTemplate: MCPTemplate = {
        id: serverName,
        name: 'Special Server',
        description: 'Server with special chars',
        package: '@test/special',
        config: {
          name: serverName,
          type: 'stdio',
          command: 'npx',
          args: ['@test/special'],
        },
        capabilities: ['test'],
        verified: true,
        defaultEnabled: true,
      };

      const mockConfig: ApexConfig = {
        agents: {},
        workflows: {},
        autonomyLevel: 'manual',
        budgets: {
          maxCostPerTask: 10,
          maxTokensPerTask: 100000,
        },
      };

      vi.mocked(getMCPTemplate).mockResolvedValue(mockTemplate);
      vi.mocked(loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(saveConfig).mockResolvedValue();

      await mcpCommand.handler(mockContext, ['add', serverName]);

      expect(getMCPTemplate).toHaveBeenCalledWith(serverName);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ Successfully added MCP server')
      );
    });

    it('should handle very long server names', async () => {
      const longServerName = 'a'.repeat(100);
      vi.mocked(getMCPTemplate).mockResolvedValue(null);

      await mcpCommand.handler(mockContext, ['add', longServerName]);

      expect(getMCPTemplate).toHaveBeenCalledWith(longServerName);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("❌ Error: Template 'aaaaaaaaaa")
      );
    });

    it('should handle template with minimal required fields only', async () => {
      const minimalTemplate: MCPTemplate = {
        id: 'minimal',
        name: 'Minimal Server',
        description: 'Minimal server config',
        package: '@test/minimal',
        config: {
          name: 'minimal',
          type: 'stdio',
          command: 'minimal',
        },
        capabilities: [],
        verified: false,
        defaultEnabled: false,
      };

      const mockConfig: ApexConfig = {
        agents: {},
        workflows: {},
        autonomyLevel: 'manual',
        budgets: {
          maxCostPerTask: 10,
          maxTokensPerTask: 100000,
        },
      };

      vi.mocked(getMCPTemplate).mockResolvedValue(minimalTemplate);
      vi.mocked(loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(saveConfig).mockResolvedValue();

      await mcpCommand.handler(mockContext, ['add', 'minimal']);

      expect(saveConfig).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ Successfully added MCP server')
      );
    });
  });
});