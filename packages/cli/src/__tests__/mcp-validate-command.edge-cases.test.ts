/**
 * @fileoverview Edge case tests for 'apex mcp validate' CLI command
 *
 * Tests edge cases, error conditions, and unusual configurations
 * for the MCP validation command to ensure robust error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { validateMCPConfig, loadConfig } from '@apex/core';

// Mock dependencies
vi.mock('@apex/core');
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

// Simulate CLI command for edge case testing
async function simulateEdgeCaseMcpValidate(workingDirectory: string): Promise<{
  success: boolean;
  output: string[];
  error?: Error;
}> {
  const output: string[] = [];
  let caughtError: Error | undefined;

  const originalConsoleLog = console.log;
  console.log = (...args: any[]) => {
    output.push(args.join(' '));
  };

  try {
    output.push(chalk.cyan('🔍 Validating MCP configuration...'));

    const config = await loadConfig(workingDirectory);
    const mcpConfig = config.mcp || { enabled: false, servers: {} };

    const validationResult = await validateMCPConfig(mcpConfig, {
      checkEnvironmentVars: true,
      checkCommandExistence: true,
      validateConnectionConfig: true,
      baseDirectory: workingDirectory,
    });

    if (validationResult.isValid) {
      output.push(chalk.green('✅ MCP configuration is valid!'));
      if (!config.mcp?.enabled) {
        output.push(chalk.gray('Note: MCP is currently disabled in configuration'));
      }
    } else {
      output.push(chalk.red('❌ MCP configuration has validation errors:'));
      // Error formatting logic...
    }

    return { success: validationResult.isValid, output };
  } catch (error) {
    caughtError = error as Error;
    output.push(chalk.red(`❌ Error validating MCP configuration: ${(error as Error).message}`));
    return { success: false, output, error: caughtError };
  } finally {
    console.log = originalConsoleLog;
  }
}

describe('MCP Validate Command Edge Cases', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-mcp-edge-test-'));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    vi.restoreAllMocks();
  });

  describe('Configuration File Edge Cases', () => {
    it('should handle missing .apex directory', async () => {
      mockLoadConfig.mockRejectedValue(new Error('ENOENT: no such file or directory, open \'.apex/config.yaml\''));

      const result = await simulateEdgeCaseMcpValidate(tempDir);

      expect(result.success).toBe(false);
      expect(result.output).toContain('RED:❌ Error validating MCP configuration: ENOENT: no such file or directory, open \'.apex/config.yaml\'');
    });

    it('should handle corrupted configuration file', async () => {
      mockLoadConfig.mockRejectedValue(new Error('Invalid YAML syntax at line 5: unexpected token'));

      const result = await simulateEdgeCaseMcpValidate(tempDir);

      expect(result.success).toBe(false);
      expect(result.output).toContain('RED:❌ Error validating MCP configuration: Invalid YAML syntax at line 5: unexpected token');
    });

    it('should handle permission errors when reading config', async () => {
      mockLoadConfig.mockRejectedValue(new Error('EACCES: permission denied, open \'.apex/config.yaml\''));

      const result = await simulateEdgeCaseMcpValidate(tempDir);

      expect(result.success).toBe(false);
      expect(result.output).toContain('RED:❌ Error validating MCP configuration: EACCES: permission denied, open \'.apex/config.yaml\'');
    });

    it('should handle extremely large configuration files', async () => {
      // Simulate a very large config with many servers
      const largeConfig = {
        mcp: {
          enabled: true,
          servers: {} as Record<string, any>,
        },
      };

      // Create 1000 servers
      for (let i = 0; i < 1000; i++) {
        largeConfig.mcp.servers[`server-${i}`] = {
          command: 'node',
          args: [`server-${i}.js`],
        };
      }

      mockLoadConfig.mockResolvedValue(largeConfig);

      // Mock validation to simulate timeout or memory issues
      mockValidateMCPConfig.mockRejectedValue(new Error('Validation timeout: configuration too large'));

      const result = await simulateEdgeCaseMcpValidate(tempDir);

      expect(result.success).toBe(false);
      expect(result.output).toContain('RED:❌ Error validating MCP configuration: Validation timeout: configuration too large');
    });
  });

  describe('Validation Service Edge Cases', () => {
    it('should handle validation service crashes', async () => {
      mockLoadConfig.mockResolvedValue({
        mcp: { enabled: true, servers: {} },
      });

      mockValidateMCPConfig.mockRejectedValue(new Error('Segmentation fault in validation service'));

      const result = await simulateEdgeCaseMcpValidate(tempDir);

      expect(result.success).toBe(false);
      expect(result.output).toContain('RED:❌ Error validating MCP configuration: Segmentation fault in validation service');
    });

    it('should handle network-related validation errors', async () => {
      mockLoadConfig.mockResolvedValue({
        mcp: {
          enabled: true,
          servers: {
            'remote-server': {
              command: 'http://remote-server.com/mcp-server',
            },
          },
        },
      });

      mockValidateMCPConfig.mockRejectedValue(new Error('Network unreachable: unable to validate remote server'));

      const result = await simulateEdgeCaseMcpValidate(tempDir);

      expect(result.success).toBe(false);
      expect(result.output).toContain('RED:❌ Error validating MCP configuration: Network unreachable: unable to validate remote server');
    });

    it('should handle validation service returning malformed results', async () => {
      mockLoadConfig.mockResolvedValue({
        mcp: { enabled: true, servers: {} },
      });

      // Mock validation returning invalid structure
      mockValidateMCPConfig.mockResolvedValue({
        // Missing required fields
        issues: [],
      } as any);

      // This should cause an error when trying to access missing fields
      const result = await simulateEdgeCaseMcpValidate(tempDir);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Extreme Configuration Edge Cases', () => {
    it('should handle configuration with null/undefined values', async () => {
      mockLoadConfig.mockResolvedValue({
        mcp: null,
      } as any);

      mockValidateMCPConfig.mockResolvedValue({
        isValid: false,
        issues: [
          {
            code: 'NULL_CONFIG',
            message: 'MCP configuration is null',
            severity: 'error' as const,
          },
        ],
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
      });

      const result = await simulateEdgeCaseMcpValidate(tempDir);

      expect(result.success).toBe(false);
      expect(mockValidateMCPConfig).toHaveBeenCalledWith(
        { enabled: false, servers: {} }, // Should default when config.mcp is null
        expect.any(Object)
      );
    });

    it('should handle configuration with circular references', async () => {
      mockLoadConfig.mockRejectedValue(new Error('Converting circular structure to JSON'));

      const result = await simulateEdgeCaseMcpValidate(tempDir);

      expect(result.success).toBe(false);
      expect(result.output).toContain('RED:❌ Error validating MCP configuration: Converting circular structure to JSON');
    });

    it('should handle Unicode and special characters in configuration', async () => {
      mockLoadConfig.mockResolvedValue({
        mcp: {
          enabled: true,
          servers: {
            '🔥-server-🚀': {
              command: 'node',
              description: 'Server with émojis and spéciál chàracters',
            },
          },
        },
      });

      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });

      const result = await simulateEdgeCaseMcpValidate(tempDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('GREEN:✅ MCP configuration is valid!');
    });
  });

  describe('System Resource Edge Cases', () => {
    it('should handle out-of-memory conditions during validation', async () => {
      mockLoadConfig.mockResolvedValue({
        mcp: { enabled: true, servers: {} },
      });

      mockValidateMCPConfig.mockRejectedValue(new Error('JavaScript heap out of memory'));

      const result = await simulateEdgeCaseMcpValidate(tempDir);

      expect(result.success).toBe(false);
      expect(result.output).toContain('RED:❌ Error validating MCP configuration: JavaScript heap out of memory');
    });

    it('should handle filesystem permission issues', async () => {
      mockLoadConfig.mockResolvedValue({
        mcp: {
          enabled: true,
          servers: {
            'restricted-server': {
              command: '/usr/local/restricted/server',
            },
          },
        },
      });

      mockValidateMCPConfig.mockRejectedValue(new Error('EACCES: permission denied, access \'/usr/local/restricted/server\''));

      const result = await simulateEdgeCaseMcpValidate(tempDir);

      expect(result.success).toBe(false);
      expect(result.output).toContain('RED:❌ Error validating MCP configuration: EACCES: permission denied, access \'/usr/local/restricted/server\'');
    });
  });

  describe('Working Directory Edge Cases', () => {
    it('should handle relative paths correctly', async () => {
      const relativeDir = './relative-test-dir';

      mockLoadConfig.mockResolvedValue({
        mcp: {
          enabled: true,
          servers: {
            'relative-server': {
              command: './relative-command',
            },
          },
        },
      });

      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });

      const result = await simulateEdgeCaseMcpValidate(relativeDir);

      expect(result.success).toBe(true);
      expect(mockValidateMCPConfig).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          baseDirectory: relativeDir,
        })
      );
    });

    it('should handle non-existent working directories', async () => {
      const nonExistentDir = '/non/existent/directory/path';

      mockLoadConfig.mockRejectedValue(new Error('ENOENT: no such file or directory, chdir \'/non/existent/directory/path\''));

      const result = await simulateEdgeCaseMcpValidate(nonExistentDir);

      expect(result.success).toBe(false);
      expect(result.output).toContain('RED:❌ Error validating MCP configuration: ENOENT: no such file or directory, chdir \'/non/existent/directory/path\'');
    });

    it('should handle working directory with special characters', async () => {
      const specialDir = '/tmp/test with spaces & symbols!@#$%';

      mockLoadConfig.mockResolvedValue({
        mcp: { enabled: false, servers: {} },
      });

      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });

      const result = await simulateEdgeCaseMcpValidate(specialDir);

      expect(result.success).toBe(true);
      expect(mockValidateMCPConfig).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          baseDirectory: specialDir,
        })
      );
    });
  });

  describe('Concurrent Validation Edge Cases', () => {
    it('should handle multiple concurrent validation calls', async () => {
      mockLoadConfig.mockResolvedValue({
        mcp: { enabled: true, servers: {} },
      });

      let validationCallCount = 0;
      mockValidateMCPConfig.mockImplementation(async () => {
        validationCallCount++;
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          isValid: true,
          issues: [],
          errorCount: 0,
          warningCount: 0,
          infoCount: 0,
        };
      });

      // Run multiple validations concurrently
      const results = await Promise.all([
        simulateEdgeCaseMcpValidate(tempDir),
        simulateEdgeCaseMcpValidate(tempDir),
        simulateEdgeCaseMcpValidate(tempDir),
      ]);

      expect(validationCallCount).toBe(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle validation interruption/cancellation', async () => {
      mockLoadConfig.mockResolvedValue({
        mcp: { enabled: true, servers: {} },
      });

      // Mock a long-running validation that gets cancelled
      let cancelled = false;
      mockValidateMCPConfig.mockImplementation(async () => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            if (cancelled) {
              reject(new Error('Validation cancelled'));
            } else {
              resolve({
                isValid: true,
                issues: [],
                errorCount: 0,
                warningCount: 0,
                infoCount: 0,
              });
            }
          }, 100);

          // Simulate cancellation after 50ms
          setTimeout(() => {
            cancelled = true;
            clearTimeout(timeout);
          }, 50);
        });
      });

      const result = await simulateEdgeCaseMcpValidate(tempDir);

      expect(result.success).toBe(false);
      expect(result.output).toContain('RED:❌ Error validating MCP configuration: Validation cancelled');
    });
  });
});