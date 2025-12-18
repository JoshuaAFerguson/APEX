import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import WebSocket from 'ws';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { initializeApex } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { createServer } from './index';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

// Mock child_process for git/gh commands
vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, opts: unknown, callback?: unknown) => {
    if (typeof opts === 'function') {
      callback = opts;
    }
    const cb = callback as (error: Error | null, result?: { stdout: string }) => void;

    if (cmd.includes('gh --version')) {
      cb(null, { stdout: 'gh version 2.0.0' });
    } else if (cmd.includes('git remote get-url origin')) {
      cb(null, { stdout: 'https://github.com/test/repo.git' });
    } else {
      cb(null, { stdout: '' });
    }
  }),
}));

describe('Thinking Content Integration Tests', () => {
  let testDir: string;
  let server: any;
  let orchestrator: ApexOrchestrator;
  let port: number;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-thinking-api-test-'));

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'thinking-api-test',
      language: 'typescript',
      framework: 'node',
    });

    // Create test workflow and agents
    const workflowContent = `
name: feature
description: Feature development workflow
stages:
  - name: planning
    agent: planner
    description: Create implementation plan
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'feature.yaml'),
      workflowContent
    );

    const plannerContent = `---
name: planner
description: Plans implementation tasks
tools: Read, Glob, Grep
model: sonnet
---
You are a planning agent.
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'planner.md'),
      plannerContent
    );

    // Create orchestrator and server
    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();

    server = createServer({ orchestrator });
    await server.listen({ port: 0, host: '127.0.0.1' });
    port = server.server.address().port;
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('WebSocket thinking event streaming', () => {
    it('should stream thinking events via WebSocket', async () => {
      const mockQuery = vi.mocked(query);

      // Mock Claude SDK response with thinking content
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'WebSocket test thinking content from agent'
                },
                {
                  type: 'text',
                  text: 'Planning the implementation...'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      // Create task
      const task = await orchestrator.createTask({
        description: 'WebSocket thinking test',
        workflow: 'feature',
      });

      // Connect WebSocket
      const ws = new WebSocket(`ws://localhost:${port}/ws`);

      let thinkingEvent: any = null;
      let connected = false;

      // Wait for connection and listen for thinking events
      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          connected = true;
          // Subscribe to task events
          ws.send(JSON.stringify({
            type: 'subscribe',
            taskId: task.id
          }));
        });

        ws.on('message', (data) => {
          try {
            const event = JSON.parse(data.toString());
            if (event.type === 'agent:thinking') {
              thinkingEvent = event;
              ws.close();
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('error', reject);

        // Start task execution after WebSocket is connected
        setTimeout(async () => {
          if (connected) {
            try {
              await orchestrator.executeTask(task.id);
            } catch (error) {
              // Task execution might complete before WebSocket closes
            }
          }
        }, 100);

        // Timeout after 5 seconds
        setTimeout(() => {
          reject(new Error('Timeout waiting for thinking event'));
        }, 5000);
      });

      // Verify thinking event was streamed
      expect(thinkingEvent).not.toBeNull();
      expect(thinkingEvent.type).toBe('agent:thinking');
      expect(thinkingEvent.taskId).toBe(task.id);
      expect(thinkingEvent.data.agent).toBe('planner');
      expect(thinkingEvent.data.thinking).toBe('WebSocket test thinking content from agent');
      expect(thinkingEvent.timestamp).toBeDefined();
    });

    it('should handle multiple thinking events in sequence', async () => {
      const mockQuery = vi.mocked(query);

      // Mock multiple thinking events
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'First thinking event'
                }
              ]
            }
          };

          // Simulate delay
          await new Promise(resolve => setTimeout(resolve, 50));

          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'Second thinking event'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Multiple thinking events test',
        workflow: 'feature',
      });

      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const thinkingEvents: any[] = [];
      let connected = false;

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          connected = true;
          ws.send(JSON.stringify({
            type: 'subscribe',
            taskId: task.id
          }));
        });

        ws.on('message', (data) => {
          try {
            const event = JSON.parse(data.toString());
            if (event.type === 'agent:thinking') {
              thinkingEvents.push(event);

              // Close after receiving second event
              if (thinkingEvents.length === 2) {
                ws.close();
                resolve();
              }
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('error', reject);

        setTimeout(async () => {
          if (connected) {
            try {
              await orchestrator.executeTask(task.id);
            } catch (error) {
              // Ignore execution errors for this test
            }
          }
        }, 100);

        setTimeout(() => {
          reject(new Error('Timeout waiting for multiple thinking events'));
        }, 5000);
      });

      // Verify both thinking events were received
      expect(thinkingEvents).toHaveLength(2);
      expect(thinkingEvents[0].data.thinking).toBe('First thinking event');
      expect(thinkingEvents[1].data.thinking).toBe('Second thinking event');
    });

    it('should not stream thinking events when no thinking content is present', async () => {
      const mockQuery = vi.mocked(query);

      // Mock response without thinking content
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'text',
                  text: 'Just regular response without thinking'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'No thinking content test',
        workflow: 'feature',
      });

      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      let thinkingEventReceived = false;
      let taskCompletedReceived = false;

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'subscribe',
            taskId: task.id
          }));
        });

        ws.on('message', (data) => {
          try {
            const event = JSON.parse(data.toString());

            if (event.type === 'agent:thinking') {
              thinkingEventReceived = true;
            } else if (event.type === 'task:completed') {
              taskCompletedReceived = true;
              ws.close();
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('error', reject);

        setTimeout(async () => {
          try {
            await orchestrator.executeTask(task.id);
          } catch (error) {
            // Ignore execution errors
          }
        }, 100);

        setTimeout(() => {
          resolve(); // Resolve even without task completion for this test
        }, 3000);
      });

      // Should not have received thinking event
      expect(thinkingEventReceived).toBe(false);
    });

    it('should handle WebSocket disconnection gracefully during thinking events', async () => {
      const mockQuery = vi.mocked(query);

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'Thinking before disconnect'
                }
              ]
            }
          };

          // Simulate longer processing
          await new Promise(resolve => setTimeout(resolve, 200));

          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'Thinking after disconnect (should not crash)'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'WebSocket disconnect test',
        workflow: 'feature',
      });

      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      let firstThinkingReceived = false;

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'subscribe',
            taskId: task.id
          }));
        });

        ws.on('message', (data) => {
          try {
            const event = JSON.parse(data.toString());
            if (event.type === 'agent:thinking' && !firstThinkingReceived) {
              firstThinkingReceived = true;

              // Disconnect immediately after first thinking event
              ws.close();

              // Give some time for second event processing
              setTimeout(resolve, 500);
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('error', reject);

        setTimeout(async () => {
          try {
            await orchestrator.executeTask(task.id);
          } catch (error) {
            // Execution should continue even if WebSocket disconnects
          }
        }, 100);
      });

      expect(firstThinkingReceived).toBe(true);
      // Test passes if no errors were thrown during execution
    });
  });

  describe('REST API thinking event retrieval', () => {
    it('should include thinking events in task logs via REST API', async () => {
      const mockQuery = vi.mocked(query);

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'REST API thinking content test'
                },
                {
                  type: 'text',
                  text: 'Processing request...'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'REST API thinking test',
        workflow: 'feature',
      });

      await orchestrator.executeTask(task.id);

      // Get logs via REST API
      const response = await fetch(`http://localhost:${port}/api/tasks/${task.id}/logs`);
      expect(response.ok).toBe(true);

      const logs = await response.json();

      // Find thinking log entries
      const thinkingLogs = logs.filter((log: any) =>
        log.level === 'debug' && log.message.startsWith('[THINKING]')
      );

      expect(thinkingLogs.length).toBeGreaterThan(0);
      expect(thinkingLogs[0].message).toContain('REST API thinking content test');
    });

    it('should get task details with thinking information via REST API', async () => {
      const mockQuery = vi.mocked(query);

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'Task details thinking test'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Task details thinking test',
        workflow: 'feature',
      });

      await orchestrator.executeTask(task.id);

      // Get task details via REST API
      const response = await fetch(`http://localhost:${port}/api/tasks/${task.id}`);
      expect(response.ok).toBe(true);

      const taskDetails = await response.json();
      expect(taskDetails.id).toBe(task.id);
      expect(taskDetails.status).toBe('completed');
    });
  });
});