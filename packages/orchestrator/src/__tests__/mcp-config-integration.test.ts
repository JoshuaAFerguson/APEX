/**
 * MCP Configuration System Integration Tests
 *
 * Comprehensive integration tests that verify the full MCP configuration flow
 * from generation through validation to application. Tests the interaction
 * between MCPConfigurator, MCPConfigValidator, EnvironmentDetector, and
 * MCPServerTemplates.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { MCPConfigurator } from '../mcp/configurator.js';
import { MCPConfigValidator } from '@apexcli/core';
import { EnvironmentDetector } from '@apexcli/core';
import type { ApexConfig, MCPConfig, MCPServerConfig } from '@apexcli/core';

// Mock external dependencies
vi.mock('fs/promises');
vi.mock('child_process');

describe('MCP Configuration System Integration', () => {
  let testProjectPath: string;
  let mockApexConfig: ApexConfig;
  let configurator: MCPConfigurator;
  let validator: MCPConfigValidator;
  let envDetector: EnvironmentDetector;

  beforeEach(() => {
    testProjectPath = '/test/integration/project';

    mockApexConfig = {
      project: { name: 'integration-test' },
      mcp: {
        enabled: true,
        servers: {},
        connection: {
          timeout: 5000,
          maxRetries: 3,
          retryDelay: 1000,
        },
      },
    } as ApexConfig;

    configurator = new MCPConfigurator({
      projectPath: testProjectPath,
      config: mockApexConfig,
    });

    validator = new MCPConfigValidator({
      checkCommandExistence: false, // Skip for integration tests
      checkEnvironmentVars: false,  // We'll test this separately
    });

    envDetector = new EnvironmentDetector(testProjectPath);

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('End-to-End Configuration Flow', () => {
    it('should complete full configuration lifecycle', async () => {
      // Step 1: Generate server from template
      const filesystemConfig = configurator.generateFromTemplate('filesystem', {
        autoStart: true,
      });

      expect(filesystemConfig).toBeDefined();
      expect(filesystemConfig.name).toBe('filesystem');
      expect(filesystemConfig.autoStart).toBe(true);
      expect(filesystemConfig.args).toContain(testProjectPath);

      // Step 2: Add server to configuration
      const updatedConfig = configurator.addServer('filesystem', filesystemConfig, {
        validate: false, // Skip validation for this step
      });

      expect(updatedConfig.servers).toHaveProperty('filesystem');

      // Step 3: Add GitHub server with environment variables
      const githubConfig = configurator.generateFromTemplate('github');
      configurator.addServer('github', githubConfig, { validate: false });

      // Step 4: Generate different output formats
      const apexFormat = configurator.generateConfig('apex');
      const claudeFormat = configurator.generateConfig('claude-desktop');

      expect(apexFormat).toHaveProperty('enabled', true);
      expect(apexFormat.servers).toHaveProperty('filesystem');
      expect(apexFormat.servers).toHaveProperty('github');

      expect(claudeFormat).toHaveProperty('mcpServers');
      const claudeServers = (claudeFormat as any).mcpServers;
      expect(claudeServers).toHaveProperty('filesystem');
      expect(claudeServers).toHaveProperty('github');

      // Step 5: Validate the generated configuration
      const validationResult = await validator.validate(apexFormat);
      expect(validationResult).toBeDefined();
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errorCount).toBe(0);

      // Step 6: Export configuration to file
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await configurator.exportConfig('claude-desktop', '/test/output/config.json');

      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/output/config.json',
        expect.stringContaining('"mcpServers"'),
        'utf-8'
      );
    });

    it('should handle complete environment variable workflow', async () => {
      // Mock environment detection
      vi.mocked(fs.access).mockImplementation(async (filePath) => {
        if (filePath === path.join(testProjectPath, '.env')) {
          return Promise.resolve();
        }
        throw new Error('File not found');
      });

      vi.mocked(fs.readFile).mockResolvedValue(
        'GITHUB_TOKEN=gh_test_token_123\nOPENAI_API_KEY=sk-test-key'
      );

      vi.mocked(fs.readdir).mockResolvedValue([]);

      // Step 1: Add server with environment requirements
      const serverConfig: MCPServerConfig = {
        name: 'env-test-server',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@test/server'],
        envVars: [
          {
            name: 'GITHUB_TOKEN',
            description: 'GitHub API token for repository access',
            required: true,
            sensitive: true,
            pattern: '^gh[ps]_[a-zA-Z0-9]{36}$',
          },
          {
            name: 'OPENAI_API_KEY',
            description: 'OpenAI API key for AI features',
            required: true,
            sensitive: true,
            pattern: '^sk-[a-zA-Z0-9]+$',
          },
          {
            name: 'OPTIONAL_VAR',
            description: 'Optional configuration variable',
            required: false,
            sensitive: false,
          },
        ],
      };

      configurator.addServer('env-test', serverConfig, { validate: false });

      // Step 2: Detect environment variables
      const envResult = await configurator.detectEnvironmentVariables('env-test');

      expect(envResult.variables).toHaveLength(3);
      expect(envResult.found.length).toBeGreaterThan(0);
      expect(envResult.missing.length).toBeGreaterThanOrEqual(0);

      // Step 3: Validate environment variables specifically
      const envValidation = await configurator.validateEnvironmentVariables('env-test');

      // The validation result should reflect the environment state
      expect(envValidation).toBeDefined();
      expect(typeof envValidation.valid).toBe('boolean');
    });

    it('should handle configuration import and conversion', async () => {
      // Step 1: Import from Claude Desktop format
      const claudeConfig = {
        mcpServers: {
          'imported-filesystem': {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/imported/path'],
            env: {
              'ROOT_PATH': '/imported/path',
              'READ_ONLY': 'true',
            },
          },
          'imported-github': {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: {
              'GITHUB_TOKEN': 'imported-token',
            },
          },
        },
      };

      const importedConfig = await configurator.importConfig(claudeConfig, 'claude-desktop');

      expect(importedConfig.enabled).toBe(true);
      expect(importedConfig.servers).toHaveProperty('imported-filesystem');
      expect(importedConfig.servers).toHaveProperty('imported-github');

      // Verify imported server details
      const importedFs = importedConfig.servers!['imported-filesystem'];
      expect(importedFs.type).toBe('stdio');
      expect(importedFs.command).toBe('npx');
      expect(importedFs.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem', '/imported/path']);
      expect(importedFs.env).toEqual({
        'ROOT_PATH': '/imported/path',
        'READ_ONLY': 'true',
      });

      // Step 2: Validate the imported configuration
      const importValidation = await validator.validate(importedConfig);
      expect(importValidation.isValid).toBe(true);

      // Step 3: Apply the configuration
      await configurator.applyConfig(importedConfig, {
        validate: true,
        backup: false,
      });

      // Step 4: Re-export in different format
      const reExported = configurator.generateConfig('apex');
      expect(reExported.servers).toHaveProperty('imported-filesystem');
      expect(reExported.servers).toHaveProperty('imported-github');
    });

    it('should handle complex template-based configuration', async () => {
      // Step 1: Get all available templates
      const allTemplates = configurator.getServerTemplates();
      expect(allTemplates.length).toBeGreaterThan(0);

      // Step 2: Filter templates by capability
      const gitTemplates = configurator.getServerTemplates('git');
      const fileTemplates = configurator.getServerTemplates('filesystem');

      expect(gitTemplates.every(t => t.capabilities.includes('git'))).toBe(true);
      expect(fileTemplates.every(t => t.capabilities.includes('filesystem'))).toBe(true);

      // Step 3: Generate configurations from multiple templates
      const templateIds = ['filesystem', 'git', 'fetch'];
      const generatedConfigs: Record<string, MCPServerConfig> = {};

      for (const templateId of templateIds) {
        const template = configurator.getServerTemplate(templateId);
        if (template) {
          generatedConfigs[templateId] = configurator.generateFromTemplate(templateId, {
            autoStart: templateId === 'filesystem', // Only filesystem auto-starts
          });
        }
      }

      expect(Object.keys(generatedConfigs)).toHaveLength(templateIds.length);

      // Step 4: Add all generated configs
      for (const [serverId, config] of Object.entries(generatedConfigs)) {
        configurator.addServer(serverId, config, { validate: false });
      }

      // Step 5: Validate the complete multi-server configuration
      const finalConfig = configurator.getConfig();
      const finalValidation = await validator.validate(finalConfig);

      expect(finalValidation).toBeDefined();
      expect(finalConfig.servers).toHaveProperty('filesystem');
      expect(finalConfig.servers).toHaveProperty('git');
      expect(finalConfig.servers).toHaveProperty('fetch');

      // Step 6: Export to multiple formats
      const formats: Array<'claude-desktop' | 'apex' | 'json'> = ['claude-desktop', 'apex', 'json'];

      for (const format of formats) {
        const exported = configurator.generateConfig(format);
        expect(exported).toBeDefined();

        if (format === 'claude-desktop') {
          expect(exported).toHaveProperty('mcpServers');
        } else {
          expect(exported).toHaveProperty('enabled');
          expect(exported).toHaveProperty('servers');
        }
      }
    });

    it('should handle error scenarios gracefully', async () => {
      // Test 1: Invalid template
      expect(() => configurator.generateFromTemplate('non-existent'))
        .toThrow('Template not found');

      // Test 2: Invalid server ID for environment detection
      await expect(configurator.detectEnvironmentVariables('non-existent'))
        .rejects.toThrow('Server or template not found');

      // Test 3: Duplicate server addition
      const testConfig: MCPServerConfig = {
        name: 'duplicate-test',
        type: 'stdio',
        command: 'test',
      };

      configurator.addServer('duplicate-test', testConfig, { validate: false });

      expect(() => configurator.addServer('duplicate-test', testConfig, { validate: false }))
        .toThrow('already exists');

      // Test 4: Remove non-existent server
      expect(() => configurator.removeServer('non-existent'))
        .toThrow('not found');

      // Test 5: Validation of invalid configuration
      const invalidConfig: MCPConfig = {
        enabled: true,
        servers: {
          'invalid': {
            name: 'invalid',
            type: 'stdio',
            // Missing required command
          } as MCPServerConfig,
        },
      };

      await expect(configurator.applyConfig(invalidConfig, { validate: true }))
        .rejects.toThrow('validation failed');
    });
  });

  describe('Event-Driven Integration', () => {
    it('should emit events throughout the configuration process', async () => {
      const events: Array<{ type: string; data: any }> = [];

      // Set up event listeners
      const eventTypes = [
        'config:generated',
        'config:validated',
        'config:applied',
        'env:detected',
        'env:missing',
        'server:added',
        'server:removed',
      ] as const;

      eventTypes.forEach(eventType => {
        configurator.on(eventType, (data) => {
          events.push({ type: eventType, data });
        });
      });

      // Step 1: Add servers (should emit server:added)
      const fsConfig = configurator.generateFromTemplate('filesystem');
      configurator.addServer('filesystem', fsConfig, { validate: false });

      // Step 2: Generate config (should emit config:generated)
      configurator.generateConfig('apex');

      // Step 3: Remove server (should emit server:removed)
      configurator.removeServer('filesystem');

      // Step 4: Validate config (should emit config:validated)
      const emptyConfig = configurator.getConfig();
      configurator.validateConfig(emptyConfig);

      // Verify events were emitted
      const eventTypes_ = events.map(e => e.type);
      expect(eventTypes_).toContain('server:added');
      expect(eventTypes_).toContain('config:generated');
      expect(eventTypes_).toContain('server:removed');
      expect(eventTypes_).toContain('config:validated');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large configurations efficiently', async () => {
      const startTime = Date.now();

      // Generate a large number of servers
      const serverCount = 100;
      for (let i = 0; i < serverCount; i++) {
        const config = configurator.generateFromTemplate('filesystem', {
          name: `filesystem-${i}`,
        });

        // Modify args to avoid conflicts
        config.args = ['-y', '@modelcontextprotocol/server-filesystem', `/path/${i}`];

        configurator.addServer(`filesystem-${i}`, config, { validate: false });
      }

      // Generate configuration with many servers
      const largeConfig = configurator.generateConfig('apex');
      expect(Object.keys(largeConfig.servers || {})).toHaveLength(serverCount);

      // Export to file
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await configurator.exportConfig('claude-desktop');

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 5 seconds for 100 servers)
      expect(duration).toBeLessThan(5000);

      // Verify the configuration is correct
      expect(fs.writeFile).toHaveBeenCalled();
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const configContent = writeCall[1] as string;
      const parsedConfig = JSON.parse(configContent);
      expect(Object.keys(parsedConfig.mcpServers)).toHaveLength(serverCount);
    });
  });

  describe('Cross-Format Compatibility', () => {
    it('should maintain data integrity across format conversions', async () => {
      // Step 1: Create a comprehensive configuration
      const originalConfig: MCPConfig = {
        enabled: true,
        servers: {
          'comprehensive-server': {
            name: 'comprehensive-server',
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@test/comprehensive'],
            env: {
              'ENV_VAR_1': 'value1',
              'ENV_VAR_2': 'value2',
            },
            envVars: [
              {
                name: 'ENV_VAR_3',
                description: 'Third environment variable',
                required: true,
                sensitive: false,
                value: 'value3',
              },
            ],
            autoStart: true,
          },
        },
        connection: {
          timeout: 10000,
          maxRetries: 5,
          retryDelay: 2000,
        },
      };

      // Step 2: Apply the configuration
      await configurator.applyConfig(originalConfig, { validate: false });

      // Step 3: Export to Claude Desktop format
      const claudeFormat = configurator.generateConfig('claude-desktop');

      // Step 4: Import it back
      const reimportedConfig = await configurator.importConfig(claudeFormat, 'claude-desktop');

      // Step 5: Verify core data is preserved
      const originalServer = originalConfig.servers!['comprehensive-server'];
      const reimportedServer = reimportedConfig.servers!['comprehensive-server'];

      expect(reimportedServer.name).toBe(originalServer.name);
      expect(reimportedServer.command).toBe(originalServer.command);
      expect(reimportedServer.args).toEqual(originalServer.args);

      // Environment variables should be merged
      expect(reimportedServer.env).toEqual({
        'ENV_VAR_1': 'value1',
        'ENV_VAR_2': 'value2',
        'ENV_VAR_3': 'value3',
      });

      // Step 6: Validate both configurations
      const originalValidation = await validator.validate(originalConfig);
      const reimportedValidation = await validator.validate(reimportedConfig);

      expect(originalValidation.isValid).toBe(true);
      expect(reimportedValidation.isValid).toBe(true);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should support typical development workflow', async () => {
      // Scenario: Developer sets up MCP for a project with filesystem and git support

      // Step 1: Add filesystem server for project access
      const filesystemConfig = configurator.generateFromTemplate('filesystem', {
        autoStart: true,
      });
      configurator.addServer('project-files', filesystemConfig, { validate: false });

      // Step 2: Add git server for repository operations
      const gitConfig = configurator.generateFromTemplate('git', {
        autoStart: false, // Manual start
      });
      configurator.addServer('git-ops', gitConfig, { validate: false });

      // Step 3: Add memory server for state persistence
      const memoryTemplate = configurator.getServerTemplate('memory');
      if (memoryTemplate) {
        const memoryConfig = configurator.generateFromTemplate('memory');
        configurator.addServer('session-memory', memoryConfig, { validate: false });
      }

      // Step 4: Generate Claude Desktop config for local development
      const devConfig = configurator.generateConfig('claude-desktop');
      expect(devConfig).toHaveProperty('mcpServers');

      const servers = (devConfig as any).mcpServers;
      expect(servers).toHaveProperty('project-files');
      expect(servers).toHaveProperty('git-ops');

      // Step 5: Export for team sharing
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await configurator.exportConfig(
        'claude-desktop',
        '/project/.claude/desktop_config.json'
      );

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/project/.claude/desktop_config.json',
        expect.stringContaining('project-files'),
        'utf-8'
      );

      // Step 6: Validate the final configuration
      const finalConfig = configurator.getConfig();
      const validation = await validator.validate(finalConfig);

      expect(validation.isValid).toBe(true);
      expect(Object.keys(finalConfig.servers || {})).toHaveLength(3);
    });
  });
});