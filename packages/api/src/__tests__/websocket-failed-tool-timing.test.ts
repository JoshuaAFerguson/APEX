/**
 * WebSocket Failed Tool Events - Timing Verification Tests
 *
 * Integration tests that verify timing data is correctly broadcast
 * via WebSocket for tools that fail during execution.
 *
 * These tests verify the acceptance criteria outlined in:
 * docs/architecture/failed-tool-timing-test-design.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import WebSocket from 'ws';
import { createServer, ServerOptions } from '../index';
import { FastifyInstance } from 'fastify';
import {
  DEFAULT_TIMING_TOLERANCE,
  ErrorTypes,
  createErrorMessage,
} from '../../../../tests/test-utils/failed-tool-timing-helpers';

// Use vi.hoisted to create the orchestrator instance holder
const { orchestratorInstanceHolder } = vi.hoisted(() => ({
  orchestratorInstanceHolder: { current: null as any },
}));

// Mock the orchestrator with all required exports
vi.mock('@apexcli/orchestrator', () => {
  class MockOrchestrator {
    private tasks = new Map<string, any>();
    private listeners = new Map<string, Function[]>();

    constructor() {
      // Store instance for test access
      orchestratorInstanceHolder.current = this;
    }

    async initialize() {}

    async createTask(options: { description: string }) {
      const task = {
        id: `task_${Date.now()}_failed_timing`,
        description: options.description,
        workflow: 'feature',
        autonomy: 'full',
        status: 'pending',
        priority: 'normal',
        effort: 'medium',
        projectPath: '/test',
        branchName: 'apex/test-failed-timing',
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
      this.tasks.set(task.id, task);
      return task;
    }

    async executeTask() {}
    async getTask(taskId: string) { return this.tasks.get(taskId) || null; }
    async listTasks() { return Array.from(this.tasks.values()); }
    async updateTaskStatus(taskId: string, status: string) {
      const task = this.tasks.get(taskId);
      if (task) task.status = status;
    }
    async cancelTask() { return true; }
    async resumePausedTask() { return true; }
    async hasPendingSubtasks() { return false; }
    async continuePendingSubtasks() {}
    async getAgents() { return {}; }
    async getConfig() { return { project: { name: 'test' }, api: { auth: { enabled: false, apiKeys: [] } } }; }
    async approveGate() {}
    async rejectGate() {}
    async getAllGates() { return []; }
    async listMcpServers() { return []; }
    async getMcpServerDetails() { return null; }
    async installMcpServer() { return {}; }
    async close() {}

    simulateFailedToolComplete(
      taskId: string,
      toolName: string,
      callId: string,
      errorMessage: string,
      durationMs: number = 100
    ) {
      const startTime = new Date(Date.now() - durationMs);
      const endTime = new Date();
      const event = {
        taskId,
        toolName,
        callId,
        result: { success: false, error: errorMessage },
        timing: { startTime, endTime, duration: endTime.getTime() - startTime.getTime() },
        timestamp: new Date(),
      };
      this.emit('tool:complete', event);
      return event;
    }

    simulateToolStart(taskId: string, toolName: string, input: Record<string, unknown>) {
      const event = {
        taskId,
        toolName,
        input,
        timestamp: new Date(),
        callId: `call_${Date.now()}`,
      };
      this.emit('tool:start', event);
      return event;
    }

    simulateToolComplete(
      taskId: string,
      toolName: string,
      callId: string,
      result: { success: boolean; output?: unknown; error?: string }
    ) {
      const startTime = new Date(Date.now() - 1000);
      const endTime = new Date();
      const event = {
        taskId,
        toolName,
        callId,
        result,
        timing: { startTime, endTime, duration: endTime.getTime() - startTime.getTime() },
        timestamp: new Date(),
      };
      this.emit('tool:complete', event);
    }

    on(event: string, listener: Function) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event)!.push(listener);
    }

    emit(event: string, ...args: any[]) {
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.forEach((listener) => listener(...args));
      }
    }
  }

  class MockDaemonManager {
    async getStatus() { return { running: false, uptime: 0 }; }
    async start() { return true; }
    async stop() { return true; }
  }

  class MockHealthMonitor {
    getMetrics() { return {}; }
    checkHealth() { return { healthy: true }; }
  }

  return {
    ApexOrchestrator: MockOrchestrator,
    DaemonManager: MockDaemonManager,
    HealthMonitor: MockHealthMonitor,
    ToolCallStartEvent: class {},
    ToolCallProgressEvent: class {},
    ToolCallCompleteEvent: class {},
  };
});

describe('WebSocket Failed Tool Events - Timing Verification', () => {
  let server: FastifyInstance;
  let testDir: string;
  let port: number;
  let mockOrchestrator: any;

  beforeEach(async () => {
    // Reset orchestrator instance holder
    orchestratorInstanceHolder.current = null;

    testDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'apex-api-failed-tool-timing-')
    );

    // Create minimal config
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `version: "1.0"\nproject:\n  name: test-failed-tool-timing\n`
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
    port = typeof address === 'object' && address !== null ? address.port : 0;

    // Get reference to the mock orchestrator instance created during server setup
    mockOrchestrator = orchestratorInstanceHolder.current;
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
    await fs.rm(testDir, { recursive: true, force: true });
    orchestratorInstanceHolder.current = null;
  });

  describe('Timing Data Broadcasting for Failed Tools', () => {
    it('should broadcast timing data for failed tool events', async () => {
      // Create a task first
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for failed tool timing test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const EXPECTED_DURATION = 150;

      // Set up WebSocket to listen for events
      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            // Simulate a failed tool complete event with specific timing
            const callId = `fail_call_${Date.now()}`;
            mockOrchestrator.simulateFailedToolComplete(
              taskId,
              'FailingNetworkTool',
              callId,
              createErrorMessage(ErrorTypes.NETWORK, 'Connection refused'),
              EXPECTED_DURATION
            );
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());

          // Look for the tool:complete event
          if (event.type === 'tool:complete') {
            try {
              // Verify basic structure
              expect(event.type).toBe('tool:complete');
              expect(event.taskId).toBe(taskId);
              expect(event.timestamp).toBeDefined();

              // Verify failure data
              expect(event.data.result.success).toBe(false);
              expect(event.data.result.error).toContain('Network error');

              // Verify timing data is present and correct
              expect(event.data.timing).toBeDefined();
              expect(event.data.timing.startTime).toBeDefined();
              expect(event.data.timing.endTime).toBeDefined();
              expect(event.data.timing.duration).toBeGreaterThanOrEqual(0);

              // Verify timing is approximately correct
              expect(event.data.timing.duration).toBeGreaterThanOrEqual(
                EXPECTED_DURATION - DEFAULT_TIMING_TOLERANCE
              );
              expect(event.data.timing.duration).toBeLessThanOrEqual(
                EXPECTED_DURATION + DEFAULT_TIMING_TOLERANCE * 2
              );

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
          reject(
            new Error(
              'Timeout: failed tool timing event not received within 5 seconds'
            )
          );
        }, 5000);
      });
    });

    it('should broadcast correct timing for immediate failures', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for immediate failure timing test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            // Simulate an immediate failure (duration = 0 or very small)
            const callId = `immediate_fail_${Date.now()}`;
            mockOrchestrator.simulateFailedToolComplete(
              taskId,
              'ValidationTool',
              callId,
              createErrorMessage(ErrorTypes.VALIDATION, 'Invalid input'),
              5 // Very short duration
            );
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());

          if (event.type === 'tool:complete') {
            try {
              expect(event.data.result.success).toBe(false);
              expect(event.data.timing).toBeDefined();

              // For immediate failures, duration should be very small but valid
              expect(event.data.timing.duration).toBeGreaterThanOrEqual(0);
              expect(event.data.timing.duration).toBeLessThanOrEqual(100);

              // Start time should be before or equal to end time
              const startTime = new Date(event.data.timing.startTime).getTime();
              const endTime = new Date(event.data.timing.endTime).getTime();
              expect(startTime).toBeLessThanOrEqual(endTime);

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
    });

    it('should broadcast correct timing for timeout failures', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for timeout failure timing test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const TIMEOUT_DURATION = 300;
      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            const callId = `timeout_fail_${Date.now()}`;
            mockOrchestrator.simulateFailedToolComplete(
              taskId,
              'SlowOperationTool',
              callId,
              createErrorMessage(ErrorTypes.TIMEOUT, 'Operation exceeded 30s limit'),
              TIMEOUT_DURATION
            );
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());

          if (event.type === 'tool:complete') {
            try {
              expect(event.data.result.success).toBe(false);
              expect(event.data.result.error).toContain('Operation timed out');

              // Duration should reflect the timeout period
              expect(event.data.timing.duration).toBeGreaterThanOrEqual(
                TIMEOUT_DURATION - DEFAULT_TIMING_TOLERANCE
              );

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
    });
  });

  describe('Timing Consistency Between Orchestrator and API', () => {
    it('should verify timing consistency between orchestrator and API broadcast', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for timing consistency test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const EXPECTED_DURATION = 200;
      let orchestratorEvent: any = null;

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            const callId = `consistency_${Date.now()}`;
            // Capture the event at orchestrator level
            orchestratorEvent = mockOrchestrator.simulateFailedToolComplete(
              taskId,
              'ConsistencyTool',
              callId,
              'Consistency test error',
              EXPECTED_DURATION
            );
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());

          if (event.type === 'tool:complete') {
            try {
              // Compare orchestrator event with broadcast event
              expect(orchestratorEvent).toBeTruthy();

              // Timing data should match
              expect(event.data.timing.duration).toBe(
                orchestratorEvent.timing.duration
              );

              // Start/end times should be serialized correctly
              const broadcastStartTime = new Date(
                event.data.timing.startTime
              ).getTime();
              const orchestratorStartTime =
                orchestratorEvent.timing.startTime.getTime();
              expect(broadcastStartTime).toBe(orchestratorStartTime);

              const broadcastEndTime = new Date(
                event.data.timing.endTime
              ).getTime();
              const orchestratorEndTime =
                orchestratorEvent.timing.endTime.getTime();
              expect(broadcastEndTime).toBe(orchestratorEndTime);

              // Result should match
              expect(event.data.result.success).toBe(
                orchestratorEvent.result.success
              );
              expect(event.data.result.error).toBe(orchestratorEvent.result.error);

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
    });

    it('should preserve timing precision in WebSocket transmission', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for precision test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Use a specific duration to verify precision
      const PRECISE_DURATION = 137;

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            const callId = `precision_${Date.now()}`;
            mockOrchestrator.simulateFailedToolComplete(
              taskId,
              'PrecisionTool',
              callId,
              'Precision test error',
              PRECISE_DURATION
            );
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());

          if (event.type === 'tool:complete') {
            try {
              // Duration should be precise (no truncation in transmission)
              expect(typeof event.data.timing.duration).toBe('number');
              expect(Number.isInteger(event.data.timing.duration)).toBe(true);

              // Should be close to expected duration
              expect(event.data.timing.duration).toBeGreaterThanOrEqual(
                PRECISE_DURATION - 1
              );
              expect(event.data.timing.duration).toBeLessThanOrEqual(
                PRECISE_DURATION + 1
              );

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
    });
  });

  describe('Multiple Failed Tool Events', () => {
    it('should broadcast timing for multiple concurrent failures', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for concurrent failures test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const failedEvents: any[] = [];
      const expectedDurations = [100, 150, 200];

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            // Simulate multiple failures with different durations
            expectedDurations.forEach((duration, index) => {
              setTimeout(() => {
                mockOrchestrator.simulateFailedToolComplete(
                  taskId,
                  `FailTool_${index}`,
                  `concurrent_fail_${index}`,
                  `Error ${index}`,
                  duration
                );
              }, index * 50); // Stagger the events slightly
            });
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());

          if (event.type === 'tool:complete' && !event.data.result.success) {
            failedEvents.push(event);

            if (failedEvents.length === expectedDurations.length) {
              try {
                // Each event should have valid timing
                failedEvents.forEach((evt, index) => {
                  expect(evt.data.timing).toBeDefined();
                  expect(evt.data.timing.duration).toBeGreaterThanOrEqual(0);

                  // Should be approximately the expected duration
                  expect(evt.data.timing.duration).toBeGreaterThanOrEqual(
                    expectedDurations[index] - DEFAULT_TIMING_TOLERANCE
                  );
                  expect(evt.data.timing.duration).toBeLessThanOrEqual(
                    expectedDurations[index] + DEFAULT_TIMING_TOLERANCE * 2
                  );
                });

                // Each event should have unique call ID
                const callIds = failedEvents.map((e) => e.data.callId);
                expect(new Set(callIds).size).toBe(failedEvents.length);

                ws.close();
                resolve();
              } catch (error) {
                reject(error);
              }
            }
          }
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Timeout waiting for all events')), 10000);
      });
    });

    it('should distinguish timing between successful and failed tools', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for mixed results test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const allEvents: any[] = [];

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            // Simulate one success and one failure
            mockOrchestrator.simulateToolComplete(
              taskId,
              'SuccessTool',
              'success_call',
              { success: true, output: 'Success' }
            );

            mockOrchestrator.simulateFailedToolComplete(
              taskId,
              'FailTool',
              'fail_call',
              'Test failure',
              100
            );
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());

          if (event.type === 'tool:complete') {
            allEvents.push(event);

            if (allEvents.length === 2) {
              try {
                const successEvent = allEvents.find((e) => e.data.result.success);
                const failEvent = allEvents.find((e) => !e.data.result.success);

                expect(successEvent).toBeDefined();
                expect(failEvent).toBeDefined();

                // Both should have timing
                expect(successEvent.data.timing).toBeDefined();
                expect(failEvent.data.timing).toBeDefined();

                // Both should have valid duration
                expect(successEvent.data.timing.duration).toBeGreaterThanOrEqual(0);
                expect(failEvent.data.timing.duration).toBeGreaterThanOrEqual(0);

                // They should have different call IDs
                expect(successEvent.data.callId).not.toBe(failEvent.data.callId);

                ws.close();
                resolve();
              } catch (error) {
                reject(error);
              }
            }
          }
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
    });
  });

  describe('Error Message Preservation', () => {
    it('should preserve full error message in timing event', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Task for error message test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const LONG_ERROR_MESSAGE =
        'This is a detailed error message with specific information about what went wrong. ' +
        'It includes diagnostic data: code=E001, severity=critical, component=NetworkHandler. ' +
        'Stack trace: at processRequest() at handleTool() at executeWorkflow()';

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            mockOrchestrator.simulateFailedToolComplete(
              taskId,
              'DetailedErrorTool',
              `detailed_error_${Date.now()}`,
              LONG_ERROR_MESSAGE,
              50
            );
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());

          if (event.type === 'tool:complete') {
            try {
              expect(event.data.result.success).toBe(false);
              // Error message should be fully preserved
              expect(event.data.result.error).toBe(LONG_ERROR_MESSAGE);
              expect(event.data.result.error.length).toBe(LONG_ERROR_MESSAGE.length);

              // Timing should still be valid
              expect(event.data.timing.duration).toBeGreaterThanOrEqual(0);

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
    });
  });
});
