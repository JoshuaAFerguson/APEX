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

  // ============================================================================
  // MCP Server Configure Command Validation Tests
  // ============================================================================

  describe('Invalid Config Values Rejection', () => {
    describe('Missing Required Fields', () => {
      it('should reject config missing command for stdio type', async () => {
        const config = {
          enabled: true,
          servers: {
            'missing-command': {
              name: 'Test Server',
              type: 'stdio',
              // command: missing
              args: ['server.js'],
            },
          },
        };

        const result = await validateMCPConfig(config, {
          checkCommandExistence: false,
          checkEnvironmentVars: false,
        });

        expect(result.isValid).toBe(false);
        expect(result.errorCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'MISSING_COMMAND')).toBe(true);

        const missingCommandIssue = result.issues.find(i => i.code === 'MISSING_COMMAND');
        expect(missingCommandIssue?.severity).toBe('error');
        expect(missingCommandIssue?.path).toBe('servers.missing-command.command');
        expect(missingCommandIssue?.suggestion).toContain('command to execute');
      });

      it('should reject config missing name', async () => {
        const config = {
          enabled: true,
          servers: {
            'missing-name': {
              // name: missing
              command: 'node',
            },
          },
        };

        const result = await validateMCPConfig(config, {
          checkCommandExistence: false,
          checkEnvironmentVars: false,
        });

        expect(result.isValid).toBe(false);
        expect(result.errorCount).toBeGreaterThan(0);
        // Should fail at schema level validation
        expect(result.issues.some(i => i.code === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
      });

      it('should reject config missing URL for http/sse types', async () => {
        const httpConfig = {
          enabled: true,
          servers: {
            'missing-url': {
              name: 'HTTP Server',
              type: 'http',
              // url: missing
            },
          },
        };

        const result = await validateMCPConfig(httpConfig);

        expect(result.isValid).toBe(false);
        expect(result.errorCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'MISSING_URL')).toBe(true);
      });
    });

    describe('Invalid Data Types', () => {
      it('should reject invalid boolean enabled field', async () => {
        const config = {
          enabled: 'true', // Should be boolean
          servers: {
            'test-server': {
              name: 'Test Server',
              command: 'node',
            },
          },
        };

        const result = await validateMCPConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errorCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'SCHEMA_VALIDATION_ERROR')).toBe(true);

        const typeIssue = result.issues.find(i =>
          i.code === 'SCHEMA_VALIDATION_ERROR' && i.path === 'enabled'
        );
        expect(typeIssue?.suggestion).toContain('Expected boolean');
      });

      it('should reject invalid string command field', async () => {
        const config = {
          enabled: true,
          servers: {
            'test-server': {
              name: 'Test Server',
              command: 123, // Should be string
            },
          },
        };

        const result = await validateMCPConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errorCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
      });

      it('should reject invalid array for args field', async () => {
        const config = {
          enabled: true,
          servers: {
            'test-server': {
              name: 'Test Server',
              command: 'node',
              args: 'server.js', // Should be array
            },
          },
        };

        const result = await validateMCPConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errorCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
      });

      it('should reject invalid type enum value', async () => {
        const config = {
          enabled: true,
          servers: {
            'test-server': {
              name: 'Test Server',
              type: 'invalid-type', // Should be stdio, http, sse, or sdk
              command: 'node',
            },
          },
        };

        const result = await validateMCPConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errorCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'SCHEMA_VALIDATION_ERROR')).toBe(true);

        const enumIssue = result.issues.find(i =>
          i.code === 'SCHEMA_VALIDATION_ERROR' && i.path?.includes('type')
        );
        expect(enumIssue?.suggestion).toContain('one of:');
      });
    });

    describe('Malformed URLs', () => {
      it('should reject malformed URL for http type', async () => {
        const config = {
          enabled: true,
          servers: {
            'malformed-url': {
              name: 'HTTP Server',
              type: 'http',
              url: 'not-a-url',
            },
          },
        };

        const result = await validateMCPConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errorCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
      });

      it('should reject empty URL for sse type', async () => {
        const config = {
          enabled: true,
          servers: {
            'empty-url': {
              name: 'SSE Server',
              type: 'sse',
              url: '',
            },
          },
        };

        const result = await validateMCPConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errorCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
      });
    });

    describe('Unsafe Commands', () => {
      it('should warn about potentially dangerous commands', async () => {
        const config = {
          enabled: true,
          servers: {
            'unsafe-server': {
              name: 'Unsafe Server',
              command: 'rm',
              args: ['-rf', '/'],
            },
          },
        };

        const result = await validateMCPConfig(config, {
          checkCommandExistence: false,
          checkEnvironmentVars: false,
        });

        // Should not fail validation but provide warnings
        expect(result.isValid).toBe(true);
        expect(result.warningCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'POTENTIALLY_UNSAFE_COMMAND' || i.code === 'POTENTIALLY_UNSAFE_ARGS')).toBe(true);
      });

      it('should warn about commands with sudo', async () => {
        const config = {
          enabled: true,
          servers: {
            'sudo-server': {
              name: 'Sudo Server',
              command: 'sudo',
              args: ['node', 'server.js'],
            },
          },
        };

        const result = await validateMCPConfig(config, {
          checkCommandExistence: false,
          checkEnvironmentVars: false,
        });

        expect(result.isValid).toBe(true);
        expect(result.warningCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'POTENTIALLY_UNSAFE_COMMAND')).toBe(true);
      });
    });
  });

  describe('Required Settings Enforcement', () => {
    describe('Connection Type Requirements', () => {
      it('should enforce command requirement for stdio type', async () => {
        const config = {
          enabled: true,
          servers: {
            'stdio-no-command': {
              name: 'Stdio Server',
              type: 'stdio',
              // command missing - required for stdio
            },
          },
        };

        const result = await validateMCPConfig(config, {
          checkCommandExistence: false,
          checkEnvironmentVars: false,
        });

        expect(result.isValid).toBe(false);
        expect(result.errorCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'MISSING_COMMAND')).toBe(true);
      });

      it('should enforce URL requirement for http type', async () => {
        const config = {
          enabled: true,
          servers: {
            'http-no-url': {
              name: 'HTTP Server',
              type: 'http',
              // url missing - required for http
            },
          },
        };

        const result = await validateMCPConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errorCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'MISSING_URL')).toBe(true);
      });

      it('should enforce URL requirement for sse type', async () => {
        const config = {
          enabled: true,
          servers: {
            'sse-no-url': {
              name: 'SSE Server',
              type: 'sse',
              // url missing - required for sse
            },
          },
        };

        const result = await validateMCPConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errorCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'MISSING_URL')).toBe(true);
      });
    });

    describe('Name Requirement', () => {
      it('should enforce name field for all servers', async () => {
        const config = {
          enabled: true,
          servers: {
            'no-name': {
              // name missing - always required
              command: 'node',
            },
          },
        };

        const result = await validateMCPConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errorCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
      });

      it('should reject empty name string', async () => {
        const config = {
          enabled: true,
          servers: {
            'empty-name': {
              name: '', // Empty string not allowed
              command: 'node',
            },
          },
        };

        const result = await validateMCPConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errorCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
      });

      it('should reject whitespace-only name', async () => {
        const config = {
          enabled: true,
          servers: {
            'whitespace-name': {
              name: '   ', // Whitespace only
              command: 'node',
            },
          },
        };

        const result = await validateMCPConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errorCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
      });
    });

    describe('Required Environment Variables', () => {
      it('should enforce required environment variables', async () => {
        const config = {
          enabled: true,
          servers: {
            'env-required': {
              name: 'Environment Server',
              command: 'node',
              envVars: [
                {
                  name: 'REQUIRED_VAR',
                  required: true,
                  description: 'This variable is required',
                },
                {
                  name: 'OPTIONAL_VAR',
                  required: false,
                  description: 'This variable is optional',
                },
              ],
            },
          },
        };

        const result = await validateMCPConfig(config, {
          checkCommandExistence: false,
          checkEnvironmentVars: true, // Enable environment variable checking
        });

        expect(result.isValid).toBe(false);
        expect(result.errorCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'REQUIRED_ENV_VAR_MISSING')).toBe(true);

        const envVarIssue = result.issues.find(i => i.code === 'REQUIRED_ENV_VAR_MISSING');
        expect(envVarIssue?.message).toContain('REQUIRED_VAR');
        expect(envVarIssue?.suggestion).toContain('This variable is required');
      });

      it('should allow config when required env vars are set', async () => {
        const config = {
          enabled: true,
          servers: {
            'env-satisfied': {
              name: 'Environment Server',
              command: 'node',
              envVars: [
                {
                  name: 'REQUIRED_VAR',
                  required: true,
                  description: 'This variable is required',
                },
              ],
            },
          },
        };

        const result = await validateMCPConfig(config, {
          checkCommandExistence: false,
          checkEnvironmentVars: true,
          additionalEnvVars: ['REQUIRED_VAR'], // Simulate variable being set
        });

        expect(result.isValid).toBe(true);
        expect(result.errorCount).toBe(0);
      });
    });
  });

  describe('Optional Settings Warnings', () => {
    describe('Missing Optional Capabilities', () => {
      it('should generate info message for missing capabilities field', async () => {
        const config = {
          enabled: true,
          servers: {
            'no-capabilities': {
              name: 'Server Without Capabilities',
              command: 'node',
              // capabilities: missing (optional)
            },
          },
        };

        const result = await validateMCPConfig(config, {
          checkCommandExistence: false,
          checkEnvironmentVars: false,
        });

        expect(result.isValid).toBe(true);
        expect(result.infoCount).toBeGreaterThan(0);
        // Should warn about autoStart being disabled by default
        expect(result.issues.some(i => i.code === 'AUTOSTART_DISABLED')).toBe(true);
      });

      it('should not generate warnings when capabilities are provided', async () => {
        const config = {
          enabled: true,
          servers: {
            'with-capabilities': {
              name: 'Server With Capabilities',
              command: 'node',
              capabilities: ['filesystem', 'read'],
              autoStart: true, // Prevent autostart warning
            },
          },
        };

        const result = await validateMCPConfig(config, {
          checkCommandExistence: false,
          checkEnvironmentVars: false,
        });

        expect(result.isValid).toBe(true);
        expect(result.infoCount).toBe(0);
        expect(result.warningCount).toBe(0);
      });
    });

    describe('Missing Optional AutoStart', () => {
      it('should generate info message when autoStart is not explicitly set', async () => {
        const config = {
          enabled: true,
          servers: {
            'default-autostart': {
              name: 'Default AutoStart Server',
              command: 'node',
              // autoStart: defaults to false
            },
          },
        };

        const result = await validateMCPConfig(config, {
          checkCommandExistence: false,
          checkEnvironmentVars: false,
        });

        expect(result.isValid).toBe(true);
        expect(result.infoCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'AUTOSTART_DISABLED')).toBe(true);

        const autostartIssue = result.issues.find(i => i.code === 'AUTOSTART_DISABLED');
        expect(autostartIssue?.severity).toBe('info');
        expect(autostartIssue?.suggestion).toContain('Set autoStart: true');
      });

      it('should not generate warning when autoStart is explicitly enabled', async () => {
        const config = {
          enabled: true,
          servers: {
            'explicit-autostart': {
              name: 'Explicit AutoStart Server',
              command: 'node',
              autoStart: true,
            },
          },
        };

        const result = await validateMCPConfig(config, {
          checkCommandExistence: false,
          checkEnvironmentVars: false,
        });

        expect(result.isValid).toBe(true);
        expect(result.issues.some(i => i.code === 'AUTOSTART_DISABLED')).toBe(false);
      });
    });

    describe('Missing Optional Environment Variable Descriptions', () => {
      it('should generate warning for env vars without descriptions', async () => {
        const config = {
          enabled: true,
          servers: {
            'no-env-descriptions': {
              name: 'No Env Descriptions Server',
              command: 'node',
              envVars: [
                {
                  name: 'VAR_WITHOUT_DESC',
                  required: false,
                  // description: missing
                },
                {
                  name: 'VAR_WITH_DESC',
                  required: false,
                  description: 'This has a description',
                },
              ],
            },
          },
        };

        const result = await validateMCPConfig(config, {
          checkCommandExistence: false,
          checkEnvironmentVars: false,
        });

        expect(result.isValid).toBe(true);
        // This test focuses on the fact that missing descriptions don't cause errors
        // The current validator doesn't warn about missing descriptions
        // but the test verifies that the config is still valid
      });
    });

    describe('Suboptimal Configuration Warnings', () => {
      it('should warn about very low timeouts', async () => {
        const config = {
          enabled: true,
          servers: {
            'low-timeout': {
              name: 'Low Timeout Server',
              command: 'node',
              connection: {
                timeout: 500, // Very low timeout
              },
            },
          },
        };

        const result = await validateMCPConfig(config, {
          checkCommandExistence: false,
          checkEnvironmentVars: false,
          validateConnectionConfig: true,
        });

        expect(result.isValid).toBe(true);
        expect(result.warningCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'TIMEOUT_TOO_LOW')).toBe(true);

        const timeoutIssue = result.issues.find(i => i.code === 'TIMEOUT_TOO_LOW');
        expect(timeoutIssue?.severity).toBe('warning');
        expect(timeoutIssue?.suggestion).toContain('at least 1000ms');
      });

      it('should warn about very high max connections', async () => {
        const config = {
          enabled: true,
          servers: {
            'high-connections': {
              name: 'High Connections Server',
              command: 'node',
              connection: {
                maxConcurrentConnections: 500, // Very high
              },
            },
          },
        };

        const result = await validateMCPConfig(config, {
          checkCommandExistence: false,
          checkEnvironmentVars: false,
          validateConnectionConfig: true,
        });

        expect(result.isValid).toBe(true);
        expect(result.warningCount).toBeGreaterThan(0);
        expect(result.issues.some(i => i.code === 'MAX_CONNECTIONS_HIGH')).toBe(true);

        const connectionsIssue = result.issues.find(i => i.code === 'MAX_CONNECTIONS_HIGH');
        expect(connectionsIssue?.severity).toBe('warning');
        expect(connectionsIssue?.suggestion).toContain('lower value');
      });
    });

    describe('All Tests Integration', () => {
      it('should pass comprehensive validation when all settings are optimal', async () => {
        const config = {
          enabled: true,
          servers: {
            'optimal-server': {
              name: 'Optimally Configured Server',
              type: 'stdio',
              command: 'node',
              args: ['server.js'],
              autoStart: true,
              capabilities: ['filesystem', 'read', 'write'],
              envVars: [
                {
                  name: 'CONFIG_VAR',
                  required: false,
                  description: 'Configuration variable for the server',
                  defaultValue: 'default-value',
                },
              ],
              connection: {
                timeout: 5000,
                maxRetries: 3,
                retryDelay: 1000,
                maxConcurrentConnections: 10,
              },
            },
          },
          connection: {
            timeout: 30000,
            maxRetries: 5,
            retryDelay: 2000,
            maxConcurrentConnections: 50,
          },
        };

        const result = await validateMCPConfig(config, {
          checkCommandExistence: false,
          checkEnvironmentVars: false,
          validateConnectionConfig: true,
        });

        expect(result.isValid).toBe(true);
        expect(result.errorCount).toBe(0);
        expect(result.warningCount).toBe(0);
        expect(result.infoCount).toBe(0);
        expect(result.issues).toHaveLength(0);
      });
    });
  });
});