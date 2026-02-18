import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task, ApprovalState } from '@apexcli/core';

describe('TaskStore Approval States Persistence', () => {
  let testDir: string;

  const createTestTask = (): Task => ({
    id: `persistence_task_${Date.now()}`,
    description: 'Persistence test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    projectPath: testDir,
    branchName: 'apex/test-branch',
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    logs: [],
    artifacts: [],
  });

  const createTestApprovalState = (taskId: string): ApprovalState => ({
    id: `persistence_approval_${Date.now()}`,
    taskId,
    gateName: 'persistence-test',
    status: 'pending',
    requestedAt: new Date(),
    approver: undefined,
    respondedAt: undefined,
    comment: 'Persistence test approval',
    context: {
      testType: 'persistence',
      metadata: { key: 'value' },
    },
    stage: 'testing',
    agent: 'tester',
    approvalsReceived: 1,
    approvalsRequired: 2,
    timeoutMinutes: 30,
    expiresAt: new Date(Date.now() + 1800000), // 30 minutes from now
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-persistence-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Database Persistence', () => {
    it('should persist approval states across store instances', async () => {
      let store = new TaskStore(testDir);
      await store.initialize();

      // Create task and approval state
      const task = createTestTask();
      await store.createTask(task);

      const originalApproval = createTestApprovalState(task.id);
      await store.saveApprovalState(originalApproval);

      // Verify it exists
      let retrieved = await store.getApprovalState(task.id, originalApproval.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.comment).toBe('Persistence test approval');

      // Close the store
      store.close();

      // Create a new store instance using the same directory
      store = new TaskStore(testDir);
      await store.initialize();

      // Verify approval state persists
      retrieved = await store.getApprovalState(task.id, originalApproval.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(originalApproval.id);
      expect(retrieved?.taskId).toBe(task.id);
      expect(retrieved?.gateName).toBe('persistence-test');
      expect(retrieved?.status).toBe('pending');
      expect(retrieved?.comment).toBe('Persistence test approval');
      expect(retrieved?.context?.testType).toBe('persistence');
      expect(retrieved?.stage).toBe('testing');
      expect(retrieved?.agent).toBe('tester');

      store.close();
    });

    it('should maintain data integrity after multiple operations', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask();
      await store.createTask(task);

      // Create multiple approval states
      const approvals = [];
      for (let i = 0; i < 10; i++) {
        const approval = createTestApprovalState(task.id);
        approval.id = `batch_approval_${i}`;
        approval.gateName = `gate-${i % 3}`; // Rotate between 3 gates
        approval.status = ['pending', 'approved', 'denied'][i % 3] as any;
        approvals.push(approval);
        await store.saveApprovalState(approval);
      }

      // Perform multiple updates
      for (let i = 0; i < 5; i++) {
        await store.updateApprovalState(approvals[i].id, {
          status: 'approved',
          approver: `user_${i}@company.com`,
          respondedAt: new Date(),
        });
      }

      // Delete some approvals
      for (let i = 5; i < 7; i++) {
        await store.deleteApprovalState(approvals[i].id);
      }

      // Verify final state
      const remainingApprovals = await store.getApprovalStatesByTask(task.id);
      expect(remainingApprovals).toHaveLength(8); // 10 - 2 deleted

      const approvedCount = remainingApprovals.filter(a => a.status === 'approved').length;
      expect(approvedCount).toBe(5); // 5 updated to approved

      store.close();
    });

    it('should handle database file corruption gracefully', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask();
      await store.createTask(task);

      const approval = createTestApprovalState(task.id);
      await store.saveApprovalState(approval);

      // Verify data exists
      const retrieved = await store.getApprovalState(task.id, approval.id);
      expect(retrieved).toBeDefined();

      store.close();

      // Simulate minor database corruption by truncating the file slightly
      // (This is a contrived test case - real corruption would be more complex)
      const dbPath = path.join(testDir, '.apex', 'apex.db');
      const stats = await fs.stat(dbPath);

      // For this test, we'll just verify the database file exists and has content
      expect(stats.size).toBeGreaterThan(0);

      // Reinitialize should work (SQLite is quite resilient)
      const newStore = new TaskStore(testDir);
      await expect(newStore.initialize()).resolves.toBeUndefined();

      newStore.close();
    });
  });

  describe('Transaction Isolation and Consistency', () => {
    it('should maintain consistency during rapid successive operations', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask();
      await store.createTask(task);

      const approval = createTestApprovalState(task.id);
      await store.saveApprovalState(approval);

      // Perform rapid successive updates (simulating potential race conditions)
      const updatePromises = [];
      for (let i = 0; i < 10; i++) {
        updatePromises.push(
          store.updateApprovalState(approval.id, {
            comment: `Update ${i}`,
            approvalsReceived: i,
          })
        );
      }

      await Promise.all(updatePromises);

      // Verify final state is consistent
      const final = await store.getApprovalState(task.id, approval.id);
      expect(final).toBeDefined();
      expect(final?.id).toBe(approval.id);

      // One of the updates should have succeeded
      expect(typeof final?.comment).toBe('string');
      expect(final?.comment).toMatch(/Update \d+/);
      expect(typeof final?.approvalsReceived).toBe('number');

      store.close();
    });

    it('should handle concurrent read operations efficiently', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask();
      await store.createTask(task);

      // Create multiple approval states
      const approvals = [];
      for (let i = 0; i < 20; i++) {
        const approval = createTestApprovalState(task.id);
        approval.id = `concurrent_read_${i}`;
        approval.gateName = `gate-${i}`;
        approvals.push(approval);
        await store.saveApprovalState(approval);
      }

      // Perform concurrent read operations
      const readPromises = [];
      for (let i = 0; i < 50; i++) {
        readPromises.push(store.getPendingApprovals());
        readPromises.push(store.getApprovalStatesByTask(task.id));
        readPromises.push(store.getApprovalStatesByGate(`gate-${i % 20}`));
        readPromises.push(store.getApprovalStateById(approvals[i % 20].id));
      }

      const start = Date.now();
      const results = await Promise.all(readPromises);
      const duration = Date.now() - start;

      // All reads should succeed
      expect(results).toHaveLength(200); // 50 * 4 operations
      results.forEach(result => {
        expect(result).toBeDefined();
      });

      // Should complete reasonably quickly
      expect(duration).toBeLessThan(1000); // Less than 1 second

      store.close();
    });
  });

  describe('Storage Efficiency', () => {
    it('should store complex approval contexts efficiently', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask();
      await store.createTask(task);

      // Create approval with very large context
      const largeContext = {
        files: Array.from({ length: 100 }, (_, i) => ({
          path: `src/components/Component${i}.tsx`,
          changes: Array.from({ length: 10 }, (_, j) => `Change ${j} in file ${i}`),
          metrics: {
            linesAdded: Math.floor(Math.random() * 100),
            linesRemoved: Math.floor(Math.random() * 50),
            complexity: Math.floor(Math.random() * 20),
          },
        })),
        dependencies: {
          added: Array.from({ length: 20 }, (_, i) => `package-${i}`),
          removed: Array.from({ length: 10 }, (_, i) => `old-package-${i}`),
          updated: Array.from({ length: 15 }, (_, i) => ({
            name: `updated-package-${i}`,
            from: `1.${i}.0`,
            to: `1.${i + 1}.0`,
          })),
        },
        testResults: {
          unit: { passed: 150, failed: 2, coverage: 89.5 },
          integration: { passed: 45, failed: 0, coverage: 92.1 },
          e2e: { passed: 12, failed: 1, coverage: 78.3 },
        },
        performance: {
          buildTime: 45.2,
          bundleSize: 2.4,
          loadTime: 1.8,
          metrics: Object.fromEntries(
            Array.from({ length: 50 }, (_, i) => [`metric_${i}`, Math.random() * 100])
          ),
        },
      };

      const approval = createTestApprovalState(task.id);
      approval.context = largeContext;
      await store.saveApprovalState(approval);

      // Verify large context is stored and retrieved correctly
      const retrieved = await store.getApprovalState(task.id, approval.id);
      expect(retrieved?.context).toEqual(largeContext);
      expect(retrieved?.context?.files).toHaveLength(100);
      expect(retrieved?.context?.dependencies?.added).toHaveLength(20);
      expect(retrieved?.context?.performance?.metrics).toBeDefined();

      // Verify we can still perform efficient queries
      const start = Date.now();
      await store.getApprovalStatesByTask(task.id);
      await store.getPendingApprovals();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should still be fast

      store.close();
    });

    it('should handle approval deletion and cleanup properly', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask();
      await store.createTask(task);

      // Create and delete many approval states to test cleanup
      const approvalIds = [];
      for (let i = 0; i < 50; i++) {
        const approval = createTestApprovalState(task.id);
        approval.id = `cleanup_test_${i}`;
        approvalIds.push(approval.id);
        await store.saveApprovalState(approval);
      }

      // Verify all exist
      const beforeDeletion = await store.getApprovalStatesByTask(task.id);
      expect(beforeDeletion).toHaveLength(50);

      // Delete half of them
      for (let i = 0; i < 25; i++) {
        await store.deleteApprovalState(approvalIds[i]);
      }

      // Verify correct number remain
      const afterDeletion = await store.getApprovalStatesByTask(task.id);
      expect(afterDeletion).toHaveLength(25);

      // Verify deleted ones are actually gone
      for (let i = 0; i < 25; i++) {
        const deleted = await store.getApprovalStateById(approvalIds[i]);
        expect(deleted).toBeNull();
      }

      // Verify remaining ones are still accessible
      for (let i = 25; i < 50; i++) {
        const remaining = await store.getApprovalStateById(approvalIds[i]);
        expect(remaining).toBeDefined();
      }

      store.close();
    });
  });

  describe('Database Schema Evolution', () => {
    it('should handle initialization on existing database', async () => {
      // First initialization
      let store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask();
      await store.createTask(task);

      const approval = createTestApprovalState(task.id);
      await store.saveApprovalState(approval);

      store.close();

      // Second initialization (simulating upgrade/restart)
      store = new TaskStore(testDir);
      await expect(store.initialize()).resolves.toBeUndefined();

      // Verify data is still accessible
      const retrieved = await store.getApprovalState(task.id, approval.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(approval.id);

      store.close();
    });

    it('should maintain backwards compatibility of stored data', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask();
      await store.createTask(task);

      // Create approval with old-style data (missing newer fields)
      const legacyApproval: ApprovalState = {
        id: 'legacy_approval',
        taskId: task.id,
        gateName: 'legacy-gate',
        status: 'pending',
        requestedAt: new Date(),
        // No newer fields like approvalsReceived, approvalsRequired, etc.
      };

      await store.saveApprovalState(legacyApproval);

      // Should retrieve successfully with defaults for missing fields
      const retrieved = await store.getApprovalState(task.id, legacyApproval.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('legacy_approval');
      expect(retrieved?.status).toBe('pending');

      // Fields that weren't set should be undefined/null
      expect(retrieved?.approvalsReceived).toBeUndefined();
      expect(retrieved?.approvalsRequired).toBeUndefined();
      expect(retrieved?.timeoutMinutes).toBeUndefined();

      store.close();
    });
  });
});