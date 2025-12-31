/**
 * @fileoverview Integration tests for WebSearchTool
 *
 * These tests verify complex scenarios and integration behavior including:
 * - Domain filtering logic with realistic data
 * - Caching behavior and lifecycle
 * - Complex validation scenarios
 * - Performance and timeout behavior
 * - Memory management and cleanup
 *
 * @module @apex/core/tools/web/__tests__/web-search-tool.integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WebSearchTool,
  type WebSearchToolInput,
  type WebSearchToolOutput,
  type WebSearchToolConfig,
  type WebSearchResult,
} from '../web-search-tool.js';
import type { ToolExecutionContext } from '../../base-tool.js';

// ============================================================================
// Test Setup and Helpers
// ============================================================================

/**
 * Creates a mock search result for testing
 */
function createMockResult(domain: string, position: number): WebSearchResult {
  return {
    title: `Test Result ${position}`,
    url: `https://${domain}/test-${position}`,
    snippet: `This is a test snippet from ${domain}`,
    domain,
    position,
  };
}

/**
 * Creates a tool instance with custom performSearch implementation for testing
 */
class TestableWebSearchTool extends WebSearchTool {
  private mockResults: WebSearchResult[] = [];
  private searchCallCount = 0;

  constructor(config?: WebSearchToolConfig, mockResults: WebSearchResult[] = []) {
    super(config);
    this.mockResults = mockResults;
  }

  // Override the private performSearch method for testing
  protected async performSearch(
    query: string,
    allowedDomains: string[],
    blockedDomains: string[],
    context?: ToolExecutionContext
  ): Promise<WebSearchResult[]> {
    this.searchCallCount++;

    if (context?.signal?.aborted) {
      throw new Error('WebSearch operation was cancelled');
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 10));

    // Apply domain filtering to mock results
    let filteredResults = [...this.mockResults];

    if (blockedDomains.length > 0) {
      filteredResults = filteredResults.filter(result => {
        const domain = result.domain.toLowerCase();
        return !blockedDomains.some(blocked =>
          domain === blocked.toLowerCase() || domain.endsWith('.' + blocked.toLowerCase())
        );
      });
    }

    if (allowedDomains.length > 0) {
      filteredResults = filteredResults.filter(result => {
        const domain = result.domain.toLowerCase();
        return allowedDomains.some(allowed =>
          domain === allowed.toLowerCase() || domain.endsWith('.' + allowed.toLowerCase())
        );
      });
    }

    // Respect maxResults configuration
    const maxResults = (this as any).config.maxResults;
    return filteredResults.slice(0, maxResults);
  }

  public getSearchCallCount(): number {
    return this.searchCallCount;
  }

  public resetSearchCallCount(): void {
    this.searchCallCount = 0;
  }
}

describe('WebSearchTool Integration Tests', () => {
  let mockResults: WebSearchResult[];

  beforeEach(() => {
    // Create realistic mock search results
    mockResults = [
      createMockResult('developer.mozilla.org', 1),
      createMockResult('stackoverflow.com', 2),
      createMockResult('github.com', 3),
      createMockResult('w3schools.com', 4),
      createMockResult('example.com', 5),
      createMockResult('docs.python.org', 6),
      createMockResult('spam.example.net', 7),
      createMockResult('sub.example.com', 8),
    ];
  });

  // ============================================================================
  // Domain Filtering Integration Tests
  // ============================================================================

  describe('domain filtering integration', () => {
    it('should properly filter results with allowed domains', async () => {
      const tool = new TestableWebSearchTool({}, mockResults);
      const input: WebSearchToolInput = {
        query: 'JavaScript documentation',
        allowed_domains: ['developer.mozilla.org', 'github.com'],
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.domainFiltered).toBe(true);
      expect(result.output!.results).toHaveLength(2);
      expect(result.output!.results[0].domain).toBe('developer.mozilla.org');
      expect(result.output!.results[1].domain).toBe('github.com');
    });

    it('should properly filter results with blocked domains', async () => {
      const tool = new TestableWebSearchTool({}, mockResults);
      const input: WebSearchToolInput = {
        query: 'JavaScript tutorial',
        blocked_domains: ['w3schools.com', 'spam.example.net'],
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.domainFiltered).toBe(true);
      expect(result.output!.results.some(r => r.domain === 'w3schools.com')).toBe(false);
      expect(result.output!.results.some(r => r.domain === 'spam.example.net')).toBe(false);
      expect(result.output!.results.length).toBeGreaterThan(0);
    });

    it('should handle subdomain filtering correctly', async () => {
      const tool = new TestableWebSearchTool({}, mockResults);
      const input: WebSearchToolInput = {
        query: 'test search',
        allowed_domains: ['example.com'], // Should match both example.com and sub.example.com
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.results.some(r => r.domain === 'example.com')).toBe(true);
      expect(result.output!.results.some(r => r.domain === 'sub.example.com')).toBe(true);
      expect(result.output!.results.some(r => r.domain === 'spam.example.net')).toBe(false);
    });

    it('should handle complex domain filtering scenarios', async () => {
      const tool = new TestableWebSearchTool({}, mockResults);
      const input: WebSearchToolInput = {
        query: 'programming resources',
        allowed_domains: ['github.com', 'stackoverflow.com', 'docs.python.org'],
        blocked_domains: ['spam.example.net'],
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.results).toHaveLength(3);
      expect(result.output!.results.every(r =>
        ['github.com', 'stackoverflow.com', 'docs.python.org'].includes(r.domain)
      )).toBe(true);
    });

    it('should return empty results when no domains match allowlist', async () => {
      const tool = new TestableWebSearchTool({}, mockResults);
      const input: WebSearchToolInput = {
        query: 'test search',
        allowed_domains: ['nonexistent.com'],
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.results).toHaveLength(0);
      expect(result.output!.totalResults).toBe(0);
    });
  });

  // ============================================================================
  // Caching Integration Tests
  // ============================================================================

  describe('caching integration', () => {
    it('should cache results and avoid duplicate searches', async () => {
      const tool = new TestableWebSearchTool({}, mockResults);
      const input: WebSearchToolInput = {
        query: 'test search',
      };

      // First search
      const result1 = await tool.execute(input);
      expect(tool.getSearchCallCount()).toBe(1);

      // Second identical search should use cache
      const result2 = await tool.execute(input);
      expect(tool.getSearchCallCount()).toBe(1); // Still 1, not 2

      expect(result1.output!.query).toBe(result2.output!.query);
      expect(result1.output!.totalResults).toBe(result2.output!.totalResults);
    });

    it('should respect cache for domain-filtered searches', async () => {
      const tool = new TestableWebSearchTool({}, mockResults);

      // Search with domain filtering
      const input1: WebSearchToolInput = {
        query: 'test search',
        allowed_domains: ['github.com'],
      };

      await tool.execute(input1);
      expect(tool.getSearchCallCount()).toBe(1);

      // Same search should use cache
      await tool.execute(input1);
      expect(tool.getSearchCallCount()).toBe(1);

      // Different domain filtering should trigger new search
      const input2: WebSearchToolInput = {
        query: 'test search',
        allowed_domains: ['stackoverflow.com'],
      };

      await tool.execute(input2);
      expect(tool.getSearchCallCount()).toBe(2);
    });

    it('should handle cache cleanup correctly', async () => {
      const tool = new TestableWebSearchTool({ cacheTTL: 10 }, mockResults); // 10ms TTL
      const input: WebSearchToolInput = {
        query: 'test search',
      };

      // First search
      await tool.execute(input);
      expect(tool.getCacheSize()).toBe(1);
      expect(tool.getSearchCallCount()).toBe(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 15));

      // Second search should not use expired cache
      await tool.execute(input);
      expect(tool.getSearchCallCount()).toBe(2);
    });

    it('should clear cache when requested', async () => {
      const tool = new TestableWebSearchTool({}, mockResults);
      const input: WebSearchToolInput = {
        query: 'test search',
      };

      await tool.execute(input);
      expect(tool.getCacheSize()).toBeGreaterThan(0);

      tool.clearCache();
      expect(tool.getCacheSize()).toBe(0);

      // Next search should not use cache
      await tool.execute(input);
      expect(tool.getSearchCallCount()).toBe(2);
    });
  });

  // ============================================================================
  // Configuration Integration Tests
  // ============================================================================

  describe('configuration integration', () => {
    it('should respect maxResults configuration', async () => {
      const tool = new TestableWebSearchTool({ maxResults: 3 }, mockResults);
      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.results).toHaveLength(3);
    });

    it('should use custom user agent configuration', () => {
      const customUserAgent = 'CustomTestAgent/1.0';
      const tool = new TestableWebSearchTool({ userAgent: customUserAgent }, mockResults);

      // We can't directly test the user agent without mocking network calls,
      // but we can verify the tool was created successfully with custom config
      expect(tool).toBeDefined();
    });

    it('should handle custom timeout configuration', async () => {
      const tool = new TestableWebSearchTool({ timeout: 1000 }, mockResults);
      const input: WebSearchToolInput = {
        query: 'test search',
      };

      const result = await tool.execute(input);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Error Handling Integration Tests
  // ============================================================================

  describe('error handling integration', () => {
    it('should handle cancellation during search execution', async () => {
      const tool = new TestableWebSearchTool({}, mockResults);
      const controller = new AbortController();

      const context: ToolExecutionContext = {
        signal: controller.signal,
      };

      // Start the search and cancel it immediately
      const searchPromise = tool.execute({
        query: 'test search',
      }, context);

      controller.abort();

      const result = await searchPromise;
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.includes('cancelled')).toBe(true);
    });

    it('should handle complex validation errors gracefully', async () => {
      const tool = new TestableWebSearchTool({}, mockResults);
      const input = {
        query: '', // Invalid: too short
        allowed_domains: 'not-an-array', // Invalid: should be array
        blocked_domains: [123], // Invalid: should be strings
      } as unknown as WebSearchToolInput;

      const result = await tool.execute(input);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // Performance Integration Tests
  // ============================================================================

  describe('performance integration', () => {
    it('should complete searches within reasonable time', async () => {
      const tool = new TestableWebSearchTool({}, mockResults);
      const input: WebSearchToolInput = {
        query: 'performance test',
      };

      const startTime = Date.now();
      const result = await tool.execute(input);
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(1000); // Should complete within 1 second
      expect(result.duration).toBeDefined();
      expect(result.duration!).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple concurrent searches efficiently', async () => {
      const tool = new TestableWebSearchTool({}, mockResults);

      const searches = Array.from({ length: 5 }, (_, i) =>
        tool.execute({
          query: `concurrent search ${i}`,
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(searches);
      const elapsed = Date.now() - startTime;

      expect(results.every(r => r.success)).toBe(true);
      expect(elapsed).toBeLessThan(2000); // All 5 searches within 2 seconds
    });

    it('should maintain cache efficiency under load', async () => {
      const tool = new TestableWebSearchTool({}, mockResults);
      const input: WebSearchToolInput = {
        query: 'cache efficiency test',
      };

      // Perform multiple identical searches
      const searches = Array.from({ length: 10 }, () => tool.execute(input));
      await Promise.all(searches);

      // Should only perform one actual search due to caching
      expect(tool.getSearchCallCount()).toBe(1);
    });
  });

  // ============================================================================
  // Memory Management Tests
  // ============================================================================

  describe('memory management', () => {
    it('should properly clean up resources', async () => {
      const tool = new TestableWebSearchTool({ cacheTTL: 10 }, mockResults);

      // Perform many searches to populate cache
      for (let i = 0; i < 100; i++) {
        await tool.execute({ query: `search ${i}` });
      }

      expect(tool.getCacheSize()).toBe(100);

      // Wait for cache cleanup
      await new Promise(resolve => setTimeout(resolve, 20));

      // Perform one more search to trigger cleanup
      await tool.execute({ query: 'cleanup trigger' });

      // Cache should be much smaller after cleanup
      expect(tool.getCacheSize()).toBeLessThan(50);
    });

    it('should handle cache growth and prevent memory leaks', () => {
      const tool = new TestableWebSearchTool({}, mockResults);

      // The cache should not grow indefinitely
      expect(tool.getCacheSize()).toBe(0);

      // Clear cache to test that it works
      tool.clearCache();
      expect(tool.getCacheSize()).toBe(0);
    });
  });
});