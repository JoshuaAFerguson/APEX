/**
 * Enhanced tests for MCP validate command
 * Tests additional edge cases and actual implementation details
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import type { CliContext } from '../index.js';

// Mock chalk to avoid color codes in tests
vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => str,
    red: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    gray: (str: string) => str,
    blue: (str: string) => str,
  },
}));

// Mock the MCP and config functions
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadConfig: vi.fn(),
    validateMCPConfig: vi.fn(),
  };
});

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

describe('MCP Validate Command - Enhanced Tests', () => {
  let mockContext: CliContext;
  let mockLoadConfig: any;
  let mockValidateMCPConfig: any;

  beforeEach(async () => {
    mockContext = {
      cwd: '/test/project',
      initialized: true,
      config: null,
    } as CliContext;

    // Get the mocked functions
    const { loadConfig, validateMCPConfig } = await import('@apexcli/core');
    mockLoadConfig = vi.mocked(loadConfig);
    mockValidateMCPConfig = vi.mocked(validateMCPConfig);

    // Reset all mocks
    mockConsoleLog.mockClear();
    mockLoadConfig.mockClear();
    mockValidateMCPConfig.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Actual validation implementation tests', () => {
    it('should call validateMCPConfig with correct options', async () => {
      const mockConfig = {
        mcp: {
          enabled: true,
          servers: {},
        },
        agents: {},
        workflows: {},
      };

      mockLoadConfig.mockResolvedValue(mockConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockValidateMCPConfig).toHaveBeenCalledWith(
        mockConfig.mcp,
        {
          checkEnvironmentVars: true,
          checkCommandExistence: true,
          validateConnectionConfig: true,
          baseDirectory: mockContext.cwd,
        }
      );
    });

    it('should handle config without MCP section', async () => {
      const mockConfig = {
        agents: {},
        workflows: {},
      };

      mockLoadConfig.mockResolvedValue(mockConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      // Should default to disabled MCP config
      expect(mockValidateMCPConfig).toHaveBeenCalledWith(
        { enabled: false, servers: {} },
        expect.any(Object)
      );
    });

    it('should display validation progress message', async () => {
      const mockConfig = {
        mcp: { enabled: true, servers: {} },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🔍 Validating MCP configuration...')
      );
    });
  });

  describe('Validation result formatting', () => {
    it('should format error issues correctly with all details', async () => {
      const mockConfig = {
        mcp: {
          enabled: true,
          servers: {
            'bad-server': {},
          },
        },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: false,
        issues: [
          {
            code: 'MISSING_COMMAND',
            message: 'Server is missing required command field',
            severity: 'error' as const,
            path: 'servers.bad-server.command',
            suggestion: 'Add a command field to specify how to run the server',
          },
          {
            code: 'INVALID_TYPE',
            message: 'Invalid server type',
            severity: 'error' as const,
            path: 'servers.bad-server.type',
            // No suggestion for this one
          },
        ],
        errorCount: 2,
        warningCount: 0,
        infoCount: 0,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ MCP configuration has validation errors')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📊 Summary: 2 errors, 0 warnings, 0 info')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🚨 Errors:')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('• [MISSING_COMMAND] Server is missing required command field')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Path: servers.bad-server.command')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('💡 Add a command field to specify how to run the server')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('• [INVALID_TYPE] Invalid server type')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Path: servers.bad-server.type')
      );

      // Should not show suggestion line for issue without suggestion
      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput.match(/💡/g)?.length).toBe(1); // Only one suggestion
    });

    it('should format warning issues correctly', async () => {
      const mockConfig = {
        mcp: {
          enabled: true,
          servers: {
            'warning-server': {
              command: 'node',
              timeout: 100,
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [
          {
            code: 'LOW_TIMEOUT',
            message: 'Timeout value is very low',
            severity: 'warning' as const,
            path: 'servers.warning-server.timeout',
            suggestion: 'Consider increasing the timeout value',
          },
        ],
        errorCount: 0,
        warningCount: 1,
        infoCount: 0,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ MCP configuration is valid!')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📋 Additional information:')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Warnings:')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('• [LOW_TIMEOUT] Timeout value is very low')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('💡 Consider increasing the timeout value')
      );
    });

    it('should format info issues correctly', async () => {
      const mockConfig = {
        mcp: {
          enabled: true,
          servers: {
            'info-server': {
              command: 'node',
              enabled: false,
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [
          {
            code: 'SERVER_DISABLED',
            message: 'Server is disabled',
            severity: 'info' as const,
            path: 'servers.info-server.enabled',
            suggestion: 'Enable the server if you want to use it',
          },
        ],
        errorCount: 0,
        warningCount: 0,
        infoCount: 1,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('ℹ️  Information:')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('• [SERVER_DISABLED] Server is disabled')
      );
    });

    it('should handle mixed severity issues correctly', async () => {
      const mockConfig = {
        mcp: {
          enabled: true,
          servers: {
            'mixed-server': {},
          },
        },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: false,
        issues: [
          {
            code: 'ERROR_ISSUE',
            message: 'This is an error',
            severity: 'error' as const,
            path: 'servers.mixed-server.error',
          },
          {
            code: 'WARNING_ISSUE',
            message: 'This is a warning',
            severity: 'warning' as const,
            path: 'servers.mixed-server.warning',
          },
          {
            code: 'INFO_ISSUE',
            message: 'This is info',
            severity: 'info' as const,
            path: 'servers.mixed-server.info',
          },
        ],
        errorCount: 1,
        warningCount: 1,
        infoCount: 1,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📊 Summary: 1 errors, 1 warnings, 1 info')
      );

      // Should display all three sections
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🚨 Errors:')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Warnings:')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('ℹ️  Information:')
      );
    });
  });

  describe('Configuration state notifications', () => {
    it('should show note when MCP is disabled', async () => {
      const mockConfig = {
        mcp: {
          enabled: false,
          servers: {
            'some-server': {},
          },
        },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('💡 Note: MCP is currently disabled or not configured')
      );
    });

    it('should show note when MCP section is missing', async () => {
      const mockConfig = {
        // No MCP section
        agents: {},
        workflows: {},
      };

      mockLoadConfig.mockResolvedValue(mockConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('💡 Note: MCP is currently disabled or not configured')
      );
    });

    it('should show note when no servers are configured', async () => {
      const mockConfig = {
        mcp: {
          enabled: true,
          servers: {},
        },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('💡 Note: No MCP servers are configured')
      );
    });

    it('should show note when servers section is missing', async () => {
      const mockConfig = {
        mcp: {
          enabled: true,
          // No servers section
        },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('💡 Note: No MCP servers are configured')
      );
    });

    it('should not show notes when MCP is properly configured', async () => {
      const mockConfig = {
        mcp: {
          enabled: true,
          servers: {
            'working-server': {
              command: 'node',
              args: ['server.js'],
            },
          },
        },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).not.toContain('💡 Note: MCP is currently disabled');
      expect(allOutput).not.toContain('💡 Note: No MCP servers are configured');
    });
  });

  describe('Error handling', () => {
    it('should handle config loading errors', async () => {
      mockLoadConfig.mockRejectedValue(new Error('Config file not found'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error validating MCP configuration: Config file not found')
      );
      expect(mockValidateMCPConfig).not.toHaveBeenCalled();
    });

    it('should handle validation function errors', async () => {
      const mockConfig = {
        mcp: { enabled: true, servers: {} },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);
      mockValidateMCPConfig.mockRejectedValue(new Error('Validation service unavailable'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error validating MCP configuration: Validation service unavailable')
      );
    });

    it('should handle malformed validation results', async () => {
      const mockConfig = {
        mcp: { enabled: true, servers: {} },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);
      // Return malformed result
      mockValidateMCPConfig.mockResolvedValue(null);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await expect(mcpCommand?.handler(mockContext, ['validate'])).rejects.toThrow();
    });
  });

  describe('Issue formatting edge cases', () => {
    it('should handle issues without paths', async () => {
      const mockConfig = {
        mcp: { enabled: true, servers: {} },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: false,
        issues: [
          {
            code: 'GENERAL_ERROR',
            message: 'General configuration error',
            severity: 'error' as const,
            // No path property
          },
        ],
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('• [GENERAL_ERROR] General configuration error')
      );

      // Should not show a Path line
      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).not.toContain('Path:');
    });

    it('should handle issues without suggestions', async () => {
      const mockConfig = {
        mcp: { enabled: true, servers: {} },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [
          {
            code: 'NO_SUGGESTION',
            message: 'Issue without suggestion',
            severity: 'warning' as const,
            path: 'some.path',
            // No suggestion property
          },
        ],
        errorCount: 0,
        warningCount: 1,
        infoCount: 0,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).not.toContain('💡');
    });

    it('should handle empty issue arrays', async () => {
      const mockConfig = {
        mcp: { enabled: true, servers: { 'test': {} } },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ MCP configuration is valid!')
      );

      // Should not show any issue sections
      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).not.toContain('🚨 Errors:');
      expect(allOutput).not.toContain('⚠️  Warnings:');
      expect(allOutput).not.toContain('ℹ️  Information:');
    });

    it('should handle zero issue counts correctly', async () => {
      const mockConfig = {
        mcp: { enabled: true, servers: { 'test': {} } },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      // Should not show summary when all counts are zero
      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).not.toContain('📊 Summary:');
    });
  });
});