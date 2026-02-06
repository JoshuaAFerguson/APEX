/**
 * Quick compilation test to verify all Task Management types work correctly
 */
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
} from './packages/core/src/types';

// Test basic schema parsing
const status = TaskStatusSchema.parse('pending');
const priority = TaskPrioritySchema.parse('normal');
const effort = TaskEffortSchema.parse('medium');

// Test complete Task interface
const task: Task = {
  id: 'test',
  description: 'test',
  workflow: 'test',
  autonomy: 'supervised',
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
    executionTimeMs: 0,
  },
  logs: [],
  artifacts: [],
};

console.log('✅ All Task Management types compile successfully');
console.log(`Status: ${status}, Priority: ${priority}, Effort: ${effort}`);
console.log(`Task ID: ${task.id}`);