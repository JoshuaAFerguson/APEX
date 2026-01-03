import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer } from '@apexcli/api';
import type { FastifyInstance } from 'fastify';
import { ApprovalState, Task, ApprovalDecisionResponse } from '@apexcli/core';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

interface ApprovalRequest {
  approver: string;
  comment?: string;
}

describe('Task Abort on Approval Denial Integration Tests', () => {
  let server: FastifyInstance;
  let orchestrator: ApexOrchestrator;
  let projectPath: string;

  beforeAll(async () => {
    // Create temporary directory for test project
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-abort-test-'));

    // Create .apex directory structure
    const apexDir = path.join(projectPath, '.apex');
    await fs.mkdir(apexDir, { recursive: true });

    // Create config.yaml with approval workflow
    const configContent = `
version: "1.0"
name: "task-abort-test"
description: "Integration test project for task abort on approval denial"
agents:
  planner:
    name: "Planning Agent"
    role: "Creates plans and requires approval"
  developer:
    name: "Development Agent"
    role: "Implements features after approval"
workflows:
  approval-workflow:
    name: "Feature Development with Approval"
    description: "Development workflow requiring approval at planning stage"
    stages:
      - name: "planning"
        agent: "planner"
        description: "Create implementation plan"
        gate: "plan-approval"
      - name: "implementation"
        agent: "developer"
        description: "Implement the feature"
    gates:
      - id: "plan-approval"
        name: "Plan Approval Gate"
        description: "Requires approval before implementation begins"
        required: true
        type: "approval"
        approversRequired: 1
        timeoutMinutes: 60
autonomy:
  level: "medium"
  requireApproval:
    - "high-risk-operations"
limits:
  maxTokens: 100000
  timeout: 1800
  costLimit: 10.00
`;
    await fs.writeFile(path.join(apexDir, 'config.yaml'), configContent);

    // Create agent files
    await fs.mkdir(path.join(apexDir, 'agents'), { recursive: true });

    await fs.writeFile(path.join(apexDir, 'agents', 'planner.md'), `
# Planning Agent

You are responsible for creating implementation plans that require approval before proceeding.

## Your Role
- Analyze requirements
- Create detailed implementation plans
- Wait for approval before proceeding

## Process
1. Analyze the task requirements
2. Create a comprehensive plan
3. Present plan for approval
4. Wait for approval decision
`);

    await fs.writeFile(path.join(apexDir, 'agents', 'developer.md'), `
# Development Agent

You implement features after plans have been approved.

## Your Role
- Implement approved plans
- Write code following best practices

## Process
1. Review approved plan
2. Implement the feature
`);

    // Create workflows directory
    await fs.mkdir(path.join(apexDir, 'workflows'), { recursive: true });

    await fs.writeFile(path.join(apexDir, 'workflows', 'approval-workflow.yaml'), `
name: "Feature Development with Approval"
description: "Development workflow requiring approval at planning stage"
stages:
  - name: "planning"
    agent: "planner"
    description: "Create implementation plan"
    gate: "plan-approval"
  - name: "implementation"
    agent: "developer"
    description: "Implement the feature"
gates:
  - id: "plan-approval"
    name: "Plan Approval Gate"
    description: "Requires approval before implementation begins"
    required: true
    type: "approval"
    approversRequired: 1
    timeoutMinutes: 60
`);

    // Create server and orchestrator
    server = await createServer({
      projectPath,
      port: 0, // Use random available port
      silent: true,
    });

    await server.ready();

    // Get direct access to orchestrator for integration testing
    orchestrator = new ApexOrchestrator({ projectPath });
    await orchestrator.initialize();
  });

  afterAll(async () => {
    await server.close();
    // Clean up test directory
    try {
      await fs.rm(projectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Clean up any existing tasks/approvals before each test
    try {
      const allTasks = await orchestrator.listTasks({});
      for (const task of allTasks) {
        try {
          await orchestrator.cancelTask(task.id);
        } catch {
          // Ignore cancellation errors
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Task Abort on Approval Denial', () => {
    it('should abort task when approval is denied via API', async () => {
      // Step 1: Create a task with approval gate
      const taskDescription = 'Implement high-risk database changes with potential data loss';
      const task = await orchestrator.createTask({
        description: taskDescription,
        workflow: 'approval-workflow',
        acceptanceCriteria: 'Database changes should be implemented safely without data loss',
      });

      expect(task).toBeDefined();
      expect(task.status).toBe('pending');
      const taskId = task.id;

      // Step 2: Start task execution which should pause at approval gate
      const executionPromise = orchestrator.executeTask(taskId);

      // Allow time for task to progress to approval gate
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify task is paused waiting for approval
      const pausedTask = await orchestrator.getTask(taskId);
      expect(pausedTask).toBeDefined();
      expect(pausedTask!.status).toBe('paused');

      // Step 3: Get the pending approval via API
      const listResponse = await server.inject({
        method: 'GET',
        url: '/api/approvals',
      });

      expect(listResponse.statusCode).toBe(200);
      const listBody = JSON.parse(listResponse.body);

      expect(listBody.count).toBeGreaterThan(0);
      expect(Array.isArray(listBody.approvals)).toBe(true);

      const pendingApproval = listBody.approvals.find(
        (approval: ApprovalState) => approval.taskId === taskId
      );

      expect(pendingApproval).toBeDefined();
      expect(pendingApproval.status).toBe('pending');
      expect(pendingApproval.gateName).toBe('plan-approval');

      // Step 4: Send denial via API
      const denialRequest: ApprovalRequest = {
        approver: 'senior-architect@company.com',
        comment: 'High risk approach detected - database changes need safer implementation strategy',
      };

      const denyResponse = await server.inject({
        method: 'POST',
        url: `/api/approvals/${pendingApproval.id}/deny`,
        payload: denialRequest,
      });

      expect(denyResponse.statusCode).toBe(200);
      const denyBody: ApprovalDecisionResponse = JSON.parse(denyResponse.body);

      // Verify API response for denial
      expect(denyBody.success).toBe(true);
      expect(denyBody.taskWillProceed).toBe(false);

      // Verify approval state is updated to denied
      expect(denyBody.approvalState).toBeDefined();
      expect(denyBody.approvalState!.status).toBe('denied');
      expect(denyBody.approvalState!.approver).toBe('senior-architect@company.com');
      expect(denyBody.approvalState!.comment).toBe('High risk approach detected - database changes need safer implementation strategy');

      // Step 5: Wait for task to be aborted and verify final state
      await new Promise(resolve => setTimeout(resolve, 200));

      const finalTask = await orchestrator.getTask(taskId);
      expect(finalTask).toBeDefined();

      // Verify task is marked as failed (aborted) with appropriate error message
      expect(finalTask!.status).toBe('failed');
      expect(finalTask!.error).toBeDefined();
      expect(finalTask!.error).toContain('Approval denied by senior-architect@company.com');
      expect(finalTask!.error).toContain('High risk approach detected - database changes need safer implementation strategy');

      // Step 6: Verify the approval is no longer in pending state
      const finalListResponse = await server.inject({
        method: 'GET',
        url: '/api/approvals',
      });

      const finalListBody = JSON.parse(finalListResponse.body);
      const stillPendingApprovals = finalListBody.approvals.filter(
        (approval: ApprovalState) => approval.taskId === taskId && approval.status === 'pending'
      );

      expect(stillPendingApprovals).toHaveLength(0);

      // Step 7: Verify we can get the denied approval state by ID
      const deniedApproval = await orchestrator.getApprovalStateById(pendingApproval.id);
      expect(deniedApproval).toBeDefined();
      expect(deniedApproval!.status).toBe('denied');
      expect(deniedApproval!.approver).toBe('senior-architect@company.com');
      expect(deniedApproval!.respondedAt).toBeDefined();

      // Wait for execution promise to complete (should resolve with failure)
      try {
        await executionPromise;
      } catch (error) {
        // Task execution may throw due to denial - this is expected
        expect(error).toBeDefined();
      }
    }, 15000);

    it('should emit approval:denied event when approval is denied', async () => {
      // Create task
      const task = await orchestrator.createTask({
        description: 'Test approval denial event emission',
        workflow: 'approval-workflow',
        acceptanceCriteria: 'Should emit events properly',
      });

      // Listen for approval:denied event
      const eventPromise = new Promise((resolve) => {
        orchestrator.once('approval:denied', (eventData) => {
          resolve(eventData);
        });
      });

      // Start execution
      const executionPromise = orchestrator.executeTask(task.id);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get approval and deny it
      const listResponse = await server.inject({
        method: 'GET',
        url: '/api/approvals',
      });

      const listBody = JSON.parse(listResponse.body);
      const pendingApproval = listBody.approvals.find(
        (approval: ApprovalState) => approval.taskId === task.id
      );

      expect(pendingApproval).toBeDefined();

      // Deny approval
      await server.inject({
        method: 'POST',
        url: `/api/approvals/${pendingApproval.id}/deny`,
        payload: {
          approver: 'event-tester@company.com',
          comment: 'Testing event emission on denial',
        },
      });

      // Verify event was emitted
      const eventData = await eventPromise;
      expect(eventData).toBeDefined();
      expect((eventData as any).taskId).toBe(task.id);
      expect((eventData as any).approver).toBe('event-tester@company.com');
      expect((eventData as any).reason).toBe('Testing event emission on denial');

      // Clean up
      try {
        await executionPromise;
      } catch {
        // Expected failure
      }
    }, 10000);

    it('should handle approval denial for non-existent approval gracefully', async () => {
      const nonExistentApprovalId = 'approval-nonexistent-task-gate-12345';

      const denyResponse = await server.inject({
        method: 'POST',
        url: `/api/approvals/${nonExistentApprovalId}/deny`,
        payload: {
          approver: 'test@company.com',
          comment: 'Attempting to deny non-existent approval',
        },
      });

      expect(denyResponse.statusCode).toBe(400);
      const body = JSON.parse(denyResponse.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('Approval request not found');
    });

    it('should reject denial request without required comment', async () => {
      const denyResponse = await server.inject({
        method: 'POST',
        url: '/api/approvals/test-approval-id/deny',
        payload: {
          approver: 'test@company.com',
          // Missing required comment
        },
      });

      expect(denyResponse.statusCode).toBe(400);
      const body = JSON.parse(denyResponse.body);
      expect(body.error).toBe('Reason/comment is required when denying approval');
    });

    it('should reject denial request without required approver', async () => {
      const denyResponse = await server.inject({
        method: 'POST',
        url: '/api/approvals/test-approval-id/deny',
        payload: {
          // Missing required approver
          comment: 'Test denial reason',
        },
      });

      expect(denyResponse.statusCode).toBe(400);
      const body = JSON.parse(denyResponse.body);
      expect(body.error).toBe('Approver is required');
    });
  });
});