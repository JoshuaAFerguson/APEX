// Type validation for respondToApproval implementation
import { ApexOrchestrator } from './index';
import { ApprovalResponse } from '@apexcli/core';

// Compile-time type checking
function validateTypes() {
  // Test that ApexOrchestrator has the new methods
  const orchestrator: ApexOrchestrator = null as any;

  // Check respondToApproval method signature
  const respondMethod: (requestId: string, response: ApprovalResponse) => Promise<void> =
    orchestrator.respondToApproval;

  // Check waitForApproval method signature
  const waitMethod: (requestId: string, timeoutMs?: number) => Promise<ApprovalResponse> =
    orchestrator.waitForApproval;

  // Test ApprovalResponse type usage
  const response: ApprovalResponse = {
    requestId: 'test-request',
    taskId: 'test-task',
    response: 'approved',
    message: 'approved for testing',
    approvalId: 'approval-1',
    gateName: 'test-gate',
    action: 'approve',
    approver: 'test-user',
    comment: 'LGTM',
    timestamp: new Date(),
    requestedAt: new Date(),
    approvalsReceived: 1,
    approvalsRequired: 1,
    resolved: true,
  };

  return { respondMethod, waitMethod, response };
}

// This will only compile if types are correct
export default validateTypes;
