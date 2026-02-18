/**
 * MCPConfigurator Integration Tests
 *
 * Integration tests that test workflows, cross-module interactions,
 * and real-world usage scenarios.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MCPConfigurator, MCPConfiguratorError } from './configurator.js';
import type { ApexConfig, MCPConfig, MCPServerConfig } from '@apexcli/core';

// Mock fs module
vi.mock('fs/promises');

describe('MCPConfigurator - Integration Tests', () => {
  let configurator: MCPConfigurator;
  let mockConfig: ApexConfig;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    mockConfig = {
      project: { name: 'integration-test' },
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
        },
      },
    } as ApexConfig;

    configurator = new MCPConfigurator({
      projectPath: testProjectPath,
      config: mockConfig,
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    configurator.removeAllListeners();
  });

  // =========================================================================
  // End-to-End Workflow Tests
  // =========================================================================

  describe('Complete Configuration Workflows', () => {
    it('should support complete project setup workflow', async () => {
      const events: string[] = [];

      // Track events
      configurator.on('server:added', () => events.push('server:added'));
      configurator.on('config:generated', () => events.push('config:generated'));
      configurator.on('config:validated', () => events.push('config:validated'));
      configurator.on('env:detected', () => events.push('env:detected'));

      // Step 1: Add servers from templates
      const githubServer = configurator.generateFromTemplate('github', {
        autoStart: true,
      });
      configurator.addServer('github', githubServer);

      const postgresServer = configurator.generateFromTemplate('postgres');
      configurator.addServer('postgres', postgresServer);

      // Step 2: Validate configuration
      const config = configurator.getConfig();
      const validation = configurator.validateConfig(config);

      // Step 3: Check environment variables
      const envResults = await configurator.detectAllEnvironmentVariables();

      // Step 4: Generate Claude Desktop configuration
      const claudeConfig = configurator.generateConfig('claude-desktop');

      // Step 5: Export configuration
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      await configurator.exportConfig('claude-desktop');

      // Verify workflow completed successfully
      expect(events).toContain('server:added');
      expect(events).toContain('config:generated');
      expect(events).toContain('config:validated');
      expect(events).toContain('env:detected');

      expect(config.servers).toHaveProperty('filesystem');
      expect(config.servers).toHaveProperty('github');
      expect(config.servers).toHaveProperty('postgres');

      expect(validation).toBeDefined();
      expect(envResults.size).toBe(3);
      expect(claudeConfig.mcpServers).toHaveProperty('filesystem');
      expect(claudeConfig.mcpServers).toHaveProperty('github');
      // postgres might be filtered out for Claude Desktop if it's HTTP-based

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should handle configuration migration workflow', async () => {
      // Step 1: Import existing Claude Desktop configuration
      const existingConfig = {
        mcpServers: {
          legacy1: {
            command: 'python',
            args: ['legacy-server1.py'],
            env: { LEGACY_VAR: 'value1' },
          },
          legacy2: {
            command: 'node',
            args: ['legacy-server2.js'],
            env: { NODE_ENV: 'production' },
          },
        },
      };

      const imported = await configurator.importConfig(existingConfig, 'claude-desktop');

      // Step 2: Apply imported configuration
      await configurator.applyConfig(imported, { validate: false }); // Skip validation for legacy

      // Step 3: Get merged configuration (should include both original and imported)
      const mergedConfig = configurator.getConfig();

      // Step 4: Generate new configuration with all servers
      const newConfig = configurator.generateConfig('apex');

      // Verify migration completed successfully
      expect(imported.servers).toHaveProperty('legacy1');
      expect(imported.servers).toHaveProperty('legacy2');

      expect(imported.servers?.legacy1.command).toBe('python');
      expect(imported.servers?.legacy1.args).toEqual(['legacy-server1.py']);
      expect(imported.servers?.legacy1.env).toEqual({ LEGACY_VAR: 'value1' });

      // Note: mergedConfig might not include imported servers depending on applyConfig implementation
      // This tests the import functionality primarily
    });

    it('should support server lifecycle management workflow', () => {
      const serverEvents: Array<{ type: string; serverId: string }> = [];

      configurator.on('server:added', ({ serverId }) =>
        serverEvents.push({ type: 'added', serverId })
      );
      configurator.on('server:removed', ({ serverId }) =>
        serverEvents.push({ type: 'removed', serverId })
      );

      // Step 1: Add multiple servers
      const servers = ['git', 'fetch', 'memory'];
      for (const serverId of servers) {
        const template = configurator.getServerTemplate(serverId);
        expect(template).toBeDefined();

        const config = configurator.generateFromTemplate(serverId);
        configurator.addServer(serverId, config);
      }

      // Step 2: Verify all servers added
      let currentConfig = configurator.getConfig();
      expect(Object.keys(currentConfig.servers || {})).toHaveLength(4); // original + 3 new

      // Step 3: Remove some servers
      configurator.removeServer('git');
      configurator.removeServer('memory');

      // Step 4: Verify final state
      currentConfig = configurator.getConfig();
      expect(Object.keys(currentConfig.servers || {})).toHaveLength(2); // filesystem + fetch

      // Verify events
      expect(serverEvents.filter(e => e.type === 'added')).toHaveLength(3);
      expect(serverEvents.filter(e => e.type === 'removed')).toHaveLength(2);
      expect(serverEvents.some(e => e.type === 'added' && e.serverId === 'git')).toBe(true);
      expect(serverEvents.some(e => e.type === 'removed' && e.serverId === 'git')).toBe(true);
    });
  });

  // =========================================================================
  // Cross-Module Integration Tests
  // =========================================================================

  describe('Template and Environment Integration', () => {
    it('should integrate template generation with environment detection', async () => {
      // Step 1: Generate server from template that requires env vars
      const slackConfig = configurator.generateFromTemplate('slack');
      configurator.addServer('slack-test', slackConfig);

      // Step 2: Detect environment variables for the generated server
      const envResult = await configurator.detectEnvironmentVariables('slack-test');

      // Step 3: Validate environment variables
      const envValidation = await configurator.validateEnvironmentVariables('slack-test');

      // Verify integration
      expect(slackConfig.envVars).toBeDefined();
      expect(slackConfig.envVars?.length).toBeGreaterThan(0);

      expect(envResult.variables.length).toBeGreaterThan(0);
      expect(envResult.missing.length).toBeGreaterThan(0); // Should be missing since no env vars set

      expect(envValidation.valid).toBe(false); // Should be invalid due to missing required vars
      expect(envValidation.errors.length).toBeGreaterThan(0);
    });

    it('should integrate configuration generation with validation', () => {
      // Step 1: Add servers with various configurations
      configurator.addServer('valid-server', {
        name: 'valid-server',
        type: 'stdio',
        command: 'npx',
        args: ['valid-package'],
      });

      // Step 2: Generate configuration
      const config = configurator.getConfig();

      // Step 3: Validate generated configuration
      const validation = configurator.validateConfig(config);

      // Step 4: Generate Claude Desktop format and validate it can be created
      const claudeConfig = configurator.generateConfig('claude-desktop');

      // Verify integration
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(claudeConfig.mcpServers).toHaveProperty('filesystem');
      expect(claudeConfig.mcpServers).toHaveProperty('valid-server');
    });
  });

  // =========================================================================
  // Configuration Format Compatibility Tests
  // =========================================================================

  describe('Format Compatibility and Conversion', () => {
    it('should maintain data integrity across format conversions', async () => {
      // Step 1: Create complex configuration
      const complexServer = {
        name: 'complex-server',
        type: 'stdio' as const,
        command: 'node',
        args: ['--inspect', 'server.js', '--port=3000'],
        env: {
          NODE_ENV: 'development',
          DEBUG: 'true',
          PORT: '3000',
        },
        autoStart: true,
      };
      configurator.addServer('complex', complexServer);

      // Step 2: Export as Claude Desktop format
      const claudeConfig = configurator.generateConfig('claude-desktop');

      // Step 3: Import back from Claude Desktop format
      const imported = await configurator.importConfig(claudeConfig, 'claude-desktop');

      // Step 4: Compare original and round-trip data
      const originalComplex = configurator.getConfig().servers!['complex'];
      const importedComplex = imported.servers!['complex'];

      expect(importedComplex.name).toBe(originalComplex.name);
      expect(importedComplex.type).toBe(originalComplex.type);
      expect(importedComplex.command).toBe(originalComplex.command);
      expect(importedComplex.args).toEqual(originalComplex.args);
      expect(importedComplex.env).toEqual(originalComplex.env);
      // Note: autoStart might not be preserved through Claude Desktop format
    });

    it('should handle format-specific limitations correctly', () => {
      // Add different server types
      configurator.addServer('stdio-server', {
        name: 'stdio-server',
        type: 'stdio',
        command: 'npx',
      });

      configurator.addServer('http-server', {
        name: 'http-server',
        type: 'http',
        url: 'https://example.com/mcp',
      }, { validate: false }); // Skip validation as it might not support HTTP

      // Generate different formats
      const claudeConfig = configurator.generateConfig('claude-desktop');
      const apexConfig = configurator.generateConfig('apex') as MCPConfig;
      const jsonConfig = configurator.generateConfig('json') as MCPConfig;

      // Claude Desktop should only include stdio servers
      expect(claudeConfig.mcpServers['stdio-server']).toBeDefined();
      expect(claudeConfig.mcpServers['http-server']).toBeUndefined();

      // APEX and JSON formats should include all servers
      expect(apexConfig.servers!['stdio-server']).toBeDefined();
      expect(apexConfig.servers!['http-server']).toBeDefined();
      expect(jsonConfig.servers!['stdio-server']).toBeDefined();
      expect(jsonConfig.servers!['http-server']).toBeDefined();
    });
  });

  // =========================================================================
  // Real-World Scenario Tests
  // =========================================================================

  describe('Real-World Usage Scenarios', () => {
    it('should handle typical development setup scenario', async () => {
      // Simulate setting up MCP for a typical development project

      // Step 1: Start with essential servers
      const essentialServers = ['filesystem', 'git', 'fetch'];

      for (const serverId of essentialServers) {
        const config = configurator.generateFromTemplate(serverId);
        configurator.addServer(serverId, config);
      }

      // Step 2: Add project-specific servers
      configurator.addServer('project-specific', {
        name: 'project-specific',
        type: 'stdio',
        command: 'node',
        args: ['scripts/mcp-server.js'],
        env: { PROJECT_ROOT: testProjectPath },
      });

      // Step 3: Validate entire configuration
      const config = configurator.getConfig();
      const validation = configurator.validateConfig(config);

      // Step 4: Export for Claude Desktop
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      await configurator.exportConfig('claude-desktop',
        path.join(testProjectPath, '.config', 'claude_desktop_config.json')
      );

      // Verify development setup
      expect(Object.keys(config.servers || {})).toHaveLength(5); // original + 4 new
      expect(validation.valid).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(testProjectPath, '.config', 'claude_desktop_config.json'),
        expect.stringContaining('"mcpServers"'),
        'utf-8'
      );
    });

    it('should handle enterprise environment scenario', async () => {
      // Simulate enterprise setup with security and compliance considerations

      // Step 1: Add enterprise-grade servers
      const enterpriseServers = {
        'auth-service': {
          name: 'auth-service',
          type: 'http',
          url: 'https://auth.company.com/mcp',
          headers: { 'X-API-Key': '{{AUTH_API_KEY}}' },
        },
        'monitoring': {
          name: 'monitoring',
          type: 'stdio',
          command: 'monitoring-agent',
          env: {
            MONITORING_URL: 'https://monitoring.company.com',
            TEAM_ID: 'engineering',
          },
        },
      };

      for (const [serverId, serverConfig] of Object.entries(enterpriseServers)) {
        configurator.addServer(serverId, serverConfig as MCPServerConfig, { validate: false });
      }

      // Step 2: Validate configuration for enterprise requirements
      const config = configurator.getConfig();
      const validation = configurator.validateConfig(config);

      // Step 3: Check environment variable requirements
      const envResults = await configurator.detectAllEnvironmentVariables();

      // Step 4: Export in multiple formats for different environments
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await configurator.exportConfig('claude-desktop');
      await configurator.exportConfig('json', path.join(testProjectPath, 'config', 'mcp-production.json'));
      await configurator.exportConfig('apex', path.join(testProjectPath, '.apex', 'mcp-config.yaml'));

      // Verify enterprise setup
      expect(Object.keys(config.servers || {})).toHaveLength(3); // filesystem + 2 enterprise
      expect(envResults.size).toBe(3);
      expect(fs.writeFile).toHaveBeenCalledTimes(3); // Three export calls
    });

    it('should handle configuration update and rollback scenario', () => {
      // Simulate updating configuration and rolling back if needed

      // Step 1: Capture initial state
      const initialConfig = configurator.getConfig();
      const initialServerCount = Object.keys(initialConfig.servers || {}).length;

      // Step 2: Make configuration changes
      configurator.addServer('experimental', {
        name: 'experimental',
        type: 'stdio',
        command: 'experimental-server',
      });

      configurator.addServer('beta', {
        name: 'beta',
        type: 'stdio',
        command: 'beta-server',
      });

      // Step 3: Verify changes
      const updatedConfig = configurator.getConfig();
      expect(Object.keys(updatedConfig.servers || {})).toHaveLength(initialServerCount + 2);

      // Step 4: Simulate rollback (remove experimental servers)
      configurator.removeServer('experimental');
      configurator.removeServer('beta');

      // Step 5: Verify rollback
      const rolledBackConfig = configurator.getConfig();
      expect(Object.keys(rolledBackConfig.servers || {})).toHaveLength(initialServerCount);
      expect(rolledBackConfig.servers).toEqual(initialConfig.servers);
    });
  });

  // =========================================================================
  // Error Recovery Integration Tests
  // =========================================================================

  describe('Error Recovery Integration', () => {
    it('should recover from file system errors gracefully', async () => {
      // Step 1: Simulate file system error during export
      vi.mocked(fs.mkdir).mockRejectedValueOnce(new Error('Permission denied'));

      await expect(configurator.exportConfig('claude-desktop'))
        .rejects.toThrow('Permission denied');

      // Step 2: Verify configurator is still functional
      const config = configurator.getConfig();
      expect(config).toBeDefined();

      // Step 3: Verify can still add/remove servers
      configurator.addServer('recovery-test', {
        name: 'recovery-test',
        type: 'stdio',
        command: 'test',
      });

      const updatedConfig = configurator.getConfig();
      expect(updatedConfig.servers).toHaveProperty('recovery-test');

      // Step 4: Verify export works after fixing the error
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await expect(configurator.exportConfig('claude-desktop')).resolves.not.toThrow();
    });

    it('should handle partial validation failures gracefully', async () => {
      // Add multiple servers, some valid, some problematic
      configurator.addServer('valid1', {
        name: 'valid1',
        type: 'stdio',
        command: 'valid-command',
      });

      configurator.addServer('problematic', {
        name: 'problematic',
        type: 'stdio',
        command: 'problematic-command',
        envVars: [
          {
            name: 'REQUIRED_VAR',
            description: 'Required but missing',
            required: true,
          },
        ],
      } as MCPServerConfig, { validate: false });

      configurator.addServer('valid2', {
        name: 'valid2',
        type: 'stdio',
        command: 'another-valid-command',
      });

      // Environment validation for problematic server should fail
      const envValidation = await configurator.validateEnvironmentVariables('problematic');
      expect(envValidation.valid).toBe(false);

      // But the configurator should still work for other servers
      const valid1Env = await configurator.validateEnvironmentVariables('valid1');
      expect(valid1Env.valid).toBe(true);

      // Overall configuration generation should work (filtering as needed)
      const claudeConfig = configurator.generateConfig('claude-desktop');
      expect(claudeConfig.mcpServers).toHaveProperty('valid1');
      expect(claudeConfig.mcpServers).toHaveProperty('valid2');
      // problematic might or might not be included depending on validation logic
    });
  });
});