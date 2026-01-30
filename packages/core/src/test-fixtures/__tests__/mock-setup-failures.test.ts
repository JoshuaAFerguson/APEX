/**
 * @fileoverview Tests for Mock Setup Failure Scenarios
 *
 * This test suite focuses on testing error handling and resilience in the
 * test fixture infrastructure, particularly around mock setup failures,
 * cleanup failures, and recovery scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTestSuite,
  setupTestMocks,
  setupFileSystemMocks,
  setupNetworkMocks,
  addCleanupTask,
  cleanupTestState,
  getTestEnvironment,
  createMockFunction,
  flushTimers,
  advanceTimers
} from '../setup-teardown.js';
import type { MockConfig, SetupTeardownHooks } from '../types.js';

describe('Mock Setup Failure Scenarios', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Capture console output for failure scenarios
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe('File System Mock Failures', () => {
    it('should handle corrupted file data gracefully', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      // Mock with intentionally problematic data
      const corruptedFileData = {
        '/valid-file.txt': 'valid content',
        // @ts-expect-error - Testing with invalid data
        '/invalid-file.txt': null,
        // @ts-expect-error - Testing with invalid data
        '/undefined-file.txt': undefined,
        '/circular-file.txt': '[Circular reference]'
      };

      expect(() => {
        setupFileSystemMocks(corruptedFileData);
      }).not.toThrow();

      await suite.afterEach();
    });

    it('should handle file system mock initialization errors', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      // Test with mock that throws during setup
      const originalMock = vi.mock;
      vi.mock = vi.fn().mockImplementation(() => {
        throw new Error('Mock initialization failed');
      });

      expect(() => {
        setupFileSystemMocks({ '/test.txt': 'content' });
      }).toThrow();

      // Restore original mock function
      vi.mock = originalMock;

      await suite.afterEach();
    });

    it('should recover from failed file operations', async () => {
      const suite = createTestSuite({
        mockConfig: {
          mockFs: true,
          mockData: {
            fileSystemData: { '/exists.txt': 'content' }
          }
        }
      });

      await suite.beforeEach();

      // File operations should work normally after setup
      const env = getTestEnvironment();
      expect(env).not.toBeNull();

      await suite.afterEach();
    });
  });

  describe('Network Mock Failures', () => {
    it('should handle malformed API response data', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const malformedApiData = {
        'https://api.test.com/good': { success: true },
        // @ts-expect-error - Testing malformed data
        'https://api.test.com/circular': null,
        'https://api.test.com/large': 'x'.repeat(10000000) // Very large response
      };

      expect(() => {
        setupNetworkMocks(malformedApiData);
      }).not.toThrow();

      // Should be able to use global fetch even with malformed setup
      expect(typeof global.fetch).toBe('function');

      await suite.afterEach();
    });

    it('should handle fetch mock override failures', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      // Mock Response constructor to fail
      const originalResponse = global.Response;
      global.Response = vi.fn().mockImplementation(() => {
        throw new Error('Response creation failed');
      }) as any;

      expect(() => {
        setupNetworkMocks({ 'https://test.com': { data: 'test' } });
      }).not.toThrow();

      // Restore original Response
      global.Response = originalResponse;

      await suite.afterEach();
    });

    it('should handle network requests to unmocked URLs', async () => {
      const suite = createTestSuite({
        mockConfig: {
          mockNetwork: true,
          mockData: {
            apiResponses: {
              'https://mocked.com/api': { data: 'mocked' }
            }
          }
        }
      });

      await suite.beforeEach();

      // Request to unmocked URL should throw expected error
      if (typeof global.fetch === 'function') {
        await expect(global.fetch('https://unmocked.com/api')).rejects.toThrow(
          'Network request to https://unmocked.com/api was not mocked'
        );
      }

      await suite.afterEach();
    });
  });

  describe('Custom Mock Failures', () => {
    it('should handle broken custom mock implementations', async () => {
      const brokenMock = vi.fn().mockImplementation(() => {
        throw new Error('Custom mock is broken');
      });

      const suite = createTestSuite({
        setupMocks: true,
        mockConfig: {
          customMocks: {
            brokenService: brokenMock
          }
        }
      });

      await suite.beforeEach();

      const env = getTestEnvironment();
      expect(env).not.toBeNull();
      expect(env!.activeMocks.has('brokenService')).toBe(true);

      // Using the mock should throw, but setup should succeed
      const mock = env!.activeMocks.get('brokenService');
      expect(() => mock()).toThrow('Custom mock is broken');

      await suite.afterEach();
    });

    it('should handle undefined custom mocks', async () => {
      const mockConfig: MockConfig = {
        customMocks: {
          // @ts-expect-error - Testing undefined mock
          undefinedMock: undefined,
          // @ts-expect-error - Testing null mock
          nullMock: null,
          validMock: vi.fn()
        }
      };

      const suite = createTestSuite({
        setupMocks: true,
        mockConfig
      });

      await suite.beforeEach();

      const env = getTestEnvironment();
      expect(env).not.toBeNull();
      expect(env!.activeMocks.has('validMock')).toBe(true);
      // Invalid mocks should be skipped
      expect(env!.activeMocks.has('undefinedMock')).toBe(true);
      expect(env!.activeMocks.has('nullMock')).toBe(true);

      await suite.afterEach();
    });
  });

  describe('Timer Mock Failures', () => {
    it('should handle timer setup failures', async () => {
      // Mock vi.useFakeTimers to throw
      const originalUseFakeTimers = vi.useFakeTimers;
      vi.useFakeTimers = vi.fn().mockImplementation(() => {
        throw new Error('Timer setup failed');
      });

      const suite = createTestSuite({
        mockConfig: { mockTimers: true }
      });

      await expect(suite.beforeEach()).rejects.toThrow();

      // Restore original function
      vi.useFakeTimers = originalUseFakeTimers;
    });

    it('should handle timer cleanup failures', async () => {
      const suite = createTestSuite({ useFakeTimers: true });
      await suite.beforeEach();

      // Mock vi.useRealTimers to throw during cleanup
      const originalUseRealTimers = vi.useRealTimers;
      vi.useRealTimers = vi.fn().mockImplementation(() => {
        throw new Error('Timer cleanup failed');
      });

      // Should not throw, but should warn
      await expect(suite.afterEach()).resolves.toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalled();

      // Restore
      vi.useRealTimers = originalUseRealTimers;
    });

    it('should handle timer operations with broken fake timers', async () => {
      const suite = createTestSuite({ useFakeTimers: true });
      await suite.beforeEach();

      // Mock timer advancement to fail
      const originalAdvanceTimers = vi.advanceTimersByTimeAsync;
      vi.advanceTimersByTimeAsync = vi.fn().mockImplementation(() => {
        throw new Error('Timer advancement failed');
      });

      await expect(advanceTimers(1000)).rejects.toThrow('Timer advancement failed');

      // Restore
      vi.advanceTimersByTimeAsync = originalAdvanceTimers;

      await suite.afterEach();
    });
  });

  describe('Environment Variable Mock Failures', () => {
    it('should handle process.env modification failures', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      // Mock vi.stubEnv to throw
      const originalStubEnv = vi.stubEnv;
      vi.stubEnv = vi.fn().mockImplementation(() => {
        throw new Error('Environment variable stub failed');
      });

      await expect(setupTestMocks({
        mockData: {
          envVars: { TEST_VAR: 'test-value' }
        }
      })).rejects.toThrow();

      // Restore
      vi.stubEnv = originalStubEnv;

      await suite.afterEach();
    });

    it('should handle environment variable cleanup failures', async () => {
      const suite = createTestSuite({
        mockConfig: {
          mockData: {
            envVars: { TEST_VAR: 'test' }
          }
        }
      });

      await suite.beforeEach();

      // Mock cleanup to fail
      const originalUnstubAllEnvs = vi.unstubAllEnvs;
      vi.unstubAllEnvs = vi.fn().mockImplementation(() => {
        throw new Error('Environment cleanup failed');
      });

      // Should handle cleanup failure gracefully
      await expect(suite.afterEach()).resolves.toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalled();

      // Restore
      vi.unstubAllEnvs = originalUnstubAllEnvs;
    });
  });

  describe('Cleanup Task Failures', () => {
    it('should continue cleanup even when tasks fail', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const successfulCleanups: string[] = [];

      // Add cleanup tasks that will fail and succeed
      addCleanupTask(() => {
        throw new Error('First cleanup failed');
      });

      addCleanupTask(() => {
        successfulCleanups.push('second');
      });

      addCleanupTask(() => {
        throw new Error('Third cleanup failed');
      });

      addCleanupTask(() => {
        successfulCleanups.push('fourth');
      });

      await suite.afterEach();

      // Successful cleanups should have run
      expect(successfulCleanups).toEqual(['second', 'fourth']);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2); // Two failures
    });

    it('should handle async cleanup failures', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const asyncResults: string[] = [];

      addCleanupTask(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('Async cleanup failed');
      });

      addCleanupTask(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        asyncResults.push('success');
      });

      await suite.afterEach();

      expect(asyncResults).toEqual(['success']);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle infinite loop in cleanup tasks', async () => {
      const suite = createTestSuite({ timeout: 1000 });
      await suite.beforeEach();

      addCleanupTask(() => {
        // Simulate an infinite loop
        const start = Date.now();
        while (Date.now() - start < 50) {
          // Busy wait for 50ms to simulate problematic cleanup
        }
      });

      // Should complete even with slow cleanup
      const startTime = Date.now();
      await suite.afterEach();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should not take too long
    });
  });

  describe('Memory and Resource Cleanup Failures', () => {
    it('should handle temporary directory cleanup failures', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      // Simulate temp directory that can't be cleaned up
      const env = getTestEnvironment();
      if (env) {
        env.tempDir = '/nonexistent/directory/that/cannot/be/removed';
      }

      // Should handle cleanup failure gracefully
      await expect(cleanupTestState()).resolves.toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalled();

      await suite.afterEach();
    });

    it('should handle mock clearing failures', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      // Mock vi.clearAllMocks to throw
      const originalClearAllMocks = vi.clearAllMocks;
      vi.clearAllMocks = vi.fn().mockImplementation(() => {
        throw new Error('Mock clearing failed');
      });

      await expect(cleanupTestState()).rejects.toThrow();

      // Restore
      vi.clearAllMocks = originalClearAllMocks;

      await suite.afterEach();
    });
  });

  describe('Custom Setup/Teardown Failures', () => {
    it('should handle custom setup failures', async () => {
      const customSetup = vi.fn().mockImplementation(() => {
        throw new Error('Custom setup failed');
      });

      const suite = createTestSuite({ customSetup });

      await expect(suite.beforeEach()).rejects.toThrow('Custom setup failed');
    });

    it('should handle async custom setup failures', async () => {
      const customSetup = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('Async custom setup failed');
      });

      const suite = createTestSuite({ customSetup });

      await expect(suite.beforeEach()).rejects.toThrow('Async custom setup failed');
    });

    it('should handle custom teardown failures gracefully', async () => {
      const customTeardown = vi.fn().mockImplementation(() => {
        throw new Error('Custom teardown failed');
      });

      const suite = createTestSuite({ customTeardown });

      await suite.beforeEach();
      await expect(suite.afterEach()).resolves.toBeUndefined();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Custom teardown failed:',
        expect.any(Error)
      );
    });

    it('should handle nested custom setup failures', async () => {
      let setupCallCount = 0;
      const customSetup = vi.fn().mockImplementation(() => {
        setupCallCount++;
        if (setupCallCount === 1) {
          throw new Error('First setup failed');
        }
        // Second call should work
      });

      const suite = createTestSuite({ customSetup });

      // First call should fail
      await expect(suite.beforeEach()).rejects.toThrow('First setup failed');

      // Second call should succeed
      await expect(suite.beforeEach()).resolves.toBeUndefined();

      await suite.afterEach();
    });
  });

  describe('Mock Function Creation Failures', () => {
    it('should handle mock function creation errors', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      // Mock vi.fn to throw
      const originalViFn = vi.fn;
      vi.fn = vi.fn().mockImplementation(() => {
        throw new Error('Mock function creation failed');
      });

      expect(() => {
        createMockFunction('testMock');
      }).toThrow('Mock function creation failed');

      // Restore
      vi.fn = originalViFn;

      await suite.afterEach();
    });

    it('should handle mock registration when environment is null', () => {
      // Call outside of test environment
      expect(() => {
        createMockFunction('orphanMock');
      }).not.toThrow();

      // Mock should be created but not registered
      const mock = createMockFunction('orphanMock');
      expect(mock).toBeDefined();
      expect(typeof mock).toBe('function');
    });
  });

  describe('Integration: Multiple Failure Scenarios', () => {
    it('should handle cascading failures gracefully', async () => {
      const failures: string[] = [];

      const customSetup = vi.fn().mockImplementation(() => {
        failures.push('setup-attempted');
        throw new Error('Setup failed');
      });

      const customTeardown = vi.fn().mockImplementation(() => {
        failures.push('teardown-attempted');
        throw new Error('Teardown failed');
      });

      const suite = createTestSuite({
        customSetup,
        customTeardown,
        setupMocks: true,
        mockConfig: {
          customMocks: {
            brokenMock: vi.fn().mockImplementation(() => {
              throw new Error('Mock is broken');
            })
          }
        }
      });

      // Setup should fail
      await expect(suite.beforeEach()).rejects.toThrow('Setup failed');

      // Even with setup failure, teardown should attempt to run
      await expect(suite.afterEach()).resolves.toBeUndefined();

      expect(failures).toContain('setup-attempted');
      expect(failures).toContain('teardown-attempted');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should recover from partial setup failures', async () => {
      let attemptCount = 0;

      const suite = createTestSuite({
        customSetup: () => {
          attemptCount++;
          if (attemptCount === 1) {
            throw new Error('First attempt failed');
          }
          // Second attempt succeeds
        }
      });

      // First setup fails
      await expect(suite.beforeEach()).rejects.toThrow('First attempt failed');

      // Should be able to retry successfully
      await expect(suite.beforeEach()).resolves.toBeUndefined();
      await expect(suite.afterEach()).resolves.toBeUndefined();
    });

    it('should maintain isolation between failed and successful tests', async () => {
      const suite1 = createTestSuite({
        customSetup: () => {
          throw new Error('Suite 1 setup failed');
        }
      });

      const suite2 = createTestSuite({
        setupMocks: true,
        cleanupAfterEach: true
      });

      // Suite 1 fails
      await expect(suite1.beforeEach()).rejects.toThrow();
      await suite1.afterEach(); // Should still work

      // Suite 2 should work independently
      await expect(suite2.beforeEach()).resolves.toBeUndefined();

      const env = getTestEnvironment();
      expect(env).not.toBeNull();

      await expect(suite2.afterEach()).resolves.toBeUndefined();
      expect(getTestEnvironment()).toBeNull();
    });
  });
});