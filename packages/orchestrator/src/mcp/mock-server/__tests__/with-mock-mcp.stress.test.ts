/**
 * @fileoverview Stress Tests for withMockMCP() Test Wrapper Functions
 *
 * High-load and performance testing scenarios to ensure the wrapper functions
 * can handle heavy concurrent usage, resource pressure, and extended operation
 * periods without memory leaks or performance degradation.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { withMockMCP, withMockMCPFacade } from '../with-mock-mcp.js';
import { MockMCPServer } from '../mock-mcp-server.js';
import type { MockMCPServerDefinition } from '@apexcli/core';

// Stress test configuration
const STRESS_CONFIG = {
  CONCURRENT_SERVERS: 20,
  SEQUENTIAL_ITERATIONS: 100,
  RAPID_CYCLES: 50,
  LARGE_DATASET_SIZE: 200,
  TIMEOUT_STRESS_COUNT: 30,
};

describe('withMockMCP - Stress Tests', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let performanceMetrics: {
    totalOperations: number;
    startTime: number;
    completedOperations: number;
  };

  beforeAll(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    performanceMetrics = {
      totalOperations: 0,
      startTime: Date.now(),
      completedOperations: 0,
    };
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();

    const elapsed = Date.now() - performanceMetrics.startTime;
    console.log(`Stress tests completed: ${performanceMetrics.completedOperations}/${performanceMetrics.totalOperations} operations in ${elapsed}ms`);
  });

  describe('concurrent server creation stress', () => {
    it(`should handle ${STRESS_CONFIG.CONCURRENT_SERVERS} concurrent server creations`, async () => {
      const promises: Promise<any>[] = [];
      const results: Array<{ serverId: number; serverName: string; success: boolean }> = [];

      performanceMetrics.totalOperations += STRESS_CONFIG.CONCURRENT_SERVERS;

      // Create many servers concurrently
      for (let i = 0; i < STRESS_CONFIG.CONCURRENT_SERVERS; i++) {
        promises.push(
          withMockMCP(
            builder => builder
              .withName(`stress-server-${i}`)
              .withTool(`tool-${i}`)
              .withStaticResponse([{ type: 'text', text: `Response ${i}` }]),
            async (server) => {
              const result = {
                serverId: i,
                serverName: server.getName(),
                success: server.isListening()
              };
              results.push(result);
              performanceMetrics.completedOperations++;

              // Simulate some work
              await new Promise(resolve => setTimeout(resolve, Math.random() * 20));

              return result;
            }
          )
        );
      }

      const allResults = await Promise.all(promises);

      // Verify all servers were created and cleaned up properly
      expect(allResults).toHaveLength(STRESS_CONFIG.CONCURRENT_SERVERS);
      expect(results).toHaveLength(STRESS_CONFIG.CONCURRENT_SERVERS);

      for (let i = 0; i < STRESS_CONFIG.CONCURRENT_SERVERS; i++) {
        const result = results.find(r => r.serverId === i);
        expect(result).toBeDefined();
        expect(result?.serverName).toBe(`stress-server-${i}`);
        expect(result?.success).toBe(true);
      }
    });

    it(`should handle ${STRESS_CONFIG.CONCURRENT_SERVERS} concurrent facade creations`, async () => {
      const promises: Promise<any>[] = [];
      const results: Array<{ facadeId: number; success: boolean }> = [];

      performanceMetrics.totalOperations += STRESS_CONFIG.CONCURRENT_SERVERS;

      for (let i = 0; i < STRESS_CONFIG.CONCURRENT_SERVERS; i++) {
        promises.push(
          withMockMCPFacade(
            builder => builder
              .withName(`stress-facade-${i}`)
              .withTool(`facade-tool-${i}`)
              .withStaticResponse([{ type: 'text', text: `Facade response ${i}` }]),
            async (facade) => {
              const result = {
                facadeId: i,
                success: facade.isListening()
              };
              results.push(result);
              performanceMetrics.completedOperations++;

              const transport = facade.getTransport();
              expect(transport).toBeDefined();

              return result;
            }
          )
        );
      }

      await Promise.all(promises);

      expect(results).toHaveLength(STRESS_CONFIG.CONCURRENT_SERVERS);
      for (const result of results) {
        expect(result.success).toBe(true);
      }
    });
  });

  describe('sequential operation stress', () => {
    it(`should handle ${STRESS_CONFIG.SEQUENTIAL_ITERATIONS} sequential server creations`, async () => {
      performanceMetrics.totalOperations += STRESS_CONFIG.SEQUENTIAL_ITERATIONS;

      for (let i = 0; i < STRESS_CONFIG.SEQUENTIAL_ITERATIONS; i++) {
        await withMockMCP(
          builder => builder
            .withName(`sequential-${i}`)
            .withTool('sequential-tool')
            .withStaticResponse([{ type: 'text', text: `Sequential ${i}` }]),
          async (server) => {
            expect(server.isListening()).toBe(true);
            performanceMetrics.completedOperations++;

            // Vary the work to test different code paths
            if (i % 10 === 0) {
              server.setErrorMode({ mode: 'always_fail', category: 'jsonrpc', affectedClients: 'all' });
            }
          }
        );
      }
    });

    it('should handle rapid start/stop cycles without resource leaks', async () => {
      const serverRefs: MockMCPServer[] = [];
      performanceMetrics.totalOperations += STRESS_CONFIG.RAPID_CYCLES;

      for (let i = 0; i < STRESS_CONFIG.RAPID_CYCLES; i++) {
        await withMockMCP(
          builder => builder
            .withName(`rapid-cycle-${i}`)
            .withTool('cycle-tool')
            .withStaticResponse([]),
          async (server) => {
            serverRefs.push(server);
            performanceMetrics.completedOperations++;

            // Rapidly start and stop within the test
            await server.stop();
            expect(server.isListening()).toBe(false);

            await server.start();
            expect(server.isListening()).toBe(true);

            await server.stop();
            expect(server.isListening()).toBe(false);

            await server.start();
            expect(server.isListening()).toBe(true);
          }
        );
      }

      // All servers should be cleaned up
      for (const server of serverRefs) {
        expect(server.isListening()).toBe(false);
      }
    });
  });

  describe('large configuration stress', () => {
    it(`should handle server with ${STRESS_CONFIG.LARGE_DATASET_SIZE} tools`, async () => {
      performanceMetrics.totalOperations += 1;

      await withMockMCP(
        builder => {
          let config = builder.withName('large-config-server');

          // Add many tools to stress the configuration system
          for (let i = 0; i < STRESS_CONFIG.LARGE_DATASET_SIZE; i++) {
            config = config
              .withTool(`large_tool_${i}`)
              .withDynamicHandler(async (toolName, args) => ({
                content: [{ type: 'text', text: `Large response ${i} for ${toolName}` }],
                isError: false,
              }));
          }

          return config
            .withDelay(1, 5)
            .withErrorSimulation({
              mode: 'fail_percentage',
              failureRate: 0.1,
              category: 'mcp',
              affectedClients: 'all',
            });
        },
        async (server) => {
          expect(server.isListening()).toBe(true);
          expect(server.getName()).toBe('large-config-server');
          performanceMetrics.completedOperations++;

          // Test that the server is functional with large config
          const transport = server.createClientTransport();
          expect(transport).toBeDefined();
        }
      );
    });

    it('should handle complex definition objects', async () => {
      performanceMetrics.totalOperations += 1;

      const complexDefinition: MockMCPServerDefinition = {
        serverConfig: {
          name: 'complex-definition-server',
          transport: 'stdio',
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: true },
            resources: { listChanged: true, subscribe: true },
            prompts: { listChanged: true },
            logging: {},
          },
          serverInfo: {
            name: 'complex-definition-server',
            version: '1.0.0',
            description: 'A complex server for stress testing'
          },
          maxConnections: 100,
          shutdownTimeoutMs: 10000,
        },
        defaultBehavior: {
          toolHandlers: Array.from({ length: 50 }, (_, i) => ({
            toolName: `complex_tool_${i}`,
            response: {
              content: [{
                type: 'text',
                text: `Complex response ${i} with detailed information about tool execution`
              }],
              isError: false
            },
          })),
          notificationTriggers: Array.from({ length: 10 }, (_, i) => ({
            method: `notification_${i}`,
            trigger: 'immediate',
            payload: { message: `Notification ${i}`, timestamp: Date.now() },
          })),
        },
        scenarios: Array.from({ length: 5 }, (_, i) => ({
          name: `stress_scenario_${i}`,
          description: `Stress test scenario ${i}`,
          steps: [
            {
              description: `Step 1 of scenario ${i}`,
              triggerCondition: { method: 'tools/list' },
              behaviorOverride: {
                toolHandlers: [{
                  toolName: 'special_tool',
                  response: { content: [{ type: 'text', text: 'Special response' }], isError: false },
                }],
              },
            },
          ],
        })),
      };

      await withMockMCP(complexDefinition, async (server) => {
        expect(server.isListening()).toBe(true);
        expect(server.getName()).toBe('complex-definition-server');
        performanceMetrics.completedOperations++;

        // Test server functionality
        const transport = server.createClientTransport();
        expect(transport).toBeDefined();
      });
    });
  });

  describe('timeout stress scenarios', () => {
    it(`should handle ${STRESS_CONFIG.TIMEOUT_STRESS_COUNT} concurrent timeout scenarios`, async () => {
      const promises: Promise<any>[] = [];
      const timeoutResults: Array<{ id: number; timedOut: boolean }> = [];

      performanceMetrics.totalOperations += STRESS_CONFIG.TIMEOUT_STRESS_COUNT;

      for (let i = 0; i < STRESS_CONFIG.TIMEOUT_STRESS_COUNT; i++) {
        promises.push(
          withMockMCP(
            builder => {
              const mockBuilder = builder.withName(`timeout-stress-${i}`).withTool('x').withStaticResponse([]);
              const mockServer = mockBuilder.buildServer();

              // Make some servers timeout
              if (i % 3 === 0) {
                vi.spyOn(mockServer, 'start').mockImplementation(() => new Promise(() => {}));
              }

              return mockBuilder;
            },
            async () => {
              performanceMetrics.completedOperations++;
            },
            { timeout: 50 }
          ).catch((error) => {
            const timedOut = error.message.includes('timed out');
            timeoutResults.push({ id: i, timedOut });
            if (timedOut) {
              performanceMetrics.completedOperations++;
            }
          })
        );
      }

      await Promise.allSettled(promises);

      // Should have some timeouts due to our mocking
      const timeouts = timeoutResults.filter(r => r.timedOut);
      expect(timeouts.length).toBeGreaterThan(0);
    });

    it('should handle timeout stress during cleanup', async () => {
      performanceMetrics.totalOperations += 1;

      await withMockMCP(
        builder => {
          const mockBuilder = builder.withName('cleanup-timeout-stress').withTool('x').withStaticResponse([]);
          const mockServer = mockBuilder.buildServer();

          // Mock stop to hang during cleanup
          vi.spyOn(mockServer, 'stop').mockImplementation(() => new Promise(() => {}));

          return mockBuilder;
        },
        async () => {
          performanceMetrics.completedOperations++;
        },
        { timeout: 50 }
      );

      // Should have logged cleanup error due to timeout
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error during MockMCPServer cleanup:',
        expect.any(Error)
      );
    });
  });

  describe('memory pressure simulation', () => {
    it('should handle servers with large in-memory state', async () => {
      performanceMetrics.totalOperations += 1;

      await withMockMCP(
        builder => builder
          .withName('memory-pressure-server')
          .withTool('memory-intensive-tool')
          .withDynamicHandler(async (toolName, args) => {
            // Simulate large response data
            const largeResponse = Array.from({ length: 1000 }, (_, i) => ({
              type: 'text' as const,
              text: `Large response chunk ${i}: ${'x'.repeat(100)}`
            }));

            return {
              content: largeResponse,
              isError: false,
            };
          }),
        async (server) => {
          expect(server.isListening()).toBe(true);
          performanceMetrics.completedOperations++;

          // Test that server handles large state
          const transport = server.createClientTransport();
          expect(transport).toBeDefined();
        }
      );
    });

    it('should handle rapid creation and destruction under memory pressure', async () => {
      const promises: Promise<void>[] = [];
      performanceMetrics.totalOperations += 10;

      // Create multiple servers with large configurations simultaneously
      for (let i = 0; i < 10; i++) {
        promises.push(
          withMockMCP(
            builder => {
              let config = builder.withName(`memory-test-${i}`);

              // Add many tools with large handlers
              for (let j = 0; j < 20; j++) {
                config = config
                  .withTool(`memory_tool_${i}_${j}`)
                  .withDynamicHandler(async () => ({
                    content: Array.from({ length: 50 }, (_, k) => ({
                      type: 'text' as const,
                      text: `Memory response ${i}-${j}-${k}`
                    })),
                    isError: false,
                  }));
              }

              return config;
            },
            async (server) => {
              expect(server.isListening()).toBe(true);
              performanceMetrics.completedOperations++;

              // Simulate some memory-intensive operations
              for (let k = 0; k < 5; k++) {
                server.setErrorMode({ mode: 'always_fail', category: 'jsonrpc', affectedClients: 'all' });
                server.clearErrorMode();
              }
            }
          )
        );
      }

      await Promise.all(promises);
    });
  });

  describe('error recovery stress', () => {
    it('should handle cascading error scenarios', async () => {
      performanceMetrics.totalOperations += 5;

      for (let i = 0; i < 5; i++) {
        await withMockMCP(
          builder => {
            const mockBuilder = builder.withName(`error-cascade-${i}`).withTool('x').withStaticResponse([]);
            const mockServer = mockBuilder.buildServer();

            // Simulate different types of cascading errors
            if (i === 0) {
              vi.spyOn(mockServer, 'start').mockImplementation(() => Promise.reject(new Error('Start error')));
            } else if (i === 1) {
              vi.spyOn(mockServer, 'resetBehavior').mockImplementation(() => {
                throw new Error('Reset error');
              });
              vi.spyOn(mockServer, 'stop').mockImplementation(() => Promise.reject(new Error('Stop error')));
            } else if (i === 2) {
              vi.spyOn(mockServer, 'clearErrorMode').mockImplementation(() => {
                throw new Error('Clear error mode error');
              });
              vi.spyOn(mockServer, 'resetToDefault').mockImplementation(() => {
                throw new Error('Reset to default error');
              });
            }

            return mockBuilder;
          },
          async () => {
            // This may or may not execute depending on start errors
          },
          {
            beforeCleanup: async () => {
              if (i === 3) {
                throw new Error('Before cleanup error');
              }
            }
          }
        ).catch(() => {
          // Expected for some scenarios
          performanceMetrics.completedOperations++;
        });
      }
    });
  });

  describe('long-running operation simulation', () => {
    it('should handle servers with slow operations', async () => {
      performanceMetrics.totalOperations += 1;

      await withMockMCP(
        builder => builder
          .withName('slow-operations-server')
          .withTool('slow-tool')
          .withDynamicHandler(async (toolName, args) => {
            // Simulate slow operation
            await new Promise(resolve => setTimeout(resolve, 100));

            return {
              content: [{ type: 'text', text: 'Slow response completed' }],
              isError: false,
            };
          })
          .withDelay(50, 150), // Add additional delay
        async (server) => {
          expect(server.isListening()).toBe(true);
          performanceMetrics.completedOperations++;

          // Test server responsiveness
          const transport = server.createClientTransport();
          expect(transport).toBeDefined();
        }
      );
    });
  });
});

describe('Mixed withMockMCP and withMockMCPFacade Stress Tests', () => {
  let performanceMetrics: { operations: number; startTime: number };

  beforeAll(() => {
    performanceMetrics = { operations: 0, startTime: Date.now() };
  });

  afterAll(() => {
    const elapsed = Date.now() - performanceMetrics.startTime;
    console.log(`Mixed stress tests completed: ${performanceMetrics.operations} operations in ${elapsed}ms`);
  });

  it('should handle alternating server and facade creation under load', async () => {
    const promises: Promise<any>[] = [];

    for (let i = 0; i < 20; i++) {
      if (i % 2 === 0) {
        // Create server
        promises.push(
          withMockMCP(
            builder => builder.withName(`mixed-server-${i}`).withTool('test').withStaticResponse([]),
            async (server) => {
              performanceMetrics.operations++;
              expect(server.isListening()).toBe(true);
              await new Promise(resolve => setTimeout(resolve, Math.random() * 30));
            }
          )
        );
      } else {
        // Create facade
        promises.push(
          withMockMCPFacade(
            builder => builder.withName(`mixed-facade-${i}`).withTool('test').withStaticResponse([]),
            async (facade) => {
              performanceMetrics.operations++;
              expect(facade.isListening()).toBe(true);
              await new Promise(resolve => setTimeout(resolve, Math.random() * 30));
            }
          )
        );
      }
    }

    await Promise.all(promises);
    expect(performanceMetrics.operations).toBe(20);
  });

  it('should handle deep nesting of servers and facades', async () => {
    const maxDepth = 5;
    let operationCount = 0;

    async function createNestedMockServers(depth: number): Promise<void> {
      if (depth <= 0) return;

      if (depth % 2 === 0) {
        await withMockMCP(
          builder => builder.withName(`nested-server-${depth}`).withTool('test').withStaticResponse([]),
          async (server) => {
            operationCount++;
            expect(server.isListening()).toBe(true);
            await createNestedMockServers(depth - 1);
          }
        );
      } else {
        await withMockMCPFacade(
          builder => builder.withName(`nested-facade-${depth}`).withTool('test').withStaticResponse([]),
          async (facade) => {
            operationCount++;
            expect(facade.isListening()).toBe(true);
            await createNestedMockServers(depth - 1);
          }
        );
      }
    }

    await createNestedMockServers(maxDepth);
    expect(operationCount).toBe(maxDepth);
    performanceMetrics.operations += operationCount;
  });
});