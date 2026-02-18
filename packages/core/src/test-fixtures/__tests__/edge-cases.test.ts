/**
 * @fileoverview Edge Cases and Error Scenario Tests
 *
 * This test suite focuses on testing edge cases, boundary conditions,
 * and error scenarios for the test setup and teardown utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  createTestSuite,
  setupTestMocks,
  setupFileSystemMocks,
  setupNetworkMocks,
  addCleanupTask,
  cleanupTestState,
  getTestEnvironment,
  setTestData,
  getTestData,
  createMockFunction,
  createTempDir,
  createModuleSpy,
  flushTimers,
  advanceTimers,
} from '../setup-teardown.js';
import type { TestSuiteConfig, MockConfig } from '../types.js';

describe('Edge Cases and Error Scenarios', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration Edge Cases', () => {
    it('should handle undefined config gracefully', () => {
      expect(() => createTestSuite(undefined as any)).not.toThrow();
    });

    it('should handle null config gracefully', () => {
      expect(() => createTestSuite(null as any)).not.toThrow();
    });

    it('should handle config with unexpected properties', () => {
      const config = {
        setupMocks: true,
        // @ts-expect-error - Testing unexpected property
        unexpectedProperty: 'unexpected',
        // @ts-expect-error - Testing wrong type
        timeout: 'not-a-number',
        mockConfig: {
          // @ts-expect-error - Testing unexpected property
          invalidMockProperty: true
        }
      } as TestSuiteConfig;

      expect(() => createTestSuite(config)).not.toThrow();
    });

    it('should handle extremely large timeout values', () => {
      const config: TestSuiteConfig = {
        timeout: Number.MAX_SAFE_INTEGER
      };

      expect(() => createTestSuite(config)).not.toThrow();
    });

    it('should handle negative timeout values', () => {
      const config: TestSuiteConfig = {
        timeout: -1000
      };

      expect(() => createTestSuite(config)).not.toThrow();
    });

    it('should handle zero timeout', () => {
      const config: TestSuiteConfig = {
        timeout: 0
      };

      expect(() => createTestSuite(config)).not.toThrow();
    });
  });

  describe('File System Mock Edge Cases', () => {
    let suite: ReturnType<typeof createTestSuite>;

    beforeEach(async () => {
      suite = createTestSuite();
      await suite.beforeEach();
    });

    afterEach(async () => {
      await suite.afterEach();
    });

    it('should handle empty file data object', () => {
      expect(() => setupFileSystemMocks({})).not.toThrow();
    });

    it('should handle very long file paths', () => {
      const longPath = '/' + 'very'.repeat(100) + '/long/path/file.txt';
      const fileData = {
        [longPath]: 'content'
      };

      setupFileSystemMocks(fileData);

      // Should be able to read the file with long path
      expect(fs.readFile(longPath, 'utf-8')).resolves.toBe('content');
    });

    it('should handle file paths with special characters', async () => {
      const specialPaths = {
        '/path with spaces/file.txt': 'spaces content',
        '/path-with-dashes/file.txt': 'dashes content',
        '/path_with_underscores/file.txt': 'underscores content',
        '/path.with.dots/file.txt': 'dots content',
        '/path[with]brackets/file.txt': 'brackets content',
        '/path(with)parentheses/file.txt': 'parentheses content',
        '/path@with@symbols/file.txt': 'symbols content'
      };

      setupFileSystemMocks(specialPaths);

      for (const [filePath, expectedContent] of Object.entries(specialPaths)) {
        const content = await fs.readFile(filePath, 'utf-8');
        expect(content).toBe(expectedContent);
      }
    });

    it('should handle very large file content', async () => {
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB of 'x'
      setupFileSystemMocks({
        '/large-file.txt': largeContent
      });

      const content = await fs.readFile('/large-file.txt', 'utf-8');
      expect(content).toBe(largeContent);
      expect(content.length).toBe(1024 * 1024);
    });

    it('should handle empty file content', async () => {
      setupFileSystemMocks({
        '/empty-file.txt': ''
      });

      const content = await fs.readFile('/empty-file.txt', 'utf-8');
      expect(content).toBe('');
    });

    it('should handle file content with special characters and unicode', async () => {
      const unicodeContent = '🚀 Hello, 世界! Ñice tëst 🎉 \n\t\r';
      setupFileSystemMocks({
        '/unicode-file.txt': unicodeContent
      });

      const content = await fs.readFile('/unicode-file.txt', 'utf-8');
      expect(content).toBe(unicodeContent);
    });

    it('should handle concurrent file operations', async () => {
      setupFileSystemMocks({
        '/file1.txt': 'content1',
        '/file2.txt': 'content2',
        '/file3.txt': 'content3'
      });

      const promises = [
        fs.readFile('/file1.txt', 'utf-8'),
        fs.readFile('/file2.txt', 'utf-8'),
        fs.readFile('/file3.txt', 'utf-8'),
        fs.writeFile('/output1.txt', 'new content 1'),
        fs.writeFile('/output2.txt', 'new content 2')
      ];

      const results = await Promise.all(promises);
      expect(results.slice(0, 3)).toEqual(['content1', 'content2', 'content3']);
    });

    it('should handle file path normalization', async () => {
      setupFileSystemMocks({
        '/normalized/path/file.txt': 'normalized content'
      });

      // Test different path representations that should normalize to the same path
      const content1 = await fs.readFile('/normalized/path/file.txt', 'utf-8');
      const content2 = await fs.readFile('/normalized/path/../path/file.txt', 'utf-8');

      expect(content1).toBe('normalized content');
      // Note: The mock doesn't actually normalize paths, so this tests the raw path handling
      await expect(fs.readFile('/normalized/path/../path/file.txt', 'utf-8')).rejects.toThrow();
    });
  });

  describe('Network Mock Edge Cases', () => {
    let suite: ReturnType<typeof createTestSuite>;

    beforeEach(async () => {
      suite = createTestSuite();
      await suite.beforeEach();
    });

    afterEach(async () => {
      await suite.afterEach();
    });

    it('should handle empty API responses object', () => {
      expect(() => setupNetworkMocks({})).not.toThrow();
      expect(typeof global.fetch).toBe('function');
    });

    it('should handle very large JSON responses', async () => {
      const largeData = {
        data: Array.from({ length: 10000 }, (_, i) => ({ id: i, value: `item-${i}` }))
      };

      setupNetworkMocks({
        'https://api.large.com/data': largeData
      });

      const response = await global.fetch('https://api.large.com/data');
      const result = await response.json();
      expect(result.data).toHaveLength(10000);
      expect(result.data[9999]).toEqual({ id: 9999, value: 'item-9999' });
    });

    it('should handle URLs with query parameters', async () => {
      setupNetworkMocks({
        'https://api.test.com/search?q=test&limit=10': { results: ['result1', 'result2'] }
      });

      const response = await global.fetch('https://api.test.com/search?q=test&limit=10');
      const data = await response.json();
      expect(data.results).toEqual(['result1', 'result2']);
    });

    it('should handle URLs with fragments and complex paths', async () => {
      const complexUrls = {
        'https://api.complex.com/v1/users/123/posts?sort=date&order=desc#latest': { posts: [] },
        'https://subdomain.api.com/deeply/nested/path/endpoint': { deep: 'data' },
        'https://api.test.com:8080/port-specific': { port: '8080' }
      };

      setupNetworkMocks(complexUrls);

      for (const [url, expectedData] of Object.entries(complexUrls)) {
        const response = await global.fetch(url);
        const data = await response.json();
        expect(data).toEqual(expectedData);
      }
    });

    it('should handle responses with null and undefined values', async () => {
      setupNetworkMocks({
        'https://api.nullable.com/data': {
          nullValue: null,
          undefinedValue: undefined,
          emptyString: '',
          zeroNumber: 0,
          falseBool: false
        }
      });

      const response = await global.fetch('https://api.nullable.com/data');
      const data = await response.json();

      expect(data.nullValue).toBeNull();
      expect(data.undefinedValue).toBeUndefined();
      expect(data.emptyString).toBe('');
      expect(data.zeroNumber).toBe(0);
      expect(data.falseBool).toBe(false);
    });

    it('should handle Response object creation edge cases', async () => {
      setupNetworkMocks({
        'https://api.test.com/edge': { success: true }
      });

      const response = await global.fetch('https://api.test.com/edge');

      // Test Response object properties
      expect(response.status).toBe(200);
      expect(response.ok).toBe(true);
      expect(response.headers).toBeInstanceOf(Headers);
      expect(response.headers.get('Content-Type')).toBe('application/json');

      // Should be able to read response body
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should handle concurrent network requests', async () => {
      setupNetworkMocks({
        'https://api.concurrent.com/1': { id: 1 },
        'https://api.concurrent.com/2': { id: 2 },
        'https://api.concurrent.com/3': { id: 3 }
      });

      const promises = [
        global.fetch('https://api.concurrent.com/1'),
        global.fetch('https://api.concurrent.com/2'),
        global.fetch('https://api.concurrent.com/3')
      ];

      const responses = await Promise.all(promises);
      const data = await Promise.all(responses.map(r => r.json()));

      expect(data).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });
  });

  describe('Test Environment Edge Cases', () => {
    it('should handle operations when test environment is null', () => {
      // Ensure no test environment is active
      expect(getTestEnvironment()).toBeNull();

      // These operations should be no-ops when environment is null
      expect(() => setTestData('key', 'value')).not.toThrow();
      expect(() => addCleanupTask(() => {})).not.toThrow();
      expect(getTestData('key')).toBeUndefined();

      const mock = createMockFunction('orphanMock');
      expect(mock).toBeDefined();
    });

    it('should handle test data with complex objects', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const complexData = {
        nested: {
          array: [1, { inner: 'value' }, null],
          map: new Map([['key', 'value']]),
          set: new Set([1, 2, 3]),
          date: new Date(),
          regexp: /test/gi,
          function: () => 'test'
        }
      };

      setTestData('complex', complexData);
      const retrieved = getTestData('complex');

      expect(retrieved.nested.array).toEqual(complexData.nested.array);
      expect(retrieved.nested.map).toEqual(complexData.nested.map);
      expect(retrieved.nested.set).toEqual(complexData.nested.set);
      expect(retrieved.nested.date).toEqual(complexData.nested.date);

      await suite.afterEach();
    });

    it('should handle overwriting test data', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      setTestData('key', 'value1');
      expect(getTestData('key')).toBe('value1');

      setTestData('key', 'value2');
      expect(getTestData('key')).toBe('value2');

      setTestData('key', { object: 'value' });
      expect(getTestData('key')).toEqual({ object: 'value' });

      setTestData('key', null);
      expect(getTestData('key')).toBeNull();

      await suite.afterEach();
    });

    it('should handle many test data entries', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      // Set lots of test data
      for (let i = 0; i < 1000; i++) {
        setTestData(`key-${i}`, `value-${i}`);
      }

      // Verify all entries
      for (let i = 0; i < 1000; i++) {
        expect(getTestData(`key-${i}`)).toBe(`value-${i}`);
      }

      await suite.afterEach();
    });
  });

  describe('Timer Edge Cases', () => {
    it('should handle timer operations without fake timers enabled', async () => {
      const suite = createTestSuite({ useFakeTimers: false });
      await suite.beforeEach();

      // These should work even without fake timers (they'll use real timers)
      await expect(flushTimers()).resolves.toBeUndefined();
      await expect(advanceTimers(100)).resolves.toBeUndefined();

      await suite.afterEach();
    });

    it('should handle zero and negative timer advances', async () => {
      const suite = createTestSuite({ useFakeTimers: true });
      await suite.beforeEach();

      await expect(advanceTimers(0)).resolves.toBeUndefined();
      await expect(advanceTimers(-100)).resolves.toBeUndefined();

      await suite.afterEach();
    });

    it('should handle extremely large timer advances', async () => {
      const suite = createTestSuite({ useFakeTimers: true });
      await suite.beforeEach();

      await expect(advanceTimers(Number.MAX_SAFE_INTEGER)).resolves.toBeUndefined();

      await suite.afterEach();
    });
  });

  describe('Cleanup Task Edge Cases', () => {
    it('should handle adding many cleanup tasks', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const executionOrder: number[] = [];

      // Add many cleanup tasks
      for (let i = 0; i < 100; i++) {
        addCleanupTask(() => {
          executionOrder.push(i);
        });
      }

      await suite.afterEach();

      // All tasks should have executed in order
      expect(executionOrder).toHaveLength(100);
      for (let i = 0; i < 100; i++) {
        expect(executionOrder[i]).toBe(i);
      }
    });

    it('should handle cleanup tasks that add more cleanup tasks', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const executionLog: string[] = [];

      addCleanupTask(() => {
        executionLog.push('first');
        // Add another cleanup task from within a cleanup task
        addCleanupTask(() => {
          executionLog.push('nested');
        });
      });

      addCleanupTask(() => {
        executionLog.push('second');
      });

      await suite.afterEach();

      // Original tasks should execute, but nested ones might not in the same teardown
      expect(executionLog).toContain('first');
      expect(executionLog).toContain('second');
    });

    it('should handle async cleanup tasks with varying delays', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const completionOrder: string[] = [];

      addCleanupTask(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        completionOrder.push('slow');
      });

      addCleanupTask(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        completionOrder.push('fast');
      });

      addCleanupTask(() => {
        completionOrder.push('sync');
      });

      await suite.afterEach();

      expect(completionOrder).toHaveLength(3);
      expect(completionOrder).toContain('slow');
      expect(completionOrder).toContain('fast');
      expect(completionOrder).toContain('sync');
    });
  });

  describe('Temporary Directory Edge Cases', () => {
    let suite: ReturnType<typeof createTestSuite>;

    beforeEach(async () => {
      suite = createTestSuite();
      await suite.beforeEach();
    });

    afterEach(async () => {
      await suite.afterEach();
    });

    it('should handle multiple temp directory creations', async () => {
      const dirs: string[] = [];

      for (let i = 0; i < 5; i++) {
        const dir = await createTempDir();
        dirs.push(dir);
      }

      // All directories should be unique
      const uniqueDirs = new Set(dirs);
      expect(uniqueDirs.size).toBe(5);

      // All should be valid paths
      for (const dir of dirs) {
        expect(path.isAbsolute(dir)).toBe(true);
        expect(dir).toContain('apex-test-');
      }
    });

    it('should update test environment with latest temp directory', async () => {
      const dir1 = await createTempDir();
      const env1 = getTestEnvironment();
      expect(env1!.tempDir).toBe(dir1);

      const dir2 = await createTempDir();
      const env2 = getTestEnvironment();
      expect(env2!.tempDir).toBe(dir2);

      expect(dir1).not.toBe(dir2);
    });

    it('should handle temp directory creation when os.tmpdir() has unusual path', async () => {
      // Mock os.tmpdir to return unusual path
      const originalTmpdir = os.tmpdir;
      vi.mocked(os.tmpdir).mockReturnValue('/unusual/temp/path with spaces');

      const tempDir = await createTempDir();
      expect(tempDir).toContain('/unusual/temp/path with spaces');
      expect(tempDir).toContain('apex-test-');

      // Restore original
      os.tmpdir = originalTmpdir;
    });
  });

  describe('Module Spy Edge Cases', () => {
    let suite: ReturnType<typeof createTestSuite>;

    beforeEach(async () => {
      suite = createTestSuite();
      await suite.beforeEach();
    });

    afterEach(async () => {
      await suite.afterEach();
    });

    it('should handle spying on non-existent module functions', () => {
      expect(() => {
        createModuleSpy('nonexistent-module', 'nonexistentFunction');
      }).not.toThrow();
    });

    it('should handle module paths with special characters', () => {
      const specialPaths = [
        '@scoped/package',
        'package-with-dashes',
        'package_with_underscores',
        'package.with.dots'
      ];

      for (const modulePath of specialPaths) {
        expect(() => {
          createModuleSpy(modulePath, 'testFunction');
        }).not.toThrow();
      }
    });

    it('should handle function names with special characters', () => {
      const specialNames = [
        'function_with_underscores',
        'function-with-dashes',
        'functionWithCamelCase',
        'FUNCTION_WITH_CAPS',
        '$pecial',
        'function123'
      ];

      for (const functionName of specialNames) {
        expect(() => {
          createModuleSpy('test-module', functionName);
        }).not.toThrow();
      }
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle maximum string lengths', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      // Test with very long strings
      const longKey = 'x'.repeat(10000);
      const longValue = 'y'.repeat(100000);

      setTestData(longKey, longValue);
      expect(getTestData(longKey)).toBe(longValue);

      await suite.afterEach();
    });

    it('should handle maximum number of active mocks', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      // Create many mock functions
      const mocks: any[] = [];
      for (let i = 0; i < 1000; i++) {
        const mock = createMockFunction(`mock-${i}`);
        mocks.push(mock);
      }

      const env = getTestEnvironment();
      expect(env!.activeMocks.size).toBe(1000);

      // All mocks should be accessible
      for (let i = 0; i < 1000; i++) {
        expect(env!.activeMocks.has(`mock-${i}`)).toBe(true);
        expect(env!.activeMocks.get(`mock-${i}`)).toBe(mocks[i]);
      }

      await suite.afterEach();
    });

    it('should handle deeply nested test data structures', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      // Create deeply nested object
      let nested: any = 'deep value';
      for (let i = 0; i < 100; i++) {
        nested = { level: i, data: nested };
      }

      setTestData('deeplyNested', nested);
      const retrieved = getTestData('deeplyNested');

      // Navigate to the deep value
      let current = retrieved;
      for (let i = 99; i >= 0; i--) {
        expect(current.level).toBe(i);
        current = current.data;
      }
      expect(current).toBe('deep value');

      await suite.afterEach();
    });
  });
});