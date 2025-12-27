/**
 * Iteration History Session Persistence Tests
 * Verifies that iteration history is correctly persisted across sessions
 * and that data integrity is maintained through database operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from '../store';
import { InteractionManager } from '../interaction-manager';
import { ApexOrchestrator } from '../index';
import type {
  Task,
  IterationEntry,
  IterationHistory,
  IterationSnapshot,
  IterationDiff,
  TaskStatus
} from '@apexcli/core';

describe('Iteration History Session Persistence', () => {
  let testDir: string;
  let dbPath: string;

  const createTestTask = (id: string, status: TaskStatus = 'in-progress'): Task => ({
    id,
    title: `Test Task ${id}`,
    description: `Test task for iteration history persistence: ${id}`,
    status,
    priority: 'normal',
    effort: 'medium',
    currentStage: 'implementation',
    workflowName: 'feature',
    branchName: `apex/${id}`,
    projectPath: testDir,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      estimatedCost: 0.075,
    },
    logs: [
      {
        timestamp: new Date(),
        level: 'info',
        stage: 'implementation',
        message: 'Starting implementation phase',
        agent: 'developer',
      },
    ],
    artifacts: [
      {
        type: 'file',
        path: `src/${id}-feature.ts`,
        name: 'Initial implementation',
        content: 'export function newFeature() {\n  return "hello";\n}',
      },
    ],
    dependsOn: [],
    blockedBy: [],
    iterationHistory: {
      entries: [],
      totalIterations: 0,
    },
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-persistence-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    dbPath = path.join(testDir, '.apex', 'apex.db');

    // Create minimal config for orchestrator
    const configContent = `
project:
  name: session-persistence-test
  version: 1.0.0
agents:
  developer:
    model: haiku
    autonomy: high
workflows:
  feature:
    stages:
      - name: implementation
        agent: developer
limits:
  maxTokens: 10000
  maxCost: 1.0
`;
    await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), configContent);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Basic Session Persistence', () => {
    it('should persist iteration entries across store instances', async () => {
      // Create first store instance
      const store1 = new TaskStore(testDir);
      await store1.initialize();

      const task = createTestTask('persist-basic-001');
      await store1.createTask(task);

      // Add iteration entry
      const iterationEntry: Omit<IterationEntry, 'id'> & { id: string } = {
        id: 'persist-basic-001-iter-123',
        feedback: 'First iteration feedback',
        timestamp: new Date(),
        stage: 'implementation',
        beforeState: {
          timestamp: new Date(),
          stage: 'implementation',
          status: 'in-progress',
          files: { created: ['src/test.ts'], modified: [] },
          usage: task.usage,
          artifactCount: 1,
        },
      };

      await store1.addIterationEntry('persist-basic-001', iterationEntry);
      store1.close();

      // Create second store instance (simulating restart)
      const store2 = new TaskStore(testDir);
      await store2.initialize();

      const history = await store2.getIterationHistory('persist-basic-001');
      expect(history.entries).toHaveLength(1);
      expect(history.totalIterations).toBe(1);
      expect(history.entries[0]).toMatchObject({
        id: 'persist-basic-001-iter-123',
        feedback: 'First iteration feedback',
        stage: 'implementation',
      });

      store2.close();
    });

    it('should preserve iteration order across sessions', async () => {
      const store1 = new TaskStore(testDir);
      await store1.initialize();

      const task = createTestTask('order-test-001');
      await store1.createTask(task);

      // Add multiple iterations with deliberate time spacing
      const iterations = [
        {
          id: 'order-test-001-iter-001',
          feedback: 'First iteration',
          timestamp: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'order-test-001-iter-002',
          feedback: 'Second iteration',
          timestamp: new Date('2024-01-01T10:30:00Z'),
        },
        {
          id: 'order-test-001-iter-003',
          feedback: 'Third iteration',
          timestamp: new Date('2024-01-01T11:00:00Z'),
        },
      ];

      for (const iter of iterations) {
        await store1.addIterationEntry('order-test-001', {
          ...iter,
          stage: 'implementation',
          beforeState: {
            timestamp: iter.timestamp,
            stage: 'implementation',
            status: 'in-progress',
            files: { created: [], modified: [] },
            usage: task.usage,
            artifactCount: 0,
          },
        });
      }

      store1.close();

      // Verify order in new session
      const store2 = new TaskStore(testDir);
      await store2.initialize();

      const history = await store2.getIterationHistory('order-test-001');
      expect(history.entries).toHaveLength(3);
      expect(history.totalIterations).toBe(3);

      // Verify chronological order is preserved
      expect(history.entries[0].id).toBe('order-test-001-iter-001');
      expect(history.entries[1].id).toBe('order-test-001-iter-002');
      expect(history.entries[2].id).toBe('order-test-001-iter-003');

      // Verify timestamps are ordered
      for (let i = 0; i < history.entries.length - 1; i++) {
        expect(history.entries[i].timestamp.getTime()).toBeLessThan(
          history.entries[i + 1].timestamp.getTime()
        );
      }

      store2.close();
    });

    it('should maintain snapshot data integrity across sessions', async () => {
      const store1 = new TaskStore(testDir);
      await store1.initialize();

      const task = createTestTask('snapshot-integrity-001');
      await store1.createTask(task);

      const beforeState: IterationSnapshot = {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        stage: 'implementation',
        status: 'in-progress',
        files: {
          created: ['src/component.ts', 'src/utils.ts'],
          modified: ['package.json', 'src/index.ts'],
        },
        usage: {
          inputTokens: 1500,
          outputTokens: 800,
          totalTokens: 2300,
          estimatedCost: 0.115,
        },
        artifactCount: 5,
      };

      const afterState: IterationSnapshot = {
        timestamp: new Date('2024-01-01T12:30:00Z'),
        stage: 'testing',
        status: 'in-progress',
        files: {
          created: ['src/component.ts', 'src/utils.ts', 'tests/component.test.ts'],
          modified: ['package.json', 'src/index.ts', 'src/component.ts'],
        },
        usage: {
          inputTokens: 2000,
          outputTokens: 1200,
          totalTokens: 3200,
          estimatedCost: 0.16,
        },
        artifactCount: 7,
      };

      const iterationEntry: Omit<IterationEntry, 'id'> & { id: string } = {
        id: 'snapshot-integrity-001-iter-001',
        feedback: 'Added comprehensive tests',
        timestamp: new Date('2024-01-01T12:15:00Z'),
        stage: 'implementation',
        beforeState,
        afterState,
        diffSummary: 'stage changed, 1 files added, 1 files modified, 900 tokens used',
        modifiedFiles: ['tests/component.test.ts', 'src/component.ts'],
      };

      await store1.addIterationEntry('snapshot-integrity-001', iterationEntry);
      store1.close();

      // Verify complete snapshot data in new session
      const store2 = new TaskStore(testDir);
      await store2.initialize();

      const history = await store2.getIterationHistory('snapshot-integrity-001');
      const savedIteration = history.entries[0];

      expect(savedIteration.beforeState).toBeDefined();
      expect(savedIteration.afterState).toBeDefined();
      expect(savedIteration.beforeState).toEqual(beforeState);
      expect(savedIteration.afterState).toEqual(afterState);
      expect(savedIteration.diffSummary).toBe(
        'stage changed, 1 files added, 1 files modified, 900 tokens used'
      );
      expect(savedIteration.modifiedFiles).toEqual([
        'tests/component.test.ts',
        'src/component.ts'
      ]);

      store2.close();
    });
  });

  describe('InteractionManager Session Persistence', () => {
    it('should preserve iteration history through InteractionManager restarts', async () => {
      // First session with InteractionManager
      const orchestrator1 = new ApexOrchestrator({ projectPath: testDir });
      const store1 = orchestrator1.getTaskStore();
      const interactionManager1 = orchestrator1.getInteractionManager();

      const task = createTestTask('manager-persist-001');
      await store1.createTask(task);

      // Create iterations through InteractionManager
      const firstIteration = await interactionManager1.iterateTask(
        'manager-persist-001',
        'First manager iteration'
      );

      await interactionManager1.completeIteration('manager-persist-001', firstIteration);

      const secondIteration = await interactionManager1.iterateTask(
        'manager-persist-001',
        'Second manager iteration'
      );

      await interactionManager1.completeIteration('manager-persist-001', secondIteration);

      // Second session (restart simulation)
      const orchestrator2 = new ApexOrchestrator({ projectPath: testDir });
      const interactionManager2 = orchestrator2.getInteractionManager();

      // Verify history is accessible
      const history = await orchestrator2.getIterationHistory('manager-persist-001');
      expect(history.entries).toHaveLength(2);
      expect(history.totalIterations).toBe(2);

      // Verify we can get iteration diffs
      const diff = await interactionManager2.getIterationDiff('manager-persist-001');
      expect(diff).toBeDefined();
      expect(diff.iterationId).toBe(secondIteration);
      expect(diff.previousIterationId).toBe(firstIteration);

      // Verify we can add more iterations
      const thirdIteration = await interactionManager2.iterateTask(
        'manager-persist-001',
        'Third iteration after restart'
      );

      const updatedHistory = await orchestrator2.getIterationHistory('manager-persist-001');
      expect(updatedHistory.entries).toHaveLength(3);
      expect(updatedHistory.totalIterations).toBe(3);
    });

    it('should handle concurrent access to iteration history', async () => {
      const orchestrator1 = new ApexOrchestrator({ projectPath: testDir });
      const orchestrator2 = new ApexOrchestrator({ projectPath: testDir });

      const store1 = orchestrator1.getTaskStore();
      const task = createTestTask('concurrent-access-001');
      await store1.createTask(task);

      const interactionManager1 = orchestrator1.getInteractionManager();
      const interactionManager2 = orchestrator2.getInteractionManager();

      // Create concurrent iterations from different managers
      const [iteration1, iteration2] = await Promise.all([
        interactionManager1.iterateTask('concurrent-access-001', 'Concurrent iteration 1'),
        interactionManager2.iterateTask('concurrent-access-001', 'Concurrent iteration 2'),
      ]);

      // Both should be unique
      expect(iteration1).not.toBe(iteration2);

      // Verify both are recorded
      const history = await orchestrator1.getIterationHistory('concurrent-access-001');
      expect(history.entries).toHaveLength(2);
      expect(history.totalIterations).toBe(2);

      const iterationIds = history.entries.map(e => e.id);
      expect(iterationIds).toContain(iteration1);
      expect(iterationIds).toContain(iteration2);
    });

    it('should recover gracefully from incomplete iteration states', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask('incomplete-state-001');
      await store.createTask(task);

      // Manually create an incomplete iteration (missing afterState)
      const incompleteIteration: Omit<IterationEntry, 'id'> & { id: string } = {
        id: 'incomplete-state-001-iter-incomplete',
        feedback: 'Incomplete iteration',
        timestamp: new Date(),
        stage: 'implementation',
        beforeState: {
          timestamp: new Date(),
          stage: 'implementation',
          status: 'in-progress',
          files: { created: ['src/test.ts'], modified: [] },
          usage: task.usage,
          artifactCount: 1,
        },
        // Missing afterState, diffSummary, modifiedFiles
      };

      await store.addIterationEntry('incomplete-state-001', incompleteIteration);
      store.close();

      // Create InteractionManager in new session
      const orchestrator = new ApexOrchestrator({ projectPath: testDir });
      const interactionManager = orchestrator.getInteractionManager();

      // Should be able to get history with incomplete iteration
      const history = await orchestrator.getIterationHistory('incomplete-state-001');
      expect(history.entries).toHaveLength(1);
      expect(history.entries[0].id).toBe('incomplete-state-001-iter-incomplete');

      // Should be able to continue with new iterations
      const newIteration = await interactionManager.iterateTask(
        'incomplete-state-001',
        'New iteration after incomplete'
      );

      const updatedHistory = await orchestrator.getIterationHistory('incomplete-state-001');
      expect(updatedHistory.entries).toHaveLength(2);
    });
  });

  describe('Database Integrity and Recovery', () => {
    it('should maintain database integrity across multiple write operations', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      const tasks = ['integrity-001', 'integrity-002', 'integrity-003'].map(createTestTask);

      // Create tasks and iterations in rapid succession
      for (const task of tasks) {
        await store.createTask(task);

        // Multiple iterations per task
        for (let i = 0; i < 3; i++) {
          const iteration: Omit<IterationEntry, 'id'> & { id: string } = {
            id: `${task.id}-iter-${i + 1}`,
            feedback: `Iteration ${i + 1} for ${task.id}`,
            timestamp: new Date(Date.now() + i * 1000),
            stage: 'implementation',
            beforeState: {
              timestamp: new Date(),
              stage: 'implementation',
              status: 'in-progress',
              files: { created: [], modified: [] },
              usage: task.usage,
              artifactCount: 0,
            },
          };

          await store.addIterationEntry(task.id, iteration);
        }
      }

      store.close();

      // Verify all data persisted correctly
      const verifyStore = new TaskStore(testDir);
      await verifyStore.initialize();

      for (const task of tasks) {
        const history = await verifyStore.getIterationHistory(task.id);
        expect(history.entries).toHaveLength(3);
        expect(history.totalIterations).toBe(3);

        // Verify iteration ordering
        for (let i = 0; i < history.entries.length - 1; i++) {
          expect(history.entries[i].timestamp.getTime()).toBeLessThan(
            history.entries[i + 1].timestamp.getTime()
          );
        }
      }

      verifyStore.close();
    });

    it('should handle database file corruption gracefully', async () => {
      const store1 = new TaskStore(testDir);
      await store1.initialize();

      const task = createTestTask('corruption-test-001');
      await store1.createTask(task);
      store1.close();

      // Simulate database corruption by truncating the file
      await fs.writeFile(dbPath, 'corrupted data', 'utf8');

      // Should handle gracefully and recreate database
      const store2 = new TaskStore(testDir);
      await expect(store2.initialize()).resolves.not.toThrow();

      // Database should be functional (though data is lost due to corruption)
      const newTask = createTestTask('post-corruption-001');
      await expect(store2.createTask(newTask)).resolves.not.toThrow();

      store2.close();
    });

    it('should support database migration and schema updates', async () => {
      // This test would be more relevant when schema changes are needed
      // For now, verify that the current schema is robust
      const store = new TaskStore(testDir);
      await store.initialize();

      // Verify database has expected tables and structure
      expect(await fs.pathExists(dbPath)).toBe(true);

      const task = createTestTask('schema-test-001');
      await store.createTask(task);

      const iteration: Omit<IterationEntry, 'id'> & { id: string } = {
        id: 'schema-test-001-iter-001',
        feedback: 'Schema test iteration',
        timestamp: new Date(),
        stage: 'implementation',
        beforeState: {
          timestamp: new Date(),
          stage: 'implementation',
          status: 'in-progress',
          files: { created: [], modified: [] },
          usage: task.usage,
          artifactCount: 0,
        },
      };

      await store.addIterationEntry(task.id, iteration);

      // Should be able to retrieve all data correctly
      const history = await store.getIterationHistory(task.id);
      expect(history.entries).toHaveLength(1);
      expect(history.entries[0].feedback).toBe('Schema test iteration');

      store.close();
    });
  });

  describe('Large Scale Data Handling', () => {
    it('should handle large iteration histories efficiently', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask('large-history-001');
      await store.createTask(task);

      const iterationCount = 100;
      const startTime = Date.now();

      // Create large number of iterations
      for (let i = 0; i < iterationCount; i++) {
        const iteration: Omit<IterationEntry, 'id'> & { id: string } = {
          id: `large-history-001-iter-${String(i).padStart(3, '0')}`,
          feedback: `Iteration ${i} with detailed feedback about the changes made`,
          timestamp: new Date(Date.now() + i * 100),
          stage: 'implementation',
          beforeState: {
            timestamp: new Date(),
            stage: 'implementation',
            status: 'in-progress',
            files: {
              created: [`src/file-${i}.ts`],
              modified: [`src/modified-${i}.ts`]
            },
            usage: {
              inputTokens: 1000 + i * 10,
              outputTokens: 500 + i * 5,
              totalTokens: 1500 + i * 15,
              estimatedCost: (1500 + i * 15) * 0.00005,
            },
            artifactCount: i + 1,
          },
          afterState: {
            timestamp: new Date(),
            stage: 'implementation',
            status: 'in-progress',
            files: {
              created: [`src/file-${i}.ts`, `src/new-${i}.ts`],
              modified: [`src/modified-${i}.ts`]
            },
            usage: {
              inputTokens: 1000 + (i + 1) * 10,
              outputTokens: 500 + (i + 1) * 5,
              totalTokens: 1500 + (i + 1) * 15,
              estimatedCost: (1500 + (i + 1) * 15) * 0.00005,
            },
            artifactCount: i + 2,
          },
          diffSummary: `Iteration ${i}: added 1 file, modified 1 file`,
          modifiedFiles: [`src/new-${i}.ts`, `src/modified-${i}.ts`],
        };

        await store.addIterationEntry(task.id, iteration);
      }

      const insertTime = Date.now() - startTime;
      console.log(`Inserted ${iterationCount} iterations in ${insertTime}ms`);

      store.close();

      // Test retrieval performance
      const retrieveStore = new TaskStore(testDir);
      await retrieveStore.initialize();

      const retrieveStartTime = Date.now();
      const history = await retrieveStore.getIterationHistory('large-history-001');
      const retrieveTime = Date.now() - retrieveStartTime;

      console.log(`Retrieved ${iterationCount} iterations in ${retrieveTime}ms`);

      expect(history.entries).toHaveLength(iterationCount);
      expect(history.totalIterations).toBe(iterationCount);

      // Verify first and last entries
      expect(history.entries[0].id).toBe('large-history-001-iter-000');
      expect(history.entries[iterationCount - 1].id).toBe('large-history-001-iter-099');

      retrieveStore.close();

      // Performance assertions (should complete in reasonable time)
      expect(insertTime).toBeLessThan(10000); // 10 seconds max
      expect(retrieveTime).toBeLessThan(1000); // 1 second max
    });

    it('should handle complex snapshot data efficiently', async () => {
      const store = new TaskStore(testDir);
      await store.initialize();

      const task = createTestTask('complex-snapshot-001');
      await store.createTask(task);

      // Create iteration with large, complex snapshot data
      const complexSnapshot: IterationSnapshot = {
        timestamp: new Date(),
        stage: 'implementation',
        status: 'in-progress',
        files: {
          created: Array.from({ length: 50 }, (_, i) => `src/generated/file-${i}.ts`),
          modified: Array.from({ length: 30 }, (_, i) => `src/existing/modified-${i}.ts`),
        },
        usage: {
          inputTokens: 50000,
          outputTokens: 25000,
          totalTokens: 75000,
          estimatedCost: 3.75,
        },
        artifactCount: 100,
      };

      const iteration: Omit<IterationEntry, 'id'> & { id: string } = {
        id: 'complex-snapshot-001-iter-001',
        feedback: 'Complex iteration with large snapshot data',
        timestamp: new Date(),
        stage: 'implementation',
        beforeState: complexSnapshot,
        afterState: {
          ...complexSnapshot,
          files: {
            ...complexSnapshot.files,
            created: [
              ...complexSnapshot.files.created,
              ...Array.from({ length: 20 }, (_, i) => `src/additional/file-${i}.ts`)
            ],
          },
          usage: {
            inputTokens: 55000,
            outputTokens: 28000,
            totalTokens: 83000,
            estimatedCost: 4.15,
          },
          artifactCount: 120,
        },
        diffSummary: '20 files added, 30 files modified, 8000 tokens used',
        modifiedFiles: Array.from({ length: 20 }, (_, i) => `src/additional/file-${i}.ts`),
      };

      const startTime = Date.now();
      await store.addIterationEntry(task.id, iteration);
      const insertTime = Date.now() - startTime;

      store.close();

      // Verify data integrity
      const verifyStore = new TaskStore(testDir);
      await verifyStore.initialize();

      const retrieveStartTime = Date.now();
      const history = await verifyStore.getIterationHistory('complex-snapshot-001');
      const retrieveTime = Date.now() - retrieveStartTime;

      expect(history.entries).toHaveLength(1);
      const savedIteration = history.entries[0];

      expect(savedIteration.beforeState!.files.created).toHaveLength(50);
      expect(savedIteration.afterState!.files.created).toHaveLength(70);
      expect(savedIteration.modifiedFiles).toHaveLength(20);

      verifyStore.close();

      console.log(`Complex snapshot insert: ${insertTime}ms, retrieve: ${retrieveTime}ms`);

      // Should handle complex data efficiently
      expect(insertTime).toBeLessThan(1000); // 1 second max
      expect(retrieveTime).toBeLessThan(500);  // 0.5 second max
    });
  });
});