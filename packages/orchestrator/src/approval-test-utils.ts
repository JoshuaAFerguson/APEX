import { EventEmitter } from 'eventemitter3';
import type {
  ApprovalGate,
  ApprovalState,
  ApprovalStatus,
  ApprovalCheckpointType,
  Task,
  WorkflowDefinition,
  WorkflowStage,
} from '@apexcli/core';
import { TaskStore } from './store.js';
import { createTestTaskStore, createMockTask, type TestTaskStoreContext } from './test-utils.js';

// ============================================================================
// Approval State Factories and Utilities
// ============================================================================

/**
 * Configuration options for creating approval states
 */
export interface ApprovalStateConfig {
  /** Unique approval ID (generated if not provided) */
  id?: string;
  /** Task ID (required) */
  taskId: string;
  /** Gate name (defaults to 'test-gate') */
  gateName?: string;
  /** Approval status (defaults to 'pending') */
  status?: ApprovalStatus;
  /** Who made the approval decision */
  approver?: string;
  /** When the approval was requested (defaults to now) */
  requestedAt?: Date;
  /** When the approval was responded to */
  respondedAt?: Date;
  /** Comment or reason */
  comment?: string;
  /** Additional context data */
  context?: Record<string, unknown>;
  /** Stage where approval was requested */
  stage?: string;
  /** Agent that triggered the approval */
  agent?: string;
  /** Number of approvals received */
  approvalsReceived?: number;
  /** Number of approvals required */
  approvalsRequired?: number;
  /** Timeout in minutes */
  timeoutMinutes?: number;
  /** When the approval expires */
  expiresAt?: Date;
}

/**
 * Creates a mock approval state with sensible defaults for testing.
 *
 * @param config - Configuration options for the approval state
 * @returns A complete ApprovalState object
 *
 * @example
 * ```typescript
 * const approval = createMockApprovalState({
 *   taskId: 'task-123',
 *   status: 'approved',
 *   approver: 'john.doe@example.com'
 * });
 * ```
 */
export function createMockApprovalState(config: ApprovalStateConfig): ApprovalState {
  const now = new Date();
  const id = config.id || `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    id,
    taskId: config.taskId,
    gateName: config.gateName || 'test-gate',
    status: config.status || 'pending',
    approver: config.approver,
    requestedAt: config.requestedAt || now,
    respondedAt: config.respondedAt,
    comment: config.comment,
    context: config.context,
    stage: config.stage,
    agent: config.agent,
    approvalsReceived: config.approvalsReceived,
    approvalsRequired: config.approvalsRequired || 1,
    timeoutMinutes: config.timeoutMinutes,
    expiresAt: config.expiresAt,
  };
}

/**
 * Configuration options for creating approval gates
 */
export interface ApprovalGateConfig {
  /** Unique gate ID */
  id?: string;
  /** Type of checkpoint */
  type?: ApprovalCheckpointType;
  /** Human-readable name */
  name?: string;
  /** Description of what this gate protects */
  description?: string;
  /** Whether this gate is required */
  required?: boolean;
  /** Custom trigger condition */
  trigger?: string;
  /** List of approver identifiers */
  approvers?: string[];
  /** Timeout in minutes */
  timeout?: number;
  /** Auto-approve always */
  autoApprove?: boolean;
  /** Auto-approve on timeout */
  autoApproveOnTimeout?: boolean;
  /** Minimum number of approvals required */
  minApprovals?: number;
}

/**
 * Creates a mock approval gate with sensible defaults for testing.
 *
 * @param config - Configuration options for the approval gate
 * @returns A complete ApprovalGate object
 *
 * @example
 * ```typescript
 * const gate = createMockApprovalGate({
 *   type: 'before-deploy',
 *   name: 'deployment-approval',
 *   timeout: 60,
 *   minApprovals: 2
 * });
 * ```
 */
export function createMockApprovalGate(config: ApprovalGateConfig = {}): ApprovalGate {
  return {
    id: config.id || `gate_${Math.random().toString(36).substr(2, 9)}`,
    type: config.type || 'custom',
    name: config.name || 'test-gate',
    description: config.description || 'Test approval gate',
    required: config.required !== false,
    trigger: config.trigger,
    approvers: config.approvers || ['test@example.com'],
    timeout: config.timeout,
    autoApprove: config.autoApprove || false,
    autoApproveOnTimeout: config.autoApproveOnTimeout || false,
    minApprovals: config.minApprovals || 1,
  };
}

// ============================================================================
// Approval Workflow Simulators
// ============================================================================

/**
 * Simulates different approval scenarios for testing
 */
export type ApprovalScenario =
  | 'pending-approval'
  | 'auto-approval'
  | 'manual-approval'
  | 'rejection'
  | 'timeout'
  | 'multi-step-approval'
  | 'approval-chain';

/**
 * Creates approval states for predefined scenarios
 *
 * @param taskId - The task ID to create approvals for
 * @param scenario - The approval scenario to simulate
 * @returns Array of ApprovalState objects representing the scenario
 *
 * @example
 * ```typescript
 * const approvals = createApprovalScenario('task-123', 'multi-step-approval');
 * expect(approvals).toHaveLength(3);
 * expect(approvals[0].status).toBe('approved');
 * expect(approvals[1].status).toBe('pending');
 * ```
 */
export function createApprovalScenario(taskId: string, scenario: ApprovalScenario): ApprovalState[] {
  const now = new Date();

  switch (scenario) {
    case 'pending-approval':
      return [
        createMockApprovalState({
          taskId,
          gateName: 'code-review',
          status: 'pending',
          stage: 'review',
          agent: 'reviewer',
          comment: 'Awaiting code review approval',
        }),
      ];

    case 'auto-approval':
      return [
        createMockApprovalState({
          taskId,
          gateName: 'auto-gate',
          status: 'approved',
          approver: 'system',
          requestedAt: new Date(now.getTime() - 1000),
          respondedAt: now,
          comment: 'Auto-approved by system',
        }),
      ];

    case 'manual-approval':
      return [
        createMockApprovalState({
          taskId,
          gateName: 'deployment-gate',
          status: 'approved',
          approver: 'john.doe@example.com',
          requestedAt: new Date(now.getTime() - 300000), // 5 minutes ago
          respondedAt: now,
          comment: 'Approved after code review',
          stage: 'deployment',
          agent: 'devops',
        }),
      ];

    case 'rejection':
      return [
        createMockApprovalState({
          taskId,
          gateName: 'security-review',
          status: 'denied',
          approver: 'security@example.com',
          requestedAt: new Date(now.getTime() - 600000), // 10 minutes ago
          respondedAt: now,
          comment: 'Security concerns identified - needs further review',
          stage: 'review',
          agent: 'reviewer',
        }),
      ];

    case 'timeout':
      const expiresAt = new Date(now.getTime() + 30000); // 30 seconds from now
      return [
        createMockApprovalState({
          taskId,
          gateName: 'timeout-test',
          status: 'pending',
          timeoutMinutes: 0.5,
          expiresAt,
          comment: 'Will timeout soon',
        }),
      ];

    case 'multi-step-approval':
      return [
        // Step 1: Already approved
        createMockApprovalState({
          taskId,
          gateName: 'code-review',
          status: 'approved',
          approver: 'dev@example.com',
          requestedAt: new Date(now.getTime() - 900000), // 15 minutes ago
          respondedAt: new Date(now.getTime() - 600000), // 10 minutes ago
          comment: 'Code looks good',
          stage: 'review',
          agent: 'reviewer',
        }),
        // Step 2: Currently pending
        createMockApprovalState({
          taskId,
          gateName: 'security-review',
          status: 'pending',
          requestedAt: new Date(now.getTime() - 300000), // 5 minutes ago
          comment: 'Awaiting security approval',
          stage: 'review',
          agent: 'reviewer',
        }),
        // Step 3: Not yet requested
        createMockApprovalState({
          taskId,
          gateName: 'deployment-approval',
          status: 'pending',
          comment: 'Final deployment approval',
          stage: 'deployment',
          agent: 'devops',
        }),
      ];

    case 'approval-chain':
      return [
        // Gate 1: Approved
        createMockApprovalState({
          taskId,
          gateName: 'pr-review',
          status: 'approved',
          approver: 'reviewer1@example.com',
          requestedAt: new Date(now.getTime() - 1200000), // 20 minutes ago
          respondedAt: new Date(now.getTime() - 900000), // 15 minutes ago
          comment: 'PR approved',
          stage: 'review',
          agent: 'reviewer',
        }),
        // Gate 2: Approved
        createMockApprovalState({
          taskId,
          gateName: 'qa-approval',
          status: 'approved',
          approver: 'qa@example.com',
          requestedAt: new Date(now.getTime() - 900000), // 15 minutes ago
          respondedAt: new Date(now.getTime() - 600000), // 10 minutes ago
          comment: 'QA tests passed',
          stage: 'testing',
          agent: 'tester',
        }),
        // Gate 3: Pending
        createMockApprovalState({
          taskId,
          gateName: 'final-approval',
          status: 'pending',
          requestedAt: new Date(now.getTime() - 300000), // 5 minutes ago
          comment: 'Final approval needed',
          stage: 'deployment',
          agent: 'devops',
          approvalsRequired: 2,
          approvalsReceived: 0,
        }),
      ];

    default:
      throw new Error(`Unknown approval scenario: ${scenario}`);
  }
}

// ============================================================================
// Approval Flow Testing Environment
// ============================================================================

/**
 * Event emitter interface for approval flow testing
 */
export interface ApprovalTestEvents {
  'approval-required': (data: { approvalId: string; taskId: string; gateName: string }) => void;
  'approval-granted': (data: { approvalId: string; taskId: string; approver: string }) => void;
  'approval-denied': (data: { approvalId: string; taskId: string; approver: string; reason?: string }) => void;
  'approval-timeout': (data: { approvalId: string; taskId: string; gateName: string }) => void;
}

/**
 * Test environment for simulating approval workflows
 */
export class ApprovalFlowTestEnvironment {
  private store: TaskStore;
  private storeContext: TestTaskStoreContext | null = null;
  private eventEmitter: EventEmitter<ApprovalTestEvents>;
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(store?: TaskStore) {
    this.store = store!;
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Initialize the test environment with a fresh database
   */
  async initialize(): Promise<void> {
    if (!this.store) {
      this.storeContext = await createTestTaskStore();
      this.store = this.storeContext.store;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Clear all timeouts
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();

    // Clean up store if we created it
    if (this.storeContext) {
      await this.storeContext.cleanup();
      this.storeContext = null;
    }

    // Remove all listeners
    this.eventEmitter.removeAllListeners();
  }

  /**
   * Get the TaskStore instance
   */
  getStore(): TaskStore {
    return this.store;
  }

  /**
   * Get the event emitter for listening to approval events
   */
  getEventEmitter(): EventEmitter<ApprovalTestEvents> {
    return this.eventEmitter;
  }

  /**
   * Create a task with approval requirements
   *
   * @param config - Task configuration with approval gates
   * @returns Created task with approval gates
   */
  async createTaskWithApprovals(config: {
    task?: Partial<Task>;
    gates?: ApprovalGateConfig[];
  } = {}): Promise<{ task: Task; gates: ApprovalGate[] }> {
    const task = createMockTask({
      description: 'Task with approval gates',
      workflow: 'feature',
      ...config.task,
    });

    await this.store.createTask(task);

    const gates = (config.gates || [createMockApprovalGate()]).map(gateConfig =>
      createMockApprovalGate(gateConfig)
    );

    return { task, gates };
  }

  /**
   * Simulate requesting approval for a gate
   *
   * @param taskId - Task ID
   * @param gateName - Gate name
   * @param config - Approval configuration
   * @returns Created approval state
   */
  async requestApproval(
    taskId: string,
    gateName: string,
    config: Omit<ApprovalStateConfig, 'taskId' | 'gateName'> = {}
  ): Promise<ApprovalState> {
    const approval = createMockApprovalState({
      ...config,
      taskId,
      gateName,
      status: 'pending',
    });

    await this.store.saveApprovalState(approval);

    // Emit approval required event
    this.eventEmitter.emit('approval-required', {
      approvalId: approval.id,
      taskId,
      gateName,
    });

    // Set up timeout if specified
    if (approval.timeoutMinutes && approval.timeoutMinutes > 0) {
      const timeoutMs = approval.timeoutMinutes * 60 * 1000;
      const timeout = setTimeout(() => {
        this.handleApprovalTimeout(approval.id);
      }, timeoutMs);
      this.timeouts.set(approval.id, timeout);
    }

    return approval;
  }

  /**
   * Simulate granting approval
   *
   * @param approvalId - Approval ID
   * @param approver - Who granted the approval
   * @param comment - Optional comment
   */
  async grantApproval(
    approvalId: string,
    approver: string = 'test@example.com',
    comment?: string
  ): Promise<ApprovalState> {
    const approval = await this.store.getApprovalStateById(approvalId);
    if (!approval) {
      throw new Error(`Approval ${approvalId} not found`);
    }

    // Clear timeout if it exists
    if (this.timeouts.has(approvalId)) {
      clearTimeout(this.timeouts.get(approvalId)!);
      this.timeouts.delete(approvalId);
    }

    const updatedApproval = {
      ...approval,
      status: 'approved' as ApprovalStatus,
      approver,
      respondedAt: new Date(),
      comment: comment || approval.comment,
    };

    await this.store.updateApprovalState(approvalId, {
      status: 'approved',
      approver,
      respondedAt: new Date(),
      comment,
    });

    // Emit approval granted event
    this.eventEmitter.emit('approval-granted', {
      approvalId,
      taskId: approval.taskId,
      approver,
    });

    return updatedApproval;
  }

  /**
   * Simulate denying approval
   *
   * @param approvalId - Approval ID
   * @param approver - Who denied the approval
   * @param reason - Reason for denial
   */
  async denyApproval(
    approvalId: string,
    approver: string = 'test@example.com',
    reason?: string
  ): Promise<ApprovalState> {
    const approval = await this.store.getApprovalStateById(approvalId);
    if (!approval) {
      throw new Error(`Approval ${approvalId} not found`);
    }

    // Clear timeout if it exists
    if (this.timeouts.has(approvalId)) {
      clearTimeout(this.timeouts.get(approvalId)!);
      this.timeouts.delete(approvalId);
    }

    const updatedApproval = {
      ...approval,
      status: 'denied' as ApprovalStatus,
      approver,
      respondedAt: new Date(),
      comment: reason || approval.comment,
    };

    await this.store.updateApprovalState(approvalId, {
      status: 'denied',
      approver,
      respondedAt: new Date(),
      comment: reason,
    });

    // Emit approval denied event
    this.eventEmitter.emit('approval-denied', {
      approvalId,
      taskId: approval.taskId,
      approver,
      reason,
    });

    return updatedApproval;
  }

  /**
   * Simulate an approval timeout
   *
   * @param approvalId - Approval ID
   */
  private async handleApprovalTimeout(approvalId: string): Promise<void> {
    const approval = await this.store.getApprovalStateById(approvalId);
    if (!approval || approval.status !== 'pending') {
      return; // Approval was already processed
    }

    // Remove from timeouts map
    this.timeouts.delete(approvalId);

    // Emit timeout event
    this.eventEmitter.emit('approval-timeout', {
      approvalId,
      taskId: approval.taskId,
      gateName: approval.gateName,
    });
  }

  /**
   * Simulate a complete approval workflow scenario
   *
   * @param taskId - Task ID
   * @param scenario - Scenario to simulate
   * @returns Array of created approval states
   */
  async simulateApprovalWorkflow(
    taskId: string,
    scenario: ApprovalScenario
  ): Promise<ApprovalState[]> {
    const approvals = createApprovalScenario(taskId, scenario);

    // Save all approval states to the store
    for (const approval of approvals) {
      await this.store.saveApprovalState(approval);

      // Emit appropriate events based on status
      if (approval.status === 'pending') {
        this.eventEmitter.emit('approval-required', {
          approvalId: approval.id,
          taskId: approval.taskId,
          gateName: approval.gateName,
        });
      } else if (approval.status === 'approved' && approval.approver) {
        this.eventEmitter.emit('approval-granted', {
          approvalId: approval.id,
          taskId: approval.taskId,
          approver: approval.approver,
        });
      } else if (approval.status === 'denied' && approval.approver) {
        this.eventEmitter.emit('approval-denied', {
          approvalId: approval.id,
          taskId: approval.taskId,
          approver: approval.approver,
          reason: approval.comment,
        });
      }
    }

    return approvals;
  }

  /**
   * Check if all approvals for a task are complete
   *
   * @param taskId - Task ID
   * @returns True if all approvals are approved, false otherwise
   */
  async areAllApprovalsComplete(taskId: string): Promise<boolean> {
    const approvals = await this.store.getApprovalStatesByTask(taskId);
    return approvals.every(approval => approval.status === 'approved');
  }

  /**
   * Check if any approval for a task has been denied
   *
   * @param taskId - Task ID
   * @returns True if any approval is denied, false otherwise
   */
  async hasAnyApprovalBeenDenied(taskId: string): Promise<boolean> {
    const approvals = await this.store.getApprovalStatesByTask(taskId);
    return approvals.some(approval => approval.status === 'denied');
  }

  /**
   * Get pending approvals for a task
   *
   * @param taskId - Task ID
   * @returns Array of pending approval states
   */
  async getPendingApprovals(taskId: string): Promise<ApprovalState[]> {
    const approvals = await this.store.getApprovalStatesByTask(taskId);
    return approvals.filter(approval => approval.status === 'pending');
  }

  /**
   * Wait for approval events (useful for testing)
   *
   * @param eventType - Type of event to wait for
   * @param timeoutMs - Timeout in milliseconds
   * @returns Promise that resolves with event data
   */
  async waitForApprovalEvent<T extends keyof ApprovalTestEvents>(
    eventType: T,
    timeoutMs: number = 5000
  ): Promise<Parameters<ApprovalTestEvents[T]>[0]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.eventEmitter.off(eventType, listener);
        reject(new Error(`Timeout waiting for ${eventType} event`));
      }, timeoutMs);

      const listener = (data: any) => {
        clearTimeout(timeout);
        this.eventEmitter.off(eventType, listener);
        resolve(data);
      };

      this.eventEmitter.on(eventType, listener);
    });
  }
}

// ============================================================================
// Convenience Factory Functions
// ============================================================================

/**
 * Create a pre-configured approval flow test environment
 *
 * @param store - Optional existing TaskStore to use
 * @returns Initialized approval flow test environment
 *
 * @example
 * ```typescript
 * const approvalFlow = await createApprovalFlowTestEnvironment();
 *
 * // Create task with approvals
 * const { task } = await approvalFlow.createTaskWithApprovals({
 *   gates: [
 *     { type: 'before-deploy', name: 'deployment-approval' }
 *   ]
 * });
 *
 * // Request approval
 * const approval = await approvalFlow.requestApproval(task.id, 'deployment-approval');
 *
 * // Grant approval
 * await approvalFlow.grantApproval(approval.id, 'admin@example.com');
 *
 * await approvalFlow.cleanup();
 * ```
 */
export async function createApprovalFlowTestEnvironment(store?: TaskStore): Promise<ApprovalFlowTestEnvironment> {
  const env = new ApprovalFlowTestEnvironment(store);
  await env.initialize();
  return env;
}

/**
 * Create a workflow definition with approval gates for testing
 *
 * @param config - Configuration for the workflow
 * @returns WorkflowDefinition with approval gates
 *
 * @example
 * ```typescript
 * const workflow = createWorkflowWithApprovals({
 *   name: 'test-workflow',
 *   gates: [
 *     { type: 'before-deploy', name: 'deployment-gate' },
 *     { type: 'before-commit', name: 'code-review-gate' }
 *   ]
 * });
 * ```
 */
export function createWorkflowWithApprovals(config: {
  name?: string;
  description?: string;
  gates?: ApprovalGateConfig[];
  stages?: Partial<WorkflowStage>[];
}): WorkflowDefinition {
  const gates = (config.gates || []).map(gateConfig => createMockApprovalGate(gateConfig));

  const defaultStages: WorkflowStage[] = [
    {
      name: 'implementation',
      agent: 'developer',
      description: 'Implement the feature',
      parallel: false,
      gate: gates.length > 0 ? gates[0]?.type : undefined,
    },
  ];

  const stages = config.stages ?
    config.stages.map(stage => ({ ...defaultStages[0], ...stage })) :
    defaultStages;

  return {
    name: config.name || 'test-workflow-with-approvals',
    description: config.description || 'Test workflow with approval gates',
    stages,
  };
}

/**
 * Test utilities for asserting approval states
 */
export const ApprovalTestAssertions = {
  /**
   * Assert that an approval has the expected status
   */
  async assertApprovalStatus(
    store: TaskStore,
    approvalId: string,
    expectedStatus: ApprovalStatus
  ): Promise<void> {
    const approval = await store.getApprovalStateById(approvalId);
    if (!approval) {
      throw new Error(`Approval ${approvalId} not found`);
    }
    if (approval.status !== expectedStatus) {
      throw new Error(`Expected approval status ${expectedStatus}, got ${approval.status}`);
    }
  },

  /**
   * Assert that a task has the expected number of pending approvals
   */
  async assertPendingApprovalsCount(
    store: TaskStore,
    taskId: string,
    expectedCount: number
  ): Promise<void> {
    const approvals = await store.getApprovalStatesByTask(taskId);
    const pendingCount = approvals.filter(a => a.status === 'pending').length;
    if (pendingCount !== expectedCount) {
      throw new Error(`Expected ${expectedCount} pending approvals, got ${pendingCount}`);
    }
  },

  /**
   * Assert that all approvals for a task are approved
   */
  async assertAllApprovalsApproved(
    store: TaskStore,
    taskId: string
  ): Promise<void> {
    const approvals = await store.getApprovalStatesByTask(taskId);
    const allApproved = approvals.every(a => a.status === 'approved');
    if (!allApproved) {
      const statuses = approvals.map(a => `${a.gateName}: ${a.status}`);
      throw new Error(`Not all approvals approved. Status: ${statuses.join(', ')}`);
    }
  },

  /**
   * Assert that an approval has the expected approver
   */
  async assertApprovalApprover(
    store: TaskStore,
    approvalId: string,
    expectedApprover: string
  ): Promise<void> {
    const approval = await store.getApprovalStateById(approvalId);
    if (!approval) {
      throw new Error(`Approval ${approvalId} not found`);
    }
    if (approval.approver !== expectedApprover) {
      throw new Error(`Expected approver ${expectedApprover}, got ${approval.approver}`);
    }
  },
};