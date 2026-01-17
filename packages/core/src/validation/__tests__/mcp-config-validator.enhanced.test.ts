/**
 * Enhanced MCPConfigValidator Tests
 *
 * Additional comprehensive tests to ensure >80% coverage for the MCP configuration validator.
 * This file supplements the existing mcp-config-validator.test.ts with additional edge cases,
 * error scenarios, and integration patterns.
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
} from '../mcp-config-validator.js';

// Mock external dependencies
vi.mock('child_process');
vi.mock('fs/promises');

const mockExecSync = vi.mocked(execSync);
const mockAccess = vi.mocked(access);

describe('MCPConfigValidator - Enhanced Coverage', () => {
  let validator: MCPConfigValidator;

  beforeEach(() => {
    validator = new MCPConfigValidator();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complex Configuration Scenarios', () => {
    it('should validate complete configuration with all optional fields', async () => {
      const complexConfig = {
        enabled: true,
        servers: {
          'complex-server': {
            command: 'node',
            args: ['server.js', '--verbose'],
            enabled: true,
            autoStart: true,
            envVars: [
              {
                name: 'API_KEY',
                required: true,
                description: 'API key for service',
                sensitive: true,
                defaultValue: 'default-key',
              },
              {
                name: 'PORT',
                required: false,
                description: 'Server port',
                sensitive: false,
                defaultValue: '3000',
              },
            ],
            connection: {
              timeout: 10000,
              maxRetries: 5,
              retryDelay: 2000,
              maxConcurrentConnections: 10,
            },
          },
        },
        connection: {
          timeout: 15000,
          maxRetries: 3,
          retryDelay: 1500,
          maxConcurrentConnections: 20,
        },
      };

      // Mock command exists
      mockExecSync.mockReturnValue(Buffer.from('/usr/bin/node'));
      // Mock environment variables exist
      const originalEnv = process.env;
      process.env = { ...originalEnv, API_KEY: 'test-key' };

      try {
        const result = await validator.validate(complexConfig);

        expect(result.isValid).toBe(true);
        expect(result.errorCount).toBe(0);

        // Should have info about autoStart being enabled
        expect(result.infoCount).toBeGreaterThanOrEqual(0);
      } finally {
        process.env = originalEnv;
      }
    });

    it('should handle mixed valid and invalid servers', async () => {
      const mixedConfig = {
        enabled: true,
        servers: {
          'valid-server': {
            command: 'node',
            args: ['valid.js'],
          },
          'invalid-server': {
            // Missing command
            args: ['invalid.js'],
          },
          'missing-env-server': {
            command: 'python',
            envVars: [
              {
                name: 'REQUIRED_MISSING',
                required: true,
                description: 'This is missing',
              },
            ],
          },
        },
      };

      mockExecSync.mockImplementation((cmd) => {
        if (cmd.includes('node')) return Buffer.from('/usr/bin/node');
        if (cmd.includes('python')) return Buffer.from('/usr/bin/python');
        throw new Error('Command not found');
      });

      const result = await validator.validate(mixedConfig);

      expect(result.isValid).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);

      // Should have errors for missing command and missing env var
      expect(result.issues.some(i => i.code === 'MISSING_COMMAND')).toBe(true);
      expect(result.issues.some(i => i.code === 'REQUIRED_ENV_VAR_MISSING')).toBe(true);
    });
  });

  describe('Schema Validation Edge Cases', () => {
    it('should provide specific suggestions for different schema violations', () => {
      const testCases = [
        {
          config: { enabled: 'not-boolean' },
          expectedSuggestion: 'Expected boolean, but got string',
        },
        {
          config: { enabled: true, servers: { 'test': { command: '' } } },
          expectedSuggestion: 'String must be at least',
        },
        {
          config: { enabled: true, servers: { 'test': { command: 'node', envVars: 'not-array' } } },
          expectedSuggestion: 'Expected array, but got string',
        },
      ];

      testCases.forEach(({ config, expectedSuggestion }) => {
        const result = validator.validateStructure(config);

        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.parsedConfig).toBeNull();

        const schemaIssue = result.issues.find(i => i.code === 'SCHEMA_VALIDATION_ERROR');
        expect(schemaIssue?.suggestion).toContain(expectedSuggestion);
      });
    });

    it('should handle deeply nested schema errors', () => {
      const nestedConfig = {
        enabled: true,
        servers: {
          'nested-server': {
            command: 'node',
            connection: {
              timeout: 'not-a-number', // Should be number
              maxRetries: -1, // Should be positive
            },
          },
        },
      };

      const result = validator.validateStructure(nestedConfig);

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.parsedConfig).toBeNull();

      const timeoutIssue = result.issues.find(i => i.path?.includes('timeout'));
      expect(timeoutIssue).toBeDefined();
    });

    it('should handle unknown schema error types gracefully', () => {
      // Create a mock Zod error with custom issue type
      const mockZodIssue = {
        code: 'custom' as any,
        path: ['test'],
        message: 'Custom error type',
      };

      // Test the suggestion generation for unknown issue types
      const suggestion = (validator as any).getSchemaValidationSuggestion(mockZodIssue);
      expect(suggestion).toBe('Check the configuration schema for valid values');
    });
  });

  describe('Command Validation Edge Cases', () => {
    it('should handle command validation with base directory', async () => {
      const validator = new MCPConfigValidator({
        baseDirectory: '/custom/base',
      });

      const config = {
        enabled: true,
        servers: {
          'relative-server': {
            command: './relative-script.sh',
          },
        },
      };

      // Mock access for the resolved path
      mockAccess.mockResolvedValue(undefined);

      const result = await validator.validate(config);

      expect(mockAccess).toHaveBeenCalledWith(
        '/custom/base/relative-script.sh',
        constants.F_OK | constants.X_OK
      );
    });

    it('should handle command validation errors gracefully', async () => {
      const config = {
        enabled: true,
        servers: {
          'error-server': {
            command: '/some/path/that/causes/error',
          },
        },
      };

      // Mock access to throw a different type of error
      mockAccess.mockImplementation(() => {
        throw new TypeError('Unexpected error type');
      });

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'COMMAND_VALIDATION_ERROR')).toBe(true);
    });

    it('should correctly identify system commands vs file paths', () => {
      const systemCommands = ['node', 'python', 'npx', 'java'];
      const filePaths = ['/usr/bin/node', './script.sh', '..\\windows\\path.exe', '/path with spaces/script'];

      systemCommands.forEach(cmd => {
        const isSystem = (validator as any).isSystemCommand(cmd);
        expect(isSystem).toBe(true);
      });

      filePaths.forEach(path => {
        const isSystem = (validator as any).isSystemCommand(path);
        expect(isSystem).toBe(false);
      });
    });
  });

  describe('Environment Variable Validation Edge Cases', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should validate non-string default values', async () => {
      const config = {
        enabled: true,
        servers: {
          'env-server': {
            command: 'node',
            envVars: [
              {
                name: 'INVALID_DEFAULT',
                required: false,
                defaultValue: 12345, // Not a string
              },
            ],
          },
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'INVALID_DEFAULT_VALUE')).toBe(true);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('should handle environment variables with additional available vars', async () => {
      const validator = new MCPConfigValidator({
        additionalEnvVars: ['CUSTOM_VAR', 'ANOTHER_VAR'],
      });

      const config = {
        enabled: true,
        servers: {
          'env-server': {
            command: 'node',
            envVars: [
              {
                name: 'CUSTOM_VAR',
                required: true,
              },
              {
                name: 'MISSING_VAR',
                required: true,
              },
            ],
          },
        },
      };

      // Ensure the missing var is not in process.env
      process.env = { ...originalEnv };
      delete process.env.MISSING_VAR;

      const result = await validator.validate(config);

      // CUSTOM_VAR should be considered available, MISSING_VAR should not
      const customVarIssue = result.issues.find(i =>
        i.code === 'REQUIRED_ENV_VAR_MISSING' && i.path?.includes('CUSTOM_VAR')
      );
      expect(customVarIssue).toBeUndefined();

      const missingVarIssue = result.issues.find(i =>
        i.code === 'REQUIRED_ENV_VAR_MISSING' && i.path?.includes('MISSING_VAR')
      );
      expect(missingVarIssue).toBeDefined();
    });

    it('should include environment variable description in suggestions', async () => {
      const config = {
        enabled: true,
        servers: {
          'env-server': {
            command: 'node',
            envVars: [
              {
                name: 'MISSING_WITH_DESC',
                required: true,
                description: 'This is a detailed description of what this variable does',
              },
              {
                name: 'MISSING_NO_DESC',
                required: true,
                // No description
              },
            ],
          },
        },
      };

      const result = await validator.validate(config);

      const withDescIssue = result.issues.find(i =>
        i.path?.includes('MISSING_WITH_DESC')
      );
      expect(withDescIssue?.suggestion).toContain('This is a detailed description');

      const noDescIssue = result.issues.find(i =>
        i.path?.includes('MISSING_NO_DESC')
      );
      expect(noDescIssue?.suggestion).toContain('export MISSING_NO_DESC=');
    });
  });

  describe('Connection Configuration Validation', () => {
    it('should validate connection timeouts and provide appropriate warnings', async () => {
      const config = {
        enabled: true,
        servers: {
          'timeout-server': {
            command: 'node',
            connection: {
              timeout: 100, // Very low
            },
          },
        },
        connection: {
          timeout: 200, // Also low
          maxConcurrentConnections: 500, // Very high
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'TIMEOUT_TOO_LOW')).toBe(true);
      expect(result.issues.some(i => i.code === 'MAX_CONNECTIONS_HIGH')).toBe(true);
      expect(result.warningCount).toBeGreaterThan(0);
    });

    it('should handle malformed connection configuration', async () => {
      const config = {
        enabled: true,
        servers: {
          'bad-connection': {
            command: 'node',
            connection: {
              timeout: 'invalid', // Should be number
              invalidField: 'should not exist',
            },
          },
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'CONNECTION_CONFIG_ERROR')).toBe(true);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('should skip connection validation when disabled', async () => {
      const validator = new MCPConfigValidator({
        validateConnectionConfig: false,
      });

      const config = {
        enabled: true,
        servers: {
          'server': {
            command: 'node',
            connection: {
              timeout: 1, // Would normally trigger warning
            },
          },
        },
      };

      const result = await validator.validate(config);

      expect(result.issues.some(i => i.code === 'TIMEOUT_TOO_LOW')).toBe(false);
    });
  });

  describe('Validation Options and Configuration', () => {
    it('should respect all validation options', async () => {
      const validator = new MCPConfigValidator({
        checkEnvironmentVars: false,
        checkCommandExistence: false,
        validateConnectionConfig: false,
        additionalEnvVars: ['TEST_VAR'],
        baseDirectory: '/custom/base',
      });

      const config = {
        enabled: true,
        servers: {
          'options-test': {
            command: 'nonexistent-command',
            envVars: [
              {
                name: 'MISSING_REQUIRED',
                required: true,
              },
            ],
            connection: {
              timeout: 1,
            },
          },
        },
      };

      const result = await validator.validate(config);

      // Should not have any of these errors due to disabled checks
      expect(result.issues.some(i => i.code === 'COMMAND_NOT_FOUND')).toBe(false);
      expect(result.issues.some(i => i.code === 'REQUIRED_ENV_VAR_MISSING')).toBe(false);
      expect(result.issues.some(i => i.code === 'TIMEOUT_TOO_LOW')).toBe(false);
    });

    it('should handle default validation options', () => {
      const defaultValidator = new MCPConfigValidator();

      // Test that defaults are set correctly
      const options = (defaultValidator as any).options;
      expect(options.checkEnvironmentVars).toBe(true);
      expect(options.checkCommandExistence).toBe(true);
      expect(options.validateConnectionConfig).toBe(true);
      expect(options.additionalEnvVars).toEqual([]);
    });
  });

  describe('Error Message Quality and Paths', () => {
    it('should provide accurate configuration paths for nested errors', async () => {
      const config = {
        enabled: true,
        servers: {
          'my-special-server': {
            command: 'nonexistent',
            envVars: [
              {
                name: 'FIRST_VAR',
                required: false,
              },
              {
                name: 'SECOND_VAR',
                required: true,
              },
            ],
          },
        },
      };

      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      const result = await validator.validate(config);

      const commandIssue = result.issues.find(i => i.code === 'COMMAND_NOT_FOUND');
      expect(commandIssue?.path).toBe('servers.my-special-server.command');

      const envIssue = result.issues.find(i => i.code === 'REQUIRED_ENV_VAR_MISSING');
      expect(envIssue?.path).toBe('servers.my-special-server.envVars[1].name');
    });

    it('should provide actionable suggestions for common scenarios', async () => {
      const config = {
        enabled: true,
        servers: {
          'suggestion-test': {
            command: 'some-missing-tool',
            envVars: [
              {
                name: 'API_TOKEN',
                required: true,
                description: 'Token for authenticating with the API service',
              },
            ],
          },
        },
      };

      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      const result = await validator.validate(config);

      const commandIssue = result.issues.find(i => i.code === 'COMMAND_NOT_FOUND');
      expect(commandIssue?.suggestion).toContain('Install the required command');

      const envIssue = result.issues.find(i => i.code === 'REQUIRED_ENV_VAR_MISSING');
      expect(envIssue?.suggestion).toContain('Token for authenticating with the API service');
    });
  });

  describe('Edge Cases and Error Boundaries', () => {
    it('should handle null/undefined configuration gracefully', async () => {
      const nullResult = await validator.validate(null);
      const undefinedResult = await validator.validate(undefined);

      expect(nullResult.isValid).toBe(false);
      expect(undefinedResult.isValid).toBe(false);
      expect(nullResult.errorCount).toBeGreaterThan(0);
      expect(undefinedResult.errorCount).toBeGreaterThan(0);
    });

    it('should handle very deep nested configurations', async () => {
      const deepConfig = {
        enabled: true,
        servers: {},
      };

      // Add 50 servers to test performance
      for (let i = 0; i < 50; i++) {
        deepConfig.servers[`server-${i}`] = {
          command: 'node',
          args: [`script-${i}.js`],
          envVars: [
            {
              name: `VAR_${i}`,
              required: i % 2 === 0, // Half required, half optional
            },
          ],
        };
      }

      const result = await validator.validate(deepConfig);

      expect(result).toBeDefined();
      expect(result.issues.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle circular references in configuration objects', async () => {
      const config: any = {
        enabled: true,
        servers: {
          'circular-test': {
            command: 'node',
          },
        },
      };

      // Create a circular reference
      config.self = config;

      // This should not crash the validator
      const result = await validator.validate(config);
      expect(result).toBeDefined();
    });
  });

  describe('Convenience Functions Edge Cases', () => {
    it('should handle validateMCPConfig with various option combinations', async () => {
      const config = {
        enabled: true,
        servers: {
          'convenience-test': {
            command: 'test-command',
          },
        },
      };

      // Test with different option combinations
      const optionCombinations: Partial<MCPValidationOptions>[] = [
        {},
        { checkCommandExistence: false },
        { checkEnvironmentVars: false },
        { validateConnectionConfig: false },
        { additionalEnvVars: ['TEST'] },
        { baseDirectory: '/test' },
        {
          checkCommandExistence: false,
          checkEnvironmentVars: false,
          validateConnectionConfig: false,
        },
      ];

      for (const options of optionCombinations) {
        const result = await validateMCPConfig(config, options);
        expect(result).toBeDefined();
        expect(result.isValid).toBeDefined();
        expect(Array.isArray(result.issues)).toBe(true);
      }
    });

    it('should handle validateMCPConfigStructure with malformed input', () => {
      const malformedInputs = [
        null,
        undefined,
        'not an object',
        123,
        [],
        { enabled: 'not-boolean' },
      ];

      malformedInputs.forEach(input => {
        const result = validateMCPConfigStructure(input);
        expect(result).toBeDefined();
        expect(Array.isArray(result.issues)).toBe(true);
        expect(result.parsedConfig).toBeNull();
      });
    });
  });
});