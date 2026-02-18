import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import WebSocket from 'ws';
import { createServer, ServerOptions } from '../index';
import { FastifyInstance } from 'fastify';

// Mock the orchestrator to control tool event emission for testing
vi.mock('@apexcli/orchestrator', () => {
  const mockTask = {
    id: 'task_123_edge_test',
    description: 'Test task for tool events edge cases',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: '/test',
    branchName: 'apex/test-tool-events-edge',
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
      const task = { ...mockTask, id: `task_${Date.now()}_edge`, description: options.description };
      this.tasks.set(task.id, task);
      return task;
    }

    async executeTask() {}
    async getTask(taskId: string) { return this.tasks.get(taskId) || null; }
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

    // Tool event simulation methods
    simulateToolStart(taskId: string, toolName: string, input: Record<string, unknown>, callId?: string) {
      const event = {
        taskId,
        toolName,
        input,
        timestamp: new Date(),
        callId: callId || `call_${Date.now()}`
      };
      this.emit('tool:start', event);
      return event.callId;
    }

    simulateToolProgress(taskId: string, toolName: string, callId: string, progress: { message: string; percentage?: number }) {
      const event = {
        taskId,
        toolName,
        callId,
        progress,
        timestamp: new Date()
      };
      this.emit('tool:progress', event);
    }

    simulateToolComplete(taskId: string, toolName: string, callId: string, result: { success: boolean; output?: unknown; error?: string }) {
      const startTime = new Date(Date.now() - Math.random() * 5000); // Random duration up to 5 seconds
      const endTime = new Date();
      const event = {
        taskId,
        toolName,
        callId,
        result,
        timing: {
          startTime,
          endTime,
          duration: endTime.getTime() - startTime.getTime()
        },
        timestamp: new Date()
      };
      this.emit('tool:complete', event);
    }

    simulateInvalidEvent(taskId: string, invalidData: any) {
      this.emit('tool:start', invalidData);
    }

    // Simulate concurrent tool calls
    simulateConcurrentTools(taskId: string) {
      const tools = ['ReadFile', 'WriteFile', 'DatabaseQuery', 'APICall', 'ProcessData'];
      const callIds: string[] = [];

      tools.forEach((tool, index) => {
        setTimeout(() => {
          const callId = this.simulateToolStart(taskId, tool, { index, concurrent: true });
          callIds.push(callId);

          setTimeout(() => {
            this.simulateToolProgress(taskId, tool, callId, {
              message: `Processing ${tool}...`,
              percentage: 50
            });
          }, 100);

          setTimeout(() => {
            this.simulateToolComplete(taskId, tool, callId, {
              success: Math.random() > 0.2, // 80% success rate
              output: { processed: true, index }
            });
          }, 200 + Math.random() * 300);
        }, index * 50); // Stagger starts slightly
      });

      return callIds;
    }

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

  return {
    ApexOrchestrator: MockOrchestrator,
    ToolCallStartEvent: class {},
    ToolCallProgressEvent: class {},
    ToolCallCompleteEvent: class {},
  };
});

describe('WebSocket Tool Events - Edge Cases', () => {
  let server: FastifyInstance;
  let testDir: string;
  let port: number;
  let mockOrchestrator: any;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-api-tool-edge-'));

    // Create minimal config
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `version: "1.0"\nproject:\n  name: test-tool-edge-cases\n`
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

  describe('Concurrent tool events', () => {
    it('should handle multiple concurrent tool calls correctly', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Concurrent tools test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        let expectedEvents = 15; // 5 tools * 3 events each (start, progress, complete)
        let eventCount = 0;

        ws.on('open', () => {
          try {
            mockOrchestrator.simulateConcurrentTools(taskId);
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());

          if (['tool:start', 'tool:progress', 'tool:complete'].includes(event.type)) {
            receivedEvents.push(event);
            eventCount++;

            if (eventCount >= expectedEvents) {
              try {
                // Verify we received all event types
                const startEvents = receivedEvents.filter(e => e.type === 'tool:start');
                const progressEvents = receivedEvents.filter(e => e.type === 'tool:progress');
                const completeEvents = receivedEvents.filter(e => e.type === 'tool:complete');

                expect(startEvents.length).toBe(5);
                expect(progressEvents.length).toBe(5);
                expect(completeEvents.length).toBe(5);

                // Verify all tools were called
                const toolNames = startEvents.map(e => e.data.toolName);
                expect(toolNames).toContain('ReadFile');
                expect(toolNames).toContain('WriteFile');
                expect(toolNames).toContain('DatabaseQuery');
                expect(toolNames).toContain('APICall');
                expect(toolNames).toContain('ProcessData');

                // Verify call IDs match across start/progress/complete for each tool
                toolNames.forEach(toolName => {
                  const start = startEvents.find(e => e.data.toolName === toolName);
                  const progress = progressEvents.find(e => e.data.toolName === toolName);
                  const complete = completeEvents.find(e => e.data.toolName === toolName);

                  expect(start.data.callId).toBe(progress.data.callId);
                  expect(progress.data.callId).toBe(complete.data.callId);
                });

                ws.close();
                resolve();
              } catch (error) {
                reject(error);
              }
            }
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error(`Timeout: Expected ${expectedEvents} events, received ${eventCount}`));
        }, 10000);
      });
    });
  });

  describe('Event filtering edge cases', () => {
    it('should handle malformed event filter query parameters', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Malformed filter test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Test with empty filters, duplicate filters, and whitespace
      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}?events=,,tool:start, ,tool:start,tool:complete,`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            const callId = mockOrchestrator.simulateToolStart(taskId, 'TestTool', { test: true });
            mockOrchestrator.simulateToolProgress(taskId, 'TestTool', callId, { message: 'Progress...' });
            mockOrchestrator.simulateToolComplete(taskId, 'TestTool', callId, { success: true });
            mockOrchestrator.emit('agent:thinking', taskId, 'test-agent', 'Thinking...');
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          if (event.type === 'tool:complete') {
            try {
              // Should receive tool:start and tool:complete but not tool:progress or agent:thinking
              const eventTypes = receivedEvents.map(e => e.type);
              expect(eventTypes).toContain('tool:start');
              expect(eventTypes).toContain('tool:complete');
              expect(eventTypes).not.toContain('tool:progress');
              expect(eventTypes).not.toContain('agent:thinking');

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error('Timeout: Malformed filter test failed'));
        }, 5000);
      });
    });

    it('should handle invalid event filter names gracefully', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Invalid filter test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Test with non-existent event types
      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}?events=invalid:event,tool:nonexistent,tool:start`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            const callId = mockOrchestrator.simulateToolStart(taskId, 'TestTool', { test: true });
            mockOrchestrator.simulateToolComplete(taskId, 'TestTool', callId, { success: true });
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          if (event.type === 'tool:start') {
            // Wait a bit to see if any other events come through
            setTimeout(() => {
              try {
                // Should only receive tool:start event, not the invalid filter events
                const eventTypes = receivedEvents.map(e => e.type);
                expect(eventTypes).toContain('tool:start');
                expect(eventTypes.filter(t => t === 'tool:start')).toHaveLength(1);
                expect(eventTypes).not.toContain('invalid:event');
                expect(eventTypes).not.toContain('tool:nonexistent');

                ws.close();
                resolve();
              } catch (error) {
                reject(error);
              }
            }, 500);
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error('Timeout: Invalid filter test failed'));
        }, 5000);
      });
    });
  });

  describe('Connection handling', () => {
    it('should handle client disconnection during tool events', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Disconnection test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
        let connectionEstablished = false;

        ws.on('open', () => {
          connectionEstablished = true;

          try {
            // Start a tool call
            const callId = mockOrchestrator.simulateToolStart(taskId, 'SlowTool', { data: 'test' });

            // Disconnect after starting tool call
            setTimeout(() => {
              ws.close();
            }, 100);

            // Continue emitting events after disconnect (should not crash server)
            setTimeout(() => {
              mockOrchestrator.simulateToolProgress(taskId, 'SlowTool', callId, { message: 'Still processing...' });
              mockOrchestrator.simulateToolComplete(taskId, 'SlowTool', callId, { success: true });
              resolve();
            }, 500);
          } catch (error) {
            reject(error);
          }
        });

        ws.on('close', () => {
          if (!connectionEstablished) {
            reject(new Error('Connection never established'));
          }
        });

        ws.on('error', (error) => {
          // Don't reject on client-side errors during intentional disconnect
          if (connectionEstablished) {
            console.log('Expected client error during disconnect:', error.message);
          } else {
            reject(error);
          }
        });

        setTimeout(() => {
          if (!connectionEstablished) {
            reject(new Error('Timeout: Connection not established'));
          }
        }, 5000);
      });
    });

    it('should handle multiple clients for the same task', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Multiple clients test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      return new Promise<void>((resolve, reject) => {
        const ws1 = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
        const ws2 = new WebSocket(`ws://localhost:${port}/stream/${taskId}?events=tool:start,tool:complete`);

        const client1Events: any[] = [];
        const client2Events: any[] = [];
        let client1Ready = false;
        let client2Ready = false;

        ws1.on('open', () => {
          client1Ready = true;
          checkAndStart();
        });

        ws2.on('open', () => {
          client2Ready = true;
          checkAndStart();
        });

        function checkAndStart() {
          if (client1Ready && client2Ready) {
            try {
              const callId = mockOrchestrator.simulateToolStart(taskId, 'MultiClientTool', { test: true });
              mockOrchestrator.simulateToolProgress(taskId, 'MultiClientTool', callId, { message: 'Processing...' });
              mockOrchestrator.simulateToolComplete(taskId, 'MultiClientTool', callId, { success: true });
            } catch (error) {
              reject(error);
            }
          }
        }

        ws1.on('message', (data) => {
          const event = JSON.parse(data.toString());
          if (['tool:start', 'tool:progress', 'tool:complete'].includes(event.type)) {
            client1Events.push(event);
          }
        });

        ws2.on('message', (data) => {
          const event = JSON.parse(data.toString());
          if (['tool:start', 'tool:progress', 'tool:complete'].includes(event.type)) {
            client2Events.push(event);
          }

          // Check when client2 has received its filtered events
          if (event.type === 'tool:complete') {
            setTimeout(() => {
              try {
                // Client 1 should receive all events
                expect(client1Events.length).toBe(3); // start, progress, complete
                expect(client1Events.map(e => e.type)).toEqual(['tool:start', 'tool:progress', 'tool:complete']);

                // Client 2 should only receive filtered events (no progress)
                expect(client2Events.length).toBe(2); // start, complete
                expect(client2Events.map(e => e.type)).toEqual(['tool:start', 'tool:complete']);

                // Both clients should receive the same start and complete events
                expect(client1Events[0].data.callId).toBe(client2Events[0].data.callId);
                expect(client1Events[2].data.callId).toBe(client2Events[1].data.callId);

                ws1.close();
                ws2.close();
                resolve();
              } catch (error) {
                reject(error);
              }
            }, 200);
          }
        });

        ws1.on('error', reject);
        ws2.on('error', reject);

        setTimeout(() => {
          reject(new Error('Timeout: Multiple clients test failed'));
        }, 10000);
      });
    });
  });

  describe('Tool event data validation', () => {
    it('should handle tool events with missing or invalid data', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Invalid data test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            // Emit invalid events (should be handled gracefully)
            mockOrchestrator.simulateInvalidEvent(taskId, null);
            mockOrchestrator.simulateInvalidEvent(taskId, undefined);
            mockOrchestrator.simulateInvalidEvent(taskId, { invalidFormat: true });

            // Then emit a valid event
            const callId = mockOrchestrator.simulateToolStart(taskId, 'ValidTool', { test: true });
            mockOrchestrator.simulateToolComplete(taskId, 'ValidTool', callId, { success: true });
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          if (event.type === 'tool:complete') {
            try {
              // Should only receive valid events, invalid ones should be filtered out or cause no errors
              const toolEvents = receivedEvents.filter(e => e.type.startsWith('tool:'));
              expect(toolEvents.length).toBe(2); // tool:start and tool:complete
              expect(toolEvents[0].type).toBe('tool:start');
              expect(toolEvents[1].type).toBe('tool:complete');

              // Valid events should have proper structure
              expect(toolEvents[0].data.toolName).toBe('ValidTool');
              expect(toolEvents[0].data.callId).toBeDefined();
              expect(toolEvents[1].data.toolName).toBe('ValidTool');
              expect(toolEvents[1].data.result.success).toBe(true);

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error('Timeout: Invalid data test failed'));
        }, 5000);
      });
    });
  });

  describe('High frequency tool events', () => {
    it('should handle rapid succession of tool events without dropping messages', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'High frequency test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            // Emit 50 rapid tool calls
            const numCalls = 50;
            const callIds: string[] = [];

            for (let i = 0; i < numCalls; i++) {
              const callId = mockOrchestrator.simulateToolStart(taskId, `RapidTool${i}`, { index: i });
              callIds.push(callId);

              // Immediately complete each call
              mockOrchestrator.simulateToolComplete(taskId, `RapidTool${i}`, callId, {
                success: true,
                output: { index: i, completed: true }
              });
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          if (['tool:start', 'tool:complete'].includes(event.type)) {
            receivedEvents.push(event);

            // Check when we've received all expected events
            if (receivedEvents.length >= 100) { // 50 starts + 50 completes
              try {
                const startEvents = receivedEvents.filter(e => e.type === 'tool:start');
                const completeEvents = receivedEvents.filter(e => e.type === 'tool:complete');

                expect(startEvents.length).toBe(50);
                expect(completeEvents.length).toBe(50);

                // Verify all indices are present
                const startIndices = startEvents.map(e => e.data.input.index).sort((a, b) => a - b);
                const completeIndices = completeEvents.map(e => e.data.result.output.index).sort((a, b) => a - b);

                expect(startIndices).toEqual(Array.from({ length: 50 }, (_, i) => i));
                expect(completeIndices).toEqual(Array.from({ length: 50 }, (_, i) => i));

                // Verify call IDs match between start and complete events
                startEvents.forEach(startEvent => {
                  const matchingComplete = completeEvents.find(ce =>
                    ce.data.callId === startEvent.data.callId
                  );
                  expect(matchingComplete).toBeDefined();
                });

                ws.close();
                resolve();
              } catch (error) {
                reject(error);
              }
            }
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error(`Timeout: High frequency test failed. Received ${receivedEvents.length} events`));
        }, 10000);
      });
    });
  });
});