/**
 * Performance tests for ApprovalGateController
 *
 * Tests performance under various load conditions and stress scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'eventemitter3';
import {
  ApprovalGateController,
  type ApprovalGateOptions,
} from '../approval-gate-controller';
import { TaskStore } from '../store';
import type { ApprovalGate as ApprovalGateConfig } from '@apexcli/core';

describe('ApprovalGateController - Performance', () => {
  let testDir: string;
  let store: TaskStore;
  let parentEmitter: EventEmitter;

  const createTestGateConfig = (id: string): ApprovalGateConfig => ({
    id,
    type: 'stage-completion',
    name: `Performance Test Gate ${id}`,
    description: 'Performance testing gate',
    required: true,
    timeout: undefined,
    autoApprove: false,
    autoApproveOnTimeout: false,
    minApprovals: 1,
    tags: ['performance'],
  });

  const createTestOptions = (gateId: string, taskId: string): ApprovalGateOptions => ({
    config: createTestGateConfig(gateId),
    taskId,
    stage: 'testing',
    agent: 'performance-tester',
    store,
    parentEmitter,
    context: {
      testType: 'performance',
      gateId,
    },
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-approval-perf-test-'));
    store = new TaskStore(path.join(testDir, 'performance.db'));
    parentEmitter = new EventEmitter();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('single controller performance', () => {
    it('should handle rapid approval requests efficiently', async () => {
      const controller = new ApprovalGateController(createTestOptions('rapid-1', 'task-1'));

      const startTime = Date.now();

      // Rapid approval/denial cycles
      for (let i = 0; i < 10; i++) {
        const approvalPromise = controller.requestApproval();

        if (i % 2 === 0) {
          await controller.grant(`approver-${i}`, `Approval ${i}`);
        } else {
          await controller.deny(`denier-${i}`, `Denial ${i}`);
        }

        await approvalPromise;

        // Reset for next iteration (create new controller)
        controller.dispose();
        const newController = new ApprovalGateController(
          createTestOptions(`rapid-${i + 2}`, `task-${i + 2}`)
        );
        Object.setPrototypeOf(controller, newController);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete 10 cycles in under 1 second
      expect(duration).toBeLessThan(1000);

      controller.dispose();
    }, 10000);

    it('should handle large number of event listeners efficiently', async () => {
      const controller = new ApprovalGateController(createTestOptions('listeners-1', 'task-1'));

      const startTime = Date.now();

      // Add many event listeners
      const listeners: Array<() => void> = [];
      for (let i = 0; i < 100; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        controller.on('approval:requested', listener);
        controller.on('approval:resolved', listener);
      }

      const approvalPromise = controller.requestApproval();
      await controller.grant('listener-tester', 'Many listeners test');
      await approvalPromise;

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle 100 listeners efficiently
      expect(duration).toBeLessThan(500);

      // Verify all listeners were called
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalled();
      });

      controller.dispose();
    }, 10000);

    it('should handle frequent state queries efficiently', async () => {
      const controller = new ApprovalGateController(createTestOptions('query-1', 'task-1'));

      const approvalPromise = controller.requestApproval();

      const startTime = Date.now();

      // Query state frequently while approval is pending
      for (let i = 0; i < 1000; i++) {
        const state = controller.approvalState;
        expect(state.status).toBe('pending');

        const isPending = controller.isPending;
        expect(isPending).toBe(true);

        const isResolved = controller.isResolved;
        expect(isResolved).toBe(false);
      }

      const queryTime = Date.now();
      const queryDuration = queryTime - startTime;

      await controller.grant('query-tester', 'Query test');
      await approvalPromise;

      // 1000 state queries should be very fast
      expect(queryDuration).toBeLessThan(50);

      controller.dispose();
    }, 10000);
  });

  describe('multiple controllers performance', () => {
    it('should handle many concurrent approval gates efficiently', async () => {
      const controllerCount = 50;
      const controllers: ApprovalGateController[] = [];
      const approvalPromises: Promise<any>[] = [];

      const startTime = Date.now();

      // Create many controllers concurrently
      for (let i = 0; i < controllerCount; i++) {
        const controller = new ApprovalGateController(
          createTestOptions(`concurrent-${i}`, `task-${i}`)
        );
        controllers.push(controller);

        const promise = controller.requestApproval();
        approvalPromises.push(promise);
      }

      const setupTime = Date.now();

      // Approve all concurrently
      const approvePromises = controllers.map((controller, index) =>
        controller.grant(`approver-${index}`, `Concurrent approval ${index}`)
      );

      await Promise.all(approvePromises);
      const results = await Promise.all(approvalPromises);

      const endTime = Date.now();

      const setupDuration = setupTime - startTime;
      const totalDuration = endTime - startTime;

      expect(results).toHaveLength(controllerCount);
      results.forEach(result => {
        expect(result.status).toBe('approved');
      });

      // Should handle 50 concurrent approvals efficiently
      expect(totalDuration).toBeLessThan(2000);
      expect(setupDuration).toBeLessThan(500);

      // Clean up
      controllers.forEach(controller => controller.dispose());
    }, 15000);

    it('should handle rapid controller creation and disposal', async () => {
      const iterations = 100;

      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const controller = new ApprovalGateController(
          createTestOptions(`disposal-${i}`, `task-${i}`)
        );

        // Quick lifecycle
        const promise = controller.requestApproval();
        await controller.grant(`quick-${i}`, 'Quick approval');
        await promise;

        controller.dispose();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should create/dispose 100 controllers quickly
      expect(duration).toBeLessThan(3000);
    }, 15000);
  });

  describe('database performance', () => {
    it('should handle many approval state saves efficiently', async () => {
      const saveCount = 100;
      const controllers: ApprovalGateController[] = [];

      const startTime = Date.now();

      // Create and request many approvals (which saves to DB)
      const promises: Promise<any>[] = [];
      for (let i = 0; i < saveCount; i++) {
        const controller = new ApprovalGateController(
          createTestOptions(`save-${i}`, `task-${i}`)
        );
        controllers.push(controller);

        const promise = controller.requestApproval().then(() =>
          controller.grant(`saver-${i}`, `Save test ${i}`)
        );
        promises.push(promise);
      }

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle 100 database saves efficiently
      expect(duration).toBeLessThan(5000);

      // Verify all states were saved
      for (let i = 0; i < saveCount; i++) {
        const state = await store.getApprovalStateById(`save-${i}`);
        expect(state).toBeDefined();
        expect(state!.status).toBe('approved');
      }

      controllers.forEach(controller => controller.dispose());
    }, 20000);

    it('should handle approval state queries under load', async () => {
      // Create some approval states first
      const stateCount = 50;
      const controllers: ApprovalGateController[] = [];

      for (let i = 0; i < stateCount; i++) {
        const controller = new ApprovalGateController(
          createTestOptions(`query-${i}`, `task-${i % 10}`) // Group tasks
        );
        controllers.push(controller);

        await controller.requestApproval();
        await controller.grant(`setup-${i}`, 'Setup data');
      }

      const startTime = Date.now();

      // Perform many queries
      const queryPromises: Promise<any>[] = [];

      for (let i = 0; i < stateCount; i++) {
        queryPromises.push(store.getApprovalStateById(`query-${i}`));
      }

      for (let taskId = 0; taskId < 10; taskId++) {
        queryPromises.push(store.getApprovalStatesByTask(`task-${taskId}`));
      }

      const results = await Promise.all(queryPromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle many queries efficiently
      expect(duration).toBeLessThan(1000);

      // Verify query results
      expect(results.slice(0, stateCount).every(result => result !== null)).toBe(true);
      expect(results.slice(stateCount).every(result => Array.isArray(result))).toBe(true);

      controllers.forEach(controller => controller.dispose());
    }, 15000);
  });

  describe('memory performance', () => {
    it('should not leak memory with many approval cycles', async () => {
      const initialMemory = process.memoryUsage();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const cycles = 20;
      for (let i = 0; i < cycles; i++) {
        const controller = new ApprovalGateController(
          createTestOptions(`memory-${i}`, `task-${i}`)
        );

        const promise = controller.requestApproval();
        await controller.grant(`memory-${i}`, 'Memory test');
        await promise;

        controller.dispose();

        // Occasional garbage collection
        if (i % 5 === 0 && global.gc) {
          global.gc();
        }
      }

      // Force final garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();

      // Memory usage should not grow significantly
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseKB = memoryIncrease / 1024;

      // Allow for some memory growth but not excessive
      expect(memoryIncreaseKB).toBeLessThan(5000); // Less than 5MB growth
    }, 15000);

    it('should clean up event listeners properly', async () => {
      const listenerCount = 50;
      const controllers: ApprovalGateController[] = [];

      // Create many controllers with listeners
      for (let i = 0; i < listenerCount; i++) {
        const controller = new ApprovalGateController(
          createTestOptions(`cleanup-${i}`, `task-${i}`)
        );
        controllers.push(controller);

        // Add listeners
        controller.on('approval:requested', vi.fn());
        controller.on('approval:resolved', vi.fn());
        controller.on('approval:timeout', vi.fn());
      }

      // Check initial listener counts
      const initialTotalListeners = controllers.reduce(
        (sum, controller) => sum + controller.listenerCount(),
        0
      );
      expect(initialTotalListeners).toBe(listenerCount * 3);

      // Dispose all controllers
      controllers.forEach(controller => controller.dispose());

      // Check that all listeners are cleaned up
      const finalTotalListeners = controllers.reduce(
        (sum, controller) => sum + controller.listenerCount(),
        0
      );
      expect(finalTotalListeners).toBe(0);
    });
  });

  describe('timeout performance', () => {
    it('should handle many concurrent timeouts efficiently', async () => {
      vi.useFakeTimers();

      const timeoutCount = 20;
      const controllers: ApprovalGateController[] = [];
      const promises: Promise<any>[] = [];

      // Create many controllers with short timeouts
      for (let i = 0; i < timeoutCount; i++) {
        const config = createTestGateConfig(`timeout-${i}`);
        config.timeout = 0.1; // 6 seconds
        config.autoApproveOnTimeout = i % 2 === 0; // Mix approve/deny

        const controller = new ApprovalGateController({
          config,
          taskId: `timeout-task-${i}`,
          stage: 'testing',
          agent: 'timeout-tester',
          store,
        });
        controllers.push(controller);

        promises.push(controller.requestApproval());
      }

      const startTime = Date.now();

      // Advance time to trigger all timeouts
      vi.advanceTimersByTime(10 * 1000); // 10 seconds

      const results = await Promise.all(promises);

      const endTime = Date.now();

      expect(results).toHaveLength(timeoutCount);

      // Should handle timeouts efficiently even with fake timers
      results.forEach((result, index) => {
        if (index % 2 === 0) {
          expect(result.status).toBe('approved'); // autoApproveOnTimeout = true
        } else {
          expect(result.status).toBe('denied'); // autoApproveOnTimeout = false
        }
      });

      vi.useRealTimers();
      controllers.forEach(controller => controller.dispose());
    }, 15000);
  });
});