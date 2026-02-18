/**
 * Comprehensive unit tests for MCPConfigurator
 * Tests configuration generation, validation, server management, and template system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import {
  MCPConfigurator,
  MCPConfiguratorError,
  type MCPConfiguratorOptions,
  type MCPServerTemplate,
  type ClaudeDesktopConfig,
  type EnvVarDetectionResult,
  type ConfigValidationResult,
} from '../mcp/configurator.js';
import type {
  MCPConfig,
  MCPServerConfig,
  ApexConfig,
  MCPEnvironmentVar,
} from '@apexcli/core';
import * as fs from 'fs/promises';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('../mcp/templates.js');
vi.mock('../mcp/env-detector.js');
vi.mock('../mcp/config-validator.js');

const mockFs = vi.mocked(fs);

describe('MCPConfigurator', () => {
  let configurator: MCPConfigurator;
  let mockConfig: ApexConfig;
  const projectPath = '/test/project';

  const sampleServerConfig: MCPServerConfig = {
    name: 'filesystem',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    autoStart: true,
    envVars: [
      {
        name: 'FS_ROOT',
        description: 'Root directory for filesystem access',
        required: false,
        defaultValue: '/tmp',
      },
    ],
  };

  const sampleTemplate: MCPServerTemplate = {
    id: 'filesystem',
    name: 'Filesystem Server',
    description: 'Secure filesystem access for MCP',
    package: '@modelcontextprotocol/server-filesystem',
    config: {
      name: 'filesystem',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      autoStart: true,
    },
    envVars: [
      {
        name: 'FS_ROOT',
        description: 'Root directory for filesystem access',
        required: false,
        defaultValue: '/tmp',
      },
    ],
    capabilities: ['file:read', 'file:write', 'directory:list'],
    verified: true,
    defaultEnabled: true,
  };

  beforeEach(() => {
    mockConfig = {
      project: {
        name: 'Test Project',
        description: 'Test project',
      },
      agents: {},
      workflows: {},
      limits: {
        maxTokens: 100000,
        maxCost: 10.0,
        timeoutMs: 300000,
      },
      autonomy: {
        level: 'medium',
        autoApprove: false,
      },
      mcp: {
        enabled: true,
        servers: {
          filesystem: sampleServerConfig,
          github: {
            name: 'github',
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            autoStart: false,
            envVars: [
              {
                name: 'GITHUB_TOKEN',
                description: 'GitHub personal access token',
                required: true,
              },
            ],
          },
        },
        connection: {
          timeout: 30000,
          retries: 3,
        },
        marketplace: {
          enabled: true,
          autoUpdate: true,
          sources: ['https://marketplace.modelcontextprotocol.io'],
        },
      },
    };

    // Mock filesystem operations
    mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
    mockFs.writeFile = vi.fn().mockResolvedValue(undefined);
    mockFs.readFile = vi.fn().mockResolvedValue('{}');

    configurator = new MCPConfigurator({
      projectPath,
      config: mockConfig,
      customTemplates: [sampleTemplate],
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with provided config', () => {
      const config = configurator.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.servers).toHaveProperty('filesystem');
      expect(config.servers).toHaveProperty('github');
      expect(config.connection?.timeout).toBe(30000);
      expect(config.marketplace?.enabled).toBe(true);
    });

    it('should normalize array servers to record format', () => {
      const configWithArrayServers = {
        ...mockConfig,
        mcp: {
          enabled: true,
          servers: [sampleServerConfig], // Array format
        },
      };

      const configuratorWithArray = new MCPConfigurator({
        projectPath,
        config: configWithArrayServers,
      });

      const config = configuratorWithArray.getConfig();
      expect(config.servers).toEqual({
        filesystem: sampleServerConfig,
      });
    });

    it('should register custom templates', () => {
      const template = configurator.getServerTemplate('filesystem');

      expect(template).toBeDefined();
      expect(template?.name).toBe('Filesystem Server');
      expect(template?.verified).toBe(true);
    });

    it('should handle missing MCP config', () => {
      const configWithoutMcp = {
        ...mockConfig,
        mcp: undefined,
      };

      const configuratorWithoutMcp = new MCPConfigurator({
        projectPath,
        config: configWithoutMcp,
      });

      const config = configuratorWithoutMcp.getConfig();
      expect(config.enabled).toBe(true); // Default
      expect(config.servers).toEqual({});
    });
  });

  describe('Configuration Generation', () => {
    it('should generate APEX format configuration', () => {
      const config = configurator.generateConfig('apex');

      expect(config).toHaveProperty('enabled', true);
      expect(config).toHaveProperty('servers');
      expect((config as MCPConfig).servers).toHaveProperty('filesystem');
      expect((config as MCPConfig).servers).toHaveProperty('github');
    });

    it('should generate JSON format configuration', () => {
      const config = configurator.generateConfig('json');

      expect(config).toHaveProperty('enabled', true);
      expect(config).toHaveProperty('servers');
      expect((config as MCPConfig).servers).toHaveProperty('filesystem');
    });

    it('should filter servers when specified', () => {
      const config = configurator.generateConfig('apex', ['filesystem']);

      expect((config as MCPConfig).servers).toHaveProperty('filesystem');
      expect((config as MCPConfig).servers).not.toHaveProperty('github');
    });

    it('should generate Claude Desktop configuration', () => {
      const config = configurator.generateConfig('claude-desktop') as ClaudeDesktopConfig;

      expect(config).toHaveProperty('mcpServers');
      expect(config.mcpServers).toHaveProperty('filesystem');
      expect(config.mcpServers).toHaveProperty('github');

      // Check filesystem server structure
      const fsServer = config.mcpServers.filesystem;
      expect(fsServer.command).toBe('npx');
      expect(fsServer.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem']);
      expect(fsServer.env).toEqual({ FS_ROOT: '/tmp' });
    });

    it('should generate Claude Desktop config with specific servers', () => {
      const config = configurator.generateClaudeDesktopConfig(['filesystem']);

      expect(config.mcpServers).toHaveProperty('filesystem');
      expect(config.mcpServers).not.toHaveProperty('github');
    });

    it('should handle servers without args in Claude Desktop format', () => {
      configurator.addServer('simple-server', {
        name: 'simple-server',
        type: 'stdio',
        command: 'simple-command',
        autoStart: false,
      }, { overwrite: true });

      const config = configurator.generateClaudeDesktopConfig(['simple-server']);
      const server = config.mcpServers['simple-server'];

      expect(server.command).toBe('simple-command');
      expect(server.args).toBeUndefined();
    });

    it('should skip non-stdio servers in Claude Desktop format', () => {
      configurator.addServer('tcp-server', {
        name: 'tcp-server',
        type: 'tcp',
        host: 'localhost',
        port: 8080,
        autoStart: false,
      } as MCPServerConfig, { overwrite: true });

      const config = configurator.generateClaudeDesktopConfig(['tcp-server']);

      expect(config.mcpServers).not.toHaveProperty('tcp-server');
    });

    it('should combine env and envVars in Claude Desktop format', () => {
      configurator.addServer('env-server', {
        name: 'env-server',
        type: 'stdio',
        command: 'test',
        env: { STATIC_VAR: 'value1' },
        envVars: [
          { name: 'DYNAMIC_VAR', value: 'value2', required: false },
        ],
        autoStart: false,
      }, { overwrite: true });

      const config = configurator.generateClaudeDesktopConfig(['env-server']);
      const server = config.mcpServers['env-server'];

      expect(server.env).toEqual({
        STATIC_VAR: 'value1',
        DYNAMIC_VAR: 'value2',
      });
    });
  });

  describe('Configuration Export', () => {
    it('should export configuration to file with default path', async () => {
      await configurator.exportConfig('claude-desktop');

      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/project/claude_desktop_config.json',
        expect.stringContaining('"mcpServers"'),
        'utf-8'
      );
    });

    it('should export configuration to custom path', async () => {
      const customPath = '/custom/path/config.json';

      await configurator.exportConfig('apex', customPath);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        customPath,
        expect.any(String),
        'utf-8'
      );
    });

    it('should create directory structure if needed', async () => {
      await configurator.exportConfig('apex', '/deep/nested/path/config.json');

      expect(mockFs.mkdir).toHaveBeenCalledWith('/deep/nested/path', { recursive: true });
    });

    it('should export with server filtering', async () => {
      await configurator.exportConfig('json', undefined, ['filesystem']);

      const writeCall = mockFs.writeFile.mock.calls[0];
      const configContent = writeCall[1] as string;
      const parsedConfig = JSON.parse(configContent);

      expect(parsedConfig.servers).toHaveProperty('filesystem');
      expect(parsedConfig.servers).not.toHaveProperty('github');
    });
  });

  describe('Environment Variable Detection', () => {
    beforeEach(() => {
      // Mock EnvVarDetector
      const mockDetector = {
        detectEnvironmentVariables: vi.fn(),
        resolveEnvVariable: vi.fn(),
      };

      // Access the private detector through configurator
      (configurator as any).envDetector = mockDetector;
    });

    it('should detect environment variables for server', async () => {
      const mockResult: EnvVarDetectionResult = {
        variables: [
          { name: 'GITHUB_TOKEN', description: 'GitHub token', required: true },
          { name: 'DEBUG', description: 'Debug mode', required: false },
        ],
        missing: [
          { name: 'GITHUB_TOKEN', description: 'GitHub token', required: true },
        ],
        found: [
          { name: 'DEBUG', description: 'Debug mode', required: false, value: 'true' },
        ],
        warnings: [
          { variable: 'GITHUB_TOKEN', message: 'Token should have repo scope' },
        ],
      };

      (configurator as any).envDetector.detectEnvironmentVariables.mockResolvedValue(mockResult);

      const result = await configurator.detectEnvironmentVariables('github');

      expect(result).toEqual(mockResult);
      expect((configurator as any).envDetector.detectEnvironmentVariables).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'GITHUB_TOKEN', required: true })
        ])
      );
    });

    it('should detect variables for all servers', async () => {
      const mockResult: EnvVarDetectionResult = {
        variables: [],
        missing: [],
        found: [],
        warnings: [],
      };

      (configurator as any).envDetector.detectEnvironmentVariables.mockResolvedValue(mockResult);

      const results = await configurator.detectAllEnvironmentVariables();

      expect(results.size).toBe(2); // filesystem and github
      expect(results.has('filesystem')).toBe(true);
      expect(results.has('github')).toBe(true);
    });

    it('should handle detection errors gracefully', async () => {
      (configurator as any).envDetector.detectEnvironmentVariables.mockRejectedValue(
        new Error('Detection failed')
      );

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const results = await configurator.detectAllEnvironmentVariables();

      expect(results.size).toBe(0); // No results due to errors
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to detect env vars'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should resolve environment variables from multiple sources', () => {
      const mockResult = {
        value: 'resolved-value',
        source: 'env' as const,
      };

      (configurator as any).envDetector.resolveEnvVariable.mockReturnValue(mockResult);

      const result = configurator.resolveEnvVariable('TEST_VAR');

      expect(result).toEqual(mockResult);
      expect((configurator as any).envDetector.resolveEnvVariable).toHaveBeenCalledWith(
        'TEST_VAR',
        ['env', 'config', 'user']
      );
    });

    it('should validate environment variables for server', async () => {
      const mockDetectionResult: EnvVarDetectionResult = {
        variables: [
          { name: 'REQUIRED_VAR', description: 'Required variable', required: true },
          { name: 'OPTIONAL_VAR', description: 'Optional variable', required: false },
        ],
        missing: [
          { name: 'REQUIRED_VAR', description: 'Required variable', required: true },
          { name: 'OPTIONAL_VAR', description: 'Optional variable', required: false },
        ],
        found: [],
        warnings: [
          { variable: 'REQUIRED_VAR', message: 'Invalid format' },
        ],
      };

      (configurator as any).envDetector.detectEnvironmentVariables.mockResolvedValue(mockDetectionResult);

      const result = await configurator.validateEnvironmentVariables('github');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_ENV_VAR');
      expect(result.warnings).toHaveLength(2); // One missing optional + one warning
    });
  });

  describe('Server Templates', () => {
    it('should get all server templates', () => {
      const templates = configurator.getServerTemplates();

      expect(templates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'filesystem',
            name: 'Filesystem Server',
          })
        ])
      );
    });

    it('should filter templates by category', () => {
      const templates = configurator.getServerTemplates('filesystem');

      expect(templates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'filesystem',
            capabilities: expect.arrayContaining(['file:read']),
          })
        ])
      );
    });

    it('should get specific template by ID', () => {
      const template = configurator.getServerTemplate('filesystem');

      expect(template).toBeDefined();
      expect(template?.id).toBe('filesystem');
      expect(template?.name).toBe('Filesystem Server');
    });

    it('should return undefined for non-existent template', () => {
      const template = configurator.getServerTemplate('nonexistent');

      expect(template).toBeUndefined();
    });

    it('should register custom template', () => {
      const customTemplate: MCPServerTemplate = {
        id: 'custom-server',
        name: 'Custom Server',
        description: 'Custom MCP server',
        package: 'custom-package',
        config: {
          name: 'custom-server',
          type: 'stdio',
          command: 'custom-command',
          autoStart: false,
        },
        envVars: [],
        capabilities: ['custom:capability'],
        verified: false,
      };

      configurator.registerTemplate(customTemplate);

      const registered = configurator.getServerTemplate('custom-server');
      expect(registered).toEqual(customTemplate);
    });

    it('should generate configuration from template', () => {
      const config = configurator.generateFromTemplate('filesystem');

      expect(config.name).toBe('filesystem');
      expect(config.type).toBe('stdio');
      expect(config.command).toBe('npx');
      expect(config.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem']);
      expect(config.envVars).toEqual(sampleTemplate.envVars);
    });

    it('should apply overrides when generating from template', () => {
      const config = configurator.generateFromTemplate('filesystem', {
        autoStart: false,
        args: ['--custom-arg'],
      });

      expect(config.autoStart).toBe(false);
      expect(config.args).toEqual(['--custom-arg']);
      expect(config.envVars).toEqual(sampleTemplate.envVars); // Should still include template envVars
    });

    it('should substitute placeholders in template', () => {
      const templateWithPlaceholders: MCPServerTemplate = {
        id: 'placeholder-test',
        name: 'Placeholder Test',
        description: 'Test placeholder substitution',
        package: 'test-package',
        config: {
          name: 'placeholder-test',
          type: 'stdio',
          command: 'test-command',
          args: ['{{PROJECT_PATH}}/script.sh'],
          autoStart: false,
        },
        envVars: [],
        capabilities: [],
        verified: false,
      };

      configurator.registerTemplate(templateWithPlaceholders);

      const config = configurator.generateFromTemplate('placeholder-test');

      expect(config.args).toEqual([`${projectPath}/script.sh`]);
    });

    it('should throw error for non-existent template', () => {
      expect(() => configurator.generateFromTemplate('nonexistent')).toThrow(
        'Template not found: nonexistent'
      );
    });
  });

  describe('Configuration Validation', () => {
    beforeEach(() => {
      // Mock ConfigValidator
      const mockValidator = {
        validateConfig: vi.fn(),
        validateServerConfig: vi.fn(),
      };

      (configurator as any).validator = mockValidator;
    });

    it('should validate complete MCP configuration', () => {
      const validationResult: ConfigValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      (configurator as any).validator.validateConfig.mockReturnValue(validationResult);

      const config = configurator.getConfig();
      const result = configurator.validateConfig(config);

      expect(result).toEqual(validationResult);
      expect((configurator as any).validator.validateConfig).toHaveBeenCalledWith(config);
    });

    it('should validate server configuration', () => {
      const validationResult: ConfigValidationResult = {
        valid: false,
        errors: [
          {
            path: 'servers.test.command',
            message: 'Command is required',
            code: 'MISSING_REQUIRED_FIELD',
          },
        ],
        warnings: [],
      };

      (configurator as any).validator.validateServerConfig.mockReturnValue(validationResult);

      const result = configurator.validateServerConfig(sampleServerConfig);

      expect(result).toEqual(validationResult);
      expect((configurator as any).validator.validateServerConfig).toHaveBeenCalledWith(
        sampleServerConfig
      );
    });
  });

  describe('Server Management', () => {
    it('should add new server to configuration', () => {
      const newServerConfig: MCPServerConfig = {
        name: 'new-server',
        type: 'stdio',
        command: 'new-command',
        autoStart: false,
      };

      const updatedConfig = configurator.addServer('new-server', newServerConfig);

      expect(updatedConfig.servers).toHaveProperty('new-server');
      expect(updatedConfig.servers!['new-server']).toEqual(newServerConfig);
    });

    it('should prevent adding duplicate server without overwrite', () => {
      expect(() => configurator.addServer('filesystem', sampleServerConfig)).toThrow(
        MCPConfiguratorError
      );
    });

    it('should allow overwriting existing server', () => {
      const modifiedConfig = {
        ...sampleServerConfig,
        command: 'modified-command',
      };

      const updatedConfig = configurator.addServer('filesystem', modifiedConfig, {
        overwrite: true,
      });

      expect(updatedConfig.servers!['filesystem'].command).toBe('modified-command');
    });

    it('should validate server config when adding', () => {
      const invalidConfig: MCPServerConfig = {
        name: '',
        type: 'stdio',
        command: '',
        autoStart: false,
      };

      const validationResult: ConfigValidationResult = {
        valid: false,
        errors: [
          {
            path: 'name',
            message: 'Name is required',
            code: 'MISSING_REQUIRED_FIELD',
          },
        ],
        warnings: [],
      };

      (configurator as any).validator.validateServerConfig.mockReturnValue(validationResult);

      expect(() => configurator.addServer('invalid', invalidConfig)).toThrow(
        MCPConfiguratorError
      );
    });

    it('should skip validation when requested', () => {
      const config: MCPServerConfig = {
        name: 'test',
        type: 'stdio',
        command: 'test',
        autoStart: false,
      };

      const updatedConfig = configurator.addServer('test', config, { validate: false });

      expect(updatedConfig.servers).toHaveProperty('test');
      expect((configurator as any).validator.validateServerConfig).not.toHaveBeenCalled();
    });

    it('should remove server from configuration', () => {
      const updatedConfig = configurator.removeServer('filesystem');

      expect(updatedConfig.servers).not.toHaveProperty('filesystem');
      expect(updatedConfig.servers).toHaveProperty('github'); // Other servers remain
    });

    it('should throw error when removing non-existent server', () => {
      expect(() => configurator.removeServer('nonexistent')).toThrow(MCPConfiguratorError);
    });

    it('should initialize servers object if not present', () => {
      const emptyConfig = new MCPConfigurator({
        projectPath,
        config: {
          ...mockConfig,
          mcp: { enabled: true },
        },
      });

      const newServerConfig: MCPServerConfig = {
        name: 'first-server',
        type: 'stdio',
        command: 'test',
        autoStart: false,
      };

      const updatedConfig = emptyConfig.addServer('first-server', newServerConfig);

      expect(updatedConfig.servers).toHaveProperty('first-server');
    });
  });

  describe('Configuration Import', () => {
    it('should import Claude Desktop configuration', async () => {
      const claudeConfig: ClaudeDesktopConfig = {
        mcpServers: {
          'claude-fs': {
            command: 'npx',
            args: ['-y', '@claude/filesystem'],
            env: {
              ROOT_DIR: '/home/user',
            },
          },
          'claude-git': {
            command: 'claude-git-server',
            env: {
              GIT_TOKEN: 'secret',
            },
          },
        },
      };

      const mcpConfig = await configurator.importConfig(claudeConfig, 'claude-desktop');

      expect(mcpConfig.enabled).toBe(true);
      expect(mcpConfig.servers).toHaveProperty('claude-fs');
      expect(mcpConfig.servers).toHaveProperty('claude-git');

      const fsServer = mcpConfig.servers!['claude-fs'];
      expect(fsServer.type).toBe('stdio');
      expect(fsServer.command).toBe('npx');
      expect(fsServer.args).toEqual(['-y', '@claude/filesystem']);
      expect(fsServer.env).toEqual({ ROOT_DIR: '/home/user' });

      const gitServer = mcpConfig.servers!['claude-git'];
      expect(gitServer.command).toBe('claude-git-server');
      expect(gitServer.args).toEqual([]);
      expect(gitServer.env).toEqual({ GIT_TOKEN: 'secret' });
    });

    it('should import from file path', async () => {
      const claudeConfig = {
        mcpServers: {
          'file-server': {
            command: 'file-command',
          },
        },
      };

      mockFs.readFile = vi.fn().mockResolvedValue(JSON.stringify(claudeConfig));

      const mcpConfig = await configurator.importConfig('/path/to/config.json', 'claude-desktop');

      expect(mcpConfig.servers).toHaveProperty('file-server');
      expect(mockFs.readFile).toHaveBeenCalledWith('/path/to/config.json', 'utf-8');
    });

    it('should handle missing optional fields in Claude Desktop config', async () => {
      const claudeConfig: ClaudeDesktopConfig = {
        mcpServers: {
          'minimal-server': {
            command: 'minimal-command',
          },
        },
      };

      const mcpConfig = await configurator.importConfig(claudeConfig, 'claude-desktop');
      const server = mcpConfig.servers!['minimal-server'];

      expect(server.args).toEqual([]);
      expect(server.env).toEqual({});
    });

    it('should throw error for unsupported import format', async () => {
      await expect(configurator.importConfig('test', 'unsupported' as any)).rejects.toThrow(
        'Import from format \'unsupported\' is not yet implemented'
      );
    });
  });

  describe('Event Emission', () => {
    it('should emit config generation events', () => {
      const eventSpy = vi.fn();
      configurator.on('config:generated', eventSpy);

      configurator.generateConfig('claude-desktop');

      expect(eventSpy).toHaveBeenCalledWith({ format: 'claude-desktop' });
    });

    it('should emit config export events', async () => {
      const eventSpy = vi.fn();
      configurator.on('config:generated', eventSpy);

      await configurator.exportConfig('apex', '/test/path.json');

      expect(eventSpy).toHaveBeenCalledWith({
        format: 'apex',
        path: '/test/path.json',
      });
    });

    it('should emit server management events', () => {
      const addSpy = vi.fn();
      const removeSpy = vi.fn();
      configurator.on('server:added', addSpy);
      configurator.on('server:removed', removeSpy);

      const newConfig: MCPServerConfig = {
        name: 'event-test',
        type: 'stdio',
        command: 'test',
        autoStart: false,
      };

      configurator.addServer('event-test', newConfig);
      configurator.removeServer('event-test');

      expect(addSpy).toHaveBeenCalledWith({
        serverId: 'event-test',
        config: newConfig,
      });
      expect(removeSpy).toHaveBeenCalledWith({
        serverId: 'event-test',
      });
    });

    it('should emit environment detection events', async () => {
      const detectionSpy = vi.fn();
      const missingSpy = vi.fn();
      configurator.on('env:detected', detectionSpy);
      configurator.on('env:missing', missingSpy);

      const mockResult: EnvVarDetectionResult = {
        variables: [],
        missing: [{ name: 'MISSING_VAR', required: true, description: 'Missing variable' }],
        found: [],
        warnings: [],
      };

      (configurator as any).envDetector.detectEnvironmentVariables.mockResolvedValue(mockResult);

      await configurator.detectEnvironmentVariables('github');

      expect(detectionSpy).toHaveBeenCalledWith(mockResult);
      expect(missingSpy).toHaveBeenCalledWith({
        variables: [{ name: 'MISSING_VAR', required: true, description: 'Missing variable' }],
      });
    });

    it('should emit validation events', () => {
      const validationSpy = vi.fn();
      configurator.on('config:validated', validationSpy);

      const mockResult: ConfigValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      (configurator as any).validator.validateConfig.mockReturnValue(mockResult);

      configurator.validateConfig(configurator.getConfig());

      expect(validationSpy).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('Error Cases', () => {
    it('should handle filesystem errors during export', async () => {
      mockFs.writeFile = vi.fn().mockRejectedValue(new Error('Permission denied'));

      await expect(configurator.exportConfig('apex')).rejects.toThrow('Permission denied');
    });

    it('should handle environment detection for non-existent server', async () => {
      await expect(configurator.detectEnvironmentVariables('nonexistent')).rejects.toThrow(
        'Server or template not found: nonexistent'
      );
    });

    it('should handle missing template config gracefully', () => {
      const result = (configurator as any).getServerOrTemplateConfig('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should preserve deep copy isolation', () => {
      const config = configurator.getConfig();
      config.enabled = false;

      const freshConfig = configurator.getConfig();
      expect(freshConfig.enabled).toBe(true); // Should not be affected
    });
  });

  describe('Default Paths', () => {
    it('should use correct default paths for different formats', async () => {
      const formats = [
        { format: 'claude-desktop', expectedPath: '/test/project/claude_desktop_config.json' },
        { format: 'apex', expectedPath: '/test/project/.apex/mcp-config.yaml' },
        { format: 'json', expectedPath: '/test/project/mcp-config.json' },
      ] as const;

      for (const { format, expectedPath } of formats) {
        mockFs.writeFile.mockClear();
        await configurator.exportConfig(format);

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expectedPath,
          expect.any(String),
          'utf-8'
        );
      }
    });
  });
});