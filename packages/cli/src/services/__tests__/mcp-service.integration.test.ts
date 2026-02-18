import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { McpService } from '../mcp-service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Integration tests for McpService that test actual file system interactions
 * These tests create real temporary directories and config files to ensure
 * the service works correctly with actual file operations
 */
describe('McpService Integration Tests', () => {
  let tempDir: string;
  let mcpService: McpService;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-service-test-'));
    mcpService = new McpService(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory after each test
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Real file system integration', () => {
    it('should throw error when APEX is not initialized', async () => {
      await expect(mcpService.getInstalledServers()).rejects.toThrow(
        `Cannot read MCP servers: APEX not initialized in ${tempDir}. Run 'apex init' first.`
      );
    });

    it('should read MCP servers from actual config file', async () => {
      // Create .apex directory and config file
      const apexDir = path.join(tempDir, '.apex');
      await fs.mkdir(apexDir);

      const configContent = `
version: '1.0'
project:
  name: 'test-project'
mcp:
  enabled: true
  servers:
    filesystem:
      name: 'Filesystem Server'
      type: 'stdio'
      command: '@modelcontextprotocol/server-filesystem'
      args:
        - '/allowed/path'
      env:
        NODE_ENV: 'production'
    database:
      name: 'Database Server'
      type: 'stdio'
      command: 'mcp-server-postgres'
      args:
        - '--host'
        - 'localhost'
      env:
        DATABASE_URL: 'postgresql://localhost/test'
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configContent);

      const servers = await mcpService.getInstalledServers();

      expect(Object.keys(servers)).toHaveLength(2);
      expect(servers).toHaveProperty('filesystem');
      expect(servers).toHaveProperty('database');

      // Test filesystem server config
      expect(servers.filesystem.name).toBe('Filesystem Server');
      expect(servers.filesystem.type).toBe('stdio');
      expect(servers.filesystem.command).toBe('@modelcontextprotocol/server-filesystem');
      expect(servers.filesystem.args).toEqual(['/allowed/path']);
      expect(servers.filesystem.env).toEqual({ NODE_ENV: 'production' });

      // Test database server config
      expect(servers.database.name).toBe('Database Server');
      expect(servers.database.type).toBe('stdio');
      expect(servers.database.command).toBe('mcp-server-postgres');
      expect(servers.database.args).toEqual(['--host', 'localhost']);
      expect(servers.database.env).toEqual({ DATABASE_URL: 'postgresql://localhost/test' });
    });

    it('should handle config with no MCP section', async () => {
      const apexDir = path.join(tempDir, '.apex');
      await fs.mkdir(apexDir);

      const configContent = `
version: '1.0'
project:
  name: 'test-project'
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configContent);

      const servers = await mcpService.getInstalledServers();
      expect(servers).toEqual({});
    });

    it('should handle config with MCP disabled', async () => {
      const apexDir = path.join(tempDir, '.apex');
      await fs.mkdir(apexDir);

      const configContent = `
version: '1.0'
project:
  name: 'test-project'
mcp:
  enabled: false
  servers:
    filesystem:
      name: 'Filesystem Server'
      type: 'stdio'
      command: '@modelcontextprotocol/server-filesystem'
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configContent);

      // Even though MCP is disabled, getInstalledServers should still return configured servers
      // The enabled flag affects runtime behavior, not configuration reading
      const servers = await mcpService.getInstalledServers();
      expect(servers).toHaveProperty('filesystem');

      // But isMcpEnabled should return false
      const isEnabled = await mcpService.isMcpEnabled();
      expect(isEnabled).toBe(false);
    });

    it('should handle array format server configuration', async () => {
      const apexDir = path.join(tempDir, '.apex');
      await fs.mkdir(apexDir);

      const configContent = `
version: '1.0'
project:
  name: 'test-project'
mcp:
  enabled: true
  servers:
    - name: 'filesystem'
      type: 'stdio'
      command: '@modelcontextprotocol/server-filesystem'
      args: ['/allowed/path']
    - name: 'database'
      type: 'stdio'
      command: 'mcp-server-postgres'
      args: ['--host', 'localhost']
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configContent);

      const servers = await mcpService.getInstalledServers();

      expect(Object.keys(servers)).toHaveLength(2);
      expect(servers).toHaveProperty('filesystem');
      expect(servers).toHaveProperty('database');

      // Verify the servers are correctly indexed by name
      expect(servers.filesystem.name).toBe('filesystem');
      expect(servers.database.name).toBe('database');
    });

    it('should handle empty servers configuration', async () => {
      const apexDir = path.join(tempDir, '.apex');
      await fs.mkdir(apexDir);

      const configContent = `
version: '1.0'
project:
  name: 'test-project'
mcp:
  enabled: true
  servers: {}
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configContent);

      const servers = await mcpService.getInstalledServers();
      expect(servers).toEqual({});
    });

    it('should handle malformed YAML configuration', async () => {
      const apexDir = path.join(tempDir, '.apex');
      await fs.mkdir(apexDir);

      const malformedYaml = `
version: '1.0'
project:
  name: 'test-project'
mcp:
  enabled: true
  servers:
    filesystem:
      name: 'Filesystem Server'
      type: 'stdio'
    command: '@modelcontextprotocol/server-filesystem' # missing proper indentation
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), malformedYaml);

      await expect(mcpService.getInstalledServers()).rejects.toThrow(
        /Failed to read MCP server configuration:/
      );
    });

    it('should handle file system permission errors', async () => {
      const apexDir = path.join(tempDir, '.apex');
      await fs.mkdir(apexDir);

      // Create a config file that we then make unreadable (if possible on this system)
      const configPath = path.join(apexDir, 'config.yaml');
      await fs.writeFile(configPath, 'version: "1.0"\nproject:\n  name: test');

      // Note: chmod may not work on all systems (like Windows), but test should still pass
      try {
        await fs.chmod(configPath, 0o000); // Remove all permissions

        await expect(mcpService.getInstalledServers()).rejects.toThrow(
          /Failed to read MCP server configuration:/
        );

        // Restore permissions for cleanup
        await fs.chmod(configPath, 0o644);
      } catch (chmodError) {
        // If chmod fails (e.g., on Windows), skip this specific assertion
        // but still verify the service doesn't crash
        const servers = await mcpService.getInstalledServers();
        expect(servers).toEqual({});
      }
    });
  });

  describe('Service method integration', () => {
    beforeEach(async () => {
      // Set up a standard test configuration for method testing
      const apexDir = path.join(tempDir, '.apex');
      await fs.mkdir(apexDir);

      const configContent = `
version: '1.0'
project:
  name: 'test-project'
mcp:
  enabled: true
  servers:
    filesystem:
      name: 'Filesystem Server'
      type: 'stdio'
      command: '@modelcontextprotocol/server-filesystem'
    database:
      name: 'Database Server'
      type: 'stdio'
      command: 'mcp-server-postgres'
    disabled-server:
      name: 'Disabled Server'
      type: 'stdio'
      command: 'disabled-server'
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configContent);
    });

    it('should correctly identify installed servers', async () => {
      expect(await mcpService.isServerInstalled('filesystem')).toBe(true);
      expect(await mcpService.isServerInstalled('database')).toBe(true);
      expect(await mcpService.isServerInstalled('nonexistent')).toBe(false);
    });

    it('should return correct server configuration', async () => {
      const filesystemConfig = await mcpService.getServerConfig('filesystem');
      expect(filesystemConfig).not.toBeNull();
      expect(filesystemConfig?.name).toBe('Filesystem Server');

      const nonexistentConfig = await mcpService.getServerConfig('nonexistent');
      expect(nonexistentConfig).toBeNull();
    });

    it('should return list of installed server names', async () => {
      const serverNames = await mcpService.getInstalledServerNames();
      expect(serverNames).toHaveLength(3);
      expect(serverNames).toContain('filesystem');
      expect(serverNames).toContain('database');
      expect(serverNames).toContain('disabled-server');
    });

    it('should report MCP as enabled', async () => {
      const isEnabled = await mcpService.isMcpEnabled();
      expect(isEnabled).toBe(true);
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle directory without .apex subdirectory', async () => {
      await expect(mcpService.getInstalledServers()).rejects.toThrow(
        'Cannot read MCP servers: APEX not initialized'
      );
    });

    it('should handle .apex directory without config.yaml', async () => {
      const apexDir = path.join(tempDir, '.apex');
      await fs.mkdir(apexDir);

      await expect(mcpService.getInstalledServers()).rejects.toThrow(
        /Failed to read MCP server configuration:/
      );
    });

    it('should handle empty config file', async () => {
      const apexDir = path.join(tempDir, '.apex');
      await fs.mkdir(apexDir);
      await fs.writeFile(path.join(apexDir, 'config.yaml'), '');

      await expect(mcpService.getInstalledServers()).rejects.toThrow(
        /Failed to read MCP server configuration:/
      );
    });

    it('should handle config file with only whitespace', async () => {
      const apexDir = path.join(tempDir, '.apex');
      await fs.mkdir(apexDir);
      await fs.writeFile(path.join(apexDir, 'config.yaml'), '   \n\t\n   ');

      await expect(mcpService.getInstalledServers()).rejects.toThrow(
        /Failed to read MCP server configuration:/
      );
    });
  });
});