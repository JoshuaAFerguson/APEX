/**
 * @fileoverview Comprehensive caching tests for WebSearchTool
 *
 * This test suite focuses exclusively on caching behavior:
 * - Cache key generation and uniqueness
 * - Cache TTL and expiration behavior
 * - Cache cleanup and memory management
 * - Cache hit/miss scenarios
 * - Concurrent cache operations
 * - Cache invalidation patterns
 *
 * @module @apex/core/tools/web/__tests__/web-search-tool.caching
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WebSearchTool,
  type WebSearchToolInput,
  type WebSearchToolOutput,
  type WebSearchToolConfig,
  type WebSearchResult,
} from '../web-search-tool.js';

/**
 * Extended WebSearchTool for testing cache internals
 */
class CacheTestableWebSearchTool extends WebSearchTool {
  private searchExecutions: Array<{
    query: string;
    allowedDomains: string[];
    blockedDomains: string[];
    timestamp: number;
  }> = [];

  constructor(config?: WebSearchToolConfig) {
    super(config);
  }

  protected async performSearch(
    query: string,
    allowedDomains: string[],
    blockedDomains: string[]
  ): Promise<WebSearchResult[]> {
    // Record each actual search execution
    this.searchExecutions.push({
      query,
      allowedDomains: [...allowedDomains],
      blockedDomains: [...blockedDomains],
      timestamp: Date.now(),
    });

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 10));

    // Return mock results based on query
    return [
      {
        title: `Result for "${query}"`,
        url: `https://example.com/search?q=${encodeURIComponent(query)}`,
        snippet: `Search results for ${query}`,
        domain: 'example.com',
        position: 1,
      },
    ];
  }

  public getSearchExecutions() {
    return [...this.searchExecutions];
  }

  public clearSearchExecutions() {
    this.searchExecutions = [];
  }

  public getSearchExecutionCount(): number {
    return this.searchExecutions.length;
  }

  // Expose cache key generation for testing
  public generateCacheKeyPublic(
    query: string,
    allowedDomains: string[],
    blockedDomains: string[]
  ): string {
    return (this as any).generateCacheKey(query, allowedDomains, blockedDomains);
  }

  // Expose cache cleanup for testing
  public forceCleanupCache(): void {
    (this as any).cleanupCache();
  }
}

describe('WebSearchTool Caching', () => {
  let tool: CacheTestableWebSearchTool;

  beforeEach(() => {
    tool = new CacheTestableWebSearchTool({ cacheTTL: 1000 }); // 1 second TTL for testing
  });

  afterEach(() => {
    tool.clearCache();
    tool.clearSearchExecutions();
  });

  // ============================================================================
  // Cache Key Generation Tests
  // ============================================================================

  describe('cache key generation', () => {
    it('should generate consistent keys for identical parameters', () => {
      const key1 = tool.generateCacheKeyPublic('test query', ['example.com'], ['spam.com']);
      const key2 = tool.generateCacheKeyPublic('test query', ['example.com'], ['spam.com']);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different queries', () => {
      const key1 = tool.generateCacheKeyPublic('query one', [], []);
      const key2 = tool.generateCacheKeyPublic('query two', [], []);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different domain configurations', () => {
      const baseQuery = 'same query';

      const key1 = tool.generateCacheKeyPublic(baseQuery, [], []);
      const key2 = tool.generateCacheKeyPublic(baseQuery, ['example.com'], []);
      const key3 = tool.generateCacheKeyPublic(baseQuery, [], ['spam.com']);
      const key4 = tool.generateCacheKeyPublic(baseQuery, ['example.com'], ['spam.com']);

      const keys = [key1, key2, key3, key4];
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(4);
    });

    it('should normalize case and ordering for cache keys', () => {
      // Same domains, different order
      const key1 = tool.generateCacheKeyPublic('test', ['a.com', 'b.com'], ['x.com', 'y.com']);
      const key2 = tool.generateCacheKeyPublic('test', ['b.com', 'a.com'], ['y.com', 'x.com']);

      expect(key1).toBe(key2);
    });

    it('should handle special characters in cache keys', () => {
      const specialQuery = 'query with "quotes" and symbols!@#$%^&*()';
      const specialDomains = ['domain-with-hyphens.com', 'domain_with_underscores.org'];

      expect(() => {
        const key = tool.generateCacheKeyPublic(specialQuery, specialDomains, []);
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      }).not.toThrow();
    });

    it('should handle empty arrays consistently', () => {
      const key1 = tool.generateCacheKeyPublic('test', [], []);
      const key2 = tool.generateCacheKeyPublic('test', [], []);

      expect(key1).toBe(key2);
    });
  });

  // ============================================================================
  // Cache Hit/Miss Behavior Tests
  // ============================================================================

  describe('cache hit/miss behavior', () => {
    it('should cache results after first execution', async () => {
      const input: WebSearchToolInput = {
        query: 'test search',
      };

      // First execution should perform search
      await tool.execute(input);
      expect(tool.getSearchExecutionCount()).toBe(1);
      expect(tool.getCacheSize()).toBe(1);

      // Second execution should use cache
      await tool.execute(input);
      expect(tool.getSearchExecutionCount()).toBe(1); // Still 1
      expect(tool.getCacheSize()).toBe(1);
    });

    it('should cache results with different domain configurations separately', async () => {
      const query = 'same query';

      const input1: WebSearchToolInput = { query };
      const input2: WebSearchToolInput = { query, allowed_domains: ['example.com'] };
      const input3: WebSearchToolInput = { query, blocked_domains: ['spam.com'] };

      await tool.execute(input1);
      await tool.execute(input2);
      await tool.execute(input3);

      expect(tool.getSearchExecutionCount()).toBe(3);
      expect(tool.getCacheSize()).toBe(3);

      // Execute again - should use cache
      await tool.execute(input1);
      await tool.execute(input2);
      await tool.execute(input3);

      expect(tool.getSearchExecutionCount()).toBe(3); // Still 3
    });

    it('should preserve cache across different tool methods', async () => {
      const input: WebSearchToolInput = {
        query: 'cache persistence test',
      };

      // Execute search
      await tool.execute(input);
      expect(tool.getCacheSize()).toBe(1);

      // Clear search executions but not cache
      tool.clearSearchExecutions();

      // Execute again - should use cache
      await tool.execute(input);
      expect(tool.getSearchExecutionCount()).toBe(0); // No new executions
      expect(tool.getCacheSize()).toBe(1);
    });

    it('should handle cache misses correctly', async () => {
      const input1: WebSearchToolInput = { query: 'first query' };
      const input2: WebSearchToolInput = { query: 'second query' };

      await tool.execute(input1);
      await tool.execute(input2);

      expect(tool.getSearchExecutionCount()).toBe(2);
      expect(tool.getCacheSize()).toBe(2);

      // Execute first query again - should hit cache
      await tool.execute(input1);
      expect(tool.getSearchExecutionCount()).toBe(2); // No new execution
    });
  });

  // ============================================================================
  // Cache TTL and Expiration Tests
  // ============================================================================

  describe('cache TTL and expiration', () => {
    it('should respect cache TTL for expiration', async () => {
      const shortTTLTool = new CacheTestableWebSearchTool({ cacheTTL: 50 }); // 50ms TTL
      const input: WebSearchToolInput = {
        query: 'ttl test',
      };

      // First execution
      await shortTTLTool.execute(input);
      expect(shortTTLTool.getSearchExecutionCount()).toBe(1);
      expect(shortTTLTool.getCacheSize()).toBe(1);

      // Execute again immediately - should use cache
      await shortTTLTool.execute(input);
      expect(shortTTLTool.getSearchExecutionCount()).toBe(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 60));

      // Execute after expiration - should perform new search
      await shortTTLTool.execute(input);
      expect(shortTTLTool.getSearchExecutionCount()).toBe(2);
    });

    it('should handle zero TTL configuration', async () => {
      const noCache = new CacheTestableWebSearchTool({ cacheTTL: 0 });
      const input: WebSearchToolInput = {
        query: 'no cache test',
      };

      await noCache.execute(input);
      await noCache.execute(input);

      // With zero TTL, every execution should be fresh
      expect(noCache.getSearchExecutionCount()).toBe(2);
    });

    it('should handle very long TTL configuration', async () => {
      const longCacheTool = new CacheTestableWebSearchTool({ cacheTTL: 86400000 }); // 24 hours
      const input: WebSearchToolInput = {
        query: 'long cache test',
      };

      await longCacheTool.execute(input);
      await longCacheTool.execute(input);
      await longCacheTool.execute(input);

      // Should use cache for all executions
      expect(longCacheTool.getSearchExecutionCount()).toBe(1);
      expect(longCacheTool.getCacheSize()).toBe(1);
    });

    it('should handle mixed TTL scenarios', async () => {
      const mixedTTLTool = new CacheTestableWebSearchTool({ cacheTTL: 100 }); // 100ms TTL

      // Execute multiple searches
      await mixedTTLTool.execute({ query: 'search 1' });
      await mixedTTLTool.execute({ query: 'search 2' });

      expect(mixedTTLTool.getCacheSize()).toBe(2);

      // Wait for partial expiration
      await new Promise(resolve => setTimeout(resolve, 50));

      // Add more searches
      await mixedTTLTool.execute({ query: 'search 3' });
      await mixedTTLTool.execute({ query: 'search 1' }); // Should still be cached

      expect(mixedTTLTool.getSearchExecutionCount()).toBe(3);

      // Wait for full expiration
      await new Promise(resolve => setTimeout(resolve, 60));

      // This should trigger cleanup and new search
      await mixedTTLTool.execute({ query: 'search 1' });
      expect(mixedTTLTool.getSearchExecutionCount()).toBe(4);
    });
  });

  // ============================================================================
  // Cache Cleanup Tests
  // ============================================================================

  describe('cache cleanup', () => {
    it('should clean up expired entries automatically', async () => {
      const cleanupTool = new CacheTestableWebSearchTool({ cacheTTL: 50 });

      // Add multiple entries
      await cleanupTool.execute({ query: 'entry 1' });
      await cleanupTool.execute({ query: 'entry 2' });
      await cleanupTool.execute({ query: 'entry 3' });

      expect(cleanupTool.getCacheSize()).toBe(3);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60));

      // Force cleanup by adding new entry
      await cleanupTool.execute({ query: 'entry 4' });

      // Cache should be smaller after cleanup
      expect(cleanupTool.getCacheSize()).toBeLessThanOrEqual(1);
    });

    it('should clear all cache when requested', async () => {
      await tool.execute({ query: 'test 1' });
      await tool.execute({ query: 'test 2' });
      await tool.execute({ query: 'test 3' });

      expect(tool.getCacheSize()).toBe(3);

      tool.clearCache();
      expect(tool.getCacheSize()).toBe(0);

      // Subsequent searches should execute fresh
      await tool.execute({ query: 'test 1' });
      expect(tool.getSearchExecutionCount()).toBe(4); // Original 3 + 1 new
    });

    it('should handle cleanup during concurrent operations', async () => {
      const concurrentTool = new CacheTestableWebSearchTool({ cacheTTL: 20 });

      // Start many concurrent searches
      const searches = Array.from({ length: 20 }, (_, i) =>
        concurrentTool.execute({ query: `concurrent ${i}` })
      );

      await Promise.all(searches);

      // Wait for expiration and trigger cleanup
      await new Promise(resolve => setTimeout(resolve, 30));
      await concurrentTool.execute({ query: 'cleanup trigger' });

      // Should not throw errors and should manage cache size
      expect(concurrentTool.getCacheSize()).toBeLessThan(20);
    });

    it('should preserve non-expired entries during cleanup', async () => {
      const selectiveTool = new CacheTestableWebSearchTool({ cacheTTL: 100 });

      // Add first batch
      await selectiveTool.execute({ query: 'old entry 1' });
      await selectiveTool.execute({ query: 'old entry 2' });

      // Wait partially
      await new Promise(resolve => setTimeout(resolve, 50));

      // Add second batch (these should not expire yet)
      await selectiveTool.execute({ query: 'new entry 1' });
      await selectiveTool.execute({ query: 'new entry 2' });

      expect(selectiveTool.getCacheSize()).toBe(4);

      // Wait for first batch to expire
      await new Promise(resolve => setTimeout(resolve, 60));

      // Force cleanup
      selectiveTool.forceCleanupCache();

      // Should preserve recent entries
      expect(selectiveTool.getCacheSize()).toBe(2);

      // Recent entries should still be cached
      await selectiveTool.execute({ query: 'new entry 1' });
      expect(selectiveTool.getSearchExecutionCount()).toBe(4); // No new execution
    });
  });

  // ============================================================================
  // Concurrent Cache Operations Tests
  // ============================================================================

  describe('concurrent cache operations', () => {
    it('should handle concurrent cache reads safely', async () => {
      const input: WebSearchToolInput = {
        query: 'concurrent reads',
      };

      // Prime the cache
      await tool.execute(input);
      tool.clearSearchExecutions();

      // Execute many concurrent reads
      const concurrentReads = Array.from({ length: 10 }, () => tool.execute(input));
      const results = await Promise.all(concurrentReads);

      // All should succeed and use cache
      expect(results.every(r => r.success)).toBe(true);
      expect(tool.getSearchExecutionCount()).toBe(0); // All from cache
    });

    it('should handle concurrent cache writes safely', async () => {
      const searches = Array.from({ length: 10 }, (_, i) =>
        tool.execute({ query: `concurrent write ${i}` })
      );

      const results = await Promise.all(searches);

      expect(results.every(r => r.success)).toBe(true);
      expect(tool.getSearchExecutionCount()).toBe(10);
      expect(tool.getCacheSize()).toBe(10);
    });

    it('should handle mixed concurrent operations', async () => {
      // Prime some cache entries
      await tool.execute({ query: 'existing 1' });
      await tool.execute({ query: 'existing 2' });
      tool.clearSearchExecutions();

      const operations = [
        // Cache hits
        tool.execute({ query: 'existing 1' }),
        tool.execute({ query: 'existing 2' }),
        tool.execute({ query: 'existing 1' }),

        // Cache misses
        tool.execute({ query: 'new 1' }),
        tool.execute({ query: 'new 2' }),

        // Cache operations
        Promise.resolve(tool.clearCache()).then(() =>
          tool.execute({ query: 'after clear' })
        ),
      ];

      const results = await Promise.all(operations);
      expect(results.every(r => r !== undefined)).toBe(true);
    });
  });

  // ============================================================================
  // Cache Memory Management Tests
  // ============================================================================

  describe('cache memory management', () => {
    it('should not grow cache indefinitely', async () => {
      const managedTool = new CacheTestableWebSearchTool({ cacheTTL: 10 }); // Very short TTL

      // Execute many searches
      for (let i = 0; i < 100; i++) {
        await managedTool.execute({ query: `search ${i}` });

        // Occasionally wait to allow cleanup
        if (i % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 15));
        }
      }

      // Cache should be much smaller than 100 due to cleanup
      expect(managedTool.getCacheSize()).toBeLessThan(50);
    });

    it('should report accurate cache size', async () => {
      expect(tool.getCacheSize()).toBe(0);

      await tool.execute({ query: 'test 1' });
      expect(tool.getCacheSize()).toBe(1);

      await tool.execute({ query: 'test 2' });
      expect(tool.getCacheSize()).toBe(2);

      await tool.execute({ query: 'test 1' }); // Cache hit
      expect(tool.getCacheSize()).toBe(2); // Still 2

      tool.clearCache();
      expect(tool.getCacheSize()).toBe(0);
    });

    it('should handle cache operations after clear', async () => {
      await tool.execute({ query: 'before clear' });
      expect(tool.getCacheSize()).toBe(1);

      tool.clearCache();
      expect(tool.getCacheSize()).toBe(0);

      // Should work normally after clear
      await tool.execute({ query: 'after clear' });
      expect(tool.getCacheSize()).toBe(1);

      // Should cache subsequent identical requests
      await tool.execute({ query: 'after clear' });
      expect(tool.getSearchExecutionCount()).toBe(2); // Original + after clear
    });
  });
});