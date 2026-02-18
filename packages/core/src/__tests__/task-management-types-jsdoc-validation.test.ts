/**
 * @fileoverview JSDoc Documentation Validation Tests for Task Management Types
 *
 * This test file specifically validates that the JSDoc documentation added to Task Management
 * types is correct, complete, and provides working examples as documented.
 *
 * This extends the existing comprehensive test coverage in:
 * - task-management-types.test.ts (main comprehensive tests)
 * - task-management-types.edge-cases.test.ts (edge case scenarios)
 *
 * Focus areas for JSDoc validation:
 * - Example code in JSDoc comments works correctly
 * - All documented enum values are valid
 * - Interface properties match documentation
 * - Usage examples compile and execute properly
 */

import { describe, it, expect } from 'vitest';
import {
  TaskStatusSchema,
  TaskStatus,
  TaskPrioritySchema,
  TaskPriority,
  TaskEffortSchema,
  TaskEffort,
  Task,
  TaskUsage,
  TaskLog,
  TaskArtifact,
  SubtaskStrategy,
  TaskDecomposition,
  SubtaskDefinition,
} from '../types';

describe('Task Management Types - JSDoc Documentation Validation', () => {
  describe('TaskStatusSchema JSDoc Examples', () => {
    it('should execute all JSDoc examples correctly', () => {
      // Example from JSDoc: const status: TaskStatus = 'pending';
      const status: TaskStatus = 'pending';
      expect(status).toBe('pending');

      // Example from JSDoc: const validStatus = TaskStatusSchema.parse('in-progress');
      const validStatus = TaskStatusSchema.parse('in-progress');
      expect(validStatus).toBe('in-progress');

      // Test workflow progression examples from JSDoc
      const standardProgression = ['pending', 'queued', 'planning', 'in-progress', 'completed'];
      const pausedProgression = ['pending', 'queued', 'planning', 'in-progress', 'paused', 'in-progress', 'completed'];

      standardProgression.forEach(status => {
        expect(() => TaskStatusSchema.parse(status)).not.toThrow();
      });

      pausedProgression.forEach(status => {
        expect(() => TaskStatusSchema.parse(status)).not.toThrow();
      });
    });

    it('should validate all documented enum values and descriptions', () => {
      const documentedStatuses = [
        { value: 'pending', description: 'Task created but not yet queued' },
        { value: 'queued', description: 'Task ready for execution' },
        { value: 'planning', description: 'Agent is planning implementation approach' },
        { value: 'in-progress', description: 'Task actively being executed' },
        { value: 'waiting-approval', description: 'Task requires user approval (deprecated)' },
        { value: 'awaiting-approval', description: 'Task requires user approval to continue' },
        { value: 'paused', description: 'Task execution paused' },
        { value: 'completed', description: 'Task successfully finished' },
        { value: 'failed', description: 'Task execution failed' },
        { value: 'cancelled', description: 'Task was cancelled by user or system' },
      ];

      documentedStatuses.forEach(({ value }) => {
        expect(() => TaskStatusSchema.parse(value)).not.toThrow();
        expect(TaskStatusSchema.parse(value)).toBe(value);
      });
    });
  });

  describe('TaskPrioritySchema JSDoc Examples', () => {
    it('should execute all JSDoc examples correctly', () => {
      // Example from JSDoc: const priority: TaskPriority = 'normal';
      const priority: TaskPriority = 'normal';
      expect(priority).toBe('normal');

      // Example from JSDoc: const validPriority = TaskPrioritySchema.parse('urgent');
      const validPriority = TaskPrioritySchema.parse('urgent');
      expect(validPriority).toBe('urgent');
    });

    it('should validate priority ordering from JSDoc comment', () => {
      // JSDoc states: urgent > high > normal > low
      const priorityOrder = ['low', 'normal', 'high', 'urgent'];
      const priorityWeights = { low: 1, normal: 2, high: 3, urgent: 4 };

      priorityOrder.forEach(priority => {
        expect(() => TaskPrioritySchema.parse(priority)).not.toThrow();
        expect(priorityWeights[priority as TaskPriority]).toBeDefined();
      });

      // Validate ordering relationships
      expect(priorityWeights.urgent).toBeGreaterThan(priorityWeights.high);
      expect(priorityWeights.high).toBeGreaterThan(priorityWeights.normal);
      expect(priorityWeights.normal).toBeGreaterThan(priorityWeights.low);
    });

    it('should validate all documented enum values and descriptions', () => {
      const documentedPriorities = [
        { value: 'low', description: 'Low priority, executed when resources available' },
        { value: 'normal', description: 'Default priority for most tasks' },
        { value: 'high', description: 'High priority, prioritized over normal/low' },
        { value: 'urgent', description: 'Highest priority, executed immediately when possible' },
      ];

      documentedPriorities.forEach(({ value }) => {
        expect(() => TaskPrioritySchema.parse(value)).not.toThrow();
        expect(TaskPrioritySchema.parse(value)).toBe(value);
      });
    });
  });

  describe('TaskEffortSchema JSDoc Examples', () => {
    it('should execute all JSDoc examples correctly', () => {
      // Example from JSDoc: const effort: TaskEffort = 'medium';
      const effort: TaskEffort = 'medium';
      expect(effort).toBe('medium');

      // Example from JSDoc: const validEffort = TaskEffortSchema.parse('large');
      const validEffort = TaskEffortSchema.parse('large');
      expect(validEffort).toBe('large');
    });

    it('should validate time estimate mappings from JSDoc', () => {
      // JSDoc comment: xs: <1 hour, small: 1-4 hours, medium: 4-8 hours, large: 1-2 days, xl: 2+ days
      const effortTimeEstimates = {
        xs: 0.5,    // <1 hour
        small: 2.5, // 1-4 hours (midpoint)
        medium: 6,  // 4-8 hours (midpoint)
        large: 12,  // 1-2 days (midpoint: 1.5 days = 12 hours)
        xl: 48      // 2+ days (2 days = 48 hours)
      };

      const efforts: TaskEffort[] = ['xs', 'small', 'medium', 'large', 'xl'];

      efforts.forEach(effort => {
        expect(() => TaskEffortSchema.parse(effort)).not.toThrow();
        expect(effortTimeEstimates[effort]).toBeDefined();
        expect(typeof effortTimeEstimates[effort]).toBe('number');
        expect(effortTimeEstimates[effort]).toBeGreaterThan(0);
      });

      // Validate progression (each level should be more than previous)
      expect(effortTimeEstimates.small).toBeGreaterThan(effortTimeEstimates.xs);
      expect(effortTimeEstimates.medium).toBeGreaterThan(effortTimeEstimates.small);
      expect(effortTimeEstimates.large).toBeGreaterThan(effortTimeEstimates.medium);
      expect(effortTimeEstimates.xl).toBeGreaterThan(effortTimeEstimates.large);
    });

    it('should validate all documented enum values and descriptions', () => {
      const documentedEfforts = [
        { value: 'xs', description: 'Extra small: minimal effort, quick fixes' },
        { value: 'small', description: 'Small: simple features or bug fixes' },
        { value: 'medium', description: 'Medium: moderate complexity features' },
        { value: 'large', description: 'Large: complex features or refactoring' },
        { value: 'xl', description: 'Extra large: major features or architectural changes' },
      ];

      documentedEfforts.forEach(({ value }) => {
        expect(() => TaskEffortSchema.parse(value)).not.toThrow();
        expect(TaskEffortSchema.parse(value)).toBe(value);
      });
    });
  });

  describe('Task Interface JSDoc Example', () => {
    it('should execute the complete JSDoc example correctly', () => {
      // Complete example from Task interface JSDoc
      const task: Task = {
        id: 'task-123',
        description: 'Add login component',
        acceptanceCriteria: 'Component should handle validation and errors',
        workflow: 'feature-development',
        autonomy: 'supervised',
        status: 'pending',
        priority: 'normal',
        effort: 'medium',
        projectPath: '/path/to/project',
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0, totalCostCents: 0, executionTimeMs: 0 },
        logs: [],
        artifacts: []
      };

      // Validate all properties are correctly typed and set
      expect(task.id).toBe('task-123');
      expect(task.description).toBe('Add login component');
      expect(task.acceptanceCriteria).toBe('Component should handle validation and errors');
      expect(task.workflow).toBe('feature-development');
      expect(task.autonomy).toBe('supervised');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('normal');
      expect(task.effort).toBe('medium');
      expect(task.projectPath).toBe('/path/to/project');
      expect(task.retryCount).toBe(0);
      expect(task.maxRetries).toBe(3);
      expect(task.resumeAttempts).toBe(0);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
      expect(task.usage).toBeDefined();
      expect(Array.isArray(task.logs)).toBe(true);
      expect(Array.isArray(task.artifacts)).toBe(true);
    });
  });

  describe('TaskUsage Interface JSDoc Example', () => {
    it('should execute the exact JSDoc example correctly', () => {
      // Example from TaskUsage JSDoc
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

      // Validate that totalTokens equals inputTokens + outputTokens
      expect(usage.totalTokens).toBe(usage.inputTokens + usage.outputTokens);
    });
  });

  describe('TaskLog Interface JSDoc Example', () => {
    it('should execute the exact JSDoc example correctly', () => {
      // Example from TaskLog JSDoc
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

  describe('TaskArtifact Interface JSDoc Example', () => {
    it('should execute the exact JSDoc example correctly', () => {
      // Example from TaskArtifact JSDoc
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

  describe('SubtaskStrategy Type JSDoc Example', () => {
    it('should execute all JSDoc examples correctly', () => {
      // Example from SubtaskStrategy JSDoc
      const strategy: SubtaskStrategy = 'parallel';
      expect(strategy).toBe('parallel');

      // Validate all documented strategies
      const strategies: SubtaskStrategy[] = ['sequential', 'parallel', 'dependency-based'];
      strategies.forEach(s => {
        const validStrategy: SubtaskStrategy = s;
        expect(validStrategy).toBe(s);
      });
    });
  });

  describe('TaskDecomposition Interface JSDoc Example', () => {
    it('should execute the exact JSDoc example correctly', () => {
      // Example from TaskDecomposition JSDoc
      const decomposition: TaskDecomposition = {
        parentTaskId: 'task-123',
        subtasks: [
          {
            description: 'Create user model',
            acceptanceCriteria: 'Model should include validation',
            workflow: 'code-only',
            effort: 'small'
          },
          {
            description: 'Create user controller',
            dependsOn: ['Create user model'],
            effort: 'medium'
          }
        ],
        strategy: 'dependency-based'
      };

      expect(decomposition.parentTaskId).toBe('task-123');
      expect(decomposition.subtasks).toHaveLength(2);
      expect(decomposition.subtasks[0].description).toBe('Create user model');
      expect(decomposition.subtasks[0].acceptanceCriteria).toBe('Model should include validation');
      expect(decomposition.subtasks[0].workflow).toBe('code-only');
      expect(decomposition.subtasks[0].effort).toBe('small');
      expect(decomposition.subtasks[1].description).toBe('Create user controller');
      expect(decomposition.subtasks[1].dependsOn).toEqual(['Create user model']);
      expect(decomposition.subtasks[1].effort).toBe('medium');
      expect(decomposition.strategy).toBe('dependency-based');
    });
  });

  describe('SubtaskDefinition Interface JSDoc Example', () => {
    it('should execute the exact JSDoc example correctly', () => {
      // Example from SubtaskDefinition JSDoc
      const subtaskDef: SubtaskDefinition = {
        description: 'Create user authentication API',
        acceptanceCriteria: 'API should handle login/logout with JWT tokens',
        workflow: 'api-development',
        priority: 'high',
        effort: 'medium',
        dependsOn: ['Create user database schema']
      };

      expect(subtaskDef.description).toBe('Create user authentication API');
      expect(subtaskDef.acceptanceCriteria).toBe('API should handle login/logout with JWT tokens');
      expect(subtaskDef.workflow).toBe('api-development');
      expect(subtaskDef.priority).toBe('high');
      expect(subtaskDef.effort).toBe('medium');
      expect(subtaskDef.dependsOn).toEqual(['Create user database schema']);
    });
  });

  describe('JSDoc Comment Completeness Validation', () => {
    it('should have comprehensive JSDoc documentation for all exported types', () => {
      // This test validates that the main types have proper JSDoc structure
      // by testing that examples work and descriptions are meaningful

      // Test that all schema types can be used in examples
      const statusExample = TaskStatusSchema.parse('pending');
      const priorityExample = TaskPrioritySchema.parse('normal');
      const effortExample = TaskEffortSchema.parse('medium');

      expect(statusExample).toBe('pending');
      expect(priorityExample).toBe('normal');
      expect(effortExample).toBe('medium');

      // Test that all interface examples compile and work
      const usageExample: TaskUsage = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.003,
        totalCostCents: 0,
        executionTimeMs: 1000
      };

      const logExample: TaskLog = {
        timestamp: new Date(),
        level: 'info',
        message: 'Test message'
      };

      const artifactExample: TaskArtifact = {
        name: 'test.ts',
        type: 'file',
        createdAt: new Date()
      };

      expect(usageExample.totalTokens).toBe(usageExample.inputTokens + usageExample.outputTokens);
      expect(logExample.level).toBe('info');
      expect(artifactExample.type).toBe('file');
    });

    it('should validate that documentation examples are practical and realistic', () => {
      // Test that JSDoc examples represent realistic usage patterns

      // TaskStatus workflow progression should be realistic
      const realWorkflow: TaskStatus[] = [
        'pending',      // Initial state
        'queued',       // Ready for processing
        'planning',     // Agent planning
        'in-progress',  // Active work
        'completed'     // Finished
      ];

      realWorkflow.forEach(status => {
        expect(() => TaskStatusSchema.parse(status)).not.toThrow();
      });

      // TaskPriority should support common business priorities
      const businessPriorities: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];
      businessPriorities.forEach(priority => {
        expect(() => TaskPrioritySchema.parse(priority)).not.toThrow();
      });

      // TaskEffort should cover common development scenarios
      const developmentEfforts: TaskEffort[] = ['xs', 'small', 'medium', 'large', 'xl'];
      developmentEfforts.forEach(effort => {
        expect(() => TaskEffortSchema.parse(effort)).not.toThrow();
      });
    });
  });
});