/**
 * MCP Orchestrator Mock Integration Tests
 *
 * Focused integration tests demonstrating MCP mock usage specifically
 * with the ApexOrchestrator package. Shows real-world patterns for:
 * 1. Orchestrator initialization with mock MCP servers
 * 2. Tool discovery and registry integration
 * 3. Task execution with mocked MCP tools
 * 4. Error handling and resilience patterns
 *
 * These tests demonstrate the recommended patterns for testing
 * orchestrator functionality with MCP mocks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ApexOrchestrator,
  MCPConnectionManager,
  MCPToolRegistry,
  MCPClient
} from '@apexcli/orchestrator';
import {
  withMockMCP,
  withMockMCPFacade,
  createMockMCPServer,
  MockMCPServerBuilder
} from '@apexcli/orchestrator/mcp/mock-server';
import type { ApexConfig, Task } from '@apexcli/core';

describe('🎯 MCP Orchestrator Mock Integration', () => {
  let testConfig: ApexConfig;
  let orchestrator: ApexOrchestrator;
  let connectionManager: MCPConnectionManager;
  let toolRegistry: MCPToolRegistry;

  beforeEach(() => {
    testConfig = {
      project: { name: 'orchestrator-mock-test', version: '1.0.0' },
      limits: {
        maxConcurrentTasks: 5,
        maxDailyTasks: 50,
        maxTokensPerTask: 100000,
        maxTurns: 15
      },
      autonomy: { level: 'manual' },
      agents: {},
      workflows: {},
      mcp: {
        enabled: true,
        servers: {
          'test-server': {
            name: 'Test MCP Server',
            type: 'stdio',
            command: 'test-mcp-server',
            args: []
          }
        },
        connection: {
          maxRetries: 3,
          retryDelayMs: 100,
          connectionTimeoutMs: 5000,
          autoReconnect: true,
          healthCheckIntervalMs: 30000
        }
      }
    };

    connectionManager = new MCPConnectionManager({
      projectPath: '/test/project',
      config: testConfig
    });

    toolRegistry = new MCPToolRegistry({
      autoRefresh: false,
      operationTimeoutMs: 5000
    });

    toolRegistry.setConnectionManager(connectionManager);
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    if (connectionManager) {
      await connectionManager.disconnectAll();
    }
    if (toolRegistry) {
      toolRegistry.shutdown();
    }
  });

  describe('🔧 Tool Discovery and Registry Integration', () => {
    it('should integrate mock servers with orchestrator tool discovery', async () => {
      await withMockMCP(
        builder => builder
          .withName('discovery-test')
          .withTool('file_processor')
            .withDynamicHandler(async (toolName, args) => ({
              content: [{
                type: 'text',
                text: JSON.stringify({
                  processed: args.filepath,
                  lines: Math.floor(Math.random() * 100) + 1,
                  words: Math.floor(Math.random() * 500) + 1,
                  timestamp: new Date().toISOString()
                })
              }],
              isError: false
            }))
          .withTool('data_validator')
            .withDynamicHandler(async (toolName, args) => {
              const isValid = args.data && typeof args.data === 'object';
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    valid: isValid,
                    errors: isValid ? [] : ['Invalid data format'],
                    checkedFields: Object.keys(args.data || {})
                  })
                }],
                isError: false
              };
            }),
        async (server) => {
          await server.start();

          // Mock the connection manager to use our test server
          const transport = server.createClientTransport();
          const mockConnection = {
            id: 'test-server',
            name: 'Test MCP Server',
            state: 'connected' as const,
            transport,
            lastPing: Date.now(),
            client: {
              connect: vi.fn().mockResolvedValue(undefined),
              disconnect: vi.fn().mockResolvedValue(undefined),
              listTools: vi.fn().mockImplementation(async () => {
                const response = await transport.request('tools/list', {});
                return response;
              }),
              callTool: vi.fn().mockImplementation(async (name: string, args: any) => {
                const response = await transport.request('tools/call', { name, arguments: args });
                return response;
              }),
              on: vi.fn(),
              off: vi.fn()
            },
            metadata: {
              version: '1.0.0',
              capabilities: ['tools'],
              serverInfo: { name: 'Test Server', version: '1.0.0' }
            }
          };

          await transport.connect();

          // Add the mock connection to the tool registry
          await toolRegistry.addConnection(mockConnection);

          // Verify tools were discovered
          const discoveredTools = toolRegistry.getToolsByConnection('test-server');
          expect(discoveredTools).toHaveLength(2);

          const toolNames = discoveredTools.map(t => t.mcpTool.name);
          expect(toolNames).toContain('file_processor');
          expect(toolNames).toContain('data_validator');

          // Test tool execution through registry
          const fileProcessorTool = toolRegistry.getTool('file_processor');
          expect(fileProcessorTool).toBeDefined();

          const validatorTool = toolRegistry.getTool('data_validator');
          expect(validatorTool).toBeDefined();

          // Verify tool availability
          expect(toolRegistry.isToolAvailable('file_processor')).toBe(true);
          expect(toolRegistry.isToolAvailable('data_validator')).toBe(true);

          // Test execution through connection manager
          const processorResult = await connectionManager.executeTool(
            'test-server',
            'file_processor',
            { filepath: '/test/document.txt' }
          );

          const result = JSON.parse(processorResult.content[0].text);
          expect(result.processed).toBe('/test/document.txt');
          expect(result.lines).toBeGreaterThan(0);
          expect(result.words).toBeGreaterThan(0);

          const validatorResult = await connectionManager.executeTool(
            'test-server',
            'data_validator',
            { data: { name: 'test', value: 42 } }
          );

          const validation = JSON.parse(validatorResult.content[0].text);
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
          expect(validation.checkedFields).toEqual(['name', 'value']);

          server.assertToolCalled('file_processor', 1);
          server.assertToolCalled('data_validator', 1);

          await transport.disconnect();
        },
        { autoStart: false }
      );
    });

    it('should handle tool registry updates with connection state changes', async () => {
      await withMockMCPFacade(
        builder => builder
          .withName('state-test')
          .withTool('status_check')
            .withStaticResponse([{
              type: 'text',
              text: JSON.stringify({ status: 'operational', uptime: 12345 })
            }]),
        async (facade) => {
          const transport = facade.getTransport();

          // Create mock connection
          const mockConnection = {
            id: 'state-test',
            name: 'State Test Server',
            state: 'connected' as const,
            transport,
            lastPing: Date.now(),
            client: {
              connect: vi.fn().mockResolvedValue(undefined),
              disconnect: vi.fn().mockResolvedValue(undefined),
              listTools: vi.fn().mockImplementation(async () => {
                const response = await transport.request('tools/list', {});
                return response;
              }),
              callTool: vi.fn().mockImplementation(async (name: string, args: any) => {
                const response = await transport.request('tools/call', { name, arguments: args });
                return response;
              }),
              on: vi.fn(),
              off: vi.fn()
            },
            metadata: {
              version: '1.0.0',
              capabilities: ['tools'],
              serverInfo: { name: 'State Test Server', version: '1.0.0' }
            }
          };

          await transport.connect();
          await toolRegistry.addConnection(mockConnection);

          // Tool should be available initially
          expect(toolRegistry.isToolAvailable('status_check')).toBe(true);

          // Test tool execution
          const result = await connectionManager.executeTool(
            'state-test',
            'status_check',
            {}
          );
          const status = JSON.parse(result.content[0].text);
          expect(status.status).toBe('operational');

          // Simulate connection failure
          await transport.disconnect();
          toolRegistry.updateConnectionState('state-test', 'disconnected');

          // Tool should no longer be available
          expect(toolRegistry.isToolAvailable('status_check')).toBe(false);

          // Attempting to execute should fail
          await expect(connectionManager.executeTool(
            'state-test',
            'status_check',
            {}
          )).rejects.toThrow();

          // Reconnect
          await transport.connect();
          toolRegistry.updateConnectionState('state-test', 'connected');

          // Tool should be available again
          expect(toolRegistry.isToolAvailable('status_check')).toBe(true);

          facade.assertToolCalled('status_check', 1);
        }
      );
    });
  });

  describe('📋 Task Execution with Mocked Tools', () => {
    it('should execute tasks using mocked MCP tools', async () => {
      await withMockMCP(
        builder => builder
          .withName('task-execution')
          .withTool('analyze_code')
            .withDynamicHandler(async (toolName, args) => ({
              content: [{
                type: 'text',
                text: JSON.stringify({
                  file: args.filepath,
                  language: args.language || 'typescript',
                  issues: Math.floor(Math.random() * 5),
                  complexity: Math.floor(Math.random() * 10) + 1,
                  suggestions: [
                    'Consider adding type annotations',
                    'Extract complex expressions into variables'
                  ]
                })
              }],
              isError: false
            }))
          .withTool('generate_report')
            .withDynamicHandler(async (toolName, args) => ({
              content: [{
                type: 'text',
                text: JSON.stringify({
                  reportId: `report-${Date.now()}`,
                  format: args.format || 'markdown',
                  sections: args.sections || ['summary', 'details'],
                  generated: new Date().toISOString(),
                  size: `${Math.floor(Math.random() * 50) + 10}KB`
                })
              }],
              isError: false
            })),
        async (server) => {
          await server.start();
          const transport = server.createClientTransport();
          await transport.connect();

          // Create orchestrator instance
          orchestrator = new ApexOrchestrator({
            projectPath: '/test/project',
            config: testConfig,
            agentApiKey: 'test-key'
          });

          // Mock task definition
          const testTask: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
            type: 'feature',
            title: 'Code Analysis Task',
            description: 'Analyze code quality and generate report',
            status: 'pending',
            priority: 'medium',
            estimatedHours: 2,
            metadata: {
              workflow: 'code-analysis',
              files: ['/src/main.ts', '/src/utils.ts'],
              outputFormat: 'markdown'
            }
          };

          // Create task
          const createdTask = await orchestrator.createTask(testTask);
          expect(createdTask.id).toBeDefined();
          expect(createdTask.status).toBe('pending');

          // Mock tool calls that would happen during task execution
          const analysisResult1 = await transport.request('tools/call', {
            name: 'analyze_code',
            arguments: { filepath: '/src/main.ts', language: 'typescript' }
          });

          const analysisResult2 = await transport.request('tools/call', {
            name: 'analyze_code',
            arguments: { filepath: '/src/utils.ts', language: 'typescript' }
          });

          const reportResult = await transport.request('tools/call', {
            name: 'generate_report',
            arguments: {
              format: 'markdown',
              sections: ['summary', 'analysis', 'recommendations']
            }
          });

          // Verify results
          const analysis1 = JSON.parse(analysisResult1.content[0].text);
          expect(analysis1.file).toBe('/src/main.ts');
          expect(analysis1.language).toBe('typescript');
          expect(typeof analysis1.issues).toBe('number');

          const analysis2 = JSON.parse(analysisResult2.content[0].text);
          expect(analysis2.file).toBe('/src/utils.ts');

          const report = JSON.parse(reportResult.content[0].text);
          expect(report.reportId).toMatch(/^report-\d+$/);
          expect(report.format).toBe('markdown');
          expect(report.sections).toEqual(['summary', 'analysis', 'recommendations']);

          // Verify call tracking
          server.assertToolCalled('analyze_code', 2);
          server.assertToolCalled('generate_report', 1);

          await transport.disconnect();
        },
        { autoStart: false }
      );
    });

    it('should handle complex multi-tool workflows', async () => {
      await withMockMCP(
        builder => builder
          .withName('workflow-test')
          .withTool('fetch_data')
            .withDynamicHandler(async (toolName, args) => {
              if (args.source === 'database') {
                return {
                  content: [{
                    type: 'text',
                    text: JSON.stringify({
                      records: [
                        { id: 1, name: 'Item 1', status: 'active' },
                        { id: 2, name: 'Item 2', status: 'inactive' }
                      ],
                      count: 2
                    })
                  }],
                  isError: false
                };
              } else if (args.source === 'api') {
                return {
                  content: [{
                    type: 'text',
                    text: JSON.stringify({
                      data: { temperature: 22, humidity: 65, pressure: 1013 },
                      timestamp: new Date().toISOString()
                    })
                  }],
                  isError: false
                };
              }
              return {
                content: [],
                isError: true,
                _meta: { error: 'Unknown data source' }
              };
            })
          .withTool('process_data')
            .withDynamicHandler(async (toolName, args) => ({
              content: [{
                type: 'text',
                text: JSON.stringify({
                  processedRecords: args.records?.length || 0,
                  transformations: ['normalize', 'filter', 'aggregate'],
                  outputFormat: args.outputFormat || 'json',
                  processingTime: Math.floor(Math.random() * 1000) + 100
                })
              }],
              isError: false
            }))
          .withTool('store_results')
            .withDynamicHandler(async (toolName, args) => ({
              content: [{
                type: 'text',
                text: JSON.stringify({
                  stored: true,
                  location: args.destination || '/results/output.json',
                  fileSize: Math.floor(Math.random() * 10000) + 1000,
                  checksum: 'sha256:abcd1234...'
                })
              }],
              isError: false
            })),
        async (server) => {
          await server.start();
          const transport = server.createClientTransport();
          await transport.connect();

          // Step 1: Fetch data from database
          const dbData = await transport.request('tools/call', {
            name: 'fetch_data',
            arguments: { source: 'database', table: 'items' }
          });
          const dbResult = JSON.parse(dbData.content[0].text);
          expect(dbResult.records).toHaveLength(2);

          // Step 2: Fetch data from API
          const apiData = await transport.request('tools/call', {
            name: 'fetch_data',
            arguments: { source: 'api', endpoint: '/weather' }
          });
          const apiResult = JSON.parse(apiData.content[0].text);
          expect(apiResult.data.temperature).toBe(22);

          // Step 3: Process the combined data
          const processedData = await transport.request('tools/call', {
            name: 'process_data',
            arguments: {
              records: dbResult.records,
              weatherData: apiResult.data,
              outputFormat: 'csv'
            }
          });
          const processResult = JSON.parse(processedData.content[0].text);
          expect(processResult.processedRecords).toBe(2);
          expect(processResult.outputFormat).toBe('csv');

          // Step 4: Store results
          const storeData = await transport.request('tools/call', {
            name: 'store_results',
            arguments: {
              data: processResult,
              destination: '/results/workflow_output.csv'
            }
          });
          const storeResult = JSON.parse(storeData.content[0].text);
          expect(storeResult.stored).toBe(true);
          expect(storeResult.location).toBe('/results/workflow_output.csv');

          // Verify all steps completed successfully
          server.assertToolCalled('fetch_data', 2);
          server.assertToolCalled('process_data', 1);
          server.assertToolCalled('store_results', 1);

          await transport.disconnect();
        },
        { autoStart: false }
      );
    });
  });

  describe('⚠️ Error Handling and Resilience', () => {
    it('should handle tool execution errors gracefully', async () => {
      await withMockMCPFacade(
        builder => builder
          .withName('error-handling')
          .withTool('reliable_operation')
            .withStaticResponse([{
              type: 'text',
              text: JSON.stringify({ success: true, data: 'reliable result' })
            }])
          .withTool('unreliable_operation')
            .withDynamicHandler(async (toolName, args) => {
              // Simulate random failures
              if (Math.random() < 0.5) {
                return {
                  content: [],
                  isError: true,
                  _meta: { error: 'Random failure occurred' }
                };
              }
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({ success: true, attempt: args.attempt || 1 })
                }],
                isError: false
              };
            }),
        async (facade) => {
          const transport = facade.getTransport();
          await transport.connect();

          // Test reliable operation
          const reliableResult = await transport.request('tools/call', {
            name: 'reliable_operation',
            arguments: {}
          });
          const reliable = JSON.parse(reliableResult.content[0].text);
          expect(reliable.success).toBe(true);

          // Test unreliable operation with retry logic
          let attempts = 0;
          let success = false;
          let lastError: any;

          while (attempts < 5 && !success) {
            attempts++;
            try {
              const result = await transport.request('tools/call', {
                name: 'unreliable_operation',
                arguments: { attempt: attempts }
              });

              if (!result.isError) {
                const data = JSON.parse(result.content[0].text);
                expect(data.success).toBe(true);
                success = true;
              } else {
                lastError = result._meta?.error;
              }
            } catch (error) {
              lastError = error.message;
            }

            // Small delay between retries
            if (!success && attempts < 5) {
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }

          // Should eventually succeed or we should have error details
          if (!success) {
            expect(lastError).toBeDefined();
            console.log(`Failed after ${attempts} attempts: ${lastError}`);
          } else {
            console.log(`Succeeded after ${attempts} attempts`);
          }

          facade.assertToolCalled('reliable_operation', 1);
          facade.assertToolCalled('unreliable_operation', attempts);
        }
      );
    });

    it('should handle connection failures with recovery', async () => {
      await withMockMCP(
        builder => builder
          .withName('recovery-test')
          .withTool('persistent_data')
            .withStaticResponse([{
              type: 'text',
              text: JSON.stringify({ data: 'persistent', id: 12345 })
            }]),
        async (server) => {
          await server.start();
          const transport = server.createClientTransport();
          await transport.connect();

          // Initial successful operation
          const result1 = await transport.request('tools/call', {
            name: 'persistent_data',
            arguments: {}
          });
          expect(JSON.parse(result1.content[0].text).data).toBe('persistent');

          // Simulate server restart
          await server.stop();
          expect(server.isListening()).toBe(false);

          // Restart server
          await server.start();
          expect(server.isListening()).toBe(true);

          // Create new transport and reconnect
          const newTransport = server.createClientTransport();
          await newTransport.connect();

          // Should work after recovery
          const result2 = await newTransport.request('tools/call', {
            name: 'persistent_data',
            arguments: {}
          });
          expect(JSON.parse(result2.content[0].text).data).toBe('persistent');

          // Verify calls were tracked across sessions
          server.assertToolCalled('persistent_data', 2);

          await newTransport.disconnect();
        },
        { autoStart: false }
      );
    });
  });

  describe('📊 Performance and Monitoring', () => {
    it('should track performance metrics during tool execution', async () => {
      await withMockMCPFacade(
        builder => builder
          .withName('performance-test')
          .withTool('fast_operation')
            .withStaticResponse([{ type: 'text', text: 'fast result' }])
          .withTool('slow_operation')
            .withDynamicHandler(async () => {
              await new Promise(resolve => setTimeout(resolve, 100));
              return {
                content: [{ type: 'text', text: 'slow result' }],
                isError: false
              };
            })
          .withDelay(50, 100), // Add network simulation
        async (facade) => {
          const transport = facade.getTransport();
          await transport.connect();

          // Measure fast operation
          const fastStart = Date.now();
          const fastResult = await transport.request('tools/call', {
            name: 'fast_operation',
            arguments: {}
          });
          const fastDuration = Date.now() - fastStart;

          expect(fastResult.content[0].text).toBe('fast result');
          expect(fastDuration).toBeGreaterThanOrEqual(50); // Network delay

          // Measure slow operation
          const slowStart = Date.now();
          const slowResult = await transport.request('tools/call', {
            name: 'slow_operation',
            arguments: {}
          });
          const slowDuration = Date.now() - slowStart;

          expect(slowResult.content[0].text).toBe('slow result');
          expect(slowDuration).toBeGreaterThanOrEqual(150); // Network + processing delay

          console.log(`Fast operation: ${fastDuration}ms, Slow operation: ${slowDuration}ms`);

          // Verify monitoring capabilities
          const stats = facade.getStats();
          expect(stats.totalRequests).toBeGreaterThanOrEqual(2);
          expect(stats.toolCalls).toHaveProperty('fast_operation', 1);
          expect(stats.toolCalls).toHaveProperty('slow_operation', 1);

          facade.assertToolCalled('fast_operation', 1);
          facade.assertToolCalled('slow_operation', 1);
        }
      );
    });
  });
});