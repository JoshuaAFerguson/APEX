/**
 * MCP Install Error WebSocket Integration Test
 *
 * Verifies that `mcp:install-error` events are properly broadcast to WebSocket clients
 * when MCP server installation fails, according to acceptance criteria:
 *
 * AC1: WebSocket clients receive mcp:install-error events when installation fails
 * AC2: Error events contain serverId, error message, stage, and timestamp
 * AC3: Multiple clients receive the same error broadcast
 *
 * Based on ADR-207 technical design.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

// Type definitions for test events
interface MCPInstallErrorEventData {
  serverId: string;
  serverName?: string;
  stage: 'error';
  progress: number;
  message: string;
  error: {
    message: string;
    code?: string;
    stack?: string;
    recoverable?: boolean;
    suggestedAction?: string;
  };
  timestamp: Date;
}

interface MCPInstallErrorBroadcastEvent {
  type: 'mcp:install-error';
  taskId: 'mcp-installation';
  timestamp: string | Date;
  data: MCPInstallErrorEventData;
}

// Test server factory function
async function createMCPInstallErrorTestServer() {
  const fastify = Fastify();
  await fastify.register(websocket);

  // Mock orchestrator using EventEmitter (avoids constructor issues)
  const mockOrchestrator = new EventEmitter();

  // Client tracking for broadcast simulation
  const clients = new Map<string, Set<{ socket: WebSocket }>>();
  const broadcastedEvents: Array<{ taskId: string; event: any }> = [];

  // Broadcast function - simulates real event broadcasting
  function broadcast(taskId: string, event: any): void {
    broadcastedEvents.push({ taskId, event });
    const taskClients = clients.get(taskId);
    if (!taskClients) return;

    const message = JSON.stringify(event);
    for (const client of taskClients) {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(message);
      }
    }
  }

  // Wire up mcp:install-error event handler
  // This simulates the real setupEventBroadcasting() behavior
  mockOrchestrator.on('mcp:install-error', (eventData: MCPInstallErrorEventData) => {
    const broadcastEvent: MCPInstallErrorBroadcastEvent = {
      type: 'mcp:install-error',
      taskId: 'mcp-installation',
      timestamp: eventData.timestamp || new Date(),
      data: {
        serverId: eventData.serverId,
        serverName: eventData.serverName,
        stage: eventData.stage,
        progress: eventData.progress,
        message: eventData.message,
        error: eventData.error,
        timestamp: eventData.timestamp,
      },
    };

    broadcast('mcp-installation', broadcastEvent);
  });

  // WebSocket endpoint - matches real /stream/:taskId endpoint
  fastify.get('/stream/:taskId', { websocket: true }, (socket, request) => {
    const { taskId } = request.params as { taskId: string };

    const client = { socket };
    if (!clients.has(taskId)) {
      clients.set(taskId, new Set());
    }
    clients.get(taskId)!.add(client);

    socket.on('close', () => {
      clients.get(taskId)?.delete(client);
      if (clients.get(taskId)?.size === 0) {
        clients.delete(taskId);
      }
    });
  });

  return {
    fastify,
    mockOrchestrator,
    clients,
    broadcastedEvents,
    broadcast
  };
}

// Helper function to connect WebSocket client
async function connectWebSocketClient(port: number, taskId: string = 'mcp-installation'): Promise<{
  socket: WebSocket;
  receivedEvents: any[];
  waitForEvent: (timeoutMs?: number) => Promise<any>;
}> {
  const socket = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
  const receivedEvents: any[] = [];

  // Promise-based connection handling
  await new Promise<void>((resolve, reject) => {
    socket.on('open', () => resolve());
    socket.on('error', reject);
  });

  // Event collection
  socket.on('message', (data) => {
    try {
      const event = JSON.parse(data.toString());
      receivedEvents.push(event);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  });

  // Helper to wait for next event
  const waitForEvent = (timeoutMs: number = 5000): Promise<any> => {
    return new Promise((resolve, reject) => {
      const startLength = receivedEvents.length;
      const timeout = setTimeout(() => {
        reject(new Error(`No event received within ${timeoutMs}ms`));
      }, timeoutMs);

      const checkForNewEvent = () => {
        if (receivedEvents.length > startLength) {
          clearTimeout(timeout);
          resolve(receivedEvents[receivedEvents.length - 1]);
        } else {
          setTimeout(checkForNewEvent, 10);
        }
      };
      checkForNewEvent();
    });
  };

  return { socket, receivedEvents, waitForEvent };
}

describe('MCP Install Error WebSocket Broadcasting Integration', () => {
  let testServer: any;
  let fastify: FastifyInstance;
  let port: number;

  beforeEach(async () => {
    testServer = await createMCPInstallErrorTestServer();
    fastify = testServer.fastify;

    // Start server on random port
    await fastify.listen({ port: 0, host: '127.0.0.1' });
    port = (fastify.server.address() as any)?.port;
  });

  afterEach(async () => {
    await fastify?.close();
  });

  // AC1: WebSocket clients receive mcp:install-error events when installation fails
  it('delivers mcp:install-error events to connected WebSocket clients', async () => {
    // 1. Connect WebSocket client
    const client = await connectWebSocketClient(port);

    // 2. Emit mcp:install-error from mock orchestrator
    const errorEventData: MCPInstallErrorEventData = {
      serverId: 'test-server-123',
      serverName: 'Test MCP Server',
      stage: 'error',
      progress: 0,
      message: 'Installation failed due to network timeout',
      error: {
        message: 'Network timeout connecting to registry',
        code: 'NETWORK_TIMEOUT',
        recoverable: true,
        suggestedAction: 'Check network connection and retry',
      },
      timestamp: new Date(),
    };

    testServer.mockOrchestrator.emit('mcp:install-error', errorEventData);

    // 3. Assert client receives the error event
    const receivedEvent = await client.waitForEvent();
    expect(receivedEvent).toBeDefined();

    // 4. Assert event.type === 'mcp:install-error'
    expect(receivedEvent.type).toBe('mcp:install-error');

    client.socket.close();
  });

  // AC2: Error events contain serverId, error message, stage, and timestamp
  it('validates error event structure contains required fields', async () => {
    // 1. Connect client and emit error event with full data
    const client = await connectWebSocketClient(port);

    const errorEventData: MCPInstallErrorEventData = {
      serverId: 'server-xyz-789',
      serverName: 'Complex MCP Server',
      stage: 'error',
      progress: 0,
      message: 'Dependency resolution failed',
      error: {
        message: 'Package not found in registry',
        code: 'PACKAGE_NOT_FOUND',
        stack: 'Error: Package not found\n  at installer.js:45:12',
        recoverable: false,
        suggestedAction: 'Verify package name and version',
      },
      timestamp: new Date('2024-01-15T10:30:00.000Z'),
    };

    testServer.mockOrchestrator.emit('mcp:install-error', errorEventData);

    // 2. Capture received event
    const receivedEvent = await client.waitForEvent();

    // 3. Assert: event.data.serverId exists and is correct
    expect(receivedEvent.data.serverId).toBe('server-xyz-789');

    // 4. Assert: event.data.error (message) exists
    expect(receivedEvent.data.error).toBeDefined();
    expect(receivedEvent.data.error.message).toBe('Package not found in registry');
    expect(receivedEvent.data.message).toBe('Dependency resolution failed');

    // 5. Assert: event.data.stage === 'error'
    expect(receivedEvent.data.stage).toBe('error');

    // 6. Assert: event.timestamp exists and is valid Date
    expect(receivedEvent.timestamp).toBeDefined();
    expect(new Date(receivedEvent.timestamp)).toBeInstanceOf(Date);

    client.socket.close();
  });

  // AC3: Multiple clients receive the same error broadcast
  it('broadcasts error events to multiple connected clients simultaneously', { timeout: 15000 }, async () => {
    // 1. Connect multiple WebSocket clients
    const client1 = await connectWebSocketClient(port);
    const client2 = await connectWebSocketClient(port);

    // 2. Wait for all to be connected (they are connected by this point)
    // Small delay to ensure both connections are fully established
    await new Promise(resolve => setTimeout(resolve, 100));

    // 3. Emit single mcp:install-error event
    const errorEventData: MCPInstallErrorEventData = {
      serverId: 'multi-client-server',
      stage: 'error',
      progress: 0,
      message: 'Multi-client broadcast test',
      error: {
        message: 'Test error for multiple clients',
        recoverable: true,
      },
      timestamp: new Date(),
    };

    testServer.mockOrchestrator.emit('mcp:install-error', errorEventData);

    // 4. Wait a bit and then check received events
    await new Promise(resolve => setTimeout(resolve, 200));

    // Assert both clients received the event
    expect(client1.receivedEvents).toHaveLength(1);
    expect(client2.receivedEvents).toHaveLength(1);

    const event1 = client1.receivedEvents[0];
    const event2 = client2.receivedEvents[0];

    expect(event1).toBeDefined();
    expect(event2).toBeDefined();

    // 5. Assert both received identical data
    expect(event1.type).toBe(event2.type);
    expect(event1.data.serverId).toBe(event2.data.serverId);
    expect(event1.data.message).toBe(event2.data.message);
    expect(event1.data.stage).toBe(event2.data.stage);
    expect(event1.data.error.message).toBe(event2.data.error.message);

    // Additional verification: ensure events match the broadcast structure
    expect(event1.type).toBe('mcp:install-error');
    expect(event1.taskId).toBe('mcp-installation');
    expect(event1.data.serverId).toBe('multi-client-server');

    client1.socket.close();
    client2.socket.close();
  });

  // Additional test: Event payload structure validation
  it('validates complete event payload structure matches specification', async () => {
    const client = await connectWebSocketClient(port);

    const fullErrorEventData: MCPInstallErrorEventData = {
      serverId: 'validation-server',
      serverName: 'Validation Test Server',
      stage: 'error',
      progress: 0,
      message: 'Complete structure validation test',
      error: {
        message: 'Comprehensive error details',
        code: 'VALIDATION_ERROR',
        stack: 'Error stack trace here...',
        recoverable: true,
        suggestedAction: 'Follow validation guidelines',
      },
      timestamp: new Date(),
    };

    testServer.mockOrchestrator.emit('mcp:install-error', fullErrorEventData);

    const receivedEvent: MCPInstallErrorBroadcastEvent = await client.waitForEvent();

    // Validate top-level structure
    expect(receivedEvent.type).toBe('mcp:install-error');
    expect(receivedEvent.taskId).toBe('mcp-installation');
    expect(receivedEvent.timestamp).toBeDefined();
    expect(receivedEvent.data).toBeDefined();

    // Validate data structure
    expect(receivedEvent.data.serverId).toBe('validation-server');
    expect(receivedEvent.data.serverName).toBe('Validation Test Server');
    expect(receivedEvent.data.stage).toBe('error');
    expect(receivedEvent.data.progress).toBe(0);
    expect(receivedEvent.data.message).toBe('Complete structure validation test');

    // Validate error object structure
    expect(receivedEvent.data.error).toBeDefined();
    expect(receivedEvent.data.error.message).toBe('Comprehensive error details');
    expect(receivedEvent.data.error.code).toBe('VALIDATION_ERROR');
    expect(receivedEvent.data.error.stack).toBe('Error stack trace here...');
    expect(receivedEvent.data.error.recoverable).toBe(true);
    expect(receivedEvent.data.error.suggestedAction).toBe('Follow validation guidelines');

    client.socket.close();
  });

  // Test edge case: Client connects after error emission (should not receive old events)
  it('does not deliver events to clients that connect after emission', async () => {
    // 1. Emit error before any client connects
    const errorEventData: MCPInstallErrorEventData = {
      serverId: 'late-client-test',
      stage: 'error',
      progress: 0,
      message: 'This should not be received by late client',
      error: {
        message: 'Pre-connection error',
        recoverable: false,
      },
      timestamp: new Date(),
    };

    testServer.mockOrchestrator.emit('mcp:install-error', errorEventData);

    // 2. Connect client after emission
    const client = await connectWebSocketClient(port);

    // 3. Wait briefly and verify no events received
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(client.receivedEvents).toHaveLength(0);

    // 4. Emit new event and verify it IS received
    const newErrorEventData: MCPInstallErrorEventData = {
      serverId: 'new-event-server',
      stage: 'error',
      progress: 0,
      message: 'This should be received',
      error: {
        message: 'Post-connection error',
        recoverable: true,
      },
      timestamp: new Date(),
    };

    testServer.mockOrchestrator.emit('mcp:install-error', newErrorEventData);

    const receivedEvent = await client.waitForEvent();
    expect(receivedEvent.data.serverId).toBe('new-event-server');

    client.socket.close();
  });
});