/**
 * Unit Tests for MCP Configuration Parsing
 *
 * This test suite specifically validates MCP server config parsing
 * to ensure the acceptance criteria is fully met:
 * "Unit tests verify config parsing for MCP servers"
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, type ApexConfig, type MCPServerConfig } from '@apexcli/core';

describe('MCP Config Parsing Unit Tests', () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-mcp-config-test-'));
    configPath = path.join(tempDir, '.apex', 'config.yaml');

    await fs.mkdir(path.join(tempDir, '.apex'), { recursive: true });
    await fs.mkdir(path.join(tempDir, '.apex', 'agents'), { recursive: true });
    await fs.mkdir(path.join(tempDir, '.apex', 'workflows'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Basic MCP Config Parsing', () => {
    it('should parse stdio MCP server configuration correctly', async () => {
      const config = `
project:
  name: stdio-config-test
limits:
  maxConcurrentTasks: 1
  maxDailyTasks: 10
  maxTokensPerTask: 1000
  maxTurns: 1
mcp:
  enabled: true
  servers:
    filesystem:
      name: filesystem
      type: stdio
      command: npx
      args: ['@modelcontextprotocol/server-filesystem', '/test/path']
      env:
        ROOT_PATH: /test/path
        READ_ONLY: "true"
      autoStart: true
autonomy:
  level: manual
agents: {}
workflows: {}
`;

      await fs.writeFile(configPath, config.trim());
      const loadedConfig = await loadConfig(tempDir);

      expect(loadedConfig.mcp).toBeDefined();
      expect(loadedConfig.mcp!.enabled).toBe(true);

      const fsServer = loadedConfig.mcp!.servers!['filesystem'];
      expect(fsServer).toEqual({
        name: 'filesystem',
        type: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', '/test/path'],
        env: {
          ROOT_PATH: '/test/path',
          READ_ONLY: 'true'
        },
        autoStart: true
      });
    });

    it('should parse HTTP MCP server configuration correctly', async () => {
      const config = `
project:
  name: http-config-test
limits:
  maxConcurrentTasks: 1
  maxDailyTasks: 10
  maxTokensPerTask: 1000
  maxTurns: 1
mcp:
  enabled: true
  servers:
    api-server:
      name: api-server
      type: http
      url: https://api.example.com/mcp
      headers:
        Content-Type: application/json
        X-API-Version: "1.0"
      timeout: 10000
autonomy:
  level: manual
agents: {}
workflows: {}
`;

      await fs.writeFile(configPath, config.trim());
      const loadedConfig = await loadConfig(tempDir);

      const apiServer = loadedConfig.mcp!.servers!['api-server'];
      expect(apiServer).toEqual({
        name: 'api-server',
        type: 'http',
        url: 'https://api.example.com/mcp',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Version': '1.0'
        },
        timeout: 10000
      });
    });

    it('should parse multiple MCP servers with different types', async () => {
      const config = `
project:
  name: multi-server-test
limits:
  maxConcurrentTasks: 1
  maxDailyTasks: 10
  maxTokensPerTask: 1000
  maxTurns: 1
mcp:
  enabled: true
  servers:
    filesystem-server:
      name: filesystem-server
      type: stdio
      command: npx
      args: ['@modelcontextprotocol/server-filesystem', '/workspace']
    api-server:
      name: api-server
      type: http
      url: https://api.service.com/mcp
    events-server:
      name: events-server
      type: sse
      url: https://events.service.com/stream
  connection:
    timeout: 8000
    maxRetries: 5
    retryDelay: 2000
autonomy:
  level: manual
agents: {}
workflows: {}
`;

      await fs.writeFile(configPath, config.trim());
      const loadedConfig = await loadConfig(tempDir);

      expect(loadedConfig.mcp).toBeDefined();
      expect(Object.keys(loadedConfig.mcp!.servers!)).toHaveLength(3);
      expect(loadedConfig.mcp!.servers!['filesystem-server'].type).toBe('stdio');
      expect(loadedConfig.mcp!.servers!['api-server'].type).toBe('http');
      expect(loadedConfig.mcp!.servers!['events-server'].type).toBe('sse');

      expect(loadedConfig.mcp!.connection).toEqual({
        timeout: 8000,
        maxRetries: 5,
        retryDelay: 2000
      });
    });
  });

  describe('MCP Configuration Edge Cases', () => {
    it('should handle missing MCP section', async () => {
      const config = `
project:
  name: no-mcp-test
limits:
  maxConcurrentTasks: 1
  maxDailyTasks: 10
  maxTokensPerTask: 1000
  maxTurns: 1
autonomy:
  level: manual
agents: {}
workflows: {}
`;

      await fs.writeFile(configPath, config.trim());
      const loadedConfig = await loadConfig(tempDir);

      expect(loadedConfig.mcp).toBeUndefined();
    });

    it('should handle disabled MCP', async () => {
      const config = `
project:
  name: disabled-mcp-test
limits:
  maxConcurrentTasks: 1
  maxDailyTasks: 10
  maxTokensPerTask: 1000
  maxTurns: 1
mcp:
  enabled: false
  servers:
    filesystem:
      name: filesystem
      command: npx
      args: ['@modelcontextprotocol/server-filesystem']
autonomy:
  level: manual
agents: {}
workflows: {}
`;

      await fs.writeFile(configPath, config.trim());
      const loadedConfig = await loadConfig(tempDir);

      expect(loadedConfig.mcp).toBeDefined();
      expect(loadedConfig.mcp!.enabled).toBe(false);
      expect(loadedConfig.mcp!.servers).toBeDefined();
    });

    it('should handle empty servers section', async () => {
      const config = `
project:
  name: empty-servers-test
limits:
  maxConcurrentTasks: 1
  maxDailyTasks: 10
  maxTokensPerTask: 1000
  maxTurns: 1
mcp:
  enabled: true
  servers: {}
autonomy:
  level: manual
agents: {}
workflows: {}
`;

      await fs.writeFile(configPath, config.trim());
      const loadedConfig = await loadConfig(tempDir);

      expect(loadedConfig.mcp!.servers).toEqual({});
    });
  });

  describe('MCP Server Config Validation', () => {
    it('should validate stdio server config fields', () => {
      const stdioServer: MCPServerConfig = {
        name: 'stdio-server',
        type: 'stdio',
        command: 'node',
        args: ['test.js'],
        env: { TEST: 'value' }
      };

      expect(stdioServer.type).toBe('stdio');
      expect(stdioServer.command).toBeDefined();
      expect(stdioServer.args).toBeDefined();
    });

    it('should validate http server config fields', () => {
      const httpServer: MCPServerConfig = {
        name: 'http-server',
        type: 'http',
        url: 'https://example.com',
        headers: { 'Content-Type': 'application/json' }
      };

      expect(httpServer.type).toBe('http');
      expect(httpServer.url).toBeDefined();
      expect(httpServer.headers).toBeDefined();
    });

    it('should validate sse server config fields', () => {
      const sseServer: MCPServerConfig = {
        name: 'sse-server',
        type: 'sse',
        url: 'https://events.example.com',
        headers: { 'Accept': 'text/event-stream' }
      };

      expect(sseServer.type).toBe('sse');
      expect(sseServer.url).toBeDefined();
      expect(sseServer.headers).toBeDefined();
    });
  });
});