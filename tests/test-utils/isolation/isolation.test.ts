/**
 * Test Isolation Utilities - Unit Tests
 *
 * Validates the test isolation system works correctly with:
 * - Unique test contexts
 * - State cleanup between tests
 * - Parallel test support without interference
 * - All isolation utilities (files, env, mocks, timers, processes)
 *
 * @see ADR-052 for architecture decisions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

import {
  createIsolatedTest,
  withIsolation,
  createTestContextFactory,
  generateTestId,
  CleanupPriority,
  type IsolatedTestContext,
} from './index';

describe('Test Isolation Utilities', () => {
  describe('generateTestId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateTestId();
      const id2 = generateTestId();

      expect(id1).not.toBe(id2);
    });

    it('should include custom prefix', () => {
      const id = generateTestId('custom');

      expect(id).toMatch(/^custom_\d+_[a-z0-9]+$/);
    });

    it('should use default prefix when not specified', () => {
      const id = generateTestId();

      expect(id).toMatch(/^test_\d+_[a-z0-9]+$/);
    });
  });

  describe('createIsolatedTest', () => {
    let ctx: IsolatedTestContext;

    afterEach(async () => {
      if (ctx) {
        await ctx.teardown();
      }
    });

    it('should create a unique context with ID and temp directory', async () => {
      ctx = await createIsolatedTest();

      expect(ctx.id).toMatch(/^test_\d+_[a-z0-9]+$/);
      expect(ctx.tempDir).toBeTruthy();

      // Temp directory should exist
      const stats = await fs.stat(ctx.tempDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should use custom prefix for context ID', async () => {
      ctx = await createIsolatedTest({ prefix: 'integration' });

      expect(ctx.id).toMatch(/^integration_\d+_[a-z0-9]+$/);
    });

    it('should create database path when withDatabase is true', async () => {
      ctx = await createIsolatedTest({ withDatabase: true });

      expect(ctx.dbPath).toBeTruthy();
      expect(ctx.dbPath).toContain('.db');
      expect(ctx.dbPath?.startsWith(ctx.tempDir)).toBe(true);
    });

    it('should not have database path when withDatabase is false', async () => {
      ctx = await createIsolatedTest({ withDatabase: false });

      expect(ctx.dbPath).toBeUndefined();
    });

    it('should initialize all isolation utilities', async () => {
      ctx = await createIsolatedTest();

      expect(ctx.files).toBeDefined();
      expect(ctx.env).toBeDefined();
      expect(ctx.mocks).toBeDefined();
      expect(ctx.timers).toBeDefined();
      expect(ctx.processes).toBeDefined();
    });

    it('should track start time', async () => {
      const before = new Date();
      ctx = await createIsolatedTest();
      const after = new Date();

      expect(ctx.startTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(ctx.startTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should calculate elapsed time', async () => {
      ctx = await createIsolatedTest();

      await new Promise(resolve => setTimeout(resolve, 50));
      const elapsed = ctx.getElapsed();

      expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some variance
    });
  });

  describe('FileSystemIsolation', () => {
    let ctx: IsolatedTestContext;

    afterEach(async () => {
      if (ctx) {
        await ctx.teardown();
      }
    });

    it('should create temp files with content', async () => {
      ctx = await createIsolatedTest();

      const filePath = await ctx.files.createTempFile('test.txt', 'hello world');

      expect(filePath.startsWith(ctx.tempDir)).toBe(true);
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('hello world');
    });

    it('should create temp directories', async () => {
      ctx = await createIsolatedTest();

      const dirPath = await ctx.files.createTempDir('subdir');

      expect(dirPath.startsWith(ctx.tempDir)).toBe(true);
      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create nested files automatically creating directories', async () => {
      ctx = await createIsolatedTest();

      const filePath = await ctx.files.createTempFile('deeply/nested/file.txt', 'nested content');

      expect(filePath.startsWith(ctx.tempDir)).toBe(true);
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('nested content');
    });

    it('should track external paths', async () => {
      ctx = await createIsolatedTest();

      ctx.files.trackPath('/some/external/path');
      const trackedPaths = ctx.files.getTrackedPaths();

      expect(trackedPaths).toContain('/some/external/path');
    });

    it('should cleanup all tracked paths on teardown', async () => {
      ctx = await createIsolatedTest();

      const file1 = await ctx.files.createTempFile('file1.txt', 'content1');
      const file2 = await ctx.files.createTempFile('file2.txt', 'content2');
      const dir1 = await ctx.files.createTempDir('dir1');

      await ctx.teardown();

      // All paths should be cleaned up
      await expect(fs.stat(file1)).rejects.toThrow();
      await expect(fs.stat(file2)).rejects.toThrow();
      await expect(fs.stat(dir1)).rejects.toThrow();
      await expect(fs.stat(ctx.tempDir)).rejects.toThrow();

      // Prevent double teardown
      ctx = null!;
    });
  });

  describe('EnvironmentIsolation', () => {
    let ctx: IsolatedTestContext;
    const testEnvKey = 'APEX_TEST_ISOLATION_VAR';

    beforeEach(() => {
      // Clean up test variable before each test
      delete process.env[testEnvKey];
    });

    afterEach(async () => {
      if (ctx) {
        await ctx.teardown();
      }
      // Clean up test variable after each test
      delete process.env[testEnvKey];
    });

    it('should set environment variables', async () => {
      ctx = await createIsolatedTest();

      ctx.env.setEnv(testEnvKey, 'test-value');

      expect(process.env[testEnvKey]).toBe('test-value');
    });

    it('should restore original environment on teardown', async () => {
      // Set an original value
      process.env[testEnvKey] = 'original-value';

      ctx = await createIsolatedTest();
      ctx.env.setEnv(testEnvKey, 'modified-value');

      expect(process.env[testEnvKey]).toBe('modified-value');

      await ctx.teardown();

      expect(process.env[testEnvKey]).toBe('original-value');

      // Prevent double teardown
      ctx = null!;
    });

    it('should delete environment variables', async () => {
      process.env[testEnvKey] = 'to-delete';

      ctx = await createIsolatedTest();
      ctx.env.deleteEnv(testEnvKey);

      expect(process.env[testEnvKey]).toBeUndefined();
    });

    it('should restore deleted variables on teardown', async () => {
      process.env[testEnvKey] = 'was-deleted';

      ctx = await createIsolatedTest();
      ctx.env.deleteEnv(testEnvKey);
      expect(process.env[testEnvKey]).toBeUndefined();

      await ctx.teardown();

      expect(process.env[testEnvKey]).toBe('was-deleted');

      // Prevent double teardown
      ctx = null!;
    });

    it('should track modified variables', async () => {
      ctx = await createIsolatedTest();

      ctx.env.setEnv('VAR_A', 'value_a');
      ctx.env.setEnv('VAR_B', 'value_b');

      const modified = ctx.env.getModified();

      expect(modified['VAR_A']).toBe('value_a');
      expect(modified['VAR_B']).toBe('value_b');

      // Clean up
      ctx.env.restore();
    });
  });

  describe('MockIsolation', () => {
    let ctx: IsolatedTestContext;

    afterEach(async () => {
      if (ctx) {
        await ctx.teardown();
      }
    });

    it('should create and track spies', async () => {
      ctx = await createIsolatedTest();

      const obj = { method: () => 'original' };
      const spy = ctx.mocks.spyOn(obj, 'method');

      obj.method();

      expect(spy).toHaveBeenCalled();
      expect(ctx.mocks.getActiveCount()).toBe(1);
    });

    it('should create mock functions', async () => {
      ctx = await createIsolatedTest();

      const mockFn = ctx.mocks.fn((x: number) => x * 2);

      expect(mockFn(5)).toBe(10);
      expect(mockFn).toHaveBeenCalledWith(5);
    });

    it('should restore spies on teardown', async () => {
      ctx = await createIsolatedTest();

      const obj = { method: () => 'original' };
      ctx.mocks.spyOn(obj, 'method').mockReturnValue('mocked');

      expect(obj.method()).toBe('mocked');

      await ctx.teardown();

      expect(obj.method()).toBe('original');

      // Prevent double teardown
      ctx = null!;
    });
  });

  describe('TimerIsolation', () => {
    let ctx: IsolatedTestContext;

    afterEach(async () => {
      if (ctx) {
        await ctx.teardown();
      }
    });

    it('should create and track timeouts', async () => {
      ctx = await createIsolatedTest();

      let executed = false;
      ctx.timers.setTimeout(() => {
        executed = true;
      }, 10);

      expect(ctx.timers.getActiveCount()).toBe(1);

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(executed).toBe(true);
    });

    it('should create and track intervals', async () => {
      ctx = await createIsolatedTest();

      let count = 0;
      ctx.timers.setInterval(() => {
        count++;
      }, 10);

      expect(ctx.timers.getActiveCount()).toBe(1);

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(count).toBeGreaterThan(0);
    });

    it('should clear all timers on teardown', async () => {
      ctx = await createIsolatedTest();

      let executed = false;
      ctx.timers.setTimeout(() => {
        executed = true;
      }, 1000);

      await ctx.teardown();

      // Timer should not execute
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(executed).toBe(false);

      // Prevent double teardown
      ctx = null!;
    });
  });

  describe('ProcessIsolation', () => {
    let ctx: IsolatedTestContext;

    afterEach(async () => {
      if (ctx) {
        await ctx.teardown();
      }
    });

    it('should track processes', async () => {
      ctx = await createIsolatedTest();

      const mockProcess = { kill: vi.fn().mockReturnValue(true), pid: 12345 };
      ctx.processes.track(mockProcess, 'test-process');

      expect(ctx.processes.getActiveCount()).toBe(1);
    });

    it('should kill all processes on teardown', async () => {
      ctx = await createIsolatedTest();

      const mockProcess = { kill: vi.fn().mockReturnValue(true), pid: 12345 };
      ctx.processes.track(mockProcess, 'test-process');

      await ctx.teardown();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');

      // Prevent double teardown
      ctx = null!;
    });
  });

  describe('Cleanup Priority', () => {
    let ctx: IsolatedTestContext;

    afterEach(async () => {
      if (ctx) {
        await ctx.teardown();
      }
    });

    it('should execute cleanup in priority order', async () => {
      ctx = await createIsolatedTest();

      const order: string[] = [];

      ctx.registerCleanup(() => { order.push('normal'); }, CleanupPriority.NORMAL, 'normal');
      ctx.registerCleanup(() => { order.push('high'); }, CleanupPriority.HIGH, 'high');
      ctx.registerCleanup(() => { order.push('critical'); }, CleanupPriority.CRITICAL, 'critical');
      ctx.registerCleanup(() => { order.push('low'); }, CleanupPriority.LOW, 'low');

      await ctx.teardown();

      // Higher priority should run first
      expect(order.indexOf('critical')).toBeLessThan(order.indexOf('high'));
      expect(order.indexOf('high')).toBeLessThan(order.indexOf('normal'));
      expect(order.indexOf('normal')).toBeLessThan(order.indexOf('low'));

      // Prevent double teardown
      ctx = null!;
    });

    it('should execute same-priority cleanup in LIFO order', async () => {
      ctx = await createIsolatedTest();

      const order: string[] = [];

      ctx.registerCleanup(() => { order.push('first'); }, CleanupPriority.NORMAL, 'first');
      ctx.registerCleanup(() => { order.push('second'); }, CleanupPriority.NORMAL, 'second');
      ctx.registerCleanup(() => { order.push('third'); }, CleanupPriority.NORMAL, 'third');

      await ctx.teardown();

      // Last registered should run first (LIFO within same priority)
      expect(order).toEqual(['third', 'second', 'first']);

      // Prevent double teardown
      ctx = null!;
    });
  });

  describe('withIsolation', () => {
    it('should create and teardown context automatically', async () => {
      let capturedTempDir: string | null = null;

      await withIsolation(async (ctx) => {
        capturedTempDir = ctx.tempDir;

        // Temp dir should exist during execution
        const stats = await fs.stat(ctx.tempDir);
        expect(stats.isDirectory()).toBe(true);
      });

      // Temp dir should be cleaned up after
      await expect(fs.stat(capturedTempDir!)).rejects.toThrow();
    });

    it('should cleanup even on error', async () => {
      let capturedTempDir: string | null = null;

      await expect(
        withIsolation(async (ctx) => {
          capturedTempDir = ctx.tempDir;
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      // Temp dir should still be cleaned up
      await expect(fs.stat(capturedTempDir!)).rejects.toThrow();
    });

    it('should pass options to createIsolatedTest', async () => {
      await withIsolation(
        async (ctx) => {
          expect(ctx.id).toMatch(/^custom_/);
          expect(ctx.dbPath).toBeTruthy();
        },
        { prefix: 'custom', withDatabase: true }
      );
    });
  });

  describe('createTestContextFactory', () => {
    it('should provide setup and teardown functions', async () => {
      const { setup, teardown, getContext } = createTestContextFactory({ prefix: 'factory' });

      await setup();
      const ctx = getContext();

      expect(ctx.id).toMatch(/^factory_/);

      await teardown();
    });

    it('should throw if getContext called before setup', () => {
      const { getContext } = createTestContextFactory();

      expect(() => getContext()).toThrow('Test context not initialized');
    });

    it('should create new context on each setup', async () => {
      const { setup, teardown, getContext } = createTestContextFactory();

      await setup();
      const id1 = getContext().id;
      await teardown();

      await setup();
      const id2 = getContext().id;
      await teardown();

      expect(id1).not.toBe(id2);
    });
  });

  describe('Parallel Test Isolation', () => {
    /**
     * This test verifies that multiple contexts created in parallel
     * do not interfere with each other.
     */
    it('should isolate parallel contexts', async () => {
      // Create multiple contexts in parallel
      const contexts = await Promise.all([
        createIsolatedTest({ prefix: 'parallel-1' }),
        createIsolatedTest({ prefix: 'parallel-2' }),
        createIsolatedTest({ prefix: 'parallel-3' }),
      ]);

      try {
        // Each should have unique ID and temp dir
        const ids = new Set(contexts.map(ctx => ctx.id));
        const tempDirs = new Set(contexts.map(ctx => ctx.tempDir));

        expect(ids.size).toBe(3);
        expect(tempDirs.size).toBe(3);

        // Create files in each context
        const files = await Promise.all(
          contexts.map((ctx, i) =>
            ctx.files.createTempFile(`file-${i}.txt`, `content-${i}`)
          )
        );

        // Files should be in different directories
        expect(new Set(files.map(f => path.dirname(f))).size).toBe(3);

        // Modify environment in each context
        contexts[0].env.setEnv('PARALLEL_TEST', 'ctx0');
        contexts[1].env.setEnv('PARALLEL_TEST', 'ctx1');
        contexts[2].env.setEnv('PARALLEL_TEST', 'ctx2');

        // Last write wins for the actual env var
        expect(process.env['PARALLEL_TEST']).toBe('ctx2');

      } finally {
        // Teardown all contexts
        await Promise.all(contexts.map(ctx => ctx.teardown()));
      }

      // After teardown, env should be restored (original was undefined)
      expect(process.env['PARALLEL_TEST']).toBeUndefined();
    });
  });

  describe('Data Storage', () => {
    let ctx: IsolatedTestContext;

    afterEach(async () => {
      if (ctx) {
        await ctx.teardown();
      }
    });

    it('should provide shared data storage', async () => {
      ctx = await createIsolatedTest();

      ctx.data['testKey'] = 'testValue';
      ctx.data['counter'] = 42;

      expect(ctx.data['testKey']).toBe('testValue');
      expect(ctx.data['counter']).toBe(42);
    });

    it('should isolate data between contexts', async () => {
      ctx = await createIsolatedTest();
      const ctx2 = await createIsolatedTest();

      ctx.data['key'] = 'value1';
      ctx2.data['key'] = 'value2';

      expect(ctx.data['key']).toBe('value1');
      expect(ctx2.data['key']).toBe('value2');

      await ctx2.teardown();
    });
  });
});
