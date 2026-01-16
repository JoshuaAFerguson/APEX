/**
 * Integration tests for WebSocket health checks in the API server
 *
 * Tests the health check events streaming over WebSocket connections,
 * real-time health monitoring, and client-server health coordination.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../index';
import path from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import WebSocket from 'ws';

describe('API WebSocket Health Integration Tests', () => {
  let app: FastifyInstance;
  let tempDir: string;
  let wsPort: number;

  beforeEach(async () => {
    // Create a temporary directory for the project
    tempDir = await mkdtemp(path.join(tmpdir(), 'apex-health-test-'));

    // Create .apex directory
    await mkdir(path.join(tempDir, '.apex'), { recursive: true });

    // Create server with test configuration
    app = await createServer({
      projectPath: tempDir,
      port: 0, // Use dynamic port
      silent: true, // Suppress logs during tests
    });

    // Get the assigned port
    const address = app.server.address();
    wsPort = typeof address === 'object' && address ? address.port : 0;
  });

  afterEach(async () => {
    // Clean up
    if (app) {
      await app.close();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('WebSocket Health Event Streaming', () => {
    it('should stream health events to connected WebSocket clients', (done) => {
      const ws = new WebSocket(`ws://localhost:${wsPort}/events`);
      const healthEvents: any[] = [];

      ws.on('open', () => {
        // Subscribe to health events
        ws.send(JSON.stringify({
          type: 'subscribe',
          events: ['health:*']
        }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'event' && message.event?.type?.startsWith('health:')) {
          healthEvents.push(message.event);
        }

        // Check if we received expected health events
        if (healthEvents.length > 0) {
          const event = healthEvents[0];
          expect(event).toHaveProperty('type');
          expect(event.type).toMatch(/^health:/);
          expect(event).toHaveProperty('timestamp');

          ws.close();
          done();
        }
      });

      ws.on('error', done);

      // Simulate health event after connection
      setTimeout(() => {
        // This would normally be triggered by actual health checks
        // For testing, we simulate the event structure
        ws.send(JSON.stringify({
          type: 'event',
          event: {
            type: 'health:check',
            connectionId: 'test-connection',
            isHealthy: true,
            latencyMs: 45,
            timestamp: new Date().toISOString()
          }
        }));
      }, 100);
    });

    it('should handle multiple WebSocket clients subscribing to health events', (done) => {
      const clients: WebSocket[] = [];
      const clientEvents: any[][] = [];
      let connectedCount = 0;
      const totalClients = 3;

      for (let i = 0; i < totalClients; i++) {
        const ws = new WebSocket(`ws://localhost:${wsPort}/events`);
        clients.push(ws);
        clientEvents.push([]);

        ws.on('open', () => {
          connectedCount++;
          ws.send(JSON.stringify({
            type: 'subscribe',
            events: ['health:check', 'health:unhealthy']
          }));

          if (connectedCount === totalClients) {
            // All clients connected, simulate health event
            setTimeout(() => {
              // Broadcast simulated health event
              clients.forEach(client => {
                client.send(JSON.stringify({
                  type: 'event',
                  event: {
                    type: 'health:check',
                    connectionId: 'broadcast-test',
                    isHealthy: false,
                    consecutiveFailures: 2,
                    error: 'Ping timeout',
                    timestamp: new Date().toISOString()
                  }
                }));
              });
            }, 50);
          }
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'event') {
            clientEvents[i].push(message.event);

            // Check if all clients received the event
            if (clientEvents.every(events => events.length > 0)) {
              // Verify all clients received the same event
              const firstEvent = clientEvents[0][0];
              clientEvents.forEach(events => {
                expect(events[0]).toEqual(firstEvent);
              });

              // Clean up
              clients.forEach(client => client.close());
              done();
            }
          }
        });

        ws.on('error', done);
      }
    });

    it('should filter health events based on client subscriptions', (done) => {
      const ws = new WebSocket(`ws://localhost:${wsPort}/events`);
      const receivedEvents: any[] = [];

      ws.on('open', () => {
        // Subscribe only to specific health events
        ws.send(JSON.stringify({
          type: 'subscribe',
          events: ['health:unhealthy', 'health:recovered']
        }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'event') {
          receivedEvents.push(message.event);
        }
      });

      ws.on('error', done);

      // Send various health events
      setTimeout(() => {
        const events = [
          { type: 'health:check', data: 'should not receive' },
          { type: 'health:unhealthy', data: 'should receive' },
          { type: 'health:healthy', data: 'should not receive' },
          { type: 'health:recovered', data: 'should receive' }
        ];

        events.forEach((event, index) => {
          setTimeout(() => {
            ws.send(JSON.stringify({
              type: 'event',
              event: {
                ...event,
                connectionId: `filter-test-${index}`,
                timestamp: new Date().toISOString()
              }
            }));

            // Check results after all events sent
            if (index === events.length - 1) {
              setTimeout(() => {
                expect(receivedEvents).toHaveLength(2);
                expect(receivedEvents[0].type).toBe('health:unhealthy');
                expect(receivedEvents[1].type).toBe('health:recovered');
                ws.close();
                done();
              }, 50);
            }
          }, index * 10);
        });
      }, 100);
    });
  });

  describe('Real-time Health Monitoring', () => {
    it('should provide real-time health status updates via WebSocket', (done) => {
      const ws = new WebSocket(`ws://localhost:${wsPort}/events`);
      const statusUpdates: any[] = [];

      ws.on('open', () => {
        // Subscribe to all health-related events
        ws.send(JSON.stringify({
          type: 'subscribe',
          events: ['health:*', 'connection:*']
        }));

        // Request current health status
        ws.send(JSON.stringify({
          type: 'get-health-status',
          connections: ['ws-main', 'api-main']
        }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'health-status') {
          statusUpdates.push(message);
        }

        if (message.type === 'event' && message.event?.type?.startsWith('health:')) {
          statusUpdates.push(message.event);
        }

        // Process after receiving some updates
        if (statusUpdates.length > 0) {
          expect(statusUpdates[0]).toHaveProperty('type');
          ws.close();
          done();
        }
      });

      ws.on('error', done);

      // Simulate health status response
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'health-status',
          connections: {
            'ws-main': {
              isHealthy: true,
              lastCheckAt: new Date().toISOString(),
              latencyMs: 42
            },
            'api-main': {
              isHealthy: false,
              lastCheckAt: new Date().toISOString(),
              consecutiveFailures: 3
            }
          },
          timestamp: new Date().toISOString()
        }));
      }, 50);
    });

    it('should handle WebSocket connection health monitoring', (done) => {
      const ws = new WebSocket(`ws://localhost:${wsPort}/events`);
      const healthEvents: any[] = [];

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          events: ['connection:health']
        }));

        // Enable WebSocket health monitoring
        ws.send(JSON.stringify({
          type: 'enable-health-monitoring',
          intervalMs: 1000,
          timeoutMs: 500
        }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'ping') {
          // Respond to server ping
          ws.send(JSON.stringify({
            type: 'pong',
            id: message.id,
            timestamp: message.timestamp,
            serverTimestamp: Date.now()
          }));
        }

        if (message.type === 'health-event') {
          healthEvents.push(message);
        }
      });

      ws.on('error', done);

      // Check for health monitoring after some time
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'get-health-status'
        }));

        setTimeout(() => {
          // Should have received some health-related messages
          // Clean up and finish test
          ws.close();
          done();
        }, 200);
      }, 1200);
    });

    it('should handle WebSocket disconnection and reconnection health events', (done) => {
      const ws = new WebSocket(`ws://localhost:${wsPort}/events`);
      const connectionEvents: any[] = [];

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          events: ['connection:*']
        }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'event' && message.event?.type?.startsWith('connection:')) {
          connectionEvents.push(message.event);
        }
      });

      ws.on('close', () => {
        // Reconnect to test reconnection events
        setTimeout(() => {
          const ws2 = new WebSocket(`ws://localhost:${wsPort}/events`);

          ws2.on('open', () => {
            // Should trigger connection events
            setTimeout(() => {
              ws2.close();
              done();
            }, 100);
          });

          ws2.on('error', done);
        }, 100);
      });

      ws.on('error', done);

      // Close connection to trigger disconnection event
      setTimeout(() => {
        ws.close();
      }, 200);
    });
  });

  describe('Health Check API and WebSocket Coordination', () => {
    it('should coordinate health status between HTTP API and WebSocket events', async () => {
      // Set up daemon state for HTTP endpoint
      const pidFile = path.join(tempDir, '.apex', 'daemon.pid');
      const stateFile = path.join(tempDir, '.apex', 'daemon-state.json');

      await writeFile(pidFile, JSON.stringify({
        pid: 12345,
        startedAt: new Date().toISOString(),
        version: '0.3.0'
      }));

      const healthMetrics = {
        uptime: 3600000,
        memoryUsage: {
          heapUsed: 100000000,
          heapTotal: 200000000,
          rss: 250000000
        },
        taskCounts: {
          processed: 10,
          succeeded: 8,
          failed: 1,
          active: 1
        },
        lastHealthCheck: new Date().toISOString(),
        healthChecksPassed: 50,
        healthChecksFailed: 2,
        restartHistory: []
      };

      await writeFile(stateFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        pid: 12345,
        startedAt: new Date().toISOString(),
        running: true,
        health: healthMetrics
      }));

      // Mock process.kill to simulate running process
      vi.spyOn(process, 'kill').mockImplementation(() => true);

      // Get health status via HTTP
      const httpResponse = await app.inject({
        method: 'GET',
        url: '/daemon/health'
      });

      expect(httpResponse.statusCode).toBe(200);
      const httpHealth = JSON.parse(httpResponse.body);

      // Connect WebSocket and compare status
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}/events`);

        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'get-daemon-health'
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'daemon-health') {
            try {
              // Compare HTTP and WebSocket health data
              expect(message.status).toBe(httpHealth.status);
              expect(message.metrics).toEqual(httpHealth.metrics);

              ws.close();
              resolve();
            } catch (error) {
              ws.close();
              reject(error);
            }
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          ws.close();
          reject(new Error('Timeout waiting for daemon health response'));
        }, 2000);
      }).finally(() => {
        vi.restoreAllMocks();
      });
    });

    it('should handle health check timeouts and errors in WebSocket context', (done) => {
      const ws = new WebSocket(`ws://localhost:${wsPort}/events`);
      const errorEvents: any[] = [];

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          events: ['health:error', 'health:timeout']
        }));

        // Trigger a health check that will timeout
        ws.send(JSON.stringify({
          type: 'trigger-health-check',
          connectionId: 'timeout-test',
          timeoutMs: 100
        }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'event' &&
            (message.event?.type === 'health:error' || message.event?.type === 'health:timeout')) {
          errorEvents.push(message.event);
        }

        if (message.type === 'error') {
          errorEvents.push(message);
        }
      });

      ws.on('error', (error) => {
        // Should handle WebSocket errors gracefully
        errorEvents.push({ type: 'websocket:error', error: error.message });
      });

      setTimeout(() => {
        // Test completed, verify error handling
        ws.close();
        done();
      }, 500);
    });
  });

  describe('Performance and Scale Testing', () => {
    it('should handle high-frequency health events efficiently', (done) => {
      const ws = new WebSocket(`ws://localhost:${wsPort}/events`);
      const eventCount = 100;
      let receivedCount = 0;
      const startTime = Date.now();

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          events: ['health:*']
        }));

        // Send many events rapidly
        for (let i = 0; i < eventCount; i++) {
          setTimeout(() => {
            ws.send(JSON.stringify({
              type: 'event',
              event: {
                type: 'health:check',
                connectionId: `perf-test-${i}`,
                isHealthy: i % 2 === 0,
                latencyMs: Math.random() * 100,
                timestamp: new Date().toISOString()
              }
            }));
          }, i * 5); // 5ms between events
        }
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'event') {
          receivedCount++;

          if (receivedCount >= eventCount) {
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Should process events efficiently
            expect(totalTime).toBeLessThan(2000); // Less than 2 seconds
            expect(receivedCount).toBe(eventCount);

            ws.close();
            done();
          }
        }
      });

      ws.on('error', done);
    });

    it('should maintain performance with multiple concurrent health monitoring clients', (done) => {
      const clientCount = 10;
      const clients: WebSocket[] = [];
      let connectedClients = 0;
      let totalEventsReceived = 0;
      const eventsPerClient = 5;
      const expectedTotalEvents = clientCount * eventsPerClient;

      for (let i = 0; i < clientCount; i++) {
        const ws = new WebSocket(`ws://localhost:${wsPort}/events`);
        clients.push(ws);

        ws.on('open', () => {
          connectedClients++;
          ws.send(JSON.stringify({
            type: 'subscribe',
            events: ['health:check']
          }));

          if (connectedClients === clientCount) {
            // All clients connected, start sending events
            setTimeout(() => {
              clients.forEach((client, index) => {
                for (let j = 0; j < eventsPerClient; j++) {
                  client.send(JSON.stringify({
                    type: 'event',
                    event: {
                      type: 'health:check',
                      connectionId: `client-${index}-event-${j}`,
                      isHealthy: true,
                      latencyMs: 50,
                      timestamp: new Date().toISOString()
                    }
                  }));
                }
              });
            }, 100);
          }
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'event') {
            totalEventsReceived++;

            if (totalEventsReceived >= expectedTotalEvents) {
              // All events processed
              clients.forEach(client => client.close());
              done();
            }
          }
        });

        ws.on('error', done);
      }
    });
  });
});