/**
 * Quick verification script to ensure approval test utilities work correctly
 * This can be run independently to verify the implementation
 */

import {
  createMockApprovalState,
  createMockApprovalGate,
  createApprovalScenario,
  createApprovalFlowTestEnvironment,
} from '../approval-test-utils.js';

async function verifyApprovalTestUtils() {
  console.log('🧪 Verifying approval test utilities...');

  try {
    // Test mock approval state creation
    console.log('✅ Testing createMockApprovalState...');
    const mockApproval = createMockApprovalState({ taskId: 'test-task' });
    if (!mockApproval.id || mockApproval.taskId !== 'test-task') {
      throw new Error('Mock approval state creation failed');
    }

    // Test mock approval gate creation
    console.log('✅ Testing createMockApprovalGate...');
    const mockGate = createMockApprovalGate({ type: 'before-deploy', name: 'deployment-gate' });
    if (mockGate.type !== 'before-deploy' || mockGate.name !== 'deployment-gate') {
      throw new Error('Mock approval gate creation failed');
    }

    // Test scenario generation
    console.log('✅ Testing createApprovalScenario...');
    const pendingScenario = createApprovalScenario('test-task', 'pending-approval');
    if (pendingScenario.length !== 1 || pendingScenario[0].status !== 'pending') {
      throw new Error('Approval scenario generation failed');
    }

    const multiStepScenario = createApprovalScenario('test-task', 'multi-step-approval');
    if (multiStepScenario.length !== 3) {
      throw new Error('Multi-step approval scenario generation failed');
    }

    // Test approval flow environment (basic initialization)
    console.log('✅ Testing ApprovalFlowTestEnvironment...');
    const approvalFlow = await createApprovalFlowTestEnvironment();

    // Verify environment has required components
    if (!approvalFlow.getStore() || !approvalFlow.getEventEmitter()) {
      throw new Error('Approval flow test environment initialization failed');
    }

    // Test basic approval workflow
    const { task } = await approvalFlow.createTaskWithApprovals({
      task: { description: 'Verification test task' },
      gates: [{ type: 'custom', name: 'verification-gate' }],
    });

    if (!task.id || task.description !== 'Verification test task') {
      throw new Error('Task creation with approvals failed');
    }

    // Test approval request
    const approval = await approvalFlow.requestApproval(task.id, 'verification-gate');
    if (!approval.id || approval.status !== 'pending') {
      throw new Error('Approval request failed');
    }

    // Test approval granting
    await approvalFlow.grantApproval(approval.id, 'verifier@test.com');
    const updatedApproval = await approvalFlow.getStore().getApprovalStateById(approval.id);
    if (updatedApproval?.status !== 'approved') {
      throw new Error('Approval granting failed');
    }

    // Cleanup
    await approvalFlow.cleanup();

    console.log('🎉 All approval test utilities verified successfully!');
    return true;
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

// Export for use in tests
export { verifyApprovalTestUtils };

// Run verification if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyApprovalTestUtils()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Verification error:', error);
      process.exit(1);
    });
}