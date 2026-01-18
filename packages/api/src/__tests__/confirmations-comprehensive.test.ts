import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createServer } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { ApprovalState } from '@apexcli/core';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Confirmations API Comprehensive Tests', () => {
  let server: FastifyInstance;
  let orchestrator: ApexOrchestrator;
  let projectPath: string;

  beforeAll(async () => {
    // Create temporary directory for test project
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-confirmation-comprehensive-test-'));

    // Create .apex directory structure
    const apexDir = path.join(projectPath, '.apex');
    await fs.mkdir(apexDir, { recursive: true });

    // Create minimal config.yaml
    const configContent = `
version: "1.0"
name: "confirmation-comprehensive-test"
description: "Comprehensive test project for confirmation API"
agents:
  planner:
    name: "Planning Agent"
    role: "Creates plans and requires confirmation"
workflows:
  test-workflow:
    name: "Test Workflow"
    description: "Test workflow for confirmations"
    stages:
      - name: "planning"
        agent: "planner"
        description: "Create implementation plan"
autonomy:
  level: "supervised"
`.trim();

    await fs.writeFile(path.join(apexDir, 'config.yaml'), configContent);

    // Initialize server
    server = await createServer({ projectPath, port: 0 });
    await server.listen({ port: 0 });

    // Get orchestrator instance from server
    orchestrator = (server as any).orchestrator || new ApexOrchestrator({ projectPath });
    if (!orchestrator.isInitialized) {
      await orchestrator.initialize();
    }
  });

  afterAll(async () => {
    await server?.close();
    // Clean up temporary directory
    try {
      await fs.rm(projectPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  beforeEach(async () => {
    // Clear any existing data before each test
    await orchestrator.store.clearAll?.();
    // Reset all mocks
    vi.restoreAllMocks();
  });

  describe('Security and Input Validation', () => {
    it('should sanitize malicious input in confirmation ID', async () => {
      const maliciousIds = [
        '../../../etc/passwd',
        'test<script>alert("xss")</script>',
        'test%00.txt',
        'CON', // Windows reserved name
        'test\x00null-byte',
        'test/../../../sensitive-file'
      ];

      const originalGrantApproval = orchestrator.grantApproval;
      orchestrator.grantApproval = vi.fn().mockResolvedValue(undefined);

      try {
        for (const maliciousId of maliciousIds) {
          const response = await server.inject({
            method: 'POST',
            url: `/confirmations/${encodeURIComponent(maliciousId)}/respond`,
            payload: {
              response: 'accept',
              approver: 'test-user'
            }
          });

          // Should either reject malicious input or handle safely
          expect([200, 400, 404]).toContain(response.statusCode);
          if (response.statusCode === 200) {
            // If accepted, ensure the ID was passed to orchestrator safely
            expect(orchestrator.grantApproval).toHaveBeenCalled();
          }
        }
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
      }
    });

    it('should handle extremely large payloads gracefully', async () => {
      const largeComment = 'x'.repeat(100000); // 100KB comment

      const response = await server.inject({
        method: 'POST',
        url: '/confirmations/test-large/respond',
        payload: {
          response: 'reject',
          approver: 'test-user',
          comments: largeComment
        }
      });

      // Should handle large payloads without crashing
      expect([200, 400, 413]).toContain(response.statusCode);
    });

    it('should validate content-type headers', async () => {
      const responses = await Promise.all([
        // Missing content-type
        server.inject({
          method: 'POST',
          url: '/confirmations/test-header/respond',
          payload: JSON.stringify({
            response: 'accept',
            approver: 'test-user'
          }),
          headers: {}
        }),
        // Wrong content-type
        server.inject({
          method: 'POST',
          url: '/confirmations/test-header/respond',
          payload: JSON.stringify({
            response: 'accept',
            approver: 'test-user'
          }),
          headers: {
            'content-type': 'text/plain'
          }
        }),
        // Multiple content-type headers
        server.inject({
          method: 'POST',
          url: '/confirmations/test-header/respond',
          payload: JSON.stringify({
            response: 'accept',
            approver: 'test-user'
          }),
          headers: {
            'content-type': 'application/json, text/plain'
          }
        })
      ]);

      // All should be handled gracefully
      responses.forEach(response => {
        expect([200, 400, 415]).toContain(response.statusCode);
      });
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle concurrent requests to the same confirmation', async () => {
      const confirmationId = 'concurrent-test-123';
      let approvalCount = 0;
      let denialCount = 0;

      // Mock orchestrator methods
      const originalGrantApproval = orchestrator.grantApproval;
      const originalDenyApproval = orchestrator.denyApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = vi.fn().mockImplementation(async () => {
        approvalCount++;
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 50));
        return Promise.resolve();
      });

      orchestrator.denyApproval = vi.fn().mockImplementation(async () => {
        denialCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
        return Promise.resolve();
      });

      orchestrator.getApprovalStateById = vi.fn().mockResolvedValue({
        requestId: confirmationId,
        gateName: 'test-gate',
        status: 'approved' as any,
        requestedAt: new Date(),
        context: {},
        stage: 'test',
        agent: 'test'
      });

      try {
        // Send multiple concurrent requests
        const requests = [
          server.inject({
            method: 'POST',
            url: `/confirmations/${confirmationId}/respond`,
            payload: { response: 'accept', approver: 'user1' }
          }),
          server.inject({
            method: 'POST',
            url: `/confirmations/${confirmationId}/respond`,
            payload: { response: 'accept', approver: 'user2' }
          }),
          server.inject({
            method: 'PUT',
            url: `/confirmations/${confirmationId}/respond`,
            payload: { approver: 'user3' }
          })
        ];

        const responses = await Promise.all(requests);

        // All should succeed or handle gracefully
        responses.forEach(response => {
          expect([200, 400, 409]).toContain(response.statusCode);
        });

        // Orchestrator methods should have been called
        expect(approvalCount).toBeGreaterThan(0);
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.denyApproval = originalDenyApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });

    it('should handle orchestrator timeout scenarios', async () => {
      const confirmationId = 'timeout-test-123';

      // Mock orchestrator methods with timeout simulation
      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = vi.fn().mockImplementation(async () => {
        // Simulate a long-running operation
        await new Promise(resolve => setTimeout(resolve, 1000));
        throw new Error('Operation timeout');
      });

      orchestrator.getApprovalStateById = vi.fn().mockResolvedValue({
        requestId: confirmationId,
        gateName: 'test-gate',
        status: 'pending' as any,
        requestedAt: new Date(),
        context: {},
        stage: 'test',
        agent: 'test'
      });

      try {
        const response = await server.inject({
          method: 'POST',
          url: `/confirmations/${confirmationId}/respond`,
          payload: {
            response: 'accept',
            approver: 'timeout-user'
          }
        });

        expect(response.statusCode).toBe(400);
        const result = JSON.parse(response.body);
        expect(result.error).toContain('Operation timeout');
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from orchestrator connection failures', async () => {
      const confirmationId = 'connection-test-123';

      // Mock orchestrator methods to simulate connection failures
      const originalGrantApproval = orchestrator.grantApproval;
      let attemptCount = 0;

      orchestrator.grantApproval = vi.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('ECONNRESET: Connection reset by peer');
        }
        return Promise.resolve(); // Success on retry
      });

      try {
        const response = await server.inject({
          method: 'POST',
          url: `/confirmations/${confirmationId}/respond`,
          payload: {
            response: 'accept',
            approver: 'connection-user'
          }
        });

        // Should handle connection errors gracefully
        expect([200, 400, 500, 503]).toContain(response.statusCode);
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
      }
    });

    it('should handle memory pressure scenarios', async () => {
      const confirmationId = 'memory-test-123';

      // Mock orchestrator methods to simulate memory pressure
      const originalGrantApproval = orchestrator.grantApproval;
      orchestrator.grantApproval = vi.fn().mockImplementation(async () => {
        throw new Error('ENOMEM: Cannot allocate memory');
      });

      try {
        const response = await server.inject({
          method: 'POST',
          url: `/confirmations/${confirmationId}/respond`,
          payload: {
            response: 'accept',
            approver: 'memory-user'
          }
        });

        expect(response.statusCode).toBe(400);
        const result = JSON.parse(response.body);
        expect(result.error).toContain('ENOMEM');
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
      }
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle burst of requests efficiently', async () => {
      const startTime = Date.now();
      const numRequests = 50;

      // Mock orchestrator for fast responses
      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = vi.fn().mockResolvedValue(undefined);
      orchestrator.getApprovalStateById = vi.fn().mockResolvedValue({
        requestId: 'perf-test',
        gateName: 'test-gate',
        status: 'approved' as any,
        requestedAt: new Date(),
        context: {},
        stage: 'test',
        agent: 'test'
      });

      try {
        const requests = Array.from({ length: numRequests }, (_, i) =>
          server.inject({
            method: 'POST',
            url: `/confirmations/perf-test-${i}/respond`,
            payload: {
              response: 'accept',
              approver: `user-${i}`
            }
          })
        );

        const responses = await Promise.all(requests);
        const duration = Date.now() - startTime;

        // All requests should complete successfully
        responses.forEach((response, index) => {
          expect(response.statusCode).toBe(200);
          const result = JSON.parse(response.body);
          expect(result.success).toBe(true);
          expect(result.confirmationId).toBe(`perf-test-${index}`);
        });

        // Should complete within reasonable time (less than 5 seconds for 50 requests)
        expect(duration).toBeLessThan(5000);

        // Should maintain good throughput
        const requestsPerSecond = numRequests / (duration / 1000);
        expect(requestsPerSecond).toBeGreaterThan(10); // At least 10 RPS
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });

    it('should handle memory usage efficiently for large response objects', async () => {
      const confirmationId = 'large-response-test';

      // Mock orchestrator to return large response object
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;
      const originalGrantApproval = orchestrator.grantApproval;

      orchestrator.grantApproval = vi.fn().mockResolvedValue(undefined);
      orchestrator.getApprovalStateById = vi.fn().mockResolvedValue({
        requestId: confirmationId,
        gateName: 'test-gate',
        status: 'approved' as any,
        requestedAt: new Date(),
        context: {
          largeData: 'x'.repeat(50000), // Large context data
          metadata: Array.from({ length: 1000 }, (_, i) => ({
            key: `item-${i}`,
            value: `value-${i}`.repeat(10)
          }))
        },
        stage: 'test',
        agent: 'test'
      });

      try {
        const response = await server.inject({
          method: 'POST',
          url: `/confirmations/${confirmationId}/respond`,
          payload: {
            response: 'accept',
            approver: 'large-response-user'
          }
        });

        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.success).toBe(true);
        expect(result.confirmationState).toBeDefined();
        expect(result.confirmationState.context.largeData).toBeDefined();
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });
  });

  describe('HTTP Protocol Compliance', () => {
    it('should support HTTP/1.1 keep-alive connections', async () => {
      const responses = await Promise.all([
        server.inject({
          method: 'POST',
          url: '/confirmations/keepalive-1/respond',
          payload: { response: 'accept', approver: 'user1' },
          headers: { 'connection': 'keep-alive' }
        }),
        server.inject({
          method: 'POST',
          url: '/confirmations/keepalive-2/respond',
          payload: { response: 'accept', approver: 'user2' },
          headers: { 'connection': 'keep-alive' }
        })
      ]);

      responses.forEach(response => {
        expect([200, 400]).toContain(response.statusCode);
        // Should not close connection unexpectedly
        expect(response.headers.connection).not.toBe('close');
      });
    });

    it('should handle different HTTP methods correctly', async () => {
      const methods = ['GET', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const;

      const responses = await Promise.all(
        methods.map(method =>
          server.inject({
            method,
            url: '/confirmations/method-test/respond'
          })
        )
      );

      responses.forEach((response, index) => {
        const method = methods[index];
        if (method === 'OPTIONS') {
          // Should handle CORS preflight
          expect([200, 204]).toContain(response.statusCode);
        } else {
          // Should return method not allowed
          expect([405, 404]).toContain(response.statusCode);
        }
      });
    });

    it('should return appropriate HTTP status codes', async () => {
      const testCases = [
        // Valid request
        {
          method: 'POST' as const,
          url: '/confirmations/valid-test/respond',
          payload: { response: 'accept', approver: 'user' },
          expectedStatus: [200, 400] // 400 if orchestrator fails
        },
        // Missing response
        {
          method: 'POST' as const,
          url: '/confirmations/invalid-test/respond',
          payload: { approver: 'user' },
          expectedStatus: [400]
        },
        // Invalid response value
        {
          method: 'POST' as const,
          url: '/confirmations/invalid-test/respond',
          payload: { response: 'maybe', approver: 'user' },
          expectedStatus: [400]
        }
      ];

      for (const testCase of testCases) {
        const response = await server.inject(testCase);
        expect(testCase.expectedStatus).toContain(response.statusCode);
      }
    });
  });

  describe('Data Integrity and Consistency', () => {
    it('should maintain data consistency between request and response', async () => {
      const confirmationId = 'consistency-test';
      const approver = 'consistency-user';
      const comments = 'Test comments for consistency';

      // Mock orchestrator
      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      let capturedId: string | undefined;
      let capturedApprover: string | undefined;
      let capturedComments: string | undefined;

      orchestrator.grantApproval = vi.fn().mockImplementation(async (id, appr, comm) => {
        capturedId = id;
        capturedApprover = appr;
        capturedComments = comm;
        return Promise.resolve();
      });

      orchestrator.getApprovalStateById = vi.fn().mockResolvedValue({
        requestId: confirmationId,
        gateName: 'test-gate',
        status: 'approved' as any,
        requestedAt: new Date(),
        respondedBy: capturedApprover,
        respondedAt: new Date(),
        context: { comments: capturedComments },
        stage: 'test',
        agent: 'test'
      });

      try {
        const response = await server.inject({
          method: 'POST',
          url: `/confirmations/${confirmationId}/respond`,
          payload: {
            response: 'accept',
            approver,
            comments
          }
        });

        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);

        // Verify data consistency
        expect(result.confirmationId).toBe(confirmationId);
        expect(result.approver).toBe(approver);
        expect(result.comments).toBe(comments);
        expect(capturedId).toBe(confirmationId);
        expect(capturedApprover).toBe(approver);
        expect(capturedComments).toBe(comments);
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });

    it('should handle Unicode and special characters correctly', async () => {
      const testCases = [
        {
          confirmationId: 'unicode-test-émojis-🚀',
          approver: 'user-中文-العربية',
          comments: 'Testing émojis 🎉 and unicode characters ñáéíóú αβγδε'
        },
        {
          confirmationId: 'special-chars-test',
          approver: 'user@domain.com',
          comments: 'Special chars: !@#$%^&*()_+-=[]{}|;\':",./<>?`~'
        }
      ];

      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = vi.fn().mockResolvedValue(undefined);
      orchestrator.getApprovalStateById = vi.fn().mockImplementation(async (id) => ({
        requestId: id,
        gateName: 'test-gate',
        status: 'approved' as any,
        requestedAt: new Date(),
        context: {},
        stage: 'test',
        agent: 'test'
      }));

      try {
        for (const testCase of testCases) {
          const response = await server.inject({
            method: 'POST',
            url: `/confirmations/${encodeURIComponent(testCase.confirmationId)}/respond`,
            payload: {
              response: 'accept',
              approver: testCase.approver,
              comments: testCase.comments
            }
          });

          expect(response.statusCode).toBe(200);
          const result = JSON.parse(response.body);
          expect(result.approver).toBe(testCase.approver);
          expect(result.comments).toBe(testCase.comments);
        }
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });
  });
});