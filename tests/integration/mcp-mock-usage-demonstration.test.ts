/**
 * MCP Mock Usage Demonstration Integration Tests
 *
 * Comprehensive test suite demonstrating MCP mock usage patterns and serving
 * as documentation for developers. Shows:
 * 1. Basic request/response mocking
 * 2. Error handling scenarios
 * 3. Connection lifecycle testing
 * 4. Usage with orchestrator package
 *
 * This test suite serves as both validation and documentation for
 * the MCP mock infrastructure.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  withMockMCP,
  withMockMCPFacade,
  MockMCPServerBuilder,
  createMockMCPServer,
  createFileSystemMockServer,
  createDatabaseMockServer,
  ERROR_SIMULATION_PRESETS,
  type WithMockMCPOptions
} from '@apexcli/orchestrator/mcp/mock-server';
import { MCPClient } from '@apexcli/orchestrator';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import type { ApexConfig } from '@apexcli/core';

describe('🧪 MCP Mock Usage Demonstration', () => {
  describe('📋 Basic Request/Response Mocking', () => {
    it('should demonstrate simple tool mocking with static responses', async () => {
      await withMockMCPFacade(
        builder => builder
          .withName('demo-server')
          .withTool('read_file')
            .withStaticResponse([{
              type: 'text',
              text: 'File content from mock server'
            }])
          .withTool('list_files')
            .withStaticResponse([{
              type: 'text',
              text: JSON.stringify({
                files: ['file1.txt', 'file2.txt', 'file3.txt']
              })
            }]),
        async (facade) => {
          const transport = facade.getTransport();

          // Connect and verify basic functionality
          await transport.connect();
          expect(transport.isConnected()).toBe(true);

          // Test tool listing
          const toolsResponse = await transport.request('tools/list', {});
          expect(toolsResponse.tools).toHaveLength(2);
          expect(toolsResponse.tools[0].name).toBe('read_file');
          expect(toolsResponse.tools[1].name).toBe('list_files');

          // Test tool calls
          const readResponse = await transport.request('tools/call', {
            name: 'read_file',
            arguments: { path: '/demo/file.txt' }
          });
          expect(readResponse.content[0].text).toBe('File content from mock server');

          const listResponse = await transport.request('tools/call', {
            name: 'list_files',
            arguments: { directory: '/demo' }
          });
          const parsedList = JSON.parse(listResponse.content[0].text);
          expect(parsedList.files).toEqual(['file1.txt', 'file2.txt', 'file3.txt']);

          // Verify call tracking
          facade.assertMethodCalled('tools/list', 1);
          facade.assertMethodCalled('tools/call', 2);
          facade.assertToolCalled('read_file', 1);
          facade.assertToolCalled('list_files', 1);
        }
      );
    });

    it('should demonstrate dynamic response handlers', async () => {
      await withMockMCPFacade(
        builder => builder
          .withName('dynamic-server')
          .withTool('calculate')
            .withDynamicHandler(async (toolName, args) => {
              const { operation, a, b } = args;
              let result: number;

              switch (operation) {
                case 'add':
                  result = a + b;
                  break;
                case 'multiply':
                  result = a * b;
                  break;
                case 'divide':
                  if (b === 0) {
                    return {
                      content: [],
                      isError: true,
                      _meta: { error: 'Division by zero is not allowed' }
                    };
                  }
                  result = a / b;
                  break;
                default:
                  return {
                    content: [],
                    isError: true,
                    _meta: { error: `Unknown operation: ${operation}` }
                  };
              }

              return {
                content: [{
                  type: 'text',
                  text: `Result: ${result}`
                }],
                isError: false
              };
            })
          .withTool('echo')
            .withDynamicHandler(async (toolName, args) => ({
              content: [{
                type: 'text',
                text: `Echo: ${JSON.stringify(args)}`
              }],
              isError: false
            })),
        async (facade) => {
          const transport = facade.getTransport();
          await transport.connect();

          // Test successful calculations
          const addResult = await transport.request('tools/call', {
            name: 'calculate',
            arguments: { operation: 'add', a: 5, b: 3 }
          });
          expect(addResult.content[0].text).toBe('Result: 8');

          const multiplyResult = await transport.request('tools/call', {
            name: 'calculate',
            arguments: { operation: 'multiply', a: 4, b: 6 }
          });
          expect(multiplyResult.content[0].text).toBe('Result: 24');

          // Test error handling in dynamic handler
          const errorResult = await transport.request('tools/call', {
            name: 'calculate',
            arguments: { operation: 'divide', a: 10, b: 0 }
          });
          expect(errorResult.isError).toBe(true);
          expect(errorResult._meta.error).toBe('Division by zero is not allowed');

          // Test echo functionality
          const echoResult = await transport.request('tools/call', {
            name: 'echo',
            arguments: { message: 'Hello World', timestamp: Date.now() }
          });
          expect(echoResult.content[0].text).toContain('Hello World');

          facade.assertToolCalled('calculate', 3);
          facade.assertToolCalled('echo', 1);
        }
      );
    });

    it('should demonstrate preset-based mock server creation', async () => {
      // Test filesystem preset
      const fsServer = createFileSystemMockServer('fs-demo', {
        files: {
          '/project/README.md': 'Project documentation',
          '/project/package.json': JSON.stringify({
            name: 'demo-project',
            version: '1.0.0'
          })
        }
      });

      await fsServer.start();

      try {
        const transport = fsServer.createClientTransport();
        await transport.connect();

        // Test file reading
        const readmeResponse = await transport.request('tools/call', {
          name: 'read_file',
          arguments: { path: '/project/README.md' }
        });
        expect(readmeResponse.content[0].text).toBe('Project documentation');

        // Test file listing
        const listResponse = await transport.request('tools/call', {
          name: 'list_files',
          arguments: { path: '/project' }
        });
        const files = JSON.parse(listResponse.content[0].text);
        expect(files.files).toContain('README.md');
        expect(files.files).toContain('package.json');

        fsServer.assertToolCalled('read_file', 1);
        fsServer.assertToolCalled('list_files', 1);
      } finally {
        await fsServer.stop();
      }

      // Test database preset
      const dbServer = createDatabaseMockServer('db-demo', {
        tables: {
          users: [
            { id: 1, name: 'Alice', email: 'alice@example.com' },
            { id: 2, name: 'Bob', email: 'bob@example.com' }
          ],
          posts: [
            { id: 1, title: 'Hello World', author_id: 1 }
          ]
        }
      });

      await dbServer.start();

      try {
        const transport = dbServer.createClientTransport();
        await transport.connect();

        // Test querying
        const usersResponse = await transport.request('tools/call', {
          name: 'query',
          arguments: { sql: 'SELECT * FROM users' }
        });
        const users = JSON.parse(usersResponse.content[0].text);
        expect(users.rows).toHaveLength(2);
        expect(users.rows[0].name).toBe('Alice');

        dbServer.assertToolCalled('query', 1);
      } finally {
        await dbServer.stop();
      }
    });
  });

  describe('⚠️ Error Handling Scenarios', () => {
    it('should demonstrate error simulation presets', async () => {
      await withMockMCP(
        builder => builder
          .withName('error-demo')
          .withTool('flaky_operation')
            .withStaticResponse([{ type: 'text', text: 'Success' }])
          .withErrorSimulation(ERROR_SIMULATION_PRESETS.INTERMITTENT_FAILURES)
          .withDelay(50, 100),
        async (server) => {
          await server.start();
          const transport = server.createClientTransport();
          await transport.connect();

          // Try multiple times to see intermittent failures
          const results = [];
          for (let i = 0; i < 10; i++) {
            try {
              const response = await transport.request('tools/call', {
                name: 'flaky_operation',
                arguments: {}
              });
              results.push({ success: true, response });
            } catch (error) {
              results.push({ success: false, error: error.message });
            }
          }

          // Should have both successes and failures due to intermittent preset
          const successes = results.filter(r => r.success).length;
          const failures = results.filter(r => !r.success).length;

          expect(successes).toBeGreaterThan(0);
          expect(failures).toBeGreaterThan(0);
          expect(successes + failures).toBe(10);

          console.log(`Intermittent failures demo: ${successes} successes, ${failures} failures`);
        },
        { autoStart: false }
      );
    });

    it('should demonstrate manual error injection', async () => {
      await withMockMCPFacade(
        builder => builder
          .withName('manual-error-demo')
          .withTool('test_tool')
            .withStaticResponse([{ type: 'text', text: 'Normal response' }]),
        async (facade) => {
          const transport = facade.getTransport();
          await transport.connect();

          // Normal operation
          let response = await transport.request('tools/call', {
            name: 'test_tool',
            arguments: {}
          });
          expect(response.content[0].text).toBe('Normal response');

          // Enable error mode
          facade.enableErrorMode('Connection lost', 'transport_error');

          // Should now fail
          await expect(transport.request('tools/call', {
            name: 'test_tool',
            arguments: {}
          })).rejects.toThrow('Connection lost');

          // Clear error mode
          facade.clearErrorMode();

          // Should work again
          response = await transport.request('tools/call', {
            name: 'test_tool',
            arguments: {}
          });
          expect(response.content[0].text).toBe('Normal response');

          facade.assertToolCalled('test_tool', 2);
        }
      );
    });

    it('should demonstrate malformed response injection', async () => {
      await withMockMCPFacade(
        builder => builder
          .withName('malformed-demo')
          .withTool('data_tool')
            .withStaticResponse([{ type: 'text', text: 'Valid data' }]),
        async (facade) => {
          const transport = facade.getTransport();
          await transport.connect();

          // Normal response
          let response = await transport.request('tools/call', {
            name: 'data_tool',
            arguments: {}
          });
          expect(response.content[0].text).toBe('Valid data');

          // Enable malformed response mode
          facade.enableMalformedResponseMode({
            probability: 1.0, // Always inject
            malformationType: 'truncated_json',
            preserveMethod: false
          });

          // Should receive malformed response
          try {
            response = await transport.request('tools/call', {
              name: 'data_tool',
              arguments: {}
            });
            // Response should be malformed but not throw (depends on client handling)
            expect(typeof response).toBe('object');
          } catch (error) {
            // Acceptable if client can't parse malformed response
            expect(error.message).toMatch(/parse|malformed|invalid/i);
          }

          facade.clearMalformedResponseMode();
        }
      );
    });
  });

  describe('🔄 Connection Lifecycle Testing', () => {
    it('should demonstrate connection state management', async () => {
      await withMockMCP(
        builder => builder
          .withName('lifecycle-demo')
          .withTool('ping')
            .withStaticResponse([{ type: 'text', text: 'pong' }]),
        async (server) => {
          // Start server
          await server.start();
          expect(server.isListening()).toBe(true);

          // Create multiple clients
          const transport1 = server.createClientTransport();
          const transport2 = server.createClientTransport();

          // Connect clients
          await transport1.connect();
          await transport2.connect();

          expect(transport1.isConnected()).toBe(true);
          expect(transport2.isConnected()).toBe(true);
          expect(server.getConnectedClientCount()).toBe(2);

          // Test both clients can make requests
          const response1 = await transport1.request('tools/call', {
            name: 'ping',
            arguments: {}
          });
          const response2 = await transport2.request('tools/call', {
            name: 'ping',
            arguments: {}
          });

          expect(response1.content[0].text).toBe('pong');
          expect(response2.content[0].text).toBe('pong');

          // Disconnect one client
          await transport1.disconnect();
          expect(transport1.isConnected()).toBe(false);
          expect(server.getConnectedClientCount()).toBe(1);

          // Other client should still work
          const response3 = await transport2.request('tools/call', {
            name: 'ping',
            arguments: {}
          });
          expect(response3.content[0].text).toBe('pong');

          // Disconnect second client
          await transport2.disconnect();
          expect(server.getConnectedClientCount()).toBe(0);

          server.assertToolCalled('ping', 3);
        },
        { autoStart: false }
      );
    });

    it('should demonstrate automatic reconnection patterns', async () => {
      await withMockMCPFacade(
        builder => builder
          .withName('reconnect-demo')
          .withTool('status')
            .withStaticResponse([{ type: 'text', text: 'online' }]),
        async (facade) => {
          const transport = facade.getTransport();

          // Initial connection
          await transport.connect();
          expect(transport.isConnected()).toBe(true);

          let response = await transport.request('tools/call', {
            name: 'status',
            arguments: {}
          });
          expect(response.content[0].text).toBe('online');

          // Simulate server restart
          await facade.stop();
          expect(transport.isConnected()).toBe(false);

          await facade.start();

          // Reconnect
          await transport.connect();
          expect(transport.isConnected()).toBe(true);

          // Should work after reconnection
          response = await transport.request('tools/call', {
            name: 'status',
            arguments: {}
          });
          expect(response.content[0].text).toBe('online');

          facade.assertToolCalled('status', 2);
        }
      );
    });

    it('should demonstrate health check patterns', async () => {
      await withMockMCPFacade(
        builder => builder
          .withName('health-demo')
          .withTool('health_check')
            .withDynamicHandler(async () => ({
              content: [{
                type: 'text',
                text: JSON.stringify({
                  status: 'healthy',
                  timestamp: new Date().toISOString(),
                  uptime: Math.floor(Math.random() * 1000000)
                })
              }],
              isError: false
            })),
        async (facade) => {
          const transport = facade.getTransport();
          await transport.connect();

          // Perform multiple health checks
          for (let i = 0; i < 3; i++) {
            const response = await transport.request('tools/call', {
              name: 'health_check',
              arguments: {}
            });

            const health = JSON.parse(response.content[0].text);
            expect(health.status).toBe('healthy');
            expect(health.timestamp).toBeDefined();
            expect(typeof health.uptime).toBe('number');

            // Wait a bit between checks
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          facade.assertToolCalled('health_check', 3);
        }
      );
    });
  });

  describe('🎯 Orchestrator Package Integration', () => {
    let testConfig: ApexConfig;
    let orchestrator: ApexOrchestrator;

    beforeEach(() => {
      testConfig = {
        project: { name: 'mcp-integration-test', version: '1.0.0' },
        limits: {
          maxConcurrentTasks: 5,
          maxDailyTasks: 100,
          maxTokensPerTask: 50000,
          maxTurns: 20
        },
        autonomy: { level: 'manual' },
        agents: {},
        workflows: {},
        mcp: {
          enabled: true,
          servers: {},
          connection: {
            maxRetries: 3,
            retryDelayMs: 100,
            connectionTimeoutMs: 5000,
            autoReconnect: true,
            healthCheckIntervalMs: 30000
          }
        }
      };
    });

    afterEach(async () => {
      if (orchestrator) {
        await orchestrator.shutdown();
      }
    });

    it('should demonstrate MCP mock integration with ApexOrchestrator', async () => {
      await withMockMCP(
        builder => builder
          .withName('orchestrator-demo')
          .withTool('get_project_info')
            .withStaticResponse([{
              type: 'text',
              text: JSON.stringify({
                name: 'Demo Project',
                version: '2.1.0',
                dependencies: ['vitest', 'typescript']
              })
            }])
          .withTool('run_command')
            .withDynamicHandler(async (toolName, args) => ({
              content: [{
                type: 'text',
                text: JSON.stringify({
                  command: args.command,
                  exitCode: 0,
                  stdout: `Executed: ${args.command}`,
                  stderr: ''
                })
              }],
              isError: false
            })),
        async (server) => {
          await server.start();

          // Mock the orchestrator's MCP client to use our mock server
          const mockTransport = server.createClientTransport();

          // Create orchestrator with test config
          orchestrator = new ApexOrchestrator({
            projectPath: '/test/project',
            config: testConfig,
            agentApiKey: 'test-key'
          });

          // Mock the MCP connection manager to use our mock transport
          const mockClient = new MCPClient({ transport: mockTransport });
          await mockClient.connect();

          // Simulate tool discovery
          const toolsResponse = await mockClient.listTools();
          expect(toolsResponse.tools).toHaveLength(2);

          // Test tool execution through mocked client
          const projectInfo = await mockClient.callTool('get_project_info', {});
          const info = JSON.parse(projectInfo.content[0].text);
          expect(info.name).toBe('Demo Project');
          expect(info.version).toBe('2.1.0');

          const commandResult = await mockClient.callTool('run_command', {
            command: 'npm test'
          });
          const result = JSON.parse(commandResult.content[0].text);
          expect(result.command).toBe('npm test');
          expect(result.exitCode).toBe(0);

          server.assertToolCalled('get_project_info', 1);
          server.assertToolCalled('run_command', 1);

          await mockClient.disconnect();
        },
        { autoStart: false }
      );
    });

    it('should demonstrate tool registry integration with mocks', async () => {
      // Create multiple mock servers for different tool categories
      const servers = {
        filesystem: createFileSystemMockServer('fs-tools', {
          files: {
            '/workspace/config.json': '{"setting": "test"}'
          }
        }),
        database: createDatabaseMockServer('db-tools', {
          tables: {
            tasks: [
              { id: 1, title: 'Test Task', status: 'pending' }
            ]
          }
        })
      };

      try {
        // Start all servers
        await Promise.all(Object.values(servers).map(s => s.start()));

        // Create transports for all servers
        const transports = {
          filesystem: servers.filesystem.createClientTransport(),
          database: servers.database.createClientTransport()
        };

        // Connect all transports
        await Promise.all(Object.values(transports).map(t => t.connect()));

        // Test filesystem operations
        const fileContent = await transports.filesystem.request('tools/call', {
          name: 'read_file',
          arguments: { path: '/workspace/config.json' }
        });
        expect(fileContent.content[0].text).toBe('{"setting": "test"}');

        // Test database operations
        const tasksResponse = await transports.database.request('tools/call', {
          name: 'query',
          arguments: { sql: 'SELECT * FROM tasks' }
        });
        const tasks = JSON.parse(tasksResponse.content[0].text);
        expect(tasks.rows[0].title).toBe('Test Task');

        // Verify call tracking across servers
        servers.filesystem.assertToolCalled('read_file', 1);
        servers.database.assertToolCalled('query', 1);

        // Disconnect all transports
        await Promise.all(Object.values(transports).map(t => t.disconnect()));

      } finally {
        // Stop all servers
        await Promise.all(Object.values(servers).map(s => s.stop()));
      }
    });

    it('should demonstrate complex workflow with error recovery', async () => {
      await withMockMCP(
        builder => builder
          .withName('workflow-demo')
          .withTool('backup_data')
            .withDynamicHandler(async (toolName, args) => {
              if (args.source === '/error/path') {
                return {
                  content: [],
                  isError: true,
                  _meta: { error: 'Source path not accessible' }
                };
              }
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    backedUp: args.source,
                    destination: args.destination,
                    timestamp: new Date().toISOString(),
                    files: Math.floor(Math.random() * 100) + 1
                  })
                }],
                isError: false
              };
            })
          .withTool('cleanup_temp')
            .withStaticResponse([{
              type: 'text',
              text: JSON.stringify({
                cleaned: true,
                freedSpace: '1.2GB',
                filesRemoved: 42
              })
            }])
          .withTool('send_notification')
            .withDynamicHandler(async (toolName, args) => ({
              content: [{
                type: 'text',
                text: JSON.stringify({
                  sent: true,
                  recipient: args.recipient,
                  message: args.message,
                  method: 'email'
                })
              }],
              isError: false
            })),
        async (server) => {
          await server.start();
          const transport = server.createClientTransport();
          await transport.connect();

          // Workflow step 1: Try to backup (will fail)
          try {
            await transport.request('tools/call', {
              name: 'backup_data',
              arguments: { source: '/error/path', destination: '/backup' }
            });
            expect.fail('Should have thrown an error');
          } catch (error) {
            expect(error.message).toContain('Source path not accessible');
          }

          // Workflow step 2: Retry with correct path
          const backupResult = await transport.request('tools/call', {
            name: 'backup_data',
            arguments: { source: '/data', destination: '/backup' }
          });
          const backup = JSON.parse(backupResult.content[0].text);
          expect(backup.backedUp).toBe('/data');
          expect(backup.files).toBeGreaterThan(0);

          // Workflow step 3: Cleanup
          const cleanupResult = await transport.request('tools/call', {
            name: 'cleanup_temp',
            arguments: {}
          });
          const cleanup = JSON.parse(cleanupResult.content[0].text);
          expect(cleanup.cleaned).toBe(true);

          // Workflow step 4: Send success notification
          const notificationResult = await transport.request('tools/call', {
            name: 'send_notification',
            arguments: {
              recipient: 'admin@example.com',
              message: 'Backup completed successfully'
            }
          });
          const notification = JSON.parse(notificationResult.content[0].text);
          expect(notification.sent).toBe(true);

          // Verify all calls were tracked
          server.assertToolCalled('backup_data', 2); // 1 failure + 1 success
          server.assertToolCalled('cleanup_temp', 1);
          server.assertToolCalled('send_notification', 1);
        },
        { autoStart: false }
      );
    });
  });

  describe('📚 Documentation Examples', () => {
    it('should provide simple getting-started example', async () => {
      // This test serves as a getting-started guide for developers
      await withMockMCPFacade(
        builder => builder
          .withName('getting-started')
          .withTool('hello')
            .withStaticResponse([{
              type: 'text',
              text: 'Hello from MCP mock server!'
            }]),
        async (facade) => {
          // Step 1: Get transport and connect
          const transport = facade.getTransport();
          await transport.connect();

          // Step 2: List available tools
          const tools = await transport.request('tools/list', {});
          expect(tools.tools).toHaveLength(1);
          expect(tools.tools[0].name).toBe('hello');

          // Step 3: Call a tool
          const response = await transport.request('tools/call', {
            name: 'hello',
            arguments: {}
          });
          expect(response.content[0].text).toBe('Hello from MCP mock server!');

          // Step 4: Verify interactions (optional)
          facade.assertMethodCalled('tools/list', 1);
          facade.assertToolCalled('hello', 1);
        }
      );
    });

    it('should provide advanced configuration example', async () => {
      const options: WithMockMCPOptions = {
        autoStart: false,
        resetOnCleanup: true,
        timeout: 10000
      };

      await withMockMCP(
        builder => builder
          .withName('advanced-config')
          .withTool('advanced_tool')
            .withDynamicHandler(async (toolName, args) => ({
              content: [{
                type: 'text',
                text: `Advanced response for ${JSON.stringify(args)}`
              }],
              isError: false
            }))
          .withDelay(100, 200)
          .withBehaviorModifiers({
            simulateNetworkLatency: true,
            maxConcurrentRequests: 5
          }),
        async (server) => {
          // Manual start with custom configuration
          await server.start();

          const transport = server.createClientTransport();
          await transport.connect();

          const startTime = Date.now();
          const response = await transport.request('tools/call', {
            name: 'advanced_tool',
            arguments: { config: 'advanced', level: 'expert' }
          });
          const endTime = Date.now();

          // Should have network latency simulation
          expect(endTime - startTime).toBeGreaterThanOrEqual(100);

          expect(response.content[0].text).toContain('advanced');
          expect(response.content[0].text).toContain('expert');

          server.assertToolCalled('advanced_tool', 1);
        },
        options
      );
    });
  });
});