import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, saveConfig, getMCPServers, getMCPConfig, isMCPEnabled } from '../config.js';
import { ApexConfigSchema, MCPConfigSchema, MCPServerConfigSchema } from '../types.js';

/**
 * Comprehensive MCP configuration validation tests
 * Tests schema validation, error handling, and edge cases for MCP functionality
 */
describe('MCP Configuration Validation', () => {
  let tempDir: string;
  let apexDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-mcp-validation-'));
    apexDir = path.join(tempDir, '.apex');
    await fs.mkdir(apexDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Schema validation tests', () => {
    it('should validate MCPServerConfigSchema with all server types', () => {
      const stdioServer = {
        name: 'Stdio Server',
        type: 'stdio' as const,
        command: 'node',
        args: ['server.js'],
        autoStart: true,
      };

      const httpServer = {
        name: 'HTTP Server',
        type: 'http' as const,
        url: 'https://api.example.com/mcp',
        headers: { 'Accept': 'application/json' },
        autoStart: false,
      };

      const sseServer = {
        name: 'SSE Server',
        type: 'sse' as const,
        url: 'https://events.example.com/stream',
        headers: { 'Accept': 'text/event-stream' },
        autoStart: true,
      };

      const sdkServer = {
        name: 'SDK Server',
        type: 'sdk' as const,
        autoStart: false,
      };

      expect(() => MCPServerConfigSchema.parse(stdioServer)).not.toThrow();
      expect(() => MCPServerConfigSchema.parse(httpServer)).not.toThrow();
      expect(() => MCPServerConfigSchema.parse(sseServer)).not.toThrow();
      expect(() => MCPServerConfigSchema.parse(sdkServer)).not.toThrow();
    });

    it('should reject invalid server configurations', () => {
      const invalidConfigs = [
        // Missing name
        { type: 'stdio', command: 'node' },
        // Empty name
        { name: '', type: 'stdio', command: 'node' },
        // Invalid type
        { name: 'Test', type: 'invalid' },
        // HTTP server without URL
        { name: 'HTTP Test', type: 'http', autoStart: true },
        // SSE server without URL
        { name: 'SSE Test', type: 'sse', autoStart: true },
      ];

      for (const config of invalidConfigs) {
        expect(() => MCPServerConfigSchema.parse(config)).toThrow();
      }
    });

    it('should apply default values correctly', () => {
      const minimalConfig = {
        name: 'Minimal Server',
        command: 'node',
      };

      const parsed = MCPServerConfigSchema.parse(minimalConfig);
      expect(parsed.type).toBe('stdio'); // default
      expect(parsed.autoStart).toBe(false); // default
    });

    it('should validate complex connection configurations', () => {
      const serverWithConnection = {
        name: 'Connection Test',
        type: 'http' as const,
        url: 'https://api.test.com',
        connection: {
          maxRetries: 5,
          retryDelayMs: 2000,
          backoffFactor: 2.0,
          maxRetryDelayMs: 30000,
          connectionTimeoutMs: 10000,
          requestTimeoutMs: 60000,
          idleTimeoutMs: 300000,
          poolSize: 3,
          poolMinSize: 1,
          healthCheckIntervalMs: 30000,
          healthCheckTimeoutMs: 5000,
          healthCheckFailureThreshold: 3,
          autoReconnect: true,
          keepAlive: true,
          keepAliveIntervalMs: 15000,
          heartbeatEnabled: true,
          heartbeatIntervalMs: 30000,
        },
      };

      expect(() => MCPServerConfigSchema.parse(serverWithConnection)).not.toThrow();
      const parsed = MCPServerConfigSchema.parse(serverWithConnection);
      expect(parsed.connection?.maxRetries).toBe(5);
      expect(parsed.connection?.backoffFactor).toBe(2.0);
    });
  });

  describe('Configuration loading error handling', () => {
    it('should handle invalid server type in config file', async () => {
      const configYaml = `
project:
  name: test-project
  version: 1.0.0

mcp:
  enabled: true
  servers:
    invalid-server:
      name: invalid-type-server
      type: invalid-type
      command: node
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      await expect(loadConfig(tempDir)).rejects.toThrow();
    });

    it('should handle missing required name field', async () => {
      const configYaml = `
project:
  name: test-project
  version: 1.0.0

mcp:
  enabled: true
  servers:
    no-name-server:
      type: stdio
      command: node
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      await expect(loadConfig(tempDir)).rejects.toThrow();
    });

    it('should handle malformed YAML gracefully', async () => {
      const malformedYaml = `
project:
  name: test-project
  version: 1.0.0

mcp:
  enabled: true
  servers:
    broken-server:
      name: broken
      type: stdio
      command: node
      invalid_yaml: [unclosed
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), malformedYaml);

      await expect(loadConfig(tempDir)).rejects.toThrow();
    });
  });

  describe('Helper function validation', () => {
    it('should handle getMCPServers with various configurations', () => {
      const configs = [
        // No MCP config
        { version: '1.0', project: { name: 'test' } },
        // Empty servers
        { version: '1.0', project: { name: 'test' }, mcp: { enabled: true, servers: {} } },
        // With servers
        {
          version: '1.0',
          project: { name: 'test' },
          mcp: {
            enabled: true,
            servers: {
              test: { name: 'Test', type: 'stdio' as const, command: 'node' },
            },
          },
        },
      ];

      const results = configs.map(getMCPServers);
      expect(results[0]).toEqual({});
      expect(results[1]).toEqual({});
      expect(results[2]).toHaveProperty('test');
    });

    it('should handle getMCPConfig with default values', () => {
      const config = { version: '1.0', project: { name: 'test' } };
      const mcpConfig = getMCPConfig(config);

      expect(mcpConfig.enabled).toBe(true);
      expect(mcpConfig.servers).toEqual({});
      expect(mcpConfig.marketplace).toBeUndefined();
      expect(mcpConfig.connection).toBeUndefined();
      expect(mcpConfig.tools).toBeUndefined();
    });

    it('should handle isMCPEnabled with various configurations', () => {
      const configs = [
        { version: '1.0', project: { name: 'test' } }, // should default to true
        { version: '1.0', project: { name: 'test' }, mcp: { enabled: true } },
        { version: '1.0', project: { name: 'test' }, mcp: { enabled: false } },
        { version: '1.0', project: { name: 'test' }, mcp: {} }, // should default to true
      ];

      expect(isMCPEnabled(configs[0])).toBe(true);
      expect(isMCPEnabled(configs[1])).toBe(true);
      expect(isMCPEnabled(configs[2])).toBe(false);
      expect(isMCPEnabled(configs[3])).toBe(true);
    });
  });

  describe('Complex configuration scenarios', () => {
    it('should handle multiple servers with different types', async () => {
      const configYaml = `
project:
  name: multi-server-test
  version: 1.0.0

mcp:
  enabled: true
  servers:
    filesystem:
      name: Filesystem Server
      type: stdio
      command: npx
      args: ["filesystem-server", "/workspace"]
      env:
        NODE_ENV: development
      autoStart: true
      capabilities: ["filesystem", "read", "write"]

    api-server:
      name: API Server
      type: http
      url: https://api.example.com/mcp
      headers:
        Accept: application/json
        Content-Type: application/json
      autoStart: false
      capabilities: ["api", "rest"]

    events:
      name: Event Stream
      type: sse
      url: https://events.example.com/stream
      headers:
        Accept: text/event-stream
        Cache-Control: no-cache
      autoStart: true
      capabilities: ["events", "streaming"]

    sdk-server:
      name: SDK Server
      type: sdk
      autoStart: false
      capabilities: ["sdk", "direct"]
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);

      expect(config.mcp?.enabled).toBe(true);
      expect(Object.keys(config.mcp?.servers || {})).toHaveLength(4);

      const servers = config.mcp?.servers;
      expect(servers?.filesystem?.type).toBe('stdio');
      expect(servers?.['api-server']?.type).toBe('http');
      expect(servers?.events?.type).toBe('sse');
      expect(servers?.['sdk-server']?.type).toBe('sdk');
    });

    it('should preserve configuration through save/load cycle', async () => {
      const originalConfig = {
        version: '1.0',
        project: {
          name: 'persistence-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        mcp: {
          enabled: true,
          servers: {
            test: {
              name: 'Test Server',
              type: 'stdio' as const,
              command: 'node',
              args: ['test.js'],
              autoStart: true,
              capabilities: ['test'],
              connection: {
                maxRetries: 3,
                timeoutMs: 30000,
              },
            },
          },
          marketplace: {
            url: 'https://registry.example.com',
            enabled: true,
            refreshIntervalMinutes: 720,
            allowUnverified: false,
          },
          connection: {
            maxRetries: 5,
            timeoutMs: 45000,
            autoReconnect: true,
          },
        },
      };

      await saveConfig(tempDir, originalConfig);
      const loadedConfig = await loadConfig(tempDir);

      expect(loadedConfig.mcp?.enabled).toBe(true);
      expect(loadedConfig.mcp?.servers?.test?.name).toBe('Test Server');
      expect(loadedConfig.mcp?.marketplace?.url).toBe('https://registry.example.com');
      expect(loadedConfig.mcp?.connection?.maxRetries).toBe(5);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle empty configurations gracefully', async () => {
      const configYaml = `
project:
  name: empty-mcp-test
  version: 1.0.0

mcp:
  enabled: true
  servers: {}
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);
      expect(config.mcp?.enabled).toBe(true);
      expect(config.mcp?.servers).toEqual({});
    });

    it('should handle MCP disabled configuration', async () => {
      const configYaml = `
project:
  name: disabled-mcp-test
  version: 1.0.0

mcp:
  enabled: false
  servers: {}
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);
      expect(config.mcp?.enabled).toBe(false);
      expect(isMCPEnabled(config)).toBe(false);
    });

    it('should validate config without MCP section', async () => {
      const configYaml = `
project:
  name: no-mcp-test
  version: 1.0.0

agents:
  enabled: ["developer"]
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);
      expect(config.mcp).toBeUndefined();
      expect(isMCPEnabled(config)).toBe(true); // defaults to true
      expect(getMCPServers(config)).toEqual({});
    });
  });

  describe('Schema integration with ApexConfig', () => {
    it('should validate complete config including MCP section', async () => {
      const configYaml = `
project:
  name: integration-test
  version: 1.0.0

agents:
  enabled: ["developer", "planner"]

mcp:
  enabled: true
  servers:
    test-server:
      name: Test Server
      type: stdio
      command: node
      autoStart: true
  connection:
    maxRetries: 3
    timeoutMs: 30000
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);

      // Should validate against complete ApexConfig schema
      expect(() => ApexConfigSchema.parse(config)).not.toThrow();

      const validatedConfig = ApexConfigSchema.parse(config);
      expect(validatedConfig.project.name).toBe('integration-test');
      expect(validatedConfig.mcp?.enabled).toBe(true);
      expect(validatedConfig.mcp?.servers?.['test-server']).toBeDefined();
      expect(validatedConfig.agents?.enabled).toContain('developer');
    });
  });
});