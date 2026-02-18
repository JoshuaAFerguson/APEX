/**
 * @fileoverview Performance and timeout tests for WebSearchTool
 *
 * This test suite focuses on performance characteristics and timeout behavior:
 * - Execution timing and performance benchmarks
 * - Timeout configuration and enforcement
 * - Load testing and stress scenarios
 * - Memory usage patterns
 * - Concurrent execution performance
 * - Cache performance impact
 *
 * @module @apex/core/tools/web/__tests__/web-search-tool.performance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WebSearchTool,
  type WebSearchToolInput,
  type WebSearchToolConfig,
  type WebSearchResult,
} from '../web-search-tool.js';
import type { ToolExecutionContext } from '../../base-tool.js';

/**
 * Performance-testable WebSearchTool with controllable delays
 */
class PerformanceTestableWebSearchTool extends WebSearchTool {
  private searchDelay: number = 0;
  private executionTimes: number[] = [];

  constructor(config?: WebSearchToolConfig, searchDelay: number = 0) {
    super(config);
    this.searchDelay = searchDelay;
  }

  protected async performSearch(
    query: string,
    allowedDomains: string[],
    blockedDomains: string[],
    context?: ToolExecutionContext
  ): Promise<WebSearchResult[]> {
    const startTime = Date.now();

    // Simulate network delay
    if (this.searchDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.searchDelay));
    }

    // Check for cancellation during "network" delay
    if (context?.signal?.aborted) {
      throw new Error('WebSearch operation was cancelled');
    }

    this.executionTimes.push(Date.now() - startTime);

    // Return mock results
    return [
      {
        title: `Performance test result for "${query}"`,
        url: `https://example.com/search?q=${encodeURIComponent(query)}`,
        snippet: `Mock search result for performance testing`,
        domain: 'example.com',
        position: 1,
      },
    ];
  }

  public getExecutionTimes(): number[] {
    return [...this.executionTimes];
  }

  public clearExecutionTimes(): void {
    this.executionTimes = [];
  }

  public getAverageExecutionTime(): number {
    if (this.executionTimes.length === 0) return 0;
    return this.executionTimes.reduce((sum, time) => sum + time, 0) / this.executionTimes.length;
  }
}

describe('WebSearchTool Performance', () => {
  // ============================================================================
  // Basic Performance Tests
  // ============================================================================

  describe('basic performance characteristics', () => {
    it('should complete simple searches quickly', async () => {
      const tool = new PerformanceTestableWebSearchTool({}, 10); // 10ms mock delay
      const input: WebSearchToolInput = {
        query: 'quick search test',
      };

      const startTime = Date.now();
      const result = await tool.execute(input);
      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(totalTime).toBeLessThan(100); // Should complete well under 100ms
      expect(result.duration).toBeDefined();
      expect(result.duration!).toBeGreaterThanOrEqual(10); // At least our mock delay
    });

    it('should provide accurate timing information', async () => {
      const tool = new PerformanceTestableWebSearchTool({}, 25); // 25ms delay
      const input: WebSearchToolInput = {
        query: 'timing test',
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.invokedAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
      expect(result.duration).toBeDefined();

      const calculatedDuration = result.completedAt!.getTime() - result.invokedAt!.getTime();
      expect(Math.abs(calculatedDuration - result.duration!)).toBeLessThan(5); // Within 5ms
    });

    it('should scale performance with query complexity', async () => {
      const tool = new PerformanceTestableWebSearchTool({}, 20);
      const queries = [
        'simple',
        'medium complexity query with multiple words',
        'very long and complex query with many words that might impact processing time and require more computational resources',
      ];

      const results = [];
      for (const query of queries) {
        const result = await tool.execute({ query });
        results.push(result);
      }

      expect(results.every(r => r.success)).toBe(true);
      expect(results.every(r => r.duration! < 100)).toBe(true); // All should be fast
    });
  });

  // ============================================================================
  // Timeout Configuration Tests
  // ============================================================================

  describe('timeout configuration', () => {
    it('should respect default timeout settings', async () => {
      const tool = new PerformanceTestableWebSearchTool({ timeout: 1000 }); // 1 second timeout
      const input: WebSearchToolInput = {
        query: 'timeout test',
      };

      const result = await tool.execute(input);
      expect(result.success).toBe(true);
    });

    it('should handle very short timeouts', async () => {
      // This tests the configuration is accepted, actual timeout behavior would
      // need integration with real network operations to test properly
      const tool = new PerformanceTestableWebSearchTool({ timeout: 100 }); // 100ms timeout

      expect(tool).toBeDefined();

      const result = await tool.execute({ query: 'short timeout test' });
      expect(result.success).toBe(true);
    });

    it('should handle very long timeouts', async () => {
      const tool = new PerformanceTestableWebSearchTool({ timeout: 300000 }); // 5 minutes

      expect(tool).toBeDefined();

      const result = await tool.execute({ query: 'long timeout test' });
      expect(result.success).toBe(true);
    });

    it('should handle cancellation via AbortSignal effectively', async () => {
      const tool = new PerformanceTestableWebSearchTool({}, 100); // 100ms delay
      const controller = new AbortController();

      const context: ToolExecutionContext = {
        signal: controller.signal,
      };

      // Start the search
      const searchPromise = tool.execute({
        query: 'cancellation test',
      }, context);

      // Cancel after 50ms (before our 100ms delay completes)
      setTimeout(() => controller.abort(), 50);

      const startTime = Date.now();
      const result = await searchPromise;
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.includes('cancelled')).toBe(true);
      expect(elapsed).toBeLessThan(80); // Should cancel before full delay
    });
  });

  // ============================================================================
  // Concurrent Execution Performance Tests
  // ============================================================================

  describe('concurrent execution performance', () => {
    it('should handle multiple concurrent searches efficiently', async () => {
      const tool = new PerformanceTestableWebSearchTool({}, 50); // 50ms delay each
      const searchCount = 10;

      const searches = Array.from({ length: searchCount }, (_, i) =>
        tool.execute({ query: `concurrent search ${i}` })
      );

      const startTime = Date.now();
      const results = await Promise.all(searches);
      const totalTime = Date.now() - startTime;

      expect(results.every(r => r.success)).toBe(true);
      expect(totalTime).toBeLessThan(150); // Should be much less than 10 * 50ms due to parallelism
      expect(tool.getExecutionTimes()).toHaveLength(searchCount);
    });

    it('should maintain cache performance under concurrent load', async () => {
      const tool = new PerformanceTestableWebSearchTool({}, 30);
      const sameQuery = 'cached concurrent search';

      // Prime the cache
      await tool.execute({ query: sameQuery });
      expect(tool.getCacheSize()).toBe(1);
      tool.clearExecutionTimes();

      // Execute many concurrent identical searches
      const concurrentSearches = Array.from({ length: 20 }, () =>
        tool.execute({ query: sameQuery })
      );

      const startTime = Date.now();
      const results = await Promise.all(concurrentSearches);
      const totalTime = Date.now() - startTime;

      expect(results.every(r => r.success)).toBe(true);
      expect(tool.getExecutionTimes()).toHaveLength(0); // All should use cache
      expect(totalTime).toBeLessThan(50); // Should be very fast due to caching
    });

    it('should handle mixed cache hits and misses efficiently', async () => {
      const tool = new PerformanceTestableWebSearchTool({}, 20);

      // Prime some cache entries
      await tool.execute({ query: 'cached 1' });
      await tool.execute({ query: 'cached 2' });
      tool.clearExecutionTimes();

      // Mix of cached and new searches
      const searches = [
        tool.execute({ query: 'cached 1' }), // Hit
        tool.execute({ query: 'cached 2' }), // Hit
        tool.execute({ query: 'new 1' }),    // Miss
        tool.execute({ query: 'cached 1' }), // Hit
        tool.execute({ query: 'new 2' }),    // Miss
        tool.execute({ query: 'cached 2' }), // Hit
      ];

      const startTime = Date.now();
      const results = await Promise.all(searches);
      const totalTime = Date.now() - startTime;

      expect(results.every(r => r.success)).toBe(true);
      expect(tool.getExecutionTimes()).toHaveLength(2); // Only 2 new searches
      expect(totalTime).toBeLessThan(80); // Should be faster than 6 * 20ms
    });
  });

  // ============================================================================
  // Cache Performance Impact Tests
  // ============================================================================

  describe('cache performance impact', () => {
    it('should show significant performance improvement with caching', async () => {
      const tool = new PerformanceTestableWebSearchTool({}, 50); // 50ms delay
      const query = 'cache performance test';

      // First execution (cache miss)
      const startTime1 = Date.now();
      const result1 = await tool.execute({ query });
      const time1 = Date.now() - startTime1;

      expect(result1.success).toBe(true);
      expect(time1).toBeGreaterThanOrEqual(50);

      tool.clearExecutionTimes();

      // Second execution (cache hit)
      const startTime2 = Date.now();
      const result2 = await tool.execute({ query });
      const time2 = Date.now() - startTime2;

      expect(result2.success).toBe(true);
      expect(time2).toBeLessThan(10); // Should be much faster
      expect(tool.getExecutionTimes()).toHaveLength(0); // No new execution
      expect(time2 * 5).toBeLessThan(time1); // At least 5x faster
    });

    it('should maintain cache performance with large cache sizes', async () => {
      const tool = new PerformanceTestableWebSearchTool({}, 10);

      // Populate cache with many entries
      const cachePopulation = Array.from({ length: 100 }, (_, i) =>
        tool.execute({ query: `cache entry ${i}` })
      );

      await Promise.all(cachePopulation);
      expect(tool.getCacheSize()).toBe(100);

      tool.clearExecutionTimes();

      // Test cache lookup performance
      const lookupQueries = [
        'cache entry 0',
        'cache entry 50',
        'cache entry 99',
        'cache entry 25',
      ];

      const startTime = Date.now();
      for (const query of lookupQueries) {
        await tool.execute({ query });
      }
      const totalTime = Date.now() - startTime;

      expect(tool.getExecutionTimes()).toHaveLength(0); // All cache hits
      expect(totalTime).toBeLessThan(20); // Should be very fast even with large cache
    });

    it('should handle cache cleanup performance efficiently', async () => {
      const cleanupTool = new PerformanceTestableWebSearchTool({ cacheTTL: 50 }, 5);

      // Add many entries that will expire
      const populatePromises = Array.from({ length: 200 }, (_, i) =>
        cleanupTool.execute({ query: `cleanup test ${i}` })
      );

      await Promise.all(populatePromises);
      expect(cleanupTool.getCacheSize()).toBe(200);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60));

      // Execute a new search that should trigger cleanup
      const startTime = Date.now();
      await cleanupTool.execute({ query: 'trigger cleanup' });
      const cleanupTime = Date.now() - startTime;

      // Cleanup should be fast even with many expired entries
      expect(cleanupTime).toBeLessThan(100);
      expect(cleanupTool.getCacheSize()).toBeLessThan(100); // Should have cleaned up
    });
  });

  // ============================================================================
  // Memory Performance Tests
  // ============================================================================

  describe('memory performance', () => {
    it('should not accumulate excessive memory with many searches', async () => {
      const tool = new PerformanceTestableWebSearchTool({ cacheTTL: 10 }, 1); // Very short TTL

      const searchCount = 1000;
      let completedSearches = 0;

      // Execute many searches with occasional cleanup opportunities
      for (let i = 0; i < searchCount; i++) {
        await tool.execute({ query: `memory test ${i}` });
        completedSearches++;

        // Occasionally pause to allow cleanup
        if (i % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 15));
        }
      }

      expect(completedSearches).toBe(searchCount);
      // Cache should not contain all entries due to TTL and cleanup
      expect(tool.getCacheSize()).toBeLessThan(searchCount / 2);
    });

    it('should handle rapid cache turnover efficiently', async () => {
      const rapidTool = new PerformanceTestableWebSearchTool({ cacheTTL: 20 }, 2);

      const cycles = 50;
      for (let cycle = 0; cycle < cycles; cycle++) {
        // Add entries
        await rapidTool.execute({ query: `cycle ${cycle} entry 1` });
        await rapidTool.execute({ query: `cycle ${cycle} entry 2` });

        // Wait for some to expire
        await new Promise(resolve => setTimeout(resolve, 25));

        // Use some entries (might be expired)
        await rapidTool.execute({ query: `cycle ${cycle} entry 1` });
      }

      // Should complete without performance degradation
      expect(rapidTool.getCacheSize()).toBeGreaterThan(0);
      expect(rapidTool.getCacheSize()).toBeLessThan(cycles * 2);
    });
  });

  // ============================================================================
  // Domain Filtering Performance Tests
  // ============================================================================

  describe('domain filtering performance', () => {
    it('should handle large domain lists efficiently', async () => {
      const largeDomainList = Array.from({ length: 1000 }, (_, i) => `domain${i}.com`);
      const tool = new PerformanceTestableWebSearchTool({}, 10);

      const startTime = Date.now();
      const result = await tool.execute({
        query: 'large domain list test',
        allowed_domains: largeDomainList.slice(0, 500),
        blocked_domains: largeDomainList.slice(500),
      });
      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(totalTime).toBeLessThan(100); // Should handle large lists quickly
    });

    it('should cache domain-filtered results efficiently', async () => {
      const tool = new PerformanceTestableWebSearchTool({}, 25);
      const domains = ['example.com', 'test.org', 'demo.net'];

      const input = {
        query: 'domain filtering cache test',
        allowed_domains: domains,
      };

      // First execution
      const time1Start = Date.now();
      await tool.execute(input);
      const time1 = Date.now() - time1Start;

      tool.clearExecutionTimes();

      // Second execution (should use cache)
      const time2Start = Date.now();
      await tool.execute(input);
      const time2 = Date.now() - time2Start;

      expect(tool.getExecutionTimes()).toHaveLength(0); // Cache hit
      expect(time2).toBeLessThan(time1 / 3); // Much faster
    });
  });

  // ============================================================================
  // Performance Regression Tests
  // ============================================================================

  describe('performance regression protection', () => {
    it('should complete basic operations within performance budgets', async () => {
      const tool = new PerformanceTestableWebSearchTool({}, 15);

      const performanceTests = [
        { operation: 'simple search', input: { query: 'test' }, maxTime: 50 },
        { operation: 'domain filtered', input: { query: 'test', allowed_domains: ['example.com'] }, maxTime: 60 },
        { operation: 'complex query', input: { query: 'complex search with multiple words' }, maxTime: 70 },
      ];

      for (const test of performanceTests) {
        const startTime = Date.now();
        const result = await tool.execute(test.input);
        const elapsed = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(elapsed).toBeLessThan(test.maxTime);
      }
    });

    it('should maintain consistent performance across multiple executions', async () => {
      const tool = new PerformanceTestableWebSearchTool({}, 20);
      const executions = 10;
      const times: number[] = [];

      for (let i = 0; i < executions; i++) {
        const startTime = Date.now();
        await tool.execute({ query: `consistency test ${i}` });
        times.push(Date.now() - startTime);
      }

      // Check for consistent performance (no significant outliers)
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxDeviation = Math.max(...times.map(time => Math.abs(time - avgTime)));

      expect(maxDeviation).toBeLessThan(avgTime * 0.5); // Within 50% of average
      expect(avgTime).toBeLessThan(100); // Reasonable average time
    });

    it('should scale linearly with reasonable load', async () => {
      const tool = new PerformanceTestableWebSearchTool({}, 10);

      // Test different batch sizes
      const batchSizes = [1, 5, 10, 20];
      const results = [];

      for (const size of batchSizes) {
        const startTime = Date.now();
        const searches = Array.from({ length: size }, (_, i) =>
          tool.execute({ query: `scale test ${size}-${i}` })
        );
        await Promise.all(searches);
        const elapsed = Date.now() - startTime;
        results.push({ size, elapsed });
      }

      // Performance should scale reasonably (not exponentially)
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        const scaleFactor = curr.size / prev.size;
        const timeFactor = curr.elapsed / prev.elapsed;

        // Time factor should not be significantly worse than scale factor
        expect(timeFactor).toBeLessThan(scaleFactor * 1.5);
      }
    });
  });
});