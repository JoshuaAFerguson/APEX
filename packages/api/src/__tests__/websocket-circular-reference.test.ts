import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import WebSocket from 'ws';
import { createServer, ServerOptions } from '../index';
import { FastifyInstance } from 'fastify';

// Mock the orchestrator with circular reference event capability
vi.mock('@apexcli/orchestrator', () => {
  const mockTask = {
    id: 'task_circular_test',
    description: 'Circular reference test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: '/test',
    branchName: 'apex/circular-test',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
    logs: [],
    artifacts: [],
    trashedAt: undefined,
    archivedAt: undefined,
  };

  class MockOrchestrator {
    private tasks: Map<string, any> = new Map();
    private listeners: Map<string, Function[]> = new Map();

    async initialize() {}

    async createTask(options: { description: string }) {
      const task = {
        ...mockTask,
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        description: options.description
      };
      this.tasks.set(task.id, task);
      this.emit('task:created', task);
      return task;
    }

    async getTask(taskId: string) {
      return this.tasks.get(taskId) || null;
    }

    async listTasks() {
      return Array.from(this.tasks.values());
    }

    // Method to emit events with circular references for testing
    async emitCircularEvent(taskId: string) {
      const task = this.tasks.get(taskId);
      if (!task) return;

      // Create an event with circular references to test safeSerialize
      const circularEvent: any = {
        type: 'task:circular-data',
        taskId: taskId,
        timestamp: new Date().toISOString(),
        data: {
          task: task,
          metadata: {
            source: 'test',
            level: 'info'
          }
        }
      };

      // Add circular references
      circularEvent.data.self = circularEvent;
      circularEvent.data.task.parentEvent = circularEvent;
      circularEvent.data.metadata.event = circularEvent;

      // Create nested circular references
      const nested: any = {
        level1: {
          level2: {
            level3: {}
          }
        }
      };
      nested.level1.level2.level3.backToRoot = nested;
      circularEvent.data.nested = nested;

      // Array with circular reference
      const circularArray: any = [1, 2, 3];
      circularArray.push(circularArray);
      circularEvent.data.circularArray = circularArray;

      // Multiple interconnected objects
      const objA: any = { name: 'A' };
      const objB: any = { name: 'B' };
      objA.ref = objB;
      objB.ref = objA;
      circularEvent.data.interconnected = { a: objA, b: objB };

      this.emit('task:circular-data', circularEvent);
    }

    // Standard mock methods
    async executeTask() {}
    async updateTaskStatus() {}
    async trashTask() {}
    async restoreTask() {}
    async listTrashedTasks() { return []; }
    async emptyTrash() { return 0; }
    async archiveTask() {}
    async unarchiveTask() {}
    async listArchivedTasks() { return []; }
    async cancelTask() { return true; }
    async resumePausedTask() { return true; }
    async hasPendingSubtasks() { return false; }
    async continuePendingSubtasks() {}
    async getAgents() { return {}; }
    async getConfig() { return { project: { name: 'circular-test' }, api: { auth: { enabled: false, apiKeys: [] } } }; }
    async approveGate() {}
    async rejectGate() {}
    async getAllGates() { return []; }

    on(event: string, listener: Function) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event)!.push(listener);
    }

    emit(event: string, ...args: any[]) {
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.forEach(listener => {
          try {
            listener(...args);
          } catch (error) {
            console.error(`Error in event listener for ${event}:`, error);
          }
        });
      }
    }
  }

  return { ApexOrchestrator: MockOrchestrator, DaemonManager: class { async getStatus() { return { running: false }; } async start() {} async stop() {} }, HealthMonitor: class { getMetrics() { return {}; } checkHealth() { return { healthy: true }; } }, ToolCallStartEvent: class {}, ToolCallProgressEvent: class {}, ToolCallCompleteEvent: class {}, MCPErrorEventData: class {}, MCPConnectionEventData: class {}, MCPDisconnectionEventData: class {}, MCPReconnectingEventData: class {}, MCPHealthCheckEventData: class {}, MCPStateChangeEventData: class {} };
});

describe.skip('WebSocket Circular Reference Handling', () => {
  let server: FastifyInstance;
  let testDir: string;
  let port: number;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-circular-test-'));

    // Create minimal config
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `version: "1.0"\nproject:\n  name: test-circular\n`
    );

    const options: ServerOptions = {
      port: 0, // Let OS assign port
      host: '127.0.0.1',
      projectPath: testDir,
      silent: true,
    };

    server = await createServer(options);
    await server.listen({ port: 0, host: '127.0.0.1' });
    const address = server.server.address();
    port = (typeof address === 'object' && address !== null) ? address.port : 0;
  });

  afterEach(async () => {
    await server.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Circular Reference Serialization', () => {
    it('should handle WebSocket events with circular references without crashing the server', async () => {
      // Create a task
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Circular reference test task' },
      });

      expect(createResponse.statusCode).toBe(200);
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          try {
            // Access the orchestrator instance to trigger circular event
            const orchestratorInstance = (server as any).orchestrator;
            await orchestratorInstance.emitCircularEvent(taskId);
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          try {
            const event = JSON.parse(data.toString());
            receivedEvents.push(event);

            if (event.type === 'task:circular-data') {
              // Verify that the event was properly serialized
              expect(event.taskId).toBe(taskId);
              expect(event.data).toBeDefined();
              expect(event.data.task).toBeDefined();
              expect(event.data.task.id).toBe(taskId);

              // Verify circular references are replaced with '[Circular]'
              expect(event.data.self).toBe('[Circular]');
              expect(event.data.task.parentEvent).toBe('[Circular]');
              expect(event.data.metadata.event).toBe('[Circular]');

              // Verify nested circular reference handling
              expect(event.data.nested.level1.level2.level3.backToRoot).toBe('[Circular]');

              // Verify circular array handling
              expect(Array.isArray(event.data.circularArray)).toBe(true);
              expect(event.data.circularArray[0]).toBe(1);
              expect(event.data.circularArray[1]).toBe(2);
              expect(event.data.circularArray[2]).toBe(3);
              expect(event.data.circularArray[3]).toBe('[Circular]');

              // Verify interconnected objects
              expect(event.data.interconnected.a.name).toBe('A');
              expect(event.data.interconnected.b.name).toBe('B');
              expect(event.data.interconnected.a.ref.name).toBe('B');
              expect(event.data.interconnected.b.ref).toBe('[Circular]');

              ws.close();
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error(`Timeout: Expected circular event not received. Got events: ${receivedEvents.map(e => e.type).join(', ')}`));
        }, 5000);
      });
    });

    it('should handle multiple WebSocket clients receiving circular reference events', async () => {
      // Create a task
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Multi-client circular reference test' },
      });

      const { taskId } = JSON.parse(createResponse.body);

      // Create multiple WebSocket connections
      const clientCount = 3;
      const clients = Array.from({ length: clientCount }, (_, i) => ({
        id: i,
        ws: new WebSocket(`ws://localhost:${port}/stream/${taskId}`),
        events: [] as any[]
      }));

      let connectionsReady = 0;
      let eventReceived = 0;

      return new Promise<void>((resolve, reject) => {
        clients.forEach(client => {
          client.ws.on('open', () => {
            connectionsReady++;
            if (connectionsReady === clientCount) {
              // All clients connected, trigger circular event
              const orchestratorInstance = (server as any).orchestrator;
              orchestratorInstance.emitCircularEvent(taskId);
            }
          });

          client.ws.on('message', (data) => {
            try {
              const event = JSON.parse(data.toString());
              client.events.push(event);

              if (event.type === 'task:circular-data') {
                eventReceived++;

                // Verify circular references are properly handled for this client
                expect(event.data.self).toBe('[Circular]');
                expect(event.data.task.parentEvent).toBe('[Circular]');
                expect(event.data.nested.level1.level2.level3.backToRoot).toBe('[Circular]');

                // Check if all clients received the event
                if (eventReceived === clientCount) {
                  // Verify all clients got the same event structure
                  const firstEvent = clients[0].events.find(e => e.type === 'task:circular-data');

                  clients.forEach(client => {
                    const circularEvent = client.events.find(e => e.type === 'task:circular-data');
                    expect(circularEvent.taskId).toBe(firstEvent.taskId);
                    expect(circularEvent.data.self).toBe('[Circular]');
                    expect(circularEvent.data.task.parentEvent).toBe('[Circular]');
                  });

                  // Clean up
                  clients.forEach(client => client.ws.close());
                  resolve();
                }
              }
            } catch (error) {
              reject(error);
            }
          });

          client.ws.on('error', reject);
        });

        setTimeout(() => {
          reject(new Error(`Timeout: Not all clients received circular events. Received: ${eventReceived}/${clientCount}`));
        }, 5000);
      });
    });

    it('should maintain server stability after processing many circular reference events', async () => {
      // Create a task
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Stress test circular references' },
      });

      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      let eventsReceived = 0;
      const eventCount = 10;

      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          try {
            const orchestratorInstance = (server as any).orchestrator;

            // Emit multiple circular events rapidly
            for (let i = 0; i < eventCount; i++) {
              await orchestratorInstance.emitCircularEvent(taskId);
              // Small delay to allow processing
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          try {
            const event = JSON.parse(data.toString());

            if (event.type === 'task:circular-data') {
              eventsReceived++;

              // Verify each event is properly serialized
              expect(event.data.self).toBe('[Circular]');
              expect(event.data.task.parentEvent).toBe('[Circular]');

              if (eventsReceived === eventCount) {
                // Verify server is still responsive
                server.inject({
                  method: 'GET',
                  url: `/tasks/${taskId}`,
                }).then(response => {
                  expect(response.statusCode).toBe(200);
                  ws.close();
                  resolve();
                }).catch(reject);
              }
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error(`Timeout: Stress test failed. Received ${eventsReceived}/${eventCount} events`));
        }, 10000);
      });
    });

    it('should handle deeply nested circular references', async () => {
      // Create a task
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Deep circular reference test' },
      });

      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          try {
            // Create a deeply nested circular structure
            const orchestratorInstance = (server as any).orchestrator;
            const task = await orchestratorInstance.getTask(taskId);

            // Create a deep structure with circular references at various levels
            const deepEvent: any = {
              type: 'task:deep-circular',
              taskId: taskId,
              data: {
                level0: {
                  level1: {
                    level2: {
                      level3: {
                        level4: {
                          level5: {
                            task: task
                          }
                        }
                      }
                    }
                  }
                }
              }
            };

            // Add circular references at different levels
            deepEvent.data.level0.root = deepEvent;
            deepEvent.data.level0.level1.parent = deepEvent.data.level0;
            deepEvent.data.level0.level1.level2.grandparent = deepEvent.data;
            deepEvent.data.level0.level1.level2.level3.level4.level5.deepRoot = deepEvent;

            orchestratorInstance.emit('task:deep-circular', deepEvent);
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          try {
            const event = JSON.parse(data.toString());

            if (event.type === 'task:deep-circular') {
              // Verify deep circular references are handled
              expect(event.data.level0.root).toBe('[Circular]');
              expect(event.data.level0.level1.parent).toBe('[Circular]');
              expect(event.data.level0.level1.level2.grandparent).toBe('[Circular]');
              expect(event.data.level0.level1.level2.level3.level4.level5.deepRoot).toBe('[Circular]');

              // Verify non-circular data is preserved
              expect(event.data.level0.level1.level2.level3.level4.level5.task.id).toBe(taskId);

              ws.close();
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error('Timeout: Deep circular reference test failed'));
        }, 5000);
      });
    });
  });
});