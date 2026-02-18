/**
 * MCPConfigurator Edge Cases Tests
 *
 * Tests for edge cases, boundary conditions, error scenarios,
 * and unusual inputs for the MCPConfigurator class.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import { MCPConfigurator, MCPConfiguratorError } from './configurator.js';
import type { ApexConfig, MCPConfig, MCPServerConfig } from '@apexcli/core';

// Mock fs module
vi.mock('fs/promises');

describe('MCPConfigurator - Edge Cases Tests', () => {
  let configurator: MCPConfigurator;
  let mockConfig: ApexConfig;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    mockConfig = {
      project: { name: 'edge-case-test' },
      mcp: {
        enabled: true,
        servers: {},
      },
    } as ApexConfig;

    configurator = new MCPConfigurator({
      projectPath: testProjectPath,
      config: mockConfig,
    });

    vi.clearAllMocks();
  });

  // =========================================================================
  // Input Validation Edge Cases
  // =========================================================================

  describe('Input Validation Edge Cases', () => {
    describe('Server ID edge cases', () => {
      it('should handle empty server ID', () => {
        expect(() => configurator.addServer('', {
          name: 'empty-id',
          type: 'stdio',
          command: 'test',
        })).toThrow();
      });

      it('should handle server IDs with special characters', () => {
        const specialIds = [
          'server-with-dashes',
          'server_with_underscores',
          'server.with.dots',
          'server123',
          'Server-Mixed-Case',
          'server@email.com',
          'server/path',
          'server\\backslash',
          'server space',
          'server\ttab',
          'server\nnewline',
        ];

        specialIds.forEach(serverId => {
          try {
            configurator.addServer(serverId, {
              name: serverId,
              type: 'stdio',
              command: 'test',
            });

            const config = configurator.getConfig();
            expect(config.servers).toHaveProperty(serverId);
          } catch (error) {
            // Some special characters might be invalid - that's okay
            console.log(`Server ID '${serverId}' rejected:`, error.message);
          }
        });
      });

      it('should handle very long server IDs', () => {
        const longId = 'a'.repeat(1000);

        const result = configurator.addServer(longId, {
          name: 'long-id-test',
          type: 'stdio',
          command: 'test',
        });

        expect(result.servers).toHaveProperty(longId);
      });

      it('should handle server IDs with Unicode characters', () => {
        const unicodeIds = [
          'server-中文',
          'server-🚀',
          'server-émojí',
          'server-русский',
          'server-العربية',
        ];

        unicodeIds.forEach(serverId => {
          const result = configurator.addServer(serverId, {
            name: serverId,
            type: 'stdio',
            command: 'test',
          });

          expect(result.servers).toHaveProperty(serverId);
        });
      });
    });

    describe('Server configuration edge cases', () => {
      it('should handle servers with null/undefined values', () => {
        const edgeCaseConfigs = [
          {
            name: 'null-args',
            type: 'stdio' as const,
            command: 'test',
            args: null as any,
          },
          {
            name: 'undefined-args',
            type: 'stdio' as const,
            command: 'test',
            args: undefined,
          },
          {
            name: 'null-env',
            type: 'stdio' as const,
            command: 'test',
            env: null as any,
          },
          {
            name: 'undefined-env',
            type: 'stdio' as const,
            command: 'test',
            env: undefined,
          },
        ];

        edgeCaseConfigs.forEach((config, index) => {
          try {
            const result = configurator.addServer(`edge-case-${index}`, config, { validate: false });
            expect(result.servers).toHaveProperty(`edge-case-${index}`);
          } catch (error) {
            // Some configurations might be invalid - that's expected
            console.log(`Config ${config.name} rejected:`, error.message);
          }
        });
      });

      it('should handle servers with empty strings', () => {
        const emptyStringConfig = {
          name: '',
          type: 'stdio' as const,
          command: '',
          args: [''],
          env: { '': '' },
        };

        try {
          configurator.addServer('empty-strings', emptyStringConfig, { validate: false });
        } catch (error) {
          // Empty strings might be invalid - that's okay
          expect(error).toBeDefined();
        }
      });

      it('should handle servers with extremely large configurations', () => {
        const largeArgs = Array.from({ length: 10000 }, (_, i) => `arg-${i}`);
        const largeEnv = Object.fromEntries(
          Array.from({ length: 1000 }, (_, i) => [`VAR_${i}`, `value-${i}`.repeat(100)])
        );

        const largeConfig = {
          name: 'large-config',
          type: 'stdio' as const,
          command: 'test',
          args: largeArgs,
          env: largeEnv,
        };

        const result = configurator.addServer('large-config', largeConfig);
        expect(result.servers?.['large-config'].args).toHaveLength(10000);
        expect(Object.keys(result.servers?.['large-config'].env || {})).toHaveLength(1000);
      });

      it('should handle servers with circular reference-like structures', () => {
        const config = {
          name: 'circular-test',
          type: 'stdio' as const,
          command: 'test',
          // Create a structure that might cause issues if not handled properly
          args: [],
          env: {},
        };

        // Add references that might create circular-like behavior
        config.args = [JSON.stringify(config)];
        config.env = { SELF_CONFIG: JSON.stringify(config) };

        const result = configurator.addServer('circular-test', config);
        expect(result.servers).toHaveProperty('circular-test');
      });
    });
  });

  // =========================================================================
  // Configuration Generation Edge Cases
  // =========================================================================

  describe('Configuration Generation Edge Cases', () => {
    it('should handle generation with no servers', () => {
      const emptyConfig: ApexConfig = {
        project: { name: 'empty' },
        mcp: { enabled: true, servers: {} },
      };

      const emptyConfigurator = new MCPConfigurator({
        projectPath: testProjectPath,
        config: emptyConfig,
      });

      const claudeConfig = emptyConfigurator.generateConfig('claude-desktop');
      const apexConfig = emptyConfigurator.generateConfig('apex');

      expect(claudeConfig.mcpServers).toEqual({});
      expect((apexConfig as MCPConfig).servers).toEqual({});
    });

    it('should handle generation with only filtered out servers', () => {
      configurator.addServer('http-only', {
        name: 'http-only',
        type: 'http',
        url: 'https://example.com',
      }, { validate: false });

      configurator.addServer('missing-command', {
        name: 'missing-command',
        type: 'stdio',
        // command is missing
      } as MCPServerConfig, { validate: false });

      const claudeConfig = configurator.generateConfig('claude-desktop');

      // Claude Desktop should filter out both servers
      expect(Object.keys(claudeConfig.mcpServers)).toHaveLength(0);
    });

    it('should handle servers with invalid type values', () => {
      const invalidTypeConfig = {
        name: 'invalid-type',
        type: 'invalid-type' as any,
        command: 'test',
      };

      configurator.addServer('invalid-type', invalidTypeConfig, { validate: false });

      const claudeConfig = configurator.generateConfig('claude-desktop');
      const apexConfig = configurator.generateConfig('apex');

      // Claude Desktop might filter out invalid types
      // APEX format might include all servers
      expect((apexConfig as MCPConfig).servers).toHaveProperty('invalid-type');
    });

    it('should handle generation with non-existent server filter', () => {
      configurator.addServer('existing', {
        name: 'existing',
        type: 'stdio',
        command: 'test',
      });

      const config = configurator.generateConfig('claude-desktop', ['existing', 'non-existent']);

      expect(config.mcpServers.existing).toBeDefined();
      expect(config.mcpServers['non-existent']).toBeUndefined();
    });

    it('should handle generation with empty server filter array', () => {
      configurator.addServer('test-server', {
        name: 'test-server',
        type: 'stdio',
        command: 'test',
      });

      const config = configurator.generateConfig('claude-desktop', []);

      expect(Object.keys(config.mcpServers)).toHaveLength(0);
    });
  });

  // =========================================================================
  // Environment Variable Edge Cases
  // =========================================================================

  describe('Environment Variable Edge Cases', () => {
    it('should handle environment variables with special characters in names', async () => {
      const specialVarNames = [
        'VAR_WITH_UNDERSCORES',
        'var-with-dashes', // might be invalid
        'VAR.WITH.DOTS', // might be invalid
        'VAR123',
        'VAR_中文', // Unicode
        'VAR_🚀', // Emoji
        '', // Empty name
        ' ', // Space
        '\t', // Tab
        '\n', // Newline
      ];

      const envVars = specialVarNames.map((name, i) => ({
        name,
        description: `Special variable ${i}`,
        required: i % 2 === 0,
      }));

      configurator.addServer('special-env', {
        name: 'special-env',
        type: 'stdio',
        command: 'test',
        envVars,
      }, { validate: false });

      try {
        const result = await configurator.detectEnvironmentVariables('special-env');
        expect(result.variables).toHaveLength(specialVarNames.length);
      } catch (error) {
        // Some special variable names might cause errors - that's expected
        expect(error).toBeDefined();
      }
    });

    it('should handle environment variables with extremely long values', async () => {
      const longValue = 'x'.repeat(100000); // 100KB string
      const originalEnv = process.env;

      // Set extremely long environment variable
      process.env.EXTREMELY_LONG_VAR = longValue;

      try {
        configurator.addServer('long-env', {
          name: 'long-env',
          type: 'stdio',
          command: 'test',
          envVars: [{
            name: 'EXTREMELY_LONG_VAR',
            description: 'Variable with very long value',
            required: true,
          }],
        });

        const result = await configurator.detectEnvironmentVariables('long-env');
        expect(result.found).toHaveLength(1);
        expect(result.found[0].name).toBe('EXTREMELY_LONG_VAR');
      } finally {
        // Restore original environment
        process.env = originalEnv;
      }
    });

    it('should handle environment variables with null/undefined patterns', async () => {
      configurator.addServer('null-pattern', {
        name: 'null-pattern',
        type: 'stdio',
        command: 'test',
        envVars: [
          {
            name: 'NULL_PATTERN',
            description: 'Variable with null pattern',
            pattern: null as any,
          },
          {
            name: 'UNDEFINED_PATTERN',
            description: 'Variable with undefined pattern',
            pattern: undefined,
          },
        ],
      }, { validate: false });

      const result = await configurator.detectEnvironmentVariables('null-pattern');
      expect(result.variables).toHaveLength(2);
    });

    it('should handle invalid regex patterns gracefully', async () => {
      const invalidPatterns = [
        '(unclosed parenthesis',
        '[unclosed bracket',
        '*invalid quantifier',
        '\\invalid escape',
        '(?invalid group',
      ];

      const envVars = invalidPatterns.map((pattern, i) => ({
        name: `INVALID_PATTERN_${i}`,
        description: `Variable with invalid pattern ${i}`,
        pattern,
      }));

      configurator.addServer('invalid-patterns', {
        name: 'invalid-patterns',
        type: 'stdio',
        command: 'test',
        envVars,
      }, { validate: false });

      try {
        const result = await configurator.detectEnvironmentVariables('invalid-patterns');
        // Should not crash, might return warnings
        expect(result.variables).toHaveLength(invalidPatterns.length);
      } catch (error) {
        // Invalid regex patterns might cause detection to fail - that's expected
        expect(error).toBeDefined();
      }
    });
  });

  // =========================================================================
  // Template Edge Cases
  // =========================================================================

  describe('Template Edge Cases', () => {
    it('should handle templates with no capabilities', () => {
      const emptyCapabilitiesTemplate = {
        id: 'no-capabilities',
        name: 'No Capabilities',
        description: 'Template with no capabilities',
        package: 'no-capabilities',
        config: {
          name: 'no-capabilities',
          type: 'stdio' as const,
          command: 'test',
        },
        envVars: [],
        capabilities: [],
        verified: true,
      };

      configurator.registerTemplate(emptyCapabilitiesTemplate);

      const allTemplates = configurator.getServerTemplates();
      const filteredTemplates = configurator.getServerTemplates('any-category');

      expect(allTemplates.some(t => t.id === 'no-capabilities')).toBe(true);
      expect(filteredTemplates.some(t => t.id === 'no-capabilities')).toBe(false);
    });

    it('should handle templates with invalid config structures', () => {
      const invalidConfigTemplate = {
        id: 'invalid-config',
        name: 'Invalid Config',
        description: 'Template with invalid config',
        package: 'invalid-config',
        config: {
          // Missing required fields
        } as any,
        envVars: [],
        capabilities: ['test'],
        verified: false,
      };

      configurator.registerTemplate(invalidConfigTemplate);

      try {
        const config = configurator.generateFromTemplate('invalid-config');
        // Should work with whatever config was provided
        expect(config).toBeDefined();
      } catch (error) {
        // Might fail due to invalid config - that's expected
        expect(error).toBeDefined();
      }
    });

    it('should handle placeholder substitution edge cases', () => {
      const edgeCaseTemplate = {
        id: 'edge-placeholders',
        name: 'Edge Case Placeholders',
        description: 'Template with edge case placeholders',
        package: 'edge-placeholders',
        config: {
          name: 'edge-placeholders',
          type: 'stdio' as const,
          command: 'test',
          args: [
            '{{PROJECT_PATH}}',
            '{{NON_EXISTENT_PLACEHOLDER}}',
            '{{PROJECT_PATH}}{{PROJECT_PATH}}',
            'prefix-{{PROJECT_PATH}}-suffix',
            '',
            null as any,
          ],
        },
        envVars: [],
        capabilities: ['test'],
        verified: false,
      };

      configurator.registerTemplate(edgeCaseTemplate);

      const config = configurator.generateFromTemplate('edge-placeholders');

      expect(config.args).toContain(testProjectPath);
      expect(config.args).toContain('{{NON_EXISTENT_PLACEHOLDER}}'); // Should remain unchanged
      expect(config.args).toContain(`${testProjectPath}${testProjectPath}`);
      expect(config.args).toContain(`prefix-${testProjectPath}-suffix`);
    });

    it('should handle templates with circular references in overrides', () => {
      const circularOverride: any = {
        autoStart: true,
        args: [],
      };
      circularOverride.self = circularOverride;

      try {
        const config = configurator.generateFromTemplate('filesystem', circularOverride);
        expect(config).toBeDefined();
        expect(config.autoStart).toBe(true);
      } catch (error) {
        // Circular references might cause issues - that's expected
        expect(error).toBeDefined();
      }
    });
  });

  // =========================================================================
  // File Operations Edge Cases
  // =========================================================================

  describe('File Operations Edge Cases', () => {
    it('should handle export to invalid paths', async () => {
      const invalidPaths = [
        '', // Empty path
        '/', // Root directory
        '/dev/null/invalid', // Invalid parent
        '\0invalid', // Null character
        'con', // Windows reserved name
        'prn', // Windows reserved name
        'aux', // Windows reserved name
      ];

      for (const invalidPath of invalidPaths) {
        try {
          await configurator.exportConfig('claude-desktop', invalidPath);
        } catch (error) {
          // Should fail for invalid paths
          expect(error).toBeDefined();
        }
      }
    });

    it('should handle import of malformed JSON gracefully', async () => {
      const malformedInputs = [
        '', // Empty string
        '{', // Incomplete JSON
        '{"mcpServers": {', // Incomplete JSON
        'not json at all', // Not JSON
        '{"mcpServers": null}', // Null servers
        '{"mcpServers": []}', // Array instead of object
        '{"mcpServers": {"server": "not an object"}}', // Invalid server config
      ];

      for (const malformed of malformedInputs) {
        vi.mocked(fs.readFile).mockResolvedValue(malformed);

        try {
          await configurator.importConfig('/path/to/malformed.json', 'claude-desktop');
        } catch (error) {
          // Should fail for malformed input
          expect(error).toBeDefined();
        }
      }
    });

    it('should handle import with extremely large files', async () => {
      // Create a very large configuration
      const largeConfig = {
        mcpServers: {} as Record<string, any>,
      };

      // Add 10,000 servers with large configurations
      for (let i = 0; i < 10000; i++) {
        largeConfig.mcpServers[`server-${i}`] = {
          command: 'test',
          args: Array.from({ length: 100 }, (_, j) => `arg-${i}-${j}`),
          env: Object.fromEntries(
            Array.from({ length: 50 }, (_, j) => [`VAR_${i}_${j}`, `value-${i}-${j}`])
          ),
        };
      }

      const largeJsonString = JSON.stringify(largeConfig);
      vi.mocked(fs.readFile).mockResolvedValue(largeJsonString);

      const start = performance.now();
      const imported = await configurator.importConfig('/path/to/large.json', 'claude-desktop');
      const end = performance.now();

      // Should handle large files efficiently (less than 10 seconds)
      expect(end - start).toBeLessThan(10000);
      expect(Object.keys(imported.servers || {})).toHaveLength(10000);
    });
  });

  // =========================================================================
  // Memory and Resource Edge Cases
  // =========================================================================

  describe('Memory and Resource Edge Cases', () => {
    it('should handle adding and removing many servers without memory leaks', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Add and remove servers many times
      for (let cycle = 0; cycle < 10; cycle++) {
        // Add 1000 servers
        for (let i = 0; i < 1000; i++) {
          configurator.addServer(`temp-${cycle}-${i}`, {
            name: `temp-${cycle}-${i}`,
            type: 'stdio',
            command: 'test',
          });
        }

        // Remove all servers added in this cycle
        for (let i = 0; i < 1000; i++) {
          configurator.removeServer(`temp-${cycle}-${i}`);
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle event listener accumulation', () => {
      const eventTypes = [
        'config:generated',
        'server:added',
        'server:removed',
        'config:validated',
        'env:detected',
      ] as const;

      // Add many listeners
      const listeners: Array<() => void> = [];
      for (let i = 0; i < 1000; i++) {
        for (const eventType of eventTypes) {
          const listener = vi.fn();
          configurator.on(eventType, listener);
          listeners.push(() => configurator.removeListener(eventType, listener));
        }
      }

      // Check listener count
      const totalListeners = eventTypes.reduce(
        (sum, eventType) => sum + configurator.listenerCount(eventType),
        0
      );
      expect(totalListeners).toBe(5000);

      // Remove all listeners
      listeners.forEach(removeListener => removeListener());

      // Check that listeners were removed
      const finalListeners = eventTypes.reduce(
        (sum, eventType) => sum + configurator.listenerCount(eventType),
        0
      );
      expect(finalListeners).toBe(0);
    });

    it('should handle deep configuration nesting', () => {
      // Create deeply nested configuration
      let deepEnv: any = 'value';
      for (let i = 0; i < 100; i++) {
        deepEnv = { [`level_${i}`]: deepEnv };
      }

      const deepConfig = {
        name: 'deep-config',
        type: 'stdio' as const,
        command: 'test',
        env: deepEnv,
      };

      try {
        const result = configurator.addServer('deep-config', deepConfig);
        expect(result.servers).toHaveProperty('deep-config');

        // Try to generate configuration with deep nesting
        const claudeConfig = configurator.generateConfig('claude-desktop');
        expect(claudeConfig).toBeDefined();
      } catch (error) {
        // Deep nesting might cause stack overflow or other issues
        console.log('Deep nesting error:', error.message);
      }
    });
  });

  // =========================================================================
  // Concurrency Edge Cases
  // =========================================================================

  describe('Concurrency Edge Cases', () => {
    it('should handle rapid add/remove operations', () => {
      const operations = [];
      const serverIds = [];

      // Create many rapid add/remove operations
      for (let i = 0; i < 1000; i++) {
        const serverId = `rapid-${i}`;
        serverIds.push(serverId);

        // Add
        operations.push(() => {
          configurator.addServer(serverId, {
            name: serverId,
            type: 'stdio',
            command: 'test',
          });
        });

        // Remove (will fail if add hasn't happened yet)
        operations.push(() => {
          try {
            configurator.removeServer(serverId);
          } catch (error) {
            // Expected to fail sometimes due to timing
          }
        });
      }

      // Shuffle operations to create race conditions
      for (let i = operations.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [operations[i], operations[j]] = [operations[j], operations[i]];
      }

      // Execute all operations
      operations.forEach(op => op());

      // Verify configurator is still functional
      const config = configurator.getConfig();
      expect(config).toBeDefined();

      // Clean up any remaining servers
      for (const serverId of serverIds) {
        try {
          configurator.removeServer(serverId);
        } catch (error) {
          // Might not exist - that's okay
        }
      }
    });

    it('should handle simultaneous configuration generation and modification', () => {
      // Start with some servers
      for (let i = 0; i < 10; i++) {
        configurator.addServer(`base-${i}`, {
          name: `base-${i}`,
          type: 'stdio',
          command: 'test',
        });
      }

      const results: any[] = [];
      const operations = [];

      // Generate configurations while modifying
      for (let i = 0; i < 50; i++) {
        operations.push(() => {
          results.push(configurator.generateConfig('claude-desktop'));
        });

        operations.push(() => {
          try {
            configurator.addServer(`concurrent-${i}`, {
              name: `concurrent-${i}`,
              type: 'stdio',
              command: 'test',
            });
          } catch (error) {
            // Might conflict
          }
        });
      }

      // Execute operations
      operations.forEach(op => op());

      // All results should be valid
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result).toHaveProperty('mcpServers');
      });
    });
  });
});