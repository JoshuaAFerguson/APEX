import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { EventEmitter } from 'events';

// Mock the orchestrator
vi.mock('@apexcli/orchestrator', () => ({
  ApexOrchestrator: vi.fn().mockImplementation(() => {
    const emitter = new EventEmitter();
    return {
      ...emitter,
      installMcpServer: vi.fn(),
      uninstallMcpServer: vi.fn(),
    };
  }),
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

// Create a simplified test server that implements setupEventBroadcasting
async function createTestServerWithMCPBroadcasting() {
  const fastify = Fastify();
  await fastify.register(websocket);

  // Mock orchestrator instance that extends EventEmitter
  const mockOrchestrator = new ApexOrchestrator('/mock/project/path') as any;

  // WebSocket client tracking
  const clients = new Map<string, Set<{ socket: WebSocket; eventFilters?: Set<string> }>>();
  const broadcastedEvents: any[] = [];

  // Broadcast function implementation (matches the real implementation)
  function broadcast(taskId: string, event: any): void {
    broadcastedEvents.push({ taskId, event });
    const taskClients = clients.get(taskId);
    if (!taskClients) return;

    const message = JSON.stringify(event);
    for (const client of taskClients) {
      // Check if client has event filters and if this event should be sent
      if (client.eventFilters && !client.eventFilters.has(event.type)) {
        continue; // Skip this client - event type not in their filter list
      }

      // Send message if socket is open
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(message);
      }
    }
  }

  // Setup MCP event broadcasting (mirrors the real setupEventBroadcasting implementation)
  function setupMCPEventBroadcasting(orchestrator: any): void {
    // MCP Installation Events (v0.6.0) - Real-time MCP server installation monitoring
    orchestrator.on('mcp:install-start', (event: any) => {
      broadcast('mcp-installation', {
        type: 'mcp:install-start',
        taskId: 'mcp-installation',
        timestamp: event.timestamp || new Date(),
        data: {
          serverId: event.serverId,
          serverName: event.serverName,
          stage: event.stage,
          progress: event.progress,
          message: event.message,
        },
      });
    });

    orchestrator.on('mcp:install-progress', (event: any) => {
      broadcast('mcp-installation', {
        type: 'mcp:install-progress',
        taskId: 'mcp-installation',
        timestamp: event.timestamp || new Date(),
        data: {
          serverId: event.serverId,
          serverName: event.serverName,
          stage: event.stage,
          progress: event.progress,
          message: event.message,
        },
      });
    });

    orchestrator.on('mcp:install-complete', (event: any) => {
      broadcast('mcp-installation', {
        type: 'mcp:install-complete',
        taskId: 'mcp-installation',
        timestamp: event.timestamp || new Date(),
        data: {
          serverId: event.serverId,
          serverName: event.serverName,
          stage: event.stage,
          progress: event.progress,
          message: event.message,
          config: event.config,
        },
      });
    });

    orchestrator.on('mcp:install-error', (event: any) => {
      broadcast('mcp-installation', {
        type: 'mcp:install-error',
        taskId: 'mcp-installation',
        timestamp: event.timestamp || new Date(),
        data: {
          serverId: event.serverId,
          serverName: event.serverName,
          stage: event.stage,
          progress: event.progress,
          message: event.message,
          error: event.error,
        },
      });
    });

    // MCP Uninstallation Events (v0.6.0)
    orchestrator.on('mcp:uninstall-start', (event: any) => {
      broadcast('mcp-installation', {
        type: 'mcp:uninstall-start',
        taskId: 'mcp-installation',
        timestamp: event.timestamp || new Date(),
        data: {
          serverId: event.serverId,
          serverName: event.serverName,
          stage: event.stage,
          progress: event.progress,
          message: event.message,
        },
      });
    });

    orchestrator.on('mcp:uninstall-complete', (event: any) => {
      broadcast('mcp-installation', {
        type: 'mcp:uninstall-complete',
        taskId: 'mcp-installation',
        timestamp: event.timestamp || new Date(),
        data: {
          serverId: event.serverId,
          serverName: event.serverName,
          stage: event.stage,
          progress: event.progress,
          message: event.message,
        },
      });
    });

    orchestrator.on('mcp:uninstall-error', (event: any) => {
      broadcast('mcp-installation', {
        type: 'mcp:uninstall-error',
        taskId: 'mcp-installation',
        timestamp: event.timestamp || new Date(),
        data: {
          serverId: event.serverId,
          serverName: event.serverName,
          stage: event.stage,
          progress: event.progress,
          message: event.message,
          error: event.error,
        },
      });
    });
  }

  // Initialize the event broadcasting
  setupMCPEventBroadcasting(mockOrchestrator);

  // WebSocket streaming endpoint for MCP installation events
  fastify.get('/stream/:taskId', { websocket: true }, (socket, request) => {
    const { taskId } = request.params as { taskId: string };

    // Parse event filters from query parameters
    const eventFiltersParam = (request.query as any).eventFilters;
    let eventFilters: Set<string> | undefined;

    if (eventFiltersParam) {
      const filters = Array.isArray(eventFiltersParam) ? eventFiltersParam : [eventFiltersParam];
      eventFilters = new Set(filters);
    }

    // Register client
    const client = { socket, eventFilters };
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

  // Add a health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  return { fastify, mockOrchestrator, clients, broadcastedEvents, broadcast };
}

describe('MCP Event Broadcasting Integration', () => {
  let server: FastifyInstance | null = null;
  let mockOrchestrator: any;
  let clients: Map<string, Set<any>>;
  let broadcastedEvents: any[];

  beforeEach(async () => {
    vi.clearAllMocks();
    const testServer = await createTestServerWithMCPBroadcasting();
    server = testServer.fastify;
    mockOrchestrator = testServer.mockOrchestrator;
    clients = testServer.clients;
    broadcastedEvents = testServer.broadcastedEvents;
    await server.ready();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  describe('Orchestrator Event Integration', () => {
    it('broadcasts mcp:install-start events from orchestrator to WebSocket clients', async () => {
      const receivedEvents: any[] = [];
      const ws = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-installation`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            receivedEvents.push(event);

            if (event.type === 'mcp:install-start') {
              try {
                expect(event.type).toBe('mcp:install-start');
                expect(event.taskId).toBe('mcp-installation');
                expect(event.data.serverId).toBe('test-server');
                expect(event.data.stage).toBe('starting');
                expect(event.data.progress).toBe(0);
                expect(typeof event.timestamp).toBe('string'); // JSON serialized dates become strings

                ws.close();
                resolve();
              } catch (error) {
                ws.close();
                reject(error);
              }
            }
          });

          // Small delay to ensure WebSocket is fully connected
          setTimeout(() => {
            // Simulate orchestrator emitting the event
            mockOrchestrator.emit('mcp:install-start', {
              serverId: 'test-server',
              serverName: 'Test Server',
              stage: 'starting',
              progress: 0,
              message: 'Starting installation',
              timestamp: new Date(),
            });
          }, 10);
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Test timeout')), 5000);
      });
    });

    it('broadcasts mcp:install-progress events with correct data structure', async () => {
      const receivedEvents: any[] = [];
      const ws = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-installation`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            receivedEvents.push(event);

            if (event.type === 'mcp:install-progress') {
              try {
                expect(event.type).toBe('mcp:install-progress');
                expect(event.taskId).toBe('mcp-installation');
                expect(event.data.serverId).toBe('test-server');
                expect(event.data.stage).toBe('downloading');
                expect(event.data.progress).toBe(50);
                expect(event.data.message).toBe('Downloading dependencies');

                ws.close();
                resolve();
              } catch (error) {
                ws.close();
                reject(error);
              }
            }
          });

          // Simulate orchestrator emitting the event
          mockOrchestrator.emit('mcp:install-progress', {
            serverId: 'test-server',
            serverName: 'Test Server',
            stage: 'downloading',
            progress: 50,
            message: 'Downloading dependencies',
            timestamp: new Date(),
          });
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Test timeout')), 5000);
      });
    });

    it('broadcasts mcp:install-complete events with configuration data', async () => {
      const receivedEvents: any[] = [];
      const ws = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-installation`);
      const testConfig = { type: 'stdio', command: 'node', args: ['server.js'] };

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            receivedEvents.push(event);

            if (event.type === 'mcp:install-complete') {
              try {
                expect(event.type).toBe('mcp:install-complete');
                expect(event.taskId).toBe('mcp-installation');
                expect(event.data.serverId).toBe('test-server');
                expect(event.data.stage).toBe('complete');
                expect(event.data.progress).toBe(100);
                expect(event.data.config).toEqual(testConfig);

                ws.close();
                resolve();
              } catch (error) {
                ws.close();
                reject(error);
              }
            }
          });

          // Simulate orchestrator emitting the event
          mockOrchestrator.emit('mcp:install-complete', {
            serverId: 'test-server',
            serverName: 'Test Server',
            stage: 'complete',
            progress: 100,
            message: 'Installation completed',
            config: testConfig,
            timestamp: new Date(),
          });
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Test timeout')), 5000);
      });
    });

    it('broadcasts mcp:install-error events with full error details', async () => {
      const receivedEvents: any[] = [];
      const ws = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-installation`);
      const testError = {
        code: 'NETWORK_TIMEOUT',
        message: 'Connection timeout after 30 seconds',
        details: {
          host: 'registry.npmjs.org',
          timeout: 30000
        }
      };

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            receivedEvents.push(event);

            if (event.type === 'mcp:install-error') {
              try {
                expect(event.type).toBe('mcp:install-error');
                expect(event.taskId).toBe('mcp-installation');
                expect(event.data.serverId).toBe('test-server');
                expect(event.data.stage).toBe('error');
                expect(event.data.progress).toBe(0);
                expect(event.data.error).toEqual(testError);
                expect(event.data.message).toBe('Installation failed');

                ws.close();
                resolve();
              } catch (error) {
                ws.close();
                reject(error);
              }
            }
          });

          // Simulate orchestrator emitting the event
          mockOrchestrator.emit('mcp:install-error', {
            serverId: 'test-server',
            serverName: 'Test Server',
            stage: 'error',
            progress: 0,
            message: 'Installation failed',
            error: testError,
            timestamp: new Date(),
          });
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Test timeout')), 5000);
      });
    });

    it('broadcasts all uninstall event types correctly', async () => {
      const receivedEvents: any[] = [];
      const ws = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-installation`);
      let eventsToTest = ['mcp:uninstall-start', 'mcp:uninstall-complete', 'mcp:uninstall-error'];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            receivedEvents.push(event);

            if (receivedEvents.length >= 3) {
              try {
                // Verify all event types were received
                const eventTypes = receivedEvents.map(e => e.type);
                expect(eventTypes).toContain('mcp:uninstall-start');
                expect(eventTypes).toContain('mcp:uninstall-complete');
                expect(eventTypes).toContain('mcp:uninstall-error');

                // Verify event structure for each type
                receivedEvents.forEach(event => {
                  expect(event.taskId).toBe('mcp-installation');
                  expect(event.data.serverId).toBe('test-server');
                  expect(event.timestamp).toBeInstanceOf(Date);
                });

                ws.close();
                resolve();
              } catch (error) {
                ws.close();
                reject(error);
              }
            }
          });

          // Simulate orchestrator emitting all uninstall events
          mockOrchestrator.emit('mcp:uninstall-start', {
            serverId: 'test-server',
            serverName: 'Test Server',
            stage: 'uninstalling',
            progress: 0,
            message: 'Starting uninstallation',
            timestamp: new Date(),
          });

          mockOrchestrator.emit('mcp:uninstall-complete', {
            serverId: 'test-server',
            serverName: 'Test Server',
            stage: 'complete',
            progress: 100,
            message: 'Uninstallation completed',
            timestamp: new Date(),
          });

          mockOrchestrator.emit('mcp:uninstall-error', {
            serverId: 'test-server',
            serverName: 'Test Server',
            stage: 'error',
            progress: 0,
            message: 'Uninstallation failed',
            error: 'Permission denied',
            timestamp: new Date(),
          });
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Test timeout')), 5000);
      });
    });
  });

  describe('Event Filtering and Client Management', () => {
    it('supports event filtering for MCP events', async () => {
      const receivedEvents: any[] = [];
      // Connect with event filter for only install-complete events
      const wsUrl = `ws://localhost:${server.server.address()?.port}/stream/mcp-installation?eventFilters=mcp:install-complete`;
      const ws = new WebSocket(wsUrl);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            receivedEvents.push(event);

            if (event.type === 'mcp:install-complete') {
              try {
                // Should only receive the complete event, not start or progress
                expect(receivedEvents.length).toBe(1);
                expect(event.type).toBe('mcp:install-complete');

                ws.close();
                resolve();
              } catch (error) {
                ws.close();
                reject(error);
              }
            }
          });

          // Emit multiple events, but client should only receive the filtered one
          mockOrchestrator.emit('mcp:install-start', {
            serverId: 'filtered-test',
            stage: 'starting',
            progress: 0,
            message: 'Starting',
            timestamp: new Date(),
          });

          mockOrchestrator.emit('mcp:install-progress', {
            serverId: 'filtered-test',
            stage: 'progress',
            progress: 50,
            message: 'In progress',
            timestamp: new Date(),
          });

          mockOrchestrator.emit('mcp:install-complete', {
            serverId: 'filtered-test',
            stage: 'complete',
            progress: 100,
            message: 'Completed',
            timestamp: new Date(),
          });
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Test timeout')), 5000);
      });
    });

    it('handles multiple clients with different event filters', async () => {
      const client1Events: any[] = [];
      const client2Events: any[] = [];

      const ws1 = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-installation?eventFilters=mcp:install-start`);
      const ws2 = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-installation?eventFilters=mcp:install-error`);

      return new Promise<void>((resolve, reject) => {
        let connectionsReady = 0;

        const checkCompletion = () => {
          if (client1Events.length > 0 && client2Events.length > 0) {
            try {
              // Client 1 should only receive start events
              expect(client1Events.every(e => e.type === 'mcp:install-start')).toBe(true);
              // Client 2 should only receive error events
              expect(client2Events.every(e => e.type === 'mcp:install-error')).toBe(true);

              ws1.close();
              ws2.close();
              resolve();
            } catch (error) {
              ws1.close();
              ws2.close();
              reject(error);
            }
          }
        };

        const handleConnectionReady = () => {
          connectionsReady++;
          if (connectionsReady === 2) {
            // Emit various events
            mockOrchestrator.emit('mcp:install-start', {
              serverId: 'multi-client-test',
              stage: 'starting',
              progress: 0,
              message: 'Starting',
              timestamp: new Date(),
            });

            mockOrchestrator.emit('mcp:install-progress', {
              serverId: 'multi-client-test',
              stage: 'progress',
              progress: 50,
              message: 'In progress',
              timestamp: new Date(),
            });

            mockOrchestrator.emit('mcp:install-error', {
              serverId: 'multi-client-test',
              stage: 'error',
              progress: 0,
              message: 'Failed',
              error: 'Test error',
              timestamp: new Date(),
            });

            // Wait a bit for events to be processed
            setTimeout(checkCompletion, 100);
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

        setTimeout(() => reject(new Error('Test timeout')), 5000);
      });
    });

    it('properly cleans up clients when disconnected', async () => {
      const ws = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-installation`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          // Verify client is registered
          expect(clients.get('mcp-installation')?.size).toBe(1);

          // Close connection
          ws.close();
        });

        ws.on('close', () => {
          // Wait a bit for cleanup to complete
          setTimeout(() => {
            expect(clients.get('mcp-installation')?.size || 0).toBe(0);
            resolve();
          }, 100);
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Test timeout')), 5000);
      });
    });
  });

  describe('Real-time Event Flow', () => {
    it('handles rapid succession of events without message loss', async () => {
      const receivedEvents: any[] = [];
      const ws = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-installation`);
      const eventCount = 20;

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            receivedEvents.push(event);

            if (receivedEvents.length >= eventCount) {
              try {
                expect(receivedEvents.length).toBe(eventCount);

                // Verify events are in order (using sequence numbers)
                for (let i = 0; i < eventCount; i++) {
                  expect(receivedEvents[i].data.sequence).toBe(i);
                }

                ws.close();
                resolve();
              } catch (error) {
                ws.close();
                reject(error);
              }
            }
          });

          // Rapidly emit events
          for (let i = 0; i < eventCount; i++) {
            mockOrchestrator.emit('mcp:install-progress', {
              serverId: 'rapid-test',
              stage: 'progress',
              progress: (i / eventCount) * 100,
              message: `Progress ${i}`,
              sequence: i, // Add sequence for verification
              timestamp: new Date(),
            });
          }
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Test timeout')), 5000);
      });
    });

    it('provides automatic timestamp when not provided', async () => {
      const receivedEvents: any[] = [];
      const ws = new WebSocket(`ws://localhost:${server.server.address()?.port}/stream/mcp-installation`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            receivedEvents.push(event);

            if (event.type === 'mcp:install-start') {
              try {
                expect(event.timestamp).toBeInstanceOf(Date);
                // Timestamp should be recent (within last 5 seconds)
                const timeDiff = Date.now() - new Date(event.timestamp).getTime();
                expect(timeDiff).toBeLessThan(5000);

                ws.close();
                resolve();
              } catch (error) {
                ws.close();
                reject(error);
              }
            }
          });

          // Emit event without timestamp
          mockOrchestrator.emit('mcp:install-start', {
            serverId: 'timestamp-test',
            stage: 'starting',
            progress: 0,
            message: 'Starting',
            // No timestamp provided
          });
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Test timeout')), 5000);
      });
    });
  });
});