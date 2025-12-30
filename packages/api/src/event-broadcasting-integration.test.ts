import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import WebSocket from 'ws';
import { createServer, ServerOptions } from './index';
import { FastifyInstance } from 'fastify';

// Mock the orchestrator with enhanced event emission capabilities
vi.mock('@apexcli/orchestrator', () => {
  const mockTask: {
    id: string;
    description: string;
    workflow: string;
    autonomy: string;
    status: string;
    priority: string;
    effort: string;
    projectPath: string;
    branchName: string;
    retryCount: number;
    maxRetries: number;
    resumeAttempts: number;
    createdAt: Date;
    updatedAt: Date;
    usage: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCost: number };
    logs: never[];
    artifacts: never[];
    trashedAt: Date | undefined;
    archivedAt: Date | undefined;
  } = {
    id: 'task_integration_test',
    description: 'Integration test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: '/test',
    branchName: 'apex/integration-test',
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
    private tasks: Map<string, typeof mockTask> = new Map();
    private listeners: Map<string, Function[]> = new Map();
    private eventHistory: any[] = [];

    async initialize() {}

    async createTask(options: { description: string }) {
      const task = {
        ...mockTask,
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        description: options.description
      };
      this.tasks.set(task.id, task);

      // Emit task created event
      this.emit('task:created', task);
      return task;
    }

    async executeTask(taskId: string) {
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = 'in-progress';
        this.emit('task:started', task);
      }
    }

    async getTask(taskId: string) {
      return this.tasks.get(taskId) || null;
    }

    async listTasks() {
      return Array.from(this.tasks.values());
    }

    async updateTaskStatus(taskId: string, status: string) {
      const task = this.tasks.get(taskId);
      if (task) {
        const oldStatus = task.status;
        task.status = status;

        // Emit appropriate events based on status change
        if (status === 'completed') {
          this.emit('task:completed', task);
        } else if (status === 'failed') {
          this.emit('task:failed', task, new Error('Test failure'));
        }
      }
    }

    // Full lifecycle test methods with proper event emission
    async trashTask(taskId: string) {
      const task = this.tasks.get(taskId);
      if (!task) throw new Error(`Task with ID ${taskId} not found`);
      if (task.trashedAt) throw new Error(`Task with ID ${taskId} is already in trash`);

      task.trashedAt = new Date();
      task.status = 'cancelled';
      this.emit('task:trashed', task);
    }

    async restoreTask(taskId: string) {
      const task = this.tasks.get(taskId);
      if (!task) throw new Error(`Task with ID ${taskId} not found`);
      if (!task.trashedAt) throw new Error(`Task with ID ${taskId} is not in trash`);

      task.trashedAt = undefined;
      task.status = 'pending';
      this.emit('task:restored', task);
    }

    async listTrashedTasks() {
      return Array.from(this.tasks.values()).filter(task => task.trashedAt);
    }

    async emptyTrash() {
      const trashedTasks = Array.from(this.tasks.values()).filter(task => task.trashedAt);
      const taskIds = trashedTasks.map(task => task.id);
      const deletedCount = trashedTasks.length;

      trashedTasks.forEach(task => this.tasks.delete(task.id));
      this.emit('trash:emptied', deletedCount, taskIds);

      return deletedCount;
    }

    async archiveTask(taskId: string) {
      const task = this.tasks.get(taskId);
      if (!task) throw new Error(`Task with ID ${taskId} not found`);
      if (task.status !== 'completed') {
        throw new Error(`Cannot archive task ${taskId}: only completed tasks can be archived (current status: ${task.status})`);
      }
      if (task.archivedAt) throw new Error(`Task with ID ${taskId} is already archived`);

      task.archivedAt = new Date();
      this.emit('task:archived', task);
    }

    async unarchiveTask(taskId: string) {
      const task = this.tasks.get(taskId);
      if (!task) throw new Error(`Task with ID ${taskId} not found`);
      if (!task.archivedAt) throw new Error(`Task with ID ${taskId} is not archived`);

      task.archivedAt = undefined;
      this.emit('task:unarchived', task);
    }

    async listArchivedTasks() {
      return Array.from(this.tasks.values()).filter(task => task.archivedAt);
    }

    // Additional mock methods
    async cancelTask() { return true; }
    async resumePausedTask() { return true; }
    async hasPendingSubtasks() { return false; }
    async continuePendingSubtasks() {}
    async getAgents() { return {}; }
    async getConfig() { return { project: { name: 'integration-test' } }; }
    async approveGate() {}
    async rejectGate() {}
    async getAllGates() { return []; }

    // Enhanced event system for integration testing
    on(event: string, listener: Function) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event)!.push(listener);
    }

    emit(event: string, ...args: any[]) {
      // Record event in history for testing
      this.eventHistory.push({ event, args, timestamp: new Date() });

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

    getEventHistory() {
      return [...this.eventHistory];
    }

    clearEventHistory() {
      this.eventHistory = [];
    }
  }

  return { ApexOrchestrator: MockOrchestrator };
});

describe('WebSocket Event Broadcasting Integration Tests', () => {
  let server: FastifyInstance;
  let testDir: string;
  let port: number;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-api-integration-'));

    // Create minimal config
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `version: "1.0"\nproject:\n  name: test-integration\n`
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

  describe('End-to-End Task Lifecycle with WebSocket Events', () => {
    it('should handle complete task lifecycle: create → trash → restore → complete → archive', async () => {
      // Create a task
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Full lifecycle integration test task' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];
      const expectedEventOrder = ['task:state', 'task:created', 'task:trashed', 'task:restored', 'task:stage-changed', 'task:archived'];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          try {
            // Step 1: Move to trash
            await server.inject({
              method: 'POST',
              url: `/tasks/${taskId}/trash`,
            });

            // Step 2: Restore from trash
            await server.inject({
              method: 'POST',
              url: `/tasks/${taskId}/restore`,
            });

            // Step 3: Complete the task
            await server.inject({
              method: 'POST',
              url: `/tasks/${taskId}/status`,
              headers: { 'Content-Type': 'application/json' },
              payload: { status: 'completed', stage: 'final', message: 'Task completed' },
            });

            // Step 4: Archive the task
            await server.inject({
              method: 'POST',
              url: `/tasks/${taskId}/archive`,
            });

          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          // Check if we've received the archive event (last in sequence)
          if (event.type === 'task:archived') {
            try {
              // Verify all expected events were received
              const eventTypes = receivedEvents.map(e => e.type);

              // Check for presence of key lifecycle events
              expect(eventTypes).toContain('task:created');
              expect(eventTypes).toContain('task:trashed');
              expect(eventTypes).toContain('task:restored');
              expect(eventTypes).toContain('task:stage-changed');
              expect(eventTypes).toContain('task:archived');

              // Verify event data integrity
              const trashedEvent = receivedEvents.find(e => e.type === 'task:trashed');
              expect(trashedEvent.data.task.id).toBe(taskId);
              expect(trashedEvent.data.trashedAt).toBeDefined();

              const restoredEvent = receivedEvents.find(e => e.type === 'task:restored');
              expect(restoredEvent.data.task.id).toBe(taskId);
              expect(restoredEvent.data.status).toBe('pending');

              const archivedEvent = receivedEvents.find(e => e.type === 'task:archived');
              expect(archivedEvent.data.task.id).toBe(taskId);
              expect(archivedEvent.data.archivedAt).toBeDefined();

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error(`Timeout: Expected events not received. Got: ${receivedEvents.map(e => e.type).join(', ')}`));
        }, 10000);
      });
    });
  });

  describe('Bulk Operations Integration', () => {
    it('should handle bulk trash operations with proper event broadcasting', async () => {
      // Create multiple tasks
      const taskCount = 5;
      const taskIds: string[] = [];

      for (let i = 0; i < taskCount; i++) {
        const response = await server.inject({
          method: 'POST',
          url: '/tasks',
          headers: { 'Content-Type': 'application/json' },
          payload: { description: `Bulk test task ${i + 1}` },
        });
        taskIds.push(JSON.parse(response.body).taskId);
      }

      // Set up WebSocket connections for each task
      const connections = taskIds.map(taskId => ({
        taskId,
        ws: new WebSocket(`ws://localhost:${port}/stream/${taskId}`),
        events: [] as any[]
      }));

      // Set up global WebSocket for trash:emptied event
      const globalWs = new WebSocket(`ws://localhost:${port}/stream/0`);
      const globalEvents: any[] = [];

      let connectionsReady = 0;
      const totalConnections = connections.length + 1; // +1 for global

      return new Promise<void>((resolve, reject) => {
        const checkReady = () => {
          connectionsReady++;
          if (connectionsReady === totalConnections) {
            // All connections ready, start bulk operations
            performBulkOperations();
          }
        };

        // Set up event listeners for each task
        connections.forEach(({ ws, events }) => {
          ws.on('open', checkReady);
          ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            events.push(event);
          });
          ws.on('error', reject);
        });

        // Set up global event listener
        globalWs.on('open', checkReady);
        globalWs.on('message', (data) => {
          const event = JSON.parse(data.toString());
          globalEvents.push(event);

          if (event.type === 'trash:emptied') {
            try {
              // Verify trash emptied event
              expect(event.data.deletedCount).toBe(taskCount);
              expect(event.data.deletedTaskIds).toHaveLength(taskCount);
              expect(event.data.deletedTaskIds).toEqual(expect.arrayContaining(taskIds));

              // Verify each task received the appropriate events
              connections.forEach(({ taskId, events }) => {
                const trashedEvent = events.find(e => e.type === 'task:trashed');
                expect(trashedEvent).toBeDefined();
                expect(trashedEvent.taskId).toBe(taskId);

                const trashEmptiedEvent = events.find(e => e.type === 'trash:emptied');
                expect(trashEmptiedEvent).toBeDefined();
                expect(trashEmptiedEvent.data.deletedTaskIds).toContain(taskId);
              });

              // Clean up connections
              connections.forEach(({ ws }) => ws.close());
              globalWs.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });
        globalWs.on('error', reject);

        const performBulkOperations = async () => {
          try {
            // Move all tasks to trash
            for (const taskId of taskIds) {
              await server.inject({
                method: 'POST',
                url: `/tasks/${taskId}/trash`,
              });
            }

            // Wait a bit for events to propagate
            await new Promise(resolve => setTimeout(resolve, 100));

            // Empty the trash
            await server.inject({
              method: 'DELETE',
              url: '/tasks/trash',
            });
          } catch (error) {
            reject(error);
          }
        };

        setTimeout(() => {
          reject(new Error('Timeout: Bulk operations test failed'));
        }, 15000);
      });
    });
  });

  describe('Concurrent WebSocket Connections', () => {
    it('should handle multiple clients connected to the same task stream', async () => {
      // Create a task
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Multi-client test task' },
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

      return new Promise<void>((resolve, reject) => {
        clients.forEach(client => {
          client.ws.on('open', () => {
            connectionsReady++;
            if (connectionsReady === clientCount) {
              // All clients connected, trigger event
              server.inject({
                method: 'POST',
                url: `/tasks/${taskId}/trash`,
              }).catch(reject);
            }
          });

          client.ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            client.events.push(event);

            // Check if all clients received the trashed event
            if (event.type === 'task:trashed') {
              const allClientsGotEvent = clients.every(c =>
                c.events.some(e => e.type === 'task:trashed')
              );

              if (allClientsGotEvent) {
                try {
                  // Verify all clients received the same event
                  clients.forEach(client => {
                    const trashedEvent = client.events.find(e => e.type === 'task:trashed');
                    expect(trashedEvent).toBeDefined();
                    expect(trashedEvent.taskId).toBe(taskId);
                    expect(trashedEvent.data.task.id).toBe(taskId);
                  });

                  // Clean up
                  clients.forEach(client => client.ws.close());
                  resolve();
                } catch (error) {
                  reject(error);
                }
              }
            }
          });

          client.ws.on('error', reject);
        });

        setTimeout(() => {
          reject(new Error('Timeout: Multi-client test failed'));
        }, 10000);
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle WebSocket disconnections during active operations', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Disconnect handling test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws1 = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const ws2 = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);

      return new Promise<void>((resolve, reject) => {
        let ws1Connected = false;
        let ws2Connected = false;

        ws1.on('open', () => {
          ws1Connected = true;
          if (ws2Connected) {
            // Disconnect first client immediately
            ws1.close();

            // Trigger event after first client disconnects
            setTimeout(async () => {
              try {
                await server.inject({
                  method: 'POST',
                  url: `/tasks/${taskId}/trash`,
                });
              } catch (error) {
                reject(error);
              }
            }, 100);
          }
        });

        ws2.on('open', () => {
          ws2Connected = true;
          if (ws1Connected) {
            // Disconnect first client immediately
            ws1.close();

            // Trigger event after first client disconnects
            setTimeout(async () => {
              try {
                await server.inject({
                  method: 'POST',
                  url: `/tasks/${taskId}/trash`,
                });
              } catch (error) {
                reject(error);
              }
            }, 100);
          }
        });

        // Second client should still receive the event
        ws2.on('message', (data) => {
          const event = JSON.parse(data.toString());

          if (event.type === 'task:trashed') {
            try {
              expect(event.taskId).toBe(taskId);
              expect(event.data.task.id).toBe(taskId);

              ws2.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws1.on('error', (error) => {
          // Ignore errors from intentional disconnection
          if (error.message.includes('close')) {
            return;
          }
          reject(error);
        });

        ws2.on('error', reject);

        setTimeout(() => {
          reject(new Error('Timeout: Disconnect handling test failed'));
        }, 10000);
      });
    });

    it('should continue operating normally after WebSocket errors', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Error recovery test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Create an initial connection that will be closed
      const ws1 = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);

      return new Promise<void>((resolve, reject) => {
        ws1.on('open', () => {
          // Close the connection to simulate an error
          ws1.close();

          // Create a new connection after the first one is closed
          setTimeout(() => {
            const ws2 = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);

            ws2.on('open', async () => {
              try {
                // Trigger an event to ensure the system is still working
                await server.inject({
                  method: 'POST',
                  url: `/tasks/${taskId}/trash`,
                });
              } catch (error) {
                reject(error);
              }
            });

            ws2.on('message', (data) => {
              const event = JSON.parse(data.toString());

              if (event.type === 'task:trashed') {
                try {
                  expect(event.taskId).toBe(taskId);
                  ws2.close();
                  resolve();
                } catch (error) {
                  reject(error);
                }
              }
            });

            ws2.on('error', reject);
          }, 100);
        });

        ws1.on('error', () => {
          // Expected error from closing connection
        });

        setTimeout(() => {
          reject(new Error('Timeout: Error recovery test failed'));
        }, 10000);
      });
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle rapid successive events without losing data', async () => {
      // Create multiple tasks for rapid operations
      const taskCount = 10;
      const taskIds: string[] = [];

      for (let i = 0; i < taskCount; i++) {
        const response = await server.inject({
          method: 'POST',
          url: '/tasks',
          headers: { 'Content-Type': 'application/json' },
          payload: { description: `Rapid test task ${i + 1}` },
        });
        taskIds.push(JSON.parse(response.body).taskId);
      }

      // Connect to all tasks
      const connections = taskIds.map(taskId => ({
        taskId,
        ws: new WebSocket(`ws://localhost:${port}/stream/${taskId}`),
        events: [] as any[]
      }));

      let connectionsReady = 0;

      return new Promise<void>((resolve, reject) => {
        connections.forEach(({ ws, events }) => {
          ws.on('open', () => {
            connectionsReady++;
            if (connectionsReady === taskCount) {
              // All connected, trigger rapid operations
              performRapidOperations();
            }
          });

          ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            events.push(event);
          });

          ws.on('error', reject);
        });

        const performRapidOperations = async () => {
          try {
            // Rapidly trash all tasks
            const trashPromises = taskIds.map(taskId =>
              server.inject({ method: 'POST', url: `/tasks/${taskId}/trash` })
            );

            await Promise.all(trashPromises);

            // Wait for all events to propagate
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Verify all connections received the appropriate events
            connections.forEach(({ taskId, events }) => {
              const trashedEvent = events.find(e => e.type === 'task:trashed' && e.taskId === taskId);
              expect(trashedEvent).toBeDefined();
            });

            // Clean up
            connections.forEach(({ ws }) => ws.close());
            resolve();
          } catch (error) {
            reject(error);
          }
        };

        setTimeout(() => {
          reject(new Error('Timeout: Rapid operations test failed'));
        }, 15000);
      });
    });
  });
});