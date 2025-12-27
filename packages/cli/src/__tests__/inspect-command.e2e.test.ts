/**
 * Inspect Command End-to-End Tests
 *
 * End-to-end tests that verify the complete inspect command workflow
 * with real services and minimal mocking. Tests the entire pipeline
 * from CLI command parsing through TaskInspector to console output.
 *
 * These tests validate:
 * 1. Real TaskInspector integration without mocks
 * 2. Actual console output formatting
 * 3. Real orchestrator interactions
 * 4. Complete acceptance criteria validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { Task, TaskStatus, TaskPriority, TaskEffort, AutonomyLevel, TaskLog, TaskCheckpoint } from '@apexcli/core';

// We'll use the real TaskInspector but mock the orchestrator
import { TaskInspector } from '../services/task-inspector.js';

// Capture console output for validation
let consoleOutput: string[] = [];
const originalConsoleLog = console.log;

const mockConsoleLog = (...args: any[]) => {
  consoleOutput.push(args.map(arg => String(arg)).join(' '));
};

// Mock orchestrator with realistic data
const createMockOrchestrator = (tasks: Record<string, Task> = {}, logs: Record<string, TaskLog[]> = {}, checkpoints: Record<string, TaskCheckpoint[]> = {}) => {
  return {
    getTask: vi.fn().mockImplementation(async (taskId: string) => tasks[taskId] || null),
    getTaskLogs: vi.fn().mockImplementation(async (taskId: string) => logs[taskId] || []),
    listCheckpoints: vi.fn().mockImplementation(async (taskId: string) => checkpoints[taskId] || [])
  } as unknown as ApexOrchestrator;
};

// Test data factory
const createTestTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'test-task-e2e',
  description: 'End-to-end test task',
  acceptanceCriteria: 'Should demonstrate all inspect functionality',
  workflow: 'feature',
  autonomy: 'autonomous' as AutonomyLevel,
  status: 'completed' as TaskStatus,
  priority: 'high' as TaskPriority,
  effort: 'large' as TaskEffort,
  projectPath: '/test/e2e-project',
  retryCount: 2,
  maxRetries: 3,
  resumeAttempts: 1,
  currentStage: 'testing',
  branchName: 'feature/e2e-test',
  prUrl: 'https://github.com/test/e2e/pull/456',
  createdAt: new Date('2023-06-01T09:00:00Z'),
  updatedAt: new Date('2023-06-01T12:30:00Z'),
  completedAt: new Date('2023-06-01T13:15:00Z'),
  pausedAt: undefined,
  usage: {
    inputTokens: 2500,
    outputTokens: 1200,
    totalTokens: 3700,
    estimatedCost: 0.185
  },
  logs: [],
  artifacts: [
    {
      name: 'feature.ts',
      type: 'file',
      path: '/test/e2e-project/src/feature.ts',
      content: 'export class FeatureClass {\n  constructor() {}\n  execute() { return "done"; }\n}',
      createdAt: new Date('2023-06-01T10:30:00Z')
    },
    {
      name: 'README.md',
      type: 'report',
      path: '/test/e2e-project/docs/README.md',
      content: '# Feature Documentation\n\nThis feature provides...\n\n## Usage\n\n```typescript\nconst feature = new FeatureClass();\nfeature.execute();\n```',
      createdAt: new Date('2023-06-01T11:45:00Z')
    },
    {
      name: 'changes.diff',
      type: 'diff',
      content: '+export class FeatureClass {\n+  constructor() {}\n+  execute() { return "done"; }\n+}\n',
      createdAt: new Date('2023-06-01T10:35:00Z')
    }
  ],
  dependsOn: ['prereq-task-1'],
  blockedBy: [],
  parentTaskId: 'epic-task',
  subtaskIds: ['subtask-a', 'subtask-b'],
  subtaskStrategy: 'sequential',
  ...overrides
});

const createTestLogs = (): TaskLog[] => [
  {
    id: 'log-e2e-1',
    taskId: 'test-task-e2e',
    level: 'info',
    message: 'Starting task execution',
    timestamp: new Date('2023-06-01T09:01:00Z'),
    stage: 'planning',
    agent: 'planner'
  },
  {
    id: 'log-e2e-2',
    taskId: 'test-task-e2e',
    level: 'warn',
    message: 'Memory usage is high',
    timestamp: new Date('2023-06-01T10:15:00Z'),
    metadata: { memoryUsage: '2.1GB', threshold: '2GB' }
  },
  {
    id: 'log-e2e-3',
    taskId: 'test-task-e2e',
    level: 'error',
    message: 'Temporary build failure',
    timestamp: new Date('2023-06-01T11:00:00Z'),
    stage: 'implementation',
    agent: 'developer'
  },
  {
    id: 'log-e2e-4',
    taskId: 'test-task-e2e',
    level: 'info',
    message: 'Build fixed and tests passing',
    timestamp: new Date('2023-06-01T11:30:00Z'),
    stage: 'implementation',
    agent: 'developer'
  }
];

const createTestCheckpoints = (): TaskCheckpoint[] => [
  {
    checkpointId: 'cp-planning-e2e',
    taskId: 'test-task-e2e',
    stage: 'planning',
    stageIndex: 0,
    createdAt: new Date('2023-06-01T09:30:00Z'),
    conversationState: [
      { role: 'user', content: 'Plan the feature implementation' },
      { role: 'assistant', content: 'I will create a new FeatureClass...' }
    ],
    metadata: { planningComplete: true, estimatedEffort: 'large' }
  },
  {
    checkpointId: 'cp-implementation-e2e',
    taskId: 'test-task-e2e',
    stage: 'implementation',
    stageIndex: 1,
    createdAt: new Date('2023-06-01T11:30:00Z'),
    conversationState: [
      { role: 'user', content: 'Implement the planned feature' },
      { role: 'assistant', content: 'Implementing FeatureClass...' },
      { role: 'assistant', content: 'Implementation complete with tests' }
    ],
    metadata: { linesOfCode: 150, testsAdded: 12 }
  },
  {
    checkpointId: 'cp-testing-e2e',
    taskId: 'test-task-e2e',
    stage: 'testing',
    stageIndex: 2,
    createdAt: new Date('2023-06-01T13:00:00Z'),
    conversationState: [
      { role: 'user', content: 'Run comprehensive tests' },
      { role: 'assistant', content: 'All tests passing. Coverage at 95%.' }
    ],
    metadata: { testCoverage: 95, testsRun: 42, testsPassed: 42 }
  }
];

describe('Inspect Command End-to-End Tests', () => {
  let mockOrchestrator: ReturnType<typeof createMockOrchestrator>;
  let inspector: TaskInspector;
  let testTask: Task;
  let testLogs: TaskLog[];
  let testCheckpoints: TaskCheckpoint[];

  beforeEach(() => {
    // Reset console output capture
    consoleOutput = [];
    console.log = mockConsoleLog;

    // Create test data
    testTask = createTestTask();
    testLogs = createTestLogs();
    testCheckpoints = createTestCheckpoints();

    // Create mock orchestrator with test data
    mockOrchestrator = createMockOrchestrator(
      { [testTask.id]: testTask },
      { [testTask.id]: testLogs },
      { [testTask.id]: testCheckpoints }
    );

    // Create real TaskInspector instance
    inspector = new TaskInspector(mockOrchestrator);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    vi.clearAllMocks();
  });

  describe('Comprehensive Task Inspection (Default View)', () => {
    it('should display complete task information with proper formatting', async () => {
      await inspector.inspectTask(testTask.id);

      // Verify main sections are displayed
      expect(consoleOutput.join('\n')).toContain('📋 Task Inspection: test-task-e2e');
      expect(consoleOutput.join('\n')).toContain('✅ COMPLETED');
      expect(consoleOutput.join('\n')).toContain('End-to-end test task');
      expect(consoleOutput.join('\n')).toContain('Should demonstrate all inspect functionality');

      // Verify details section
      expect(consoleOutput.join('\n')).toContain('📝 Details:');
      expect(consoleOutput.join('\n')).toContain('Workflow: feature');
      expect(consoleOutput.join('\n')).toContain('Priority: high');
      expect(consoleOutput.join('\n')).toContain('Effort: large');
      expect(consoleOutput.join('\n')).toContain('Current Stage: testing');

      // Verify usage and cost section
      expect(consoleOutput.join('\n')).toContain('💰 Usage & Cost:');
      expect(consoleOutput.join('\n')).toContain('Total Tokens: 3,700');
      expect(consoleOutput.join('\n')).toContain('Input Tokens: 2,500');
      expect(consoleOutput.join('\n')).toContain('Output Tokens: 1,200');
      expect(consoleOutput.join('\n')).toContain('Estimated Cost: $0.19');

      // Verify timeline section
      expect(consoleOutput.join('\n')).toContain('⏱️  Timeline:');
      expect(consoleOutput.join('\n')).toContain('Created:');
      expect(consoleOutput.join('\n')).toContain('Completed:');
      expect(consoleOutput.join('\n')).toContain('Duration:');

      // Verify dependencies section
      expect(consoleOutput.join('\n')).toContain('🔗 Dependencies & Subtasks:');
      expect(consoleOutput.join('\n')).toContain('Depends On: prereq-task-1');
      expect(consoleOutput.join('\n')).toContain('Parent Task: epic-task');
      expect(consoleOutput.join('\n')).toContain('Subtasks: subtask-a, subtask-b');
      expect(consoleOutput.join('\n')).toContain('Subtask Strategy: sequential');

      // Verify git info section
      expect(consoleOutput.join('\n')).toContain('🌿 Git Info:');
      expect(consoleOutput.join('\n')).toContain('Branch: feature/e2e-test');
      expect(consoleOutput.join('\n')).toContain('Pull Request: https://github.com/test/e2e/pull/456');

      // Verify quick summary
      expect(consoleOutput.join('\n')).toContain('📎 Quick Summary:');
      expect(consoleOutput.join('\n')).toContain('Artifacts: 3 items');
      expect(consoleOutput.join('\n')).toContain('Retry Count: 2/3');
      expect(consoleOutput.join('\n')).toContain('Resume Attempts: 1');

      // Verify help text
      expect(consoleOutput.join('\n')).toContain('💡 Use specific options for detailed views:');
    });

    it('should handle task not found scenario', async () => {
      await inspector.inspectTask('nonexistent-task');

      expect(consoleOutput.join('\n')).toContain('Task not found: nonexistent-task');
      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('nonexistent-task');
    });
  });

  describe('Modified Files View (--files)', () => {
    it('should display file artifacts with proper formatting', async () => {
      await inspector.inspectTask(testTask.id, { files: true });

      expect(consoleOutput.join('\n')).toContain('📁 Modified Files for Task: test-task-e2e');
      expect(consoleOutput.join('\n')).toContain('📄 /test/e2e-project/src/feature.ts');
      expect(consoleOutput.join('\n')).toContain('Modified:');
      expect(consoleOutput.join('\n')).toContain('📊 Total: 1 files modified');
    });

    it('should handle tasks with no file modifications', async () => {
      const taskWithoutFiles = createTestTask({ artifacts: [] });
      mockOrchestrator.getTask.mockResolvedValueOnce(taskWithoutFiles);

      await inspector.inspectTask(testTask.id, { files: true });

      expect(consoleOutput.join('\n')).toContain('No file modifications found.');
    });
  });

  describe('Specific File Content View (--file)', () => {
    it('should display specific file content with proper formatting', async () => {
      await inspector.inspectTask(testTask.id, { file: '/test/e2e-project/src/feature.ts' });

      expect(consoleOutput.join('\n')).toContain('📄 File Content: /test/e2e-project/src/feature.ts');
      expect(consoleOutput.join('\n')).toContain('Task: test-task-e2e');
      expect(consoleOutput.join('\n')).toContain('export class FeatureClass {');
      expect(consoleOutput.join('\n')).toContain('execute() { return "done"; }');
    });

    it('should handle file not found in artifacts', async () => {
      await inspector.inspectTask(testTask.id, { file: '/nonexistent/file.ts' });

      expect(consoleOutput.join('\n')).toContain('File not found in task artifacts: /nonexistent/file.ts');
    });
  });

  describe('Timeline View (--timeline)', () => {
    it('should display chronological timeline with logs and checkpoints', async () => {
      await inspector.inspectTask(testTask.id, { timeline: true });

      expect(consoleOutput.join('\n')).toContain('⏱️  Execution Timeline for Task: test-task-e2e');
      expect(consoleOutput.join('\n')).toContain('Task created');
      expect(consoleOutput.join('\n')).toContain('Task completed');
      expect(consoleOutput.join('\n')).toContain('planner: [planning] Starting task execution');
      expect(consoleOutput.join('\n')).toContain('Memory usage is high');
      expect(consoleOutput.join('\n')).toContain('🏁');
      expect(consoleOutput.join('\n')).toContain('Checkpoint created: cp-planning-e2e');
      expect(consoleOutput.join('\n')).toContain('📊 Total events:');
    });

    it('should handle empty timeline', async () => {
      const emptyTask = createTestTask({ completedAt: undefined, pausedAt: undefined });
      mockOrchestrator.getTask.mockResolvedValueOnce(emptyTask);
      mockOrchestrator.getTaskLogs.mockResolvedValueOnce([]);
      mockOrchestrator.listCheckpoints.mockResolvedValueOnce([]);

      await inspector.inspectTask(testTask.id, { timeline: true });

      expect(consoleOutput.join('\n')).toContain('No timeline events found.');
    });
  });

  describe('Documentation View (--docs)', () => {
    it('should display documentation artifacts', async () => {
      await inspector.inspectTask(testTask.id, { docs: true });

      expect(consoleOutput.join('\n')).toContain('📚 Generated Documentation for Task: test-task-e2e');
      expect(consoleOutput.join('\n')).toContain('📖 README.md');
      expect(consoleOutput.join('\n')).toContain('Path: /test/e2e-project/docs/README.md');
      expect(consoleOutput.join('\n')).toContain('Content: 8 lines');
      expect(consoleOutput.join('\n')).toContain('📊 Total documentation artifacts: 1');
    });

    it('should handle tasks with no documentation', async () => {
      const taskWithoutDocs = createTestTask({
        artifacts: [{ name: 'code.ts', type: 'file', createdAt: new Date() }]
      });
      mockOrchestrator.getTask.mockResolvedValueOnce(taskWithoutDocs);

      await inspector.inspectTask(testTask.id, { docs: true });

      expect(consoleOutput.join('\n')).toContain('No documentation artifacts found.');
    });
  });

  describe('Logs View (--logs)', () => {
    it('should display task logs with proper formatting and metadata', async () => {
      await inspector.inspectTask(testTask.id, { logs: true });

      expect(consoleOutput.join('\n')).toContain('📝 Task Logs for: test-task-e2e');
      expect(consoleOutput.join('\n')).toContain('ℹ️');
      expect(consoleOutput.join('\n')).toContain('[planning]');
      expect(consoleOutput.join('\n')).toContain('{planner}');
      expect(consoleOutput.join('\n')).toContain('Starting task execution');
      expect(consoleOutput.join('\n')).toContain('⚠️');
      expect(consoleOutput.join('\n')).toContain('Memory usage is high');
      expect(consoleOutput.join('\n')).toContain('Metadata: {"memoryUsage":"2.1GB","threshold":"2GB"}');
      expect(consoleOutput.join('\n')).toContain('❌');
      expect(consoleOutput.join('\n')).toContain('Temporary build failure');
      expect(consoleOutput.join('\n')).toContain('📊 Total log entries: 4');
    });

    it('should handle tasks with no logs', async () => {
      mockOrchestrator.getTaskLogs.mockResolvedValueOnce([]);

      await inspector.inspectTask(testTask.id, { logs: true });

      expect(consoleOutput.join('\n')).toContain('No logs found.');
    });
  });

  describe('Artifacts View (--artifacts)', () => {
    it('should display artifacts grouped by type', async () => {
      await inspector.inspectTask(testTask.id, { artifacts: true });

      expect(consoleOutput.join('\n')).toContain('📎 Task Artifacts for: test-task-e2e');
      expect(consoleOutput.join('\n')).toContain('📄 FILE (1):');
      expect(consoleOutput.join('\n')).toContain('feature.ts');
      expect(consoleOutput.join('\n')).toContain('Path: /test/e2e-project/src/feature.ts');
      expect(consoleOutput.join('\n')).toContain('Size: 79 characters');

      expect(consoleOutput.join('\n')).toContain('📋 REPORT (1):');
      expect(consoleOutput.join('\n')).toContain('README.md');
      expect(consoleOutput.join('\n')).toContain('Path: /test/e2e-project/docs/README.md');

      expect(consoleOutput.join('\n')).toContain('📊 DIFF (1):');
      expect(consoleOutput.join('\n')).toContain('changes.diff');

      expect(consoleOutput.join('\n')).toContain('📊 Total artifacts: 3');
    });

    it('should handle tasks with no artifacts', async () => {
      const taskWithoutArtifacts = createTestTask({ artifacts: [] });
      mockOrchestrator.getTask.mockResolvedValueOnce(taskWithoutArtifacts);

      await inspector.inspectTask(testTask.id, { artifacts: true });

      expect(consoleOutput.join('\n')).toContain('No artifacts found.');
    });
  });

  describe('Checkpoints View (--checkpoints)', () => {
    it('should display checkpoints with conversation state and metadata', async () => {
      await inspector.inspectTask(testTask.id, { checkpoints: true });

      expect(consoleOutput.join('\n')).toContain('🏁 Task Checkpoints for: test-task-e2e');
      expect(consoleOutput.join('\n')).toContain('cp-planning-e2e');
      expect(consoleOutput.join('\n')).toContain('Stage: planning (Index: 0)');
      expect(consoleOutput.join('\n')).toContain('Conversation Messages: 2');
      expect(consoleOutput.join('\n')).toContain('Metadata: {"planningComplete":true,"estimatedEffort":"large"}');

      expect(consoleOutput.join('\n')).toContain('cp-implementation-e2e');
      expect(consoleOutput.join('\n')).toContain('Stage: implementation (Index: 1)');
      expect(consoleOutput.join('\n')).toContain('Conversation Messages: 3');

      expect(consoleOutput.join('\n')).toContain('cp-testing-e2e');
      expect(consoleOutput.join('\n')).toContain('Stage: testing (Index: 2)');

      expect(consoleOutput.join('\n')).toContain('📊 Total checkpoints: 3');
    });

    it('should handle tasks with no checkpoints', async () => {
      mockOrchestrator.listCheckpoints.mockResolvedValueOnce([]);

      await inspector.inspectTask(testTask.id, { checkpoints: true });

      expect(consoleOutput.join('\n')).toContain('No checkpoints found.');
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    it('should handle failed tasks with error information', async () => {
      const failedTask = createTestTask({
        status: 'failed',
        error: 'Build compilation failed due to syntax error in feature.ts',
        completedAt: undefined
      });
      mockOrchestrator.getTask.mockResolvedValueOnce(failedTask);

      await inspector.inspectTask(testTask.id);

      expect(consoleOutput.join('\n')).toContain('❌ FAILED');
      expect(consoleOutput.join('\n')).toContain('❌ Error:');
      expect(consoleOutput.join('\n')).toContain('Build compilation failed due to syntax error in feature.ts');
    });

    it('should handle paused tasks with pause information', async () => {
      const pausedTask = createTestTask({
        status: 'paused',
        pausedAt: new Date('2023-06-01T12:00:00Z'),
        pauseReason: 'Waiting for user input on API design',
        completedAt: undefined
      });
      mockOrchestrator.getTask.mockResolvedValueOnce(pausedTask);

      await inspector.inspectTask(testTask.id);

      expect(consoleOutput.join('\n')).toContain('⏸️ PAUSED');
      expect(consoleOutput.join('\n')).toContain('Paused:');
      expect(consoleOutput.join('\n')).toContain('Waiting for user input on API design');
    });

    it('should handle tasks with minimal data', async () => {
      const minimalTask: Task = {
        id: 'minimal-task',
        description: 'Minimal task data',
        workflow: 'hotfix',
        autonomy: 'guided' as AutonomyLevel,
        status: 'pending' as TaskStatus,
        priority: 'low' as TaskPriority,
        effort: 'small' as TaskEffort,
        projectPath: '/minimal',
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 }
      };
      mockOrchestrator.getTask.mockResolvedValueOnce(minimalTask);

      await inspector.inspectTask('minimal-task');

      expect(consoleOutput.join('\n')).toContain('📋 Task Inspection: minimal-task');
      expect(consoleOutput.join('\n')).toContain('⏳ PENDING');
      expect(consoleOutput.join('\n')).toContain('Minimal task data');
      // Should not crash and should handle missing optional fields gracefully
    });

    it('should handle orchestrator service errors', async () => {
      mockOrchestrator.getTask.mockRejectedValueOnce(new Error('Database connection lost'));

      await expect(inspector.inspectTask(testTask.id)).rejects.toThrow('Database connection lost');
    });
  });

  describe('Performance and Data Validation', () => {
    it('should handle tasks with large amounts of data efficiently', async () => {
      // Create task with many artifacts, logs, and checkpoints
      const largeTask = createTestTask({
        artifacts: Array(50).fill(null).map((_, i) => ({
          name: `large-file-${i}.ts`,
          type: 'file',
          path: `/test/large-file-${i}.ts`,
          content: 'export const data = "test";'.repeat(1000),
          createdAt: new Date()
        }))
      });

      const largeLogs = Array(100).fill(null).map((_, i) => ({
        id: `log-${i}`,
        taskId: testTask.id,
        level: 'info',
        message: `Log message ${i}`,
        timestamp: new Date()
      }));

      const largeCheckpoints = Array(20).fill(null).map((_, i) => ({
        checkpointId: `checkpoint-${i}`,
        taskId: testTask.id,
        stage: 'testing',
        stageIndex: i,
        createdAt: new Date(),
        conversationState: [{ role: 'user', content: `Message ${i}` }],
        metadata: {}
      }));

      mockOrchestrator.getTask.mockResolvedValueOnce(largeTask);
      mockOrchestrator.getTaskLogs.mockResolvedValueOnce(largeLogs);
      mockOrchestrator.listCheckpoints.mockResolvedValueOnce(largeCheckpoints);

      const start = performance.now();
      await inspector.inspectTask(testTask.id);
      const duration = performance.now() - start;

      // Should complete within reasonable time (less than 1 second for this much data)
      expect(duration).toBeLessThan(1000);
      expect(consoleOutput.join('\n')).toContain('Artifacts: 50 items');
    });

    it('should validate data formatting consistency', async () => {
      await inspector.inspectTask(testTask.id);

      const output = consoleOutput.join('\n');

      // Verify consistent emoji usage
      expect(output).toContain('📋');  // Task header
      expect(output).toContain('✅');  // Status
      expect(output).toContain('📝');  // Details
      expect(output).toContain('💰');  // Cost
      expect(output).toContain('⏱️');  // Timeline
      expect(output).toContain('🔗');  // Dependencies
      expect(output).toContain('🌿');  // Git
      expect(output).toContain('📎');  // Summary

      // Verify consistent spacing and formatting
      expect(output).toMatch(/📋 Task Inspection: test-task-e2e\n/);
      expect(output).toMatch(/  ID: test-task-e2e/);
      expect(output).toMatch(/  Status: ✅ COMPLETED/);

      // Verify numeric formatting
      expect(output).toContain('Total Tokens: 3,700');
      expect(output).toContain('Estimated Cost: $0.19');
    });
  });
});