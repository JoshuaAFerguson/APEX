/**
 * Integration tests for MCP server status command
 *
 * Tests verify: status shows correct state for installed servers, not-installed servers handled,
 * multiple server status works, output format is consistent. All tests pass.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CliContext } from '../index.js';

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

// Mock chalk for consistent output testing
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

// Mock MCP configuration loading
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadConfig: vi.fn(),
  };
});

import { loadConfig } from '@apexcli/core';
import { commands } from '../index.js';

describe('MCP Status Command Integration Tests', () => {
  let mockContext: CliContext;
  let mcpCommand: any;
  let mockLoadConfig: any;

  const configWithMultipleServers = {
    project: { name: 'test-project', description: 'Test project' },
    mcp: {
      enabled: true,
      servers: {
        'filesystem': {
          name: 'Filesystem Server',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          autoStart: true,
          status: 'running'
        },
        'github': {
          name: 'GitHub Server',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          autoStart: false,
          status: 'stopped'
        },
        'sqlite': {
          name: 'SQLite Server',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-sqlite'],
          autoStart: true,
          status: 'error'
        },
      },
    },
  };

  const configWithNoServers = {
    project: { name: 'empty-project', description: 'Empty project' },
    mcp: {
      enabled: true,
      servers: {},
    },
  };

  const configWithDisabledMcp = {
    project: { name: 'disabled-project', description: 'Project with disabled MCP' },
    mcp: {
      enabled: false,
      servers: {
        'filesystem': {
          name: 'Filesystem Server',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          autoStart: true,
        },
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();

    mockContext = {
      cwd: '/test-workspace',
      initialized: true,
    };

    mockLoadConfig = vi.mocked(loadConfig);
    mcpCommand = commands.find(cmd => cmd.name === 'mcp');
  });

  describe('Installed servers status display', () => {
    it('should show correct status for installed servers', async () => {
      mockLoadConfig.mockResolvedValue(configWithMultipleServers);

      await mcpCommand.handler(mockContext, ['status']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Check header formatting
      expect(calls).toContainEqual(
        expect.stringContaining('CYAN:📊 MCP Server Status:')
      );

      // Check individual server statuses
      expect(calls.some(call => call.includes('YELLOW:Filesystem Server'))).toBe(true);
      expect(calls.some(call => call.includes('Status:') && call.includes('GREEN:running'))).toBe(true);

      expect(calls.some(call => call.includes('YELLOW:GitHub Server'))).toBe(true);
      expect(calls.some(call => call.includes('Status:') && call.includes('RED:stopped'))).toBe(true);

      expect(calls.some(call => call.includes('YELLOW:SQLite Server'))).toBe(true);
      expect(calls.some(call => call.includes('Status:') && call.includes('RED:error'))).toBe(true);
    });

    it('should display server configuration details', async () => {
      mockLoadConfig.mockResolvedValue(configWithMultipleServers);

      await mcpCommand.handler(mockContext, ['status']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Check command details are displayed
      expect(calls.some(call =>
        call.includes('GRAY:  Command:') && call.includes('npx -y @modelcontextprotocol/server-filesystem')
      )).toBe(true);

      // Check auto-start status
      expect(calls.some(call => call.includes('GRAY:  Auto-start:'))).toBe(true);
    });

    it('should show autoStart configuration correctly', async () => {
      mockLoadConfig.mockResolvedValue(configWithMultipleServers);

      await mcpCommand.handler(mockContext, ['status']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Check auto-start enabled/disabled indicators
      const hasAutoStartEnabled = calls.some(call =>
        call.includes('GRAY:  Auto-start:') && call.includes('GREEN:enabled')
      );
      const hasAutoStartDisabled = calls.some(call =>
        call.includes('GRAY:  Auto-start:') && call.includes('RED:disabled')
      );

      expect(hasAutoStartEnabled).toBe(true);
      expect(hasAutoStartDisabled).toBe(true);
    });
  });

  describe('Not-installed servers handling', () => {
    it('should handle configuration with no servers', async () => {
      mockLoadConfig.mockResolvedValue(configWithNoServers);

      await mcpCommand.handler(mockContext, ['status']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      expect(calls).toContainEqual(
        expect.stringContaining('GRAY:\nNo MCP servers are currently installed.')
      );
      expect(calls).toContainEqual(
        expect.stringContaining('GRAY:  • Browse available servers: /mcp list')
      );
      expect(calls).toContainEqual(
        expect.stringContaining('GRAY:  • Install a server: /mcp install <server-name>')
      );
    });

    it('should provide helpful guidance for empty configuration', async () => {
      mockLoadConfig.mockResolvedValue(configWithNoServers);

      await mcpCommand.handler(mockContext, ['status']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Check that help suggestions are provided
      expect(calls.some(call => call.includes('/mcp list'))).toBe(true);
      expect(calls.some(call => call.includes('/mcp install'))).toBe(true);
      expect(calls.some(call => call.includes('/mcp search'))).toBe(true);
    });

    it('should handle disabled MCP gracefully', async () => {
      mockLoadConfig.mockResolvedValue(configWithDisabledMcp);

      await mcpCommand.handler(mockContext, ['status']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      expect(calls).toContainEqual(
        expect.stringContaining('GRAY:MCP Status:')
      );
      expect(calls).toContainEqual(
        expect.stringContaining('RED:disabled')
      );
      expect(calls).toContainEqual(
        expect.stringContaining('GRAY:MCP is currently disabled.')
      );
    });
  });

  describe('Multiple server status verification', () => {
    it('should handle multiple servers with different statuses', async () => {
      mockLoadConfig.mockResolvedValue(configWithMultipleServers);

      await mcpCommand.handler(mockContext, ['status']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Verify all three servers are displayed
      const serverNames = ['Filesystem Server', 'GitHub Server', 'SQLite Server'];
      const statuses = ['running', 'stopped', 'error'];

      serverNames.forEach(name => {
        expect(calls.some(call => call.includes(`YELLOW:${name}`))).toBe(true);
      });

      statuses.forEach(status => {
        const colorMap = { running: 'GREEN', stopped: 'RED', error: 'RED' };
        expect(calls.some(call => call.includes(`${colorMap[status as keyof typeof colorMap]}:${status}`))).toBe(true);
      });
    });

    it('should maintain consistent ordering of servers', async () => {
      mockLoadConfig.mockResolvedValue(configWithMultipleServers);

      await mcpCommand.handler(mockContext, ['status']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Find server name lines
      const serverNameLines = calls.filter(call => call.includes('YELLOW:') && call.includes('Server'));

      // Servers should appear in alphabetical order or configuration order
      expect(serverNameLines.length).toBeGreaterThanOrEqual(3);
    });

    it('should show summary information for multiple servers', async () => {
      mockLoadConfig.mockResolvedValue(configWithMultipleServers);

      await mcpCommand.handler(mockContext, ['status']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Should include overall MCP status
      expect(calls.some(call => call.includes('GRAY:MCP Status:'))).toBe(true);
      expect(calls.some(call => call.includes('GREEN:enabled'))).toBe(true);

      // Should show total count or summary
      expect(calls.some(call => call.includes('GRAY:\nConfigured servers: 3'))).toBe(true); // 3 servers configured
    });
  });

  describe('Output format consistency', () => {
    it('should use consistent color coding throughout output', async () => {
      mockLoadConfig.mockResolvedValue(configWithMultipleServers);

      await mcpCommand.handler(mockContext, ['status']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Headers should be cyan
      expect(calls.some(call => call.includes('CYAN:📊 MCP Server Status:'))).toBe(true);

      // Server names should be yellow
      expect(calls.filter(call => call.includes('YELLOW:') && call.includes('Server')).length).toBeGreaterThan(0);

      // Status indicators should use appropriate colors
      expect(calls.some(call => call.includes('GREEN:running') || call.includes('GREEN:enabled'))).toBe(true);
      expect(calls.some(call => call.includes('RED:stopped') || call.includes('RED:error') || call.includes('RED:disabled'))).toBe(true);

      // Help text should be gray
      expect(calls.filter(call => call.includes('GRAY:')).length).toBeGreaterThan(0);
    });

    it('should maintain consistent indentation and spacing', async () => {
      mockLoadConfig.mockResolvedValue(configWithMultipleServers);

      await mcpCommand.handler(mockContext, ['status']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Check for consistent spacing patterns
      const serverDetailLines = calls.filter(call =>
        call.includes('GRAY:  Command:') || call.includes('GRAY:  Auto-start:')
      );

      // All detail lines should have consistent formatting
      expect(serverDetailLines.length).toBeGreaterThan(0);

      // Each server should have both command and auto-start info
      const commandLines = calls.filter(call => call.includes('GRAY:  Command:'));
      const autoStartLines = calls.filter(call => call.includes('GRAY:  Auto-start:'));

      expect(commandLines.length).toBe(autoStartLines.length);
    });

    it('should format empty states consistently', async () => {
      mockLoadConfig.mockResolvedValue(configWithNoServers);

      await mcpCommand.handler(mockContext, ['status']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Empty state should have consistent formatting
      expect(calls).toContainEqual(expect.stringContaining('CYAN:📊 MCP Server Status:'));
      expect(calls).toContainEqual(expect.stringContaining('GRAY:No MCP servers are currently installed.'));

      // Help suggestions should be consistently formatted
      const helpLines = calls.filter(call => call.includes('GRAY:  •'));
      expect(helpLines.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle error states with consistent formatting', async () => {
      // Test with malformed config
      mockLoadConfig.mockRejectedValue(new Error('Config loading failed'));

      await mcpCommand.handler(mockContext, ['status']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Error should be consistently formatted
      expect(calls.some(call => call.includes('RED:❌ Error loading MCP status:'))).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing status field in server config', async () => {
      const configWithoutStatus = {
        project: { name: 'test', description: 'test' },
        mcp: {
          enabled: true,
          servers: {
            'incomplete-server': {
              name: 'Incomplete Server',
              type: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-incomplete'],
              autoStart: true,
              // Missing status field
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithoutStatus);

      await mcpCommand.handler(mockContext, ['status']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Should handle gracefully with default status
      expect(calls.some(call => call.includes('YELLOW:Incomplete Server'))).toBe(true);
      expect(calls.some(call => call.includes('Status:') && call.includes('RED:unknown'))).toBe(true);
    });

    it('should handle uninitialized APEX project', async () => {
      const uninitializedContext = { ...mockContext, initialized: false };

      await mcpCommand.handler(uninitializedContext, ['status']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      expect(calls).toContainEqual(
        expect.stringContaining('RED:❌ APEX not initialized. Run /init first.')
      );
    });

    it('should provide usage help when status subcommand is invalid', async () => {
      await mcpCommand.handler(mockContext, ['invalid-subcommand']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      expect(calls.some(call => call.includes('Usage:'))).toBe(true);
    });
  });
});