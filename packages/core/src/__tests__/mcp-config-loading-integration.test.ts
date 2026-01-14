import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadConfig } from '../config.js';
import { ApexConfigSchema, MCPConfigSchema } from '../types.js';

/**
 * Integration test suite for MCP configuration loading
 * Tests that the config loading properly parses MCP settings from .apex/config.yaml
 *
 * Covers the acceptance criteria:
 * "Config loading updated to parse MCP settings from .apex/config.yaml"
 */
describe('MCP Configuration Loading Integration', () => {
  let tempDir: string;
  let apexDir: string;

  beforeEach(async () => {
    // Create temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-'));
    apexDir = path.join(tempDir, '.apex');
    await fs.mkdir(apexDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Basic MCP configuration loading', () => {
    it('should load minimal MCP configuration', async () => {
      const configYaml = `
project:
  name: test-project
  version: 1.0.0
  description: Test project

mcp:
  enabled: true
  servers: {}
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);

      expect(config.mcp).toBeDefined();
      expect(config.mcp?.enabled).toBe(true);
      expect(config.mcp?.servers).toEqual({});
      expect(config.mcp?.marketplace).toBeUndefined();
      expect(config.mcp?.connection).toBeUndefined();
    });

    it('should load complete MCP configuration', async () => {
      const configYaml = `
project:
  name: test-project
  version: 1.0.0
  description: Test project

mcp:
  enabled: true
  servers:
    filesystem:
      name: filesystem-server
      type: stdio
      command: npx
      args: ["@modelcontextprotocol/server-filesystem"]
      env:
        NODE_ENV: production
      autoStart: true
      capabilities: ["filesystem"]
      connection:
        maxRetries: 5
        timeoutMs: 45000
        poolSize: 2
        healthCheckIntervalMs: 60000
    weather:
      name: weather-server
      type: http
      url: https://api.weather.com/mcp
      headers:
        Authorization: Bearer secret-key
      autoStart: false
      capabilities: ["weather", "location"]
  marketplace:
    url: https://registry.modelcontextprotocol.io
    enabled: true
    refreshIntervalMinutes: 720
    allowUnverified: false
  connection:
    maxRetries: 3
    timeoutMs: 30000
    connectTimeoutMs: 5000
    readTimeoutMs: 120000
    writeTimeoutMs: 30000
    idleTimeoutMs: 300000
    poolSize: 1
    healthCheckIntervalMs: 30000
    healthCheckTimeoutMs: 5000
    heartbeatEnabled: true
    heartbeatIntervalMs: 30000
    keepAliveIntervalMs: 15000
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);

      // Validate MCP section
      expect(config.mcp).toBeDefined();
      expect(config.mcp?.enabled).toBe(true);

      // Validate servers
      expect(config.mcp?.servers).toBeDefined();
      expect(Object.keys(config.mcp?.servers || {})).toHaveLength(2);

      // Validate filesystem server
      const filesystemServer = config.mcp?.servers?.filesystem;
      expect(filesystemServer?.name).toBe('filesystem-server');
      expect(filesystemServer?.type).toBe('stdio');
      expect(filesystemServer?.command).toBe('npx');
      expect(filesystemServer?.args).toEqual(['@modelcontextprotocol/server-filesystem']);
      expect(filesystemServer?.env).toEqual({ NODE_ENV: 'production' });
      expect(filesystemServer?.autoStart).toBe(true);
      expect(filesystemServer?.capabilities).toEqual(['filesystem']);
      expect(filesystemServer?.connection?.maxRetries).toBe(5);
      expect(filesystemServer?.connection?.timeoutMs).toBe(45000);
      expect(filesystemServer?.connection?.poolSize).toBe(2);

      // Validate weather server
      const weatherServer = config.mcp?.servers?.weather;
      expect(weatherServer?.name).toBe('weather-server');
      expect(weatherServer?.type).toBe('http');
      expect(weatherServer?.url).toBe('https://api.weather.com/mcp');
      expect(weatherServer?.headers).toEqual({ Authorization: 'Bearer secret-key' });
      expect(weatherServer?.autoStart).toBe(false);
      expect(weatherServer?.capabilities).toEqual(['weather', 'location']);

      // Validate marketplace
      expect(config.mcp?.marketplace).toBeDefined();
      expect(config.mcp?.marketplace?.url).toBe('https://registry.modelcontextprotocol.io');
      expect(config.mcp?.marketplace?.enabled).toBe(true);
      expect(config.mcp?.marketplace?.refreshIntervalMinutes).toBe(720);
      expect(config.mcp?.marketplace?.allowUnverified).toBe(false);

      // Validate global connection config
      expect(config.mcp?.connection).toBeDefined();
      expect(config.mcp?.connection?.maxRetries).toBe(3);
      expect(config.mcp?.connection?.timeoutMs).toBe(30000);
      expect(config.mcp?.connection?.connectTimeoutMs).toBe(5000);
      expect(config.mcp?.connection?.poolSize).toBe(1);
      expect(config.mcp?.connection?.healthCheckIntervalMs).toBe(30000);
      expect(config.mcp?.connection?.heartbeatEnabled).toBe(true);
    });

    it('should handle disabled MCP configuration', async () => {
      const configYaml = `
project:
  name: test-project
  version: 1.0.0
  description: Test project

mcp:
  enabled: false
  servers: {}
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);

      expect(config.mcp).toBeDefined();
      expect(config.mcp?.enabled).toBe(false);
      expect(config.mcp?.servers).toEqual({});
    });
  });

  describe('MCP server configuration variations', () => {
    it('should load stdio server configurations', async () => {
      const configYaml = `
project:
  name: test-project
  version: 1.0.0
  description: Test project

mcp:
  enabled: true
  servers:
    stdio-server:
      name: stdio-test
      type: stdio
      command: node
      args: ["server.js", "--port", "3000"]
      env:
        NODE_ENV: development
        DEBUG: "true"
      autoStart: true
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);
      const server = config.mcp?.servers?.['stdio-server'];

      expect(server?.type).toBe('stdio');
      expect(server?.command).toBe('node');
      expect(server?.args).toEqual(['server.js', '--port', '3000']);
      expect(server?.env).toEqual({
        NODE_ENV: 'development',
        DEBUG: 'true',
      });
    });

    it('should load HTTP server configurations', async () => {
      const configYaml = `
project:
  name: test-project
  version: 1.0.0
  description: Test project

mcp:
  enabled: true
  servers:
    http-server:
      name: http-test
      type: http
      url: https://api.example.com/mcp
      headers:
        Authorization: Bearer token123
        X-API-Version: "2.0"
        Content-Type: application/json
      autoStart: false
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);
      const server = config.mcp?.servers?.['http-server'];

      expect(server?.type).toBe('http');
      expect(server?.url).toBe('https://api.example.com/mcp');
      expect(server?.headers).toEqual({
        Authorization: 'Bearer token123',
        'X-API-Version': '2.0',
        'Content-Type': 'application/json',
      });
      expect(server?.autoStart).toBe(false);
    });

    it('should load SSE server configurations', async () => {
      const configYaml = `
project:
  name: test-project
  version: 1.0.0
  description: Test project

mcp:
  enabled: true
  servers:
    sse-server:
      name: sse-test
      type: sse
      url: https://events.example.com/mcp
      headers:
        Accept: text/event-stream
        Cache-Control: no-cache
      autoStart: true
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);
      const server = config.mcp?.servers?.['sse-server'];

      expect(server?.type).toBe('sse');
      expect(server?.url).toBe('https://events.example.com/mcp');
      expect(server?.headers).toEqual({
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      });
      expect(server?.autoStart).toBe(true);
    });

    it('should load SDK server configurations', async () => {
      const configYaml = `
project:
  name: test-project
  version: 1.0.0
  description: Test project

mcp:
  enabled: true
  servers:
    sdk-server:
      name: sdk-test
      type: sdk
      autoStart: false
      capabilities: ["custom", "sdk-only"]
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);
      const server = config.mcp?.servers?.['sdk-server'];

      expect(server?.type).toBe('sdk');
      expect(server?.capabilities).toEqual(['custom', 'sdk-only']);
      expect(server?.autoStart).toBe(false);
    });
  });

  describe('MCP connection configuration hierarchy', () => {
    it('should load global connection configuration', async () => {
      const configYaml = `
project:
  name: test-project
  version: 1.0.0
  description: Test project

mcp:
  enabled: true
  servers: {}
  connection:
    maxRetries: 5
    timeoutMs: 60000
    poolSize: 3
    healthCheckIntervalMs: 45000
    heartbeatEnabled: false
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);
      const connection = config.mcp?.connection;

      expect(connection?.maxRetries).toBe(5);
      expect(connection?.timeoutMs).toBe(60000);
      expect(connection?.poolSize).toBe(3);
      expect(connection?.healthCheckIntervalMs).toBe(45000);
      expect(connection?.heartbeatEnabled).toBe(false);
    });

    it('should load per-server connection configuration overrides', async () => {
      const configYaml = `
project:
  name: test-project
  version: 1.0.0
  description: Test project

mcp:
  enabled: true
  connection:
    maxRetries: 3
    timeoutMs: 30000
    poolSize: 1
  servers:
    fast-server:
      name: fast-server
      type: stdio
      command: node
      autoStart: true
      connection:
        maxRetries: 1
        timeoutMs: 10000
        poolSize: 2
    slow-server:
      name: slow-server
      type: http
      url: https://slow.example.com
      autoStart: false
      connection:
        maxRetries: 10
        timeoutMs: 120000
        poolSize: 5
        healthCheckIntervalMs: 60000
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);

      // Global connection config
      expect(config.mcp?.connection?.maxRetries).toBe(3);
      expect(config.mcp?.connection?.timeoutMs).toBe(30000);
      expect(config.mcp?.connection?.poolSize).toBe(1);

      // Fast server overrides
      const fastServer = config.mcp?.servers?.['fast-server'];
      expect(fastServer?.connection?.maxRetries).toBe(1);
      expect(fastServer?.connection?.timeoutMs).toBe(10000);
      expect(fastServer?.connection?.poolSize).toBe(2);

      // Slow server overrides
      const slowServer = config.mcp?.servers?.['slow-server'];
      expect(slowServer?.connection?.maxRetries).toBe(10);
      expect(slowServer?.connection?.timeoutMs).toBe(120000);
      expect(slowServer?.connection?.poolSize).toBe(5);
      expect(slowServer?.connection?.healthCheckIntervalMs).toBe(60000);
    });
  });

  describe('MCP marketplace configuration', () => {
    it('should load marketplace with all options', async () => {
      const configYaml = `
project:
  name: test-project
  version: 1.0.0
  description: Test project

mcp:
  enabled: true
  servers: {}
  marketplace:
    url: https://custom-registry.example.com
    enabled: false
    refreshIntervalMinutes: 1440
    allowUnverified: true
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);
      const marketplace = config.mcp?.marketplace;

      expect(marketplace?.url).toBe('https://custom-registry.example.com');
      expect(marketplace?.enabled).toBe(false);
      expect(marketplace?.refreshIntervalMinutes).toBe(1440);
      expect(marketplace?.allowUnverified).toBe(true);
    });

    it('should load marketplace with minimal configuration', async () => {
      const configYaml = `
project:
  name: test-project
  version: 1.0.0
  description: Test project

mcp:
  enabled: true
  servers: {}
  marketplace:
    url: https://registry.modelcontextprotocol.io
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);
      const marketplace = config.mcp?.marketplace;

      expect(marketplace?.url).toBe('https://registry.modelcontextprotocol.io');
      expect(marketplace?.enabled).toBe(true); // Default
      expect(marketplace?.refreshIntervalMinutes).toBe(1440); // Default
      expect(marketplace?.allowUnverified).toBe(false); // Default
    });
  });

  describe('Configuration validation and error handling', () => {
    it('should handle missing MCP section gracefully', async () => {
      const configYaml = `
project:
  name: test-project
  version: 1.0.0
  description: Test project

# No MCP section
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);

      // MCP should be undefined when not specified
      expect(config.mcp).toBeUndefined();
    });

    it('should apply defaults to partial MCP configuration', async () => {
      const configYaml = `
project:
  name: test-project
  version: 1.0.0
  description: Test project

mcp:
  servers:
    partial-server:
      name: partial-server
      command: node
      # type defaults to 'stdio'
      # autoStart defaults to false
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);

      expect(config.mcp?.enabled).toBe(true); // Default
      expect(config.mcp?.servers).toBeDefined();

      const server = config.mcp?.servers?.['partial-server'];
      expect(server?.type).toBe('stdio'); // Default
      expect(server?.autoStart).toBe(false); // Default
      expect(server?.capabilities).toBeUndefined(); // Optional, no default
      expect(server?.connection).toBeUndefined(); // Optional, no default
    });

    it('should validate MCP configuration schema', async () => {
      const configYaml = `
project:
  name: test-project
  version: 1.0.0
  description: Test project

mcp:
  enabled: true
  servers:
    test-server:
      name: test-server
      type: stdio
      command: node
      args: ["server.js"]
      env:
        NODE_ENV: production
      autoStart: true
      capabilities: ["filesystem", "network"]
      connection:
        maxRetries: 3
        timeoutMs: 30000
        poolSize: 2
        healthCheckIntervalMs: 60000
        heartbeatEnabled: true
  marketplace:
    url: https://registry.example.com
    enabled: true
    refreshIntervalMinutes: 720
    allowUnverified: false
  connection:
    maxRetries: 5
    timeoutMs: 45000
    connectTimeoutMs: 8000
    readTimeoutMs: 180000
    writeTimeoutMs: 45000
    idleTimeoutMs: 600000
    poolSize: 1
    healthCheckIntervalMs: 30000
    healthCheckTimeoutMs: 8000
    heartbeatEnabled: true
    heartbeatIntervalMs: 45000
    keepAliveIntervalMs: 20000
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);

      // Should parse successfully without throwing
      expect(() => MCPConfigSchema.parse(config.mcp)).not.toThrow();

      // Validate parsed structure
      const mcpConfig = MCPConfigSchema.parse(config.mcp!);
      expect(mcpConfig.enabled).toBe(true);
      expect(Object.keys(mcpConfig.servers)).toHaveLength(1);
      expect(mcpConfig.marketplace).toBeDefined();
      expect(mcpConfig.connection).toBeDefined();
    });
  });

  describe('Real-world configuration examples', () => {
    it('should load configuration for development environment', async () => {
      const configYaml = `
project:
  name: development-project
  version: 0.1.0
  description: Development project with MCP servers

mcp:
  enabled: true
  servers:
    filesystem:
      name: filesystem-dev
      type: stdio
      command: npx
      args: ["@modelcontextprotocol/server-filesystem", "/workspace"]
      env:
        NODE_ENV: development
        DEBUG: mcp:*
      autoStart: true
      capabilities: ["filesystem"]
      connection:
        maxRetries: 1
        timeoutMs: 10000

    git:
      name: git-dev
      type: stdio
      command: npx
      args: ["@modelcontextprotocol/server-git"]
      env:
        GIT_AUTHOR_NAME: Developer
        GIT_AUTHOR_EMAIL: dev@example.com
      autoStart: true
      capabilities: ["git", "version-control"]

    web-search:
      name: web-search-dev
      type: http
      url: http://localhost:8080/mcp
      headers:
        X-Development: "true"
      autoStart: false
      capabilities: ["web-search"]

  marketplace:
    url: https://dev-registry.modelcontextprotocol.io
    enabled: true
    refreshIntervalMinutes: 60
    allowUnverified: true

  connection:
    maxRetries: 2
    timeoutMs: 15000
    poolSize: 1
    healthCheckIntervalMs: 15000
    heartbeatEnabled: true
    heartbeatIntervalMs: 10000
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);

      expect(config.mcp?.enabled).toBe(true);
      expect(Object.keys(config.mcp?.servers || {})).toHaveLength(3);

      // Verify filesystem server
      const fsServer = config.mcp?.servers?.filesystem;
      expect(fsServer?.env?.NODE_ENV).toBe('development');
      expect(fsServer?.env?.DEBUG).toBe('mcp:*');

      // Verify git server
      const gitServer = config.mcp?.servers?.git;
      expect(gitServer?.env?.GIT_AUTHOR_NAME).toBe('Developer');

      // Verify web search server
      const webServer = config.mcp?.servers?.['web-search'];
      expect(webServer?.type).toBe('http');
      expect(webServer?.headers?.['X-Development']).toBe('true');

      // Verify development-oriented marketplace
      expect(config.mcp?.marketplace?.allowUnverified).toBe(true);
      expect(config.mcp?.marketplace?.refreshIntervalMinutes).toBe(60);
    });

    it('should load configuration for production environment', async () => {
      const configYaml = `
project:
  name: production-project
  version: 2.1.0
  description: Production project with optimized MCP configuration

mcp:
  enabled: true
  servers:
    filesystem:
      name: filesystem-prod
      type: stdio
      command: /usr/local/bin/mcp-filesystem-server
      args: ["/data"]
      env:
        NODE_ENV: production
        LOG_LEVEL: warn
      autoStart: true
      capabilities: ["filesystem"]
      connection:
        maxRetries: 5
        timeoutMs: 60000
        poolSize: 3
        healthCheckIntervalMs: 120000

    database:
      name: database-prod
      type: http
      url: https://secure-db-api.example.com/mcp
      headers:
        Authorization: Bearer \${DB_API_TOKEN}
        X-Environment: production
      autoStart: true
      capabilities: ["database", "sql"]
      connection:
        maxRetries: 10
        timeoutMs: 180000
        poolSize: 5
        healthCheckIntervalMs: 60000

  marketplace:
    url: https://registry.modelcontextprotocol.io
    enabled: true
    refreshIntervalMinutes: 1440
    allowUnverified: false

  connection:
    maxRetries: 3
    timeoutMs: 30000
    connectTimeoutMs: 10000
    readTimeoutMs: 300000
    writeTimeoutMs: 60000
    idleTimeoutMs: 900000
    poolSize: 2
    healthCheckIntervalMs: 60000
    healthCheckTimeoutMs: 10000
    heartbeatEnabled: true
    heartbeatIntervalMs: 60000
    keepAliveIntervalMs: 30000
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const config = await loadConfig(tempDir);

      expect(config.mcp?.enabled).toBe(true);
      expect(Object.keys(config.mcp?.servers || {})).toHaveLength(2);

      // Verify production filesystem server
      const fsServer = config.mcp?.servers?.filesystem;
      expect(fsServer?.command).toBe('/usr/local/bin/mcp-filesystem-server');
      expect(fsServer?.env?.NODE_ENV).toBe('production');
      expect(fsServer?.env?.LOG_LEVEL).toBe('warn');
      expect(fsServer?.connection?.maxRetries).toBe(5);
      expect(fsServer?.connection?.poolSize).toBe(3);

      // Verify production database server
      const dbServer = config.mcp?.servers?.database;
      expect(dbServer?.type).toBe('http');
      expect(dbServer?.headers?.['X-Environment']).toBe('production');
      expect(dbServer?.connection?.maxRetries).toBe(10);
      expect(dbServer?.connection?.poolSize).toBe(5);

      // Verify production marketplace settings
      expect(config.mcp?.marketplace?.allowUnverified).toBe(false);
      expect(config.mcp?.marketplace?.refreshIntervalMinutes).toBe(1440);

      // Verify production connection timeouts
      expect(config.mcp?.connection?.connectTimeoutMs).toBe(10000);
      expect(config.mcp?.connection?.readTimeoutMs).toBe(300000);
      expect(config.mcp?.connection?.idleTimeoutMs).toBe(900000);
    });
  });

  describe('Integration with ApexConfig schema', () => {
    it('should validate complete config with MCP section', async () => {
      const configYaml = `
project:
  name: integration-test
  version: 1.0.0
  description: Integration test project

agents:
  developer:
    model: opus
    tools:
      - Read
      - Write
      - Bash

workflows:
  - type: feature
    agents:
      - planner
      - architect
      - developer

mcp:
  enabled: true
  servers:
    test-server:
      name: test-server
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
    });
  });
});