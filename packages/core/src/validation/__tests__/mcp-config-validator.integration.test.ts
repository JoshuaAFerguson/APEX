/**
 * @fileoverview Integration tests for MCPConfigValidator
 *
 * These tests demonstrate real-world usage scenarios and end-to-end validation flows.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MCPConfigValidator,
  validateMCPConfig,
  validateMCPConfigStructure,
} from '../mcp-config-validator.js';

describe('MCPConfigValidator Integration Tests', () => {
  describe('Real-world Configuration Examples', () => {
    it('should validate a typical MCP server configuration', async () => {
      const config = {
        enabled: true,
        servers: {
          'filesystem': {
            command: 'npx',
            args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
            envVars: [
              {
                name: 'MCP_FILESYSTEM_ROOT',
                required: false,
                defaultValue: '/tmp',
                description: 'Root directory for filesystem access',
              },
            ],
            enabled: true,
            autoStart: true,
          },
          'sqlite': {
            command: 'node',
            args: ['sqlite-server.js'],
            envVars: [
              {
                name: 'DATABASE_URL',
                required: true,
                description: 'SQLite database connection string',
              },
            ],
            enabled: true,
            autoStart: true,
            connection: {
              timeout: 5000,
              maxRetries: 3,
              retryDelay: 1000,
            },
          },
        },
        connection: {
          timeout: 30000,
          maxRetries: 5,
          retryDelay: 2000,
          maxConcurrentConnections: 10,
        },
      };

      // Validate without external checks for predictable results
      const validator = new MCPConfigValidator({
        checkCommandExistence: false,
        checkEnvironmentVars: false,
      });

      const result = await validator.validate(config);

      expect(result.isValid).toBe(true);
      expect(result.errorCount).toBe(0);
      expect(result.issues).toHaveLength(0);
    });

    it('should identify common configuration mistakes', async () => {
      const config = {
        enabled: true,
        servers: {
          'broken-server': {
            // Missing required command
            args: ['server.js'],
            envVars: [
              {
                name: 'REQUIRED_VAR',
                required: true,
                description: 'This is required but not set',
              },
            ],
            connection: {
              timeout: 100, // Too low
              maxConcurrentConnections: 1000, // Too high
            },
          },
          'misconfigured-server': {
            command: 'nonexistent-command',
            enabled: true,
            autoStart: false, // Inconsistent
          },
        },
      };

      const result = await validateMCPConfig(config, {
        checkCommandExistence: false, // Focus on logical errors
        checkEnvironmentVars: true,
      });

      expect(result.isValid).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);

      // Should identify the missing command
      expect(result.issues.some(i => i.code === 'MISSING_COMMAND')).toBe(true);

      // Should identify the missing environment variable
      expect(result.issues.some(i => i.code === 'REQUIRED_ENV_VAR_MISSING')).toBe(true);

      // Should warn about timeout being too low
      expect(result.issues.some(i => i.code === 'TIMEOUT_TOO_LOW')).toBe(true);

      // Should warn about inconsistent autoStart/enabled
      expect(result.issues.some(i => i.code === 'AUTOSTART_DISABLED_BUT_ENABLED')).toBe(true);
    });

    it('should handle minimal valid configuration', async () => {
      const config = {
        enabled: true,
        servers: {
          'minimal-server': {
            command: 'echo',
          },
        },
      };

      const result = await validateMCPConfig(config, {
        checkCommandExistence: false,
        checkEnvironmentVars: false,
      });

      expect(result.isValid).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should handle disabled MCP configuration', async () => {
      const config = {
        enabled: false,
        servers: {}, // Empty servers is OK when disabled
      };

      const result = await validateMCPConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errorCount).toBe(0);
      // Should not warn about no servers when MCP is disabled
      expect(result.issues.some(i => i.code === 'NO_SERVERS_CONFIGURED')).toBe(false);
    });
  });

  describe('Error Message Quality', () => {
    it('should provide helpful error messages with context', async () => {
      const config = {
        enabled: true,
        servers: {
          'problematic-server': {
            command: '', // Empty command
            envVars: [
              {
                name: 'MISSING_REQUIRED_VAR',
                required: true,
                description: 'This variable is absolutely required for the server to function properly',
              },
            ],
          },
        },
      };

      const result = await validateMCPConfig(config);

      // All error messages should include helpful suggestions
      const errors = result.issues.filter(i => i.severity === 'error');
      for (const error of errors) {
        expect(error.message).toBeTruthy();
        expect(error.suggestion).toBeTruthy();
        expect(error.path).toBeTruthy();
        expect(error.code).toBeTruthy();
      }

      // Check specific error message quality
      const envVarError = result.issues.find(i => i.code === 'REQUIRED_ENV_VAR_MISSING');
      expect(envVarError?.suggestion).toContain('This variable is absolutely required');
    });

    it('should provide structured results suitable for tooling', async () => {
      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'test-command',
            connection: {
              timeout: 500, // Warning
              maxConcurrentConnections: 200, // Warning
            },
            autoStart: false, // Info when enabled is true
          },
        },
      };

      const result = await validateMCPConfig(config, {
        checkCommandExistence: false,
        checkEnvironmentVars: false,
      });

      // Result should be well-structured for programmatic use
      expect(result.isValid).toBeDefined();
      expect(result.errorCount).toBeDefined();
      expect(result.warningCount).toBeDefined();
      expect(result.infoCount).toBeDefined();
      expect(Array.isArray(result.issues)).toBe(true);

      // Each issue should have consistent structure
      for (const issue of result.issues) {
        expect(issue.code).toBeTruthy();
        expect(issue.message).toBeTruthy();
        expect(['error', 'warning', 'info']).toContain(issue.severity);
      }

      // Should have warnings but no errors
      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBeGreaterThan(0);
      expect(result.infoCount).toBeGreaterThan(0);
      expect(result.isValid).toBe(true); // No errors means valid
    });
  });

  describe('Structure Validation Standalone', () => {
    it('should validate structure independently', () => {
      const validConfig = {
        enabled: true,
        servers: {
          'test': {
            command: 'node',
            args: ['test.js'],
          },
        },
      };

      const result = validateMCPConfigStructure(validConfig);

      expect(result.parsedConfig).toBeTruthy();
      expect(result.issues).toHaveLength(0);
    });

    it('should reject invalid structure', () => {
      const invalidConfig = {
        enabled: 'not-a-boolean',
        servers: {
          'test': {
            command: 123, // Should be string
          },
        },
      };

      const result = validateMCPConfigStructure(invalidConfig);

      expect(result.parsedConfig).toBeNull();
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.every(i => i.severity === 'error')).toBe(true);
    });
  });

  describe('Validation Options', () => {
    it('should respect validation options', async () => {
      const config = {
        enabled: true,
        servers: {
          'test-server': {
            command: 'nonexistent-command',
            envVars: [
              {
                name: 'MISSING_VAR',
                required: true,
              },
            ],
          },
        },
      };

      // Test with all checks disabled
      const lenientResult = await validateMCPConfig(config, {
        checkCommandExistence: false,
        checkEnvironmentVars: false,
        validateConnectionConfig: false,
      });

      expect(lenientResult.issues.some(i => i.code === 'COMMAND_NOT_FOUND')).toBe(false);
      expect(lenientResult.issues.some(i => i.code === 'REQUIRED_ENV_VAR_MISSING')).toBe(false);

      // Test with all checks enabled (default)
      const strictResult = await validateMCPConfig(config);

      expect(strictResult.issues.some(i => i.code === 'REQUIRED_ENV_VAR_MISSING')).toBe(true);
    });

    it('should handle additional environment variables', async () => {
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

      const result = await validateMCPConfig(config, {
        checkCommandExistence: false,
        additionalEnvVars: ['ADDITIONAL_VAR'],
      });

      expect(result.issues.some(i => i.code === 'REQUIRED_ENV_VAR_MISSING')).toBe(false);
    });
  });
});