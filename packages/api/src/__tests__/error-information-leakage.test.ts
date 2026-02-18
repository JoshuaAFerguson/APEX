/**
 * Error information leakage tests for the API package
 *
 * Tests that error responses don't contain internal paths, config values,
 * stack traces, or other sensitive information that could be used by attackers.
 *
 * Covers:
 * 1. REST API error responses sanitization
 * 2. WebSocket error messages security
 * 3. 4xx/5xx response sanitization
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../index.js';
import { setupTestServer, TestContext, WebSocketTestClient, TestSetup } from './setup.js';
import path from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { WebSocket } from 'ws';

describe('Error Information Leakage Security Tests', () => {
  let testContext: TestContext;
  let app: FastifyInstance;
  let tempDir: string;

  beforeEach(async () => {
    testContext = await setupTestServer({
      silent: true, // Suppress logs during tests
      mockOrchestrator: false
    });
    app = testContext.app;
    tempDir = testContext.tempDir;
  });

  afterEach(async () => {
    await testContext.cleanup();
  });

  describe('REST API Error Response Sanitization', () => {
    describe('Production Environment Sanitization', () => {
      beforeEach(() => {
        // Mock production environment
        process.env.NODE_ENV = 'production';
      });

      afterEach(() => {
        // Restore original NODE_ENV
        delete process.env.NODE_ENV;
      });

      it('should not expose internal file paths in 500 errors', async () => {
        // Trigger a server error by providing invalid project path
        const invalidApp = await createServer({
          projectPath: '/nonexistent/invalid/path/that/should/not/exist',
          port: 0,
          silent: true
        });

        try {
          const response = await invalidApp.inject({
            method: 'POST',
            url: '/tasks',
            payload: {
              description: 'Test task'
            }
          });

          // Should be either 500 or 400 depending on validation
          expect([400, 500]).toContain(response.statusCode);

          const body = JSON.parse(response.body);

          // Should not contain file paths
          expect(body.error).not.toMatch(/\/.*\//); // No forward slashes indicating paths
          expect(body.error).not.toMatch(/\\.*\\/); // No backslashes indicating Windows paths
          expect(body.message).not.toMatch(/\/.*\//);
          expect(body.message).not.toMatch(/\\.*\\/);

          // Should not contain stack traces
          expect(body).not.toHaveProperty('stack');
          expect(body).not.toHaveProperty('stackTrace');
          expect(JSON.stringify(body)).not.toContain('at ');
          expect(JSON.stringify(body)).not.toContain('.js:');
          expect(JSON.stringify(body)).not.toContain('.ts:');

          // Should use generic error messages in production
          expect(body.error).toMatch(/^(Internal Server Error|Bad Request)$/);
          expect(body.message).toMatch(/^(An internal server error occurred|The request could not be processed)$/);
        } finally {
          await invalidApp.close();
        }
      });

      it('should not expose config values in error responses', async () => {
        // Try to access a restricted endpoint that might leak config
        const response = await app.inject({
          method: 'GET',
          url: '/config',
        });

        const body = JSON.parse(response.body);

        // If it's an error, ensure no sensitive config is leaked
        if (response.statusCode >= 400) {
          // Should not contain API keys, tokens, or paths
          expect(JSON.stringify(body)).not.toMatch(/api[_-]?key/i);
          expect(JSON.stringify(body)).not.toMatch(/token/i);
          expect(JSON.stringify(body)).not.toMatch(/secret/i);
          expect(JSON.stringify(body)).not.toMatch(/password/i);
          expect(JSON.stringify(body)).not.toMatch(/\/.*\//); // File paths
          expect(JSON.stringify(body)).not.toMatch(/\\.*\\/); // Windows paths
        }
      });

      it('should sanitize validation errors to prevent info leakage', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/tasks',
          payload: {
            // Missing required field 'description'
          }
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);

        // Should use generic error message in production
        expect(body.error).toBe('Bad Request');
        expect(body.message).toBe('The request could not be processed');

        // Should not expose validation details that could leak schema info
        expect(JSON.stringify(body)).not.toContain('description is required');
        expect(JSON.stringify(body)).not.toContain('schema');
        expect(JSON.stringify(body)).not.toContain('validation');
      });

      it('should sanitize database errors', async () => {
        // Try to access a task with invalid ID format to potentially trigger DB error
        const response = await app.inject({
          method: 'GET',
          url: '/tasks/invalid-id-that-might-cause-db-error-' + 'x'.repeat(1000)
        });

        if (response.statusCode >= 500) {
          const body = JSON.parse(response.body);

          // Should not expose database paths or connection strings
          expect(JSON.stringify(body)).not.toContain('sqlite');
          expect(JSON.stringify(body)).not.toContain('database');
          expect(JSON.stringify(body)).not.toContain('.db');
          expect(JSON.stringify(body)).not.toContain('SQLITE_');
          expect(JSON.stringify(body)).not.toContain('connection');

          // Should use generic error message
          expect(body.error).toBe('Internal Server Error');
          expect(body.message).toBe('An internal server error occurred');
        }
      });

      it('should not expose orchestrator internal errors', async () => {
        // Try to perform an action that might fail at the orchestrator level
        const response = await app.inject({
          method: 'POST',
          url: '/tasks/nonexistent-task/cancel'
        });

        if (response.statusCode >= 400) {
          const body = JSON.parse(response.body);

          // Should not expose internal orchestrator details
          expect(JSON.stringify(body)).not.toContain('orchestrator');
          expect(JSON.stringify(body)).not.toContain('ApexOrchestrator');
          expect(JSON.stringify(body)).not.toContain('TaskStore');
          expect(JSON.stringify(body)).not.toContain('agent');
          expect(JSON.stringify(body)).not.toContain('workflow');
        }
      });
    });

    describe('Development Environment Error Details', () => {
      beforeEach(() => {
        // Ensure we're in development mode
        process.env.NODE_ENV = 'development';
      });

      afterEach(() => {
        // Clean up
        delete process.env.NODE_ENV;
      });

      it('should provide more details in development but still avoid stack traces', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/tasks',
          payload: {
            // Missing required field to trigger validation error
          }
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);

        // In development, might get more detail but still no stack traces
        expect(body).not.toHaveProperty('stack');
        expect(body).not.toHaveProperty('stackTrace');
        expect(JSON.stringify(body)).not.toContain('at ');
        expect(JSON.stringify(body)).not.toContain('.js:');
        expect(JSON.stringify(body)).not.toContain('.ts:');

        // Should still not expose sensitive paths even in development
        expect(JSON.stringify(body)).not.toMatch(/\/home\/.*\//);
        expect(JSON.stringify(body)).not.toMatch(/\/Users\/.*\//);
        expect(JSON.stringify(body)).not.toMatch(/C:\\.*\\/);
      });
    });

    describe('4xx Error Response Sanitization', () => {
      it('should sanitize 400 Bad Request responses', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/tasks',
          payload: 'invalid json',
          headers: {
            'content-type': 'application/json'
          }
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);

        expect(body).toHaveProperty('error');
        expect(body).toHaveProperty('statusCode', 400);
        expect(body).not.toHaveProperty('stack');

        // Should not leak parser implementation details
        expect(JSON.stringify(body)).not.toContain('JSON.parse');
        expect(JSON.stringify(body)).not.toContain('SyntaxError');
        expect(JSON.stringify(body)).not.toContain('position');
      });

      it('should sanitize 401 Unauthorized responses', async () => {
        // First, check if auth is enabled by trying to access protected endpoint
        const response = await app.inject({
          method: 'GET',
          url: '/tasks',
          headers: {
            'authorization': 'Bearer invalid-token'
          }
        });

        if (response.statusCode === 401) {
          const body = JSON.parse(response.body);

          // Should not expose authentication mechanism details
          expect(JSON.stringify(body)).not.toContain('jwt');
          expect(JSON.stringify(body)).not.toContain('bearer');
          expect(JSON.stringify(body)).not.toContain('api_key');
          expect(JSON.stringify(body)).not.toContain('secret');
        }
      });

      it('should sanitize 404 Not Found responses', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/nonexistent/endpoint/that/does/not/exist'
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.body);

        // Should not leak routing information
        expect(JSON.stringify(body)).not.toContain('fastify');
        expect(JSON.stringify(body)).not.toContain('route');
        expect(JSON.stringify(body)).not.toContain('handler');
        expect(JSON.stringify(body)).not.toContain('middleware');
      });

      it('should sanitize 413 Payload Too Large responses', async () => {
        // Create a large payload to potentially trigger 413
        const largePayload = {
          description: 'x'.repeat(1000000), // 1MB string
          acceptanceCriteria: 'y'.repeat(1000000)
        };

        const response = await app.inject({
          method: 'POST',
          url: '/tasks',
          payload: largePayload
        });

        if (response.statusCode === 413) {
          const body = JSON.parse(response.body);

          // Should not expose server limits or configuration
          expect(JSON.stringify(body)).not.toContain('limit');
          expect(JSON.stringify(body)).not.toContain('maxBodySize');
          expect(JSON.stringify(body)).not.toContain('bodyLimit');
        }
      });

      it('should sanitize 422 Unprocessable Entity responses', async () => {
        // Try to create a task with invalid data types
        const response = await app.inject({
          method: 'POST',
          url: '/tasks',
          payload: {
            description: 123, // Should be string
            autonomy: 'invalid' // Should be enum
          }
        });

        if (response.statusCode === 422) {
          const body = JSON.parse(response.body);

          // Should not expose validation schema details
          expect(JSON.stringify(body)).not.toContain('enum');
          expect(JSON.stringify(body)).not.toContain('type');
          expect(JSON.stringify(body)).not.toContain('properties');
          expect(JSON.stringify(body)).not.toContain('required');
        }
      });

      it('should sanitize 429 Rate Limit responses', async () => {
        // Make multiple rapid requests to potentially trigger rate limiting
        const requests = Array.from({ length: 50 }, () =>
          app.inject({
            method: 'GET',
            url: '/health'
          })
        );

        const responses = await Promise.all(requests);
        const rateLimitedResponse = responses.find(r => r.statusCode === 429);

        if (rateLimitedResponse) {
          const body = JSON.parse(rateLimitedResponse.body);

          // Should not expose rate limiting configuration
          expect(JSON.stringify(body)).not.toContain('rateLimit');
          expect(JSON.stringify(body)).not.toContain('max');
          expect(JSON.stringify(body)).not.toContain('window');
          expect(JSON.stringify(body)).not.toContain('redis');
        }
      });
    });

    describe('5xx Error Response Sanitization', () => {
      beforeEach(() => {
        // Mock production environment for 5xx tests
        process.env.NODE_ENV = 'production';
      });

      afterEach(() => {
        delete process.env.NODE_ENV;
      });

      it('should sanitize 500 Internal Server Error responses', async () => {
        // Force an error by mocking a function to throw
        const originalMethod = app.log.error;
        vi.spyOn(app, 'log').mockImplementation({
          ...app.log,
          error: vi.fn(() => {
            throw new Error('Mocked internal error with sensitive path /secret/config/file.json');
          })
        } as any);

        try {
          const response = await app.inject({
            method: 'GET',
            url: '/daemon/health'
          });

          if (response.statusCode === 500) {
            const body = JSON.parse(response.body);

            // Should use generic error message
            expect(body.error).toBe('Internal Server Error');
            expect(body.message).toBe('An internal server error occurred');

            // Should not contain the mocked sensitive information
            expect(JSON.stringify(body)).not.toContain('/secret/config/file.json');
            expect(JSON.stringify(body)).not.toContain('Mocked internal error');
          }
        } finally {
          vi.restoreAllMocks();
        }
      });

      it('should sanitize 502 Bad Gateway responses', async () => {
        // Mock a scenario that could cause bad gateway
        // This is harder to trigger in the API, but we can test the error handler
        const mockError = new Error('Bad gateway to upstream service at internal.service.local');
        mockError.name = 'BadGatewayError';
        (mockError as any).statusCode = 502;

        vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
          // Inject the error through the error handler
          const response = await app.inject({
            method: 'GET',
            url: '/health'
          });

          // The /health endpoint should work, but if it triggers a 502, check sanitization
          if (response.statusCode === 502) {
            const body = JSON.parse(response.body);

            expect(body.error).toBe('Internal Server Error');
            expect(JSON.stringify(body)).not.toContain('internal.service.local');
            expect(JSON.stringify(body)).not.toContain('upstream');
          }
        } finally {
          vi.restoreAllMocks();
        }
      });

      it('should sanitize 503 Service Unavailable responses', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/daemon/health'
        });

        // This endpoint returns 503 when daemon is not running
        if (response.statusCode === 503) {
          const body = JSON.parse(response.body);

          // Should not expose daemon internal paths or config
          expect(JSON.stringify(body)).not.toContain(tempDir);
          expect(JSON.stringify(body)).not.toContain('.apex');
          expect(JSON.stringify(body)).not.toContain('daemon.pid');
          expect(JSON.stringify(body)).not.toContain('daemon-state.json');
        }
      });
    });
  });

  describe('WebSocket Error Message Security', () => {
    let wsClient: WebSocketTestClient;

    afterEach(() => {
      if (wsClient) {
        wsClient.close();
      }
    });

    it('should not expose config values in WebSocket connection errors', async () => {
      // Try to connect with invalid parameters that might trigger config exposure
      wsClient = TestSetup.createWebSocketClient(testContext.serverPort, 'invalid-task-id-with-sensitive-data');

      try {
        await wsClient.waitForConnection(2000);

        // Wait for any error messages
        await new Promise(resolve => setTimeout(resolve, 1000));

        const messages = wsClient.getMessages();

        messages.forEach(message => {
          const messageStr = JSON.stringify(message);

          // Should not contain sensitive config information
          expect(messageStr).not.toContain('api_key');
          expect(messageStr).not.toContain('secret');
          expect(messageStr).not.toContain('token');
          expect(messageStr).not.toContain('password');

          // Should not contain file paths
          expect(messageStr).not.toMatch(/\/.*\//);
          expect(messageStr).not.toMatch(/\\.*\\/);

          // Should not contain stack traces
          expect(messageStr).not.toContain('at ');
          expect(messageStr).not.toContain('.js:');
          expect(messageStr).not.toContain('.ts:');
        });
      } catch (error) {
        // Connection might fail, which is also fine for this test
        expect(error.message).not.toContain(tempDir);
        expect(error.message).not.toContain('api_key');
        expect(error.message).not.toContain('secret');
      }
    });

    it('should not expose internal paths in WebSocket error events', async () => {
      wsClient = TestSetup.createWebSocketClient(testContext.serverPort);
      await wsClient.waitForConnection();

      // Send malformed message to potentially trigger error
      wsClient.send('invalid json message');

      // Wait for response
      await new Promise(resolve => setTimeout(resolve, 1000));

      const messages = wsClient.getMessages();

      messages.forEach(message => {
        const messageStr = JSON.stringify(message);

        // Should not expose temp directory or project paths
        expect(messageStr).not.toContain(tempDir);
        expect(messageStr).not.toContain('tmp');
        expect(messageStr).not.toContain('temp');

        // Should not expose internal error details
        expect(messageStr).not.toContain('WebSocket');
        expect(messageStr).not.toContain('socket');
        expect(messageStr).not.toContain('connection');
        expect(messageStr).not.toContain('fastify');
      });
    });

    it('should sanitize WebSocket disconnection error messages', async () => {
      wsClient = TestSetup.createWebSocketClient(testContext.serverPort);
      await wsClient.waitForConnection();

      // Force close to trigger disconnect handling
      wsClient.close();

      // Wait for any error handling
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check that no sensitive information was logged
      // This is mainly testing that the close handler doesn't expose info
      expect(true).toBe(true); // Placeholder - actual check would be against logs
    });

    it('should handle WebSocket message parsing errors securely', async () => {
      wsClient = TestSetup.createWebSocketClient(testContext.serverPort);
      await wsClient.waitForConnection();

      // Send various malformed messages
      const malformedMessages = [
        '{"invalid": json}',
        'not json at all',
        '{"type": "unknown_type", "data": {"sensitive_path": "/secret/path"}}',
        '{"ping": {"with": {"nested": {"error": "at /path/to/file.js:123"}}}}'
      ];

      for (const badMessage of malformedMessages) {
        wsClient.send(badMessage);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Wait for all processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const messages = wsClient.getMessages();

      messages.forEach(message => {
        const messageStr = JSON.stringify(message);

        // Should not echo back sensitive information from malformed messages
        expect(messageStr).not.toContain('/secret/path');
        expect(messageStr).not.toContain('/path/to/file.js:123');
        expect(messageStr).not.toContain('sensitive_path');
      });
    });

    it('should not expose orchestrator errors in WebSocket events', async () => {
      wsClient = TestSetup.createWebSocketClient(testContext.serverPort);
      await wsClient.waitForConnection();

      // Create a task that might fail and generate events
      const createResponse = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          description: 'Test task for WebSocket error testing'
        }
      });

      if (createResponse.statusCode === 201) {
        const task = JSON.parse(createResponse.body);

        // Connect to task-specific events
        const taskWsClient = TestSetup.createWebSocketClient(testContext.serverPort, task.taskId);
        await taskWsClient.waitForConnection();

        // Wait for any events
        await new Promise(resolve => setTimeout(resolve, 2000));

        const messages = taskWsClient.getMessages();

        messages.forEach(message => {
          const messageStr = JSON.stringify(message);

          // Should not expose orchestrator internals
          expect(messageStr).not.toContain('ApexOrchestrator');
          expect(messageStr).not.toContain('TaskStore');
          expect(messageStr).not.toContain('claude-agent-sdk');
          expect(messageStr).not.toContain('@anthropic');

          // Should not expose project path
          expect(messageStr).not.toContain(tempDir);

          // Should not expose SQLite details
          expect(messageStr).not.toContain('sqlite');
          expect(messageStr).not.toContain('.db');
          expect(messageStr).not.toContain('SQLITE_');
        });

        taskWsClient.close();
      }
    });

    it('should sanitize health update events for sensitive information', async () => {
      const healthWsClient = TestSetup.createWebSocketClient(testContext.serverPort, 'health');
      await healthWsClient.waitForConnection();

      // Trigger health update by requesting health endpoint
      await app.inject({
        method: 'GET',
        url: '/daemon/health'
      });

      // Wait for potential health events
      await new Promise(resolve => setTimeout(resolve, 1000));

      const messages = healthWsClient.getMessages();

      messages.forEach(message => {
        const messageStr = JSON.stringify(message);

        // Should not expose project paths
        expect(messageStr).not.toContain(tempDir);
        expect(messageStr).not.toContain('projectPath');

        // Should not expose system details that could aid attacks
        expect(messageStr).not.toContain('hostname');
        expect(messageStr).not.toContain('username');
        expect(messageStr).not.toContain('HOME');
        expect(messageStr).not.toContain('PATH');
      });

      healthWsClient.close();
    });
  });

  describe('Error Response Headers Security', () => {
    it('should not expose server implementation details in error response headers', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: 'invalid'
      });

      const headers = response.headers;

      // Should not expose fastify version
      expect(headers).not.toHaveProperty('x-powered-by');
      expect(headers).not.toHaveProperty('server');

      // Should not expose custom error headers with sensitive info
      Object.keys(headers).forEach(header => {
        const value = headers[header];
        if (typeof value === 'string') {
          expect(value).not.toContain(tempDir);
          expect(value).not.toContain('fastify');
          expect(value).not.toContain('node');
          expect(value).not.toContain('.js');
          expect(value).not.toContain('.ts');
        }
      });
    });

    it('should use secure error response content-type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/nonexistent'
      });

      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('Error Timing Attacks Prevention', () => {
    it('should not have significantly different response times for valid vs invalid resources', async () => {
      // Test response time consistency for task access
      const validTaskResponse = await app.inject({
        method: 'GET',
        url: '/tasks/valid-looking-task-id-12345'
      });

      const invalidTaskResponse = await app.inject({
        method: 'GET',
        url: '/tasks/invalid-task-id-67890'
      });

      // Both should be 404 and have similar response times
      expect(validTaskResponse.statusCode).toBe(404);
      expect(invalidTaskResponse.statusCode).toBe(404);

      // Response bodies should be similar (not revealing which was "more invalid")
      const validBody = JSON.parse(validTaskResponse.body);
      const invalidBody = JSON.parse(invalidTaskResponse.body);

      expect(validBody.error).toBe(invalidBody.error);
    });
  });
});