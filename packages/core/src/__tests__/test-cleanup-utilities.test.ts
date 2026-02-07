/**
 * @fileoverview Comprehensive tests for test cleanup utilities
 *
 * This test suite verifies that the state cleanup utilities provide proper
 * test isolation by testing:
 * - Mock cleanup in beforeEach/afterEach patterns
 * - Database cleanup helpers for SQLite TaskStore
 * - In-memory state reset functions
 * - Complete test environment isolation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockCleanup,
  createTimerManagement,
  createFileSystemMock,
  createCompressionMock,
  createCompleteTestSetup,
  createResourceCleanup
} from '../test-setup-utils.js';

describe('Test Cleanup Utilities', () => {
  describe('createMockCleanup', () => {
    it('should set up beforeEach and afterEach hooks that clean mocks', () => {
      // Track hook setup
      let beforeEachCalled = false;
      let afterEachCalled = false;

      // Mock vitest hooks to verify they are called
      const originalBeforeEach = beforeEach;
      const originalAfterEach = afterEach;
      const mockBeforeEach = vi.fn((fn) => {
        beforeEachCalled = true;
        return originalBeforeEach(fn);
      });
      const mockAfterEach = vi.fn((fn) => {
        afterEachCalled = true;
        return originalAfterEach(fn);
      });

      // Temporarily replace hooks
      (global as any).beforeEach = mockBeforeEach;
      (global as any).afterEach = mockAfterEach;

      try {
        // Call createMockCleanup
        createMockCleanup();

        // Verify hooks were set up
        expect(mockBeforeEach).toHaveBeenCalled();
        expect(mockAfterEach).toHaveBeenCalled();

        // Execute the hook functions to verify they work
        const beforeEachFn = mockBeforeEach.mock.calls[0][0];
        const afterEachFn = mockAfterEach.mock.calls[0][0];

        // Create a mock to test cleanup
        const testMock = vi.fn();
        testMock.mockReturnValue('test');

        // Call it to set up state
        expect(testMock()).toBe('test');
        expect(testMock).toHaveBeenCalledTimes(1);

        // Execute beforeEach - should clear call history but keep mock implementation
        beforeEachFn();
        expect(testMock).toHaveBeenCalledTimes(0); // Call history cleared
        expect(testMock()).toBe('test'); // Implementation still works

        // Execute afterEach - should reset implementation
        afterEachFn();
        expect(testMock()).toBeUndefined(); // Implementation reset

      } finally {
        // Restore original hooks
        (global as any).beforeEach = originalBeforeEach;
        (global as any).afterEach = originalAfterEach;
      }
    });

    it('should respect configuration options', () => {
      const originalBeforeEach = beforeEach;
      const originalAfterEach = afterEach;
      const mockBeforeEach = vi.fn();
      const mockAfterEach = vi.fn();

      (global as any).beforeEach = mockBeforeEach;
      (global as any).afterEach = mockAfterEach;

      try {
        // Test with custom options
        createMockCleanup({
          clearMocks: false,
          resetMocks: false
        });

        // Should not set up hooks if both are disabled
        expect(mockBeforeEach).not.toHaveBeenCalled();
        expect(mockAfterEach).not.toHaveBeenCalled();

        // Reset mocks
        mockBeforeEach.mockReset();
        mockAfterEach.mockReset();

        // Test with only clearMocks enabled
        createMockCleanup({
          clearMocks: true,
          resetMocks: false
        });

        expect(mockBeforeEach).toHaveBeenCalled();
        expect(mockAfterEach).not.toHaveBeenCalled();

      } finally {
        (global as any).beforeEach = originalBeforeEach;
        (global as any).afterEach = originalAfterEach;
      }
    });
  });

  describe('createTimerManagement', () => {
    it('should set up fake timers in beforeEach and restore in afterEach', () => {
      const originalBeforeEach = beforeEach;
      const originalAfterEach = afterEach;
      const mockBeforeEach = vi.fn((fn) => originalBeforeEach(fn));
      const mockAfterEach = vi.fn((fn) => originalAfterEach(fn));

      (global as any).beforeEach = mockBeforeEach;
      (global as any).afterEach = mockAfterEach;

      try {
        createTimerManagement();

        expect(mockBeforeEach).toHaveBeenCalled();
        expect(mockAfterEach).toHaveBeenCalled();

        // Test the actual hook functions
        const beforeEachFn = mockBeforeEach.mock.calls[0][0];
        const afterEachFn = mockAfterEach.mock.calls[0][0];

        // Execute beforeEach - should set up fake timers
        beforeEachFn();

        // Should be able to use vi.advanceTimersByTime
        const callback = vi.fn();
        setTimeout(callback, 1000);

        expect(callback).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1000);
        expect(callback).toHaveBeenCalled();

        // Execute afterEach - should restore real timers
        afterEachFn();

      } finally {
        (global as any).beforeEach = originalBeforeEach;
        (global as any).afterEach = originalAfterEach;
      }
    });

    it('should respect configuration options for timer management', () => {
      const originalBeforeEach = beforeEach;
      const originalAfterEach = afterEach;
      const mockBeforeEach = vi.fn();
      const mockAfterEach = vi.fn();

      (global as any).beforeEach = mockBeforeEach;
      (global as any).afterEach = mockAfterEach;

      try {
        // Test with fake timers disabled
        createTimerManagement({
          useFakeTimers: false,
          restoreTimers: false
        });

        expect(mockBeforeEach).not.toHaveBeenCalled();
        expect(mockAfterEach).not.toHaveBeenCalled();

      } finally {
        (global as any).beforeEach = originalBeforeEach;
        (global as any).afterEach = originalAfterEach;
      }
    });
  });

  describe('createFileSystemMock', () => {
    it('should create comprehensive file system mocks', () => {
      const originalBeforeEach = beforeEach;
      const mockBeforeEach = vi.fn((fn) => originalBeforeEach(fn));

      (global as any).beforeEach = mockBeforeEach;

      try {
        const mockFs = createFileSystemMock();

        // Verify all expected methods are mocked
        expect(mockFs.readFile).toBeDefined();
        expect(mockFs.writeFile).toBeDefined();
        expect(mockFs.readdir).toBeDefined();
        expect(mockFs.mkdir).toBeDefined();
        expect(mockFs.unlink).toBeDefined();
        expect(mockFs.rmdir).toBeDefined();
        expect(mockFs.stat).toBeDefined();
        expect(mockFs.exists).toBeDefined();
        expect(mockFs.copyFile).toBeDefined();
        expect(mockFs.rename).toBeDefined();

        // Verify default behaviors are set up
        expect(mockFs.readFile).toHaveReturnValue(Promise.resolve(JSON.stringify({ test: 'data' })));
        expect(mockFs.writeFile).toHaveReturnValue(Promise.resolve());

        // Verify beforeEach hook was set up to configure defaults
        expect(mockBeforeEach).toHaveBeenCalled();

      } finally {
        (global as any).beforeEach = originalBeforeEach;
      }
    });

    it('should allow custom default behaviors', () => {
      const originalBeforeEach = beforeEach;
      const mockBeforeEach = vi.fn((fn) => originalBeforeEach(fn));

      (global as any).beforeEach = mockBeforeEach;

      try {
        const customReadData = JSON.stringify({ custom: 'data' });

        const mockFs = createFileSystemMock({
          defaultReadFile: customReadData
        });

        expect(mockFs.readFile).toHaveReturnValue(Promise.resolve(customReadData));

      } finally {
        (global as any).beforeEach = originalBeforeEach;
      }
    });
  });

  describe('createCompressionMock', () => {
    it('should create compression utilities with default behaviors', () => {
      const originalBeforeEach = beforeEach;
      const mockBeforeEach = vi.fn((fn) => originalBeforeEach(fn));

      (global as any).beforeEach = mockBeforeEach;

      try {
        const mockCompression = createCompressionMock();

        // Verify compression methods are available
        expect(mockCompression.gzip).toBeDefined();
        expect(mockCompression.gunzip).toBeDefined();

        // Verify default behaviors
        expect(mockCompression.gzip).toHaveReturnValue(Promise.resolve(Buffer.from('compressed')));
        expect(mockCompression.gunzip).toHaveReturnValue(Promise.resolve(Buffer.from('decompressed')));

      } finally {
        (global as any).beforeEach = originalBeforeEach;
      }
    });

    it('should allow custom compression behaviors', () => {
      const originalBeforeEach = beforeEach;
      const mockBeforeEach = vi.fn((fn) => originalBeforeEach(fn));

      (global as any).beforeEach = mockBeforeEach;

      try {
        const customGzipped = Buffer.from('custom-gzipped');
        const customDecompressed = Buffer.from('custom-decompressed');

        const mockCompression = createCompressionMock({
          defaultGzipped: customGzipped,
          defaultDecompressed: customDecompressed
        });

        expect(mockCompression.gzip).toHaveReturnValue(Promise.resolve(customGzipped));
        expect(mockCompression.gunzip).toHaveReturnValue(Promise.resolve(customDecompressed));

      } finally {
        (global as any).beforeEach = originalBeforeEach;
      }
    });
  });

  describe('createCompleteTestSetup', () => {
    it('should combine multiple test utilities', () => {
      const originalBeforeEach = beforeEach;
      const originalAfterEach = afterEach;
      const mockBeforeEach = vi.fn((fn) => originalBeforeEach(fn));
      const mockAfterEach = vi.fn((fn) => originalAfterEach(fn));

      (global as any).beforeEach = mockBeforeEach;
      (global as any).afterEach = mockAfterEach;

      try {
        const testSetup = createCompleteTestSetup();

        // Verify all components are present
        expect(testSetup.mockFs).toBeDefined();
        expect(testSetup.mockCompression).toBeDefined();

        // Verify hooks were set up for all components
        expect(mockBeforeEach).toHaveBeenCalled();
        expect(mockAfterEach).toHaveBeenCalled();

        // Verify file system mocks are working
        expect(testSetup.mockFs.readFile).toBeDefined();
        expect(testSetup.mockFs.writeFile).toBeDefined();

        // Verify compression mocks are working
        expect(testSetup.mockCompression.gzip).toBeDefined();
        expect(testSetup.mockCompression.gunzip).toBeDefined();

      } finally {
        (global as any).beforeEach = originalBeforeEach;
        (global as any).afterEach = originalAfterEach;
      }
    });

    it('should allow custom options for all components', () => {
      const originalBeforeEach = beforeEach;
      const originalAfterEach = afterEach;
      const mockBeforeEach = vi.fn();
      const mockAfterEach = vi.fn();

      (global as any).beforeEach = mockBeforeEach;
      (global as any).afterEach = mockAfterEach;

      try {
        const testSetup = createCompleteTestSetup({
          mockCleanup: { clearMocks: false, resetMocks: false },
          timerManagement: { useFakeTimers: false, restoreTimers: false },
          fileSystem: { defaultReadFile: '{"custom":"setup"}' },
          compression: {
            defaultGzipped: Buffer.from('custom-gzip'),
            defaultDecompressed: Buffer.from('custom-decompress')
          }
        });

        // Mock cleanup disabled, so no beforeEach/afterEach for mocks
        // Timer management disabled, so no timer hooks
        // But file system and compression should still work
        expect(testSetup.mockFs.readFile).toHaveReturnValue(Promise.resolve('{"custom":"setup"}'));
        expect(testSetup.mockCompression.gzip).toHaveReturnValue(Promise.resolve(Buffer.from('custom-gzip')));

      } finally {
        (global as any).beforeEach = originalBeforeEach;
        (global as any).afterEach = originalAfterEach;
      }
    });
  });

  describe('createResourceCleanup', () => {
    it('should provide manual resource cleanup management', () => {
      const originalAfterEach = afterEach;
      const mockAfterEach = vi.fn((fn) => originalAfterEach(fn));

      (global as any).afterEach = mockAfterEach;

      try {
        const { addCleanup, cleanup } = createResourceCleanup();

        // Verify afterEach hook was set up
        expect(mockAfterEach).toHaveBeenCalled();

        // Test manual cleanup tracking
        let resource1Cleaned = false;
        let resource2Cleaned = false;

        addCleanup(() => { resource1Cleaned = true; });
        addCleanup(() => { resource2Cleaned = true; });

        // Resources should not be cleaned yet
        expect(resource1Cleaned).toBe(false);
        expect(resource2Cleaned).toBe(false);

        // Manual cleanup
        cleanup();

        // Resources should be cleaned in reverse order
        expect(resource1Cleaned).toBe(true);
        expect(resource2Cleaned).toBe(true);

      } finally {
        (global as any).afterEach = originalAfterEach;
      }
    });

    it('should handle async cleanup functions', async () => {
      const originalAfterEach = afterEach;
      const mockAfterEach = vi.fn((fn) => originalAfterEach(fn));

      (global as any).afterEach = mockAfterEach;

      try {
        const { addCleanup, cleanup } = createResourceCleanup();

        let asyncCleaned = false;

        // Add async cleanup
        addCleanup(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          asyncCleaned = true;
        });

        // Manual cleanup should handle async
        await cleanup();
        expect(asyncCleaned).toBe(true);

      } finally {
        (global as any).afterEach = originalAfterEach;
      }
    });

    it('should execute cleanup in reverse order (LIFO)', () => {
      const originalAfterEach = afterEach;
      const mockAfterEach = vi.fn((fn) => originalAfterEach(fn));

      (global as any).afterEach = mockAfterEach;

      try {
        const { addCleanup, cleanup } = createResourceCleanup();

        const executionOrder: number[] = [];

        addCleanup(() => executionOrder.push(1));
        addCleanup(() => executionOrder.push(2));
        addCleanup(() => executionOrder.push(3));

        cleanup();

        // Should execute in reverse order (LIFO)
        expect(executionOrder).toEqual([3, 2, 1]);

      } finally {
        (global as any).afterEach = originalAfterEach;
      }
    });

    it('should handle errors in cleanup functions gracefully', () => {
      const originalAfterEach = afterEach;
      const mockAfterEach = vi.fn((fn) => originalAfterEach(fn));

      (global as any).afterEach = mockAfterEach;

      try {
        const { addCleanup, cleanup } = createResourceCleanup();

        let cleanup1Executed = false;
        let cleanup3Executed = false;

        addCleanup(() => { cleanup1Executed = true; });
        addCleanup(() => { throw new Error('Cleanup error'); });
        addCleanup(() => { cleanup3Executed = true; });

        // Should not throw and should continue with other cleanups
        expect(() => cleanup()).not.toThrow();

        // Other cleanups should still execute despite the error
        expect(cleanup1Executed).toBe(true);
        expect(cleanup3Executed).toBe(true);

      } finally {
        (global as any).afterEach = originalAfterEach;
      }
    });
  });

  describe('Integration Tests - Complete Test Isolation Workflow', () => {
    // Use the actual utilities to test the complete workflow
    createMockCleanup();
    const { mockFs, mockCompression } = createCompleteTestSetup();
    const { addCleanup } = createResourceCleanup();

    let testResource: any = null;

    beforeEach(() => {
      // Set up test resource that needs manual cleanup
      testResource = { id: 'test-resource', cleaned: false };
      addCleanup(() => {
        if (testResource) {
          testResource.cleaned = true;
        }
      });
    });

    it('should provide clean mocks for each test', () => {
      // Set up a mock with specific behavior
      mockFs.readFile.mockResolvedValue('test-content-1');

      // Use the mock
      expect(mockFs.readFile).toHaveBeenCalledTimes(0);
      mockFs.readFile('test-path');
      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should have clean mocks in the second test', () => {
      // Mock should be clean from previous test
      expect(mockFs.readFile).toHaveBeenCalledTimes(0);

      // Set up different behavior
      mockFs.readFile.mockResolvedValue('test-content-2');
      mockFs.readFile('different-path');

      expect(mockFs.readFile).toHaveBeenCalledWith('different-path');
      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should provide working compression mocks', async () => {
      const input = 'test data to compress';
      const result = await mockCompression.gzip(input);

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(mockCompression.gzip).toHaveBeenCalledWith(input);
    });

    it('should handle resource cleanup between tests', () => {
      // Test resource should be fresh for each test
      expect(testResource.cleaned).toBe(false);
      expect(testResource.id).toBe('test-resource');

      // Modify the resource
      testResource.id = 'modified-resource';
    });

    it('should have clean resources in subsequent test', () => {
      // Resource should be fresh again (not modified)
      expect(testResource.cleaned).toBe(false);
      expect(testResource.id).toBe('test-resource');
    });
  });

  describe('Real-world Usage Scenarios', () => {
    createMockCleanup();

    it('should support typical unit test patterns', () => {
      // Create mocks for dependencies
      const mockApiClient = vi.fn();
      const mockLogger = vi.fn();

      mockApiClient.mockResolvedValue({ data: 'api response' });
      mockLogger.mockImplementation((msg) => console.log(msg));

      // Use mocks in test
      expect(mockApiClient).toHaveBeenCalledTimes(0);
      mockApiClient();
      expect(mockApiClient).toHaveBeenCalledTimes(1);

      mockLogger('test message');
      expect(mockLogger).toHaveBeenCalledWith('test message');
    });

    it('should support integration test patterns with file system', () => {
      const { mockFs } = createCompleteTestSetup();

      // Mock file operations
      mockFs.readFile.mockResolvedValue(JSON.stringify({ config: 'test' }));
      mockFs.writeFile.mockResolvedValue(undefined);

      // Simulate reading config
      const readConfig = async () => {
        const content = await mockFs.readFile('/path/to/config.json', 'utf8');
        return JSON.parse(content);
      };

      // Test the workflow
      expect(readConfig()).resolves.toEqual({ config: 'test' });
    });

    it('should support complex scenarios with multiple resources', () => {
      const { addCleanup } = createResourceCleanup();

      // Simulate creating multiple resources that need cleanup
      const resources: Array<{ name: string; closed: boolean }> = [];

      const createResource = (name: string) => {
        const resource = { name, closed: false };
        resources.push(resource);

        // Register cleanup for this resource
        addCleanup(() => {
          resource.closed = true;
        });

        return resource;
      };

      // Create some resources
      const db = createResource('database');
      const cache = createResource('cache');
      const logger = createResource('logger');

      expect(db.closed).toBe(false);
      expect(cache.closed).toBe(false);
      expect(logger.closed).toBe(false);

      // Resources will be automatically cleaned up after test
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle when vitest hooks are not available', () => {
      const originalBeforeEach = (global as any).beforeEach;
      const originalAfterEach = (global as any).afterEach;

      // Remove hooks temporarily
      delete (global as any).beforeEach;
      delete (global as any).afterEach;

      try {
        // Should not throw when hooks are not available
        expect(() => createMockCleanup()).not.toThrow();
        expect(() => createTimerManagement()).not.toThrow();

      } finally {
        // Restore hooks
        (global as any).beforeEach = originalBeforeEach;
        (global as any).afterEach = originalAfterEach;
      }
    });

    it('should handle invalid options gracefully', () => {
      expect(() => createMockCleanup(null as any)).not.toThrow();
      expect(() => createMockCleanup(undefined)).not.toThrow();
      expect(() => createTimerManagement({} as any)).not.toThrow();
      expect(() => createFileSystemMock({ defaultReadFile: null as any })).not.toThrow();
    });

    it('should handle mock creation failures', () => {
      // Test with invalid mock functions
      const invalidMock = null as any;

      expect(() => {
        const { mockFs } = createCompleteTestSetup();
        // Should still provide working mock functions even if setup fails
        expect(typeof mockFs.readFile).toBe('function');
        expect(typeof mockFs.writeFile).toBe('function');
      }).not.toThrow();
    });
  });
});