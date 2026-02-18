/**
 * @fileoverview Permission and Autonomy Integration Examples - Demonstrates usage of test helpers
 *
 * This file provides practical examples and integration patterns for using the existing
 * permission and autonomy test helpers to create comprehensive test scenarios.
 */

import {
  PermissionTestHelpers,
  AutonomyTestHelpers,
  ApexTestHelpers,
  AdvancedPermissionAutonomyHelpers,
  PermissionTestScenarios,
  AutonomyTestScenarios,
} from './index';

import type {
  AutonomyLevel,
  PermissionLevel,
  ApprovalCheckpointType,
  ToolPermissionResult,
  ApprovalResponse,
  RejectionBehavior,
} from '../../types';

/**
 * Integration examples demonstrating common test patterns
 */
export class PermissionAutonomyIntegrationExamples {
  private apexHelpers = new ApexTestHelpers();
  private advancedHelpers = new AdvancedPermissionAutonomyHelpers();

  /**
   * Example: Test permission denial across all autonomy levels
   */
  testPermissionDenialAcrossAutonomyLevels(tool: string, scope?: string): Array<{
    autonomyLevel: AutonomyLevel;
    permissionResult: ToolPermissionResult;
    workflowContinues: boolean;
    expectedBehavior: string;
  }> {
    const autonomyLevels: AutonomyLevel[] = ['full-auto', 'review-before-commit', 'review-all', 'supervised'];

    return autonomyLevels.map(level => {
      const result = this.apexHelpers.testPermissionDenialWithAutonomyLevel(level, tool, scope);

      return {
        autonomyLevel: level,
        permissionResult: result.permissionDenial,
        workflowContinues: result.workflowContinues,
        expectedBehavior: result.reason,
      };
    });
  }

  /**
   * Example: Test approval timeout scenarios with different rejection behaviors
   */
  testApprovalTimeoutWithRejectionBehaviors(timeoutMinutes: number): Array<{
    rejectionBehavior: RejectionBehavior;
    result: {
      timeoutResponse: ApprovalResponse;
      workflowContinues: boolean;
      nextAction: string;
      escalationTriggered: boolean;
    };
  }> {
    const behaviors: RejectionBehavior[] = ['abort', 'skip'];

    return behaviors.map(behavior => {
      const timeoutResult = this.advancedHelpers.testApprovalTimeoutWithBehavior(
        timeoutMinutes,
        behavior,
        { isCriticalGate: false, hasRetryPolicy: true }
      );

      return {
        rejectionBehavior: behavior,
        result: {
          timeoutResponse: timeoutResult.timeoutResponse,
          workflowContinues: timeoutResult.workflowEffect.workflowContinues,
          nextAction: timeoutResult.workflowEffect.nextAction,
          escalationTriggered: timeoutResult.escalationTriggered,
        },
      };
    });
  }

  /**
   * Example: Test dangerous operation handling across autonomy levels
   */
  testDangerousOperationHandling(
    operation: string,
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): Array<{
    autonomyLevel: AutonomyLevel;
    riskAssessment: any;
    permissionResult: ToolPermissionResult;
    approvalRequired: boolean;
    workflowOutcome: string;
  }> {
    const autonomyLevels: AutonomyLevel[] = ['full-auto', 'review-before-commit', 'review-all', 'supervised'];

    return autonomyLevels.map(level => {
      const dangerousOpResult = this.apexHelpers.permission.testDangerousOperationDenial(
        operation,
        riskLevel,
        {
          productionSystem: true,
          reversible: riskLevel !== 'critical',
          requiresBackup: riskLevel === 'high' || riskLevel === 'critical',
        }
      );

      let approvalRequired: boolean;
      let workflowOutcome: string;

      switch (level) {
        case 'full-auto':
          approvalRequired = riskLevel === 'critical';
          workflowOutcome = riskLevel === 'critical' ? 'blocked' : 'allowed';
          break;
        case 'review-before-commit':
          approvalRequired = riskLevel !== 'low';
          workflowOutcome = riskLevel === 'critical' ? 'escalated' : 'requires-approval';
          break;
        case 'review-all':
        case 'supervised':
          approvalRequired = true;
          workflowOutcome = riskLevel === 'critical' ? 'blocked' : 'requires-approval';
          break;
      }

      return {
        autonomyLevel: level,
        riskAssessment: dangerousOpResult.riskAssessment,
        permissionResult: dangerousOpResult.permissionResult,
        approvalRequired,
        workflowOutcome,
      };
    });
  }

  /**
   * Example: Test resource limit interactions with permissions
   */
  testResourceLimitPermissionInteraction(
    currentUsage: { maxExecutionTimeMs: number; maxMemoryMB: number; maxCpuPercent: number },
    limits: { maxExecutionTimeMs: number; maxMemoryMB: number; maxCpuPercent: number }
  ): Array<{
    autonomyLevel: AutonomyLevel;
    withinLimits: boolean;
    recommendedAction: string;
    permissionRequired: boolean;
    workflowAction: string;
  }> {
    return this.apexHelpers.testResourceLimitBoundaryWithAutonomyLevels(currentUsage, limits);
  }

  /**
   * Example: Test time-based permission expiry scenarios
   */
  testTimeBasedPermissionScenarios(tool: string, durationMinutes: number): {
    scenario: any;
    testResults: Array<{
      checkPoint: string;
      result: ToolPermissionResult;
      timestamp: Date;
      renewalRequired: boolean;
    }>;
  } {
    const scenario = this.advancedHelpers.createTimeBasedPermissionScenario(tool, durationMinutes, {
      expiryAction: 'request-renewal',
      autoRenew: false,
      gracePeriodMinutes: 5,
    });

    const testResults = [
      {
        checkPoint: 'initial',
        result: scenario.initialCheck,
        timestamp: new Date(),
        renewalRequired: false,
      },
      {
        checkPoint: 'near-expiry',
        result: scenario.nearExpiryCheck,
        timestamp: new Date(Date.now() + (durationMinutes - 5) * 60 * 1000),
        renewalRequired: true,
      },
      {
        checkPoint: 'expired',
        result: scenario.expiredCheck,
        timestamp: new Date(Date.now() + (durationMinutes + 1) * 60 * 1000),
        renewalRequired: true,
      },
    ];

    return {
      scenario,
      testResults,
    };
  }

  /**
   * Example: Test cascade failure scenarios
   */
  testCascadeFailureScenarios(): {
    scenario: any;
    mitigationPlan: Array<{
      action: string;
      priority: string;
      estimatedTime: number;
      triggered: boolean;
    }>;
    systemRecovery: {
      totalFailures: number;
      criticalSystemsAffected: number;
      estimatedRecoveryTime: number;
      circuitBreakerTriggered: boolean;
    };
  } {
    const scenario = this.advancedHelpers.simulateCascadeFailure({
      initialFailure: {
        type: 'permission-denied',
        details: { tool: 'Write', scope: '/critical/system/file' },
      },
      dependentSystems: [
        {
          system: 'auth-service',
          failureProbability: 0.3,
          impactLevel: 'high',
          recoveryTimeMinutes: 15,
        },
        {
          system: 'file-service',
          failureProbability: 0.6,
          impactLevel: 'critical',
          recoveryTimeMinutes: 45,
        },
        {
          system: 'notification-service',
          failureProbability: 0.2,
          impactLevel: 'low',
          recoveryTimeMinutes: 5,
        },
      ],
      circuitBreaker: {
        enabled: true,
        failureThreshold: 2,
        timeoutMs: 30000,
        recoveryTimeMs: 300000,
      },
    });

    const mitigationPlan = scenario.mitigationActions.map(action => ({
      ...action,
      triggered: true, // For testing, assume all mitigations are triggered
    }));

    return {
      scenario,
      mitigationPlan,
      systemRecovery: scenario.systemRecovery,
    };
  }

  /**
   * Example: Test multi-tenancy permission scenarios
   */
  testMultiTenancyPermissionScenarios(): {
    tenantIsolation: Array<{
      tenantId: string;
      isolationMaintained: boolean;
      crossTenantAttempts: number;
      allowedCrossTenantActions: number;
    }>;
    resourceQuotaEnforcement: Array<{
      tenantId: string;
      withinQuota: boolean;
      utilizationPercentage: Record<string, number>;
      actionsRequired: string[];
    }>;
  } {
    const scenario = this.advancedHelpers.testMultiTenancyPermissionScenario({
      tenants: [
        {
          id: 'free-tenant',
          name: 'Free Tier User',
          tier: 'free',
          resourceQuota: {
            maxExecutionTimeMs: 120000,
            maxMemoryMB: 256,
            maxCpuPercent: 50,
          },
          permissionLevel: 'restricted',
        },
        {
          id: 'pro-tenant',
          name: 'Pro Tier User',
          tier: 'pro',
          resourceQuota: {
            maxExecutionTimeMs: 600000,
            maxMemoryMB: 1024,
            maxCpuPercent: 80,
          },
          permissionLevel: 'standard',
        },
      ],
      crossTenantRules: [
        {
          sourceTenant: 'pro-tenant',
          targetTenant: 'free-tenant',
          allowedActions: ['read-shared-data'],
          requiresApproval: true,
          approvers: ['free-tenant-admin'],
        },
      ],
    });

    const tenantIsolation = scenario.tenantIsolationTest.map(test => ({
      tenantId: test.tenant.id,
      isolationMaintained: test.isolationMaintained,
      crossTenantAttempts: test.crossTenantAttempts.length,
      allowedCrossTenantActions: test.crossTenantAttempts.filter(attempt => attempt.allowed).length,
    }));

    const resourceQuotaEnforcement = scenario.resourceQuotaEnforcement.map(enforcement => ({
      tenantId: enforcement.tenant.id,
      withinQuota: enforcement.withinQuota,
      utilizationPercentage: enforcement.utilizationPercentage,
      actionsRequired: enforcement.actionsRequired,
    }));

    return {
      tenantIsolation,
      resourceQuotaEnforcement,
    };
  }

  /**
   * Example: Comprehensive integration test scenario
   */
  createComprehensiveIntegrationScenario(): {
    scenario: string;
    steps: Array<{
      step: string;
      autonomyLevel: AutonomyLevel;
      action: string;
      expectedResult: string;
      permissionRequired: boolean;
      approvalGates: string[];
    }>;
    summary: {
      totalSteps: number;
      approvalRequiredSteps: number;
      estimatedCompletionTime: number;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
    };
  } {
    const scenario = 'Complete software deployment workflow with varying autonomy levels';

    const steps = [
      {
        step: 'Code Review',
        autonomyLevel: 'review-before-commit' as AutonomyLevel,
        action: 'validate-code-changes',
        expectedResult: 'approval-required',
        permissionRequired: true,
        approvalGates: ['code-review-gate'],
      },
      {
        step: 'Build Artifacts',
        autonomyLevel: 'full-auto' as AutonomyLevel,
        action: 'build-application',
        expectedResult: 'auto-execute',
        permissionRequired: false,
        approvalGates: [],
      },
      {
        step: 'Security Scan',
        autonomyLevel: 'review-all' as AutonomyLevel,
        action: 'security-vulnerability-scan',
        expectedResult: 'approval-required',
        permissionRequired: true,
        approvalGates: ['security-review-gate'],
      },
      {
        step: 'Deploy to Production',
        autonomyLevel: 'supervised' as AutonomyLevel,
        action: 'deploy-to-production',
        expectedResult: 'escalated-approval-required',
        permissionRequired: true,
        approvalGates: ['deployment-gate', 'production-gate'],
      },
    ];

    const summary = {
      totalSteps: steps.length,
      approvalRequiredSteps: steps.filter(s => s.permissionRequired).length,
      estimatedCompletionTime: steps.reduce((total, step) =>
        total + (step.approvalGates.length * 30), 0), // 30 min per approval gate
      riskLevel: 'high' as const, // Production deployment = high risk
    };

    return {
      scenario,
      steps,
      summary,
    };
  }

  /**
   * Reset all helper state for clean testing
   */
  reset(): void {
    this.apexHelpers.reset();
    this.advancedHelpers.reset();
  }
}

/**
 * Pre-configured test scenarios showcasing integration patterns
 */
export const IntegrationTestScenarios = {
  /**
   * Scenario: High-security environment with strict permissions
   */
  highSecurityEnvironment: (examples: PermissionAutonomyIntegrationExamples) => {
    return {
      permissionDenials: examples.testPermissionDenialAcrossAutonomyLevels('Write', '/etc/passwd'),
      dangerousOperations: examples.testDangerousOperationHandling('rm -rf /', 'critical'),
      cascadeFailures: examples.testCascadeFailureScenarios(),
      workflowIntegration: examples.createComprehensiveIntegrationScenario(),
    };
  },

  /**
   * Scenario: Multi-tenant SaaS platform with resource limits
   */
  multiTenantSaas: (examples: PermissionAutonomyIntegrationExamples) => {
    return {
      tenantIsolation: examples.testMultiTenancyPermissionScenarios(),
      resourceLimits: examples.testResourceLimitPermissionInteraction(
        { maxExecutionTimeMs: 400000, maxMemoryMB: 600, maxCpuPercent: 90 },
        { maxExecutionTimeMs: 300000, maxMemoryMB: 512, maxCpuPercent: 80 }
      ),
      timeBasedPermissions: examples.testTimeBasedPermissionScenarios('Write', 60),
    };
  },

  /**
   * Scenario: CI/CD pipeline with approval gates
   */
  ciCdPipeline: (examples: PermissionAutonomyIntegrationExamples) => {
    return {
      approvalTimeouts: examples.testApprovalTimeoutWithRejectionBehaviors(30),
      workflowIntegration: examples.createComprehensiveIntegrationScenario(),
      permissionEscalation: examples.testPermissionDenialAcrossAutonomyLevels('Deploy', 'production'),
    };
  },
};

/**
 * Export singleton instance for convenience
 */
export const permissionAutonomyIntegrationExamples = new PermissionAutonomyIntegrationExamples();