import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createServer } from './index.js';
import type { FastifyInstance } from 'fastify';
import { ApprovalDecisionRequest, ApprovalState } from '@apexcli/core';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Approvals API Endpoints', () => {
  let server: FastifyInstance;
  let projectPath: string;

  beforeAll(async () => {
    // Create temporary directory for test project
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-'));

    // Create .apex directory structure
    const apexDir = path.join(projectPath, '.apex');
    await fs.mkdir(apexDir, { recursive: true });

    // Create minimal config.yaml
    const configContent = `
version: "1.0"
name: "test-project"
description: "Test project"
agents:
  test-agent:
    name: "Test Agent"
    role: "Tester"
workflows:
  test-workflow:
    name: "Test Workflow"
    stages:
      - name: "test-stage"
        agent: "test-agent"
        gate: "approval-gate"
    gates:
      - id: "approval-gate"
        name: "Approval Gate"
        description: "Test approval gate"
        required: true
`;
    await fs.writeFile(path.join(apexDir, 'config.yaml'), configContent);

    // Create agents directory
    await fs.mkdir(path.join(apexDir, 'agents'), { recursive: true });
    await fs.writeFile(path.join(apexDir, 'agents', 'test-agent.md'), '# Test Agent');

    // Create workflows directory
    await fs.mkdir(path.join(apexDir, 'workflows'), { recursive: true });

    // Create server instance
    server = await createServer({
      projectPath,
      port: 0, // Use random available port
      silent: true,
    });

    await server.ready();
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

  beforeEach(() => {
    // Clear any mocks
    vi.clearAllMocks();
  });

  describe('GET /api/approvals', () => {
    it('should return empty list when no pending approvals exist', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/approvals',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('approvals');
      expect(body).toHaveProperty('count', 0);
      expect(body).toHaveProperty('message', 'No pending approvals found');
      expect(Array.isArray(body.approvals)).toBe(true);
      expect(body.approvals).toHaveLength(0);
    });

    it('should handle database errors gracefully', async () => {
      // Mock the store method to throw an error
      const originalGetPendingApprovals = server.orchestrator?.store?.getPendingApprovals;
      if (server.orchestrator?.store) {
        server.orchestrator.store.getPendingApprovals = vi.fn().mockRejectedValue(
          new Error('Database connection failed')
        );
      }

      const response = await server.inject({
        method: 'GET',
        url: '/api/approvals',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('Database connection failed');

      // Restore original method
      if (server.orchestrator?.store && originalGetPendingApprovals) {
        server.orchestrator.store.getPendingApprovals = originalGetPendingApprovals;
      }
    });
  });

  describe('POST /api/approvals/:id/approve', () => {
    it('should require approver field', async () => {
      const approvalId = 'approval-test-task-gate-123';
      const requestBody: Partial<ApprovalDecisionRequest> = {
        // Missing approver
        comment: 'Looks good to me',
      };

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/approve`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toBe('Approver is required');
    });

    it('should handle valid approval request', async () => {
      const approvalId = 'approval-test-task-gate-123';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'john.doe@example.com',
        comment: 'Approved after review',
      };

      // Mock the orchestrator grantApproval method
      if (server.orchestrator) {
        server.orchestrator.grantApproval = vi.fn().mockResolvedValue(undefined);
        if (server.orchestrator.store) {
          server.orchestrator.store.getApprovalState = vi.fn().mockResolvedValue(null);
        }
      }

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/approve`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('message', 'Approval granted successfully');
      expect(body).toHaveProperty('willProceed', true);

      // Verify orchestrator method was called
      expect(server.orchestrator?.grantApproval).toHaveBeenCalledWith(
        approvalId,
        requestBody.approver,
        requestBody.comment
      );
    });

    it('should handle orchestrator errors gracefully', async () => {
      const approvalId = 'approval-invalid-task';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'john.doe@example.com',
        comment: 'Trying to approve',
      };

      // Mock the orchestrator to throw an error
      if (server.orchestrator) {
        server.orchestrator.grantApproval = vi.fn().mockRejectedValue(
          new Error('Invalid approval ID format')
        );
      }

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/approve`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toBe('Invalid approval ID format');
    });
  });

  describe('POST /api/approvals/:id/deny', () => {
    it('should require approver field', async () => {
      const approvalId = 'approval-test-task-gate-123';
      const requestBody: Partial<ApprovalDecisionRequest> = {
        // Missing approver
        comment: 'This needs changes',
      };

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/deny`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toBe('Approver is required');
    });

    it('should require comment/reason field', async () => {
      const approvalId = 'approval-test-task-gate-123';
      const requestBody: Partial<ApprovalDecisionRequest> = {
        approver: 'john.doe@example.com',
        // Missing comment
      };

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/deny`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toBe('Reason/comment is required when denying approval');
    });

    it('should handle valid denial request', async () => {
      const approvalId = 'approval-test-task-gate-123';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'john.doe@example.com',
        comment: 'This approach needs security review first',
      };

      // Mock the orchestrator denyApproval method
      if (server.orchestrator) {
        server.orchestrator.denyApproval = vi.fn().mockResolvedValue(undefined);
        if (server.orchestrator.store) {
          server.orchestrator.store.getApprovalState = vi.fn().mockResolvedValue(null);
        }
      }

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/deny`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('message', 'Approval denied successfully');
      expect(body).toHaveProperty('willProceed', false);

      // Verify orchestrator method was called
      expect(server.orchestrator?.denyApproval).toHaveBeenCalledWith(
        approvalId,
        requestBody.approver,
        requestBody.comment
      );
    });

    it('should handle orchestrator errors gracefully', async () => {
      const approvalId = 'approval-invalid-task';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'john.doe@example.com',
        comment: 'Trying to deny',
      };

      // Mock the orchestrator to throw an error
      if (server.orchestrator) {
        server.orchestrator.denyApproval = vi.fn().mockRejectedValue(
          new Error('Task not found for approval')
        );
      }

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/deny`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toBe('Task not found for approval');
    });
  });

  describe('Integration with ApprovalState', () => {
    it('should return approval state when available after approve', async () => {
      const approvalId = 'approval-test-task-gate-123';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'jane.smith@example.com',
        comment: 'Approved with minor suggestions',
      };

      // Mock approval state
      const mockApprovalState: ApprovalState = {
        id: approvalId,
        taskId: 'test-task',
        gateName: 'gate',
        status: 'approved',
        approver: requestBody.approver,
        requestedAt: new Date('2023-01-01T10:00:00Z'),
        respondedAt: new Date('2023-01-01T10:05:00Z'),
        comment: requestBody.comment,
        approvalsReceived: 1,
        approvalsRequired: 1,
      };

      // Mock the orchestrator methods
      if (server.orchestrator) {
        server.orchestrator.grantApproval = vi.fn().mockResolvedValue(undefined);
        if (server.orchestrator.store) {
          server.orchestrator.store.getApprovalState = vi.fn().mockResolvedValue(mockApprovalState);
        }
      }

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/approve`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('approvalState');
      expect(body.approvalState).toMatchObject({
        id: approvalId,
        taskId: 'test-task',
        status: 'approved',
        approver: requestBody.approver,
      });
    });
  });
});