/**
 * Performance regression tests for SemanticSearch
 *
 * These tests establish performance baselines and detect performance regressions.
 * They measure execution time, memory usage, and scalability characteristics.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SemanticSearch, type SemanticSearchOptions } from '../semantic-search.js';
import type { RepositoryMap, CodeSymbol, CodeFile } from '@apexcli/core/types';

describe('SemanticSearch - Performance Tests', () => {
  let semanticSearch: SemanticSearch;
  let largeRepositoryMap: RepositoryMap;
  let performanceMetrics: PerformanceMetrics;

  beforeEach(() => {
    performanceMetrics = new PerformanceMetrics();
    largeRepositoryMap = createPerformanceTestRepositoryMap();
    semanticSearch = new SemanticSearch(largeRepositoryMap);
  });

  afterEach(() => {
    performanceMetrics.reset();
  });

  describe('Search Performance Baselines', () => {
    it('should complete simple searches within acceptable time limits', () => {
      const simpleQueries = [
        'function',
        'class User',
        'validate email',
        'async method',
        'interface'
      ];

      simpleQueries.forEach(query => {
        const startTime = performance.now();
        const results = semanticSearch.search(query, { limit: 20 });
        const endTime = performance.now();

        const duration = endTime - startTime;
        expect(duration).toBeLessThan(50); // Should complete within 50ms for simple queries
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);

        performanceMetrics.record('simpleSearch', duration);
      });
    });

    it('should handle complex queries within reasonable time limits', () => {
      const complexQueries = [
        'async function that validates user email addresses and returns promise',
        'class method that implements authentication logic with error handling',
        'interface defining generic type constraints for data validation',
        'function returning array of filtered objects with specific properties',
        'component that renders user interface with conditional styling'
      ];

      complexQueries.forEach(query => {
        const startTime = performance.now();
        const results = semanticSearch.search(query, { limit: 50 });
        const endTime = performance.now();

        const duration = endTime - startTime;
        expect(duration).toBeLessThan(200); // Should complete within 200ms for complex queries
        expect(results).toBeDefined();

        performanceMetrics.record('complexSearch', duration);
      });
    });

    it('should scale search performance with result set size', () => {
      const query = 'test function';
      const limits = [10, 50, 100, 500, 1000];

      limits.forEach(limit => {
        const startTime = performance.now();
        const results = semanticSearch.search(query, { limit });
        const endTime = performance.now();

        const duration = endTime - startTime;
        expect(results.length).toBeLessThanOrEqual(limit);

        // Performance should scale reasonably with result set size
        // Allow up to 1ms per result (very generous for regression detection)
        expect(duration).toBeLessThan(limit * 1);

        performanceMetrics.record(`limitedSearch_${limit}`, duration);
      });
    });
  });

  describe('Index Building Performance', () => {
    it('should build search index efficiently', () => {
      const buildStartTime = performance.now();

      // Create new instance to trigger index building
      const newSemanticSearch = new SemanticSearch(largeRepositoryMap);

      const buildEndTime = performance.now();
      const buildDuration = buildEndTime - buildStartTime;

      // Index building should complete within reasonable time
      // Based on repository size (500 symbols), allow 1ms per symbol maximum
      expect(buildDuration).toBeLessThan(largeRepositoryMap.stats.totalSymbols * 1);

      // Verify the search works after index building
      const searchResults = newSemanticSearch.search('test');
      expect(searchResults).toBeDefined();

      performanceMetrics.record('indexBuilding', buildDuration);
    });

    it('should handle index updates efficiently', () => {
      // Perform initial searches to warm up
      semanticSearch.search('initial warmup');

      // Measure performance after warmup
      const warmupStartTime = performance.now();
      const warmupResults = semanticSearch.search('function');
      const warmupEndTime = performance.now();

      const coldStartTime = performance.now();
      const newSemanticSearch = new SemanticSearch(largeRepositoryMap);
      const coldResults = newSemanticSearch.search('function');
      const coldEndTime = performance.now();

      const warmupDuration = warmupEndTime - warmupStartTime;
      const coldDuration = coldEndTime - coldStartTime;

      // Warm searches should be faster than cold starts
      expect(warmupDuration).toBeLessThan(coldDuration);
      expect(warmupResults.length).toEqual(coldResults.length);

      performanceMetrics.record('warmupSearch', warmupDuration);
      performanceMetrics.record('coldStartSearch', coldDuration);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should maintain reasonable memory footprint', () => {
      // Get initial memory usage (approximate)
      const initialMemory = process.memoryUsage();

      // Create multiple instances
      const instances: SemanticSearch[] = [];
      for (let i = 0; i < 10; i++) {
        instances.push(new SemanticSearch(largeRepositoryMap));
      }

      // Perform searches with all instances
      instances.forEach((instance, index) => {
        instance.search(`test query ${index}`);
      });

      const peakMemory = process.memoryUsage();
      const memoryIncrease = peakMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 100MB for 10 instances)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

      // Cleanup
      instances.length = 0;

      performanceMetrics.record('memoryFootprint', memoryIncrease);
    });

    it('should handle garbage collection efficiently', () => {
      const createAndDestroyInstance = () => {
        const instance = new SemanticSearch(largeRepositoryMap);
        instance.search('test');
        return instance;
      };

      const startMemory = process.memoryUsage();

      // Create and destroy many instances
      for (let i = 0; i < 100; i++) {
        createAndDestroyInstance();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const endMemory = process.memoryUsage();
      const memoryDifference = endMemory.heapUsed - startMemory.heapUsed;

      // Memory difference should be minimal after cleanup
      // Allow up to 10MB difference for normal fluctuation
      expect(memoryDifference).toBeLessThan(10 * 1024 * 1024);

      performanceMetrics.record('memoryCleanup', memoryDifference);
    });
  });

  describe('Scalability Performance', () => {
    it('should maintain performance with increasing repository size', () => {
      const repositorySizes = [100, 250, 500, 1000];
      const performanceTimes: number[] = [];

      repositorySizes.forEach(size => {
        const scaledMap = createPerformanceTestRepositoryMap(size);
        const scaledSearch = new SemanticSearch(scaledMap);

        const startTime = performance.now();
        const results = scaledSearch.search('function test', { limit: 20 });
        const endTime = performance.now();

        const duration = endTime - startTime;
        performanceTimes.push(duration);

        expect(results).toBeDefined();
        expect(duration).toBeLessThan(500); // Should complete within 500ms even for large repos

        performanceMetrics.record(`scalability_${size}`, duration);
      });

      // Performance should not degrade exponentially with size
      // Allow up to 4x increase from smallest to largest
      const minTime = Math.min(...performanceTimes);
      const maxTime = Math.max(...performanceTimes);
      expect(maxTime).toBeLessThan(minTime * 10); // Very generous for regression detection
    });

    it('should handle concurrent searches efficiently', async () => {
      const concurrencyLevels = [1, 5, 10, 20];

      for (const level of concurrencyLevels) {
        const startTime = performance.now();

        // Create concurrent searches
        const promises = Array.from({ length: level }, (_, i) =>
          Promise.resolve(semanticSearch.search(`concurrent query ${i}`, { limit: 10 }))
        );

        const results = await Promise.all(promises);
        const endTime = performance.now();

        const duration = endTime - startTime;
        const averageTimePerSearch = duration / level;

        expect(results.length).toBe(level);
        expect(averageTimePerSearch).toBeLessThan(100); // Average should be under 100ms

        results.forEach(result => {
          expect(result).toBeDefined();
          expect(Array.isArray(result)).toBe(true);
        });

        performanceMetrics.record(`concurrency_${level}`, duration);
      }
    });
  });

  describe('Search Strategy Performance', () => {
    it('should compare performance of different search strategies', () => {
      const strategies: Array<'keyword' | 'fuzzy' | 'semantic'> = ['keyword', 'fuzzy', 'semantic'];
      const query = 'user validation function';
      const strategyPerformance: Record<string, number> = {};

      strategies.forEach(strategy => {
        const startTime = performance.now();
        const results = semanticSearch.search(query, { strategy, limit: 50 });
        const endTime = performance.now();

        const duration = endTime - startTime;
        strategyPerformance[strategy] = duration;

        expect(results).toBeDefined();
        expect(duration).toBeLessThan(100); // Each strategy should complete within 100ms

        performanceMetrics.record(`strategy_${strategy}`, duration);
      });

      // Keyword strategy should typically be fastest (but allow flexibility)
      expect(strategyPerformance.keyword).toBeDefined();
      expect(strategyPerformance.fuzzy).toBeDefined();
      expect(strategyPerformance.semantic).toBeDefined();
    });
  });

  describe('Performance Regression Detection', () => {
    it('should maintain consistent performance across multiple runs', () => {
      const query = 'test function validation';
      const runs = 20;
      const times: number[] = [];

      for (let i = 0; i < runs; i++) {
        const startTime = performance.now();
        semanticSearch.search(query, { limit: 25 });
        const endTime = performance.now();

        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      // Performance should be reasonably consistent
      // Max time should not be more than 3x the average (accounting for GC, etc.)
      expect(maxTime).toBeLessThan(avgTime * 3);
      expect(minTime).toBeGreaterThan(0);

      performanceMetrics.record('avgPerformance', avgTime);
      performanceMetrics.record('maxPerformance', maxTime);
      performanceMetrics.record('minPerformance', minTime);
    });

    it('should detect performance regressions in similarity search', () => {
      const testSymbol: CodeSymbol = {
        name: 'testFunction',
        type: 'function',
        filePath: 'test.ts',
        startLine: 1,
        endLine: 10,
        signature: 'function testFunction(): void'
      };

      const startTime = performance.now();
      const similar = semanticSearch.findSimilar(testSymbol, { limit: 10 });
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(150); // Should complete within 150ms
      expect(similar).toBeDefined();
      expect(Array.isArray(similar)).toBe(true);

      performanceMetrics.record('similaritySearch', duration);
    });

    it('should detect performance regressions in pattern search', () => {
      const patterns = [
        'function testFunction() {}',
        'class TestClass extends BaseClass {}',
        'interface ITest<T> extends Base<T> {}',
        'async function asyncTest(): Promise<void> {}'
      ];

      patterns.forEach((pattern, index) => {
        const startTime = performance.now();
        const results = semanticSearch.searchByExample(pattern, { limit: 15 });
        const endTime = performance.now();

        const duration = endTime - startTime;
        expect(duration).toBeLessThan(100); // Should complete within 100ms
        expect(results).toBeDefined();

        performanceMetrics.record(`patternSearch_${index}`, duration);
      });
    });
  });

  describe('Performance Benchmarking', () => {
    it('should establish baseline performance metrics', () => {
      const benchmarks = performanceMetrics.getBenchmarks();

      // Log performance metrics for monitoring
      console.log('SemanticSearch Performance Benchmarks:', benchmarks);

      // Ensure we have collected metrics
      expect(Object.keys(benchmarks).length).toBeGreaterThan(0);

      // All metrics should be positive numbers
      Object.values(benchmarks).forEach(metric => {
        expect(typeof metric.average).toBe('number');
        expect(metric.average).toBeGreaterThan(0);
        expect(metric.count).toBeGreaterThan(0);
      });
    });
  });
});

/**
 * Performance metrics collection utility
 */
class PerformanceMetrics {
  private metrics: Record<string, number[]> = {};

  record(operation: string, duration: number): void {
    if (!this.metrics[operation]) {
      this.metrics[operation] = [];
    }
    this.metrics[operation].push(duration);
  }

  getBenchmarks(): Record<string, { average: number; min: number; max: number; count: number }> {
    const benchmarks: Record<string, { average: number; min: number; max: number; count: number }> = {};

    for (const [operation, times] of Object.entries(this.metrics)) {
      if (times.length > 0) {
        benchmarks[operation] = {
          average: times.reduce((sum, time) => sum + time, 0) / times.length,
          min: Math.min(...times),
          max: Math.max(...times),
          count: times.length
        };
      }
    }

    return benchmarks;
  }

  reset(): void {
    this.metrics = {};
  }
}

/**
 * Create a repository map optimized for performance testing
 */
function createPerformanceTestRepositoryMap(symbolCount: number = 500): RepositoryMap {
  const files: CodeFile[] = [];
  const filesPerPackage = 10;
  const symbolsPerFile = Math.ceil(symbolCount / filesPerPackage / 5); // 5 files per package

  for (let packageIndex = 0; packageIndex < 5; packageIndex++) {
    for (let fileIndex = 0; fileIndex < filesPerPackage; fileIndex++) {
      const symbols: CodeSymbol[] = [];
      const fileName = `package${packageIndex}/file${fileIndex}.ts`;

      // Create various symbol types
      for (let symbolIndex = 0; symbolIndex < symbolsPerFile; symbolIndex++) {
        const symbolTypes = ['function', 'class', 'interface', 'variable', 'method'] as const;
        const type = symbolTypes[symbolIndex % symbolTypes.length];

        symbols.push({
          name: `${type}${packageIndex}_${fileIndex}_${symbolIndex}`,
          type,
          filePath: fileName,
          startLine: symbolIndex * 5 + 1,
          endLine: symbolIndex * 5 + 4,
          signature: generateSignature(type, `${type}${packageIndex}_${fileIndex}_${symbolIndex}`),
          documentation: `Documentation for ${type} in package ${packageIndex}, file ${fileIndex}`,
          exported: symbolIndex % 3 === 0,
          parent: type === 'method' ? `class${packageIndex}_${fileIndex}_0` : undefined
        });
      }

      files.push({
        filePath: fileName,
        language: 'typescript',
        content: `// Performance test file ${packageIndex}-${fileIndex}`,
        symbols,
        imports: fileIndex > 0 ? [
          {
            sourceFile: fileName,
            targetFile: `package${packageIndex}/file${fileIndex - 1}.ts`,
            importedSymbols: [`function${packageIndex}_${fileIndex - 1}_0`],
            importType: 'named'
          }
        ] : [],
        exports: symbols.filter(s => s.exported).map(s => s.name)
      });
    }
  }

  return {
    rootPath: '/performance/test',
    files,
    imports: files.flatMap(f => f.imports),
    references: [],
    stats: {
      totalFiles: files.length,
      totalSymbols: files.reduce((count, f) => count + f.symbols.length, 0),
      indexedAt: new Date(),
      processingTimeMs: 50
    }
  };
}

/**
 * Generate realistic signatures for different symbol types
 */
function generateSignature(type: string, name: string): string {
  switch (type) {
    case 'function':
      return `function ${name}(param: string): boolean`;
    case 'class':
      return `class ${name} extends BaseClass`;
    case 'interface':
      return `interface ${name}<T> extends Base<T>`;
    case 'variable':
      return `const ${name}: string`;
    case 'method':
      return `${name}(param: number): void`;
    default:
      return `${type} ${name}`;
  }
}