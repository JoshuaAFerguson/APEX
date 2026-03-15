import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import WebSocket from 'ws';
import { createServer, ServerOptions } from './index';
import { FastifyInstance } from 'fastify';

// Mock the orchestrator to control tool event emission for testing
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
    id: 'task_123_tool_test',
    description: 'Test task for tool events',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: '/test',
    branchName: 'apex/test-tool-events',
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
      const task = { ...mockTask, id: `task_${Date.now()}_tool`, description: options.description };
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

    // Tool event simulation methods
    simulateToolStart(taskId: string, toolName: string, input: Record<string, unknown>) {
      const timestamp = new Date();
      const event = {
        taskId,
        toolName,
        input,
        timestamp,
        callId: `call_${Date.now()}`,
        startTime: timestamp // Add explicit startTime field
      };
      this.emit('tool:start', event);
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
      const startTime = new Date(Date.now() - 1000); // 1 second ago
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

  return {
    ApexOrchestrator: MockOrchestrator,
    ToolCallStartEvent: class {},
    ToolCallProgressEvent: class {},
    ToolCallCompleteEvent: class {},
  };
});

describe('WebSocket Tool Events', () => {
  let server: FastifyInstance;
  let testDir: string;
  let port: number;
  let mockOrchestrator: any;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-api-tool-events-'));

    // Create minimal config
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `version: "1.0"\nproject:\n  name: test-tool-events\n`
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

  describe('tool:start WebSocket event', () => {
    it('should broadcast tool:start event when a tool call begins', async () => {
      // Create a task first
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for tool:start event test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Set up WebSocket to listen for events
      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            // Simulate a tool start event
            mockOrchestrator.simulateToolStart(taskId, 'ReadFile', { filePath: '/test.txt' });
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          // Look for the tool:start event
          if (event.type === 'tool:start') {
            try {
              expect(event.type).toBe('tool:start');
              expect(event.taskId).toBe(taskId);
              expect(event.timestamp).toBeDefined();
              expect(event.data.toolName).toBe('ReadFile');
              expect(event.data.input).toEqual({ filePath: '/test.txt' });
              expect(event.data.callId).toBeDefined();

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
          reject(new Error('Timeout: tool:start event not received within 5 seconds'));
        }, 5000);
      });
    });
  });

  describe('tool:progress WebSocket event', () => {
    it('should broadcast tool:progress event during long-running operations', async () => {
      // Create a task first
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for tool:progress event test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Set up WebSocket to listen for events
      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            // Simulate a tool progress event
            const callId = `call_${Date.now()}`;
            mockOrchestrator.simulateToolProgress(taskId, 'LargeFileProcessor', callId, {
              message: 'Processing file...',
              percentage: 45
            });
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          // Look for the tool:progress event
          if (event.type === 'tool:progress') {
            try {
              expect(event.type).toBe('tool:progress');
              expect(event.taskId).toBe(taskId);
              expect(event.timestamp).toBeDefined();
              expect(event.data.toolName).toBe('LargeFileProcessor');
              expect(event.data.callId).toBeDefined();
              expect(event.data.progress.message).toBe('Processing file...');
              expect(event.data.progress.percentage).toBe(45);

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
          reject(new Error('Timeout: tool:progress event not received within 5 seconds'));
        }, 5000);
      });
    });
  });

  describe('tool:complete WebSocket event', () => {
    it('should broadcast tool:complete event when a tool call completes successfully', async () => {
      // Create a task first
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for tool:complete event test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Set up WebSocket to listen for events
      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            // Simulate a tool complete event
            const callId = `call_${Date.now()}`;
            mockOrchestrator.simulateToolComplete(taskId, 'WriteFile', callId, {
              success: true,
              output: { bytesWritten: 1024 }
            });
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          // Look for the tool:complete event
          if (event.type === 'tool:complete') {
            try {
              expect(event.type).toBe('tool:complete');
              expect(event.taskId).toBe(taskId);
              expect(event.timestamp).toBeDefined();
              expect(event.data.toolName).toBe('WriteFile');
              expect(event.data.callId).toBeDefined();
              expect(event.data.result.success).toBe(true);
              expect(event.data.result.output).toEqual({ bytesWritten: 1024 });
              expect(event.data.timing).toBeDefined();
              expect(event.data.timing.startTime).toBeDefined();
              expect(event.data.timing.endTime).toBeDefined();
              expect(event.data.timing.duration).toBeGreaterThanOrEqual(0);

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
          reject(new Error('Timeout: tool:complete event not received within 5 seconds'));
        }, 5000);
      });
    });

    it('should broadcast tool:complete event when a tool call fails', async () => {
      // Create a task first
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for tool:complete error event test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Set up WebSocket to listen for events
      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            // Simulate a tool complete event with error
            const callId = `call_${Date.now()}`;
            mockOrchestrator.simulateToolComplete(taskId, 'DeleteFile', callId, {
              success: false,
              error: 'File not found'
            });
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          // Look for the tool:complete event
          if (event.type === 'tool:complete') {
            try {
              expect(event.type).toBe('tool:complete');
              expect(event.taskId).toBe(taskId);
              expect(event.timestamp).toBeDefined();
              expect(event.data.toolName).toBe('DeleteFile');
              expect(event.data.callId).toBeDefined();
              expect(event.data.result.success).toBe(false);
              expect(event.data.result.error).toBe('File not found');
              expect(event.data.timing).toBeDefined();

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
          reject(new Error('Timeout: tool:complete error event not received within 5 seconds'));
        }, 5000);
      });
    });
  });

  describe('Event filtering for tool events', () => {
    it('should filter tool events when using event query parameter', async () => {
      // Create a task first
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for tool event filtering test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Set up WebSocket with tool event filtering
      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}?events=tool:start,tool:complete`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            const callId = `call_${Date.now()}`;
            // Simulate multiple event types
            mockOrchestrator.simulateToolStart(taskId, 'TestTool', { test: true });
            mockOrchestrator.simulateToolProgress(taskId, 'TestTool', callId, { message: 'In progress...' });
            mockOrchestrator.simulateToolComplete(taskId, 'TestTool', callId, { success: true });
            // Also emit a non-tool event (this should be filtered out)
            mockOrchestrator.emit('agent:thinking', taskId, 'test-agent', 'I am thinking...');
          } catch (error) {
            reject(error);
          }
        });

        let startEventReceived = false;
        let completeEventReceived = false;

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          if (event.type === 'tool:start') {
            startEventReceived = true;
          }
          if (event.type === 'tool:complete') {
            completeEventReceived = true;
          }

          // Check if we should have received both filtered events
          if (startEventReceived && completeEventReceived) {
            try {
              // Should only have received tool:start and tool:complete events, not tool:progress or agent:thinking
              const eventTypes = receivedEvents.map(e => e.type);
              expect(eventTypes).toContain('tool:start');
              expect(eventTypes).toContain('tool:complete');
              expect(eventTypes).not.toContain('tool:progress');
              expect(eventTypes).not.toContain('agent:thinking');
              expect(eventTypes).not.toContain('task:state'); // Initial state event should still be sent

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
          reject(new Error('Timeout: Event filtering test failed'));
        }, 5000);
      });
    });
  });
});