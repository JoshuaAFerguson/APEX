import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, Mock } from 'vitest';
import { createServer } from './index.js';
import type { FastifyInstance } from 'fastify';
import { ApprovalDecisionRequest, ApprovalState, ApprovalDecisionResponse } from '@apexcli/core';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock the orchestrator methods
const mockGetPendingApprovals = vi.fn();
const mockGrantApproval = vi.fn();
const mockDenyApproval = vi.fn();
const mockGetApprovalStateById = vi.fn();

// Mock the orchestrator module
vi.mock('@apexcli/orchestrator', () => {
  return {
    ApexOrchestrator: class MockApexOrchestrator {
      public store = {
        getPendingApprovals: mockGetPendingApprovals,
        getApprovalStateById: mockGetApprovalStateById,
      };

      async initialize() {
        // Mock initialization
      }

      async getTask() {
        return null;
      }

      async getAgents() {
        return [];
      }

      async getConfig() {
        return {};
      }

      async grantApproval(approvalId: string, approver: string, comment?: string) {
        return mockGrantApproval(approvalId, approver, comment);
      }

      async denyApproval(approvalId: string, approver: string, reason: string) {
        return mockDenyApproval(approvalId, approver, reason);
      }

      on() {
        // Mock event listener
      }
    },
    DaemonManager: class MockDaemonManager {
      async getStatus() {
        return { running: false };
      }
    },
    HealthMonitor: class MockHealthMonitor {
      getHealthReport() {
        return {
          uptime: 1000,
          memoryUsage: process.memoryUsage(),
          taskCounts: { processed: 0, succeeded: 0, failed: 0, active: 0 },
          lastHealthCheck: new Date(),
          healthChecksPassed: 0,
          healthChecksFailed: 0,
          restartHistory: [],
        };
      }

      performHealthCheck() {
        // Mock health check
      }
    },
  };
});

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
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('GET /api/approvals', () => {
    it('should return empty list when no pending approvals exist', async () => {
      mockGetPendingApprovals.mockResolvedValue([]);

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
      expect(mockGetPendingApprovals).toHaveBeenCalledTimes(1);
    });

    it('should return list of pending approvals', async () => {
      const mockApprovals: ApprovalState[] = [
        {
          id: 'approval-task1-gate1',
          taskId: 'task1',
          gateName: 'approval-gate',
          status: 'pending' as const,
          requestedAt: new Date('2024-01-01T10:00:00Z'),
          stage: 'implementation',
          agent: 'developer',
          approvalsReceived: 0,
          approvalsRequired: 1,
        },
        {
          id: 'approval-task2-gate1',
          taskId: 'task2',
          gateName: 'security-review',
          status: 'pending' as const,
          requestedAt: new Date('2024-01-01T11:00:00Z'),
          stage: 'security',
          agent: 'security-agent',
          approvalsReceived: 0,
          approvalsRequired: 2,
        },
      ];

      mockGetPendingApprovals.mockResolvedValue(mockApprovals);

      const response = await server.inject({
        method: 'GET',
        url: '/api/approvals',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('approvals');
      expect(body).toHaveProperty('count', 2);
      expect(body).toHaveProperty('message', '2 pending approval(s) found');
      expect(body.approvals).toEqual(mockApprovals);
      expect(mockGetPendingApprovals).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors gracefully', async () => {
      mockGetPendingApprovals.mockRejectedValue(new Error('Database connection failed'));

      const response = await server.inject({
        method: 'GET',
        url: '/api/approvals',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Database connection failed');
      expect(mockGetPendingApprovals).toHaveBeenCalledTimes(1);
    });

    it('should handle unknown errors gracefully', async () => {
      mockGetPendingApprovals.mockRejectedValue('Unknown error');

      const response = await server.inject({
        method: 'GET',
        url: '/api/approvals',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Failed to list pending approvals');
      expect(mockGetPendingApprovals).toHaveBeenCalledTimes(1);
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
      expect(body).toHaveProperty('error', 'Approver is required');

      // Should not call orchestrator methods
      expect(mockGrantApproval).not.toHaveBeenCalled();
      expect(mockGetApprovalStateById).not.toHaveBeenCalled();
    });

    it('should handle valid approval request successfully', async () => {
      const approvalId = 'approval-test-task-gate-123';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'john.doe@example.com',
        comment: 'Approved after review',
      };

      const updatedState: ApprovalState = {
        id: approvalId,
        taskId: 'test-task',
        gateName: 'test-gate',
        status: 'approved' as const,
        approver: 'john.doe@example.com',
        requestedAt: new Date('2024-01-01T10:00:00Z'),
        respondedAt: new Date('2024-01-01T10:30:00Z'),
        comment: 'Approved after review',
        approvalsReceived: 1,
        approvalsRequired: 1,
      };

      mockGrantApproval.mockResolvedValue(undefined);
      mockGetApprovalStateById.mockResolvedValue(updatedState);

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/approve`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(200);
      const body: ApprovalDecisionResponse = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.message).toBe('Approval granted successfully');
      expect(body.willProceed).toBe(true);
      expect(body.approvalState).toEqual(updatedState);

      expect(mockGrantApproval).toHaveBeenCalledTimes(1);
      expect(mockGrantApproval).toHaveBeenCalledWith(approvalId, 'john.doe@example.com', 'Approved after review');
      expect(mockGetApprovalStateById).toHaveBeenCalledWith(approvalId);
    });

    it('should handle approval request without comment', async () => {
      const approvalId = 'approval-test-task-gate-456';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'jane.smith@example.com',
      };

      mockGrantApproval.mockResolvedValue(undefined);
      mockGetApprovalStateById.mockResolvedValue(null);

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/approve`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(200);
      const body: ApprovalDecisionResponse = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.message).toBe('Approval granted successfully');
      expect(body.willProceed).toBe(true);
      expect(body.approvalState).toBeUndefined();

      expect(mockGrantApproval).toHaveBeenCalledWith(approvalId, 'jane.smith@example.com', undefined);
    });

    it('should handle orchestrator errors gracefully', async () => {
      const approvalId = 'approval-invalid-task';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'john.doe@example.com',
        comment: 'Trying to approve',
      };

      mockGrantApproval.mockRejectedValue(new Error('Invalid approval ID format'));

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/approve`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Invalid approval ID format');
      expect(mockGrantApproval).toHaveBeenCalledTimes(1);
    });

    it('should handle non-Error exceptions gracefully', async () => {
      const approvalId = 'approval-test-task-gate-789';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'test@example.com',
        comment: 'Test approval',
      };

      mockGrantApproval.mockRejectedValue('Unknown error type');

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/approve`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Failed to grant approval');
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
      expect(body).toHaveProperty('error', 'Approver is required');

      expect(mockDenyApproval).not.toHaveBeenCalled();
      expect(mockGetApprovalStateById).not.toHaveBeenCalled();
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
      expect(body).toHaveProperty('error', 'Reason/comment is required when denying approval');

      expect(mockDenyApproval).not.toHaveBeenCalled();
      expect(mockGetApprovalStateById).not.toHaveBeenCalled();
    });

    it('should require non-empty comment/reason field', async () => {
      const approvalId = 'approval-test-task-gate-123';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'john.doe@example.com',
        comment: '', // Empty comment
      };

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/deny`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Reason/comment is required when denying approval');
    });

    it('should handle valid denial request successfully', async () => {
      const approvalId = 'approval-test-task-gate-123';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'john.doe@example.com',
        comment: 'This approach needs security review first',
      };

      const updatedState: ApprovalState = {
        id: approvalId,
        taskId: 'test-task',
        gateName: 'test-gate',
        status: 'denied' as const,
        approver: 'john.doe@example.com',
        requestedAt: new Date('2024-01-01T10:00:00Z'),
        respondedAt: new Date('2024-01-01T10:15:00Z'),
        comment: 'This approach needs security review first',
        approvalsReceived: 0,
        approvalsRequired: 1,
      };

      mockDenyApproval.mockResolvedValue(undefined);
      mockGetApprovalStateById.mockResolvedValue(updatedState);

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/deny`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(200);
      const body: ApprovalDecisionResponse = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.message).toBe('Approval denied successfully');
      expect(body.willProceed).toBe(false);
      expect(body.approvalState).toEqual(updatedState);

      expect(mockDenyApproval).toHaveBeenCalledTimes(1);
      expect(mockDenyApproval).toHaveBeenCalledWith(
        approvalId,
        'john.doe@example.com',
        'This approach needs security review first'
      );
      expect(mockGetApprovalStateById).toHaveBeenCalledWith(approvalId);
    });

    it('should handle denial when approval state is not found', async () => {
      const approvalId = 'approval-test-task-gate-456';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'jane.smith@example.com',
        comment: 'Rejected for valid reasons',
      };

      mockDenyApproval.mockResolvedValue(undefined);
      mockGetApprovalStateById.mockResolvedValue(null);

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/deny`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(200);
      const body: ApprovalDecisionResponse = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.message).toBe('Approval denied successfully');
      expect(body.willProceed).toBe(false);
      expect(body.approvalState).toBeUndefined();
    });

    it('should handle orchestrator errors gracefully', async () => {
      const approvalId = 'approval-invalid-task';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'john.doe@example.com',
        comment: 'Trying to deny',
      };

      mockDenyApproval.mockRejectedValue(new Error('Approval not found'));

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/deny`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Approval not found');
      expect(mockDenyApproval).toHaveBeenCalledTimes(1);
    });

    it('should handle non-Error exceptions gracefully', async () => {
      const approvalId = 'approval-test-task-gate-789';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'test@example.com',
        comment: 'Test denial reason',
      };

      mockDenyApproval.mockRejectedValue('Something went wrong');

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/deny`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Failed to deny approval');
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle invalid JSON payload gracefully', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/approvals/test-id/approve',
        payload: 'invalid json',
        headers: {
          'content-type': 'application/json',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle missing payload gracefully', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/approvals/test-id/approve',
        // No payload
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle very long approval IDs', async () => {
      const longId = 'approval-' + 'a'.repeat(1000);
      const requestBody: ApprovalDecisionRequest = {
        approver: 'test@example.com',
        comment: 'Test comment',
      };

      mockGrantApproval.mockRejectedValue(new Error('Approval ID too long'));

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${longId}/approve`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Approval ID too long');
    });

    it('should handle special characters in approval ID', async () => {
      const specialId = encodeURIComponent('approval-task#special&chars%');
      const requestBody: ApprovalDecisionRequest = {
        approver: 'test@example.com',
        comment: 'Test comment',
      };

      mockGrantApproval.mockResolvedValue(undefined);
      mockGetApprovalStateById.mockResolvedValue(null);

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${specialId}/approve`,
        payload: requestBody,
      });

      // Should handle URL encoding properly
      expect([200, 400]).toContain(response.statusCode);
    });
  });

  describe('Response structure validation', () => {
    it('should return properly structured approval response', async () => {
      const approvalId = 'approval-structure-test';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'structure.tester@example.com',
        comment: 'Testing response structure',
      };

      const mockState: ApprovalState = {
        id: approvalId,
        taskId: 'structure-test-task',
        gateName: 'structure-gate',
        status: 'approved' as const,
        approver: 'structure.tester@example.com',
        requestedAt: new Date('2024-01-01T10:00:00Z'),
        respondedAt: new Date('2024-01-01T10:05:00Z'),
        comment: 'Testing response structure',
        approvalsReceived: 1,
        approvalsRequired: 1,
      };

      mockGrantApproval.mockResolvedValue(undefined);
      mockGetApprovalStateById.mockResolvedValue(mockState);

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/approve`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Validate response structure matches ApprovalDecisionResponse schema
      expect(body).toHaveProperty('success');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('willProceed');
      expect(body).toHaveProperty('approvalState');

      expect(typeof body.success).toBe('boolean');
      expect(typeof body.message).toBe('string');
      expect(typeof body.willProceed).toBe('boolean');
      expect(typeof body.approvalState).toBe('object');
    });

    it('should return properly structured denial response', async () => {
      const approvalId = 'approval-denial-structure-test';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'denial.tester@example.com',
        comment: 'Testing denial response structure',
      };

      const mockState: ApprovalState = {
        id: approvalId,
        taskId: 'denial-structure-test-task',
        gateName: 'denial-structure-gate',
        status: 'denied' as const,
        approver: 'denial.tester@example.com',
        requestedAt: new Date('2024-01-01T10:00:00Z'),
        respondedAt: new Date('2024-01-01T10:05:00Z'),
        comment: 'Testing denial response structure',
        approvalsReceived: 0,
        approvalsRequired: 1,
      };

      mockDenyApproval.mockResolvedValue(undefined);
      mockGetApprovalStateById.mockResolvedValue(mockState);

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/deny`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Validate response structure
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('message', 'Approval denied successfully');
      expect(body).toHaveProperty('willProceed', false);
      expect(body).toHaveProperty('approvalState');
      expect(body.approvalState.status).toBe('denied');
    });
  });
});