/**
 * @fileoverview Additional edge case tests for Task Management types in @apex/core
 *
 * This file complements the main task-management-types.test.ts with additional
 * edge cases, serialization tests, and complex integration scenarios.
 *
 * Focus areas:
 * - Schema serialization/deserialization
 * - Error boundary testing
 * - Complex object validation
 * - Performance edge cases
 * - Memory usage patterns
 */

import { describe, it, expect } from 'vitest';
import {
  Task,
  TaskUsage,
  TaskLog,
  TaskArtifact,
  SubtaskStrategy,
  TaskDecomposition,
  SubtaskDefinition,
  AutonomyLevel,
  TaskStatusSchema,
  TaskStatus,
  TaskPrioritySchema,
  TaskPriority,
  TaskEffortSchema,
  TaskEffort,
} from '../types';

// Helper to create minimal valid Task
function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'edge-case-task',
    description: 'Edge case testing task',
    workflow: 'testing-workflow',
    autonomy: 'supervised' as AutonomyLevel,
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: '/test',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      totalCostCents: 0,
      executionTimeMs: 0
    },
    logs: [],
    artifacts: [],
    ...overrides
  };
}

describe('TaskStatusSchema Edge Cases', () => {
  describe('serialization and parsing', () => {
    it('should handle schema serialization/deserialization', () => {
      const status: TaskStatus = 'in-progress';
      const serialized = JSON.stringify(status);
      const parsed = JSON.parse(serialized) as TaskStatus;

      expect(() => TaskStatusSchema.parse(parsed)).not.toThrow();
      expect(TaskStatusSchema.parse(parsed)).toBe(status);
    });

    it('should handle array of statuses correctly', () => {
      const statuses: TaskStatus[] = ['pending', 'in-progress', 'completed'];
      const schema = TaskStatusSchema.array();

      expect(() => schema.parse(statuses)).not.toThrow();
      expect(schema.parse(statuses)).toEqual(statuses);
    });

    it('should provide meaningful error messages for invalid values', () => {
      try {
        TaskStatusSchema.parse('invalid-status');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Invalid enum value');
      }
    });
  });

  describe('type safety edge cases', () => {
    it('should handle undefined and null correctly', () => {
      expect(() => TaskStatusSchema.parse(undefined)).toThrow();
      expect(() => TaskStatusSchema.parse(null)).toThrow();
    });

    it('should handle numeric values that might look like strings', () => {
      expect(() => TaskStatusSchema.parse(0)).toThrow();
      expect(() => TaskStatusSchema.parse(1)).toThrow();
      expect(() => TaskStatusSchema.parse(false)).toThrow();
    });
  });
});

describe('TaskPrioritySchema Edge Cases', () => {
  describe('priority queue scenarios', () => {
    it('should support priority-based sorting logic', () => {
      const priorities: TaskPriority[] = ['urgent', 'low', 'normal', 'high'];
      const priorityWeights = { low: 1, normal: 2, high: 3, urgent: 4 };

      // Sort by priority weight (highest first)
      const sorted = priorities.sort((a, b) => priorityWeights[b] - priorityWeights[a]);

      expect(sorted).toEqual(['urgent', 'high', 'normal', 'low']);
    });

    it('should handle priority changes in task lifecycle', () => {
      const task = createTask({ priority: 'normal' });

      // Simulate priority escalation
      const escalatedPriorities: TaskPriority[] = ['normal', 'high', 'urgent'];
      escalatedPriorities.forEach(priority => {
        const validatedPriority = TaskPrioritySchema.parse(priority);
        expect(validatedPriority).toBe(priority);
      });
    });
  });

  describe('default value handling', () => {
    it('should work with optional schemas using default values', () => {
      const schemaWithDefault = TaskPrioritySchema.default('normal');
      expect(schemaWithDefault.parse(undefined)).toBe('normal');
      expect(schemaWithDefault.parse('high')).toBe('high');
    });
  });
});

describe('TaskEffortSchema Edge Cases', () => {
  describe('effort estimation calculations', () => {
    it('should support complex effort calculations', () => {
      const effortToHours = {
        xs: 0.5,    // 30 minutes
        small: 2,   // 2 hours
        medium: 6,  // 6 hours
        large: 16,  // 2 days
        xl: 40      // 1 week
      };

      const efforts: TaskEffort[] = ['xs', 'small', 'medium', 'large', 'xl'];

      efforts.forEach(effort => {
        expect(effortToHours[effort]).toBeDefined();
        expect(effortToHours[effort]).toBeGreaterThan(0);
      });

      // Test cumulative calculation
      const totalHours = efforts.reduce((sum, effort) => sum + effortToHours[effort], 0);
      expect(totalHours).toBe(64.5);
    });

    it('should handle effort-based resource allocation', () => {
      const effort: TaskEffort = 'large';
      const complexityMultipliers = {
        xs: 1,
        small: 1.2,
        medium: 1.5,
        large: 2,
        xl: 3
      };

      expect(complexityMultipliers[effort]).toBe(2);
    });
  });
});

describe('TaskUsage Edge Cases', () => {
  describe('token calculation edge cases', () => {
    it('should handle very large token counts', () => {
      const largeUsage: TaskUsage = {
        inputTokens: Number.MAX_SAFE_INTEGER - 1000,
        outputTokens: 1000,
        totalTokens: Number.MAX_SAFE_INTEGER,
        estimatedCost: 999.99,
        totalCostCents: 99999,
        executionTimeMs: 86400000 // 24 hours
      };

      expect(largeUsage.inputTokens).toBeLessThan(Number.MAX_SAFE_INTEGER);
      expect(largeUsage.totalTokens).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle decimal precision in cost calculations', () => {
      const preciseUsage: TaskUsage = {
        inputTokens: 1234,
        outputTokens: 567,
        totalTokens: 1801,
        estimatedCost: 0.0036020, // Precise calculation
        totalCostCents: 0, // Less than 1 cent
        executionTimeMs: 1500
      };

      expect(preciseUsage.estimatedCost).toBeCloseTo(0.0036, 6);
      expect(preciseUsage.totalCostCents).toBe(0);
    });

    it('should handle zero and near-zero values', () => {
      const minimalUsage: TaskUsage = {
        inputTokens: 1,
        outputTokens: 0,
        totalTokens: 1,
        estimatedCost: 0.000001,
        totalCostCents: 0,
        executionTimeMs: 1
      };

      expect(minimalUsage.inputTokens).toBeGreaterThan(0);
      expect(minimalUsage.outputTokens).toBe(0);
      expect(minimalUsage.estimatedCost).toBeGreaterThan(0);
    });
  });

  describe('usage aggregation scenarios', () => {
    it('should support usage accumulation across multiple operations', () => {
      const operation1: TaskUsage = {
        inputTokens: 500,
        outputTokens: 300,
        totalTokens: 800,
        estimatedCost: 0.016,
        totalCostCents: 2,
        executionTimeMs: 2000
      };

      const operation2: TaskUsage = {
        inputTokens: 750,
        outputTokens: 400,
        totalTokens: 1150,
        estimatedCost: 0.023,
        totalCostCents: 2,
        executionTimeMs: 3000
      };

      // Aggregate usage
      const aggregated: TaskUsage = {
        inputTokens: operation1.inputTokens + operation2.inputTokens,
        outputTokens: operation1.outputTokens + operation2.outputTokens,
        totalTokens: operation1.totalTokens + operation2.totalTokens,
        estimatedCost: operation1.estimatedCost + operation2.estimatedCost,
        totalCostCents: operation1.totalCostCents + operation2.totalCostCents,
        executionTimeMs: operation1.executionTimeMs + operation2.executionTimeMs
      };

      expect(aggregated.totalTokens).toBe(1950);
      expect(aggregated.estimatedCost).toBeCloseTo(0.039, 3);
      expect(aggregated.executionTimeMs).toBe(5000);
    });
  });
});

describe('TaskLog Edge Cases', () => {
  describe('log message handling', () => {
    it('should handle very long log messages', () => {
      const longMessage = 'A'.repeat(10000);
      const log: TaskLog = {
        timestamp: new Date(),
        level: 'info',
        stage: 'implementation',
        agent: 'developer',
        message: longMessage
      };

      expect(log.message.length).toBe(10000);
      expect(typeof log.message).toBe('string');
    });

    it('should handle special characters in log messages', () => {
      const specialMessage = 'Task failed: Error {code: 500, msg: "Database \\n connection lost"}';
      const log: TaskLog = {
        timestamp: new Date(),
        level: 'error',
        stage: 'implementation',
        agent: 'developer',
        message: specialMessage
      };

      expect(log.message).toContain('\\n');
      expect(log.message).toContain('"');
    });

    it('should handle empty and minimal metadata', () => {
      const logWithEmptyMetadata: TaskLog = {
        timestamp: new Date(),
        level: 'debug',
        stage: 'testing',
        agent: 'tester',
        message: 'Debug message',
        metadata: {}
      };

      const logWithNestedMetadata: TaskLog = {
        timestamp: new Date(),
        level: 'warn',
        stage: 'implementation',
        agent: 'developer',
        message: 'Complex warning',
        metadata: {
          performance: {
            cpuUsage: 85.5,
            memoryUsage: '256MB'
          },
          context: {
            function: 'processLargeDataset',
            line: 42,
            file: 'data-processor.ts'
          }
        }
      };

      expect(logWithEmptyMetadata.metadata).toEqual({});
      expect(logWithNestedMetadata.metadata?.performance).toBeDefined();
    });
  });

  describe('timestamp precision', () => {
    it('should handle high-precision timestamps', () => {
      const highPrecisionTime = new Date('2024-01-01T12:30:45.123Z');
      const log: TaskLog = {
        timestamp: highPrecisionTime,
        level: 'info',
        stage: 'planning',
        agent: 'planner',
        message: 'High precision timestamp test'
      };

      expect(log.timestamp.getMilliseconds()).toBe(123);
      expect(log.timestamp.toISOString()).toBe('2024-01-01T12:30:45.123Z');
    });
  });
});

describe('TaskArtifact Edge Cases', () => {
  describe('artifact size and content handling', () => {
    it('should handle large file artifacts', () => {
      const largeContent = 'x'.repeat(100000); // 100KB of content
      const artifact: TaskArtifact = {
        name: 'large-data.json',
        type: 'file',
        path: '/data/large-data.json',
        content: largeContent,
        size: largeContent.length,
        createdAt: new Date()
      };

      expect(artifact.size).toBe(100000);
      expect(artifact.content.length).toBe(artifact.size);
    });

    it('should handle binary content representations', () => {
      // Simulate base64 encoded binary content
      const binaryArtifact: TaskArtifact = {
        name: 'image.png',
        type: 'file',
        path: '/assets/image.png',
        content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        metadata: {
          encoding: 'base64',
          mimeType: 'image/png',
          originalSize: 68
        },
        createdAt: new Date()
      };

      expect(binaryArtifact.metadata?.encoding).toBe('base64');
      expect(binaryArtifact.metadata?.mimeType).toBe('image/png');
    });
  });

  describe('complex diff artifacts', () => {
    it('should handle complex multi-file diff artifacts', () => {
      const multiFileDiff: TaskArtifact = {
        name: 'feature-implementation.diff',
        type: 'diff',
        path: '/changes/feature-implementation.diff',
        content: `diff --git a/src/feature.ts b/src/feature.ts
new file mode 100644
index 0000000..abcd123
--- /dev/null
+++ b/src/feature.ts
@@ -0,0 +1,15 @@
+export class Feature {
+  constructor(private name: string) {}
+
+  execute(): void {
+    console.log(\`Executing \${this.name}\`);
+  }
+}

diff --git a/src/feature.test.ts b/src/feature.test.ts
new file mode 100644
index 0000000..efgh456
--- /dev/null
+++ b/src/feature.test.ts
@@ -0,0 +1,8 @@
+import { Feature } from './feature';
+
+describe('Feature', () => {
+  it('should execute successfully', () => {
+    const feature = new Feature('test');
+    expect(() => feature.execute()).not.toThrow();
+  });
+});`,
        metadata: {
          filesChanged: 2,
          linesAdded: 23,
          linesRemoved: 0
        },
        createdAt: new Date()
      };

      expect(multiFileDiff.content).toContain('diff --git');
      expect(multiFileDiff.metadata?.filesChanged).toBe(2);
    });
  });
});

describe('SubtaskStrategy and TaskDecomposition Edge Cases', () => {
  describe('complex decomposition scenarios', () => {
    it('should handle deeply nested task hierarchies', () => {
      const complexDecomposition: TaskDecomposition = {
        parentTaskId: 'epic-task',
        subtasks: Array.from({ length: 50 }, (_, i) => ({
          description: `Subtask ${i + 1}`,
          acceptanceCriteria: `Criteria for subtask ${i + 1}`,
          priority: (i < 10 ? 'urgent' : i < 25 ? 'high' : 'normal') as TaskPriority,
          effort: (i % 5 === 0 ? 'xl' : i % 3 === 0 ? 'large' : 'medium') as TaskEffort,
          dependsOn: i > 0 ? [`subtask-${i}`] : []
        })),
        strategy: 'dependency-based'
      };

      expect(complexDecomposition.subtasks).toHaveLength(50);
      expect(complexDecomposition.subtasks[0].priority).toBe('urgent');
      expect(complexDecomposition.subtasks[49].priority).toBe('normal');
    });

    it('should handle circular dependency detection scenarios', () => {
      const circularDecomposition: TaskDecomposition = {
        parentTaskId: 'circular-parent',
        subtasks: [
          {
            description: 'Task A',
            acceptanceCriteria: 'A depends on C',
            priority: 'normal',
            effort: 'medium',
            dependsOn: ['task-c']
          },
          {
            description: 'Task B',
            acceptanceCriteria: 'B depends on A',
            priority: 'normal',
            effort: 'medium',
            dependsOn: ['task-a']
          },
          {
            description: 'Task C',
            acceptanceCriteria: 'C depends on B (circular!)',
            priority: 'normal',
            effort: 'medium',
            dependsOn: ['task-b']
          }
        ],
        strategy: 'dependency-based'
      };

      // This represents a circular dependency that should be detected
      const dependencies = new Map();
      circularDecomposition.subtasks.forEach((subtask, i) => {
        dependencies.set(`task-${String.fromCharCode(97 + i)}`, subtask.dependsOn);
      });

      expect(dependencies.size).toBe(3);
      expect(dependencies.get('task-a')).toContain('task-c');
      expect(dependencies.get('task-c')).toContain('task-b');
    });
  });

  describe('parallel execution edge cases', () => {
    it('should handle maximum parallel task limits', () => {
      const maxParallelTasks = 100;
      const parallelDecomposition: TaskDecomposition = {
        parentTaskId: 'parallel-heavy',
        subtasks: Array.from({ length: maxParallelTasks }, (_, i) => ({
          description: `Parallel task ${i + 1}`,
          acceptanceCriteria: `Independent execution ${i + 1}`,
          priority: 'normal',
          effort: 'small',
          dependsOn: [] // All independent for parallel execution
        })),
        strategy: 'parallel'
      };

      expect(parallelDecomposition.subtasks).toHaveLength(maxParallelTasks);
      expect(parallelDecomposition.strategy).toBe('parallel');
      // All tasks should have no dependencies for true parallel execution
      const allIndependent = parallelDecomposition.subtasks.every(task => task.dependsOn.length === 0);
      expect(allIndependent).toBe(true);
    });
  });
});

describe('Task Interface Integration Edge Cases', () => {
  describe('task state transitions', () => {
    it('should handle rapid state transitions', () => {
      const task = createTask({
        status: 'pending',
        logs: [],
        artifacts: []
      });

      // Simulate rapid state transitions
      const stateTransitions: TaskStatus[] = [
        'pending',
        'queued',
        'planning',
        'in-progress',
        'paused',
        'in-progress',
        'completed'
      ];

      stateTransitions.forEach((status, index) => {
        const transitionLog: TaskLog = {
          timestamp: new Date(Date.now() + index * 100), // 100ms apart
          level: 'info',
          stage: 'orchestrator',
          agent: 'system',
          message: `Task transitioned to ${status}`,
          metadata: { previousStatus: task.status, newStatus: status }
        };

        task.status = status;
        task.logs.push(transitionLog);
      });

      expect(task.logs).toHaveLength(7);
      expect(task.status).toBe('completed');
      expect(task.logs[0].metadata?.newStatus).toBe('pending');
      expect(task.logs[6].metadata?.newStatus).toBe('completed');
    });
  });

  describe('memory and performance edge cases', () => {
    it('should handle tasks with extensive history', () => {
      const task = createTask({
        logs: Array.from({ length: 1000 }, (_, i) => ({
          timestamp: new Date(Date.now() - (1000 - i) * 1000), // 1 second apart
          level: (i % 4 === 0 ? 'error' : i % 3 === 0 ? 'warn' : 'info') as any,
          stage: 'implementation',
          agent: 'developer',
          message: `Log entry ${i + 1}`,
          metadata: { iteration: i + 1 }
        })),
        artifacts: Array.from({ length: 50 }, (_, i) => ({
          name: `artifact-${i + 1}.txt`,
          type: 'file' as const,
          path: `/artifacts/artifact-${i + 1}.txt`,
          content: `Content for artifact ${i + 1}`,
          createdAt: new Date(Date.now() - (50 - i) * 60000) // 1 minute apart
        })),
        usage: {
          inputTokens: 500000,
          outputTokens: 300000,
          totalTokens: 800000,
          estimatedCost: 16.0,
          totalCostCents: 1600,
          executionTimeMs: 3600000 // 1 hour
        }
      });

      expect(task.logs).toHaveLength(1000);
      expect(task.artifacts).toHaveLength(50);
      expect(task.usage.totalTokens).toBe(800000);
    });
  });
});