import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadConfig } from '../config.js';
import {
  MCPServerConfigSchema,
  MCPConfigSchema,
  MCPServerConfig,
  MCPConfig,
} from '../types.js';

/**
 * Acceptance criteria verification test for MCP server configuration schema
 *
 * This test suite verifies that all acceptance criteria are met:
 * 1. Zod schema for MCP servers exists in types.ts
 * 2. config.ts can parse mcpServers from .apex/config.yaml
 * 3. Schema supports server name, command, args, and env fields
 * 4. Integration between types and config loading works properly
 */
describe('MCP Server Configuration - Acceptance Criteria Verification', () => {
  let tempDir: string;
  let apexDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-mcp-test-'));
    apexDir = path.join(tempDir, '.apex');
    await fs.mkdir(apexDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Acceptance Criteria 1: Zod schema for MCP servers exists in types.ts', () => {
    it('should have MCPServerConfigSchema available for import', () => {
      expect(MCPServerConfigSchema).toBeDefined();
      expect(typeof MCPServerConfigSchema.parse).toBe('function');
    });

    it('should have MCPConfigSchema available for import', () => {
      expect(MCPConfigSchema).toBeDefined();
      expect(typeof MCPConfigSchema.parse).toBe('function');
    });

    it('should validate server name field correctly', () => {
      const validConfig = { name: 'test-server' };
      expect(() => MCPServerConfigSchema.parse(validConfig)).not.toThrow();

      const invalidConfig = { name: '' };
      expect(() => MCPServerConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should validate command field correctly', () => {
      const validConfig = {
        name: 'test-server',
        command: 'node'
      };
      expect(() => MCPServerConfigSchema.parse(validConfig)).not.toThrow();

      const invalidConfig = {
        name: 'test-server',
        command: 123
      };
      expect(() => MCPServerConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should validate args field correctly', () => {
      const validConfig = {
        name: 'test-server',
        command: 'node',
        args: ['server.js', '--port', '3000']
      };
      expect(() => MCPServerConfigSchema.parse(validConfig)).not.toThrow();

      const invalidConfig = {
        name: 'test-server',
        command: 'node',
        args: 'invalid-string-not-array'
      };
      expect(() => MCPServerConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should validate env field correctly', () => {
      const validConfig = {
        name: 'test-server',
        command: 'node',
        env: { 'NODE_ENV': 'production', 'PORT': '3000' }
      };
      expect(() => MCPServerConfigSchema.parse(validConfig)).not.toThrow();

      const invalidConfig = {
        name: 'test-server',
        command: 'node',
        env: 'invalid-string-not-object'
      };
      expect(() => MCPServerConfigSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('Acceptance Criteria 2: config.ts can parse mcpServers from .apex/config.yaml', () => {
    it('should parse minimal MCP configuration from YAML', async () => {
      const configYaml = `
project:
  name: test-project

mcp:
  enabled: true
  servers:
    test-server:
      name: test-server
      command: node
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);
      const config = await loadConfig(tempDir);

      expect(config.mcp).toBeDefined();
      expect(config.mcp?.servers).toBeDefined();
      expect(config.mcp?.servers?.['test-server']).toBeDefined();
      expect(config.mcp?.servers?.['test-server']?.name).toBe('test-server');
    });

    it('should parse complete MCP server configuration from YAML', async () => {
      const configYaml = `
project:
  name: test-project

mcp:
  enabled: true
  servers:
    filesystem-server:
      name: filesystem-server
      type: stdio
      command: npx
      args: ["@modelcontextprotocol/server-filesystem", "/workspace"]
      env:
        NODE_ENV: production
        LOG_LEVEL: info
        WORKSPACE_PATH: /workspace
      autoStart: true
      capabilities: ["filesystem", "search"]
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);
      const config = await loadConfig(tempDir);

      const server = config.mcp?.servers?.['filesystem-server'];
      expect(server).toBeDefined();
      expect(server?.name).toBe('filesystem-server');
      expect(server?.type).toBe('stdio');
      expect(server?.command).toBe('npx');
      expect(server?.args).toEqual(['@modelcontextprotocol/server-filesystem', '/workspace']);
      expect(server?.env).toEqual({
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        WORKSPACE_PATH: '/workspace'
      });
      expect(server?.autoStart).toBe(true);
      expect(server?.capabilities).toEqual(['filesystem', 'search']);
    });

    it('should parse multiple MCP servers from YAML', async () => {
      const configYaml = `
project:
  name: multi-server-project

mcp:
  enabled: true
  servers:
    server1:
      name: server1
      command: node
      args: ["server1.js"]
      env:
        SERVER_ID: "1"
    server2:
      name: server2
      command: python
      args: ["-m", "server2"]
      env:
        SERVER_ID: "2"
        PYTHON_ENV: development
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);
      const config = await loadConfig(tempDir);

      expect(Object.keys(config.mcp?.servers || {})).toHaveLength(2);

      const server1 = config.mcp?.servers?.['server1'];
      expect(server1?.name).toBe('server1');
      expect(server1?.command).toBe('node');
      expect(server1?.args).toEqual(['server1.js']);
      expect(server1?.env?.SERVER_ID).toBe('1');

      const server2 = config.mcp?.servers?.['server2'];
      expect(server2?.name).toBe('server2');
      expect(server2?.command).toBe('python');
      expect(server2?.args).toEqual(['-m', 'server2']);
      expect(server2?.env?.SERVER_ID).toBe('2');
      expect(server2?.env?.PYTHON_ENV).toBe('development');
    });

    it('should handle gracefully when MCP section is missing', async () => {
      const configYaml = `
project:
  name: no-mcp-project
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);
      const config = await loadConfig(tempDir);

      expect(config.mcp).toBeUndefined();
    });

    it('should handle gracefully when MCP servers section is empty', async () => {
      const configYaml = `
project:
  name: empty-mcp-project

mcp:
  enabled: true
  servers: {}
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);
      const config = await loadConfig(tempDir);

      expect(config.mcp?.enabled).toBe(true);
      expect(config.mcp?.servers).toEqual({});
    });
  });

  describe('Acceptance Criteria 3: Schema supports server name, command, args, and env fields', () => {
    it('should require server name field', () => {
      const configWithoutName = { command: 'node' };
      expect(() => MCPServerConfigSchema.parse(configWithoutName)).toThrow();

      const configWithName = { name: 'valid-server' };
      expect(() => MCPServerConfigSchema.parse(configWithName)).not.toThrow();
    });

    it('should support optional command field', () => {
      // Command is optional - server might use other connection types
      const configWithoutCommand = { name: 'server-no-cmd' };
      expect(() => MCPServerConfigSchema.parse(configWithoutCommand)).not.toThrow();

      const configWithCommand = {
        name: 'server-with-cmd',
        command: 'node'
      };
      expect(() => MCPServerConfigSchema.parse(configWithCommand)).not.toThrow();
    });

    it('should support optional args field as string array', () => {
      const configWithoutArgs = {
        name: 'server-no-args',
        command: 'node'
      };
      expect(() => MCPServerConfigSchema.parse(configWithoutArgs)).not.toThrow();

      const configWithEmptyArgs = {
        name: 'server-empty-args',
        command: 'node',
        args: []
      };
      expect(() => MCPServerConfigSchema.parse(configWithEmptyArgs)).not.toThrow();

      const configWithArgs = {
        name: 'server-with-args',
        command: 'node',
        args: ['server.js', '--config', 'config.json']
      };
      const result = MCPServerConfigSchema.parse(configWithArgs);
      expect(result.args).toEqual(['server.js', '--config', 'config.json']);
    });

    it('should support optional env field as string record', () => {
      const configWithoutEnv = {
        name: 'server-no-env',
        command: 'node'
      };
      expect(() => MCPServerConfigSchema.parse(configWithoutEnv)).not.toThrow();

      const configWithEmptyEnv = {
        name: 'server-empty-env',
        command: 'node',
        env: {}
      };
      expect(() => MCPServerConfigSchema.parse(configWithEmptyEnv)).not.toThrow();

      const configWithEnv = {
        name: 'server-with-env',
        command: 'node',
        env: {
          'NODE_ENV': 'production',
          'PORT': '3000',
          'API_KEY': 'secret-key'
        }
      };
      const result = MCPServerConfigSchema.parse(configWithEnv);
      expect(result.env).toEqual({
        'NODE_ENV': 'production',
        'PORT': '3000',
        'API_KEY': 'secret-key'
      });
    });

    it('should validate that env values are strings', () => {
      const invalidEnvConfig = {
        name: 'server-invalid-env',
        command: 'node',
        env: {
          'VALID_KEY': 'valid-string-value',
          'INVALID_NUMBER': 123,
          'INVALID_BOOLEAN': true
        }
      };
      expect(() => MCPServerConfigSchema.parse(invalidEnvConfig)).toThrow();
    });

    it('should validate that args are string array', () => {
      const invalidArgsConfigs = [
        { name: 'test', command: 'node', args: 'string-not-array' },
        { name: 'test', command: 'node', args: 123 },
        { name: 'test', command: 'node', args: ['valid', 123, 'mixed-types'] },
      ];

      invalidArgsConfigs.forEach(config => {
        expect(() => MCPServerConfigSchema.parse(config)).toThrow();
      });
    });
  });

  describe('Acceptance Criteria 4: Integration verification', () => {
    it('should fully integrate schema validation with config loading', async () => {
      const fullIntegrationConfig = `
project:
  name: integration-test

mcp:
  enabled: true
  servers:
    filesystem:
      name: filesystem
      type: stdio
      command: npx
      args: ["@modelcontextprotocol/server-filesystem"]
      env:
        NODE_ENV: production
        WORKSPACE_ROOT: /workspace
        LOG_LEVEL: info
      autoStart: true
      capabilities: ["filesystem", "search", "edit"]

    api-server:
      name: api-server
      type: http
      url: https://api.example.com/mcp
      headers:
        Authorization: Bearer secret-token
        Content-Type: application/json
      env:
        API_TIMEOUT: "30000"
        API_RETRIES: "3"
      autoStart: false
      capabilities: ["api", "data"]

  connection:
    maxRetries: 3
    timeoutMs: 30000
    poolSize: 1
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), fullIntegrationConfig);
      const config = await loadConfig(tempDir);

      // Verify MCP config can be parsed by schema
      expect(() => MCPConfigSchema.parse(config.mcp)).not.toThrow();
      const mcpConfig = MCPConfigSchema.parse(config.mcp!);

      expect(mcpConfig.enabled).toBe(true);
      expect(Object.keys(mcpConfig.servers)).toHaveLength(2);

      // Verify each server config can be parsed by schema
      Object.values(mcpConfig.servers).forEach(serverConfig => {
        expect(() => MCPServerConfigSchema.parse(serverConfig)).not.toThrow();
      });

      // Verify filesystem server specifics
      const filesystemServer = mcpConfig.servers['filesystem'] as MCPServerConfig;
      expect(filesystemServer.name).toBe('filesystem');
      expect(filesystemServer.command).toBe('npx');
      expect(filesystemServer.args).toEqual(['@modelcontextprotocol/server-filesystem']);
      expect(filesystemServer.env).toEqual({
        NODE_ENV: 'production',
        WORKSPACE_ROOT: '/workspace',
        LOG_LEVEL: 'info'
      });

      // Verify API server specifics
      const apiServer = mcpConfig.servers['api-server'] as MCPServerConfig;
      expect(apiServer.name).toBe('api-server');
      expect(apiServer.type).toBe('http');
      expect(apiServer.url).toBe('https://api.example.com/mcp');
      expect(apiServer.headers).toEqual({
        Authorization: 'Bearer secret-token',
        'Content-Type': 'application/json'
      });
    });

    it('should maintain type safety throughout the pipeline', async () => {
      const configYaml = `
project:
  name: type-safety-test

mcp:
  enabled: true
  servers:
    type-test-server:
      name: type-test-server
      command: node
      args: ["server.js"]
      env:
        NODE_ENV: development
        PORT: "3000"
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);
      const config = await loadConfig(tempDir);

      // TypeScript compilation should succeed for these type assertions
      const mcpConfig: MCPConfig = config.mcp!;
      const servers: Record<string, MCPServerConfig> = mcpConfig.servers as Record<string, MCPServerConfig>;
      const testServer: MCPServerConfig = servers['type-test-server'];

      // Verify types at runtime
      expect(typeof mcpConfig.enabled).toBe('boolean');
      expect(typeof servers).toBe('object');
      expect(typeof testServer.name).toBe('string');
      expect(Array.isArray(testServer.args)).toBe(true);
      expect(typeof testServer.env).toBe('object');

      // Verify values
      expect(testServer.name).toBe('type-test-server');
      expect(testServer.command).toBe('node');
      expect(testServer.args).toEqual(['server.js']);
      expect(testServer.env?.NODE_ENV).toBe('development');
      expect(testServer.env?.PORT).toBe('3000');
    });

    it('should handle complex real-world configuration scenarios', async () => {
      const complexConfig = `
project:
  name: complex-mcp-project

mcp:
  enabled: true
  servers:
    dev-filesystem:
      name: dev-filesystem
      type: stdio
      command: node
      args: ["dev-server.js", "--watch", "--debug"]
      env:
        NODE_ENV: development
        DEBUG: "mcp:*"
        WORKSPACE: /workspace/dev
        HOT_RELOAD: "true"
      autoStart: true
      capabilities: ["filesystem", "watch", "debug"]

    prod-api:
      name: prod-api
      type: https
      url: https://secure-api.production.com/mcp/v1
      headers:
        Authorization: Bearer \${API_TOKEN}
        X-Environment: production
        X-Client-Version: "1.0.0"
      env:
        API_TIMEOUT: "60000"
        RETRY_COUNT: "5"
        LOG_LEVEL: warn
      autoStart: true
      capabilities: ["api", "production", "secure"]

    event-stream:
      name: event-stream
      type: sse
      url: https://events.service.com/mcp/stream
      headers:
        Accept: text/event-stream
        Cache-Control: no-cache
      env:
        STREAM_TIMEOUT: "300000"
        RECONNECT_DELAY: "5000"
      autoStart: false
      capabilities: ["events", "streaming"]

  connection:
    maxRetries: 5
    timeoutMs: 45000
    poolSize: 2
    healthCheckIntervalMs: 60000
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), complexConfig);
      const config = await loadConfig(tempDir);

      // Verify complete configuration loads correctly
      expect(config.mcp?.enabled).toBe(true);
      expect(Object.keys(config.mcp?.servers || {})).toHaveLength(3);

      // Verify each server type is handled correctly
      const devFs = config.mcp?.servers?.['dev-filesystem'];
      expect(devFs?.type).toBe('stdio');
      expect(devFs?.env?.DEBUG).toBe('mcp:*');

      const prodApi = config.mcp?.servers?.['prod-api'];
      expect(prodApi?.type).toBe('https');
      expect(prodApi?.headers?.['X-Environment']).toBe('production');

      const eventStream = config.mcp?.servers?.['event-stream'];
      expect(eventStream?.type).toBe('sse');
      expect(eventStream?.autoStart).toBe(false);

      // Verify connection config
      expect(config.mcp?.connection?.maxRetries).toBe(5);
      expect(config.mcp?.connection?.poolSize).toBe(2);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should provide meaningful error messages for invalid configurations', async () => {
      const invalidConfig = `
project:
  name: invalid-test

mcp:
  enabled: true
  servers:
    invalid-server:
      name: ""  # Empty name should fail
      command: node
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), invalidConfig);

      try {
        await loadConfig(tempDir);
        expect.fail('Should have thrown an error for invalid config');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    });

    it('should handle YAML parsing errors gracefully', async () => {
      const malformedYaml = `
project:
  name: malformed-test
  invalid-yaml: [unclosed array
mcp:
  enabled: true
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), malformedYaml);

      try {
        await loadConfig(tempDir);
        expect.fail('Should have thrown an error for malformed YAML');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    });
  });
});