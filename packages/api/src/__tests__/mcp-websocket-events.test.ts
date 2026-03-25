import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import { ApexOrchestrator } from '@apexcli/orchestrator';

// Mock the orchestrator
vi.mock('@apexcli/orchestrator', () => ({
  DaemonManager: class { async getStatus() { return { running: false }; } async start() {} async stop() {} }, HealthMonitor: class { getMetrics() { return {}; } checkHealth() { return { healthy: true }; } }, ToolCallStartEvent: class {}, ToolCallProgressEvent: class {}, ToolCallCompleteEvent: class {}, MCPErrorEventData: class {}, MCPConnectionEventData: class {}, MCPDisconnectionEventData: class {}, MCPReconnectingEventData: class {}, MCPHealthCheckEventData: class {}, MCPStateChangeEventData: class {},
  ApexOrchestrator: vi.fn(function() { return {
    installMcpServer: vi.fn(),
    uninstallMcpServer: vi.fn(),
    on: vi.fn(), // EventEmitter methods
    emit: vi.fn(),
  }; }),
}));

// Mock path resolution
vi.mock('path', () => ({
  resolve: vi.fn(() => '/mock/project/path'),
  join: vi.fn((...args: string[]) => args.join('/')),
}));

// Mock fs for config checking
vi.mock('fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
}));

// Test server with WebSocket support
async function createTestServerWithWebSocket() {
  const fastify = Fastify();
  await fastify.register(websocket);

  // Mock orchestrator instance
  const mockOrchestrator = new ApexOrchestrator('/mock/project/path');

  // WebSocket client tracking
  const clients = new Map<string, Set<any>>();
  const broadcastedEvents: any[] = [];

  // Mock broadcast function that captures events
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

  // Install an MCP server with WebSocket events
  fastify.post('/mcp/install/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!id || !id.trim()) {
      return reply.status(400).send({ error: 'Server ID is required' });
    }

    try {
      // Broadcast installation start event
      broadcast('mcp-installation', {
        type: 'mcp:install-start',
        taskId: 'mcp-installation',
        timestamp: new Date(),
        data: {
          serverId: id,
          stage: 'starting',
          progress: 0,
          message: `Starting installation of MCP server '${id}'`
        },
      });

      // Simulate progress updates
      broadcast('mcp-installation', {
        type: 'mcp:install-progress',
        taskId: 'mcp-installation',
        timestamp: new Date(),
        data: {
          serverId: id,
          stage: 'downloading',
          progress: 25,
          message: `Downloading MCP server '${id}'`
        },
      });

      broadcast('mcp-installation', {
        type: 'mcp:install-progress',
        taskId: 'mcp-installation',
        timestamp: new Date(),
        data: {
          serverId: id,
          stage: 'configuring',
          progress: 75,
          message: `Configuring MCP server '${id}'`
        },
      });

      const serverConfig = await mockOrchestrator.installMcpServer(id);

      // Broadcast installation complete event
      broadcast('mcp-installation', {
        type: 'mcp:install-complete',
        taskId: 'mcp-installation',
        timestamp: new Date(),
        data: {
          serverId: id,
          stage: 'complete',
          progress: 100,
          message: `MCP server '${id}' installed successfully`,
          config: serverConfig
        },
      });

      return {
        ok: true,
        message: `MCP server '${id}' installed successfully`,
        serverConfig
      };
    } catch (error) {
      // Broadcast installation error event
      broadcast('mcp-installation', {
        type: 'mcp:install-error',
        taskId: 'mcp-installation',
        timestamp: new Date(),
        data: {
          serverId: id,
          stage: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : `Failed to install MCP server '${id}'`,
          error: error instanceof Error ? error.message : String(error)
        },
      });

      const message = error instanceof Error ? error.message : `Failed to install MCP server '${id}'`;
      return reply.status(500).send({
        ok: false,
        error: message
      });
    }
  });

  // Uninstall an MCP server with WebSocket events
  fastify.delete('/mcp/uninstall/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!id || !id.trim()) {
      return reply.status(400).send({ error: 'Server ID is required' });
    }

    try {
      // Broadcast uninstallation start event
      broadcast('mcp-installation', {
        type: 'mcp:uninstall-start',
        taskId: 'mcp-installation',
        timestamp: new Date(),
        data: {
          serverId: id,
          stage: 'uninstalling',
          progress: 0,
          message: `Starting uninstallation of MCP server '${id}'`
        },
      });

      // Simulate progress updates
      broadcast('mcp-installation', {
        type: 'mcp:uninstall-progress',
        taskId: 'mcp-installation',
        timestamp: new Date(),
        data: {
          serverId: id,
          stage: 'stopping',
          progress: 50,
          message: `Stopping MCP server '${id}'`
        },
      });

      await mockOrchestrator.uninstallMcpServer(id);

      // Broadcast uninstallation complete event
      broadcast('mcp-installation', {
        type: 'mcp:uninstall-complete',
        taskId: 'mcp-installation',
        timestamp: new Date(),
        data: {
          serverId: id,
          stage: 'complete',
          progress: 100,
          message: `MCP server '${id}' uninstalled successfully`
        },
      });

      return {
        ok: true,
        message: `MCP server '${id}' uninstalled successfully`
      };
    } catch (error) {
      // Broadcast uninstallation error event
      broadcast('mcp-installation', {
        type: 'mcp:uninstall-error',
        taskId: 'mcp-installation',
        timestamp: new Date(),
        data: {
          serverId: id,
          stage: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : `Failed to uninstall MCP server '${id}'`,
          error: error instanceof Error ? error.message : String(error)
        },
      });

      const message = error instanceof Error ? error.message : `Failed to uninstall MCP server '${id}'`;
      return reply.status(500).send({
        ok: false,
        error: message
      });
    }
  });

  // WebSocket streaming endpoint for MCP installation events
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

  return { fastify, mockOrchestrator, clients, broadcastedEvents, broadcast };
}

describe.skip('MCP WebSocket Events', () => {
  let server: FastifyInstance;
  let mockOrchestrator: any;
  let clients: Map<string, Set<any>>;
  let broadcastedEvents: any[];
  let broadcast: (taskId: string, event: any) => void;

  beforeEach(async () => {
    vi.clearAllMocks();
    const testServer = await createTestServerWithWebSocket();
    server = testServer.fastify;
    mockOrchestrator = testServer.mockOrchestrator;
    clients = testServer.clients;
    broadcastedEvents = testServer.broadcastedEvents;
    broadcast = testServer.broadcast;
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
  });

  describe('WebSocket connection and event streaming', () => {
    it('establishes WebSocket connection for MCP installation events', async () => {
      const ws = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-installation`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          expect(clients.get('mcp-installation')?.size).toBe(1);
          ws.close();
          resolve();
        });

        ws.on('error', reject);

        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });
    });

    it('receives real-time installation progress events via WebSocket', async () => {
      const receivedEvents: any[] = [];
      const ws = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-installation`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          // Set up message handler before triggering installation
          ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            receivedEvents.push(event);

            // Check if we received all expected events
            if (receivedEvents.length >= 4) { // start, 2 progress, complete
              try {
                // Verify events were received in correct order
                expect(receivedEvents[0].type).toBe('mcp:install-start');
                expect(receivedEvents[1].type).toBe('mcp:install-progress');
                expect(receivedEvents[1].data.progress).toBe(25);
                expect(receivedEvents[2].type).toBe('mcp:install-progress');
                expect(receivedEvents[2].data.progress).toBe(75);
                expect(receivedEvents[3].type).toBe('mcp:install-complete');
                expect(receivedEvents[3].data.progress).toBe(100);

                ws.close();
                resolve();
              } catch (error) {
                ws.close();
                reject(error);
              }
            }
          });

          // Trigger installation
          const mockConfig = { type: 'stdio', command: 'node', args: ['test.js'] };
          mockOrchestrator.installMcpServer.mockResolvedValue(mockConfig);

          await server.inject({
            method: 'POST',
            url: '/mcp/install/test-server',
          });
        });

        ws.on('error', (error) => {
          reject(error);
        });

        setTimeout(() => reject(new Error('Test timeout')), 5000);
      });
    });

    it('receives real-time uninstallation progress events via WebSocket', async () => {
      const receivedEvents: any[] = [];
      const ws = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-installation`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          // Set up message handler before triggering uninstallation
          ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            receivedEvents.push(event);

            // Check if we received all expected events
            if (receivedEvents.length >= 3) { // start, progress, complete
              try {
                // Verify events were received in correct order
                expect(receivedEvents[0].type).toBe('mcp:uninstall-start');
                expect(receivedEvents[0].data.stage).toBe('uninstalling');
                expect(receivedEvents[1].type).toBe('mcp:uninstall-progress');
                expect(receivedEvents[1].data.progress).toBe(50);
                expect(receivedEvents[2].type).toBe('mcp:uninstall-complete');
                expect(receivedEvents[2].data.progress).toBe(100);

                ws.close();
                resolve();
              } catch (error) {
                ws.close();
                reject(error);
              }
            }
          });

          // Trigger uninstallation
          mockOrchestrator.uninstallMcpServer.mockResolvedValue(undefined);

          await server.inject({
            method: 'DELETE',
            url: '/mcp/uninstall/test-server',
          });
        });

        ws.on('error', (error) => {
          reject(error);
        });

        setTimeout(() => reject(new Error('Test timeout')), 5000);
      });
    });

    it('receives error events when installation fails', async () => {
      const receivedEvents: any[] = [];
      const ws = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-installation`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          // Set up message handler before triggering installation
          ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            receivedEvents.push(event);

            // Check if we received start and error events
            if (receivedEvents.length >= 4) { // start, 2 progress, error
              try {
                // Verify error event was received
                const errorEvent = receivedEvents.find(e => e.type === 'mcp:install-error');
                expect(errorEvent).toBeDefined();
                expect(errorEvent.data.stage).toBe('error');
                expect(errorEvent.data.progress).toBe(0);
                expect(errorEvent.data.error).toBe('Installation failed');

                ws.close();
                resolve();
              } catch (error) {
                ws.close();
                reject(error);
              }
            }
          });

          // Trigger failed installation
          mockOrchestrator.installMcpServer.mockRejectedValue(new Error('Installation failed'));

          await server.inject({
            method: 'POST',
            url: '/mcp/install/failing-server',
          });
        });

        ws.on('error', (error) => {
          reject(error);
        });

        setTimeout(() => reject(new Error('Test timeout')), 5000);
      });
    });

    it('handles multiple WebSocket clients for the same task', async () => {
      const client1Events: any[] = [];
      const client2Events: any[] = [];

      const ws1 = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-installation`);
      const ws2 = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-installation`);

      return new Promise<void>((resolve, reject) => {
        let connectionsReady = 0;

        const handleConnectionReady = async () => {
          connectionsReady++;
          if (connectionsReady === 2) {
            // Both clients are connected, trigger installation
            const mockConfig = { type: 'stdio', command: 'node', args: ['test.js'] };
            mockOrchestrator.installMcpServer.mockResolvedValue(mockConfig);

            await server.inject({
              method: 'POST',
              url: '/mcp/install/multi-client-test',
            });

            // Wait a bit for all events to be received
            setTimeout(() => {
              try {
                // Both clients should have received the same events
                expect(client1Events.length).toBeGreaterThan(0);
                expect(client2Events.length).toBe(client1Events.length);

                // Check that events are the same
                client1Events.forEach((event, index) => {
                  expect(client2Events[index].type).toBe(event.type);
                  expect(client2Events[index].data.serverId).toBe(event.data.serverId);
                });

                ws1.close();
                ws2.close();
                resolve();
              } catch (error) {
                ws1.close();
                ws2.close();
                reject(error);
              }
            }, 1000);
          }
        };

        ws1.on('open', () => {
          ws1.on('message', (data) => {
            client1Events.push(JSON.parse(data.toString()));
          });
          handleConnectionReady();
        });

        ws2.on('open', () => {
          ws2.on('message', (data) => {
            client2Events.push(JSON.parse(data.toString()));
          });
          handleConnectionReady();
        });

        ws1.on('error', reject);
        ws2.on('error', reject);

        setTimeout(() => reject(new Error('Test timeout')), 10000);
      });
    });

    it('cleans up clients when WebSocket connection is closed', async () => {
      const ws = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-installation`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          // Verify client is registered
          expect(clients.get('mcp-installation')?.size).toBe(1);

          // Close connection
          ws.close();
        });

        ws.on('close', () => {
          // Verify client is cleaned up
          setTimeout(() => {
            expect(clients.get('mcp-installation')?.size || 0).toBe(0);
            resolve();
          }, 100);
        });

        ws.on('error', reject);

        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });
    });
  });

  describe('Event structure validation', () => {
    it('validates all event fields for install events', async () => {
      const mockConfig = { type: 'stdio', command: 'node', args: ['test.js'] };
      mockOrchestrator.installMcpServer.mockResolvedValue(mockConfig);

      await server.inject({
        method: 'POST',
        url: '/mcp/install/validation-test',
      });

      // Check that all broadcasted events have required structure
      expect(broadcastedEvents.length).toBeGreaterThan(0);

      broadcastedEvents.forEach((broadcast) => {
        const { taskId, event } = broadcast;

        // Validate broadcast structure
        expect(taskId).toBe('mcp-installation');
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('taskId', 'mcp-installation');
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('data');

        // Validate event data structure
        const { data } = event;
        expect(data).toHaveProperty('serverId', 'validation-test');
        expect(data).toHaveProperty('stage');
        expect(data).toHaveProperty('progress');
        expect(data).toHaveProperty('message');

        // Validate data types
        expect(typeof data.serverId).toBe('string');
        expect(typeof data.stage).toBe('string');
        expect(typeof data.progress).toBe('number');
        expect(typeof data.message).toBe('string');
        expect(data.progress).toBeGreaterThanOrEqual(0);
        expect(data.progress).toBeLessThanOrEqual(100);

        // Validate timestamp
        expect(event.timestamp).toBeInstanceOf(Date);
      });
    });

    it('validates event type patterns', async () => {
      const mockConfig = { type: 'stdio' };
      mockOrchestrator.installMcpServer.mockResolvedValue(mockConfig);

      await server.inject({
        method: 'POST',
        url: '/mcp/install/pattern-test',
      });

      const eventTypes = broadcastedEvents.map(b => b.event.type);

      // Check that we have the expected event types in the correct pattern
      expect(eventTypes).toContain('mcp:install-start');
      expect(eventTypes).toContain('mcp:install-progress');
      expect(eventTypes).toContain('mcp:install-complete');

      // Verify start event comes first
      expect(eventTypes[0]).toBe('mcp:install-start');

      // Verify complete event comes last
      const lastEvent = eventTypes[eventTypes.length - 1];
      expect(lastEvent).toBe('mcp:install-complete');

      // Verify progress events come in between
      const progressEvents = eventTypes.filter(type => type === 'mcp:install-progress');
      expect(progressEvents.length).toBeGreaterThan(0);
    });

    it('validates progress values increase monotonically', async () => {
      const mockConfig = { type: 'stdio' };
      mockOrchestrator.installMcpServer.mockResolvedValue(mockConfig);

      await server.inject({
        method: 'POST',
        url: '/mcp/install/progress-test',
      });

      const progressValues = broadcastedEvents
        .map(b => b.event.data.progress)
        .filter(progress => progress !== undefined);

      // Check that progress values are monotonically increasing
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
      }

      // Check that we start at 0 and end at 100
      expect(progressValues[0]).toBe(0);
      expect(progressValues[progressValues.length - 1]).toBe(100);
    });

    it('includes configuration in complete events', async () => {
      const mockConfig = { type: 'stdio', command: 'node', args: ['test.js'] };
      mockOrchestrator.installMcpServer.mockResolvedValue(mockConfig);

      await server.inject({
        method: 'POST',
        url: '/mcp/install/config-test',
      });

      const completeEvent = broadcastedEvents.find(b => b.event.type === 'mcp:install-complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent.event.data.config).toEqual(mockConfig);
    });

    it('includes error details in error events', async () => {
      const errorMessage = 'Detailed installation error';
      mockOrchestrator.installMcpServer.mockRejectedValue(new Error(errorMessage));

      await server.inject({
        method: 'POST',
        url: '/mcp/install/error-test',
      });

      const errorEvent = broadcastedEvents.find(b => b.event.type === 'mcp:install-error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.event.data.error).toBe(errorMessage);
      expect(errorEvent.event.data.message).toBe(errorMessage);
      expect(errorEvent.event.data.stage).toBe('error');
      expect(errorEvent.event.data.progress).toBe(0);
    });
  });

  describe('Performance and reliability', () => {
    it('handles high-frequency events without losing messages', async () => {
      const receivedEvents: any[] = [];
      const expectedEventCount = 10;
      const ws = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-installation`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.on('message', (data) => {
            receivedEvents.push(JSON.parse(data.toString()));

            if (receivedEvents.length >= expectedEventCount) {
              try {
                expect(receivedEvents.length).toBe(expectedEventCount);
                // Verify all events have proper structure
                receivedEvents.forEach((event, index) => {
                  expect(event.data.sequenceNumber).toBe(index);
                });
                ws.close();
                resolve();
              } catch (error) {
                ws.close();
                reject(error);
              }
            }
          });

          // Send high-frequency events
          for (let i = 0; i < expectedEventCount; i++) {
            broadcast('mcp-installation', {
              type: 'mcp:test-event',
              taskId: 'mcp-installation',
              timestamp: new Date(),
              data: {
                sequenceNumber: i,
                message: `Event ${i}`
              },
            });
          }
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Test timeout')), 5000);
      });
    });

    it('handles WebSocket disconnections gracefully during operations', async () => {
      const ws = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-installation`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          // Immediately close the connection
          ws.close();

          // Try to trigger installation after disconnect
          const mockConfig = { type: 'stdio' };
          mockOrchestrator.installMcpServer.mockResolvedValue(mockConfig);

          const response = await server.inject({
            method: 'POST',
            url: '/mcp/install/disconnect-test',
          });

          // Operation should still complete successfully
          expect(response.statusCode).toBe(200);

          // Events should still be broadcasted (for other potential clients)
          expect(broadcastedEvents.length).toBeGreaterThan(0);

          resolve();
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Test timeout')), 5000);
      });
    });
  });
});