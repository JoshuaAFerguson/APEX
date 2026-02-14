/**
 * MCP Mock Usage Patterns Integration Tests
 *
 * Comprehensive collection of usage patterns and best practices for MCP mocks.
 * These tests serve as living documentation and demonstrate:
 * 1. Common testing scenarios and patterns
 * 2. Best practices for mock configuration
 * 3. Integration with different components
 * 4. Debugging and troubleshooting techniques
 *
 * This test suite acts as a cookbook for developers using MCP mocks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  withMockMCP,
  withMockMCPFacade,
  MockMCPServerBuilder,
  createMockMCPServer,
  createFileSystemMockServer,
  createDatabaseMockServer,
  createApiMockServer,
  ERROR_SIMULATION_PRESETS,
  getErrorPreset,
  type WithMockMCPOptions,
  type MockMCPServerDefinition
} from '@apexcli/orchestrator/mcp/mock-server';
import { MCPClient } from '@apexcli/orchestrator';

describe('📚 MCP Mock Usage Patterns', () => {
  describe('🎯 Pattern: Simple Tool Testing', () => {
    it('should demonstrate the simplest mock setup', async () => {
      // Pattern: Quick one-liner for simple tools
      await withMockMCPFacade(
        builder => builder
          .withName('simple')
          .withTool('ping').withStaticResponse([{ type: 'text', text: 'pong' }]),
        async (facade) => {
          const transport = facade.getTransport();
          await transport.connect();

          const response = await transport.request('tools/call', {
            name: 'ping',
            arguments: {}
          });

          expect(response.content[0].text).toBe('pong');
          facade.assertToolCalled('ping', 1);
        }
      );
    });

    it('should demonstrate parameterized tool responses', async () => {
      // Pattern: Tools that echo or transform input
      await withMockMCPFacade(
        builder => builder
          .withName('echo-server')
          .withTool('echo')
            .withDynamicHandler(async (toolName, args) => ({
              content: [{
                type: 'text',
                text: `Echo: ${args.message}`
              }],
              isError: false
            }))
          .withTool('uppercase')
            .withDynamicHandler(async (toolName, args) => ({
              content: [{
                type: 'text',
                text: (args.text || '').toString().toUpperCase()
              }],
              isError: false
            })),
        async (facade) => {
          const transport = facade.getTransport();
          await transport.connect();

          // Test echo
          const echoResponse = await transport.request('tools/call', {
            name: 'echo',
            arguments: { message: 'Hello, World!' }
          });
          expect(echoResponse.content[0].text).toBe('Echo: Hello, World!');

          // Test uppercase transformation
          const upperResponse = await transport.request('tools/call', {
            name: 'uppercase',
            arguments: { text: 'convert me' }
          });
          expect(upperResponse.content[0].text).toBe('CONVERT ME');

          facade.assertToolCalled('echo', 1);
          facade.assertToolCalled('uppercase', 1);
        }
      );
    });
  });

  describe('🏗️ Pattern: Preset-Based Configuration', () => {
    it('should demonstrate filesystem preset usage', async () => {
      // Pattern: Use presets for common tool categories
      const server = createFileSystemMockServer('fs-test', {
        files: {
          '/project/src/main.ts': 'console.log("Hello, TypeScript!");',
          '/project/package.json': JSON.stringify({
            name: 'test-project',
            dependencies: { typescript: '^4.0.0' }
          }),
          '/project/README.md': '# Test Project\n\nA demonstration project.'
        },
        directories: {
          '/project/src': ['main.ts', 'utils.ts'],
          '/project/tests': ['main.test.ts']
        }
      });

      await server.start();

      try {
        const transport = server.createClientTransport();
        await transport.connect();

        // Read a TypeScript file
        const tsFile = await transport.request('tools/call', {
          name: 'read_file',
          arguments: { path: '/project/src/main.ts' }
        });
        expect(tsFile.content[0].text).toContain('console.log');

        // Read JSON configuration
        const packageJson = await transport.request('tools/call', {
          name: 'read_file',
          arguments: { path: '/project/package.json' }
        });
        const pkg = JSON.parse(packageJson.content[0].text);
        expect(pkg.name).toBe('test-project');

        // List directory contents
        const srcContents = await transport.request('tools/call', {
          name: 'list_files',
          arguments: { path: '/project/src' }
        });
        const files = JSON.parse(srcContents.content[0].text);
        expect(files.files).toContain('main.ts');

        server.assertToolCalled('read_file', 2);
        server.assertToolCalled('list_files', 1);

        await transport.disconnect();
      } finally {
        await server.stop();
      }
    });

    it('should demonstrate database preset usage', async () => {
      // Pattern: Mock database with realistic data
      const server = createDatabaseMockServer('db-test', {
        tables: {
          users: [
            { id: 1, username: 'alice', email: 'alice@test.com', active: true },
            { id: 2, username: 'bob', email: 'bob@test.com', active: false },
            { id: 3, username: 'charlie', email: 'charlie@test.com', active: true }
          ],
          orders: [
            { id: 101, user_id: 1, total: 29.99, status: 'shipped' },
            { id: 102, user_id: 3, total: 15.50, status: 'pending' }
          ]
        }
      });

      await server.start();

      try {
        const transport = server.createClientTransport();
        await transport.connect();

        // Query all users
        const allUsers = await transport.request('tools/call', {
          name: 'query',
          arguments: { sql: 'SELECT * FROM users' }
        });
        const users = JSON.parse(allUsers.content[0].text);
        expect(users.rows).toHaveLength(3);
        expect(users.rows[0].username).toBe('alice');

        // Query active users only
        const activeUsers = await transport.request('tools/call', {
          name: 'query',
          arguments: { sql: 'SELECT * FROM users WHERE active = true' }
        });
        const activeResult = JSON.parse(activeUsers.content[0].text);
        expect(activeResult.rows).toHaveLength(2);

        // Join query
        const userOrders = await transport.request('tools/call', {
          name: 'query',
          arguments: {
            sql: 'SELECT u.username, o.total FROM users u JOIN orders o ON u.id = o.user_id'
          }
        });
        const joined = JSON.parse(userOrders.content[0].text);
        expect(joined.rows).toHaveLength(2);

        server.assertToolCalled('query', 3);

        await transport.disconnect();
      } finally {
        await server.stop();
      }
    });

    it('should demonstrate API preset usage', async () => {
      // Pattern: Mock external API interactions
      const server = createApiMockServer('api-test', {
        endpoints: {
          '/users': {
            method: 'GET',
            response: {
              users: [
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' }
              ]
            }
          },
          '/users/{id}': {
            method: 'GET',
            response: { id: 1, name: 'Alice', email: 'alice@api.com' }
          },
          '/posts': {
            method: 'POST',
            response: { id: 123, title: 'New Post', created: true }
          }
        }
      });

      await server.start();

      try {
        const transport = server.createClientTransport();
        await transport.connect();

        // GET request
        const usersResponse = await transport.request('tools/call', {
          name: 'http_request',
          arguments: { method: 'GET', url: '/users' }
        });
        const users = JSON.parse(usersResponse.content[0].text);
        expect(users.users).toHaveLength(2);

        // GET with path parameter
        const userResponse = await transport.request('tools/call', {
          name: 'http_request',
          arguments: { method: 'GET', url: '/users/1' }
        });
        const user = JSON.parse(userResponse.content[0].text);
        expect(user.name).toBe('Alice');

        // POST request
        const postResponse = await transport.request('tools/call', {
          name: 'http_request',
          arguments: {
            method: 'POST',
            url: '/posts',
            body: { title: 'My New Post', content: 'Post content' }
          }
        });
        const post = JSON.parse(postResponse.content[0].text);
        expect(post.created).toBe(true);

        server.assertToolCalled('http_request', 3);

        await transport.disconnect();
      } finally {
        await server.stop();
      }
    });
  });

  describe('⚡ Pattern: State Management', () => {
    it('should demonstrate stateful mock behavior', async () => {
      // Pattern: Mock that maintains state across calls
      let counter = 0;
      const items: any[] = [];

      await withMockMCPFacade(
        builder => builder
          .withName('stateful')
          .withTool('increment')
            .withDynamicHandler(async () => {
              counter++;
              return {
                content: [{ type: 'text', text: counter.toString() }],
                isError: false
              };
            })
          .withTool('add_item')
            .withDynamicHandler(async (toolName, args) => {
              const item = { id: items.length + 1, ...args };
              items.push(item);
              return {
                content: [{ type: 'text', text: JSON.stringify(item) }],
                isError: false
              };
            })
          .withTool('list_items')
            .withDynamicHandler(async () => ({
              content: [{ type: 'text', text: JSON.stringify(items) }],
              isError: false
            }))
          .withTool('get_counter')
            .withDynamicHandler(async () => ({
              content: [{ type: 'text', text: counter.toString() }],
              isError: false
            })),
        async (facade) => {
          const transport = facade.getTransport();
          await transport.connect();

          // Initial state
          let counterResult = await transport.request('tools/call', {
            name: 'get_counter',
            arguments: {}
          });
          expect(counterResult.content[0].text).toBe('0');

          // Increment counter
          await transport.request('tools/call', { name: 'increment', arguments: {} });
          await transport.request('tools/call', { name: 'increment', arguments: {} });

          counterResult = await transport.request('tools/call', {
            name: 'get_counter',
            arguments: {}
          });
          expect(counterResult.content[0].text).toBe('2');

          // Add items
          await transport.request('tools/call', {
            name: 'add_item',
            arguments: { name: 'Item 1', type: 'test' }
          });
          await transport.request('tools/call', {
            name: 'add_item',
            arguments: { name: 'Item 2', type: 'demo' }
          });

          // List items
          const itemsResult = await transport.request('tools/call', {
            name: 'list_items',
            arguments: {}
          });
          const itemsList = JSON.parse(itemsResult.content[0].text);
          expect(itemsList).toHaveLength(2);
          expect(itemsList[0].name).toBe('Item 1');

          facade.assertToolCalled('increment', 2);
          facade.assertToolCalled('add_item', 2);
        }
      );
    });

    it('should demonstrate state reset between tests', async () => {
      // Pattern: Ensure clean state for each test
      const sharedState = { value: 0 };

      const createStatefulServer = () =>
        new MockMCPServerBuilder()
          .withName('state-reset-test')
          .withTool('set_value')
            .withDynamicHandler(async (toolName, args) => {
              sharedState.value = args.value;
              return {
                content: [{ type: 'text', text: `Set to ${sharedState.value}` }],
                isError: false
              };
            })
          .withTool('get_value')
            .withDynamicHandler(async () => ({
              content: [{ type: 'text', text: sharedState.value.toString() }],
              isError: false
            }));

      // Test 1: Set value to 42
      await withMockMCPFacade(
        createStatefulServer,
        async (facade) => {
          const transport = facade.getTransport();
          await transport.connect();

          await transport.request('tools/call', {
            name: 'set_value',
            arguments: { value: 42 }
          });

          const result = await transport.request('tools/call', {
            name: 'get_value',
            arguments: {}
          });
          expect(result.content[0].text).toBe('42');
        },
        { resetOnCleanup: true }
      );

      // Test 2: Value should still be 42 (state persists between tests)
      await withMockMCPFacade(
        createStatefulServer,
        async (facade) => {
          const transport = facade.getTransport();
          await transport.connect();

          const result = await transport.request('tools/call', {
            name: 'get_value',
            arguments: {}
          });
          expect(result.content[0].text).toBe('42'); // State persisted
        }
      );

      // Reset state manually if needed for isolation
      sharedState.value = 0;
    });
  });

  describe('🔧 Pattern: Error Simulation', () => {
    it('should demonstrate progressive error scenarios', async () => {
      // Pattern: Test error recovery and retry logic
      let attemptCount = 0;

      await withMockMCPFacade(
        builder => builder
          .withName('error-sim')
          .withTool('flaky_service')
            .withDynamicHandler(async (toolName, args) => {
              attemptCount++;

              // Fail first 2 attempts, succeed on 3rd
              if (attemptCount < 3) {
                return {
                  content: [],
                  isError: true,
                  _meta: { error: `Service unavailable (attempt ${attemptCount})` }
                };
              }

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    attempt: attemptCount,
                    data: 'Service recovered'
                  })
                }],
                isError: false
              };
            }),
        async (facade) => {
          const transport = facade.getTransport();
          await transport.connect();

          // Implement retry logic
          let lastError: string = '';
          let success = false;
          const maxRetries = 5;

          for (let retry = 1; retry <= maxRetries && !success; retry++) {
            try {
              const response = await transport.request('tools/call', {
                name: 'flaky_service',
                arguments: { retry }
              });

              if (!response.isError) {
                const result = JSON.parse(response.content[0].text);
                expect(result.success).toBe(true);
                expect(result.attempt).toBe(3); // Should succeed on 3rd attempt
                success = true;
              }
            } catch (error) {
              lastError = error.message;
              if (retry < maxRetries) {
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 10));
              }
            }
          }

          expect(success).toBe(true);
          facade.assertToolCalled('flaky_service', 3);
        }
      );
    });

    it('should demonstrate error preset combinations', async () => {
      // Pattern: Combine multiple error behaviors
      await withMockMCP(
        builder => builder
          .withName('complex-errors')
          .withTool('network_operation')
            .withStaticResponse([{ type: 'text', text: 'Success' }])
          .withErrorSimulation({
            ...ERROR_SIMULATION_PRESETS.NETWORK_ISSUES,
            intermittentFailures: {
              enabled: true,
              failureRate: 0.3, // 30% failure rate
              patterns: ['timeout', 'connection_reset']
            }
          })
          .withDelay(100, 300), // Network latency
        async (server) => {
          await server.start();
          const transport = server.createClientTransport();
          await transport.connect();

          const results = { successes: 0, failures: 0, totalTime: 0 };
          const attempts = 10;

          for (let i = 0; i < attempts; i++) {
            const start = Date.now();
            try {
              await transport.request('tools/call', {
                name: 'network_operation',
                arguments: { attempt: i + 1 }
              });
              results.successes++;
            } catch (error) {
              results.failures++;
            }
            results.totalTime += Date.now() - start;
          }

          expect(results.successes + results.failures).toBe(attempts);
          expect(results.successes).toBeGreaterThan(0); // Should have some successes
          expect(results.totalTime).toBeGreaterThan(1000); // Should include delays

          console.log(`Error simulation results: ${results.successes}/${attempts} succeeded, avg time: ${results.totalTime/attempts}ms`);

          await transport.disconnect();
        },
        { autoStart: false }
      );
    });
  });

  describe('🏎️ Pattern: Performance Testing', () => {
    it('should demonstrate load testing patterns', async () => {
      // Pattern: Test concurrent operations and throughput
      await withMockMCPFacade(
        builder => builder
          .withName('load-test')
          .withTool('process_item')
            .withDynamicHandler(async (toolName, args) => {
              // Simulate processing time
              const processingTime = Math.floor(Math.random() * 50) + 10;
              await new Promise(resolve => setTimeout(resolve, processingTime));

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    itemId: args.id,
                    processed: true,
                    processingTimeMs: processingTime,
                    timestamp: Date.now()
                  })
                }],
                isError: false
              };
            })
          .withDelay(5, 15), // Network simulation
        async (facade) => {
          const transport = facade.getTransport();
          await transport.connect();

          const concurrentRequests = 5;
          const itemsPerBatch = 10;
          const startTime = Date.now();

          // Process items in concurrent batches
          const batches = [];
          for (let batch = 0; batch < concurrentRequests; batch++) {
            const batchPromises = [];
            for (let item = 0; item < itemsPerBatch; item++) {
              const itemId = batch * itemsPerBatch + item;
              batchPromises.push(
                transport.request('tools/call', {
                  name: 'process_item',
                  arguments: { id: itemId, batch }
                })
              );
            }
            batches.push(Promise.all(batchPromises));
          }

          // Wait for all batches to complete
          const results = await Promise.all(batches);
          const endTime = Date.now();
          const totalTime = endTime - startTime;

          // Verify results
          expect(results).toHaveLength(concurrentRequests);
          results.forEach(batch => {
            expect(batch).toHaveLength(itemsPerBatch);
            batch.forEach(response => {
              const item = JSON.parse(response.content[0].text);
              expect(item.processed).toBe(true);
              expect(item.processingTimeMs).toBeGreaterThan(0);
            });
          });

          const totalItems = concurrentRequests * itemsPerBatch;
          const throughput = (totalItems / totalTime) * 1000; // items per second

          console.log(`Processed ${totalItems} items in ${totalTime}ms (${throughput.toFixed(2)} items/sec)`);

          facade.assertToolCalled('process_item', totalItems);
        }
      );
    });

    it('should demonstrate resource usage monitoring', async () => {
      // Pattern: Track memory and performance metrics
      await withMockMCPFacade(
        builder => builder
          .withName('resource-monitor')
          .withTool('memory_intensive')
            .withDynamicHandler(async (toolName, args) => {
              // Simulate memory usage
              const dataSize = args.size || 1000;
              const data = new Array(dataSize).fill(0).map((_, i) => ({
                id: i,
                data: `item-${i}`,
                timestamp: Date.now()
              }));

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    processed: data.length,
                    memoryUsed: `~${Math.round(dataSize * 0.1)}KB`,
                    firstItem: data[0],
                    lastItem: data[data.length - 1]
                  })
                }],
                isError: false
              };
            }),
        async (facade) => {
          const transport = facade.getTransport();
          await transport.connect();

          // Test different data sizes
          const sizes = [100, 500, 1000, 2000];
          const results = [];

          for (const size of sizes) {
            const start = Date.now();
            const response = await transport.request('tools/call', {
              name: 'memory_intensive',
              arguments: { size }
            });
            const duration = Date.now() - start;

            const result = JSON.parse(response.content[0].text);
            results.push({
              size,
              duration,
              processed: result.processed,
              memoryUsed: result.memoryUsed
            });
          }

          // Verify scaling behavior
          results.forEach((result, index) => {
            expect(result.processed).toBe(sizes[index]);
            expect(result.duration).toBeGreaterThan(0);
          });

          // Generally, larger sizes should take longer (not strict due to variance)
          const avgDurationSmall = (results[0].duration + results[1].duration) / 2;
          const avgDurationLarge = (results[2].duration + results[3].duration) / 2;
          console.log(`Performance scaling: small avg ${avgDurationSmall}ms, large avg ${avgDurationLarge}ms`);

          facade.assertToolCalled('memory_intensive', sizes.length);
        }
      );
    });
  });

  describe('🐛 Pattern: Debugging and Troubleshooting', () => {
    it('should demonstrate request/response logging', async () => {
      // Pattern: Enable detailed logging for debugging
      const logs: any[] = [];

      await withMockMCPFacade(
        builder => builder
          .withName('debug-logger')
          .withTool('debug_operation')
            .withDynamicHandler(async (toolName, args) => {
              const logEntry = {
                timestamp: new Date().toISOString(),
                toolName,
                args,
                sessionId: args.sessionId || 'default'
              };
              logs.push(logEntry);

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    result: 'debug operation completed',
                    logId: logs.length
                  })
                }],
                isError: false
              };
            }),
        async (facade) => {
          const transport = facade.getTransport();
          await transport.connect();

          // Make several calls with different parameters
          await transport.request('tools/call', {
            name: 'debug_operation',
            arguments: { action: 'start', sessionId: 'session-1' }
          });

          await transport.request('tools/call', {
            name: 'debug_operation',
            arguments: { action: 'process', data: [1, 2, 3], sessionId: 'session-1' }
          });

          await transport.request('tools/call', {
            name: 'debug_operation',
            arguments: { action: 'finish', sessionId: 'session-1' }
          });

          // Verify logging captured all interactions
          expect(logs).toHaveLength(3);
          expect(logs[0].args.action).toBe('start');
          expect(logs[1].args.data).toEqual([1, 2, 3]);
          expect(logs[2].args.action).toBe('finish');

          // All should be from same session
          logs.forEach(log => {
            expect(log.args.sessionId).toBe('session-1');
            expect(log.timestamp).toBeDefined();
          });

          console.log('Debug logs captured:', logs.length);
          facade.assertToolCalled('debug_operation', 3);
        }
      );
    });

    it('should demonstrate assertion and validation helpers', async () => {
      // Pattern: Use facade assertions for test validation
      await withMockMCPFacade(
        builder => builder
          .withName('validation-test')
          .withTool('validate_input')
            .withDynamicHandler(async (toolName, args) => ({
              content: [{
                type: 'text',
                text: JSON.stringify({ valid: true, input: args })
              }],
              isError: false
            }))
          .withTool('transform_data')
            .withDynamicHandler(async (toolName, args) => ({
              content: [{
                type: 'text',
                text: JSON.stringify({ transformed: args.data?.toUpperCase() })
              }],
              isError: false
            })),
        async (facade) => {
          const transport = facade.getTransport();
          await transport.connect();

          // Make calls in specific order
          await transport.request('tools/call', {
            name: 'validate_input',
            arguments: { data: 'test input' }
          });

          await transport.request('tools/call', {
            name: 'transform_data',
            arguments: { data: 'hello world' }
          });

          await transport.request('tools/call', {
            name: 'validate_input',
            arguments: { data: 'another test' }
          });

          // Use assertion helpers
          facade.assertToolCalled('validate_input', 2);
          facade.assertToolCalled('transform_data', 1);
          facade.assertMethodCalled('tools/call', 3);
          facade.assertMethodCalled('tools/list', 1); // From connection

          // Check execution order
          const stats = facade.getStats();
          expect(stats.totalRequests).toBeGreaterThan(0);
          expect(stats.toolCalls).toHaveProperty('validate_input');
          expect(stats.toolCalls).toHaveProperty('transform_data');

          // Verify call sequence (if tracking is enabled)
          const callHistory = facade.getCallHistory?.() || [];
          if (callHistory.length > 0) {
            expect(callHistory[0].method).toBe('tools/list');
            expect(callHistory[1].toolName).toBe('validate_input');
            expect(callHistory[2].toolName).toBe('transform_data');
            expect(callHistory[3].toolName).toBe('validate_input');
          }
        }
      );
    });
  });
});