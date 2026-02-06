/**
 * @fileoverview Performance and Load Tests for Browser State Fixtures
 *
 * This test suite validates the performance characteristics and scalability
 * of the browser state fixtures API under various load conditions. It ensures
 * the API can handle realistic usage patterns efficiently.
 *
 * Performance Test Categories:
 * - Memory usage and garbage collection
 * - Large dataset handling
 * - Concurrent operations
 * - Builder pattern efficiency
 * - State transformation performance
 * - Edge case performance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  browserFixtures,
  browserHelpers,
  BrowserStateBuilder,
  createBrowserState,
} from '../browser-fixtures.js';
import type { BrowserState } from '../types.js';

describe('Browser State Fixtures - Performance Tests', () => {
  let performanceStart: number;
  let memoryBefore: number;

  beforeEach(() => {
    performanceStart = performance.now();
    // Note: In Node.js environment, process.memoryUsage() is available
    // In browser environment, performance.memory might be available
    memoryBefore = process.memoryUsage().heapUsed;
  });

  afterEach(() => {
    const performanceEnd = performance.now();
    const memoryAfter = process.memoryUsage().heapUsed;
    const executionTime = performanceEnd - performanceStart;
    const memoryDelta = memoryAfter - memoryBefore;

    // Log performance metrics for analysis
    console.log(`Execution time: ${executionTime.toFixed(2)}ms, Memory delta: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
  });

  describe('Large Dataset Performance', () => {
    it('should handle large numbers of console messages efficiently', () => {
      const messageCount = 10000;
      let state = browserFixtures.cleanState();

      const startTime = performance.now();

      // Add many console messages
      for (let i = 0; i < messageCount; i++) {
        state = browserHelpers.addConsoleMessage(
          state,
          i % 2 === 0 ? 'info' : 'log',
          `Message ${i}: ${Math.random().toString(36)}`
        );
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Verify state integrity
      expect(state.consoleMessages).toHaveLength(messageCount);
      expect(state.consoleMessages[0].message).toBe('Message 0: ' + expect.any(String));
      expect(state.consoleMessages[messageCount - 1].message).toContain(`Message ${messageCount - 1}:`);

      // Performance assertions
      expect(executionTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(state.consoleMessages.every(msg => msg.timestamp instanceof Date)).toBe(true);

      console.log(`Added ${messageCount} console messages in ${executionTime.toFixed(2)}ms`);
    });

    it('should handle large numbers of network requests efficiently', () => {
      const requestCount = 10000;
      let state = browserFixtures.cleanState();

      const startTime = performance.now();

      // Add many network requests
      for (let i = 0; i < requestCount; i++) {
        state = browserHelpers.addNetworkRequest(
          state,
          `https://api${i % 10}.example.com/endpoint/${i}`,
          i % 3 === 0 ? 'POST' : 'GET',
          200 + (i % 100),
          i % 5 === 0 ? { 'Content-Type': 'application/json' } : undefined
        );
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Verify state integrity
      expect(state.networkRequests).toHaveLength(requestCount);
      expect(state.networkRequests[0].url).toBe('https://api0.example.com/endpoint/0');
      expect(state.networkRequests[requestCount - 1].url).toBe(`https://api${(requestCount - 1) % 10}.example.com/endpoint/${requestCount - 1}`);

      // Performance assertions
      expect(executionTime).toBeLessThan(5000); // Should complete in under 5 seconds

      console.log(`Added ${requestCount} network requests in ${executionTime.toFixed(2)}ms`);
    });

    it('should handle large storage datasets efficiently', () => {
      const keyCount = 10000;
      let state = browserFixtures.cleanState();

      const startTime = performance.now();

      // Add many localStorage entries
      for (let i = 0; i < keyCount; i++) {
        const key = `key${i}`;
        const value = `value${i}_${'x'.repeat(100)}`; // 100+ char values
        state = browserHelpers.setLocalStorage(state, key, value);
      }

      // Add many sessionStorage entries
      for (let i = 0; i < keyCount; i++) {
        const key = `sessionKey${i}`;
        const value = JSON.stringify({
          id: i,
          data: 'x'.repeat(50),
          timestamp: new Date().toISOString()
        });
        state = browserHelpers.setSessionStorage(state, key, value);
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Verify state integrity
      expect(Object.keys(state.localStorage)).toHaveLength(keyCount);
      expect(Object.keys(state.sessionStorage)).toHaveLength(keyCount);
      expect(state.localStorage.key0).toBe('value0_' + 'x'.repeat(100));
      expect(state.sessionStorage[`sessionKey${keyCount - 1}`]).toContain(`"id":${keyCount - 1}`);

      // Performance assertions
      expect(executionTime).toBeLessThan(3000); // Should complete in under 3 seconds

      console.log(`Added ${keyCount * 2} storage entries in ${executionTime.toFixed(2)}ms`);
    });

    it('should handle large numbers of cookies efficiently', () => {
      const cookieCount = 1000; // Reasonable cookie limit
      let state = browserFixtures.cleanState();

      const startTime = performance.now();

      // Add many cookies with different configurations
      for (let i = 0; i < cookieCount; i++) {
        state = browserHelpers.addCookie(
          state,
          `cookie${i}`,
          `value${i}_${Math.random().toString(36)}`,
          i % 3 === 0 ? { domain: `domain${i % 5}.com`, path: `/path${i % 10}` } : {}
        );
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Verify state integrity
      expect(state.cookies).toHaveLength(cookieCount);
      expect(state.cookies[0].name).toBe('cookie0');
      expect(state.cookies[cookieCount - 1].name).toBe(`cookie${cookieCount - 1}`);

      // Check domain/path variations
      const customDomainCookies = state.cookies.filter(c => c.domain !== 'localhost');
      expect(customDomainCookies.length).toBeGreaterThan(0);

      // Performance assertions
      expect(executionTime).toBeLessThan(1000); // Should complete in under 1 second

      console.log(`Added ${cookieCount} cookies in ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Builder Pattern Performance', () => {
    it('should efficiently build complex states with BrowserStateBuilder', () => {
      const buildCount = 1000;
      const states: BrowserState[] = [];

      const startTime = performance.now();

      // Build many complex states
      for (let i = 0; i < buildCount; i++) {
        const state = new BrowserStateBuilder()
          .withUrl(`https://example${i}.com/page`)
          .withTitle(`Page ${i}`)
          .withLoading(i % 2 === 0)
          .withError(i % 5 === 0)
          .withAuth(i % 3 === 0)
          .withLocalStorage({
            [`key${i}`]: `value${i}`,
            [`timestamp${i}`]: new Date().toISOString()
          })
          .withSessionStorage({
            [`sessionId${i}`]: `sess_${i}`,
            [`data${i}`]: JSON.stringify({ index: i, random: Math.random() })
          })
          .withConsoleMessages([
            { type: 'info', message: `Info message ${i}` },
            { type: 'log', message: `Log message ${i}` }
          ])
          .withNetworkRequests([
            { url: `https://api.example.com/data/${i}`, method: 'GET', status: 200 },
            { url: `https://api.example.com/update/${i}`, method: 'POST', status: 201 }
          ])
          .build();

        states.push(state);
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Verify state integrity
      expect(states).toHaveLength(buildCount);
      expect(states[0].url).toBe('https://example0.com/page');
      expect(states[buildCount - 1].url).toBe(`https://example${buildCount - 1}.com/page`);

      // Verify independence (should be different objects)
      expect(states[0]).not.toBe(states[1]);
      expect(states[0].localStorage).not.toBe(states[1].localStorage);

      // Performance assertions
      expect(executionTime).toBeLessThan(3000); // Should complete in under 3 seconds

      console.log(`Built ${buildCount} complex states in ${executionTime.toFixed(2)}ms`);
    });

    it('should efficiently create states with createBrowserState factory', () => {
      const createCount = 1000;
      const builders: BrowserStateBuilder[] = [];

      const startTime = performance.now();

      // Create many builders
      for (let i = 0; i < createCount; i++) {
        const builder = createBrowserState({
          url: `https://factory${i}.com`,
          isAuthenticated: i % 2 === 0
        });

        builders.push(builder);
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Verify builders
      expect(builders).toHaveLength(createCount);
      expect(builders[0]).toBeInstanceOf(BrowserStateBuilder);
      expect(builders[0]).not.toBe(builders[1]);

      // Performance assertions
      expect(executionTime).toBeLessThan(1000); // Should complete in under 1 second

      console.log(`Created ${createCount} builders in ${executionTime.toFixed(2)}ms`);
    });

    it('should efficiently handle builder reuse and modification', () => {
      const modificationCount = 10000;
      const builder = new BrowserStateBuilder();

      const startTime = performance.now();

      // Rapidly modify and build
      for (let i = 0; i < modificationCount; i++) {
        builder
          .withUrl(`https://test${i % 100}.com`)
          .withLoading(i % 2 === 0)
          .withAuth(i % 3 === 0);

        if (i % 10 === 0) {
          const state = builder.build();
          expect(state.url).toBe(`https://test${i % 100}.com`);
        }
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Performance assertions
      expect(executionTime).toBeLessThan(2000); // Should complete in under 2 seconds

      console.log(`Performed ${modificationCount} builder modifications in ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Efficiency Tests', () => {
    it('should not leak memory with repeated state creation', () => {
      const iterationCount = 1000;
      const memoryBefore = process.memoryUsage().heapUsed;

      // Create and discard many states
      for (let i = 0; i < iterationCount; i++) {
        const state = browserFixtures.loggedInPage({
          url: `https://test${i}.com`,
          localStorage: { [`key${i}`]: `value${i}` }
        });

        // Use state to prevent optimization
        expect(state.url).toBe(`https://test${i}.com`);

        // Occasionally force garbage collection
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      // Force final garbage collection
      if (global.gc) {
        global.gc();
      }

      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryAfter - memoryBefore;

      // Memory increase should be reasonable (less than 100MB for 1000 iterations)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB for ${iterationCount} iterations`);
    });

    it('should efficiently handle deep state copying in helpers', () => {
      // Create a state with complex nested data
      let state = browserFixtures.loggedInPage();

      // Add complex data structures
      const complexData = {
        largeArray: Array(1000).fill(0).map((_, i) => ({ id: i, data: `item${i}` })),
        nestedObject: {
          level1: {
            level2: {
              level3: {
                data: 'deeply nested',
                array: Array(100).fill('nested data')
              }
            }
          }
        }
      };

      state = browserHelpers.setLocalStorage(state, 'complex-data', JSON.stringify(complexData));

      const transformationCount = 100;
      const startTime = performance.now();

      // Perform many transformations
      for (let i = 0; i < transformationCount; i++) {
        state = browserHelpers.addConsoleMessage(state, 'info', `Iteration ${i}`);
        state = browserHelpers.addNetworkRequest(state, `https://api.com/${i}`, 'GET', 200);
        state = browserHelpers.setSessionStorage(state, `iter${i}`, `data${i}`);
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Verify final state
      expect(state.consoleMessages).toHaveLength(2 + transformationCount); // Original 2 + added
      expect(state.networkRequests).toHaveLength(2 + transformationCount); // Original 2 + added
      expect(Object.keys(state.sessionStorage)).toHaveLength(2 + transformationCount); // Original 2 + added
      expect(state.localStorage['complex-data']).toBe(JSON.stringify(complexData));

      // Performance assertions
      expect(executionTime).toBeLessThan(1000); // Should complete in under 1 second

      console.log(`Performed ${transformationCount} transformations with complex data in ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Concurrent Operation Performance', () => {
    it('should handle parallel state creation efficiently', async () => {
      const parallelCount = 100;
      const operationsPerTask = 50;

      const startTime = performance.now();

      // Create multiple promises that each perform many operations
      const promises = Array(parallelCount).fill(0).map(async (_, taskIndex) => {
        let state = browserFixtures.cleanState({
          url: `https://task${taskIndex}.com`
        });

        for (let i = 0; i < operationsPerTask; i++) {
          state = browserHelpers.addConsoleMessage(state, 'info', `Task ${taskIndex}, Op ${i}`);
          state = browserHelpers.setLocalStorage(state, `key${i}`, `value${taskIndex}_${i}`);
        }

        return state;
      });

      // Wait for all operations to complete
      const results = await Promise.all(promises);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Verify results
      expect(results).toHaveLength(parallelCount);
      results.forEach((state, index) => {
        expect(state.url).toBe(`https://task${index}.com`);
        expect(state.consoleMessages).toHaveLength(operationsPerTask);
        expect(Object.keys(state.localStorage)).toHaveLength(operationsPerTask);
      });

      // Performance assertions
      expect(executionTime).toBeLessThan(2000); // Should complete in under 2 seconds

      console.log(`Completed ${parallelCount} parallel tasks (${parallelCount * operationsPerTask} total operations) in ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Stress Testing', () => {
    it('should handle extreme builder chaining without performance degradation', () => {
      const chainLength = 1000;
      let builder = new BrowserStateBuilder();

      const startTime = performance.now();

      // Create extremely long chain
      for (let i = 0; i < chainLength; i++) {
        builder = builder
          .withLocalStorage({ [`chain${i}`]: `value${i}` })
          .withSessionStorage({ [`session${i}`]: `data${i}` })
          .withConsoleMessages([{ type: 'log', message: `Chain link ${i}` }]);
      }

      const state = builder.build();

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Verify final state has accumulated all data
      expect(Object.keys(state.localStorage)).toHaveLength(chainLength);
      expect(Object.keys(state.sessionStorage)).toHaveLength(chainLength);
      expect(state.consoleMessages).toHaveLength(chainLength);

      // Verify data integrity
      expect(state.localStorage.chain0).toBe('value0');
      expect(state.localStorage[`chain${chainLength - 1}`]).toBe(`value${chainLength - 1}`);

      // Performance assertions
      expect(executionTime).toBeLessThan(1000); // Should complete in under 1 second

      console.log(`Completed chain of ${chainLength} operations in ${executionTime.toFixed(2)}ms`);
    });

    it('should maintain performance with mixed operations at scale', () => {
      const operationCount = 5000;
      const operations = ['console', 'network', 'localStorage', 'sessionStorage', 'cookie', 'navigate'];
      let state = browserFixtures.cleanState();

      const startTime = performance.now();

      // Perform mixed operations
      for (let i = 0; i < operationCount; i++) {
        const operation = operations[i % operations.length];

        switch (operation) {
          case 'console':
            state = browserHelpers.addConsoleMessage(state, 'info', `Operation ${i}`);
            break;
          case 'network':
            state = browserHelpers.addNetworkRequest(state, `https://api${i % 10}.com/${i}`, 'GET', 200);
            break;
          case 'localStorage':
            state = browserHelpers.setLocalStorage(state, `local${i}`, `value${i}`);
            break;
          case 'sessionStorage':
            state = browserHelpers.setSessionStorage(state, `session${i}`, `data${i}`);
            break;
          case 'cookie':
            state = browserHelpers.addCookie(state, `cookie${i}`, `value${i}`);
            break;
          case 'navigate':
            state = browserHelpers.navigateTo(state, `https://page${i % 5}.com`, `Page ${i}`);
            break;
        }
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Verify mixed operations were applied
      const expectedCountPerOperation = operationCount / operations.length;
      expect(state.consoleMessages.length).toBeCloseTo(expectedCountPerOperation, -1);
      expect(state.networkRequests.length).toBeCloseTo(expectedCountPerOperation, -1);
      expect(Object.keys(state.localStorage).length).toBeCloseTo(expectedCountPerOperation, -1);
      expect(Object.keys(state.sessionStorage).length).toBeCloseTo(expectedCountPerOperation, -1);
      expect(state.cookies.length).toBeCloseTo(expectedCountPerOperation, -1);

      // Performance assertions
      expect(executionTime).toBeLessThan(3000); // Should complete in under 3 seconds

      console.log(`Completed ${operationCount} mixed operations in ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Edge Case Performance', () => {
    it('should handle empty operations efficiently', () => {
      const emptyOperationCount = 10000;
      let state = browserFixtures.cleanState();

      const startTime = performance.now();

      // Perform many operations with empty data
      for (let i = 0; i < emptyOperationCount; i++) {
        state = browserHelpers.addConsoleMessage(state, 'info', '');
        state = browserHelpers.setLocalStorage(state, '', '');
        state = browserHelpers.setSessionStorage(state, `empty${i}`, '');
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Verify operations were performed
      expect(state.consoleMessages).toHaveLength(emptyOperationCount);
      expect(state.localStorage['']).toBe('');
      expect(Object.keys(state.sessionStorage)).toHaveLength(emptyOperationCount);

      // Performance assertions
      expect(executionTime).toBeLessThan(2000); // Should complete in under 2 seconds

      console.log(`Performed ${emptyOperationCount} empty operations in ${executionTime.toFixed(2)}ms`);
    });

    it('should handle rapid clear operations efficiently', () => {
      const clearCycleCount = 100;
      let state = browserFixtures.loggedInPage(); // Start with data

      const startTime = performance.now();

      // Repeatedly clear and repopulate
      for (let i = 0; i < clearCycleCount; i++) {
        // Add some data
        state = browserHelpers.setLocalStorage(state, `cycle${i}`, `data${i}`);
        state = browserHelpers.addConsoleMessage(state, 'info', `Cycle ${i}`);
        state = browserHelpers.addNetworkRequest(state, `https://api.com/${i}`, 'GET', 200);

        // Clear it
        state = browserHelpers.clearBrowserData(state);
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Verify final state is clean
      expect(state.localStorage).toEqual({});
      expect(state.sessionStorage).toEqual({});
      expect(state.cookies).toEqual([]);
      expect(state.consoleMessages).toEqual([]);
      expect(state.networkRequests).toEqual([]);

      // Performance assertions
      expect(executionTime).toBeLessThan(500); // Should complete in under 0.5 seconds

      console.log(`Performed ${clearCycleCount} clear cycles in ${executionTime.toFixed(2)}ms`);
    });
  });
});

/**
 * Performance utility functions for additional testing
 */
export const performanceUtils = {
  /**
   * Measures execution time of a function
   */
  measureTime: <T>(fn: () => T): { result: T; time: number } => {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    return { result, time: end - start };
  },

  /**
   * Measures memory usage of a function
   */
  measureMemory: <T>(fn: () => T): { result: T; memoryDelta: number } => {
    const memBefore = process.memoryUsage().heapUsed;
    const result = fn();
    const memAfter = process.memoryUsage().heapUsed;
    return { result, memoryDelta: memAfter - memBefore };
  },

  /**
   * Runs a function multiple times and returns average performance
   */
  benchmark: <T>(fn: () => T, iterations: number = 100): { averageTime: number; results: T[] } => {
    const times: number[] = [];
    const results: T[] = [];

    for (let i = 0; i < iterations; i++) {
      const { result, time } = performanceUtils.measureTime(fn);
      times.push(time);
      results.push(result);
    }

    const averageTime = times.reduce((sum, time) => sum + time, 0) / iterations;
    return { averageTime, results };
  }
};