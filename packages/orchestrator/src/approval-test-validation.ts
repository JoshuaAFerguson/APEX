#!/usr/bin/env node
/**
 * Simple validation script for approval test utilities
 * This script can be run to verify the utilities work correctly
 */

import {
  createMockApprovalState,
  createMockApprovalGate,
  createApprovalScenario,
  createApprovalFlowTestEnvironment,
  ApprovalTestAssertions,
} from './approval-test-utils.js';

async function validateApprovalTestUtils(): Promise<void> {
  console.log('🚀 Validating approval test utilities...\n');

  try {
    // Test 1: Mock approval state creation
    console.log('✓ Testing mock approval state creation');
    const approval = createMockApprovalState({
      taskId: 'test-task-123',
      status: 'pending',
      gateName: 'validation-gate',
    });
    console.log(`  Created approval: ${approval.id} (${approval.status})`);

    // Test 2: Mock approval gate creation
    console.log('✓ Testing mock approval gate creation');
    const gate = createMockApprovalGate({
      type: 'before-deploy',
      name: 'deployment-gate',
      minApprovals: 2,
    });
    console.log(`  Created gate: ${gate.name} (${gate.type}, requires ${gate.minApprovals} approvals)`);

    // Test 3: Approval scenarios
    console.log('✓ Testing approval scenarios');
    const scenarios = [
      'pending-approval',
      'auto-approval',
      'manual-approval',
      'rejection',
      'multi-step-approval',
      'approval-chain',
    ] as const;

    for (const scenario of scenarios) {
      const approvals = createApprovalScenario('task-456', scenario);
      console.log(`  ${scenario}: ${approvals.length} approval(s) created`);
    }

    // Test 4: Approval flow environment
    console.log('✓ Testing approval flow environment');
    const approvalFlow = await createApprovalFlowTestEnvironment();

    try {
      const { task } = await approvalFlow.createTaskWithApprovals({
        task: { description: 'Validation test task' },
        gates: [
          { type: 'before-deploy', name: 'deploy-gate', minApprovals: 1 },
        ],
      });
      console.log(`  Created task with approvals: ${task.id}`);

      // Request approval
      const requestedApproval = await approvalFlow.requestApproval(task.id, 'deploy-gate', {
        comment: 'Validation test approval request',
      });
      console.log(`  Requested approval: ${requestedApproval.id}`);

      // Grant approval
      await approvalFlow.grantApproval(requestedApproval.id, 'validator@example.com', 'Validation passed');
      console.log(`  Granted approval: ${requestedApproval.id}`);

      // Test assertions
      await ApprovalTestAssertions.assertApprovalStatus(
        approvalFlow.getStore(),
        requestedApproval.id,
        'approved'
      );
      console.log(`  Assertion passed: approval status is 'approved'`);

      await ApprovalTestAssertions.assertApprovalApprover(
        approvalFlow.getStore(),
        requestedApproval.id,
        'validator@example.com'
      );
      console.log(`  Assertion passed: approver is 'validator@example.com'`);

      console.log('  Environment test completed successfully');
    } finally {
      await approvalFlow.cleanup();
    }

    console.log('\n🎉 All approval test utilities validated successfully!');

    console.log('\n📝 Test utilities summary:');
    console.log('  • createMockApprovalState - Creates approval states with configurable properties');
    console.log('  • createMockApprovalGate - Creates approval gates for workflows');
    console.log('  • createApprovalScenario - Creates predefined approval scenarios for testing');
    console.log('  • ApprovalFlowTestEnvironment - Full environment for testing approval workflows');
    console.log('  • ApprovalTestAssertions - Assertion helpers for approval state validation');
    console.log('  • Event simulation for approval-required, approval-granted, approval-denied');
    console.log('  • Timeout handling and multi-step approval chains');
    console.log('  • Support for pending, auto-approval, manual approval, and rejection scenarios');

  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  validateApprovalTestUtils().catch(console.error);
}