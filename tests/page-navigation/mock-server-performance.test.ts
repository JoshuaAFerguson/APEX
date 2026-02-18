/**
 * @fileoverview Performance and Stress Tests for Enhanced Mock Server
 *
 * This test suite focuses on performance characteristics, load handling,
 * and stress testing of the enhanced mock server implementation.
 *
 * Test categories:
 * - Response time benchmarks
 * - Concurrent request handling
 * - Memory usage monitoring
 * - Throughput testing
 * - Resource cleanup verification
 * - Scaling behavior validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockNavigationServer, MockServerLifecycle } from './mock-server';

describe('Enhanced Mock Server - Performance Testing', () => {

  describe('Response Time Benchmarks', () => {
    let mockServer: MockNavigationServer;

    beforeEach(async () => {
      mockServer = new MockNavigationServer({
        verbose: false,
        baseDelay: 0 // No artificial delay for performance tests
      });
      await mockServer.start();
    });

    afterEach(async () => {
      if (mockServer && mockServer.isRunning) {
        await mockServer.stop();
      }
    });

    it('should respond to simple requests within acceptable time limits', async () => {
      const measurements: number[] = [];

      // Take multiple measurements for reliability
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        const response = await fetch(`${mockServer.baseUrl}/`);
        const responseTime = Date.now() - startTime;

        expect(response.status).toBe(200);
        measurements.push(responseTime);
      }

      const averageTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const maxTime = Math.max(...measurements);

      // Performance expectations
      expect(averageTime).toBeLessThan(100); // Average under 100ms
      expect(maxTime).toBeLessThan(250); // No single request over 250ms

      console.log(`📊 Simple request performance: avg=${averageTime.toFixed(1)}ms, max=${maxTime}ms`);
    });

    it('should handle JSON responses efficiently', async () => {
      const measurements: number[] = [];

      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        const response = await fetch(`${mockServer.baseUrl}/api/data`);
        await response.json(); // Parse JSON to measure complete processing
        const totalTime = Date.now() - startTime;

        expect(response.status).toBe(200);
        measurements.push(totalTime);
      }

      const averageTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;

      expect(averageTime).toBeLessThan(150); // JSON responses should be fast

      console.log(`📊 JSON response performance: avg=${averageTime.toFixed(1)}ms`);
    });

    it('should handle static HTML responses efficiently', async () => {
      const pageTests = ['/page1', '/page2', '/page3'];
      const allMeasurements: number[] = [];

      for (const path of pageTests) {
        for (let i = 0; i < 5; i++) {
          const startTime = Date.now();
          const response = await fetch(`${mockServer.baseUrl}${path}`);
          await response.text(); // Parse HTML to measure complete processing
          const totalTime = Date.now() - startTime;

          expect(response.status).toBe(200);
          allMeasurements.push(totalTime);
        }
      }

      const averageTime = allMeasurements.reduce((a, b) => a + b, 0) / allMeasurements.length;

      expect(averageTime).toBeLessThan(120); // HTML pages should be fast

      console.log(`📊 HTML page performance: avg=${averageTime.toFixed(1)}ms across ${pageTests.length} pages`);
    });

    it('should handle error responses quickly', async () => {
      const errorPaths = ['/error', '/404', '/forbidden', '/nonexistent'];
      const measurements: number[] = [];

      for (const path of errorPaths) {
        const startTime = Date.now();
        const response = await fetch(`${mockServer.baseUrl}${path}`);
        const responseTime = Date.now() - startTime;

        expect(response.status).toBeGreaterThan(399); // Should be error status
        measurements.push(responseTime);
      }

      const averageTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;

      expect(averageTime).toBeLessThan(100); // Error responses should be very fast

      console.log(`📊 Error response performance: avg=${averageTime.toFixed(1)}ms`);
    });
  });

  describe('Concurrent Request Handling', () => {
    let mockServer: MockNavigationServer;

    beforeEach(async () => {
      mockServer = new MockNavigationServer({
        verbose: false,
        baseDelay: 10 // Small delay to test concurrency
      });
      await mockServer.start();
    });

    afterEach(async () => {
      if (mockServer && mockServer.isRunning) {
        await mockServer.stop();
      }
    });

    it('should handle moderate concurrent load effectively', async () => {
      const concurrentRequests = 25;
      const startTime = Date.now();

      // Create concurrent requests
      const requests = Array.from({ length: concurrentRequests }, (_, i) =>
        fetch(`${mockServer.baseUrl}/page${(i % 3) + 1}`)
      );

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      expect(responses.every(r => r.status === 200)).toBe(true);

      // Should complete in reasonable time considering concurrency
      expect(totalTime).toBeLessThan(2000); // Under 2 seconds for 25 requests

      console.log(`📊 Concurrent requests (${concurrentRequests}): ${totalTime}ms total`);
    });

    it('should handle high concurrent load with mixed endpoints', async () => {
      const concurrentRequests = 50;
      const endpoints = ['/', '/page1', '/api/data', '/error', '/slow'];

      const startTime = Date.now();

      // Create mixed concurrent requests
      const requests = Array.from({ length: concurrentRequests }, (_, i) => {
        const endpoint = endpoints[i % endpoints.length];
        return fetch(`${mockServer.baseUrl}${endpoint}`);
      });

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // Verify response distribution
      const statusCounts = responses.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      expect(responses.length).toBe(concurrentRequests);
      expect(Object.keys(statusCounts).length).toBeGreaterThan(1); // Should have mixed status codes

      console.log(`📊 High concurrent load (${concurrentRequests}): ${totalTime}ms, status distribution:`, statusCounts);
    }, 10000);

    it('should maintain response quality under sustained load', async () => {
      const batchSize = 20;
      const batches = 5;
      const allResponseTimes: number[] = [];

      for (let batch = 0; batch < batches; batch++) {
        const batchStartTime = Date.now();

        const requests = Array.from({ length: batchSize }, () =>
          fetch(`${mockServer.baseUrl}/`)
        );

        const responses = await Promise.all(requests);
        const batchTime = Date.now() - batchStartTime;

        // All should succeed
        expect(responses.every(r => r.status === 200)).toBe(true);

        allResponseTimes.push(batchTime);

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const averageBatchTime = allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length;

      // Performance should remain consistent across batches
      const maxVariation = Math.max(...allResponseTimes) - Math.min(...allResponseTimes);
      expect(maxVariation).toBeLessThan(1000); // Less than 1s variation

      console.log(`📊 Sustained load (${batches} batches of ${batchSize}): avg=${averageBatchTime.toFixed(1)}ms/batch`);
    }, 15000);
  });

  describe('Memory Usage and Resource Management', () => {
    it('should not accumulate memory leaks during normal operation', async () => {
      const server = new MockNavigationServer();
      await server.start();

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        const response = await fetch(`${server.baseUrl}/`);
        await response.text();

        // Add and remove dynamic scenarios
        server.addScenario({
          name: `temp-${i}`,
          path: `/temp-${i}`,
          body: `Temporary content ${i}`
        });
        server.removeScenario(`/temp-${i}`);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      await new Promise(resolve => setTimeout(resolve, 100)); // Allow cleanup

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      await server.stop();

      // Memory growth should be reasonable (under 5MB)
      expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024);

      console.log(`📊 Memory usage: ${(memoryGrowth / 1024).toFixed(1)}KB growth after 100 operations`);
    });

    it('should clean up resources properly on server stop', async () => {
      const servers: MockNavigationServer[] = [];

      // Create multiple servers
      for (let i = 0; i < 5; i++) {
        const server = new MockNavigationServer();
        await server.start();
        servers.push(server);

        // Make some requests
        const response = await fetch(`${server.baseUrl}/`);
        expect(response.status).toBe(200);
      }

      // Stop all servers
      for (const server of servers) {
        await server.stop();
        expect(server.isRunning).toBe(false);
      }

      // Servers should not interfere after stopping
      for (const server of servers) {
        expect(() => server.port).toThrow('not running');
        expect(() => server.baseUrl).toThrow('not running');
      }
    });
  });

  describe('Throughput Testing', () => {
    let mockServer: MockNavigationServer;

    beforeEach(async () => {
      mockServer = new MockNavigationServer({
        verbose: false,
        baseDelay: 0
      });
      await mockServer.start();
    });

    afterEach(async () => {
      if (mockServer && mockServer.isRunning) {
        await mockServer.stop();
      }
    });

    it('should achieve reasonable requests per second rate', async () => {
      const testDurationMs = 2000; // 2 second test
      const startTime = Date.now();
      let requestCount = 0;
      let successCount = 0;

      // Make requests continuously for the test duration
      while (Date.now() - startTime < testDurationMs) {
        try {
          const response = await fetch(`${mockServer.baseUrl}/`);
          requestCount++;
          if (response.status === 200) {
            successCount++;
          }
        } catch (error) {
          requestCount++;
          // Count failed requests but continue
        }
      }

      const actualDuration = Date.now() - startTime;
      const requestsPerSecond = (requestCount / actualDuration) * 1000;
      const successRate = (successCount / requestCount) * 100;

      // Performance expectations
      expect(requestsPerSecond).toBeGreaterThan(50); // At least 50 RPS
      expect(successRate).toBeGreaterThan(95); // At least 95% success rate

      console.log(`📊 Throughput: ${requestsPerSecond.toFixed(1)} RPS, ${successRate.toFixed(1)}% success rate`);
    });

    it('should handle burst traffic patterns effectively', async () => {
      const burstSizes = [10, 25, 50, 25, 10]; // Simulated traffic pattern
      const burstResults: Array<{ size: number; time: number; successRate: number }> = [];

      for (const burstSize of burstSizes) {
        const startTime = Date.now();

        const requests = Array.from({ length: burstSize }, () =>
          fetch(`${mockServer.baseUrl}/`)
        );

        const responses = await Promise.all(requests);
        const burstTime = Date.now() - startTime;
        const successCount = responses.filter(r => r.status === 200).length;
        const successRate = (successCount / burstSize) * 100;

        burstResults.push({
          size: burstSize,
          time: burstTime,
          successRate
        });

        expect(successRate).toBeGreaterThan(90); // High success rate for each burst

        // Brief pause between bursts
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const averageTime = burstResults.reduce((sum, r) => sum + r.time, 0) / burstResults.length;
      const averageSuccessRate = burstResults.reduce((sum, r) => sum + r.successRate, 0) / burstResults.length;

      expect(averageSuccessRate).toBeGreaterThan(95);

      console.log(`📊 Burst pattern: avg=${averageTime.toFixed(1)}ms/burst, ${averageSuccessRate.toFixed(1)}% success`);
    }, 10000);
  });

  describe('Scaling and Multi-Server Performance', () => {
    afterEach(async () => {
      await MockServerLifecycle.stopAll();
    });

    it('should support multiple servers without performance degradation', async () => {
      const serverCount = 3;
      const servers: MockNavigationServer[] = [];

      // Start multiple servers
      for (let i = 0; i < serverCount; i++) {
        const server = await MockServerLifecycle.startForTest(`perf-test-${i}`);
        servers.push(server);
      }

      // Test each server independently
      const serverTests = servers.map(async (server, index) => {
        const startTime = Date.now();
        const requests = Array.from({ length: 20 }, () =>
          fetch(`${server.baseUrl}/`)
        );

        const responses = await Promise.all(requests);
        const testTime = Date.now() - startTime;

        return {
          serverIndex: index,
          testTime,
          successCount: responses.filter(r => r.status === 200).length,
          totalRequests: responses.length
        };
      });

      const results = await Promise.all(serverTests);

      // All servers should perform well
      for (const result of results) {
        expect(result.successCount).toBe(result.totalRequests);
        expect(result.testTime).toBeLessThan(2000); // Under 2 seconds for 20 requests
      }

      const averageTime = results.reduce((sum, r) => sum + r.testTime, 0) / results.length;

      console.log(`📊 Multi-server performance (${serverCount} servers): avg=${averageTime.toFixed(1)}ms/server`);
    });

    it('should maintain isolation between high-load servers', async () => {
      const slowServer = await MockServerLifecycle.startForTest('slow-server', {
        baseDelay: 500 // Intentionally slow
      });

      const fastServer = await MockServerLifecycle.startForTest('fast-server', {
        baseDelay: 0 // No delay
      });

      // Start slow request on slow server
      const slowRequestPromise = fetch(`${slowServer.baseUrl}/slow`);

      // Fast server should still be responsive
      const fastStartTime = Date.now();
      const fastResponse = await fetch(`${fastServer.baseUrl}/`);
      const fastTime = Date.now() - fastStartTime;

      expect(fastResponse.status).toBe(200);
      expect(fastTime).toBeLessThan(100); // Should not be affected by slow server

      // Wait for slow request to complete
      const slowResponse = await slowRequestPromise;
      expect(slowResponse.status).toBe(200);

      console.log(`📊 Server isolation: fast=${fastTime}ms (unaffected by slow server)`);
    }, 10000);
  });

  describe('Performance Under Stress Conditions', () => {
    let mockServer: MockNavigationServer;

    beforeEach(async () => {
      mockServer = new MockNavigationServer({
        verbose: false,
        baseDelay: 5 // Small delay to simulate real conditions
      });
      await mockServer.start();
    });

    afterEach(async () => {
      if (mockServer && mockServer.isRunning) {
        await mockServer.stop();
      }
    });

    it('should gracefully handle request overload', async () => {
      const overloadRequests = 100;
      const maxConcurrency = 20; // Limit to prevent overwhelming system

      const results: Array<{ success: boolean; time: number }> = [];

      // Process requests in batches to control concurrency
      for (let i = 0; i < overloadRequests; i += maxConcurrency) {
        const batch = Array.from({ length: Math.min(maxConcurrency, overloadRequests - i) }, async () => {
          const startTime = Date.now();
          try {
            const response = await fetch(`${mockServer.baseUrl}/`);
            const time = Date.now() - startTime;
            return { success: response.status === 200, time };
          } catch (error) {
            const time = Date.now() - startTime;
            return { success: false, time };
          }
        });

        const batchResults = await Promise.all(batch);
        results.push(...batchResults);
      }

      const successRate = (results.filter(r => r.success).length / results.length) * 100;
      const averageTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
      const maxTime = Math.max(...results.map(r => r.time));

      // Should maintain reasonable performance under stress
      expect(successRate).toBeGreaterThan(85); // At least 85% success under stress
      expect(averageTime).toBeLessThan(500); // Average under 500ms
      expect(maxTime).toBeLessThan(2000); // No request over 2s

      console.log(`📊 Stress test (${overloadRequests} requests): ${successRate.toFixed(1)}% success, avg=${averageTime.toFixed(1)}ms`);
    }, 30000);

    it('should recover quickly after stress periods', async () => {
      // Create stress period
      const stressRequests = Array.from({ length: 50 }, () =>
        fetch(`${mockServer.baseUrl}/`)
      );

      await Promise.all(stressRequests);

      // Measure recovery time
      await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause

      const recoveryStartTime = Date.now();
      const recoveryResponse = await fetch(`${mockServer.baseUrl}/`);
      const recoveryTime = Date.now() - recoveryStartTime;

      expect(recoveryResponse.status).toBe(200);
      expect(recoveryTime).toBeLessThan(200); // Should recover quickly

      console.log(`📊 Recovery time after stress: ${recoveryTime}ms`);
    });
  });
});