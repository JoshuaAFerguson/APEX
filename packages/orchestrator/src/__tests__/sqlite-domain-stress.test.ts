/**
 * SQLite Domain-Specific Stress Tests
 *
 * Architecture Decision Record (ADR):
 * ------------------------------------
 * This test suite validates TaskStore behavior under realistic domain-specific
 * stress scenarios that mirror actual production usage patterns.
 *
 * Design Rationale:
 * 1. Domain-driven test scenarios - Tests are organized around actual task workflow
 *    patterns rather than abstract database operations
 * 2. Realistic data volumes - Uses scale factors typical of production workloads
 * 3. Temporal patterns - Simulates time-based operations like rapid transitions
 * 4. Hierarchical integrity - Validates parent-child relationships under load
 * 5. Lifecycle operations - Tests trash/archive flows at volume
 *
 * Test Categories:
 * 1. Rapid task status transitions - Fast consecutive state machine changes
 * 2. Parent-child hierarchies under load - Nested task relationships at scale
 * 3. Idle task processing at scale - IdleTask CRUD operations under load
 * 4. Log/artifact accumulation stress - Heavy append operations
 * 5. Task cleanup (trash/archive) at volume - Lifecycle operations at scale
 *
 * Concurrency Model:
 * - Uses Promise.all() to simulate concurrent access
 * - Batch processing to stress database lock management
 * - Randomized delays to simulate realistic timing variance
 *
 * @see packages/orchestrator/src/store.ts - TaskStore implementation
 * @see sqlite-concurrent-stress.test.ts - Generic concurrent stress tests
 * @see sqlite-performance-load.test.ts - Performance benchmarks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from '../store';
import type {
  Task,
  CreateTaskRequest,
  TaskStatus,
  TaskPriority,
  IdleTask,
  IdleTaskType,
  TaskEffort,
} from '@apexcli/core';

/**
 * Test configuration constants
 * Tuned for CI performance while maintaining meaningful stress levels
 */
const CONFIG = {
  // Number of parallel operations for stress tests
  PARALLEL_OPERATIONS: 50,

  // Maximum time (ms) for test operations
  MAX_TEST_DURATION: 60000,

  // Hierarchy depth for nested task tests
  MAX_HIERARCHY_DEPTH: 5,

  // Children per parent in hierarchy tests
  CHILDREN_PER_PARENT: 10,

  // Logs per task in accumulation tests
  LOGS_PER_TASK: 100,

  // Artifacts per task in accumulation tests
  ARTIFACTS_PER_TASK: 50,

  // Idle tasks for CRUD stress
  IDLE_TASK_COUNT: 100,

  // Tasks for cleanup stress
  CLEANUP_TASK_COUNT: 200,
} as const;

/**
 * Valid task statuses for state machine transitions
 */
const VALID_STATUSES: TaskStatus[] = [
  'pending',
  'queued',
  'in-progress',
  'paused',
  'completed',
  'failed',
  'cancelled',
];

/**
 * Helper to create unique task requests with configurable properties
 */
const createTaskRequest = (
  suffix: string | number = '',
  overrides: Partial<CreateTaskRequest> = {}
): CreateTaskRequest => ({
  description: `Domain stress test task ${suffix}`,
  acceptanceCriteria: `Task ${suffix} acceptance criteria`,
  workflow: 'feature',
  autonomy: 'full-auto',
  priority: 'normal',
  effort: 'medium',
  ...overrides,
});

/**
 * Helper to introduce random delays for simulating async behavior
 */
const randomDelay = (maxMs: number = 10): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, Math.random() * maxMs));

/**
 * Helper to create an IdleTask with unique properties
 */
const createIdleTask = (
  suffix: string | number,
  overrides: Partial<IdleTask> = {}
): IdleTask => ({
  id: `idle-stress-${suffix}-${Date.now()}`,
  type: 'maintenance' as IdleTaskType,
  title: `Idle Task ${suffix}`,
  description: `Idle task description for stress test ${suffix}`,
  priority: 'low' as TaskPriority,
  estimatedEffort: 'small' as TaskEffort,
  suggestedWorkflow: 'feature',
  rationale: `Generated for stress testing - item ${suffix}`,
  createdAt: new Date(),
  implemented: false,
  ...overrides,
});

describe('SQLite Domain-Specific Stress Tests', () => {
  let testDir: string;
  let store: TaskStore;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sqlite-domain-stress-'));
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    if (store) {
      await store.close();
    }
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ===========================================================================
  // SCENARIO 1: Rapid Task Status Transitions
  // ===========================================================================

  describe('Rapid Task Status Transitions', () => {
    it('should handle rapid consecutive status changes without state corruption', async () => {
      const task = await store.createTask(createTaskRequest('rapid-transition'));
      const transitionCount = 50;

      const startTime = Date.now();

      // Execute rapid status transitions sequentially
      for (let i = 0; i < transitionCount; i++) {
        const newStatus = VALID_STATUSES[i % VALID_STATUSES.length];
        await store.updateTask(task.id, { status: newStatus });
      }

      const duration = Date.now() - startTime;

      // Verify final state is valid
      const finalTask = await store.getTask(task.id);
      expect(VALID_STATUSES).toContain(finalTask?.status);

      // Verify task integrity
      expect(finalTask?.id).toBe(task.id);
      expect(finalTask?.description).toBe(task.description);

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Rapid transitions (${transitionCount}): ${duration}ms`);
    });

    it('should handle concurrent status transitions on multiple tasks', async () => {
      const taskCount = 30;
      const transitionsPerTask = 10;

      // Create base tasks
      const tasks = await Promise.all(
        Array(taskCount)
          .fill(null)
          .map((_, i) => store.createTask(createTaskRequest(`concurrent-trans-${i}`)))
      );

      const startTime = Date.now();

      // Concurrent transitions across all tasks
      const transitionPromises: Promise<void>[] = [];
      for (let round = 0; round < transitionsPerTask; round++) {
        for (const task of tasks) {
          const newStatus = VALID_STATUSES[(round + tasks.indexOf(task)) % VALID_STATUSES.length];
          transitionPromises.push(store.updateTask(task.id, { status: newStatus }));
        }
      }

      await Promise.all(transitionPromises);
      const duration = Date.now() - startTime;

      // Verify all tasks are in valid states
      for (const task of tasks) {
        const finalTask = await store.getTask(task.id);
        expect(VALID_STATUSES).toContain(finalTask?.status);
      }

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Concurrent transitions (${taskCount * transitionsPerTask}): ${duration}ms`);
    });

    it('should maintain state machine consistency during burst transitions', async () => {
      const task = await store.createTask(createTaskRequest('burst-transition'));
      const observations: TaskStatus[] = [];

      const startTime = Date.now();

      // Interleaved writes and reads to observe intermediate states
      const operations: Promise<void>[] = [];
      for (let i = 0; i < 100; i++) {
        // Write operation
        operations.push(
          store.updateTask(task.id, {
            status: VALID_STATUSES[i % VALID_STATUSES.length],
          })
        );

        // Read operation
        operations.push(
          store.getTask(task.id).then(t => {
            if (t?.status) {
              observations.push(t.status);
            }
          })
        );
      }

      await Promise.all(operations);
      const duration = Date.now() - startTime;

      // All observed states should be valid
      for (const status of observations) {
        expect(VALID_STATUSES).toContain(status);
      }

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Burst transitions with observations: ${duration}ms`);
    });

    it('should handle status transitions with accompanying field updates', async () => {
      const task = await store.createTask(createTaskRequest('compound-update'));

      const startTime = Date.now();

      // Compound updates that modify multiple fields
      for (let i = 0; i < 50; i++) {
        await store.updateTask(task.id, {
          status: VALID_STATUSES[i % VALID_STATUSES.length],
          retryCount: i,
          error: i % 5 === 0 ? `Error at iteration ${i}` : undefined,
          priority: i % 3 === 0 ? 'high' : 'normal',
        });
      }

      const duration = Date.now() - startTime;

      // Verify final state
      const finalTask = await store.getTask(task.id);
      expect(finalTask).not.toBeNull();
      expect(VALID_STATUSES).toContain(finalTask?.status);
      expect(typeof finalTask?.retryCount).toBe('number');

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Compound status updates: ${duration}ms`);
    });
  });

  // ===========================================================================
  // SCENARIO 2: Parent-Child Task Hierarchies Under Load
  // ===========================================================================

  describe('Parent-Child Task Hierarchies Under Load', () => {
    it('should create deep hierarchies without reference corruption', async () => {
      const startTime = Date.now();

      // Create hierarchy: root -> child -> grandchild -> etc.
      let parentId: string | undefined;
      const hierarchy: Task[] = [];

      for (let depth = 0; depth < CONFIG.MAX_HIERARCHY_DEPTH; depth++) {
        const task = await store.createTask({
          ...createTaskRequest(`hierarchy-depth-${depth}`),
          parentTaskId: parentId,
        } as any);

        hierarchy.push(task);

        // Update parent with child reference
        if (parentId) {
          const parent = await store.getTask(parentId);
          const subtaskIds = [...(parent?.subtaskIds || []), task.id];
          await store.updateTask(parentId, { subtaskIds });
        }

        parentId = task.id;
      }

      const duration = Date.now() - startTime;

      // Verify hierarchy integrity
      for (let i = 0; i < hierarchy.length; i++) {
        const task = await store.getTask(hierarchy[i].id);
        expect(task).not.toBeNull();

        if (i > 0) {
          expect(task?.parentTaskId).toBe(hierarchy[i - 1].id);
        }
      }

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Deep hierarchy (${CONFIG.MAX_HIERARCHY_DEPTH} levels): ${duration}ms`);
    });

    it('should handle wide hierarchies with many children per parent', async () => {
      const startTime = Date.now();

      // Create parent task
      const parentTask = await store.createTask(createTaskRequest('wide-parent'));
      const childTasks: Task[] = [];

      // Create children concurrently
      const childPromises = Array(CONFIG.CHILDREN_PER_PARENT)
        .fill(null)
        .map((_, i) =>
          store.createTask({
            ...createTaskRequest(`wide-child-${i}`),
            parentTaskId: parentTask.id,
          } as any)
        );

      const children = await Promise.all(childPromises);
      childTasks.push(...children);

      // Update parent with all child references
      await store.updateTask(parentTask.id, {
        subtaskIds: childTasks.map(c => c.id),
        subtaskStrategy: 'parallel',
      });

      const duration = Date.now() - startTime;

      // Verify parent has all children
      const finalParent = await store.getTask(parentTask.id);
      expect(finalParent?.subtaskIds).toHaveLength(CONFIG.CHILDREN_PER_PARENT);

      // Verify all children reference parent
      for (const child of childTasks) {
        const storedChild = await store.getTask(child.id);
        expect(storedChild?.parentTaskId).toBe(parentTask.id);
      }

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Wide hierarchy (${CONFIG.CHILDREN_PER_PARENT} children): ${duration}ms`);
    });

    it('should maintain integrity during concurrent hierarchy modifications', async () => {
      // Create parent
      const parentTask = await store.createTask(createTaskRequest('concurrent-parent'));

      const startTime = Date.now();
      const childIds: string[] = [];

      // Concurrent child creation and parent updates
      const operations: Promise<void>[] = [];

      for (let i = 0; i < 20; i++) {
        operations.push(
          (async () => {
            const child = await store.createTask({
              ...createTaskRequest(`concurrent-child-${i}`),
              parentTaskId: parentTask.id,
            } as any);
            childIds.push(child.id);

            // Random delay to create contention
            await randomDelay(5);

            // Update parent with new child
            const parent = await store.getTask(parentTask.id);
            const subtaskIds = [...new Set([...(parent?.subtaskIds || []), child.id])];
            await store.updateTask(parentTask.id, { subtaskIds });
          })()
        );
      }

      await Promise.all(operations);
      const duration = Date.now() - startTime;

      // Verify parent has correct children
      const finalParent = await store.getTask(parentTask.id);
      expect(finalParent?.subtaskIds?.length).toBeGreaterThanOrEqual(1);

      // All created children should reference the parent
      for (const childId of childIds) {
        const child = await store.getTask(childId);
        expect(child?.parentTaskId).toBe(parentTask.id);
      }

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Concurrent hierarchy modifications: ${duration}ms`);
    });

    it('should handle dependency chains within hierarchies', async () => {
      const parentTask = await store.createTask(createTaskRequest('dep-chain-parent'));
      const children: Task[] = [];

      // Create sequential children with dependencies
      for (let i = 0; i < 10; i++) {
        const child = await store.createTask({
          ...createTaskRequest(`dep-chain-child-${i}`),
          parentTaskId: parentTask.id,
        } as any);
        children.push(child);

        // Add dependency on previous child
        if (i > 0) {
          await store.addDependency(child.id, children[i - 1].id);
        }
      }

      // Update parent
      await store.updateTask(parentTask.id, {
        subtaskIds: children.map(c => c.id),
        subtaskStrategy: 'dependency-based',
      });

      // Verify dependencies
      for (let i = 1; i < children.length; i++) {
        const child = await store.getTask(children[i].id);
        expect(child?.dependsOn).toContain(children[i - 1].id);
      }

      console.log('  Dependency chain within hierarchy: verified');
    });

    it('should handle mixed hierarchy and flat task operations', async () => {
      const startTime = Date.now();

      // Create mixed workload
      const operations: Promise<any>[] = [];

      // Some hierarchical tasks
      for (let i = 0; i < 5; i++) {
        operations.push(
          (async () => {
            const parent = await store.createTask(createTaskRequest(`mixed-parent-${i}`));
            const children = await Promise.all(
              Array(5)
                .fill(null)
                .map((_, j) =>
                  store.createTask({
                    ...createTaskRequest(`mixed-child-${i}-${j}`),
                    parentTaskId: parent.id,
                  } as any)
                )
            );
            await store.updateTask(parent.id, { subtaskIds: children.map(c => c.id) });
            return { parent, children };
          })()
        );
      }

      // Some flat tasks
      for (let i = 0; i < 20; i++) {
        operations.push(store.createTask(createTaskRequest(`mixed-flat-${i}`)));
      }

      await Promise.all(operations);
      const duration = Date.now() - startTime;

      // Verify all tasks exist
      const allTasks = await store.listTasks();
      expect(allTasks.length).toBeGreaterThanOrEqual(45); // 5*6 hierarchical + 20 flat

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Mixed hierarchy and flat operations: ${duration}ms`);
    });
  });

  // ===========================================================================
  // SCENARIO 3: Idle Task Processing at Scale
  // ===========================================================================

  describe('Idle Task Processing at Scale', () => {
    it('should handle bulk idle task creation', async () => {
      const startTime = Date.now();

      // Create many idle tasks concurrently
      const createPromises = Array(CONFIG.IDLE_TASK_COUNT)
        .fill(null)
        .map((_, i) => store.createIdleTask(createIdleTask(i)));

      const idleTasks = await Promise.all(createPromises);
      const duration = Date.now() - startTime;

      expect(idleTasks).toHaveLength(CONFIG.IDLE_TASK_COUNT);

      // Verify all tasks have unique IDs
      const ids = new Set(idleTasks.map(t => t.id));
      expect(ids.size).toBe(CONFIG.IDLE_TASK_COUNT);

      // Verify persistence
      const storedTasks = await store.listIdleTasks();
      expect(storedTasks.length).toBeGreaterThanOrEqual(CONFIG.IDLE_TASK_COUNT);

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Bulk idle task creation (${CONFIG.IDLE_TASK_COUNT}): ${duration}ms`);
    });

    it('should handle idle task listing with various filters at scale', async () => {
      // Create diverse idle tasks
      const types: IdleTaskType[] = ['maintenance', 'refactoring', 'docs', 'tests', 'technical-debt'];
      const priorities: TaskPriority[] = ['low', 'normal', 'high'];

      await Promise.all(
        Array(50)
          .fill(null)
          .map((_, i) =>
            store.createIdleTask(
              createIdleTask(i, {
                type: types[i % types.length],
                priority: priorities[i % priorities.length],
              })
            )
          )
      );

      const startTime = Date.now();

      // Multiple concurrent filtered queries
      const queryPromises = [
        ...Array(10).fill(null).map(() => store.listIdleTasks()),
        ...Array(10).fill(null).map(() => store.listIdleTasks({ implemented: false })),
        ...Array(10).fill(null).map(() => store.listIdleTasks({ priority: 'low' })),
        ...Array(10).fill(null).map(() => store.listIdleTasks({ implemented: true })),
      ];

      const results = await Promise.all(queryPromises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(40);

      // Verify filter consistency
      const allTasks = results.slice(0, 10);
      const allCount = allTasks[0].length;
      allTasks.forEach(r => expect(r.length).toBe(allCount));

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Filtered idle task queries (${queryPromises.length}): ${duration}ms`);
    });

    it('should handle idle task promotion at scale', async () => {
      // Create idle tasks to promote
      const idleTasks = await Promise.all(
        Array(30)
          .fill(null)
          .map((_, i) => store.createIdleTask(createIdleTask(`promote-${i}`)))
      );

      const startTime = Date.now();

      // Promote tasks sequentially (since promotion has side effects)
      const promotedTasks: Task[] = [];
      for (const idleTask of idleTasks.slice(0, 20)) {
        const realTask = await store.promoteIdleTask(idleTask.id, {
          workflow: 'feature',
          autonomy: 'full-auto',
          projectPath: testDir,
        });
        promotedTasks.push(realTask);
      }

      const duration = Date.now() - startTime;

      // Verify promotions
      expect(promotedTasks).toHaveLength(20);

      // Verify idle tasks are marked as implemented
      const implementedTasks = await store.listIdleTasks({ implemented: true });
      expect(implementedTasks.length).toBeGreaterThanOrEqual(20);

      // Verify real tasks exist
      for (const task of promotedTasks) {
        const stored = await store.getTask(task.id);
        expect(stored).not.toBeNull();
        expect(stored?.priority).toBe('low'); // Inherited from idle task
      }

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Idle task promotion (20 tasks): ${duration}ms`);
    });

    it('should handle mixed idle task CRUD operations', async () => {
      const startTime = Date.now();
      const operations: Promise<any>[] = [];

      // Create phase
      const createOps = Array(30)
        .fill(null)
        .map((_, i) => store.createIdleTask(createIdleTask(`crud-${i}`)));
      operations.push(...createOps);

      const created = await Promise.all(createOps);

      // Read phase (concurrent reads)
      const readOps = created.map(t => store.getIdleTask(t.id));
      operations.push(...readOps);

      // Mixed read/promote phase
      for (let i = 0; i < 10; i++) {
        operations.push(
          store.promoteIdleTask(created[i].id, {
            workflow: 'feature',
            autonomy: 'full-auto',
            projectPath: testDir,
          })
        );
        operations.push(store.listIdleTasks());
      }

      await Promise.all(operations);
      const duration = Date.now() - startTime;

      // Verify final state
      const allIdleTasks = await store.listIdleTasks();
      const implemented = await store.listIdleTasks({ implemented: true });
      const unimplemented = await store.listIdleTasks({ implemented: false });

      expect(implemented.length + unimplemented.length).toBe(allIdleTasks.length);

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Mixed idle task CRUD: ${duration}ms`);
    });
  });

  // ===========================================================================
  // SCENARIO 4: Log/Artifact Accumulation Stress
  // ===========================================================================

  describe('Log/Artifact Accumulation Stress', () => {
    it('should handle heavy log accumulation on a single task', async () => {
      const task = await store.createTask(createTaskRequest('log-heavy'));

      const startTime = Date.now();

      // Add many logs sequentially
      for (let i = 0; i < CONFIG.LOGS_PER_TASK; i++) {
        await store.addLog(task.id, {
          level: i % 4 === 0 ? 'error' : i % 3 === 0 ? 'warn' : 'info',
          message: `Log entry ${i}: ${Array(50).fill('x').join('')}`,
          metadata: { index: i, timestamp: Date.now() } as unknown as Record<string, unknown>,
        });
      }

      const duration = Date.now() - startTime;

      // Verify all logs persisted
      const finalTask = await store.getTask(task.id);
      expect(finalTask?.logs).toHaveLength(CONFIG.LOGS_PER_TASK);

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Heavy log accumulation (${CONFIG.LOGS_PER_TASK}): ${duration}ms`);
    });

    it('should handle concurrent log additions to multiple tasks', async () => {
      const taskCount = 10;
      const logsPerTask = 30;

      // Create tasks
      const tasks = await Promise.all(
        Array(taskCount)
          .fill(null)
          .map((_, i) => store.createTask(createTaskRequest(`log-concurrent-${i}`)))
      );

      const startTime = Date.now();

      // Add logs concurrently to all tasks
      const logPromises: Promise<void>[] = [];
      for (const task of tasks) {
        for (let i = 0; i < logsPerTask; i++) {
          logPromises.push(
            store.addLog(task.id, {
              level: 'info',
              message: `Concurrent log ${i} for task ${task.id}`,
            })
          );
        }
      }

      await Promise.all(logPromises);
      const duration = Date.now() - startTime;

      // Verify all logs persisted
      for (const task of tasks) {
        const finalTask = await store.getTask(task.id);
        expect(finalTask?.logs).toHaveLength(logsPerTask);
      }

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Concurrent log additions (${taskCount * logsPerTask}): ${duration}ms`);
    });

    it('should handle heavy artifact accumulation', async () => {
      const task = await store.createTask(createTaskRequest('artifact-heavy'));

      const startTime = Date.now();

      // Add many artifacts
      const artifactPromises = Array(CONFIG.ARTIFACTS_PER_TASK)
        .fill(null)
        .map((_, i) =>
          store.addArtifact(task.id, {
            name: `artifact_${i}.txt`,
            type: 'file',
            content: `Artifact content ${i}: ${Array(100).fill('data').join('-')}`,
          })
        );

      await Promise.all(artifactPromises);
      const duration = Date.now() - startTime;

      // Verify all artifacts persisted
      const finalTask = await store.getTask(task.id);
      expect(finalTask?.artifacts).toHaveLength(CONFIG.ARTIFACTS_PER_TASK);

      // Verify artifact uniqueness
      const names = new Set(finalTask?.artifacts.map(a => a.name));
      expect(names.size).toBe(CONFIG.ARTIFACTS_PER_TASK);

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Heavy artifact accumulation (${CONFIG.ARTIFACTS_PER_TASK}): ${duration}ms`);
    });

    it('should handle mixed log and artifact accumulation', async () => {
      const task = await store.createTask(createTaskRequest('mixed-accumulation'));

      const startTime = Date.now();

      // Interleaved log and artifact additions
      const operations: Promise<void>[] = [];
      for (let i = 0; i < 50; i++) {
        // Add log
        operations.push(
          store.addLog(task.id, {
            level: 'info',
            message: `Mixed log ${i}`,
          })
        );

        // Add artifact
        operations.push(
          store.addArtifact(task.id, {
            name: `mixed_artifact_${i}.txt`,
            type: 'file',
            content: `Mixed artifact content ${i}`,
          })
        );
      }

      await Promise.all(operations);
      const duration = Date.now() - startTime;

      // Verify both persisted
      const finalTask = await store.getTask(task.id);
      expect(finalTask?.logs).toHaveLength(50);
      expect(finalTask?.artifacts).toHaveLength(50);

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Mixed log/artifact accumulation: ${duration}ms`);
    });

    it('should handle large payload logs and artifacts', async () => {
      const task = await store.createTask(createTaskRequest('large-payload'));
      const largeContent = 'X'.repeat(10000); // 10KB per entry

      const startTime = Date.now();

      // Add large logs
      await Promise.all(
        Array(20)
          .fill(null)
          .map((_, i) =>
            store.addLog(task.id, {
              level: 'info',
              message: `Large log ${i}: ${largeContent}`,
            })
          )
      );

      // Add large artifacts
      await Promise.all(
        Array(10)
          .fill(null)
          .map((_, i) =>
            store.addArtifact(task.id, {
              name: `large_artifact_${i}.txt`,
              type: 'file',
              content: `Large artifact ${i}: ${largeContent}`,
            })
          )
      );

      const duration = Date.now() - startTime;

      // Verify retrieval works with large data
      const finalTask = await store.getTask(task.id);
      expect(finalTask?.logs).toHaveLength(20);
      expect(finalTask?.artifacts).toHaveLength(10);

      // Verify content integrity
      expect(finalTask?.logs[0].message).toContain(largeContent.substring(0, 100));
      expect(finalTask?.artifacts[0].content).toContain(largeContent.substring(0, 100));

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Large payload accumulation: ${duration}ms`);
    });
  });

  // ===========================================================================
  // SCENARIO 5: Task Cleanup (Trash/Archive) at Volume
  // ===========================================================================

  describe('Task Cleanup (Trash/Archive) at Volume', () => {
    it('should handle bulk task trashing', async () => {
      // Create many tasks
      const tasks = await Promise.all(
        Array(CONFIG.CLEANUP_TASK_COUNT)
          .fill(null)
          .map((_, i) => store.createTask(createTaskRequest(`trash-bulk-${i}`)))
      );

      const startTime = Date.now();

      // Trash all tasks concurrently
      await Promise.all(tasks.map(t => store.trashTask(t.id)));

      const duration = Date.now() - startTime;

      // Verify all trashed
      const trashedTasks = await store.getTrashedTasks();
      expect(trashedTasks.length).toBeGreaterThanOrEqual(CONFIG.CLEANUP_TASK_COUNT);

      // Verify excluded from normal listing
      const activeTasks = await store.listTasks();
      const activeIds = new Set(activeTasks.map(t => t.id));
      for (const task of tasks) {
        expect(activeIds.has(task.id)).toBe(false);
      }

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Bulk task trashing (${CONFIG.CLEANUP_TASK_COUNT}): ${duration}ms`);
    });

    it('should handle bulk task restoration', async () => {
      // Create and trash tasks
      const tasks = await Promise.all(
        Array(50)
          .fill(null)
          .map((_, i) => store.createTask(createTaskRequest(`restore-bulk-${i}`)))
      );

      await Promise.all(tasks.map(t => store.trashTask(t.id)));

      const startTime = Date.now();

      // Restore all tasks
      for (const task of tasks) {
        await store.restoreFromTrash(task.id);
      }

      const duration = Date.now() - startTime;

      // Verify all restored
      const trashedTasks = await store.getTrashedTasks();
      const trashedIds = new Set(trashedTasks.map(t => t.id));
      for (const task of tasks) {
        expect(trashedIds.has(task.id)).toBe(false);
      }

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Bulk task restoration (${tasks.length}): ${duration}ms`);
    });

    it('should handle bulk task archiving', async () => {
      // Create completed tasks
      const tasks = await Promise.all(
        Array(100)
          .fill(null)
          .map(async (_, i) => {
            const task = await store.createTask(createTaskRequest(`archive-bulk-${i}`));
            await store.updateTask(task.id, {
              status: 'completed',
              completedAt: new Date(),
            });
            return task;
          })
      );

      const startTime = Date.now();

      // Archive all completed tasks
      await Promise.all(tasks.map(t => store.archiveTask(t.id)));

      const duration = Date.now() - startTime;

      // Verify all archived
      const archivedTasks = await store.listArchived();
      expect(archivedTasks.length).toBeGreaterThanOrEqual(100);

      // Verify excluded from normal listing
      const activeTasks = await store.listTasks();
      const activeIds = new Set(activeTasks.map(t => t.id));
      for (const task of tasks) {
        expect(activeIds.has(task.id)).toBe(false);
      }

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Bulk task archiving (${tasks.length}): ${duration}ms`);
    });

    it('should handle emptyTrash with large volume', async () => {
      // Create and trash many tasks with related data
      const tasks = await Promise.all(
        Array(100)
          .fill(null)
          .map(async (_, i) => {
            const task = await store.createTask(createTaskRequest(`empty-trash-${i}`));
            // Add some related data
            await store.addLog(task.id, { level: 'info', message: `Log for ${i}` });
            await store.addArtifact(task.id, {
              name: `artifact_${i}.txt`,
              type: 'file',
              content: `Content ${i}`,
            });
            return task;
          })
      );

      // Trash all tasks
      await Promise.all(tasks.map(t => store.trashTask(t.id)));

      // Verify trashed
      const trashedBefore = await store.getTrashedTasks();
      expect(trashedBefore.length).toBeGreaterThanOrEqual(100);

      const startTime = Date.now();

      // Empty trash
      const deletedCount = await store.emptyTrash();

      const duration = Date.now() - startTime;

      expect(deletedCount).toBeGreaterThanOrEqual(100);

      // Verify permanently deleted
      const trashedAfter = await store.getTrashedTasks();
      expect(trashedAfter.length).toBe(0);

      // Verify tasks cannot be retrieved
      for (const task of tasks) {
        const deleted = await store.getTask(task.id);
        expect(deleted).toBeNull();
      }

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Empty trash (${deletedCount} tasks): ${duration}ms`);
    });

    it('should handle mixed cleanup operations', async () => {
      // Create diverse tasks
      const completedTasks = await Promise.all(
        Array(30)
          .fill(null)
          .map(async (_, i) => {
            const task = await store.createTask(createTaskRequest(`mixed-completed-${i}`));
            await store.updateTask(task.id, {
              status: 'completed',
              completedAt: new Date(),
            });
            return task;
          })
      );

      const pendingTasks = await Promise.all(
        Array(30)
          .fill(null)
          .map((_, i) => store.createTask(createTaskRequest(`mixed-pending-${i}`)))
      );

      const startTime = Date.now();

      // Mixed operations
      const operations: Promise<any>[] = [];

      // Archive completed tasks
      for (const task of completedTasks.slice(0, 20)) {
        operations.push(store.archiveTask(task.id));
      }

      // Trash pending tasks
      for (const task of pendingTasks.slice(0, 20)) {
        operations.push(store.trashTask(task.id));
      }

      await Promise.all(operations);

      // Restore some trashed tasks
      for (const task of pendingTasks.slice(0, 10)) {
        await store.restoreFromTrash(task.id);
      }

      const duration = Date.now() - startTime;

      // Verify final state
      const archivedTasks = await store.listArchived();
      expect(archivedTasks.length).toBeGreaterThanOrEqual(20);

      const trashedTasks = await store.getTrashedTasks();
      expect(trashedTasks.length).toBeGreaterThanOrEqual(10);

      const activeTasks = await store.listTasks();
      expect(activeTasks.length).toBeGreaterThanOrEqual(20); // Non-archived, non-trashed

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Mixed cleanup operations: ${duration}ms`);
    });

    it('should handle cleanup with parent-child relationships', async () => {
      // Create hierarchical tasks
      const parents: Task[] = [];
      const children: Task[] = [];

      for (let i = 0; i < 10; i++) {
        const parent = await store.createTask(createTaskRequest(`cleanup-parent-${i}`));
        parents.push(parent);

        const childTasks = await Promise.all(
          Array(5)
            .fill(null)
            .map((_, j) =>
              store.createTask({
                ...createTaskRequest(`cleanup-child-${i}-${j}`),
                parentTaskId: parent.id,
              } as any)
            )
        );
        children.push(...childTasks);

        await store.updateTask(parent.id, {
          subtaskIds: childTasks.map(c => c.id),
        });
      }

      const startTime = Date.now();

      // Trash parent tasks (should not cascade to children automatically)
      await Promise.all(parents.map(p => store.trashTask(p.id)));

      // Verify children still exist
      for (const child of children) {
        const stored = await store.getTask(child.id);
        expect(stored).not.toBeNull();
      }

      // Now trash children
      await Promise.all(children.map(c => store.trashTask(c.id)));

      // Empty trash
      const deletedCount = await store.emptyTrash();

      const duration = Date.now() - startTime;

      // All should be deleted
      expect(deletedCount).toBe(parents.length + children.length);

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Hierarchical cleanup: ${duration}ms`);
    });
  });

  // ===========================================================================
  // INTEGRATION: Combined Domain Stress
  // ===========================================================================

  describe('Combined Domain Stress', () => {
    it('should handle realistic workflow simulation', async () => {
      const startTime = Date.now();

      // Simulate a realistic workflow: create tasks, transition states, accumulate data, cleanup

      // Phase 1: Create hierarchical tasks
      const parentTasks: Task[] = [];
      for (let i = 0; i < 5; i++) {
        const parent = await store.createTask(createTaskRequest(`workflow-parent-${i}`));
        parentTasks.push(parent);

        const children = await Promise.all(
          Array(3)
            .fill(null)
            .map((_, j) =>
              store.createTask({
                ...createTaskRequest(`workflow-child-${i}-${j}`),
                parentTaskId: parent.id,
              } as any)
            )
        );

        await store.updateTask(parent.id, {
          subtaskIds: children.map(c => c.id),
          status: 'in-progress',
        });

        // Add logs and artifacts to children
        for (const child of children) {
          await store.addLog(child.id, { level: 'info', message: 'Task started' });
          await store.addArtifact(child.id, {
            name: 'output.txt',
            type: 'file',
            content: 'Initial output',
          });
        }
      }

      // Phase 2: Progress some tasks
      const allTasks = await store.listTasks();
      for (const task of allTasks.slice(0, 10)) {
        await store.updateTask(task.id, {
          status: 'completed',
          completedAt: new Date(),
        });
      }

      // Phase 3: Archive completed tasks
      const completedTasks = await store.listTasks({ status: 'completed' });
      for (const task of completedTasks.slice(0, 5)) {
        await store.archiveTask(task.id);
      }

      // Phase 4: Trash failed/cancelled tasks
      for (const task of allTasks.slice(10, 15)) {
        await store.updateTask(task.id, { status: 'failed' });
        await store.trashTask(task.id);
      }

      const duration = Date.now() - startTime;

      // Verify system state
      const finalActive = await store.listTasks();
      const finalArchived = await store.listArchived();
      const finalTrashed = await store.getTrashedTasks();

      expect(finalActive.length + finalArchived.length + finalTrashed.length).toBeGreaterThan(0);

      expect(duration).toBeLessThan(CONFIG.MAX_TEST_DURATION);
      console.log(`  Realistic workflow simulation: ${duration}ms`);
    });
  });
});
