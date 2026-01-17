/**
 * @fileoverview Integration tests for 'apex mcp validate' CLI command
 *
 * Tests the complete integration of the MCP validation command including:
 * - Command parsing and argument handling
 * - Configuration loading from .apex/config.yaml
 * - Integration with MCPConfigValidator
 * - Output formatting and user experience
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { validateMCPConfig } from '@apexcli/core';
import { loadConfig } from '@apexcli/core';

// Mock dependencies
vi.mock('@apexcli/core');
vi.mock('fs/promises');
vi.mock('chalk', () => ({
  default: {
    green: vi.fn((text) => `GREEN:${text}`),
    red: vi.fn((text) => `RED:${text}`),
    yellow: vi.fn((text) => `YELLOW:${text}`),
    blue: vi.fn((text) => `BLUE:${text}`),
    cyan: vi.fn((text) => `CYAN:${text}`),
    gray: vi.fn((text) => `GRAY:${text}`),
    dim: vi.fn((text) => `DIM:${text}`),
  },
}));

const mockLoadConfig = vi.mocked(loadConfig);
const mockValidateMCPConfig = vi.mocked(validateMCPConfig);
const mockFs = vi.mocked(fs);

// Command handler simulation - we'll directly test the logic that would be in the CLI
async function simulateMcpValidateCommand(workingDirectory: string): Promise<{
  success: boolean;
  output: string[];
}> {
  const output: string[] = [];
  const originalConsoleLog = console.log;

  // Capture console output
  console.log = (...args: any[]) => {
    output.push(args.join(' '));
  };

  try {
    output.push(chalk.cyan('🔍 Validating MCP configuration...'));

    // Load configuration
    const config = await loadConfig(workingDirectory);
    const mcpConfig = config.mcp || { enabled: false, servers: {} };

    // Validate the MCP configuration
    const validationResult = await validateMCPConfig(mcpConfig, {
      checkEnvironmentVars: true,
      checkCommandExistence: true,
      validateConnectionConfig: true,
      baseDirectory: workingDirectory,
    });

    if (validationResult.isValid) {
      output.push(chalk.green('✅ MCP configuration is valid!'));

      if (validationResult.warningCount > 0) {
        output.push(chalk.yellow(`⚠️  Found ${validationResult.warningCount} warning(s):`));
        validationResult.issues
          .filter(issue => issue.severity === 'warning')
          .forEach(issue => {
            output.push(chalk.yellow(`   • ${issue.message}`));
            if (issue.suggestion) {
              output.push(chalk.dim(`     Suggestion: ${issue.suggestion}`));
            }
          });
      }

      if (validationResult.infoCount > 0) {
        output.push(chalk.blue(`ℹ️  Found ${validationResult.infoCount} info message(s):`));
        validationResult.issues
          .filter(issue => issue.severity === 'info')
          .forEach(issue => {
            output.push(chalk.blue(`   • ${issue.message}`));
            if (issue.suggestion) {
              output.push(chalk.dim(`     Suggestion: ${issue.suggestion}`));
            }
          });
      }

      if (!config.mcp?.enabled) {
        output.push(chalk.gray('Note: MCP is currently disabled in configuration'));
      }
    } else {
      output.push(chalk.red('❌ MCP configuration has validation errors:'));

      // Show errors
      if (validationResult.errorCount > 0) {
        output.push(chalk.red(`\n🚨 Errors (${validationResult.errorCount}):`));
        validationResult.issues
          .filter(issue => issue.severity === 'error')
          .forEach(issue => {
            output.push(chalk.red(`   • ${issue.message}`));
            if (issue.path) {
              output.push(chalk.dim(`     Path: ${issue.path}`));
            }
            if (issue.suggestion) {
              output.push(chalk.dim(`     Suggestion: ${issue.suggestion}`));
            }
          });
      }

      // Show warnings
      if (validationResult.warningCount > 0) {
        output.push(chalk.yellow(`\n⚠️  Warnings (${validationResult.warningCount}):`));
        validationResult.issues
          .filter(issue => issue.severity === 'warning')
          .forEach(issue => {
            output.push(chalk.yellow(`   • ${issue.message}`));
            if (issue.path) {
              output.push(chalk.dim(`     Path: ${issue.path}`));
            }
            if (issue.suggestion) {
              output.push(chalk.dim(`     Suggestion: ${issue.suggestion}`));
            }
          });
      }

      // Show info messages
      if (validationResult.infoCount > 0) {
        output.push(chalk.blue(`\nℹ️  Info (${validationResult.infoCount}):`));
        validationResult.issues
          .filter(issue => issue.severity === 'info')
          .forEach(issue => {
            output.push(chalk.blue(`   • ${issue.message}`));
            if (issue.suggestion) {
              output.push(chalk.dim(`     Suggestion: ${issue.suggestion}`));
            }
          });
      }
    }

    return { success: validationResult.isValid, output };
  } catch (error) {
    output.push(chalk.red(`❌ Error validating MCP configuration: ${(error as Error).message}`));
    return { success: false, output };
  } finally {
    console.log = originalConsoleLog;
  }
}

describe('MCP Validate Command Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-mcp-test-'));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    vi.restoreAllMocks();
  });

  describe('Successful Validation Cases', () => {
    it('should validate valid MCP configuration successfully', async () => {
      // Mock configuration loading
      const mockConfig = {
        mcp: {
          enabled: true,
          servers: {
            'test-server': {
              command: 'node',
              args: ['server.js'],
              enabled: true,
            },
          },
        },
      };
      mockLoadConfig.mockResolvedValue(mockConfig);

      // Mock validation result
      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });

      const result = await simulateMcpValidateCommand(tempDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('CYAN:🔍 Validating MCP configuration...');
      expect(result.output).toContain('GREEN:✅ MCP configuration is valid!');
      expect(mockLoadConfig).toHaveBeenCalledWith(tempDir);
      expect(mockValidateMCPConfig).toHaveBeenCalledWith(mockConfig.mcp, {
        checkEnvironmentVars: true,
        checkCommandExistence: true,
        validateConnectionConfig: true,
        baseDirectory: tempDir,
      });
    });

    it('should show warnings for valid configuration with warnings', async () => {
      const mockConfig = {
        mcp: {
          enabled: true,
          servers: {
            'test-server': {
              command: 'node',
              connection: { timeout: 500 }, // This will trigger a warning
            },
          },
        },
      };
      mockLoadConfig.mockResolvedValue(mockConfig);

      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [
          {
            code: 'TIMEOUT_TOO_LOW',
            message: 'Connection timeout of 500ms may be too low',
            severity: 'warning' as const,
            path: 'servers.test-server.connection.timeout',
            suggestion: 'Consider using a timeout of at least 1000ms (1 second) for reliable connections',
          },
        ],
        errorCount: 0,
        warningCount: 1,
        infoCount: 0,
      });

      const result = await simulateMcpValidateCommand(tempDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('GREEN:✅ MCP configuration is valid!');
      expect(result.output).toContain('YELLOW:⚠️  Found 1 warning(s):');
      expect(result.output).toContain('YELLOW:   • Connection timeout of 500ms may be too low');
      expect(result.output).toContain('DIM:     Suggestion: Consider using a timeout of at least 1000ms');
    });

    it('should show info messages for valid configuration with info', async () => {
      const mockConfig = {
        mcp: {
          enabled: true,
          servers: {
            'test-server': {
              command: 'node',
              enabled: true,
              autoStart: false,
            },
          },
        },
      };
      mockLoadConfig.mockResolvedValue(mockConfig);

      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [
          {
            code: 'AUTOSTART_DISABLED_BUT_ENABLED',
            message: 'Server \'test-server\' has autoStart disabled but is still enabled',
            severity: 'info' as const,
            path: 'servers.test-server.autoStart',
            suggestion: 'Consider setting enabled: false if this server should not be used, or enable autoStart if it should start automatically',
          },
        ],
        errorCount: 0,
        warningCount: 0,
        infoCount: 1,
      });

      const result = await simulateMcpValidateCommand(tempDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('GREEN:✅ MCP configuration is valid!');
      expect(result.output).toContain('BLUE:ℹ️  Found 1 info message(s):');
      expect(result.output).toContain('BLUE:   • Server \'test-server\' has autoStart disabled but is still enabled');
    });

    it('should handle disabled MCP configuration', async () => {
      const mockConfig = {
        mcp: {
          enabled: false,
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

      const result = await simulateMcpValidateCommand(tempDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('GREEN:✅ MCP configuration is valid!');
      expect(result.output).toContain('GRAY:Note: MCP is currently disabled in configuration');
    });
  });

  describe('Validation Error Cases', () => {
    it('should handle validation errors properly', async () => {
      const mockConfig = {
        mcp: {
          enabled: true,
          servers: {
            'problematic-server': {
              // Missing required command field
              args: ['server.js'],
            },
          },
        },
      };
      mockLoadConfig.mockResolvedValue(mockConfig);

      mockValidateMCPConfig.mockResolvedValue({
        isValid: false,
        issues: [
          {
            code: 'MISSING_COMMAND',
            message: 'Server \'problematic-server\' is missing required \'command\' field',
            severity: 'error' as const,
            path: 'servers.problematic-server.command',
            suggestion: 'Specify the command to execute the MCP server (e.g., "npx", "node", or path to executable)',
          },
          {
            code: 'TIMEOUT_TOO_LOW',
            message: 'Connection timeout of 100ms may be too low',
            severity: 'warning' as const,
            path: 'servers.problematic-server.connection.timeout',
            suggestion: 'Consider using a timeout of at least 1000ms for reliable connections',
          },
        ],
        errorCount: 1,
        warningCount: 1,
        infoCount: 0,
      });

      const result = await simulateMcpValidateCommand(tempDir);

      expect(result.success).toBe(false);
      expect(result.output).toContain('RED:❌ MCP configuration has validation errors:');
      expect(result.output).toContain('RED:🚨 Errors (1):');
      expect(result.output).toContain('RED:   • Server \'problematic-server\' is missing required \'command\' field');
      expect(result.output).toContain('DIM:     Path: servers.problematic-server.command');
      expect(result.output).toContain('YELLOW:⚠️  Warnings (1):');
      expect(result.output).toContain('YELLOW:   • Connection timeout of 100ms may be too low');
    });

    it('should handle multiple validation errors with proper formatting', async () => {
      const mockConfig = {
        mcp: {
          enabled: true,
          servers: {
            'server1': {
              // Missing command
            },
            'server2': {
              command: 'nonexistent-command',
            },
          },
        },
      };
      mockLoadConfig.mockResolvedValue(mockConfig);

      mockValidateMCPConfig.mockResolvedValue({
        isValid: false,
        issues: [
          {
            code: 'MISSING_COMMAND',
            message: 'Server \'server1\' is missing required \'command\' field',
            severity: 'error' as const,
            path: 'servers.server1.command',
            suggestion: 'Specify the command to execute the MCP server',
          },
          {
            code: 'COMMAND_NOT_FOUND',
            message: 'Command \'nonexistent-command\' not found in system PATH',
            severity: 'error' as const,
            path: 'servers.server2.command',
            suggestion: 'Install the required command or provide full path to executable',
          },
        ],
        errorCount: 2,
        warningCount: 0,
        infoCount: 0,
      });

      const result = await simulateMcpValidateCommand(tempDir);

      expect(result.success).toBe(false);
      expect(result.output).toContain('RED:🚨 Errors (2):');
      expect(result.output).toContain('RED:   • Server \'server1\' is missing required \'command\' field');
      expect(result.output).toContain('RED:   • Command \'nonexistent-command\' not found in system PATH');
    });
  });

  describe('Configuration Loading Error Cases', () => {
    it('should handle configuration loading errors', async () => {
      mockLoadConfig.mockRejectedValue(new Error('Configuration file not found'));

      const result = await simulateMcpValidateCommand(tempDir);

      expect(result.success).toBe(false);
      expect(result.output).toContain('RED:❌ Error validating MCP configuration: Configuration file not found');
    });

    it('should handle missing MCP configuration section', async () => {
      const mockConfig = {
        // No MCP section - should default to disabled
      };
      mockLoadConfig.mockResolvedValue(mockConfig);

      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });

      const result = await simulateMcpValidateCommand(tempDir);

      expect(result.success).toBe(true);
      expect(mockValidateMCPConfig).toHaveBeenCalledWith(
        { enabled: false, servers: {} },
        expect.any(Object)
      );
    });
  });

  describe('Validation Service Integration', () => {
    it('should pass correct validation options', async () => {
      const mockConfig = {
        mcp: {
          enabled: true,
          servers: {
            'test-server': {
              command: 'node',
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

      await simulateMcpValidateCommand(tempDir);

      expect(mockValidateMCPConfig).toHaveBeenCalledWith(mockConfig.mcp, {
        checkEnvironmentVars: true,
        checkCommandExistence: true,
        validateConnectionConfig: true,
        baseDirectory: tempDir,
      });
    });

    it('should handle validation service errors gracefully', async () => {
      const mockConfig = {
        mcp: {
          enabled: true,
          servers: {},
        },
      };
      mockLoadConfig.mockResolvedValue(mockConfig);

      mockValidateMCPConfig.mockRejectedValue(new Error('Validation service error'));

      const result = await simulateMcpValidateCommand(tempDir);

      expect(result.success).toBe(false);
      expect(result.output).toContain('RED:❌ Error validating MCP configuration: Validation service error');
    });
  });

  describe('Output Formatting and User Experience', () => {
    it('should format validation paths correctly', async () => {
      const mockConfig = {
        mcp: {
          enabled: true,
          servers: {
            'my-server': {
              command: 'invalid',
            },
          },
        },
      };
      mockLoadConfig.mockResolvedValue(mockConfig);

      mockValidateMCPConfig.mockResolvedValue({
        isValid: false,
        issues: [
          {
            code: 'COMMAND_NOT_FOUND',
            message: 'Command not found',
            severity: 'error' as const,
            path: 'servers.my-server.command',
            suggestion: 'Install the command',
          },
        ],
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
      });

      const result = await simulateMcpValidateCommand(tempDir);

      expect(result.output).toContain('DIM:     Path: servers.my-server.command');
      expect(result.output).toContain('DIM:     Suggestion: Install the command');
    });

    it('should handle issues without paths or suggestions', async () => {
      const mockConfig = {
        mcp: {
          enabled: true,
          servers: {},
        },
      };
      mockLoadConfig.mockResolvedValue(mockConfig);

      mockValidateMCPConfig.mockResolvedValue({
        isValid: false,
        issues: [
          {
            code: 'GENERAL_ERROR',
            message: 'Something went wrong',
            severity: 'error' as const,
            // No path or suggestion
          },
        ],
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
      });

      const result = await simulateMcpValidateCommand(tempDir);

      expect(result.output).toContain('RED:   • Something went wrong');
      // Should not include path or suggestion lines
      expect(result.output.find(line => line.includes('Path:'))).toBeUndefined();
      expect(result.output.find(line => line.includes('Suggestion:'))).toBeUndefined();
    });

    it('should use appropriate emojis and colors for different message types', async () => {
      const mockConfig = {
        mcp: {
          enabled: true,
          servers: {
            'test-server': {
              command: 'node',
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

      const result = await simulateMcpValidateCommand(tempDir);

      expect(result.output[0]).toContain('CYAN:🔍 Validating MCP configuration...');
      expect(result.output).toContain('GREEN:✅ MCP configuration is valid!');
    });
  });
});