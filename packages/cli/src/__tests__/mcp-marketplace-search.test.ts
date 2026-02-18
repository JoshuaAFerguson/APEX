/**
 * Tests for MCP marketplace search command
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
    blue: (str: string) => `BLUE:${str}`,
  },
}));

// Mock MCP functions
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadMCPTemplates: vi.fn(),
  };
});

import { loadMCPTemplates } from '@apexcli/core';
import { commands } from '../index.js';

describe('MCP Search Command', () => {
  let mockContext: CliContext;
  let mcpCommand: any;
  let mockLoadMCPTemplates: any;

  const testTemplates = {
    filesystem: {
      id: 'filesystem',
      name: 'Filesystem Server',
      description: 'File access server',
      capabilities: ['filesystem'],
      verified: true,
      category: 'Files',
      tags: ['filesystem', 'files'],
    },
    github: {
      id: 'github',
      name: 'GitHub Server',
      description: 'GitHub integration server',
      capabilities: ['git'],
      verified: true,
      category: 'Git',
      tags: ['github', 'git'],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();

    mockContext = {
      cwd: '/test',
      initialized: true,
    };

    mockLoadMCPTemplates = vi.mocked(loadMCPTemplates);
    mockLoadMCPTemplates.mockResolvedValue(testTemplates);

    mcpCommand = commands.find(cmd => cmd.name === 'mcp');
  });

  it('should search and display matching servers', async () => {
    await mcpCommand.handler(mockContext, ['search', 'filesystem']);

    expect(mockLoadMCPTemplates).toHaveBeenCalled();
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('CYAN:🔍 Searching MCP marketplace')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('YELLOW:Filesystem Server')
    );
  });

  it('should require search query', async () => {
    await mcpCommand.handler(mockContext, ['search']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('RED:❌ Error: Search query is required')
    );
  });

  it('should handle no results', async () => {
    await mcpCommand.handler(mockContext, ['search', 'nonexistent']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('YELLOW:No MCP servers found')
    );
  });

  it('should handle search errors', async () => {
    mockLoadMCPTemplates.mockRejectedValue(new Error('Test error'));

    await mcpCommand.handler(mockContext, ['search', 'test']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('RED:❌ Error searching MCP marketplace')
    );
  });
});