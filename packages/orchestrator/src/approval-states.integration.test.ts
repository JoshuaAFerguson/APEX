import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task, ApprovalState, ApprovalStatus } from '@apexcli/core';

describe('Approval States Integration Tests', () => {
  let testDir: string;
  let store: TaskStore;

  const createTestTask = (suffix = ''): Task => ({
    id: `task_${Date.now()}_${suffix}`,
    description: `Test task for approval integration ${suffix}`,
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    projectPath: testDir,
    branchName: 'apex/test-branch',
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    logs: [],
    artifacts: [],
  });

  const createApprovalRequest = (taskId: string, gateName: string, options: Partial<ApprovalState> = {}): ApprovalState => ({
    id: `approval_${Date.now()}_${gateName}`,
    taskId,
    gateName,
    status: 'pending',
    requestedAt: new Date(),
    approver: undefined,
    respondedAt: undefined,
    comment: undefined,
    context: {
      stage: 'implementation',
      agent: 'developer',
      riskLevel: 'medium',
      ...options.context,
    },
    stage: options.stage || 'implementation',
    agent: options.agent || 'developer',
    approvalsReceived: options.approvalsReceived || 0,
    approvalsRequired: options.approvalsRequired || 1,
    timeoutMinutes: options.timeoutMinutes,
    expiresAt: options.expiresAt,
    ...options,
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-integration-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Approval Workflow Simulation', () => {
    it('should handle complete approval lifecycle for a feature task', async () => {
      // 1. Create a feature development task
      const task = createTestTask('feature');
      task.workflow = 'feature';
      task.status = 'in-progress';
      task.currentStage = 'implementation';
      await store.createTask(task);

      // 2. Implementation stage requires security review
      const securityApproval = createApprovalRequest(task.id, 'security-review', {
        stage: 'implementation',
        agent: 'developer',
        context: {
          stage: 'implementation',
          agent: 'developer',
          riskLevel: 'high',
          filesModified: ['auth/login.ts', 'middleware/security.ts'],
          securityConcerns: ['authentication', 'authorization'],
        },
      });

      await store.saveApprovalState(securityApproval);

      // 3. Verify approval is pending
      const pendingApprovals = await store.getPendingApprovals();
      expect(pendingApprovals).toHaveLength(1);
      expect(pendingApprovals[0].gateName).toBe('security-review');

      // 4. Security team reviews and approves
      await store.updateApprovalState(securityApproval.id, {
        status: 'approved',
        approver: 'security-team@company.com',
        respondedAt: new Date(),
        comment: 'Security review passed. Good implementation of authentication.',
      });

      // 5. Task proceeds to testing stage and requires QA approval
      await store.updateTask(task.id, {
        currentStage: 'testing',
      });

      const qaApproval = createApprovalRequest(task.id, 'qa-review', {
        stage: 'testing',
        agent: 'tester',
        context: {
          stage: 'testing',
          agent: 'tester',
          testCoverage: 92,
          criticalBugsFound: 0,
          regressionTestsPassed: true,
        },
      });

      await store.saveApprovalState(qaApproval);

      // 6. Verify we now have two approval states for the task
      const taskApprovals = await store.getApprovalStatesByTask(task.id);
      expect(taskApprovals).toHaveLength(2);

      const approvedSecurity = taskApprovals.find(a => a.gateName === 'security-review');
      const pendingQA = taskApprovals.find(a => a.gateName === 'qa-review');

      expect(approvedSecurity?.status).toBe('approved');
      expect(pendingQA?.status).toBe('pending');

      // 7. QA team approves
      await store.updateApprovalState(qaApproval.id, {
        status: 'approved',
        approver: 'qa-team@company.com',
        respondedAt: new Date(),
        comment: 'QA review passed. All tests passing, good code coverage.',
      });

      // 8. Final verification - all approvals are now approved
      const finalApprovals = await store.getApprovalStatesByTask(task.id);
      expect(finalApprovals).toHaveLength(2);
      expect(finalApprovals.every(a => a.status === 'approved')).toBe(true);

      // 9. No more pending approvals
      const remainingPending = await store.getPendingApprovals();
      expect(remainingPending).toHaveLength(0);
    });

    it('should handle approval rejection and task blocking', async () => {
      const task = createTestTask('rejected');
      await store.createTask(task);

      // Create approval request
      const approval = createApprovalRequest(task.id, 'security-review', {
        context: {
          riskLevel: 'critical',
          securityConcerns: ['sql-injection', 'xss-vulnerability'],
        },
      });

      await store.saveApprovalState(approval);

      // Security team rejects the approval
      await store.updateApprovalState(approval.id, {
        status: 'denied',
        approver: 'security-lead@company.com',
        respondedAt: new Date(),
        comment: 'Critical security vulnerabilities found. Please fix SQL injection in user query and XSS in profile display.',
      });

      // Verify rejection is recorded
      const rejectedApproval = await store.getApprovalState(task.id, approval.id);
      expect(rejectedApproval?.status).toBe('denied');
      expect(rejectedApproval?.comment).toContain('Critical security vulnerabilities');

      // Task should be blocked (would be handled by orchestrator logic)
      // Here we just verify the approval state is correctly recorded
      const taskApprovals = await store.getApprovalStatesByTask(task.id);
      expect(taskApprovals).toHaveLength(1);
      expect(taskApprovals[0].status).toBe('denied');
    });

    it('should handle multiple approval requirements (consensus approval)', async () => {
      const task = createTestTask('consensus');
      await store.createTask(task);

      // Create approval requiring multiple approvers
      const consensusApproval = createApprovalRequest(task.id, 'architecture-review', {
        approvalsRequired: 3,
        approvalsReceived: 0,
        context: {
          changeType: 'architecture-breaking',
          impact: 'high',
          approvers: ['tech-lead', 'architect', 'product-owner'],
        },
      });

      await store.saveApprovalState(consensusApproval);

      // First approval
      const firstApproval = { ...consensusApproval };
      firstApproval.approvalsReceived = 1;
      firstApproval.status = 'pending'; // Still pending until all approvals received
      await store.saveApprovalState(firstApproval);

      // Second approval
      const secondApproval = { ...firstApproval };
      secondApproval.approvalsReceived = 2;
      await store.saveApprovalState(secondApproval);

      // Third and final approval
      const finalApproval = { ...secondApproval };
      finalApproval.approvalsReceived = 3;
      finalApproval.status = 'approved';
      finalApproval.approver = 'consensus-reached';
      finalApproval.respondedAt = new Date();
      finalApproval.comment = 'All three required approvals received: tech-lead, architect, product-owner';
      await store.saveApprovalState(finalApproval);

      // Verify final state
      const approvedConsensus = await store.getApprovalState(task.id, consensusApproval.id);
      expect(approvedConsensus?.approvalsReceived).toBe(3);
      expect(approvedConsensus?.approvalsRequired).toBe(3);
      expect(approvedConsensus?.status).toBe('approved');
    });

    it('should handle approval timeout scenarios', async () => {
      const task = createTestTask('timeout');
      await store.createTask(task);

      // Create approval with short timeout
      const timeoutApproval = createApprovalRequest(task.id, 'urgent-review', {
        timeoutMinutes: 1, // 1 minute timeout
        expiresAt: new Date(Date.now() - 5000), // Already expired (5 seconds ago)
      });

      await store.saveApprovalState(timeoutApproval);

      // Check for expired approvals
      const expiredApprovals = await store.getExpiredApprovals();
      expect(expiredApprovals).toHaveLength(1);
      expect(expiredApprovals[0].id).toBe(timeoutApproval.id);
      expect(expiredApprovals[0].status).toBe('pending');

      // Simulate timeout handling by denying expired approval
      await store.updateApprovalState(timeoutApproval.id, {
        status: 'denied',
        approver: 'system-timeout',
        respondedAt: new Date(),
        comment: 'Approval request timed out after 1 minute',
      });

      // Verify timeout handling
      const timedOutApproval = await store.getApprovalState(task.id, timeoutApproval.id);
      expect(timedOutApproval?.status).toBe('denied');
      expect(timedOutApproval?.comment).toContain('timed out');

      // Should no longer appear in expired list
      const remainingExpired = await store.getExpiredApprovals();
      expect(remainingExpired).toHaveLength(0);
    });
  });

  describe('Cross-Task Approval Analytics', () => {
    it('should provide insights across multiple tasks and gates', async () => {
      // Create multiple tasks with various approval states
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        const task = createTestTask(`analytics_${i}`);
        tasks.push(task);
        await store.createTask(task);
      }

      // Create different types of approvals
      const approvalData = [
        { taskIndex: 0, gate: 'security-review', status: 'approved' as ApprovalStatus },
        { taskIndex: 0, gate: 'qa-review', status: 'pending' as ApprovalStatus },
        { taskIndex: 1, gate: 'security-review', status: 'approved' as ApprovalStatus },
        { taskIndex: 1, gate: 'architecture-review', status: 'denied' as ApprovalStatus },
        { taskIndex: 2, gate: 'security-review', status: 'pending' as ApprovalStatus },
        { taskIndex: 3, gate: 'qa-review', status: 'approved' as ApprovalStatus },
        { taskIndex: 4, gate: 'security-review', status: 'pending' as ApprovalStatus },
        { taskIndex: 4, gate: 'qa-review', status: 'approved' as ApprovalStatus },
      ];

      for (const { taskIndex, gate, status } of approvalData) {
        const approval = createApprovalRequest(tasks[taskIndex].id, gate, { status });
        await store.saveApprovalState(approval);
      }

      // Analytics queries

      // 1. All security review approvals
      const securityApprovals = await store.getApprovalStatesByGate('security-review');
      expect(securityApprovals).toHaveLength(4);

      // 2. All pending approvals across all tasks
      const allPending = await store.getPendingApprovals();
      expect(allPending).toHaveLength(3); // security-review x2, qa-review x1

      // 3. QA review approvals
      const qaApprovals = await store.getApprovalStatesByGate('qa-review');
      expect(qaApprovals).toHaveLength(3);

      // 4. Denied approvals (architecture review)
      const architectureApprovals = await store.getApprovalStatesByGate('architecture-review');
      expect(architectureApprovals).toHaveLength(1);
      expect(architectureApprovals[0].status).toBe('denied');

      // 5. Task with multiple approvals
      const multipleApprovalsTask = await store.getApprovalStatesByTask(tasks[0].id);
      expect(multipleApprovalsTask).toHaveLength(2); // security + qa

      const statuses = multipleApprovalsTask.map(a => a.status);
      expect(statuses).toContain('approved');
      expect(statuses).toContain('pending');
    });
  });

  describe('Data Consistency and Integrity', () => {
    it('should maintain data consistency under concurrent operations', async () => {
      const task = createTestTask('concurrent');
      await store.createTask(task);

      const approval = createApprovalRequest(task.id, 'load-test');
      await store.saveApprovalState(approval);

      // Simulate concurrent updates (in real scenarios these might happen simultaneously)
      const updates = [
        { approver: 'user1@company.com', comment: 'First update' },
        { approver: 'user2@company.com', comment: 'Second update' },
        { status: 'approved' as const, comment: 'Third update' },
      ];

      // Apply updates sequentially (simulating rapid concurrent access)
      for (const update of updates) {
        await store.updateApprovalState(approval.id, update);
      }

      // Verify final state is consistent
      const finalState = await store.getApprovalState(task.id, approval.id);
      expect(finalState).toBeDefined();
      expect(finalState?.approver).toBe('user2@company.com'); // Last approver update
      expect(finalState?.status).toBe('approved'); // Last status update
      expect(finalState?.comment).toBe('Third update'); // Last comment update
    });

    it('should handle complex context objects properly', async () => {
      const task = createTestTask('complex_context');
      await store.createTask(task);

      const complexContext = {
        metadata: {
          author: 'developer@company.com',
          timestamp: new Date().toISOString(),
          version: '1.2.3',
        },
        files: [
          { path: 'src/auth/login.ts', changes: ['added oauth support', 'improved error handling'] },
          { path: 'src/middleware/auth.ts', changes: ['refactored middleware'] },
        ],
        metrics: {
          linesOfCode: 450,
          cyclomatic_complexity: 12,
          test_coverage: 89.5,
        },
        dependencies: {
          added: ['@auth/oauth', 'jsonwebtoken'],
          removed: ['old-auth-lib'],
          updated: [{ name: 'express', from: '4.18.0', to: '4.19.0' }],
        },
        riskAssessment: {
          level: 'medium',
          factors: ['new dependencies', 'auth changes'],
          mitigations: ['thorough testing', 'staged rollout'],
        },
      };

      const approval = createApprovalRequest(task.id, 'comprehensive-review', {
        context: complexContext,
      });

      await store.saveApprovalState(approval);

      // Retrieve and verify complex context
      const retrieved = await store.getApprovalState(task.id, approval.id);
      expect(retrieved?.context).toBeDefined();

      // Verify nested structure preservation
      expect(retrieved?.context?.metadata?.author).toBe('developer@company.com');
      expect(retrieved?.context?.files).toHaveLength(2);
      expect(retrieved?.context?.metrics?.test_coverage).toBe(89.5);
      expect(retrieved?.context?.dependencies?.added).toContain('@auth/oauth');
      expect(retrieved?.context?.riskAssessment?.level).toBe('medium');
    });
  });
});