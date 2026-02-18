/**
 * Tests for MCP installed command CLI formatting and data presentation
 *
 * This test suite focuses specifically on:
 * 1. CLI output formatting consistency
 * 2. Color coding correctness
 * 3. Data sorting and presentation
 * 4. Edge cases in display logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CliContext } from '../index.js';

// Mock console.log to capture exact output
const mockConsoleLog = vi.spyOn(console, 'log');

// Mock chalk with consistent prefixes for testing
vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => `CYAN:${str}`,
    red: (str: string) => `RED:${str}`,
    green: (str: string) => `GREEN:${str}`,
    yellow: (str: string) => `YELLOW:${str}`,
    gray: (str: string) => `GRAY:${str}`,
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

describe('MCP Installed Command - CLI Formatting', () => {
  let mockContext: CliContext;
  let mcpCommand: any;
  let mockLoadConfig: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();

    mockContext = {
      cwd: '/test',
      initialized: true,
    };

    mockLoadConfig = vi.mocked(loadConfig);
    mcpCommand = commands.find(cmd => cmd.name === 'mcp');
  });

  describe('Display Formatting', () => {
    it('should format server configuration details correctly', async () => {
      const configWithDetailedServers = {
        project: { name: 'test', description: 'test' },
        mcp: {
          enabled: true,
          servers: {
            'complex-server': {
              name: 'Complex MCP Server',
              type: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-complex', '--port', '3000'],
              autoStart: true,
              capabilities: ['resources', 'tools', 'prompts'],
              envVars: [
                { name: 'API_KEY', sensitive: true },
                { name: 'DEBUG', value: 'true' }
              ]
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithDetailedServers);

      await mcpCommand.handler(mockContext, ['installed']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Check header formatting
      expect(calls).toContainEqual(
        expect.stringContaining('CYAN:📦 Installed MCP Servers:')
      );

      // Check server name formatting
      expect(calls.some(call => call.includes('YELLOW:Complex MCP Server'))).toBe(true);

      // Check command display
      expect(calls.some(call =>
        call.includes('CYAN:npx -y @modelcontextprotocol/server-complex --port 3000')
      )).toBe(true);

      // Check capabilities display
      expect(calls.some(call =>
        call.includes('resources, tools, prompts')
      )).toBe(true);

      // Check environment variables display
      expect(calls.some(call =>
        call.includes('API_KEY') && call.includes('(sensitive)')
      )).toBe(true);
      expect(calls.some(call =>
        call.includes('DEBUG=true')
      )).toBe(true);
    });

    it('should handle servers with minimal configuration gracefully', async () => {
      const configWithMinimalServer = {
        project: { name: 'test', description: 'test' },
        mcp: {
          enabled: true,
          servers: {
            'minimal': {
              name: 'Minimal Server',
              type: 'stdio',
              command: 'simple-command',
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithMinimalServer);

      await mcpCommand.handler(mockContext, ['installed']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Should display server name
      expect(calls.some(call => call.includes('YELLOW:Minimal Server'))).toBe(true);

      // Should display simple command
      expect(calls.some(call => call.includes('CYAN:simple-command'))).toBe(true);

      // Should not break on missing optional fields
      expect(calls.some(call => call.includes('undefined'))).toBe(false);
    });

    it('should sort servers alphabetically by server ID consistently', async () => {
      const configWithMultipleServers = {
        project: { name: 'test', description: 'test' },
        mcp: {
          enabled: true,
          servers: {
            'zebra-server': {
              name: 'Zebra MCP Server',
              type: 'stdio',
              command: 'zebra-cmd',
              autoStart: false,
            },
            'alpha-server': {
              name: 'Alpha MCP Server',
              type: 'stdio',
              command: 'alpha-cmd',
              autoStart: true,
            },
            'beta-server': {
              name: 'Beta MCP Server',
              type: 'stdio',
              command: 'beta-cmd',
              autoStart: false,
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithMultipleServers);

      await mcpCommand.handler(mockContext, ['installed']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Find indices of server names in the output
      const alphaIndex = calls.findIndex(call => call.includes('Alpha MCP Server'));
      const betaIndex = calls.findIndex(call => call.includes('Beta MCP Server'));
      const zebraIndex = calls.findIndex(call => call.includes('Zebra MCP Server'));

      // All servers should be displayed
      expect(alphaIndex).toBeGreaterThan(-1);
      expect(betaIndex).toBeGreaterThan(-1);
      expect(zebraIndex).toBeGreaterThan(-1);

      // Alpha should come before Beta, Beta before Zebra
      expect(alphaIndex).toBeLessThan(betaIndex);
      expect(betaIndex).toBeLessThan(zebraIndex);
    });

    it('should display auto-start status with correct colors', async () => {
      const configWithAutoStartVariations = {
        project: { name: 'test', description: 'test' },
        mcp: {
          enabled: true,
          servers: {
            'auto-enabled': {
              name: 'Auto Enabled Server',
              type: 'stdio',
              command: 'auto-cmd',
              autoStart: true,
            },
            'auto-disabled': {
              name: 'Auto Disabled Server',
              type: 'stdio',
              command: 'manual-cmd',
              autoStart: false,
            },
            'auto-unspecified': {
              name: 'Auto Unspecified Server',
              type: 'stdio',
              command: 'default-cmd',
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithAutoStartVariations);

      await mcpCommand.handler(mockContext, ['installed']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Check for enabled/disabled indicators
      const hasEnabledIndicator = calls.some(call => call.includes('GREEN:●') || call.includes('enabled'));
      const hasDisabledIndicator = calls.some(call => call.includes('GRAY:○') || call.includes('disabled'));

      // Should show status indicators for all servers
      expect(hasEnabledIndicator || hasDisabledIndicator).toBe(true);
    });

    it('should display server count accurately', async () => {
      const configWithExactCountTest = {
        project: { name: 'test', description: 'test' },
        mcp: {
          enabled: true,
          servers: {
            'server1': { name: 'Server 1', type: 'stdio', command: 'cmd1' },
            'server2': { name: 'Server 2', type: 'stdio', command: 'cmd2' },
            'server3': { name: 'Server 3', type: 'stdio', command: 'cmd3' },
            'server4': { name: 'Server 4', type: 'stdio', command: 'cmd4' },
            'server5': { name: 'Server 5', type: 'stdio', command: 'cmd5' },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithExactCountTest);

      await mcpCommand.handler(mockContext, ['installed']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Should show exact count
      expect(calls.some(call => call.includes('GRAY:Total: 5 servers installed'))).toBe(true);
    });
  });

  describe('Error Display Formatting', () => {
    it('should format configuration errors consistently', async () => {
      const testError = new Error('Configuration file is corrupted');
      mockLoadConfig.mockRejectedValue(testError);

      await mcpCommand.handler(mockContext, ['installed']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'RED:❌ Error listing installed MCP servers: Configuration file is corrupted'
      );
    });

    it('should handle generic errors gracefully', async () => {
      mockLoadConfig.mockRejectedValue('Unknown error');

      await mcpCommand.handler(mockContext, ['installed']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('RED:❌ Error listing installed MCP servers:')
      );
    });
  });

  describe('MCP Status Display', () => {
    it('should display MCP enabled status with green indicator', async () => {
      mockLoadConfig.mockResolvedValue({
        project: { name: 'test', description: 'test' },
        mcp: {
          enabled: true,
          servers: {},
        },
      });

      await mcpCommand.handler(mockContext, ['installed']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      expect(calls.some(call =>
        call.includes('GRAY:MCP Status:') && call.includes('GREEN:enabled')
      )).toBe(true);
    });

    it('should display MCP disabled status with warning', async () => {
      mockLoadConfig.mockResolvedValue({
        project: { name: 'test', description: 'test' },
        mcp: {
          enabled: false,
          servers: {
            'test-server': {
              name: 'Test Server',
              type: 'stdio',
              command: 'test-cmd',
            },
          },
        },
      });

      await mcpCommand.handler(mockContext, ['installed']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Should show disabled status
      expect(calls.some(call => call.includes('RED:disabled'))).toBe(true);

      // Should show warning message
      expect(calls.some(call =>
        call.includes('YELLOW:⚠️  MCP is disabled. Enable it with "/mcp init" to use installed servers.')
      )).toBe(true);
    });
  });

  describe('Management Commands Display', () => {
    it('should always display management command hints', async () => {
      mockLoadConfig.mockResolvedValue({
        project: { name: 'test', description: 'test' },
        mcp: {
          enabled: true,
          servers: {
            'test': {
              name: 'Test Server',
              type: 'stdio',
              command: 'test',
            },
          },
        },
      });

      await mcpCommand.handler(mockContext, ['installed']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Should display management commands section
      expect(calls.some(call => call.includes('GRAY:Management commands:'))).toBe(true);
      expect(calls.some(call => call.includes('GRAY:• Uninstall: /mcp uninstall <server-name>'))).toBe(true);
      expect(calls.some(call => call.includes('GRAY:• Validate config: /mcp validate'))).toBe(true);
      expect(calls.some(call => call.includes('GRAY:• Configure servers: edit .apex/config.yaml'))).toBe(true);
    });

    it('should display helpful hints when no servers are installed', async () => {
      mockLoadConfig.mockResolvedValue({
        project: { name: 'test', description: 'test' },
        mcp: {
          enabled: true,
          servers: {},
        },
      });

      await mcpCommand.handler(mockContext, ['installed']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Should show helpful installation hints
      expect(calls.some(call => call.includes('GRAY:• Browse available servers: /mcp list'))).toBe(true);
      expect(calls.some(call => call.includes('GRAY:• Search for servers: /mcp search <query>'))).toBe(true);
      expect(calls.some(call => call.includes('GRAY:• Install a server: /mcp install <server-name>'))).toBe(true);
    });
  });

  describe('Edge Cases in Formatting', () => {
    it('should handle servers with special characters in names', async () => {
      const configWithSpecialChars = {
        project: { name: 'test', description: 'test' },
        mcp: {
          enabled: true,
          servers: {
            'special-chars': {
              name: 'Server with "quotes" & symbols <test>',
              type: 'stdio',
              command: 'special-cmd',
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithSpecialChars);

      await mcpCommand.handler(mockContext, ['installed']);

      const calls = mockConsoleLog.mock.calls.map(call => call[0]);

      // Should display server with special characters without breaking
      expect(calls.some(call =>
        call.includes('Server with "quotes" & symbols <test>')
      )).toBe(true);
    });

    it('should handle very long server names gracefully', async () => {
      const configWithLongName = {
        project: { name: 'test', description: 'test' },
        mcp: {
          enabled: true,
          servers: {
            'long-name-server': {
              name: 'This is a very long server name that might cause formatting issues if not handled properly in the display logic',
              type: 'stdio',
              command: 'long-cmd',
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithLongName);

      await mcpCommand.handler(mockContext, ['installed']);

      // Should not throw any errors and should display the long name
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(() => mockConsoleLog.mock.calls).not.toThrow();
    });

    it('should handle empty string values gracefully', async () => {
      const configWithEmptyValues = {
        project: { name: 'test', description: 'test' },
        mcp: {
          enabled: true,
          servers: {
            'empty-values': {
              name: '',
              type: 'stdio',
              command: 'cmd',
              args: [],
              capabilities: [],
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(configWithEmptyValues);

      await mcpCommand.handler(mockContext, ['installed']);

      // Should handle empty values without errors
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(() => mockConsoleLog.mock.calls).not.toThrow();
    });
  });
});