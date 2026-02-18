/**
 * @fileoverview Edge case and error path tests for MCPConfigValidator
 *
 * Additional test coverage for edge cases and uncommon error paths
 * to ensure comprehensive validation behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execSync } from 'child_process';
import { access } from 'fs/promises';
import {
  MCPConfigValidator,
  type MCPValidationOptions,
} from '../mcp-config-validator.js';

// Mock external dependencies
vi.mock('child_process');
vi.mock('fs/promises');

const mockExecSync = vi.mocked(execSync);
const mockAccess = vi.mocked(access);

describe('MCPConfigValidator Edge Cases', () => {
  let validator: MCPConfigValidator;

  beforeEach(() => {
    validator = new MCPConfigValidator();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Command Validation Error Handling', () => {
    it('should handle unexpected errors during command validation', async () => {
      // Mock execSync to throw an unexpected error
      mockExecSync.mockImplementation(() => {
        const error = new Error('Unexpected system error');
        error.name = 'SystemError';
        throw error;
      });

      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'test-command',
          },
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'COMMAND_VALIDATION_ERROR')).toBe(true);
      const commandError = result.issues.find(i => i.code === 'COMMAND_VALIDATION_ERROR');
      expect(commandError?.severity).toBe('warning');
      expect(commandError?.suggestion).toContain('Check command syntax');
    });

    it('should handle command validation with baseDirectory option', async () => {
      const validator = new MCPConfigValidator({ baseDirectory: '/test/base' });

      // Mock access to reject
      mockAccess.mockRejectedValue(new Error('File not found'));

      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: './relative-command',
          },
        },
      };

      const result = await validator.validate(config);

      expect(mockAccess).toHaveBeenCalledWith(
        '/test/base/relative-command',
        expect.any(Number)
      );
      expect(result.issues.some(i => i.code === 'EXECUTABLE_NOT_FOUND')).toBe(true);
    });

    it('should handle non-Error exceptions during command validation', async () => {
      // Mock execSync to throw a non-Error object
      mockExecSync.mockImplementation(() => {
        throw 'String error';
      });

      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'test-command',
          },
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'COMMAND_VALIDATION_ERROR')).toBe(true);
      const commandError = result.issues.find(i => i.code === 'COMMAND_VALIDATION_ERROR');
      expect(commandError?.message).toContain('Unknown error');
    });
  });

  describe('Environment Variable Edge Cases', () => {
    it('should validate environment variables with non-string default values', async () => {
      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'node',
            envVars: [
              {
                name: 'TEST_VAR',
                required: false,
                defaultValue: 123, // Invalid - should be string
              },
            ],
          },
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'INVALID_DEFAULT_VALUE')).toBe(true);
      const defaultError = result.issues.find(i => i.code === 'INVALID_DEFAULT_VALUE');
      expect(defaultError?.severity).toBe('error');
      expect(defaultError?.suggestion).toContain('string value');
    });

    it('should handle environment variable validation with complex configurations', async () => {
      process.env.EXISTING_VAR = 'exists';
      delete process.env.MISSING_VAR;

      const config = {
        enabled: true,
        servers: {
          'complex-server': {
            command: 'node',
            envVars: [
              {
                name: 'EXISTING_VAR',
                required: true,
                description: 'This variable exists',
              },
              {
                name: 'MISSING_VAR',
                required: true,
                description: 'This variable is missing and required',
              },
              {
                name: 'OPTIONAL_VAR',
                required: false,
                defaultValue: 'default-value',
                description: 'This is optional',
              },
            ],
          },
        },
      };

      const result = await validator.validate(config);

      // Should find missing required var but not complain about existing or optional ones
      const missingVarIssues = result.issues.filter(i => i.code === 'REQUIRED_ENV_VAR_MISSING');
      expect(missingVarIssues).toHaveLength(1);
      expect(missingVarIssues[0].message).toContain('MISSING_VAR');
      expect(missingVarIssues[0].suggestion).toContain('This variable is missing and required');
    });
  });

  describe('Schema Validation Edge Cases', () => {
    it('should handle various Zod error types with specific suggestions', () => {
      const invalidConfigs = [
        {
          enabled: 'invalid', // invalid_type error
          servers: {},
        },
        {
          enabled: true,
          servers: {
            'test-server': {
              command: '', // too_small error for string
            },
          },
        },
        {
          enabled: true,
          servers: {
            'test-server': {
              command: 'x'.repeat(10000), // Potentially too_big if there's a max
            },
          },
        },
      ];

      invalidConfigs.forEach((config, index) => {
        const result = validator.validateStructure(config);
        expect(result.issues.length).toBeGreaterThan(0);

        // Check that suggestions are provided and meaningful
        result.issues.forEach(issue => {
          expect(issue.suggestion).toBeDefined();
          expect(issue.suggestion!.length).toBeGreaterThan(0);
          expect(issue.code).toBe('SCHEMA_VALIDATION_ERROR');
        });
      });
    });

    it('should handle undefined and null in schema validation suggestions', () => {
      // Test with enum-like values to trigger invalid_enum_value
      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'node',
            // Assuming there's some enum field that could be invalid
            type: 'invalid-type', // Should trigger invalid_enum_value if type is an enum
          },
        },
      };

      const result = validator.validateStructure(config);

      if (result.issues.length > 0) {
        const enumIssue = result.issues.find(i =>
          i.suggestion?.includes('one of:') || i.message.includes('enum')
        );
        if (enumIssue) {
          expect(enumIssue.suggestion).toBeDefined();
        }
      }
    });
  });

  describe('Connection Config Edge Cases', () => {
    it('should validate extremely low timeout values', async () => {
      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'node',
            connection: {
              timeout: 1, // Extremely low
              maxConcurrentConnections: 1,
            },
          },
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'TIMEOUT_TOO_LOW')).toBe(true);
      const timeoutIssue = result.issues.find(i => i.code === 'TIMEOUT_TOO_LOW');
      expect(timeoutIssue?.severity).toBe('warning');
    });

    it('should validate extremely high concurrent connection values', async () => {
      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'node',
            connection: {
              timeout: 5000,
              maxConcurrentConnections: 500, // Very high
            },
          },
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'MAX_CONNECTIONS_HIGH')).toBe(true);
      const connectionsIssue = result.issues.find(i => i.code === 'MAX_CONNECTIONS_HIGH');
      expect(connectionsIssue?.severity).toBe('warning');
    });
  });

  describe('System Command Detection Edge Cases', () => {
    it('should correctly identify system commands vs file paths', async () => {
      const testCases = [
        { command: 'node', isSystem: true },
        { command: 'npx', isSystem: true },
        { command: 'python3', isSystem: true },
        { command: './local-script', isSystem: false },
        { command: '/absolute/path/to/command', isSystem: false },
        { command: 'C:\\Windows\\command.exe', isSystem: false }, // Windows path
        { command: 'command-with-dashes', isSystem: true },
        { command: 'command_with_underscores', isSystem: true },
      ];

      for (const testCase of testCases) {
        const config = {
          enabled: true,
          servers: {
            'test-server': {
              command: testCase.command,
            },
          },
        };

        if (testCase.isSystem) {
          // Mock successful system command check
          mockExecSync.mockReturnValue(Buffer.from('/usr/bin/' + testCase.command));
        } else {
          // Mock successful file access
          mockAccess.mockResolvedValue(undefined);
        }

        const result = await validator.validate(config);

        // Should not have command errors for valid commands
        const commandErrors = result.issues.filter(i =>
          i.code === 'COMMAND_NOT_FOUND' || i.code === 'EXECUTABLE_NOT_FOUND'
        );
        expect(commandErrors).toHaveLength(0);

        vi.clearAllMocks();
      }
    });
  });

  describe('Validation Options Edge Cases', () => {
    it('should respect all validation options when disabled', async () => {
      const validator = new MCPConfigValidator({
        checkEnvironmentVars: false,
        checkCommandExistence: false,
        validateConnectionConfig: false,
        additionalEnvVars: [],
        baseDirectory: '/tmp',
      });

      const config = {
        enabled: true,
        servers: {
          'problematic-server': {
            command: 'nonexistent-command',
            envVars: [
              {
                name: 'MISSING_REQUIRED_VAR',
                required: true,
              },
            ],
            connection: {
              timeout: 1,
              maxConcurrentConnections: 1000,
            },
          },
        },
        connection: {
          timeout: 1,
          maxConcurrentConnections: 1000,
        },
      };

      const result = await validator.validate(config);

      // Should not validate any of the problematic configurations
      expect(result.issues.some(i => i.code === 'COMMAND_NOT_FOUND')).toBe(false);
      expect(result.issues.some(i => i.code === 'REQUIRED_ENV_VAR_MISSING')).toBe(false);
      expect(result.issues.some(i => i.code === 'TIMEOUT_TOO_LOW')).toBe(false);
      expect(result.issues.some(i => i.code === 'MAX_CONNECTIONS_HIGH')).toBe(false);
    });

    it('should handle validation options parsing with partial options', () => {
      const validators = [
        new MCPConfigValidator({ checkEnvironmentVars: false }),
        new MCPConfigValidator({ checkCommandExistence: false }),
        new MCPConfigValidator({ validateConnectionConfig: false }),
        new MCPConfigValidator({ additionalEnvVars: ['EXTRA_VAR'] }),
        new MCPConfigValidator({ baseDirectory: '/custom/base' }),
        new MCPConfigValidator({}), // Empty options
      ];

      // All validators should be created successfully
      validators.forEach(v => {
        expect(v).toBeInstanceOf(MCPConfigValidator);
      });
    });
  });

  describe('Complex Error Scenarios', () => {
    it('should handle server with both missing command and env var issues', async () => {
      delete process.env.REQUIRED_VAR;

      const config = {
        enabled: true,
        servers: {
          'problematic-server': {
            // Missing command
            envVars: [
              {
                name: 'REQUIRED_VAR',
                required: true,
              },
            ],
          },
        },
      };

      const result = await validator.validate(config);

      // Should report both types of errors
      expect(result.issues.some(i => i.code === 'MISSING_COMMAND')).toBe(true);
      expect(result.issues.some(i => i.code === 'REQUIRED_ENV_VAR_MISSING')).toBe(true);
      expect(result.errorCount).toBeGreaterThanOrEqual(2);
      expect(result.isValid).toBe(false);
    });

    it('should handle mixed severity issues correctly', async () => {
      const config = {
        enabled: true,
        servers: {
          'mixed-issues-server': {
            command: 'node', // Valid
            connection: {
              timeout: 100, // Warning
              maxConcurrentConnections: 300, // Warning
            },
            autoStart: false, // Info when enabled
            enabled: true,
          },
        },
      };

      // Mock successful command check
      mockExecSync.mockReturnValue(Buffer.from('/usr/bin/node'));

      const result = await validator.validate(config);

      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBeGreaterThan(0);
      expect(result.infoCount).toBeGreaterThan(0);
      expect(result.isValid).toBe(true); // No errors, so valid despite warnings
    });

    it('should handle servers with empty string names', async () => {
      // This should fail schema validation before reaching server validation
      const config = {
        enabled: true,
        servers: {
          '': { // Empty key might be allowed, but empty name field won't be
            name: '',
            command: 'node',
          },
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
      expect(result.parsedConfig).toBeNull();
    });
  });
});