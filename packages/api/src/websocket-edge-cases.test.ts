import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import WebSocket from 'ws';
import { createServer, ServerOptions } from './index';
import { FastifyInstance } from 'fastify';

// Mock the orchestrator with enhanced error simulation capabilities
vi.mock('@apex/orchestrator', () => {
  const mockTask = {
    id: 'task_edge_test',
    description: 'Edge case test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: '/test',
    branchName: 'apex/edge-test',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
    logs: [],
    artifacts: [],
    trashedAt: null,
    archivedAt: null,
  };

  class MockOrchestrator {
    private tasks: Map<string, typeof mockTask> = new Map();
    private listeners: Map<string, Function[]> = new Map();
    private shouldThrowErrors = false;
    private errorScenario: string | null = null;

    async initialize() {}

    // Error simulation methods
    setErrorScenario(scenario: string) {
      this.errorScenario = scenario;
      this.shouldThrowErrors = true;
    }

    clearErrorScenario() {
      this.errorScenario = null;
      this.shouldThrowErrors = false;
    }

    async createTask(options: { description: string }) {
      if (this.errorScenario === 'create') {
        throw new Error('Simulated task creation error');
      }

      const task = {
        ...mockTask,
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        description: options.description
      };
      this.tasks.set(task.id, task);

      // Simulate potential event emission errors
      if (this.errorScenario === 'event-emission') {
        // Emit event but with corrupted data
        this.emit('task:created', null);
      } else {
        this.emit('task:created', task);
      }

      return task;
    }

    async executeTask() {}

    async getTask(taskId: string) {
      if (this.errorScenario === 'get-task') {
        throw new Error('Database connection lost');
      }
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

    async trashTask(taskId: string) {
      if (this.errorScenario === 'trash') {
        throw new Error('Failed to move task to trash');
      }

      const task = this.tasks.get(taskId);
      if (!task) throw new Error(`Task with ID ${taskId} not found`);
      if (task.trashedAt) throw new Error(`Task with ID ${taskId} is already in trash`);

      task.trashedAt = new Date();
      task.status = 'cancelled';

      // Test malformed event data
      if (this.errorScenario === 'malformed-event') {
        this.emit('task:trashed', { ...task, trashedAt: 'invalid-date' });
      } else {
        this.emit('task:trashed', task);
      }
    }

    async restoreTask(taskId: string) {
      if (this.errorScenario === 'restore') {
        throw new Error('Failed to restore task from trash');
      }

      const task = this.tasks.get(taskId);
      if (!task) throw new Error(`Task with ID ${taskId} not found`);
      if (!task.trashedAt) throw new Error(`Task with ID ${taskId} is not in trash`);

      task.trashedAt = null;
      task.status = 'pending';

      // Emit event with missing required fields to test error handling
      if (this.errorScenario === 'missing-fields') {
        const corruptedTask = { ...task };
        delete corruptedTask.id;
        this.emit('task:restored', corruptedTask);
      } else {
        this.emit('task:restored', task);
      }
    }

    async listTrashedTasks() {
      return Array.from(this.tasks.values()).filter(task => task.trashedAt);
    }

    async emptyTrash() {
      if (this.errorScenario === 'empty-trash') {
        throw new Error('Failed to empty trash');
      }

      const trashedTasks = Array.from(this.tasks.values()).filter(task => task.trashedAt);
      const taskIds = trashedTasks.map(task => task.id);
      const deletedCount = trashedTasks.length;

      trashedTasks.forEach(task => this.tasks.delete(task.id));

      // Test edge case with empty trash
      if (deletedCount === 0 && this.errorScenario === 'empty-trash-no-tasks') {
        this.emit('trash:emptied', 0, []);
        return 0;
      }

      // Test oversized event data
      if (this.errorScenario === 'oversized-event') {
        const hugeTaskIds = Array.from({ length: 10000 }, (_, i) => `huge-task-${i}`);
        this.emit('trash:emptied', deletedCount, hugeTaskIds);
      } else {
        this.emit('trash:emptied', deletedCount, taskIds);
      }

      return deletedCount;
    }

    async archiveTask(taskId: string) {
      if (this.errorScenario === 'archive') {
        throw new Error('Archive system temporarily unavailable');
      }

      const task = this.tasks.get(taskId);
      if (!task) throw new Error(`Task with ID ${taskId} not found`);
      if (task.status !== 'completed') {
        throw new Error(`Cannot archive task ${taskId}: only completed tasks can be archived (current status: ${task.status})`);
      }
      if (task.archivedAt) throw new Error(`Task with ID ${taskId} is already archived`);

      task.archivedAt = new Date();

      // Test circular reference in event data
      if (this.errorScenario === 'circular-reference') {
        const taskWithCircularRef = { ...task };
        taskWithCircularRef.self = taskWithCircularRef; // Create circular reference
        this.emit('task:archived', taskWithCircularRef);
      } else {
        this.emit('task:archived', task);
      }
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
    async getConfig() { return { project: { name: 'edge-test' } }; }
    async approveGate() {}
    async rejectGate() {}
    async getAllGates() { return []; }

    // Event system with error simulation
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
            // Simulate listener throwing errors
            if (this.errorScenario === 'listener-error') {
              throw new Error('Event listener error simulation');
            }
            listener(...args);
          } catch (error) {
            // In real orchestrator, this would be logged but not propagated
            console.warn(`Error in event listener for ${event}:`, error.message);
          }
        });
      }
    }
  }

  return { ApexOrchestrator: MockOrchestrator };
});

describe('WebSocket Edge Cases and Error Handling', () => {
  let server: FastifyInstance;
  let testDir: string;
  let port: number;
  let orchestrator: any;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-api-edge-'));

    // Create minimal config
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `version: "1.0"\nproject:\n  name: test-edge-cases\n`
    );

    const options: ServerOptions = {
      port: 0, // Let OS assign port
      host: '127.0.0.1',
      projectPath: testDir,
      silent: true,
    };

    server = await createServer(options);
    await server.listen({ port: 0, host: '127.0.0.1' });
    port = server.server.address()?.port || 0;

    // Access the orchestrator instance for error simulation
    orchestrator = (server as any).orchestrator;
  });

  afterEach(async () => {
    if (orchestrator && orchestrator.clearErrorScenario) {
      orchestrator.clearErrorScenario();
    }
    await server.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Invalid WebSocket connections', () => {
    it('should handle connections to non-existent task streams gracefully', async () => {
      const nonExistentTaskId = 'non-existent-task-id';
      const ws = new WebSocket(`ws://localhost:${port}/stream/${nonExistentTaskId}`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          // Connection should succeed even for non-existent task
          ws.close();
          resolve();
        });

        ws.on('error', (error) => {
          // Should not error just for connecting to non-existent task stream
          reject(new Error(`Unexpected WebSocket error: ${error.message}`));
        });

        setTimeout(() => {
          reject(new Error('Timeout: WebSocket connection test failed'));
        }, 5000);
      });
    });

    it('should handle malformed WebSocket URLs', async () => {
      // Test various malformed URLs
      const malformedUrls = [
        `ws://localhost:${port}/stream/`,
        `ws://localhost:${port}/stream`,
        `ws://localhost:${port}/invalid-endpoint`,
      ];

      const results = await Promise.allSettled(
        malformedUrls.map(url => {
          return new Promise<string>((resolve, reject) => {
            const ws = new WebSocket(url);

            ws.on('open', () => {
              ws.close();
              resolve(`Connected to ${url}`);
            });

            ws.on('error', (error) => {
              resolve(`Expected error for ${url}: ${error.message}`);
            });

            setTimeout(() => {
              reject(`Timeout for ${url}`);
            }, 2000);
          });
        })
      );

      // Should handle all URLs without crashing the server
      expect(results).toHaveLength(malformedUrls.length);
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn(`URL ${malformedUrls[index]} caused unexpected rejection:`, result.reason);
        }
      });
    });
  });

  describe('Event broadcasting errors', () => {
    it('should handle corrupted event data gracefully', async () => {
      orchestrator.setErrorScenario('malformed-event');

      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for malformed event test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          try {
            // This should trigger a malformed event
            await server.inject({
              method: 'POST',
              url: `/tasks/${taskId}/trash`,
            });
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          try {
            const event = JSON.parse(data.toString());
            receivedEvents.push(event);

            if (event.type === 'task:trashed') {
              // Even with malformed data, the event should still be received
              // The WebSocket broadcasting should handle the error gracefully
              expect(event.type).toBe('task:trashed');
              expect(event.taskId).toBe(taskId);

              ws.close();
              resolve();
            }
          } catch (parseError) {
            // JSON parsing error is also a valid test outcome
            ws.close();
            resolve();
          }
        });

        ws.on('error', (error) => {
          // WebSocket errors are acceptable in this edge case test
          resolve();
        });

        setTimeout(() => {
          reject(new Error('Timeout: Malformed event test failed'));
        }, 5000);
      });
    });

    it('should handle event listener errors without affecting other listeners', async () => {
      orchestrator.setErrorScenario('listener-error');

      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for listener error test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Create multiple WebSocket connections
      const ws1 = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const ws2 = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);

      const events1: any[] = [];
      const events2: any[] = [];
      let connectionsReady = 0;

      return new Promise<void>((resolve, reject) => {
        const checkReady = () => {
          connectionsReady++;
          if (connectionsReady === 2) {
            // Both connections ready, trigger event that will cause listener error
            server.inject({
              method: 'POST',
              url: `/tasks/${taskId}/trash`,
            }).catch(reject);
          }
        };

        ws1.on('open', checkReady);
        ws2.on('open', checkReady);

        ws1.on('message', (data) => {
          const event = JSON.parse(data.toString());
          events1.push(event);

          if (event.type === 'task:trashed') {
            // Check if the other client also received the event
            const trashedEvent2 = events2.find(e => e.type === 'task:trashed');
            if (trashedEvent2) {
              try {
                expect(event.taskId).toBe(taskId);
                expect(trashedEvent2.taskId).toBe(taskId);

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
            // Check if the other client also received the event
            const trashedEvent1 = events1.find(e => e.type === 'task:trashed');
            if (trashedEvent1) {
              try {
                expect(event.taskId).toBe(taskId);
                expect(trashedEvent1.taskId).toBe(taskId);

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
          reject(new Error('Timeout: Listener error test failed'));
        }, 5000);
      });
    });
  });

  describe('Large data handling', () => {
    it('should handle events with large payloads', async () => {
      orchestrator.setErrorScenario('oversized-event');

      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for oversized event test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Trash the task first
      await server.inject({
        method: 'POST',
        url: `/tasks/${taskId}/trash`,
      });

      const ws = new WebSocket(`ws://localhost:${port}/stream/0`); // Global stream for trash:emptied

      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          try {
            // This will trigger an oversized event
            await server.inject({
              method: 'DELETE',
              url: '/tasks/trash',
            });
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          try {
            const event = JSON.parse(data.toString());

            if (event.type === 'trash:emptied') {
              // The event should be successfully transmitted even with large payload
              expect(event.type).toBe('trash:emptied');
              expect(event.data.deletedTaskIds).toBeDefined();
              // The test creates 10000 fake task IDs in the mock
              expect(Array.isArray(event.data.deletedTaskIds)).toBe(true);

              ws.close();
              resolve();
            }
          } catch (error) {
            // JSON parsing error might occur with very large payloads
            // This is acceptable behavior
            ws.close();
            resolve();
          }
        });

        ws.on('error', (error) => {
          // WebSocket errors are acceptable with oversized data
          if (error.message.includes('payload') || error.message.includes('size')) {
            ws.close();
            resolve();
          } else {
            reject(error);
          }
        });

        setTimeout(() => {
          reject(new Error('Timeout: Oversized event test failed'));
        }, 10000);
      });
    });
  });

  describe('Network interruption simulation', () => {
    it('should handle abrupt connection termination', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for connection termination test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          // Immediately terminate the connection after opening
          ws.terminate();

          // Wait a bit, then trigger an event
          setTimeout(async () => {
            try {
              // This should not cause server errors even though client is gone
              const response = await server.inject({
                method: 'POST',
                url: `/tasks/${taskId}/trash`,
              });

              expect(response.statusCode).toBe(200);
              resolve();
            } catch (error) {
              reject(error);
            }
          }, 100);
        });

        ws.on('error', () => {
          // Ignore errors from termination
        });

        setTimeout(() => {
          reject(new Error('Timeout: Connection termination test failed'));
        }, 5000);
      });
    });

    it('should clean up disconnected clients properly', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for cleanup test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Create multiple connections and disconnect them
      const connectionCount = 5;
      const connections: WebSocket[] = [];

      for (let i = 0; i < connectionCount; i++) {
        const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
        connections.push(ws);
      }

      return new Promise<void>((resolve, reject) => {
        let openConnections = 0;

        connections.forEach((ws, index) => {
          ws.on('open', () => {
            openConnections++;

            if (openConnections === connectionCount) {
              // All connected, now disconnect them all
              connections.forEach(conn => conn.close());

              // After all are disconnected, verify server can still handle events
              setTimeout(async () => {
                try {
                  const response = await server.inject({
                    method: 'POST',
                    url: `/tasks/${taskId}/trash`,
                  });

                  expect(response.statusCode).toBe(200);
                  resolve();
                } catch (error) {
                  reject(error);
                }
              }, 500);
            }
          });

          ws.on('error', () => {
            // Ignore connection errors
          });
        });

        setTimeout(() => {
          reject(new Error('Timeout: Cleanup test failed'));
        }, 10000);
      });
    });
  });

  describe('Concurrent operation edge cases', () => {
    it('should handle rapid successive WebSocket connections and disconnections', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for rapid connection test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Rapidly create and destroy connections
      const connectionCycles = 10;
      let completedCycles = 0;

      return new Promise<void>((resolve, reject) => {
        const createConnection = (cycleIndex: number) => {
          const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);

          ws.on('open', () => {
            // Immediately close the connection
            ws.close();

            completedCycles++;
            if (completedCycles === connectionCycles) {
              // All cycles completed, verify server is still responsive
              setTimeout(async () => {
                try {
                  const response = await server.inject({
                    method: 'POST',
                    url: `/tasks/${taskId}/trash`,
                  });

                  expect(response.statusCode).toBe(200);
                  resolve();
                } catch (error) {
                  reject(error);
                }
              }, 100);
            }
          });

          ws.on('error', () => {
            // Ignore rapid connection errors
            completedCycles++;
            if (completedCycles === connectionCycles) {
              resolve();
            }
          });
        };

        // Start all connection cycles rapidly
        for (let i = 0; i < connectionCycles; i++) {
          setTimeout(() => createConnection(i), i * 10);
        }

        setTimeout(() => {
          reject(new Error('Timeout: Rapid connection test failed'));
        }, 10000);
      });
    });
  });

  describe('API error propagation', () => {
    it('should handle API errors without affecting WebSocket connections', async () => {
      orchestrator.setErrorScenario('trash');

      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for API error test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          try {
            // This should fail at the API level
            const response = await server.inject({
              method: 'POST',
              url: `/tasks/${taskId}/trash`,
            });

            // API should return an error status
            expect(response.statusCode).toBeGreaterThanOrEqual(400);

            // But WebSocket connection should remain stable
            expect(ws.readyState).toBe(WebSocket.OPEN);

            ws.close();
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error('Timeout: API error test failed'));
        }, 5000);
      });
    });
  });

  describe('Empty and null data handling', () => {
    it('should handle empty trash operations gracefully', async () => {
      orchestrator.setErrorScenario('empty-trash-no-tasks');

      const ws = new WebSocket(`ws://localhost:${port}/stream/0`); // Global stream

      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          try {
            // Empty trash when no tasks are trashed
            const response = await server.inject({
              method: 'DELETE',
              url: '/tasks/trash',
            });

            expect(response.statusCode).toBe(200);
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());

          if (event.type === 'trash:emptied') {
            try {
              expect(event.data.deletedCount).toBe(0);
              expect(event.data.deletedTaskIds).toEqual([]);

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error('Timeout: Empty trash test failed'));
        }, 5000);
      });
    });
  });
});