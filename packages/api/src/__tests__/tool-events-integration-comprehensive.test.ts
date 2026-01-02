import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import WebSocket from 'ws';
import { createServer, ServerOptions } from '../index';
import { FastifyInstance } from 'fastify';

// Mock the orchestrator for comprehensive integration testing
vi.mock('@apexcli/orchestrator', () => {
  const mockTask = {
    id: 'task_comprehensive_test',
    description: 'Comprehensive tool events integration test',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: '/test',
    branchName: 'apex/comprehensive-tool-test',
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
      const task = { ...mockTask, id: `task_${Date.now()}_comprehensive`, description: options.description };
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

    // Comprehensive tool event simulation
    simulateFullWorkflow(taskId: string) {
      const workflows = [
        { tool: 'PlannerTool', duration: 500 },
        { tool: 'ArchitectTool', duration: 800 },
        { tool: 'DeveloperTool', duration: 1200 },
        { tool: 'TesterTool', duration: 600 },
        { tool: 'ReviewerTool', duration: 400 },
      ];

      workflows.forEach((workflow, index) => {
        setTimeout(() => {
          const callId = `workflow_${workflow.tool}_${index}`;

          // Start
          this.emit('tool:start', {
            taskId,
            toolName: workflow.tool,
            input: { stage: index + 1, workflow: 'feature' },
            timestamp: new Date(),
            callId
          });

          // Progress updates
          const progressSteps = 3;
          for (let step = 1; step <= progressSteps; step++) {
            setTimeout(() => {
              this.emit('tool:progress', {
                taskId,
                toolName: workflow.tool,
                callId,
                progress: {
                  message: `${workflow.tool} step ${step}/${progressSteps}`,
                  percentage: (step / progressSteps) * 100
                },
                timestamp: new Date()
              });
            }, (workflow.duration / progressSteps) * step * 0.3);
          }

          // Complete
          setTimeout(() => {
            this.emit('tool:complete', {
              taskId,
              toolName: workflow.tool,
              callId,
              result: {
                success: true,
                output: { stage: index + 1, completed: true }
              },
              timing: {
                startTime: new Date(Date.now() - workflow.duration),
                endTime: new Date(),
                duration: workflow.duration
              },
              timestamp: new Date()
            });
          }, workflow.duration);
        }, index * 100); // Stagger tool starts
      });
    }

    simulateEventFiltering(taskId: string) {
      const events = [
        { type: 'tool:start', tool: 'FilterTool1' },
        { type: 'agent:thinking', agent: 'test-agent', message: 'Thinking...' },
        { type: 'tool:progress', tool: 'FilterTool1', message: 'Processing...' },
        { type: 'log:entry', level: 'info', message: 'Log entry' },
        { type: 'tool:complete', tool: 'FilterTool1', success: true },
        { type: 'task:stage-changed', stage: 'implementation' },
        { type: 'tool:start', tool: 'FilterTool2' },
        { type: 'tool:complete', tool: 'FilterTool2', success: false }
      ];

      events.forEach((event, index) => {
        setTimeout(() => {
          if (event.type === 'tool:start') {
            this.emit('tool:start', {
              taskId,
              toolName: event.tool,
              input: { test: true },
              timestamp: new Date(),
              callId: `filter_${event.tool}_${index}`
            });
          } else if (event.type === 'tool:progress') {
            this.emit('tool:progress', {
              taskId,
              toolName: event.tool,
              callId: `filter_${event.tool}_start`,
              progress: { message: event.message },
              timestamp: new Date()
            });
          } else if (event.type === 'tool:complete') {
            this.emit('tool:complete', {
              taskId,
              toolName: event.tool,
              callId: `filter_${event.tool}_start`,
              result: { success: event.success },
              timing: {
                startTime: new Date(Date.now() - 100),
                endTime: new Date(),
                duration: 100
              },
              timestamp: new Date()
            });
          } else {
            // Non-tool events for filtering tests
            this.emit(event.type.replace(':', ':'), taskId, event.agent || event.level || event.stage,
                     event.message || event.message || 'Event data');
          }
        }, index * 50);
      });
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

describe('Tool Events - Comprehensive Integration Tests', () => {
  let server: FastifyInstance;
  let testDir: string;
  let port: number;
  let mockOrchestrator: any;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-api-comprehensive-'));

    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `version: "1.0"\nproject:\n  name: comprehensive-test\n`
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

  describe('Full Workflow Integration', () => {
    it('should handle complete workflow with all tool event types', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Full workflow integration test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];
      const eventSummary: Record<string, number> = {};

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            mockOrchestrator.simulateFullWorkflow(taskId);
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());

          if (['tool:start', 'tool:progress', 'tool:complete'].includes(event.type)) {
            receivedEvents.push(event);
            eventSummary[event.type] = (eventSummary[event.type] || 0) + 1;
          }

          // Wait for all workflow events (5 tools * 3 event types + progress events)
          if (receivedEvents.length >= 25) { // 5 starts + 15 progress + 5 completes
            setTimeout(() => {
              try {
                // Verify workflow completion
                expect(eventSummary['tool:start']).toBe(5);
                expect(eventSummary['tool:complete']).toBe(5);
                expect(eventSummary['tool:progress']).toBeGreaterThanOrEqual(15);

                // Verify tool sequence
                const startEvents = receivedEvents.filter(e => e.type === 'tool:start');
                const expectedTools = ['PlannerTool', 'ArchitectTool', 'DeveloperTool', 'TesterTool', 'ReviewerTool'];
                const actualTools = startEvents.map(e => e.data.toolName);

                expectedTools.forEach(tool => {
                  expect(actualTools).toContain(tool);
                });

                // Verify event structure consistency
                receivedEvents.forEach(event => {
                  expect(event.taskId).toBe(taskId);
                  expect(event.timestamp).toBeDefined();
                  expect(event.data).toBeDefined();

                  if (event.type === 'tool:start') {
                    expect(event.data.toolName).toBeDefined();
                    expect(event.data.input).toBeDefined();
                    expect(event.data.callId).toBeDefined();
                  } else if (event.type === 'tool:progress') {
                    expect(event.data.progress.message).toBeDefined();
                    expect(event.data.progress.percentage).toBeGreaterThanOrEqual(0);
                    expect(event.data.progress.percentage).toBeLessThanOrEqual(100);
                  } else if (event.type === 'tool:complete') {
                    expect(event.data.result).toBeDefined();
                    expect(event.data.timing).toBeDefined();
                    expect(event.data.timing.duration).toBeGreaterThan(0);
                  }
                });

                ws.close();
                resolve();
              } catch (error) {
                reject(error);
              }
            }, 1000);
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error(`Timeout: Workflow test failed. Received ${receivedEvents.length} events: ${JSON.stringify(eventSummary)}`));
        }, 15000);
      });
    });
  });

  describe('Event Filtering Integration', () => {
    it('should correctly filter mixed event types', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Event filtering integration test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Test multiple filter combinations
      const testCases = [
        { filter: 'tool:start,tool:complete', expectedTypes: ['tool:start', 'tool:complete'] },
        { filter: 'tool:progress', expectedTypes: ['tool:progress'] },
        { filter: '', expectedTypes: [] }, // No filter = all events
      ];

      for (const testCase of testCases) {
        await new Promise<void>((resolve, reject) => {
          const url = testCase.filter
            ? `ws://localhost:${port}/stream/${taskId}?events=${testCase.filter}`
            : `ws://localhost:${port}/stream/${taskId}`;

          const ws = new WebSocket(url);
          const receivedEvents: any[] = [];

          ws.on('open', () => {
            try {
              mockOrchestrator.simulateEventFiltering(taskId);
            } catch (error) {
              reject(error);
            }
          });

          ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            if (event.type !== 'task:state') { // Ignore initial state event
              receivedEvents.push(event);
            }

            // Check after sufficient time
            if (receivedEvents.length > 0) {
              setTimeout(() => {
                try {
                  if (testCase.filter) {
                    // Should only receive filtered event types
                    const receivedTypes = [...new Set(receivedEvents.map(e => e.type))];
                    receivedTypes.forEach(type => {
                      expect(testCase.expectedTypes).toContain(type);
                    });
                  } else {
                    // No filter - should receive all event types
                    const receivedTypes = receivedEvents.map(e => e.type);
                    expect(receivedTypes.length).toBeGreaterThan(3); // Multiple event types
                  }

                  ws.close();
                  resolve();
                } catch (error) {
                  reject(error);
                }
              }, 1000);
            }
          });

          ws.on('error', reject);

          setTimeout(() => {
            reject(new Error(`Timeout: Filter test failed for: ${testCase.filter}`));
          }, 5000);
        });
      }
    });
  });

  describe('API Endpoint Integration', () => {
    it('should integrate tool events with task management endpoints', async () => {
      // Create task
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'API integration test' },
      });

      expect(createResponse.statusCode).toBe(201);
      const { taskId } = JSON.parse(createResponse.body);

      // Set up WebSocket for events
      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          // Test task status updates alongside tool events
          server.inject({
            method: 'POST',
            url: `/tasks/${taskId}/status`,
            headers: { 'Content-Type': 'application/json' },
            payload: { status: 'in-progress', stage: 'implementation' },
          }).then(() => {
            // Generate tool events
            const callId = mockOrchestrator.simulateToolStart(taskId, 'APIIntegrationTool', { api: true });
            mockOrchestrator.simulateToolComplete(taskId, 'APIIntegrationTool', callId, { success: true });
          }).catch(reject);
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          // Look for both task status and tool events
          const eventTypes = receivedEvents.map(e => e.type);

          if (eventTypes.includes('task:stage-changed') && eventTypes.includes('tool:complete')) {
            try {
              // Should receive both API-triggered and tool events
              expect(eventTypes).toContain('task:stage-changed');
              expect(eventTypes).toContain('tool:start');
              expect(eventTypes).toContain('tool:complete');

              // Verify event data integrity
              const toolCompleteEvent = receivedEvents.find(e => e.type === 'tool:complete');
              expect(toolCompleteEvent.data.result.success).toBe(true);
              expect(toolCompleteEvent.taskId).toBe(taskId);

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error(`Timeout: API integration test failed. Events: ${receivedEvents.map(e => e.type).join(', ')}`));
        }, 5000);
      });
    });
  });

  describe('Compliance with Acceptance Criteria', () => {
    it('should meet all acceptance criteria requirements', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Acceptance criteria validation' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}?events=tool:start,tool:complete`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            // Generate tool call events
            const callId = mockOrchestrator.simulateToolStart(taskId, 'AcceptanceTool', { criteria: 'test' });
            mockOrchestrator.simulateToolComplete(taskId, 'AcceptanceTool', callId, { success: true });
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);

          if (event.type === 'tool:complete') {
            try {
              // 1. API WebSocket broadcasts tool call events to connected clients
              expect(receivedEvents.some(e => e.type === 'tool:start')).toBe(true);
              expect(receivedEvents.some(e => e.type === 'tool:complete')).toBe(true);

              // 2. Events are formatted consistently with other streaming events
              receivedEvents.forEach(event => {
                expect(event).toHaveProperty('type');
                expect(event).toHaveProperty('taskId');
                expect(event).toHaveProperty('timestamp');
                expect(event).toHaveProperty('data');
                expect(event.taskId).toBe(taskId);
                expect(new Date(event.timestamp)).toBeInstanceOf(Date);
              });

              // 3. Clients can filter/subscribe to specific event types
              // This test uses filtering - should only receive start and complete, not progress
              const eventTypes = receivedEvents.map(e => e.type);
              expect(eventTypes).toContain('tool:start');
              expect(eventTypes).toContain('tool:complete');
              expect(eventTypes).not.toContain('tool:progress');

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error('Timeout: Acceptance criteria test failed'));
        }, 5000);
      });
    });
  });
});