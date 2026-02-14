/**
 * Test helpers for permission notification integration tests and autonomy/permission scenarios
 */
export { EventCollector } from './EventCollector';
export { WSTestClient } from './WSTestClient';
export { MockPermissionTrigger } from './MockPermissionTrigger';

// Permission and autonomy test helpers
export {
  PermissionTestHelpers,
  MockPermissionManager,
  PermissionTestScenarios,
  permissionTestHelpers,
} from './permission-test-helpers';

export type {
  TestPermissionConfig,
  PermissionCheckScenario,
  ApprovalFlowConfig,
} from './permission-test-helpers';

export {
  AutonomyTestHelpers,
  MockApprovalSystem,
  AutonomyTestScenarios,
  autonomyTestHelpers,
} from './autonomy-test-helpers';

export type {
  TestAutonomyConfig,
  ApprovalFlowScenario,
  AutonomyBoundaryScenario,
} from './autonomy-test-helpers';

// Advanced test helpers
export {
  AdvancedPermissionAutonomyHelpers,
  AdvancedTestScenarios,
  advancedPermissionAutonomyHelpers,
} from './advanced-permission-autonomy-helpers';

export type {
  TimeBasedPermissionScenario,
  ConditionalApprovalScenario,
  CascadeFailureScenario,
  WorkloadBasedAutonomyScenario,
  MultiTenancyPermissionScenario,
} from './advanced-permission-autonomy-helpers';

// Integration examples and scenarios
export {
  PermissionAutonomyIntegrationExamples,
  IntegrationTestScenarios,
  permissionAutonomyIntegrationExamples,
} from './permission-autonomy-integration-examples';

// Permission scenario helpers
export {
  PermissionScenarioHelpers,
  PermissionScenarioPatterns,
  permissionScenarioHelpers,
} from './permission-scenario-helpers';

export type {
  PermissionBoundaryConfig,
  PermissionDenialScenarioConfig,
  PermissionGrantScenarioConfig,
  ToolPermissionMockConfig,
  PermissionBoundaryResult,
  PermissionDenialResult,
  PermissionGrantResult,
} from './permission-scenario-helpers';

// Additional permission test scenarios
export {
  PermissionTestScenarios,
  permissionTestScenarios,
  runQuickPermissionTests,
} from './permission-test-scenarios';

/**
 * Combined test helpers for comprehensive testing scenarios
 */
export class ApexTestHelpers {
  public readonly permission = new PermissionTestHelpers();
  public readonly autonomy = new AutonomyTestHelpers();
  public readonly advanced = new AdvancedPermissionAutonomyHelpers();

  /**
   * Create a comprehensive test scenario combining permissions and autonomy
   */
  createIntegratedScenario(autonomyLevel: string, permissionLevel: string) {
    return {
      autonomyConfig: this.autonomy.createAutonomyConfig(autonomyLevel as any),
      permissionScenarios: this.permission.createCommonPermissionScenarios(),
      approvalFlow: this.autonomy.getMockApprovalSystem(),
      permissionManager: this.permission.getMockPermissionManager(),
    };
  }

  /**
   * Test permission denial combined with different autonomy levels
   */
  testPermissionDenialWithAutonomyLevel(
    autonomyLevel: 'full-auto' | 'review-before-commit' | 'review-all' | 'supervised',
    tool: string,
    scope?: string
  ): {
    autonomyConfig: any;
    permissionDenial: any;
    expectedOutcome: 'blocked' | 'requires-approval' | 'escalated';
    workflowContinues: boolean;
    reason: string;
  } {
    const autonomyConfig = this.autonomy.createAutonomyConfig(autonomyLevel);
    const permissionDenial = this.permission.simulatePermissionDenial(
      tool,
      scope,
      'Permission denied by policy'
    );

    let expectedOutcome: 'blocked' | 'requires-approval' | 'escalated';
    let workflowContinues: boolean;
    let reason: string;

    switch (autonomyLevel) {
      case 'full-auto':
        expectedOutcome = 'blocked';
        workflowContinues = false;
        reason = 'Even full autonomy cannot override explicit permission denial';
        break;
      case 'review-before-commit':
        expectedOutcome = 'requires-approval';
        workflowContinues = true;
        reason = 'Permission denial triggers approval gate for review';
        break;
      case 'review-all':
      case 'supervised':
        expectedOutcome = 'escalated';
        workflowContinues = false;
        reason = 'Permission denial requires escalation in supervised mode';
        break;
    }

    return {
      autonomyConfig,
      permissionDenial,
      expectedOutcome,
      workflowContinues,
      reason,
    };
  }

  /**
   * Test approval gates functioning in autonomous mode
   */
  testApprovalGateInAutonomousMode(
    gate: any,
    autonomyLevel: 'full-auto' | 'review-before-commit' | 'review-all' | 'supervised'
  ): {
    gateRequired: boolean;
    autoApprove: boolean;
    workflowEffect: 'continues' | 'pauses' | 'fails';
    explanation: string;
  } {
    let gateRequired: boolean;
    let autoApprove: boolean;
    let workflowEffect: 'continues' | 'pauses' | 'fails';
    let explanation: string;

    switch (autonomyLevel) {
      case 'full-auto':
        // Even in full-auto, certain gates (like security) may still be required
        gateRequired = gate.required && (gate.type === 'before-destructive' || gate.type === 'deployment');
        autoApprove = gate.autoApprove || false;
        workflowEffect = gateRequired && !autoApprove ? 'pauses' : 'continues';
        explanation = gateRequired
          ? 'Critical gates required even in full-auto mode'
          : 'Gate bypassed in full-auto mode';
        break;

      case 'review-before-commit':
        gateRequired = gate.type === 'before-commit' || gate.type === 'before-deploy' || gate.required;
        autoApprove = false;
        workflowEffect = gateRequired ? 'pauses' : 'continues';
        explanation = 'Gates required for commit/deploy operations';
        break;

      case 'review-all':
      case 'supervised':
        gateRequired = true;
        autoApprove = false;
        workflowEffect = 'pauses';
        explanation = 'All gates required in review-all/supervised mode';
        break;
    }

    return {
      gateRequired,
      autoApprove,
      workflowEffect,
      explanation,
    };
  }

  /**
   * Test dangerous operations across different autonomy levels
   */
  testDangerousOperationAcrossAutonomyLevels(
    operation: string,
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): Array<{
    autonomyLevel: string;
    permissionResult: any;
    approvalRequired: boolean;
    escalationLevel: 'none' | 'supervisor' | 'admin' | 'security-team';
    workflowOutcome: 'allowed' | 'requires-approval' | 'blocked' | 'escalated';
  }> {
    const autonomyLevels: Array<'full-auto' | 'review-before-commit' | 'review-all' | 'supervised'> = [
      'full-auto',
      'review-before-commit',
      'review-all',
      'supervised',
    ];

    return autonomyLevels.map(level => {
      const dangerousOpResult = this.permission.testDangerousOperationDenial(
        operation,
        riskLevel,
        {
          productionSystem: true,
          reversible: riskLevel !== 'critical',
          requiresBackup: riskLevel === 'high' || riskLevel === 'critical',
        }
      );

      let approvalRequired: boolean;
      let escalationLevel: 'none' | 'supervisor' | 'admin' | 'security-team';
      let workflowOutcome: 'allowed' | 'requires-approval' | 'blocked' | 'escalated';

      switch (level) {
        case 'full-auto':
          approvalRequired = riskLevel === 'critical' || dangerousOpResult.riskAssessment.recommendation === 'deny';
          escalationLevel = riskLevel === 'critical' ? 'security-team' : 'none';
          workflowOutcome = riskLevel === 'critical' ? 'blocked' : 'allowed';
          break;

        case 'review-before-commit':
          approvalRequired = riskLevel !== 'low';
          escalationLevel = riskLevel === 'critical' ? 'security-team' :
                           riskLevel === 'high' ? 'admin' : 'supervisor';
          workflowOutcome = riskLevel === 'critical' ? 'escalated' : 'requires-approval';
          break;

        case 'review-all':
          approvalRequired = true;
          escalationLevel = riskLevel === 'critical' ? 'security-team' : 'admin';
          workflowOutcome = 'requires-approval';
          break;

        case 'supervised':
          approvalRequired = true;
          escalationLevel = 'security-team';
          workflowOutcome = riskLevel === 'critical' ? 'blocked' : 'escalated';
          break;
      }

      return {
        autonomyLevel: level,
        permissionResult: dangerousOpResult.permissionResult,
        approvalRequired,
        escalationLevel,
        workflowOutcome,
      };
    });
  }

  /**
   * Test permission escalation combined with approval gates
   */
  testPermissionEscalationWithApprovalGates(
    tool: string,
    scope: string,
    escalationPath: Array<'supervisor' | 'admin' | 'security-team'>
  ): {
    initialDenial: any;
    escalationSteps: Array<{
      level: string;
      gate: any;
      approvalFlow: any;
      successful: boolean;
    }>;
    finalOutcome: 'approved' | 'denied' | 'timeout';
    totalEscalationTime: number;
  } {
    const initialDenial = this.permission.simulatePermissionDenial(
      tool,
      scope,
      'Initial permission denied - escalation required'
    );

    let totalEscalationTime = 0;
    const escalationSteps = escalationPath.map((level, index) => {
      const gate = this.autonomy.createApprovalGate(
        `escalation-${level}`,
        `${level} Escalation Approval`,
        'custom',
        {
          timeout: level === 'security-team' ? 120 : 60,
          minApprovals: level === 'security-team' ? 2 : 1,
          approvers: [level, `backup-${level}`],
        }
      );

      // Simulate increasing chance of success at higher levels
      const successChance = 0.3 + (index * 0.3); // 30%, 60%, 90% for each level
      const outcome = Math.random() < successChance ? 'approved' : 'denied';

      const approvalFlow = this.autonomy.simulateApprovalFlow({
        gate,
        outcome,
        responseTimeMs: (gate.timeout || 60) * 1000 * 0.8, // 80% of timeout
      });

      totalEscalationTime += approvalFlow.responseTimeMs;

      return {
        level,
        gate,
        approvalFlow,
        successful: outcome === 'approved',
      };
    });

    const anySuccessful = escalationSteps.some(step => step.successful);
    const finalOutcome = anySuccessful ? 'approved' : 'denied';

    return {
      initialDenial,
      escalationSteps,
      finalOutcome,
      totalEscalationTime,
    };
  }

  /**
   * Test resource limits interaction with autonomy and permissions
   */
  testResourceLimitBoundaryWithAutonomyLevels(
    usage: {
      maxExecutionTimeMs?: number;
      maxMemoryMB?: number;
      maxCpuPercent?: number;
    },
    limits: {
      maxExecutionTimeMs?: number;
      maxMemoryMB?: number;
      maxCpuPercent?: number;
    }
  ): Array<{
    autonomyLevel: string;
    boundaryResult: any;
    permissionRequired: boolean;
    workflowAction: 'continue' | 'warn' | 'request-approval' | 'deny';
  }> {
    const autonomyLevels: Array<'full-auto' | 'review-before-commit' | 'review-all' | 'supervised'> = [
      'full-auto',
      'review-before-commit',
      'review-all',
      'supervised',
    ];

    return autonomyLevels.map(level => {
      const boundaryResult = this.autonomy.testResourceLimitBoundary(limits, usage);

      let permissionRequired: boolean;
      let workflowAction: 'continue' | 'warn' | 'request-approval' | 'deny';

      switch (level) {
        case 'full-auto':
          permissionRequired = !boundaryResult.withinLimits;
          workflowAction = boundaryResult.recommendedAction === 'deny' ? 'deny' :
                          boundaryResult.recommendedAction === 'warn' ? 'warn' : 'continue';
          break;

        case 'review-before-commit':
          permissionRequired = boundaryResult.recommendedAction !== 'proceed';
          workflowAction = boundaryResult.recommendedAction === 'deny' ? 'deny' : 'request-approval';
          break;

        case 'review-all':
        case 'supervised':
          permissionRequired = true;
          workflowAction = boundaryResult.recommendedAction === 'deny' ? 'deny' : 'request-approval';
          break;
      }

      return {
        autonomyLevel: level,
        boundaryResult,
        permissionRequired,
        workflowAction,
      };
    });
  }

  /**
   * Create comprehensive test scenarios for complex workflows
   */
  createComprehensiveTestScenarios() {
    return {
      // Scenario 1: High-risk operation with full autonomy
      highRiskFullAutonomy: () => {
        const autonomyConfig = this.autonomy.createAutonomyConfig('full-auto');
        const dangerousOp = this.permission.testDangerousOperationDenial('rm -rf /', 'critical');
        return this.testDangerousOperationAcrossAutonomyLevels('rm -rf /', 'critical');
      },

      // Scenario 2: Permission denial cascade with escalation
      permissionDenialCascade: () => {
        return this.testPermissionEscalationWithApprovalGates(
          'Write',
          '/etc/passwd',
          ['supervisor', 'admin', 'security-team']
        );
      },

      // Scenario 3: Resource exhaustion with different autonomy levels
      resourceExhaustion: () => {
        return this.testResourceLimitBoundaryWithAutonomyLevels(
          { maxExecutionTimeMs: 400000, maxMemoryMB: 600, maxCpuPercent: 95 },
          { maxExecutionTimeMs: 300000, maxMemoryMB: 512, maxCpuPercent: 80 }
        );
      },

      // Scenario 4: Multi-gate sequential approval with permissions
      multiGateSequentialApproval: () => {
        const gates = [
          this.autonomy.createApprovalGate('security', 'Security Review', 'before-destructive'),
          this.autonomy.createApprovalGate('compliance', 'Compliance Check', 'custom'),
          this.autonomy.createApprovalGate('deploy', 'Deployment Approval', 'before-deploy'),
        ];
        return this.autonomy.simulateSequentialApprovals(gates, ['approved', 'approved', 'approved']);
      },

      // Scenario 5: Parallel approval quorum testing
      parallelApprovalQuorum: () => {
        const gates = [
          this.autonomy.createApprovalGate('tech-lead-1', 'Tech Lead 1', 'custom'),
          this.autonomy.createApprovalGate('tech-lead-2', 'Tech Lead 2', 'custom'),
          this.autonomy.createApprovalGate('architect', 'Architect Review', 'custom'),
        ];
        return this.autonomy.simulateParallelApprovals(
          gates,
          ['approved', 'denied', 'approved'],
          { requireAllApprovals: false, minimumApprovals: 2 }
        );
      },
    };
  }

  /**
   * Reset all test state across both helper systems
   */
  reset(): void {
    this.permission.reset();
    this.autonomy.reset();
  }
}

/**
 * Singleton instance for convenience
 */
export const apexTestHelpers = new ApexTestHelpers();