/**
 * MCPConfigurator Configure Integration Tests
 *
 * Integration tests specifically for configuration persistence, format validity,
 * and round-trip conversion of MCP server configurations.
 *
 * Test Coverage:
 * 1. Configuration changes persist via exportConfig/file writes
 * 2. Config file format remains valid JSON/YAML after add/remove/update operations
 * 3. Round-trip conversion between formats preserves data
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MCPConfigurator, MCPConfiguratorError } from './configurator.js';
import type { ApexConfig, MCPConfig, MCPServerConfig, ClaudeDesktopConfig } from '@apexcli/core';

// Mock fs module
vi.mock('fs/promises');

describe('MCPConfigurator Configure Integration Tests', () => {
  let configurator: MCPConfigurator;
  let mockConfig: ApexConfig;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    mockConfig = {
      project: { name: 'configure-test' },
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
  // Test Suite 1: Configuration Persistence
  // =========================================================================

  describe('Configuration Persistence via exportConfig', () => {
    it('should persist add server operations to file system', async () => {
      // Mock file system operations
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Add a new server
      const newServer: MCPServerConfig = {
        name: 'test-server',
        type: 'stdio',
        command: 'node',
        args: ['test-server.js'],
        env: { TEST_VAR: 'test_value' },
        autoStart: false,
      };

      configurator.addServer('test-server', newServer);

      // Export configuration
      await configurator.exportConfig('json', path.join(testProjectPath, 'test-config.json'));

      // Verify file write was called
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(testProjectPath, 'test-config.json'),
        expect.any(String),
        'utf-8'
      );

      // Get the written content
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenContent = writeCall[1] as string;
      const parsedContent = JSON.parse(writtenContent);

      // Verify the new server is persisted
      expect(parsedContent.servers).toHaveProperty('test-server');
      expect(parsedContent.servers['test-server']).toEqual({
        name: 'test-server',
        type: 'stdio',
        command: 'node',
        args: ['test-server.js'],
        env: { TEST_VAR: 'test_value' },
        autoStart: false,
      });
    });

    it('should persist remove server operations to file system', async () => {
      // Mock file system operations
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Add multiple servers first
      configurator.addServer('server1', {
        name: 'server1',
        type: 'stdio',
        command: 'server1-cmd',
      });
      configurator.addServer('server2', {
        name: 'server2',
        type: 'stdio',
        command: 'server2-cmd',
      });

      // Remove one server
      configurator.removeServer('server1');

      // Export configuration
      await configurator.exportConfig('json', path.join(testProjectPath, 'after-remove.json'));

      // Get the written content
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenContent = writeCall[1] as string;
      const parsedContent = JSON.parse(writtenContent);

      // Verify server1 is removed but server2 remains
      expect(parsedContent.servers).not.toHaveProperty('server1');
      expect(parsedContent.servers).toHaveProperty('server2');
      expect(parsedContent.servers).toHaveProperty('filesystem'); // Original server
    });

    it('should persist server update operations to file system', async () => {
      // Mock file system operations
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Add a server
      const originalServer: MCPServerConfig = {
        name: 'updatable-server',
        type: 'stdio',
        command: 'original-command',
        args: ['original-arg'],
      };
      configurator.addServer('updatable-server', originalServer);

      // Update the server by removing and re-adding with changes
      configurator.removeServer('updatable-server');
      const updatedServer: MCPServerConfig = {
        name: 'updatable-server',
        type: 'stdio',
        command: 'updated-command',
        args: ['updated-arg', '--verbose'],
        env: { NEW_VAR: 'new_value' },
        autoStart: true,
      };
      configurator.addServer('updatable-server', updatedServer);

      // Export configuration
      await configurator.exportConfig('json', path.join(testProjectPath, 'updated-config.json'));

      // Get the written content
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenContent = writeCall[1] as string;
      const parsedContent = JSON.parse(writtenContent);

      // Verify the server has updated properties
      expect(parsedContent.servers['updatable-server']).toEqual({
        name: 'updatable-server',
        type: 'stdio',
        command: 'updated-command',
        args: ['updated-arg', '--verbose'],
        env: { NEW_VAR: 'new_value' },
        autoStart: true,
      });
    });

    it('should persist configuration to different target paths', async () => {
      // Mock file system operations
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Add a test server
      configurator.addServer('path-test', {
        name: 'path-test',
        type: 'stdio',
        command: 'test-cmd',
      });

      // Test different export paths
      const testPaths = [
        '/custom/path/config.json',
        path.join(testProjectPath, '.apex', 'mcp-config.yaml'),
        path.join(testProjectPath, 'config', 'production.json'),
      ];

      for (const testPath of testPaths) {
        await configurator.exportConfig('json', testPath);
      }

      // Verify mkdir was called for each directory
      expect(fs.mkdir).toHaveBeenCalledTimes(testPaths.length);
      expect(fs.writeFile).toHaveBeenCalledTimes(testPaths.length);

      // Verify each path was written to
      const writeCalls = vi.mocked(fs.writeFile).mock.calls;
      testPaths.forEach((expectedPath, index) => {
        expect(writeCalls[index][0]).toBe(expectedPath);
      });
    });

    it('should persist complex server configurations with all properties', async () => {
      // Mock file system operations
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Add a complex server with all possible properties
      const complexServer: MCPServerConfig = {
        name: 'complex-server',
        type: 'http',
        url: 'https://example.com/mcp',
        headers: {
          'Authorization': 'Bearer {{API_TOKEN}}',
          'X-Custom-Header': 'custom-value',
        },
        envVars: [
          {
            name: 'API_TOKEN',
            description: 'Authentication token for API access',
            required: true,
            sensitive: true,
            pattern: '^[a-zA-Z0-9_-]{32,}$',
          },
          {
            name: 'DEBUG_MODE',
            description: 'Enable debug logging',
            required: false,
            defaultValue: 'false',
          },
        ],
        autoStart: true,
        connection: {
          timeout: 30000,
          retryAttempts: 3,
          retryDelay: 1000,
        },
      };

      configurator.addServer('complex-server', complexServer, { validate: false });

      // Export configuration
      await configurator.exportConfig('json', path.join(testProjectPath, 'complex-config.json'));

      // Get the written content
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenContent = writeCall[1] as string;
      const parsedContent = JSON.parse(writtenContent);

      // Verify all complex properties are persisted
      const persistedServer = parsedContent.servers['complex-server'];
      expect(persistedServer.name).toBe('complex-server');
      expect(persistedServer.type).toBe('http');
      expect(persistedServer.url).toBe('https://example.com/mcp');
      expect(persistedServer.headers).toEqual({
        'Authorization': 'Bearer {{API_TOKEN}}',
        'X-Custom-Header': 'custom-value',
      });
      expect(persistedServer.envVars).toHaveLength(2);
      expect(persistedServer.autoStart).toBe(true);
      expect(persistedServer.connection).toEqual({
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
      });
    });
  });

  // =========================================================================
  // Test Suite 2: Config File Format Validity
  // =========================================================================

  describe('Config File Format Validity', () => {
    it('should maintain valid JSON format after add operations', async () => {
      // Mock file system operations
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Add multiple servers
      const servers = [
        { id: 'server1', config: { name: 'server1', type: 'stdio' as const, command: 'cmd1' }},
        { id: 'server2', config: { name: 'server2', type: 'stdio' as const, command: 'cmd2' }},
        { id: 'server3', config: { name: 'server3', type: 'stdio' as const, command: 'cmd3' }},
      ];

      for (const { id, config } of servers) {
        configurator.addServer(id, config);

        // Export after each add
        await configurator.exportConfig('json', path.join(testProjectPath, `after-add-${id}.json`));

        // Verify JSON is valid
        const writeCall = vi.mocked(fs.writeFile).mock.calls[vi.mocked(fs.writeFile).mock.calls.length - 1];
        const writtenContent = writeCall[1] as string;

        // This should not throw if JSON is valid
        expect(() => JSON.parse(writtenContent)).not.toThrow();

        // Verify structure
        const parsed = JSON.parse(writtenContent);
        expect(parsed).toHaveProperty('servers');
        expect(typeof parsed.servers).toBe('object');
        expect(parsed.servers).toHaveProperty(id);
      }
    });

    it('should maintain valid JSON format after remove operations', async () => {
      // Mock file system operations
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Add several servers
      ['temp1', 'temp2', 'temp3'].forEach(id => {
        configurator.addServer(id, {
          name: id,
          type: 'stdio',
          command: `${id}-command`,
        });
      });

      // Remove servers one by one
      for (const serverId of ['temp1', 'temp2', 'temp3']) {
        configurator.removeServer(serverId);

        // Export after each removal
        await configurator.exportConfig('json', path.join(testProjectPath, `after-remove-${serverId}.json`));

        // Verify JSON is still valid
        const writeCall = vi.mocked(fs.writeFile).mock.calls[vi.mocked(fs.writeFile).mock.calls.length - 1];
        const writtenContent = writeCall[1] as string;

        // This should not throw if JSON is valid
        expect(() => JSON.parse(writtenContent)).not.toThrow();

        // Verify structure is intact
        const parsed = JSON.parse(writtenContent);
        expect(parsed).toHaveProperty('servers');
        expect(typeof parsed.servers).toBe('object');
        expect(parsed.servers).not.toHaveProperty(serverId);
      }
    });

    it('should maintain valid JSON format with special characters and unicode', async () => {
      // Mock file system operations
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Add server with special characters
      const specialServer: MCPServerConfig = {
        name: 'special-chars-测试-🚀',
        type: 'stdio',
        command: 'echo',
        args: ['Hello "World" & \'test\' with unicode: 测试 🚀'],
        env: {
          'SPECIAL_VAR': 'Value with "quotes" and \'apostrophes\' and unicode: 测试',
          'JSON_VAR': '{"nested": "json", "array": [1, 2, 3]}',
          'NEWLINE_VAR': 'Line 1\nLine 2\rLine 3',
        },
      };

      configurator.addServer('special-server', specialServer);

      // Export configuration
      await configurator.exportConfig('json', path.join(testProjectPath, 'special-chars.json'));

      // Verify JSON is valid
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenContent = writeCall[1] as string;

      expect(() => JSON.parse(writtenContent)).not.toThrow();

      // Verify special characters are preserved
      const parsed = JSON.parse(writtenContent);
      const persistedServer = parsed.servers['special-server'];
      expect(persistedServer.name).toBe('special-chars-测试-🚀');
      expect(persistedServer.args[0]).toBe('Hello "World" & \'test\' with unicode: 测试 🚀');
      expect(persistedServer.env['SPECIAL_VAR']).toBe('Value with "quotes" and \'apostrophes\' and unicode: 测试');
      expect(persistedServer.env['NEWLINE_VAR']).toBe('Line 1\nLine 2\rLine 3');
    });

    it('should maintain valid Claude Desktop JSON format', async () => {
      // Mock file system operations
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Add stdio servers (compatible with Claude Desktop)
      configurator.addServer('git', {
        name: 'git',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-git'],
        env: { GIT_USER: 'testuser' },
      });

      configurator.addServer('fetch', {
        name: 'fetch',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-fetch'],
      });

      // Export as Claude Desktop format
      await configurator.exportConfig('claude-desktop', path.join(testProjectPath, 'claude_desktop_config.json'));

      // Verify JSON is valid
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenContent = writeCall[1] as string;

      expect(() => JSON.parse(writtenContent)).not.toThrow();

      // Verify Claude Desktop structure
      const parsed = JSON.parse(writtenContent) as ClaudeDesktopConfig;
      expect(parsed).toHaveProperty('mcpServers');
      expect(typeof parsed.mcpServers).toBe('object');

      // Verify servers have required Claude Desktop properties
      expect(parsed.mcpServers).toHaveProperty('filesystem');
      expect(parsed.mcpServers).toHaveProperty('git');
      expect(parsed.mcpServers).toHaveProperty('fetch');

      Object.values(parsed.mcpServers).forEach(server => {
        expect(server).toHaveProperty('command');
        expect(typeof server.command).toBe('string');
        if (server.args) {
          expect(Array.isArray(server.args)).toBe(true);
        }
        if (server.env) {
          expect(typeof server.env).toBe('object');
        }
      });
    });

    it('should handle empty servers configuration gracefully', async () => {
      // Mock file system operations
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Remove the default filesystem server to test empty state
      configurator.removeServer('filesystem');

      // Export configuration with no servers
      await configurator.exportConfig('json', path.join(testProjectPath, 'empty-config.json'));

      // Verify JSON is valid
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenContent = writeCall[1] as string;

      expect(() => JSON.parse(writtenContent)).not.toThrow();

      // Verify structure
      const parsed = JSON.parse(writtenContent);
      expect(parsed).toHaveProperty('servers');
      expect(Object.keys(parsed.servers || {})).toHaveLength(0);
    });
  });

  // =========================================================================
  // Test Suite 3: Round-trip Conversion Between Formats
  // =========================================================================

  describe('Round-trip Conversion Between Formats', () => {
    it('should preserve data through JSON → import → export cycle', async () => {
      // Mock file system operations
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Create original configuration
      const originalServers = {
        'server1': {
          name: 'server1',
          type: 'stdio' as const,
          command: 'node',
          args: ['server1.js', '--port', '3001'],
          env: { SERVER1_ENV: 'value1' },
          autoStart: true,
        },
        'server2': {
          name: 'server2',
          type: 'stdio' as const,
          command: 'python',
          args: ['server2.py'],
          env: { SERVER2_ENV: 'value2', DEBUG: 'true' },
          autoStart: false,
        },
      };

      // Add servers to configurator
      Object.entries(originalServers).forEach(([id, config]) => {
        configurator.addServer(id, config);
      });

      // Step 1: Export to JSON format
      await configurator.exportConfig('json', path.join(testProjectPath, 'original.json'));
      const exportCall = vi.mocked(fs.writeFile).mock.calls[0];
      const exportedContent = exportCall[1] as string;
      const exportedConfig = JSON.parse(exportedContent) as MCPConfig;

      // Step 2: Import the exported configuration
      const imported = await configurator.importConfig(exportedConfig, 'json');

      // Step 3: Create a new configurator and apply the imported config
      const newConfigurator = new MCPConfigurator({
        projectPath: testProjectPath,
        config: { project: { name: 'test' }, mcp: { enabled: true } } as ApexConfig,
      });
      await newConfigurator.applyConfig(imported, { validate: false });

      // Step 4: Export again to compare
      vi.clearAllMocks();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await newConfigurator.exportConfig('json', path.join(testProjectPath, 'roundtrip.json'));
      const roundtripCall = vi.mocked(fs.writeFile).mock.calls[0];
      const roundtripContent = roundtripCall[1] as string;
      const roundtripConfig = JSON.parse(roundtripContent) as MCPConfig;

      // Compare original servers with round-trip result
      expect(roundtripConfig.servers).toHaveProperty('server1');
      expect(roundtripConfig.servers).toHaveProperty('server2');

      const roundtripServer1 = roundtripConfig.servers!['server1'];
      const roundtripServer2 = roundtripConfig.servers!['server2'];

      expect(roundtripServer1.name).toBe(originalServers.server1.name);
      expect(roundtripServer1.type).toBe(originalServers.server1.type);
      expect(roundtripServer1.command).toBe(originalServers.server1.command);
      expect(roundtripServer1.args).toEqual(originalServers.server1.args);
      expect(roundtripServer1.env).toEqual(originalServers.server1.env);
      expect(roundtripServer1.autoStart).toBe(originalServers.server1.autoStart);

      expect(roundtripServer2.name).toBe(originalServers.server2.name);
      expect(roundtripServer2.type).toBe(originalServers.server2.type);
      expect(roundtripServer2.command).toBe(originalServers.server2.command);
      expect(roundtripServer2.args).toEqual(originalServers.server2.args);
      expect(roundtripServer2.env).toEqual(originalServers.server2.env);
      expect(roundtripServer2.autoStart).toBe(originalServers.server2.autoStart);

      newConfigurator.removeAllListeners();
    });

    it('should preserve data through Claude Desktop → import → export cycle', async () => {
      // Mock file system operations
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Create original Claude Desktop configuration
      const claudeDesktopConfig: ClaudeDesktopConfig = {
        mcpServers: {
          'filesystem': {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/test/path'],
            env: { FS_ROOT: '/test/path' },
          },
          'git-server': {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-git'],
            env: { GIT_AUTHOR: 'test-user' },
          },
        },
      };

      // Step 1: Import Claude Desktop configuration
      const imported = await configurator.importConfig(claudeDesktopConfig, 'claude-desktop');

      // Step 2: Apply imported configuration
      await configurator.applyConfig(imported, { validate: false });

      // Step 3: Export back to Claude Desktop format
      await configurator.exportConfig('claude-desktop', path.join(testProjectPath, 'roundtrip-claude.json'));

      const exportCall = vi.mocked(fs.writeFile).mock.calls[0];
      const exportedContent = exportCall[1] as string;
      const exportedConfig = JSON.parse(exportedContent) as ClaudeDesktopConfig;

      // Compare original with round-trip result
      expect(exportedConfig.mcpServers).toHaveProperty('filesystem');
      expect(exportedConfig.mcpServers).toHaveProperty('git-server');

      const roundtripFs = exportedConfig.mcpServers['filesystem'];
      const roundtripGit = exportedConfig.mcpServers['git-server'];
      const originalFs = claudeDesktopConfig.mcpServers['filesystem'];
      const originalGit = claudeDesktopConfig.mcpServers['git-server'];

      expect(roundtripFs.command).toBe(originalFs.command);
      expect(roundtripFs.args).toEqual(originalFs.args);
      expect(roundtripFs.env).toEqual(originalFs.env);

      expect(roundtripGit.command).toBe(originalGit.command);
      expect(roundtripGit.args).toEqual(originalGit.args);
      expect(roundtripGit.env).toEqual(originalGit.env);
    });

    it('should preserve complex environment variables through round-trip', async () => {
      // Mock file system operations
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Add server with complex environment variables
      const serverWithComplexEnv: MCPServerConfig = {
        name: 'complex-env-server',
        type: 'stdio',
        command: 'node',
        args: ['complex-server.js'],
        envVars: [
          {
            name: 'API_KEY',
            description: 'API authentication key',
            required: true,
            sensitive: true,
            pattern: '^[a-zA-Z0-9_-]{32,}$',
            source: 'env',
          },
          {
            name: 'LOG_LEVEL',
            description: 'Logging level',
            required: false,
            defaultValue: 'info',
            pattern: '^(debug|info|warn|error)$',
            source: 'default',
          },
          {
            name: 'CUSTOM_CONFIG',
            description: 'Custom configuration JSON',
            required: false,
            value: '{"feature1": true, "timeout": 5000}',
            source: 'config',
          },
        ],
        env: {
          'API_KEY': '{{API_KEY}}',
          'LOG_LEVEL': '{{LOG_LEVEL}}',
          'CUSTOM_CONFIG': '{{CUSTOM_CONFIG}}',
        },
      };

      configurator.addServer('complex-env-server', serverWithComplexEnv, { validate: false });

      // Step 1: Export to JSON
      await configurator.exportConfig('json', path.join(testProjectPath, 'complex-env.json'));
      const exportCall = vi.mocked(fs.writeFile).mock.calls[0];
      const exportedContent = exportCall[1] as string;
      const exportedConfig = JSON.parse(exportedContent) as MCPConfig;

      // Step 2: Import and re-apply
      const newConfigurator = new MCPConfigurator({
        projectPath: testProjectPath,
        config: { project: { name: 'test' }, mcp: { enabled: true } } as ApexConfig,
      });
      const imported = await newConfigurator.importConfig(exportedConfig, 'json');
      await newConfigurator.applyConfig(imported, { validate: false });

      // Step 3: Export again
      vi.clearAllMocks();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await newConfigurator.exportConfig('json', path.join(testProjectPath, 'complex-env-roundtrip.json'));
      const roundtripCall = vi.mocked(fs.writeFile).mock.calls[0];
      const roundtripContent = roundtripCall[1] as string;
      const roundtripConfig = JSON.parse(roundtripContent) as MCPConfig;

      // Compare environment variable configurations
      const original = serverWithComplexEnv;
      const roundtrip = roundtripConfig.servers!['complex-env-server'];

      expect(roundtrip.envVars).toBeDefined();
      expect(roundtrip.envVars).toHaveLength(original.envVars!.length);

      original.envVars!.forEach((originalEnvVar, index) => {
        const roundtripEnvVar = roundtrip.envVars![index];
        expect(roundtripEnvVar.name).toBe(originalEnvVar.name);
        expect(roundtripEnvVar.description).toBe(originalEnvVar.description);
        expect(roundtripEnvVar.required).toBe(originalEnvVar.required);
        expect(roundtripEnvVar.sensitive).toBe(originalEnvVar.sensitive);
        expect(roundtripEnvVar.pattern).toBe(originalEnvVar.pattern);
        expect(roundtripEnvVar.defaultValue).toBe(originalEnvVar.defaultValue);
        expect(roundtripEnvVar.value).toBe(originalEnvVar.value);
        expect(roundtripEnvVar.source).toBe(originalEnvVar.source);
      });

      expect(roundtrip.env).toEqual(original.env);

      newConfigurator.removeAllListeners();
    });

    it('should handle format-specific data loss gracefully in round-trips', async () => {
      // Mock file system operations
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Add servers with features not supported in Claude Desktop format
      configurator.addServer('http-server', {
        name: 'http-server',
        type: 'http', // Not supported in Claude Desktop
        url: 'https://example.com/mcp',
        headers: { 'Authorization': 'Bearer token' },
        autoStart: true,
      }, { validate: false });

      configurator.addServer('stdio-server', {
        name: 'stdio-server',
        type: 'stdio', // Supported in Claude Desktop
        command: 'node',
        args: ['server.js'],
        autoStart: false, // This might be lost in Claude Desktop format
        connection: { // This might be lost in Claude Desktop format
          timeout: 5000,
          retryAttempts: 3,
        },
      }, { validate: false });

      // Step 1: Export to Claude Desktop format (lossy conversion)
      await configurator.exportConfig('claude-desktop', path.join(testProjectPath, 'lossy.json'));
      const claudeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const claudeContent = claudeCall[1] as string;
      const claudeConfig = JSON.parse(claudeContent) as ClaudeDesktopConfig;

      // Step 2: Import back from Claude Desktop format
      const imported = await configurator.importConfig(claudeConfig, 'claude-desktop');

      // Step 3: Export as full format to see what was preserved
      const newConfigurator = new MCPConfigurator({
        projectPath: testProjectPath,
        config: { project: { name: 'test' }, mcp: { enabled: true } } as ApexConfig,
      });
      await newConfigurator.applyConfig(imported, { validate: false });

      vi.clearAllMocks();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await newConfigurator.exportConfig('json', path.join(testProjectPath, 'restored.json'));
      const restoredCall = vi.mocked(fs.writeFile).mock.calls[0];
      const restoredContent = restoredCall[1] as string;
      const restoredConfig = JSON.parse(restoredContent) as MCPConfig;

      // Verify expected data loss and preservation
      // HTTP server should be lost (not supported in Claude Desktop)
      expect(restoredConfig.servers).not.toHaveProperty('http-server');

      // Stdio server should be preserved but with core properties only
      expect(restoredConfig.servers).toHaveProperty('stdio-server');
      const restoredStdio = restoredConfig.servers!['stdio-server'];

      expect(restoredStdio.name).toBe('stdio-server');
      expect(restoredStdio.type).toBe('stdio');
      expect(restoredStdio.command).toBe('node');
      expect(restoredStdio.args).toEqual(['server.js']);

      // These properties might be lost through Claude Desktop format
      // The test verifies the behavior is consistent and predictable

      newConfigurator.removeAllListeners();
    });

    it('should preserve data integrity with mixed server types in applicable formats', async () => {
      // Mock file system operations
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Add mixed server types
      const mixedServers = {
        'stdio1': {
          name: 'stdio1',
          type: 'stdio' as const,
          command: 'npx',
          args: ['package1'],
          env: { VAR1: 'value1' },
        },
        'stdio2': {
          name: 'stdio2',
          type: 'stdio' as const,
          command: 'python',
          args: ['script.py'],
          env: { VAR2: 'value2' },
        },
        'http1': {
          name: 'http1',
          type: 'http' as const,
          url: 'https://example1.com',
          headers: { 'X-Key': 'key1' },
        },
        'sse1': {
          name: 'sse1',
          type: 'sse' as const,
          url: 'https://example2.com/sse',
          headers: { 'X-Key': 'key2' },
        },
      };

      Object.entries(mixedServers).forEach(([id, config]) => {
        configurator.addServer(id, config, { validate: false });
      });

      // Test round-trip with JSON format (should preserve all types)
      await configurator.exportConfig('json', path.join(testProjectPath, 'mixed-types.json'));
      const jsonCall = vi.mocked(fs.writeFile).mock.calls[0];
      const jsonContent = jsonCall[1] as string;
      const jsonConfig = JSON.parse(jsonContent) as MCPConfig;

      // Import and re-export
      const newConfigurator = new MCPConfigurator({
        projectPath: testProjectPath,
        config: { project: { name: 'test' }, mcp: { enabled: true } } as ApexConfig,
      });
      const imported = await newConfigurator.importConfig(jsonConfig, 'json');
      await newConfigurator.applyConfig(imported, { validate: false });

      vi.clearAllMocks();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await newConfigurator.exportConfig('json', path.join(testProjectPath, 'mixed-types-roundtrip.json'));
      const roundtripCall = vi.mocked(fs.writeFile).mock.calls[0];
      const roundtripContent = roundtripCall[1] as string;
      const roundtripConfig = JSON.parse(roundtripContent) as MCPConfig;

      // Verify all server types are preserved through JSON round-trip
      Object.entries(mixedServers).forEach(([id, originalConfig]) => {
        expect(roundtripConfig.servers).toHaveProperty(id);
        const roundtripServer = roundtripConfig.servers![id];

        expect(roundtripServer.name).toBe(originalConfig.name);
        expect(roundtripServer.type).toBe(originalConfig.type);

        if (originalConfig.type === 'stdio') {
          expect(roundtripServer.command).toBe(originalConfig.command);
          expect(roundtripServer.args).toEqual(originalConfig.args);
        } else {
          expect(roundtripServer.url).toBe(originalConfig.url);
          expect(roundtripServer.headers).toEqual(originalConfig.headers);
        }

        if (originalConfig.env) {
          expect(roundtripServer.env).toEqual(originalConfig.env);
        }
      });

      newConfigurator.removeAllListeners();
    });
  });
});