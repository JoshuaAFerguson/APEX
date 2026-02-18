/**
 * Tests for MCP marketplace uninstall command
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

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

// Mock MCP functions
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
  };
});

import inquirer from 'inquirer';
import { loadConfig, saveConfig } from '@apexcli/core';
import { commands } from '../index.js';

describe('MCP Uninstall Command', () => {
  let mockContext: CliContext;
  let mcpCommand: any;
  let mockLoadConfig: any;
  let mockSaveConfig: any;
  let mockInquirerPrompt: any;

  const configWithServers = {
    project: { name: 'test', description: 'test' },
    mcp: {
      enabled: true,
      servers: {
        'test-server': {
          name: 'Test Server',
          type: 'stdio',
          command: 'test-command',
          args: ['--test'],
          autoStart: true,
        },
        'another-server': {
          name: 'Another Server',
          type: 'stdio',
          command: 'another-command',
          args: [],
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
    mockSaveConfig = vi.mocked(saveConfig);
    mockInquirerPrompt = vi.mocked(inquirer.prompt);

    mockLoadConfig.mockResolvedValue(configWithServers);
    mockSaveConfig.mockResolvedValue(undefined);

    mcpCommand = commands.find(cmd => cmd.name === 'mcp');
  });

  it('should uninstall a server after confirmation', async () => {
    mockInquirerPrompt.mockResolvedValue({ confirm: true });

    await mcpCommand.handler(mockContext, ['uninstall', 'test-server']);

    expect(mockInquirerPrompt).toHaveBeenCalledWith([{
      type: 'confirm',
      name: 'confirm',
      message: "Are you sure you want to uninstall 'Test Server' (test-server)?",
      default: false,
    }]);

    expect(mockSaveConfig).toHaveBeenCalled();
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GREEN:✅ Successfully uninstalled MCP server \'Test Server\' (test-server)')
    );
  });

  it('should cancel uninstall when not confirmed', async () => {
    mockInquirerPrompt.mockResolvedValue({ confirm: false });

    await mcpCommand.handler(mockContext, ['uninstall', 'test-server']);

    expect(mockSaveConfig).not.toHaveBeenCalled();
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('YELLOW:❌ Uninstallation cancelled')
    );
  });

  it('should find server by name instead of ID', async () => {
    mockInquirerPrompt.mockResolvedValue({ confirm: true });

    await mcpCommand.handler(mockContext, ['uninstall', 'Another Server']);

    expect(mockInquirerPrompt).toHaveBeenCalledWith([{
      type: 'confirm',
      name: 'confirm',
      message: "Are you sure you want to uninstall 'Another Server' (another-server)?",
      default: false,
    }]);

    expect(mockSaveConfig).toHaveBeenCalled();
  });

  it('should require server name', async () => {
    await mcpCommand.handler(mockContext, ['uninstall']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('RED:❌ Error: Server name is required')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:Usage: /mcp uninstall <server-name>')
    );
  });

  it('should handle non-existent server', async () => {
    await mcpCommand.handler(mockContext, ['uninstall', 'nonexistent']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('RED:❌ MCP server \'nonexistent\' is not installed')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:Use "/mcp installed" to see installed servers')
    );
  });

  it('should handle no MCP servers installed', async () => {
    mockLoadConfig.mockResolvedValue({
      project: { name: 'test', description: 'test' },
      mcp: { enabled: true, servers: {} },
    });

    await mcpCommand.handler(mockContext, ['uninstall', 'test-server']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('YELLOW:⚠️  No MCP servers are currently installed.')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:Use "/mcp list" to see available servers')
    );
  });

  it('should handle missing MCP config', async () => {
    mockLoadConfig.mockResolvedValue({
      project: { name: 'test', description: 'test' },
    });

    await mcpCommand.handler(mockContext, ['uninstall', 'test-server']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('YELLOW:⚠️  No MCP servers are currently installed.')
    );
  });

  it('should show remaining servers count', async () => {
    mockInquirerPrompt.mockResolvedValue({ confirm: true });

    await mcpCommand.handler(mockContext, ['uninstall', 'test-server']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:Remaining installed servers: 1')
    );
  });

  it('should handle last server uninstall', async () => {
    mockInquirerPrompt.mockResolvedValue({ confirm: true });
    mockLoadConfig.mockResolvedValue({
      project: { name: 'test', description: 'test' },
      mcp: {
        enabled: true,
        servers: {
          'only-server': {
            name: 'Only Server',
            type: 'stdio',
            command: 'only-command',
            args: [],
            autoStart: false,
          },
        },
      },
    });

    await mcpCommand.handler(mockContext, ['uninstall', 'only-server']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:No MCP servers are currently installed.')
    );
  });

  it('should handle uninstall errors', async () => {
    mockLoadConfig.mockRejectedValue(new Error('Config error'));

    await mcpCommand.handler(mockContext, ['uninstall', 'test-server']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('RED:❌ Error uninstalling MCP server: Config error')
    );
  });

  it('should show configuration removal notice', async () => {
    mockInquirerPrompt.mockResolvedValue({ confirm: true });

    await mcpCommand.handler(mockContext, ['uninstall', 'test-server']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:   Server configuration has been removed from .apex/config.yaml')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:   Restart APEX to apply the changes')
    );
  });

});