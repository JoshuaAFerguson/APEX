/**
 * Tests for unified parallel utilities module
 *
 * These tests verify that the unified parallel utilities module correctly
 * exports and integrates all parallel testing utilities from both the
 * orchestrator package and test-utils package.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  // Core parallel utilities
  getTestWorkerId,
  isParallelTestExecution,
  createParallelTestContext,
  createComprehensiveTestEnvironment,
  runWithComprehensiveIsolation,
  parallelTestPatterns,

  // Types
  type ParallelTestContext,
  type ComprehensiveTestEnvironment,
  type ComprehensiveTestOptions,
} from './parallel-utils';

describe('Parallel Utils Integration', () => {
  describe('Core Exports', () => {
    it('should export worker ID utilities', () => {
      expect(typeof getTestWorkerId).toBe('function');
      expect(typeof isParallelTestExecution).toBe('function');

      const workerId = getTestWorkerId();
      expect(typeof workerId).toBe('string');
      expect(workerId.length).toBeGreaterThan(0);
    });

    it('should export context creation utilities', () => {
      expect(typeof createParallelTestContext).toBe('function');
      expect(typeof createComprehensiveTestEnvironment).toBe('function');
      expect(typeof runWithComprehensiveIsolation).toBe('function');
    });

    it('should export pattern utilities', () => {
      expect(typeof parallelTestPatterns).toBe('object');
      expect(typeof parallelTestPatterns.simpleDatabase).toBe('function');
      expect(typeof parallelTestPatterns.simpleEventEmitter).toBe('function');
      expect(typeof parallelTestPatterns.shareResource).toBe('function');
      expect(typeof parallelTestPatterns.withCleanEnvironment).toBe('function');
      expect(typeof parallelTestPatterns.createWorkerTempDir).toBe('function');
    });
  });

  describe('Parallel Test Context', () => {
    let ctx: ParallelTestContext;

    afterEach(async () => {
      if (ctx) {
        await ctx.cleanup();
      }
    });

    it('should create isolated parallel test context', async () => {
      ctx = await createParallelTestContext({
        prefix: 'test-parallel-ctx',
        createDbStructure: true,
      });

      expect(ctx.workerId).toBeTruthy();
      expect(ctx.tempDir).toBeTruthy();
      expect(ctx.dbPath).toBeTruthy();
      expect(ctx.eventEmitter).toBeTruthy();
      expect(typeof ctx.cleanup).toBe('function');

      // Verify event emitter works
      let eventFired = false;
      ctx.eventEmitter.emitter.on('test', () => {
        eventFired = true;
      });

      ctx.eventEmitter.emitter.emit('test');
      expect(eventFired).toBe(true);
      expect(ctx.eventEmitter.getEventHistory()).toHaveLength(1);
    });

    it('should create context with unique worker ID', async () => {
      const ctx1 = await createParallelTestContext({ prefix: 'test1' });
      const ctx2 = await createParallelTestContext({ prefix: 'test2' });

      try {
        // Worker IDs should be the same (same process) but temp dirs should be different
        expect(ctx1.tempDir).not.toBe(ctx2.tempDir);
        expect(ctx1.dbPath).not.toBe(ctx2.dbPath);

        // Event emitters should be isolated
        ctx1.eventEmitter.emitter.emit('test1');
        ctx2.eventEmitter.emitter.emit('test2');

        expect(ctx1.eventEmitter.getEventHistory()).toHaveLength(1);
        expect(ctx2.eventEmitter.getEventHistory()).toHaveLength(1);
        expect(ctx1.eventEmitter.getEventHistory()[0].event).toBe('test1');
        expect(ctx2.eventEmitter.getEventHistory()[0].event).toBe('test2');
      } finally {
        await Promise.all([ctx1.cleanup(), ctx2.cleanup()]);
      }
    });
  });

  describe('Comprehensive Test Environment', () => {
    let env: ComprehensiveTestEnvironment;

    afterEach(async () => {
      if (env) {
        await env.cleanup();
      }
    });

    it('should create environment with parallel context only', async () => {
      env = await createComprehensiveTestEnvironment({
        prefix: 'comprehensive-minimal',
        withDatabase: true,
        withIsolation: false,
        withWorkerCoordination: false,
      });

      expect(env.workerId).toBeTruthy();
      expect(env.parallel).toBeTruthy();
      expect(env.isolation).toBeUndefined();
      expect(env.coordinator).toBeUndefined();
      expect(typeof env.cleanup).toBe('function');
    });

    it('should create environment with isolation enabled', async () => {
      env = await createComprehensiveTestEnvironment({
        prefix: 'comprehensive-isolation',
        withDatabase: true,
        withIsolation: true,
        withWorkerCoordination: false,
      });

      expect(env.workerId).toBeTruthy();
      expect(env.parallel).toBeTruthy();
      expect(env.isolation).toBeTruthy();
      expect(env.coordinator).toBeUndefined();

      // Test isolation features
      if (env.isolation) {
        const tempFile = await env.isolation.files.createTempFile('test.txt', 'content');
        expect(tempFile).toBeTruthy();

        env.isolation.env.setEnv('TEST_PARALLEL_VAR', 'test-value');
        expect(process.env.TEST_PARALLEL_VAR).toBe('test-value');
      }
    });

    it('should create environment with worker coordination enabled', async () => {
      env = await createComprehensiveTestEnvironment({
        prefix: 'comprehensive-coordination',
        withDatabase: false,
        withIsolation: false,
        withWorkerCoordination: true,
      });

      expect(env.workerId).toBeTruthy();
      expect(env.parallel).toBeTruthy();
      expect(env.isolation).toBeUndefined();
      expect(env.coordinator).toBeTruthy();

      // Test coordinator features
      if (env.coordinator) {
        expect(env.coordinator.getWorkerId()).toBe(env.workerId);
        const workers = env.coordinator.getWorkers();
        expect(Array.isArray(workers)).toBe(true);
      }
    });
  });

  describe('runWithComprehensiveIsolation', () => {
    it('should run test with automatic cleanup', async () => {
      let capturedEnv: ComprehensiveTestEnvironment | null = null;

      const result = await runWithComprehensiveIsolation(async (env) => {
        capturedEnv = env;

        expect(env.workerId).toBeTruthy();
        expect(env.parallel).toBeTruthy();

        // Use some features
        env.parallel.eventEmitter.emitter.emit('test-event', 'data');

        if (env.isolation) {
          await env.isolation.files.createTempFile('wrapper-test.txt', 'test');
          env.isolation.env.setEnv('WRAPPER_TEST', 'value');
        }

        return 'test-completed';
      }, {
        prefix: 'wrapper-test',
        withIsolation: true,
      });

      expect(result).toBe('test-completed');
      expect(capturedEnv).toBeTruthy();

      if (capturedEnv && capturedEnv.isolation) {
        // Environment variables should be restored
        expect(process.env.WRAPPER_TEST).toBeUndefined();
      }
    });

    it('should cleanup even if test throws error', async () => {
      let envCaptured = false;

      try {
        await runWithComprehensiveIsolation(async (env) => {
          envCaptured = true;
          expect(env.parallel).toBeTruthy();

          if (env.isolation) {
            env.isolation.env.setEnv('ERROR_TEST_VAR', 'should-be-cleaned');
          }

          throw new Error('Test error');
        }, {
          withIsolation: true,
        });
      } catch (error) {
        expect((error as Error).message).toBe('Test error');
      }

      expect(envCaptured).toBe(true);
      // Environment should still be cleaned up
      expect(process.env.ERROR_TEST_VAR).toBeUndefined();
    });
  });

  describe('Parallel Test Patterns', () => {
    it('should create simple database pattern', async () => {
      const { store, cleanup } = await parallelTestPatterns.simpleDatabase('pattern-db');

      try {
        expect(store).toBeTruthy();
        expect(typeof store.initialize).toBe('function');
      } finally {
        await cleanup();
      }
    });

    it('should create simple event emitter pattern', () => {
      const { emitter, cleanup } = parallelTestPatterns.simpleEventEmitter();

      try {
        expect(emitter).toBeTruthy();

        let eventFired = false;
        emitter.on('test', () => { eventFired = true; });
        emitter.emit('test');

        expect(eventFired).toBe(true);
      } finally {
        cleanup();
      }
    });

    it('should create worker temp directory pattern', async () => {
      const tempDir = await parallelTestPatterns.createWorkerTempDir('pattern-temp');

      expect(tempDir).toBeTruthy();
      expect(typeof tempDir).toBe('string');
      expect(tempDir.includes('pattern-temp')).toBe(true);
    });

    it('should run with clean environment pattern', async () => {
      const originalValue = process.env.PATTERN_TEST_VAR;

      try {
        const result = await parallelTestPatterns.withCleanEnvironment(async (envCtx) => {
          envCtx.set('PATTERN_TEST_VAR', 'pattern-value');
          expect(process.env.PATTERN_TEST_VAR).toBe('pattern-value');

          return 'pattern-result';
        });

        expect(result).toBe('pattern-result');
        expect(process.env.PATTERN_TEST_VAR).toBe(originalValue);
      } finally {
        if (originalValue !== undefined) {
          process.env.PATTERN_TEST_VAR = originalValue;
        } else {
          delete process.env.PATTERN_TEST_VAR;
        }
      }
    });
  });

  describe('Integration with Existing Tests', () => {
    it('should work alongside vitest test isolation', async () => {
      const testId = vi.fn();
      const { parallel, cleanup } = await createComprehensiveTestEnvironment({
        prefix: 'vitest-integration',
        withIsolation: false,
      });

      try {
        // Use vitest spy with our parallel utilities
        parallel.eventEmitter.emitter.on('spy-test', testId);
        parallel.eventEmitter.emitter.emit('spy-test', 'data');

        expect(testId).toHaveBeenCalledWith('data');
        expect(parallel.eventEmitter.getEventHistory()).toHaveLength(1);
      } finally {
        await cleanup();
      }
    });

    it('should maintain test isolation across multiple test contexts', async () => {
      const contexts: ParallelTestContext[] = [];

      try {
        // Create multiple contexts in parallel
        const contextPromises = Array.from({ length: 3 }, (_, i) =>
          createParallelTestContext({ prefix: `multi-${i}` })
        );

        const results = await Promise.all(contextPromises);
        contexts.push(...results);

        // Each should be isolated
        const tempDirs = contexts.map(ctx => ctx.tempDir);
        const uniqueTempDirs = new Set(tempDirs);
        expect(uniqueTempDirs.size).toBe(3);

        // Events should be isolated
        contexts.forEach((ctx, i) => {
          ctx.eventEmitter.emitter.emit(`event-${i}`, i);
        });

        contexts.forEach((ctx, i) => {
          const history = ctx.eventEmitter.getEventHistory();
          expect(history).toHaveLength(1);
          expect(history[0].event).toBe(`event-${i}`);
        });
      } finally {
        await Promise.all(contexts.map(ctx => ctx.cleanup()));
      }
    });
  });
});