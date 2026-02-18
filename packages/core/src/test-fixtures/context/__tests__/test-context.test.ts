/**
 * @fileoverview Tests for TestContext Factory
 *
 * Validates that TestContext properly generates unique identifiers,
 * provides isolated namespaces, manages resources, and cleans up correctly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  createTestContext,
  useTestContext,
  createIntegrationTestContext,
  createUnitTestContext,
} from '../test-context.js';
import type { TestContext } from '../types.js';

describe('TestContext Factory', () => {
  describe('createTestContext', () => {
    let ctx: TestContext;

    afterEach(async () => {
      if (ctx && !ctx.isCleanedUp()) {
        await ctx.cleanup();
      }
    });

    describe('Basic Creation', () => {
      it('should create a TestContext with unique testId', () => {
        ctx = createTestContext();
        expect(ctx.testId).toBeDefined();
        expect(ctx.testId).toMatch(/^test_\d+_[a-z0-9]+$/);
      });

      it('should create different testIds for each instance', () => {
        const ctx1 = createTestContext();
        const ctx2 = createTestContext();

        expect(ctx1.testId).not.toBe(ctx2.testId);

        // Cleanup
        ctx1.cleanup();
        ctx2.cleanup();
      });

      it('should set namespace equal to testId by default', () => {
        ctx = createTestContext();
        expect(ctx.namespace).toBe(ctx.testId);
      });

      it('should set createdAt to current time', () => {
        const before = new Date();
        ctx = createTestContext();
        const after = new Date();

        expect(ctx.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(ctx.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      });

      it('should accept custom namespace prefix', () => {
        ctx = createTestContext({ namespacePrefix: 'custom' });
        expect(ctx.testId).toMatch(/^custom_\d+_[a-z0-9]+$/);
      });

      it('should accept custom seed for reproducible IDs', () => {
        const ctx1 = createTestContext({ seed: 'fixed_seed_123' });
        const ctx2 = createTestContext({ seed: 'fixed_seed_123' });

        expect(ctx1.testId).toBe(ctx2.testId);

        ctx1.cleanup();
        ctx2.cleanup();
      });

      it('should store options in readonly property', () => {
        const options = { namespacePrefix: 'mytest', suiteName: 'MySuite' };
        ctx = createTestContext(options);

        expect(ctx.options.namespacePrefix).toBe('mytest');
        expect(ctx.options.suiteName).toBe('MySuite');
      });
    });

    describe('ID Generation', () => {
      beforeEach(() => {
        ctx = createTestContext({ seed: 'test_seed' });
      });

      it('should generate unique IDs with uniqueId()', () => {
        const id1 = ctx.uniqueId();
        const id2 = ctx.uniqueId();

        expect(id1).not.toBe(id2);
        expect(id1).toContain(ctx.testId);
        expect(id2).toContain(ctx.testId);
      });

      it('should generate IDs with custom prefix', () => {
        const id = ctx.uniqueId('item');
        expect(id).toMatch(/^item_test_test_seed_\d+$/);
      });

      it('should generate task IDs with correct format', () => {
        const taskId = ctx.uniqueTaskId();
        expect(taskId).toMatch(/^task_test_test_seed_\d+$/);
      });

      it('should generate session IDs with correct format', () => {
        const sessionId = ctx.uniqueSessionId();
        expect(sessionId).toMatch(/^sess_test_test_seed_\d+$/);
      });

      it('should generate agent IDs with correct format', () => {
        const agentId = ctx.uniqueAgentId();
        expect(agentId).toMatch(/^agent_test_test_seed_\d+$/);
      });

      it('should generate workflow IDs with correct format', () => {
        const workflowId = ctx.uniqueWorkflowId();
        expect(workflowId).toMatch(/^wf_test_test_seed_\d+$/);
      });

      it('should generate checkpoint IDs with correct format', () => {
        const checkpointId = ctx.uniqueCheckpointId();
        expect(checkpointId).toMatch(/^checkpoint_test_test_seed_\d+$/);
      });

      it('should increment sequence counter', () => {
        expect(ctx.idSequence).toBe(0);

        ctx.uniqueId();
        expect(ctx.idSequence).toBe(1);

        ctx.uniqueTaskId();
        expect(ctx.idSequence).toBe(2);

        ctx.uniqueSessionId();
        expect(ctx.idSequence).toBe(3);
      });
    });

    describe('Namespace Utilities', () => {
      beforeEach(() => {
        ctx = createTestContext({ seed: 'ns_test' });
      });

      it('should create namespaced paths', () => {
        const path = ctx.namespacedPath('/data/file.txt');
        expect(path).toContain(ctx.namespace);
        expect(path).toContain('file.txt');
      });

      it('should create namespaced keys', () => {
        const key = ctx.namespacedKey('mykey');
        expect(key).toBe(`${ctx.namespace}:mykey`);
      });

      it('should create namespaced table names', () => {
        const table = ctx.namespacedTable('tasks');
        expect(table).toContain('tasks');
        expect(table).toContain(ctx.namespace.replace(/-/g, '_'));
      });

      it('should create namespaced env keys in uppercase', () => {
        const envKey = ctx.namespacedEnv('api_key');
        expect(envKey).toMatch(/^TEST_NS_TEST_API_KEY$/i);
      });
    });

    describe('Data Store', () => {
      beforeEach(() => {
        ctx = createTestContext();
      });

      it('should store and retrieve data', () => {
        ctx.setData('key1', 'value1');
        expect(ctx.getData('key1')).toBe('value1');
      });

      it('should return undefined for missing keys', () => {
        expect(ctx.getData('nonexistent')).toBeUndefined();
      });

      it('should store complex objects', () => {
        const obj = { nested: { deep: { value: 42 } } };
        ctx.setData('complex', obj);
        expect(ctx.getData('complex')).toEqual(obj);
      });

      it('should check if key exists with hasData', () => {
        ctx.setData('exists', true);
        expect(ctx.hasData('exists')).toBe(true);
        expect(ctx.hasData('notexists')).toBe(false);
      });

      it('should delete data with deleteData', () => {
        ctx.setData('toDelete', 'value');
        expect(ctx.hasData('toDelete')).toBe(true);

        const deleted = ctx.deleteData('toDelete');
        expect(deleted).toBe(true);
        expect(ctx.hasData('toDelete')).toBe(false);
      });

      it('should clear all data with clearData', () => {
        ctx.setData('key1', 'value1');
        ctx.setData('key2', 'value2');

        ctx.clearData();

        expect(ctx.hasData('key1')).toBe(false);
        expect(ctx.hasData('key2')).toBe(false);
      });

      it('should preserve type information with getData<T>', () => {
        interface User {
          name: string;
          age: number;
        }

        const user: User = { name: 'Test', age: 30 };
        ctx.setData('user', user);

        const retrieved = ctx.getData<User>('user');
        expect(retrieved?.name).toBe('Test');
        expect(retrieved?.age).toBe(30);
      });
    });

    describe('Lifecycle Management', () => {
      beforeEach(() => {
        ctx = createTestContext();
      });

      it('should track cleanup tasks', async () => {
        let cleaned = false;
        ctx.addCleanupTask(() => {
          cleaned = true;
        });

        await ctx.cleanup();
        expect(cleaned).toBe(true);
      });

      it('should run cleanup tasks in LIFO order', async () => {
        const order: number[] = [];

        ctx.addCleanupTask(() => order.push(1));
        ctx.addCleanupTask(() => order.push(2));
        ctx.addCleanupTask(() => order.push(3));

        await ctx.cleanup();

        expect(order).toEqual([3, 2, 1]);
      });

      it('should handle async cleanup tasks', async () => {
        let cleaned = false;
        ctx.addCleanupTask(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          cleaned = true;
        });

        await ctx.cleanup();
        expect(cleaned).toBe(true);
      });

      it('should mark context as cleaned up after cleanup()', async () => {
        expect(ctx.isCleanedUp()).toBe(false);
        await ctx.cleanup();
        expect(ctx.isCleanedUp()).toBe(true);
      });

      it('should be idempotent - calling cleanup() multiple times is safe', async () => {
        let count = 0;
        ctx.addCleanupTask(() => count++);

        await ctx.cleanup();
        await ctx.cleanup();
        await ctx.cleanup();

        expect(count).toBe(1);
      });

      it('should clear data after cleanup', async () => {
        ctx.setData('key', 'value');
        await ctx.cleanup();
        expect(ctx.getData('key')).toBeUndefined();
      });

      it('should continue cleanup even if a task throws', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        let secondTaskRan = false;

        ctx.addCleanupTask(() => secondTaskRan = true);
        ctx.addCleanupTask(() => {
          throw new Error('Cleanup error');
        });

        await ctx.cleanup();

        expect(secondTaskRan).toBe(true);
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });

    describe('Directory Management', () => {
      beforeEach(() => {
        ctx = createTestContext();
      });

      it('should create temp directory on demand', async () => {
        const tempDir = await ctx.createTempDir();

        expect(tempDir).toBeDefined();
        expect(tempDir).toContain(ctx.testId);

        // Verify directory exists
        const stat = await fs.stat(tempDir);
        expect(stat.isDirectory()).toBe(true);
      });

      it('should return same temp dir on repeated calls', async () => {
        const dir1 = await ctx.createTempDir();
        const dir2 = await ctx.createTempDir();

        expect(dir1).toBe(dir2);
      });

      it('should return undefined from getTempDir before creation', () => {
        expect(ctx.getTempDir()).toBeUndefined();
      });

      it('should return temp dir from getTempDir after creation', async () => {
        const created = await ctx.createTempDir();
        expect(ctx.getTempDir()).toBe(created);
      });

      it('should create subdirectories', async () => {
        const subDir = await ctx.createSubDir('nested/path/here');

        const stat = await fs.stat(subDir);
        expect(stat.isDirectory()).toBe(true);
        expect(subDir).toContain('nested');
      });

      it('should write files to temp directory', async () => {
        const filePath = await ctx.writeFile('test.txt', 'Hello, World!');

        const content = await fs.readFile(filePath, 'utf-8');
        expect(content).toBe('Hello, World!');
      });

      it('should create parent directories when writing files', async () => {
        const filePath = await ctx.writeFile('deep/nested/file.json', '{}');

        const content = await fs.readFile(filePath, 'utf-8');
        expect(content).toBe('{}');
      });

      it('should clean up temp directory on cleanup()', async () => {
        const tempDir = await ctx.createTempDir();
        await ctx.writeFile('test.txt', 'content');

        await ctx.cleanup();

        // Directory should be removed
        await expect(fs.stat(tempDir)).rejects.toThrow();
      });
    });
  });

  describe('useTestContext Hook', () => {
    it('should provide context, setup, and teardown', () => {
      const result = useTestContext();

      expect(result.context).toBeDefined();
      expect(typeof result.setup).toBe('function');
      expect(typeof result.teardown).toBe('function');
    });

    it('should create fresh context on each setup call', () => {
      const result = useTestContext();

      const id1 = result.context.testId;
      result.setup();
      const id2 = result.context.testId;

      expect(id1).not.toBe(id2);

      result.teardown();
    });

    it('should cleanup context on teardown', async () => {
      const result = useTestContext();

      result.setup();
      result.context.setData('key', 'value');

      await result.teardown();

      expect(result.context.isCleanedUp()).toBe(true);
    });

    it('should work with custom options', () => {
      const result = useTestContext({ namespacePrefix: 'hook' });

      expect(result.context.testId).toMatch(/^hook_/);

      result.teardown();
    });
  });

  describe('Convenience Factories', () => {
    describe('createIntegrationTestContext', () => {
      it('should create context with integration prefix', async () => {
        const ctx = createIntegrationTestContext();
        expect(ctx.testId).toMatch(/^integration_/);
        await ctx.cleanup();
      });

      it('should merge custom options', async () => {
        const ctx = createIntegrationTestContext({ suiteName: 'MySuite' });
        expect(ctx.options.suiteName).toBe('MySuite');
        await ctx.cleanup();
      });
    });

    describe('createUnitTestContext', () => {
      it('should create context with unit prefix', async () => {
        const ctx = createUnitTestContext();
        expect(ctx.testId).toMatch(/^unit_/);
        await ctx.cleanup();
      });

      it('should merge custom options', async () => {
        const ctx = createUnitTestContext({ testName: 'myTest' });
        expect(ctx.options.testName).toBe('myTest');
        await ctx.cleanup();
      });
    });
  });

  describe('Concurrent Usage', () => {
    it('should maintain isolation between concurrent contexts', async () => {
      const contexts: TestContext[] = [];
      const ids: Set<string> = new Set();

      // Create many contexts concurrently
      const promises = Array.from({ length: 20 }, async (_, i) => {
        const ctx = createTestContext({ namespacePrefix: `concurrent_${i}` });
        contexts.push(ctx);
        ids.add(ctx.testId);

        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));

        ctx.setData('index', i);
        return ctx;
      });

      await Promise.all(promises);

      // All IDs should be unique
      expect(ids.size).toBe(20);

      // Each context should have its own data
      for (let i = 0; i < contexts.length; i++) {
        expect(contexts[i].getData('index')).toBeDefined();
      }

      // Cleanup all
      await Promise.all(contexts.map(ctx => ctx.cleanup()));
    });

    it('should handle concurrent temp directory creation', async () => {
      const contexts = Array.from({ length: 5 }, () => createTestContext());

      const tempDirs = await Promise.all(
        contexts.map(ctx => ctx.createTempDir())
      );

      // All temp dirs should be unique
      const uniqueDirs = new Set(tempDirs);
      expect(uniqueDirs.size).toBe(5);

      // Cleanup all
      await Promise.all(contexts.map(ctx => ctx.cleanup()));
    });
  });
});
