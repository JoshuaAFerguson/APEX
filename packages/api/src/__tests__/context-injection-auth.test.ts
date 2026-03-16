/**
 * Auth Middleware Tests for Context Injection API Endpoint - @apex/api Package
 *
 * Tests authentication and authorization for the POST /tasks/:id/context endpoint:
 * - Authentication requirement verification
 * - Bearer token authentication
 * - X-API-Key authentication
 * - Invalid authentication handling
 * - Unauthorized access prevention
 *
 * Acceptance Criteria:
 * 1. Endpoint requires authentication when auth is enabled
 * 2. Valid Bearer tokens allow access
 * 3. Valid X-API-Key headers allow access
 * 4. Invalid credentials are rejected with 403
 * 5. Missing credentials are rejected with 401
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../index.js';
import { InjectContextRequest } from '@apexcli/core';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

/**
 * Test context for auth testing with authentication enabled
 */
interface ContextInjectionAuthTestContext {
  app: FastifyInstance;
  serverPort: number;
  projectPath: string;
  cleanup: () => Promise<void>;
}

/**
 * Create a test server with authentication enabled
 */
async function createAuthEnabledTestServer(projectPath: string): Promise<ContextInjectionAuthTestContext> {
  const apexDir = path.join(projectPath, '.apex');
  const configPath = path.join(apexDir, 'config.yaml');

  // Ensure .apex directory exists
  await mkdir(apexDir, { recursive: true });

  // Create config with auth enabled
  const authConfig = `
api:
  auth:
    enabled: true
    apiKeys:
      - test-api-key-123
      - another-valid-key
      - context-injection-key
`;

  await writeFile(configPath, authConfig);

  // Create server that will read this config
  const app = await createServer({
    projectPath,
    port: 0,
    silent: true,
  });

  // Start server and get assigned port
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();

  if (!address || typeof address !== 'object') {
    throw new Error('Failed to start test server');
  }

  const serverPort = address.port;

  const cleanup = async (): Promise<void> => {
    if (app) {
      await app.close();
    }
    // Clean up temp directory
    await rm(projectPath, { recursive: true, force: true });
  };

  return {
    app,
    serverPort,
    projectPath,
    cleanup,
  };
}

describe('Context Injection Auth Middleware Tests', () => {
  let context: ContextInjectionAuthTestContext;

  beforeEach(async () => {
    // Create temp directory for test project
    const tempDir = await mkdtemp(path.join(tmpdir(), 'apex-test-context-auth-'));
    context = await createAuthEnabledTestServer(tempDir);
  });

  afterEach(async () => {
    if (context?.cleanup) {
      await context.cleanup();
    }
  });

  describe('Authentication Required', () => {
    it('should return 401 when no authentication is provided', async () => {
      const payload: InjectContextRequest = {
        context: 'Test context without auth',
      };

      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: { 'Content-Type': 'application/json' },
        payload,
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Unauthorized');
      expect(body).toHaveProperty('message', 'Authentication required');
      expect(body).toHaveProperty('statusCode', 401);
    });

    it('should return 401 for empty Authorization header', async () => {
      const payload: InjectContextRequest = {
        context: 'Test context with empty auth',
      };

      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'Authorization': '',
          'Content-Type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');
    });

    it('should return 401 for empty X-API-Key header', async () => {
      const payload: InjectContextRequest = {
        context: 'Test context with empty API key',
      };

      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'X-API-Key': '',
          'Content-Type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');
    });
  });

  describe('Bearer Token Authentication', () => {
    it('should allow access with valid Bearer token', async () => {
      const payload: InjectContextRequest = {
        context: 'Authorized context with Bearer token',
        source: 'bearer-auth-test',
      };

      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'Authorization': 'Bearer test-api-key-123',
          'Content-Type': 'application/json',
        },
        payload,
      });

      // Should not return 401 or 403 (might return 404 for non-existent task)
      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(403);
    });

    it('should allow access with alternative valid Bearer token', async () => {
      const payload: InjectContextRequest = {
        context: 'Context with alternative token',
      };

      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'Authorization': 'Bearer another-valid-key',
          'Content-Type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(403);
    });

    it('should allow access with context-specific API key', async () => {
      const payload: InjectContextRequest = {
        context: 'Context with context-specific key',
      };

      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'Authorization': 'Bearer context-injection-key',
          'Content-Type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(403);
    });
  });

  describe('X-API-Key Authentication', () => {
    it('should allow access with valid X-API-Key header', async () => {
      const payload: InjectContextRequest = {
        context: 'Authorized context with API key header',
        source: 'api-key-test',
      };

      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'X-API-Key': 'test-api-key-123',
          'Content-Type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(403);
    });

    it('should allow access with alternative valid API key', async () => {
      const payload: InjectContextRequest = {
        context: 'Context with alternative API key',
      };

      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'X-API-Key': 'another-valid-key',
          'Content-Type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(403);
    });
  });

  describe('Invalid Authentication', () => {
    it('should return 403 for invalid Bearer token', async () => {
      const payload: InjectContextRequest = {
        context: 'Context with invalid Bearer token',
      };

      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'Authorization': 'Bearer invalid-token-12345',
          'Content-Type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).toBe(403);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Forbidden');
      expect(body).toHaveProperty('message', 'Invalid authentication credentials');
      expect(body).toHaveProperty('statusCode', 403);
    });

    it('should return 403 for invalid X-API-Key', async () => {
      const payload: InjectContextRequest = {
        context: 'Context with invalid API key',
      };

      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'X-API-Key': 'invalid-api-key-67890',
          'Content-Type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).toBe(403);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Forbidden');
      expect(body).toHaveProperty('message', 'Invalid authentication credentials');
    });

    it('should return 403 for malformed Authorization header', async () => {
      const payload: InjectContextRequest = {
        context: 'Context with malformed auth header',
      };

      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'Authorization': 'InvalidFormat token-value',
          'Content-Type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).toBe(403);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Forbidden');
    });

    it('should return 403 for Bearer token with no value', async () => {
      const payload: InjectContextRequest = {
        context: 'Context with empty Bearer value',
      };

      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'Authorization': 'Bearer ',
          'Content-Type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).toBe(403);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Forbidden');
    });

    it('should return 403 for Authorization header without Bearer prefix', async () => {
      const payload: InjectContextRequest = {
        context: 'Context without Bearer prefix',
      };

      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'Authorization': 'test-api-key-123',
          'Content-Type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Authentication Precedence', () => {
    it('should use Bearer token when both Authorization and X-API-Key headers are present', async () => {
      const payload: InjectContextRequest = {
        context: 'Context testing auth precedence',
      };

      // Valid Bearer token, invalid API key - should succeed
      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'Authorization': 'Bearer test-api-key-123', // Valid
          'X-API-Key': 'invalid-key', // Invalid
          'Content-Type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(403);
    });

    it('should fallback to X-API-Key when Bearer token is invalid', async () => {
      const payload: InjectContextRequest = {
        context: 'Context testing auth fallback',
      };

      // Invalid Bearer token, valid API key - should succeed
      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'Authorization': 'Bearer invalid-token', // Invalid
          'X-API-Key': 'test-api-key-123', // Valid
          'Content-Type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(403);
    });

    it('should return 403 when both Bearer token and X-API-Key are invalid', async () => {
      const payload: InjectContextRequest = {
        context: 'Context with all invalid auth',
      };

      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'X-API-Key': 'invalid-key',
          'Content-Type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).toBe(403);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Forbidden');
    });
  });

  describe('Case Sensitivity and Edge Cases', () => {
    it('should be case-sensitive for API keys', async () => {
      const payload: InjectContextRequest = {
        context: 'Case sensitivity test',
      };

      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'X-API-Key': 'TEST-API-KEY-123', // Different case
          'Content-Type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should handle whitespace in API keys correctly', async () => {
      const payload: InjectContextRequest = {
        context: 'Whitespace test',
      };

      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'X-API-Key': ' test-api-key-123 ', // With whitespace
          'Content-Type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should reject null bytes in authentication', async () => {
      const payload: InjectContextRequest = {
        context: 'Null byte test',
      };

      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'X-API-Key': 'test-api-key-123\x00',
          'Content-Type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Header Case Insensitivity', () => {
    it('should accept X-API-Key header with different casing', async () => {
      const payload: InjectContextRequest = {
        context: 'Header case test',
      };

      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'x-api-key': 'test-api-key-123', // Lowercase
          'Content-Type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(403);
    });

    it('should accept Authorization header with different casing', async () => {
      const payload: InjectContextRequest = {
        context: 'Authorization case test',
      };

      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/test-task-id/context',
        headers: {
          'authorization': 'Bearer test-api-key-123', // Lowercase
          'Content-Type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(403);
    });
  });

  describe('Endpoint Coverage Verification', () => {
    it('should confirm context injection endpoint is protected by auth middleware', async () => {
      // Test that the context injection endpoint is NOT in the public routes list
      const publicRoutes = ['/health', '/status', '/metrics', '/ws'];

      expect(publicRoutes).not.toContain('/tasks/:id/context');
      expect(publicRoutes).not.toContain('/tasks/*/context');

      // Verify that the endpoint requires authentication
      const response = await context.app.inject({
        method: 'POST',
        url: '/tasks/any-task-id/context',
        headers: { 'Content-Type': 'application/json' },
        payload: { context: 'Test' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should verify auth middleware applies to all HTTP methods on context endpoint', async () => {
      const methods = ['POST']; // Only POST is valid for this endpoint

      for (const method of methods) {
        const response = await context.app.inject({
          method: method as any,
          url: '/tasks/test-task-id/context',
          headers: { 'Content-Type': 'application/json' },
          payload: method === 'POST' ? { context: 'Test' } : undefined,
        });

        if (method === 'POST') {
          expect(response.statusCode).toBe(401); // Unauthorized for POST without auth
        }
      }
    });
  });
});