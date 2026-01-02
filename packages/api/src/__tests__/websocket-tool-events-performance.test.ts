import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import WebSocket from 'ws';
import { createServer, ServerOptions } from '../index';
import { FastifyInstance } from 'fastify';

// Mock the orchestrator for performance testing
vi.mock('@apexcli/orchestrator', () => {
  const mockTask = {
    id: 'task_123_perf_test',
    description: 'Performance test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: '/test',
    branchName: 'apex/test-tool-perf',
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
      const task = { ...mockTask, id: `task_${Date.now()}_perf`, description: options.description };
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

    // Performance testing methods
    generateBurstEvents(taskId: string, count: number) {
      const startTime = Date.now();

      for (let i = 0; i < count; i++) {
        const callId = `call_${Date.now()}_${i}`;

        // Emit start, progress, and complete in sequence
        this.emit('tool:start', {
          taskId,
          toolName: `BurstTool${i % 10}`, // Cycle through 10 different tool names
          input: { burstIndex: i, batchSize: count },
          timestamp: new Date(),
          callId
        });

        if (i % 3 === 0) { // Only emit progress for every 3rd call to vary the pattern
          this.emit('tool:progress', {
            taskId,
            toolName: `BurstTool${i % 10}`,
            callId,
            progress: { message: `Processing burst ${i}`, percentage: (i / count) * 100 },
            timestamp: new Date()
          });
        }

        this.emit('tool:complete', {
          taskId,
          toolName: `BurstTool${i % 10}`,
          callId,
          result: {
            success: i % 7 !== 0, // Fail every 7th call to test mixed results
            output: { burstIndex: i, processed: true }
          },
          timing: {
            startTime: new Date(Date.now() - Math.random() * 100),
            endTime: new Date(),
            duration: Math.random() * 100
          },
          timestamp: new Date()
        });
      }

      const endTime = Date.now();
      console.log(`Generated ${count * 2.33} events in ${endTime - startTime}ms`); // Accounting for conditional progress events
    }

    generateSustainedLoad(taskId: string, eventsPerSecond: number, durationSeconds: number) {
      const intervalMs = 1000 / eventsPerSecond;
      const totalEvents = eventsPerSecond * durationSeconds;
      let eventCount = 0;

      const interval = setInterval(() => {
        if (eventCount >= totalEvents) {
          clearInterval(interval);
          return;
        }

        const callId = `sustained_call_${eventCount}`;
        this.emit('tool:start', {
          taskId,
          toolName: `SustainedTool`,
          input: { eventIndex: eventCount, timestamp: Date.now() },
          timestamp: new Date(),
          callId
        });

        // Complete immediately for sustained load test
        this.emit('tool:complete', {
          taskId,
          toolName: `SustainedTool`,
          callId,
          result: { success: true, output: { eventIndex: eventCount } },
          timing: {
            startTime: new Date(Date.now() - 1),
            endTime: new Date(),
            duration: 1
          },
          timestamp: new Date()
        });

        eventCount += 2; // Count both start and complete
      }, intervalMs);

      return interval;
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

describe('WebSocket Tool Events - Performance', () => {
  let server: FastifyInstance;
  let testDir: string;
  let port: number;
  let mockOrchestrator: any;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-api-tool-perf-'));

    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `version: "1.0"\nproject:\n  name: test-tool-performance\n`
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

  describe('Burst load handling', () => {
    it('should handle 1000 rapid events without dropping messages', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Burst load test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];
      const startTime = Date.now();

      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          try {
            // Generate 1000 events in a burst
            mockOrchestrator.generateBurstEvents(taskId, 1000);
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          if (['tool:start', 'tool:progress', 'tool:complete'].includes(event.type)) {
            receivedEvents.push(event);

            // Check when we've likely received most events (accounting for conditional progress events)
            const expectedMinEvents = 2000; // 1000 start + 1000 complete
            const expectedMaxEvents = 2333; // Adding ~333 progress events (every 3rd)

            if (receivedEvents.length >= expectedMinEvents) {
              // Wait a bit more for any remaining events
              setTimeout(() => {
                try {
                  const endTime = Date.now();
                  const duration = endTime - startTime;

                  console.log(`Performance test completed in ${duration}ms`);
                  console.log(`Received ${receivedEvents.length} events`);
                  console.log(`Events per second: ${(receivedEvents.length / duration * 1000).toFixed(2)}`);

                  // Verify we received a reasonable number of events
                  expect(receivedEvents.length).toBeGreaterThanOrEqual(expectedMinEvents);
                  expect(receivedEvents.length).toBeLessThanOrEqual(expectedMaxEvents + 100); // Allow some margin

                  // Verify event distribution
                  const startEvents = receivedEvents.filter(e => e.type === 'tool:start');
                  const completeEvents = receivedEvents.filter(e => e.type === 'tool:complete');
                  const progressEvents = receivedEvents.filter(e => e.type === 'tool:progress');

                  expect(startEvents.length).toBe(1000);
                  expect(completeEvents.length).toBe(1000);
                  expect(progressEvents.length).toBeGreaterThanOrEqual(300); // ~every 3rd

                  // Performance requirement: should handle 1000+ events per second
                  const eventsPerSecond = receivedEvents.length / duration * 1000;
                  expect(eventsPerSecond).toBeGreaterThan(1000);

                  ws.close();
                  resolve();
                } catch (error) {
                  reject(error);
                }
              }, 2000);
            }
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error(`Timeout: Burst test failed. Received ${receivedEvents.length} events`));
        }, 30000);
      });
    });
  });

  describe('Sustained load handling', () => {
    it('should handle sustained 100 events/second for 10 seconds', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Sustained load test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];
      const eventTimestamps: number[] = [];

      return new Promise<void>((resolve, reject) => {
        let loadGenerationStarted = false;

        ws.on('open', () => {
          try {
            loadGenerationStarted = true;
            // Generate 100 events/second for 10 seconds = 2000 total events
            mockOrchestrator.generateSustainedLoad(taskId, 100, 10);
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          if (['tool:start', 'tool:complete'].includes(event.type)) {
            receivedEvents.push(event);
            eventTimestamps.push(Date.now());
          }

          // Check if we've received the expected number of events
          if (receivedEvents.length >= 2000) { // 100 events/sec * 10 sec * 2 (start+complete)
            try {
              // Analyze sustained performance
              const firstEventTime = eventTimestamps[0];
              const lastEventTime = eventTimestamps[eventTimestamps.length - 1];
              const totalDuration = lastEventTime - firstEventTime;

              console.log(`Sustained test: ${receivedEvents.length} events over ${totalDuration}ms`);
              console.log(`Average rate: ${(receivedEvents.length / totalDuration * 1000).toFixed(2)} events/sec`);

              // Verify we received all events
              expect(receivedEvents.length).toBe(2000);

              // Verify sustained rate (should be close to 200 events/sec accounting for start+complete)
              const averageRate = receivedEvents.length / totalDuration * 1000;
              expect(averageRate).toBeGreaterThan(150); // Allow some tolerance
              expect(averageRate).toBeLessThan(250);

              // Check for consistent distribution over time (no significant gaps)
              const timeWindows = 10; // Divide into 10 windows
              const windowSize = totalDuration / timeWindows;
              const eventsPerWindow: number[] = [];

              for (let i = 0; i < timeWindows; i++) {
                const windowStart = firstEventTime + (i * windowSize);
                const windowEnd = firstEventTime + ((i + 1) * windowSize);
                const eventsInWindow = eventTimestamps.filter(ts => ts >= windowStart && ts < windowEnd).length;
                eventsPerWindow.push(eventsInWindow);
              }

              // No window should be empty or have drastically different counts
              const avgEventsPerWindow = eventsPerWindow.reduce((a, b) => a + b, 0) / timeWindows;
              const maxDeviation = Math.max(...eventsPerWindow.map(count => Math.abs(count - avgEventsPerWindow)));

              console.log(`Average events per window: ${avgEventsPerWindow.toFixed(2)}`);
              console.log(`Max deviation: ${maxDeviation.toFixed(2)}`);

              // Allow up to 50% deviation from average (accounting for timing variations)
              expect(maxDeviation).toBeLessThan(avgEventsPerWindow * 0.5);

              ws.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          if (!loadGenerationStarted) {
            reject(new Error('Load generation never started'));
          } else {
            reject(new Error(`Timeout: Sustained test failed. Received ${receivedEvents.length}/2000 events`));
          }
        }, 30000);
      });
    });
  });

  describe('Multiple concurrent clients under load', () => {
    it('should handle 5 concurrent clients with sustained load', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Concurrent clients load test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const numClients = 5;
      const clients: WebSocket[] = [];
      const clientEvents: any[][] = [];

      return new Promise<void>((resolve, reject) => {
        let connectedClients = 0;
        let loadStarted = false;

        // Create multiple clients
        for (let i = 0; i < numClients; i++) {
          const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
          clients.push(ws);
          clientEvents.push([]);

          ws.on('open', () => {
            connectedClients++;
            if (connectedClients === numClients && !loadStarted) {
              loadStarted = true;
              try {
                // Generate moderate sustained load: 50 events/sec for 5 seconds
                mockOrchestrator.generateSustainedLoad(taskId, 50, 5);
              } catch (error) {
                reject(error);
              }
            }
          });

          ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            if (['tool:start', 'tool:complete'].includes(event.type)) {
              clientEvents[i].push(event);
            }
          });

          ws.on('error', (error) => {
            console.error(`Client ${i} error:`, error.message);
          });
        }

        // Check results after expected completion time
        setTimeout(() => {
          try {
            console.log(`Concurrent test: ${numClients} clients, events per client:`,
              clientEvents.map(events => events.length));

            // Each client should receive the same number of events
            const expectedEvents = 500; // 50 events/sec * 5 sec * 2 (start+complete)

            clientEvents.forEach((events, clientIndex) => {
              expect(events.length).toBe(expectedEvents);

              // Verify events are properly structured
              const startEvents = events.filter(e => e.type === 'tool:start');
              const completeEvents = events.filter(e => e.type === 'tool:complete');
              expect(startEvents.length).toBe(250);
              expect(completeEvents.length).toBe(250);
            });

            // All clients should receive identical events (same taskId broadcasts)
            for (let i = 1; i < numClients; i++) {
              const events0 = clientEvents[0].map(e => ({ type: e.type, callId: e.data.callId }));
              const eventsI = clientEvents[i].map(e => ({ type: e.type, callId: e.data.callId }));
              expect(eventsI).toEqual(events0);
            }

            // Clean up connections
            clients.forEach(ws => ws.close());
            resolve();
          } catch (error) {
            reject(error);
          }
        }, 15000); // Give extra time for completion

        setTimeout(() => {
          reject(new Error(`Timeout: Concurrent clients test failed after 20s`));
        }, 20000);
      });
    });
  });

  describe('Memory usage under load', () => {
    it('should maintain reasonable memory usage during high event throughput', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Memory usage test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const ws = new WebSocket(`ws://localhost:${port}/stream/${taskId}`);
      const receivedEvents: any[] = [];

      return new Promise<void>((resolve, reject) => {
        const initialMemory = process.memoryUsage();
        let peakMemoryIncrease = 0;

        ws.on('open', () => {
          try {
            // Generate large burst: 5000 events
            mockOrchestrator.generateBurstEvents(taskId, 5000);

            // Monitor memory usage during event processing
            const memoryInterval = setInterval(() => {
              const currentMemory = process.memoryUsage();
              const heapIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
              peakMemoryIncrease = Math.max(peakMemoryIncrease, heapIncrease);
            }, 100);

            setTimeout(() => {
              clearInterval(memoryInterval);
            }, 10000);
          } catch (error) {
            reject(error);
          }
        });

        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          if (['tool:start', 'tool:progress', 'tool:complete'].includes(event.type)) {
            receivedEvents.push(event);

            if (receivedEvents.length >= 10000) { // Minimum expected events
              setTimeout(() => {
                try {
                  const finalMemory = process.memoryUsage();
                  const totalHeapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

                  console.log(`Memory usage test results:`);
                  console.log(`  Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
                  console.log(`  Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
                  console.log(`  Peak increase: ${(peakMemoryIncrease / 1024 / 1024).toFixed(2)} MB`);
                  console.log(`  Final increase: ${(totalHeapIncrease / 1024 / 1024).toFixed(2)} MB`);
                  console.log(`  Events processed: ${receivedEvents.length}`);

                  // Memory increase should be reasonable (less than 100MB for 10K+ events)
                  const maxAllowedIncrease = 100 * 1024 * 1024; // 100MB
                  expect(peakMemoryIncrease).toBeLessThan(maxAllowedIncrease);

                  // Verify we processed a significant number of events
                  expect(receivedEvents.length).toBeGreaterThan(10000);

                  ws.close();
                  resolve();
                } catch (error) {
                  reject(error);
                }
              }, 2000); // Wait for event processing to settle
            }
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          reject(new Error(`Timeout: Memory test failed. Received ${receivedEvents.length} events`));
        }, 30000);
      });
    });
  });
});