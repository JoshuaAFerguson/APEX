/**
 * Comprehensive integration tests for MCP marketplace CLI commands
 * Tests the complete marketplace listing and installation flow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CliContext } from '../index.js';

// Mock dependencies
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadMCPTemplates: vi.fn(),
    getMCPTemplate: vi.fn(),
    getMCPServers: vi.fn(),
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
    validateMCPConfig: vi.fn(),
    listMCPServers: vi.fn(),
    getMCPRegistry: vi.fn(),
  };
});

vi.mock('@apexcli/orchestrator', () => ({
  ApexOrchestrator: vi.fn().mockImplementation(() => ({
    installMcpServer: vi.fn(),
    uninstallMcpServer: vi.fn(),
    listMcpInstallations: vi.fn(),
    getMcpServerStatus: vi.fn(),
  })),
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => `CYAN:${str}`,
    red: (str: string) => `RED:${str}`,
    green: (str: string) => `GREEN:${str}`,
    yellow: (str: string) => `YELLOW:${str}`,
    gray: (str: string) => `GRAY:${str}`,
    blue: (str: string) => `BLUE:${str}`,
    bold: (str: string) => `BOLD:${str}`,
    dim: (str: string) => `DIM:${str}`,
  },
}));

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

describe('MCP Marketplace CLI Commands Integration', () => {
  let mockContext: CliContext;
  let mockLoadMCPTemplates: any;
  let mockLoadConfig: any;
  let mockInquirerPrompt: any;
  let mockOrchestrator: any;

  const sampleMarketplaceServers = {
    filesystem: {
      id: 'filesystem',
      name: 'Filesystem Server',
      description: 'Secure filesystem access for MCP applications',
      package: '@modelcontextprotocol/server-filesystem',
      version: '1.0.0',
      verified: true,
      featured: true,
      config: {
        name: 'filesystem',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        autoStart: true,
      },
      capabilities: ['file:read', 'file:write', 'directory:list'],
      envVars: [],
      tags: ['filesystem', 'files'],
      author: 'Anthropic',
      license: 'MIT',
      repository: 'https://github.com/modelcontextprotocol/servers',
      documentationUrl: 'https://docs.modelcontextprotocol.io/servers/filesystem',
      installCount: 1200,
      rating: 4.8,
      reviewCount: 156,
      category: 'filesystem',
    },
    github: {
      id: 'github',
      name: 'GitHub Server',
      description: 'GitHub repository integration for MCP',
      package: '@modelcontextprotocol/server-github',
      version: '1.1.0',
      verified: true,
      featured: true,
      config: {
        name: 'github',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        autoStart: false,
      },
      capabilities: ['git:clone', 'git:commit', 'api:github'],
      envVars: [
        {
          name: 'GITHUB_ACCESS_TOKEN',
          description: 'GitHub personal access for repository operations',
          required: true,
        },
      ],
      tags: ['git', 'github', 'development', 'api'],
      author: 'Anthropic',
      license: 'MIT',
      repository: 'https://github.com/modelcontextprotocol/servers',
      documentationUrl: 'https://docs.modelcontextprotocol.io/servers/github',
      installCount: 980,
      rating: 4.7,
      reviewCount: 123,
      category: 'development',
    },
    postgres: {
      id: 'postgres',
      name: 'PostgreSQL Server',
      description: 'PostgreSQL database connectivity for MCP',
      package: '@modelcontextprotocol/server-postgres',
      version: '1.2.0',
      verified: false,
      featured: false,
      config: {
        name: 'postgres',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        autoStart: false,
      },
      capabilities: ['db:query', 'db:schema', 'sql:execute'],
      envVars: [
        {
          name: 'DATABASE_URL',
          description: 'PostgreSQL connection string',
          required: true,
        },
      ],
      tags: ['database', 'sql', 'postgres'],
      author: 'Community',
      license: 'MIT',
      repository: 'https://github.com/community/mcp-postgres',
      documentationUrl: 'https://docs.example.com/postgres-server',
      installCount: 450,
      rating: 4.2,
      reviewCount: 67,
      category: 'database',
    },
  };

  beforeEach(async () => {
    // Import mocked functions
    const {
      loadMCPTemplates,
      loadConfig,
    } = await import('@apexcli/core');
    const { ApexOrchestrator } = await import('@apexcli/orchestrator');
    const inquirer = await import('inquirer');

    mockLoadMCPTemplates = vi.mocked(loadMCPTemplates);
    mockLoadConfig = vi.mocked(loadConfig);
    mockInquirerPrompt = vi.mocked(inquirer.default.prompt);

    // Create mock orchestrator
    mockOrchestrator = new (vi.mocked(ApexOrchestrator))();

    mockContext = {
      cwd: '/test/project',
      initialized: true,
      config: {
        project: { name: 'Test Project', description: 'Test' },
        agents: {},
        workflows: {},
        limits: { maxTokens: 100000, maxCost: 10.0, timeoutMs: 300000 },
        autonomy: { level: 'medium', autoApprove: false },
        mcp: {
          enabled: true,
          servers: {
            filesystem: sampleMarketplaceServers.filesystem.config,
            github: sampleMarketplaceServers.github.config,
          },
        },
      },
      orchestrator: mockOrchestrator,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };

    // Setup default mock responses
    mockLoadMCPTemplates.mockResolvedValue(sampleMarketplaceServers);
    mockLoadConfig.mockResolvedValue(mockContext.config);
    mockOrchestrator.listMcpInstallations.mockResolvedValue([]);
    mockOrchestrator.installMcpServer.mockResolvedValue({
      name: 'test-server',
      type: 'stdio',
      command: 'test-command',
      autoStart: false,
    });
    mockOrchestrator.uninstallMcpServer.mockResolvedValue(undefined);

    mockConsoleLog.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('/mcp list command', () => {
    it('should list all marketplace servers with categories', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockLoadMCPTemplates).toHaveBeenCalled();

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      // Check header
      expect(allOutput).toContain('CYAN:\n📦 MCP Marketplace - Available Servers:\n');

      // Check featured servers section
      expect(allOutput).toContain('CYAN:✨ Featured Servers:');
      expect(allOutput).toContain('Filesystem Server');
      expect(allOutput).toContain('GitHub Server');

      // Check server details
      expect(allOutput).toContain('Secure filesystem access for MCP applications');
      expect(allOutput).toContain('GitHub repository integration for MCP');
      expect(allOutput).toContain('BLUE:verified');

      // Check install counts and ratings
      expect(allOutput).toContain('1200 installs');
      expect(allOutput).toContain('4.8★ (156 reviews)');
    });

    it('should show JSON output when --json flag is used', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list', '--json']);

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedOutput = JSON.parse(jsonOutput);

      expect(parsedOutput).toHaveProperty('servers');
      expect(parsedOutput.servers).toHaveProperty('filesystem');
      expect(parsedOutput.servers).toHaveProperty('github');
    });

    it('should handle empty marketplace gracefully', async () => {
      mockLoadMCPTemplates.mockResolvedValue({});

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('GRAY:No MCP servers found in marketplace.');
    });
  });

  describe('/mcp search command', () => {
    it('should search servers by name and description', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'filesystem']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      expect(allOutput).toContain('CYAN:\n🔍 Search Results for "filesystem":\n');
      expect(allOutput).toContain('Filesystem Server');
      expect(allOutput).toContain('file:read, file:write, directory:list');
    });

    it('should handle no search results', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['search', 'nonexistent-server']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('YELLOW:No MCP servers found matching "nonexistent-server"');
    });
  });

  describe('/mcp install command', () => {
    it('should install server with confirmation', async () => {
      mockInquirerPrompt.mockResolvedValue({ confirm: true });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['install', 'postgres']);

      expect(mockOrchestrator.installMcpServer).toHaveBeenCalledWith('postgres');

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('GREEN:✅ Successfully installed PostgreSQL Server');
    });

    it('should handle installation cancellation', async () => {
      mockInquirerPrompt.mockResolvedValue({ confirm: false });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['install', 'github']);

      expect(mockOrchestrator.installMcpServer).not.toHaveBeenCalled();

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('GRAY:Installation cancelled.');
    });

    it('should handle non-existent server', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['install', 'nonexistent-server']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('RED:❌ Server "nonexistent-server" not found in marketplace.');
    });
  });

  describe('/mcp uninstall command', () => {
    it('should uninstall server with confirmation', async () => {
      mockInquirerPrompt.mockResolvedValue({ confirm: true });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['uninstall', 'github']);

      expect(mockOrchestrator.uninstallMcpServer).toHaveBeenCalledWith('github');

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('GREEN:✅ Successfully uninstalled server "github"');
    });
  });

  describe('Error Handling', () => {
    it('should handle orchestrator initialization failure', async () => {
      mockContext.orchestrator = null;

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['install', 'filesystem']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('RED:❌ Orchestrator not initialized');
    });

    it('should handle marketplace loading errors', async () => {
      mockLoadMCPTemplates.mockRejectedValue(new Error('Marketplace unavailable'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('RED:❌ Error loading MCP marketplace');
    });
  });
});