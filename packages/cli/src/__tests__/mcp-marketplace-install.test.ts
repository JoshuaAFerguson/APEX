/**
 * Tests for MCP marketplace install command
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
    getMCPTemplate: vi.fn(),
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
  };
});

import { getMCPTemplate, loadConfig, saveConfig } from '@apexcli/core';
import { commands } from '../index.js';

describe('MCP Install Command', () => {
  let mockContext: CliContext;
  let mcpCommand: any;
  let mockGetMCPTemplate: any;
  let mockLoadConfig: any;
  let mockSaveConfig: any;

  const testTemplate = {
    id: 'test-server',
    name: 'Test Server',
    description: 'A test MCP server',
    config: {
      name: 'test-server',
      type: 'stdio',
      command: 'test-command',
      args: ['--test'],
      autoStart: true,
    },
  };

  const baseConfig = {
    project: { name: 'test', description: 'test' },
    mcp: { enabled: true, servers: {} },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();

    mockContext = {
      cwd: '/test',
      initialized: true,
    };

    mockGetMCPTemplate = vi.mocked(getMCPTemplate);
    mockLoadConfig = vi.mocked(loadConfig);
    mockSaveConfig = vi.mocked(saveConfig);

    mockLoadConfig.mockResolvedValue(baseConfig);
    mockSaveConfig.mockResolvedValue(undefined);

    mcpCommand = commands.find(cmd => cmd.name === 'mcp');
  });

  it('should install a server successfully', async () => {
    mockGetMCPTemplate.mockResolvedValue(testTemplate);

    await mcpCommand.handler(mockContext, ['install', 'test-server']);

    expect(mockGetMCPTemplate).toHaveBeenCalledWith('test-server');
    expect(mockSaveConfig).toHaveBeenCalled();
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GREEN:✅ Successfully added MCP server')
    );
  });

  it('should work with add alias', async () => {
    mockGetMCPTemplate.mockResolvedValue(testTemplate);

    await mcpCommand.handler(mockContext, ['add', 'test-server']);

    expect(mockGetMCPTemplate).toHaveBeenCalledWith('test-server');
    expect(mockSaveConfig).toHaveBeenCalled();
  });

  it('should require server name', async () => {
    await mcpCommand.handler(mockContext, ['install']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('RED:❌ Error: Server name is required')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:Usage: /mcp install <server-name>')
    );
  });

  it('should handle non-existent template', async () => {
    mockGetMCPTemplate.mockResolvedValue(null);

    await mcpCommand.handler(mockContext, ['install', 'nonexistent']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('RED:❌ Error: Template \'nonexistent\' not found')
    );
  });

  it('should detect existing server', async () => {
    mockGetMCPTemplate.mockResolvedValue({ ...testTemplate, id: 'existing-server' });
    mockLoadConfig.mockResolvedValue({
      ...baseConfig,
      mcp: {
        enabled: true,
        servers: {
          'existing-server': {
            name: 'Existing Server',
            type: 'stdio',
            command: 'existing',
            args: [],
            autoStart: false,
          },
        },
      },
    });

    await mcpCommand.handler(mockContext, ['install', 'existing-server']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('YELLOW:⚠️  Server \'existing-server\' already exists')
    );
    expect(mockSaveConfig).not.toHaveBeenCalled();
  });

  it('should initialize MCP config if missing', async () => {
    mockGetMCPTemplate.mockResolvedValue(testTemplate);
    mockLoadConfig.mockResolvedValue({
      project: { name: 'test', description: 'test' },
    });

    await mcpCommand.handler(mockContext, ['install', 'test-server']);

    expect(mockSaveConfig).toHaveBeenCalled();
    const savedConfig = mockSaveConfig.mock.calls[0][1];
    expect(savedConfig).toHaveProperty('mcp');
    expect(savedConfig.mcp).toHaveProperty('enabled', true);
    expect(savedConfig.mcp).toHaveProperty('servers');
  });

  it('should handle installation errors', async () => {
    mockGetMCPTemplate.mockRejectedValue(new Error('Template error'));

    await mcpCommand.handler(mockContext, ['install', 'test-server']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('RED:❌ Error adding MCP server: Template error')
    );
  });

  it('should show installation guidance', async () => {
    mockGetMCPTemplate.mockResolvedValue(testTemplate);

    await mcpCommand.handler(mockContext, ['install', 'test-server']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:Next steps:')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('GRAY:• Configure environment variables')
    );
  });
});