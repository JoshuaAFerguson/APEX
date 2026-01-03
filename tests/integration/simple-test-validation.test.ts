import { describe, it, expect } from 'vitest';
import { ApprovalState, Task, ApprovalDecisionResponse } from '@apexcli/core';

// Simple validation test to ensure our test environment is working
describe('Integration Test Environment Validation', () => {
  it('should import core types correctly', () => {
    // Test that we can create objects with proper typing
    const mockApprovalState: ApprovalState = {
      id: 'test-approval-123',
      taskId: 'test-task-456',
      gateName: 'test-gate',
      status: 'pending',
      requestedAt: new Date()
    };

    expect(mockApprovalState.id).toBe('test-approval-123');
    expect(mockApprovalState.status).toBe('pending');
  });

  it('should validate ApprovalDecisionResponse type', () => {
    const mockResponse: ApprovalDecisionResponse = {
      success: true,
      taskWillProceed: false,
      approvalState: {
        id: 'test-approval-123',
        taskId: 'test-task-456',
        gateName: 'test-gate',
        status: 'denied',
        approver: 'test@example.com',
        comment: 'Test denial reason',
        requestedAt: new Date(),
        respondedAt: new Date()
      }
    };

    expect(mockResponse.success).toBe(true);
    expect(mockResponse.taskWillProceed).toBe(false);
    expect(mockResponse.approvalState?.status).toBe('denied');
  });

  it('should validate Task type with error field', () => {
    const mockTask: Task = {
      id: 'task-123',
      description: 'Test task',
      workflow: 'test-workflow',
      autonomy: 'medium',
      priority: 'normal',
      effort: 'medium',
      status: 'failed',
      error: 'Approval denied by test@example.com: Test denial reason',
      createdAt: new Date(),
      updatedAt: new Date(),
      agentAssignments: {},
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      }
    };

    expect(mockTask.status).toBe('failed');
    expect(mockTask.error).toBeDefined();
    expect(mockTask.error).toContain('Approval denied');
  });
});