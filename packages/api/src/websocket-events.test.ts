import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import WebSocket from 'ws';
import { createServer, ServerOptions } from './index';
import { FastifyInstance } from 'fastify';

// Mock the orchestrator to control event emission for testing WebSocket events
vi.mock('@apex/orchestrator', () => {
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
    id: 'task_123_test',
    description: 'Test task for WebSocket events',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: '/test',
    branchName: 'apex/test-websocket-events',
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

    async initialize() {}

    async createTask(options: { description: string }) {
      const task = { ...mockTask, id: `task_${Date.now()}_ws`, description: options.description };
      this.tasks.set(task.id, task);
      return task;
    }

    async executeTask() {}

    async getTask(taskId: string) {
      return this.tasks.get(taskId) || null;
    }

    async listTasks() {
      return Array.from(this.tasks.values());
    }

    async updateTaskStatus(taskId: string, status: string) {
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = status;
      }
    }

    // Lifecycle management methods
    async trashTask(taskId: string) {
      const task = this.tasks.get(taskId);
      if (!task) throw new Error(`Task with ID ${taskId} not found`);
      if (task.trashedAt) throw new Error(`Task with ID ${taskId} is already in trash`);
      task.trashedAt = new Date();
      task.status = 'cancelled';

      // Emit the trashed event
      this.emit('task:trashed', task);
    }

    async restoreTask(taskId: string) {
      const task = this.tasks.get(taskId);
      if (!task) throw new Error(`Task with ID ${taskId} not found`);
      if (!task.trashedAt) throw new Error(`Task with ID ${taskId} is not in trash`);
      task.trashedAt = undefined;
      task.status = 'pending';

      // Emit the restored event
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

      // Emit the trash emptied event
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

      // Emit the archived event
      this.emit('task:archived', task);
    }

    async unarchiveTask(taskId: string) {
      const task = this.tasks.get(taskId);
      if (!task) throw new Error(`Task with ID ${taskId} not found`);
      if (!task.archivedAt) throw new Error(`Task with ID ${taskId} is not archived`);
      task.archivedAt = undefined;

      // Emit the unarchived event
      this.emit('task:unarchived', task);
    }

    async listArchivedTasks() {
      return Array.from(this.tasks.values()).filter(task => task.archivedAt);
    }

    // Additional mock methods for existing APIs
    async cancelTask() { return true; }
    async resumePausedTask() { return true; }
    async hasPendingSubtasks() { return false; }
    async continuePendingSubtasks() {}
    async getAgents() { return {}; }
    async getConfig() { return { project: { name: 'test' } }; }
    async approveGate() {}
    async rejectGate() {}
    async getAllGates() { return []; }

    // Event emitter functionality
    on(event: string, listener: Function) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event)!.push(listener);
    }

    emit(event: string, ...args: any[]) {
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.forEach(listener => listener(...args));
      }
    }
  }

  return { ApexOrchestrator: MockOrchestrator };
});

describe('WebSocket Task Lifecycle Events', () => {
  let server: FastifyInstance;
  let testDir: string;
  let port: number;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-api-ws-events-'));

    // Create minimal config
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `version: "1.0"\nproject:\n  name: test-websocket-events\n`
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

  describe('task:trashed WebSocket event', () => {
    it('should broadcast task:trashed event when task is moved to trash', async () => {
      // Create a task first
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task to trash for WebSocket test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Set up WebSocket to listen for events
      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          try {
            // Move task to trash
            const trashResponse = await server.inject({
              method: 'POST',
              url: `/tasks/${taskId}/trash`,
            });
            expect(trashResponse.statusCode).toBe(200);
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          // Look for the trashed event
          if (event.type === 'task:trashed') {
            try {
              expect(event.type).toBe('task:trashed');
              expect(event.taskId).toBe(taskId);
              expect(event.timestamp).toBeDefined();
              expect(event.data.task).toBeDefined();
              expect(event.data.task.id).toBe(taskId);
              expect(event.data.trashedAt).toBeDefined();
              expect(event.data.task.status).toBe('cancelled');

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);

        // Timeout after 5 seconds
        setTimeout(() => {
          reject(new Error('Timeout: task:trashed event not received within 5 seconds'));
        }, 5000);
      });
    });
  });

  describe('task:restored WebSocket event', () => {
    it('should broadcast task:restored event when task is restored from trash', async () => {
      // Create and trash a task first
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task to restore for WebSocket test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      await server.inject({
        method: 'POST',
        url: `/tasks/${taskId}/trash`,
      });

      // Set up WebSocket to listen for restore event
      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          try {
            // Restore task from trash
            const restoreResponse = await server.inject({
              method: 'POST',
              url: `/tasks/${taskId}/restore`,
            });
            expect(restoreResponse.statusCode).toBe(200);
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          // Look for the restored event
          if (event.type === 'task:restored') {
            try {
              expect(event.type).toBe('task:restored');
              expect(event.taskId).toBe(taskId);
              expect(event.timestamp).toBeDefined();
              expect(event.data.task).toBeDefined();
              expect(event.data.task.id).toBe(taskId);
              expect(event.data.status).toBe('pending');

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);

        // Timeout after 5 seconds
        setTimeout(() => {
          reject(new Error('Timeout: task:restored event not received within 5 seconds'));
        }, 5000);
      });
    });
  });

  describe('task:archived WebSocket event', () => {
    it('should broadcast task:archived event when completed task is archived', async () => {
      // Create and complete a task first
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task to archive for WebSocket test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Mark task as completed so it can be archived
      await server.inject({
        method: 'POST',
        url: `/tasks/${taskId}/status`,
        headers: { 'Content-Type': 'application/json' },
        payload: { status: 'completed' },
      });

      // Set up WebSocket to listen for archive event
      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          try {
            // Archive the task
            const archiveResponse = await server.inject({
              method: 'POST',
              url: `/tasks/${taskId}/archive`,
            });
            expect(archiveResponse.statusCode).toBe(200);
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          // Look for the archived event
          if (event.type === 'task:archived') {
            try {
              expect(event.type).toBe('task:archived');
              expect(event.taskId).toBe(taskId);
              expect(event.timestamp).toBeDefined();
              expect(event.data.task).toBeDefined();
              expect(event.data.task.id).toBe(taskId);
              expect(event.data.archivedAt).toBeDefined();

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);

        // Timeout after 5 seconds
        setTimeout(() => {
          reject(new Error('Timeout: task:archived event not received within 5 seconds'));
        }, 5000);
      });
    });
  });

  describe('task:unarchived WebSocket event', () => {
    it('should broadcast task:unarchived event when archived task is unarchived', async () => {
      // Create, complete, and archive a task first
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task to unarchive for WebSocket test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Mark task as completed and archive it
      await server.inject({
        method: 'POST',
        url: `/tasks/${taskId}/status`,
        headers: { 'Content-Type': 'application/json' },
        payload: { status: 'completed' },
      });

      await server.inject({
        method: 'POST',
        url: `/tasks/${taskId}/archive`,
      });

      // Set up WebSocket to listen for unarchive event
      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          try {
            // Trigger unarchive by calling the mock method directly
            // Note: There's no unarchive endpoint in the current API, but the event handler exists
            // This tests the WebSocket event broadcasting functionality
            const orchestrator = (server as any).orchestrator;
            await orchestrator.unarchiveTask(taskId);
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          // Look for the unarchived event
          if (event.type === 'task:unarchived') {
            try {
              expect(event.type).toBe('task:unarchived');
              expect(event.taskId).toBe(taskId);
              expect(event.timestamp).toBeDefined();
              expect(event.data.task).toBeDefined();
              expect(event.data.task.id).toBe(taskId);
              expect(event.data.status).toBeDefined();

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);

        // Timeout after 5 seconds
        setTimeout(() => {
          reject(new Error('Timeout: task:unarchived event not received within 5 seconds'));
        }, 5000);
      });
    });
  });

  describe('trash:emptied WebSocket event', () => {
    it('should broadcast trash:emptied event when trash is permanently emptied', async () => {
      // Create and trash multiple tasks
      const taskIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const createResponse = await server.inject({
          method: 'POST',
          url: '/tasks',
          headers: { 'Content-Type': 'application/json' },
          payload: { description: `Task ${i + 1} for empty trash WebSocket test` },
        });
        const { taskId } = JSON.parse(createResponse.body);
        taskIds.push(taskId);

        // Move to trash
        await server.inject({
          method: 'POST',
          url: `/tasks/${taskId}/trash`,
        });
      }

      // Set up WebSocket to listen to global events (task '0')
      const ws = new WebSocket(`ws://localhost:${port}/stream/0`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          try {
            // Empty the trash
            const emptyResponse = await server.inject({
              method: 'DELETE',
              url: '/tasks/trash',
            });
            expect(emptyResponse.statusCode).toBe(200);
            const body = JSON.parse(emptyResponse.body);
            expect(body.deletedCount).toBe(3);
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          // Look for the trash emptied event
          if (event.type === 'trash:emptied') {
            try {
              expect(event.type).toBe('trash:emptied');
              expect(event.taskId).toBe('0'); // Global event
              expect(event.timestamp).toBeDefined();
              expect(event.data.deletedCount).toBe(3);
              expect(event.data.deletedTaskIds).toBeDefined();
              expect(event.data.deletedTaskIds).toHaveLength(3);
              expect(event.data.deletedTaskIds).toEqual(expect.arrayContaining(taskIds));

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);

        // Timeout after 5 seconds
        setTimeout(() => {
          reject(new Error('Timeout: trash:emptied event not received within 5 seconds'));
        }, 5000);
      });
    });

    it('should broadcast trash:emptied event to individual task WebSockets as well', async () => {
      // Create and trash a task
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for individual trash empty WebSocket test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      await server.inject({
        method: 'POST',
        url: `/tasks/${taskId}/trash`,
      });

      // Set up WebSocket to listen to the specific task
      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          try {
            // Empty the trash
            const emptyResponse = await server.inject({
              method: 'DELETE',
              url: '/tasks/trash',
            });
            expect(emptyResponse.statusCode).toBe(200);
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          // Look for the trash emptied event
          if (event.type === 'trash:emptied') {
            try {
              expect(event.type).toBe('trash:emptied');
              expect(event.taskId).toBe(taskId);
              expect(event.timestamp).toBeDefined();
              expect(event.data.deletedCount).toBe(1);
              expect(event.data.deletedTaskIds).toContain(taskId);

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);

        // Timeout after 5 seconds
        setTimeout(() => {
          reject(new Error('Timeout: trash:emptied event not received within 5 seconds'));
        }, 5000);
      });
    });
  });

  describe('WebSocket connection handling', () => {
    it('should handle multiple simultaneous WebSocket connections for different events', async () => {
      // Create tasks for different lifecycle events
      const tasks = await Promise.all([
        server.inject({
          method: 'POST',
          url: '/tasks',
          headers: { 'Content-Type': 'application/json' },
          payload: { description: 'Task 1 for multi-connection test' },
        }),
        server.inject({
          method: 'POST',
          url: '/tasks',
          headers: { 'Content-Type': 'application/json' },
          payload: { description: 'Task 2 for multi-connection test' },
        }),
      ]);

      const taskId1 = JSON.parse(tasks[0].body).taskId;
      const taskId2 = JSON.parse(tasks[1].body).taskId;

      const ws1 = new WebSocket(`ws://localhost:${port}/stream/${taskId1}`);
      const ws2 = new WebSocket(`ws://localhost:${port}/stream/${taskId2}`);

      const events1: any[] = [];
      const events2: any[] = [];
      let connectionsReady = 0;

      return new Promise<void>((resolve, reject) => {
        const checkReady = () => {
          connectionsReady++;
          if (connectionsReady === 2) {
            // Both connections ready, trigger events
            Promise.all([
              server.inject({ method: 'POST', url: `/tasks/${taskId1}/trash` }),
              server.inject({ method: 'POST', url: `/tasks/${taskId2}/trash` })
            ]).catch(reject);
          }
        };

        ws1.on('open', checkReady);
        ws2.on('open', checkReady);

        ws1.on('message', (data) => {
          const event = JSON.parse(data.toString());
          events1.push(event);

          if (event.type === 'task:trashed') {
            expect(event.taskId).toBe(taskId1);

            // Check if both events received
            const trashedEvent2 = events2.find(e => e.type === 'task:trashed');
            if (trashedEvent2) {
              try {
                expect(trashedEvent2.taskId).toBe(taskId2);
                ws1.close();
                ws2.close();
                resolve();
              } catch (error) {
                reject(error);
              }
            }
          }
        });

        ws2.on('message', (data) => {
          const event = JSON.parse(data.toString());
          events2.push(event);

          if (event.type === 'task:trashed') {
            expect(event.taskId).toBe(taskId2);

            // Check if both events received
            const trashedEvent1 = events1.find(e => e.type === 'task:trashed');
            if (trashedEvent1) {
              try {
                expect(trashedEvent1.taskId).toBe(taskId1);
                ws1.close();
                ws2.close();
                resolve();
              } catch (error) {
                reject(error);
              }
            }
          }
        });

        ws1.on('error', reject);
        ws2.on('error', reject);

        setTimeout(() => {
          reject(new Error('Timeout: Multi-connection test failed'));
        }, 5000);
      });
    });
  });

  describe('Event data validation', () => {
    it('should ensure all lifecycle events contain required fields', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for event validation test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          try {
            // Trigger trash event
            await server.inject({ method: 'POST', url: `/tasks/${taskId}/trash` });
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          if (event.type === 'task:trashed') {
            try {
              // Validate common event structure
              expect(event).toHaveProperty('type');
              expect(event).toHaveProperty('taskId');
              expect(event).toHaveProperty('timestamp');
              expect(event).toHaveProperty('data');

              // Validate type is a string
              expect(typeof event.type).toBe('string');
              expect(typeof event.taskId).toBe('string');
              expect(event.timestamp).toBeInstanceOf(Date);
              expect(typeof event.data).toBe('object');

              // Validate trash-specific data
              expect(event.data).toHaveProperty('task');
              expect(event.data).toHaveProperty('trashedAt');
              expect(event.data.task).toHaveProperty('id');
              expect(event.data.task.id).toBe(taskId);

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error('Timeout: Event validation test failed'));
        }, 5000);
      });
    });
  });
});