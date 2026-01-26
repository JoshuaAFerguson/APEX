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
import type {
  Task,
  TaskUsage,
  TaskLog,
  TaskArtifact,
  SubtaskStrategy,
  TaskDecomposition,
  SubtaskDefinition,
  AutonomyLevel
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
// TaskUsage Interface Tests
// ============================================================================

describe('TaskUsage Interface', () => {
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
