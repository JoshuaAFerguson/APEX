/**
 * Simple smoke test for MCP install command integration
 */

import { describe, it, expect, vi } from 'vitest';
import type { CliContext } from '../index.js';
import { commands } from '../index.js';

// Mock console.log
const mockConsoleLog = vi.spyOn(console, 'log');

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    red: (str: string) => `RED:${str}`,
    gray: (str: string) => `GRAY:${str}`,
  },
}));

describe('MCP Install Command - Smoke Test', () => {
  it('should exist and handle missing server name', async () => {
    const mockContext: CliContext = {
      cwd: '/test',
      initialized: true,
      config: {} as any,
    };

    const mcpCommand = commands.find(cmd => cmd.name === 'mcp');
    expect(mcpCommand).toBeDefined();

    mockConsoleLog.mockClear();
    await mcpCommand!.handler(mockContext, ['install']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('RED:❌ Error: Server name is required')
    );
  });
});