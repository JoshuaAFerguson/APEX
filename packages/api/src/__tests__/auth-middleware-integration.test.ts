/**
 * Integration tests for auth middleware functionality
 * Tests the complete auth middleware flow with real configuration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createTestEnvironment } from './setup.js';
import { writeFile } from 'fs/promises';
import path from 'path';

interface AuthIntegrationTestContext {
  app: FastifyInstance;
  projectPath: string;
  cleanup: () => Promise<void>;
}

describe('Auth Middleware Integration', () => {
  let context: AuthIntegrationTestContext;

  beforeEach(async () => {
    // Create test environment with auth enabled
    const testEnv = await createTestEnvironment({
      silent: true,
      mockOrchestrator: false  // Use real orchestrator to test config loading
    });

    context = testEnv as AuthIntegrationTestContext;
  });

  afterEach(async () => {
    if (context?.cleanup) {
      await context.cleanup();
    }
  });

  describe('Configuration Loading', () => {
    it('should load auth config from .apex/config.yaml', async () => {
      // Create config with auth enabled
      const configPath = path.join(context.projectPath, '.apex', 'config.yaml');
      const configContent = `
version: "1.0"
project:
  name: "test-auth-project"
  description: "Test project for auth"
api:
  port: 3000
  auth:
    enabled: true
    apiKeys:
      - "test-key-123"
      - "another-valid-key"
`;

      await writeFile(configPath, configContent);

      // The auth middleware should be configured with these keys
      // Test that valid key works
      const validResponse = await context.app.inject({
        method: 'GET',
        url: '/tasks',
        headers: {
          'X-API-Key': 'test-key-123'
        }
      });

      // Should succeed with valid key
      expect(validResponse.statusCode).not.toBe(401);
      expect(validResponse.statusCode).not.toBe(403);

      // Test that invalid key fails
      const invalidResponse = await context.app.inject({
        method: 'GET',
        url: '/tasks',
        headers: {
          'X-API-Key': 'invalid-key'
        }
      });

      expect([401, 403]).toContain(invalidResponse.statusCode);
    });

    it('should work with auth disabled by default', async () => {
      // Create config without auth section
      const configPath = path.join(context.projectPath, '.apex', 'config.yaml');
      const configContent = `
version: "1.0"
project:
  name: "test-no-auth-project"
  description: "Test project without auth"
api:
  port: 3000
`;

      await writeFile(configPath, configContent);

      // Should allow access without authentication
      const response = await context.app.inject({
        method: 'GET',
        url: '/tasks'
      });

      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(403);
    });
  });

  describe('Bearer Token Authentication', () => {
    it('should authenticate with Bearer token from config', async () => {
      const configPath = path.join(context.projectPath, '.apex', 'config.yaml');
      const configContent = `
version: "1.0"
project:
  name: "bearer-auth-test"
api:
  auth:
    enabled: true
    apiKeys:
      - "bearer-token-123"
`;

      await writeFile(configPath, configContent);

      const response = await context.app.inject({
        method: 'GET',
        url: '/tasks',
        headers: {
          'Authorization': 'Bearer bearer-token-123'
        }
      });

      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(403);
    });
  });

  describe('Public Routes', () => {
    it('should allow access to health endpoint without auth', async () => {
      const configPath = path.join(context.projectPath, '.apex', 'config.yaml');
      const configContent = `
version: "1.0"
project:
  name: "public-routes-test"
api:
  auth:
    enabled: true
    apiKeys:
      - "secret-key"
`;

      await writeFile(configPath, configContent);

      // Health endpoint should be public
      const healthResponse = await context.app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(healthResponse.statusCode).toBe(200);

      // Tasks endpoint should require auth
      const tasksResponse = await context.app.inject({
        method: 'GET',
        url: '/tasks'
      });

      expect(tasksResponse.statusCode).toBe(401);
    });
  });

  describe('Error Responses', () => {
    it('should return proper error format for auth failures', async () => {
      const configPath = path.join(context.projectPath, '.apex', 'config.yaml');
      const configContent = `
version: "1.0"
project:
  name: "error-format-test"
api:
  auth:
    enabled: true
    apiKeys:
      - "valid-key"
`;

      await writeFile(configPath, configContent);

      // Test missing auth
      const noAuthResponse = await context.app.inject({
        method: 'GET',
        url: '/tasks'
      });

      expect(noAuthResponse.statusCode).toBe(401);

      const noAuthBody = JSON.parse(noAuthResponse.body);
      expect(noAuthBody).toHaveProperty('error', 'Unauthorized');
      expect(noAuthBody).toHaveProperty('message', 'Authentication required');
      expect(noAuthBody).toHaveProperty('statusCode', 401);

      // Test invalid auth
      const invalidAuthResponse = await context.app.inject({
        method: 'GET',
        url: '/tasks',
        headers: {
          'X-API-Key': 'invalid-key'
        }
      });

      expect(invalidAuthResponse.statusCode).toBe(403);

      const invalidAuthBody = JSON.parse(invalidAuthResponse.body);
      expect(invalidAuthBody).toHaveProperty('error', 'Forbidden');
      expect(invalidAuthBody).toHaveProperty('message', 'Invalid authentication credentials');
      expect(invalidAuthBody).toHaveProperty('statusCode', 403);
    });
  });

  describe('Security Tests', () => {
    it('should handle timing attacks protection', async () => {
      const configPath = path.join(context.projectPath, '.apex', 'config.yaml');
      const configContent = `
version: "1.0"
project:
  name: "timing-attack-test"
api:
  auth:
    enabled: true
    apiKeys:
      - "security-test-key-1234567890"
`;

      await writeFile(configPath, configContent);

      // Test multiple invalid keys of same length
      const testKeys = [
        'invalid-test-key-1234567890',  // same length, different chars
        'another-fake-key-1234567890',
        'security-fake-key-1234567890'
      ];

      const timings: number[] = [];

      for (const key of testKeys) {
        const start = process.hrtime.bigint();

        await context.app.inject({
          method: 'GET',
          url: '/tasks',
          headers: {
            'X-API-Key': key
          }
        });

        const end = process.hrtime.bigint();
        timings.push(Number(end - start) / 1000000); // Convert to ms
      }

      // Timing variance should be minimal for constant-time comparison
      const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;
      const variance = timings.reduce((acc, timing) => acc + Math.pow(timing - avgTiming, 2), 0) / timings.length;
      const stdDev = Math.sqrt(variance);

      // Standard deviation should be relatively small
      expect(stdDev).toBeLessThan(avgTiming * 0.1); // Less than 10% of average
    });
  });
});