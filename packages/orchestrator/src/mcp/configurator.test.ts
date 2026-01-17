/**
 * MCPConfigurator Unit Tests
 *
 * Comprehensive test suite for the MCPConfigurator class including
 * configuration generation, validation, environment variable detection,
 * and template management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MCPConfigurator, MCPConfiguratorError } from './configurator.js';
import { BUILTIN_TEMPLATES } from './templates.js';
import type { ApexConfig, MCPConfig, MCPServerConfig, MCPEnvironmentVar } from '@apexcli/core';

// Mock fs module
vi.mock('fs/promises');
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

describe('MCPConfigurator', () => {
  let configurator: MCPConfigurator;
  let mockConfig: ApexConfig;
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

    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with correct options', () => {
      expect(configurator).toBeDefined();
    });

    it('should load built-in templates', () => {
      const templates = configurator.getServerTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.id === 'filesystem')).toBe(true);
      expect(templates.some(t => t.id === 'github')).toBe(true);
    });
  });

  describe('Configuration Generation', () => {
    describe('generateConfig', () => {
      it('should generate APEX format configuration', () => {
        const config = configurator.generateConfig('apex');
        expect(config).toEqual(mockConfig.mcp);
      });

      it('should generate Claude Desktop format', () => {
        const config = configurator.generateConfig('claude-desktop');
        expect(config).toHaveProperty('mcpServers');

        const claudeConfig = config as any;
        expect(claudeConfig.mcpServers.filesystem).toEqual({
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', testProjectPath],
        });
      });
    });

    describe('exportConfig', () => {
      it('should export configuration to file', async () => {
        const outputPath = '/test/output/config.json';
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);

        await configurator.exportConfig('claude-desktop', outputPath);

        expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(outputPath), { recursive: true });
        expect(fs.writeFile).toHaveBeenCalledWith(
          outputPath,
          expect.stringContaining('"mcpServers"'),
          'utf-8'
        );
      });
    });
  });

  describe('Environment Variable Detection', () => {
    describe('detectEnvironmentVariables', () => {
      it('should detect missing required environment variables', async () => {
        const result = await configurator.detectEnvironmentVariables('github');

        expect(result.variables).toHaveLength(1);
        expect(result.missing).toHaveLength(1);
        expect(result.missing[0].name).toBe('GITHUB_TOKEN');
        expect(result.missing[0].required).toBe(true);
      });
    });
  });

  describe('Server Templates', () => {
    describe('getServerTemplates', () => {
      it('should return all templates', () => {
        const templates = configurator.getServerTemplates();
        expect(templates.length).toBeGreaterThan(0);
        expect(templates.some(t => t.id === 'filesystem')).toBe(true);
      });

      it('should filter by category', () => {
        const gitTemplates = configurator.getServerTemplates('git');
        expect(gitTemplates.every(t => t.capabilities.includes('git'))).toBe(true);
      });
    });

    describe('generateFromTemplate', () => {
      it('should generate configuration from template', () => {
        const config = configurator.generateFromTemplate('filesystem');

        expect(config.name).toBe('filesystem');
        expect(config.command).toBe('npx');
        expect(config.args).toContain(testProjectPath);
      });

      it('should throw error for non-existent template', () => {
        expect(() => configurator.generateFromTemplate('non-existent'))
          .toThrow('Template not found: non-existent');
      });
    });
  });

  describe('Configuration Validation', () => {
    describe('validateConfig', () => {
      it('should validate valid configuration', () => {
        const validConfig: MCPConfig = {
          enabled: true,
          servers: {
            filesystem: {
              name: 'filesystem',
              type: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem'],
            },
          },
        };

        const result = configurator.validateConfig(validConfig);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect validation errors', () => {
        const invalidConfig: MCPConfig = {
          enabled: true,
          servers: {
            invalid: {
              name: 'invalid',
              type: 'stdio',
            } as MCPServerConfig,
          },
        };

        const result = configurator.validateConfig(invalidConfig);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Built-in Templates', () => {
  it('should include common MCP servers', () => {
    const templateIds = BUILTIN_TEMPLATES.map(t => t.id);

    expect(templateIds).toContain('filesystem');
    expect(templateIds).toContain('git');
    expect(templateIds).toContain('github');
    expect(templateIds).toContain('fetch');
    expect(templateIds).toContain('memory');
  });

  it('should have verified templates', () => {
    const verifiedTemplates = BUILTIN_TEMPLATES.filter(t => t.verified);
    expect(verifiedTemplates.length).toBeGreaterThan(0);
  });
});

describe('Edge Cases and Integration Tests', () => {
  describe('Configuration Generation Edge Cases', () => {
    it('should handle empty server configuration', () => {
      const emptyConfig: ApexConfig = {
        project: { name: 'test' },
        mcp: { enabled: true, servers: {} },
      };

      const emptyConfigurator = new MCPConfigurator({
        projectPath: testProjectPath,
        config: emptyConfig,
      });

      const config = emptyConfigurator.generateConfig('apex');
      expect(config).toEqual(emptyConfig.mcp);
    });

    it('should filter servers correctly when specific servers requested', () => {
      const config = configurator.generateConfig('claude-desktop', ['filesystem']);
      const claudeConfig = config as any;

      expect(claudeConfig.mcpServers.filesystem).toBeDefined();
      expect(claudeConfig.mcpServers.github).toBeUndefined();
    });

    it('should handle servers with environment variables in Claude Desktop format', () => {
      const configWithEnv: ApexConfig = {
        project: { name: 'test' },
        mcp: {
          enabled: true,
          servers: {
            testServer: {
              name: 'testServer',
              type: 'stdio',
              command: 'npx',
              env: { TEST_VAR: 'test-value' },
              envVars: [
                {
                  name: 'ANOTHER_VAR',
                  description: 'Another variable',
                  required: true,
                  sensitive: false,
                  value: 'another-value',
                } as MCPEnvironmentVar,
              ],
            },
          },
        },
      };

      const testConfigurator = new MCPConfigurator({
        projectPath: testProjectPath,
        config: configWithEnv,
      });

      const config = testConfigurator.generateConfig('claude-desktop');
      const claudeConfig = config as any;

      expect(claudeConfig.mcpServers.testServer.env).toEqual({
        TEST_VAR: 'test-value',
        ANOTHER_VAR: 'another-value',
      });
    });

    it('should skip non-stdio servers for Claude Desktop format', () => {
      const configWithHttp: ApexConfig = {
        project: { name: 'test' },
        mcp: {
          enabled: true,
          servers: {
            httpServer: {
              name: 'httpServer',
              type: 'http',
              url: 'https://example.com/mcp',
            },
            stdioServer: {
              name: 'stdioServer',
              type: 'stdio',
              command: 'npx',
            },
          },
        },
      };

      const testConfigurator = new MCPConfigurator({
        projectPath: testProjectPath,
        config: configWithHttp,
      });

      const config = testConfigurator.generateConfig('claude-desktop');
      const claudeConfig = config as any;

      expect(claudeConfig.mcpServers.httpServer).toBeUndefined();
      expect(claudeConfig.mcpServers.stdioServer).toBeDefined();
    });
  });

  describe('Template Management Edge Cases', () => {
    it('should handle custom templates', () => {
      const customTemplate = {
        id: 'custom-server',
        name: 'Custom Server',
        description: 'Custom test server',
        package: 'custom-package',
        config: {
          name: 'custom',
          type: 'stdio' as const,
          command: 'node',
          args: ['server.js'],
        },
        envVars: [],
        capabilities: ['custom'],
        verified: false,
      };

      const customConfigurator = new MCPConfigurator({
        projectPath: testProjectPath,
        config: mockConfig,
        customTemplates: [customTemplate],
      });

      const templates = customConfigurator.getServerTemplates();
      expect(templates.some(t => t.id === 'custom-server')).toBe(true);

      const template = customConfigurator.getServerTemplate('custom-server');
      expect(template).toEqual(customTemplate);
    });

    it('should handle placeholder substitution correctly', () => {
      const config = configurator.generateFromTemplate('filesystem');

      expect(config.args).toContain(testProjectPath);
      expect(config.args?.some(arg => arg.includes('{{PROJECT_PATH}}'))).toBe(false);
    });

    it('should apply overrides when generating from template', () => {
      const config = configurator.generateFromTemplate('filesystem', {
        autoStart: false,
        args: ['custom-args'],
      });

      expect(config.autoStart).toBe(false);
      expect(config.args).toEqual(['custom-args']);
    });
  });

  describe('Configuration Import/Export', () => {
    it('should import from Claude Desktop configuration', async () => {
      const claudeConfig = {
        mcpServers: {
          importedServer: {
            command: 'npx',
            args: ['imported-package'],
            env: { IMPORTED_VAR: 'imported-value' },
          },
        },
      };

      const imported = await configurator.importConfig(claudeConfig, 'claude-desktop');

      expect(imported.servers?.importedServer).toBeDefined();
      expect(imported.servers?.importedServer.command).toBe('npx');
      expect(imported.servers?.importedServer.args).toEqual(['imported-package']);
      expect(imported.servers?.importedServer.env).toEqual({ IMPORTED_VAR: 'imported-value' });
    });

    it('should throw error for unsupported import format', async () => {
      await expect(configurator.importConfig('test', 'unsupported' as any))
        .rejects.toThrow('not yet implemented');
    });
  });

  describe('Event Emission', () => {
    it('should emit events during configuration generation', () => {
      const configGeneratedSpy = vi.fn();
      configurator.on('config:generated', configGeneratedSpy);

      configurator.generateConfig('apex');
      expect(configGeneratedSpy).toHaveBeenCalledWith({ format: 'apex' });
    });

    it('should emit events during environment variable detection', async () => {
      const envDetectedSpy = vi.fn();
      const envMissingSpy = vi.fn();

      configurator.on('env:detected', envDetectedSpy);
      configurator.on('env:missing', envMissingSpy);

      await configurator.detectEnvironmentVariables('github');

      expect(envDetectedSpy).toHaveBeenCalled();
      expect(envMissingSpy).toHaveBeenCalled();
    });

    it('should emit events during configuration validation', () => {
      const validatedSpy = vi.fn();
      configurator.on('config:validated', validatedSpy);

      const testConfig: MCPConfig = {
        enabled: true,
        servers: {
          test: {
            name: 'test',
            type: 'stdio',
            command: 'npx',
          },
        },
      };

      configurator.validateConfig(testConfig);
      expect(validatedSpy).toHaveBeenCalled();
    });
  });

  describe('Server Management', () => {
    describe('getConfig', () => {
      it('should return current configuration', () => {
        const config = configurator.getConfig();
        expect(config.enabled).toBe(true);
        expect(config.servers).toHaveProperty('filesystem');
        expect(config.servers).toHaveProperty('github');
      });

      it('should return a copy that prevents external mutations', () => {
        const config = configurator.getConfig();

        // Attempt to mutate the returned config
        config.enabled = false;
        config.servers!['new-server'] = {
          name: 'new-server',
          type: 'stdio',
          command: 'test',
        };

        // Original config should remain unchanged
        const freshConfig = configurator.getConfig();
        expect(freshConfig.enabled).toBe(true);
        expect(freshConfig.servers).not.toHaveProperty('new-server');
      });
    });

    describe('addServer', () => {
      const newServerConfig: MCPServerConfig = {
        name: 'new-test-server',
        type: 'stdio',
        command: 'npx',
        args: ['test-server'],
        autoStart: false,
      };

      it('should add a new server successfully', () => {
        const addedSpy = vi.fn();
        configurator.on('server:added', addedSpy);

        const updatedConfig = configurator.addServer('test-server', newServerConfig);

        expect(updatedConfig.servers).toHaveProperty('test-server');
        expect(updatedConfig.servers!['test-server']).toEqual(newServerConfig);
        expect(addedSpy).toHaveBeenCalledWith({
          serverId: 'test-server',
          config: newServerConfig,
        });
      });

      it('should throw error when server exists and overwrite is false', () => {
        // First add a server
        configurator.addServer('duplicate-server', newServerConfig);

        // Try to add again without overwrite
        expect(() => configurator.addServer('duplicate-server', newServerConfig))
          .toThrow('Server \'duplicate-server\' already exists');
      });

      it('should overwrite existing server when overwrite is true', () => {
        const originalConfig: MCPServerConfig = {
          name: 'original',
          type: 'stdio',
          command: 'original-command',
        };

        const updatedConfig: MCPServerConfig = {
          name: 'updated',
          type: 'http',
          url: 'http://example.com',
        };

        // Add original server
        configurator.addServer('overwrite-test', originalConfig);

        // Overwrite with new config
        const result = configurator.addServer('overwrite-test', updatedConfig, {
          overwrite: true,
        });

        expect(result.servers!['overwrite-test']).toEqual(updatedConfig);
      });

      it('should validate server config by default', () => {
        const invalidConfig: MCPServerConfig = {
          name: 'invalid',
          type: 'stdio',
          // Missing required command field
        } as MCPServerConfig;

        expect(() => configurator.addServer('invalid-server', invalidConfig))
          .toThrow('Server configuration validation failed');
      });

      it('should skip validation when validate is false', () => {
        const invalidConfig: MCPServerConfig = {
          name: 'invalid',
          type: 'stdio',
        } as MCPServerConfig;

        expect(() => configurator.addServer('invalid-server', invalidConfig, {
          validate: false,
        })).not.toThrow();
      });

      it('should handle servers object initialization', () => {
        // Create configurator with empty servers
        const emptyConfig: ApexConfig = {
          project: { name: 'test' },
          mcp: { enabled: true },
        };

        const emptyConfigurator = new MCPConfigurator({
          projectPath: testProjectPath,
          config: emptyConfig,
        });

        const result = emptyConfigurator.addServer('first-server', newServerConfig);
        expect(result.servers).toHaveProperty('first-server');
      });
    });

    describe('removeServer', () => {
      beforeEach(() => {
        // Add a test server for removal tests
        configurator.addServer('removal-test', {
          name: 'removal-test',
          type: 'stdio',
          command: 'test-command',
        });
      });

      it('should remove an existing server successfully', () => {
        const removedSpy = vi.fn();
        configurator.on('server:removed', removedSpy);

        const updatedConfig = configurator.removeServer('removal-test');

        expect(updatedConfig).not.toBeNull();
        expect(updatedConfig!.servers).not.toHaveProperty('removal-test');
        expect(removedSpy).toHaveBeenCalledWith({ serverId: 'removal-test' });
      });

      it('should throw error when server does not exist', () => {
        expect(() => configurator.removeServer('non-existent'))
          .toThrow('Server \'non-existent\' not found');
      });

      it('should handle removal from existing configuration', () => {
        // Verify server exists first
        const beforeConfig = configurator.getConfig();
        expect(beforeConfig.servers).toHaveProperty('removal-test');

        // Remove server
        const afterConfig = configurator.removeServer('removal-test');
        expect(afterConfig!.servers).not.toHaveProperty('removal-test');

        // Verify it's also removed from subsequent getConfig calls
        const freshConfig = configurator.getConfig();
        expect(freshConfig.servers).not.toHaveProperty('removal-test');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing server gracefully in environment detection', async () => {
      await expect(configurator.detectEnvironmentVariables('non-existent'))
        .rejects.toThrow('Server or template not found');
    });

    it('should handle missing template gracefully', () => {
      expect(() => configurator.generateFromTemplate('non-existent'))
        .toThrow('Template not found');
    });

    it('should validate configuration before applying', async () => {
      const invalidConfig: MCPConfig = {
        enabled: true,
        servers: {
          invalid: {
            name: 'invalid',
            type: 'stdio',
            // Missing command
          } as MCPServerConfig,
        },
      };

      await expect(configurator.applyConfig(invalidConfig))
        .rejects.toThrow('Configuration validation failed');
    });

    describe('MCPConfiguratorError', () => {
      it('should throw proper error when server already exists', () => {
        const serverConfig: MCPServerConfig = {
          name: 'test',
          type: 'stdio',
          command: 'test',
        };

        configurator.addServer('existing', serverConfig);

        try {
          configurator.addServer('existing', serverConfig);
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(MCPConfiguratorError);
          expect((error as MCPConfiguratorError).code).toBe('SERVER_EXISTS');
          expect((error as MCPConfiguratorError).serverId).toBe('existing');
        }
      });

      it('should throw proper error when removing non-existent server', () => {
        try {
          configurator.removeServer('non-existent');
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(MCPConfiguratorError);
          expect((error as MCPConfiguratorError).code).toBe('SERVER_NOT_FOUND');
          expect((error as MCPConfiguratorError).serverId).toBe('non-existent');
        }
      });

      it('should throw proper error for validation failures', () => {
        const invalidConfig: MCPServerConfig = {
          name: 'invalid',
          type: 'stdio',
        } as MCPServerConfig;

        try {
          configurator.addServer('invalid', invalidConfig);
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(MCPConfiguratorError);
          expect((error as MCPConfiguratorError).code).toBe('VALIDATION_FAILED');
          expect((error as MCPConfiguratorError).serverId).toBe('invalid');
        }
      });
    });
  });
});