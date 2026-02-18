/**
 * @fileoverview Performance and Stress Tests for MockMCPServer
 *
 * This test suite validates MockMCPServer performance characteristics
 * and stress resilience according to acceptance criteria:
 * - High-throughput request processing
 * - Concurrent client handling
 * - Memory usage stability
 * - Response time consistency
 * - Resource cleanup efficiency
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockMCPServer } from './mock-mcp-server.js';
import type { MockMCPServerDefinition } from '@apexcli/core';

// Increase timeout for performance tests
vi.setConfig({ testTimeout: 30000 });

describe('MockMCPServer Performance and Stress Tests', () => {
  let server: MockMCPServer;
  let serverDefinition: MockMCPServerDefinition;

  beforeEach(() => {
    serverDefinition = {
      serverConfig: {
        name: 'performance-test-server',
        transport: 'stdio',
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true },
          resources: { listChanged: false },
          prompts: { listChanged: false },
        },
        serverInfo: {
          name: 'performance-test-server',
          version: '1.0.0',
        },
        maxConnections: 100,
        shutdownTimeoutMs: 5000,
      },
      defaultBehavior: {
        responseDelay: { fixedMs: 1 }, // Minimal delay for performance testing
        errorInjection: { enabled: false },
        toolHandlers: [
          {
            toolName: 'fast-tool',
            response: {
              content: [{ type: 'text', text: 'Quick response' }],
              isError: false,
            },
          },
          {
            toolName: 'data-processor',
            response: {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  processedAt: new Date().toISOString(),
                  result: 'data processed',
                  metadata: { size: 1024, format: 'json' }
                })
              }],
              isError: false,
            },
          },
        ],
        notificationTriggers: [],
        defaultToolResponse: {
          content: [{ type: 'text', text: 'Default fast response' }],
          isError: false,
        },
      },
      scenarios: [],
    };

    server = new MockMCPServer(serverDefinition);
  });

  afterEach(async () => {
    if (server.isListening()) {
      await server.stop();
    }
    vi.clearAllMocks();
  });

  describe('High-Throughput Request Processing', () => {
    it('should handle 1000 rapid requests from single client', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      const requestCount = 1000;
      const startTime = Date.now();

      // Send 1000 requests rapidly
      const requests = Array.from({ length: requestCount }, (_, i) =>
        transport.send({
          jsonrpc: '2.0',
          id: i + 1,
          method: 'tools/call',
          params: {
            name: 'fast-tool',
            arguments: { requestId: i },
          },
        })
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;
      const requestsPerSecond = (requestCount / duration) * 1000;

      // Verify all requests succeeded
      expect(responses).toHaveLength(requestCount);
      responses.forEach((response, i) => {
        expect(response).toMatchObject({
          jsonrpc: '2.0',
          id: i + 1,
          result: {
            content: [{ type: 'text', text: 'Quick response' }],
            isError: false,
          },
        });
      });

      // Performance expectations (should handle at least 100 req/sec)
      expect(requestsPerSecond).toBeGreaterThan(100);
      console.log(`Processed ${requestCount} requests in ${duration}ms (${requestsPerSecond.toFixed(2)} req/sec)`);

      // Verify server state consistency
      expect(server.getConnectionCount()).toBe(1);
      expect(server.getStats().totalRequests).toBe(requestCount);

      const client = server.getConnectedClients()[0];
      expect(client.requestCount).toBe(requestCount);
    });

    it('should maintain response time consistency under load', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      const batchSize = 100;
      const batches = 10;
      const responseTimes: number[] = [];

      for (let batch = 0; batch < batches; batch++) {
        const batchStart = Date.now();

        const batchRequests = Array.from({ length: batchSize }, (_, i) =>
          transport.send({
            jsonrpc: '2.0',
            id: batch * batchSize + i + 1,
            method: 'tools/call',
            params: {
              name: 'fast-tool',
              arguments: { batch, requestIndex: i },
            },
          })
        );

        await Promise.all(batchRequests);
        const batchDuration = Date.now() - batchStart;
        responseTimes.push(batchDuration);

        console.log(`Batch ${batch + 1}/${batches}: ${batchDuration}ms for ${batchSize} requests`);
      }

      // Calculate statistics
      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const minResponseTime = Math.min(...responseTimes);
      const maxResponseTime = Math.max(...responseTimes);
      const standardDeviation = Math.sqrt(
        responseTimes.reduce((sum, time) => sum + Math.pow(time - avgResponseTime, 2), 0) / responseTimes.length
      );

      console.log(`Response time stats: avg=${avgResponseTime.toFixed(2)}ms, min=${minResponseTime}ms, max=${maxResponseTime}ms, stddev=${standardDeviation.toFixed(2)}ms`);

      // Performance expectations
      expect(avgResponseTime).toBeLessThan(1000); // Average batch should complete in < 1s
      expect(maxResponseTime / minResponseTime).toBeLessThan(3); // Max should not be more than 3x min
      expect(standardDeviation / avgResponseTime).toBeLessThan(0.5); // Low variance in performance

      // Verify total accuracy
      expect(server.getStats().totalRequests).toBe(batchSize * batches);
    });

    it('should handle burst traffic patterns', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      // Simulate burst pattern: quiet -> burst -> quiet -> burst
      const patterns = [
        { requests: 10, delay: 50 },   // Quiet period
        { requests: 200, delay: 0 },   // Burst
        { requests: 5, delay: 100 },   // Quiet period
        { requests: 300, delay: 0 },   // Larger burst
        { requests: 10, delay: 50 },   // Quiet period
      ];

      let totalRequests = 0;
      const allResults: any[] = [];

      for (const pattern of patterns) {
        const patternStart = Date.now();

        for (let i = 0; i < pattern.requests; i++) {
          const requestPromise = transport.send({
            jsonrpc: '2.0',
            id: totalRequests + i + 1,
            method: 'tools/call',
            params: {
              name: 'data-processor',
              arguments: { burst: true, patternIndex: i },
            },
          });

          allResults.push(requestPromise);

          if (pattern.delay > 0) {
            await new Promise(resolve => setTimeout(resolve, pattern.delay));
          }
        }

        totalRequests += pattern.requests;
        const patternDuration = Date.now() - patternStart;
        console.log(`Pattern completed: ${pattern.requests} requests in ${patternDuration}ms`);
      }

      // Wait for all requests to complete
      const finalResults = await Promise.all(allResults);

      expect(finalResults).toHaveLength(totalRequests);
      expect(server.getStats().totalRequests).toBe(totalRequests);

      // All requests should have succeeded
      finalResults.forEach(result => {
        expect(result).toMatchObject({
          jsonrpc: '2.0',
          result: expect.any(Object),
        });
      });
    });
  });

  describe('Concurrent Client Handling', () => {
    it('should handle 50 concurrent clients with independent operations', async () => {
      await server.start();

      const clientCount = 50;
      const requestsPerClient = 20;

      console.log(`Starting test with ${clientCount} clients, ${requestsPerClient} requests each`);

      // Create and connect all clients
      const transports = await Promise.all(
        Array.from({ length: clientCount }, async (_, clientIndex) => {
          const transport = server.createClientTransport();
          await transport.connect();

          // Initialize each client
          await transport.send({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              clientInfo: {
                name: `client-${clientIndex}`,
                version: '1.0.0',
              },
              capabilities: {},
            },
          });

          return { transport, clientIndex };
        })
      );

      expect(server.getConnectionCount()).toBe(clientCount);

      const startTime = Date.now();

      // Each client sends requests concurrently
      const allClientPromises = transports.map(({ transport, clientIndex }) =>
        Promise.all(
          Array.from({ length: requestsPerClient }, (_, requestIndex) =>
            transport.send({
              jsonrpc: '2.0',
              id: requestIndex + 2, // +2 because initialize was id 1
              method: 'tools/call',
              params: {
                name: 'fast-tool',
                arguments: {
                  clientId: clientIndex,
                  requestId: requestIndex,
                },
              },
            })
          )
        )
      );

      const allResults = await Promise.all(allClientPromises);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;
      const totalRequests = clientCount * requestsPerClient;

      console.log(`Completed ${totalRequests} requests from ${clientCount} clients in ${totalDuration}ms`);

      // Verify all requests succeeded
      expect(allResults).toHaveLength(clientCount);
      allResults.forEach((clientResults, clientIndex) => {
        expect(clientResults).toHaveLength(requestsPerClient);
        clientResults.forEach((response, requestIndex) => {
          expect(response).toMatchObject({
            jsonrpc: '2.0',
            id: requestIndex + 2,
            result: expect.any(Object),
          });
        });
      });

      // Verify server state
      const stats = server.getStats();
      expect(stats.totalRequests).toBe(totalRequests + clientCount); // +clientCount for initialize requests

      // Verify each client tracked its requests
      const clients = server.getConnectedClients();
      expect(clients).toHaveLength(clientCount);

      clients.forEach(client => {
        expect(client.requestCount).toBe(requestsPerClient + 1); // +1 for initialize
        expect(client.protocolState).toBe('initialized');
        expect(client.clientInfo?.name).toMatch(/^client-\d+$/);
      });

      // Performance expectation: should handle concurrent load efficiently
      const requestsPerSecond = (totalRequests / totalDuration) * 1000;
      expect(requestsPerSecond).toBeGreaterThan(50); // Should handle at least 50 req/sec with 50 concurrent clients

      console.log(`Performance: ${requestsPerSecond.toFixed(2)} req/sec with ${clientCount} concurrent clients`);
    });

    it('should handle client churn (connect/disconnect cycles)', async () => {
      await server.start();

      const iterations = 20;
      const clientsPerIteration = 10;
      const requestsPerClient = 5;

      let totalConnections = 0;
      let totalRequests = 0;

      for (let iteration = 0; iteration < iterations; iteration++) {
        // Create clients for this iteration
        const iterationTransports = await Promise.all(
          Array.from({ length: clientsPerIteration }, async () => {
            const transport = server.createClientTransport();
            await transport.connect();
            totalConnections++;
            return transport;
          })
        );

        expect(server.getConnectionCount()).toBe(clientsPerIteration);

        // Each client makes requests
        const iterationPromises = iterationTransports.map(async (transport) => {
          const requests = Array.from({ length: requestsPerClient }, (_, i) =>
            transport.send({
              jsonrpc: '2.0',
              id: i + 1,
              method: 'tools/call',
              params: {
                name: 'fast-tool',
                arguments: { iteration, request: i },
              },
            })
          );

          totalRequests += requestsPerClient;
          return Promise.all(requests);
        });

        await Promise.all(iterationPromises);

        // Disconnect all clients
        await Promise.all(
          iterationTransports.map(transport => transport.disconnect())
        );

        expect(server.getConnectionCount()).toBe(0);

        if (iteration % 5 === 0) {
          console.log(`Completed iteration ${iteration + 1}/${iterations}`);
        }
      }

      // Verify final state
      expect(server.getConnectionCount()).toBe(0);
      expect(server.isListening()).toBe(true);

      const stats = server.getStats();
      expect(stats.totalRequests).toBe(totalRequests);

      // Server should still be responsive after all the churn
      const finalTransport = server.createClientTransport();
      await finalTransport.connect();

      const finalResponse = await finalTransport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'fast-tool', arguments: { final: true } },
      });

      expect(finalResponse).toMatchObject({
        jsonrpc: '2.0',
        result: expect.any(Object),
      });

      console.log(`Completed ${iterations} iterations of client churn: ${totalConnections} total connections, ${totalRequests} total requests`);
    });

    it('should handle mixed transport types under load', async () => {
      const stdioServer = new MockMCPServer({
        ...serverDefinition,
        serverConfig: {
          ...serverDefinition.serverConfig,
          name: 'stdio-performance',
          transport: 'stdio',
        },
      });

      const httpServer = new MockMCPServer({
        ...serverDefinition,
        serverConfig: {
          ...serverDefinition.serverConfig,
          name: 'http-performance',
          transport: 'http',
        },
      });

      await Promise.all([stdioServer.start(), httpServer.start()]);

      try {
        const clientsPerServer = 25;
        const requestsPerClient = 10;

        // Create clients for both servers
        const stdioClients = await Promise.all(
          Array.from({ length: clientsPerServer }, async () => {
            const transport = stdioServer.createClientTransport();
            await transport.connect();
            return transport;
          })
        );

        const httpClients = await Promise.all(
          Array.from({ length: clientsPerServer }, async () => {
            const transport = httpServer.createClientTransport();
            await transport.connect();
            return transport;
          })
        );

        expect(stdioServer.getConnectionCount()).toBe(clientsPerServer);
        expect(httpServer.getConnectionCount()).toBe(clientsPerServer);

        const startTime = Date.now();

        // Concurrent requests to both servers
        const [stdioResults, httpResults] = await Promise.all([
          Promise.all(
            stdioClients.map((transport, clientIndex) =>
              Promise.all(
                Array.from({ length: requestsPerClient }, (_, requestIndex) =>
                  transport.send({
                    jsonrpc: '2.0',
                    id: requestIndex + 1,
                    method: 'tools/call',
                    params: {
                      name: 'fast-tool',
                      arguments: { server: 'stdio', client: clientIndex },
                    },
                  })
                )
              )
            )
          ),
          Promise.all(
            httpClients.map((transport, clientIndex) =>
              Promise.all(
                Array.from({ length: requestsPerClient }, (_, requestIndex) =>
                  transport.send({
                    jsonrpc: '2.0',
                    id: requestIndex + 1,
                    method: 'tools/call',
                    params: {
                      name: 'fast-tool',
                      arguments: { server: 'http', client: clientIndex },
                    },
                  })
                )
              )
            )
          ),
        ]);

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Verify all requests succeeded
        expect(stdioResults).toHaveLength(clientsPerServer);
        expect(httpResults).toHaveLength(clientsPerServer);

        const totalRequests = clientsPerServer * requestsPerClient * 2; // 2 servers
        const requestsPerSecond = (totalRequests / duration) * 1000;

        console.log(`Mixed transport performance: ${totalRequests} requests in ${duration}ms (${requestsPerSecond.toFixed(2)} req/sec)`);

        // Verify both servers handled their loads correctly
        expect(stdioServer.getStats().totalRequests).toBe(clientsPerServer * requestsPerClient);
        expect(httpServer.getStats().totalRequests).toBe(clientsPerServer * requestsPerClient);

        expect(requestsPerSecond).toBeGreaterThan(50);

      } finally {
        await Promise.all([stdioServer.stop(), httpServer.stop()]);
      }
    });
  });

  describe('Memory and Resource Management', () => {
    it('should maintain stable memory usage during extended operation', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      // Create baseline measurement
      const initialStats = server.getStats();
      expect(initialStats.totalRequests).toBe(0);

      // Extended operation: 50 iterations of 100 requests each
      const iterations = 50;
      const requestsPerIteration = 100;
      const measurements: number[] = [];

      for (let iteration = 0; iteration < iterations; iteration++) {
        const iterationStart = Date.now();

        // Send batch of requests
        const requests = Array.from({ length: requestsPerIteration }, (_, i) =>
          transport.send({
            jsonrpc: '2.0',
            id: iteration * requestsPerIteration + i + 1,
            method: 'tools/call',
            params: {
              name: 'data-processor',
              arguments: {
                iteration,
                data: `payload-${i}`,
                metadata: { size: Math.random() * 1000 },
              },
            },
          })
        );

        await Promise.all(requests);

        const iterationTime = Date.now() - iterationStart;
        measurements.push(iterationTime);

        // Every 10 iterations, check if performance is degrading
        if (iteration > 0 && iteration % 10 === 0) {
          const recentAvg = measurements.slice(-10).reduce((sum, time) => sum + time, 0) / 10;
          const earlyAvg = measurements.slice(0, 10).reduce((sum, time) => sum + time, 0) / 10;
          const degradation = recentAvg / earlyAvg;

          console.log(`Iteration ${iteration}: recent avg ${recentAvg.toFixed(2)}ms, early avg ${earlyAvg.toFixed(2)}ms, ratio ${degradation.toFixed(2)}`);

          // Performance shouldn't degrade significantly over time
          expect(degradation).toBeLessThan(2.0); // Allow up to 2x degradation
        }
      }

      const finalStats = server.getStats();
      expect(finalStats.totalRequests).toBe(iterations * requestsPerIteration);

      // Performance should remain relatively stable
      const firstQuarter = measurements.slice(0, Math.floor(iterations / 4));
      const lastQuarter = measurements.slice(-Math.floor(iterations / 4));

      const firstQuarterAvg = firstQuarter.reduce((sum, time) => sum + time, 0) / firstQuarter.length;
      const lastQuarterAvg = lastQuarter.reduce((sum, time) => sum + time, 0) / lastQuarter.length;

      console.log(`Performance stability: first quarter avg ${firstQuarterAvg.toFixed(2)}ms, last quarter avg ${lastQuarterAvg.toFixed(2)}ms`);

      expect(lastQuarterAvg / firstQuarterAvg).toBeLessThan(1.5); // Less than 50% degradation
    });

    it('should efficiently clean up resources during rapid client cycles', async () => {
      await server.start();

      const cycles = 100;
      const requestsPerCycle = 5;

      let peakConnections = 0;

      for (let cycle = 0; cycle < cycles; cycle++) {
        // Create client
        const transport = server.createClientTransport();
        await transport.connect();

        peakConnections = Math.max(peakConnections, server.getConnectionCount());

        // Send requests
        const requests = Array.from({ length: requestsPerCycle }, (_, i) =>
          transport.send({
            jsonrpc: '2.0',
            id: i + 1,
            method: 'tools/call',
            params: {
              name: 'fast-tool',
              arguments: { cycle, request: i },
            },
          })
        );

        await Promise.all(requests);

        // Disconnect immediately
        await transport.disconnect();

        // Connection count should return to 0
        expect(server.getConnectionCount()).toBe(0);

        if (cycle % 25 === 0) {
          console.log(`Completed ${cycle + 1}/${cycles} rapid cycles`);
        }
      }

      // Final verification
      expect(server.getConnectionCount()).toBe(0);
      expect(server.isListening()).toBe(true);

      const stats = server.getStats();
      expect(stats.totalRequests).toBe(cycles * requestsPerCycle);

      console.log(`Completed ${cycles} rapid cycles, peak connections: ${peakConnections}, final requests: ${stats.totalRequests}`);

      // Server should still be fully functional
      const testTransport = server.createClientTransport();
      await testTransport.connect();

      const testResponse = await testTransport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      });

      expect(testResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: {},
      });
    });

    it('should handle request history management efficiently', async () => {
      // Create server with limited history
      const limitedServer = new MockMCPServer({
        ...serverDefinition,
        defaultBehavior: {
          ...serverDefinition.defaultBehavior,
          recordRequests: true,
          maxRecordedRequests: 100,
        },
      });

      await limitedServer.start();

      try {
        const transport = limitedServer.createClientTransport();
        await transport.connect();

        // Send more requests than the history limit
        const totalRequests = 250;

        for (let i = 0; i < totalRequests; i++) {
          await transport.send({
            jsonrpc: '2.0',
            id: i + 1,
            method: 'tools/call',
            params: {
              name: 'fast-tool',
              arguments: { requestIndex: i },
            },
          });

          // Check history doesn't grow beyond limit
          const history = limitedServer.getRequestHistory();
          expect(history.length).toBeLessThanOrEqual(100);
        }

        const finalHistory = limitedServer.getRequestHistory();
        const finalStats = limitedServer.getStats();

        // History should be capped at 100
        expect(finalHistory.length).toBe(100);

        // But total request count should be accurate
        expect(finalStats.totalRequests).toBe(totalRequests);

        // History should contain the most recent requests
        const latestRecord = finalHistory[finalHistory.length - 1];
        expect(latestRecord.request.id).toBe(totalRequests);

        console.log(`Request history management: processed ${totalRequests} requests, kept ${finalHistory.length} in history`);

      } finally {
        await limitedServer.stop();
      }
    });
  });
});