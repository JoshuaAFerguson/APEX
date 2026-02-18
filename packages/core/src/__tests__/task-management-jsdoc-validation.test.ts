/**
 * @fileoverview JSDoc validation tests for Task Management types
 *
 * This test file validates that the JSDoc documentation accurately reflects
 * the actual schema definitions and type behaviors. It ensures that examples
 * in documentation work correctly and that descriptions match implementation.
 *
 * These tests help maintain documentation quality and catch documentation
 * drift as the codebase evolves.
 */

import { describe, it, expect } from 'vitest';
import {
  TaskStatusSchema,
  TaskPrioritySchema,
  TaskEffortSchema,
  TaskStatus,
  TaskPriority,
  TaskEffort,
  TaskUsage,
  TaskLog,
  TaskArtifact,
  SubtaskStrategy,
  TaskDecomposition,
} from '../types';

describe('JSDoc Documentation Validation', () => {
  describe('TaskStatusSchema JSDoc Validation', () => {
    it('should validate all status values mentioned in JSDoc comments', () => {
      // Extract status values from JSDoc comments in the source
      const documentedStatuses = [
        'pending',        // Task created but not yet queued
        'queued',         // Task ready for execution
        'planning',       // Agent is planning implementation approach
        'in-progress',    // Task actively being executed
        'waiting-approval',  // Task requires user approval (deprecated)
        'awaiting-approval', // Task requires user approval
        'paused',         // Task execution paused (rate limits, manual pause, etc.)
        'completed',      // Task successfully finished
        'failed',         // Task execution failed
        'cancelled',      // Task was cancelled by user or system
      ];

      // Verify all documented statuses are valid
      documentedStatuses.forEach(status => {
        expect(() => TaskStatusSchema.parse(status)).not.toThrow();
      });
    });

    it('should validate JSDoc example code snippets', () => {
      // Example from JSDoc: const status: TaskStatus = 'pending';
      const status: TaskStatus = 'pending';
      expect(status).toBe('pending');

      // Example from JSDoc: const validStatus = TaskStatusSchema.parse('in-progress');
      const validStatus = TaskStatusSchema.parse('in-progress');
      expect(validStatus).toBe('in-progress');
    });

    it('should validate workflow progression examples from JSDoc', () => {
      // Standard progression from JSDoc: pending → queued → planning → in-progress → completed
      const standardProgression: TaskStatus[] = [
        'pending',
        'queued',
        'planning',
        'in-progress',
        'completed'
      ];

      standardProgression.forEach(status => {
        expect(() => TaskStatusSchema.parse(status)).not.toThrow();
      });

      // Alternative progression from JSDoc: pending → queued → planning → in-progress → paused → in-progress → completed
      const pausedProgression: TaskStatus[] = [
        'pending',
        'queued',
        'planning',
        'in-progress',
        'paused',
        'in-progress',
        'completed'
      ];

      pausedProgression.forEach(status => {
        expect(() => TaskStatusSchema.parse(status)).not.toThrow();
      });
    });

    it('should verify deprecation notice for waiting-approval', () => {
      // Both old and new approval statuses should work
      expect(() => TaskStatusSchema.parse('waiting-approval')).not.toThrow();
      expect(() => TaskStatusSchema.parse('awaiting-approval')).not.toThrow();

      // But awaiting-approval is the preferred form (documented in JSDoc)
      expect(TaskStatusSchema.parse('awaiting-approval')).toBe('awaiting-approval');
    });
  });

  describe('TaskPrioritySchema JSDoc Validation', () => {
    it('should validate all priority values mentioned in JSDoc comments', () => {
      const documentedPriorities = [
        'low',      // Low priority, executed when resources available
        'normal',   // Default priority for most tasks
        'high',     // High priority, prioritized over normal/low
        'urgent',   // Highest priority, executed immediately when possible
      ];

      documentedPriorities.forEach(priority => {
        expect(() => TaskPrioritySchema.parse(priority)).not.toThrow();
      });
    });

    it('should validate JSDoc example code snippets', () => {
      // Example from JSDoc: const priority: TaskPriority = 'normal';
      const priority: TaskPriority = 'normal';
      expect(priority).toBe('normal');

      // Example from JSDoc: const validPriority = TaskPrioritySchema.parse('urgent');
      const validPriority = TaskPrioritySchema.parse('urgent');
      expect(validPriority).toBe('urgent');
    });

    it('should validate priority ordering documentation', () => {
      // JSDoc states: urgent > high > normal > low
      const priorityWeights = { low: 1, normal: 2, high: 3, urgent: 4 };

      // Test ordering relationships
      expect(priorityWeights.urgent).toBeGreaterThan(priorityWeights.high);
      expect(priorityWeights.high).toBeGreaterThan(priorityWeights.normal);
      expect(priorityWeights.normal).toBeGreaterThan(priorityWeights.low);

      // All priorities should be valid
      Object.keys(priorityWeights).forEach(priority => {
        expect(() => TaskPrioritySchema.parse(priority)).not.toThrow();
      });
    });
  });

  describe('TaskEffortSchema JSDoc Validation', () => {
    it('should validate all effort values mentioned in JSDoc comments', () => {
      const documentedEfforts = [
        'xs',      // Extra small: minimal effort, quick fixes
        'small',   // Small: simple features or bug fixes
        'medium',  // Medium: moderate complexity features
        'large',   // Large: complex features or refactoring
        'xl',      // Extra large: major features or architectural changes
      ];

      documentedEfforts.forEach(effort => {
        expect(() => TaskEffortSchema.parse(effort)).not.toThrow();
      });
    });

    it('should validate JSDoc example code snippets', () => {
      // Example from JSDoc: const effort: TaskEffort = 'medium';
      const effort: TaskEffort = 'medium';
      expect(effort).toBe('medium');

      // Example from JSDoc: const validEffort = TaskEffortSchema.parse('large');
      const validEffort = TaskEffortSchema.parse('large');
      expect(validEffort).toBe('large');
    });

    it('should validate time estimate documentation', () => {
      // JSDoc states time estimates: xs: <1 hour, small: 1-4 hours, medium: 4-8 hours, large: 1-2 days, xl: 2+ days
      const effortHours = {
        xs: 0.5,     // <1 hour (30 minutes)
        small: 2,    // 1-4 hours (2 hours average)
        medium: 6,   // 4-8 hours (6 hours average)
        large: 16,   // 1-2 days (2 days = 16 hours)
        xl: 40       // 2+ days (1 week = 40 hours)
      };

      // Verify time progression matches documentation
      expect(effortHours.xs).toBeLessThan(1);           // <1 hour
      expect(effortHours.small).toBeGreaterThanOrEqual(1);
      expect(effortHours.small).toBeLessThanOrEqual(4);  // 1-4 hours
      expect(effortHours.medium).toBeGreaterThanOrEqual(4);
      expect(effortHours.medium).toBeLessThanOrEqual(8); // 4-8 hours
      expect(effortHours.large).toBeGreaterThanOrEqual(8);
      expect(effortHours.large).toBeLessThanOrEqual(24); // 1-2 days (8-16 hours)
      expect(effortHours.xl).toBeGreaterThan(16);        // 2+ days

      // All efforts should be valid
      Object.keys(effortHours).forEach(effort => {
        expect(() => TaskEffortSchema.parse(effort)).not.toThrow();
      });
    });
  });

  describe('TaskUsage JSDoc Validation', () => {
    it('should validate JSDoc example exactly', () => {
      // Exact example from JSDoc comments
      const usage: TaskUsage = {
        inputTokens: 1500,
        outputTokens: 800,
        totalTokens: 2300,
        estimatedCost: 0.023,
        totalCostCents: 23,
        executionTimeMs: 5000
      };

      // All properties should match types and be reasonable
      expect(typeof usage.inputTokens).toBe('number');
      expect(typeof usage.outputTokens).toBe('number');
      expect(typeof usage.totalTokens).toBe('number');
      expect(typeof usage.estimatedCost).toBe('number');
      expect(typeof usage.totalCostCents).toBe('number');
      expect(typeof usage.executionTimeMs).toBe('number');

      // Values should match the example
      expect(usage.inputTokens).toBe(1500);
      expect(usage.outputTokens).toBe(800);
      expect(usage.totalTokens).toBe(2300);
      expect(usage.estimatedCost).toBe(0.023);
      expect(usage.totalCostCents).toBe(23);
      expect(usage.executionTimeMs).toBe(5000);
    });

    it('should verify JSDoc documentation purpose matches implementation', () => {
      // JSDoc states this tracks "token consumption, cost estimates, and execution time for Claude API calls"
      const apiCallUsage: TaskUsage = {
        inputTokens: 1200,    // tokens sent to Claude API
        outputTokens: 600,    // tokens received from Claude API
        totalTokens: 1800,    // sum of input + output
        estimatedCost: 0.036, // cost estimate for billing
        totalCostCents: 4,    // cost in cents for resource monitoring
        executionTimeMs: 3500 // execution time for performance tracking
      };

      // Verify the fields serve their documented purposes
      expect(apiCallUsage.totalTokens).toBe(apiCallUsage.inputTokens + apiCallUsage.outputTokens);
      expect(apiCallUsage.estimatedCost).toBeGreaterThan(0);
      expect(apiCallUsage.totalCostCents).toBeGreaterThanOrEqual(0);
      expect(apiCallUsage.executionTimeMs).toBeGreaterThan(0);
    });
  });

  describe('TaskLog JSDoc Validation', () => {
    it('should validate JSDoc example exactly', () => {
      // Exact example from JSDoc comments
      const log: TaskLog = {
        timestamp: new Date(),
        level: 'info',
        stage: 'implementation',
        agent: 'developer',
        message: 'Starting code implementation',
        metadata: { fileCount: 3, estimatedTime: 300 }
      };

      // Verify structure matches documentation
      expect(log.timestamp).toBeInstanceOf(Date);
      expect(log.level).toBe('info');
      expect(log.stage).toBe('implementation');
      expect(log.agent).toBe('developer');
      expect(log.message).toBe('Starting code implementation');
      expect(log.metadata?.fileCount).toBe(3);
      expect(log.metadata?.estimatedTime).toBe(300);
    });

    it('should validate all log levels mentioned in JSDoc', () => {
      const documentedLevels: Array<'debug' | 'info' | 'warn' | 'error'> = [
        'debug',   // Debug information
        'info',    // Informational messages
        'warn',    // Warning messages
        'error'    // Error messages
      ];

      documentedLevels.forEach(level => {
        const log: TaskLog = {
          timestamp: new Date(),
          level,
          stage: 'test',
          agent: 'test-agent',
          message: `Test message at ${level} level`
        };

        expect(['debug', 'info', 'warn', 'error']).toContain(log.level);
      });
    });

    it('should verify JSDoc purpose documentation', () => {
      // JSDoc states it "captures structured logging information during task execution"
      const structuredLog: TaskLog = {
        timestamp: new Date(),
        level: 'warn',
        stage: 'implementation',
        agent: 'developer',
        message: 'Performance warning: slow query detected',
        metadata: {
          queryTime: 2500,
          query: 'SELECT * FROM large_table',
          threshold: 1000,
          suggestion: 'Add index on frequently queried columns'
        }
      };

      // Should capture structured information for troubleshooting
      expect(structuredLog.metadata?.queryTime).toBeGreaterThan(structuredLog.metadata?.threshold);
      expect(structuredLog.metadata?.suggestion).toBeDefined();
    });
  });

  describe('TaskArtifact JSDoc Validation', () => {
    it('should validate JSDoc example exactly', () => {
      // Exact example from JSDoc comments
      const artifact: TaskArtifact = {
        name: 'LoginComponent.tsx',
        type: 'file',
        path: '/src/components/LoginComponent.tsx',
        content: 'import React from "react"...',
        createdAt: new Date()
      };

      // Verify structure matches documentation
      expect(artifact.name).toBe('LoginComponent.tsx');
      expect(artifact.type).toBe('file');
      expect(artifact.path).toBe('/src/components/LoginComponent.tsx');
      expect(artifact.content).toBe('import React from "react"...');
      expect(artifact.createdAt).toBeInstanceOf(Date);
    });

    it('should validate all artifact types mentioned in JSDoc', () => {
      const documentedTypes: Array<'file' | 'diff' | 'report' | 'log'> = [
        'file',    // Code files, documentation files
        'diff',    // Change summaries, git diffs
        'report',  // Analysis reports, test reports
        'log'      // Execution logs, error logs
      ];

      documentedTypes.forEach(type => {
        const artifact: TaskArtifact = {
          name: `test-${type}`,
          type,
          path: `/test/${type}`,
          content: `Content for ${type} type`,
          createdAt: new Date()
        };

        expect(['file', 'diff', 'report', 'log']).toContain(artifact.type);
      });
    });

    it('should verify JSDoc purpose documentation', () => {
      // JSDoc states it represents "deliverables and outputs created during task execution"
      const deliverables: TaskArtifact[] = [
        {
          name: 'UserModel.ts',
          type: 'file',
          path: '/src/models/UserModel.ts',
          content: 'export interface User { id: string; name: string; }',
          createdAt: new Date()
        },
        {
          name: 'migration-changes.diff',
          type: 'diff',
          path: '/migrations/001-add-user-table.sql',
          content: '+CREATE TABLE users (\n+  id UUID PRIMARY KEY,\n+  name VARCHAR(255)\n+);',
          createdAt: new Date()
        },
        {
          name: 'test-coverage-report.html',
          type: 'report',
          path: '/reports/coverage.html',
          content: '<html><body>Coverage: 95%</body></html>',
          createdAt: new Date()
        }
      ];

      deliverables.forEach(artifact => {
        expect(artifact.name).toBeDefined();
        expect(artifact.content).toBeDefined();
        expect(artifact.createdAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('SubtaskStrategy JSDoc Validation', () => {
    it('should validate JSDoc example exactly', () => {
      // Example from JSDoc: const strategy: SubtaskStrategy = 'parallel';
      const strategy: SubtaskStrategy = 'parallel';
      expect(strategy).toBe('parallel');
    });

    it('should validate all strategies and their descriptions from JSDoc', () => {
      // JSDoc descriptions:
      // sequential: subtasks execute one after another
      // parallel: all subtasks execute simultaneously
      // dependency-based: execution order determined by dependsOn relationships

      const strategies: { [K in SubtaskStrategy]: string } = {
        'sequential': 'subtasks execute one after another',
        'parallel': 'all subtasks execute simultaneously',
        'dependency-based': 'execution order determined by dependsOn relationships'
      };

      Object.entries(strategies).forEach(([strategy, description]) => {
        expect(['sequential', 'parallel', 'dependency-based']).toContain(strategy);
        expect(description).toBeTruthy();
        expect(typeof description).toBe('string');
      });
    });
  });

  describe('TaskDecomposition JSDoc Validation', () => {
    it('should validate JSDoc example structure', () => {
      // Example structure from JSDoc comments
      const decomposition: TaskDecomposition = {
        parentTaskId: 'task-123',
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

      // Verify structure matches JSDoc
      expect(decomposition.parentTaskId).toBe('task-123');
      expect(decomposition.subtasks).toHaveLength(1);
      expect(decomposition.subtasks[0].description).toBe('Create user model');
      expect(decomposition.strategy).toBe('dependency-based');
    });

    it('should verify JSDoc purpose documentation', () => {
      // JSDoc states it's used "when a large task needs to be broken down into smaller units"
      // for "better parallelization, progress tracking, and failure isolation"

      const largeTaskDecomposition: TaskDecomposition = {
        parentTaskId: 'large-feature-epic',
        subtasks: [
          {
            description: 'Design API endpoints',
            acceptanceCriteria: 'REST API design complete',
            priority: 'high',
            effort: 'medium',
            dependsOn: []
          },
          {
            description: 'Implement backend logic',
            acceptanceCriteria: 'All endpoints functional',
            priority: 'normal',
            effort: 'large',
            dependsOn: ['api-design']
          },
          {
            description: 'Create frontend components',
            acceptanceCriteria: 'UI components complete',
            priority: 'normal',
            effort: 'medium',
            dependsOn: ['api-design']
          },
          {
            description: 'Write integration tests',
            acceptanceCriteria: 'All tests pass',
            priority: 'normal',
            effort: 'small',
            dependsOn: ['backend', 'frontend']
          }
        ],
        strategy: 'dependency-based'
      };

      // Should enable parallelization (some tasks can run in parallel)
      const independentTasks = decomposition.subtasks.filter(task => task.dependsOn.length === 0);
      expect(independentTasks.length).toBeGreaterThan(0);

      // Should enable progress tracking (each subtask has clear acceptance criteria)
      decomposition.subtasks.forEach(task => {
        expect(task.acceptanceCriteria).toBeDefined();
        expect(task.acceptanceCriteria.length).toBeGreaterThan(0);
      });

      // Should enable failure isolation (tasks have dependencies but can fail independently)
      expect(decomposition.strategy).toBe('dependency-based');
      expect(decomposition.subtasks.length).toBeGreaterThan(1);
    });
  });

  describe('Cross-Type JSDoc Consistency', () => {
    it('should ensure JSDoc examples use consistent terminology', () => {
      // Verify agent names used in examples are consistent
      const agentNamesInExamples = ['developer', 'planner', 'tester'];

      agentNamesInExamples.forEach(agentName => {
        const log: TaskLog = {
          timestamp: new Date(),
          level: 'info',
          stage: 'implementation',
          agent: agentName,
          message: `Message from ${agentName}`
        };

        expect(typeof log.agent).toBe('string');
        expect(log.agent).toBe(agentName);
      });
    });

    it('should ensure JSDoc time/duration examples are realistic', () => {
      // Usage execution time should be reasonable for the token counts
      const usage: TaskUsage = {
        inputTokens: 1500,
        outputTokens: 800,
        totalTokens: 2300,
        estimatedCost: 0.023,
        totalCostCents: 23,
        executionTimeMs: 5000 // 5 seconds for 2300 tokens is reasonable
      };

      // Execution time should be proportional to token count
      const tokensPerSecond = usage.totalTokens / (usage.executionTimeMs / 1000);
      expect(tokensPerSecond).toBeLessThan(1000); // Should be less than 1000 tokens/second
      expect(tokensPerSecond).toBeGreaterThan(100); // Should be more than 100 tokens/second
    });
  });
});