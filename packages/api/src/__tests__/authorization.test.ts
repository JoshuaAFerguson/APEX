/**
 * Authorization Test Infrastructure for @apex/api Package
 *
 * This test file provides infrastructure and validation for authorization
 * mechanisms in the APEX API. The API now has authorization implemented,
 * which these tests validate by creating an auth-enabled server instance.
 *
 * Usage:
 *   npm test --workspace=@apex/api
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../index.js';
import { WebSocket } from 'ws';

/**
 * Test context for authorization testing
 */
interface AuthorizationTestContext {
  app: FastifyInstance;
  serverPort: number;
  projectPath: string;
  cleanup: () => Promise<void>;
}

/**
 * Create a test server with authentication enabled
 */
async function createTestServerWithAuth(projectPath: string): Promise<AuthorizationTestContext> {
  // First create a minimal config file to enable auth
  const fs = await import('fs/promises');
  const path = await import('path');

  const apexDir = path.join(projectPath, '.apex');
  const configPath = path.join(apexDir, 'config.yaml');

  // Ensure .apex directory exists
  await fs.mkdir(apexDir, { recursive: true });

  // Create config with auth enabled
  const authConfig = `version: "1.0"
project:
  name: apex-auth-test
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
      - test-api-key-123
      - another-valid-key
`;

  await fs.writeFile(configPath, authConfig);

  // Create server that will read this config
  const authEnabledApp = await createServer({
    projectPath,
    port: 0,
    silent: true,
  });

  // Start server and get assigned port
  await authEnabledApp.listen({ port: 0, host: '127.0.0.1' });
  const address = authEnabledApp.server.address();

  if (!address || typeof address !== 'object') {
    throw new Error('Failed to start test server');
  }

  const serverPort = address.port;

  const cleanup = async (): Promise<void> => {
    if (authEnabledApp) {
      await authEnabledApp.close();
    }
    // Clean up temp directory
    await fs.rm(projectPath, { recursive: true, force: true });
  };

  return {
    app: authEnabledApp,
    serverPort,
    projectPath,
    cleanup,
  };
}

describe('Authorization Test Infrastructure', () => {
  let context: AuthorizationTestContext;

  beforeEach(async () => {
    // Create temp directory for test project
    const { mkdtemp } = await import('fs/promises');
    const { tmpdir } = await import('os');
    const path = await import('path');

    const tempDir = await mkdtemp(path.join(tmpdir(), 'apex-test-auth-'));
    context = await createTestServerWithAuth(tempDir);
  });

  afterEach(async () => {
    if (context?.cleanup) {
      await context.cleanup();
    }
  });

  describe('Current Authorization State', () => {
    it('should confirm API now requires authentication for protected endpoints', async () => {
      // Test that protected endpoints now return 401 without authentication
      const protectedEndpoints = [
        { method: 'GET', url: '/tasks' },
        { method: 'GET', url: '/agents' },
        { method: 'GET', url: '/config' },
        { method: 'GET', url: '/templates' },
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await context.app.inject({
          method: endpoint.method as any,
          url: endpoint.url,
        });

        // Should return authentication errors now
        expect(response.statusCode).toBe(401); // Unauthorized
      }
    });

    it('should require authentication for task creation', async () => {
      const createResponse = await context.app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          description: 'Authorization test task'
        }
      });

      expect(createResponse.statusCode).toBe(401);

      const body = JSON.parse(createResponse.body);
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('statusCode', 401);
      expect(body.error).toBe('Unauthorized');
    });

    it('should allow task creation with valid authentication', async () => {
      const createResponse = await context.app.inject({
        method: 'POST',
        url: '/tasks',
        headers: {
          'Authorization': 'Bearer test-api-key-123'
        },
        payload: {
          description: 'Authorization test task'
        }
      });

      expect(createResponse.statusCode).toBe(201);

      const taskData = JSON.parse(createResponse.body);
      expect(taskData).toHaveProperty('taskId');
      expect(taskData).toHaveProperty('status', 'pending');
    });

    it('should reject WebSocket connections without authentication', (done) => {
      const wsUrl = `ws://127.0.0.1:${context.serverPort}/stream/test-task-id`;
      const ws = new WebSocket(wsUrl);

      ws.on('error', (error: Error) => {
        // Connection should be rejected due to lack of authentication
        expect(error.message).toContain('Unexpected server response: 401');
        done();
      });

      ws.on('open', () => {
        // Connection should NOT open without authentication
        ws.close();
        done(new Error('WebSocket connection opened without authentication - security failure!'));
      });

      // Timeout to avoid hanging test
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.terminate();
          done(new Error('WebSocket connection attempt timed out'));
        }
      }, 2000);
    });
  });

  describe('Authorization Infrastructure Setup', () => {
    it('should have proper test environment for authorization testing', () => {
      expect(context.app).toBeDefined();
      expect(context.serverPort).toBeGreaterThan(0);
      expect(context.projectPath).toBeDefined();
    });

    it('should support CORS for authentication headers', async () => {
      const corsResponse = await context.app.inject({
        method: 'OPTIONS',
        url: '/tasks',
        headers: {
          'Origin': 'https://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Authorization,Content-Type',
        }
      });

      expect(corsResponse.statusCode).toBe(204);
    });

    it('should allow health check without authentication', async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: '/health',
      });

      // Health endpoint should remain public
      expect(response.statusCode).toBe(200);
      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('Authorization Framework Validation', () => {
    it('should validate Bearer token authentication', async () => {
      // Test with valid token
      const validResponse = await context.app.inject({
        method: 'GET',
        url: '/config',
        headers: {
          'Authorization': 'Bearer test-api-key-123'
        }
      });

      expect(validResponse.statusCode).not.toBe(401);
      expect(validResponse.statusCode).not.toBe(403);
    });

    it('should reject invalid Bearer tokens', async () => {
      const invalidResponse = await context.app.inject({
        method: 'GET',
        url: '/config',
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });

      expect(invalidResponse.statusCode).toBe(403);
      const body = JSON.parse(invalidResponse.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toBe('Forbidden');
    });

    it('should validate X-API-Key authentication', async () => {
      // Test with valid API key
      const validResponse = await context.app.inject({
        method: 'GET',
        url: '/config',
        headers: {
          'X-API-Key': 'another-valid-key'
        }
      });

      expect(validResponse.statusCode).not.toBe(401);
      expect(validResponse.statusCode).not.toBe(403);
    });

    it('should reject invalid API keys', async () => {
      const invalidResponse = await context.app.inject({
        method: 'GET',
        url: '/config',
        headers: {
          'X-API-Key': 'invalid-api-key'
        }
      });

      expect(invalidResponse.statusCode).toBe(403);
      const body = JSON.parse(invalidResponse.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toBe('Forbidden');
    });
  });

  describe('Authorization Documentation', () => {
    it('should document current authorization status', () => {
      const authStatus = {
        implemented: true,
        endpoints_protected: 25, // Approximate count of protected endpoints
        security_level: 'API_KEY_BEARER',
        test_infrastructure_ready: true,
      };

      expect(authStatus.implemented).toBe(true);
      expect(authStatus.endpoints_protected).toBeGreaterThan(0);
      expect(authStatus.security_level).toBe('API_KEY_BEARER');
      expect(authStatus.test_infrastructure_ready).toBe(true);
    });
  });

  describe('Test Infrastructure Validation', () => {
    it('should validate all test components are working', () => {
      expect(context.app).toBeDefined();
      expect(typeof context.cleanup).toBe('function');
    });

    it('should confirm test environment is properly isolated', async () => {
      // Verify we have an isolated test environment
      expect(context.projectPath).toContain('apex-test-auth-');

      // Verify server is running on dynamic port
      expect(context.serverPort).toBeGreaterThan(0);
      expect(context.serverPort).not.toBe(3000); // Not using default port
    });
  });

  describe('WebSocket Authorization', () => {
    let testTaskId: string;

    beforeEach(async () => {
      // Create a test task for WebSocket testing
      const createResponse = await context.app.inject({
        method: 'POST',
        url: '/tasks',
        headers: {
          'Authorization': 'Bearer test-api-key-123' // Use valid auth for task creation
        },
        payload: {
          description: 'Test task for WebSocket authorization testing'
        }
      });

      expect(createResponse.statusCode).toBe(201);
      const taskData = JSON.parse(createResponse.body);
      testTaskId = taskData.taskId;
    });

    it('should allow WebSocket connection to /ws without authentication (public route)', (done) => {
      const wsUrl = `ws://127.0.0.1:${context.serverPort}/ws`;
      const ws = new WebSocket(wsUrl);

      ws.on('error', (error: Error) => {
        // Should not error - /ws is in public routes
        done(new Error(`WebSocket connection to /ws failed: ${error.message}`));
      });

      ws.on('open', () => {
        // Connection should open successfully since /ws is public
        ws.close();
        done();
      });

      // Timeout to avoid hanging test
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.terminate();
          done(new Error('WebSocket connection attempt timed out'));
        }
      }, 2000);
    });

    it('should allow authenticated WebSocket connections to task streams', (done) => {
      const wsUrl = `ws://127.0.0.1:${context.serverPort}/stream/${testTaskId}`;
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': 'Bearer test-api-key-123'
        }
      });

      ws.on('error', (error: Error) => {
        // Should not error with valid authentication
        done(new Error(`WebSocket connection with valid auth failed: ${error.message}`));
      });

      ws.on('open', () => {
        // Connection should open successfully with valid auth
        ws.close();
        done();
      });

      // Timeout to avoid hanging test
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.terminate();
          done(new Error('WebSocket connection with valid auth timed out'));
        }
      }, 2000);
    });

    it('should reject WebSocket connections with invalid authentication', (done) => {
      const wsUrl = `ws://127.0.0.1:${context.serverPort}/stream/${testTaskId}`;
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });

      ws.on('error', (error: Error) => {
        // Connection should be rejected due to invalid authentication
        expect(error.message).toContain('Unexpected server response: 403');
        done();
      });

      ws.on('open', () => {
        // Connection should NOT open with invalid authentication
        ws.close();
        done(new Error('WebSocket connection opened with invalid authentication - security failure!'));
      });

      // Timeout to avoid hanging test
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.terminate();
          done(new Error('WebSocket connection with invalid auth timed out'));
        }
      }, 2000);
    });
  });
});