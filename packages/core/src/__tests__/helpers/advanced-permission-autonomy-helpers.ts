/**
 * @fileoverview Advanced Permission and Autonomy Test Helpers - Extended scenarios for edge cases
 *
 * This module provides additional test helpers that complement the existing permission-test-helpers
 * and autonomy-test-helpers with more specialized scenarios including time-based permissions,
 * cascade failures, conditional approvals, and complex workflow simulations.
 *
 * @example
 * ```typescript
 * import { AdvancedPermissionAutonomyHelpers } from './advanced-permission-autonomy-helpers';
 *
 * const helpers = new AdvancedPermissionAutonomyHelpers();
 *
 * // Test time-based permission expiry
 * const timeBasedScenario = helpers.createTimeBasedPermissionScenario('Write', 30);
 *
 * // Test conditional approval chains
 * const conditionalApprovals = helpers.testConditionalApprovalChain([...conditions]);
 * ```
 */

import {
  Permission,
  PermissionLevel,
  AutonomyLevel,
  AutonomyConfig,
  ApprovalGate,
  ApprovalCheckpointType,
  ApprovalRequest,
  ApprovalResponse,
  RejectionBehavior,
  TaskResourceLimits,
  AgentAutonomyOverride,
  ToolPermissionResult,
} from '../../types';

import { PermissionTestHelpers, AutonomyTestHelpers } from './index';

/**
 * Configuration for time-based permission scenarios
 */
export interface TimeBasedPermissionScenario {
  /** Tool for the permission */
  tool: string;
  /** Permission scope */
  scope?: string;
  /** Duration in minutes before expiry */
  durationMinutes: number;
  /** Whether the permission should auto-renew */
  autoRenew?: boolean;
  /** Grace period after expiry in minutes */
  gracePeriodMinutes?: number;
  /** Action to take on expiry */
  expiryAction: 'deny' | 'request-renewal' | 'downgrade';
}

/**
 * Configuration for conditional approval scenarios
 */
export interface ConditionalApprovalScenario {
  /** Conditions that must be met */
  conditions: Array<{
    type: 'time-window' | 'approver-availability' | 'system-health' | 'workload' | 'custom';
    criteria: any;
    required: boolean;
    weight?: number;
  }>;
  /** Fallback actions if conditions not met */
  fallbackActions: Array<{
    action: 'escalate' | 'delay' | 'alternative-approver' | 'auto-deny';
    parameters?: any;
  }>;
}

/**
 * Configuration for cascade failure scenarios
 */
export interface CascadeFailureScenario {
  /** Initial failure point */
  initialFailure: {
    type: 'permission-denied' | 'approval-timeout' | 'resource-limit' | 'system-error';
    details: any;
  };
  /** Dependent systems that might fail */
  dependentSystems: Array<{
    system: string;
    failureProbability: number;
    impactLevel: 'low' | 'medium' | 'high' | 'critical';
    recoveryTimeMinutes?: number;
  }>;
  /** Circuit breaker configuration */
  circuitBreaker?: {
    enabled: boolean;
    failureThreshold: number;
    timeoutMs: number;
    recoveryTimeMs: number;
  };
}

/**
 * Configuration for workload-based autonomy scenarios
 */
export interface WorkloadBasedAutonomyScenario {
  /** Current system workload */
  systemWorkload: {
    cpuUtilization: number;
    memoryUtilization: number;
    activeTasksCount: number;
    queuedTasksCount: number;
  };
  /** Workload thresholds for autonomy adjustment */
  workloadThresholds: {
    high: { cpu: number; memory: number; tasks: number };
    critical: { cpu: number; memory: number; tasks: number };
  };
  /** Autonomy degradation rules */
  degradationRules: Array<{
    threshold: 'high' | 'critical';
    targetAutonomyLevel: AutonomyLevel;
    additionalGates: ApprovalCheckpointType[];
    resourceLimitReduction?: number; // Percentage reduction
  }>;
}

/**
 * Configuration for multi-tenancy permission scenarios
 */
export interface MultiTenancyPermissionScenario {
  /** Tenant information */
  tenants: Array<{
    id: string;
    name: string;
    tier: 'free' | 'pro' | 'enterprise';
    resourceQuota: Partial<TaskResourceLimits>;
    permissionLevel: 'restricted' | 'standard' | 'elevated';
  }>;
  /** Cross-tenant access rules */
  crossTenantRules: Array<{
    sourceTenant: string;
    targetTenant: string;
    allowedActions: string[];
    requiresApproval: boolean;
    approvers?: string[];
  }>;
}

/**
 * Advanced test helpers for complex permission and autonomy scenarios
 */
export class AdvancedPermissionAutonomyHelpers {
  private permissionHelpers = new PermissionTestHelpers();
  private autonomyHelpers = new AutonomyTestHelpers();

  /**
   * Create a time-based permission scenario with expiry and renewal
   */
  createTimeBasedPermissionScenario(
    tool: string,
    durationMinutes: number,
    config?: Partial<TimeBasedPermissionScenario>
  ): {
    permission: Permission;
    initialCheck: ToolPermissionResult;
    nearExpiryCheck: ToolPermissionResult;
    expiredCheck: ToolPermissionResult;
    renewalRequest?: ApprovalRequest;
  } {
    const now = new Date();
    const expiryTime = new Date(now.getTime() + durationMinutes * 60 * 1000);
    const nearExpiryTime = new Date(expiryTime.getTime() - 5 * 60 * 1000); // 5 minutes before
    const postExpiryTime = new Date(expiryTime.getTime() + 1 * 60 * 1000); // 1 minute after

    // Create time-based permission
    const permission = this.permissionHelpers.createPermission(tool, 'allow-once', {
      scope: config?.scope,
      expiry: expiryTime,
    });

    // Simulate checks at different times
    const initialCheck = this.permissionHelpers.simulatePermissionApproval(tool, config?.scope);

    const nearExpiryCheck: ToolPermissionResult = {
      allowed: true,
      level: 'allow-once',
      requiresConfirmation: true,
      reason: 'Permission expires soon - confirmation required',
      consumed: false,
    };

    let expiredCheck: ToolPermissionResult;
    let renewalRequest: ApprovalRequest | undefined;

    if (config?.expiryAction === 'request-renewal') {
      expiredCheck = {
        allowed: false,
        level: null,
        requiresConfirmation: true,
        reason: 'Permission expired - renewal required',
        consumed: false,
      };

      renewalRequest = {
        requestId: `renewal-${Date.now()}`,
        id: `renewal-${Date.now()}`,
        taskId: `task-${Date.now()}`,
        gateName: 'Permission Renewal',
        gateType: 'custom',
        description: `Renew ${tool} permission for ${config?.scope || 'all scopes'}`,
        requestedAt: postExpiryTime,
        timeoutMinutes: 30,
        priority: 'normal',
      };
    } else if (config?.expiryAction === 'downgrade') {
      expiredCheck = {
        allowed: true,
        level: 'allow-always', // Downgrade to basic permission
        requiresConfirmation: true,
        reason: 'Permission expired - downgraded to basic level',
        consumed: false,
      };
    } else {
      expiredCheck = this.permissionHelpers.simulatePermissionDenial(
        tool,
        config?.scope,
        'Permission expired'
      );
    }

    return {
      permission,
      initialCheck,
      nearExpiryCheck,
      expiredCheck,
      renewalRequest,
    };
  }

  /**
   * Test conditional approval chains with complex decision trees
   */
  testConditionalApprovalChain(scenario: ConditionalApprovalScenario): {
    conditionResults: Array<{
      condition: any;
      met: boolean;
      weight: number;
      reason: string;
    }>;
    overallScore: number;
    approvalDecision: 'approved' | 'denied' | 'conditional' | 'escalated';
    fallbacksTriggered: Array<{
      fallback: any;
      executed: boolean;
      result?: any;
    }>;
    finalApprovalGate?: ApprovalGate;
  } {
    const conditionResults = scenario.conditions.map(condition => {
      let met = false;
      let reason = '';

      switch (condition.type) {
        case 'time-window':
          const now = new Date();
          const inWindow = condition.criteria.start <= now && now <= condition.criteria.end;
          met = inWindow;
          reason = inWindow ? 'Within approved time window' : 'Outside approved time window';
          break;

        case 'approver-availability':
          met = Math.random() > 0.3; // 70% availability simulation
          reason = met ? 'Approver available' : 'Approver unavailable';
          break;

        case 'system-health':
          const healthScore = Math.random() * 100;
          met = healthScore >= condition.criteria.minHealthScore;
          reason = `System health score: ${healthScore.toFixed(1)}`;
          break;

        case 'workload':
          const currentLoad = Math.random() * 100;
          met = currentLoad <= condition.criteria.maxWorkloadPercent;
          reason = `Current workload: ${currentLoad.toFixed(1)}%`;
          break;

        case 'custom':
          met = condition.criteria.mockResult ?? false;
          reason = condition.criteria.reason ?? 'Custom condition evaluation';
          break;
      }

      return {
        condition,
        met,
        weight: condition.weight ?? 1,
        reason,
      };
    });

    // Calculate overall score
    const totalWeight = conditionResults.reduce((sum, result) => sum + result.weight, 0);
    const weightedScore = conditionResults.reduce(
      (sum, result) => sum + (result.met ? result.weight : 0),
      0
    );
    const overallScore = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;

    // Determine approval decision
    let approvalDecision: 'approved' | 'denied' | 'conditional' | 'escalated';
    if (overallScore >= 90) {
      approvalDecision = 'approved';
    } else if (overallScore >= 70) {
      approvalDecision = 'conditional';
    } else if (overallScore >= 50) {
      approvalDecision = 'escalated';
    } else {
      approvalDecision = 'denied';
    }

    // Execute fallback actions if needed
    const fallbacksTriggered = scenario.fallbackActions.map(fallback => {
      let executed = false;
      let result: any;

      if (approvalDecision === 'denied' || approvalDecision === 'escalated') {
        executed = true;

        switch (fallback.action) {
          case 'escalate':
            result = {
              escalationLevel: fallback.parameters?.level ?? 'supervisor',
              newTimeout: fallback.parameters?.timeoutMinutes ?? 60,
            };
            break;

          case 'delay':
            result = {
              delayMinutes: fallback.parameters?.delayMinutes ?? 30,
              retryAfter: new Date(Date.now() + (fallback.parameters?.delayMinutes ?? 30) * 60 * 1000),
            };
            break;

          case 'alternative-approver':
            result = {
              alternativeApprovers: fallback.parameters?.approvers ?? ['backup-approver'],
              requiredApprovals: fallback.parameters?.requiredApprovals ?? 1,
            };
            break;

          case 'auto-deny':
            result = {
              denied: true,
              reason: fallback.parameters?.reason ?? 'Conditions not met for approval',
            };
            break;
        }
      }

      return {
        fallback,
        executed,
        result,
      };
    });

    // Create approval gate if needed
    let finalApprovalGate: ApprovalGate | undefined;
    if (approvalDecision === 'conditional' || approvalDecision === 'escalated') {
      finalApprovalGate = this.autonomyHelpers.createApprovalGate(
        'conditional-approval',
        'Conditional Approval Gate',
        'custom',
        {
          timeout: 60,
          minApprovals: approvalDecision === 'escalated' ? 2 : 1,
          approvers: approvalDecision === 'escalated' ? ['senior-approver', 'tech-lead'] : ['approver'],
        }
      );
    }

    return {
      conditionResults,
      overallScore,
      approvalDecision,
      fallbacksTriggered,
      finalApprovalGate,
    };
  }

  /**
   * Simulate cascade failures and system degradation
   */
  simulateCascadeFailure(scenario: CascadeFailureScenario): {
    initialFailure: {
      type: string;
      timestamp: Date;
      impact: string;
    };
    cascadeSteps: Array<{
      step: number;
      system: string;
      failed: boolean;
      impactLevel: string;
      recoveryEstimate?: Date;
    }>;
    systemRecovery: {
      totalFailures: number;
      criticalSystemsAffected: number;
      estimatedRecoveryTime: number;
      circuitBreakerTriggered: boolean;
    };
    mitigationActions: Array<{
      action: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      estimatedTime: number;
    }>;
  } {
    const now = new Date();

    // Initial failure
    const initialFailure = {
      type: scenario.initialFailure.type,
      timestamp: now,
      impact: this.getFailureImpactDescription(scenario.initialFailure.type),
    };

    // Simulate cascade through dependent systems
    const cascadeSteps = scenario.dependentSystems.map((system, index) => {
      const failed = Math.random() < system.failureProbability;
      const recoveryEstimate = failed && system.recoveryTimeMinutes
        ? new Date(now.getTime() + system.recoveryTimeMinutes * 60 * 1000)
        : undefined;

      return {
        step: index + 1,
        system: system.system,
        failed,
        impactLevel: system.impactLevel,
        recoveryEstimate,
      };
    });

    // Calculate system recovery metrics
    const totalFailures = cascadeSteps.filter(step => step.failed).length + 1; // +1 for initial
    const criticalSystemsAffected = cascadeSteps.filter(
      step => step.failed && step.impactLevel === 'critical'
    ).length;

    const maxRecoveryTime = Math.max(
      ...cascadeSteps
        .filter(step => step.failed && step.recoveryEstimate)
        .map(step => step.recoveryEstimate!.getTime() - now.getTime())
    );

    const estimatedRecoveryTime = maxRecoveryTime > 0 ? maxRecoveryTime / (60 * 1000) : 0; // Minutes

    // Circuit breaker logic
    const circuitBreakerTriggered = scenario.circuitBreaker?.enabled &&
      totalFailures >= (scenario.circuitBreaker.failureThreshold ?? 3);

    // Generate mitigation actions
    const mitigationActions = [
      {
        action: 'Enable fallback systems',
        priority: 'high' as const,
        estimatedTime: 15,
      },
      {
        action: 'Isolate failed components',
        priority: 'critical' as const,
        estimatedTime: 5,
      },
      {
        action: 'Notify stakeholders',
        priority: 'medium' as const,
        estimatedTime: 10,
      },
    ];

    if (criticalSystemsAffected > 0) {
      mitigationActions.push({
        action: 'Emergency escalation to on-call team',
        priority: 'critical',
        estimatedTime: 2,
      });
    }

    if (circuitBreakerTriggered) {
      mitigationActions.push({
        action: 'Circuit breaker activated - degraded mode',
        priority: 'high',
        estimatedTime: 1,
      });
    }

    return {
      initialFailure,
      cascadeSteps,
      systemRecovery: {
        totalFailures,
        criticalSystemsAffected,
        estimatedRecoveryTime,
        circuitBreakerTriggered,
      },
      mitigationActions,
    };
  }

  /**
   * Test workload-based autonomy adjustment
   */
  testWorkloadBasedAutonomyAdjustment(scenario: WorkloadBasedAutonomyScenario): {
    currentWorkload: any;
    thresholdEvaluation: {
      exceededHigh: boolean;
      exceededCritical: boolean;
      triggeringFactors: string[];
    };
    autonomyAdjustments: Array<{
      rule: any;
      applied: boolean;
      newAutonomyLevel: AutonomyLevel;
      additionalGates: ApprovalGate[];
      resourceLimitsAdjusted: boolean;
    }>;
    recommendedActions: Array<{
      action: string;
      urgency: 'low' | 'medium' | 'high' | 'immediate';
      impact: string;
    }>;
  } {
    const { systemWorkload, workloadThresholds, degradationRules } = scenario;

    // Evaluate thresholds
    const exceededHigh = systemWorkload.cpuUtilization >= workloadThresholds.high.cpu ||
                        systemWorkload.memoryUtilization >= workloadThresholds.high.memory ||
                        (systemWorkload.activeTasksCount + systemWorkload.queuedTasksCount) >= workloadThresholds.high.tasks;

    const exceededCritical = systemWorkload.cpuUtilization >= workloadThresholds.critical.cpu ||
                           systemWorkload.memoryUtilization >= workloadThresholds.critical.memory ||
                           (systemWorkload.activeTasksCount + systemWorkload.queuedTasksCount) >= workloadThresholds.critical.tasks;

    const triggeringFactors: string[] = [];
    if (systemWorkload.cpuUtilization >= workloadThresholds.high.cpu) {
      triggeringFactors.push(`High CPU utilization: ${systemWorkload.cpuUtilization}%`);
    }
    if (systemWorkload.memoryUtilization >= workloadThresholds.high.memory) {
      triggeringFactors.push(`High memory utilization: ${systemWorkload.memoryUtilization}%`);
    }
    if ((systemWorkload.activeTasksCount + systemWorkload.queuedTasksCount) >= workloadThresholds.high.tasks) {
      triggeringFactors.push(`High task load: ${systemWorkload.activeTasksCount + systemWorkload.queuedTasksCount} tasks`);
    }

    // Apply degradation rules
    const autonomyAdjustments = degradationRules.map(rule => {
      const applied = (rule.threshold === 'high' && exceededHigh) ||
                     (rule.threshold === 'critical' && exceededCritical);

      let additionalGates: ApprovalGate[] = [];
      if (applied) {
        additionalGates = rule.additionalGates.map(gateType =>
          this.autonomyHelpers.createApprovalGate(
            `workload-${gateType}`,
            `Workload-triggered ${gateType}`,
            gateType,
            {
              timeout: 15, // Shorter timeout during high load
              required: true,
            }
          )
        );
      }

      return {
        rule,
        applied,
        newAutonomyLevel: rule.targetAutonomyLevel,
        additionalGates,
        resourceLimitsAdjusted: applied && !!rule.resourceLimitReduction,
      };
    });

    // Generate recommended actions
    const recommendedActions: Array<{
      action: string;
      urgency: 'low' | 'medium' | 'high' | 'immediate';
      impact: string;
    }> = [];

    if (exceededCritical) {
      recommendedActions.push({
        action: 'Activate emergency load shedding',
        urgency: 'immediate',
        impact: 'Temporary service degradation to prevent system failure',
      });
      recommendedActions.push({
        action: 'Scale up infrastructure immediately',
        urgency: 'immediate',
        impact: 'Increased capacity to handle load',
      });
    } else if (exceededHigh) {
      recommendedActions.push({
        action: 'Increase approval gates for non-critical operations',
        urgency: 'high',
        impact: 'Reduced autonomous actions to free up resources',
      });
      recommendedActions.push({
        action: 'Consider scaling up infrastructure',
        urgency: 'medium',
        impact: 'Proactive capacity increase',
      });
    }

    if (systemWorkload.queuedTasksCount > systemWorkload.activeTasksCount * 2) {
      recommendedActions.push({
        action: 'Optimize task scheduling and prioritization',
        urgency: 'medium',
        impact: 'Improved task throughput',
      });
    }

    return {
      currentWorkload: systemWorkload,
      thresholdEvaluation: {
        exceededHigh,
        exceededCritical,
        triggeringFactors,
      },
      autonomyAdjustments,
      recommendedActions,
    };
  }

  /**
   * Test multi-tenancy permission scenarios
   */
  testMultiTenancyPermissionScenario(scenario: MultiTenancyPermissionScenario): {
    tenantIsolationTest: Array<{
      tenant: any;
      isolationMaintained: boolean;
      crossTenantAttempts: Array<{
        targetTenant: string;
        action: string;
        allowed: boolean;
        reason: string;
      }>;
    }>;
    resourceQuotaEnforcement: Array<{
      tenant: any;
      withinQuota: boolean;
      utilizationPercentage: Record<string, number>;
      actionsRequired: string[];
    }>;
    crossTenantAccessResults: Array<{
      rule: any;
      testResult: {
        accessGranted: boolean;
        approvalRequired: boolean;
        approvers?: string[];
      };
    }>;
  } {
    const { tenants, crossTenantRules } = scenario;

    // Test tenant isolation
    const tenantIsolationTest = tenants.map(tenant => {
      const crossTenantAttempts = tenants
        .filter(t => t.id !== tenant.id)
        .map(targetTenant => {
          const action = 'read-data';
          const rule = crossTenantRules.find(r =>
            r.sourceTenant === tenant.id && r.targetTenant === targetTenant.id
          );

          let allowed = false;
          let reason = 'No cross-tenant rule defined';

          if (rule) {
            allowed = rule.allowedActions.includes(action);
            reason = allowed ? 'Cross-tenant access allowed by rule' : 'Action not in allowed list';
          } else if (tenant.tier === 'enterprise' && targetTenant.tier === 'enterprise') {
            allowed = true;
            reason = 'Enterprise tier cross-access';
          }

          return {
            targetTenant: targetTenant.id,
            action,
            allowed,
            reason,
          };
        });

      const isolationMaintained = crossTenantAttempts.every(attempt =>
        !attempt.allowed || crossTenantRules.some(rule =>
          rule.sourceTenant === tenant.id && rule.targetTenant === attempt.targetTenant
        )
      );

      return {
        tenant,
        isolationMaintained,
        crossTenantAttempts,
      };
    });

    // Test resource quota enforcement
    const resourceQuotaEnforcement = tenants.map(tenant => {
      const currentUsage = {
        maxExecutionTimeMs: Math.random() * (tenant.resourceQuota.maxExecutionTimeMs ?? 300000),
        maxMemoryMB: Math.random() * (tenant.resourceQuota.maxMemoryMB ?? 512),
        maxCpuPercent: Math.random() * (tenant.resourceQuota.maxCpuPercent ?? 80),
      };

      const utilizationPercentage: Record<string, number> = {};
      let withinQuota = true;
      const actionsRequired: string[] = [];

      Object.entries(currentUsage).forEach(([key, value]) => {
        const quotaValue = (tenant.resourceQuota as any)[key];
        if (quotaValue) {
          const utilization = (value / quotaValue) * 100;
          utilizationPercentage[key] = utilization;

          if (utilization > 100) {
            withinQuota = false;
            actionsRequired.push(`Reduce ${key} usage`);
          } else if (utilization > 90) {
            actionsRequired.push(`Monitor ${key} usage closely`);
          }
        }
      });

      if (!withinQuota && tenant.tier === 'free') {
        actionsRequired.push('Consider upgrading to higher tier');
      }

      return {
        tenant,
        withinQuota,
        utilizationPercentage,
        actionsRequired,
      };
    });

    // Test cross-tenant access rules
    const crossTenantAccessResults = crossTenantRules.map(rule => {
      const sourceTenant = tenants.find(t => t.id === rule.sourceTenant);
      const targetTenant = tenants.find(t => t.id === rule.targetTenant);

      let accessGranted = false;
      let approvalRequired = rule.requiresApproval;
      let approvers = rule.approvers;

      if (sourceTenant && targetTenant) {
        // Basic access check based on tenant tiers and permission levels
        const sourcePermLevel = sourceTenant.permissionLevel;
        const targetPermLevel = targetTenant.permissionLevel;

        if (sourcePermLevel === 'elevated' || targetPermLevel !== 'restricted') {
          accessGranted = !rule.requiresApproval;
        }

        // If approval is required but no approvers specified, use defaults
        if (approvalRequired && !approvers) {
          approvers = [`${targetTenant.id}-admin`, 'security-team'];
        }
      }

      return {
        rule,
        testResult: {
          accessGranted,
          approvalRequired,
          approvers,
        },
      };
    });

    return {
      tenantIsolationTest,
      resourceQuotaEnforcement,
      crossTenantAccessResults,
    };
  }

  /**
   * Reset all test state
   */
  reset(): void {
    this.permissionHelpers.reset();
    this.autonomyHelpers.reset();
  }

  private getFailureImpactDescription(failureType: string): string {
    switch (failureType) {
      case 'permission-denied':
        return 'Access control failure - operations blocked';
      case 'approval-timeout':
        return 'Approval workflow disruption - delayed operations';
      case 'resource-limit':
        return 'Resource exhaustion - performance degradation';
      case 'system-error':
        return 'System malfunction - unpredictable behavior';
      default:
        return 'Unknown failure impact';
    }
  }
}

/**
 * Advanced test scenarios for complex edge cases
 */
export const AdvancedTestScenarios = {
  /**
   * Scenario: Time-based permissions with auto-renewal
   */
  timeBasedPermissionWithRenewal: (helpers: AdvancedPermissionAutonomyHelpers) => {
    return helpers.createTimeBasedPermissionScenario('Write', 60, {
      scope: '/tmp/*',
      autoRenew: true,
      gracePeriodMinutes: 15,
      expiryAction: 'request-renewal',
    });
  },

  /**
   * Scenario: Conditional approvals based on system state
   */
  conditionalApprovalBasedOnSystemState: (helpers: AdvancedPermissionAutonomyHelpers) => {
    return helpers.testConditionalApprovalChain({
      conditions: [
        {
          type: 'time-window',
          criteria: {
            start: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            end: new Date(Date.now() + 2 * 60 * 60 * 1000),   // 2 hours from now
          },
          required: true,
          weight: 2,
        },
        {
          type: 'system-health',
          criteria: { minHealthScore: 80 },
          required: true,
          weight: 3,
        },
        {
          type: 'workload',
          criteria: { maxWorkloadPercent: 75 },
          required: false,
          weight: 1,
        },
      ],
      fallbackActions: [
        {
          action: 'delay',
          parameters: { delayMinutes: 30 },
        },
        {
          action: 'alternative-approver',
          parameters: { approvers: ['emergency-approver'] },
        },
      ],
    });
  },

  /**
   * Scenario: Cascade failure with circuit breaker
   */
  cascadeFailureWithCircuitBreaker: (helpers: AdvancedPermissionAutonomyHelpers) => {
    return helpers.simulateCascadeFailure({
      initialFailure: {
        type: 'approval-timeout',
        details: { gateName: 'critical-gate', timeoutMinutes: 30 },
      },
      dependentSystems: [
        {
          system: 'permission-service',
          failureProbability: 0.4,
          impactLevel: 'high',
          recoveryTimeMinutes: 20,
        },
        {
          system: 'approval-service',
          failureProbability: 0.6,
          impactLevel: 'critical',
          recoveryTimeMinutes: 45,
        },
        {
          system: 'notification-service',
          failureProbability: 0.2,
          impactLevel: 'low',
          recoveryTimeMinutes: 10,
        },
      ],
      circuitBreaker: {
        enabled: true,
        failureThreshold: 2,
        timeoutMs: 30000,
        recoveryTimeMs: 300000,
      },
    });
  },

  /**
   * Scenario: Workload-based autonomy degradation
   */
  workloadBasedAutonomyDegradation: (helpers: AdvancedPermissionAutonomyHelpers) => {
    return helpers.testWorkloadBasedAutonomyAdjustment({
      systemWorkload: {
        cpuUtilization: 85,
        memoryUtilization: 78,
        activeTasksCount: 25,
        queuedTasksCount: 40,
      },
      workloadThresholds: {
        high: { cpu: 80, memory: 75, tasks: 50 },
        critical: { cpu: 95, memory: 90, tasks: 100 },
      },
      degradationRules: [
        {
          threshold: 'high',
          targetAutonomyLevel: 'review-before-commit',
          additionalGates: ['before-commit', 'before-deploy'],
          resourceLimitReduction: 25,
        },
        {
          threshold: 'critical',
          targetAutonomyLevel: 'supervised',
          additionalGates: ['before-destructive', 'custom'],
          resourceLimitReduction: 50,
        },
      ],
    });
  },

  /**
   * Scenario: Multi-tenancy with complex cross-tenant rules
   */
  multiTenancyComplexCrossTenant: (helpers: AdvancedPermissionAutonomyHelpers) => {
    return helpers.testMultiTenancyPermissionScenario({
      tenants: [
        {
          id: 'tenant-a',
          name: 'Free Tenant',
          tier: 'free',
          resourceQuota: {
            maxExecutionTimeMs: 120000,
            maxMemoryMB: 256,
            maxCpuPercent: 50,
          },
          permissionLevel: 'restricted',
        },
        {
          id: 'tenant-b',
          name: 'Pro Tenant',
          tier: 'pro',
          resourceQuota: {
            maxExecutionTimeMs: 600000,
            maxMemoryMB: 1024,
            maxCpuPercent: 80,
          },
          permissionLevel: 'standard',
        },
        {
          id: 'tenant-c',
          name: 'Enterprise Tenant',
          tier: 'enterprise',
          resourceQuota: {
            maxExecutionTimeMs: 1800000,
            maxMemoryMB: 4096,
            maxCpuPercent: 100,
          },
          permissionLevel: 'elevated',
        },
      ],
      crossTenantRules: [
        {
          sourceTenant: 'tenant-c',
          targetTenant: 'tenant-b',
          allowedActions: ['read-data', 'write-shared'],
          requiresApproval: false,
        },
        {
          sourceTenant: 'tenant-b',
          targetTenant: 'tenant-a',
          allowedActions: ['read-data'],
          requiresApproval: true,
          approvers: ['tenant-a-admin'],
        },
      ],
    });
  },
};

/**
 * Export singleton instance for convenience
 */
export const advancedPermissionAutonomyHelpers = new AdvancedPermissionAutonomyHelpers();