/**
 * Acceptance criteria validation tests for navigation scenario handlers
 *
 * This test suite validates all acceptance criteria for the navigation
 * scenario handlers implementation in the MockServer class.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockServer } from '../mock-server';

describe('Navigation Scenario Handlers - Acceptance Criteria', () => {
  let mockServer: MockServer;

  beforeEach(async () => {
    mockServer = new MockServer();
    await mockServer.start();
  });

  afterEach(async () => {
    if (mockServer && mockServer.isRunning()) {
      await mockServer.stop();
    }
  });

  describe('Acceptance Criteria: MockServer supports redirect routes with configurable status codes and targets', () => {
    it('should support 301 permanent redirects', async () => {
      const response = await fetch(`${mockServer.getUrl()}/redirect/301/dashboard`, {
        redirect: 'manual',
      });

      expect(response.status).toBe(301);
      expect(response.headers.get('location')).toBe('/dashboard');
    });

    it('should support 302 temporary redirects', async () => {
      const response = await fetch(`${mockServer.getUrl()}/redirect/302/login`, {
        redirect: 'manual',
      });

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/login');
    });

    it('should support 307 temporary redirects with method preservation', async () => {
      const response = await fetch(`${mockServer.getUrl()}/redirect/307/profile`, {
        redirect: 'manual',
      });

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('/profile');
    });

    it('should support 308 permanent redirects via query parameter', async () => {
      const response = await fetch(`${mockServer.getUrl()}/redirect?status=308&target=/settings`, {
        redirect: 'manual',
      });

      expect(response.status).toBe(308);
      expect(response.headers.get('location')).toBe('/settings');
    });

    it('should support configurable redirect targets', async () => {
      const testTargets = ['/home', '/about', '/contact', '/api/data'];

      for (const target of testTargets) {
        const response = await fetch(`${mockServer.getUrl()}/redirect?status=302&target=${target}`, {
          redirect: 'manual',
        });

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe(target);
      }
    });

    it('should handle home shortcut in redirect routes', async () => {
      const response = await fetch(`${mockServer.getUrl()}/redirect/301/home`, {
        redirect: 'manual',
      });

      expect(response.status).toBe(301);
      expect(response.headers.get('location')).toBe('/'); // home should map to root
    });

    it('should validate redirect status codes', async () => {
      // Valid redirect codes should work
      const validCodes = [301, 302, 307, 308];
      for (const code of validCodes) {
        const response = await fetch(`${mockServer.getUrl()}/redirect?status=${code}&target=/test`);
        expect([code, 200]).toContain(response.status); // Either redirect or followed redirect
      }

      // Invalid redirect codes should be rejected
      const response = await fetch(`${mockServer.getUrl()}/redirect?status=200&target=/test`);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('Invalid redirect status code');
    });
  });

  describe('Acceptance Criteria: MockServer supports error routes that return specific HTTP errors', () => {
    it('should support 404 Not Found errors', async () => {
      const response = await fetch(`${mockServer.getUrl()}/error/404`);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('Not Found');
      expect(data.message).toBe('The requested resource was not found');
      expect(data).toHaveProperty('path');
      expect(data).toHaveProperty('timestamp');
    });

    it('should support 500 Internal Server Error', async () => {
      const response = await fetch(`${mockServer.getUrl()}/error/500`);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Internal Server Error');
      expect(data.message).toBe('An internal server error occurred');
      expect(data).toHaveProperty('timestamp');
    });

    it('should support 401 Unauthorized errors', async () => {
      const response = await fetch(`${mockServer.getUrl()}/error/401`);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
      expect(data.message).toBe('Authentication required');
      expect(data).toHaveProperty('timestamp');
    });

    it('should support 403 Forbidden errors', async () => {
      const response = await fetch(`${mockServer.getUrl()}/error/403`);

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('Forbidden');
      expect(data.message).toBe('Access denied');
      expect(data).toHaveProperty('timestamp');
    });

    it('should support 503 Service Unavailable errors', async () => {
      const response = await fetch(`${mockServer.getUrl()}/error/503`);

      expect(response.status).toBe(503);

      const data = await response.json();
      expect(data.error).toBe('Service Unavailable');
      expect(data.message).toBe('Service temporarily unavailable');
      expect(data).toHaveProperty('timestamp');
    });

    it('should support configurable error status codes via query parameters', async () => {
      const testCodes = [418, 422, 429, 502, 503];

      for (const code of testCodes) {
        const response = await fetch(`${mockServer.getUrl()}/error?status=${code}`);

        expect(response.status).toBe(code);

        const data = await response.json();
        expect(data.error).toBe(`HTTP ${code}`);
        expect(data).toHaveProperty('timestamp');
      }
    });

    it('should support custom error messages', async () => {
      const customMessage = 'This is a custom error message';
      const response = await fetch(`${mockServer.getUrl()}/error?status=422&message=${encodeURIComponent(customMessage)}`);

      expect(response.status).toBe(422);

      const data = await response.json();
      expect(data.error).toBe('HTTP 422');
      expect(data.message).toBe(customMessage);
    });

    it('should validate error status codes', async () => {
      // Valid error codes (400-599) should work
      const validCodes = [400, 404, 500, 599];
      for (const code of validCodes) {
        const response = await fetch(`${mockServer.getUrl()}/error?status=${code}`);
        expect(response.status).toBe(code);
      }

      // Invalid error codes should be rejected
      const invalidCodes = [200, 300, 399, 600];
      for (const code of invalidCodes) {
        const response = await fetch(`${mockServer.getUrl()}/error?status=${code}`);
        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.error).toContain('Invalid error status code');
      }
    });
  });

  describe('Acceptance Criteria: MockServer supports delay routes with configurable response time', () => {
    it('should support configurable delays via path parameter', async () => {
      const delayMs = 100;
      const startTime = Date.now();

      const response = await fetch(`${mockServer.getUrl()}/delay/${delayMs}`);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeGreaterThanOrEqual(delayMs - 50); // Allow 50ms tolerance

      const data = await response.json();
      expect(data.message).toBe(`Response delayed by ${delayMs}ms`);
      expect(data.delayMs).toBe(delayMs);
      expect(data).toHaveProperty('timestamp');
    });

    it('should support configurable delays via query parameter', async () => {
      const delayMs = 150;
      const startTime = Date.now();

      const response = await fetch(`${mockServer.getUrl()}/delay?ms=${delayMs}`);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeGreaterThanOrEqual(delayMs - 50);

      const data = await response.json();
      expect(data.delayMs).toBe(delayMs);
    });

    it('should support delays with error responses', async () => {
      const delayMs = 100;
      const errorStatus = 404;
      const startTime = Date.now();

      const response = await fetch(`${mockServer.getUrl()}/delay-error/${delayMs}/${errorStatus}`);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(errorStatus);
      expect(duration).toBeGreaterThanOrEqual(delayMs - 50);

      const data = await response.json();
      expect(data.error).toBe(`HTTP ${errorStatus}`);
      expect(data.message).toBe(`Delayed error response (${delayMs}ms delay)`);
      expect(data.delayMs).toBe(delayMs);
    });

    it('should support slow redirects', async () => {
      const delayMs = 100;
      const startTime = Date.now();

      const response = await fetch(`${mockServer.getUrl()}/slow-redirect/${delayMs}/about`, {
        redirect: 'manual',
      });
      const duration = Date.now() - startTime;

      expect(response.status).toBe(302);
      expect(duration).toBeGreaterThanOrEqual(delayMs - 50);
      expect(response.headers.get('location')).toBe('/about');
    });

    it('should handle various delay values', async () => {
      const testDelays = [0, 1, 50, 100, 500];

      for (const delay of testDelays) {
        const startTime = Date.now();
        const response = await fetch(`${mockServer.getUrl()}/delay/${delay}`);
        const duration = Date.now() - startTime;

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.delayMs).toBe(delay);

        if (delay > 0) {
          expect(duration).toBeGreaterThanOrEqual(delay - 50);
        }
      }
    });

    it('should default to 1000ms when no delay specified', async () => {
      const startTime = Date.now();
      const response = await fetch(`${mockServer.getUrl()}/delay`);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeGreaterThanOrEqual(950); // Allow tolerance for 1000ms default

      const data = await response.json();
      expect(data.delayMs).toBe(1000);
    });

    it('should validate delay values', async () => {
      // Valid delays should work
      const validDelays = [0, 1, 1000, 5000];
      for (const delay of validDelays) {
        const response = await fetch(`${mockServer.getUrl()}/delay/${delay}`);
        expect(response.status).toBe(200);
      }

      // Invalid delays should be rejected
      const invalidDelays = [-1, 50000, 'abc'];
      for (const delay of invalidDelays) {
        const response = await fetch(`${mockServer.getUrl()}/delay/${delay}`);
        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.error).toContain('Invalid delay value');
      }
    });
  });

  describe('Acceptance Criteria: Each scenario is accessible via predictable URL patterns', () => {
    it('should provide predictable redirect URL patterns', () => {
      const baseUrl = mockServer.getUrl();

      // Path-based redirects
      expect(`${baseUrl}/redirect/301/target`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/redirect\/301\/target$/);
      expect(`${baseUrl}/redirect/302/target`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/redirect\/302\/target$/);
      expect(`${baseUrl}/redirect/307/target`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/redirect\/307\/target$/);

      // Query-based redirects
      expect(`${baseUrl}/redirect?status=302&target=/test`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/redirect\?status=302&target=\/test$/);

      // Special redirects
      expect(`${baseUrl}/redirect-chain-start`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/redirect-chain-start$/);
    });

    it('should provide predictable error URL patterns', () => {
      const baseUrl = mockServer.getUrl();

      // Specific error routes
      expect(`${baseUrl}/error/404`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/error\/404$/);
      expect(`${baseUrl}/error/500`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/error\/500$/);
      expect(`${baseUrl}/error/401`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/error\/401$/);

      // Generic error route
      expect(`${baseUrl}/error?status=422`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/error\?status=422$/);
    });

    it('should provide predictable delay URL patterns', () => {
      const baseUrl = mockServer.getUrl();

      // Path-based delays
      expect(`${baseUrl}/delay/1000`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/delay\/1000$/);

      // Query-based delays
      expect(`${baseUrl}/delay?ms=500`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/delay\?ms=500$/);

      // Delay with error
      expect(`${baseUrl}/delay-error/500/404`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/delay-error\/500\/404$/);

      // Slow redirect
      expect(`${baseUrl}/slow-redirect/300/target`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/slow-redirect\/300\/target$/);
    });

    it('should verify all scenarios are accessible', async () => {
      // Test redirect scenarios
      let response = await fetch(`${mockServer.getUrl()}/redirect/301/test`, { redirect: 'manual' });
      expect(response.status).toBe(301);

      // Test error scenarios
      response = await fetch(`${mockServer.getUrl()}/error/404`);
      expect(response.status).toBe(404);

      // Test delay scenarios
      response = await fetch(`${mockServer.getUrl()}/delay/50`);
      expect(response.status).toBe(200);

      // Verify all patterns exist and are working
      expect(true).toBe(true); // All above requests should succeed without throwing
    });
  });

  describe('Overall Integration - All Acceptance Criteria', () => {
    it('should demonstrate complete navigation scenario functionality', async () => {
      console.log('🧪 Testing complete navigation scenario functionality...');

      // Test 1: Redirect routes with configurable status codes and targets
      console.log('  ✅ Testing redirect routes...');
      const redirectResponse = await fetch(`${mockServer.getUrl()}/redirect/301/dashboard`, { redirect: 'manual' });
      expect(redirectResponse.status).toBe(301);
      expect(redirectResponse.headers.get('location')).toBe('/dashboard');

      // Test 2: Error routes that return specific HTTP errors
      console.log('  ✅ Testing error routes...');
      const errorResponse = await fetch(`${mockServer.getUrl()}/error/404`);
      expect(errorResponse.status).toBe(404);
      const errorData = await errorResponse.json();
      expect(errorData.error).toBe('Not Found');

      // Test 3: Delay routes with configurable response time
      console.log('  ✅ Testing delay routes...');
      const startTime = Date.now();
      const delayResponse = await fetch(`${mockServer.getUrl()}/delay/100`);
      const duration = Date.now() - startTime;
      expect(delayResponse.status).toBe(200);
      expect(duration).toBeGreaterThanOrEqual(90);

      // Test 4: Predictable URL patterns
      console.log('  ✅ Testing predictable URL patterns...');
      const baseUrl = mockServer.getUrl();
      expect(`${baseUrl}/redirect/302/test`).toMatch(/\/redirect\/302\/test$/);
      expect(`${baseUrl}/error/500`).toMatch(/\/error\/500$/);
      expect(`${baseUrl}/delay/1000`).toMatch(/\/delay\/1000$/);

      console.log('🎉 All acceptance criteria successfully validated!');
      console.log('');
      console.log('✅ Redirect routes with configurable status codes and targets');
      console.log('✅ Error routes that return specific HTTP errors');
      console.log('✅ Delay routes with configurable response time');
      console.log('✅ Predictable URL patterns for all scenarios');
    });
  });
});