import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '../index';
import type { ApexConfig, WorkflowDefinition, AgentDefinition } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('Workflow Execution Integration Tests', () => {
  let orchestrator: ApexOrchestrator;
  let testWorkspacePath: string;
  let mockConfig: ApexConfig;

  beforeEach(async () => {
    // Create a temporary workspace for testing
    testWorkspacePath = path.join(os.tmpdir(), `apex-test-${Date.now()}`);
    await fs.mkdir(testWorkspacePath, { recursive: true });

    // Create .apex directory structure
    const apexDir = path.join(testWorkspacePath, '.apex');
    await fs.mkdir(apexDir, { recursive: true });
    await fs.mkdir(path.join(apexDir, 'agents'), { recursive: true });
    await fs.mkdir(path.join(apexDir, 'workflows'), { recursive: true });

    // Create test config
    mockConfig = {
      autonomyLevel: 'medium',
      maxConcurrentTasks: 2,
      limits: {
        maxTokens: 100000,
        maxCost: 10.0,
        maxDuration: 3600000,
      },
      permissions: {
        filesystem: {
          allowedPaths: [testWorkspacePath],
          deniedPaths: [],
        },
      },
    };

    orchestrator = new ApexOrchestrator(mockConfig, testWorkspacePath);

    // Setup mock Claude responses
    const mockQuery = vi.mocked(query);
    mockQuery.mockImplementation(async () => ({
      content: [{ type: 'text', text: 'Mock agent response completing the stage successfully.' }],
      usage: { input_tokens: 50, output_tokens: 25 },
    }));
  });

  afterEach(async () => {
    await orchestrator.shutdown();

    // Cleanup test workspace
    try {
      await fs.rmdir(testWorkspacePath, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors in tests
    }

    vi.clearAllMocks();
  });

  describe('Basic Workflow Execution', () => {
    it('should execute a simple workflow from start to finish', async () => {
      // Create test workflow definition
      const testWorkflow: WorkflowDefinition = {
        name: 'test-workflow',
        description: 'A simple test workflow',
        stages: [
          {
            name: 'analysis',
            agent: 'test-analyst',
            description: 'Analyze the requirements',
            inputs: [],
            outputs: ['analysis-results'],
          },
          {
            name: 'implementation',
            agent: 'test-developer',
            description: 'Implement the solution',
            inputs: ['analysis-results'],
            outputs: ['implementation-results'],
          },
        ],
        gates: [],
      };

      // Create test agents
      const testAgents: AgentDefinition[] = [
        {
          name: 'test-analyst',
          description: 'Test analyst agent',
          prompt: 'You are a test analyst. Analyze the given requirements and provide insights.',
          model: 'sonnet',
        },
        {
          name: 'test-developer',
          description: 'Test developer agent',
          prompt: 'You are a test developer. Implement solutions based on the analysis.',
          model: 'sonnet',
        },
      ];

      // Save workflow and agents to filesystem (simulate proper setup)
      const workflowPath = path.join(testWorkspacePath, '.apex', 'workflows', 'test-workflow.yaml');
      await fs.writeFile(workflowPath, JSON.stringify(testWorkflow, null, 2));

      for (const agent of testAgents) {
        const agentPath = path.join(testWorkspacePath, '.apex', 'agents', `${agent.name}.md`);
        const agentContent = `# ${agent.name}\n\n${agent.description}\n\n## Prompt\n\n${agent.prompt}`;
        await fs.writeFile(agentPath, agentContent);
      }

      // Create and execute task
      const task = await orchestrator.createTask({
        description: 'Execute test workflow from start to finish',
        workflow: 'test-workflow',
      });

      // Execute the workflow
      const result = await orchestrator.runTask(task.id);

      // Verify workflow completion
      expect(result.status).toBe('completed');
      expect(result.stages).toHaveLength(2);
      expect(result.stages[0].name).toBe('analysis');
      expect(result.stages[0].status).toBe('completed');
      expect(result.stages[1].name).toBe('implementation');
      expect(result.stages[1].status).toBe('completed');

      // Verify task was updated in store
      const finalTask = orchestrator.store.getTask(task.id);
      expect(finalTask!.status).toBe('completed');
      expect(finalTask!.completedAt).toBeInstanceOf(Date);
    });

    it('should handle workflow stage dependencies correctly', async () => {
      const dependentWorkflow: WorkflowDefinition = {
        name: 'dependent-workflow',
        description: 'Workflow with stage dependencies',
        stages: [
          {
            name: 'foundation',
            agent: 'test-analyst',
            description: 'Build foundation',
            inputs: [],
            outputs: ['foundation-data'],
          },
          {
            name: 'middle',
            agent: 'test-developer',
            description: 'Build on foundation',
            inputs: ['foundation-data'],
            outputs: ['middle-data'],
          },
          {
            name: 'final',
            agent: 'test-analyst',
            description: 'Complete the work',
            inputs: ['foundation-data', 'middle-data'],
            outputs: ['final-result'],
          },
        ],
        gates: [],
      };

      // Save workflow
      const workflowPath = path.join(testWorkspacePath, '.apex', 'workflows', 'dependent-workflow.yaml');
      await fs.writeFile(workflowPath, JSON.stringify(dependentWorkflow, null, 2));

      const task = await orchestrator.createTask({
        description: 'Test stage dependencies',
        workflow: 'dependent-workflow',
      });

      const result = await orchestrator.runTask(task.id);

      // Verify execution order and dependencies
      expect(result.status).toBe('completed');
      expect(result.stages).toHaveLength(3);

      // Verify stages completed in correct order
      const foundationStage = result.stages.find(s => s.name === 'foundation')!;
      const middleStage = result.stages.find(s => s.name === 'middle')!;
      const finalStage = result.stages.find(s => s.name === 'final')!;

      expect(foundationStage.completedAt!.getTime()).toBeLessThan(middleStage.startedAt!.getTime());
      expect(middleStage.completedAt!.getTime()).toBeLessThan(finalStage.startedAt!.getTime());
    });
  });

  describe('Error Handling in Workflows', () => {
    it('should handle agent failures gracefully', async () => {
      // Mock Claude to simulate failure
      const mockQuery = vi.mocked(query);
      mockQuery.mockRejectedValueOnce(new Error('Agent execution failed'));

      const failingWorkflow: WorkflowDefinition = {
        name: 'failing-workflow',
        description: 'Workflow that will fail',
        stages: [
          {
            name: 'failing-stage',
            agent: 'test-analyst',
            description: 'This stage will fail',
            inputs: [],
            outputs: ['should-not-exist'],
          },
        ],
        gates: [],
      };

      const workflowPath = path.join(testWorkspacePath, '.apex', 'workflows', 'failing-workflow.yaml');
      await fs.writeFile(workflowPath, JSON.stringify(failingWorkflow, null, 2));

      const task = await orchestrator.createTask({
        description: 'Test error handling',
        workflow: 'failing-workflow',
      });

      const result = await orchestrator.runTask(task.id);

      // Verify proper error handling
      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Agent execution failed');
    });

    it('should handle missing workflow files', async () => {
      await expect(
        orchestrator.createTask({
          description: 'Test missing workflow',
          workflow: 'nonexistent-workflow',
        })
      ).rejects.toThrow(/workflow.*not found/i);
    });

    it('should handle missing agents', async () => {
      const workflowWithMissingAgent: WorkflowDefinition = {
        name: 'missing-agent-workflow',
        description: 'Workflow with missing agent',
        stages: [
          {
            name: 'broken-stage',
            agent: 'nonexistent-agent',
            description: 'Uses missing agent',
            inputs: [],
            outputs: [],
          },
        ],
        gates: [],
      };

      const workflowPath = path.join(testWorkspacePath, '.apex', 'workflows', 'missing-agent-workflow.yaml');
      await fs.writeFile(workflowPath, JSON.stringify(workflowWithMissingAgent, null, 2));

      const task = await orchestrator.createTask({
        description: 'Test missing agent',
        workflow: 'missing-agent-workflow',
      });

      await expect(orchestrator.runTask(task.id)).rejects.toThrow(/agent.*not found/i);
    });
  });

  describe('Usage and Limits Integration', () => {
    it('should track usage across entire workflow', async () => {
      // Create workflow with multiple stages
      const multiStageWorkflow: WorkflowDefinition = {
        name: 'usage-tracking-workflow',
        description: 'Track usage across stages',
        stages: [
          {
            name: 'stage1',
            agent: 'test-analyst',
            description: 'First stage',
            inputs: [],
            outputs: ['stage1-output'],
          },
          {
            name: 'stage2',
            agent: 'test-developer',
            description: 'Second stage',
            inputs: ['stage1-output'],
            outputs: ['stage2-output'],
          },
        ],
        gates: [],
      };

      const workflowPath = path.join(testWorkspacePath, '.apex', 'workflows', 'usage-tracking-workflow.yaml');
      await fs.writeFile(workflowPath, JSON.stringify(multiStageWorkflow, null, 2));

      const task = await orchestrator.createTask({
        description: 'Test usage tracking',
        workflow: 'usage-tracking-workflow',
      });

      await orchestrator.runTask(task.id);

      // Verify usage was tracked
      const finalTask = orchestrator.store.getTask(task.id)!;
      expect(finalTask.usage.inputTokens).toBeGreaterThan(0);
      expect(finalTask.usage.outputTokens).toBeGreaterThan(0);
      expect(finalTask.usage.totalCost).toBeGreaterThan(0);

      // Should have usage from both stages (2 Claude calls)
      expect(finalTask.usage.inputTokens).toBe(100); // 50 * 2 stages
      expect(finalTask.usage.outputTokens).toBe(50);  // 25 * 2 stages
    });

    it('should enforce token limits during execution', async () => {
      // Create orchestrator with very low limits
      const limitedConfig = {
        ...mockConfig,
        limits: {
          ...mockConfig.limits,
          maxTokens: 10, // Very low limit
        },
      };

      const limitedOrchestrator = new ApexOrchestrator(limitedConfig, testWorkspacePath);

      const simpleWorkflow: WorkflowDefinition = {
        name: 'limited-workflow',
        description: 'Workflow to test limits',
        stages: [
          {
            name: 'single-stage',
            agent: 'test-analyst',
            description: 'Will exceed token limit',
            inputs: [],
            outputs: [],
          },
        ],
        gates: [],
      };

      const workflowPath = path.join(testWorkspacePath, '.apex', 'workflows', 'limited-workflow.yaml');
      await fs.writeFile(workflowPath, JSON.stringify(simpleWorkflow, null, 2));

      const task = await limitedOrchestrator.createTask({
        description: 'Test token limits',
        workflow: 'limited-workflow',
      });

      // This should fail due to token limits
      await expect(limitedOrchestrator.runTask(task.id)).rejects.toThrow(/token.*limit/i);

      await limitedOrchestrator.shutdown();
    });
  });

  describe('Event Emission During Workflow', () => {
    it('should emit appropriate events during workflow execution', async () => {
      const events: any[] = [];

      // Listen to all orchestrator events
      orchestrator.onAny((eventType, eventData) => {
        events.push({ type: eventType, data: eventData });
      });

      const eventWorkflow: WorkflowDefinition = {
        name: 'event-workflow',
        description: 'Workflow to test event emission',
        stages: [
          {
            name: 'event-stage',
            agent: 'test-analyst',
            description: 'Test event emission',
            inputs: [],
            outputs: [],
          },
        ],
        gates: [],
      };

      const workflowPath = path.join(testWorkspacePath, '.apex', 'workflows', 'event-workflow.yaml');
      await fs.writeFile(workflowPath, JSON.stringify(eventWorkflow, null, 2));

      const task = await orchestrator.createTask({
        description: 'Test event emission',
        workflow: 'event-workflow',
      });

      await orchestrator.runTask(task.id);

      // Verify events were emitted
      const eventTypes = events.map(e => e.type);
      expect(eventTypes).toContain('task:created');
      expect(eventTypes).toContain('task:status-changed');
      expect(eventTypes).toContain('stage:started');
      expect(eventTypes).toContain('stage:completed');
      expect(eventTypes).toContain('task:completed');
    });
  });
});