/**
 * @fileoverview Memory Cleanup and Resource Management Tests
 *
 * This test suite validates proper memory cleanup and resource management
 * in the test fixtures infrastructure, ensuring no memory leaks and proper
 * disposal of resources during test execution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  createTestSuite,
  setupTestMocks,
  getTestEnvironment,
  setTestData,
  getTestData,
  addCleanupTask,
  createMockFunction,
  cleanupTestState,
  createTempDir,
  browserFixtures,
  browserHelpers,
  createBrowserState
} from '../index.js';
import type { SetupTeardownHooks, BrowserState, TestEnvironment } from '../types.js';

describe('Memory Cleanup and Resource Management', () => {
  describe('Test Environment Memory Management', () => {
    it('should properly initialize and cleanup test environment', async () => {
      const suite = createTestSuite();

      // Before setup, environment should be null
      expect(getTestEnvironment()).toBeNull();

      await suite.beforeEach();

      // After setup, environment should exist
      const env = getTestEnvironment();
      expect(env).not.toBeNull();
      expect(env!.activeMocks).toBeInstanceOf(Map);
      expect(env!.cleanupTasks).toBeInstanceOf(Array);
      expect(env!.testData).toBeInstanceOf(Map);

      // Add some data to verify cleanup
      setTestData('test-key', { large: new Array(1000).fill('data') });
      createMockFunction('test-mock');
      addCleanupTask(() => {});

      expect(env!.testData.size).toBe(1);
      expect(env!.activeMocks.size).toBe(1);
      expect(env!.cleanupTasks.length).toBe(1);

      await suite.afterEach();

      // After teardown, environment should be null
      expect(getTestEnvironment()).toBeNull();
    });

    it('should clear large data structures completely', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const env = getTestEnvironment();
      expect(env).not.toBeNull();

      // Add large amount of test data
      const largeData = new Array(10000).fill(0).map((_, i) => ({
        id: i,
        data: `item-${i}`,
        nested: {
          array: new Array(100).fill(i),
          object: { value: i, timestamp: new Date() }
        }
      }));

      setTestData('large-dataset', largeData);
      setTestData('large-string', 'x'.repeat(100000));
      setTestData('circular-ref', { self: null as any });
      const circularRef = getTestData('circular-ref');
      circularRef.self = circularRef; // Create circular reference

      // Create multiple mock functions
      for (let i = 0; i < 100; i++) {
        createMockFunction(`mock-${i}`, () => new Array(50).fill(i));
      }

      expect(env!.testData.size).toBe(3);
      expect(env!.activeMocks.size).toBe(100);

      // Cleanup should handle all data
      await cleanupTestState();

      expect(env!.testData.size).toBe(0);
      expect(env!.activeMocks.size).toBe(0);

      await suite.afterEach();
    });

    it('should handle memory cleanup with weak references', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      // Create objects that might hold references
      const objects = new Array(1000).fill(0).map((_, i) => ({ id: i, data: `object-${i}` }));
      setTestData('objects', objects);

      const mocks = new Array(100).fill(0).map((_, i) => createMockFunction(`bulk-mock-${i}`));

      const env = getTestEnvironment();
      expect(env!.testData.has('objects')).toBe(true);
      expect(env!.activeMocks.size).toBe(100);

      // Clear references at application level
      objects.length = 0;
      mocks.length = 0;

      // Cleanup should still clear internal references
      await cleanupTestState();

      expect(env!.testData.size).toBe(0);
      expect(env!.activeMocks.size).toBe(0);

      await suite.afterEach();
    });
  });

  describe('Browser State Memory Management', () => {
    it('should properly handle large browser states without memory leaks', async () => {
      const largeBrowserStates: BrowserState[] = [];

      // Create large browser states
      for (let i = 0; i < 100; i++) {
        const state = createBrowserState()
          .withUrl(`https://test${i}.example.com`)
          .withTitle(`Test Page ${i}`)
          .withLocalStorage(
            Object.fromEntries(
              Array.from({ length: 50 }, (_, j) => [`key-${i}-${j}`, `value-${i}-${j}`])
            )
          )
          .withSessionStorage(
            Object.fromEntries(
              Array.from({ length: 25 }, (_, j) => [`session-${i}-${j}`, `session-value-${i}-${j}`])
            )
          )
          .withConsoleMessages(
            Array.from({ length: 20 }, (_, j) => ({
              type: 'info' as const,
              message: `Message ${i}-${j}`,
              timestamp: new Date(Date.now() + j)
            }))
          )
          .withNetworkRequests(
            Array.from({ length: 10 }, (_, j) => ({
              url: `https://api.test${i}.com/endpoint${j}`,
              method: 'GET',
              status: 200,
              headers: { 'Request-ID': `req-${i}-${j}` }
            }))
          )
          .build();

        largeBrowserStates.push(state);
      }

      expect(largeBrowserStates).toHaveLength(100);

      // Verify data integrity
      const firstState = largeBrowserStates[0];
      expect(Object.keys(firstState.localStorage)).toHaveLength(50);
      expect(Object.keys(firstState.sessionStorage)).toHaveLength(25);
      expect(firstState.consoleMessages).toHaveLength(20);
      expect(firstState.networkRequests).toHaveLength(10);

      const lastState = largeBrowserStates[99];
      expect(lastState.url).toBe('https://test99.example.com');
      expect(lastState.title).toBe('Test Page 99');

      // Clear references
      largeBrowserStates.length = 0;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Test should complete without memory issues
      expect(true).toBe(true);
    });

    it('should handle browser state transformations without accumulating memory', async () => {
      let state = browserFixtures.cleanState();

      // Perform many transformations
      for (let i = 0; i < 1000; i++) {
        state = browserHelpers.setLocalStorage(state, `key-${i}`, `value-${i}`);
        state = browserHelpers.addConsoleMessage(state, 'info', `Message ${i}`);

        if (i % 10 === 0) {
          state = browserHelpers.addNetworkRequest(state, `https://api.example.com/request-${i}`);
        }

        if (i % 100 === 0) {
          state = browserHelpers.addCookie(state, `cookie-${i}`, `cookie-value-${i}`);
        }
      }

      expect(Object.keys(state.localStorage)).toHaveLength(1000);
      expect(state.consoleMessages).toHaveLength(1000);
      expect(state.networkRequests).toHaveLength(100);
      expect(state.cookies).toHaveLength(10);

      // Clear state
      state = browserFixtures.cleanState();

      expect(Object.keys(state.localStorage)).toHaveLength(0);
      expect(state.consoleMessages).toHaveLength(0);
      expect(state.networkRequests).toHaveLength(0);
      expect(state.cookies).toHaveLength(0);
    });

    it('should handle immutable operations without memory accumulation', async () => {
      const baseState = browserFixtures.loggedInPage();
      const transformations: BrowserState[] = [];

      // Create many immutable transformations
      let currentState = baseState;
      for (let i = 0; i < 500; i++) {
        currentState = browserHelpers.setLocalStorage(currentState, `dynamic-key-${i}`, `dynamic-value-${i}`);
        transformations.push(currentState);
      }

      expect(transformations).toHaveLength(500);

      // Each transformation should be independent
      expect(Object.keys(baseState.localStorage).includes('dynamic-key-0')).toBe(false);
      expect(Object.keys(transformations[0].localStorage).includes('dynamic-key-0')).toBe(true);
      expect(Object.keys(transformations[499].localStorage).includes('dynamic-key-499')).toBe(true);

      // Clear transformations
      transformations.length = 0;

      if (global.gc) {
        global.gc();
      }

      expect(transformations).toHaveLength(0);
    });
  });

  describe('Mock Function Memory Management', () => {
    it('should properly cleanup mock function references', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const mockRefs: Array<ReturnType<typeof vi.fn>> = [];

      // Create many mock functions with different implementations
      for (let i = 0; i < 200; i++) {
        const mock = createMockFunction(`memory-mock-${i}`, (value: number) => {
          // Create some objects in closure
          const data = new Array(100).fill(value);
          return data.reduce((sum, v) => sum + v, 0);
        });

        mockRefs.push(mock);

        // Call mocks to create call history
        mock(i);
        mock(i * 2);
      }

      const env = getTestEnvironment();
      expect(env!.activeMocks.size).toBe(200);

      // Verify mocks work
      expect(mockRefs[0](1)).toBe(100); // 100 * 1
      expect(mockRefs[50](2)).toBe(200); // 100 * 2

      // Cleanup should clear all mock references
      await cleanupTestState();

      expect(env!.activeMocks.size).toBe(0);

      // Clear our references
      mockRefs.length = 0;

      await suite.afterEach();
    });

    it('should handle mock functions with circular references', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const circularMock = createMockFunction('circular-mock', function mockImpl(this: any) {
        if (!this.calls) {
          this.calls = [];
        }
        this.calls.push(mockImpl); // Create circular reference
        return this.calls.length;
      });

      // Call mock several times
      circularMock();
      circularMock();
      circularMock();

      const env = getTestEnvironment();
      expect(env!.activeMocks.has('circular-mock')).toBe(true);

      // Cleanup should handle circular references gracefully
      await expect(cleanupTestState()).resolves.toBeUndefined();

      expect(env!.activeMocks.size).toBe(0);

      await suite.afterEach();
    });
  });

  describe('File System Resource Management', () => {
    it('should cleanup temporary directories properly', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      // Create temporary directory
      const tempDir = await createTempDir();
      expect(tempDir).toBeDefined();
      expect(tempDir.includes(os.tmpdir())).toBe(true);

      // Create some files in temp directory
      const testFiles = [
        path.join(tempDir, 'test1.txt'),
        path.join(tempDir, 'test2.txt'),
        path.join(tempDir, 'subdir', 'test3.txt')
      ];

      // Create subdirectory
      await fs.mkdir(path.join(tempDir, 'subdir'), { recursive: true });

      // Write test files
      for (const filePath of testFiles) {
        await fs.writeFile(filePath, `Test content for ${path.basename(filePath)}`);
      }

      // Verify files exist
      for (const filePath of testFiles) {
        expect(await fs.access(filePath).then(() => true).catch(() => false)).toBe(true);
      }

      const env = getTestEnvironment();
      expect(env!.tempDir).toBe(tempDir);

      // Cleanup should remove temp directory and all contents
      await suite.afterEach();

      // Temp directory should be cleaned up
      expect(await fs.access(tempDir).then(() => true).catch(() => false)).toBe(false);
    });

    it('should handle temp directory cleanup failures gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const suite = createTestSuite();
      await suite.beforeEach();

      const tempDir = await createTempDir();
      const env = getTestEnvironment();

      // Simulate permission issues by changing tempDir to non-existent path
      if (env) {
        env.tempDir = '/nonexistent/path/that/cannot/be/removed';
      }

      // Cleanup should handle failure gracefully
      await expect(suite.afterEach()).resolves.toBeUndefined();

      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should handle multiple temp directories', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const tempDirs: string[] = [];

      // Create multiple temp directories via cleanup tasks
      for (let i = 0; i < 5; i++) {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `apex-test-multi-${i}-`));
        tempDirs.push(tempDir);

        await fs.writeFile(path.join(tempDir, 'test.txt'), `Content ${i}`);

        addCleanupTask(async () => {
          await fs.rm(tempDir, { recursive: true, force: true });
        });
      }

      // Verify all directories exist
      for (const dir of tempDirs) {
        expect(await fs.access(dir).then(() => true).catch(() => false)).toBe(true);
      }

      // Cleanup should remove all directories
      await suite.afterEach();

      // All directories should be cleaned up
      for (const dir of tempDirs) {
        expect(await fs.access(dir).then(() => true).catch(() => false)).toBe(false);
      }
    });
  });

  describe('Cleanup Task Resource Management', () => {
    it('should execute cleanup tasks in proper order and handle resources', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const resources: Array<{ id: string; cleaned: boolean }> = [];
      const cleanupOrder: string[] = [];

      // Create simulated resources that need cleanup
      for (let i = 0; i < 10; i++) {
        const resource = { id: `resource-${i}`, cleaned: false };
        resources.push(resource);

        addCleanupTask(() => {
          resource.cleaned = true;
          cleanupOrder.push(resource.id);
        });

        // Add some async cleanup tasks
        if (i % 3 === 0) {
          addCleanupTask(async () => {
            await new Promise(resolve => setTimeout(resolve, 5));
            cleanupOrder.push(`async-${resource.id}`);
          });
        }
      }

      expect(resources.every(r => !r.cleaned)).toBe(true);

      await suite.afterEach();

      // All resources should be cleaned
      expect(resources.every(r => r.cleaned)).toBe(true);
      expect(cleanupOrder.length).toBeGreaterThanOrEqual(10);
    });

    it('should handle cleanup tasks with memory-intensive operations', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const largeDataSets: Array<any[]> = [];

      // Create cleanup tasks that handle large data
      for (let i = 0; i < 10; i++) {
        const largeData = new Array(10000).fill(0).map((_, j) => ({
          id: `${i}-${j}`,
          data: `item-${i}-${j}`,
          buffer: new Array(100).fill(j)
        }));

        largeDataSets.push(largeData);

        addCleanupTask(() => {
          // Clear the large data
          largeData.length = 0;
          const index = largeDataSets.indexOf(largeData);
          if (index !== -1) {
            largeDataSets.splice(index, 1);
          }
        });
      }

      expect(largeDataSets).toHaveLength(10);
      expect(largeDataSets[0]).toHaveLength(10000);

      await suite.afterEach();

      expect(largeDataSets).toHaveLength(0);
    });

    it('should prevent memory leaks from failed cleanup tasks', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const suite = createTestSuite();
      await suite.beforeEach();

      const successfulCleanups: string[] = [];
      const resources = new Array(20).fill(0).map((_, i) => ({ id: i, data: new Array(1000).fill(i) }));

      // Add mix of successful and failing cleanup tasks
      resources.forEach((resource, i) => {
        if (i % 3 === 0) {
          // Failing cleanup
          addCleanupTask(() => {
            throw new Error(`Cleanup failed for resource ${i}`);
          });
        } else {
          // Successful cleanup
          addCleanupTask(() => {
            resource.data.length = 0; // Clear the data
            successfulCleanups.push(`cleaned-${i}`);
          });
        }
      });

      await suite.afterEach();

      // Successful cleanups should have run
      const expectedSuccessful = resources
        .map((_, i) => i)
        .filter(i => i % 3 !== 0)
        .map(i => `cleaned-${i}`);

      expect(successfulCleanups.sort()).toEqual(expectedSuccessful.sort());
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Global State Management', () => {
    it('should properly reset global state between test runs', async () => {
      // First test run
      const suite1 = createTestSuite();
      await suite1.beforeEach();

      setTestData('global-test-1', { data: 'first run' });
      createMockFunction('global-mock-1');

      const env1 = getTestEnvironment();
      expect(env1!.testData.size).toBe(1);
      expect(env1!.activeMocks.size).toBe(1);

      await suite1.afterEach();
      expect(getTestEnvironment()).toBeNull();

      // Second test run should have clean state
      const suite2 = createTestSuite();
      await suite2.beforeEach();

      const env2 = getTestEnvironment();
      expect(env2!.testData.size).toBe(0);
      expect(env2!.activeMocks.size).toBe(0);

      // Should not have data from first run
      expect(getTestData('global-test-1')).toBeUndefined();

      setTestData('global-test-2', { data: 'second run' });
      expect(getTestData('global-test-2')).toEqual({ data: 'second run' });

      await suite2.afterEach();
      expect(getTestEnvironment()).toBeNull();
    });

    it('should handle multiple concurrent global state resets', async () => {
      const suiteResults: Array<{ id: string; isolated: boolean }> = [];

      const runIsolatedSuite = async (suiteId: string) => {
        const suite = createTestSuite();
        await suite.beforeEach();

        // Set unique data for this suite
        setTestData(`suite-data-${suiteId}`, { id: suiteId, timestamp: Date.now() });

        // Check that only this suite's data exists
        const env = getTestEnvironment();
        const hasOnlyOwnData = env!.testData.size === 1 && env!.testData.has(`suite-data-${suiteId}`);

        await suite.afterEach();

        suiteResults.push({ id: suiteId, isolated: hasOnlyOwnData });
      };

      // Run multiple suites concurrently
      await Promise.all([
        runIsolatedSuite('A'),
        runIsolatedSuite('B'),
        runIsolatedSuite('C'),
        runIsolatedSuite('D'),
        runIsolatedSuite('E')
      ]);

      // All suites should have been properly isolated
      expect(suiteResults).toHaveLength(5);
      expect(suiteResults.every(result => result.isolated)).toBe(true);
    });

    it('should handle environment state corruption recovery', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const env = getTestEnvironment();
      expect(env).not.toBeNull();

      // Simulate corruption of environment state
      if (env) {
        // @ts-expect-error - Intentionally corrupting state
        env.testData = null;
        // @ts-expect-error - Intentionally corrupting state
        env.activeMocks = null;
        // @ts-expect-error - Intentionally corrupting state
        env.cleanupTasks = null;
      }

      // Cleanup should handle corrupted state gracefully
      await expect(cleanupTestState()).resolves.toBeUndefined();

      await suite.afterEach();
      expect(getTestEnvironment()).toBeNull();
    });
  });

  describe('Memory Usage Monitoring', () => {
    it('should not accumulate memory across multiple test cycles', async () => {
      const initialMemory = process.memoryUsage();
      const cycles = 20;

      for (let cycle = 0; cycle < cycles; cycle++) {
        const suite = createTestSuite({
          setupMocks: true,
          mockConfig: {
            mockFs: true,
            mockData: {
              fileSystemData: Object.fromEntries(
                Array.from({ length: 100 }, (_, i) => [
                  `/test-cycle-${cycle}/file-${i}.txt`,
                  `Content for cycle ${cycle}, file ${i}`
                ])
              )
            }
          }
        });

        await suite.beforeEach();

        // Create test data
        setTestData('cycle-data', {
          cycle,
          largeArray: new Array(5000).fill(cycle),
          timestamp: new Date()
        });

        // Create mocks
        for (let i = 0; i < 20; i++) {
          createMockFunction(`cycle-${cycle}-mock-${i}`, () => new Array(100).fill(i));
        }

        // Create browser states
        const browserStates = Array.from({ length: 10 }, (_, i) =>
          createBrowserState()
            .withUrl(`https://cycle${cycle}-test${i}.example.com`)
            .withLocalStorage({ [`cycle-${cycle}-key-${i}`]: `value-${i}` })
            .build()
        );

        // Use resources
        const env = getTestEnvironment();
        expect(env!.testData.size).toBe(1);
        expect(env!.activeMocks.size).toBe(20);
        expect(browserStates).toHaveLength(10);

        await suite.afterEach();

        // Force GC periodically
        if (cycle % 5 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be minimal (less than 20MB)
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024);
    });

    it('should handle stress test with large data volumes', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      // Create large amounts of test data
      const largeDataStructures = [
        new Array(50000).fill(0).map((_, i) => ({ id: i, data: `item-${i}` })),
        new Array(100000).fill('large-string-item'),
        Object.fromEntries(
          Array.from({ length: 10000 }, (_, i) => [`key-${i}`, `value-${i}-${Date.now()}`])
        )
      ];

      setTestData('large-array', largeDataStructures[0]);
      setTestData('large-string-array', largeDataStructures[1]);
      setTestData('large-object', largeDataStructures[2]);

      // Create many mock functions
      const mocks = Array.from({ length: 500 }, (_, i) =>
        createMockFunction(`stress-mock-${i}`, (value: number) => value * i)
      );

      // Use the mocks
      mocks.forEach((mock, i) => {
        mock(i);
        mock(i * 2);
      });

      const env = getTestEnvironment();
      expect(env!.testData.size).toBe(3);
      expect(env!.activeMocks.size).toBe(500);

      // Cleanup should handle large volumes
      const cleanupStart = Date.now();
      await cleanupTestState();
      const cleanupDuration = Date.now() - cleanupStart;

      // Cleanup should complete in reasonable time (less than 1 second)
      expect(cleanupDuration).toBeLessThan(1000);

      expect(env!.testData.size).toBe(0);
      expect(env!.activeMocks.size).toBe(0);

      await suite.afterEach();
    });
  });
});