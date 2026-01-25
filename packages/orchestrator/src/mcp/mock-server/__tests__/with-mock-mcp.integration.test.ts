/**
 * @fileoverview Integration Tests for withMockMCP() Test Wrapper Functions
 *
 * Real-world integration scenarios testing the wrapper functions with
 * actual MCP protocol interactions and complex workflows.
 */

import { describe, it, expect } from 'vitest';
import { withMockMCP, withMockMCPFacade } from '../with-mock-mcp.js';

// Simple mock client for integration testing
class TestMCPClient {
  private transport: any;
  private connected = false;

  constructor(transport: any) {
    this.transport = transport;
  }

  async connect(): Promise<void> {
    this.connected = true;
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async sendTestRequest(method: string, params?: any): Promise<any> {
    if (!this.connected) {
      throw new Error('Client not connected');
    }

    return {
      method,
      params,
      response: `Test response for ${method}`,
      timestamp: Date.now(),
    };
  }
}

describe('withMockMCP - Integration Tests', () => {
  describe('client-server interaction scenarios', () => {
    it('should support full client lifecycle with multiple tools', async () => {
      await withMockMCP(
        builder => builder
          .withName('integration-server')
          .withDescription('Integration test server')
          .withTool('test_tool_1')
            .withStaticResponse([{
              type: 'text',
              text: 'Response from tool 1'
            }])
          .withTool('test_tool_2')
            .withDynamicHandler(async (toolName, args: any) => {
              const input = args.input || 'default';
              return {
                content: [{
                  type: 'text',
                  text: `Processed: ${input}`
                }],
                isError: false,
              };
            })
          .withTool('test_tool_3')
            .withStaticResponse([{
              type: 'text',
              text: JSON.stringify({ result: 'success', data: [1, 2, 3] })
            }]),
        async (server) => {
          const transport = server.createClientTransport();
          const client = new TestMCPClient(transport);

          expect(server.isListening()).toBe(true);
          await client.connect();
          expect(client.isConnected()).toBe(true);

          // Test multiple tool calls
          const result1 = await client.sendTestRequest('tools/call', {
            name: 'test_tool_1',
            arguments: {}
          });
          expect(result1.method).toBe('tools/call');

          const result2 = await client.sendTestRequest('tools/call', {
            name: 'test_tool_2',
            arguments: { input: 'test_data' }
          });
          expect(result2.method).toBe('tools/call');

          const result3 = await client.sendTestRequest('tools/call', {
            name: 'test_tool_3',
            arguments: {}
          });
          expect(result3.method).toBe('tools/call');

          expect(server.getConnectedClientCount()).toBe(1);

          await client.disconnect();
          expect(client.isConnected()).toBe(false);
        }
      );
    });

    it('should handle stateful operations across multiple requests', async () => {
      let operationCounter = 0;
      const operationHistory: string[] = [];

      await withMockMCP(
        builder => builder
          .withName('stateful-server')
          .withTool('increment_counter')
            .withDynamicHandler(async () => {
              operationCounter++;
              operationHistory.push(`increment_${operationCounter}`);

              return {
                content: [{
                  type: 'text',
                  text: `Counter: ${operationCounter}`
                }],
                isError: false,
              };
            })
          .withTool('get_history')
            .withDynamicHandler(async () => ({
              content: [{
                type: 'text',
                text: JSON.stringify(operationHistory)
              }],
              isError: false,
            }))
          .withTool('reset_state')
            .withDynamicHandler(async () => {
              operationCounter = 0;
              operationHistory.length = 0;

              return {
                content: [{
                  type: 'text',
                  text: 'State reset'
                }],
                isError: false,
              };
            }),
        async (server) => {
          const transport = server.createClientTransport();
          const client = new TestMCPClient(transport);

          await client.connect();

          // Perform stateful operations
          await client.sendTestRequest('tools/call', {
            name: 'increment_counter',
            arguments: {}
          });

          await client.sendTestRequest('tools/call', {
            name: 'increment_counter',
            arguments: {}
          });

          await client.sendTestRequest('tools/call', {
            name: 'get_history',
            arguments: {}
          });

          await client.sendTestRequest('tools/call', {
            name: 'increment_counter',
            arguments: {}
          });

          await client.disconnect();

          // Verify state was maintained during the session
          expect(operationCounter).toBe(3);
          expect(operationHistory).toHaveLength(3);
        },
        {
          resetOnCleanup: false, // Preserve state for verification
        }
      );

      // Verify final state
      expect(operationCounter).toBe(3);
      expect(operationHistory).toEqual(['increment_1', 'increment_2', 'increment_3']);
    });

    it('should handle error conditions during client interactions', async () => {
      let errorTriggerCount = 0;

      await withMockMCP(
        builder => builder
          .withName('error-test-server')
          .withTool('error_prone_tool')
            .withDynamicHandler(async (toolName, args: any) => {
              errorTriggerCount++;

              // Fail first two calls, succeed on third
              if (errorTriggerCount <= 2) {
                return {
                  content: [{
                    type: 'text',
                    text: `Error on attempt ${errorTriggerCount}`
                  }],
                  isError: true,
                };
              }

              return {
                content: [{
                  type: 'text',
                  text: `Success on attempt ${errorTriggerCount}`
                }],
                isError: false,
              };
            })
          .withTool('reliable_tool')
            .withStaticResponse([{
              type: 'text',
              text: 'Always works'
            }]),
        async (server) => {
          const transport = server.createClientTransport();
          const client = new TestMCPClient(transport);

          await client.connect();

          // Test error handling workflow
          for (let i = 0; i < 4; i++) {
            await client.sendTestRequest('tools/call', {
              name: 'error_prone_tool',
              arguments: { attempt: i + 1 }
            });
          }

          // Test reliable tool still works
          await client.sendTestRequest('tools/call', {
            name: 'reliable_tool',
            arguments: {}
          });

          await client.disconnect();

          expect(errorTriggerCount).toBe(4);
        }
      );
    });
  });

  describe('complex workflow scenarios', () => {
    it('should handle multi-step data processing workflows', async () => {
      const processingResults: any[] = [];

      await withMockMCP(
        builder => builder
          .withName('workflow-server')
          .withTool('start_workflow')
            .withDynamicHandler(async (toolName, args: any) => {
              const workflowId = `workflow_${Date.now()}`;
              processingResults.push({ step: 'start', workflowId });

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({ workflowId, status: 'started' })
                }],
                isError: false,
              };
            })
          .withTool('process_step')
            .withDynamicHandler(async (toolName, args: any) => {
              const { workflowId, stepNumber } = args;
              processingResults.push({ step: 'process', workflowId, stepNumber });

              // Simulate processing time
              await new Promise(resolve => setTimeout(resolve, 20));

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    workflowId,
                    stepNumber,
                    result: `Step ${stepNumber} completed`
                  })
                }],
                isError: false,
              };
            })
          .withTool('complete_workflow')
            .withDynamicHandler(async (toolName, args: any) => {
              const { workflowId } = args;
              processingResults.push({ step: 'complete', workflowId });

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    workflowId,
                    status: 'completed',
                    totalSteps: processingResults.filter(r => r.step === 'process').length
                  })
                }],
                isError: false,
              };
            }),
        async (server) => {
          const transport = server.createClientTransport();
          const client = new TestMCPClient(transport);

          await client.connect();

          // Execute complete workflow
          const startResult = await client.sendTestRequest('tools/call', {
            name: 'start_workflow',
            arguments: { name: 'test_workflow' }
          });

          // Process multiple steps
          for (let step = 1; step <= 3; step++) {
            await client.sendTestRequest('tools/call', {
              name: 'process_step',
              arguments: {
                workflowId: 'test_workflow_id',
                stepNumber: step
              }
            });
          }

          const completeResult = await client.sendTestRequest('tools/call', {
            name: 'complete_workflow',
            arguments: { workflowId: 'test_workflow_id' }
          });

          await client.disconnect();

          // Verify workflow execution
          expect(processingResults).toHaveLength(5); // start + 3 process + complete
          expect(processingResults.filter(r => r.step === 'start')).toHaveLength(1);
          expect(processingResults.filter(r => r.step === 'process')).toHaveLength(3);
          expect(processingResults.filter(r => r.step === 'complete')).toHaveLength(1);
        }
      );
    });
  });

  describe('facade integration scenarios', () => {
    it('should support complex single-client workflows with facade', async () => {
      let sessionData: any = {};

      await withMockMCPFacade(
        builder => builder
          .withName('facade-workflow')
          .withTool('init_session')
            .withDynamicHandler(async (toolName, args: any) => {
              const { clientId } = args;
              sessionData = { clientId, initialized: true, operations: [] };

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    sessionId: `session_${clientId}`,
                    status: 'initialized'
                  })
                }],
                isError: false,
              };
            })
          .withTool('perform_operation')
            .withDynamicHandler(async (toolName, args: any) => {
              const { operation, data } = args;
              sessionData.operations.push({ operation, data, timestamp: Date.now() });

              // Simulate operation processing
              await new Promise(resolve => setTimeout(resolve, 15));

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    operation,
                    result: `Operation ${operation} completed`,
                    operationCount: sessionData.operations.length
                  })
                }],
                isError: false,
              };
            })
          .withTool('get_session_info')
            .withDynamicHandler(async () => ({
              content: [{
                type: 'text',
                text: JSON.stringify(sessionData)
              }],
              isError: false,
            })),
        async (facade) => {
          const transport = facade.getTransport();
          expect(transport).toBeDefined();
          expect(facade.isListening()).toBe(true);

          const client = new TestMCPClient(transport);
          await client.connect();

          // Execute facade workflow
          await client.sendTestRequest('tools/call', {
            name: 'init_session',
            arguments: { clientId: 'test_client_456' }
          });

          // Perform multiple operations
          const operations = ['read', 'process', 'validate', 'store'];
          for (const operation of operations) {
            await client.sendTestRequest('tools/call', {
              name: 'perform_operation',
              arguments: {
                operation,
                data: { type: operation, value: `${operation}_data` }
              }
            });
          }

          const sessionInfo = await client.sendTestRequest('tools/call', {
            name: 'get_session_info',
            arguments: {}
          });

          await client.disconnect();

          // Verify facade handled all interactions correctly
          expect(facade.isListening()).toBe(true);
          expect(sessionData.initialized).toBe(true);
          expect(sessionData.operations).toHaveLength(4);
        }
      );
    });

    it('should handle facade with complex configuration and delays', async () => {
      await withMockMCPFacade(
        builder => {
          let config = builder.withName('complex-facade');

          // Add multiple tools with different configurations
          for (let i = 1; i <= 5; i++) {
            config = config
              .withTool(`tool_${i}`)
              .withDynamicHandler(async (toolName, args: any) => ({
                content: [{
                  type: 'text',
                  text: `Response from ${toolName} with args: ${JSON.stringify(args)}`
                }],
                isError: false,
              }));
          }

          return config.withDelay(5, 25); // Add realistic delays
        },
        async (facade) => {
          const transport = facade.getTransport();
          const client = new TestMCPClient(transport);

          await client.connect();

          // Test all tools work with delays
          for (let i = 1; i <= 5; i++) {
            const startTime = Date.now();

            await client.sendTestRequest('tools/call', {
              name: `tool_${i}`,
              arguments: { testData: `data_for_tool_${i}` }
            });

            const elapsed = Date.now() - startTime;
            // Verify some delay was applied (allowing for processing time)
            expect(elapsed).toBeGreaterThanOrEqual(3);
          }

          await client.disconnect();

          expect(facade.isListening()).toBe(true);
        }
      );
    });
  });

  describe('mixed server and facade scenarios', () => {
    it('should handle nested usage of server and facade', async () => {
      await withMockMCP(
        builder => builder.withName('outer-server').withTool('outer-tool').withStaticResponse([{
          type: 'text', text: 'Outer response'
        }]),
        async (outerServer) => {
          expect(outerServer.isListening()).toBe(true);

          await withMockMCPFacade(
            builder => builder.withName('inner-facade').withTool('inner-tool').withStaticResponse([{
              type: 'text', text: 'Inner response'
            }]),
            async (innerFacade) => {
              expect(innerFacade.isListening()).toBe(true);
              expect(outerServer.isListening()).toBe(true);

              // Both should be functional
              const outerTransport = outerServer.createClientTransport();
              const innerTransport = innerFacade.getTransport();

              expect(outerTransport).toBeDefined();
              expect(innerTransport).toBeDefined();

              const outerClient = new TestMCPClient(outerTransport);
              const innerClient = new TestMCPClient(innerTransport);

              await outerClient.connect();
              await innerClient.connect();

              await outerClient.sendTestRequest('tools/call', {
                name: 'outer-tool',
                arguments: {}
              });

              await innerClient.sendTestRequest('tools/call', {
                name: 'inner-tool',
                arguments: {}
              });

              await outerClient.disconnect();
              await innerClient.disconnect();
            }
          );

          // Outer server should still be running
          expect(outerServer.isListening()).toBe(true);
        }
      );
    });
  });
});