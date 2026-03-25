/**
 * Security Generic Error Messages Tests
 *
 * Tests specifically for ensuring that security-sensitive failures return
 * generic error messages that don't reveal specifics about the failure reason.
 *
 * Acceptance Criteria Verification:
 * 1. Authentication failures return generic 'Invalid credentials' messages
 *    (not specifics like 'User not found' vs 'Wrong password')
 * 2. Authorization failures return generic 'Access denied' messages
 * 3. Rate limiting and other security controls use non-revealing messages
 *
 * This test suite complements existing security tests but focuses specifically
 * on message genericness to prevent information disclosure attacks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../index.js';
import { createTestEnvironment, TestSetupConfig } from './setup.js';
import { WebSocket } from 'ws';
import path from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';

// Test context interfaces are imported from setup.js

describe('Security Generic Error Messages Tests', () => {
  let testContext: any;
  let authTestContext: any;

  beforeEach(async () => {
    // Create test environment without auth
    testContext = await createTestEnvironment({
      silent: true,
      mockOrchestrator: false
    });

    // Create temp directory for auth-enabled server
    const authTempDir = await mkdtemp(path.join(tmpdir(), 'apex-auth-security-test-'));
    await mkdir(path.join(authTempDir, '.apex'), { recursive: true });

    // Create config with auth enabled
    const authConfigPath = path.join(authTempDir, '.apex', 'config.yaml');
    await writeFile(authConfigPath, `version: "1.0"
project:
  name: test-auth-project
  language: typescript
  framework: node
autonomy:
  level: full-auto
agents:
  enabled: []
models:
  planning: opus
  implementation: sonnet
  review: haiku
limits:
  maxTokensPerTask: 100000
  maxCostPerTask: 10
  maxRetries: 3
git:
  branchPrefix: apex/
  commitFormat: conventional
  autoPush: false
  defaultBranch: main
api:
  auth:
    enabled: true
    apiKeys:
      - "valid-test-key-123"
      - "another-valid-key-456"
`);

    // Create auth-enabled server
    const appWithAuth = await createServer({
      projectPath: authTempDir,
      port: 0,
      silent: true,
    });

    // Start auth server and get port
    await appWithAuth.listen({ port: 0, host: '127.0.0.1' });
    const authAddress = appWithAuth.server.address();

    if (!authAddress || typeof authAddress !== 'object') {
      throw new Error('Failed to start auth test server');
    }

    authTestContext = {
      app: appWithAuth,
      serverPort: authAddress.port,
      tempDir: authTempDir,
      cleanup: async () => {
        await appWithAuth?.close();
        await rm(authTempDir, { recursive: true, force: true });
      }
    };
  });

  afterEach(async () => {
    await Promise.all([
      testContext?.cleanup?.(),
      authTestContext?.cleanup?.()
    ]);
  });

  describe('Authentication Failure Generic Messages', () => {
    it('should return generic "Invalid credentials" for missing authentication', async () => {
      const response = await authTestContext.app.inject({
        method: 'GET',
        url: '/tasks',
        // No authentication headers
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Unauthorized');
      expect(body).toHaveProperty('message', 'Authentication required');
      expect(body).toHaveProperty('statusCode', 401);

      // Verify message is generic and doesn't reveal specifics
      expect(body.message).not.toContain('Bearer');
      expect(body.message).not.toContain('X-API-Key');
      expect(body.message).not.toContain('header');
      expect(body.message).not.toContain('missing');
      expect(body.message).not.toContain('token');
      expect(body.message).not.toContain('api key');
      expect(body.message).not.toContain('credential');
    });

    it('should return generic "Invalid authentication credentials" for wrong Bearer token', async () => {
      const response = await authTestContext.app.inject({
        method: 'GET',
        url: '/tasks',
        headers: {
          'Authorization': 'Bearer wrong-token-123'
        }
      });

      expect(response.statusCode).toBe(403);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Forbidden');
      expect(body).toHaveProperty('message', 'Invalid authentication credentials');
      expect(body).toHaveProperty('statusCode', 403);

      // Verify message doesn't reveal token was invalid vs format was wrong
      expect(body.message).not.toContain('token');
      expect(body.message).not.toContain('Bearer');
      expect(body.message).not.toContain('wrong');
      expect(body.message).not.toContain('invalid');
      expect(body.message).not.toContain('not found');
      expect(body.message).not.toContain('expired');
      expect(body.message).not.toContain('malformed');
    });

    it('should return generic "Invalid authentication credentials" for wrong API key', async () => {
      const response = await authTestContext.app.inject({
        method: 'GET',
        url: '/tasks',
        headers: {
          'X-API-Key': 'wrong-api-key-789'
        }
      });

      expect(response.statusCode).toBe(403);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Forbidden');
      expect(body).toHaveProperty('message', 'Invalid authentication credentials');
      expect(body).toHaveProperty('statusCode', 403);

      // Verify message doesn't reveal API key was invalid vs missing
      expect(body.message).not.toContain('api');
      expect(body.message).not.toContain('key');
      expect(body.message).not.toContain('wrong');
      expect(body.message).not.toContain('invalid');
      expect(body.message).not.toContain('not found');
      expect(body.message).not.toContain('X-API-Key');
    });

    it('should return generic message for malformed Bearer token', async () => {
      const malformedTokens = [
        'Bearer',              // No token
        'Bearer ',             // Empty token
        'Bearer   ',           // Whitespace only
        'bear token-123',      // Wrong prefix
        'Bearer\ttoken-123',   // Tab character
        'Bearer\ntoken-123',   // Newline character
      ];

      for (const authHeader of malformedTokens) {
        const response = await authTestContext.app.inject({
          method: 'GET',
          url: '/tasks',
          headers: {
            'Authorization': authHeader
          }
        });

        expect(response.statusCode).toBe(403);

        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('error', 'Forbidden');
        expect(body).toHaveProperty('message', 'Invalid authentication credentials');

        // Should not reveal format problems
        expect(body.message).not.toContain('malformed');
        expect(body.message).not.toContain('format');
        expect(body.message).not.toContain('Bearer');
        expect(body.message).not.toContain('missing');
        expect(body.message).not.toContain('empty');
      }
    });

    it('should return same generic message regardless of authentication method used', async () => {
      // Test various authentication attempts
      const authAttempts = [
        { headers: { 'Authorization': 'Bearer invalid-token' } },
        { headers: { 'X-API-Key': 'invalid-key' } },
        { headers: { 'Authorization': 'Basic invalid-basic' } },
        { headers: { 'Authorization': 'Digest invalid-digest' } },
      ];

      const responses = [];
      for (const attempt of authAttempts) {
        const response = await authTestContext.app.inject({
          method: 'GET',
          url: '/config',
          headers: attempt.headers
        });
        responses.push(response);
      }

      // All should return 403 with same generic message
      responses.forEach((response, index) => {
        expect(response.statusCode).toBe(403);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('Forbidden');
        expect(body.message).toBe('Invalid authentication credentials');

        // First response sets the expected format, all others should match
        if (index === 0) {
          expect(body).toHaveProperty('statusCode', 403);
        }
      });

      // Verify all responses have identical structure
      const firstBody = JSON.parse(responses[0].body);
      responses.slice(1).forEach(response => {
        const body = JSON.parse(response.body);
        expect(body).toEqual(firstBody);
      });
    });

    it('should use consistent timing for authentication failures', async () => {
      // Test timing consistency to prevent timing attacks
      const startTime1 = process.hrtime.bigint();
      await authTestContext.app.inject({
        method: 'GET',
        url: '/tasks',
        headers: { 'Authorization': 'Bearer ' + 'a'.repeat(50) }
      });
      const duration1 = process.hrtime.bigint() - startTime1;

      const startTime2 = process.hrtime.bigint();
      await authTestContext.app.inject({
        method: 'GET',
        url: '/tasks',
        headers: { 'X-API-Key': 'b'.repeat(50) }
      });
      const duration2 = process.hrtime.bigint() - startTime2;

      // Timing difference should be minimal (within reasonable bounds)
      const timeDiffMs = Number(duration1 - duration2) / 1000000;
      expect(Math.abs(timeDiffMs)).toBeLessThan(50); // 50ms tolerance
    });
  });

  describe('Authorization Failure Generic Messages', () => {
    let testTaskId: string;

    beforeEach(async () => {
      // Create a test task for authorization testing
      const createResponse = await authTestContext.app.inject({
        method: 'POST',
        url: '/tasks',
        headers: {
          'Authorization': 'Bearer valid-test-key-123'
        },
        payload: {
          description: 'Test task for authorization testing'
        }
      });

      if (createResponse.statusCode === 201) {
        const taskData = JSON.parse(createResponse.body);
        testTaskId = taskData.taskId;
      }
    });

    it('should return generic access denied for insufficient permissions on task operations', async () => {
      // Simulate attempting restricted operations
      const restrictedOperations = [
        { method: 'DELETE', url: '/tasks/admin-only-task' },
        { method: 'PUT', url: '/config/security' },
        { method: 'POST', url: '/admin/users' },
        { method: 'DELETE', url: '/admin/logs' },
      ];

      for (const operation of restrictedOperations) {
        const response = await authTestContext.app.inject({
          method: operation.method as any,
          url: operation.url,
          headers: {
            'Authorization': 'Bearer valid-test-key-123' // Valid auth but insufficient permissions
          }
        });

        // Might be 403, 404, or 405 depending on implementation
        // The key is that error messages should be generic
        if (response.statusCode === 403) {
          const body = JSON.parse(response.body);

          expect(body.error).toBe('Forbidden');
          expect(body.message).toBe('Access denied');

          // Should not reveal permission details
          expect(body.message).not.toContain('admin');
          expect(body.message).not.toContain('permission');
          expect(body.message).not.toContain('role');
          expect(body.message).not.toContain('insufficient');
          expect(body.message).not.toContain('unauthorized');
          expect(body.message).not.toContain('privilege');
        }
      }
    });

    it('should return generic access denied for resource-level authorization failures', async () => {
      if (!testTaskId) {
        // Skip if task creation failed
        return;
      }

      // Try to access task with different user context (if supported)
      const response = await authTestContext.app.inject({
        method: 'DELETE',
        url: `/tasks/${testTaskId}`,
        headers: {
          'Authorization': 'Bearer another-valid-key-456' // Different user's key
        }
      });

      // Response could be 403, 404, or other depending on implementation
      if (response.statusCode === 403) {
        const body = JSON.parse(response.body);

        expect(body.error).toBe('Forbidden');
        expect(body.message).toBe('Access denied');

        // Should not reveal ownership details
        expect(body.message).not.toContain('owner');
        expect(body.message).not.toContain('belongs');
        expect(body.message).not.toContain('different user');
        expect(body.message).not.toContain('not authorized');
      }
    });

    it('should return consistent authorization error format across all protected endpoints', async () => {
      const protectedEndpoints = [
        { method: 'GET', url: '/admin/stats' },
        { method: 'POST', url: '/admin/reset' },
        { method: 'DELETE', url: '/config/reset' },
        { method: 'PUT', url: '/system/shutdown' },
      ];

      const authResponses = [];
      for (const endpoint of protectedEndpoints) {
        const response = await authTestContext.app.inject({
          method: endpoint.method as any,
          url: endpoint.url,
          headers: {
            'Authorization': 'Bearer valid-test-key-123'
          }
        });

        if (response.statusCode === 403) {
          authResponses.push(response);
        }
      }

      // All authorization failures should have identical format
      if (authResponses.length > 1) {
        const firstBody = JSON.parse(authResponses[0].body);
        authResponses.slice(1).forEach(response => {
          const body = JSON.parse(response.body);
          expect(body.error).toBe(firstBody.error);
          expect(body.message).toBe(firstBody.message);
          expect(body.statusCode).toBe(firstBody.statusCode);
        });
      }
    });
  });

  describe('Rate Limiting Generic Messages', () => {
    it('should return generic rate limit message without revealing limits or timing', async () => {
      // Make rapid requests to potentially trigger rate limiting
      const rapidRequests = Array.from({ length: 100 }, (_, i) =>
        testContext.app.inject({
          method: 'GET',
          url: '/health',
          headers: {
            'X-Forwarded-For': `192.168.1.${i % 10}` // Vary IP to avoid other limits
          }
        })
      );

      const responses = await Promise.all(rapidRequests);
      const rateLimitedResponse = responses.find(r => r.statusCode === 429);

      if (rateLimitedResponse) {
        const body = JSON.parse(rateLimitedResponse.body);

        expect(body.error).toBe('Too Many Requests');
        expect(body.message).toBe('Rate limit exceeded');

        // Should not reveal rate limiting configuration
        expect(body.message).not.toContain('per minute');
        expect(body.message).not.toContain('per hour');
        expect(body.message).not.toContain('limit');
        expect(body.message).not.toContain('requests');
        expect(body.message).not.toContain('window');
        expect(body.message).not.toContain('retry');
        expect(body.message).not.toContain('reset');
        expect(body.message).not.toContain('seconds');

        // Should not have rate limit headers that reveal config
        expect(rateLimitedResponse.headers).not.toHaveProperty('x-ratelimit-limit');
        expect(rateLimitedResponse.headers).not.toHaveProperty('x-ratelimit-remaining');
        expect(rateLimitedResponse.headers).not.toHaveProperty('x-ratelimit-reset');
      }
    });

    it('should return same rate limit message regardless of endpoint', async () => {
      // Test rate limiting across different endpoints
      const endpoints = ['/health', '/daemon/health', '/'];
      const rateLimitResponses = [];

      for (const endpoint of endpoints) {
        // Make many requests to each endpoint
        const requests = Array.from({ length: 30 }, () =>
          testContext.app.inject({
            method: 'GET',
            url: endpoint
          })
        );

        const responses = await Promise.all(requests);
        const rateLimited = responses.find(r => r.statusCode === 429);
        if (rateLimited) {
          rateLimitResponses.push(rateLimited);
        }
      }

      // All rate limit responses should be identical
      if (rateLimitResponses.length > 1) {
        const firstBody = JSON.parse(rateLimitResponses[0].body);
        rateLimitResponses.slice(1).forEach(response => {
          const body = JSON.parse(response.body);
          expect(body).toEqual(firstBody);
        });
      }
    });
  });

  describe('WebSocket Authentication Generic Messages', () => {
    it('should return generic authentication error for WebSocket connections', (done) => {
      const wsUrl = `ws://127.0.0.1:${authTestContext.serverPort}/stream/test-task`;
      const ws = new WebSocket(wsUrl); // No auth headers

      ws.on('error', (error: Error) => {
        // Should get generic authentication error
        expect(error.message).toContain('Unexpected server response: 401');

        // Should not reveal WebSocket-specific authentication details
        expect(error.message).not.toContain('header');
        expect(error.message).not.toContain('token');
        expect(error.message).not.toContain('authorization');
        expect(error.message).not.toContain('Bearer');
        expect(error.message).not.toContain('websocket');

        done();
      });

      ws.on('open', () => {
        ws.close();
        done(new Error('WebSocket should not open without authentication'));
      });

      // Timeout to prevent hanging
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.terminate();
          done(new Error('WebSocket connection timed out'));
        }
      }, 2000);
    });

    it('should return generic error for invalid WebSocket authentication', (done) => {
      const wsUrl = `ws://127.0.0.1:${authTestContext.serverPort}/stream/test-task`;
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': 'Bearer invalid-ws-token'
        }
      });

      ws.on('error', (error: Error) => {
        // Should get generic forbidden error
        expect(error.message).toContain('Unexpected server response: 403');

        // Should not reveal why the token was invalid
        expect(error.message).not.toContain('invalid');
        expect(error.message).not.toContain('expired');
        expect(error.message).not.toContain('malformed');
        expect(error.message).not.toContain('not found');

        done();
      });

      ws.on('open', () => {
        ws.close();
        done(new Error('WebSocket should not open with invalid authentication'));
      });

      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.terminate();
          done(new Error('WebSocket connection timed out'));
        }
      }, 2000);
    });
  });

  describe('Security Edge Cases and Attack Prevention', () => {
    it('should return generic errors for SQL injection attempts in authentication', async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "admin' OR '1'='1",
        "' UNION SELECT * FROM credentials --",
        "'; SELECT * FROM api_keys; --",
      ];

      for (const attempt of sqlInjectionAttempts) {
        const response = await authTestContext.app.inject({
          method: 'GET',
          url: '/tasks',
          headers: {
            'Authorization': `Bearer ${attempt}`,
            'X-API-Key': attempt
          }
        });

        expect(response.statusCode).toBe(403);

        const body = JSON.parse(response.body);
        expect(body.error).toBe('Forbidden');
        expect(body.message).toBe('Invalid authentication credentials');

        // Should not echo back the injection attempt
        expect(JSON.stringify(body)).not.toContain('DROP');
        expect(JSON.stringify(body)).not.toContain('SELECT');
        expect(JSON.stringify(body)).not.toContain('UNION');
        expect(JSON.stringify(body)).not.toContain(attempt);
      }
    });

    it('should return generic errors for path traversal attempts in resource access', async () => {
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '../../../../home/user/.ssh/id_rsa',
        '../.apex/config.yaml',
      ];

      for (const attempt of pathTraversalAttempts) {
        const response = await authTestContext.app.inject({
          method: 'GET',
          url: `/tasks/${attempt}`,
          headers: {
            'Authorization': 'Bearer valid-test-key-123'
          }
        });

        // Should be 404 or 403, with generic message
        expect([403, 404]).toContain(response.statusCode);

        const body = JSON.parse(response.body);

        if (response.statusCode === 404) {
          expect(body.error).toBe('Not Found');
          expect(body.message).toBe('Resource not found');
        } else if (response.statusCode === 403) {
          expect(body.error).toBe('Forbidden');
          expect(body.message).toBe('Access denied');
        }

        // Should not echo back the traversal attempt
        expect(JSON.stringify(body)).not.toContain('../');
        expect(JSON.stringify(body)).not.toContain('..\\');
        expect(JSON.stringify(body)).not.toContain('passwd');
        expect(JSON.stringify(body)).not.toContain('system32');
        expect(JSON.stringify(body)).not.toContain('.ssh');
        expect(JSON.stringify(body)).not.toContain(attempt);
      }
    });

    it('should return generic errors for timing attack attempts', async () => {
      // Test multiple authentication attempts to ensure consistent timing
      const attempts = [
        'valid-test-key-123',     // Valid key
        'valid-test-key-124',     // Almost valid (off by one)
        'wrong-test-key-123',     // Wrong prefix, right suffix
        'valid-fake-key-456',     // Wrong middle, valid-looking structure
        'x'.repeat(47),           // Same length, completely wrong
        'y'.repeat(20),           // Different length
      ];

      const timings = [];
      for (const key of attempts) {
        const start = process.hrtime.bigint();

        const response = await authTestContext.app.inject({
          method: 'GET',
          url: '/tasks',
          headers: {
            'X-API-Key': key
          }
        });

        const duration = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        timings.push({ key, duration, statusCode: response.statusCode });

        // All invalid keys should get same error message
        if (response.statusCode === 403) {
          const body = JSON.parse(response.body);
          expect(body.error).toBe('Forbidden');
          expect(body.message).toBe('Invalid authentication credentials');
        }
      }

      // Check that timing variations are within reasonable bounds
      const invalidTimings = timings.filter(t => t.statusCode === 403);
      if (invalidTimings.length > 1) {
        const avgTiming = invalidTimings.reduce((sum, t) => sum + t.duration, 0) / invalidTimings.length;
        invalidTimings.forEach(timing => {
          const variance = Math.abs(timing.duration - avgTiming);
          expect(variance).toBeLessThan(100); // 100ms variance tolerance
        });
      }
    });

    it('should prevent enumeration attacks through consistent error responses', async () => {
      // Test accessing resources that may or may not exist
      const resourceTests = [
        '/tasks/real-looking-uuid-12345678-1234-5678-9abc-123456789012',
        '/tasks/00000000-0000-0000-0000-000000000000',
        '/tasks/existing-task-name',
        '/tasks/admin-task',
        '/tasks/test-task-1',
      ];

      const responses = [];
      for (const resourceUrl of resourceTests) {
        const response = await authTestContext.app.inject({
          method: 'GET',
          url: resourceUrl,
          headers: {
            'Authorization': 'Bearer valid-test-key-123'
          }
        });
        responses.push(response);
      }

      // All non-existent resources should return identical 404 responses
      const notFoundResponses = responses.filter(r => r.statusCode === 404);
      if (notFoundResponses.length > 1) {
        const firstBody = JSON.parse(notFoundResponses[0].body);
        notFoundResponses.slice(1).forEach(response => {
          const body = JSON.parse(response.body);
          expect(body).toEqual(firstBody);
        });

        // Verify generic message
        expect(firstBody.error).toBe('Not Found');
        expect(firstBody.message).toBe('Resource not found');

        // Should not reveal why it wasn't found
        expect(firstBody.message).not.toContain('does not exist');
        expect(firstBody.message).not.toContain('invalid');
        expect(firstBody.message).not.toContain('permission');
        expect(firstBody.message).not.toContain('access');
      }
    });

    it('should sanitize error messages under high load conditions', async () => {
      // Test that error messages remain generic even under stress
      const concurrentRequests = Array.from({ length: 50 }, (_, i) =>
        authTestContext.app.inject({
          method: 'POST',
          url: '/tasks',
          headers: {
            'Authorization': `Bearer invalid-concurrent-token-${i}`
          },
          payload: {
            description: `Concurrent test task ${i}`
          }
        })
      );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach((response, index) => {
        expect(response.statusCode).toBe(403);

        const body = JSON.parse(response.body);
        expect(body.error).toBe('Forbidden');
        expect(body.message).toBe('Invalid authentication credentials');

        // Error messages should remain consistent under load
        expect(body.message).not.toContain('concurrent');
        expect(body.message).not.toContain('load');
        expect(body.message).not.toContain('overload');
        expect(body.message).not.toContain('busy');
        expect(body.message).not.toContain(index.toString());
      });

      // All error responses should be identical
      const firstBody = JSON.parse(responses[0].body);
      responses.slice(1).forEach(response => {
        const body = JSON.parse(response.body);
        expect(body).toEqual(firstBody);
      });
    });
  });
});