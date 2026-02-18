/**
 * Example usage of approval test utilities
 * This file demonstrates how to use the approval test utilities in real tests
 */

import {
  createApprovalFlowTestEnvironment,
  createApprovalScenario,
  createMockApprovalState,
  createMockApprovalGate,
  createWorkflowWithApprovals,
  ApprovalTestAssertions,
  type ApprovalFlowTestEnvironment,
} from '../approval-test-utils.js';

/**
 * Example 1: Basic approval flow testing
 */
export async function basicApprovalFlowExample(): Promise<void> {
  console.log('🔄 Example 1: Basic Approval Flow');

  const approvalFlow = await createApprovalFlowTestEnvironment();

  try {
    // Create a task with approval requirements
    const { task, gates } = await approvalFlow.createTaskWithApprovals({
      task: {
        description: 'Deploy new feature to production',
        workflow: 'feature-deployment',
      },
      gates: [
        {
          type: 'before-deploy',
          name: 'security-review',
          description: 'Security team must approve deployment',
          approvers: ['security@company.com'],
          timeout: 60, // 1 hour timeout
        }
      ]
    });

    console.log(`  ✅ Created task: ${task.id}`);
    console.log(`  📋 Gates created: ${gates.length}`);

    // Request approval
    const approval = await approvalFlow.requestApproval(task.id, 'security-review', {
      comment: 'Ready for security review - all tests passing',
      stage: 'pre-deployment',
      agent: 'deployment-bot',
    });

    console.log(`  🔔 Requested approval: ${approval.id}`);

    // Check initial state
    const pendingApprovals = await approvalFlow.getPendingApprovals(task.id);
    console.log(`  ⏳ Pending approvals: ${pendingApprovals.length}`);

    // Grant approval
    await approvalFlow.grantApproval(
      approval.id,
      'security-lead@company.com',
      'Security review passed - approved for deployment'
    );

    console.log(`  ✅ Approval granted`);

    // Verify completion
    const allComplete = await approvalFlow.areAllApprovalsComplete(task.id);
    console.log(`  🎯 All approvals complete: ${allComplete}`);

    // Use assertions
    await ApprovalTestAssertions.assertApprovalStatus(
      approvalFlow.getStore(),
      approval.id,
      'approved'
    );
    console.log(`  ✅ Assertion passed: approval is approved`);

  } finally {
    await approvalFlow.cleanup();
  }
}

/**
 * Example 2: Multi-step approval chain testing
 */
export async function multiStepApprovalExample(): Promise<void> {
  console.log('\n🔗 Example 2: Multi-Step Approval Chain');

  const approvalFlow = await createApprovalFlowTestEnvironment();

  try {
    const { task } = await approvalFlow.createTaskWithApprovals({
      task: { description: 'Critical database migration' },
      gates: [
        { type: 'before-commit', name: 'code-review', minApprovals: 2 },
        { type: 'before-deploy', name: 'dba-approval' },
        { type: 'before-deploy', name: 'ops-approval' },
      ]
    });

    console.log(`  📋 Created task with 3 approval gates`);

    // Simulate the multi-step approval scenario
    const approvals = await approvalFlow.simulateApprovalWorkflow(task.id, 'multi-step-approval');
    console.log(`  🔄 Simulated workflow with ${approvals.length} approvals`);

    // Check what's pending
    const pendingApprovals = await approvalFlow.getPendingApprovals(task.id);
    console.log(`  ⏳ Pending approvals: ${pendingApprovals.length}`);

    // Grant remaining approvals
    for (const pending of pendingApprovals) {
      await approvalFlow.grantApproval(pending.id, `approver-${pending.gateName}@company.com`);
      console.log(`  ✅ Granted approval for ${pending.gateName}`);
    }

    // Verify all complete
    await ApprovalTestAssertions.assertAllApprovalsApproved(approvalFlow.getStore(), task.id);
    console.log(`  🎯 All approvals completed successfully`);

  } finally {
    await approvalFlow.cleanup();
  }
}

/**
 * Example 3: Testing approval rejections
 */
export async function approvalRejectionExample(): Promise<void> {
  console.log('\n❌ Example 3: Approval Rejection Testing');

  const approvalFlow = await createApprovalFlowTestEnvironment();

  try {
    const { task } = await approvalFlow.createTaskWithApprovals();

    // Request approval
    const approval = await approvalFlow.requestApproval(task.id, 'security-gate', {
      comment: 'Please review for security concerns',
    });

    console.log(`  📝 Requested approval: ${approval.id}`);

    // Deny the approval
    await approvalFlow.denyApproval(
      approval.id,
      'security-chief@company.com',
      'Found critical security vulnerabilities - cannot approve'
    );

    console.log(`  ❌ Approval denied`);

    // Verify denial
    const anyDenied = await approvalFlow.hasAnyApprovalBeenDenied(task.id);
    console.log(`  🚫 Has denied approvals: ${anyDenied}`);

    // Check that approvals are not complete
    const allComplete = await approvalFlow.areAllApprovalsComplete(task.id);
    console.log(`  ❌ All approvals complete: ${allComplete}`);

  } finally {
    await approvalFlow.cleanup();
  }
}

/**
 * Example 4: Testing approval events
 */
export async function approvalEventsExample(): Promise<void> {
  console.log('\n📡 Example 4: Approval Events Testing');

  const approvalFlow = await createApprovalFlowTestEnvironment();

  try {
    const { task } = await approvalFlow.createTaskWithApprovals();
    const events: string[] = [];

    // Listen for all approval events
    const emitter = approvalFlow.getEventEmitter();
    emitter.on('approval-required', (data) => {
      events.push(`required:${data.gateName}`);
      console.log(`  📬 Approval required for ${data.gateName}`);
    });

    emitter.on('approval-granted', (data) => {
      events.push(`granted:${data.approver}`);
      console.log(`  ✅ Approval granted by ${data.approver}`);
    });

    emitter.on('approval-denied', (data) => {
      events.push(`denied:${data.approver}`);
      console.log(`  ❌ Approval denied by ${data.approver}`);
    });

    // Request and grant approval
    const approval = await approvalFlow.requestApproval(task.id, 'event-test-gate');
    await approvalFlow.grantApproval(approval.id, 'event-tester@company.com');

    console.log(`  📊 Events captured: ${events.join(', ')}`);

    // Wait for specific event
    setTimeout(async () => {
      await approvalFlow.requestApproval(task.id, 'async-gate');
    }, 100);

    const eventData = await approvalFlow.waitForApprovalEvent('approval-required', 1000);
    console.log(`  ⏱️  Waited for event: ${eventData.gateName}`);

  } finally {
    await approvalFlow.cleanup();
  }
}

/**
 * Example 5: Creating custom approval scenarios
 */
export async function customScenariosExample(): Promise<void> {
  console.log('\n🎭 Example 5: Custom Approval Scenarios');

  // Create custom approval states
  const customApprovals = [
    createMockApprovalState({
      taskId: 'custom-task-123',
      gateName: 'executive-approval',
      status: 'pending',
      comment: 'Requires C-suite approval for budget',
      approvalsRequired: 3,
      approvalsReceived: 1,
      timeoutMinutes: 1440, // 24 hours
    }),
    createMockApprovalState({
      taskId: 'custom-task-123',
      gateName: 'legal-review',
      status: 'approved',
      approver: 'legal@company.com',
      comment: 'Legal review completed - no concerns',
      respondedAt: new Date(),
    }),
  ];

  console.log(`  📋 Created ${customApprovals.length} custom approval states`);

  // Create custom approval gate
  const customGate = createMockApprovalGate({
    type: 'custom',
    name: 'regulatory-compliance',
    description: 'Must meet all regulatory requirements',
    required: true,
    minApprovals: 2,
    approvers: ['compliance@company.com', 'audit@company.com'],
    timeout: 720, // 12 hours
  });

  console.log(`  🚧 Created custom gate: ${customGate.name}`);

  // Create workflow with custom approvals
  const workflow = createWorkflowWithApprovals({
    name: 'compliance-workflow',
    description: 'Workflow with regulatory approval requirements',
    gates: [customGate],
  });

  console.log(`  🔄 Created workflow: ${workflow.name}`);

  // Test predefined scenarios
  const scenarios = [
    'pending-approval',
    'auto-approval',
    'manual-approval',
    'rejection',
    'timeout',
    'multi-step-approval',
    'approval-chain',
  ] as const;

  for (const scenario of scenarios) {
    const scenarioApprovals = createApprovalScenario('scenario-task', scenario);
    console.log(`  📝 ${scenario}: ${scenarioApprovals.length} approval(s)`);
  }
}

/**
 * Example 6: Error handling and edge cases
 */
export async function errorHandlingExample(): Promise<void> {
  console.log('\n🚨 Example 6: Error Handling & Edge Cases');

  const approvalFlow = await createApprovalFlowTestEnvironment();

  try {
    // Test approval not found
    try {
      await approvalFlow.grantApproval('non-existent-id', 'test@example.com');
    } catch (error) {
      console.log(`  ❌ Expected error: ${(error as Error).message}`);
    }

    // Test assertion failures
    const { task } = await approvalFlow.createTaskWithApprovals();
    const approval = await approvalFlow.requestApproval(task.id, 'test-gate');

    try {
      await ApprovalTestAssertions.assertApprovalStatus(
        approvalFlow.getStore(),
        approval.id,
        'approved' // Should fail - it's pending
      );
    } catch (error) {
      console.log(`  ❌ Expected assertion error: ${(error as Error).message}`);
    }

    // Test event timeout
    try {
      await approvalFlow.waitForApprovalEvent('approval-granted', 100);
    } catch (error) {
      console.log(`  ⏱️  Expected timeout: ${(error as Error).message}`);
    }

    console.log(`  ✅ Error handling working correctly`);

  } finally {
    await approvalFlow.cleanup();
  }
}

/**
 * Run all examples
 */
export async function runAllApprovalExamples(): Promise<void> {
  console.log('🚀 Running Approval Test Utilities Examples\n');

  try {
    await basicApprovalFlowExample();
    await multiStepApprovalExample();
    await approvalRejectionExample();
    await approvalEventsExample();
    await customScenariosExample();
    await errorHandlingExample();

    console.log('\n🎉 All examples completed successfully!');
    console.log('\n📚 Key features demonstrated:');
    console.log('  • Basic approval request/grant flow');
    console.log('  • Multi-step approval chains');
    console.log('  • Approval rejections and error states');
    console.log('  • Event-driven approval workflows');
    console.log('  • Custom scenarios and configurations');
    console.log('  • Comprehensive error handling');

  } catch (error) {
    console.error('❌ Example failed:', error);
    throw error;
  }
}

// Export for use in other files
export default {
  basicApprovalFlowExample,
  multiStepApprovalExample,
  approvalRejectionExample,
  approvalEventsExample,
  customScenariosExample,
  errorHandlingExample,
  runAllApprovalExamples,
};