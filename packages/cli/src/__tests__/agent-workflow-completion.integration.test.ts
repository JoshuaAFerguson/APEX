/**
 * Agent and Workflow Completion Integration Tests
 *
 * Integration tests verifying that agent and workflow completions work correctly in the CLI.
 *
 * Acceptance Criteria Covered:
 * 1. Tests verify: typing @ triggers agent completions
 * 2. Tests verify: typing --workflow triggers workflow completions
 * 3. Tests verify: agents include proper descriptions
 * 4. Tests verify: custom agents/workflows from context work
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CompletionEngine, CompletionContext } from '../services/CompletionEngine';

interface TestSetup {
  mockContext: CompletionContext;
  engine: CompletionEngine;
}

/**
 * Creates a test completion context with default values that can be overridden
 */
const createTestContext = (overrides?: Partial<CompletionContext>): CompletionContext => ({
  projectPath: '/test/project',
  agents: ['planner', 'architect', 'developer', 'reviewer', 'tester', 'devops'],
  workflows: ['feature', 'bugfix', 'refactor'],
  recentTasks: [],
  inputHistory: [],
  ...overrides,
});

/**
 * Default agent descriptions as defined in CompletionEngine
 */
const defaultAgentDescriptions: Record<string, string> = {
  planner: 'Creates implementation plans',
  architect: 'Designs system architecture',
  developer: 'Writes production code',
  reviewer: 'Reviews code quality',
  tester: 'Creates and runs tests',
  devops: 'Handles infrastructure',
};

/**
 * Default workflow descriptions as defined in CompletionEngine
 */
const defaultWorkflowDescriptions: Record<string, string> = {
  feature: 'Full feature implementation',
  bugfix: 'Bug investigation and fix',
  refactor: 'Code refactoring',
};

describe('Agent and Workflow Completion Integration Tests', () => {
  let testSetup: TestSetup;

  beforeEach(() => {
    testSetup = {
      mockContext: createTestContext(),
      engine: new CompletionEngine(),
    };
  });

  describe('Agent Completion Trigger (@)', () => {
    it('should trigger agent completions on @ prefix', async () => {
      const { engine, mockContext } = testSetup;

      const results = await engine.getCompletions('@', 1, mockContext);

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.type === 'agent')).toBe(true);
      expect(results.every(r => r.value.startsWith('@'))).toBe(true);

      // Verify all default agents are included
      const agentValues = results.map(r => r.value);
      expect(agentValues).toContain('@planner');
      expect(agentValues).toContain('@architect');
      expect(agentValues).toContain('@developer');
      expect(agentValues).toContain('@reviewer');
      expect(agentValues).toContain('@tester');
      expect(agentValues).toContain('@devops');
    });

    it('should filter agents by partial prefix match', async () => {
      const { engine, mockContext } = testSetup;

      const results = await engine.getCompletions('@p', 2, mockContext);

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.type === 'agent')).toBe(true);
      expect(results.every(r => r.value.startsWith('@p'))).toBe(true);

      // Should include planner but not architect, developer, etc.
      const agentValues = results.map(r => r.value);
      expect(agentValues).toContain('@planner');
      expect(agentValues).not.toContain('@architect');
      expect(agentValues).not.toContain('@developer');
    });

    it('should complete exact agent match with higher score', async () => {
      const { engine, mockContext } = testSetup;

      const results = await engine.getCompletions('@planner', 8, mockContext);

      expect(results.length).toBeGreaterThan(0);
      const plannerResult = results.find(r => r.value === '@planner');
      expect(plannerResult).toBeDefined();
      expect(plannerResult?.score).toBe(100); // Exact match should have highest score
    });

    it('should work with agent completion mid-sentence', async () => {
      const { engine, mockContext } = testSetup;

      const results = await engine.getCompletions('ask @dev for help', 8, mockContext);

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.type === 'agent')).toBe(true);
      expect(results.every(r => r.value.startsWith('@dev'))).toBe(true);

      const agentValues = results.map(r => r.value);
      expect(agentValues).toContain('@developer');
      expect(agentValues).toContain('@devops');
    });

    it('should be case-insensitive for agent matching', async () => {
      const { engine, mockContext } = testSetup;

      const results = await engine.getCompletions('@DEV', 4, mockContext);

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.type === 'agent')).toBe(true);

      const agentValues = results.map(r => r.value);
      expect(agentValues).toContain('@developer');
      expect(agentValues).toContain('@devops');
    });

    it('should not trigger agent completion without @ prefix', async () => {
      const { engine, mockContext } = testSetup;

      const results = await engine.getCompletions('planner help me', 7, mockContext);

      // Should not return any agent suggestions
      expect(results.filter(r => r.type === 'agent')).toHaveLength(0);
    });
  });

  describe('Agent Descriptions', () => {
    it('should provide proper descriptions for default agents', async () => {
      const { engine, mockContext } = testSetup;

      const results = await engine.getCompletions('@', 1, mockContext);

      // Check that all default agents have their proper descriptions
      for (const [agentName, expectedDescription] of Object.entries(defaultAgentDescriptions)) {
        const agentResult = results.find(r => r.value === `@${agentName}`);
        expect(agentResult).toBeDefined();
        expect(agentResult?.description).toBe(expectedDescription);
        expect(agentResult?.icon).toBe('🤖');
      }
    });

    it('should include description in specific agent completion', async () => {
      const { engine, mockContext } = testSetup;

      const results = await engine.getCompletions('@planner', 8, mockContext);

      const plannerResult = results.find(r => r.value === '@planner');
      expect(plannerResult).toMatchObject({
        value: '@planner',
        displayValue: '@planner',
        description: 'Creates implementation plans',
        type: 'agent',
        icon: '🤖',
      });
    });
  });

  describe('Custom Agents from Context', () => {
    it('should include custom agents from context', async () => {
      const { engine } = testSetup;
      const customContext = createTestContext({
        agents: ['planner', 'my-custom-agent', 'qa-specialist'],
      });

      const results = await engine.getCompletions('@', 1, customContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '@my-custom-agent',
          displayValue: '@my-custom-agent',
          description: 'Agent: my-custom-agent',
          type: 'agent',
          icon: '🤖',
        })
      );

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '@qa-specialist',
          displayValue: '@qa-specialist',
          description: 'Agent: qa-specialist',
          type: 'agent',
          icon: '🤖',
        })
      );
    });

    it('should mix default and custom agents correctly', async () => {
      const { engine } = testSetup;
      const customContext = createTestContext({
        agents: ['planner', 'custom-agent'],
      });

      const results = await engine.getCompletions('@', 1, customContext);

      // Should have both default planner with its description
      expect(results).toContainEqual(
        expect.objectContaining({
          value: '@planner',
          description: 'Creates implementation plans',
        })
      );

      // And custom agent with fallback description
      expect(results).toContainEqual(
        expect.objectContaining({
          value: '@custom-agent',
          description: 'Agent: custom-agent',
        })
      );
    });

    it('should return no agent suggestions when context has empty agent list', async () => {
      const { engine } = testSetup;
      const emptyContext = createTestContext({
        agents: [],
      });

      const results = await engine.getCompletions('@', 1, emptyContext);

      expect(results.filter(r => r.type === 'agent')).toHaveLength(0);
    });

    it('should filter custom agents by prefix', async () => {
      const { engine } = testSetup;
      const customContext = createTestContext({
        agents: ['custom-agent', 'my-special-agent', 'other-agent'],
      });

      const results = await engine.getCompletions('@custom', 7, customContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: '@custom-agent',
          description: 'Agent: custom-agent',
        })
      );

      expect(results).not.toContainEqual(
        expect.objectContaining({
          value: '@my-special-agent',
        })
      );
      expect(results).not.toContainEqual(
        expect.objectContaining({
          value: '@other-agent',
        })
      );
    });
  });

  describe('Workflow Completion Trigger (--workflow)', () => {
    it('should trigger workflow completions on --workflow prefix', async () => {
      const { engine, mockContext } = testSetup;

      const results = await engine.getCompletions('run --workflow ', 14, mockContext);

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.type === 'workflow')).toBe(true);

      // Verify all default workflows are included
      const workflowValues = results.map(r => r.value);
      expect(workflowValues).toContain('feature');
      expect(workflowValues).toContain('bugfix');
      expect(workflowValues).toContain('refactor');
    });

    it('should filter workflows by partial prefix match', async () => {
      const { engine, mockContext } = testSetup;

      const results = await engine.getCompletions('execute --workflow f', 20, mockContext);

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.type === 'workflow')).toBe(true);
      expect(results.every(r => r.value.startsWith('f'))).toBe(true);

      // Should include feature but not bugfix or refactor
      const workflowValues = results.map(r => r.value);
      expect(workflowValues).toContain('feature');
      expect(workflowValues).not.toContain('bugfix');
      expect(workflowValues).not.toContain('refactor');
    });

    it('should complete exact workflow match with higher score', async () => {
      const { engine, mockContext } = testSetup;

      const results = await engine.getCompletions('start --workflow feature', 22, mockContext);

      expect(results.length).toBeGreaterThan(0);
      const featureResult = results.find(r => r.value === 'feature');
      expect(featureResult).toBeDefined();
      expect(featureResult?.score).toBe(100); // Exact match should have highest score
    });

    it('should not trigger workflow completion without --workflow prefix', async () => {
      const { engine, mockContext } = testSetup;

      const results = await engine.getCompletions('run feature', 11, mockContext);

      // Should not return any workflow suggestions
      expect(results.filter(r => r.type === 'workflow')).toHaveLength(0);
    });

    it('should require --workflow prefix exactly', async () => {
      const { engine, mockContext } = testSetup;

      // Test variations that should NOT trigger workflow completion
      const nonTriggeringInputs = [
        'workflow feature',
        '--work feature',
        'use feature workflow',
        'feature --workflow',
      ];

      for (const input of nonTriggeringInputs) {
        const results = await engine.getCompletions(input, input.length, mockContext);
        expect(results.filter(r => r.type === 'workflow')).toHaveLength(0);
      }
    });

    it('should suggest workflow values not --workflow value', async () => {
      const { engine, mockContext } = testSetup;

      const results = await engine.getCompletions('apex --workflow bug', 19, mockContext);

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.type === 'workflow')).toBe(true);

      // Should suggest 'bugfix', not '--workflow bugfix'
      const workflowValues = results.map(r => r.value);
      expect(workflowValues).toContain('bugfix');
      expect(workflowValues).not.toContain('--workflow bugfix');
    });
  });

  describe('Workflow Descriptions', () => {
    it('should provide proper descriptions for default workflows', async () => {
      const { engine, mockContext } = testSetup;

      const results = await engine.getCompletions('run --workflow ', 14, mockContext);

      // Check that all default workflows have their proper descriptions
      for (const [workflowName, expectedDescription] of Object.entries(defaultWorkflowDescriptions)) {
        const workflowResult = results.find(r => r.value === workflowName);
        expect(workflowResult).toBeDefined();
        expect(workflowResult?.description).toBe(expectedDescription);
        expect(workflowResult?.icon).toBe('⚙️');
      }
    });

    it('should include description in specific workflow completion', async () => {
      const { engine, mockContext } = testSetup;

      const results = await engine.getCompletions('deploy --workflow feature', 23, mockContext);

      const featureResult = results.find(r => r.value === 'feature');
      expect(featureResult).toMatchObject({
        value: 'feature',
        displayValue: 'feature',
        description: 'Full feature implementation',
        type: 'workflow',
        icon: '⚙️',
      });
    });
  });

  describe('Custom Workflows from Context', () => {
    it('should include custom workflows from context', async () => {
      const { engine } = testSetup;
      const customContext = createTestContext({
        workflows: ['feature', 'my-custom-workflow', 'hotfix'],
      });

      const results = await engine.getCompletions('run --workflow ', 14, customContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: 'my-custom-workflow',
          displayValue: 'my-custom-workflow',
          description: 'Workflow: my-custom-workflow',
          type: 'workflow',
          icon: '⚙️',
        })
      );

      expect(results).toContainEqual(
        expect.objectContaining({
          value: 'hotfix',
          displayValue: 'hotfix',
          description: 'Workflow: hotfix',
          type: 'workflow',
          icon: '⚙️',
        })
      );
    });

    it('should mix default and custom workflows correctly', async () => {
      const { engine } = testSetup;
      const customContext = createTestContext({
        workflows: ['feature', 'custom-workflow'],
      });

      const results = await engine.getCompletions('start --workflow ', 16, customContext);

      // Should have both default feature with its description
      expect(results).toContainEqual(
        expect.objectContaining({
          value: 'feature',
          description: 'Full feature implementation',
        })
      );

      // And custom workflow with fallback description
      expect(results).toContainEqual(
        expect.objectContaining({
          value: 'custom-workflow',
          description: 'Workflow: custom-workflow',
        })
      );
    });

    it('should return no workflow suggestions when context has empty workflow list', async () => {
      const { engine } = testSetup;
      const emptyContext = createTestContext({
        workflows: [],
      });

      const results = await engine.getCompletions('run --workflow ', 14, emptyContext);

      expect(results.filter(r => r.type === 'workflow')).toHaveLength(0);
    });

    it('should filter custom workflows by prefix', async () => {
      const { engine } = testSetup;
      const customContext = createTestContext({
        workflows: ['custom-workflow', 'my-special-workflow', 'other-workflow'],
      });

      const results = await engine.getCompletions('execute --workflow custom', 25, customContext);

      expect(results).toContainEqual(
        expect.objectContaining({
          value: 'custom-workflow',
          description: 'Workflow: custom-workflow',
        })
      );

      expect(results).not.toContainEqual(
        expect.objectContaining({
          value: 'my-special-workflow',
        })
      );
      expect(results).not.toContainEqual(
        expect.objectContaining({
          value: 'other-workflow',
        })
      );
    });
  });

  describe('Combined Agent and Workflow Scenarios', () => {
    it('should handle input with both @agent and --workflow triggers', async () => {
      const { engine, mockContext } = testSetup;

      // Test input that could trigger both agent and workflow completion
      // Since CompletionEngine tests triggers sequentially, the last matching trigger wins
      const results = await engine.getCompletions('ask @developer to run --workflow f', 34, mockContext);

      // At cursor position 34 (after 'f'), should trigger workflow completion
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.type === 'workflow')).toBe(true);
      expect(results.every(r => r.value.startsWith('f'))).toBe(true);

      const workflowValues = results.map(r => r.value);
      expect(workflowValues).toContain('feature');
    });

    it('should handle agent completion in complex command context', async () => {
      const { engine, mockContext } = testSetup;

      const results = await engine.getCompletions('run --workflow feature with @arch', 33, mockContext);

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.type === 'agent')).toBe(true);
      expect(results.every(r => r.value.startsWith('@arch'))).toBe(true);

      const agentValues = results.map(r => r.value);
      expect(agentValues).toContain('@architect');
    });

    it('should maintain proper score ordering across different completion types', async () => {
      const { engine, mockContext } = testSetup;

      // Test that exact matches get highest scores regardless of type
      const agentResults = await engine.getCompletions('@tester', 7, mockContext);
      const workflowResults = await engine.getCompletions('run --workflow feature', 22, mockContext);

      const exactAgentMatch = agentResults.find(r => r.value === '@tester');
      const exactWorkflowMatch = workflowResults.find(r => r.value === 'feature');

      expect(exactAgentMatch?.score).toBe(100);
      expect(exactWorkflowMatch?.score).toBe(100);
    });

    it('should deduplicate results properly across provider types', async () => {
      const { engine, mockContext } = testSetup;

      const results = await engine.getCompletions('test', 4, mockContext);

      // Check that there are no duplicate values regardless of type
      const values = results.map(r => r.value);
      const uniqueValues = new Set(values);
      expect(values.length).toBe(uniqueValues.size);
    });

    it('should respect the 15 result limit with mixed completion types', async () => {
      const { engine } = testSetup;

      // Create context with many agents and workflows to test limit
      const largeContext = createTestContext({
        agents: Array.from({ length: 20 }, (_, i) => `agent-${i}`),
        workflows: Array.from({ length: 20 }, (_, i) => `workflow-${i}`),
      });

      const results = await engine.getCompletions('/', 1, largeContext);

      // CompletionEngine should limit total results to 15
      expect(results.length).toBeLessThanOrEqual(15);
    });
  });
});