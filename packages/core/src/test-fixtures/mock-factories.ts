/**
 * @fileoverview Mock Factories for Core Domain Types
 *
 * This module provides factory functions for creating mock instances of all core
 * APEX domain types including Task, Agent, Workflow, and related Zod schemas.
 *
 * All factories support partial overrides and generate valid typed objects
 * that match their corresponding Zod schema definitions.
 *
 * @example
 * ```typescript
 * import { createMockTask, createMockAgentDefinition } from './mock-factories';
 *
 * const mockTask = createMockTask({
 *   description: 'Custom task description',
 *   priority: 'high'
 * });
 *
 * const mockAgent = createMockAgentDefinition({
 *   name: 'custom-agent',
 *   model: 'opus'
 * });
 * ```
 */

import type {
  Task,
  TaskUsage,
  TaskLog,
  TaskArtifact,
  AgentDefinition,
  WorkflowDefinition,
  WorkflowStage,
  WorkflowGate,
  ApexConfig,
  ProjectConfig,
  TaskStatus,
  TaskPriority,
  TaskEffort,
  AutonomyLevel,
  AgentModel,
  AgentTool,
  PermissionLevel,
  Permission,
  ToolConfig,
  WorkspaceConfig,
  IsolationConfig,
  ContainerConfig,
  TaskSessionData,
  ThoughtCapture,
  IterationHistory,
  TaskPolicyCheckResult,
  ApprovalState,
  SubtaskStrategy,
  TaskDecomposition,
  SubtaskDefinition
} from '../types.js';

/**
 * Creates a mock Task with reasonable defaults and optional overrides
 */
export function createMockTask(overrides: Partial<Task> = {}): Task {
  const baseTask: Task = {
    id: 'task-' + Math.random().toString(36).substr(2, 9),
    description: 'Mock task description',
    acceptanceCriteria: 'Task should complete successfully',
    workflow: 'feature-development',
    autonomy: 'review-before-commit',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    currentStage: undefined,
    projectPath: '/mock/project/path',
    branchName: undefined,
    prUrl: undefined,
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    dependsOn: undefined,
    blockedBy: undefined,
    parentTaskId: undefined,
    subtaskIds: undefined,
    subtaskStrategy: undefined,
    dryRun: false,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    completedAt: undefined,
    pausedAt: undefined,
    resumeAfter: undefined,
    pauseReason: undefined,
    trashedAt: undefined,
    archivedAt: undefined,
    usage: createMockTaskUsage(),
    logs: [],
    artifacts: [],
    error: undefined,
    conversation: undefined,
    workspace: undefined,
    sessionData: undefined,
    thoughtCaptures: undefined,
    iterationHistory: undefined,
    policyCheckResult: undefined,
    approvalState: undefined
  };

  return { ...baseTask, ...overrides };
}

/**
 * Creates a mock TaskUsage with reasonable defaults and optional overrides
 */
export function createMockTaskUsage(overrides: Partial<TaskUsage> = {}): TaskUsage {
  const baseUsage: TaskUsage = {
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    estimatedCost: 0.015,
    totalCostCents: 15,
    executionTimeMs: 5000
  };

  return { ...baseUsage, ...overrides };
}

/**
 * Creates a mock TaskLog with reasonable defaults and optional overrides
 */
export function createMockTaskLog(overrides: Partial<TaskLog> = {}): TaskLog {
  const baseLog: TaskLog = {
    timestamp: new Date('2024-01-01T12:00:00Z'),
    level: 'info',
    stage: 'implementation',
    agent: 'developer',
    message: 'Mock log message',
    metadata: { action: 'test-action' }
  };

  return { ...baseLog, ...overrides };
}

/**
 * Creates a mock TaskArtifact with reasonable defaults and optional overrides
 */
export function createMockTaskArtifact(overrides: Partial<TaskArtifact> = {}): TaskArtifact {
  const baseArtifact: TaskArtifact = {
    name: 'MockFile.ts',
    type: 'file',
    path: '/src/components/MockFile.ts',
    content: 'export const MockComponent = () => { return <div>Mock</div>; };',
    createdAt: new Date('2024-01-01T12:00:00Z')
  };

  return { ...baseArtifact, ...overrides };
}

/**
 * Creates a mock AgentDefinition with reasonable defaults and optional overrides
 */
export function createMockAgentDefinition(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  const baseAgent: AgentDefinition = {
    name: 'mock-agent',
    model: 'sonnet',
    tools: ['task', 'grep', 'read', 'edit', 'write'],
    description: 'Mock agent for testing purposes',
    prompt: 'You are a mock agent used for testing.'
  };

  return { ...baseAgent, ...overrides };
}

/**
 * Creates a mock WorkflowStage with reasonable defaults and optional overrides
 */
export function createMockWorkflowStage(overrides: Partial<WorkflowStage> = {}): WorkflowStage {
  const baseStage: WorkflowStage = {
    name: 'mock-stage',
    agent: 'mock-agent',
    description: 'Mock workflow stage',
    inputs: undefined,
    outputs: undefined,
    parallel: undefined,
    dependsOn: undefined,
    condition: undefined,
    actions: undefined,
    gate: undefined,
    maxRetries: undefined,
  };

  return { ...baseStage, ...overrides };
}

/**
 * Creates a mock WorkflowGate with reasonable defaults and optional overrides
 */
export function createMockWorkflowGate(overrides: Partial<WorkflowGate> = {}): WorkflowGate {
  const baseGate: WorkflowGate = {
    id: 'gate-mock-' + Math.random().toString(36).substr(2, 9),
    trigger: 'stage:mock-stage:completed',
    name: 'Mock Approval Gate',
    description: 'Mock gate for testing',
    timeout: 300000,
    required: true,
  };

  return { ...baseGate, ...overrides };
}

/**
 * Creates a mock WorkflowDefinition with reasonable defaults and optional overrides
 */
export function createMockWorkflowDefinition(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  const baseWorkflow: WorkflowDefinition = {
    name: 'mock-workflow',
    description: 'Mock workflow for testing',
    stages: [createMockWorkflowStage()],
    gates: undefined,
    isolation: undefined,
  };

  return { ...baseWorkflow, ...overrides };
}

/**
 * Creates a mock Permission with reasonable defaults and optional overrides
 */
export function createMockPermission(overrides: Partial<Permission> = {}): Permission {
  const basePermission: Permission = {
    tool: 'Read',
    level: 'allow-always',
    scope: '/allowed/**',
    createdAt: new Date(),
  };

  return { ...basePermission, ...overrides };
}

/**
 * Creates a mock ToolConfig with reasonable defaults and optional overrides
 */
export function createMockToolConfig(overrides: Partial<ToolConfig> = {}): ToolConfig {
  const baseConfig: ToolConfig = {};
  return { ...baseConfig, ...overrides };
}

/**
 * Creates a mock ContainerConfig with reasonable defaults and optional overrides
 */
export function createMockContainerConfig(overrides: Partial<ContainerConfig> = {}): ContainerConfig {
  const baseConfig: ContainerConfig = {
    image: 'node:20-alpine',
    dockerfile: undefined,
    buildContext: undefined,
    imageTag: undefined,
    volumes: undefined,
    environment: undefined,
    resourceLimits: undefined,
    networkMode: 'bridge',
    workingDir: '/workspace',
    user: undefined,
    labels: undefined,
    entrypoint: undefined,
    command: undefined,
    autoRemove: true,
    privileged: false,
    securityOpts: undefined,
    capAdd: undefined,
    capDrop: undefined,
    autoDependencyInstall: true,
    customInstallCommand: undefined,
    useFrozenLockfile: true,
    installTimeout: undefined,
    installRetries: undefined
  };

  return { ...baseConfig, ...overrides };
}

/**
 * Creates a mock IsolationConfig with reasonable defaults and optional overrides
 */
export function createMockIsolationConfig(overrides: Partial<IsolationConfig> = {}): IsolationConfig {
  const baseConfig: IsolationConfig = {
    mode: 'worktree',
    cleanupOnComplete: true,
    preserveOnFailure: false,
    container: undefined,
  };

  return { ...baseConfig, ...overrides };
}

/**
 * Creates a mock WorkspaceConfig with reasonable defaults and optional overrides
 */
export function createMockWorkspaceConfig(overrides: Partial<WorkspaceConfig> = {}): WorkspaceConfig {
  const baseConfig: WorkspaceConfig = {
    strategy: 'directory',
    path: undefined,
    container: undefined,
    cleanup: true,
    preserveOnFailure: false,
  };

  return { ...baseConfig, ...overrides };
}

/**
 * Creates a mock ProjectConfig with reasonable defaults and optional overrides
 */
export function createMockProjectConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  const baseConfig: ProjectConfig = {
    name: 'mock-project',
  };

  return { ...baseConfig, ...overrides };
}

/**
 * Creates a mock ApexConfig with reasonable defaults and optional overrides
 */
export function createMockApexConfig(overrides: Partial<ApexConfig> = {}): ApexConfig {
  const baseConfig: ApexConfig = {
    version: '0.5.0',
    project: createMockProjectConfig(),
    tools: undefined,
    autonomy: undefined,
    limits: undefined,
    git: undefined,
    repair: undefined,
  };

  return { ...baseConfig, ...overrides };
}

/**
 * Creates a mock SubtaskDefinition with reasonable defaults and optional overrides
 */
export function createMockSubtaskDefinition(overrides: Partial<SubtaskDefinition> = {}): SubtaskDefinition {
  const baseDefinition: SubtaskDefinition = {
    description: 'Mock subtask description',
    acceptanceCriteria: 'Subtask should complete successfully',
    workflow: undefined,
    priority: undefined,
    effort: undefined,
    dependsOn: undefined
  };

  return { ...baseDefinition, ...overrides };
}

/**
 * Creates a mock TaskDecomposition with reasonable defaults and optional overrides
 */
export function createMockTaskDecomposition(overrides: Partial<TaskDecomposition> = {}): TaskDecomposition {
  const baseDecomposition: TaskDecomposition = {
    parentTaskId: 'parent-task-id',
    subtasks: [createMockSubtaskDefinition()],
    strategy: 'sequential'
  };

  return { ...baseDecomposition, ...overrides };
}

/**
 * Creates a collection of related mock objects for testing workflows
 */
export function createMockWorkflowTestData(overrides: {
  task?: Partial<Task>;
  agent?: Partial<AgentDefinition>;
  workflow?: Partial<WorkflowDefinition>;
  config?: Partial<ApexConfig>;
} = {}) {
  return {
    task: createMockTask(overrides.task),
    agent: createMockAgentDefinition(overrides.agent),
    workflow: createMockWorkflowDefinition(overrides.workflow),
    config: createMockApexConfig(overrides.config)
  };
}

/**
 * Creates a mock Task with multiple logs, artifacts, and usage data for complex testing scenarios
 */
export function createMockComplexTask(overrides: Partial<Task> = {}): Task {
  return createMockTask({
    logs: [
      createMockTaskLog({ level: 'info', message: 'Task started' }),
      createMockTaskLog({ level: 'warn', message: 'Warning during execution' }),
      createMockTaskLog({ level: 'info', message: 'Task completed' })
    ],
    artifacts: [
      createMockTaskArtifact({ name: 'Component.tsx', type: 'file' }),
      createMockTaskArtifact({ name: 'test.diff', type: 'diff' }),
      createMockTaskArtifact({ name: 'report.md', type: 'report' })
    ],
    usage: createMockTaskUsage({
      inputTokens: 5000,
      outputTokens: 2500,
      totalTokens: 7500,
      estimatedCost: 0.075,
      totalCostCents: 75,
      executionTimeMs: 15000
    }),
    ...overrides
  });
}

/**
 * Creates a mock workflow with multiple stages and gates for complex testing scenarios
 */
export function createMockComplexWorkflow(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return createMockWorkflowDefinition({
    name: 'complex-workflow',
    description: 'Complex multi-stage workflow with gates',
    stages: [
      createMockWorkflowStage({ name: 'planning', agent: 'planner' }),
      createMockWorkflowStage({ name: 'implementation', agent: 'developer' }),
      createMockWorkflowStage({ name: 'testing', agent: 'tester' }),
      createMockWorkflowStage({ name: 'review', agent: 'reviewer' })
    ],
    gates: [
      createMockWorkflowGate({ id: 'plan-approval', name: 'Plan Approval', trigger: 'stage:planning:completed' }),
      createMockWorkflowGate({ id: 'security-check', name: 'Security Check', trigger: 'stage:review:completed' })
    ],
    ...overrides
  });
}

/**
 * Validates that a mock object matches its expected type structure
 */
export function validateMockObject<T>(mockObj: T, validator: (obj: T) => boolean): boolean {
  try {
    return validator(mockObj);
  } catch (error) {
    console.error('Mock validation failed:', error);
    return false;
  }
}

/**
 * Collection of all mock factories for easy access
 */
export const mockFactories = {
  // Core domain types
  createMockTask,
  createMockTaskUsage,
  createMockTaskLog,
  createMockTaskArtifact,
  createMockAgentDefinition,
  createMockWorkflowStage,
  createMockWorkflowGate,
  createMockWorkflowDefinition,
  createMockPermission,
  createMockToolConfig,
  createMockContainerConfig,
  createMockIsolationConfig,
  createMockWorkspaceConfig,
  createMockProjectConfig,
  createMockApexConfig,
  createMockSubtaskDefinition,
  createMockTaskDecomposition,

  // Complex scenarios
  createMockWorkflowTestData,
  createMockComplexTask,
  createMockComplexWorkflow,

  // Utilities
  validateMockObject
};

export default mockFactories;