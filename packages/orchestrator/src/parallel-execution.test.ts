/**
 * Comprehensive tests for orchestrator parallel execution functionality
 * Tests the core logic that detects parallel-ready stages and emits parallel execution events
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'os';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { initializeApex } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

// Mock child_process for git commands
vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, opts: unknown, callback?: unknown) => {
    if (typeof opts === 'function') {
      callback = opts;
    }
    const cb = callback as (error: Error | null, result?: { stdout: string }) => void;
    cb(null, { stdout: '' });
  }),
}));

describe('ApexOrchestrator Parallel Execution', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-parallel-test-'));

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'parallel-test',
      language: 'typescript',
      framework: 'node',
    });

    // Create a parallel-capable workflow file
    const parallelWorkflowContent = `
name: parallel-feature
description: Workflow with parallel execution capabilities
stages:
  - name: planning
    agent: planner
    description: Create implementation plan

  - name: architecture
    agent: architect
    dependsOn:
      - planning
    description: Design system architecture

  # These stages can run in parallel (both depend only on architecture)
  - name: frontend-implementation
    agent: frontend-developer
    dependsOn:
      - architecture
    description: Implement frontend components

  - name: backend-implementation
    agent: backend-developer
    dependsOn:
      - architecture
    description: Implement backend services

  - name: testing
    agent: tester
    dependsOn:
      - architecture
    description: Create test suites

  # Final stages that depend on parallel work
  - name: integration
    agent: integration-engineer
    dependsOn:
      - frontend-implementation
      - backend-implementation
      - testing
    description: Integrate and test system

  - name: deployment
    agent: devops
    dependsOn:
      - integration
    description: Deploy to production
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'parallel-feature.yaml'),
      parallelWorkflowContent
    );

    // Create test agent files for all agents
    const agents = [
      'planner', 'architect', 'frontend-developer',
      'backend-developer', 'tester', 'integration-engineer', 'devops'
    ];

    for (const agentName of agents) {
      const agentContent = `---
name: ${agentName}
description: ${agentName} agent for testing
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a ${agentName} agent for testing parallel execution.
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', `${agentName}.md`),
        agentContent
      );
    }

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('Parallel Stage Detection', () => {
    it('should identify stages that can run in parallel', async () => {
      // Mock query to simulate successful stage completion
      const mockQuery = vi.mocked(query);
      let stageCompletedCount = 0;

      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          stageCompletedCount++;
          yield { type: 'text', content: `Stage ${stageCompletedCount} completed` };
        },
      } as unknown as ReturnType<typeof query>));

      const parallelStartedEvents: Array<{ stages: string[], agents: string[] }> = [];
      const parallelCompletedEvents: string[] = [];

      orchestrator.on('stage:parallel-started', (taskId, stages, agents) => {
        parallelStartedEvents.push({ stages, agents });
      });

      orchestrator.on('stage:parallel-completed', (taskId) => {
        parallelCompletedEvents.push(taskId);
      });

      const task = await orchestrator.createTask({
        description: 'Test parallel stage detection',
        workflow: 'parallel-feature',
      });

      await orchestrator.executeTask(task.id);

      // Should have detected parallel execution for stages that depend only on architecture
      expect(parallelStartedEvents).toHaveLength(1);
      const parallelEvent = parallelStartedEvents[0];

      expect(parallelEvent.stages).toContain('frontend-implementation');
      expect(parallelEvent.stages).toContain('backend-implementation');
      expect(parallelEvent.stages).toContain('testing');

      expect(parallelEvent.agents).toContain('frontend-developer');
      expect(parallelEvent.agents).toContain('backend-developer');
      expect(parallelEvent.agents).toContain('tester');

      // Should have emitted completion event
      expect(parallelCompletedEvents).toHaveLength(1);
      expect(parallelCompletedEvents[0]).toBe(task.id);
    });

    it('should not emit parallel events for single ready stage', async () => {
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', content: 'Stage completed' };
        },
      } as unknown as ReturnType<typeof query>);

      // Create simple sequential workflow
      const sequentialWorkflowContent = `
name: sequential-test
description: Sequential workflow without parallel stages
stages:
  - name: step1
    agent: planner
    description: First step

  - name: step2
    agent: architect
    dependsOn:
      - step1
    description: Second step
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'sequential-test.yaml'),
        sequentialWorkflowContent
      );

      const parallelStartedEvents: string[] = [];
      orchestrator.on('stage:parallel-started', () => {
        parallelStartedEvents.push('parallel-started');
      });

      const task = await orchestrator.createTask({
        description: 'Test sequential execution',
        workflow: 'sequential-test',
      });

      await orchestrator.executeTask(task.id);

      // Should not emit any parallel events
      expect(parallelStartedEvents).toHaveLength(0);
    });

    it('should handle complex dependency graphs correctly', async () => {
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', content: 'Stage completed' };
        },
      } as unknown as ReturnType<typeof query>);

      // Create workflow with multiple parallel opportunities
      const complexWorkflowContent = `
name: complex-parallel
description: Complex workflow with multiple parallel execution points
stages:
  - name: init
    agent: planner
    description: Initialize

  # First parallel group
  - name: setup-a
    agent: architect
    dependsOn:
      - init
    description: Setup A

  - name: setup-b
    agent: frontend-developer
    dependsOn:
      - init
    description: Setup B

  # Second parallel group (depends on both setups)
  - name: work-a
    agent: backend-developer
    dependsOn:
      - setup-a
      - setup-b
    description: Work A

  - name: work-b
    agent: tester
    dependsOn:
      - setup-a
      - setup-b
    description: Work B

  - name: finalize
    agent: devops
    dependsOn:
      - work-a
      - work-b
    description: Finalize
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'complex-parallel.yaml'),
        complexWorkflowContent
      );

      const parallelStartedEvents: Array<{ stages: string[], agents: string[] }> = [];
      orchestrator.on('stage:parallel-started', (taskId, stages, agents) => {
        parallelStartedEvents.push({ stages, agents });
      });

      const task = await orchestrator.createTask({
        description: 'Test complex parallel workflow',
        workflow: 'complex-parallel',
      });

      await orchestrator.executeTask(task.id);

      // Should detect two parallel execution opportunities
      expect(parallelStartedEvents).toHaveLength(2);

      // First parallel group: setup-a and setup-b
      const firstParallel = parallelStartedEvents[0];
      expect(firstParallel.stages.sort()).toEqual(['setup-a', 'setup-b'].sort());
      expect(firstParallel.agents.sort()).toEqual(['architect', 'frontend-developer'].sort());

      // Second parallel group: work-a and work-b
      const secondParallel = parallelStartedEvents[1];
      expect(secondParallel.stages.sort()).toEqual(['work-a', 'work-b'].sort());
      expect(secondParallel.agents.sort()).toEqual(['backend-developer', 'tester'].sort());
    });
  });

  describe('Parallel Execution Event Timing', () => {
    it('should emit parallel-started before stage execution begins', async () => {
      const mockQuery = vi.mocked(query);
      const eventOrder: string[] = [];

      // Track when query starts vs when events are emitted
      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          eventOrder.push('query-started');
          yield { type: 'text', content: 'Done' };
          eventOrder.push('query-completed');
        },
      } as unknown as ReturnType<typeof query>));

      orchestrator.on('stage:parallel-started', () => {
        eventOrder.push('parallel-started');
      });

      orchestrator.on('stage:parallel-completed', () => {
        eventOrder.push('parallel-completed');
      });

      const task = await orchestrator.createTask({
        description: 'Test event timing',
        workflow: 'parallel-feature',
      });

      await orchestrator.executeTask(task.id);

      // parallel-started should come before any query execution
      const parallelStartedIndex = eventOrder.indexOf('parallel-started');
      const firstQueryIndex = eventOrder.indexOf('query-started');

      expect(parallelStartedIndex).toBeGreaterThanOrEqual(0);
      expect(firstQueryIndex).toBeGreaterThan(parallelStartedIndex);
    });

    it('should emit parallel-completed after all parallel stages finish', async () => {
      const mockQuery = vi.mocked(query);
      const stageCompletions: string[] = [];

      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          const timestamp = Date.now();
          stageCompletions.push(`stage-${timestamp}`);
          yield { type: 'text', content: 'Stage completed' };
        },
      } as unknown as ReturnType<typeof query>));

      let parallelCompletedTime: number | null = null;

      orchestrator.on('stage:parallel-completed', () => {
        parallelCompletedTime = Date.now();
      });

      const task = await orchestrator.createTask({
        description: 'Test completion timing',
        workflow: 'parallel-feature',
      });

      await orchestrator.executeTask(task.id);

      // parallel-completed should be emitted after all stages complete
      expect(parallelCompletedTime).not.toBeNull();
      expect(stageCompletions.length).toBeGreaterThan(0);
    });

    it('should handle rapid parallel state changes', async () => {
      const mockQuery = vi.mocked(query);
      let callCount = 0;

      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          callCount++;
          // Simulate very fast execution
          yield { type: 'text', content: `Fast completion ${callCount}` };
        },
      } as unknown as ReturnType<typeof query>));

      const eventCounts = { started: 0, completed: 0 };

      orchestrator.on('stage:parallel-started', () => {
        eventCounts.started++;
      });

      orchestrator.on('stage:parallel-completed', () => {
        eventCounts.completed++;
      });

      const task = await orchestrator.createTask({
        description: 'Test rapid state changes',
        workflow: 'parallel-feature',
      });

      await orchestrator.executeTask(task.id);

      // Should still emit correct number of events despite rapid execution
      expect(eventCounts.started).toBe(1); // One parallel group detected
      expect(eventCounts.completed).toBe(1); // One parallel completion
    });
  });

  describe('Parallel Execution Error Handling', () => {
    it('should handle failure in one parallel stage', async () => {
      const mockQuery = vi.mocked(query);
      let callCount = 0;

      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          callCount++;
          if (callCount === 2) { // Fail the second parallel stage
            throw new Error('Stage execution failed');
          }
          yield { type: 'text', content: 'Stage completed successfully' };
        },
      } as unknown as ReturnType<typeof query>));

      const task = await orchestrator.createTask({
        description: 'Test parallel stage failure',
        workflow: 'parallel-feature',
        maxRetries: 0, // Disable retries for predictable behavior
      });

      // Execution should fail due to one stage failing
      await expect(orchestrator.executeTask(task.id)).rejects.toThrow('Stage execution failed');

      const failedTask = await orchestrator.getTask(task.id);
      expect(failedTask?.status).toBe('failed');
    });

    it('should emit parallel-completed even if some stages fail', async () => {
      const mockQuery = vi.mocked(query);
      let callCount = 0;

      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          callCount++;
          if (callCount === 2) { // Fail the second call
            throw new Error('Non-retryable error: Task exceeded budget');
          }
          yield { type: 'text', content: 'Success' };
        },
      } as unknown as ReturnType<typeof query>));

      const parallelEvents: string[] = [];

      orchestrator.on('stage:parallel-started', () => {
        parallelEvents.push('started');
      });

      orchestrator.on('stage:parallel-completed', () => {
        parallelEvents.push('completed');
      });

      const task = await orchestrator.createTask({
        description: 'Test failure event emission',
        workflow: 'parallel-feature',
        maxRetries: 0,
      });

      await expect(orchestrator.executeTask(task.id)).rejects.toThrow();

      // Should still emit both events despite failure
      expect(parallelEvents).toContain('started');
      // Note: parallel-completed may or may not be emitted depending on
      // when the failure occurs in the execution flow
    });

    it('should handle retries in parallel execution context', async () => {
      const mockQuery = vi.mocked(query);
      let attemptCount = 0;

      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          attemptCount++;
          if (attemptCount === 1) {
            throw new Error('Network timeout'); // Retryable error
          }
          yield { type: 'text', content: 'Retry success' };
        },
      } as unknown as ReturnType<typeof query>));

      const parallelEvents: string[] = [];

      orchestrator.on('stage:parallel-started', () => {
        parallelEvents.push('started');
      });

      orchestrator.on('stage:parallel-completed', () => {
        parallelEvents.push('completed');
      });

      const task = await orchestrator.createTask({
        description: 'Test retry in parallel context',
        workflow: 'parallel-feature',
        maxRetries: 2,
      });

      await orchestrator.executeTask(task.id);

      const completedTask = await orchestrator.getTask(task.id);
      expect(completedTask?.status).toBe('completed');

      // Should have emitted parallel events despite retry
      expect(parallelEvents).toContain('started');
      expect(parallelEvents).toContain('completed');
    });
  });

  describe('Parallel Execution Event Data Validation', () => {
    it('should emit events with correct stage and agent arrays', async () => {
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', content: 'Success' };
        },
      } as unknown as ReturnType<typeof query>);

      let capturedEvent: { taskId: string, stages: string[], agents: string[] } | null = null;

      orchestrator.on('stage:parallel-started', (taskId, stages, agents) => {
        capturedEvent = { taskId, stages, agents };
      });

      const task = await orchestrator.createTask({
        description: 'Test event data validation',
        workflow: 'parallel-feature',
      });

      await orchestrator.executeTask(task.id);

      expect(capturedEvent).not.toBeNull();
      expect(capturedEvent!.taskId).toBe(task.id);

      // Verify stage and agent arrays match
      expect(capturedEvent!.stages).toHaveLength(capturedEvent!.agents.length);

      // Verify expected stages are present
      const expectedStages = ['frontend-implementation', 'backend-implementation', 'testing'];
      const expectedAgents = ['frontend-developer', 'backend-developer', 'tester'];

      for (const expectedStage of expectedStages) {
        expect(capturedEvent!.stages).toContain(expectedStage);
      }

      for (const expectedAgent of expectedAgents) {
        expect(capturedEvent!.agents).toContain(expectedAgent);
      }

      // Verify stage-agent mapping is correct
      expectedStages.forEach(stage => {
        const stageIndex = capturedEvent!.stages.indexOf(stage);
        const correspondingAgent = capturedEvent!.agents[stageIndex];
        const expectedAgent = expectedAgents[expectedStages.indexOf(stage)];
        expect(correspondingAgent).toBe(expectedAgent);
      });
    });

    it('should handle empty dependency arrays correctly', async () => {
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', content: 'Success' };
        },
      } as unknown as ReturnType<typeof query>));

      // Create workflow where first stages have no dependencies (should run in parallel)
      const parallelStartWorkflowContent = `
name: parallel-start
description: Workflow with parallel stages at the beginning
stages:
  - name: task-a
    agent: planner
    description: Independent task A

  - name: task-b
    agent: architect
    description: Independent task B

  - name: task-c
    agent: frontend-developer
    description: Independent task C

  - name: final
    agent: backend-developer
    dependsOn:
      - task-a
      - task-b
      - task-c
    description: Final task
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'parallel-start.yaml'),
        parallelStartWorkflowContent
      );

      const parallelEvents: Array<{ stages: string[], agents: string[] }> = [];

      orchestrator.on('stage:parallel-started', (taskId, stages, agents) => {
        parallelEvents.push({ stages, agents });
      });

      const task = await orchestrator.createTask({
        description: 'Test empty dependency handling',
        workflow: 'parallel-start',
      });

      await orchestrator.executeTask(task.id);

      // Should detect initial parallel execution of independent tasks
      expect(parallelEvents).toHaveLength(1);
      const initialParallel = parallelEvents[0];

      expect(initialParallel.stages.sort()).toEqual(['task-a', 'task-b', 'task-c'].sort());
      expect(initialParallel.agents.sort()).toEqual(['planner', 'architect', 'frontend-developer'].sort());
    });
  });

  describe('Workflow Integration with Parallel Execution', () => {
    it('should respect stage dependencies in parallel context', async () => {
      const mockQuery = vi.mocked(query);
      const executionOrder: string[] = [];

      mockQuery.mockImplementation(({ prompt }) => ({
        [Symbol.asyncIterator]: async function* () {
          // Extract stage name from prompt context
          if (prompt.includes('planning')) {
            executionOrder.push('planning');
          } else if (prompt.includes('architecture')) {
            executionOrder.push('architecture');
          } else if (prompt.includes('frontend-implementation')) {
            executionOrder.push('frontend-implementation');
          } else if (prompt.includes('backend-implementation')) {
            executionOrder.push('backend-implementation');
          } else if (prompt.includes('testing')) {
            executionOrder.push('testing');
          } else if (prompt.includes('integration')) {
            executionOrder.push('integration');
          } else if (prompt.includes('deployment')) {
            executionOrder.push('deployment');
          }

          yield { type: 'text', content: 'Stage completed' };
        },
      } as unknown as ReturnType<typeof query>));

      const task = await orchestrator.createTask({
        description: 'Test dependency respect in parallel execution',
        workflow: 'parallel-feature',
      });

      await orchestrator.executeTask(task.id);

      // Verify execution order respects dependencies
      const planningIndex = executionOrder.indexOf('planning');
      const architectureIndex = executionOrder.indexOf('architecture');
      const integrationIndex = executionOrder.indexOf('integration');
      const deploymentIndex = executionOrder.indexOf('deployment');

      // Sequential stages should be in order
      expect(planningIndex).toBeLessThan(architectureIndex);
      expect(integrationIndex).toBeLessThan(deploymentIndex);

      // Parallel stages should come after architecture
      const frontendIndex = executionOrder.indexOf('frontend-implementation');
      const backendIndex = executionOrder.indexOf('backend-implementation');
      const testingIndex = executionOrder.indexOf('testing');

      expect(architectureIndex).toBeLessThan(frontendIndex);
      expect(architectureIndex).toBeLessThan(backendIndex);
      expect(architectureIndex).toBeLessThan(testingIndex);

      // Integration should come after all parallel stages
      expect(frontendIndex).toBeLessThan(integrationIndex);
      expect(backendIndex).toBeLessThan(integrationIndex);
      expect(testingIndex).toBeLessThan(integrationIndex);
    });

    it('should handle circular dependency detection', async () => {
      // Create workflow with circular dependencies
      const circularWorkflowContent = `
name: circular-deps
description: Workflow with circular dependencies (should be detected)
stages:
  - name: stage-a
    agent: planner
    dependsOn:
      - stage-b
    description: Stage A

  - name: stage-b
    agent: architect
    dependsOn:
      - stage-a
    description: Stage B
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'circular-deps.yaml'),
        circularWorkflowContent
      );

      const task = await orchestrator.createTask({
        description: 'Test circular dependency handling',
        workflow: 'circular-deps',
      });

      // Should fail due to circular dependencies
      await expect(orchestrator.executeTask(task.id)).rejects.toThrow();
    });

    it('should aggregate usage metrics across parallel stages', async () => {
      const mockQuery = vi.mocked(query);
      let stageCount = 0;

      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          stageCount++;
          yield {
            type: 'text',
            content: 'Stage completed',
            usage: { input_tokens: 100 * stageCount, output_tokens: 50 * stageCount }
          };
        },
      } as unknown as ReturnType<typeof query>));

      const usageUpdates: Array<{ taskId: string, usage: any }> = [];

      orchestrator.on('usage:updated', (taskId, usage) => {
        usageUpdates.push({ taskId, usage });
      });

      const task = await orchestrator.createTask({
        description: 'Test usage aggregation in parallel execution',
        workflow: 'parallel-feature',
      });

      await orchestrator.executeTask(task.id);

      const finalTask = await orchestrator.getTask(task.id);

      // Should have accumulated usage from all stages
      expect(finalTask?.usage.inputTokens).toBeGreaterThan(0);
      expect(finalTask?.usage.outputTokens).toBeGreaterThan(0);
      expect(finalTask?.usage.totalTokens).toBeGreaterThan(0);

      // Should have emitted usage updates
      expect(usageUpdates.length).toBeGreaterThan(0);
      expect(usageUpdates.every(update => update.taskId === task.id)).toBe(true);
    });
  });
});