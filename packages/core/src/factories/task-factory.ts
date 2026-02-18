/**
 * Task Factory - Mock factories for Task and related domain types
 */

import { z } from 'zod';
import type {
  Task,
  TaskStatus,
  TaskPriority,
  TaskEffort,
  TaskUsage,
  TaskLog,
  TaskArtifact,
  AgentMessage,
  WorkspaceConfig,
  TaskSessionData,
  ThoughtCapture,
  IterationHistory,
  TaskPolicyCheckResult,
  ApprovalState,
  SubtaskStrategy,
  TaskDecomposition,
  SubtaskDefinition,
  AutonomyLevel,
} from '../types.js';

// ============================================================================
// Task Usage Factory
// ============================================================================

export interface TaskUsageOverrides {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  totalCostCents?: number;
  executionTimeMs?: number;
}

export function createTaskUsage(overrides: TaskUsageOverrides = {}): TaskUsage {
  const defaults: TaskUsage = {
    inputTokens: 1500,
    outputTokens: 800,
    totalTokens: 2300,
    estimatedCost: 0.023,
    totalCostCents: 23,
    executionTimeMs: 5000,
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Task Log Factory
// ============================================================================

export interface TaskLogOverrides {
  timestamp?: Date;
  level?: 'debug' | 'info' | 'warn' | 'error';
  stage?: string;
  agent?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export function createTaskLog(overrides: TaskLogOverrides = {}): TaskLog {
  const defaults: TaskLog = {
    timestamp: new Date(),
    level: 'info',
    stage: 'implementation',
    agent: 'developer',
    message: 'Task execution in progress',
    metadata: { step: 1, total: 3 },
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Task Artifact Factory
// ============================================================================

export interface TaskArtifactOverrides {
  name?: string;
  type?: 'file' | 'diff' | 'report' | 'log';
  path?: string;
  content?: string;
  createdAt?: Date;
}

export function createTaskArtifact(overrides: TaskArtifactOverrides = {}): TaskArtifact {
  const defaults: TaskArtifact = {
    name: 'LoginComponent.tsx',
    type: 'file',
    path: '/src/components/LoginComponent.tsx',
    content: 'import React from "react";\n\nexport const LoginComponent = () => {\n  return <div>Login</div>;\n};',
    createdAt: new Date(),
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Agent Message Factory
// ============================================================================

export interface AgentMessageOverrides {
  role?: 'user' | 'assistant';
  content?: string;
  timestamp?: Date;
  agent?: string;
  stage?: string;
  metadata?: Record<string, unknown>;
}

export function createAgentMessage(overrides: AgentMessageOverrides = {}): AgentMessage {
  const defaults: AgentMessage = {
    role: 'assistant',
    content: 'I will start implementing the requested feature.',
    timestamp: new Date(),
    agent: 'developer',
    stage: 'implementation',
    metadata: { confidence: 0.95 },
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Workspace Config Factory
// ============================================================================

export interface WorkspaceConfigOverrides {
  type?: 'local' | 'container' | 'remote';
  path?: string;
  isolation?: boolean;
  cleanup?: boolean;
  environment?: Record<string, string>;
  resources?: {
    cpu?: number;
    memory?: string;
    storage?: string;
  };
}

export function createWorkspaceConfig(overrides: WorkspaceConfigOverrides = {}): WorkspaceConfig {
  const defaults: WorkspaceConfig = {
    type: 'local',
    path: '/tmp/apex-workspace',
    isolation: true,
    cleanup: true,
    environment: {
      NODE_ENV: 'development',
      PATH: '/usr/local/bin:/usr/bin:/bin',
    },
    resources: {
      cpu: 2,
      memory: '4Gi',
      storage: '10Gi',
    },
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Task Session Data Factory
// ============================================================================

export interface TaskSessionDataOverrides {
  checkpoint?: string;
  state?: Record<string, unknown>;
  lastSaved?: Date;
  version?: number;
}

export function createTaskSessionData(overrides: TaskSessionDataOverrides = {}): TaskSessionData {
  const defaults: TaskSessionData = {
    checkpoint: 'implementation_started',
    state: {
      filesModified: ['src/components/Login.tsx'],
      currentStep: 'writing_tests',
      progress: 0.6,
    },
    lastSaved: new Date(),
    version: 1,
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Thought Capture Factory
// ============================================================================

export interface ThoughtCaptureOverrides {
  id?: string;
  content?: string;
  category?: string;
  timestamp?: Date;
  agent?: string;
  stage?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export function createThoughtCapture(overrides: ThoughtCaptureOverrides = {}): ThoughtCapture {
  const defaults: ThoughtCapture = {
    id: `thought_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    content: 'I should consider edge cases for user input validation',
    category: 'implementation',
    timestamp: new Date(),
    agent: 'developer',
    stage: 'implementation',
    confidence: 0.8,
    metadata: { priority: 'high', actionable: true },
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Iteration History Factory
// ============================================================================

export interface IterationHistoryOverrides {
  iterations?: Array<{
    version: number;
    description: string;
    timestamp: Date;
    changes: string[];
    reason: string;
  }>;
  currentVersion?: number;
  totalIterations?: number;
}

export function createIterationHistory(overrides: IterationHistoryOverrides = {}): IterationHistory {
  const defaults: IterationHistory = {
    iterations: [
      {
        version: 1,
        description: 'Initial implementation',
        timestamp: new Date(Date.now() - 3600000),
        changes: ['Created LoginComponent'],
        reason: 'Initial task requirements',
      },
      {
        version: 2,
        description: 'Added validation',
        timestamp: new Date(),
        changes: ['Added form validation', 'Added error handling'],
        reason: 'Feedback from code review',
      },
    ],
    currentVersion: 2,
    totalIterations: 2,
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Approval State Factory
// ============================================================================

export interface ApprovalStateOverrides {
  required?: boolean;
  pending?: boolean;
  approved?: boolean;
  approver?: string;
  requestedAt?: Date;
  respondedAt?: Date;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export function createApprovalState(overrides: ApprovalStateOverrides = {}): ApprovalState {
  const defaults: ApprovalState = {
    required: true,
    pending: true,
    approved: false,
    approver: 'user@example.com',
    requestedAt: new Date(),
    reason: 'Code review required for production deployment',
    metadata: { reviewType: 'security', severity: 'high' },
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Subtask Definition Factory
// ============================================================================

export interface SubtaskDefinitionOverrides {
  description?: string;
  acceptanceCriteria?: string;
  workflow?: string;
  priority?: TaskPriority;
  effort?: TaskEffort;
  dependsOn?: string[];
}

export function createSubtaskDefinition(overrides: SubtaskDefinitionOverrides = {}): SubtaskDefinition {
  const defaults: SubtaskDefinition = {
    description: 'Create user authentication API',
    acceptanceCriteria: 'API should handle login/logout with JWT tokens',
    workflow: 'api-development',
    priority: 'high',
    effort: 'medium',
    dependsOn: ['Create user database schema'],
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Task Decomposition Factory
// ============================================================================

export interface TaskDecompositionOverrides {
  parentTaskId?: string;
  subtasks?: SubtaskDefinition[];
  strategy?: SubtaskStrategy;
}

export function createTaskDecomposition(overrides: TaskDecompositionOverrides = {}): TaskDecomposition {
  const defaults: TaskDecomposition = {
    parentTaskId: 'task-123',
    subtasks: [
      createSubtaskDefinition({
        description: 'Create user model',
        acceptanceCriteria: 'Model should include validation',
        workflow: 'code-only',
        effort: 'small',
      }),
      createSubtaskDefinition({
        description: 'Create user controller',
        dependsOn: ['Create user model'],
        effort: 'medium',
      }),
    ],
    strategy: 'dependency-based',
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Task Factory (Main)
// ============================================================================

export interface TaskOverrides {
  id?: string;
  description?: string;
  acceptanceCriteria?: string;
  workflow?: string;
  autonomy?: AutonomyLevel;
  status?: TaskStatus;
  priority?: TaskPriority;
  effort?: TaskEffort;
  currentStage?: string;
  projectPath?: string;
  branchName?: string;
  prUrl?: string;
  retryCount?: number;
  maxRetries?: number;
  resumeAttempts?: number;
  dependsOn?: string[];
  blockedBy?: string[];
  parentTaskId?: string;
  subtaskIds?: string[];
  subtaskStrategy?: SubtaskStrategy;
  dryRun?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  completedAt?: Date;
  pausedAt?: Date;
  resumeAfter?: Date;
  pauseReason?: string;
  trashedAt?: Date;
  archivedAt?: Date;
  usage?: TaskUsage;
  logs?: TaskLog[];
  artifacts?: TaskArtifact[];
  error?: string;
  conversation?: AgentMessage[];
  workspace?: WorkspaceConfig;
  sessionData?: TaskSessionData;
  thoughtCaptures?: ThoughtCapture[];
  iterationHistory?: IterationHistory;
  policyCheckResult?: TaskPolicyCheckResult;
  approvalState?: ApprovalState;
}

/**
 * Creates a mock Task with realistic default values
 *
 * @param overrides - Partial task properties to override defaults
 * @returns Complete Task object with valid type-safe properties
 *
 * @example
 * ```typescript
 * // Create task with defaults
 * const task = createTask();
 *
 * // Create task with custom properties
 * const customTask = createTask({
 *   description: 'Add login component',
 *   priority: 'urgent',
 *   effort: 'large'
 * });
 * ```
 */
export function createTask(overrides: TaskOverrides = {}): Task {
  const now = new Date();
  const id = overrides.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const defaults: Task = {
    id,
    description: 'Create mock task for testing',
    acceptanceCriteria: 'Task should pass all tests and meet quality standards',
    workflow: 'feature-development',
    autonomy: 'supervised',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    currentStage: 'planning',
    projectPath: '/Users/developer/projects/apex',
    branchName: `apex/${id.replace('task_', '')}-feature-development`,
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    dependsOn: [],
    blockedBy: [],
    createdAt: now,
    updatedAt: now,
    usage: createTaskUsage(),
    logs: [
      createTaskLog({ message: 'Task created and queued for execution' }),
    ],
    artifacts: [],
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Factory Collections
// ============================================================================

/**
 * Creates multiple tasks with sequential IDs and varied properties
 */
export function createTasks(count: number, baseOverrides: TaskOverrides = {}): Task[] {
  return Array.from({ length: count }, (_, index) => {
    return createTask({
      ...baseOverrides,
      id: `task_${Date.now()}_${index.toString().padStart(3, '0')}`,
      description: `${baseOverrides.description || 'Mock task'} ${index + 1}`,
      priority: ['low', 'normal', 'high', 'urgent'][index % 4] as TaskPriority,
      status: ['pending', 'queued', 'in-progress', 'completed'][index % 4] as TaskStatus,
    });
  });
}

/**
 * Creates a task in different lifecycle stages for testing workflows
 */
export function createTaskLifecycle(baseOverrides: TaskOverrides = {}): {
  pending: Task;
  inProgress: Task;
  completed: Task;
  failed: Task;
} {
  const baseTask = createTask(baseOverrides);

  return {
    pending: { ...baseTask, status: 'pending' },
    inProgress: {
      ...baseTask,
      status: 'in-progress',
      currentStage: 'implementation',
      logs: [
        createTaskLog({ message: 'Task execution started' }),
        createTaskLog({ message: 'Implementing feature requirements' }),
      ],
    },
    completed: {
      ...baseTask,
      status: 'completed',
      completedAt: new Date(),
      artifacts: [
        createTaskArtifact({ name: 'implementation.tsx' }),
        createTaskArtifact({ name: 'test.spec.ts', type: 'report' }),
      ],
    },
    failed: {
      ...baseTask,
      status: 'failed',
      error: 'Build failed due to TypeScript errors',
      logs: [
        createTaskLog({ level: 'error', message: 'Compilation failed' }),
      ],
    },
  };
}