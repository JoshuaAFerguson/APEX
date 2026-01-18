import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { ApprovalState, Task } from '@apexcli/core';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Confirmations API Integration Tests', () => {
  let server: FastifyInstance;
  let orchestrator: ApexOrchestrator;
  let projectPath: string;

  beforeAll(async () => {
    // Create temporary directory for test project
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-confirmation-test-'));

    // Create .apex directory structure
    const apexDir = path.join(projectPath, '.apex');
    await fs.mkdir(apexDir, { recursive: true });

    // Create config.yaml with confirmation workflow
    const configContent = `
version: "1.0"
name: "confirmation-integration-test"
description: "Integration test project for confirmation API"
agents:
  planner:
    name: "Planning Agent"
    role: "Creates plans and requires confirmation"
  developer:
    name: "Development Agent"
    role: "Implements features after confirmation"
workflows:
  confirmation-workflow:
    name: "Feature Development with Confirmation"
    description: "Development workflow requiring confirmations at key stages"
    stages:
      - name: "planning"
        agent: "planner"
        description: "Create implementation plan"
        gate: "plan-confirmation"
      - name: "implementation"
        agent: "developer"
        description: "Implement the feature"
        gate: "code-confirmation"
autonomy:
  level: "supervised"
  gates:
    plan-confirmation:
      type: "before-commit"
      description: "Requires confirmation before committing plan changes"
      required: true
    code-confirmation:
      type: "before-deploy"
      description: "Requires confirmation before deploying code"
      required: true
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
  });

  describe('POST /confirmations/:id/respond', () => {
    it('should accept a confirmation response with "accept"', async () => {
      // Create a test task first
      const task = await orchestrator.createTask({
        description: 'Test task requiring confirmation',
        workflow: 'confirmation-workflow',
        autonomy: { level: 'supervised' }
      });

      // Mock an approval state (simulating a pending confirmation)
      const confirmationId = 'test-confirmation-123';
      const mockApprovalState: ApprovalState = {
        requestId: confirmationId,
        gateName: 'plan-confirmation',
        status: 'pending',
        requestedAt: new Date(),
        context: { stage: 'planning', changesSummary: 'Test plan changes' },
        stage: 'planning',
        agent: 'planner'
      };

      // Mock the orchestrator methods for this test
      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = async (id: string, approver: string, comments?: string) => {
        expect(id).toBe(confirmationId);
        expect(approver).toBe('test-user');
        expect(comments).toBe('Looks good to proceed');
        return Promise.resolve();
      };

      orchestrator.getApprovalStateById = async (id: string) => {
        expect(id).toBe(confirmationId);
        return Promise.resolve({
          ...mockApprovalState,
          status: 'approved' as any,
          respondedBy: 'test-user',
          respondedAt: new Date()
        });
      };

      try {
        const response = await server.inject({
          method: 'POST',
          url: `/confirmations/${confirmationId}/respond`,
          payload: {
            response: 'accept',
            approver: 'test-user',
            comments: 'Looks good to proceed'
          }
        });

        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);

        expect(result).toMatchObject({
          success: true,
          confirmationId,
          response: 'accept',
          approver: 'test-user',
          comments: 'Looks good to proceed',
          forwarded: true
        });

        expect(result.confirmationState).toBeDefined();
        expect(result.confirmationState.status).toBe('approved');
        expect(result.timestamp).toBeDefined();
      } finally {
        // Restore original methods
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });

    it('should accept a confirmation response with "reject"', async () => {
      const confirmationId = 'test-confirmation-456';

      // Mock the orchestrator methods for this test
      const originalDenyApproval = orchestrator.denyApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.denyApproval = async (id: string, approver: string, reason: string) => {
        expect(id).toBe(confirmationId);
        expect(approver).toBe('test-reviewer');
        expect(reason).toBe('Needs more work');
        return Promise.resolve();
      };

      orchestrator.getApprovalStateById = async (id: string) => {
        return Promise.resolve({
          requestId: confirmationId,
          gateName: 'code-confirmation',
          status: 'denied' as any,
          requestedAt: new Date(),
          respondedBy: 'test-reviewer',
          respondedAt: new Date(),
          context: { stage: 'implementation', reason: 'Needs more work' },
          stage: 'implementation',
          agent: 'developer'
        });
      };

      try {
        const response = await server.inject({
          method: 'POST',
          url: `/confirmations/${confirmationId}/respond`,
          payload: {
            response: 'reject',
            approver: 'test-reviewer',
            comments: 'Needs more work'
          }
        });

        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);

        expect(result).toMatchObject({
          success: true,
          confirmationId,
          response: 'reject',
          approver: 'test-reviewer',
          comments: 'Needs more work',
          forwarded: true
        });

        expect(result.confirmationState).toBeDefined();
        expect(result.confirmationState.status).toBe('denied');
      } finally {
        // Restore original methods
        orchestrator.denyApproval = originalDenyApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });

    it('should require confirmation ID', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/confirmations//respond',
        payload: {
          response: 'accept',
          approver: 'test-user'
        }
      });

      expect(response.statusCode).toBe(404); // Route not found due to empty ID
    });

    it('should require valid response value', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/confirmations/test-123/respond',
        payload: {
          response: 'invalid',
          approver: 'test-user'
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.body);
      expect(result.error).toContain('Response is required and must be either "accept" or "reject"');
    });

    it('should require comments when rejecting', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/confirmations/test-123/respond',
        payload: {
          response: 'reject',
          approver: 'test-user'
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.body);
      expect(result.error).toContain('Comments are required when rejecting a confirmation');
    });

    it('should default approver to "anonymous" when not provided', async () => {
      const confirmationId = 'test-confirmation-789';

      // Mock the orchestrator methods
      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = async (id: string, approver: string, comments?: string) => {
        expect(approver).toBe('anonymous');
        return Promise.resolve();
      };

      orchestrator.getApprovalStateById = async (id: string) => {
        return Promise.resolve({
          requestId: confirmationId,
          gateName: 'plan-confirmation',
          status: 'approved' as any,
          requestedAt: new Date(),
          respondedBy: 'anonymous',
          respondedAt: new Date(),
          context: {},
          stage: 'planning',
          agent: 'planner'
        });
      };

      try {
        const response = await server.inject({
          method: 'POST',
          url: `/confirmations/${confirmationId}/respond`,
          payload: {
            response: 'accept'
          }
        });

        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.approver).toBe('anonymous');
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });

    it('should handle orchestrator errors gracefully', async () => {
      const confirmationId = 'test-error-confirmation';

      // Mock the orchestrator to throw an error
      const originalGrantApproval = orchestrator.grantApproval;
      orchestrator.grantApproval = async () => {
        throw new Error('Orchestrator error: confirmation not found');
      };

      try {
        const response = await server.inject({
          method: 'POST',
          url: `/confirmations/${confirmationId}/respond`,
          payload: {
            response: 'accept',
            approver: 'test-user'
          }
        });

        expect(response.statusCode).toBe(400);
        const result = JSON.parse(response.body);
        expect(result.error).toContain('Orchestrator error: confirmation not found');
        expect(result.confirmationId).toBe(confirmationId);
        expect(result.response).toBe('accept');
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
      }
    });
  });

  describe('PUT /confirmations/:id/respond', () => {
    it('should accept a confirmation using PUT method', async () => {
      const confirmationId = 'test-put-confirmation';

      // Mock the orchestrator methods
      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = async (id: string, approver: string, comments?: string) => {
        expect(id).toBe(confirmationId);
        expect(approver).toBe('put-user');
        expect(comments).toBe('Approved via PUT');
        return Promise.resolve();
      };

      orchestrator.getApprovalStateById = async (id: string) => {
        return Promise.resolve({
          requestId: confirmationId,
          gateName: 'plan-confirmation',
          status: 'approved' as any,
          requestedAt: new Date(),
          respondedBy: 'put-user',
          respondedAt: new Date(),
          context: {},
          stage: 'planning',
          agent: 'planner'
        });
      };

      try {
        const response = await server.inject({
          method: 'PUT',
          url: `/confirmations/${confirmationId}/respond`,
          payload: {
            approver: 'put-user',
            comments: 'Approved via PUT'
          }
        });

        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);

        expect(result).toMatchObject({
          success: true,
          confirmationId,
          response: 'accept',
          approver: 'put-user',
          comments: 'Approved via PUT',
          forwarded: true
        });
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });

    it('should require confirmation ID for PUT method', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/confirmations//respond',
        payload: {
          approver: 'test-user'
        }
      });

      expect(response.statusCode).toBe(404); // Route not found due to empty ID
    });

    it('should handle orchestrator errors gracefully for PUT method', async () => {
      const confirmationId = 'test-put-error';

      // Mock the orchestrator to throw an error
      const originalGrantApproval = orchestrator.grantApproval;
      orchestrator.grantApproval = async () => {
        throw new Error('PUT orchestrator error');
      };

      try {
        const response = await server.inject({
          method: 'PUT',
          url: `/confirmations/${confirmationId}/respond`,
          payload: {
            approver: 'test-user'
          }
        });

        expect(response.statusCode).toBe(400);
        const result = JSON.parse(response.body);
        expect(result.error).toContain('PUT orchestrator error');
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
      }
    });
  });

  describe('Response forwarding to orchestrator', () => {
    it('should forward confirmation responses to the orchestrator correctly', async () => {
      const confirmationId = 'forwarding-test-123';
      let grantApprovalCalled = false;
      let denyApprovalCalled = false;

      // Mock orchestrator methods to track calls
      const originalGrantApproval = orchestrator.grantApproval;
      const originalDenyApproval = orchestrator.denyApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = async (id: string, approver: string, comments?: string) => {
        grantApprovalCalled = true;
        expect(id).toBe(confirmationId);
        return Promise.resolve();
      };

      orchestrator.denyApproval = async (id: string, approver: string, reason: string) => {
        denyApprovalCalled = true;
        expect(id).toBe(confirmationId);
        return Promise.resolve();
      };

      orchestrator.getApprovalStateById = async (id: string) => {
        return Promise.resolve({
          requestId: confirmationId,
          gateName: 'test-gate',
          status: grantApprovalCalled ? 'approved' as any : 'denied' as any,
          requestedAt: new Date(),
          context: {},
          stage: 'test',
          agent: 'test'
        });
      };

      try {
        // Test acceptance forwarding
        await server.inject({
          method: 'POST',
          url: `/confirmations/${confirmationId}/respond`,
          payload: {
            response: 'accept',
            approver: 'test-user'
          }
        });

        expect(grantApprovalCalled).toBe(true);

        // Reset and test rejection forwarding
        grantApprovalCalled = false;
        await server.inject({
          method: 'POST',
          url: `/confirmations/${confirmationId}/respond`,
          payload: {
            response: 'reject',
            approver: 'test-user',
            comments: 'Test rejection'
          }
        });

        expect(denyApprovalCalled).toBe(true);
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.denyApproval = originalDenyApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });
  });

  describe('Response payload validation', () => {
    it('should validate response payload structure', async () => {
      // Test with completely invalid JSON
      const response1 = await server.inject({
        method: 'POST',
        url: '/confirmations/test-123/respond',
        payload: 'invalid json',
        headers: {
          'content-type': 'application/json'
        }
      });

      expect(response1.statusCode).toBe(400);

      // Test with missing response field
      const response2 = await server.inject({
        method: 'POST',
        url: '/confirmations/test-123/respond',
        payload: {
          approver: 'test-user'
        }
      });

      expect(response2.statusCode).toBe(400);
      const result2 = JSON.parse(response2.body);
      expect(result2.error).toContain('Response is required');

      // Test with null response
      const response3 = await server.inject({
        method: 'POST',
        url: '/confirmations/test-123/respond',
        payload: {
          response: null,
          approver: 'test-user'
        }
      });

      expect(response3.statusCode).toBe(400);
    });

    it('should handle edge cases in confirmation ID', async () => {
      // Mock orchestrator for the valid case
      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = async () => Promise.resolve();
      orchestrator.getApprovalStateById = async () => Promise.resolve({
        requestId: 'valid-id',
        gateName: 'test',
        status: 'approved' as any,
        requestedAt: new Date(),
        context: {},
        stage: 'test',
        agent: 'test'
      });

      try {
        // Test with whitespace-only confirmation ID
        const response1 = await server.inject({
          method: 'POST',
          url: '/confirmations/   /respond',
          payload: {
            response: 'accept',
            approver: 'test-user'
          }
        });

        expect(response1.statusCode).toBe(404); // URL routing issue

        // Test with very long confirmation ID (should work)
        const longId = 'a'.repeat(1000);
        const response2 = await server.inject({
          method: 'POST',
          url: `/confirmations/${longId}/respond`,
          payload: {
            response: 'accept',
            approver: 'test-user'
          }
        });

        expect(response2.statusCode).toBe(200);
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });
  });
});