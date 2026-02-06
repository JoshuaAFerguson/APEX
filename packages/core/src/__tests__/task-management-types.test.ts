/**
 * @fileoverview Comprehensive unit tests for Task Management types in @apex/core
 *
 * Tests cover Task interface, TaskUsage, TaskLog, TaskArtifact, SubtaskStrategy,
 * and TaskDecomposition types with validation of structure, JSDoc documentation,
 * and behavior in the APEX system.
 *
 * These types are the core building blocks for task execution, tracking, and
 * management throughout the APEX workflow lifecycle.
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

// Helper function to create a minimal valid Task object
function createMinimalTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-task-123',
    description: 'Test task description',
    workflow: 'feature-development',
    autonomy: 'supervised' as AutonomyLevel,
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: '/test/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date('2024-01-01T12:00:00Z'),
    updatedAt: new Date('2024-01-01T12:00:00Z'),
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

// ============================================================================
// TaskStatusSchema Tests
// ============================================================================

describe('TaskStatusSchema', () => {
  describe('schema validation', () => {
    it('should validate all documented status values from JSDoc', () => {
      const validStatuses: TaskStatus[] = [
        'pending',        // Task created but not yet queued
        'queued',         // Task ready for execution
        'planning',       // Agent is planning implementation approach
        'in-progress',    // Task actively being executed
        'waiting-approval',  // Task requires user approval (deprecated)
        'awaiting-approval', // Task requires user approval
        'paused',         // Task execution paused
        'completed',      // Task successfully finished
        'failed',         // Task execution failed
        'cancelled',      // Task was cancelled by user or system
      ];

      validStatuses.forEach((status) => {
        expect(() => TaskStatusSchema.parse(status)).not.toThrow();
        expect(TaskStatusSchema.parse(status)).toBe(status);
      });
    });

    it('should work with JSDoc example code', () => {
      // Test examples directly from JSDoc comments
      const status: TaskStatus = 'pending';
      expect(status).toBe('pending');

      const validStatus = TaskStatusSchema.parse('in-progress');
      expect(validStatus).toBe('in-progress');
    });

    it('should validate task progression workflow from JSDoc', () => {
      // Test progression example: pending → queued → planning → in-progress → completed
      const standardProgression: TaskStatus[] = [
        'pending',
        'queued',
        'planning',
        'in-progress',
        'completed'
      ];

      standardProgression.forEach((status) => {
        expect(() => TaskStatusSchema.parse(status)).not.toThrow();
      });

      // Test alternative progression with pause: pending → queued → planning → in-progress → paused → in-progress → completed
      const pausedProgression: TaskStatus[] = [
        'pending',
        'queued',
        'planning',
        'in-progress',
        'paused',
        'in-progress',
        'completed'
      ];

      pausedProgression.forEach((status) => {
        expect(() => TaskStatusSchema.parse(status)).not.toThrow();
      });
    });

    it('should reject invalid status values', () => {
      const invalidStatuses = [
        'invalid-status',
        'PENDING',           // Case sensitive
        'In-Progress',       // Case sensitive
        'ready',
        'running',
        '',                  // Empty string
        null,
        undefined,
        123,                 // Number
        true,                // Boolean
      ];

      invalidStatuses.forEach((status) => {
        expect(() => TaskStatusSchema.parse(status)).toThrow();
      });
    });
  });

  describe('type inference', () => {
    it('should infer correct TypeScript types', () => {
      const inferredStatus = 'failed';
      const typedStatus: TaskStatus = inferredStatus;
      expect(TaskStatusSchema.parse(typedStatus)).toBe('failed');

      // Test that all enum values are properly typed
      const allStatuses: TaskStatus[] = [
        'pending', 'queued', 'planning', 'in-progress',
        'waiting-approval', 'awaiting-approval', 'paused',
        'completed', 'failed', 'cancelled'
      ];

      allStatuses.forEach(status => {
        const typed: TaskStatus = status;
        expect(typed).toBe(status);
      });
    });
  });
});

// ============================================================================
// TaskPrioritySchema Tests
// ============================================================================

describe('TaskPrioritySchema', () => {
  describe('schema validation', () => {
    it('should validate all documented priority values from JSDoc', () => {
      const validPriorities: TaskPriority[] = [
        'low',      // Low priority, executed when resources available
        'normal',   // Default priority for most tasks
        'high',     // High priority, prioritized over normal/low
        'urgent',   // Highest priority, executed immediately when possible
      ];

      validPriorities.forEach((priority) => {
        expect(() => TaskPrioritySchema.parse(priority)).not.toThrow();
        expect(TaskPrioritySchema.parse(priority)).toBe(priority);
      });
    });

    it('should work with JSDoc example code', () => {
      // Test examples directly from JSDoc comments
      const priority: TaskPriority = 'normal';
      expect(priority).toBe('normal');

      const validPriority = TaskPrioritySchema.parse('urgent');
      expect(validPriority).toBe('urgent');
    });

    it('should validate priority ordering from JSDoc', () => {
      // Test priority ordering: urgent > high > normal > low
      const priorityOrder: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];

      priorityOrder.forEach((priority) => {
        expect(() => TaskPrioritySchema.parse(priority)).not.toThrow();
      });

      // Test that we can map priorities to numeric weights for sorting
      const priorityWeights = { low: 1, normal: 2, high: 3, urgent: 4 };
      priorityOrder.forEach((priority) => {
        expect(priorityWeights[priority]).toBeDefined();
        expect(typeof priorityWeights[priority]).toBe('number');
      });
    });

    it('should reject invalid priority values', () => {
      const invalidPriorities = [
        'critical',          // Not in enum
        'medium',           // Not in enum
        'LOW',              // Case sensitive
        'High',             // Case sensitive
        'emergency',        // Not in enum
        '',                 // Empty string
        null,
        undefined,
        1,                  // Number
        true,               // Boolean
      ];

      invalidPriorities.forEach((priority) => {
        expect(() => TaskPrioritySchema.parse(priority)).toThrow();
      });
    });
  });

  describe('priority logic support', () => {
    it('should support priority comparison and queue ordering', () => {
      const priorities: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];
      const priorityWeights = { low: 1, normal: 2, high: 3, urgent: 4 };

      // Test that all priorities can be mapped to weights for queue ordering
      priorities.forEach((priority) => {
        expect(priorityWeights[priority]).toBeDefined();
        expect(typeof priorityWeights[priority]).toBe('number');
        expect(priorityWeights[priority]).toBeGreaterThan(0);
      });

      // Test ordering logic
      expect(priorityWeights.urgent).toBeGreaterThan(priorityWeights.high);
      expect(priorityWeights.high).toBeGreaterThan(priorityWeights.normal);
      expect(priorityWeights.normal).toBeGreaterThan(priorityWeights.low);
    });
  });
});

// ============================================================================
// TaskEffortSchema Tests
// ============================================================================

describe('TaskEffortSchema', () => {
  describe('schema validation', () => {
    it('should validate all documented effort values from JSDoc', () => {
      const validEfforts: TaskEffort[] = [
        'xs',      // Extra small: minimal effort, quick fixes
        'small',   // Small: simple features or bug fixes
        'medium',  // Medium: moderate complexity features
        'large',   // Large: complex features or refactoring
        'xl',      // Extra large: major features or architectural changes
      ];

      validEfforts.forEach((effort) => {
        expect(() => TaskEffortSchema.parse(effort)).not.toThrow();
        expect(TaskEffortSchema.parse(effort)).toBe(effort);
      });
    });

    it('should work with JSDoc example code', () => {
      // Test examples directly from JSDoc comments
      const effort: TaskEffort = 'medium';
      expect(effort).toBe('medium');

      const validEffort = TaskEffortSchema.parse('large');
      expect(validEffort).toBe('large');
    });

    it('should validate effort level descriptions from JSDoc', () => {
      // Test that effort levels correspond to documented descriptions
      const effortDescriptions = {
        xs: 'minimal effort, quick fixes',
        small: 'simple features or bug fixes',
        medium: 'moderate complexity features',
        large: 'complex features or refactoring',
        xl: 'major features or architectural changes',
      };

      Object.keys(effortDescriptions).forEach((effort) => {
        expect(() => TaskEffortSchema.parse(effort)).not.toThrow();
      });
    });

    it('should validate time estimates from JSDoc comment', () => {
      // Test the time estimate mappings from JSDoc: xs: <1 hour, small: 1-4 hours, medium: 4-8 hours, large: 1-2 days, xl: 2+ days
      const efforts: TaskEffort[] = ['xs', 'small', 'medium', 'large', 'xl'];
      const effortHours = { xs: 0.5, small: 2, medium: 6, large: 16, xl: 40 };

      efforts.forEach((effort) => {
        expect(effortHours[effort]).toBeDefined();
        expect(typeof effortHours[effort]).toBe('number');
        expect(effortHours[effort]).toBeGreaterThan(0);
      });

      // Validate time progression (each level should generally be more than the previous)
      expect(effortHours.small).toBeGreaterThan(effortHours.xs);
      expect(effortHours.medium).toBeGreaterThan(effortHours.small);
      expect(effortHours.large).toBeGreaterThan(effortHours.medium);
      expect(effortHours.xl).toBeGreaterThan(effortHours.large);
    });

    it('should reject invalid effort values', () => {
      const invalidEfforts = [
        'extra-small',      // Not abbreviated
        'tiny',             // Not in enum
        'huge',             // Not in enum
        'XS',               // Case sensitive
        'Small',            // Case sensitive
        'mini',             // Not in enum
        '',                 // Empty string
        null,
        undefined,
        0,                  // Number
        false,              // Boolean
      ];

      invalidEfforts.forEach((effort) => {
        expect(() => TaskEffortSchema.parse(effort)).toThrow();
      });
    });
  });

  describe('effort estimation support', () => {
    it('should support effort-based planning and resource allocation', () => {
      const efforts: TaskEffort[] = ['xs', 'small', 'medium', 'large', 'xl'];
      const effortHours = { xs: 1, small: 4, medium: 8, large: 16, xl: 40 };
      const effortComplexity = { xs: 1, small: 2, medium: 3, large: 4, xl: 5 };

      // Test that all efforts can be mapped to planning metrics
      efforts.forEach((effort) => {
        expect(effortHours[effort]).toBeDefined();
        expect(effortComplexity[effort]).toBeDefined();
        expect(typeof effortHours[effort]).toBe('number');
        expect(typeof effortComplexity[effort]).toBe('number');
        expect(effortHours[effort]).toBeGreaterThan(0);
        expect(effortComplexity[effort]).toBeGreaterThan(0);
      });
    });
  });
});

// ============================================================================
// TaskUsage Interface Tests
// ============================================================================

describe('TaskUsage Interface', () => {
  describe('JSDoc example validation', () => {
    it('should work with exact JSDoc example', () => {
      // Test the exact example from JSDoc comments
      const usage: TaskUsage = {
        inputTokens: 1500,
        outputTokens: 800,
        totalTokens: 2300,
        estimatedCost: 0.023,
        totalCostCents: 23,
        executionTimeMs: 5000
      };

      expect(usage.inputTokens).toBe(1500);
      expect(usage.outputTokens).toBe(800);
      expect(usage.totalTokens).toBe(2300);
      expect(usage.estimatedCost).toBe(0.023);
      expect(usage.totalCostCents).toBe(23);
      expect(usage.executionTimeMs).toBe(5000);
    });
  });

  describe('structure validation', () => {
    it('should have all required fields with correct types', () => {
      const usage: TaskUsage = {
        inputTokens: 1500,
        outputTokens: 800,
        totalTokens: 2300,
        estimatedCost: 0.023,
        totalCostCents: 23,
        executionTimeMs: 5000
      };

      expect(typeof usage.inputTokens).toBe('number');
      expect(typeof usage.outputTokens).toBe('number');
      expect(typeof usage.totalTokens).toBe('number');
      expect(typeof usage.estimatedCost).toBe('number');
      expect(typeof usage.totalCostCents).toBe('number');
      expect(typeof usage.executionTimeMs).toBe('number');
    });

    it('should support zero values for all fields', () => {
      const usage: TaskUsage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        totalCostCents: 0,
        executionTimeMs: 0
      };

      expect(usage.inputTokens).toBe(0);
      expect(usage.outputTokens).toBe(0);
      expect(usage.totalTokens).toBe(0);
      expect(usage.estimatedCost).toBe(0);
      expect(usage.totalCostCents).toBe(0);
      expect(usage.executionTimeMs).toBe(0);
    });

    it('should support realistic token consumption values', () => {
      const usage: TaskUsage = {
        inputTokens: 15432,
        outputTokens: 8765,
        totalTokens: 24197,
        estimatedCost: 0.48394,
        totalCostCents: 48,
        executionTimeMs: 12500
      };

      expect(usage.inputTokens).toBeGreaterThan(0);
      expect(usage.outputTokens).toBeGreaterThan(0);
      expect(usage.totalTokens).toBe(usage.inputTokens + usage.outputTokens);
      expect(usage.estimatedCost).toBeGreaterThan(0);
      expect(usage.totalCostCents).toBeGreaterThan(0);
      expect(usage.executionTimeMs).toBeGreaterThan(0);
    });
  });

  describe('token calculation validation', () => {
    it('should maintain consistency between input+output and total tokens', () => {
      const usage: TaskUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        estimatedCost: 0.015,
        totalCostCents: 2,
        executionTimeMs: 3000
      };

      expect(usage.totalTokens).toBe(usage.inputTokens + usage.outputTokens);
    });

    it('should handle fractional cost values', () => {
      const usage: TaskUsage = {
        inputTokens: 750,
        outputTokens: 250,
        totalTokens: 1000,
        estimatedCost: 0.00875,
        totalCostCents: 1,
        executionTimeMs: 2500
      };

      expect(usage.estimatedCost).toBeLessThan(1);
      expect(usage.totalCostCents).toBeGreaterThanOrEqual(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very large token counts', () => {
      const usage: TaskUsage = {
        inputTokens: 100000,
        outputTokens: 50000,
        totalTokens: 150000,
        estimatedCost: 3.0,
        totalCostCents: 300,
        executionTimeMs: 60000
      };

      expect(usage.inputTokens).toBe(100000);
      expect(usage.totalTokens).toBe(150000);
    });

    it('should handle very short execution times', () => {
      const usage: TaskUsage = {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        estimatedCost: 0.0001,
        totalCostCents: 0,
        executionTimeMs: 100
      };

      expect(usage.executionTimeMs).toBe(100);
    });
  });
});

// ============================================================================
// TaskLog Interface Tests
// ============================================================================

describe('TaskLog Interface', () => {
  describe('JSDoc example validation', () => {
    it('should work with exact JSDoc example', () => {
      // Test the exact example from JSDoc comments
      const log: TaskLog = {
        timestamp: new Date(),
        level: 'info',
        stage: 'implementation',
        agent: 'developer',
        message: 'Starting code implementation',
        metadata: { fileCount: 3, estimatedTime: 300 }
      };

      expect(log.timestamp).toBeInstanceOf(Date);
      expect(log.level).toBe('info');
      expect(log.stage).toBe('implementation');
      expect(log.agent).toBe('developer');
      expect(log.message).toBe('Starting code implementation');
      expect(log.metadata?.fileCount).toBe(3);
      expect(log.metadata?.estimatedTime).toBe(300);
    });
  });

  describe('structure validation', () => {
    it('should have all required fields with correct types', () => {
      const log: TaskLog = {
        timestamp: new Date('2024-01-01T12:30:00Z'),
        level: 'info',
        stage: 'implementation',
        agent: 'developer',
        message: 'Starting code implementation',
        metadata: { fileCount: 3, estimatedTime: 300 }
      };

      expect(log.timestamp).toBeInstanceOf(Date);
      expect(['debug', 'info', 'warn', 'error']).toContain(log.level);
      expect(typeof log.stage).toBe('string');
      expect(typeof log.agent).toBe('string');
      expect(typeof log.message).toBe('string');
      expect(typeof log.metadata).toBe('object');
    });

    it('should support all log levels', () => {
      const levels: Array<'debug' | 'info' | 'warn' | 'error'> = ['debug', 'info', 'warn', 'error'];

      levels.forEach(level => {
        const log: TaskLog = {
          timestamp: new Date(),
          level,
          stage: 'testing',
          agent: 'tester',
          message: `Test message for ${level} level`
        };

        expect(log.level).toBe(level);
      });
    });

    it('should support optional metadata field', () => {
      const logWithoutMetadata: TaskLog = {
        timestamp: new Date(),
        level: 'info',
        stage: 'planning',
        agent: 'planner',
        message: 'Planning stage started'
      };

      const logWithMetadata: TaskLog = {
        timestamp: new Date(),
        level: 'info',
        stage: 'planning',
        agent: 'planner',
        message: 'Planning stage started',
        metadata: { complexity: 'medium', estimatedHours: 2 }
      };

      expect(logWithoutMetadata.metadata).toBeUndefined();
      expect(logWithMetadata.metadata).toBeDefined();
    });
  });

  describe('workflow stage tracking', () => {
    it('should track different workflow stages', () => {
      const stages = ['planning', 'implementation', 'testing', 'review', 'deployment'];

      stages.forEach(stage => {
        const log: TaskLog = {
          timestamp: new Date(),
          level: 'info',
          stage,
          agent: 'test-agent',
          message: `Working on ${stage} stage`
        };

        expect(log.stage).toBe(stage);
      });
    });
  });

  describe('error tracking', () => {
    it('should properly log error events', () => {
      const errorLog: TaskLog = {
        timestamp: new Date(),
        level: 'error',
        stage: 'implementation',
        agent: 'developer',
        message: 'Build failed due to TypeScript errors',
        metadata: {
          errorCount: 5,
          errorTypes: ['type-mismatch', 'missing-import'],
          files: ['src/components/Button.tsx', 'src/utils/helpers.ts']
        }
      };

      expect(errorLog.level).toBe('error');
      expect(errorLog.metadata?.errorCount).toBe(5);
    });
  });
});

// ============================================================================
// TaskArtifact Interface Tests
// ============================================================================

describe('TaskArtifact Interface', () => {
  describe('JSDoc example validation', () => {
    it('should work with exact JSDoc example', () => {
      // Test the exact example from JSDoc comments
      const artifact: TaskArtifact = {
        name: 'LoginComponent.tsx',
        type: 'file',
        path: '/src/components/LoginComponent.tsx',
        content: 'import React from "react"...',
        createdAt: new Date()
      };

      expect(artifact.name).toBe('LoginComponent.tsx');
      expect(artifact.type).toBe('file');
      expect(artifact.path).toBe('/src/components/LoginComponent.tsx');
      expect(artifact.content).toBe('import React from "react"...');
      expect(artifact.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('structure validation', () => {
    it('should have all required fields with correct types', () => {
      const artifact: TaskArtifact = {
        name: 'LoginComponent.tsx',
        type: 'file',
        path: '/src/components/LoginComponent.tsx',
        content: 'import React from "react"...',
        createdAt: new Date('2024-01-01T13:00:00Z')
      };

      expect(typeof artifact.name).toBe('string');
      expect(['file', 'diff', 'report', 'log']).toContain(artifact.type);
      expect(typeof artifact.path).toBe('string');
      expect(typeof artifact.content).toBe('string');
      expect(artifact.createdAt).toBeInstanceOf(Date);
    });

    it('should support all artifact types', () => {
      const types: Array<'file' | 'diff' | 'report' | 'log'> = ['file', 'diff', 'report', 'log'];

      types.forEach(type => {
        const artifact: TaskArtifact = {
          name: `test-artifact-${type}`,
          type,
          path: `/test/${type}/artifact`,
          content: `Content for ${type} artifact`,
          createdAt: new Date()
        };

        expect(artifact.type).toBe(type);
      });
    });

    it('should support optional size and metadata fields', () => {
      const artifactWithSize: TaskArtifact = {
        name: 'large-file.json',
        type: 'file',
        path: '/data/large-file.json',
        content: JSON.stringify({ data: 'large dataset' }),
        size: 1024,
        createdAt: new Date()
      };

      const artifactWithMetadata: TaskArtifact = {
        name: 'test-report.html',
        type: 'report',
        path: '/reports/test-report.html',
        content: '<html>Test Results</html>',
        metadata: {
          testsPassed: 25,
          testsFailed: 2,
          coverage: 85.5
        },
        createdAt: new Date()
      };

      expect(artifactWithSize.size).toBe(1024);
      expect(artifactWithMetadata.metadata?.testsPassed).toBe(25);
    });
  });

  describe('file artifacts', () => {
    it('should represent created code files', () => {
      const codeFile: TaskArtifact = {
        name: 'UserService.ts',
        type: 'file',
        path: '/src/services/UserService.ts',
        content: `export class UserService {
  async getUser(id: string) {
    // Implementation
  }
}`,
        size: 156,
        createdAt: new Date()
      };

      expect(codeFile.type).toBe('file');
      expect(codeFile.name.endsWith('.ts')).toBe(true);
    });
  });

  describe('diff artifacts', () => {
    it('should represent code changes', () => {
      const diffArtifact: TaskArtifact = {
        name: 'login-form-changes.diff',
        type: 'diff',
        path: '/src/components/LoginForm.tsx',
        content: `@@ -15,7 +15,12 @@
   const [password, setPassword] = useState('');

   const handleSubmit = (e) => {
+    e.preventDefault();
+    if (!email || !password) {
+      setError('Please fill in all fields');
+      return;
+    }
     // Submit logic
   };`,
        createdAt: new Date()
      };

      expect(diffArtifact.type).toBe('diff');
      expect(diffArtifact.content.includes('@@')).toBe(true);
    });
  });
});

// ============================================================================
// SubtaskStrategy Type Tests
// ============================================================================

describe('SubtaskStrategy Type', () => {
  describe('JSDoc example validation', () => {
    it('should work with exact JSDoc example', () => {
      // Test the exact example from JSDoc comments
      const strategy: SubtaskStrategy = 'parallel';
      expect(strategy).toBe('parallel');
    });

    it('should validate all strategies mentioned in JSDoc', () => {
      // sequential: subtasks execute one after another
      const sequential: SubtaskStrategy = 'sequential';
      expect(sequential).toBe('sequential');

      // parallel: all subtasks execute simultaneously
      const parallel: SubtaskStrategy = 'parallel';
      expect(parallel).toBe('parallel');

      // dependency-based: execution order determined by dependsOn relationships
      const dependencyBased: SubtaskStrategy = 'dependency-based';
      expect(dependencyBased).toBe('dependency-based');
    });
  });

  describe('valid strategy values', () => {
    it('should accept sequential strategy', () => {
      const strategy: SubtaskStrategy = 'sequential';
      expect(strategy).toBe('sequential');
    });

    it('should accept parallel strategy', () => {
      const strategy: SubtaskStrategy = 'parallel';
      expect(strategy).toBe('parallel');
    });

    it('should accept dependency-based strategy', () => {
      const strategy: SubtaskStrategy = 'dependency-based';
      expect(strategy).toBe('dependency-based');
    });
  });

  describe('usage in task context', () => {
    it('should work with sequential execution', () => {
      const task = createMinimalTask({
        subtaskStrategy: 'sequential',
        subtaskIds: ['subtask-1', 'subtask-2', 'subtask-3']
      });

      expect(task.subtaskStrategy).toBe('sequential');
      expect(task.subtaskIds).toHaveLength(3);
    });

    it('should work with parallel execution', () => {
      const task = createMinimalTask({
        subtaskStrategy: 'parallel',
        subtaskIds: ['parallel-1', 'parallel-2']
      });

      expect(task.subtaskStrategy).toBe('parallel');
    });

    it('should work with dependency-based execution', () => {
      const task = createMinimalTask({
        subtaskStrategy: 'dependency-based',
        subtaskIds: ['dep-task-1', 'dep-task-2'],
        dependsOn: ['prerequisite-task']
      });

      expect(task.subtaskStrategy).toBe('dependency-based');
      expect(task.dependsOn).toContain('prerequisite-task');
    });
  });
});

// ============================================================================
// TaskDecomposition Interface Tests
// ============================================================================

describe('TaskDecomposition Interface', () => {
  describe('structure validation', () => {
    it('should have all required fields with correct types', () => {
      const decomposition: TaskDecomposition = {
        parentTaskId: 'parent-123',
        subtasks: [
          {
            description: 'Create user model',
            acceptanceCriteria: 'Model should include validation',
            priority: 'normal',
            effort: 'small',
            dependsOn: []
          }
        ],
        strategy: 'dependency-based'
      };

      expect(typeof decomposition.parentTaskId).toBe('string');
      expect(Array.isArray(decomposition.subtasks)).toBe(true);
      expect(['sequential', 'parallel', 'dependency-based']).toContain(decomposition.strategy);
    });

    it('should support multiple subtasks with different configurations', () => {
      const decomposition: TaskDecomposition = {
        parentTaskId: 'complex-feature-456',
        subtasks: [
          {
            description: 'Design database schema',
            acceptanceCriteria: 'Schema supports all required entities',
            priority: 'high',
            effort: 'medium',
            dependsOn: []
          },
          {
            description: 'Implement API endpoints',
            acceptanceCriteria: 'All CRUD operations work correctly',
            priority: 'normal',
            effort: 'large',
            dependsOn: ['schema-task']
          },
          {
            description: 'Add frontend components',
            acceptanceCriteria: 'UI matches design specifications',
            priority: 'normal',
            effort: 'medium',
            dependsOn: ['api-task']
          }
        ],
        strategy: 'dependency-based'
      };

      expect(decomposition.subtasks).toHaveLength(3);
      expect(decomposition.subtasks[0].priority).toBe('high');
      expect(decomposition.subtasks[1].dependsOn).toContain('schema-task');
      expect(decomposition.strategy).toBe('dependency-based');
    });
  });

  describe('subtask definitions', () => {
    it('should validate SubtaskDefinition structure', () => {
      const subtaskDef: SubtaskDefinition = {
        description: 'Implement user authentication',
        acceptanceCriteria: 'Users can login and logout securely',
        priority: 'urgent',
        effort: 'large',
        dependsOn: ['user-model', 'auth-service']
      };

      expect(typeof subtaskDef.description).toBe('string');
      expect(typeof subtaskDef.acceptanceCriteria).toBe('string');
      expect(['low', 'normal', 'high', 'urgent']).toContain(subtaskDef.priority);
      expect(['xs', 'small', 'medium', 'large', 'xl']).toContain(subtaskDef.effort);
      expect(Array.isArray(subtaskDef.dependsOn)).toBe(true);
    });

    it('should support subtasks without dependencies', () => {
      const independentSubtask: SubtaskDefinition = {
        description: 'Add unit tests',
        acceptanceCriteria: 'All functions have test coverage',
        priority: 'normal',
        effort: 'medium',
        dependsOn: []
      };

      expect(independentSubtask.dependsOn).toHaveLength(0);
    });
  });

  describe('execution strategies', () => {
    it('should support sequential strategy for ordered execution', () => {
      const sequentialDecomposition: TaskDecomposition = {
        parentTaskId: 'sequential-feature',
        subtasks: [
          {
            description: 'Step 1: Setup',
            acceptanceCriteria: 'Environment is configured',
            priority: 'normal',
            effort: 'small',
            dependsOn: []
          },
          {
            description: 'Step 2: Implementation',
            acceptanceCriteria: 'Feature is implemented',
            priority: 'normal',
            effort: 'large',
            dependsOn: []
          }
        ],
        strategy: 'sequential'
      };

      expect(sequentialDecomposition.strategy).toBe('sequential');
    });

    it('should support parallel strategy for independent execution', () => {
      const parallelDecomposition: TaskDecomposition = {
        parentTaskId: 'parallel-feature',
        subtasks: [
          {
            description: 'Frontend component',
            acceptanceCriteria: 'UI component works',
            priority: 'normal',
            effort: 'medium',
            dependsOn: []
          },
          {
            description: 'Backend API',
            acceptanceCriteria: 'API endpoints work',
            priority: 'normal',
            effort: 'medium',
            dependsOn: []
          }
        ],
        strategy: 'parallel'
      };

      expect(parallelDecomposition.strategy).toBe('parallel');
    });
  });
});

// ============================================================================
// Task Interface Integration Tests
// ============================================================================

describe('Task Interface Integration', () => {
  describe('complete task with all components', () => {
    it('should create a valid complete task with usage, logs, and artifacts', () => {
      const completeTask: Task = {
        id: 'complete-task-789',
        description: 'Build comprehensive feature',
        acceptanceCriteria: 'Feature meets all requirements and passes tests',
        workflow: 'feature-development',
        autonomy: 'supervised',
        status: 'in-progress',
        priority: 'high',
        effort: 'large',
        currentStage: 'implementation',
        projectPath: '/workspace/my-project',
        branchName: 'feature/comprehensive-feature',
        retryCount: 1,
        maxRetries: 3,
        resumeAttempts: 0,
        dependsOn: ['prerequisite-task'],
        subtaskIds: ['subtask-1', 'subtask-2'],
        subtaskStrategy: 'dependency-based',
        dryRun: false,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T14:00:00Z'),
        usage: {
          inputTokens: 5000,
          outputTokens: 3000,
          totalTokens: 8000,
          estimatedCost: 0.16,
          totalCostCents: 16,
          executionTimeMs: 15000
        },
        logs: [
          {
            timestamp: new Date('2024-01-01T10:05:00Z'),
            level: 'info',
            stage: 'planning',
            agent: 'planner',
            message: 'Task planning started'
          },
          {
            timestamp: new Date('2024-01-01T12:00:00Z'),
            level: 'info',
            stage: 'implementation',
            agent: 'developer',
            message: 'Implementation phase began',
            metadata: { filesPlanned: 5 }
          }
        ],
        artifacts: [
          {
            name: 'feature-plan.md',
            type: 'file',
            path: '/docs/feature-plan.md',
            content: '# Feature Implementation Plan\n\n...',
            createdAt: new Date('2024-01-01T10:30:00Z')
          },
          {
            name: 'FeatureComponent.tsx',
            type: 'file',
            path: '/src/components/FeatureComponent.tsx',
            content: 'import React from "react";\n\nexport const FeatureComponent = () => {\n  return <div>Feature</div>;\n};',
            size: 95,
            createdAt: new Date('2024-01-01T12:30:00Z')
          }
        ]
      };

      // Validate all components work together
      expect(completeTask.id).toBe('complete-task-789');
      expect(completeTask.status).toBe('in-progress');
      expect(completeTask.subtaskStrategy).toBe('dependency-based');
      expect(completeTask.usage.totalTokens).toBe(8000);
      expect(completeTask.logs).toHaveLength(2);
      expect(completeTask.artifacts).toHaveLength(2);
      expect(completeTask.artifacts[0].type).toBe('file');
      expect(completeTask.logs[1].metadata?.filesPlanned).toBe(5);
    });
  });

  describe('task lifecycle transitions', () => {
    it('should support task progression through statuses', () => {
      const baseTask = createMinimalTask();

      // Test status progression
      const statuses: Array<Task['status']> = ['pending', 'queued', 'planning', 'in-progress', 'completed'];

      statuses.forEach(status => {
        const task: Task = { ...baseTask, status };
        expect(task.status).toBe(status);
      });
    });

    it('should track task timing correctly', () => {
      const task = createMinimalTask({
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T14:00:00Z'),
        completedAt: new Date('2024-01-01T16:00:00Z'),
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.03,
          totalCostCents: 3,
          executionTimeMs: 21600000 // 6 hours in milliseconds
        }
      });

      const duration = task.completedAt!.getTime() - task.createdAt.getTime();
      expect(duration).toBe(6 * 60 * 60 * 1000); // 6 hours
      expect(task.usage.executionTimeMs).toBe(duration);
    });
  });

  describe('subtask relationships', () => {
    it('should properly link parent and child tasks', () => {
      const parentTask = createMinimalTask({
        id: 'parent-task',
        subtaskIds: ['child-1', 'child-2'],
        subtaskStrategy: 'parallel'
      });

      const childTask1 = createMinimalTask({
        id: 'child-1',
        parentTaskId: 'parent-task'
      });

      const childTask2 = createMinimalTask({
        id: 'child-2',
        parentTaskId: 'parent-task'
      });

      expect(parentTask.subtaskIds).toContain('child-1');
      expect(parentTask.subtaskIds).toContain('child-2');
      expect(parentTask.subtaskStrategy).toBe('parallel');
      expect(childTask1.parentTaskId).toBe('parent-task');
      expect(childTask2.parentTaskId).toBe('parent-task');
    });
  });
});
