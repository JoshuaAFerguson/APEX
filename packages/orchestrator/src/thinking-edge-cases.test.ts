import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { initializeApex } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';

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
    cb(null, { stdout: '' });
  }),
}));

describe('Thinking Content Edge Cases and Error Scenarios', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-thinking-edge-test-'));

    await initializeApex(testDir, {
      projectName: 'thinking-edge-test',
      language: 'typescript',
      framework: 'node',
    });

    // Create minimal workflow and agent
    const workflowContent = `
name: test
description: Test workflow
stages:
  - name: testing
    agent: tester
    description: Test stage
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'test.yaml'),
      workflowContent
    );

    const agentContent = `---
name: tester
description: Test agent
tools: Read
model: sonnet
---
You are a test agent.
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'tester.md'),
      agentContent
    );

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('malformed message handling', () => {
    it('should handle null/undefined messages gracefully', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield null; // Null message
          yield undefined; // Undefined message
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'Valid thinking after null messages'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Null message test',
        workflow: 'test',
      });

      await expect(orchestrator.executeTask(task.id)).resolves.not.toThrow();

      // Should still extract valid thinking content
      expect(thinkingHandler).toHaveBeenCalledWith(
        task.id,
        'tester',
        'Valid thinking after null messages'
      );
    });

    it('should handle messages without type property', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            // Missing type property
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'Should not be processed'
                }
              ]
            }
          };
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'Should be processed'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Missing type test',
        workflow: 'test',
      });

      await orchestrator.executeTask(task.id);

      // Should only process the valid message
      expect(thinkingHandler).toHaveBeenCalledTimes(1);
      expect(thinkingHandler).toHaveBeenCalledWith(
        task.id,
        'tester',
        'Should be processed'
      );
    });

    it('should handle messages without message property', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant'
            // Missing message property
          };
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'Valid after invalid message'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Missing message test',
        workflow: 'test',
      });

      await orchestrator.executeTask(task.id);

      expect(thinkingHandler).toHaveBeenCalledWith(
        task.id,
        'tester',
        'Valid after invalid message'
      );
    });

    it('should handle non-array content property', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: 'String instead of array' // Invalid type
            }
          };
          yield {
            type: 'assistant',
            message: {
              content: { invalid: 'object' } // Invalid type
            }
          };
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'Valid content after invalid'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Non-array content test',
        workflow: 'test',
      });

      await orchestrator.executeTask(task.id);

      expect(thinkingHandler).toHaveBeenCalledWith(
        task.id,
        'tester',
        'Valid content after invalid'
      );
    });
  });

  describe('extreme content scenarios', () => {
    it('should handle extremely large thinking content', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      // Create 10MB of thinking content
      const largeThinking = 'A'.repeat(10 * 1024 * 1024);

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: largeThinking
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Large thinking content test',
        workflow: 'test',
      });

      // Should not crash with large content
      await expect(orchestrator.executeTask(task.id)).resolves.not.toThrow();

      expect(thinkingHandler).toHaveBeenCalledWith(
        task.id,
        'tester',
        largeThinking
      );
    });

    it('should handle thinking content with special characters', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      const specialThinking = `
        Special characters test:
        Unicode: 🤔💭🧠✨
        Newlines and tabs:\n\t\r
        Quotes: "single" 'double' \`backtick\`
        Escape sequences: \\n \\t \\r \\\\
        JSON-breaking: {"key": "value"}
        HTML: <script>alert('xss')</script>
        SQL: DROP TABLE users; --
        Null bytes: \x00
        Control chars: \x01\x02\x03
      `;

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: specialThinking
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Special characters test',
        workflow: 'test',
      });

      await orchestrator.executeTask(task.id);

      expect(thinkingHandler).toHaveBeenCalledWith(
        task.id,
        'tester',
        specialThinking
      );
    });

    it('should handle very deep nested content structures', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      // Create deeply nested structure that might cause stack overflow
      const deepMessage: any = {
        type: 'assistant',
        message: {
          content: []
        }
      };

      // Add 1000 content blocks
      for (let i = 0; i < 1000; i++) {
        deepMessage.message.content.push({
          type: 'thinking',
          thinking: `Thinking block ${i}`
        });
      }

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield deepMessage;
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Deep nesting test',
        workflow: 'test',
      });

      await expect(orchestrator.executeTask(task.id)).resolves.not.toThrow();

      // Should concatenate all thinking blocks
      expect(thinkingHandler).toHaveBeenCalled();
      const calledThinking = thinkingHandler.mock.calls[0][2];
      expect(calledThinking).toContain('Thinking block 0');
      expect(calledThinking).toContain('Thinking block 999');
    });
  });

  describe('concurrent access scenarios', () => {
    it('should handle multiple tasks with thinking content simultaneously', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      let taskCounter = 0;
      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          const currentTask = ++taskCounter;
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: `Thinking from task ${currentTask}`
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>));

      // Create multiple tasks
      const tasks = await Promise.all([
        orchestrator.createTask({ description: 'Concurrent task 1', workflow: 'test' }),
        orchestrator.createTask({ description: 'Concurrent task 2', workflow: 'test' }),
        orchestrator.createTask({ description: 'Concurrent task 3', workflow: 'test' }),
      ]);

      // Execute them concurrently
      await Promise.all(
        tasks.map(task => orchestrator.executeTask(task.id))
      );

      // Should have thinking events from all tasks
      expect(thinkingHandler).toHaveBeenCalledTimes(3);

      // Check that each task got its own thinking event
      const calls = thinkingHandler.mock.calls;
      expect(calls.some(call => call[2] === 'Thinking from task 1')).toBe(true);
      expect(calls.some(call => call[2] === 'Thinking from task 2')).toBe(true);
      expect(calls.some(call => call[2] === 'Thinking from task 3')).toBe(true);
    });

    it('should handle rapid-fire thinking events', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          // Yield many thinking events rapidly
          for (let i = 0; i < 100; i++) {
            yield {
              type: 'assistant',
              message: {
                content: [
                  {
                    type: 'thinking',
                    thinking: `Rapid thinking ${i}`
                  }
                ]
              }
            };
          }
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Rapid fire test',
        workflow: 'test',
      });

      await orchestrator.executeTask(task.id);

      // Should handle all 100 rapid events
      expect(thinkingHandler).toHaveBeenCalledTimes(100);
    });
  });

  describe('memory and performance edge cases', () => {
    it('should handle memory pressure during thinking extraction', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      // Create many large thinking blocks to stress memory
      const largeBlocks = Array.from({ length: 50 }, (_, i) => ({
        type: 'thinking' as const,
        thinking: `Large thinking block ${i}: ${'X'.repeat(100000)}` // 100KB each
      }));

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: largeBlocks
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Memory pressure test',
        workflow: 'test',
      });

      await expect(orchestrator.executeTask(task.id)).resolves.not.toThrow();

      expect(thinkingHandler).toHaveBeenCalled();
      // Verify the concatenated content includes all blocks
      const fullThinking = thinkingHandler.mock.calls[0][2];
      expect(fullThinking).toContain('Large thinking block 0');
      expect(fullThinking).toContain('Large thinking block 49');
    });

    it('should handle slow thinking content processing', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'First thinking block'
                }
              ]
            }
          };

          // Simulate slow processing
          await new Promise(resolve => setTimeout(resolve, 100));

          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'Second thinking block after delay'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Slow processing test',
        workflow: 'test',
      });

      const startTime = Date.now();
      await orchestrator.executeTask(task.id);
      const endTime = Date.now();

      // Should handle delay gracefully
      expect(endTime - startTime).toBeGreaterThan(90); // Allow for some timing variance
      expect(thinkingHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('error recovery scenarios', () => {
    it('should continue processing after thinking extraction error', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      // Mock a thinking handler that throws on first call
      thinkingHandler.mockImplementationOnce(() => {
        throw new Error('Thinking handler error');
      });

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'First thinking (will cause error)'
                }
              ]
            }
          };

          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'Second thinking (should work)'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Error recovery test',
        workflow: 'test',
      });

      // Should not fail the entire task due to handler error
      await expect(orchestrator.executeTask(task.id)).resolves.not.toThrow();

      expect(thinkingHandler).toHaveBeenCalledTimes(2);
    });

    it('should handle circular reference in message content', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      // Create circular reference
      const circularContent: any = {
        type: 'thinking',
        thinking: 'Circular reference test'
      };
      circularContent.self = circularContent;

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [circularContent]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Circular reference test',
        workflow: 'test',
      });

      // Should handle circular reference gracefully
      await expect(orchestrator.executeTask(task.id)).resolves.not.toThrow();

      expect(thinkingHandler).toHaveBeenCalledWith(
        task.id,
        'tester',
        'Circular reference test'
      );
    });
  });
});