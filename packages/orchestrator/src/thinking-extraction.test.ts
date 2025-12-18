import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
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

    // Mock git/gh commands for testing
    if (cmd.includes('gh --version')) {
      cb(null, { stdout: 'gh version 2.0.0' });
    } else if (cmd.includes('git remote get-url origin')) {
      cb(null, { stdout: 'https://github.com/test/repo.git' });
    } else {
      cb(null, { stdout: '' });
    }
  }),
}));

describe('Thinking Content Extraction', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-thinking-test-'));

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'thinking-test-project',
      language: 'typescript',
      framework: 'node',
    });

    // Create a test workflow file
    const workflowContent = `
name: feature
description: Standard feature development workflow
stages:
  - name: planning
    agent: planner
    description: Create implementation plan
  - name: implementation
    agent: developer
    dependsOn:
      - planning
    description: Implement the feature
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'feature.yaml'),
      workflowContent
    );

    // Create test agent files
    const plannerContent = `---
name: planner
description: Plans implementation tasks
tools: Read, Glob, Grep
model: sonnet
---
You are a planning agent that creates implementation plans.
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'planner.md'),
      plannerContent
    );

    const developerContent = `---
name: developer
description: Implements code changes
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a developer agent that implements code changes.
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'developer.md'),
      developerContent
    );

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('thinking content extraction from Claude SDK messages', () => {
    it('should extract thinking content from content blocks with type "thinking"', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();
      const messageHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);
      orchestrator.on('agent:message', messageHandler);

      // Mock Claude SDK response with thinking content in content blocks
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'I need to analyze the requirements and create a detailed plan. First, I should understand the codebase structure...'
                },
                {
                  type: 'text',
                  text: 'I will create an implementation plan for this feature.'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Test thinking extraction',
        workflow: 'feature',
      });

      await orchestrator.executeTask(task.id);

      // Verify thinking event was emitted
      expect(thinkingHandler).toHaveBeenCalledWith(
        task.id,
        'planner',
        'I need to analyze the requirements and create a detailed plan. First, I should understand the codebase structure...'
      );

      // Verify message event was also emitted with the assistant message
      expect(messageHandler).toHaveBeenCalled();
    });

    it('should extract thinking content from legacy format (direct thinking property)', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      // Mock Claude SDK response with legacy thinking format
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              thinking: 'Legacy thinking content from direct property',
              content: [
                {
                  type: 'text',
                  text: 'This is the main response text.'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Test legacy thinking format',
        workflow: 'feature',
      });

      await orchestrator.executeTask(task.id);

      // Verify thinking event was emitted for legacy format
      expect(thinkingHandler).toHaveBeenCalledWith(
        task.id,
        'planner',
        'Legacy thinking content from direct property'
      );
    });

    it('should prioritize content blocks thinking over legacy format', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      // Mock response with both formats - content blocks should take precedence
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              thinking: 'Legacy thinking that should be ignored',
              content: [
                {
                  type: 'thinking',
                  thinking: 'Priority thinking from content blocks'
                },
                {
                  type: 'text',
                  text: 'Response text'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Test thinking priority',
        workflow: 'feature',
      });

      await orchestrator.executeTask(task.id);

      // Should use content blocks thinking, not legacy format
      expect(thinkingHandler).toHaveBeenCalledWith(
        task.id,
        'planner',
        'Priority thinking from content blocks'
      );
    });

    it('should concatenate multiple thinking blocks', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      // Mock response with multiple thinking blocks
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'First part of thinking: analyzing the problem...'
                },
                {
                  type: 'text',
                  text: 'Some response text'
                },
                {
                  type: 'thinking',
                  thinking: 'Second part of thinking: considering the solution...'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Test multiple thinking blocks',
        workflow: 'feature',
      });

      await orchestrator.executeTask(task.id);

      // Should concatenate all thinking blocks
      expect(thinkingHandler).toHaveBeenCalledWith(
        task.id,
        'planner',
        'First part of thinking: analyzing the problem...Second part of thinking: considering the solution...'
      );
    });

    it('should handle messages without thinking content', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();
      const messageHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);
      orchestrator.on('agent:message', messageHandler);

      // Mock response with no thinking content
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'text',
                  text: 'Just a regular response with no thinking'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Test no thinking content',
        workflow: 'feature',
      });

      await orchestrator.executeTask(task.id);

      // Should not emit thinking event
      expect(thinkingHandler).not.toHaveBeenCalled();

      // But should still emit message event
      expect(messageHandler).toHaveBeenCalled();
    });

    it('should handle empty thinking content', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      // Mock response with empty thinking
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: ''
                },
                {
                  type: 'text',
                  text: 'Response text'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Test empty thinking',
        workflow: 'feature',
      });

      await orchestrator.executeTask(task.id);

      // Should not emit thinking event for empty content
      expect(thinkingHandler).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only thinking content', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      // Mock response with whitespace-only thinking
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: '   \n\t  '
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Test whitespace thinking',
        workflow: 'feature',
      });

      await orchestrator.executeTask(task.id);

      // Should not emit thinking event for whitespace-only content
      expect(thinkingHandler).not.toHaveBeenCalled();
    });

    it('should log thinking content in debug logs', async () => {
      const mockQuery = vi.mocked(query);

      orchestrator.on('agent:thinking', vi.fn());

      // Mock response with thinking content
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'This is some thinking content that should be logged'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Test thinking logging',
        workflow: 'feature',
      });

      await orchestrator.executeTask(task.id);

      // Get logs to verify thinking was logged
      const logs = await orchestrator.getLogs(task.id);
      const thinkingLogs = logs.filter(log =>
        log.level === 'debug' && log.message.startsWith('[THINKING]')
      );

      expect(thinkingLogs.length).toBeGreaterThan(0);
      expect(thinkingLogs[0].message).toContain('This is some thinking content that should be logged');
    });

    it('should truncate long thinking content in debug logs', async () => {
      const mockQuery = vi.mocked(query);

      // Create thinking content longer than 200 characters
      const longThinking = 'A'.repeat(250) + ' - this should be truncated in logs';

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: longThinking
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Test long thinking truncation',
        workflow: 'feature',
      });

      await orchestrator.executeTask(task.id);

      // Get logs to verify thinking was truncated
      const logs = await orchestrator.getLogs(task.id);
      const thinkingLogs = logs.filter(log =>
        log.level === 'debug' && log.message.startsWith('[THINKING]')
      );

      expect(thinkingLogs.length).toBeGreaterThan(0);
      expect(thinkingLogs[0].message).toContain('...');
      expect(thinkingLogs[0].message.length).toBeLessThan(220); // [THINKING] + 200 chars + ...
    });

    it('should handle non-string thinking property gracefully', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      // Mock response with non-string thinking property
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: { invalid: 'object' } // Invalid type
                } as any,
                {
                  type: 'text',
                  text: 'Response text'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Test invalid thinking type',
        workflow: 'feature',
      });

      await orchestrator.executeTask(task.id);

      // Should not emit thinking event for non-string content
      expect(thinkingHandler).not.toHaveBeenCalled();
    });

    it('should handle malformed content blocks gracefully', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();
      const messageHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);
      orchestrator.on('agent:message', messageHandler);

      // Mock response with malformed content blocks
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'assistant',
            message: {
              content: [
                null, // Invalid block
                {
                  type: 'thinking'
                  // Missing thinking property
                },
                {
                  type: 'thinking',
                  thinking: 'Valid thinking content'
                },
                {
                  // Missing type property
                  text: 'Some text'
                }
              ]
            }
          };
        },
      } as unknown as ReturnType<typeof query>);

      const task = await orchestrator.createTask({
        description: 'Test malformed content blocks',
        workflow: 'feature',
      });

      // Should not throw error
      await expect(orchestrator.executeTask(task.id)).resolves.not.toThrow();

      // Should extract valid thinking content despite malformed blocks
      expect(thinkingHandler).toHaveBeenCalledWith(
        task.id,
        'planner',
        'Valid thinking content'
      );
    });

    it('should emit thinking events for different agents in workflow', async () => {
      const mockQuery = vi.mocked(query);
      const thinkingHandler = vi.fn();

      orchestrator.on('agent:thinking', thinkingHandler);

      // Mock different responses for different agents
      let callCount = 0;
      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          callCount++;
          if (callCount === 1) {
            // First call - planner agent
            yield {
              type: 'assistant',
              message: {
                content: [
                  {
                    type: 'thinking',
                    thinking: 'Planner agent thinking about the implementation plan'
                  },
                  {
                    type: 'text',
                    text: 'Creating implementation plan...'
                  }
                ]
              }
            };
          } else {
            // Second call - developer agent
            yield {
              type: 'assistant',
              message: {
                content: [
                  {
                    type: 'thinking',
                    thinking: 'Developer agent thinking about code implementation'
                  },
                  {
                    type: 'text',
                    text: 'Implementing the feature...'
                  }
                ]
              }
            };
          }
        },
      } as unknown as ReturnType<typeof query>));

      const task = await orchestrator.createTask({
        description: 'Test multi-agent thinking',
        workflow: 'feature',
      });

      await orchestrator.executeTask(task.id);

      // Should have thinking events from both agents
      expect(thinkingHandler).toHaveBeenCalledTimes(2);

      expect(thinkingHandler).toHaveBeenCalledWith(
        task.id,
        'planner',
        'Planner agent thinking about the implementation plan'
      );

      expect(thinkingHandler).toHaveBeenCalledWith(
        task.id,
        'developer',
        'Developer agent thinking about code implementation'
      );
    });
  });
});