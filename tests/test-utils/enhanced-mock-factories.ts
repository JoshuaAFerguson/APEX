/**
 * Enhanced Mock Factories for APEX Integration Testing
 *
 * This module provides advanced mock factories that build upon the existing
 * infrastructure to provide more sophisticated testing capabilities.
 */

import { vi } from 'vitest';
import { EventEmitter } from 'events';
import type {
  Task,
  AgentDefinition,
  WorkflowDefinition,
  Permission,
  PermissionLevel,
  AgentTool,
  TaskStatus,
  Autonomy,
  Priority,
  ApexConfig,
} from '@apexcli/core';

// ============================================================================
// Advanced Task Mock Factory
// ============================================================================

export interface TaskMockOptions {
  withEvents?: boolean;
  withHistory?: boolean;
  withValidation?: boolean;
  withMetrics?: boolean;
  customBehaviors?: Record<string, (...args: any[]) => any>;
}

/**
 * Create an advanced mock task with realistic behavior patterns
 */
export function createAdvancedTaskMock(baseTask: Partial<Task> = {}, options: TaskMockOptions = {}): Task & {
  // Enhanced mock methods
  updateStatus: (status: TaskStatus) => void;
  addLog: (message: string, level?: 'info' | 'warn' | 'error') => void;
  addArtifact: (name: string, path: string, type?: string) => void;
  simulateProgress: (stages: string[]) => Promise<void>;

  // Event handling
  on?: (event: string, listener: (...args: any[]) => void) => void;
  emit?: (event: string, ...args: any[]) => boolean;

  // History tracking
  getStatusHistory?: () => Array<{ status: TaskStatus; timestamp: Date }>;
  getLogHistory?: () => Array<{ message: string; level: string; timestamp: Date }>;

  // Metrics
  getMetrics?: () => Record<string, number>;

  // Validation
  validate?: () => { valid: boolean; errors: string[] };
} {
  const {
    withEvents = false,
    withHistory = false,
    withValidation = false,
    withMetrics = false,
    customBehaviors = {},
  } = options;

  const now = new Date();
  let task: Task = {
    id: `mock_task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Mock task for testing',
    workflow: 'feature',
    status: 'pending',
    autonomy: 'full',
    priority: 'normal',
    projectPath: '/tmp/mock-project',
    branchName: 'mock-branch',
    retryCount: 0,
    maxRetries: 3,
    dependsOn: [],
    blockedBy: [],
    createdAt: now,
    updatedAt: now,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    logs: [],
    artifacts: [],
    ...baseTask,
  };

  // History tracking
  const statusHistory: Array<{ status: TaskStatus; timestamp: Date }> = [
    { status: task.status, timestamp: task.createdAt },
  ];
  const logHistory: Array<{ message: string; level: string; timestamp: Date }> = [];

  // Metrics tracking
  const metrics: Record<string, number> = {
    statusChanges: 0,
    logsAdded: 0,
    artifactsAdded: 0,
    executionTime: 0,
  };

  // Event emitter (optional)
  const eventEmitter = withEvents ? new EventEmitter() : null;

  // Enhanced methods
  const mockTask = Object.assign(task, {
    updateStatus: (status: TaskStatus) => {
      const oldStatus = task.status;
      task.status = status;
      task.updatedAt = new Date();

      if (withHistory) {
        statusHistory.push({ status, timestamp: new Date() });
      }

      if (withMetrics) {
        metrics.statusChanges++;
      }

      if (withEvents && eventEmitter) {
        eventEmitter.emit('statusChanged', { from: oldStatus, to: status, task });
      }
    },

    addLog: (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
      const logEntry = {
        message,
        level,
        timestamp: new Date(),
        stage: 'mock',
      };

      task.logs.push(logEntry);

      if (withHistory) {
        logHistory.push(logEntry);
      }

      if (withMetrics) {
        metrics.logsAdded++;
      }

      if (withEvents && eventEmitter) {
        eventEmitter.emit('logAdded', { logEntry, task });
      }
    },

    addArtifact: (name: string, path: string, type = 'file') => {
      const artifact = {
        name,
        path,
        type,
        createdAt: new Date(),
        size: Math.floor(Math.random() * 10000), // Mock size
      };

      task.artifacts.push(artifact);

      if (withMetrics) {
        metrics.artifactsAdded++;
      }

      if (withEvents && eventEmitter) {
        eventEmitter.emit('artifactAdded', { artifact, task });
      }
    },

    simulateProgress: async (stages: string[]) => {
      const startTime = Date.now();

      for (const stage of stages) {
        mockTask.updateStatus('in-progress');
        mockTask.addLog(`Starting stage: ${stage}`);

        // Simulate stage execution time
        await new Promise(resolve => setTimeout(resolve, 10));

        mockTask.addLog(`Completed stage: ${stage}`);
      }

      mockTask.updateStatus('completed');

      if (withMetrics) {
        metrics.executionTime = Date.now() - startTime;
      }
    },

    // Optional event methods
    ...(withEvents && eventEmitter ? {
      on: eventEmitter.on.bind(eventEmitter),
      emit: eventEmitter.emit.bind(eventEmitter),
    } : {}),

    // Optional history methods
    ...(withHistory ? {
      getStatusHistory: () => [...statusHistory],
      getLogHistory: () => [...logHistory],
    } : {}),

    // Optional metrics methods
    ...(withMetrics ? {
      getMetrics: () => ({ ...metrics }),
    } : {}),

    // Optional validation methods
    ...(withValidation ? {
      validate: () => {
        const errors: string[] = [];

        if (!task.id) errors.push('Task ID is required');
        if (!task.description) errors.push('Task description is required');
        if (!task.workflow) errors.push('Workflow is required');
        if (task.retryCount > task.maxRetries) errors.push('Retry count exceeds maximum');

        return { valid: errors.length === 0, errors };
      },
    } : {}),

    // Custom behaviors
    ...customBehaviors,
  });

  return mockTask;
}

// ============================================================================
// Advanced Orchestrator Mock Factory
// ============================================================================

export interface OrchestratorMockOptions {
  taskStore?: any;
  agentRegistry?: Record<string, AgentDefinition>;
  workflowRegistry?: Record<string, WorkflowDefinition>;
  permissionSystem?: any;
  eventTracking?: boolean;
  performanceMetrics?: boolean;
}

/**
 * Create a comprehensive orchestrator mock
 */
export function createAdvancedOrchestratorMock(options: OrchestratorMockOptions = {}) {
  const {
    taskStore,
    agentRegistry = {},
    workflowRegistry = {},
    permissionSystem,
    eventTracking = true,
    performanceMetrics = false,
  } = options;

  const tasks = new Map<string, Task>();
  const eventEmitter = eventTracking ? new EventEmitter() : null;
  const metrics = performanceMetrics ? {
    tasksCreated: 0,
    tasksCompleted: 0,
    tasksFailures: 0,
    totalExecutionTime: 0,
    averageExecutionTime: 0,
  } : {};

  const orchestratorMock = {
    // Core methods
    createTask: vi.fn().mockImplementation(async (taskData: Partial<Task>) => {
      const task = createAdvancedTaskMock(taskData);
      tasks.set(task.id, task);

      if (performanceMetrics) {
        metrics.tasksCreated++;
      }

      if (eventTracking && eventEmitter) {
        eventEmitter.emit('task:created', task);
      }

      return task;
    }),

    getTask: vi.fn().mockImplementation(async (taskId: string) => {
      return tasks.get(taskId);
    }),

    listTasks: vi.fn().mockImplementation(async (filters?: any) => {
      const taskList = Array.from(tasks.values());

      if (filters?.status) {
        return taskList.filter(task => task.status === filters.status);
      }

      if (filters?.limit) {
        return taskList.slice(0, filters.limit);
      }

      return taskList;
    }),

    updateTask: vi.fn().mockImplementation(async (taskId: string, updates: Partial<Task>) => {
      const task = tasks.get(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      Object.assign(task, updates, { updatedAt: new Date() });

      if (eventTracking && eventEmitter) {
        eventEmitter.emit('task:updated', task);
      }

      return task;
    }),

    updateTaskStatus: vi.fn().mockImplementation(async (taskId: string, status: TaskStatus) => {
      const task = tasks.get(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      const oldStatus = task.status;
      task.status = status;
      task.updatedAt = new Date();

      if (status === 'completed' && performanceMetrics) {
        metrics.tasksCompleted++;
      } else if (status === 'failed' && performanceMetrics) {
        metrics.tasksFailures++;
      }

      if (eventTracking && eventEmitter) {
        eventEmitter.emit('task:status:changed', { task, oldStatus, newStatus: status });
      }

      return task;
    }),

    executeTask: vi.fn().mockImplementation(async (taskId: string) => {
      const task = tasks.get(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      const startTime = Date.now();

      // Simulate task execution
      await orchestratorMock.updateTaskStatus(taskId, 'in-progress');

      // Simulate workflow stages
      const workflow = workflowRegistry[task.workflow];
      if (workflow?.stages) {
        for (const stage of workflow.stages) {
          if (eventTracking && eventEmitter) {
            eventEmitter.emit('stage:started', { task, stage: stage.name });
          }

          // Simulate stage execution
          await new Promise(resolve => setTimeout(resolve, 10));

          if (eventTracking && eventEmitter) {
            eventEmitter.emit('stage:completed', { task, stage: stage.name });
          }
        }
      }

      await orchestratorMock.updateTaskStatus(taskId, 'completed');

      if (performanceMetrics) {
        const executionTime = Date.now() - startTime;
        metrics.totalExecutionTime += executionTime;
        metrics.averageExecutionTime = metrics.totalExecutionTime / metrics.tasksCreated;
      }

      return task;
    }),

    // Event handling
    on: eventTracking && eventEmitter ? eventEmitter.on.bind(eventEmitter) : vi.fn(),
    off: eventTracking && eventEmitter ? eventEmitter.off.bind(eventEmitter) : vi.fn(),
    emit: eventTracking && eventEmitter ? eventEmitter.emit.bind(eventEmitter) : vi.fn(),

    // Metrics
    ...(performanceMetrics ? {
      getMetrics: () => ({ ...metrics }),
      resetMetrics: () => {
        metrics.tasksCreated = 0;
        metrics.tasksCompleted = 0;
        metrics.tasksFailures = 0;
        metrics.totalExecutionTime = 0;
        metrics.averageExecutionTime = 0;
      },
    } : {}),

    // Cleanup
    cleanup: vi.fn().mockImplementation(async () => {
      tasks.clear();
      if (eventTracking && eventEmitter) {
        eventEmitter.removeAllListeners();
      }
    }),

    // Test utilities
    _getAllTasks: () => Array.from(tasks.values()),
    _getTaskCount: () => tasks.size,
    _clearTasks: () => tasks.clear(),
  };

  return orchestratorMock;
}

// ============================================================================
// Agent Execution Mock Factory
// ============================================================================

export interface AgentExecutionMockOptions {
  tools?: AgentTool[];
  permissions?: Permission[];
  behavior?: 'success' | 'failure' | 'timeout' | 'custom';
  customBehavior?: (input: any) => Promise<any>;
  executionTime?: number;
  withThinking?: boolean;
  withStepByStep?: boolean;
}

/**
 * Create a realistic agent execution mock
 */
export function createAgentExecutionMock(
  agentName: string,
  options: AgentExecutionMockOptions = {}
) {
  const {
    tools = ['Read', 'Write', 'Edit'],
    permissions = [],
    behavior = 'success',
    customBehavior,
    executionTime = 1000,
    withThinking = false,
    withStepByStep = false,
  } = options;

  const executionHistory: Array<{
    input: any;
    output: any;
    startTime: Date;
    endTime: Date;
    success: boolean;
    error?: Error;
  }> = [];

  const agentMock = {
    name: agentName,
    tools,
    permissions,

    execute: vi.fn().mockImplementation(async (input: any) => {
      const startTime = new Date();

      try {
        // Simulate execution time
        await new Promise(resolve => setTimeout(resolve, executionTime));

        let output: any;

        if (customBehavior) {
          output = await customBehavior(input);
        } else {
          switch (behavior) {
            case 'success':
              output = {
                success: true,
                result: `Agent ${agentName} completed successfully`,
                artifacts: [`${agentName}-output.txt`],
                thinking: withThinking ? `I need to ${input.description}` : undefined,
                steps: withStepByStep ? [
                  'Analyzed the requirements',
                  'Planned the approach',
                  'Executed the solution',
                  'Verified the results',
                ] : undefined,
              };
              break;

            case 'failure':
              throw new Error(`Agent ${agentName} execution failed`);

            case 'timeout':
              await new Promise(resolve => setTimeout(resolve, 10000));
              output = { success: false, error: 'Execution timeout' };
              break;

            default:
              output = { success: true, result: 'Mock result' };
          }
        }

        const endTime = new Date();
        executionHistory.push({
          input,
          output,
          startTime,
          endTime,
          success: true,
        });

        return output;

      } catch (error) {
        const endTime = new Date();
        executionHistory.push({
          input,
          output: null,
          startTime,
          endTime,
          success: false,
          error: error as Error,
        });

        throw error;
      }
    }),

    // Test utilities
    getExecutionHistory: () => [...executionHistory],
    clearHistory: () => { executionHistory.length = 0; },
    getExecutionCount: () => executionHistory.length,
    getSuccessRate: () => {
      const total = executionHistory.length;
      const successful = executionHistory.filter(h => h.success).length;
      return total > 0 ? successful / total : 0;
    },
    getAverageExecutionTime: () => {
      if (executionHistory.length === 0) return 0;
      const totalTime = executionHistory.reduce((sum, h) =>
        sum + (h.endTime.getTime() - h.startTime.getTime()), 0
      );
      return totalTime / executionHistory.length;
    },
  };

  return agentMock;
}

// ============================================================================
// Workflow Execution Mock Factory
// ============================================================================

export interface WorkflowExecutionMockOptions {
  stages: Array<{
    name: string;
    agent: string;
    duration?: number;
    successRate?: number;
  }>;
  parallelExecution?: boolean;
  withCheckpoints?: boolean;
  withRollback?: boolean;
}

/**
 * Create a comprehensive workflow execution mock
 */
export function createWorkflowExecutionMock(
  workflowName: string,
  options: WorkflowExecutionMockOptions
) {
  const {
    stages = [],
    parallelExecution = false,
    withCheckpoints = false,
    withRollback = false,
  } = options;

  const executionHistory: Array<{
    taskId: string;
    stages: Array<{ name: string; status: 'pending' | 'running' | 'completed' | 'failed'; timestamp: Date }>;
    startTime: Date;
    endTime?: Date;
    success: boolean;
    checkpoints?: Array<{ stage: string; data: any; timestamp: Date }>;
  }> = [];

  const workflowMock = {
    name: workflowName,
    stages,

    execute: vi.fn().mockImplementation(async (taskId: string, context: any) => {
      const execution = {
        taskId,
        stages: stages.map(s => ({ name: s.name, status: 'pending' as const, timestamp: new Date() })),
        startTime: new Date(),
        success: false,
        checkpoints: withCheckpoints ? [] : undefined,
      };

      executionHistory.push(execution);

      try {
        if (parallelExecution) {
          // Execute stages in parallel
          await Promise.all(
            stages.map(async (stage, index) => {
              execution.stages[index].status = 'running';
              execution.stages[index].timestamp = new Date();

              await new Promise(resolve => setTimeout(resolve, stage.duration || 100));

              const shouldSucceed = Math.random() < (stage.successRate || 0.9);
              if (!shouldSucceed) {
                throw new Error(`Stage ${stage.name} failed`);
              }

              execution.stages[index].status = 'completed';
              execution.stages[index].timestamp = new Date();

              if (withCheckpoints) {
                execution.checkpoints!.push({
                  stage: stage.name,
                  data: { result: `${stage.name} completed` },
                  timestamp: new Date(),
                });
              }
            })
          );
        } else {
          // Execute stages sequentially
          for (let i = 0; i < stages.length; i++) {
            const stage = stages[i];

            execution.stages[i].status = 'running';
            execution.stages[i].timestamp = new Date();

            await new Promise(resolve => setTimeout(resolve, stage.duration || 100));

            const shouldSucceed = Math.random() < (stage.successRate || 0.9);
            if (!shouldSucceed) {
              execution.stages[i].status = 'failed';
              throw new Error(`Stage ${stage.name} failed`);
            }

            execution.stages[i].status = 'completed';
            execution.stages[i].timestamp = new Date();

            if (withCheckpoints) {
              execution.checkpoints!.push({
                stage: stage.name,
                data: { result: `${stage.name} completed` },
                timestamp: new Date(),
              });
            }
          }
        }

        execution.success = true;
        execution.endTime = new Date();

        return {
          success: true,
          stages: execution.stages,
          executionTime: execution.endTime.getTime() - execution.startTime.getTime(),
          checkpoints: execution.checkpoints,
        };

      } catch (error) {
        execution.endTime = new Date();

        if (withRollback) {
          // Simulate rollback
          await workflowMock.rollback(taskId, execution);
        }

        throw error;
      }
    }),

    rollback: withRollback ? vi.fn().mockImplementation(async (taskId: string, execution: any) => {
      // Simulate rollback operations
      const completedStages = execution.stages.filter(s => s.status === 'completed');

      for (const stage of completedStages.reverse()) {
        await new Promise(resolve => setTimeout(resolve, 50)); // Rollback time
      }

      return { success: true, rolledBackStages: completedStages.length };
    }) : undefined,

    // Test utilities
    getExecutionHistory: () => [...executionHistory],
    clearHistory: () => { executionHistory.length = 0; },
    getSuccessRate: () => {
      const total = executionHistory.length;
      const successful = executionHistory.filter(h => h.success).length;
      return total > 0 ? successful / total : 0;
    },
    getAverageExecutionTime: () => {
      const completed = executionHistory.filter(h => h.endTime);
      if (completed.length === 0) return 0;

      const totalTime = completed.reduce((sum, h) =>
        sum + (h.endTime!.getTime() - h.startTime.getTime()), 0
      );
      return totalTime / completed.length;
    },
  };

  return workflowMock;
}

// ============================================================================
// Mock Registry System
// ============================================================================

export class EnhancedMockRegistry {
  private tasks = new Map<string, any>();
  private orchestrators = new Map<string, any>();
  private agents = new Map<string, any>();
  private workflows = new Map<string, any>();

  createTask(id: string, options?: TaskMockOptions): any {
    const mock = createAdvancedTaskMock({ id }, options);
    this.tasks.set(id, mock);
    return mock;
  }

  createOrchestrator(id: string, options?: OrchestratorMockOptions): any {
    const mock = createAdvancedOrchestratorMock(options);
    this.orchestrators.set(id, mock);
    return mock;
  }

  createAgent(name: string, options?: AgentExecutionMockOptions): any {
    const mock = createAgentExecutionMock(name, options);
    this.agents.set(name, mock);
    return mock;
  }

  createWorkflow(name: string, options: WorkflowExecutionMockOptions): any {
    const mock = createWorkflowExecutionMock(name, options);
    this.workflows.set(name, mock);
    return mock;
  }

  getTask(id: string): any {
    return this.tasks.get(id);
  }

  getOrchestrator(id: string): any {
    return this.orchestrators.get(id);
  }

  getAgent(name: string): any {
    return this.agents.get(name);
  }

  getWorkflow(name: string): any {
    return this.workflows.get(name);
  }

  getAllMocks(): any[] {
    return [
      ...Array.from(this.tasks.values()),
      ...Array.from(this.orchestrators.values()),
      ...Array.from(this.agents.values()),
      ...Array.from(this.workflows.values()),
    ];
  }

  reset(): void {
    this.tasks.clear();
    this.orchestrators.clear();
    this.agents.clear();
    this.workflows.clear();
  }

  cleanup(): void {
    // Call cleanup on all mocks that support it
    for (const mock of this.getAllMocks()) {
      if (typeof mock.cleanup === 'function') {
        mock.cleanup();
      }
    }
    this.reset();
  }
}

// Create a singleton registry
export const mockRegistry = new EnhancedMockRegistry();

// Export everything
export default {
  createAdvancedTaskMock,
  createAdvancedOrchestratorMock,
  createAgentExecutionMock,
  createWorkflowExecutionMock,
  EnhancedMockRegistry,
  mockRegistry,
};