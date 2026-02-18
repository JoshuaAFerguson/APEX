import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, saveConfig, getMCPServers, getMCPConfig, isMCPEnabled } from '../config.js';
import { MCPConfigSchema } from '../types.js';

/**
 * Performance and stress tests for MCP configuration functionality
 * Tests large configurations, many servers, and complex scenarios
 */
describe('MCP Configuration Performance Tests', () => {
  let tempDir: string;
  let apexDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-mcp-perf-'));
    apexDir = path.join(tempDir, '.apex');
    await fs.mkdir(apexDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Large configuration handling', () => {
    it('should handle configuration with many servers efficiently', async () => {
      const serverCount = 50;
      const servers: Record<string, any> = {};

      // Generate many server configurations
      for (let i = 0; i < serverCount; i++) {
        const serverType = ['stdio', 'http', 'sse', 'sdk'][i % 4];
        const baseConfig = {
          name: `Server ${i}`,
          type: serverType,
          autoStart: i % 2 === 0,
          capabilities: [`capability-${i}`, `feature-${i}`],
        };

        if (serverType === 'stdio') {
          servers[`server-${i}`] = {
            ...baseConfig,
            command: 'node',
            args: [`server-${i}.js`],
            env: {
              [`SERVER_ID`]: `${i}`,
              [`PORT`]: `${3000 + i}`,
            },
          };
        } else if (serverType === 'http' || serverType === 'sse') {
          servers[`server-${i}`] = {
            ...baseConfig,
            url: `https://api-${i}.example.com/mcp`,
            headers: {
              [`X-Server-ID`]: `${i}`,
              'Accept': serverType === 'sse' ? 'text/event-stream' : 'application/json',
            },
          };
        } else {
          servers[`server-${i}`] = baseConfig;
        }
      }

      const configYaml = `
project:
  name: large-config-test
  version: 1.0.0

mcp:
  enabled: true
  servers: ${JSON.stringify(servers, null, 2).replace(/"/g, '')}
`;

      const startTime = Date.now();
      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);
      const config = await loadConfig(tempDir);
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(1000); // Should load in under 1 second
      expect(Object.keys(config.mcp?.servers || {})).toHaveLength(serverCount);
      expect(config.mcp?.enabled).toBe(true);

      // Test helper functions performance
      const helperStartTime = Date.now();
      const servers_result = getMCPServers(config);
      const mcpConfig = getMCPConfig(config);
      const isEnabled = isMCPEnabled(config);
      const helperTime = Date.now() - helperStartTime;

      expect(helperTime).toBeLessThan(100); // Should be fast
      expect(Object.keys(servers_result)).toHaveLength(serverCount);
      expect(mcpConfig.enabled).toBe(true);
      expect(isEnabled).toBe(true);
    });

    it('should handle deeply nested configuration structures', async () => {
      const configYaml = `
project:
  name: deep-config-test
  version: 1.0.0

mcp:
  enabled: true
  servers:
    complex-server:
      name: Complex Configuration Server
      type: http
      url: https://complex.example.com/api/v1/mcp/endpoint
      headers:
        Authorization: Bearer complex-header-value
        Accept: application/json
        Content-Type: application/json
        X-API-Version: v1
        X-Client-ID: apex-client
        X-Request-ID: req-12345
        User-Agent: APEX-MCP-Client/1.0
        Cache-Control: no-cache
        Connection: keep-alive
      autoStart: true
      capabilities:
        - complex-capability-1
        - complex-capability-2
        - complex-capability-3
        - complex-capability-4
        - complex-capability-5
      connection:
        maxRetries: 10
        retryDelayMs: 5000
        backoffFactor: 2.0
        maxRetryDelayMs: 120000
        connectionTimeoutMs: 30000
        requestTimeoutMs: 180000
        idleTimeoutMs: 900000
        poolSize: 8
        poolMinSize: 2
        healthCheckIntervalMs: 60000
        healthCheckTimeoutMs: 15000
        healthCheckFailureThreshold: 5
        autoReconnect: true
        keepAlive: true
        keepAliveIntervalMs: 30000
        heartbeatEnabled: true
        heartbeatIntervalMs: 45000

  marketplace:
    url: https://registry.modelcontextprotocol.io/v1
    enabled: true
    refreshIntervalMinutes: 1440
    allowUnverified: false

  connection:
    maxRetries: 5
    retryDelayMs: 2000
    backoffFactor: 1.5
    maxRetryDelayMs: 60000
    connectionTimeoutMs: 15000
    requestTimeoutMs: 120000
    idleTimeoutMs: 600000
    poolSize: 4
    poolMinSize: 1
    healthCheckIntervalMs: 30000
    healthCheckTimeoutMs: 10000
    healthCheckFailureThreshold: 3
    autoReconnect: true
    keepAlive: true
    keepAliveIntervalMs: 20000
    heartbeatEnabled: true
    heartbeatIntervalMs: 30000

  tools:
    registry:
      enabled: true
      autoUpdate: false
      sources:
        - url: https://tools.example.com/registry
          enabled: true
    discovery:
      enabled: true
      scanInterval: 300000
    validation:
      enabled: true
      strictMode: false
`;

      const startTime = Date.now();
      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);
      const config = await loadConfig(tempDir);
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(500); // Should still be fast
      expect(config.mcp?.servers?.['complex-server']).toBeDefined();
      expect(config.mcp?.marketplace?.url).toBe('https://registry.modelcontextprotocol.io/v1');
      expect(config.mcp?.connection?.maxRetries).toBe(5);
      expect(config.mcp?.tools?.registry?.enabled).toBe(true);
    });
  });

  describe('Configuration parsing stress tests', () => {
    it('should parse complex server configurations repeatedly without degradation', async () => {
      const configYaml = `
project:
  name: stress-test
  version: 1.0.0

mcp:
  enabled: true
  servers:
    test-server:
      name: Stress Test Server
      type: stdio
      command: node
      args: ["test-server.js", "--verbose", "--port=8080"]
      env:
        NODE_ENV: test
        DEBUG: "mcp:*"
        LOG_LEVEL: debug
      autoStart: true
      capabilities: ["test", "stress", "performance"]
      connection:
        maxRetries: 3
        timeoutMs: 30000
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      const iterations = 100;
      const times: number[] = [];

      // Run multiple parsing iterations
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        const config = await loadConfig(tempDir);
        const end = Date.now();

        times.push(end - start);

        // Verify config is parsed correctly each time
        expect(config.mcp?.enabled).toBe(true);
        expect(config.mcp?.servers?.['test-server']?.name).toBe('Stress Test Server');
      }

      // Calculate statistics
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      expect(avgTime).toBeLessThan(100); // Average should be fast
      expect(maxTime).toBeLessThan(500); // No single parse should be too slow
      expect(minTime).toBeGreaterThan(0); // Should take some time

      // Check for significant performance degradation
      const firstHalf = times.slice(0, iterations / 2);
      const secondHalf = times.slice(iterations / 2);
      const firstAvg = firstHalf.reduce((sum, time) => sum + time, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, time) => sum + time, 0) / secondHalf.length;

      // Second half shouldn't be more than 50% slower than first half
      expect(secondAvg).toBeLessThan(firstAvg * 1.5);
    });

    it('should validate schema performance with complex configurations', () => {
      const complexMcpConfig = {
        enabled: true,
        servers: Array.from({ length: 20 }, (_, i) => ({
          [`server-${i}`]: {
            name: `Performance Test Server ${i}`,
            type: i % 4 === 0 ? 'stdio' : i % 4 === 1 ? 'http' : i % 4 === 2 ? 'sse' : 'sdk',
            ...(i % 4 === 0 && { command: 'node', args: [`server-${i}.js`] }),
            ...(i % 4 !== 0 && i % 4 !== 3 && { url: `https://api-${i}.example.com` }),
            autoStart: i % 2 === 0,
            capabilities: [`cap-${i}`, `feature-${i}`],
            connection: {
              maxRetries: 3 + (i % 5),
              timeoutMs: 30000 + (i * 1000),
              poolSize: 1 + (i % 3),
            },
          },
        })).reduce((acc, server) => ({ ...acc, ...server }), {}),
        marketplace: {
          url: 'https://marketplace.example.com',
          enabled: true,
          refreshIntervalMinutes: 720,
          allowUnverified: false,
        },
        connection: {
          maxRetries: 5,
          timeoutMs: 45000,
          autoReconnect: true,
        },
      };

      const iterations = 50;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        const result = MCPConfigSchema.parse(complexMcpConfig);
        const end = Date.now();

        times.push(end - start);

        expect(result.enabled).toBe(true);
        expect(Object.keys(result.servers)).toHaveLength(20);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      expect(avgTime).toBeLessThan(50); // Schema validation should be very fast
    });
  });

  describe('Memory usage and resource management', () => {
    it('should not leak memory during repeated config operations', async () => {
      const configYaml = `
project:
  name: memory-test
  version: 1.0.0

mcp:
  enabled: true
  servers:
    memory-test:
      name: Memory Test Server
      type: stdio
      command: node
      args: ["test.js"]
      autoStart: false
`;

      await fs.writeFile(path.join(apexDir, 'config.yaml'), configYaml);

      // Get baseline memory usage
      if (global.gc) {
        global.gc();
      }
      const initialMemory = process.memoryUsage();

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        const config = await loadConfig(tempDir);
        getMCPServers(config);
        getMCPConfig(config);
        isMCPEnabled(config);
      }

      // Check memory usage after operations
      if (global.gc) {
        global.gc();
      }
      const finalMemory = process.memoryUsage();

      // Memory usage shouldn't grow significantly
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const maxGrowthMB = 10; // Allow up to 10MB growth

      expect(memoryGrowth).toBeLessThan(maxGrowthMB * 1024 * 1024);
    });
  });

  describe('Configuration validation performance', () => {
    it('should validate configurations efficiently', () => {
      const testConfigs = [
        { enabled: true, servers: {} },
        {
          enabled: false,
          servers: {
            test: { name: 'Test', type: 'stdio' as const, command: 'node' }
          }
        },
        {
          enabled: true,
          servers: {
            server1: { name: 'S1', type: 'http' as const, url: 'https://api1.com' },
            server2: { name: 'S2', type: 'sse' as const, url: 'https://api2.com' },
            server3: { name: 'S3', type: 'sdk' as const },
          },
          marketplace: { url: 'https://marketplace.com', enabled: true },
          connection: { maxRetries: 3, timeoutMs: 30000 },
        },
      ];

      const start = Date.now();

      for (const config of testConfigs) {
        for (let i = 0; i < 100; i++) {
          const result = MCPConfigSchema.parse(config);
          expect(result.enabled).toBe(config.enabled);
        }
      }

      const totalTime = Date.now() - start;
      expect(totalTime).toBeLessThan(1000); // Should validate 300 configs in under 1 second
    });
  });
});