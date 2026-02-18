/**
 * @fileoverview Example usage of APEX test helpers
 *
 * This file demonstrates practical usage patterns for the permission and autonomy test helpers.
 * These examples show how to use the helpers in real test scenarios.
 */

import {
  PermissionTestHelpers,
  AutonomyTestHelpers,
  PermissionTestScenarios,
  AutonomyTestScenarios,
  apexTestHelpers,
} from './index';

/**
 * Example: Testing a simple permission scenario
 */
export function exampleBasicPermissionTest(): void {
  const helpers = new PermissionTestHelpers();

  // Create permissions for different tools
  const writePermission = helpers.createPermission('Write', 'allow-always');
  const shellPermission = helpers.createPermission('Shell', 'deny');

  // Test permission approval and denial
  const approvedWrite = helpers.simulatePermissionApproval('Write');
  const deniedShell = helpers.simulatePermissionDenial('Shell', undefined, 'Shell access prohibited');

  console.log('Write permission:', approvedWrite.allowed); // true
  console.log('Shell permission:', deniedShell.allowed);   // false
}

/**
 * Example: Testing approval flow with mock permission manager
 */
export function exampleApprovalFlowTest(): void {
  const helpers = new PermissionTestHelpers();
  const manager = helpers.getMockPermissionManager();

  // Configure permission scenarios
  manager.configurePermissionCheck('Write', '/sensitive', {
    allowed: false,
    level: null,
    requiresConfirmation: true,
    reason: 'Sensitive directory requires approval',
  });

  manager.configurePermissionCheck('Write', '/tmp', {
    allowed: true,
    level: 'allow-always',
    requiresConfirmation: false,
  });

  // Test the configured behaviors
  const sensitiveResult = manager.checkPermission('Write', { scope: '/sensitive' });
  const tmpResult = manager.checkPermission('Write', { scope: '/tmp' });

  console.log('Sensitive write requires confirmation:', sensitiveResult.requiresConfirmation);
  console.log('Tmp write is allowed:', tmpResult.allowed);
}

/**
 * Example: Testing autonomy levels and boundaries
 */
export function exampleAutonomyBoundaryTest(): void {
  const helpers = new AutonomyTestHelpers();

  // Test different autonomy levels
  const scenarios = [
    {
      level: 'full-auto' as const,
      action: 'write-file',
      shouldRequireApproval: false,
    },
    {
      level: 'review-before-commit' as const,
      action: 'git-commit',
      shouldRequireApproval: true,
      expectedCheckpoint: 'before-commit' as const,
    },
    {
      level: 'supervised' as const,
      action: 'read-file',
      shouldRequireApproval: true,
      expectedCheckpoint: 'custom' as const,
    },
  ];

  scenarios.forEach(scenario => {
    const result = helpers.testAutonomyBoundary({
      autonomyLevel: scenario.level,
      action: scenario.action,
      shouldRequireApproval: scenario.shouldRequireApproval,
      expectedCheckpoint: scenario.expectedCheckpoint,
    });

    console.log(`${scenario.level} - ${scenario.action}:`, result.requiresApproval);
  });
}

/**
 * Example: Testing approval gate workflows
 */
export function exampleApprovalGateTest(): void {
  const helpers = new AutonomyTestHelpers();

  // Create different types of approval gates
  const codeReviewGate = helpers.createApprovalGate(
    'code-review',
    'Code Review',
    'before-commit',
    {
      timeout: 60,
      minApprovals: 2,
      approvers: ['tech-lead-1', 'tech-lead-2'],
    }
  );

  const deploymentGate = helpers.createApprovalGate(
    'deployment',
    'Production Deployment',
    'before-deploy',
    {
      timeout: 120,
      minApprovals: 3,
      approvers: ['devops-lead', 'security-lead', 'product-lead'],
    }
  );

  // Simulate approval flows
  const approvedCodeReview = helpers.simulateApprovalFlow({
    gate: codeReviewGate,
    outcome: 'approved',
    responseTimeMs: 45000, // 45 seconds
  });

  const deniedDeployment = helpers.simulateApprovalFlow({
    gate: deploymentGate,
    outcome: 'denied',
    responseTimeMs: 30000, // 30 seconds
  });

  console.log('Code review result:', approvedCodeReview.action);
  console.log('Deployment result:', deniedDeployment.action);

  // Test timeout scenario
  const timedOut = helpers.simulateApprovalTimeout('before-destructive', 5);
  console.log('Timeout result:', timedOut?.action);
}

/**
 * Example: Using pre-configured scenarios
 */
export function examplePreConfiguredScenarios(): void {
  const permissionHelpers = new PermissionTestHelpers();
  const autonomyHelpers = new AutonomyTestHelpers();

  // Apply full access permission scenario
  PermissionTestScenarios.fullAccess(permissionHelpers);
  const manager = permissionHelpers.getMockPermissionManager();

  console.log('Write access:', manager.checkPermission('Write').allowed);
  console.log('Shell access:', manager.checkPermission('Shell').allowed);

  // Test autonomy boundaries for all levels
  const boundaries = AutonomyTestScenarios.boundaryConditions(autonomyHelpers);
  boundaries.forEach(({ scenario, result }) => {
    console.log(
      `${scenario.autonomyLevel} - ${scenario.action}:`,
      result.requiresApproval ? 'requires approval' : 'autonomous'
    );
  });

  // Get all autonomy level configurations
  const autonomyConfigs = AutonomyTestScenarios.allAutonomyLevels(autonomyHelpers);
  Object.entries(autonomyConfigs).forEach(([level, config]) => {
    console.log(`${level} config has ${config.gates?.length || 0} gates`);
  });
}

/**
 * Example: Integrated permission and autonomy testing
 */
export function exampleIntegratedTesting(): void {
  // Reset state for clean testing
  apexTestHelpers.reset();

  // Create an integrated scenario
  const scenario = apexTestHelpers.createIntegratedScenario('review-before-commit', 'allow-always');

  console.log('Autonomy level:', scenario.autonomyConfig.level);
  console.log('Available permission scenarios:', Object.keys(scenario.permissionScenarios));

  // Test permission approvals
  const writeResult = apexTestHelpers.permission.simulatePermissionApproval('Write');
  console.log('Write permission:', writeResult.level);

  // Test autonomy boundaries
  const boundaryResult = apexTestHelpers.autonomy.testAutonomyBoundary({
    autonomyLevel: 'review-before-commit',
    action: 'git-commit',
    shouldRequireApproval: true,
    expectedCheckpoint: 'before-commit',
  });
  console.log('Commit requires approval:', boundaryResult.requiresApproval);

  // Test approval system integration
  const approvalSystem = apexTestHelpers.autonomy.getMockApprovalSystem();
  const request = apexTestHelpers.permission.createApprovalRequest({
    requestId: 'integrated-test',
    taskId: 'test-task',
    gateName: 'integration-gate',
    gateType: 'before-commit',
  });

  approvalSystem.createApprovalRequest(request);
  console.log('Pending approvals:', approvalSystem.getPendingApprovals().length);
}

/**
 * Example: Complex multi-stage approval workflow
 */
export function exampleComplexWorkflow(): void {
  const helpers = new AutonomyTestHelpers();

  // Create autonomy config with agent overrides
  const config = helpers.createAutonomyConfig('review-before-commit', {
    includeGates: true,
    agentOverrides: {
      developer: 'full-auto',           // Developers work autonomously
      reviewer: 'supervised',          // Reviewers are supervised
      devops: {                        // DevOps has complex rules
        level: 'review-before-commit',
        approvalTimeout: 60,
        rejectionBehavior: 'skip',
        gates: [helpers.createApprovalGate('devops-deploy', 'DevOps Deploy', 'before-deploy')],
      },
    },
  });

  console.log('Base autonomy level:', config.level);
  console.log('Agent overrides:', Object.keys(config.agentOverrides || {}));

  // Test boundaries for different agents
  const developerBoundary = helpers.testAutonomyBoundary({
    autonomyLevel: 'full-auto', // Developer override
    action: 'write-code',
    shouldRequireApproval: false,
    agent: 'developer',
  });

  const reviewerBoundary = helpers.testAutonomyBoundary({
    autonomyLevel: 'supervised', // Reviewer override
    action: 'approve-pr',
    shouldRequireApproval: true,
    agent: 'reviewer',
  });

  console.log('Developer autonomy:', !developerBoundary.requiresApproval);
  console.log('Reviewer supervision:', reviewerBoundary.requiresApproval);
}

/**
 * Run all examples (useful for manual validation)
 */
export function runAllExamples(): void {
  console.log('🧪 Running Permission and Autonomy Test Helper Examples\n');

  console.log('📋 Basic Permission Test:');
  exampleBasicPermissionTest();

  console.log('\n🔒 Approval Flow Test:');
  exampleApprovalFlowTest();

  console.log('\n🤖 Autonomy Boundary Test:');
  exampleAutonomyBoundaryTest();

  console.log('\n🚪 Approval Gate Test:');
  exampleApprovalGateTest();

  console.log('\n📚 Pre-configured Scenarios:');
  examplePreConfiguredScenarios();

  console.log('\n🔗 Integrated Testing:');
  exampleIntegratedTesting();

  console.log('\n🏗️ Complex Workflow:');
  exampleComplexWorkflow();

  console.log('\n✅ All examples completed successfully!');
}

// Export all example functions for use in tests
export default {
  exampleBasicPermissionTest,
  exampleApprovalFlowTest,
  exampleAutonomyBoundaryTest,
  exampleApprovalGateTest,
  examplePreConfiguredScenarios,
  exampleIntegratedTesting,
  exampleComplexWorkflow,
  runAllExamples,
};