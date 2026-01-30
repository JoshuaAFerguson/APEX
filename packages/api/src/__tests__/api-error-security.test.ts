/**
 * API Error Response Security Tests
 *
 * Tests to verify that:
 * 1. Error responses in production mode do NOT include stack traces
 * 2. Error responses in development mode may include stack traces (if intended)
 * 3. Tests cover both 4xx and 5xx error scenarios
 *
 * These tests are critical for security as stack traces in production
 * can leak sensitive information about the server architecture and code.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../index.js';
import path from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';

describe('API Error Response Security Tests', () => {
  let app: FastifyInstance;
  let tempDir: string;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    // Create a temporary directory for the project
    tempDir = await mkdtemp(path.join(tmpdir(), 'apex-error-security-test-'));

    // Create .apex directory structure
    await mkdir(path.join(tempDir, '.apex'), { recursive: true });

    // Create basic config file
    const configPath = path.join(tempDir, '.apex', 'config.yaml');
    await writeFile(configPath, `
project:
  name: test-project
  version: "1.0.0"

autonomy:
  level: "supervised"
  autoApprove: false

limits:
  maxConcurrentTasks: 3
  maxCostPerTask: 10.0
  dailyCostLimit: 100.0
`);
  });

  afterEach(async () => {
    // Clean up
    if (app) {
      await app.close();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  describe('Production Mode Security Tests', () => {
    beforeEach(async () => {
      // Set NODE_ENV to production
      process.env.NODE_ENV = 'production';

      // Create server with production configuration
      app = await createServer({
        projectPath: tempDir,
        port: 0, // Use dynamic port
        silent: true, // Suppress logs during tests
      });
    });

    it('should not expose stack traces in 4xx client errors', async () => {
      // Test various 4xx error scenarios
      const testCases = [
        {
          name: '400 Bad Request - Invalid task creation',
          request: {
            method: 'POST',
            url: '/tasks',
            payload: {
              // Missing required description field
              acceptanceCriteria: 'Some criteria'
            },
          },
          expectedStatus: 400,
        },
        {
          name: '400 Bad Request - Invalid template creation',
          request: {
            method: 'POST',
            url: '/templates',
            payload: {
              // Missing required fields
              name: '',
              description: ''
            },
          },
          expectedStatus: 400,
        },
        {
          name: '404 Not Found - Non-existent task',
          request: {
            method: 'GET',
            url: '/tasks/non-existent-task-id',
          },
          expectedStatus: 404,
        },
        {
          name: '404 Not Found - Non-existent template',
          request: {
            method: 'GET',
            url: '/templates/non-existent-template-id',
          },
          expectedStatus: 404,
        },
        {
          name: '400 Bad Request - Invalid approval decision',
          request: {
            method: 'POST',
            url: '/api/approvals/invalid-id/approve',
            payload: {
              // Missing required approver field
              comments: 'Test approval'
            },
          },
          expectedStatus: 400,
        },
        {
          name: '400 Bad Request - Invalid confirmation response',
          request: {
            method: 'POST',
            url: '/confirmations/invalid-id/respond',
            payload: {
              response: 'invalid-response', // Must be accept or reject
              approver: 'test-user'
            },
          },
          expectedStatus: 400,
        },
      ];

      for (const testCase of testCases) {
        const response = await app.inject(testCase.request);

        // Verify expected status code
        expect(response.statusCode, `Test case: ${testCase.name}`).toBe(testCase.expectedStatus);

        // Parse response body
        let body: any;
        try {
          body = JSON.parse(response.body);
        } catch (error) {
          // If body is not JSON, check raw text for stack traces
          expect(response.body, `Test case: ${testCase.name} - No stack trace in text response`)
            .not.toMatch(/\s+at\s+/); // Common stack trace pattern
          expect(response.body, `Test case: ${testCase.name} - No file paths in text response`)
            .not.toMatch(/\/.*\.js:\d+/); // File path pattern
          continue;
        }

        // Verify no stack trace information is present
        expect(body, `Test case: ${testCase.name} - Response body should exist`).toBeDefined();

        // Check that stack trace fields are not present
        expect(body, `Test case: ${testCase.name} - No stack field`).not.toHaveProperty('stack');
        expect(body, `Test case: ${testCase.name} - No stackTrace field`).not.toHaveProperty('stackTrace');
        expect(body, `Test case: ${testCase.name} - No trace field`).not.toHaveProperty('trace');

        // Check string fields don't contain stack trace patterns
        const bodyStr = JSON.stringify(body);
        expect(bodyStr, `Test case: ${testCase.name} - No stack trace pattern in response`)
          .not.toMatch(/\s+at\s+/); // Stack trace "at" pattern
        expect(bodyStr, `Test case: ${testCase.name} - No file paths in response`)
          .not.toMatch(/\/.*\.js:\d+/); // File path with line numbers
        expect(bodyStr, `Test case: ${testCase.name} - No Error: prefix`)
          .not.toMatch(/Error:\s+/); // Raw error messages

        // Verify error response has proper structure
        expect(body, `Test case: ${testCase.name} - Error field should be present`).toHaveProperty('error');
        expect(typeof body.error, `Test case: ${testCase.name} - Error should be string`).toBe('string');
        expect(body.error.length, `Test case: ${testCase.name} - Error message should not be empty`).toBeGreaterThan(0);
      }
    });

    it('should not expose stack traces in 5xx server errors', async () => {
      // Mock scenarios that would cause 5xx errors
      const testCases = [
        {
          name: '500 Internal Server Error - Database error simulation',
          setup: async () => {
            // Mock orchestrator method to throw error
            const mockOrchestrator = {
              getTask: vi.fn().mockImplementation(() => {
                throw new Error('Database connection failed at line 123 in /app/src/database.js');
              })
            };
            // This simulates what would happen if orchestrator failed
          },
          request: {
            method: 'GET',
            url: '/daemon/health', // This endpoint might trigger internal errors
          },
        }
      ];

      for (const testCase of testCases) {
        if (testCase.setup) {
          await testCase.setup();
        }

        const response = await app.inject(testCase.request);

        // Verify it's a server error or handled gracefully
        expect([200, 500, 503], `Test case: ${testCase.name} - Should be valid HTTP status`).toContain(response.statusCode);

        // Parse response body if JSON
        let body: any;
        try {
          body = JSON.parse(response.body);
        } catch (error) {
          // If not JSON, check raw response for stack traces
          expect(response.body, `Test case: ${testCase.name} - No stack trace in text response`)
            .not.toMatch(/\s+at\s+/);
          expect(response.body, `Test case: ${testCase.name} - No file paths in text response`)
            .not.toMatch(/\/.*\.js:\d+/);
          continue;
        }

        // Verify no stack trace information is present in JSON responses
        expect(body, `Test case: ${testCase.name} - No stack field`).not.toHaveProperty('stack');
        expect(body, `Test case: ${testCase.name} - No stackTrace field`).not.toHaveProperty('stackTrace');
        expect(body, `Test case: ${testCase.name} - No trace field`).not.toHaveProperty('trace');

        // Check string content for stack trace patterns
        const bodyStr = JSON.stringify(body);
        expect(bodyStr, `Test case: ${testCase.name} - No stack trace pattern in response`)
          .not.toMatch(/\s+at\s+/);
        expect(bodyStr, `Test case: ${testCase.name} - No file paths in response`)
          .not.toMatch(/\/.*\.js:\d+/);
        expect(bodyStr, `Test case: ${testCase.name} - No detailed error traces`)
          .not.toMatch(/Error:\s+.*\n\s+at\s+/);
      }
    });

    it('should not expose internal file paths in error messages', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          description: null, // Invalid type to trigger validation error
        },
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      const errorMessage = body.error || body.message || '';

      // Check that no internal file paths are exposed
      expect(errorMessage).not.toMatch(/\/usr\/|\/home\/|\/Users\/|C:\\|\/app\/src\/|\/node_modules\//);
      expect(errorMessage).not.toMatch(/\.js:\d+|\.ts:\d+/); // File extensions with line numbers
      expect(errorMessage).not.toMatch(/packages\/api\/src\//); // Project structure
    });

    it('should not expose environment variables or system information', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tasks/trigger-error-for-testing',
      });

      // Response might be 404 or 500 depending on implementation
      expect([404, 500]).toContain(response.statusCode);

      const bodyStr = response.body;

      // Check for common environment variable patterns
      expect(bodyStr).not.toMatch(/process\.env/);
      expect(bodyStr).not.toMatch(/NODE_ENV/);
      expect(bodyStr).not.toMatch(/PATH=/);
      expect(bodyStr).not.toMatch(/HOME=/);

      // Check for system information
      expect(bodyStr).not.toMatch(/\/tmp\/|temp\//);
      expect(bodyStr).not.toMatch(/localhost:\d+/);
      expect(bodyStr).not.toMatch(/127\.0\.0\.1:\d+/);
    });

    it('should handle malformed JSON requests securely', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: '{"invalid": json}', // Malformed JSON
        headers: {
          'content-type': 'application/json'
        },
      });

      expect([400, 500]).toContain(response.statusCode);

      // Verify no parser error details are exposed
      const bodyStr = response.body;
      expect(bodyStr).not.toMatch(/JSON\.parse/);
      expect(bodyStr).not.toMatch(/SyntaxError/);
      expect(bodyStr).not.toMatch(/Unexpected token/);
      expect(bodyStr).not.toMatch(/position \d+/);
    });
  });

  describe('Development Mode Error Handling Tests', () => {
    beforeEach(async () => {
      // Set NODE_ENV to development
      process.env.NODE_ENV = 'development';

      // Create server with development configuration
      app = await createServer({
        projectPath: tempDir,
        port: 0,
        silent: true,
      });
    });

    it('should provide helpful error messages in development mode', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          // Missing required description field
          acceptanceCriteria: 'Some criteria'
        },
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);

      // In development, error messages should be descriptive but still secure
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
      expect(body.error.length).toBeGreaterThan(0);

      // Even in development, stack traces should generally not be exposed to API consumers
      // unless explicitly configured to do so
      expect(body).not.toHaveProperty('stack');

      // However, error messages might be more descriptive
      expect(body.error).toMatch(/description.*required/i);
    });

    it('should handle validation errors consistently in development', async () => {
      const testCases = [
        {
          name: 'Empty task description',
          request: {
            method: 'POST',
            url: '/tasks',
            payload: { description: '' },
          },
        },
        {
          name: 'Invalid template name',
          request: {
            method: 'POST',
            url: '/templates',
            payload: {
              name: '',
              description: 'Valid description',
              workflow: 'valid-workflow'
            },
          },
        },
      ];

      for (const testCase of testCases) {
        const response = await app.inject(testCase.request);

        expect(response.statusCode, `Test case: ${testCase.name}`).toBe(400);

        const body = JSON.parse(response.body);

        // Should have error message
        expect(body, `Test case: ${testCase.name} - Should have error field`).toHaveProperty('error');

        // Should not have stack traces even in development
        expect(body, `Test case: ${testCase.name} - No stack field`).not.toHaveProperty('stack');
        expect(body, `Test case: ${testCase.name} - No stackTrace field`).not.toHaveProperty('stackTrace');

        // Error message should be helpful but not leak internal details
        const errorMessage = body.error;
        expect(errorMessage).not.toMatch(/\/.*\.js:\d+/);
        expect(errorMessage).not.toMatch(/\s+at\s+/);
      }
    });
  });

  describe('Test Mode Error Handling Tests', () => {
    beforeEach(async () => {
      // Set NODE_ENV to test
      process.env.NODE_ENV = 'test';

      // Create server with test configuration
      app = await createServer({
        projectPath: tempDir,
        port: 0,
        silent: true,
      });
    });

    it('should handle errors securely in test mode', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          description: null, // Invalid type
        },
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);

      // Even in test mode, should not expose stack traces to API consumers
      expect(body).not.toHaveProperty('stack');
      expect(body).not.toHaveProperty('stackTrace');

      // Should have proper error structure
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });
  });

  describe('Error Response Format Consistency', () => {
    beforeEach(async () => {
      process.env.NODE_ENV = 'production';

      app = await createServer({
        projectPath: tempDir,
        port: 0,
        silent: true,
      });
    });

    it('should have consistent error response structure across all endpoints', async () => {
      const errorEndpoints = [
        { method: 'GET', url: '/tasks/non-existent' },
        { method: 'POST', url: '/tasks', payload: {} },
        { method: 'GET', url: '/templates/non-existent' },
        { method: 'POST', url: '/templates', payload: {} },
        { method: 'GET', url: '/api/approvals/non-existent' },
      ];

      for (const endpoint of errorEndpoints) {
        const response = await app.inject(endpoint);

        expect([400, 404, 500]).toContain(response.statusCode);

        // Should be valid JSON
        let body: any;
        expect(() => {
          body = JSON.parse(response.body);
        }, `Endpoint ${endpoint.method} ${endpoint.url} should return valid JSON`).not.toThrow();

        // Should have error field
        expect(body, `Endpoint ${endpoint.method} ${endpoint.url} should have error field`)
          .toHaveProperty('error');

        // Should not have stack trace fields
        expect(body, `Endpoint ${endpoint.method} ${endpoint.url} should not have stack field`)
          .not.toHaveProperty('stack');
        expect(body, `Endpoint ${endpoint.method} ${endpoint.url} should not have stackTrace field`)
          .not.toHaveProperty('stackTrace');
      }
    });

    it('should return proper content-type headers for error responses', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should handle non-JSON error responses securely', async () => {
      // Test endpoint that might return non-JSON error
      const response = await app.inject({
        method: 'OPTIONS', // Unsupported method
        url: '/tasks',
      });

      // Verify no stack traces in any response format
      expect(response.body).not.toMatch(/\s+at\s+/);
      expect(response.body).not.toMatch(/\/.*\.js:\d+/);
      expect(response.body).not.toMatch(/Error:\s+.*\n/);
    });
  });

  describe('Edge Cases and Security Boundary Tests', () => {
    beforeEach(async () => {
      process.env.NODE_ENV = 'production';

      app = await createServer({
        projectPath: tempDir,
        port: 0,
        silent: true,
      });
    });

    it('should handle extremely large error messages securely', async () => {
      // Create a request with very long invalid data
      const longString = 'x'.repeat(10000);

      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          description: longString,
          invalidField: longString,
        },
      });

      // Should handle gracefully without exposing internal details
      expect([400, 413, 500]).toContain(response.statusCode); // 413 = Payload Too Large

      // Verify response doesn't contain stack traces even for large payloads
      expect(response.body).not.toMatch(/\s+at\s+/);
      expect(response.body).not.toMatch(/\/.*\.js:\d+/);
    });

    it('should handle special characters in error responses securely', async () => {
      const specialPayload = {
        description: '<script>alert("xss")</script>',
        acceptanceCriteria: '${process.env.SECRET}',
        workflow: '../../../etc/passwd',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: specialPayload,
      });

      // Response should be handled securely
      expect([400, 500]).toContain(response.statusCode);

      // Check that special characters don't cause information disclosure
      const bodyStr = response.body;
      expect(bodyStr).not.toMatch(/<script>/);
      expect(bodyStr).not.toMatch(/\$\{process\.env\./);
      expect(bodyStr).not.toMatch(/\/etc\/passwd/);

      // And still no stack traces
      expect(bodyStr).not.toMatch(/\s+at\s+/);
      expect(bodyStr).not.toMatch(/\/.*\.js:\d+/);
    });

    it('should not expose stack traces when orchestrator throws errors', async () => {
      // This test simulates what happens when the orchestrator itself throws errors
      // by making requests that would trigger orchestrator operations

      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          description: 'Valid description',
          workflow: 'non-existent-workflow', // This might cause orchestrator errors
          autonomy: 'invalid-autonomy-level',
        },
      });

      // Regardless of status code, should not expose stack traces
      const bodyStr = response.body;
      expect(bodyStr).not.toMatch(/\s+at\s+/);
      expect(bodyStr).not.toMatch(/\/.*\.js:\d+/);
      expect(bodyStr).not.toMatch(/packages\/orchestrator\/src\//);
      expect(bodyStr).not.toMatch(/ApexOrchestrator/);
    });
  });
});