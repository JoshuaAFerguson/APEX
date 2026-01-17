/**
 * MCPConfigurator Comprehensive Tests
 *
 * Extended test suite covering edge cases, integration scenarios,
 * error handling, and complex workflows for the MCPConfigurator class.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MCPConfigurator, MCPConfiguratorError, type MCPServerTemplate } from './configurator.js';
import type { ApexConfig, MCPConfig, MCPServerConfig, MCPEnvironmentVar } from '@apexcli/core';

// Mock fs module
vi.mock('fs/promises');

describe('MCPConfigurator - Comprehensive Tests', () => {
  let configurator: MCPConfigurator;
  let mockConfig: ApexConfig;
  let eventSpy: ReturnType<typeof vi.fn>;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    mockConfig = {
      project: { name: 'test-project' },
      mcp: {
        enabled: true,
        servers: {
          filesystem: {
            name: 'filesystem',
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', testProjectPath],
            autoStart: true,
          },
          github: {
            name: 'github',
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            autoStart: false,
            envVars: [
              {
                name: 'GITHUB_TOKEN',
                description: 'GitHub API Token',
                required: true,
                sensitive: true,
                pattern: '^gh[ps]_[a-zA-Z0-9]{36}$',
              } as MCPEnvironmentVar,
            ],
          },
        },
      },
    } as ApexConfig;

    configurator = new MCPConfigurator({
      projectPath: testProjectPath,
      config: mockConfig,
    });

    eventSpy = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    configurator.removeAllListeners();
  });

  // =========================================================================
  // Advanced Configuration Generation Tests
  // =========================================================================

  describe('Advanced Configuration Generation', () => {
    describe('generateClaudeDesktopConfig with complex scenarios', () => {
      it('should handle servers with no command gracefully', () => {
        const configWithBadServer: ApexConfig = {
          project: { name: 'test' },
          mcp: {
            enabled: true,
            servers: {
              badServer: {
                name: 'badServer',
                type: 'stdio',
                // command is missing
              } as MCPServerConfig,
              goodServer: {
                name: 'goodServer',
                type: 'stdio',
                command: 'npx',
              },
            },
          },
        };

        const testConfigurator = new MCPConfigurator({
          projectPath: testProjectPath,
          config: configWithBadServer,
        });

        const config = testConfigurator.generateClaudeDesktopConfig();

        expect(config.mcpServers.badServer).toBeUndefined();
        expect(config.mcpServers.goodServer).toBeDefined();
        expect(config.mcpServers.goodServer.command).toBe('npx');
      });

      it('should handle servers with empty args arrays', () => {
        const configWithEmptyArgs: ApexConfig = {
          project: { name: 'test' },
          mcp: {
            enabled: true,
            servers: {
              emptyArgs: {
                name: 'emptyArgs',
                type: 'stdio',
                command: 'node',
                args: [],
              },
            },
          },
        };

        const testConfigurator = new MCPConfigurator({
          projectPath: testProjectPath,
          config: configWithEmptyArgs,
        });

        const config = testConfigurator.generateClaudeDesktopConfig();

        expect(config.mcpServers.emptyArgs).toBeDefined();
        expect(config.mcpServers.emptyArgs.args).toBeUndefined();
        expect(config.mcpServers.emptyArgs.command).toBe('node');
      });

      it('should handle mixed environment variable sources correctly', () => {
        const configWithMixedEnv: ApexConfig = {
          project: { name: 'test' },
          mcp: {
            enabled: true,
            servers: {
              mixedEnv: {
                name: 'mixedEnv',
                type: 'stdio',
                command: 'npx',
                env: {
                  STATIC_VAR: 'static-value',
                  OVERRIDE_VAR: 'will-be-overridden',
                },
                envVars: [
                  {
                    name: 'OVERRIDE_VAR',
                    description: 'This overrides env',
                    required: true,
                    value: 'overridden-value',
                  } as MCPEnvironmentVar,
                  {
                    name: 'NEW_VAR',
                    description: 'New variable',
                    required: false,
                    value: 'new-value',
                  } as MCPEnvironmentVar,
                ],
              },
            },
          },
        };

        const testConfigurator = new MCPConfigurator({
          projectPath: testProjectPath,
          config: configWithMixedEnv,
        });

        const config = testConfigurator.generateClaudeDesktopConfig();

        expect(config.mcpServers.mixedEnv.env).toEqual({
          STATIC_VAR: 'static-value',
          OVERRIDE_VAR: 'overridden-value',
          NEW_VAR: 'new-value',
        });
      });

      it('should filter servers by type correctly for different formats', () => {
        const configWithMixedTypes: ApexConfig = {
          project: { name: 'test' },
          mcp: {
            enabled: true,
            servers: {
              stdioServer: {
                name: 'stdioServer',
                type: 'stdio',
                command: 'npx',
              },
              httpServer: {
                name: 'httpServer',
                type: 'http',
                url: 'https://example.com/mcp',
              },
              undefinedTypeServer: {
                name: 'undefinedTypeServer',
                // type is undefined, should be treated as stdio for Claude Desktop
                command: 'npx',
              } as MCPServerConfig,
            },
          },
        };

        const testConfigurator = new MCPConfigurator({
          projectPath: testProjectPath,
          config: configWithMixedTypes,
        });

        const claudeConfig = testConfigurator.generateClaudeDesktopConfig();
        const apexConfig = testConfigurator.generateConfig('apex');

        // Claude Desktop should only include stdio servers
        expect(claudeConfig.mcpServers.stdioServer).toBeDefined();
        expect(claudeConfig.mcpServers.httpServer).toBeUndefined();
        expect(claudeConfig.mcpServers.undefinedTypeServer).toBeDefined();

        // APEX format should include all servers
        expect((apexConfig as MCPConfig).servers?.stdioServer).toBeDefined();
        expect((apexConfig as MCPConfig).servers?.httpServer).toBeDefined();
        expect((apexConfig as MCPConfig).servers?.undefinedTypeServer).toBeDefined();
      });
    });

    describe('exportConfig with error scenarios', () => {
      it('should handle directory creation failures', async () => {
        vi.mocked(fs.mkdir).mockRejectedValue(new Error('Permission denied'));

        await expect(configurator.exportConfig('claude-desktop', '/restricted/path.json'))
          .rejects.toThrow('Permission denied');
      });

      it('should handle file write failures', async () => {
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockRejectedValue(new Error('Disk full'));

        await expect(configurator.exportConfig('claude-desktop'))
          .rejects.toThrow('Disk full');
      });

      it('should use default paths correctly for different formats', async () => {
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);

        await configurator.exportConfig('claude-desktop');
        await configurator.exportConfig('apex');
        await configurator.exportConfig('json');

        expect(vi.mocked(fs.writeFile)).toHaveBeenCalledWith(
          path.join(testProjectPath, 'claude_desktop_config.json'),
          expect.any(String),
          'utf-8'
        );
        expect(vi.mocked(fs.writeFile)).toHaveBeenCalledWith(
          path.join(testProjectPath, '.apex', 'mcp-config.yaml'),
          expect.any(String),
          'utf-8'
        );
        expect(vi.mocked(fs.writeFile)).toHaveBeenCalledWith(
          path.join(testProjectPath, 'mcp-config.json'),
          expect.any(String),
          'utf-8'
        );
      });
    });
  });

  // =========================================================================
  // Advanced Template Management Tests
  // =========================================================================

  describe('Advanced Template Management', () => {
    describe('Custom templates with complex scenarios', () => {
      it('should handle template registration with conflicts', () => {
        const existingTemplate = configurator.getServerTemplate('filesystem');
        expect(existingTemplate).toBeDefined();

        const conflictingTemplate: MCPServerTemplate = {
          id: 'filesystem', // Same ID as built-in
          name: 'Custom Filesystem',
          description: 'Custom filesystem server',
          package: 'custom-filesystem',
          config: {
            name: 'custom-filesystem',
            type: 'stdio',
            command: 'custom-command',
          },
          envVars: [],
          capabilities: ['custom-filesystem'],
          verified: false,
        };

        configurator.registerTemplate(conflictingTemplate);

        // Should overwrite the existing template
        const updated = configurator.getServerTemplate('filesystem');
        expect(updated?.name).toBe('Custom Filesystem');
        expect(updated?.package).toBe('custom-filesystem');
      });

      it('should handle multiple placeholder substitutions', () => {
        const templateWithPlaceholders: MCPServerTemplate = {
          id: 'multi-placeholder',
          name: 'Multi Placeholder Server',
          description: 'Server with multiple placeholders',
          package: 'multi-placeholder',
          config: {
            name: 'multi-placeholder',
            type: 'stdio',
            command: 'node',
            args: [
              '{{PROJECT_PATH}}/server.js',
              '--config={{PROJECT_PATH}}/config.json',
              '{{PROJECT_PATH}}'
            ],
          },
          envVars: [],
          capabilities: ['test'],
          verified: false,
        };

        configurator.registerTemplate(templateWithPlaceholders);
        const config = configurator.generateFromTemplate('multi-placeholder');

        expect(config.args).toEqual([
          `${testProjectPath}/server.js`,
          `--config=${testProjectPath}/config.json`,
          testProjectPath
        ]);
      });

      it('should handle template overrides correctly', () => {
        const config = configurator.generateFromTemplate('filesystem', {
          autoStart: false,
          args: ['--custom-arg'],
          env: { CUSTOM_ENV: 'test' },
        });

        expect(config.autoStart).toBe(false);
        expect(config.args).toEqual(['--custom-arg']);
        expect(config.env).toEqual({ CUSTOM_ENV: 'test' });
        expect(config.name).toBe('filesystem'); // Should keep original name
      });
    });

    describe('Template filtering and searching', () => {
      it('should filter by multiple categories', () => {
        const allTemplates = configurator.getServerTemplates();
        const gitTemplates = configurator.getServerTemplates('git');
        const filesystemTemplates = configurator.getServerTemplates('filesystem');

        expect(allTemplates.length).toBeGreaterThan(gitTemplates.length);
        expect(gitTemplates.every(t => t.capabilities.includes('git'))).toBe(true);
        expect(filesystemTemplates.every(t => t.capabilities.includes('filesystem'))).toBe(true);
      });

      it('should handle case-insensitive category filtering', () => {
        const lowerCase = configurator.getServerTemplates('git');
        const upperCase = configurator.getServerTemplates('GIT');
        const mixedCase = configurator.getServerTemplates('Git');

        expect(lowerCase).toEqual(upperCase);
        expect(lowerCase).toEqual(mixedCase);
      });

      it('should handle non-existent categories', () => {
        const nonExistent = configurator.getServerTemplates('non-existent-category');
        expect(nonExistent).toHaveLength(0);
      });
    });
  });

  // =========================================================================
  // Advanced Environment Variable Tests
  // =========================================================================

  describe('Advanced Environment Variable Detection', () => {
    describe('Complex environment variable scenarios', () => {
      it('should handle servers with complex environment configurations', async () => {
        const complexEnvConfig: ApexConfig = {
          project: { name: 'test' },
          mcp: {
            enabled: true,
            servers: {
              complexEnv: {
                name: 'complexEnv',
                type: 'stdio',
                command: 'npx',
                envVars: [
                  {
                    name: 'REQUIRED_VAR',
                    description: 'Required variable',
                    required: true,
                    sensitive: true,
                    pattern: '^[A-Z_]+$',
                  } as MCPEnvironmentVar,
                  {
                    name: 'OPTIONAL_VAR',
                    description: 'Optional variable',
                    required: false,
                    sensitive: false,
                    defaultValue: 'default-value',
                  } as MCPEnvironmentVar,
                  {
                    name: 'PATTERN_VAR',
                    description: 'Variable with pattern',
                    required: true,
                    pattern: '^prefix_[a-z]+_suffix$',
                  } as MCPEnvironmentVar,
                ],
              },
            },
          },
        };

        const testConfigurator = new MCPConfigurator({
          projectPath: testProjectPath,
          config: complexEnvConfig,
        });

        const result = await testConfigurator.detectEnvironmentVariables('complexEnv');

        expect(result.variables).toHaveLength(3);
        expect(result.missing).toHaveLength(3); // All missing since no env vars set
        expect(result.found).toHaveLength(0);
      });

      it('should handle environment validation with warnings', async () => {
        // Mock process.env to have some variables
        const originalEnv = process.env;
        process.env = {
          ...originalEnv,
          PATTERN_VAR: 'invalid-pattern', // Doesn't match pattern
        };

        const result = await configurator.validateEnvironmentVariables('github');

        // Restore original env
        process.env = originalEnv;

        expect(result.valid).toBe(false); // Should be invalid due to missing required vars
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should handle missing server for environment detection', async () => {
        await expect(configurator.detectEnvironmentVariables('non-existent-server'))
          .rejects.toThrow('Server or template not found: non-existent-server');
      });
    });

    describe('Environment variable detection for all servers', () => {
      it('should detect environment variables for all configured servers', async () => {
        const results = await configurator.detectAllEnvironmentVariables();

        expect(results.size).toBe(2); // filesystem and github
        expect(results.has('filesystem')).toBe(true);
        expect(results.has('github')).toBe(true);

        const githubResult = results.get('github');
        expect(githubResult?.variables).toHaveLength(1);
        expect(githubResult?.missing).toHaveLength(1);
      });

      it('should handle errors in individual server detection gracefully', async () => {
        // Mock console.warn to capture warning
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Add a server that will cause an error
        configurator.addServer('broken-server', {
          name: 'broken-server',
          type: 'stdio',
          command: 'broken',
        } as MCPServerConfig, { validate: false });

        const results = await configurator.detectAllEnvironmentVariables();

        // Should still process other servers
        expect(results.has('github')).toBe(true);
        expect(results.has('filesystem')).toBe(true);

        // The broken server should not be in results (or have empty result)
        // and a warning should have been logged
        expect(warnSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
      });
    });
  });

  // =========================================================================
  // Advanced Configuration Management Tests
  // =========================================================================

  describe('Advanced Configuration Management', () => {
    describe('Server management with complex scenarios', () => {
      it('should handle adding servers to empty configuration', () => {
        const emptyConfig: ApexConfig = {
          project: { name: 'test' },
          mcp: { enabled: true },
        };

        const emptyConfigurator = new MCPConfigurator({
          projectPath: testProjectPath,
          config: emptyConfig,
        });

        const newServer: MCPServerConfig = {
          name: 'new-server',
          type: 'stdio',
          command: 'npx',
        };

        const result = emptyConfigurator.addServer('new-server', newServer);

        expect(result.servers).toBeDefined();
        expect(result.servers!['new-server']).toEqual(newServer);
      });

      it('should handle removing last server', () => {
        const singleServerConfig: ApexConfig = {
          project: { name: 'test' },
          mcp: {
            enabled: true,
            servers: {
              onlyServer: {
                name: 'onlyServer',
                type: 'stdio',
                command: 'npx',
              },
            },
          },
        };

        const testConfigurator = new MCPConfigurator({
          projectPath: testProjectPath,
          config: singleServerConfig,
        });

        const result = testConfigurator.removeServer('onlyServer');

        expect(result?.servers).toEqual({});
      });

      it('should maintain configuration immutability', () => {
        const originalConfig = configurator.getConfig();
        const originalServerCount = Object.keys(originalConfig.servers || {}).length;

        // Try to modify the returned config
        if (originalConfig.servers) {
          originalConfig.servers['malicious'] = {
            name: 'malicious',
            type: 'stdio',
            command: 'evil-command',
          };
        }

        // Get fresh config - should be unchanged
        const freshConfig = configurator.getConfig();
        const freshServerCount = Object.keys(freshConfig.servers || {}).length;

        expect(freshServerCount).toBe(originalServerCount);
        expect(freshConfig.servers).not.toHaveProperty('malicious');
      });

      it('should handle server validation with detailed errors', () => {
        const complexInvalidServer: MCPServerConfig = {
          name: '',  // Invalid empty name
          type: 'stdio',
          command: '', // Invalid empty command
          args: [], // Empty args should be okay
          env: {}, // Empty env should be okay
          autoStart: true,
        } as MCPServerConfig;

        try {
          configurator.addServer('invalid-complex', complexInvalidServer);
          expect.fail('Should have thrown validation error');
        } catch (error) {
          expect(error).toBeInstanceOf(MCPConfiguratorError);
          expect((error as MCPConfiguratorError).code).toBe('VALIDATION_FAILED');
          expect(error.message).toContain('validation failed');
        }
      });
    });

    describe('Configuration import/export edge cases', () => {
      it('should handle Claude Desktop config import with edge cases', async () => {
        const edgeCaseConfig = {
          mcpServers: {
            emptyServer: {
              command: 'npx',
              // No args or env
            },
            argsOnlyServer: {
              command: 'node',
              args: ['server.js'],
              // No env
            },
            envOnlyServer: {
              command: 'python',
              env: { PYTHON_PATH: '/usr/bin/python' },
              // No args
            },
            fullServer: {
              command: 'java',
              args: ['-jar', 'server.jar'],
              env: { JAVA_HOME: '/usr/lib/jvm/java-8' },
            },
          },
        };

        const imported = await configurator.importConfig(edgeCaseConfig, 'claude-desktop');

        expect(imported.servers?.emptyServer).toEqual({
          name: 'emptyServer',
          type: 'stdio',
          command: 'npx',
          args: [],
          env: {},
          autoStart: false,
        });

        expect(imported.servers?.argsOnlyServer).toEqual({
          name: 'argsOnlyServer',
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
          env: {},
          autoStart: false,
        });

        expect(imported.servers?.envOnlyServer).toEqual({
          name: 'envOnlyServer',
          type: 'stdio',
          command: 'python',
          args: [],
          env: { PYTHON_PATH: '/usr/bin/python' },
          autoStart: false,
        });

        expect(imported.servers?.fullServer).toEqual({
          name: 'fullServer',
          type: 'stdio',
          command: 'java',
          args: ['-jar', 'server.jar'],
          env: { JAVA_HOME: '/usr/lib/jvm/java-8' },
          autoStart: false,
        });
      });

      it('should handle import from file path', async () => {
        const configContent = JSON.stringify({
          mcpServers: {
            fromFile: {
              command: 'npx',
              args: ['from-file'],
            },
          },
        });

        vi.mocked(fs.readFile).mockResolvedValue(configContent);

        const imported = await configurator.importConfig('/path/to/config.json', 'claude-desktop');

        expect(imported.servers?.fromFile).toBeDefined();
        expect(imported.servers?.fromFile.command).toBe('npx');
        expect(imported.servers?.fromFile.args).toEqual(['from-file']);
      });

      it('should handle malformed JSON in import', async () => {
        vi.mocked(fs.readFile).mockResolvedValue('{ malformed json }');

        await expect(configurator.importConfig('/path/to/bad.json', 'claude-desktop'))
          .rejects.toThrow();
      });
    });
  });

  // =========================================================================
  // Event System Tests
  // =========================================================================

  describe('Comprehensive Event System Tests', () => {
    it('should emit all relevant events during complex operations', async () => {
      const events: Array<{ event: string; data: any }> = [];

      // Listen to all events
      configurator.on('config:generated', (data) => events.push({ event: 'config:generated', data }));
      configurator.on('config:validated', (data) => events.push({ event: 'config:validated', data }));
      configurator.on('server:added', (data) => events.push({ event: 'server:added', data }));
      configurator.on('server:removed', (data) => events.push({ event: 'server:removed', data }));
      configurator.on('env:detected', (data) => events.push({ event: 'env:detected', data }));

      // Perform operations that should emit events
      configurator.generateConfig('claude-desktop');
      configurator.addServer('test-server', {
        name: 'test-server',
        type: 'stdio',
        command: 'test',
      });
      await configurator.detectEnvironmentVariables('test-server');
      configurator.removeServer('test-server');

      // Verify events were emitted
      expect(events.some(e => e.event === 'config:generated')).toBe(true);
      expect(events.some(e => e.event === 'server:added')).toBe(true);
      expect(events.some(e => e.event === 'env:detected')).toBe(true);
      expect(events.some(e => e.event === 'server:removed')).toBe(true);
    });

    it('should handle event listener removal correctly', () => {
      const listener = vi.fn();

      configurator.on('config:generated', listener);
      configurator.generateConfig('apex');
      expect(listener).toHaveBeenCalledTimes(1);

      configurator.removeListener('config:generated', listener);
      configurator.generateConfig('json');
      expect(listener).toHaveBeenCalledTimes(1); // Should not have been called again
    });

    it('should handle multiple listeners for the same event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      configurator.on('server:added', listener1);
      configurator.on('server:added', listener2);

      configurator.addServer('multi-listener-test', {
        name: 'multi-listener-test',
        type: 'stdio',
        command: 'test',
      });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Error Handling and Recovery Tests
  // =========================================================================

  describe('Comprehensive Error Handling', () => {
    describe('MCPConfiguratorError scenarios', () => {
      it('should provide detailed error information for all error codes', () => {
        const serverConfig: MCPServerConfig = {
          name: 'test',
          type: 'stdio',
          command: 'test',
        };

        // Test SERVER_EXISTS error
        configurator.addServer('exists-test', serverConfig);
        try {
          configurator.addServer('exists-test', serverConfig);
        } catch (error) {
          expect(error).toBeInstanceOf(MCPConfiguratorError);
          expect((error as MCPConfiguratorError).code).toBe('SERVER_EXISTS');
          expect((error as MCPConfiguratorError).serverId).toBe('exists-test');
        }

        // Test SERVER_NOT_FOUND error
        try {
          configurator.removeServer('not-found');
        } catch (error) {
          expect(error).toBeInstanceOf(MCPConfiguratorError);
          expect((error as MCPConfiguratorError).code).toBe('SERVER_NOT_FOUND');
          expect((error as MCPConfiguratorError).serverId).toBe('not-found');
        }

        // Test VALIDATION_FAILED error
        try {
          configurator.addServer('invalid', {} as MCPServerConfig);
        } catch (error) {
          expect(error).toBeInstanceOf(MCPConfiguratorError);
          expect((error as MCPConfiguratorError).code).toBe('VALIDATION_FAILED');
          expect((error as MCPConfiguratorError).serverId).toBe('invalid');
        }
      });
    });

    describe('Recovery from error states', () => {
      it('should recover gracefully from validation errors', () => {
        // Attempt to add invalid server
        try {
          configurator.addServer('invalid', {} as MCPServerConfig);
        } catch (error) {
          // Expected error
        }

        // Should still be able to add valid servers
        const validConfig = configurator.addServer('valid', {
          name: 'valid',
          type: 'stdio',
          command: 'valid-command',
        });

        expect(validConfig.servers).toHaveProperty('valid');
        expect(validConfig.servers).not.toHaveProperty('invalid');
      });

      it('should maintain state consistency after errors', () => {
        const originalConfig = configurator.getConfig();
        const originalServerCount = Object.keys(originalConfig.servers || {}).length;

        // Try various operations that should fail
        try {
          configurator.addServer('filesystem', { // Duplicate
            name: 'filesystem',
            type: 'stdio',
            command: 'test',
          });
        } catch (error) {
          // Expected
        }

        try {
          configurator.removeServer('non-existent');
        } catch (error) {
          // Expected
        }

        // Configuration should be unchanged
        const finalConfig = configurator.getConfig();
        const finalServerCount = Object.keys(finalConfig.servers || {}).length;

        expect(finalServerCount).toBe(originalServerCount);
        expect(finalConfig.servers).toEqual(originalConfig.servers);
      });
    });
  });

  // =========================================================================
  // Performance and Scalability Tests
  // =========================================================================

  describe('Performance and Scalability', () => {
    it('should handle large numbers of servers efficiently', () => {
      const largeConfig: ApexConfig = {
        project: { name: 'large-test' },
        mcp: {
          enabled: true,
          servers: {},
        },
      };

      // Create 100 servers
      for (let i = 0; i < 100; i++) {
        largeConfig.mcp!.servers![`server-${i}`] = {
          name: `server-${i}`,
          type: 'stdio',
          command: 'npx',
          args: [`server-${i}`],
        };
      }

      const largeConfigurator = new MCPConfigurator({
        projectPath: testProjectPath,
        config: largeConfig,
      });

      const start = performance.now();
      const config = largeConfigurator.generateConfig('claude-desktop');
      const end = performance.now();

      // Should complete in reasonable time (less than 1 second)
      expect(end - start).toBeLessThan(1000);

      // Should generate configuration for all servers
      expect(Object.keys(config.mcpServers)).toHaveLength(100);
    });

    it('should handle template operations efficiently with many templates', () => {
      // Register many custom templates
      for (let i = 0; i < 50; i++) {
        configurator.registerTemplate({
          id: `custom-${i}`,
          name: `Custom Template ${i}`,
          description: `Custom template number ${i}`,
          package: `custom-package-${i}`,
          config: {
            name: `custom-${i}`,
            type: 'stdio',
            command: 'npx',
          },
          envVars: [],
          capabilities: [`capability-${i % 5}`], // 5 different capabilities
          verified: i % 2 === 0,
        });
      }

      const start = performance.now();
      const allTemplates = configurator.getServerTemplates();
      const filteredTemplates = configurator.getServerTemplates('capability-0');
      const end = performance.now();

      // Should complete efficiently
      expect(end - start).toBeLessThan(100);

      // Should return correct counts
      expect(allTemplates.length).toBeGreaterThanOrEqual(50);
      expect(filteredTemplates.length).toBeGreaterThanOrEqual(10);
    });
  });
});