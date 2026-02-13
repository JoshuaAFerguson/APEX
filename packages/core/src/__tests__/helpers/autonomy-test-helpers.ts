/**
 * @fileoverview Autonomy Level Test Helpers - Utilities for testing autonomy scenarios in APEX
 *
 * This module provides comprehensive test helpers for simulating different autonomy levels,
 * approval gates, boundary conditions, and workflow scenarios. It enables thorough testing
 * of autonomous behavior across different permission levels and approval requirements.
 *
 * @example
 * ```typescript
 * import { AutonomyTestHelpers } from './autonomy-test-helpers';
 *
 * const helpers = new AutonomyTestHelpers();
 *
 * // Create a full-auto autonomy config
 * const fullAuto = helpers.createAutonomyConfig('full-auto');
 *
 * // Simulate an approval timeout scenario
 * const timeoutScenario = helpers.simulateApprovalTimeout('before-commit', 30);
 * ```
 */

import {
  AutonomyLevel,
  AutonomyConfig,
  ApprovalGate,
  ApprovalCheckpointType,
  ApprovalRequest,
  ApprovalResponse,
  ApprovalStatus,
  RejectionBehavior,
  TaskResourceLimits,
  AgentAutonomyOverride,
  WorkflowGate,
  WorkflowStage,
} from '../../types';

/**
 * Configuration for creating test autonomy scenarios
 */
export interface TestAutonomyConfig {
  /** Base autonomy level */
  level: AutonomyLevel;
  /** Whether to include approval gates */
  includeGates?: boolean;
  /** Whether to include resource limits */
  includeResourceLimits?: boolean;
  /** Stage-specific autonomy overrides */
  stageOverrides?: Record<string, AutonomyLevel>;
  /** Agent-specific autonomy overrides */
  agentOverrides?: Record<string, AutonomyLevel | AgentAutonomyOverride>;
  /** Rejection behavior */
  rejectionBehavior?: RejectionBehavior;
  /** Global approval timeout in minutes */
  approvalTimeout?: number;
}

/**
 * Configuration for approval flow simulation
 */
export interface ApprovalFlowScenario {
  /** Approval gate configuration */
  gate: ApprovalGate;
  /** Expected approval outcome */
  outcome: 'approved' | 'denied' | 'timeout' | 'expired';
  /** Response time in milliseconds */
  responseTimeMs?: number;
  /** Number of approvers required */
  requiredApprovals?: number;
  /** List of actual approvers */
  approvers?: string[];
}

/**
 * Test scenario for boundary conditions
 */
export interface AutonomyBoundaryScenario {
  /** Current autonomy level */
  autonomyLevel: AutonomyLevel;
  /** Action being attempted */
  action: string;
  /** Whether the action should require approval */
  shouldRequireApproval: boolean;
  /** Expected checkpoint type if approval needed */
  expectedCheckpoint?: ApprovalCheckpointType;
  /** Agent performing the action */
  agent?: string;
  /** Stage in workflow */
  stage?: string;
}

/**
 * Mock approval system for testing autonomy scenarios
 */
export class MockApprovalSystem {
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();
  private approvalResponses: Map<string, ApprovalResponse> = new Map();
  private autoApprovalRules: Map<string, boolean> = new Map();

  /**
   * Create a pending approval request
   */
  createApprovalRequest(request: ApprovalRequest): void {
    this.pendingApprovals.set(request.requestId || request.id, request);
  }

  /**
   * Respond to an approval request
   */
  respondToApproval(requestId: string, response: ApprovalResponse): void {
    this.approvalResponses.set(requestId, response);
    this.pendingApprovals.delete(requestId);
  }

  /**
   * Configure auto-approval for specific gates
   */
  setAutoApproval(gateName: string, autoApprove: boolean): void {
    this.autoApprovalRules.set(gateName, autoApprove);
  }

  /**
   * Check if an approval is pending
   */
  isPending(requestId: string): boolean {
    return this.pendingApprovals.has(requestId);
  }

  /**
   * Get all pending approvals
   */
  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values());
  }

  /**
   * Get approval response for a request
   */
  getApprovalResponse(requestId: string): ApprovalResponse | undefined {
    return this.approvalResponses.get(requestId);
  }

  /**
   * Simulate approval timeout
   */
  simulateTimeout(requestId: string): ApprovalResponse | null {
    const request = this.pendingApprovals.get(requestId);
    if (!request) return null;

    const response: ApprovalResponse = {
      requestId: request.requestId || request.id,
      approvalId: request.id,
      taskId: request.taskId,
      gateName: request.gateName,
      action: 'deny',
      response: 'denied',
      reason: 'Approval timeout exceeded',
      timestamp: new Date(),
      requestedAt: request.requestedAt,
      responseTimeMs: (request.timeoutMinutes || 30) * 60 * 1000,
    };

    this.respondToApproval(requestId, response);
    return response;
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.pendingApprovals.clear();
    this.approvalResponses.clear();
    this.autoApprovalRules.clear();
  }
}

/**
 * Comprehensive test helpers for autonomy level and approval testing
 */
export class AutonomyTestHelpers {
  private mockApprovalSystem = new MockApprovalSystem();

  /**
   * Create a basic autonomy configuration
   */
  createAutonomyConfig(level: AutonomyLevel, config?: Partial<TestAutonomyConfig>): AutonomyConfig {
    const baseConfig: AutonomyConfig = {
      level,
      rejectionBehavior: config?.rejectionBehavior || 'abort',
    };

    if (config?.includeGates) {
      baseConfig.gates = this.createDefaultApprovalGates();
    }

    if (config?.includeResourceLimits) {
      baseConfig.limits = this.createDefaultResourceLimits();
    }

    if (config?.stageOverrides) {
      baseConfig.stageOverrides = config.stageOverrides;
    }

    if (config?.agentOverrides) {
      baseConfig.agentOverrides = config.agentOverrides;
    }

    if (config?.approvalTimeout) {
      baseConfig.approvalTimeout = config.approvalTimeout;
    }

    return baseConfig;
  }

  /**
   * Create default approval gates for testing
   */
  createDefaultApprovalGates(): ApprovalGate[] {
    return [
      {
        id: 'before-commit',
        name: 'Code Review Gate',
        type: 'before-commit',
        description: 'Review code changes before committing',
        required: true,
        autoApprove: false,
        timeout: 30,
      },
      {
        id: 'before-deploy',
        name: 'Deployment Gate',
        type: 'before-deploy',
        description: 'Approve deployment to production',
        required: true,
        autoApprove: false,
        timeout: 60,
        minApprovals: 2,
      },
      {
        id: 'before-destructive',
        name: 'Destructive Operation Gate',
        type: 'before-destructive',
        description: 'Confirm destructive operations',
        required: true,
        autoApprove: false,
        timeout: 15,
      },
    ];
  }

  /**
   * Create default resource limits for testing
   */
  createDefaultResourceLimits(): TaskResourceLimits {
    return {
      maxExecutionTimeMs: 300000, // 5 minutes
      maxMemoryMB: 512,
      maxCpuPercent: 80,
      maxDiskUsageMB: 1024,
      maxNetworkRequestsPerMinute: 100,
    };
  }

  /**
   * Create autonomy configurations for each level
   */
  createAutonomyLevelConfigs(): Record<AutonomyLevel, AutonomyConfig> {
    return {
      'full-auto': this.createAutonomyConfig('full-auto', {
        rejectionBehavior: 'skip',
      }),
      'review-before-commit': this.createAutonomyConfig('review-before-commit', {
        includeGates: true,
        rejectionBehavior: 'abort',
        approvalTimeout: 30,
      }),
      'review-all': this.createAutonomyConfig('review-all', {
        includeGates: true,
        includeResourceLimits: true,
        rejectionBehavior: 'abort',
        approvalTimeout: 15,
      }),
      'supervised': this.createAutonomyConfig('supervised', {
        includeGates: true,
        includeResourceLimits: true,
        rejectionBehavior: 'abort',
        approvalTimeout: 10,
      }),
    };
  }

  /**
   * Simulate an approval flow scenario
   */
  simulateApprovalFlow(scenario: ApprovalFlowScenario): ApprovalResponse {
    const requestId = `test-${Date.now()}`;
    const taskId = `task-${Date.now()}`;

    // Create approval request
    const request: ApprovalRequest = {
      requestId,
      id: requestId,
      taskId,
      gateName: scenario.gate.name,
      gateType: scenario.gate.type,
      description: scenario.gate.description,
      requestedAt: new Date(),
      timeoutMinutes: scenario.gate.timeout,
      minApprovals: scenario.requiredApprovals || scenario.gate.minApprovals || 1,
      approvers: scenario.approvers,
    };

    this.mockApprovalSystem.createApprovalRequest(request);

    // Generate response based on scenario
    const response: ApprovalResponse = {
      requestId,
      approvalId: requestId,
      taskId,
      gateName: scenario.gate.name,
      action: scenario.outcome === 'approved' ? 'approve' : 'deny',
      response: scenario.outcome === 'approved' ? 'approved' : 'denied',
      approver: scenario.outcome === 'timeout' ? 'system' : 'test-user',
      reason: this.getApprovalReason(scenario.outcome),
      timestamp: new Date(),
      requestedAt: request.requestedAt,
      responseTimeMs: scenario.responseTimeMs || 5000,
    };

    this.mockApprovalSystem.respondToApproval(requestId, response);
    return response;
  }

  /**
   * Simulate approval timeout scenario
   */
  simulateApprovalTimeout(gateType: ApprovalCheckpointType, timeoutMinutes: number): ApprovalResponse | null {
    const gate = this.createApprovalGate(`timeout-${gateType}`, `Timeout ${gateType}`, gateType, {
      timeout: timeoutMinutes,
    });

    const requestId = `timeout-${Date.now()}`;
    const request: ApprovalRequest = {
      requestId,
      id: requestId,
      taskId: `task-${Date.now()}`,
      gateName: gate.name,
      gateType: gate.type,
      requestedAt: new Date(Date.now() - timeoutMinutes * 60 * 1000),
      timeoutMinutes,
    };

    this.mockApprovalSystem.createApprovalRequest(request);
    return this.mockApprovalSystem.simulateTimeout(requestId);
  }

  /**
   * Create an approval gate
   */
  createApprovalGate(
    id: string,
    name: string,
    type: ApprovalCheckpointType,
    config?: {
      required?: boolean;
      autoApprove?: boolean;
      timeout?: number;
      minApprovals?: number;
      approvers?: string[];
    }
  ): ApprovalGate {
    return {
      id,
      name,
      type,
      description: `Test approval gate: ${name}`,
      required: config?.required ?? true,
      autoApprove: config?.autoApprove ?? false,
      timeout: config?.timeout,
      minApprovals: config?.minApprovals,
      approvers: config?.approvers,
    };
  }

  /**
   * Create workflow gate for workflow testing
   */
  createWorkflowGate(
    id: string,
    name: string,
    config?: {
      required?: boolean;
      autoApprove?: boolean;
      approvers?: string[];
      timeout?: number;
    }
  ): WorkflowGate {
    return {
      id,
      name,
      description: `Workflow gate: ${name}`,
      required: config?.required ?? true,
      autoApprove: config?.autoApprove ?? false,
      approvers: config?.approvers,
      timeout: config?.timeout,
    };
  }

  /**
   * Test autonomy boundary conditions
   */
  testAutonomyBoundary(scenario: AutonomyBoundaryScenario): {
    requiresApproval: boolean;
    checkpointType: ApprovalCheckpointType | null;
    reason: string;
  } {
    const configs = this.createAutonomyLevelConfigs();
    const config = configs[scenario.autonomyLevel];

    let requiresApproval = false;
    let checkpointType: ApprovalCheckpointType | null = null;
    let reason = '';

    switch (scenario.autonomyLevel) {
      case 'full-auto':
        requiresApproval = false;
        reason = 'Full autonomy - no approval required';
        break;

      case 'review-before-commit':
        requiresApproval = scenario.action.includes('commit') || scenario.action.includes('deploy');
        checkpointType = scenario.action.includes('commit') ? 'before-commit' : 'before-deploy';
        reason = requiresApproval ? 'Commit/deploy actions require approval' : 'Action allowed autonomously';
        break;

      case 'review-all':
        requiresApproval = scenario.shouldRequireApproval;
        checkpointType = scenario.expectedCheckpoint || 'custom';
        reason = 'All major actions require approval';
        break;

      case 'supervised':
        requiresApproval = true;
        checkpointType = scenario.expectedCheckpoint || 'custom';
        reason = 'Supervised mode - all actions require approval';
        break;
    }

    return { requiresApproval, checkpointType, reason };
  }

  /**
   * Create agent autonomy overrides for testing
   */
  createAgentOverrides(): Record<string, AutonomyLevel | AgentAutonomyOverride> {
    return {
      // Simple overrides
      developer: 'review-before-commit',
      tester: 'full-auto',

      // Complex overrides
      reviewer: {
        level: 'supervised',
        approvalTimeout: 45,
        rejectionBehavior: 'skip',
        gates: [this.createApprovalGate('review-gate', 'Code Review', 'custom')],
      },
      devops: {
        level: 'review-before-commit',
        approvalTimeout: 60,
        rejectionBehavior: 'abort',
        gates: [
          this.createApprovalGate('deploy-gate', 'Deployment', 'before-deploy'),
          this.createApprovalGate('destroy-gate', 'Destructive', 'before-destructive'),
        ],
      },
    };
  }

  /**
   * Get the mock approval system for advanced testing
   */
  getMockApprovalSystem(): MockApprovalSystem {
    return this.mockApprovalSystem;
  }

  /**
   * Create test scenarios for common autonomy patterns
   */
  createCommonAutonomyScenarios() {
    return {
      // Scenario 1: Full automation with no gates
      fullAutomation: {
        config: this.createAutonomyConfig('full-auto'),
        expectedBehavior: 'No approval required for any action',
      },

      // Scenario 2: Review before critical actions
      reviewBeforeCommit: {
        config: this.createAutonomyConfig('review-before-commit', {
          includeGates: true,
          rejectionBehavior: 'abort',
        }),
        expectedBehavior: 'Approval required for commits and deployments',
      },

      // Scenario 3: Review all major decisions
      reviewAll: {
        config: this.createAutonomyConfig('review-all', {
          includeGates: true,
          includeResourceLimits: true,
        }),
        expectedBehavior: 'Approval required for all major actions',
      },

      // Scenario 4: Full supervision
      fullSupervision: {
        config: this.createAutonomyConfig('supervised', {
          includeGates: true,
          includeResourceLimits: true,
          approvalTimeout: 10,
        }),
        expectedBehavior: 'Approval required for every action',
      },

      // Scenario 5: Mixed agent autonomy
      mixedAgentAutonomy: {
        config: this.createAutonomyConfig('review-before-commit', {
          agentOverrides: this.createAgentOverrides(),
        }),
        expectedBehavior: 'Different autonomy levels per agent',
      },
    };
  }

  /**
   * Reset all mock state
   */
  reset(): void {
    this.mockApprovalSystem.reset();
  }

  private getApprovalReason(outcome: string): string {
    switch (outcome) {
      case 'approved':
        return 'Approved by test user';
      case 'denied':
        return 'Denied by test user';
      case 'timeout':
        return 'Approval timeout exceeded';
      case 'expired':
        return 'Approval request expired';
      default:
        return 'Unknown approval outcome';
    }
  }
}

/**
 * Pre-configured autonomy test scenarios
 */
export const AutonomyTestScenarios = {
  /**
   * Test all autonomy levels with default configurations
   */
  allAutonomyLevels: (helpers: AutonomyTestHelpers) => {
    return helpers.createAutonomyLevelConfigs();
  },

  /**
   * Test approval flow with various outcomes
   */
  approvalFlows: (helpers: AutonomyTestHelpers) => {
    const gate = helpers.createApprovalGate('test-gate', 'Test Gate', 'before-commit');

    return {
      approved: helpers.simulateApprovalFlow({
        gate,
        outcome: 'approved',
        responseTimeMs: 3000,
      }),
      denied: helpers.simulateApprovalFlow({
        gate,
        outcome: 'denied',
        responseTimeMs: 5000,
      }),
      timeout: helpers.simulateApprovalTimeout('before-commit', 30),
    };
  },

  /**
   * Test boundary conditions for each autonomy level
   */
  boundaryConditions: (helpers: AutonomyTestHelpers) => {
    const scenarios: AutonomyBoundaryScenario[] = [
      {
        autonomyLevel: 'full-auto',
        action: 'write-file',
        shouldRequireApproval: false,
      },
      {
        autonomyLevel: 'review-before-commit',
        action: 'git-commit',
        shouldRequireApproval: true,
        expectedCheckpoint: 'before-commit',
      },
      {
        autonomyLevel: 'review-all',
        action: 'any-action',
        shouldRequireApproval: true,
        expectedCheckpoint: 'custom',
      },
      {
        autonomyLevel: 'supervised',
        action: 'simple-read',
        shouldRequireApproval: true,
        expectedCheckpoint: 'custom',
      },
    ];

    return scenarios.map(scenario => ({
      scenario,
      result: helpers.testAutonomyBoundary(scenario),
    }));
  },
};

/**
 * Export singleton instance for convenience
 */
export const autonomyTestHelpers = new AutonomyTestHelpers();