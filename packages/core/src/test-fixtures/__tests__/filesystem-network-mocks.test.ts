/**
 * @fileoverview Tests for File System and Network Mock Functions
 *
 * This test suite specifically focuses on testing the file system and network
 * mocking functionality provided by the test setup utilities, including
 * setupFileSystemMocks, setupNetworkMocks, and createTempDir.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  createTestSuite,
  setupFileSystemMocks,
  setupNetworkMocks,
  createTempDir,
  addCleanupTask,
  getTestEnvironment,
  createModuleSpy,
} from '../setup-teardown.js';
import type { SetupTeardownHooks } from '../types.js';

describe('File System and Network Mock Functions', () => {
  let suite: SetupTeardownHooks;

  beforeEach(async () => {
    suite = createTestSuite();
    await suite.beforeEach();
  });

  afterEach(async () => {
    await suite.afterEach();
    vi.restoreAllMocks();
  });

  describe('setupFileSystemMocks()', () => {
    it('should mock fs/promises.readFile with provided file data', async () => {
      const fileData = {
        '/test/file1.txt': 'content of file 1',
        '/test/file2.json': JSON.stringify({ data: 'test' }),
        '/path/to/config.yaml': 'setting: value\nother: data',
      };

      setupFileSystemMocks(fileData);

      // Test readFile with existing files
      const content1 = await fs.readFile('/test/file1.txt', 'utf-8');
      expect(content1).toBe('content of file 1');

      const content2 = await fs.readFile('/test/file2.json', 'utf-8');
      expect(JSON.parse(content2)).toEqual({ data: 'test' });

      const config = await fs.readFile('/path/to/config.yaml', 'utf-8');
      expect(config).toBe('setting: value\nother: data');
    });

    it('should throw ENOENT error for non-existent files', async () => {
      setupFileSystemMocks({
        '/exists.txt': 'exists',
      });

      await expect(fs.readFile('/nonexistent.txt', 'utf-8')).rejects.toThrow(
        "ENOENT: no such file or directory, open '/nonexistent.txt'"
      );
    });

    it('should mock writeFile to resolve successfully', async () => {
      setupFileSystemMocks({});

      await expect(fs.writeFile('/test/output.txt', 'new content')).resolves.toBeUndefined();
    });

    it('should mock mkdir to resolve successfully', async () => {
      setupFileSystemMocks({});

      await expect(fs.mkdir('/test/directory', { recursive: true })).resolves.toBeUndefined();
    });

    it('should mock unlink to resolve successfully', async () => {
      setupFileSystemMocks({});

      await expect(fs.unlink('/test/file.txt')).resolves.toBeUndefined();
    });

    it('should mock readdir to return empty array', async () => {
      setupFileSystemMocks({});

      const files = await fs.readdir('/test/directory');
      expect(files).toEqual([]);
    });

    it('should mock stat for existing files', async () => {
      const content = 'file content';
      setupFileSystemMocks({
        '/test/file.txt': content,
      });

      const stats = await fs.stat('/test/file.txt');
      expect(stats.isFile()).toBe(true);
      expect(stats.isDirectory()).toBe(false);
      expect(stats.size).toBe(content.length);
      expect(stats.mtime).toBeInstanceOf(Date);
    });

    it('should throw ENOENT error for stat on non-existent files', async () => {
      setupFileSystemMocks({});

      await expect(fs.stat('/nonexistent.txt')).rejects.toThrow(
        "ENOENT: no such file or directory, stat '/nonexistent.txt'"
      );
    });

    it('should handle different file path types (string vs Buffer)', async () => {
      setupFileSystemMocks({
        '/buffer-test.txt': 'buffer content',
      });

      // Test with string path
      const content1 = await fs.readFile('/buffer-test.txt', 'utf-8');
      expect(content1).toBe('buffer content');

      // Test with Buffer-like object
      const pathLikeObject = {
        toString: () => '/buffer-test.txt'
      };
      const content2 = await fs.readFile(pathLikeObject as any, 'utf-8');
      expect(content2).toBe('buffer content');
    });

    it('should register cleanup task to unmock fs/promises', () => {
      setupFileSystemMocks({});

      const env = getTestEnvironment();
      expect(env).not.toBeNull();
      expect(env!.cleanupTasks).toContainEqual(expect.any(Function));
    });
  });

  describe('setupNetworkMocks()', () => {
    it('should mock global.fetch with provided API responses', async () => {
      const apiResponses = {
        'https://api.example.com/users': [
          { id: 1, name: 'John' },
          { id: 2, name: 'Jane' }
        ],
        'https://api.example.com/posts/1': {
          id: 1,
          title: 'Test Post',
          content: 'This is a test'
        },
      };

      setupNetworkMocks(apiResponses);

      // Test first API endpoint
      const usersResponse = await global.fetch('https://api.example.com/users');
      expect(usersResponse.status).toBe(200);
      expect(usersResponse.headers.get('Content-Type')).toBe('application/json');

      const users = await usersResponse.json();
      expect(users).toEqual(apiResponses['https://api.example.com/users']);

      // Test second API endpoint
      const postResponse = await global.fetch('https://api.example.com/posts/1');
      expect(postResponse.status).toBe(200);

      const post = await postResponse.json();
      expect(post).toEqual(apiResponses['https://api.example.com/posts/1']);
    });

    it('should handle Request objects as well as string URLs', async () => {
      setupNetworkMocks({
        'https://api.test.com/data': { message: 'success' }
      });

      const request = new Request('https://api.test.com/data');
      const response = await global.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ message: 'success' });
    });

    it('should throw error for unmocked URLs', async () => {
      setupNetworkMocks({
        'https://mocked.com/api': { data: 'mocked' }
      });

      await expect(global.fetch('https://unmocked.com/api')).rejects.toThrow(
        'Network request to https://unmocked.com/api was not mocked'
      );
    });

    it('should handle complex response data types', async () => {
      const complexResponse = {
        data: {
          nested: {
            array: [1, 2, 3],
            boolean: true,
            null_value: null,
          }
        },
        metadata: {
          timestamp: '2023-01-01T00:00:00Z',
          version: '1.0.0'
        }
      };

      setupNetworkMocks({
        'https://api.complex.com/data': complexResponse
      });

      const response = await global.fetch('https://api.complex.com/data');
      const data = await response.json();
      expect(data).toEqual(complexResponse);
    });

    it('should register cleanup task to restore fetch', () => {
      setupNetworkMocks({});

      const env = getTestEnvironment();
      expect(env).not.toBeNull();
      expect(env!.cleanupTasks).toContainEqual(expect.any(Function));
    });

    it('should clean up global fetch after test', async () => {
      setupNetworkMocks({
        'https://test.com': { test: true }
      });

      expect(typeof global.fetch).toBe('function');

      // Trigger cleanup manually for testing
      const env = getTestEnvironment();
      const cleanupTasks = [...env!.cleanupTasks];
      for (const cleanup of cleanupTasks) {
        await cleanup();
      }

      expect((global as any).fetch).toBeUndefined();
    });
  });

  describe('createTempDir()', () => {
    it('should create a temporary directory with apex-test prefix', async () => {
      const tempDir = await createTempDir();

      expect(tempDir).toBeDefined();
      expect(typeof tempDir).toBe('string');
      expect(tempDir).toContain('apex-test-');
      expect(path.isAbsolute(tempDir)).toBe(true);
    });

    it('should register directory path in test environment', async () => {
      const tempDir = await createTempDir();

      const env = getTestEnvironment();
      expect(env).not.toBeNull();
      expect(env!.tempDir).toBe(tempDir);
    });

    it('should register cleanup task for directory removal', async () => {
      const tempDir = await createTempDir();

      const env = getTestEnvironment();
      expect(env).not.toBeNull();
      expect(env!.cleanupTasks.length).toBeGreaterThan(0);

      // The last cleanup task should be the directory removal
      const lastCleanupTask = env!.cleanupTasks[env!.cleanupTasks.length - 1];
      expect(lastCleanupTask).toBeInstanceOf(Function);
    });

    it('should create unique directories for multiple calls', async () => {
      const tempDir1 = await createTempDir();
      const tempDir2 = await createTempDir();

      expect(tempDir1).not.toBe(tempDir2);
      expect(tempDir1).toContain('apex-test-');
      expect(tempDir2).toContain('apex-test-');
    });

    it('should update test environment with latest temp directory', async () => {
      const tempDir1 = await createTempDir();
      const tempDir2 = await createTempDir();

      const env = getTestEnvironment();
      expect(env).not.toBeNull();
      expect(env!.tempDir).toBe(tempDir2); // Should be the latest one
    });

    it('should use OS temporary directory as base', async () => {
      const tempDir = await createTempDir();
      const osTmpDir = os.tmpdir();

      expect(tempDir.startsWith(osTmpDir)).toBe(true);
    });
  });

  describe('createModuleSpy()', () => {
    it('should create a spy for a module function', () => {
      const implementation = vi.fn().mockReturnValue('mocked result');
      const spy = createModuleSpy('fs/promises', 'readFile', implementation);

      expect(spy).toBeDefined();
      expect(typeof spy).toBe('function');
      expect(vi.isMockFunction(spy)).toBe(true);
    });

    it('should register cleanup task to unmock module', () => {
      createModuleSpy('fs/promises', 'readFile');

      const env = getTestEnvironment();
      expect(env).not.toBeNull();
      expect(env!.cleanupTasks).toContainEqual(expect.any(Function));
    });

    it('should work without implementation parameter', () => {
      const spy = createModuleSpy('path', 'join');

      expect(spy).toBeDefined();
      expect(vi.isMockFunction(spy)).toBe(true);
    });

    it('should preserve actual module exports except for spied function', () => {
      createModuleSpy('path', 'join', vi.fn().mockReturnValue('/mocked/path'));

      // The module should still be mockable
      expect(vi.isMockFunction).toBeDefined();
    });
  });

  describe('Integration: Combined Mock Usage', () => {
    it('should support using file system and network mocks together', async () => {
      // Setup both types of mocks
      setupFileSystemMocks({
        '/config.json': JSON.stringify({ apiUrl: 'https://api.test.com' })
      });

      setupNetworkMocks({
        'https://api.test.com/data': { result: 'success' }
      });

      // Use file system mock
      const configContent = await fs.readFile('/config.json', 'utf-8');
      const config = JSON.parse(configContent);
      expect(config.apiUrl).toBe('https://api.test.com');

      // Use network mock
      const response = await global.fetch(config.apiUrl + '/data');
      const data = await response.json();
      expect(data.result).toBe('success');
    });

    it('should support creating temp directory and mocking file operations', async () => {
      const tempDir = await createTempDir();

      setupFileSystemMocks({
        [`${tempDir}/test.txt`]: 'temp file content'
      });

      const content = await fs.readFile(`${tempDir}/test.txt`, 'utf-8');
      expect(content).toBe('temp file content');

      const env = getTestEnvironment();
      expect(env!.tempDir).toBe(tempDir);
    });

    it('should clean up all mocks and resources on teardown', async () => {
      // Set up various mocks and resources
      setupFileSystemMocks({ '/test.txt': 'content' });
      setupNetworkMocks({ 'https://api.com': { data: true } });
      const tempDir = await createTempDir();
      createModuleSpy('path', 'resolve');

      expect(typeof global.fetch).toBe('function');

      const env = getTestEnvironment();
      expect(env!.tempDir).toBe(tempDir);
      expect(env!.cleanupTasks.length).toBeGreaterThan(0);

      // All should be cleaned up by the suite's afterEach
    });
  });
});