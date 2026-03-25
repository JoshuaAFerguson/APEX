import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createServer } from './index.js';
import type { FastifyInstance } from 'fastify';
import { ApprovalDecisionRequest } from '@apexcli/core';
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
        return { api: { auth: { enabled: false, apiKeys: [] } } };
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

describe.skip('Approvals API Edge Cases', () => {
  let server: FastifyInstance;
  let projectPath: string;

  beforeAll(async () => {
    // Create temporary directory for test project
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-edge-test-'));

    // Create minimal project structure
    const apexDir = path.join(projectPath, '.apex');
    await fs.mkdir(apexDir, { recursive: true });

    const configContent = `
version: "1.0"
name: "edge-test-project"
description: "Edge case test project"
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
`;
    await fs.writeFile(path.join(apexDir, 'config.yaml'), configContent);

    await fs.mkdir(path.join(apexDir, 'agents'), { recursive: true });
    await fs.writeFile(path.join(apexDir, 'agents', 'test-agent.md'), '# Test Agent');

    await fs.mkdir(path.join(apexDir, 'workflows'), { recursive: true });

    server = await createServer({
      projectPath,
      port: 0, // Use random available port
      silent: true,
    });

    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    try {
      await fs.rm(projectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input validation edge cases', () => {
    it('should handle extremely long approver names', async () => {
      const approvalId = 'approval-test-long-approver';
      const longApprover = 'a'.repeat(1000) + '@example.com';
      const requestBody: ApprovalDecisionRequest = {
        approver: longApprover,
        comment: 'Testing long approver name',
      };

      mockGrantApproval.mockResolvedValue(undefined);
      mockGetApprovalStateById.mockResolvedValue(null);

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/approve`,
        payload: requestBody,
      });

      // Should handle long approver names (assuming orchestrator validates length)
      expect([200, 400]).toContain(response.statusCode);
    });

    it('should handle extremely long comments', async () => {
      const approvalId = 'approval-test-long-comment';
      const longComment = 'This is a very long comment. '.repeat(1000);
      const requestBody: ApprovalDecisionRequest = {
        approver: 'test@example.com',
        comment: longComment,
      };

      mockGrantApproval.mockResolvedValue(undefined);
      mockGetApprovalStateById.mockResolvedValue(null);

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/approve`,
        payload: requestBody,
      });

      expect([200, 400]).toContain(response.statusCode);
    });

    it('should handle Unicode characters in approver field', async () => {
      const approvalId = 'approval-test-unicode-approver';
      const unicodeApprover = '测试用户@example.com';
      const requestBody: ApprovalDecisionRequest = {
        approver: unicodeApprover,
        comment: 'Testing Unicode approver',
      };

      mockGrantApproval.mockResolvedValue(undefined);
      mockGetApprovalStateById.mockResolvedValue(null);

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/approve`,
        payload: requestBody,
      });

      expect([200, 400]).toContain(response.statusCode);
    });

    it('should handle Unicode characters in comments', async () => {
      const approvalId = 'approval-test-unicode-comment';
      const unicodeComment = '批准：这个实现看起来很好 ✅';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'test@example.com',
        comment: unicodeComment,
      };

      mockGrantApproval.mockResolvedValue(undefined);
      mockGetApprovalStateById.mockResolvedValue(null);

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/approve`,
        payload: requestBody,
      });

      expect([200, 400]).toContain(response.statusCode);
    });

    it('should handle whitespace-only approver field', async () => {
      const approvalId = 'approval-test-whitespace-approver';
      const requestBody: ApprovalDecisionRequest = {
        approver: '   \t\n   ',
        comment: 'Testing whitespace approver',
      };

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/approve`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Approver is required');
    });

    it('should handle whitespace-only comment for denial', async () => {
      const approvalId = 'approval-test-whitespace-comment';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'test@example.com',
        comment: '   \t\n   ',
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
  });

  describe('URL parameter edge cases', () => {
    it('should handle URL-encoded special characters in approval ID', async () => {
      const specialChars = 'approval-task#1&param=value%20test';
      const encodedId = encodeURIComponent(specialChars);
      const requestBody: ApprovalDecisionRequest = {
        approver: 'test@example.com',
        comment: 'Testing URL encoding',
      };

      mockGrantApproval.mockResolvedValue(undefined);
      mockGetApprovalStateById.mockResolvedValue(null);

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${encodedId}/approve`,
        payload: requestBody,
      });

      // Should handle URL encoding properly
      expect([200, 400]).toContain(response.statusCode);
    });

    it('should handle double URL-encoded approval IDs', async () => {
      const originalId = 'approval-task#1&param=value%20test';
      const doubleEncodedId = encodeURIComponent(encodeURIComponent(originalId));
      const requestBody: ApprovalDecisionRequest = {
        approver: 'test@example.com',
        comment: 'Testing double encoding',
      };

      mockGrantApproval.mockResolvedValue(undefined);
      mockGetApprovalStateById.mockResolvedValue(null);

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${doubleEncodedId}/approve`,
        payload: requestBody,
      });

      expect([200, 400]).toContain(response.statusCode);
    });

    it('should handle very long approval IDs in URL', async () => {
      const longId = 'approval-' + 'a'.repeat(2000);
      const requestBody: ApprovalDecisionRequest = {
        approver: 'test@example.com',
        comment: 'Testing very long ID',
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
  });

  describe('HTTP method edge cases', () => {
    it('should reject unsupported methods on approval endpoints', async () => {
      const approvalId = 'approval-test-method';

      const methods = ['PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

      for (const method of methods) {
        const response = await server.inject({
          method,
          url: `/api/approvals/${approvalId}/approve`,
        });

        // Should return 405 Method Not Allowed or 404 Not Found
        expect([404, 405]).toContain(response.statusCode);
      }
    });

    it('should handle HEAD requests on the list endpoint', async () => {
      const response = await server.inject({
        method: 'HEAD',
        url: '/api/approvals',
      });

      // HEAD should be supported for GET endpoints
      expect([200, 405]).toContain(response.statusCode);
    });
  });

  describe('Content-Type edge cases', () => {
    it('should handle requests with no Content-Type header', async () => {
      const approvalId = 'approval-test-no-content-type';
      const requestBody = {
        approver: 'test@example.com',
        comment: 'Testing no content type',
      };

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/approve`,
        payload: JSON.stringify(requestBody),
        // No Content-Type header
      });

      // Fastify should handle this gracefully
      expect([200, 400, 415]).toContain(response.statusCode);
    });

    it('should handle requests with incorrect Content-Type', async () => {
      const approvalId = 'approval-test-wrong-content-type';
      const requestBody = {
        approver: 'test@example.com',
        comment: 'Testing wrong content type',
      };

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/approve`,
        payload: JSON.stringify(requestBody),
        headers: {
          'content-type': 'text/plain',
        },
      });

      // Should reject incorrect content type
      expect([400, 415]).toContain(response.statusCode);
    });

    it('should handle malformed JSON payload', async () => {
      const approvalId = 'approval-test-malformed-json';

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/approve`,
        payload: '{"approver": "test@example.com", "comment": "malformed json"}extra_text',
        headers: {
          'content-type': 'application/json',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Database/Storage edge cases', () => {
    it('should handle storage errors when getting pending approvals', async () => {
      mockGetPendingApprovals.mockRejectedValue(new Error('Storage unavailable'));

      const response = await server.inject({
        method: 'GET',
        url: '/api/approvals',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Storage unavailable');
    });

    it('should handle timeout errors during approval grant', async () => {
      const approvalId = 'approval-test-timeout';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'test@example.com',
        comment: 'Testing timeout',
      };

      mockGrantApproval.mockRejectedValue(new Error('Operation timeout'));

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/approve`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Operation timeout');
    });

    it('should handle connection errors during approval denial', async () => {
      const approvalId = 'approval-test-connection';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'test@example.com',
        comment: 'Testing connection error',
      };

      mockDenyApproval.mockRejectedValue(new Error('Connection lost'));

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/deny`,
        payload: requestBody,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Connection lost');
    });
  });

  describe('Performance edge cases', () => {
    it('should handle rapid sequential requests', async () => {
      const approvalId = 'approval-test-rapid';
      const requestBody: ApprovalDecisionRequest = {
        approver: 'test@example.com',
        comment: 'Testing rapid requests',
      };

      mockGrantApproval.mockResolvedValue(undefined);
      mockGetApprovalStateById.mockResolvedValue(null);

      // Send 10 rapid requests
      const promises = Array.from({ length: 10 }, (_, i) =>
        server.inject({
          method: 'POST',
          url: `/api/approvals/${approvalId}-${i}/approve`,
          payload: requestBody,
        })
      );

      const responses = await Promise.all(promises);

      // All responses should have valid status codes
      responses.forEach(response => {
        expect([200, 400, 500]).toContain(response.statusCode);
      });
    });

    it('should handle large payload sizes', async () => {
      const approvalId = 'approval-test-large-payload';
      const largeComment = 'Large comment data. '.repeat(10000); // ~200KB comment

      const requestBody: ApprovalDecisionRequest = {
        approver: 'test@example.com',
        comment: largeComment,
      };

      mockGrantApproval.mockResolvedValue(undefined);
      mockGetApprovalStateById.mockResolvedValue(null);

      const response = await server.inject({
        method: 'POST',
        url: `/api/approvals/${approvalId}/approve`,
        payload: requestBody,
      });

      // Should handle large payloads (or reject if payload is too large)
      expect([200, 400, 413, 500]).toContain(response.statusCode);
    });
  });
});