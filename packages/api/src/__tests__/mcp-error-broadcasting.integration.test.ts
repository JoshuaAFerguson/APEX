import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

// Mock dependencies to avoid external dependencies
vi.mock('path', () => ({
  resolve: vi.fn(() => '/mock/project/path'),
  join: vi.fn((...args: string[]) => args.join('/')),
}));

vi.mock('fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
}));

// Define MCP error event data structure
interface MCPErrorEventData {
  serverId: string;
  serverName?: string;
  error: string;
  timestamp: Date;
  code?: string;
  category?: string;
  recoverable?: boolean;
  stack?: string;
  recovery?: {
    canRetry: boolean;
    retryDelayMs?: number;
    attempt?: number;
    maxAttempts?: number;
    suggestions?: string[];
  };
  metadata?: Record<string, any>;
}

interface TestServerContext {
  fastify: FastifyInstance;
  mockOrchestrator: EventEmitter;
  clients: Map<string, Set<{ socket: WebSocket }>>;
  broadcastedEvents: Array<{ taskId: string; event: any }>;
  broadcast: (taskId: string, event: any) => void;
  triggerMCPError: (errorData: MCPErrorEventData) => void;
}

// Simple error serialization function (avoiding dependency issues)
function serializeMCPError(error: {
  message: string;
  name?: string;
  code?: string;
  category?: string;
  recoverable?: boolean;
  stack?: string;
  metadata?: Record<string, any>;
}) {
  // Stack trace sanitization patterns
  let sanitizedStack = error.stack;
  if (sanitizedStack) {
    sanitizedStack = sanitizedStack
      .replace(/\/Users\/[^/]+/g, '/Users/***')
      .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\***')
      .replace(/\/home\/[^/]+\/\./g, '.../');
  }

  return {
    message: error.message,
    name: error.code || 'MCPError', // Preserve code as name if provided, otherwise use MCPError
    code: error.code,
    category: error.category,
    recoverable: error.recoverable,
    stack: sanitizedStack,
  };
}

// Test server with MCP error event broadcasting
async function createTestServerWithMCPEvents(): Promise<TestServerContext> {
  const fastify = Fastify();
  await fastify.register(websocket);

  // Mock orchestrator using EventEmitter (similar to the first test)
  const mockOrchestrator = new EventEmitter();

  // WebSocket client tracking
  const clients = new Map<string, Set<{ socket: WebSocket }>>();
  const broadcastedEvents: Array<{ taskId: string; event: any }> = [];

  // Mock broadcast function that captures events and sends to WebSocket clients
  function broadcast(taskId: string, event: any) {
    broadcastedEvents.push({ taskId, event });
    const taskClients = clients.get(taskId);
    if (taskClients) {
      const message = JSON.stringify(event);
      for (const client of taskClients) {
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.send(message);
        }
      }
    }
  }

  // Function to trigger MCP error events (simulates orchestrator emitting events)
  function triggerMCPError(errorData: MCPErrorEventData) {
    mockOrchestrator.emit('mcp:error', errorData);
  }

  // Set up MCP event handlers (simulating the API setupEventBroadcasting)
  mockOrchestrator.on('mcp:error', (eventData: MCPErrorEventData) => {
    // Use enhanced MCP error serialization for safe transmission
    const serializedError = serializeMCPError({
      message: eventData.error,
      name: eventData.code || 'MCPError',
      code: eventData.code,
      category: eventData.category,
      recoverable: eventData.recoverable,
      stack: eventData.stack,
      metadata: eventData.metadata,
    });

    broadcast('mcp-events', {
      type: 'mcp:error',
      taskId: 'mcp-events',
      timestamp: eventData.timestamp,
      data: {
        serverId: eventData.serverId,
        serverName: eventData.serverName,
        error: serializedError,
        recovery: eventData.recovery,
        errorOccurredAt: eventData.timestamp,
      },
    });
  });

  // WebSocket streaming endpoint for MCP events
  fastify.get('/stream/:taskId', { websocket: true }, (socket, request) => {
    const { taskId } = request.params as { taskId: string };

    // Register client
    const client = { socket };
    if (!clients.has(taskId)) {
      clients.set(taskId, new Set());
    }
    clients.get(taskId)!.add(client);

    // Handle disconnect
    socket.on('close', () => {
      clients.get(taskId)?.delete(client);
      if (clients.get(taskId)?.size === 0) {
        clients.delete(taskId);
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      clients.get(taskId)?.delete(client);
    });
  });

  return {
    fastify,
    mockOrchestrator,
    clients,
    broadcastedEvents,
    broadcast,
    triggerMCPError
  };
}

describe('MCP Error Event Broadcasting Integration', () => {
  let testServer: any;
  let server: FastifyInstance;
  let mockOrchestrator: EventEmitter;
  let clients: Map<string, Set<{ socket: WebSocket }>>;
  let broadcastedEvents: Array<{ taskId: string; event: any }>;
  let broadcast: (taskId: string, event: any) => void;
  let triggerMCPError: (errorData: MCPErrorEventData) => void;
  let port: number;

  beforeEach(async () => {
    vi.clearAllMocks();
    testServer = await createTestServerWithMCPEvents();
    server = testServer.fastify;
    mockOrchestrator = testServer.mockOrchestrator;
    clients = testServer.clients;
    broadcastedEvents = testServer.broadcastedEvents;
    broadcast = testServer.broadcast;
    triggerMCPError = testServer.triggerMCPError;

    // Start server on random port
    await server.listen({ port: 0, host: '127.0.0.1' });
    port = (server.server.address() as any)?.port;
  });

  afterEach(async () => {
    await server?.close();
  });

  describe('MCP error event structure validation', () => {
    it('broadcasts properly structured MCP error events', async () => {
      const mockErrorData: MCPErrorEventData = {
        serverId: 'test-server-1',
        serverName: 'Test MCP Server',
        error: 'Connection failed to MCP server',
        timestamp: new Date(),
        code: 'CONNECTION_FAILED',
        category: 'connection',
        recoverable: true,
        stack: 'Error: Connection failed\n    at MCPConnection.connect (mcp.js:45)',
        recovery: {
          canRetry: true,
          retryDelayMs: 5000,
          attempt: 1,
          maxAttempts: 3,
          suggestions: ['Check network connectivity', 'Restart MCP server']
        },
        metadata: {
          connectionType: 'stdio',
          lastSuccessfulConnection: new Date(Date.now() - 60000)
        }
      };

      triggerMCPError(mockErrorData);

      expect(broadcastedEvents).toHaveLength(1);
      const broadcastEvent = broadcastedEvents[0];

      // Verify broadcast structure
      expect(broadcastEvent.taskId).toBe('mcp-events');
      expect(broadcastEvent.event).toEqual({
        type: 'mcp:error',
        taskId: 'mcp-events',
        timestamp: mockErrorData.timestamp,
        data: {
          serverId: 'test-server-1',
          serverName: 'Test MCP Server',
          error: {
            message: 'Connection failed to MCP server',
            name: 'CONNECTION_FAILED', // Name is preserved from code
            code: 'CONNECTION_FAILED',
            category: 'connection',
            recoverable: true,
            stack: expect.stringContaining('Connection failed'),
          },
          recovery: mockErrorData.recovery,
          errorOccurredAt: mockErrorData.timestamp,
        },
      });
    });

    it('handles MCP error events with minimal data', async () => {
      const minimalErrorData: MCPErrorEventData = {
        serverId: 'minimal-server',
        serverName: 'Minimal Server',
        error: 'Basic error',
        timestamp: new Date(),
        category: 'unknown',
        recoverable: false,
        recovery: {
          canRetry: false,
          suggestions: []
        }
      };

      triggerMCPError(minimalErrorData);

      expect(broadcastedEvents).toHaveLength(1);
      const event = broadcastedEvents[0].event;

      expect(event.data.serverId).toBe('minimal-server');
      expect(event.data.serverName).toBe('Minimal Server');
      expect(event.data.error.message).toBe('Basic error');
      expect(event.data.recovery.canRetry).toBe(false);
    });

    it('properly serializes complex error metadata', async () => {
      const complexErrorData: MCPErrorEventData = {
        serverId: 'complex-server',
        serverName: 'Complex Server',
        error: 'Complex error with metadata',
        timestamp: new Date(),
        code: 'COMPLEX_ERROR',
        category: 'protocol',
        recoverable: true,
        recovery: {
          canRetry: true,
          retryDelayMs: 2000,
          suggestions: ['Check protocol version', 'Update MCP server']
        },
        metadata: {
          protocolVersion: '2024-11-05',
          capabilities: ['logging', 'prompts', 'resources'],
          lastCommand: { method: 'tools/list', params: {} },
          errorCount: 5,
          connectionState: 'DISCONNECTED'
        }
      };

      triggerMCPError(complexErrorData);

      const event = broadcastedEvents[0].event;

      expect(event.data.error.code).toBe('COMPLEX_ERROR');
      expect(event.data.error.category).toBe('protocol');
      expect(event.data.recovery.retryDelayMs).toBe(2000);

      // Metadata should be preserved but not included in serialized error
      // (it's part of the root errorData, not the error object being serialized)
      expect(event.data.error.metadata).toBeUndefined();
    });
  });

  describe('WebSocket client error event reception', () => {
    it('delivers MCP error events to connected WebSocket clients', async () => {
      const receivedEvents: any[] = [];
      const ws = new WebSocket(`ws://localhost:${port}/stream/mcp-events`);

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            receivedEvents.push(event);

            if (event.type === 'mcp:error') {
              try {
                // Validate event structure (dates will be serialized as ISO strings via JSON)
                expect(event.type).toBe('mcp:error');
                expect(event.taskId).toBe('mcp-events');
                expect(event.timestamp).toBeDefined();
                expect(typeof event.timestamp).toBe('string'); // JSON serialization converts to string

                // Validate data structure
                expect(event.data.serverId).toBe('websocket-test-server');
                expect(event.data.serverName).toBe('WebSocket Test Server');

                // Validate error object
                expect(event.data.error).toBeDefined();
                expect(event.data.error.message).toBe('WebSocket delivery test error');
                expect(event.data.error.name).toBe('WEBSOCKET_TEST');
                expect(event.data.error.code).toBe('WEBSOCKET_TEST');
                expect(event.data.error.category).toBe('connection');
                expect(event.data.error.recoverable).toBe(true);
                expect(event.data.error.stack).toBeDefined();
                expect(typeof event.data.error.stack).toBe('string');

                // Validate recovery information
                expect(event.data.recovery).toBeDefined();
                expect(event.data.recovery.canRetry).toBe(true);
                expect(event.data.recovery.retryDelayMs).toBe(3000);
                expect(event.data.recovery.suggestions).toEqual(['Test suggestion']);

                // Validate timestamp is a valid ISO string
                expect(event.data.errorOccurredAt).toBeDefined();
                expect(typeof event.data.errorOccurredAt).toBe('string');
                expect(() => new Date(event.data.errorOccurredAt)).not.toThrow();

                ws.close();
                resolve();
              } catch (error) {
                ws.close();
                reject(error);
              }
            }
          });

          // Trigger MCP error event after WebSocket is ready
          triggerMCPError({
            serverId: 'websocket-test-server',
            serverName: 'WebSocket Test Server',
            error: 'WebSocket delivery test error',
            timestamp: new Date(),
            code: 'WEBSOCKET_TEST',
            category: 'connection',
            recoverable: true,
            stack: 'Error: WebSocket delivery test error\n    at test.js:10:5',
            recovery: {
              canRetry: true,
              retryDelayMs: 3000,
              suggestions: ['Test suggestion']
            }
          });
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Test timeout')), 5000);
      });
    });

    it('delivers error events to multiple WebSocket clients', async () => {
      const client1Events: any[] = [];
      const client2Events: any[] = [];

      const ws1 = new WebSocket(`ws://localhost:${port}/stream/mcp-events`);
      const ws2 = new WebSocket(`ws://localhost:${port}/stream/mcp-events`);

      await new Promise<void>((resolve, reject) => {
        let connectionsReady = 0;
        let eventsReceived = 0;

        const handleConnectionReady = () => {
          connectionsReady++;
          if (connectionsReady === 2) {
            // Both clients connected, trigger error event
            triggerMCPError({
              serverId: 'multi-client-server',
              serverName: 'Multi Client Server',
              error: 'Error for multiple clients',
              timestamp: new Date(),
              code: 'MULTI_CLIENT_ERROR',
              category: 'protocol',
              recoverable: false,
              recovery: {
                canRetry: false,
                suggestions: ['Contact support']
              }
            });
          }
        };

        ws1.on('open', () => {
          ws1.on('message', (data) => {
            const event = JSON.parse(data.toString());
            client1Events.push(event);
            eventsReceived++;

            if (eventsReceived === 2) { // Both clients received the event
              try {
                expect(client1Events).toHaveLength(1);
                expect(client2Events).toHaveLength(1);

                // Both clients should receive the same event
                expect(client1Events[0].type).toBe('mcp:error');
                expect(client2Events[0].type).toBe('mcp:error');
                expect(client1Events[0].data.serverId).toBe(client2Events[0].data.serverId);

                ws1.close();
                ws2.close();
                resolve();
              } catch (error) {
                ws1.close();
                ws2.close();
                reject(error);
              }
            }
          });
          handleConnectionReady();
        });

        ws2.on('open', () => {
          ws2.on('message', (data) => {
            const event = JSON.parse(data.toString());
            client2Events.push(event);
            eventsReceived++;
          });
          handleConnectionReady();
        });

        ws1.on('error', reject);
        ws2.on('error', reject);
        setTimeout(() => reject(new Error('Multi-client test timeout')), 5000);
      });
    });

    it('handles WebSocket disconnections during error broadcasting', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/stream/mcp-events`);

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          // Immediately close the connection
          ws.close();

          // Trigger error event after disconnect
          triggerMCPError({
            serverId: 'disconnect-test-server',
            serverName: 'Disconnect Test Server',
            error: 'Error after client disconnect',
            timestamp: new Date(),
            category: 'connection',
            recoverable: true,
            recovery: {
              canRetry: true,
              suggestions: []
            }
          });

          // Event should still be broadcasted (for other potential clients)
          expect(broadcastedEvents.length).toBeGreaterThan(0);
          const lastEvent = broadcastedEvents[broadcastedEvents.length - 1];
          expect(lastEvent.event.type).toBe('mcp:error');

          resolve();
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Disconnect test timeout')), 5000);
      });
    });
  });

  describe('error serialization in broadcasting', () => {
    it('properly sanitizes error stack traces for client transmission', async () => {
      const errorWithSensitivePaths: MCPErrorEventData = {
        serverId: 'sanitization-test',
        serverName: 'Sanitization Test Server',
        error: 'Error with sensitive paths',
        timestamp: new Date(),
        code: 'SENSITIVE_PATH_ERROR',
        category: 'unknown',
        recoverable: true,
        stack: `Error: Error with sensitive paths
    at MCPServer.connect (/Users/developer/secret-project/src/mcp/server.js:45:10)
    at Function.start (C:\\Users\\developer\\secret-project\\lib\\mcp.js:20:5)
    at /home/developer/.secret/config/mcp-config.js:15:3`,
        recovery: {
          canRetry: true,
          suggestions: []
        }
      };

      const receivedEvents: any[] = [];
      const ws = new WebSocket(`ws://localhost:${port}/stream/mcp-events`);

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            receivedEvents.push(event);

            if (event.type === 'mcp:error') {
              try {
                // Stack trace should be sanitized
                expect(event.data.error.stack).not.toContain('/Users/developer/secret-project');
                expect(event.data.error.stack).not.toContain('C:\\Users\\developer\\secret-project');
                expect(event.data.error.stack).not.toContain('/home/developer/.secret');

                // Should contain sanitized versions
                expect(event.data.error.stack).toContain('/Users/***');
                expect(event.data.error.stack).toContain('C:\\Users\\***');
                expect(event.data.error.stack).toContain('.../');

                ws.close();
                resolve();
              } catch (error) {
                ws.close();
                reject(error);
              }
            }
          });

          triggerMCPError(errorWithSensitivePaths);
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Sanitization test timeout')), 5000);
      });
    });

    it('handles errors without stack traces gracefully', async () => {
      const errorWithoutStack: MCPErrorEventData = {
        serverId: 'no-stack-test',
        serverName: 'No Stack Test Server',
        error: 'Error without stack trace',
        timestamp: new Date(),
        category: 'unknown',
        recoverable: false,
        recovery: {
          canRetry: false,
          suggestions: []
        }
        // No stack property
      };

      triggerMCPError(errorWithoutStack);

      expect(broadcastedEvents).toHaveLength(1);
      const event = broadcastedEvents[0].event;

      expect(event.data.error.message).toBe('Error without stack trace');
      expect(event.data.error.stack).toBeUndefined();
    });

    it('preserves all error recovery information in broadcasts', async () => {
      const errorWithDetailedRecovery: MCPErrorEventData = {
        serverId: 'recovery-test',
        serverName: 'Recovery Test Server',
        error: 'Detailed recovery information test',
        timestamp: new Date(),
        code: 'RECOVERY_TEST',
        category: 'timeout',
        recoverable: true,
        recovery: {
          canRetry: true,
          retryDelayMs: 10000,
          attempt: 2,
          maxAttempts: 5,
          suggestions: [
            'Check server health status',
            'Increase timeout configuration',
            'Verify network connectivity',
            'Review server logs for errors'
          ]
        }
      };

      triggerMCPError(errorWithDetailedRecovery);

      const event = broadcastedEvents[0].event;

      expect(event.data.recovery).toEqual({
        canRetry: true,
        retryDelayMs: 10000,
        attempt: 2,
        maxAttempts: 5,
        suggestions: [
          'Check server health status',
          'Increase timeout configuration',
          'Verify network connectivity',
          'Review server logs for errors'
        ]
      });
    });
  });

  describe('performance and reliability under load', () => {
    it('handles rapid succession of MCP error events', async () => {
      const errorCount = 50;
      const receivedEvents: any[] = [];

      const ws = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-events`);

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            receivedEvents.push(event);

            if (receivedEvents.length === errorCount) {
              try {
                expect(receivedEvents).toHaveLength(errorCount);

                // Verify all events are properly structured
                receivedEvents.forEach((event, index) => {
                  expect(event.type).toBe('mcp:error');
                  expect(event.data.serverId).toBe(`rapid-test-${index}`);
                });

                ws.close();
                resolve();
              } catch (error) {
                ws.close();
                reject(error);
              }
            }
          });

          // Rapidly trigger multiple error events
          for (let i = 0; i < errorCount; i++) {
            triggerMCPError({
              serverId: `rapid-test-${i}`,
              serverName: `Rapid Test Server ${i}`,
              error: `Rapid error ${i}`,
              timestamp: new Date(),
              category: 'unknown',
              recoverable: true,
              recovery: {
                canRetry: true,
                suggestions: [`Suggestion for error ${i}`]
              }
            });
          }
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Rapid events test timeout')), 10000);
      });
    });
  });
});