import { describe, it, expect } from 'vitest';
import {
  buildOrchestratorPrompt,
  buildAgentDefinitions,
  buildStagePrompt,
  parseDecompositionRequest,
  buildResumePrompt,
  type PromptContext,
  type StagePromptContext,
} from '../prompts';
import type {
  Task,
  WorkflowDefinition,
  AgentDefinition,
  TaskCheckpoint,
} from '@apexcli/core';

describe('prompts.ts - Edge Cases', () => {
  describe('buildOrchestratorPrompt - Edge Cases', () => {
    it('should handle empty agents list', () => {
      const context: PromptContext = {
        config: {
          project: { name: 'Test' },
          git: { branchPrefix: 'feat/', commitFormat: 'conventional' },
          limits: { maxTokensPerTask: 5000 },
          agents: { enabled: [], disabled: [] },
        },
        workflow: {
          name: 'simple',
          description: 'Simple workflow',
          stages: [],
        },
        task: {
          id: 'test-1',
          description: 'Test task',
          autonomy: 'full-auto',
          status: 'planning',
          createdAt: new Date(),
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
          artifacts: [],
        } as Task,
        agents: {},
      };

      const prompt = buildOrchestratorPrompt(context);
      expect(prompt).toContain('APEX Orchestrator');
      expect(prompt).toContain('Test');
      // Should handle empty agents gracefully
      expect(prompt).not.toContain('undefined');
    });

    it('should handle very large token limits', () => {
      const context: PromptContext = {
        config: {
          project: { name: 'Test' },
          git: { branchPrefix: 'feat/', commitFormat: 'conventional' },
          limits: { maxTokensPerTask: 1000000 },
          agents: { enabled: [], disabled: [] },
        },
        workflow: { name: 'simple', description: 'Simple', stages: [] },
        task: {
          id: 'test-1',
          description: 'Test',
          autonomy: 'full-auto',
          status: 'planning',
          createdAt: new Date(),
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
          artifacts: [],
        } as Task,
        agents: {},
      };

      const prompt = buildOrchestratorPrompt(context);
      expect(prompt).toContain('1,000,000 tokens');
    });

    it('should handle unknown autonomy level', () => {
      const context: PromptContext = {
        config: {
          project: { name: 'Test' },
          git: { branchPrefix: 'feat/', commitFormat: 'conventional' },
          limits: { maxTokensPerTask: 5000 },
          agents: { enabled: [], disabled: [] },
        },
        workflow: { name: 'simple', description: 'Simple', stages: [] },
        task: {
          id: 'test-1',
          description: 'Test',
          autonomy: 'unknown' as any,
          status: 'planning',
          createdAt: new Date(),
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
          artifacts: [],
        } as Task,
        agents: {},
      };

      const prompt = buildOrchestratorPrompt(context);
      expect(prompt).toContain('Follow standard workflow');
    });
  });

  describe('buildAgentDefinitions - Edge Cases', () => {
    it('should handle agents with missing optional fields', () => {
      const agents: Record<string, AgentDefinition> = {
        minimal: {
          name: 'minimal',
          description: 'Minimal agent',
          prompt: 'Basic prompt',
          tools: [],
          model: 'haiku',
        },
      };

      const config = {
        agents: { enabled: [], disabled: [] },
      };

      const result = buildAgentDefinitions(agents, config);
      expect(result.minimal).toBeDefined();
      expect(result.minimal.tools).toEqual([]);
    });

    it('should handle both enabled and disabled lists', () => {
      const agents: Record<string, AgentDefinition> = {
        agent1: {
          name: 'agent1',
          description: 'Agent 1',
          prompt: 'Prompt 1',
          tools: ['Read'],
          model: 'sonnet',
        },
        agent2: {
          name: 'agent2',
          description: 'Agent 2',
          prompt: 'Prompt 2',
          tools: ['Write'],
          model: 'haiku',
        },
        agent3: {
          name: 'agent3',
          description: 'Agent 3',
          prompt: 'Prompt 3',
          tools: ['Edit'],
          model: 'sonnet',
        },
      };

      // enabled list takes priority over disabled list
      const config = {
        agents: {
          enabled: ['agent1', 'agent2'],
          disabled: ['agent2'], // This should be ignored since enabled is specified
        },
      };

      const result = buildAgentDefinitions(agents, config);
      expect(Object.keys(result)).toEqual(['agent1', 'agent2']);
    });
  });

  describe('buildStagePrompt - Edge Cases', () => {
    it('should handle stage with very long output list', () => {
      const stageContext: StagePromptContext = {
        task: {
          id: 'test-1',
          description: 'Test task',
          status: 'planning',
          autonomy: 'full-auto',
          createdAt: new Date(),
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
          artifacts: [],
        } as Task,
        stage: {
          name: 'comprehensive',
          description: 'Comprehensive stage',
          agent: 'developer',
          outputs: [
            'output1', 'output2', 'output3', 'output4', 'output5',
            'output6', 'output7', 'output8', 'output9', 'output10'
          ],
        },
        agent: {
          name: 'developer',
          description: 'Developer agent',
          prompt: 'Development prompt',
          tools: ['Read', 'Write'],
          model: 'sonnet',
        },
        workflow: { name: 'test', description: 'Test workflow', stages: [] },
        config: {
          project: { name: 'Test' },
          agents: { enabled: [], disabled: [] },
        },
        previousStageResults: new Map(),
      };

      const prompt = buildStagePrompt(stageContext);
      expect(prompt).toContain('output1: Provide this in your summary');
      expect(prompt).toContain('output10: Provide this in your summary');
    });

    it('should handle very long output values in previous results', () => {
      const longOutput = 'A'.repeat(1000);

      const stageContext: StagePromptContext = {
        task: {
          id: 'test-1',
          description: 'Test task',
          status: 'planning',
          autonomy: 'full-auto',
          createdAt: new Date(),
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
          artifacts: [],
        } as Task,
        stage: {
          name: 'current',
          description: 'Current stage',
          agent: 'developer',
          dependsOn: ['previous'],
        },
        agent: {
          name: 'developer',
          description: 'Developer agent',
          prompt: 'Development prompt',
          tools: ['Read', 'Write'],
          model: 'sonnet',
        },
        workflow: { name: 'test', description: 'Test workflow', stages: [] },
        config: {
          project: { name: 'Test' },
          agents: { enabled: [], disabled: [] },
        },
        previousStageResults: new Map([
          [
            'previous',
            {
              agent: 'planner',
              status: 'completed',
              summary: 'Previous stage completed',
              outputs: { longOutput },
              artifacts: [],
              startedAt: new Date(),
              completedAt: new Date(),
            },
          ],
        ]),
      };

      const prompt = buildStagePrompt(stageContext);
      // Should truncate long outputs to 500 characters
      expect(prompt).toContain('A'.repeat(500) + '...');
    });
  });

  describe('parseDecompositionRequest - Edge Cases', () => {
    it('should handle multiple decompose blocks (use first one)', () => {
      const output = `
\`\`\`decompose
{
  "reason": "First block",
  "strategy": "sequential",
  "subtasks": [{"description": "First task"}]
}
\`\`\`

Some text in between.

\`\`\`decompose
{
  "reason": "Second block",
  "strategy": "parallel",
  "subtasks": [{"description": "Second task"}]
}
\`\`\`
      `;

      const result = parseDecompositionRequest(output);
      expect(result.shouldDecompose).toBe(true);
      expect(result.reason).toBe('First block');
      expect(result.subtasks[0].description).toBe('First task');
    });

    it('should handle malformed JSON with extra commas', () => {
      const output = `
\`\`\`decompose
{
  "reason": "Test",
  "strategy": "sequential",
  "subtasks": [
    {
      "description": "Task 1",
    },
  ],
}
\`\`\`
      `;

      const result = parseDecompositionRequest(output);
      // Should fail to parse and return no decomposition
      expect(result.shouldDecompose).toBe(false);
    });

    it('should handle subtasks with unusual types', () => {
      const output = `
\`\`\`decompose
{
  "subtasks": [
    {
      "description": 123,
      "acceptanceCriteria": null,
      "workflow": undefined,
      "dependsOn": "not an array"
    },
    {
      "description": "Valid task"
    }
  ]
}
\`\`\`
      `;

      const result = parseDecompositionRequest(output);
      expect(result.shouldDecompose).toBe(true);
      expect(result.subtasks).toHaveLength(2);
      expect(result.subtasks[0].description).toBe('123');
      expect(result.subtasks[0].acceptanceCriteria).toBeUndefined();
      expect(result.subtasks[0].dependsOn).toBeUndefined();
      expect(result.subtasks[1].description).toBe('Valid task');
    });

    it('should handle deeply nested JSON', () => {
      const output = `
\`\`\`decompose
{
  "metadata": {
    "nested": {
      "deep": {
        "value": "should be ignored"
      }
    }
  },
  "subtasks": [
    {
      "description": "Task with nested metadata",
      "metadata": {
        "complexity": "high",
        "tags": ["backend", "database"]
      }
    }
  ]
}
\`\`\`
      `;

      const result = parseDecompositionRequest(output);
      expect(result.shouldDecompose).toBe(true);
      expect(result.subtasks[0].description).toBe('Task with nested metadata');
      // Metadata should not be included in normalized subtask
      expect((result.subtasks[0] as any).metadata).toBeUndefined();
    });
  });

  describe('buildResumePrompt - Edge Cases', () => {
    it('should handle context with no extractable accomplishments or decisions', () => {
      const task = {
        id: 'test-1',
        description: 'Test task',
      } as Task;

      const checkpoint: TaskCheckpoint = {
        taskId: 'test-1',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        stage: 'implementation',
        stageIndex: 1,
        conversationContext: 'Previous context',
      };

      const contextSummary = `
Random text that doesn't contain accomplishments.
Some analysis of the problem space.
Discussion of various approaches without clear decisions.
General information about the technology stack.
      `;

      const prompt = buildResumePrompt(task, checkpoint, contextSummary);
      expect(prompt).toContain('No specific accomplishments identified');
      expect(prompt).toContain('No significant decisions identified');
    });

    it('should handle very long context summary', () => {
      const task = {
        id: 'test-1',
        description: 'Test task',
      } as Task;

      const checkpoint: TaskCheckpoint = {
        taskId: 'test-1',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        stage: 'implementation',
        stageIndex: 1,
        conversationContext: 'Previous context',
      };

      const longContextSummary = 'Long context summary. '.repeat(1000) +
        'Completed user authentication implementation. ' +
        'Decided to use JWT tokens for security.';

      const prompt = buildResumePrompt(task, checkpoint, longContextSummary);
      expect(prompt).toContain(longContextSummary);
      expect(prompt).toContain('user authentication implementation');
      expect(prompt).toContain('use JWT tokens for security');
    });

    it('should limit accomplishments and decisions to 5 items', () => {
      const task = {
        id: 'test-1',
        description: 'Test task',
      } as Task;

      const checkpoint: TaskCheckpoint = {
        taskId: 'test-1',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        stage: 'implementation',
        stageIndex: 1,
        conversationContext: 'Previous context',
      };

      const contextSummary = `
Completed task 1 successfully.
Completed task 2 with excellence.
Completed task 3 on schedule.
Completed task 4 under budget.
Completed task 5 with quality.
Completed task 6 with documentation.
Completed task 7 with tests.
Decided to use approach 1.
Decided to use approach 2.
Decided to use approach 3.
Decided to use approach 4.
Decided to use approach 5.
Decided to use approach 6.
Decided to use approach 7.
      `;

      const prompt = buildResumePrompt(task, checkpoint, contextSummary);

      // Count accomplishments in the prompt
      const accomplishmentMatches = prompt.match(/- task \d+ /g);
      const decisionMatches = prompt.match(/- approach \d+/g);

      expect(accomplishmentMatches).toHaveLength(5);
      expect(decisionMatches).toHaveLength(5);
    });

    it('should handle accomplishments and decisions with varying lengths', () => {
      const task = {
        id: 'test-1',
        description: 'Test task',
      } as Task;

      const checkpoint: TaskCheckpoint = {
        taskId: 'test-1',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        stage: 'implementation',
        stageIndex: 1,
        conversationContext: 'Previous context',
      };

      const contextSummary = `
Short accomplishment completed.
This is a very long accomplishment description that goes on and on with lots of details about what was accomplished, including specific technical decisions, implementation details, and various other aspects of the work that was done during this phase of the project.
A
Completed medium-length accomplishment with some details.
Decided a.
Decided to use a very long decision explanation that includes detailed reasoning about the choice of technology stack, architectural patterns, security considerations, performance implications, and various other factors that influenced this important decision.
      `;

      const prompt = buildResumePrompt(task, checkpoint, contextSummary);

      // Should filter out very short (< 10 chars) and very long (> 200 chars) items
      expect(prompt).toContain('Short accomplishment completed');
      expect(prompt).toContain('medium-length accomplishment');
      expect(prompt).not.toContain('This is a very long accomplishment');
      expect(prompt).not.toContain('- A');
      expect(prompt).not.toContain('- a.');
    });
  });
});