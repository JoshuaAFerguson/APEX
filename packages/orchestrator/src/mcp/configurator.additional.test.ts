/**
 * MCPConfigurator Additional Unit Tests
 *
 * Additional test coverage for acceptance criteria:
 * - Configuration file generation
 * - Server configuration validation
 * - Environment variable handling
 * - Configuration updates
 * - Multi-server configuration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import { MCPConfigurator, MCPConfiguratorError } from './configurator.js';
import type { ApexConfig, MCPConfig, MCPServerConfig } from '@apexcli/core';

vi.mock('fs/promises');

describe('MCPConfigurator - Additional Unit Tests', () => {
  let configurator: MCPConfigurator;
  let mockConfig: ApexConfig;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    mockConfig = {
      project: { name: 'test-project' },
      mcp: {
        enabled: true,
        servers: {
          testServer: {
            name: 'testServer',
            type: 'stdio',
            command: 'test-command',
            args: ['arg1', 'arg2'],
            autoStart: true,
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

  describe('Configuration File Generation', () => {
    it('should generate valid JSON format configuration', () => {
      const config = configurator.generateConfig('json');

      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('servers');
      expect(typeof config.enabled).toBe('boolean');
    });

    it('should handle empty configuration gracefully', () => {
      const emptyConfig: ApexConfig = {
        project: { name: 'empty' },
        mcp: { enabled: false, servers: {} },
      };

      const emptyConfigurator = new MCPConfigurator({
        projectPath: testProjectPath,
        config: emptyConfig,
      });

      const result = emptyConfigurator.generateConfig('apex');
      expect(result.enabled).toBe(false);
      expect(result.servers).toEqual({});
    });

    it('should export configuration with proper file structure', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await configurator.exportConfig('json', '/output/test.json');

      expect(fs.mkdir).toHaveBeenCalledWith('/output', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/output/test.json',
        expect.stringMatching(/"enabled"/),
        'utf-8'
      );
    });
  });

  describe('Server Configuration Validation', () => {
    it('should validate basic server configuration structure', () => {
      const serverConfig: MCPServerConfig = {
        name: 'valid-server',
        type: 'stdio',
        command: 'valid-command',
        autoStart: false,
      };

      const result = configurator.validateServerConfig(serverConfig);
      expect(result.valid).toBe(true);
    });

    it('should detect configuration schema violations', () => {
      const invalidConfig: MCPConfig = {
        enabled: 'invalid' as any, // Should be boolean
        servers: {},
      };

      const result = configurator.validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Environment Variable Handling', () => {
    it('should handle servers without environment variables', async () => {
      const result = await configurator.detectEnvironmentVariables('testServer');

      expect(result).toHaveProperty('variables');
      expect(result).toHaveProperty('missing');
      expect(result).toHaveProperty('found');
      expect(Array.isArray(result.variables)).toBe(true);
    });

    it('should validate environment variable requirements', async () => {
      const result = await configurator.validateEnvironmentVariables('testServer');

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration immutably', () => {
      const originalConfig = configurator.getConfig();
      const newServer: MCPServerConfig = {
        name: 'new-server',
        type: 'stdio',
        command: 'new-command',
      };

      const updatedConfig = configurator.addServer('new-server', newServer);

      expect(updatedConfig).not.toBe(originalConfig);
      expect(updatedConfig.servers).toHaveProperty('new-server');
      expect(originalConfig.servers).not.toHaveProperty('new-server');
    });

    it('should maintain configuration consistency during updates', () => {
      const server1: MCPServerConfig = {
        name: 'server1',
        type: 'stdio',
        command: 'cmd1',
      };

      configurator.addServer('server1', server1);
      const configAfterAdd = configurator.getConfig();

      configurator.removeServer('server1');
      const configAfterRemove = configurator.getConfig();

      expect(configAfterAdd.servers).toHaveProperty('server1');
      expect(configAfterRemove.servers).not.toHaveProperty('server1');
    });

    it('should handle configuration errors properly', () => {
      expect(() => {
        configurator.addServer('existing', mockConfig.mcp!.servers!.testServer);
        configurator.addServer('existing', mockConfig.mcp!.servers!.testServer);
      }).toThrow(MCPConfiguratorError);
    });
  });

  describe('Multi-Server Configuration', () => {
    beforeEach(() => {
      configurator.addServer('server-a', {
        name: 'server-a',
        type: 'stdio',
        command: 'cmd-a',
      });

      configurator.addServer('server-b', {
        name: 'server-b',
        type: 'http',
        url: 'http://example.com',
      });
    });

    it('should handle multiple servers of different types', () => {
      const config = configurator.getConfig();

      expect(config.servers).toHaveProperty('testServer');
      expect(config.servers).toHaveProperty('server-a');
      expect(config.servers).toHaveProperty('server-b');

      expect(config.servers!['server-a'].type).toBe('stdio');
      expect(config.servers!['server-b'].type).toBe('http');
    });

    it('should filter servers correctly for different output formats', () => {
      const allServers = configurator.generateConfig('apex');
      const claudeConfig = configurator.generateClaudeDesktopConfig();

      expect(Object.keys((allServers as MCPConfig).servers!)).toContain('server-b');
      expect(Object.keys(claudeConfig.mcpServers)).not.toContain('server-b');
    });

    it('should maintain server isolation during operations', () => {
      configurator.removeServer('server-a');
      const config = configurator.getConfig();

      expect(config.servers).not.toHaveProperty('server-a');
      expect(config.servers).toHaveProperty('server-b');
      expect(config.servers).toHaveProperty('testServer');
    });

    it('should validate multi-server configurations', () => {
      const multiConfig: MCPConfig = {
        enabled: true,
        servers: {
          valid1: {
            name: 'valid1',
            type: 'stdio',
            command: 'cmd1',
          },
          valid2: {
            name: 'valid2',
            type: 'http',
            url: 'http://example.com',
          },
        },
      };

      const result = configurator.validateConfig(multiConfig);
      expect(result.valid).toBe(true);
    });

    it('should detect environment variables across multiple servers', async () => {
      const results = await configurator.detectAllEnvironmentVariables();

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBeGreaterThanOrEqual(1);

      for (const [serverId, result] of results) {
        expect(typeof serverId).toBe('string');
        expect(result).toHaveProperty('variables');
        expect(result).toHaveProperty('missing');
        expect(result).toHaveProperty('found');
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid server IDs gracefully', () => {
      expect(() => configurator.removeServer('non-existent')).toThrow();

      try {
        configurator.removeServer('non-existent');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPConfiguratorError);
      }
    });

    it('should maintain state after failed operations', () => {
      const originalConfig = configurator.getConfig();

      try {
        configurator.addServer('invalid', {} as MCPServerConfig);
      } catch {
        // Expected to fail
      }

      const afterFailConfig = configurator.getConfig();
      expect(afterFailConfig).toEqual(originalConfig);
    });

    it('should handle filesystem errors during export', async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Permission denied'));

      await expect(configurator.exportConfig('json', '/invalid/path.json'))
        .rejects.toThrow('Permission denied');
    });
  });
});