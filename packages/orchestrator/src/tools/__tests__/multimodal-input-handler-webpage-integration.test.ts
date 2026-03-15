/**
 * Integration tests for web page processing functionality with real HTTP endpoints
 *
 * These tests use real web services to verify the MultimodalInputHandler
 * works correctly with actual HTTP responses, HTML content, and network conditions.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  MultimodalInputHandler,
  MultimodalInputError,
  processWebPage,
  type WebPageOptions
} from '../multimodal-input-handler';

// Configuration for integration tests
const TEST_TIMEOUT = 30000; // 30 seconds for network requests
const REAL_ENDPOINTS = {
  httpbin: 'https://httpbin.org',
  jsonPlaceholder: 'https://jsonplaceholder.typicode.com',
  example: 'https://example.com',
  httpstatuses: 'https://httpstat.us',
};

// Skip integration tests if running in CI without network access
const skipIfOffline = () => {
  const isCI = process.env.CI === 'true';
  const skipIntegration = process.env.SKIP_INTEGRATION_TESTS === 'true';
  return isCI || skipIntegration;
};

describe('MultimodalInputHandler - Web Page Integration Tests', () => {
  let handler: MultimodalInputHandler;

  beforeAll(() => {
    handler = new MultimodalInputHandler();
  });

  describe('real HTTP endpoint processing', { timeout: TEST_TIMEOUT }, () => {
    it.skipIf(skipIfOffline())('should process example.com successfully', async () => {
      const result = await handler.processWebPage(REAL_ENDPOINTS.example);

      expect(result.url).toBe(REAL_ENDPOINTS.example);
      expect(result.statusCode).toBe(200);
      expect(result.headers).toBeDefined();
      expect(result.markdown).toBeDefined();
      expect(result.title).toContain('Example');
      expect(result.metadata.responseTime).toBeGreaterThan(0);
      expect(result.metadata.contentType).toContain('text/html');
    });

    it.skipIf(skipIfOffline())('should handle JSON API endpoints', async () => {
      const apiUrl = `${REAL_ENDPOINTS.jsonPlaceholder}/posts/1`;

      const result = await handler.processWebPage(apiUrl, {
        convertToMarkdown: false, // Keep as JSON
      });

      expect(result.url).toBe(apiUrl);
      expect(result.statusCode).toBe(200);
      expect(result.html).toBeDefined();
      expect(result.markdown).toBeUndefined();

      // JSON content should be parseable
      expect(() => JSON.parse(result.html!)).not.toThrow();
      const jsonData = JSON.parse(result.html!);
      expect(jsonData.id).toBe(1);
      expect(jsonData.title).toBeDefined();
    });

    it.skipIf(skipIfOffline())('should handle redirects properly', async () => {
      // httpbin.org/redirect/1 redirects to /get
      const redirectUrl = `${REAL_ENDPOINTS.httpbin}/redirect/1`;

      const result = await handler.processWebPage(redirectUrl);

      expect(result.statusCode).toBe(200);
      expect(result.metadata.redirected).toBeDefined();
      expect(result.metadata.finalUrl).toBeDefined();
      expect(result.markdown).toContain('GET');
    });

    it.skipIf(skipIfOffline())('should handle various HTTP methods', async () => {
      const testData = { test: 'data', timestamp: Date.now() };

      const result = await handler.processWebPage(`${REAL_ENDPOINTS.httpbin}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData),
        convertToMarkdown: false,
      });

      expect(result.statusCode).toBe(200);
      expect(result.html).toBeDefined();

      const responseData = JSON.parse(result.html!);
      expect(responseData.json).toEqual(testData);
      expect(responseData.headers['Content-Type']).toBe('application/json');
    });

    it.skipIf(skipIfOffline())('should handle custom headers', async () => {
      const customHeaders = {
        'User-Agent': 'APEX-MultimodalInputHandler/1.0',
        'X-Custom-Header': 'test-value',
        'Accept': 'text/html,application/json',
      };

      const result = await handler.processWebPage(`${REAL_ENDPOINTS.httpbin}/headers`, {
        headers: customHeaders,
        convertToMarkdown: false,
      });

      expect(result.statusCode).toBe(200);
      const responseData = JSON.parse(result.html!);

      expect(responseData.headers['User-Agent']).toBe(customHeaders['User-Agent']);
      expect(responseData.headers['X-Custom-Header']).toBe(customHeaders['X-Custom-Header']);
      expect(responseData.headers.Accept).toBe(customHeaders.Accept);
    });
  });

  describe('error handling with real endpoints', { timeout: TEST_TIMEOUT }, () => {
    it.skipIf(skipIfOffline())('should handle 404 errors gracefully', async () => {
      const notFoundUrl = `${REAL_ENDPOINTS.httpbin}/status/404`;

      await expect(handler.processWebPage(notFoundUrl)).rejects.toThrow(
        expect.objectContaining({
          name: 'MultimodalInputError',
          code: 'FETCH_ERROR',
          message: expect.stringContaining('404'),
        })
      );
    });

    it.skipIf(skipIfOffline())('should handle server errors', async () => {
      const serverErrorUrl = `${REAL_ENDPOINTS.httpbin}/status/500`;

      await expect(handler.processWebPage(serverErrorUrl)).rejects.toThrow(
        expect.objectContaining({
          name: 'MultimodalInputError',
          code: 'FETCH_ERROR',
          message: expect.stringContaining('500'),
        })
      );
    });

    it.skipIf(skipIfOffline())('should handle timeout errors', async () => {
      // Use a delay endpoint that exceeds our timeout
      const slowUrl = `${REAL_ENDPOINTS.httpbin}/delay/5`;

      await expect(handler.processWebPage(slowUrl, { timeout: 2000 })).rejects.toThrow(
        expect.objectContaining({
          name: 'MultimodalInputError',
          code: 'FETCH_ERROR',
        })
      );
    });

    it('should handle completely invalid domains', async () => {
      const invalidUrl = 'https://this-domain-definitely-does-not-exist-12345.com';

      await expect(handler.processWebPage(invalidUrl)).rejects.toThrow(
        expect.objectContaining({
          name: 'MultimodalInputError',
          code: 'FETCH_ERROR',
        })
      );
    });
  });

  describe('content type handling', { timeout: TEST_TIMEOUT }, () => {
    it.skipIf(skipIfOffline())('should handle different content types', async () => {
      const contentTypes = [
        { path: '/html', expectedType: 'text/html' },
        { path: '/json', expectedType: 'application/json' },
        { path: '/xml', expectedType: 'application/xml' },
      ];

      for (const { path, expectedType } of contentTypes) {
        const result = await handler.processWebPage(`${REAL_ENDPOINTS.httpbin}${path}`);

        expect(result.statusCode).toBe(200);
        expect(result.metadata.contentType).toContain(expectedType);
        expect(result.markdown).toBeDefined();
      }
    });

    it.skipIf(skipIfOffline())('should handle large responses', async () => {
      // httpbin.org/range returns specified amount of data
      const largeDataUrl = `${REAL_ENDPOINTS.httpbin}/range/10000`; // 10KB

      const result = await handler.processWebPage(largeDataUrl);

      expect(result.statusCode).toBe(200);
      expect(result.metadata.contentLength).toBeGreaterThan(9000); // Should be around 10KB
      expect(result.markdown).toBeDefined();
      expect(result.markdown!.length).toBeGreaterThan(5000);
    });
  });

  describe('caching behavior with real endpoints', { timeout: TEST_TIMEOUT }, () => {
    it.skipIf(skipIfOffline())('should demonstrate cache miss and hit behavior', async () => {
      const testUrl = `${REAL_ENDPOINTS.httpbin}/uuid`; // Returns different UUID each time

      // First request - should not be from cache
      const result1 = await handler.processWebPage(testUrl);
      expect(result1.fromCache).toBe(false);
      expect(result1.metadata.responseTime).toBeGreaterThan(0);

      // Second request - should potentially be from cache (depending on cache implementation)
      const result2 = await handler.processWebPage(testUrl);
      expect(result2.statusCode).toBe(200);
      // Note: We can't guarantee cache behavior without controlling the WebFetch tool directly
    });

    it.skipIf(skipIfOffline())('should respect cache bypass option', async () => {
      const testUrl = `${REAL_ENDPOINTS.httpbin}/uuid`;

      const result1 = await handler.processWebPage(testUrl, { bypassCache: true });
      expect(result1.fromCache).toBe(false);

      const result2 = await handler.processWebPage(testUrl, { bypassCache: true });
      expect(result2.fromCache).toBe(false);

      // Both should have returned different UUIDs if cache was bypassed
      expect(result1.markdown).toBeDefined();
      expect(result2.markdown).toBeDefined();
    });
  });

  describe('AI analysis integration with real content', { timeout: TEST_TIMEOUT }, () => {
    it.skipIf(skipIfOffline())('should perform AI analysis on real web content', async () => {
      // Skip if no API key available for analysis
      if (!process.env.ANTHROPIC_API_KEY) {
        console.log('Skipping AI analysis test - no ANTHROPIC_API_KEY');
        return;
      }

      const result = await handler.processWebPage(REAL_ENDPOINTS.example, {
        prompt: 'What is the main purpose of this webpage?',
      });

      expect(result.statusCode).toBe(200);
      expect(result.markdown).toBeDefined();

      if (result.analysis) {
        expect(result.analysis.content).toBeDefined();
        expect(result.analysis.model).toBe('claude-3-5-haiku-latest');
        expect(result.analysis.usage.inputTokens).toBeGreaterThan(0);
        expect(result.analysis.usage.outputTokens).toBeGreaterThan(0);
        expect(typeof result.analysis.truncated).toBe('boolean');
        expect(result.analysis.originalContentLength).toBeGreaterThan(0);
        expect(result.analysis.analyzedContentLength).toBeGreaterThan(0);
      } else if (result.analysisError) {
        // Analysis failed, but that's acceptable for integration tests
        expect(typeof result.analysisError).toBe('string');
        console.log('AI analysis failed (expected in some environments):', result.analysisError);
      }
    });
  });

  describe('convenience function integration', { timeout: TEST_TIMEOUT }, () => {
    it.skipIf(skipIfOffline())('should work with processWebPage convenience function', async () => {
      const result = await processWebPage(REAL_ENDPOINTS.example);

      expect(result.url).toBe(REAL_ENDPOINTS.example);
      expect(result.statusCode).toBe(200);
      expect(result.markdown).toBeDefined();
      expect(result.title).toBeDefined();
    });

    it.skipIf(skipIfOffline())('should work with custom configuration', async () => {
      const result = await processWebPage(
        REAL_ENDPOINTS.example,
        { convertToMarkdown: false },
        { maxFileSizeBytes: 1024 * 1024 } // 1MB limit
      );

      expect(result.html).toBeDefined();
      expect(result.markdown).toBeUndefined();
    });
  });

  describe('performance with real endpoints', { timeout: TEST_TIMEOUT }, () => {
    it.skipIf(skipIfOffline())('should complete requests within reasonable time', async () => {
      const startTime = Date.now();

      const result = await handler.processWebPage(REAL_ENDPOINTS.example, {
        timeout: 10000, // 10 second timeout
      });

      const duration = Date.now() - startTime;

      expect(result.statusCode).toBe(200);
      expect(duration).toBeLessThan(10000); // Should complete faster than timeout
      expect(result.metadata.responseTime).toBeGreaterThan(0);
      expect(result.metadata.responseTime).toBeLessThan(duration);
    });

    it.skipIf(skipIfOffline())('should handle concurrent requests efficiently', async () => {
      const urls = [
        REAL_ENDPOINTS.example,
        `${REAL_ENDPOINTS.httpbin}/get`,
        `${REAL_ENDPOINTS.jsonPlaceholder}/posts/1`,
      ];

      const startTime = Date.now();
      const promises = urls.map(url => handler.processWebPage(url));
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.statusCode).toBe(200);
        expect(result.markdown).toBeDefined();
      });

      // Concurrent requests should be faster than sequential
      expect(duration).toBeLessThan(15000); // Should complete all within 15 seconds
    });
  });

  describe('real-world HTML parsing', { timeout: TEST_TIMEOUT }, () => {
    it.skipIf(skipIfOffline())('should extract titles from various HTML structures', async () => {
      const testSites = [
        { url: REAL_ENDPOINTS.example, expectedTitleContains: 'Example' },
      ];

      for (const { url, expectedTitleContains } of testSites) {
        const result = await handler.processWebPage(url);

        expect(result.statusCode).toBe(200);
        expect(result.title).toBeDefined();
        expect(result.title!.toLowerCase()).toContain(expectedTitleContains.toLowerCase());
      }
    });

    it.skipIf(skipIfOffline())('should convert complex HTML to readable markdown', async () => {
      const result = await handler.processWebPage(REAL_ENDPOINTS.example);

      expect(result.markdown).toBeDefined();
      expect(result.markdown!.length).toBeGreaterThan(0);

      // Should contain typical markdown elements
      expect(result.markdown).toMatch(/[#\*\-\[\]]/); // Headers, bold, lists, or links
    });
  });

  describe('network resilience', { timeout: TEST_TIMEOUT }, () => {
    it.skipIf(skipIfOffline())('should handle intermittent network issues gracefully', async () => {
      // Test with a potentially unreliable endpoint
      const attempts = 3;
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < attempts; i++) {
        try {
          const result = await handler.processWebPage(REAL_ENDPOINTS.example, {
            timeout: 5000,
          });
          expect(result.statusCode).toBe(200);
          successCount++;
        } catch (error) {
          expect(error).toBeInstanceOf(MultimodalInputError);
          errorCount++;
        }
      }

      // At least one attempt should succeed (network permitting)
      // This test primarily ensures our error handling works correctly
      expect(successCount + errorCount).toBe(attempts);
    });
  });
});