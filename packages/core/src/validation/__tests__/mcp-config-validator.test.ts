/**
 * @fileoverview Tests for MCPConfigValidator
 *
 * Comprehensive test suite for MCP configuration validation including:
 * - JSON structure validation
 * - Required field validation
 * - Environment variable checking
 * - Command existence validation
 * - Error message accuracy and actionability
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execSync } from 'child_process';
import { access, constants } from 'fs/promises';
import {
  MCPConfigValidator,
  validateMCPConfig,
  validateMCPConfigStructure,
  type MCPValidationOptions,
  type MCPValidationResult,
  type ValidationIssue,
} from '../mcp-config-validator.js';

// Mock external dependencies
vi.mock('child_process');
vi.mock('fs/promises');

const mockExecSync = vi.mocked(execSync);
const mockAccess = vi.mocked(access);

describe('MCPConfigValidator', () => {
  let validator: MCPConfigValidator;

  beforeEach(() => {
    validator = new MCPConfigValidator();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Structure Validation', () => {
    it('should validate valid MCP configuration structure', () => {
      const validConfig = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'node',
            args: ['server.js'],
            enabled: true,
          },
        },
      };

      const result = validator.validateStructure(validConfig);

      expect(result.issues).toHaveLength(0);
      expect(result.parsedConfig).toBeDefined();
      expect(result.parsedConfig?.enabled).toBe(true);
    });

    it('should reject invalid configuration structure', () => {
      const invalidConfig = {
        enabled: 'not-a-boolean', // Should be boolean
        servers: {
          'test-server': {
            // Missing required 'command' field
            args: ['server.js'],
          },
        },
      };

      const result = validator.validateStructure(invalidConfig);

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.parsedConfig).toBeNull();
      expect(result.issues[0].severity).toBe('error');
      expect(result.issues[0].code).toBe('SCHEMA_VALIDATION_ERROR');
    });

    it('should handle malformed JSON input', () => {
      const result = validator.validateStructure(null);

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].code).toBe('SCHEMA_VALIDATION_ERROR');
      expect(result.issues[0].severity).toBe('error');
      expect(result.parsedConfig).toBeNull();
    });

    it('should provide helpful error messages for schema violations', () => {
      const invalidConfig = {
        enabled: true,
        servers: {
          'test-server': {
            command: '', // Empty string should fail minimum length validation
          },
        },
      };

      const result = validator.validateStructure(invalidConfig);

      expect(result.issues.length).toBeGreaterThan(0);
      const commandIssue = result.issues.find(i => i.path?.includes('command'));
      expect(commandIssue).toBeDefined();
      expect(commandIssue?.suggestion).toBeDefined();
    });
  });

  describe('Configuration Logic Validation', () => {
    it('should warn when MCP is enabled but no servers configured', async () => {
      const config = {
        enabled: true,
        servers: {},
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'NO_SERVERS_CONFIGURED')).toBe(true);
      expect(result.warningCount).toBeGreaterThan(0);
    });

    it('should not warn when MCP is disabled with no servers', async () => {
      const config = {
        enabled: false,
        servers: {},
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'NO_SERVERS_CONFIGURED')).toBe(false);
    });

    it('should validate global connection configuration', async () => {
      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'node',
          },
        },
        connection: {
          timeout: 500, // Too low
          maxRetries: 3,
          retryDelay: 1000,
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'TIMEOUT_TOO_LOW')).toBe(true);
    });
  });

  describe('Server Configuration Validation', () => {
    it('should require command field for servers', async () => {
      const config = {
        enabled: true,
        servers: {
          'test-server': {
            args: ['server.js'],
            // Missing required 'command' field
          },
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'MISSING_COMMAND')).toBe(true);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('should validate server connection configuration', async () => {
      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'node',
            connection: {
              maxConcurrentConnections: 200, // Very high
            },
          },
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'MAX_CONNECTIONS_HIGH')).toBe(true);
    });

    it('should provide info about autoStart disabled but enabled', async () => {
      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'node',
            enabled: true,
            autoStart: false,
          },
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'AUTOSTART_DISABLED_BUT_ENABLED')).toBe(true);
      expect(result.infoCount).toBeGreaterThan(0);
    });
  });

  describe('Command Existence Validation', () => {
    beforeEach(() => {
      // Reset mocks
      mockExecSync.mockReset();
      mockAccess.mockReset();
    });

    it('should validate system commands in PATH', async () => {
      // Mock successful command check
      mockExecSync.mockReturnValue(Buffer.from('/usr/bin/node'));

      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'node',
          },
        },
      };

      const result = await validator.validate(config);

      expect(mockExecSync).toHaveBeenCalledWith('which node', { stdio: 'ignore' });
      expect(result.issues.some(i => i.code === 'COMMAND_NOT_FOUND')).toBe(false);
    });

    it('should report missing system commands', async () => {
      // Mock command not found
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'nonexistent-command',
          },
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'COMMAND_NOT_FOUND')).toBe(true);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('should validate file path executables', async () => {
      // Mock successful file access
      mockAccess.mockResolvedValue(undefined);

      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: '/usr/local/bin/my-server',
          },
        },
      };

      const result = await validator.validate(config);

      expect(mockAccess).toHaveBeenCalledWith(
        '/usr/local/bin/my-server',
        constants.F_OK | constants.X_OK
      );
      expect(result.issues.some(i => i.code === 'EXECUTABLE_NOT_FOUND')).toBe(false);
    });

    it('should report inaccessible executables', async () => {
      // Mock file access failure
      mockAccess.mockRejectedValue(new Error('File not found'));

      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: '/nonexistent/path/server',
          },
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'EXECUTABLE_NOT_FOUND')).toBe(true);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('should skip command validation when disabled', async () => {
      const validator = new MCPConfigValidator({ checkCommandExistence: false });

      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'nonexistent-command',
          },
        },
      };

      const result = await validator.validate(config);

      expect(mockExecSync).not.toHaveBeenCalled();
      expect(result.issues.some(i => i.code === 'COMMAND_NOT_FOUND')).toBe(false);
    });
  });

  describe('Environment Variable Validation', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Clean environment for predictable tests
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should validate required environment variables exist', async () => {
      process.env.TEST_VAR = 'test-value';

      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'node',
            envVars: [
              {
                name: 'TEST_VAR',
                required: true,
                description: 'Test variable',
              },
            ],
          },
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'REQUIRED_ENV_VAR_MISSING')).toBe(false);
    });

    it('should report missing required environment variables', async () => {
      delete process.env.MISSING_VAR;

      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'node',
            envVars: [
              {
                name: 'MISSING_VAR',
                required: true,
                description: 'This variable is required',
              },
            ],
          },
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'REQUIRED_ENV_VAR_MISSING')).toBe(true);
      expect(result.errorCount).toBeGreaterThan(0);

      const envIssue = result.issues.find(i => i.code === 'REQUIRED_ENV_VAR_MISSING');
      expect(envIssue?.suggestion).toContain('This variable is required');
    });

    it('should handle additional environment variables', async () => {
      const validator = new MCPConfigValidator({
        additionalEnvVars: ['ADDITIONAL_VAR'],
      });

      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'node',
            envVars: [
              {
                name: 'ADDITIONAL_VAR',
                required: true,
              },
            ],
          },
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'REQUIRED_ENV_VAR_MISSING')).toBe(false);
    });

    it('should skip environment variable validation when disabled', async () => {
      const validator = new MCPConfigValidator({ checkEnvironmentVars: false });

      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'node',
            envVars: [
              {
                name: 'MISSING_VAR',
                required: true,
              },
            ],
          },
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'REQUIRED_ENV_VAR_MISSING')).toBe(false);
    });
  });

  describe('Validation Result Structure', () => {
    it('should provide correct counts in validation result', async () => {
      const config = {
        enabled: true,
        servers: {
          'server1': {
            command: 'nonexistent-command', // Error
            connection: { timeout: 500 }, // Warning
            autoStart: false, // Info
          },
        },
      };

      // Mock command not found
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      const result = await validator.validate(config);

      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.warningCount).toBeGreaterThan(0);
      expect(result.infoCount).toBeGreaterThan(0);
      expect(result.isValid).toBe(false);
    });

    it('should mark configuration as valid when no errors', async () => {
      // Mock successful command check
      mockExecSync.mockReturnValue(Buffer.from('/usr/bin/node'));

      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'node',
            args: ['server.js'],
          },
        },
      };

      const result = await validator.validate(config);

      expect(result.errorCount).toBe(0);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Convenience Functions', () => {
    it('should work with validateMCPConfig function', async () => {
      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'node',
          },
        },
      };

      const result = await validateMCPConfig(config, { checkCommandExistence: false });

      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
      expect(result.issues).toBeInstanceOf(Array);
    });

    it('should work with validateMCPConfigStructure function', () => {
      const config = {
        enabled: true,
        servers: {},
      };

      const result = validateMCPConfigStructure(config);

      expect(result).toBeDefined();
      expect(result.issues).toBeInstanceOf(Array);
      expect(result.parsedConfig).toBeDefined();
    });
  });

  describe('Error Messages and Suggestions', () => {
    it('should provide actionable suggestions for common errors', async () => {
      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'nonexistent-command',
            envVars: [
              {
                name: 'MISSING_VAR',
                required: true,
                description: 'Important configuration variable',
              },
            ],
          },
        },
      };

      // Mock command not found
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      const result = await validator.validate(config);

      // Check that error messages include helpful suggestions
      for (const issue of result.issues) {
        if (issue.severity === 'error') {
          expect(issue.suggestion).toBeDefined();
          expect(issue.suggestion!.length).toBeGreaterThan(10); // Meaningful suggestion
        }
      }
    });

    it('should include configuration paths in error messages', async () => {
      const config = {
        enabled: true,
        servers: {
          'my-server': {
            command: 'nonexistent',
          },
        },
      };

      // Mock command not found
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      const result = await validator.validate(config);

      const commandIssue = result.issues.find(i => i.code === 'COMMAND_NOT_FOUND');
      expect(commandIssue?.path).toBe('servers.my-server.command');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty configuration object', async () => {
      const result = await validator.validate({});

      expect(result).toBeDefined();
      expect(result.issues.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle configuration with null values', async () => {
      const config = {
        enabled: null,
        servers: null,
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
    });

    it('should handle very large configurations', async () => {
      const servers: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        servers[`server-${i}`] = {
          command: 'node',
          args: [`server-${i}.js`],
        };
      }

      const config = {
        enabled: true,
        servers,
      };

      const result = await validator.validate(config);

      expect(result).toBeDefined();
      // Should complete in reasonable time
    });
  });
});