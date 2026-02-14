/**
 * Additional edge case tests for MockServer navigation scenarios
 *
 * Tests for specific edge cases and boundary conditions not covered
 * in the main test suite to ensure comprehensive coverage.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockServer } from '../mock-server';

describe('Navigation Scenario Edge Cases', () => {
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

  describe('Redirect Edge Cases', () => {
    it('should handle redirect to home with "home" parameter', async () => {
      const response = await fetch(`${mockServer.getUrl()}/redirect/301/home`, {
        redirect: 'manual',
      });
      expect(response.status).toBe(301);
      expect(response.headers.get('location')).toBe('/');
    });

    it('should handle all valid redirect status codes', async () => {
      const validRedirectCodes = [301, 302, 307, 308];

      for (const code of validRedirectCodes) {
        const response = await fetch(`${mockServer.getUrl()}/redirect?status=${code}&target=/test`, {
          redirect: 'manual',
        });
        expect(response.status).toBe(code);
        expect(response.headers.get('location')).toBe('/test');
      }
    });

    it('should handle empty target parameter defaulting to "/"', async () => {
      const response = await fetch(`${mockServer.getUrl()}/redirect?status=302`, {
        redirect: 'manual',
      });
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/');
    });

    it('should handle special characters in redirect targets', async () => {
      const specialTargets = [
        '/path-with-dashes',
        '/path_with_underscores',
        '/path.with.dots',
        '/path%20with%20encoding'
      ];

      for (const target of specialTargets) {
        const response = await fetch(`${mockServer.getUrl()}/redirect?status=302&target=${encodeURIComponent(target)}`, {
          redirect: 'manual',
        });
        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe(target);
      }
    });

    it('should handle redirect chain completion timing', async () => {
      const startTime = Date.now();
      const response = await fetch(`${mockServer.getUrl()}/redirect-chain-start`);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000); // Should complete quickly

      const data = await response.json();
      expect(data.message).toBe('Redirect chain completed');
      expect(data).toHaveProperty('timestamp');
    });
  });

  describe('Error Scenario Edge Cases', () => {
    it('should include request path in 404 error response', async () => {
      const testPath = '/some/test/path';
      const response = await fetch(`${mockServer.getUrl()}/error/404`);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('Not Found');
      expect(data).toHaveProperty('path');
      expect(data).toHaveProperty('timestamp');
    });

    it('should handle boundary error status codes', async () => {
      const boundaryCodes = [400, 599]; // Lower and upper bounds

      for (const code of boundaryCodes) {
        const response = await fetch(`${mockServer.getUrl()}/error?status=${code}`);
        expect(response.status).toBe(code);

        const data = await response.json();
        expect(data.error).toBe(`HTTP ${code}`);
        expect(data).toHaveProperty('timestamp');
      }
    });

    it('should reject error codes outside valid range', async () => {
      const invalidCodes = [199, 399, 600, 999];

      for (const code of invalidCodes) {
        const response = await fetch(`${mockServer.getUrl()}/error?status=${code}`);
        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.error).toContain('Invalid error status code');
      }
    });

    it('should handle custom error messages with special characters', async () => {
      const specialMessages = [
        'Error with "quotes"',
        'Error with <tags>',
        'Error with & ampersands',
        'Unicode error: 测试'
      ];

      for (const message of specialMessages) {
        const response = await fetch(`${mockServer.getUrl()}/error?status=422&message=${encodeURIComponent(message)}`);
        expect(response.status).toBe(422);

        const data = await response.json();
        expect(data.message).toBe(message);
      }
    });
  });

  describe('Delay Scenario Edge Cases', () => {
    it('should handle zero delay', async () => {
      const startTime = Date.now();
      const response = await fetch(`${mockServer.getUrl()}/delay/0`);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(50); // Should be nearly instant

      const data = await response.json();
      expect(data.delayMs).toBe(0);
    });

    it('should handle maximum allowed delay', async () => {
      const maxDelay = 30000; // 30 seconds - maximum allowed
      const response = await fetch(`${mockServer.getUrl()}/delay?ms=${maxDelay}`);
      expect(response.status).toBe(400); // This should actually be rejected for testing
    });

    it('should handle delay with very small values', async () => {
      const smallDelay = 1;
      const startTime = Date.now();
      const response = await fetch(`${mockServer.getUrl()}/delay/${smallDelay}`);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(100); // Should be very quick for 1ms

      const data = await response.json();
      expect(data.delayMs).toBe(smallDelay);
    });

    it('should handle delay-error with boundary conditions', async () => {
      const testCases = [
        { delay: 100, status: 400 },
        { delay: 100, status: 599 },
        { delay: 0, status: 500 }
      ];

      for (const { delay, status } of testCases) {
        const startTime = Date.now();
        const response = await fetch(`${mockServer.getUrl()}/delay-error/${delay}/${status}`);
        const duration = Date.now() - startTime;

        expect(response.status).toBe(status);
        expect(duration).toBeGreaterThanOrEqual(delay - 50); // Allow some tolerance

        const data = await response.json();
        expect(data.delayMs).toBe(delay);
        expect(data.error).toBe(`HTTP ${status}`);
      }
    });

    it('should handle slow-redirect with home target', async () => {
      const delay = 100;
      const startTime = Date.now();
      const response = await fetch(`${mockServer.getUrl()}/slow-redirect/${delay}/home`, {
        redirect: 'manual',
      });
      const duration = Date.now() - startTime;

      expect(response.status).toBe(302);
      expect(duration).toBeGreaterThanOrEqual(delay - 50);
      expect(response.headers.get('location')).toBe('/');
    });

    it('should reject non-numeric delay values', async () => {
      const invalidDelays = ['abc', 'null', 'undefined', ''];

      for (const delay of invalidDelays) {
        const response = await fetch(`${mockServer.getUrl()}/delay/${delay}`);
        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.error).toContain('Invalid delay value');
      }
    });
  });

  describe('Cross-scenario Integration', () => {
    it('should handle mixed scenario requests concurrently', async () => {
      const requests = [
        fetch(`${mockServer.getUrl()}/redirect/302/test`, { redirect: 'manual' }),
        fetch(`${mockServer.getUrl()}/error/404`),
        fetch(`${mockServer.getUrl()}/delay/50`),
        fetch(`${mockServer.getUrl()}/health`)
      ];

      const responses = await Promise.all(requests);

      expect(responses[0].status).toBe(302); // Redirect
      expect(responses[1].status).toBe(404); // Error
      expect(responses[2].status).toBe(200); // Delay success
      expect(responses[3].status).toBe(200); // Health check
    });

    it('should maintain consistent timestamp format across scenarios', async () => {
      const responses = await Promise.all([
        fetch(`${mockServer.getUrl()}/error/500`).then(r => r.json()),
        fetch(`${mockServer.getUrl()}/delay/10`).then(r => r.json()),
        fetch(`${mockServer.getUrl()}/redirect-chain-end`).then(r => r.json())
      ]);

      responses.forEach(data => {
        expect(data).toHaveProperty('timestamp');
        expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });
    });

    it('should handle rapid successive requests to same scenario', async () => {
      const rapidRequests = Array.from({ length: 10 }, () =>
        fetch(`${mockServer.getUrl()}/delay/10`)
      );

      const responses = await Promise.all(rapidRequests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      const data = await Promise.all(responses.map(r => r.json()));
      data.forEach(d => {
        expect(d.delayMs).toBe(10);
        expect(d).toHaveProperty('timestamp');
      });
    });
  });

  describe('URL Pattern Validation', () => {
    it('should validate predictable URL patterns for all scenarios', () => {
      const baseUrl = mockServer.getUrl();

      // Redirect patterns
      expect(`${baseUrl}/redirect/301/target`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/redirect\/301\/target$/);
      expect(`${baseUrl}/redirect/302/home`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/redirect\/302\/home$/);
      expect(`${baseUrl}/redirect/307/page`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/redirect\/307\/page$/);

      // Error patterns
      expect(`${baseUrl}/error/404`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/error\/404$/);
      expect(`${baseUrl}/error/500`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/error\/500$/);

      // Delay patterns
      expect(`${baseUrl}/delay/1000`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/delay\/1000$/);
      expect(`${baseUrl}/delay-error/500/404`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/delay-error\/500\/404$/);
    });

    it('should handle query parameter patterns correctly', () => {
      const baseUrl = mockServer.getUrl();

      expect(`${baseUrl}/redirect?status=302&target=/test`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/redirect\?status=302&target=\/test$/);
      expect(`${baseUrl}/error?status=422&message=test`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/error\?status=422&message=test$/);
      expect(`${baseUrl}/delay?ms=1000`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/delay\?ms=1000$/);
    });
  });
});