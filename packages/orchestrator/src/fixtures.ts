/**
 * TaskStore Test Fixtures Module
 *
 * Provides factory functions to generate test data matching the Task, Agent, and Workflow
 * Zod schemas from @apex/core. All fixtures produce valid data that passes Zod validation.
 *
 * @example
 * ```typescript
 * import { createTestTask, createTestAgent, createTestWorkflow, createTestTasks } from '@apex/orchestrator/fixtures';
 *
 * // Create individual fixtures
 * const task = createTestTask({ description: 'My test task' });
 * const agent = createTestAgent({ name: 'custom-agent', skills: ['testing'] });
 * const workflow = createTestWorkflow({ name: 'test-workflow' });
 *
 * // Create bulk fixtures
 * const tasks = createTestTasks(5, { workflow: 'feature' });
 * ```
 */

import type {
  Task,
  AgentDefinition,
  WorkflowDefinition,
  WorkflowStage,
  TaskStatus,
  TaskPriority,
  TaskEffort,
  TaskUsage,
  AutonomyLevel,
} from '@apexcli/core';

import {
  AgentDefinitionSchema,
  WorkflowDefinitionSchema,
  WorkflowStageSchema,
  TaskStatusSchema,
  TaskPrioritySchema,
  TaskEffortSchema,
} from '@apexcli/core';

/**
 * Factory function to create a Task fixture with sensible defaults.
 *
 * Note: Task is defined as a TypeScript interface rather than a Zod schema.
 * We validate individual components (status, priority, effort) that have schemas.
 *
 * @param overrides - Partial Task properties to override defaults
 * @returns A valid Task object with all required fields populated
 *
 * @example
 * ```typescript
 * const task = createTestTask({ description: 'My test task' });
 * expect(task.status).toBe('pending');
 * expect(task.priority).toBe('normal');
 * ```
 */
export function createTestTask(overrides: Partial<Task> = {}): Task {
  const now = new Date();
  const taskData = {
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test task',
    workflow: 'feature',
    autonomy: 'full' as AutonomyLevel,
    status: 'pending' as TaskStatus,
    priority: 'normal' as TaskPriority,
    effort: 'medium' as TaskEffort,
    projectPath: '/test/project',
    branchName: 'apex/test-branch',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: now,
    updatedAt: now,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      totalCostCents: 0,
      executionTimeMs: 0,
    } as TaskUsage,
    logs: [],
    artifacts: [],
    dependsOn: [],
    blockedBy: [],
    ...overrides,
  };

  // Validate individual components that have Zod schemas
  TaskStatusSchema.parse(taskData.status);
  TaskPrioritySchema.parse(taskData.priority);
  TaskEffortSchema.parse(taskData.effort);

  return taskData as Task;
}

/**
 * Factory function to create an AgentDefinition fixture with Zod validation.
 *
 * @param overrides - Partial AgentDefinition properties to override defaults
 * @returns A valid AgentDefinition that passes AgentDefinitionSchema validation
 * @throws ZodError if the resulting AgentDefinition is invalid
 *
 * @example
 * ```typescript
 * const agent = createTestAgent({ name: 'custom-agent', skills: ['testing'] });
 * expect(agent.model).toBe('sonnet');
 * expect(agent.tools).toContain('Read');
 * ```
 */
export function createTestAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  const agentData = {
    name: 'test-agent',
    description: 'Test agent for automated testing',
    prompt: 'You are a test agent. Follow instructions carefully and provide detailed responses.',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep'],
    model: 'sonnet' as const,
    skills: ['testing', 'debugging'],
    ...overrides,
  };

  // Validate against Zod schema - throws ZodError if invalid
  return AgentDefinitionSchema.parse(agentData);
}

/**
 * Factory function to create a WorkflowStage fixture with Zod validation.
 *
 * @param overrides - Partial WorkflowStage properties to override defaults
 * @returns A valid WorkflowStage that passes WorkflowStageSchema validation
 * @throws ZodError if the resulting WorkflowStage is invalid
 *
 * @example
 * ```typescript
 * const stage = createTestWorkflowStage({
 *   name: 'implementation',
 *   agent: 'developer'
 * });
 * expect(stage.maxRetries).toBe(2);
 * ```
 */
export function createTestWorkflowStage(overrides: Partial<WorkflowStage> = {}): WorkflowStage {
  const stageData = {
    name: 'test-stage',
    agent: 'test-agent',
    description: 'Test workflow stage',
    parallel: false,
    maxRetries: 2,
    ...overrides,
  };

  // Validate against Zod schema - throws ZodError if invalid
  return WorkflowStageSchema.parse(stageData);
}

/**
 * Factory function to create a WorkflowDefinition fixture with Zod validation.
 *
 * @param overrides - Partial WorkflowDefinition properties to override defaults
 * @returns A valid WorkflowDefinition that passes WorkflowDefinitionSchema validation
 * @throws ZodError if the resulting WorkflowDefinition is invalid
 *
 * @example
 * ```typescript
 * const workflow = createTestWorkflow({ name: 'test-workflow' });
 * expect(workflow.stages.length).toBeGreaterThan(0);
 * expect(workflow.stages[0].name).toBe('planning');
 * ```
 */
export function createTestWorkflow(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  const workflowData = {
    name: 'test-workflow',
    description: 'Test workflow for automated testing',
    stages: [
      createTestWorkflowStage({
        name: 'planning',
        agent: 'planner',
        description: 'Plan the implementation approach',
        outputs: ['implementation_plan'],
      }),
      createTestWorkflowStage({
        name: 'implementation',
        agent: 'developer',
        description: 'Implement the planned solution',
        dependsOn: ['planning'],
        inputs: ['implementation_plan'],
        outputs: ['code_changes'],
      }),
      createTestWorkflowStage({
        name: 'testing',
        agent: 'tester',
        description: 'Test the implemented solution',
        dependsOn: ['implementation'],
        inputs: ['code_changes'],
        outputs: ['test_results'],
      }),
    ],
    ...overrides,
  };

  // Validate against Zod schema - throws ZodError if invalid
  return WorkflowDefinitionSchema.parse(workflowData);
}

/**
 * Bulk creation helper to generate multiple Task fixtures.
 *
 * @param count - Number of tasks to create
 * @param overridesOrFn - Either a partial Task to apply to all, or a function that receives index
 * @returns Array of valid Task objects
 *
 * @example
 * ```typescript
 * // Create 5 identical tasks
 * const tasks = createTestTasks(5, { workflow: 'feature' });
 *
 * // Create 5 tasks with varying properties
 * const tasks = createTestTasks(5, (index) => ({
 *   description: `Task ${index + 1}`,
 *   priority: index === 0 ? 'urgent' : 'normal'
 * }));
 * ```
 */
export function createTestTasks(
  count: number,
  overridesOrFn?: Partial<Task> | ((index: number) => Partial<Task>)
): Task[] {
  if (count <= 0) {
    throw new Error('Count must be a positive number');
  }

  return Array.from({ length: count }, (_, index) => {
    const overrides = typeof overridesOrFn === 'function'
      ? overridesOrFn(index)
      : overridesOrFn || {};

    return createTestTask({
      description: `Test task ${index + 1}`,
      ...overrides,
    });
  });
}

/**
 * Bulk creation helper to generate multiple AgentDefinition fixtures.
 *
 * @param count - Number of agents to create
 * @param overridesOrFn - Either a partial AgentDefinition to apply to all, or a function that receives index
 * @returns Array of valid AgentDefinition objects
 *
 * @example
 * ```typescript
 * // Create 3 identical agents
 * const agents = createTestAgents(3, { model: 'opus' });
 *
 * // Create 3 agents with different names
 * const agents = createTestAgents(3, (index) => ({
 *   name: `agent-${index + 1}`,
 *   skills: [`skill-${index + 1}`]
 * }));
 * ```
 */
export function createTestAgents(
  count: number,
  overridesOrFn?: Partial<AgentDefinition> | ((index: number) => Partial<AgentDefinition>)
): AgentDefinition[] {
  if (count <= 0) {
    throw new Error('Count must be a positive number');
  }

  return Array.from({ length: count }, (_, index) => {
    const overrides = typeof overridesOrFn === 'function'
      ? overridesOrFn(index)
      : overridesOrFn || {};

    return createTestAgent({
      name: `test-agent-${index + 1}`,
      description: `Test agent ${index + 1}`,
      ...overrides,
    });
  });
}

/**
 * Bulk creation helper to generate multiple WorkflowDefinition fixtures.
 *
 * @param count - Number of workflows to create
 * @param overridesOrFn - Either a partial WorkflowDefinition to apply to all, or a function that receives index
 * @returns Array of valid WorkflowDefinition objects
 *
 * @example
 * ```typescript
 * // Create 2 identical workflows
 * const workflows = createTestWorkflows(2, { trigger: ['test:event'] });
 *
 * // Create 2 workflows with different names
 * const workflows = createTestWorkflows(2, (index) => ({
 *   name: `workflow-${index + 1}`,
 *   description: `Test workflow ${index + 1}`
 * }));
 * ```
 */
export function createTestWorkflows(
  count: number,
  overridesOrFn?: Partial<WorkflowDefinition> | ((index: number) => Partial<WorkflowDefinition>)
): WorkflowDefinition[] {
  if (count <= 0) {
    throw new Error('Count must be a positive number');
  }

  return Array.from({ length: count }, (_, index) => {
    const overrides = typeof overridesOrFn === 'function'
      ? overridesOrFn(index)
      : overridesOrFn || {};

    return createTestWorkflow({
      name: `test-workflow-${index + 1}`,
      description: `Test workflow ${index + 1}`,
      ...overrides,
    });
  });
}

// ============================================================================
// Re-exports for backward compatibility
// ============================================================================

export { createMockTask } from './test-utils.js';
export {
  DatabaseSeeder,
  seedPendingTask,
  seedRunningTask,
  seedCompletedTask,
  seedFailedTask,
  seedPausedTask,
  seedCancelledTask,
  seedTaskScenario,
  createTestTaskStore,
} from './test-utils.js';