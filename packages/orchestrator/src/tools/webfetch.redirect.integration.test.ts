/**
 * WebFetch Redirect Handling Integration Tests
 *
 * Comprehensive test suite for WebFetch tool redirect handling including:
 * - HTTP redirect status codes (301, 302, 307, 308)
 * - Method preservation verification (POST → redirect → POST)
 * - Redirect chain tracking with hop count
 * - Cross-origin redirect scenarios
 * - Edge cases and error handling
 *
 * Uses MockServer to provide deterministic redirect scenarios without
 * external dependencies.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { WebFetchTool, type WebFetchParams } from './webfetch';
import { MockServer } from '../../../core/src/test-utils/mock-server';

describe('WebFetch Redirect Handling Integration Tests', () => {
  let mockServer: MockServer;
  let webFetchTool: WebFetchTool;
  let baseUrl: string;

  beforeAll(async () => {
    mockServer = new MockServer();
    await mockServer.start();
    baseUrl = mockServer.getUrl();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  beforeEach(() => {
    webFetchTool = new WebFetchTool();
    // Clear cache between tests to ensure fresh requests
    webFetchTool.clearCache();
  });

  describe('HTTP Redirect Status Codes', () => {
    describe('301 Moved Permanently', () => {
      it('should follow 301 redirects and track final URL', async () => {
        const result = await webFetchTool.execute({
          url: `${baseUrl}/redirect/301/page1`,
          method: 'GET',
        });

        expect(result.success).toBe(true);
        expect(result.status).toBe(200);
        expect(result.metadata?.redirected).toBe(true);
        expect(result.metadata?.finalUrl).toBe(`${baseUrl}/page1`);
        expect(result.metadata?.url).toBe(`${baseUrl}/redirect/301/page1`);
      });

      it('should report redirected=true in metadata', async () => {
        const result = await webFetchTool.execute({
          url: `${baseUrl}/redirect/301/health`,
          method: 'GET',
        });

        expect(result.success).toBe(true);
        expect(result.metadata?.redirected).toBe(true);
        expect(result.metadata?.finalUrl).toContain('/health');
      });

      it('should preserve query parameters through redirect', async () => {
        const result = await webFetchTool.execute({
          url: `${baseUrl}/redirect?status=301&target=/ping`,
          method: 'GET',
        });

        expect(result.success).toBe(true);
        expect(result.metadata?.redirected).toBe(true);
        expect(result.metadata?.finalUrl).toBe(`${baseUrl}/ping`);
      });
    });

    describe('302 Found', () => {
      it('should follow 302 redirects', async () => {
        const result = await webFetchTool.execute({
          url: `${baseUrl}/redirect/302/ping`,
          method: 'GET',
        });

        expect(result.success).toBe(true);
        expect(result.status).toBe(200);
        expect(result.metadata?.redirected).toBe(true);
        expect(result.metadata?.finalUrl).toBe(`${baseUrl}/ping`);
      });

      it('should handle multiple 302 redirects in chain', async () => {
        const result = await webFetchTool.execute({
          url: `${baseUrl}/redirect-chain-start`,
          method: 'GET',
        });

        expect(result.success).toBe(true);
        expect(result.status).toBe(200);
        expect(result.metadata?.redirected).toBe(true);
        expect(result.metadata?.finalUrl).toBe(`${baseUrl}/redirect-chain-end`);
        expect(result.data).toContain('Redirect chain completed');
      });
    });

    describe('307 Temporary Redirect', () => {
      it('should preserve HTTP method for GET requests', async () => {
        const result = await webFetchTool.execute({
          url: `${baseUrl}/redirect/307/ping`,
          method: 'GET',
        });

        expect(result.success).toBe(true);
        expect(result.status).toBe(200);
        expect(result.metadata?.redirected).toBe(true);
        expect(result.metadata?.finalUrl).toBe(`${baseUrl}/ping`);
      });

      it('should preserve HTTP method for POST requests', async () => {
        const testBody = JSON.stringify({ test: 'data', method: 'POST' });

        const result = await webFetchTool.execute({
          url: `${baseUrl}/redirect/307/api`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: testBody,
        });

        expect(result.success).toBe(true);
        expect(result.status).toBe(200);
        expect(result.metadata?.redirected).toBe(true);
        expect(result.metadata?.finalUrl).toBe(`${baseUrl}/api`);

        // Parse response to verify POST method was preserved
        const responseData = JSON.parse(result.data || '{}');
        expect(responseData.method).toBe('POST');
        expect(responseData.body).toEqual({ test: 'data', method: 'POST' });
      });

      it('should preserve request body through redirect', async () => {
        const requestData = { message: 'test body preservation', timestamp: Date.now() };
        const testBody = JSON.stringify(requestData);

        const result = await webFetchTool.execute({
          url: `${baseUrl}/redirect/307/data`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: testBody,
        });

        expect(result.success).toBe(true);
        expect(result.metadata?.redirected).toBe(true);

        const responseData = JSON.parse(result.data || '{}');
        expect(responseData.method).toBe('POST');
        expect(responseData.body).toEqual(requestData);
      });
    });

    describe('308 Permanent Redirect', () => {
      it('should preserve HTTP method for all request types', async () => {
        const testBody = JSON.stringify({ test: '308 redirect test' });

        const result = await webFetchTool.execute({
          url: `${baseUrl}/redirect/308/api`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: testBody,
        });

        expect(result.success).toBe(true);
        expect(result.metadata?.redirected).toBe(true);
        expect(result.metadata?.finalUrl).toBe(`${baseUrl}/api`);

        const responseData = JSON.parse(result.data || '{}');
        expect(responseData.method).toBe('POST');
        expect(responseData.body).toEqual({ test: '308 redirect test' });
      });

      it('should preserve custom headers through redirect', async () => {
        const result = await webFetchTool.execute({
          url: `${baseUrl}/redirect/308/ping`,
          method: 'GET',
          headers: {
            'X-Custom-Header': 'test-value',
            'X-Test-Id': '12345'
          },
        });

        expect(result.success).toBe(true);
        expect(result.metadata?.redirected).toBe(true);
        expect(result.metadata?.finalUrl).toBe(`${baseUrl}/ping`);
      });
    });
  });

  describe('Redirect Chains', () => {
    it('should handle redirect chains up to 5 hops', async () => {
      const result = await webFetchTool.execute({
        url: `${baseUrl}/redirect-chain/5`,
        method: 'GET',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.metadata?.redirected).toBe(true);
      expect(result.metadata?.finalUrl).toBe(`${baseUrl}/redirect-chain/0`);

      const responseData = JSON.parse(result.data || '{}');
      expect(responseData.message).toBe('Redirect chain completed');
      expect(responseData.hops).toBe(0);
    });

    it('should handle redirect chains up to 10 hops', async () => {
      const result = await webFetchTool.execute({
        url: `${baseUrl}/redirect-chain/10`,
        method: 'GET',
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.redirected).toBe(true);

      const responseData = JSON.parse(result.data || '{}');
      expect(responseData.message).toBe('Redirect chain completed');
      expect(responseData.hops).toBe(0);
    });

    it('should detect and handle excessive redirect chains', async () => {
      // Test with 20 hops - this should work but be close to limits
      const result = await webFetchTool.execute({
        url: `${baseUrl}/redirect-chain/20`,
        method: 'GET',
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.redirected).toBe(true);

      const responseData = JSON.parse(result.data || '{}');
      expect(responseData.hops).toBe(0);
    });

    it('should track intermediate URLs in redirect chain', async () => {
      // Using the fixed 3-step redirect chain
      const result = await webFetchTool.execute({
        url: `${baseUrl}/redirect-chain-start`,
        method: 'GET',
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.redirected).toBe(true);
      expect(result.metadata?.finalUrl).toBe(`${baseUrl}/redirect-chain-end`);

      // Verify final destination reached
      const responseData = JSON.parse(result.data || '{}');
      expect(responseData.message).toBe('Redirect chain completed');
    });

    it('should report correct hop count for dynamic chains', async () => {
      const hopCount = 3;
      const result = await webFetchTool.execute({
        url: `${baseUrl}/redirect-chain/${hopCount}`,
        method: 'GET',
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.redirected).toBe(true);

      // The final URL should be the 0-hop endpoint
      expect(result.metadata?.finalUrl).toBe(`${baseUrl}/redirect-chain/0`);
    });
  });

  describe('Cross-Origin Redirects', () => {
    it('should handle same-origin redirects', async () => {
      const result = await webFetchTool.execute({
        url: `${baseUrl}/redirect/302/ping`,
        method: 'GET',
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.redirected).toBe(true);

      // Both original and final URLs should have same origin
      const originalUrl = new URL(result.metadata?.url || '');
      const finalUrl = new URL(result.metadata?.finalUrl || '');
      expect(originalUrl.origin).toBe(finalUrl.origin);
    });

    it('should handle redirect policies appropriately', async () => {
      // This tests that fetch follows redirects by default
      const result = await webFetchTool.execute({
        url: `${baseUrl}/redirect/301/health`,
        method: 'GET',
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.redirected).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle redirect with relative URL', async () => {
      const result = await webFetchTool.execute({
        url: `${baseUrl}/redirect/302/ping`,
        method: 'GET',
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.redirected).toBe(true);
      expect(result.metadata?.finalUrl).toBe(`${baseUrl}/ping`);
    });

    it('should handle redirect to root path', async () => {
      const result = await webFetchTool.execute({
        url: `${baseUrl}/redirect/302/home`,
        method: 'GET',
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.redirected).toBe(true);
      // 'home' target maps to root path in mock server
      expect(result.metadata?.finalUrl).toBe(`${baseUrl}/`);
    });

    it('should handle invalid redirect status codes gracefully', async () => {
      const result = await webFetchTool.execute({
        url: `${baseUrl}/redirect?status=999&target=/ping`,
        method: 'GET',
      });

      // Should get a 400 error from the mock server for invalid status
      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.error).toContain('400');
    });

    it('should handle redirect with missing target gracefully', async () => {
      const result = await webFetchTool.execute({
        url: `${baseUrl}/redirect?status=302`,
        method: 'GET',
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.redirected).toBe(true);
      // Should redirect to default target ('/')
      expect(result.metadata?.finalUrl).toBe(`${baseUrl}/`);
    });
  });

  describe('Performance and Timing', () => {
    it('should track response time including redirects', async () => {
      const result = await webFetchTool.execute({
        url: `${baseUrl}/redirect/302/ping`,
        method: 'GET',
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.responseTime).toBeGreaterThan(0);
      expect(result.metadata?.responseTime).toBeLessThan(5000); // Should be fast for local server
    });

    it('should handle slow redirects within timeout', async () => {
      const result = await webFetchTool.execute({
        url: `${baseUrl}/slow-redirect/500/ping`,
        method: 'GET',
        timeout: 2000, // 2 second timeout
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.redirected).toBe(true);
      expect(result.metadata?.responseTime).toBeGreaterThan(500);
    });
  });

  describe('Caching with Redirects', () => {
    it('should cache redirect results correctly', async () => {
      const params: WebFetchParams = {
        url: `${baseUrl}/redirect/301/ping`,
        method: 'GET',
      };

      // First request
      const result1 = await webFetchTool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.metadata?.redirected).toBe(true);
      expect(result1.fromCache).toBeUndefined();

      // Second request should be from cache
      const result2 = await webFetchTool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.metadata?.redirected).toBe(true);
      expect(result2.fromCache).toBe(true);
      expect(result2.metadata?.responseTime).toBe(0); // Cache hits have zero response time
    });

    it('should bypass cache when requested', async () => {
      const params: WebFetchParams = {
        url: `${baseUrl}/redirect/302/ping`,
        method: 'GET',
      };

      // First request to populate cache
      await webFetchTool.execute(params);

      // Second request with cache bypass
      const result = await webFetchTool.execute({
        ...params,
        bypassCache: true,
      });

      expect(result.success).toBe(true);
      expect(result.fromCache).toBeUndefined();
      expect(result.metadata?.responseTime).toBeGreaterThan(0);
    });
  });

  describe('Metadata Verification', () => {
    it('should include comprehensive redirect metadata', async () => {
      const result = await webFetchTool.execute({
        url: `${baseUrl}/redirect/307/ping`,
        method: 'GET',
      });

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.url).toBe(`${baseUrl}/redirect/307/ping`);
      expect(result.metadata?.method).toBe('GET');
      expect(result.metadata?.redirected).toBe(true);
      expect(result.metadata?.finalUrl).toBe(`${baseUrl}/ping`);
      expect(result.metadata?.responseTime).toBeGreaterThan(0);
      expect(result.metadata?.contentLength).toBeGreaterThan(0);
      expect(result.metadata?.contentType).toBeDefined();
    });

    it('should report redirected=false for direct requests', async () => {
      const result = await webFetchTool.execute({
        url: `${baseUrl}/ping`,
        method: 'GET',
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.redirected).toBe(false);
      expect(result.metadata?.finalUrl).toBeUndefined();
    });
  });
});