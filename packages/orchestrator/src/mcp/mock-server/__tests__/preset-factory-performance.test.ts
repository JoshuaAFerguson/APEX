/**
 * @fileoverview Performance Tests for Preset-Based Mock MCP Server Factory
 *
 * Performance benchmarks and stress tests for the createMockMCPServer()
 * factory function to ensure it performs well under various conditions.
 *
 * Tests ADR-080: Preset-Based Mock MCP Server Factory - Performance
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMockMCPServer,
  createFileSystemMockServer,
  createDatabaseMockServer,
  createApiMockServer,
  createMinimalMockServer,
} from '../preset-factory.js';
import { MockMCPServerFacade } from '../mock-server-facade.js';
import type { MockToolHandler } from '@apexcli/core';

describe('createMockMCPServer Performance', () => {
  const servers: MockMCPServerFacade[] = [];

  afterEach(async () => {
    // Clean up all servers
    await Promise.all(servers.map(server => server.stop()));
    servers.length = 0;
  });

  describe('factory function performance', () => {
    it('should create servers quickly for basic presets', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        const server = createMockMCPServer('minimal');
        servers.push(server);
      }

      const duration = performance.now() - startTime;

      // Should create 100 servers in under 100ms
      expect(duration).toBeLessThan(100);
      expect(servers).toHaveLength(100);
    });

    it('should create complex servers with reasonable performance', () => {
      const startTime = performance.now();

      for (let i = 0; i < 50; i++) {
        const server = createMockMCPServer(['filesystem', 'slow', 'error-prone'], {
          name: `performance-test-${i}`,
          additionalTools: [
            {
              toolName: `custom_tool_${i}`,
              response: { content: [{ type: 'text', text: `Tool ${i}` }], isError: false },
              priority: 50,
            }
          ],
          scenarios: [
            { name: `scenario_${i}`, behaviorPreset: 'slow' }
          ]
        });
        servers.push(server);
      }

      const duration = performance.now() - startTime;

      // Should create 50 complex servers in under 200ms
      expect(duration).toBeLessThan(200);
      expect(servers).toHaveLength(50);
    });

    it('should handle many additional tools efficiently', () => {
      const manyTools: MockToolHandler[] = [];
      for (let i = 0; i < 1000; i++) {
        manyTools.push({
          toolName: `tool_${i}`,
          response: { content: [{ type: 'text', text: `Tool ${i}` }], isError: false },
          priority: 50,
        });
      }

      const startTime = performance.now();
      const server = createMockMCPServer('minimal', { additionalTools: manyTools });
      const duration = performance.now() - startTime;

      servers.push(server);

      // Should handle 1000 tools in under 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should handle many scenarios efficiently', () => {
      const manyScenarios = [];
      for (let i = 0; i < 500; i++) {
        manyScenarios.push({
          name: `scenario_${i}`,
          behaviorPreset: i % 2 === 0 ? 'slow' as const : 'error-prone' as const
        });
      }

      const startTime = performance.now();
      const server = createMockMCPServer('minimal', { scenarios: manyScenarios });
      const duration = performance.now() - startTime;

      servers.push(server);

      // Should handle 500 scenarios in under 50ms
      expect(duration).toBeLessThan(50);
    });
  });

  describe('convenience function performance', () => {
    it('should create filesystem servers quickly', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        const server = createFileSystemMockServer({ name: `fs-${i}` });
        servers.push(server);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should create database servers quickly', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        const server = createDatabaseMockServer({ name: `db-${i}` });
        servers.push(server);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should create api servers quickly', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        const server = createApiMockServer({ name: `api-${i}` });
        servers.push(server);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should create minimal servers quickly', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        const server = createMinimalMockServer({ name: `minimal-${i}` });
        servers.push(server);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100);
    });
  });

  describe('memory usage performance', () => {
    it('should not leak memory when creating many servers', () => {
      const initialMemory = process.memoryUsage();

      // Create many servers and immediately dispose
      for (let batch = 0; batch < 10; batch++) {
        const batchServers = [];
        for (let i = 0; i < 50; i++) {
          const server = createMockMCPServer('filesystem', {
            name: `memory-test-${batch}-${i}`
          });
          batchServers.push(server);
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();

      // Memory usage should not have grown excessively (allow for some variance)
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const heapGrowthMB = heapGrowth / (1024 * 1024);

      // Should not use more than 50MB additional heap space
      expect(heapGrowthMB).toBeLessThan(50);
    });

    it('should efficiently handle large configurations', () => {
      const largeConfig = {
        name: 'large-config-test',
        description: 'x'.repeat(10000), // 10KB description
        additionalTools: Array.from({ length: 100 }, (_, i) => ({
          toolName: `tool_${i}`,
          response: {
            content: [{ type: 'text', text: 'x'.repeat(1000) }], // 1KB per tool
            isError: false
          },
          priority: 50,
        })),
        scenarios: Array.from({ length: 100 }, (_, i) => ({
          name: `scenario_${i}`,
          behaviorPreset: 'slow' as const
        }))
      };

      const initialMemory = process.memoryUsage();
      const startTime = performance.now();

      const server = createMockMCPServer('filesystem', largeConfig);

      const duration = performance.now() - startTime;
      const finalMemory = process.memoryUsage();

      servers.push(server);

      // Should create large config in reasonable time
      expect(duration).toBeLessThan(100);

      // Memory usage should be reasonable
      const memoryUsed = (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024);
      expect(memoryUsed).toBeLessThan(20); // Less than 20MB for large config
    });
  });

  describe('concurrent creation performance', () => {
    it('should handle concurrent server creation', async () => {
      const startTime = performance.now();

      const promises = Array.from({ length: 50 }, (_, i) =>
        Promise.resolve(createMockMCPServer('filesystem', {
          name: `concurrent-${i}`
        }))
      );

      const createdServers = await Promise.all(promises);
      const duration = performance.now() - startTime;

      servers.push(...createdServers);

      // Should create 50 servers concurrently in reasonable time
      expect(duration).toBeLessThan(200);
      expect(createdServers).toHaveLength(50);
    });

    it('should handle mixed preset types concurrently', async () => {
      const startTime = performance.now();

      const presets = ['filesystem', 'database', 'api', 'minimal'] as const;
      const promises = Array.from({ length: 40 }, (_, i) => {
        const preset = presets[i % presets.length];
        return Promise.resolve(createMockMCPServer(preset, {
          name: `mixed-${preset}-${i}`
        }));
      });

      const createdServers = await Promise.all(promises);
      const duration = performance.now() - startTime;

      servers.push(...createdServers);

      expect(duration).toBeLessThan(150);
      expect(createdServers).toHaveLength(40);
    });
  });

  describe('startup performance', () => {
    it('should start servers efficiently', async () => {
      // Create servers but don't start them yet
      const testServers = [
        createMockMCPServer('filesystem', { name: 'startup-fs' }),
        createMockMCPServer('database', { name: 'startup-db' }),
        createMockMCPServer('api', { name: 'startup-api' }),
        createMockMCPServer('minimal', { name: 'startup-minimal' }),
      ];

      servers.push(...testServers);

      const startTime = performance.now();

      // Start all servers concurrently
      await Promise.all(testServers.map(server => server.start()));

      const duration = performance.now() - startTime;

      // Should start 4 servers in under 100ms
      expect(duration).toBeLessThan(100);

      // Verify all servers are running
      for (const server of testServers) {
        expect(server.isRunning()).toBe(true);
      }
    });

    it('should handle tool calls efficiently after startup', async () => {
      const server = createMockMCPServer('filesystem', { name: 'tool-call-perf' });
      servers.push(server);

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      // Initialize the connection
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      });

      const startTime = performance.now();

      // Make many tool calls
      const promises = Array.from({ length: 100 }, (_, i) =>
        transport.send({
          jsonrpc: '2.0',
          id: i + 2,
          method: 'tools/call',
          params: {
            name: 'read_file',
            arguments: { path: `/test${i}.txt` }
          }
        })
      );

      const responses = await Promise.all(promises);
      const duration = performance.now() - startTime;

      // Should handle 100 tool calls in under 200ms
      expect(duration).toBeLessThan(200);
      expect(responses).toHaveLength(100);

      // Verify all calls succeeded
      for (const response of responses) {
        expect(response?.result).toBeDefined();
      }
    });
  });

  describe('cleanup performance', () => {
    it('should stop servers efficiently', async () => {
      // Create and start multiple servers
      const testServers = Array.from({ length: 20 }, (_, i) =>
        createMockMCPServer('minimal', { name: `cleanup-${i}` })
      );

      await Promise.all(testServers.map(server => server.start()));

      const startTime = performance.now();

      // Stop all servers
      await Promise.all(testServers.map(server => server.stop()));

      const duration = performance.now() - startTime;

      // Should stop 20 servers in under 100ms
      expect(duration).toBeLessThan(100);

      // Verify all servers are stopped
      for (const server of testServers) {
        expect(server.isRunning()).toBe(false);
      }
    });
  });

  describe('stress tests', () => {
    it('should handle extreme configuration without crashing', () => {
      const extremeConfig = {
        name: 'stress-test-server',
        additionalTools: Array.from({ length: 1000 }, (_, i) => ({
          toolName: `stress_tool_${i}`,
          response: {
            content: [{ type: 'text', text: `Stress tool ${i} response`.repeat(100) }],
            isError: false
          },
          priority: i % 100,
        })),
        scenarios: Array.from({ length: 1000 }, (_, i) => ({
          name: `stress_scenario_${i}`,
          behaviorPreset: i % 2 === 0 ? 'slow' as const : 'error-prone' as const
        })),
        toolOverrides: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [
            `tool_${i}`,
            { priority: i }
          ])
        ),
        delay: { min: 0, max: 1000 },
        maxConnections: 1000,
        shutdownTimeoutMs: 10000
      };

      expect(() => {
        const server = createMockMCPServer('filesystem', extremeConfig);
        servers.push(server);
      }).not.toThrow();
    });

    it('should maintain performance with many repeated operations', () => {
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        const server = createMockMCPServer('minimal', {
          name: `repeat-${i}`,
          additionalTools: [{
            toolName: `tool_${i}`,
            response: { content: [{ type: 'text', text: `Response ${i}` }], isError: false },
            priority: 50,
          }]
        });

        // Add and immediately remove to test cleanup
        servers.push(server);
        servers.pop();
      }

      const duration = performance.now() - startTime;

      // Should handle 1000 create/destroy cycles in under 500ms
      expect(duration).toBeLessThan(500);
    });
  });
});