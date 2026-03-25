import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer } from './index.js';
import type { FastifyInstance } from 'fastify';
import { ApprovalDecisionRequest, ApprovalState, Task } from '@apexcli/core';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe.skip('Approvals API Integration Tests', () => {
  let server: FastifyInstance;
  let orchestrator: ApexOrchestrator;
  let projectPath: string;

  beforeAll(async () => {
    // Create temporary directory for test project
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-integration-test-'));

    // Create .apex directory structure
    const apexDir = path.join(projectPath, '.apex');
    await fs.mkdir(apexDir, { recursive: true });

    // Create comprehensive config.yaml with approval workflow
    const configContent = `
version: "1.0"
name: "approval-integration-test"
description: "Integration test project for approval API"
agents:
  planner:
    name: "Planning Agent"
    role: "Creates plans and requires approval"
  developer:
    name: "Development Agent"
    role: "Implements features after approval"
  reviewer:
    name: "Review Agent"
    role: "Reviews code before final approval"
workflows:
  approval-workflow:
    name: "Feature Development with Approval"
    description: "Development workflow requiring approvals at key stages"
    stages:
      - name: "planning"
        agent: "planner"
        description: "Create implementation plan"
        gate: "plan-approval"
      - name: "implementation"
        agent: "developer"
        description: "Implement the feature"
        gate: "code-review"
      - name: "review"
        agent: "reviewer"
        description: "Review implementation"
        gate: "final-approval"
    gates:
      - id: "plan-approval"
        name: "Plan Approval Gate"
        description: "Requires approval before implementation begins"
        required: true
        type: "approval"
        approversRequired: 1
        timeoutMinutes: 60
      - id: "code-review"
        name: "Code Review Gate"
        description: "Requires code review before final stage"
        required: true
        type: "approval"
        approversRequired: 1
        timeoutMinutes: 120
      - id: "final-approval"
        name: "Final Approval Gate"
        description: "Final approval before deployment"
        required: true
        type: "approval"
        approversRequired: 2
        timeoutMinutes: 30
autonomy:
  level: "medium"
  requireApproval:
    - "high-risk-operations"
    - "external-integrations"
    - "data-modifications"
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
5. Proceed or revise based on feedback
`);

    await fs.writeFile(path.join(apexDir, 'agents', 'developer.md'), `
# Development Agent

You implement features after plans have been approved.

## Your Role
- Implement approved plans
- Write code following best practices
- Request code review when complete

## Process
1. Review approved plan
2. Implement the feature
3. Request code review
4. Address review feedback
`);

    await fs.writeFile(path.join(apexDir, 'agents', 'reviewer.md'), `
# Review Agent

You review implementations and ensure quality standards.

## Your Role
- Review code quality
- Check for security issues
- Verify requirements are met
- Provide final approval

## Process
1. Review implementation
2. Check for issues
3. Provide feedback or approval
4. Ensure quality standards
`);

    // Create workflows directory
    await fs.mkdir(path.join(apexDir, 'workflows'), { recursive: true });

    await fs.writeFile(path.join(apexDir, 'workflows', 'approval-workflow.yaml'), `
name: "Feature Development with Approval"
description: "Development workflow requiring approvals at key stages"
stages:
  - name: "planning"
    agent: "planner"
    description: "Create implementation plan"
    gate: "plan-approval"
  - name: "implementation"
    agent: "developer"
    description: "Implement the feature"
    gate: "code-review"
  - name: "review"
    agent: "reviewer"
    description: "Review implementation"
    gate: "final-approval"
gates:
  - id: "plan-approval"
    name: "Plan Approval Gate"
    description: "Requires approval before implementation begins"
    required: true
    type: "approval"
    approversRequired: 1
    timeoutMinutes: 60
  - id: "code-review"
    name: "Code Review Gate"
    description: "Requires code review before final stage"
    required: true
    type: "approval"
    approversRequired: 1
    timeoutMinutes: 120
  - id: "final-approval"
    name: "Final Approval Gate"
    description: "Final approval before deployment"
    required: true
    type: "approval"
    approversRequired: 2
    timeoutMinutes: 30
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
      // Clear database state between tests if needed
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

  describe('Full Approval Workflow Integration', () => {
    it('should handle complete approval workflow from task creation to completion', async () => {
      // Step 1: Create a task that will require approvals
      const taskDescription = 'Create API endpoints for user management with proper validation and security';
      const task = await orchestrator.createTask({
        description: taskDescription,
        workflow: 'approval-workflow',
        acceptanceCriteria: 'API endpoints should handle CRUD operations, validate input, implement authentication',
      });

      expect(task).toBeDefined();
      expect(task.status).toBe('pending');

      // Step 2: Start task execution which should pause at first approval gate
      const executionPromise = orchestrator.executeTask(task.id);

      // Allow some time for task to progress to approval gate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 3: Check that pending approvals are listed via API
      const listResponse = await server.inject({
        method: 'GET',
        url: '/api/approvals',
      });

      expect(listResponse.statusCode).toBe(200);
      const listBody = JSON.parse(listResponse.body);

      // Should have at least one pending approval
      expect(listBody.count).toBeGreaterThan(0);
      expect(Array.isArray(listBody.approvals)).toBe(true);

      const pendingApproval = listBody.approvals[0] as ApprovalState;
      expect(pendingApproval.status).toBe('pending');
      expect(pendingApproval.taskId).toBe(task.id);

      // Step 4: Approve the first gate via API
      const approvalRequest: ApprovalDecisionRequest = {
        approver: 'tech-lead@company.com',
        comment: 'Plan looks comprehensive, approved to proceed with implementation',
      };

      const approveResponse = await server.inject({
        method: 'POST',
        url: `/api/approvals/${pendingApproval.id}/approve`,
        payload: approvalRequest,
      });

      expect(approveResponse.statusCode).toBe(200);
      const approveBody = JSON.parse(approveResponse.body);
      expect(approveBody.success).toBe(true);
      expect(approveBody.willProceed).toBe(true);
      expect(approveBody.message).toBe('Approval granted successfully');

      // Step 5: Verify approval state is updated
      expect(approveBody.approvalState).toBeDefined();
      expect(approveBody.approvalState.status).toBe('approved');
      expect(approveBody.approvalState.approver).toBe('tech-lead@company.com');
      expect(approveBody.approvalState.comment).toBe('Plan looks comprehensive, approved to proceed with implementation');

      // Clean up
      try {
        await orchestrator.cancelTask(task.id);
      } catch {
        // Ignore cleanup errors
      }
    }, 10000);

    it('should handle approval denial workflow', async () => {
      // Create a task
      const task = await orchestrator.createTask({
        description: 'Implement database migration with potential breaking changes',
        workflow: 'approval-workflow',
        acceptanceCriteria: 'Migration should preserve all existing data',
      });

      // Start execution to reach approval gate
      const executionPromise = orchestrator.executeTask(task.id);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get pending approval
      const listResponse = await server.inject({
        method: 'GET',
        url: '/api/approvals',
      });

      const listBody = JSON.parse(listResponse.body);
      const pendingApproval = listBody.approvals.find((a: ApprovalState) => a.taskId === task.id);

      if (pendingApproval) {
        // Deny the approval
        const denialRequest: ApprovalDecisionRequest = {
          approver: 'database-admin@company.com',
          comment: 'Migration approach needs revision - potential data loss risk detected',
        };

        const denyResponse = await server.inject({
          method: 'POST',
          url: `/api/approvals/${pendingApproval.id}/deny`,
          payload: denialRequest,
        });

        expect(denyResponse.statusCode).toBe(200);
        const denyBody = JSON.parse(denyResponse.body);
        expect(denyBody.success).toBe(true);
        expect(denyBody.willProceed).toBe(false);
        expect(denyBody.message).toBe('Approval denied successfully');

        // Verify denial state
        expect(denyBody.approvalState).toBeDefined();
        expect(denyBody.approvalState.status).toBe('denied');
        expect(denyBody.approvalState.approver).toBe('database-admin@company.com');
        expect(denyBody.approvalState.comment).toBe('Migration approach needs revision - potential data loss risk detected');
      }

      // Clean up
      try {
        await orchestrator.cancelTask(task.id);
      } catch {
        // Ignore cleanup errors
      }
    }, 10000);

    it('should handle multiple approvals for the same task', async () => {
      // Create task that will go through multiple approval gates
      const task = await orchestrator.createTask({
        description: 'Implement payment processing with external service integration',
        workflow: 'approval-workflow',
        acceptanceCriteria: 'Secure payment processing with proper error handling',
      });

      const executionPromise = orchestrator.executeTask(task.id);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get first approval
      let listResponse = await server.inject({
        method: 'GET',
        url: '/api/approvals',
      });

      let listBody = JSON.parse(listResponse.body);
      let pendingApproval = listBody.approvals.find((a: ApprovalState) => a.taskId === task.id);

      if (pendingApproval) {
        // Approve first gate
        await server.inject({
          method: 'POST',
          url: `/api/approvals/${pendingApproval.id}/approve`,
          payload: {
            approver: 'architect@company.com',
            comment: 'Architecture approved for payment integration',
          },
        });

        // Allow task to progress to next gate
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check for second approval gate
        listResponse = await server.inject({
          method: 'GET',
          url: '/api/approvals',
        });

        listBody = JSON.parse(listResponse.body);
        const secondApproval = listBody.approvals.find((a: ApprovalState) =>
          a.taskId === task.id && a.status === 'pending'
        );

        if (secondApproval && secondApproval.id !== pendingApproval.id) {
          // Approve second gate
          const secondApprovalResponse = await server.inject({
            method: 'POST',
            url: `/api/approvals/${secondApproval.id}/approve`,
            payload: {
              approver: 'security-lead@company.com',
              comment: 'Security review passed for payment integration',
            },
          });

          expect(secondApprovalResponse.statusCode).toBe(200);
          const secondApprovalBody = JSON.parse(secondApprovalResponse.body);
          expect(secondApprovalBody.success).toBe(true);
        }
      }

      // Clean up
      try {
        await orchestrator.cancelTask(task.id);
      } catch {
        // Ignore cleanup errors
      }
    }, 15000);
  });

  describe('API Error Handling Integration', () => {
    it('should handle non-existent approval ID gracefully', async () => {
      const nonExistentId = 'approval-nonexistent-task-gate-12345';

      const approveResponse = await server.inject({
        method: 'POST',
        url: `/api/approvals/${nonExistentId}/approve`,
        payload: {
          approver: 'test@company.com',
          comment: 'Attempting to approve non-existent approval',
        },
      });

      expect(approveResponse.statusCode).toBe(400);
      const body = JSON.parse(approveResponse.body);
      expect(body).toHaveProperty('error');
    });

    it('should handle invalid approval ID format gracefully', async () => {
      const invalidId = 'invalid-format-id';

      const denyResponse = await server.inject({
        method: 'POST',
        url: `/api/approvals/${invalidId}/deny`,
        payload: {
          approver: 'test@company.com',
          comment: 'Testing invalid ID format',
        },
      });

      expect(denyResponse.statusCode).toBe(400);
      const body = JSON.parse(denyResponse.body);
      expect(body).toHaveProperty('error');
    });

    it('should validate request payload properly', async () => {
      // Test with invalid approver
      const invalidApprovalRequest = {
        // Missing approver
        comment: 'This should fail validation',
      };

      const response = await server.inject({
        method: 'POST',
        url: '/api/approvals/test-id/approve',
        payload: invalidApprovalRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Approver is required');
    });

    it('should handle empty comment for denial requests', async () => {
      const invalidDenialRequest = {
        approver: 'test@company.com',
        comment: '', // Empty comment should be rejected for denials
      };

      const response = await server.inject({
        method: 'POST',
        url: '/api/approvals/test-id/deny',
        payload: invalidDenialRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Reason/comment is required when denying approval');
    });
  });

  describe('API Response Format Validation', () => {
    it('should return consistent response format for pending approvals list', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/approvals',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Validate response structure
      expect(body).toHaveProperty('approvals');
      expect(body).toHaveProperty('count');
      expect(body).toHaveProperty('message');

      expect(Array.isArray(body.approvals)).toBe(true);
      expect(typeof body.count).toBe('number');
      expect(typeof body.message).toBe('string');
      expect(body.count).toBe(body.approvals.length);
    });

    it('should include proper message for different approval counts', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/approvals',
      });

      const body = JSON.parse(response.body);

      if (body.count === 0) {
        expect(body.message).toBe('No pending approvals found');
      } else {
        expect(body.message).toBe(`${body.count} pending approval(s) found`);
      }
    });
  });

  describe('Concurrent Approval Handling', () => {
    it('should handle concurrent approval attempts gracefully', async () => {
      // Create a task that will need approval
      const task = await orchestrator.createTask({
        description: 'Test concurrent approvals',
        workflow: 'approval-workflow',
      });

      const executionPromise = orchestrator.executeTask(task.id);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get pending approval
      const listResponse = await server.inject({
        method: 'GET',
        url: '/api/approvals',
      });

      const listBody = JSON.parse(listResponse.body);
      const pendingApproval = listBody.approvals.find((a: ApprovalState) => a.taskId === task.id);

      if (pendingApproval) {
        // Attempt concurrent approvals
        const approvalPromises = [
          server.inject({
            method: 'POST',
            url: `/api/approvals/${pendingApproval.id}/approve`,
            payload: {
              approver: 'user1@company.com',
              comment: 'First approval attempt',
            },
          }),
          server.inject({
            method: 'POST',
            url: `/api/approvals/${pendingApproval.id}/approve`,
            payload: {
              approver: 'user2@company.com',
              comment: 'Second approval attempt',
            },
          }),
        ];

        const responses = await Promise.all(approvalPromises);

        // At least one should succeed, others should either succeed or fail gracefully
        const successCount = responses.filter(r => r.statusCode === 200).length;
        expect(successCount).toBeGreaterThan(0);

        // Failed responses should have proper error handling
        const failedResponses = responses.filter(r => r.statusCode !== 200);
        failedResponses.forEach(response => {
          expect([400, 500]).toContain(response.statusCode);
          const body = JSON.parse(response.body);
          expect(body).toHaveProperty('error');
        });
      }

      // Clean up
      try {
        await orchestrator.cancelTask(task.id);
      } catch {
        // Ignore cleanup errors
      }
    }, 10000);
  });
});