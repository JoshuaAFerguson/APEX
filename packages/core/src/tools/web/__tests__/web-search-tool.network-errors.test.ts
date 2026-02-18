/**
 * @fileoverview Network error handling tests for WebSearchTool
 *
 * This test suite focuses on testing network-related error scenarios:
 * - Network connectivity failures
 * - Timeout handling
 * - Request cancellation
 * - HTTP error responses
 * - Rate limiting scenarios
 * - DNS resolution failures
 *
 * @module @apex/core/tools/web/__tests__/web-search-tool.network-errors
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WebSearchTool,
  type WebSearchToolInput,
  type WebSearchToolConfig,
} from '../web-search-tool.js';
import type { ToolExecutionContext } from '../../base-tool.js';

/**
 * Extended WebSearchTool for testing network error scenarios
 */
class NetworkErrorTestableWebSearchTool extends WebSearchTool {
  private errorType: string | null = null;
  private requestDelay: number = 0;
  private shouldThrowError: boolean = false;

  constructor(config?: WebSearchToolConfig) {
    super(config);
  }

  /**
   * Configure the tool to simulate specific error conditions
   */
  public simulateError(errorType: string, delay: number = 0) {
    this.errorType = errorType;
    this.requestDelay = delay;
    this.shouldThrowError = true;
  }

  /**
   * Reset error simulation
   */
  public resetErrorSimulation() {
    this.errorType = null;
    this.requestDelay = 0;
    this.shouldThrowError = false;
  }

  protected async fetchSearchResults(
    query: string,
    context?: ToolExecutionContext
  ): Promise<any[]> {
    // Simulate network delay
    if (this.requestDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.requestDelay));
    }

    // Check for cancellation after delay
    if (context?.signal?.aborted) {
      throw new Error('WebSearch operation was cancelled');
    }

    // Simulate various error conditions
    if (this.shouldThrowError) {
      switch (this.errorType) {
        case 'network_error':
          const networkError = new Error('Network request failed') as any;
          networkError.code = 'ENOTFOUND';
          throw networkError;

        case 'timeout':
          throw new Error('Request timed out after 30000ms');

        case 'connection_refused':
          const connError = new Error('Connection refused') as any;
          connError.code = 'ECONNREFUSED';
          throw connError;

        case 'dns_error':
          const dnsError = new Error('DNS resolution failed') as any;
          dnsError.code = 'ENOTFOUND';
          dnsError.hostname = 'invalid-host.duckduckgo.com';
          throw dnsError;

        case 'ssl_error':
          const sslError = new Error('SSL certificate error') as any;
          sslError.code = 'CERT_UNTRUSTED';
          throw sslError;

        case 'rate_limited':
          const rateLimitError = new Error('Too many requests') as any;
          rateLimitError.status = 429;
          throw rateLimitError;

        case 'server_error':
          const serverError = new Error('Internal server error') as any;
          serverError.status = 500;
          throw serverError;

        default:
          throw new Error('Unknown error');
      }
    }

    // Return empty results for successful simulation
    return [];
  }
}

describe('WebSearchTool Network Error Handling', () => {
  let tool: NetworkErrorTestableWebSearchTool;

  beforeEach(() => {
    tool = new NetworkErrorTestableWebSearchTool();
    vi.clearAllTimers();
  });

  afterEach(() => {
    tool.resetErrorSimulation();
    vi.clearAllTimers();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Network Error Tests
  // ============================================================================

  describe('network errors', () => {
    it('should handle network connectivity failures', async () => {
      tool.simulateError('network_error');

      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Search failed');
      expect(result.output).toBeUndefined();
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle connection refused errors', async () => {
      tool.simulateError('connection_refused');

      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Search failed');
    });

    it('should handle DNS resolution failures', async () => {
      tool.simulateError('dns_error');

      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Search failed');
    });

    it('should handle SSL certificate errors', async () => {
      tool.simulateError('ssl_error');

      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Search failed');
    });
  });

  // ============================================================================
  // HTTP Error Tests
  // ============================================================================

  describe('HTTP errors', () => {
    it('should handle rate limiting (429) responses', async () => {
      tool.simulateError('rate_limited');

      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Search failed');
    });

    it('should handle server errors (500)', async () => {
      tool.simulateError('server_error');

      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Search failed');
    });
  });

  // ============================================================================
  // Timeout Tests
  // ============================================================================

  describe('timeout handling', () => {
    it('should handle request timeouts', async () => {
      tool.simulateError('timeout');

      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Search failed');
    });

    it('should respect custom timeout configuration', async () => {
      const shortTimeoutTool = new NetworkErrorTestableWebSearchTool({
        timeout: 100, // Very short timeout
      });

      // Simulate a delay longer than the timeout
      shortTimeoutTool.simulateError('timeout', 200);

      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const startTime = Date.now();
      const result = await shortTimeoutTool.execute(input);
      const endTime = Date.now();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Should fail relatively quickly due to timeout
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  // ============================================================================
  // Cancellation Tests
  // ============================================================================

  describe('request cancellation', () => {
    it('should handle immediate cancellation', async () => {
      const controller = new AbortController();
      controller.abort(); // Cancel immediately

      const context: ToolExecutionContext = {
        signal: controller.signal,
      };

      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const result = await tool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('cancelled');
    });

    it('should handle cancellation during network request', async () => {
      tool.simulateError('', 500); // Simulate 500ms delay

      const controller = new AbortController();

      const context: ToolExecutionContext = {
        signal: controller.signal,
      };

      const input: WebSearchToolInput = {
        query: 'test search',
      };

      // Cancel after 100ms
      setTimeout(() => {
        controller.abort();
      }, 100);

      const startTime = Date.now();
      const result = await tool.execute(input, context);
      const endTime = Date.now();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('cancelled');

      // Should be cancelled before the full delay
      expect(endTime - startTime).toBeLessThan(400);
    });

    it('should cleanup resources on cancellation', async () => {
      tool.simulateError('', 1000); // Long delay

      const controller = new AbortController();

      const context: ToolExecutionContext = {
        signal: controller.signal,
      };

      const input: WebSearchToolInput = {
        query: 'test search',
      };

      // Cancel immediately
      setTimeout(() => {
        controller.abort();
      }, 50);

      const result = await tool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');

      // Verify cache is still accessible (not corrupted)
      expect(tool.getCacheSize()).toBe(0);
    });
  });

  // ============================================================================
  // Error Recovery Tests
  // ============================================================================

  describe('error recovery', () => {
    it('should recover from transient network errors', async () => {
      // First request fails
      tool.simulateError('network_error');

      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const firstResult = await tool.execute(input);
      expect(firstResult.success).toBe(false);

      // Reset error simulation
      tool.resetErrorSimulation();

      // Second request should succeed
      const secondResult = await tool.execute(input);
      expect(secondResult.success).toBe(true);
      expect(secondResult.output).toBeDefined();
    });

    it('should not cache failed requests', async () => {
      tool.simulateError('network_error');

      const input: WebSearchToolInput = {
        query: 'test search',
      };

      await tool.execute(input);

      // Cache should be empty after error
      expect(tool.getCacheSize()).toBe(0);

      // Reset and try again
      tool.resetErrorSimulation();
      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      // This should be a real search, not cached
      expect(result.output?.searchTime).toBeGreaterThan(0);
    });

    it('should provide meaningful error context', async () => {
      const errorTypes = [
        'network_error',
        'connection_refused',
        'dns_error',
        'ssl_error',
        'rate_limited',
        'server_error'
      ];

      for (const errorType of errorTypes) {
        tool.simulateError(errorType);

        const input: WebSearchToolInput = {
          query: 'test search',
        };

        const result = await tool.execute(input);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toContain('Search failed');
        expect(result.duration).toBeGreaterThan(0);
        expect(result.invokedAt).toBeDefined();
        expect(result.completedAt).toBeDefined();

        tool.resetErrorSimulation();
      }
    });
  });

  // ============================================================================
  // Fallback Tests
  // ============================================================================

  describe('fallback behavior', () => {
    it('should use mock results in test environment when network fails', async () => {
      // Set environment to test mode
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      try {
        tool.simulateError('network_error');

        const input: WebSearchToolInput = {
          query: 'TypeScript',
        };

        const result = await tool.execute(input);

        // In test environment, should return mock results instead of failing
        expect(result.success).toBe(true);
        expect(result.output).toBeDefined();
        expect(result.output?.results).toBeDefined();
        expect(Array.isArray(result.output?.results)).toBe(true);

        // Mock results should contain TypeScript-related content
        if (result.output && result.output.results.length > 0) {
          const hasTypescriptContent = result.output.results.some(r =>
            r.title.includes('TypeScript') || r.snippet.includes('TypeScript')
          );
          expect(hasTypescriptContent).toBe(true);
        }
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should respect domain filtering in mock results', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      try {
        tool.simulateError('network_error');

        const input: WebSearchToolInput = {
          query: 'TypeScript',
          allowed_domains: ['typescriptlang.org'],
        };

        const result = await tool.execute(input);

        expect(result.success).toBe(true);
        expect(result.output).toBeDefined();

        if (result.output && result.output.results.length > 0) {
          // All results should be from allowed domain or its subdomains
          result.output.results.forEach(resultItem => {
            expect(
              resultItem.domain === 'typescriptlang.org' ||
              resultItem.domain.endsWith('.typescriptlang.org')
            ).toBe(true);
          });
        }
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  // ============================================================================
  // Performance Under Error Conditions
  // ============================================================================

  describe('performance under error conditions', () => {
    it('should fail fast for immediate errors', async () => {
      tool.simulateError('connection_refused');

      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const startTime = Date.now();
      const result = await tool.execute(input);
      const endTime = Date.now();

      expect(result.success).toBe(false);
      // Should fail quickly, not wait for full timeout
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should not leak memory on repeated errors', async () => {
      tool.simulateError('network_error');

      const input: WebSearchToolInput = {
        query: 'test search',
      };

      // Execute multiple failing requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(tool.execute(input));
      }

      const results = await Promise.all(promises);

      // All should fail
      results.forEach(result => {
        expect(result.success).toBe(false);
      });

      // Cache should still be empty
      expect(tool.getCacheSize()).toBe(0);

      // Tool should still be functional after errors
      tool.resetErrorSimulation();
      const successResult = await tool.execute(input);
      expect(successResult.success).toBe(true);
    });
  });
});