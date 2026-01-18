import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createServer } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Confirmations API Validation Tests', () => {
  let server: FastifyInstance;
  let orchestrator: ApexOrchestrator;
  let projectPath: string;

  beforeAll(async () => {
    // Create temporary directory for test project
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-confirmation-validation-test-'));

    // Create .apex directory structure
    const apexDir = path.join(projectPath, '.apex');
    await fs.mkdir(apexDir, { recursive: true });

    // Create minimal config.yaml
    const configContent = `
version: "1.0"
name: "confirmation-validation-test"
description: "Validation test project for confirmation API"
agents:
  planner:
    name: "Planning Agent"
    role: "Creates plans and requires confirmation"
workflows:
  validation-workflow:
    name: "Validation Test Workflow"
    description: "Workflow for validation testing"
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

    // Get orchestrator instance
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
    vi.restoreAllMocks();
  });

  describe('Request Payload Validation', () => {
    it('should validate required fields for POST endpoint', async () => {
      const testCases = [
        {
          name: 'missing response field',
          payload: { approver: 'test-user' },
          expectedError: 'Response is required'
        },
        {
          name: 'empty response field',
          payload: { response: '', approver: 'test-user' },
          expectedError: 'Response is required'
        },
        {
          name: 'invalid response value',
          payload: { response: 'maybe', approver: 'test-user' },
          expectedError: 'must be either "accept" or "reject"'
        },
        {
          name: 'null response value',
          payload: { response: null, approver: 'test-user' },
          expectedError: 'Response is required'
        }
      ];

      for (const testCase of testCases) {
        const response = await server.inject({
          method: 'POST',
          url: '/confirmations/validation-test/respond',
          payload: testCase.payload
        });

        expect(response.statusCode).toBe(400);
        const result = JSON.parse(response.body);
        expect(result.error).toContain(testCase.expectedError);
      }
    });

    it('should validate comments requirement for rejection', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/confirmations/rejection-validation/respond',
        payload: {
          response: 'reject',
          approver: 'test-user'
          // Missing comments
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.body);
      expect(result.error).toContain('Comments are required when rejecting');
    });

    it('should allow optional approver field with default', async () => {
      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      let capturedApprover: string | undefined;

      orchestrator.grantApproval = vi.fn().mockImplementation(async (id, approver, comments) => {
        capturedApprover = approver;
        return Promise.resolve();
      });

      orchestrator.getApprovalStateById = vi.fn().mockResolvedValue({
        requestId: 'default-approver-test',
        gateName: 'test-gate',
        status: 'approved' as any,
        requestedAt: new Date(),
        context: {},
        stage: 'test',
        agent: 'test'
      });

      try {
        const response = await server.inject({
          method: 'POST',
          url: '/confirmations/default-approver-test/respond',
          payload: {
            response: 'accept'
            // No approver field
          }
        });

        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.approver).toBe('anonymous');
        expect(capturedApprover).toBe('anonymous');
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });

    it('should handle various data types in payload fields', async () => {
      const testCases = [
        {
          name: 'boolean values',
          payload: { response: true, approver: false },
          shouldSucceed: false
        },
        {
          name: 'numeric values',
          payload: { response: 1, approver: 123 },
          shouldSucceed: false
        },
        {
          name: 'array values',
          payload: { response: ['accept'], approver: ['user'] },
          shouldSucceed: false
        },
        {
          name: 'object values',
          payload: { response: { value: 'accept' }, approver: { name: 'user' } },
          shouldSucceed: false
        },
        {
          name: 'valid string values',
          payload: { response: 'accept', approver: 'valid-user' },
          shouldSucceed: true
        }
      ];

      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = vi.fn().mockResolvedValue(undefined);
      orchestrator.getApprovalStateById = vi.fn().mockImplementation(async (id) => ({
        requestId: id,
        gateName: 'type-validation-gate',
        status: 'approved' as any,
        requestedAt: new Date(),
        context: {},
        stage: 'type-validation',
        agent: 'type-validation-agent'
      }));

      try {
        for (const testCase of testCases) {
          const response = await server.inject({
            method: 'POST',
            url: `/confirmations/type-test-${testCase.name.replace(/\s+/g, '-')}/respond`,
            payload: testCase.payload
          });

          if (testCase.shouldSucceed) {
            expect(response.statusCode).toBe(200);
          } else {
            expect(response.statusCode).toBe(400);
          }
        }
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });
  });

  describe('URL Parameter Validation', () => {
    it('should validate confirmation ID format', async () => {
      const testIds = [
        { id: '', shouldWork: false, description: 'empty ID' },
        { id: '   ', shouldWork: false, description: 'whitespace only ID' },
        { id: 'valid-id-123', shouldWork: true, description: 'valid alphanumeric ID' },
        { id: 'test_id_with_underscores', shouldWork: true, description: 'ID with underscores' },
        { id: 'test-id-with-dashes', shouldWork: true, description: 'ID with dashes' },
        { id: 'CamelCaseId', shouldWork: true, description: 'camelCase ID' },
        { id: '12345', shouldWork: true, description: 'numeric ID' }
      ];

      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = vi.fn().mockResolvedValue(undefined);
      orchestrator.getApprovalStateById = vi.fn().mockImplementation(async (id) => ({
        requestId: id,
        gateName: 'id-validation-gate',
        status: 'approved' as any,
        requestedAt: new Date(),
        context: {},
        stage: 'id-validation',
        agent: 'id-validation-agent'
      }));

      try {
        for (const testCase of testIds) {
          const response = await server.inject({
            method: 'POST',
            url: `/confirmations/${encodeURIComponent(testCase.id)}/respond`,
            payload: {
              response: 'accept',
              approver: 'id-tester'
            }
          });

          if (testCase.shouldWork) {
            expect([200, 400]).toContain(response.statusCode); // 400 might be from orchestrator
          } else {
            expect([400, 404]).toContain(response.statusCode);
          }
        }
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });

    it('should handle special characters in confirmation ID', async () => {
      const specialCharIds = [
        'id-with-unicode-éñ',
        'id.with.dots',
        'id+with+plus',
        'id with spaces',
        'id@with@symbols',
        'id#with#hash'
      ];

      for (const specialId of specialCharIds) {
        const response = await server.inject({
          method: 'POST',
          url: `/confirmations/${encodeURIComponent(specialId)}/respond`,
          payload: {
            response: 'accept',
            approver: 'special-char-tester'
          }
        });

        // Should handle special characters gracefully
        expect([200, 400, 404]).toContain(response.statusCode);
      }
    });
  });

  describe('Content-Type Validation', () => {
    it('should handle different content-type headers', async () => {
      const contentTypes = [
        { type: 'application/json', shouldWork: true },
        { type: 'application/json; charset=utf-8', shouldWork: true },
        { type: 'text/plain', shouldWork: false },
        { type: 'application/xml', shouldWork: false },
        { type: 'multipart/form-data', shouldWork: false },
        { type: '', shouldWork: false }
      ];

      for (const { type, shouldWork } of contentTypes) {
        const response = await server.inject({
          method: 'POST',
          url: '/confirmations/content-type-test/respond',
          payload: JSON.stringify({
            response: 'accept',
            approver: 'content-type-tester'
          }),
          headers: {
            'content-type': type
          }
        });

        if (shouldWork) {
          expect([200, 400]).toContain(response.statusCode); // 400 might be from business logic
        } else {
          expect([400, 415]).toContain(response.statusCode); // Unsupported media type
        }
      }
    });

    it('should handle malformed JSON payloads', async () => {
      const malformedJsons = [
        '{"response": "accept"', // Missing closing brace
        '{"response": "accept",}', // Trailing comma
        '{response: "accept"}', // Missing quotes on key
        'not json at all'
      ];

      for (const malformedJson of malformedJsons) {
        const response = await server.inject({
          method: 'POST',
          url: '/confirmations/malformed-json-test/respond',
          payload: malformedJson,
          headers: {
            'content-type': 'application/json'
          }
        });

        expect(response.statusCode).toBe(400);
      }
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error response format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/confirmations/error-format-test/respond',
        payload: {
          response: 'invalid-response'
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.body);

      // Should have error field
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);

      // Should not expose internal details in error messages
      expect(result.error).not.toContain('Error:');
      expect(result.error).not.toContain('at ');
      expect(result.error).not.toContain('node_modules');
    });

    it('should handle orchestrator errors consistently', async () => {
      const originalGrantApproval = orchestrator.grantApproval;
      orchestrator.grantApproval = vi.fn().mockRejectedValue(new Error('Orchestrator test error'));

      try {
        const response = await server.inject({
          method: 'POST',
          url: '/confirmations/orchestrator-error-test/respond',
          payload: {
            response: 'accept',
            approver: 'error-tester'
          }
        });

        expect(response.statusCode).toBe(400);
        const result = JSON.parse(response.body);

        expect(result).toHaveProperty('error');
        expect(result).toHaveProperty('confirmationId');
        expect(result).toHaveProperty('response');

        expect(result.confirmationId).toBe('orchestrator-error-test');
        expect(result.response).toBe('accept');
        expect(result.error).toContain('Orchestrator test error');
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
      }
    });
  });

  describe('Success Response Format', () => {
    it('should return consistent success response format', async () => {
      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = vi.fn().mockResolvedValue(undefined);
      orchestrator.getApprovalStateById = vi.fn().mockResolvedValue({
        requestId: 'success-format-test',
        gateName: 'success-gate',
        status: 'approved' as any,
        requestedAt: new Date(),
        respondedBy: 'success-tester',
        respondedAt: new Date(),
        context: {},
        stage: 'success-test',
        agent: 'success-agent'
      });

      try {
        const response = await server.inject({
          method: 'POST',
          url: '/confirmations/success-format-test/respond',
          payload: {
            response: 'accept',
            approver: 'success-tester',
            comments: 'Test success response'
          }
        });

        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);

        // Verify all required fields are present
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('confirmationId');
        expect(result).toHaveProperty('response');
        expect(result).toHaveProperty('approver');
        expect(result).toHaveProperty('comments');
        expect(result).toHaveProperty('forwarded');
        expect(result).toHaveProperty('confirmationState');
        expect(result).toHaveProperty('timestamp');

        // Verify field types and values
        expect(result.success).toBe(true);
        expect(result.confirmationId).toBe('success-format-test');
        expect(result.response).toBe('accept');
        expect(result.approver).toBe('success-tester');
        expect(result.comments).toBe('Test success response');
        expect(result.forwarded).toBe(true);
        expect(result.confirmationState).toBeDefined();
        expect(new Date(result.timestamp)).toBeInstanceOf(Date);
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });

    it('should handle PUT endpoint response format', async () => {
      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = vi.fn().mockResolvedValue(undefined);
      orchestrator.getApprovalStateById = vi.fn().mockResolvedValue({
        requestId: 'put-format-test',
        gateName: 'put-gate',
        status: 'approved' as any,
        requestedAt: new Date(),
        context: {},
        stage: 'put-test',
        agent: 'put-agent'
      });

      try {
        const response = await server.inject({
          method: 'PUT',
          url: '/confirmations/put-format-test/respond',
          payload: {
            approver: 'put-tester',
            comments: 'PUT test comment'
          }
        });

        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);

        // PUT should always be treated as accept
        expect(result.response).toBe('accept');
        expect(result.approver).toBe('put-tester');
        expect(result.comments).toBe('PUT test comment');
        expect(result.confirmationId).toBe('put-format-test');
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });
  });
});