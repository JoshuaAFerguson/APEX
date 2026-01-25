/**
 * @fileoverview Integration Tests for Mock MCP Server Types
 *
 * Tests that demonstrate real-world integration scenarios and end-to-end
 * workflows using the new mock types functionality.
 *
 * @module @apex/core/mcp/mock-types.integration.test
 */

import { describe, it, expect, vi } from 'vitest';
import {
  MockMCPServerDefinitionSchema,
  MockBehaviorConfigSchema,
  type MockMCPServerDefinition,
  type MockDynamicHandlerFunction,
} from './mock-types.js';

// ============================================================================
// COMPREHENSIVE INTEGRATION SCENARIOS
// ============================================================================

describe('Mock Types Integration', () => {
  it('should support a complete file system mock server scenario', async () => {
    // Simulate a file system server with different response patterns
    const fileSystemMockHandler: MockDynamicHandlerFunction = async (toolName, args, context) => {
      const path = args.path as string;
      const action = args.action as string;

      // Simulate different behaviors based on file path
      if (path?.includes('/protected/')) {
        return {
          content: [{ type: 'text', text: 'Permission denied' }],
          isError: true,
        };
      }

      if (path?.includes('/slow/')) {
        // Simulate slow file operations
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      switch (action) {
        case 'read':
          return {
            content: [{ type: 'text', text: `Contents of ${path}` }],
            isError: false,
          };
        case 'write':
          return {
            content: [{ type: 'text', text: `Successfully wrote to ${path}` }],
            isError: false,
          };
        case 'list':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                files: [`${path}/file1.txt`, `${path}/file2.txt`],
                directories: [`${path}/subdir1`, `${path}/subdir2`],
              }),
            }],
            isError: false,
          };
        default:
          return {
            content: [{ type: 'text', text: 'Unknown action' }],
            isError: true,
          };
      }
    };

    const fileSystemServer: MockMCPServerDefinition = {
      serverConfig: {
        name: 'filesystem-mock-server',
        description: 'Mock filesystem operations for testing',
        transport: 'stdio',
        capabilities: {
          tools: { listChanged: true },
        },
      },
      defaultBehavior: {
        responseDelay: {
          perMethod: {
            'tools/call': 50, // Base delay for tool calls
          },
        },
        toolHandlers: [
          // Static response for listing available tools
          {
            toolName: 'list_tools',
            response: {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  tools: ['file_read', 'file_write', 'file_list'],
                }),
              }],
              isError: false,
            },
            priority: 100, // High priority for tool listing
          },
          // Error response for unauthorized operations
          {
            toolName: 'file_delete',
            response: {
              content: [{ type: 'text', text: 'Delete operations not allowed in mock mode' }],
              isError: true,
            },
            priority: 90,
          },
        ],
        dynamicHandlers: [
          {
            toolName: 'file_read',
            handler: fileSystemMockHandler,
            priority: 80,
          },
          {
            toolName: 'file_write',
            handler: fileSystemMockHandler,
            priority: 80,
          },
          {
            toolName: 'file_list',
            handler: fileSystemMockHandler,
            priority: 80,
          },
        ],
        responseSequences: [
          // Simulate a multi-step deployment process
          {
            toolName: 'deploy_application',
            responses: [
              {
                content: [{ type: 'text', text: 'Step 1: Validating application package' }],
                isError: false,
                delayMs: 500,
              },
              {
                content: [{ type: 'text', text: 'Step 2: Uploading files' }],
                isError: false,
                delayMs: 1000,
              },
              {
                content: [{ type: 'text', text: 'Step 3: Configuring environment' }],
                isError: false,
                delayMs: 300,
              },
              {
                content: [{ type: 'text', text: 'Step 4: Starting services' }],
                isError: false,
                delayMs: 800,
              },
              {
                content: [{ type: 'text', text: 'Deployment complete' }],
                isError: false,
                delayMs: 200,
              },
            ],
            cycleMode: 'stop_at_end', // Don't repeat the deployment
            priority: 70,
          },
        ],
        statefulBehavior: {
          initialState: 'disconnected',
          transitions: [
            {
              from: 'disconnected',
              to: 'connected',
              onMethod: 'initialize',
            },
            {
              from: 'connected',
              to: 'authenticated',
              onMethod: 'tools/call',
              whenArgs: { toolName: 'authenticate' },
            },
            {
              from: 'authenticated',
              to: 'connected',
              onMethod: 'tools/call',
              whenArgs: { toolName: 'logout' },
            },
          ],
          stateBehaviors: [
            {
              state: 'disconnected',
              toolHandlers: [
                {
                  toolName: 'any',
                  response: {
                    content: [{ type: 'text', text: 'Server not initialized' }],
                    isError: true,
                  },
                  priority: 100,
                },
              ],
              errorInjection: {
                enabled: true,
                probability: 1.0, // All requests fail when disconnected
                errorMessage: 'Connection not established',
              },
            },
            {
              state: 'connected',
              toolHandlers: [
                {
                  toolName: 'authenticate',
                  response: {
                    content: [{ type: 'text', text: 'Authentication successful' }],
                    isError: false,
                  },
                  priority: 100,
                },
              ],
            },
            {
              state: 'authenticated',
              capabilities: {
                tools: { listChanged: true },
                resources: { subscribe: true },
              },
              // All file operations are available when authenticated
            },
          ],
        },
        recordRequests: true,
        maxRecordedRequests: 1000,
      },
      scenarios: [
        {
          name: 'high-latency',
          description: 'Simulate high network latency',
          serverConfig: {
            name: 'slow-filesystem-server',
            transport: 'stdio',
          },
          behaviorConfig: {
            responseDelay: {
              minMs: 1000,
              maxMs: 3000,
              jitter: true,
            },
          },
        },
        {
          name: 'unreliable-network',
          description: 'Simulate network failures and timeouts',
          serverConfig: {
            name: 'unreliable-filesystem-server',
            transport: 'stdio',
          },
          behaviorConfig: {
            errorInjection: {
              enabled: true,
              probability: 0.3,
              simulateConnectionFailure: true,
              errorDelayMs: 5000,
            },
          },
        },
        {
          name: 'read-only-mode',
          description: 'Server in read-only mode',
          serverConfig: {
            name: 'readonly-filesystem-server',
            transport: 'stdio',
          },
          behaviorConfig: {
            toolHandlers: [
              {
                toolName: 'file_write',
                response: {
                  content: [{ type: 'text', text: 'Server is in read-only mode' }],
                  isError: true,
                },
                priority: 100,
              },
              {
                toolName: 'file_delete',
                response: {
                  content: [{ type: 'text', text: 'Server is in read-only mode' }],
                  isError: true,
                },
                priority: 100,
              },
            ],
          },
        },
      ],
    };

    const result = MockMCPServerDefinitionSchema.parse(fileSystemServer);

    // Verify the structure was parsed correctly
    expect(result.serverConfig.name).toBe('filesystem-mock-server');
    expect(result.defaultBehavior.toolHandlers).toHaveLength(2);
    expect(result.defaultBehavior.dynamicHandlers).toHaveLength(3);
    expect(result.defaultBehavior.responseSequences).toHaveLength(1);
    expect(result.scenarios).toHaveLength(3);
    expect(result.defaultBehavior.statefulBehavior?.transitions).toHaveLength(3);

    // Test that the dynamic handler function works
    const fileReadHandler = result.defaultBehavior.dynamicHandlers[0];
    const readResponse = await fileReadHandler.handler(
      'file_read',
      { path: '/test/file.txt', action: 'read' },
      {
        requestId: 'req-123',
        invocationCount: 1,
        timestamp: new Date(),
      }
    );

    expect(readResponse.content[0]).toEqual({
      type: 'text',
      text: 'Contents of /test/file.txt',
    });
    expect(readResponse.isError).toBe(false);

    // Test protected file access
    const protectedResponse = await fileReadHandler.handler(
      'file_read',
      { path: '/protected/secret.txt', action: 'read' },
      {
        requestId: 'req-124',
        invocationCount: 2,
        timestamp: new Date(),
      }
    );

    expect(protectedResponse.content[0]).toEqual({
      type: 'text',
      text: 'Permission denied',
    });
    expect(protectedResponse.isError).toBe(true);
  });

  it('should support complex testing scenarios with multiple handler types', () => {
    const testingServer: MockMCPServerDefinition = {
      serverConfig: {
        name: 'comprehensive-test-server',
        transport: 'http',
        httpConfig: { port: 0 },
      },
      defaultBehavior: {
        // Mix different handler types for the same tool to test priority resolution
        toolHandlers: [
          {
            toolName: 'database_query',
            response: {
              content: [{ type: 'text', text: 'Static query result' }],
              isError: false,
            },
            matchArgs: { table: 'static_table' },
            priority: 30, // Lower priority than dynamic and sequence handlers
          },
        ],
        dynamicHandlers: [
          {
            toolName: 'database_query',
            handler: vi.fn().mockImplementation(async (toolName, args) => {
              const query = args.query as string;
              const table = args.table as string;

              if (query?.includes('SELECT COUNT(*)')) {
                return {
                  content: [{ type: 'text', text: `{"count": ${Math.floor(Math.random() * 1000)}}` }],
                  isError: false,
                };
              }

              return {
                content: [{
                  type: 'text',
                  text: `Dynamic query result for table: ${table}`,
                }],
                isError: false,
              };
            }),
            matchArgs: { type: 'dynamic' },
            priority: 80, // Higher priority than static handlers
          },
        ],
        responseSequences: [
          {
            toolName: 'database_query',
            responses: [
              { content: [{ type: 'text', text: 'Connecting to database...' }], isError: false },
              { content: [{ type: 'text', text: 'Query executing...' }], isError: false },
              { content: [{ type: 'text', text: 'Results ready' }], isError: false },
            ],
            matchArgs: { mode: 'sequence' },
            cycleMode: 'cycle',
            priority: 60, // Medium priority
          },
        ],
        // Test that all three types can coexist
        expectations: [
          {
            name: 'static-query-expectation',
            request: {
              method: 'tools/call',
              params: {
                name: 'database_query',
                arguments: { table: 'static_table' },
              },
            },
            response: {
              result: {
                content: [{ type: 'text', text: 'Static query result' }],
              },
            },
          },
          {
            name: 'dynamic-query-expectation',
            request: {
              method: 'tools/call',
              params: {
                name: 'database_query',
                arguments: { type: 'dynamic', table: 'users' },
              },
            },
            response: {
              result: {
                content: [{ type: 'text', text: 'Dynamic query result for table: users' }],
              },
            },
          },
        ],
      },
      scenarios: [
        {
          name: 'priority-testing',
          description: 'Test handler priority resolution',
          serverConfig: {
            name: 'priority-test-server',
            transport: 'stdio',
          },
          behaviorConfig: {
            // Override with different priorities in scenario
            toolHandlers: [
              {
                toolName: 'database_query',
                response: {
                  content: [{ type: 'text', text: 'Scenario-specific result' }],
                  isError: false,
                },
                priority: 95, // Highest priority in scenario
              },
            ],
          },
        },
      ],
    };

    const result = MockMCPServerDefinitionSchema.parse(testingServer);

    // Verify all handler types are preserved
    expect(result.defaultBehavior.toolHandlers).toHaveLength(1);
    expect(result.defaultBehavior.dynamicHandlers).toHaveLength(1);
    expect(result.defaultBehavior.responseSequences).toHaveLength(1);

    // Verify priorities are correctly set
    expect(result.defaultBehavior.toolHandlers[0].priority).toBe(30);
    expect(result.defaultBehavior.dynamicHandlers[0].priority).toBe(80);
    expect(result.defaultBehavior.responseSequences[0].priority).toBe(60);

    // Scenario should override with highest priority
    expect(result.scenarios[0].behaviorConfig.toolHandlers?.[0].priority).toBe(95);
  });

  it('should validate complex handler interaction patterns', () => {
    // Test that multiple handlers can exist for the same tool with different match criteria
    const complexBehavior = {
      toolHandlers: [
        {
          toolName: 'api_request',
          response: { content: [{ type: 'text', text: 'GET response' }], isError: false },
          matchArgs: { method: 'GET' },
          priority: 50,
        },
        {
          toolName: 'api_request',
          response: { content: [{ type: 'text', text: 'POST response' }], isError: false },
          matchArgs: { method: 'POST' },
          priority: 50,
        },
        {
          toolName: 'api_request',
          response: { content: [{ type: 'text', text: 'Authenticated response' }], isError: false },
          matchArgs: { authenticated: true },
          priority: 70, // Higher priority for authenticated requests
        },
      ],
      dynamicHandlers: [
        {
          toolName: 'api_request',
          handler: vi.fn().mockImplementation(async (toolName, args) => {
            const url = args.url as string;
            return {
              content: [{ type: 'text', text: `Dynamic response for ${url}` }],
              isError: false,
            };
          }),
          matchArgs: { type: 'dynamic' },
          priority: 60,
        },
      ],
      responseSequences: [
        {
          toolName: 'api_request',
          responses: [
            { content: [{ type: 'text', text: 'Retry attempt 1' }], isError: true },
            { content: [{ type: 'text', text: 'Retry attempt 2' }], isError: true },
            { content: [{ type: 'text', text: 'Success on retry 3' }], isError: false },
          ],
          matchArgs: { retry: true },
          cycleMode: 'stop_at_end',
          priority: 80, // Highest priority for retry scenarios
        },
      ],
    };

    const result = MockBehaviorConfigSchema.parse(complexBehavior);

    // Verify all handlers are preserved
    expect(result.toolHandlers).toHaveLength(3);
    expect(result.dynamicHandlers).toHaveLength(1);
    expect(result.responseSequences).toHaveLength(1);

    // Verify priority ordering (sequence: 80, auth: 70, dynamic: 60, GET/POST: 50)
    expect(result.responseSequences[0].priority).toBe(80);
    expect(result.toolHandlers.find(h => h.matchArgs?.authenticated)?.priority).toBe(70);
    expect(result.dynamicHandlers[0].priority).toBe(60);
    expect(result.toolHandlers.filter(h => h.priority === 50)).toHaveLength(2);
  });

  it('should handle edge cases in handler composition', async () => {
    // Test edge cases like empty responses, null values, etc.
    const edgeCaseHandler: MockDynamicHandlerFunction = async (toolName, args, context) => {
      if (args.test_case === 'empty_response') {
        return {
          content: [],
          isError: false,
        };
      }

      if (args.test_case === 'null_content') {
        return {
          content: [{ type: 'text', text: '' }], // Empty text content
          isError: false,
        };
      }

      if (args.test_case === 'large_payload') {
        const largeText = 'x'.repeat(100000); // 100KB of data
        return {
          content: [{ type: 'text', text: largeText }],
          isError: false,
        };
      }

      return {
        content: [{ type: 'text', text: 'Default edge case response' }],
        isError: false,
      };
    };

    const edgeCaseConfig = {
      dynamicHandlers: [
        {
          toolName: 'edge_case_tool',
          handler: edgeCaseHandler,
          maxInvocations: 1000000, // Very high limit
          priority: 50,
        },
      ],
      responseSequences: [
        {
          toolName: 'edge_sequence',
          responses: [
            { content: [], isError: false }, // Empty content
            { content: [{ type: 'text', text: 'After empty' }], isError: false },
          ],
          priority: 50,
        },
      ],
      maxRecordedRequests: 0, // Disable request recording
      recordRequests: false,
    };

    const result = MockBehaviorConfigSchema.parse(edgeCaseConfig);

    // Test the dynamic handler with edge cases
    const handler = result.dynamicHandlers[0];

    const emptyResponse = await handler.handler(
      'edge_case_tool',
      { test_case: 'empty_response' },
      { requestId: 'req-1', invocationCount: 1, timestamp: new Date() }
    );
    expect(emptyResponse.content).toEqual([]);

    const largeResponse = await handler.handler(
      'edge_case_tool',
      { test_case: 'large_payload' },
      { requestId: 'req-2', invocationCount: 2, timestamp: new Date() }
    );
    expect(largeResponse.content[0].text).toHaveLength(100000);

    // Verify sequence with empty content
    expect(result.responseSequences[0].responses[0].content).toEqual([]);
  });
});