/**
 * Tests for MCP marketplace installed command
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CliContext } from '../index.js';

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => `CYAN:${str}`,
    red: (str: string) => `RED:${str}`,
    green: (str: string) => `GREEN:${str}`,
    yellow: (str: string) => `YELLOW:${str}`,
    gray: (str: string) => `GRAY:${str}`,
  },
}));

// Mock MCP functions
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadConfig: vi.fn(),
  };
});

import { loadConfig } from '@apexcli/core';
import { commands } from '../index.js';

describe('MCP Installed Command', () => {
  let mockContext: CliContext;
  let mcpCommand: any;
  let mockLoadConfig: any;

  const configWithServers = {
    project: { name: 'test', description: 'test' },
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
        'github': {
          name: 'GitHub Server',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          autoStart: false,
        },
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();

    mockContext = {
      cwd: '/test',
      initialized: true,
    };

    mockLoadConfig = vi.mocked(loadConfig);
    mockLoadConfig.mockResolvedValue(configWithServers);

    mcpCommand = commands.find(cmd => cmd.name === 'mcp');
  });

  it('should list installed servers', async () => {
    await mcpCommand.handler(mockContext, ['installed']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('CYAN:📦 Installed MCP Servers:')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('YELLOW:Filesystem Server')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('YELLOW:GitHub Server')
    );
  });

  it('should show server details and status', async () => {
    await mcpCommand.handler(mockContext, ['installed']);

    // Check for auto-start status indicators
    const calls = mockConsoleLog.mock.calls.map(call => call[0]);
    const hasEnabledIndicator = calls.some(call => call.includes('GREEN:enabled'));
    const hasDisabledIndicator = calls.some(call => call.includes('RED:disabled'));

    expect(hasEnabledIndicator || hasDisabledIndicator).toBe(true);
  });

  it('should handle no installed servers', async () => {
    mockLoadConfig.mockResolvedValue({
      project: { name: 'test', description: 'test' },
      mcp: { enabled: true, servers: {} },
    });

    await mcpCommand.handler(mockContext, ['installed']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:No MCP servers are currently installed.')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:• Browse available servers: /mcp list')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:• Search for servers: /mcp search <query>')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:• Install a server: /mcp install <server-name>')
    );
  });

  it('should show MCP enabled status', async () => {
    await mcpCommand.handler(mockContext, ['installed']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:MCP Status:')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GREEN:enabled')
    );
  });

  it('should handle disabled MCP', async () => {
    mockLoadConfig.mockResolvedValue({
      ...configWithServers,
      mcp: {
        ...configWithServers.mcp,
        enabled: false,
      },
    });

    await mcpCommand.handler(mockContext, ['installed']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('RED:disabled')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('YELLOW:⚠️  MCP is disabled. Enable it with "/mcp init" to use installed servers.')
    );
  });

  it('should show management commands', async () => {
    await mcpCommand.handler(mockContext, ['installed']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:Management commands:')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:• Uninstall: /mcp uninstall <server-name>')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:• Validate config: /mcp validate')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:• Configure servers: edit .apex/config.yaml')
    );
  });

  it('should handle installed command errors', async () => {
    mockLoadConfig.mockRejectedValue(new Error('Config error'));

    await mcpCommand.handler(mockContext, ['installed']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('RED:❌ Error listing installed MCP servers: Config error')
    );
  });

  it('should show total count of servers', async () => {
    await mcpCommand.handler(mockContext, ['installed']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:Total: 2 servers installed')
    );
  });

  it('should handle single server correctly', async () => {
    mockLoadConfig.mockResolvedValue({
      project: { name: 'test', description: 'test' },
      mcp: {
        enabled: true,
        servers: {
          'single-server': {
            name: 'Single Server',
            type: 'stdio',
            command: 'single-command',
            args: [],
            autoStart: true,
          },
        },
      },
    });

    await mcpCommand.handler(mockContext, ['installed']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:Total: 1 server installed')
    );
  });

  it('should handle missing MCP config section', async () => {
    mockLoadConfig.mockResolvedValue({
      project: { name: 'test', description: 'test' },
    });

    await mcpCommand.handler(mockContext, ['installed']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:No MCP servers are currently installed.')
    );
  });

  it('should handle empty servers object', async () => {
    mockLoadConfig.mockResolvedValue({
      project: { name: 'test', description: 'test' },
      mcp: {
        enabled: true,
        servers: {},
      },
    });

    await mcpCommand.handler(mockContext, ['installed']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:No MCP servers are currently installed.')
    );
  });

  it('should handle null servers', async () => {
    mockLoadConfig.mockResolvedValue({
      project: { name: 'test', description: 'test' },
      mcp: {
        enabled: true,
        servers: null,
      },
    });

    await mcpCommand.handler(mockContext, ['installed']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:No MCP servers are currently installed.')
    );
  });

  it('should show servers in alphabetical order', async () => {
    mockLoadConfig.mockResolvedValue({
      project: { name: 'test', description: 'test' },
      mcp: {
        enabled: true,
        servers: {
          'zebra': {
            name: 'Zebra Server',
            type: 'stdio',
            command: 'zebra',
            args: [],
            autoStart: false,
          },
          'alpha': {
            name: 'Alpha Server',
            type: 'stdio',
            command: 'alpha',
            args: [],
            autoStart: true,
          },
        },
      },
    });

    await mcpCommand.handler(mockContext, ['installed']);

    const calls = mockConsoleLog.mock.calls.map(call => call[0]);
    const alphaIndex = calls.findIndex(call => call.includes('Alpha Server'));
    const zebraIndex = calls.findIndex(call => call.includes('Zebra Server'));

    expect(alphaIndex).toBeGreaterThan(-1);
    expect(zebraIndex).toBeGreaterThan(-1);
    expect(alphaIndex).toBeLessThan(zebraIndex);
  });
});