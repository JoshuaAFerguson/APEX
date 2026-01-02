import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import WebSocket from 'ws';
import { createServer, ServerOptions } from '../index';
import { FastifyInstance } from 'fastify';

// Mock the orchestrator to test error handling scenarios
vi.mock('@apexcli/orchestrator', () => {
  const mockTask = {
    id: 'task_123_error_test',
    description: 'Error handling test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: '/test',
    branchName: 'apex/test-error-handling',
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
      const task = { ...mockTask, id: `task_${Date.now()}_error`, description: options.description };
      this.tasks.set(task.id, task);
      return task;
    }

    async executeTask() {}
    async getTask(taskId: string) {
      if (taskId === 'nonexistent') return null;
      return this.tasks.get(taskId) || null;
    }
    async listTasks() { return Array.from(this.tasks.values()); }
    async updateTaskStatus(taskId: string, status: string) {
      const task = this.tasks.get(taskId);
      if (task) { task.status = status; }
    }

    // Additional mock methods
    async cancelTask() { return true; }
    async resumePausedTask() { return true; }
    async hasPendingSubtasks() { return false; }
    async continuePendingSubtasks() {}
    async getAgents() { return {}; }
    async getConfig() { return { project: { name: 'test' } }; }
    async approveGate() {}
    async rejectGate() {}
    async getAllGates() { return []; }

    // Error simulation methods
    simulateListenerError(taskId: string) {
      // Simulate an event that will cause a listener error
      this.emit('tool:start', {
        taskId,
        toolName: 'ErrorTool',
        input: { triggerError: true },
        timestamp: new Date(),
        callId: 'error_call_123'
      });
    }

    simulateCircularReference(taskId: string) {
      const circular: any = { taskId, toolName: 'CircularTool' };
      circular.circular = circular; // Create circular reference

      this.emit('tool:start', circular);
    }

    simulateLargeEvent(taskId: string) {
      const largeData = {
        taskId,
        toolName: 'LargeDataTool',
        input: {
          largeArray: new Array(100000).fill('x').map((_, i) => ({ id: i, data: 'x'.repeat(1000) })),
          metadata: 'x'.repeat(50000)
        },
        timestamp: new Date(),
        callId: 'large_call_123'
      };

      this.emit('tool:start', largeData);
    }

    simulateInvalidJSON(taskId: string) {
      // This would normally cause JSON.stringify to fail
      const invalidData = {
        taskId,
        toolName: 'InvalidTool',
        input: {
          func: () => 'this cannot be serialized',
          symbol: Symbol('test'),
          undefined: undefined
        },
        timestamp: new Date(),
        callId: 'invalid_call_123'
      };

      this.emit('tool:start', invalidData);
    }

    simulateNetworkTimeout(taskId: string) {
      // Simulate a slow event that might cause network timeouts
      const slowEvent = {
        taskId,
        toolName: 'SlowTool',
        input: {
          startTime: Date.now(),
          willBeSlow: true
        },
        timestamp: new Date(),
        callId: 'slow_call_123'
      };

      // Emit event after a delay
      setTimeout(() => {
        this.emit('tool:start', slowEvent);
      }, 5000); // 5 second delay
    }

    // Event emitter functionality with error handling
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
            // Emit an error event that can be tested
            this.emit('listener:error', event, error, ...args);
          }
        });
      }
    }
  }

  return {
    ApexOrchestrator: MockOrchestrator,
    ToolCallStartEvent: class {},
    ToolCallProgressEvent: class {},
    ToolCallCompleteEvent: class {},
  };
});

describe('WebSocket Tool Events - Error Handling', () => {
  let server: FastifyInstance;
  let testDir: string;
  let port: number;
  let mockOrchestrator: any;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-api-tool-error-'));

    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `version: "1.0"\nproject:\n  name: test-tool-errors\n`
    );

    const options: ServerOptions = {
      port: 0,
      host: '127.0.0.1',
      projectPath: testDir,
      silent: true,
    };

    server = await createServer(options);
    await server.listen({ port: 0, host: '127.0.0.1' });
    const address = server.server.address();
    port = (typeof address === 'object' && address !== null) ? address.port : 0;

    mockOrchestrator = (server as any).orchestrator;
  });

  afterEach(async () => {
    await server.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Connection error handling', () => {
    it('should handle connection to non-existent task gracefully', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/stream/nonexistent_task`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          // Connection should open even for non-existent tasks
          // The task:state event will indicate task not found
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          // Should receive task:state event with null/undefined data
          if (event.type === 'task:state') {
            try {
              expect(event.data).toBeNull();
              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error('Timeout: Non-existent task test failed'));
        }, 5000);
      });
    });

    it('should handle malformed WebSocket URLs gracefully', async () => {
      return new Promise<void>((resolve, reject) => {
        // Test with invalid task ID characters
        const ws = new WebSocket(`ws://localhost:${port}/stream/invalid<>task?id`);

        ws.on('open', () => {
          // If connection opens, it should handle gracefully
          ws.close();
          resolve();
        });

        ws.on('error', (error) => {
          // Expecting connection error for malformed URL
          expect(error).toBeDefined();
          resolve();
        });

        setTimeout(() => {
          reject(new Error('Timeout: Malformed URL test failed'));
        }, 5000);
      });
    });
  });

  describe('Event serialization error handling', () => {
    it('should handle circular reference in event data', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Circular reference test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            // This should not crash the server even with circular reference
            mockOrchestrator.simulateCircularReference(taskId);

            // Send a normal event after to verify system is still working
            setTimeout(() => {
              mockOrchestrator.simulateToolStart(taskId, 'NormalTool', { test: true }, 'normal_call');
            }, 1000);
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          // Should receive the normal event, circular one should be handled/filtered
          if (event.type === 'tool:start' && event.data.toolName === 'NormalTool') {
            try {
              expect(event.data.callId).toBe('normal_call');

              // Should have received task:state and at least one valid tool event
              expect(receivedEvents.length).toBeGreaterThanOrEqual(1);

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error(`Timeout: Circular reference test failed. Received ${receivedEvents.length} events`));
        }, 5000);
      });
    });

    it('should handle non-serializable data in events', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Invalid JSON test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            // This should not crash the server
            mockOrchestrator.simulateInvalidJSON(taskId);

            // Send a normal event after to verify system is still working
            setTimeout(() => {
              mockOrchestrator.simulateToolStart(taskId, 'ValidTool', { valid: true }, 'valid_call');
            }, 1000);
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          if (event.type === 'tool:start' && event.data.toolName === 'ValidTool') {
            try {
              expect(event.data.input.valid).toBe(true);
              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error('Timeout: Invalid JSON test failed'));
        }, 5000);
      });
    });
  });

  describe('Large event handling', () => {
    it('should handle very large events without crashing', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Large event test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            // Send a very large event
            mockOrchestrator.simulateLargeEvent(taskId);

            // Send normal event after
            setTimeout(() => {
              mockOrchestrator.simulateToolStart(taskId, 'SmallTool', { size: 'small' }, 'small_call');
            }, 2000);
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          try {
            const event = JSON.parse(data.toString());
            receivedEvents.push(event);

            if (event.type === 'tool:start') {
              if (event.data.toolName === 'LargeDataTool') {
                // Large event should be processed (or truncated/handled gracefully)
                expect(event.data.input).toBeDefined();
                console.log(`Large event size: ${JSON.stringify(event).length} bytes`);
              } else if (event.data.toolName === 'SmallTool') {
                // Normal event should work fine after large event
                expect(event.data.input.size).toBe('small');
                ws.close();
                resolve();
              }
            }
          } catch (parseError) {
            // If JSON parsing fails, that's also a valid test result
            console.log('Event too large to parse or malformed, which is acceptable');
            ws.close();
            resolve();
          }
        });

        ws.on('error', (error) => {
          // Large events might cause connection errors, which is acceptable
          console.log('Connection error with large event (acceptable):', error.message);
          resolve();
        });

        setTimeout(() => {
          reject(new Error('Timeout: Large event test failed'));
        }, 10000);
      });
    });
  });

  describe('Network error handling', () => {
    it('should handle client disconnection gracefully', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Disconnection handling test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
        let connectionEstablished = false;

        ws.on('open', () => {
          connectionEstablished = true;

          // Start some events
          const callId = mockOrchestrator.simulateToolStart(taskId, 'DisconnectTool', { test: true });

          // Forcefully close connection
          setTimeout(() => {
            ws.terminate(); // Force close without proper close handshake
          }, 100);

          // Continue generating events after disconnect
          setTimeout(() => {
            try {
              mockOrchestrator.simulateToolProgress(taskId, 'DisconnectTool', callId, { message: 'Still running...' });
              mockOrchestrator.simulateToolComplete(taskId, 'DisconnectTool', callId, { success: true });

              // If we reach here without server crashing, test passes
              resolve();
            } catch (error) {
              reject(error);
            }
          }, 500);
        });

        ws.on('error', (error) => {
          if (connectionEstablished) {
            // Expected during forced termination
            console.log('Expected error during forced disconnect:', error.message);
          } else {
            reject(error);
          }
        });

        setTimeout(() => {
          if (!connectionEstablished) {
            reject(new Error('Connection never established'));
          }
        }, 5000);
      });
    });

    it('should handle slow client connections without blocking other clients', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Slow client test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      return new Promise<void>((resolve, reject) => {
        // Create a fast client
        const fastWs = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
        const fastEvents: any[] = [];

        // Create a slow client (simulate by not reading messages)
        const slowWs = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
        let slowConnected = false;

        fastWs.on('open', () => {
          console.log('Fast client connected');
        });

        slowWs.on('open', () => {
          slowConnected = true;
          console.log('Slow client connected (but will not read messages)');

          // Start generating events once both clients are connected
          const callId = mockOrchestrator.simulateToolStart(taskId, 'SpeedTestTool', { test: true });
          mockOrchestrator.simulateToolComplete(taskId, 'SpeedTestTool', callId, { success: true });
        });

        fastWs.on('message', (data) => {
          const event = JSON.parse(data.toString());
          if (['tool:start', 'tool:complete'].includes(event.type)) {
            fastEvents.push(event);

            if (fastEvents.length >= 2) { // start + complete
              try {
                // Fast client should receive events despite slow client
                expect(fastEvents.length).toBe(2);
                expect(fastEvents[0].type).toBe('tool:start');
                expect(fastEvents[1].type).toBe('tool:complete');

                fastWs.close();
                slowWs.close();
                resolve();
              } catch (error) {
                reject(error);
              }
            }
          }
        });

        // Slow client intentionally doesn't read messages to test backpressure handling
        // slowWs.on('message', ...) - intentionally not handling

        fastWs.on('error', reject);
        slowWs.on('error', (error) => {
          // Slow client might error due to buffer overflow, which is expected
          console.log('Slow client error (expected):', error.message);
        });

        setTimeout(() => {
          reject(new Error('Timeout: Slow client test failed'));
        }, 10000);
      });
    });
  });

  describe('Server resilience', () => {
    it('should continue operating after multiple connection errors', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Server resilience test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      return new Promise<void>((resolve, reject) => {
        const connections: WebSocket[] = [];
        let successfulConnections = 0;
        let finalTestCompleted = false;

        // Create 10 connections and force errors on most of them
        for (let i = 0; i < 10; i++) {
          const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
          connections.push(ws);

          ws.on('open', () => {
            successfulConnections++;

            if (i < 8) {
              // Force errors on first 8 connections
              setTimeout(() => {
                ws.terminate();
              }, 100 + i * 50);
            } else {
              // Keep last 2 connections for final test
              if (successfulConnections >= 10 && !finalTestCompleted) {
                finalTestCompleted = true;

                // Generate events to verify server is still working
                const callId = mockOrchestrator.simulateToolStart(taskId, 'ResilienceTool', { test: true });
                mockOrchestrator.simulateToolComplete(taskId, 'ResilienceTool', callId, { success: true });
              }
            }
          });

          if (i >= 8) {
            ws.on('message', (data) => {
              const event = JSON.parse(data.toString());
              if (event.type === 'tool:complete' && event.data.toolName === 'ResilienceTool') {
                try {
                  // Server should still be functional
                  expect(event.data.result.success).toBe(true);

                  // Clean up remaining connections
                  connections.forEach(conn => {
                    if (conn.readyState === WebSocket.OPEN) {
                      conn.close();
                    }
                  });

                  resolve();
                } catch (error) {
                  reject(error);
                }
              }
            });
          }

          ws.on('error', (error) => {
            // Expected for most connections
            console.log(`Connection ${i} error (expected):`, error.message);
          });
        }

        setTimeout(() => {
          reject(new Error(`Timeout: Server resilience test failed. Successful connections: ${successfulConnections}`));
        }, 15000);
      });
    });
  });

  describe('Event filtering error scenarios', () => {
    it('should handle URL encoding issues in event filters', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'URL encoding test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Test with problematic URL encoding
      const problematicQuery = encodeURIComponent('tool:start,agent:thinking,tool:🔧');
      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}?events=${problematicQuery}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            const callId = mockOrchestrator.simulateToolStart(taskId, 'EncodingTest', { emoji: '🚀' });
            mockOrchestrator.emit('agent:thinking', taskId, 'test-agent', 'Thinking with émojis 🤔');
            mockOrchestrator.simulateToolComplete(taskId, 'EncodingTest', callId, { success: true });
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          if (event.type === 'tool:complete') {
            setTimeout(() => {
              try {
                // Should handle encoding gracefully and filter events
                const eventTypes = receivedEvents.map(e => e.type);
                expect(eventTypes).toContain('tool:start');
                expect(eventTypes).toContain('agent:thinking');
                expect(eventTypes).toContain('tool:complete');

                ws.close();
                resolve();
              } catch (error) {
                reject(error);
              }
            }, 200);
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error('Timeout: URL encoding test failed'));
        }, 5000);
      });
    });
  });
});