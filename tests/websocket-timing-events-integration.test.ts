import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import WebSocket from 'ws';
import { createServer, ServerOptions } from '@apexcli/api';
import { FastifyInstance } from 'fastify';

// Mock the orchestrator to control tool event emission for WebSocket testing
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
    id: 'task_websocket_timing_test',
    description: 'Test task for WebSocket timing events',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: '/test',
    branchName: 'apex/test-websocket-timing',
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
      const task = {
        ...mockTask,
        id: `task_${Date.now()}_websocket`,
        description: options.description
      };
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

    // Enhanced tool event simulation with proper timing data
    simulateToolStart(taskId: string, toolName: string, input: Record<string, unknown>, callId?: string) {
      const timestamp = new Date();
      const event = {
        taskId,
        toolName,
        input,
        timestamp,
        callId: callId || `call_${Date.now()}`,
        startTime: timestamp // Include explicit startTime
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

    simulateToolComplete(
      taskId: string,
      toolName: string,
      callId: string,
      result: { success: boolean; output?: unknown; error?: string },
      startTime?: Date
    ) {
      const actualStartTime = startTime || new Date(Date.now() - 1000); // Default to 1 second ago
      const endTime = new Date();
      const event = {
        taskId,
        toolName,
        callId,
        result,
        timing: {
          startTime: actualStartTime,
          endTime: endTime,
          duration: endTime.getTime() - actualStartTime.getTime()
        },
        timestamp: endTime
      };
      this.emit('tool:complete', event);
    }

    // Simulate realistic tool execution sequence
    async simulateRealisticToolExecution(
      taskId: string,
      toolName: string,
      executionTimeMs: number = 1000,
      withProgress: boolean = true
    ) {
      const callId = this.simulateToolStart(taskId, toolName, { realistic: 'test' });
      const startTime = new Date();

      if (withProgress) {
        // Emit progress events during execution
        const progressInterval = Math.max(100, executionTimeMs / 10);
        const progressCount = Math.floor(executionTimeMs / progressInterval);

        for (let i = 1; i <= progressCount; i++) {
          await new Promise(resolve => setTimeout(resolve, progressInterval));
          const percentage = Math.round((i / progressCount) * 100);
          this.simulateToolProgress(taskId, toolName, callId, {
            message: `Processing... ${percentage}%`,
            percentage
          });
        }
      } else {
        // Just wait for the execution time without progress
        await new Promise(resolve => setTimeout(resolve, executionTimeMs));
      }

      this.simulateToolComplete(taskId, toolName, callId, {
        success: true,
        output: 'Execution completed successfully'
      }, startTime);

      return callId;
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
        listeners.forEach(listener => listener(...args));
      }
    }

    removeAllListeners(event?: string) {
      if (event) {
        this.listeners.delete(event);
      } else {
        this.listeners.clear();
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

// NOTE: This test suite is currently skipped because it requires more sophisticated
// mock infrastructure. The orchestrator mock is set up via vi.mock(), but the server's
// internal orchestrator instance isn't accessible for event simulation.
// See ADR-timing-consistency-tests.md for the recommended refactoring approach.
describe.skip('WebSocket Tool Timing Events Integration', () => {
  let server: FastifyInstance;
  let testDir: string;
  let port: number;
  let mockOrchestrator: any;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-websocket-timing-'));

    // Create minimal config
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `version: "1.0"\nproject:\n  name: test-websocket-timing\n`
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

    // Get reference to the mock orchestrator
    mockOrchestrator = (server as any).orchestrator;
  });

  afterEach(async () => {
    await server.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Acceptance Criteria 2: WebSocket Event Propagation', () => {
    it('should stream tool:start events with startTime field via WebSocket', async () => {
      // Create a task first
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for WebSocket startTime test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Set up WebSocket to listen for events
      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout: tool:start event not received within 5 seconds'));
        }, 5000);

        ws.on('open', () => {
          try {
            // Simulate a tool start event with explicit timing
            mockOrchestrator.simulateToolStart(taskId, 'TimingTestTool', {
              test: 'startTime',
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          if (event.type === 'tool:start') {
            try {
              // Verify event structure
              expect(event.type).toBe('tool:start');
              expect(event.taskId).toBe(taskId);
              expect(event.timestamp).toBeDefined();
              expect(event.data.toolName).toBe('TimingTestTool');
              expect(event.data.callId).toBeDefined();
              expect(event.data.input).toBeDefined();

              // Verify timing fields
              expect(event.data.startTime).toBeDefined();
              expect(event.data.timestamp).toBeDefined();

              // Verify timing data can be parsed as dates
              const startTime = new Date(event.data.startTime);
              const timestamp = new Date(event.data.timestamp);
              expect(startTime.getTime()).toBeCloseTo(timestamp.getTime(), 100);

              clearTimeout(timeout);
              ws.close();
              resolve();
            } catch (error) {
              clearTimeout(timeout);
              reject(error);
            }
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    it('should stream tool:complete events with full timing data via WebSocket', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for WebSocket complete timing test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout: tool:complete event not received within 5 seconds'));
        }, 5000);

        ws.on('open', () => {
          try {
            const callId = `timing_complete_test_${Date.now()}`;
            const startTime = new Date();

            // Wait a bit to create measurable duration
            setTimeout(() => {
              mockOrchestrator.simulateToolComplete(taskId, 'CompleteTimingTool', callId, {
                success: true,
                output: { result: 'timing test completed' }
              }, startTime);
            }, 200);
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          if (event.type === 'tool:complete') {
            try {
              // Verify basic event structure
              expect(event.type).toBe('tool:complete');
              expect(event.taskId).toBe(taskId);
              expect(event.timestamp).toBeDefined();
              expect(event.data.toolName).toBe('CompleteTimingTool');
              expect(event.data.callId).toBeDefined();
              expect(event.data.result).toBeDefined();

              // Verify timing object structure
              expect(event.data.timing).toBeDefined();
              expect(event.data.timing.startTime).toBeDefined();
              expect(event.data.timing.endTime).toBeDefined();
              expect(event.data.timing.duration).toBeDefined();

              // Verify timing data types and relationships
              const startTime = new Date(event.data.timing.startTime);
              const endTime = new Date(event.data.timing.endTime);
              const duration = event.data.timing.duration;

              expect(endTime.getTime()).toBeGreaterThan(startTime.getTime());
              expect(duration).toBe(endTime.getTime() - startTime.getTime());
              expect(duration).toBeGreaterThanOrEqual(180); // Should be at least 180ms

              clearTimeout(timeout);
              ws.close();
              resolve();
            } catch (error) {
              clearTimeout(timeout);
              reject(error);
            }
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    it('should maintain event sequence and timing consistency via WebSocket', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for WebSocket sequence test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout: complete sequence not received within 10 seconds'));
        }, 10000);

        ws.on('open', async () => {
          try {
            // Simulate realistic tool execution with progress
            await mockOrchestrator.simulateRealisticToolExecution(
              taskId,
              'SequenceTestTool',
              500, // 500ms execution
              true // with progress
            );
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          // Check if we received the complete sequence
          const toolEvents = receivedEvents.filter(e => e.type?.startsWith('tool:'));
          const hasStart = toolEvents.some(e => e.type === 'tool:start');
          const hasProgress = toolEvents.some(e => e.type === 'tool:progress');
          const hasComplete = toolEvents.some(e => e.type === 'tool:complete');

          if (hasStart && hasComplete) {
            try {
              // Verify event sequence
              const startEvent = toolEvents.find(e => e.type === 'tool:start');
              const completeEvent = toolEvents.find(e => e.type === 'tool:complete');
              const progressEvents = toolEvents.filter(e => e.type === 'tool:progress');

              expect(startEvent).toBeDefined();
              expect(completeEvent).toBeDefined();
              expect(progressEvents.length).toBeGreaterThan(0);

              // Verify timing consistency
              expect(startEvent.data.callId).toBe(completeEvent.data.callId);
              expect(startEvent.data.toolName).toBe(completeEvent.data.toolName);

              // Verify timing relationship
              const startTime = new Date(startEvent.data.startTime);
              const completeStartTime = new Date(completeEvent.data.timing.startTime);
              const endTime = new Date(completeEvent.data.timing.endTime);

              expect(startTime.getTime()).toBe(completeStartTime.getTime());
              expect(endTime.getTime()).toBeGreaterThan(startTime.getTime());

              // Verify duration is reasonable (should be around 500ms)
              const duration = completeEvent.data.timing.duration;
              expect(duration).toBeGreaterThanOrEqual(450);
              expect(duration).toBeLessThanOrEqual(600);

              clearTimeout(timeout);
              ws.close();
              resolve();
            } catch (error) {
              clearTimeout(timeout);
              reject(error);
            }
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    it('should handle concurrent tools with proper timing isolation via WebSocket', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for concurrent WebSocket timing test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout: concurrent tools sequence not received within 15 seconds'));
        }, 15000);

        ws.on('open', async () => {
          try {
            // Start multiple concurrent tools with different durations
            const tool1Promise = mockOrchestrator.simulateRealisticToolExecution(
              taskId, 'FastTool', 300, false
            );

            const tool2Promise = mockOrchestrator.simulateRealisticToolExecution(
              taskId, 'SlowTool', 800, true
            );

            const tool3Promise = mockOrchestrator.simulateRealisticToolExecution(
              taskId, 'MediumTool', 500, true
            );

            // Wait for all tools to complete
            await Promise.all([tool1Promise, tool2Promise, tool3Promise]);
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          // Check if we have complete sequences for all three tools
          const toolEvents = receivedEvents.filter(e => e.type?.startsWith('tool:'));
          const completeEvents = toolEvents.filter(e => e.type === 'tool:complete');

          if (completeEvents.length >= 3) {
            try {
              // Verify we have events for all three tools
              const toolNames = completeEvents.map(e => e.data.toolName);
              expect(toolNames).toContain('FastTool');
              expect(toolNames).toContain('SlowTool');
              expect(toolNames).toContain('MediumTool');

              // Verify each tool has proper timing data
              completeEvents.forEach(event => {
                expect(event.data.timing).toBeDefined();
                expect(event.data.timing.startTime).toBeDefined();
                expect(event.data.timing.endTime).toBeDefined();
                expect(event.data.timing.duration).toBeGreaterThan(0);
              });

              // Verify timing isolation - each tool should have different durations
              const durations = completeEvents.map(e => e.data.timing.duration);
              const fastToolDuration = completeEvents.find(e => e.data.toolName === 'FastTool')?.data.timing.duration;
              const slowToolDuration = completeEvents.find(e => e.data.toolName === 'SlowTool')?.data.timing.duration;

              expect(fastToolDuration).toBeLessThan(slowToolDuration);

              clearTimeout(timeout);
              ws.close();
              resolve();
            } catch (error) {
              clearTimeout(timeout);
              reject(error);
            }
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    it('should stream tool events with proper JSON serialization of timing data', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for JSON serialization test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      let rawEventData: string | null = null;

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout: JSON serialization test not completed within 5 seconds'));
        }, 5000);

        ws.on('open', () => {
          try {
            const callId = mockOrchestrator.simulateToolStart(taskId, 'JsonTestTool', {
              test: 'serialization'
            });

            setTimeout(() => {
              mockOrchestrator.simulateToolComplete(taskId, 'JsonTestTool', callId, {
                success: true,
                output: 'Serialization test'
              });
            }, 100);
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });

        ws.on('message', (data) => {
          rawEventData = data.toString();

          try {
            // Verify the raw data can be parsed as valid JSON
            const event = JSON.parse(rawEventData);

            if (event.type === 'tool:complete') {
              // Verify timing fields are properly serialized
              expect(typeof event.data.timing.startTime).toBe('string');
              expect(typeof event.data.timing.endTime).toBe('string');
              expect(typeof event.data.timing.duration).toBe('number');

              // Verify dates can be properly deserialized
              const startTime = new Date(event.data.timing.startTime);
              const endTime = new Date(event.data.timing.endTime);
              expect(startTime.getTime()).toBeLessThanOrEqual(endTime.getTime());

              // Verify no NaN or invalid values
              expect(isNaN(startTime.getTime())).toBe(false);
              expect(isNaN(endTime.getTime())).toBe(false);
              expect(isNaN(event.data.timing.duration)).toBe(false);

              clearTimeout(timeout);
              ws.close();
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(new Error(`JSON parsing failed: ${error.message}. Raw data: ${rawEventData}`));
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  });

  describe('WebSocket Event Filtering with Timing Events', () => {
    it('should filter timing events when using event query parameters', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for timing event filtering test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Connect with specific event filters
      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}?events=tool:start,tool:complete`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout: event filtering test not completed within 8 seconds'));
        }, 8000);

        ws.on('open', async () => {
          try {
            // Simulate tool execution with progress (progress should be filtered out)
            await mockOrchestrator.simulateRealisticToolExecution(
              taskId, 'FilterTestTool', 400, true
            );
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);
        });

        // Give time for all events to be processed
        setTimeout(() => {
          try {
            const toolEvents = receivedEvents.filter(e => e.type?.startsWith('tool:'));
            const eventTypes = toolEvents.map(e => e.type);

            // Should have start and complete events
            expect(eventTypes).toContain('tool:start');
            expect(eventTypes).toContain('tool:complete');

            // Should NOT have progress events due to filtering
            expect(eventTypes).not.toContain('tool:progress');

            clearTimeout(timeout);
            ws.close();
            resolve();
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        }, 1000);

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  });
});