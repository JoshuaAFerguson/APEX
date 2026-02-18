/**
 * @fileoverview Test coverage validation for MCPConfigValidator
 *
 * Ensures all public methods and critical paths are tested.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { execSync } from 'child_process';
import { access } from 'fs/promises';
import {
  MCPConfigValidator,
  validateMCPConfig,
  validateMCPConfigStructure,
  ValidationSeveritySchema,
  ValidationIssueSchema,
  MCPValidationResultSchema,
  MCPValidationOptionsSchema,
  type ValidationSeverity,
  type ValidationIssue,
  type MCPValidationResult,
  type MCPValidationOptions,
} from '../mcp-config-validator.js';

// Mock external dependencies
vi.mock('child_process');
vi.mock('fs/promises');

const mockExecSync = vi.mocked(execSync);
const mockAccess = vi.mocked(access);

describe('MCPConfigValidator Coverage Validation', () => {
  describe('Public API Coverage', () => {
    it('should expose all required public functions', () => {
      expect(typeof MCPConfigValidator).toBe('function');
      expect(typeof validateMCPConfig).toBe('function');
      expect(typeof validateMCPConfigStructure).toBe('function');
    });

    it('should expose all required schemas', () => {
      expect(ValidationSeveritySchema).toBeDefined();
      expect(ValidationIssueSchema).toBeDefined();
      expect(MCPValidationResultSchema).toBeDefined();
      expect(MCPValidationOptionsSchema).toBeDefined();
    });

    it('should validate ValidationSeverity schema', () => {
      const validSeverities: ValidationSeverity[] = ['error', 'warning', 'info'];
      const invalidSeverities = ['critical', 'debug', 'verbose', ''];

      validSeverities.forEach(severity => {
        expect(() => ValidationSeveritySchema.parse(severity)).not.toThrow();
      });

      invalidSeverities.forEach(severity => {
        expect(() => ValidationSeveritySchema.parse(severity)).toThrow();
      });
    });

    it('should validate ValidationIssue schema', () => {
      const validIssue: ValidationIssue = {
        code: 'TEST_CODE',
        message: 'Test message',
        severity: 'error',
        path: 'test.path',
        suggestion: 'Test suggestion',
      };

      expect(() => ValidationIssueSchema.parse(validIssue)).not.toThrow();

      // Test required fields
      expect(() => ValidationIssueSchema.parse({ ...validIssue, code: '' })).toThrow();
      expect(() => ValidationIssueSchema.parse({ ...validIssue, message: '' })).toThrow();
    });

    it('should validate MCPValidationResult schema', () => {
      const validResult: MCPValidationResult = {
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      };

      expect(() => MCPValidationResultSchema.parse(validResult)).not.toThrow();

      // Test with issues
      const resultWithIssues: MCPValidationResult = {
        isValid: false,
        issues: [
          {
            code: 'TEST_ERROR',
            message: 'Test error',
            severity: 'error',
          },
        ],
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
      };

      expect(() => MCPValidationResultSchema.parse(resultWithIssues)).not.toThrow();
    });

    it('should validate MCPValidationOptions schema', () => {
      const defaultOptions = MCPValidationOptionsSchema.parse({});
      expect(defaultOptions.checkEnvironmentVars).toBe(true);
      expect(defaultOptions.checkCommandExistence).toBe(true);
      expect(defaultOptions.validateConnectionConfig).toBe(true);
      expect(defaultOptions.additionalEnvVars).toEqual([]);

      const customOptions: MCPValidationOptions = {
        checkEnvironmentVars: false,
        checkCommandExistence: false,
        validateConnectionConfig: false,
        additionalEnvVars: ['TEST_VAR'],
        baseDirectory: '/test/base',
      };

      expect(() => MCPValidationOptionsSchema.parse(customOptions)).not.toThrow();
    });
  });

  describe('Method Coverage', () => {
    let validator: MCPConfigValidator;

    beforeEach(() => {
      validator = new MCPConfigValidator();
      vi.clearAllMocks();
      mockExecSync.mockReturnValue(Buffer.from('/usr/bin/node'));
      mockAccess.mockResolvedValue(undefined);
    });

    it('should cover all validation paths in validate() method', async () => {
      const testConfigs = [
        // Valid config
        {
          enabled: true,
          servers: {
            'valid-server': {
              command: 'node',
            },
          },
        },
        // Invalid structure
        {
          enabled: 'invalid',
        },
        // Empty config
        {},
        // Config with all features
        {
          enabled: true,
          servers: {
            'feature-server': {
              command: 'node',
              envVars: [{ name: 'TEST_VAR', required: false }],
              connection: { timeout: 5000 },
            },
          },
          connection: { timeout: 30000 },
        },
      ];

      for (const config of testConfigs) {
        const result = await validator.validate(config);
        expect(result).toBeDefined();
        expect(typeof result.isValid).toBe('boolean');
        expect(Array.isArray(result.issues)).toBe(true);
        expect(typeof result.errorCount).toBe('number');
        expect(typeof result.warningCount).toBe('number');
        expect(typeof result.infoCount).toBe('number');
      }
    });

    it('should cover validateStructure() method independently', () => {
      const configs = [
        { enabled: true, servers: {} },
        { enabled: 'invalid' },
        null,
        undefined,
        { servers: { test: { command: 'node' } } },
      ];

      configs.forEach(config => {
        const result = validator.validateStructure(config);
        expect(result).toBeDefined();
        expect(Array.isArray(result.issues)).toBe(true);
        expect(result.parsedConfig === null || typeof result.parsedConfig === 'object').toBe(true);
      });
    });
  });

  describe('Error Code Coverage', () => {
    let validator: MCPConfigValidator;

    beforeEach(() => {
      validator = new MCPConfigValidator();
      vi.clearAllMocks();
    });

    it('should generate all possible error codes', async () => {
      // Track which error codes we've seen
      const seenCodes = new Set<string>();

      // Test configurations designed to trigger specific error codes
      const testCases = [
        {
          name: 'SCHEMA_VALIDATION_ERROR',
          config: { enabled: 'invalid' },
        },
        {
          name: 'PARSE_ERROR',
          config: null,
        },
        {
          name: 'NO_SERVERS_CONFIGURED',
          config: { enabled: true, servers: {} },
        },
        {
          name: 'MISSING_COMMAND',
          config: { enabled: true, servers: { test: { args: ['arg'] } } },
        },
        {
          name: 'COMMAND_NOT_FOUND',
          config: { enabled: true, servers: { test: { command: 'nonexistent' } } },
          setup: () => mockExecSync.mockImplementation(() => { throw new Error('not found'); }),
        },
        {
          name: 'EXECUTABLE_NOT_FOUND',
          config: { enabled: true, servers: { test: { command: '/nonexistent/path' } } },
          setup: () => mockAccess.mockRejectedValue(new Error('not found')),
        },
        {
          name: 'REQUIRED_ENV_VAR_MISSING',
          config: {
            enabled: true,
            servers: {
              test: {
                command: 'node',
                envVars: [{ name: 'MISSING_VAR', required: true }],
              },
            },
          },
          setup: () => delete process.env.MISSING_VAR,
        },
        {
          name: 'TIMEOUT_TOO_LOW',
          config: {
            enabled: true,
            servers: {
              test: {
                command: 'node',
                connection: { timeout: 100 },
              },
            },
          },
          setup: () => mockExecSync.mockReturnValue(Buffer.from('/usr/bin/node')),
        },
        {
          name: 'MAX_CONNECTIONS_HIGH',
          config: {
            enabled: true,
            servers: {
              test: {
                command: 'node',
                connection: { maxConcurrentConnections: 200 },
              },
            },
          },
          setup: () => mockExecSync.mockReturnValue(Buffer.from('/usr/bin/node')),
        },
        {
          name: 'AUTOSTART_DISABLED_BUT_ENABLED',
          config: {
            enabled: true,
            servers: {
              test: {
                command: 'node',
                enabled: true,
                autoStart: false,
              },
            },
          },
          setup: () => mockExecSync.mockReturnValue(Buffer.from('/usr/bin/node')),
        },
      ];

      for (const testCase of testCases) {
        if (testCase.setup) {
          testCase.setup();
        }

        const result = await validator.validate(testCase.config);

        // Check if we got the expected error code
        const hasExpectedCode = result.issues.some(issue => issue.code === testCase.name);
        if (hasExpectedCode) {
          seenCodes.add(testCase.name);
        }

        vi.clearAllMocks();
      }

      // Verify we've covered the major error codes
      const expectedCodes = [
        'SCHEMA_VALIDATION_ERROR',
        'NO_SERVERS_CONFIGURED',
        'MISSING_COMMAND',
        'REQUIRED_ENV_VAR_MISSING',
        'TIMEOUT_TOO_LOW',
        'MAX_CONNECTIONS_HIGH',
        'AUTOSTART_DISABLED_BUT_ENABLED',
      ];

      expectedCodes.forEach(code => {
        expect(seenCodes.has(code), `Should have seen error code: ${code}`).toBe(true);
      });
    });
  });

  describe('Convenience Function Coverage', () => {
    it('should cover validateMCPConfig function', async () => {
      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'node',
          },
        },
      };

      mockExecSync.mockReturnValue(Buffer.from('/usr/bin/node'));

      const result = await validateMCPConfig(config, { checkCommandExistence: false });
      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);

      // Test with options
      const resultWithOptions = await validateMCPConfig(config, {
        checkEnvironmentVars: false,
        additionalEnvVars: ['TEST_VAR'],
      });
      expect(resultWithOptions).toBeDefined();
    });

    it('should cover validateMCPConfigStructure function', () => {
      const validConfig = { enabled: true, servers: {} };
      const invalidConfig = { enabled: 'invalid' };

      const validResult = validateMCPConfigStructure(validConfig);
      expect(validResult.parsedConfig).toBeDefined();
      expect(validResult.issues).toHaveLength(0);

      const invalidResult = validateMCPConfigStructure(invalidConfig);
      expect(invalidResult.parsedConfig).toBeNull();
      expect(invalidResult.issues.length).toBeGreaterThan(0);
    });
  });
});