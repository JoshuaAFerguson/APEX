import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskInspector } from '../task-inspector';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { Task, TaskStatus, TaskPriority, TaskEffort, AutonomyLevel, TaskLog, TaskCheckpoint, TaskArtifact } from '@apexcli/core';

// Mock console methods
const mockConsoleLog = vi.fn();
vi.stubGlobal('console', { log: mockConsoleLog });

const mockTask: Task = {
  id: 'test-task-1',
  description: 'Test task for inspection',
  acceptanceCriteria: 'Should complete successfully with proper output',
  workflow: 'feature',
  autonomy: 'autonomous' as AutonomyLevel,
  status: 'completed' as TaskStatus,
  priority: 'medium' as TaskPriority,
  effort: 'medium' as TaskEffort,
  projectPath: '/test/project',
  retryCount: 1,
  maxRetries: 3,
  resumeAttempts: 2,
  currentStage: 'testing',
  branchName: 'feature/test-branch',
  prUrl: 'https://github.com/test/repo/pull/123',
  createdAt: new Date('2023-01-01T10:00:00Z'),
  updatedAt: new Date('2023-01-01T11:00:00Z'),
  completedAt: new Date('2023-01-01T11:30:00Z'),
  usage: {
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    estimatedCost: 0.05
  },
  logs: [],
  artifacts: [
    {
      name: 'modified-file.ts',
      type: 'file',
      path: '/test/project/src/modified-file.ts',
      content: 'console.log("test");',
      createdAt: new Date('2023-01-01T10:30:00Z')
    },
    {
      name: 'test-report.md',
      type: 'report',
      path: '/test/project/docs/test-report.md',
      content: '# Test Report\n\nAll tests passed.',
      createdAt: new Date('2023-01-01T10:45:00Z')
    },
    {
      name: 'build-diff.diff',
      type: 'diff',
      content: '+  console.log("test");\n-  console.log("old");',
      createdAt: new Date('2023-01-01T10:35:00Z')
    }
  ]
};

const mockTaskWithError: Task = {
  ...mockTask,
  id: 'error-task',
  status: 'failed' as TaskStatus,
  error: 'Build failed due to syntax error',
  completedAt: undefined
};

const mockTaskPaused: Task = {
  ...mockTask,
  id: 'paused-task',
  status: 'paused' as TaskStatus,
  pausedAt: new Date('2023-01-01T10:45:00Z'),
  pauseReason: 'Waiting for user input',
  completedAt: undefined
};

const mockTaskWithDependencies: Task = {
  ...mockTask,
  id: 'dependency-task',
  dependsOn: ['task-a', 'task-b'],
  blockedBy: ['task-c'],
  parentTaskId: 'parent-task',
  subtaskIds: ['subtask-1', 'subtask-2'],
  subtaskStrategy: 'parallel'
};

const mockLogs: TaskLog[] = [
  {
    id: 'log-1',
    taskId: 'test-task-1',
    level: 'info',
    message: 'Task started',
    timestamp: new Date('2023-01-01T10:00:00Z'),
    stage: 'planning',
    agent: 'planner'
  },
  {
    id: 'log-2',
    taskId: 'test-task-1',
    level: 'warn',
    message: 'Performance warning',
    timestamp: new Date('2023-01-01T10:15:00Z'),
    metadata: { cpu: '85%' }
  },
  {
    id: 'log-3',
    taskId: 'test-task-1',
    level: 'error',
    message: 'Temporary error occurred',
    timestamp: new Date('2023-01-01T10:20:00Z'),
    stage: 'implementation'
  }
];

const mockCheckpoints: TaskCheckpoint[] = [
  {
    checkpointId: 'checkpoint-1',
    taskId: 'test-task-1',
    stage: 'planning',
    stageIndex: 0,
    createdAt: new Date('2023-01-01T10:05:00Z'),
    conversationState: [{ role: 'user', content: 'Start planning' }],
    metadata: { notes: 'Planning complete' }
  },
  {
    checkpointId: 'checkpoint-2',
    taskId: 'test-task-1',
    stage: 'implementation',
    stageIndex: 1,
    createdAt: new Date('2023-01-01T10:25:00Z'),
    conversationState: [
      { role: 'user', content: 'Start implementation' },
      { role: 'assistant', content: 'Implementation complete' }
    ],
    metadata: {}
  }
];

const createMockOrchestrator = (overrides = {}) => ({
  getTask: vi.fn(),
  getTaskLogs: vi.fn(),
  listCheckpoints: vi.fn(),
  ...overrides
} as unknown as ApexOrchestrator);

describe('TaskInspector', () => {
  beforeEach(() => {
    mockConsoleLog.mockClear();
  });

  describe('Basic Functionality', () => {
    it('should create an instance', () => {
      const mockOrch = createMockOrchestrator();
      const inspector = new TaskInspector(mockOrch);
      expect(inspector).toBeInstanceOf(TaskInspector);
    });

    it('should handle task not found', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(null)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('non-existent-task');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task not found: non-existent-task')
      );
    });
  });

  describe('Comprehensive View', () => {
    it('should show comprehensive view when no options provided', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTask),
        getTaskLogs: vi.fn().mockResolvedValue([]),
        listCheckpoints: vi.fn().mockResolvedValue([])
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📋 Task Inspection: test-task-1')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test task for inspection')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Should complete successfully with proper output')
      );
    });

    it('should display all task details in comprehensive view', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTask)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1');

      // Verify all major sections are displayed
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('📝 Details:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('💰 Usage & Cost:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('⏱️  Timeline:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('🌿 Git Info:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('📎 Quick Summary:'));
    });

    it('should display error information for failed tasks', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTaskWithError)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('error-task');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('❌ Error:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Build failed due to syntax error'));
    });

    it('should display pause information for paused tasks', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTaskPaused)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('paused-task');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Paused:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Waiting for user input'));
    });

    it('should display dependencies and subtasks', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTaskWithDependencies)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('dependency-task');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('🔗 Dependencies & Subtasks:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('task-a, task-b'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('task-c'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('parent-task'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('subtask-1, subtask-2'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('parallel'));
    });
  });

  describe('Modified Files View', () => {
    it('should show modified files when files option is true', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTask)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { files: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📁 Modified Files for Task: test-task-1')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('/test/project/src/modified-file.ts')
      );
    });

    it('should handle tasks with no file modifications', async () => {
      const taskWithNoFiles = { ...mockTask, artifacts: [] };
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(taskWithNoFiles)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { files: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No file modifications found.')
      );
    });

    it('should show only file type artifacts', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTask)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { files: true });

      // Should show the file artifact but not the report or diff artifacts
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('/test/project/src/modified-file.ts')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Total: 1 files modified')
      );
    });
  });

  describe('File Content View', () => {
    it('should show specific file content when file option is provided', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTask)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { file: '/test/project/src/modified-file.ts' });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📄 File Content: /test/project/src/modified-file.ts')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('console.log("test");')
      );
    });

    it('should handle file not found in artifacts', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTask)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { file: '/nonexistent/file.ts' });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('File not found in task artifacts: /nonexistent/file.ts')
      );
    });

    it('should handle artifact without content', async () => {
      const taskWithEmptyContent = {
        ...mockTask,
        artifacts: [{
          name: 'empty-file.ts',
          type: 'file' as const,
          path: '/test/empty-file.ts',
          createdAt: new Date()
        }]
      };
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(taskWithEmptyContent)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { file: '/test/empty-file.ts' });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('File content not available in artifacts.')
      );
    });
  });

  describe('Timeline View', () => {
    it('should show execution timeline when timeline option is true', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTask),
        getTaskLogs: vi.fn().mockResolvedValue(mockLogs),
        listCheckpoints: vi.fn().mockResolvedValue(mockCheckpoints)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { timeline: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('⏱️  Execution Timeline for Task: test-task-1')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task created')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task completed')
      );
    });

    it('should include logs in timeline with proper formatting', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTask),
        getTaskLogs: vi.fn().mockResolvedValue(mockLogs),
        listCheckpoints: vi.fn().mockResolvedValue([])
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { timeline: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('planner: [planning] Task started')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Performance warning')
      );
    });

    it('should include checkpoints in timeline', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTask),
        getTaskLogs: vi.fn().mockResolvedValue([]),
        listCheckpoints: vi.fn().mockResolvedValue(mockCheckpoints)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { timeline: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Checkpoint created: checkpoint-1')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Stage: planning')
      );
    });

    it('should handle empty timeline', async () => {
      const emptyTask = { ...mockTask, completedAt: undefined, pausedAt: undefined };
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(emptyTask),
        getTaskLogs: vi.fn().mockResolvedValue([]),
        listCheckpoints: vi.fn().mockResolvedValue([])
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { timeline: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No timeline events found.')
      );
    });
  });

  describe('Documentation View', () => {
    it('should show generated documentation when docs option is true', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTask)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { docs: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📚 Generated Documentation for Task: test-task-1')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('test-report.md')
      );
    });

    it('should handle tasks with no documentation artifacts', async () => {
      const taskWithNoDocsArtifacts = {
        ...mockTask,
        artifacts: [{ name: 'code.ts', type: 'file' as const, createdAt: new Date() }]
      };
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(taskWithNoDocsArtifacts)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { docs: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No documentation artifacts found.')
      );
    });
  });

  describe('Logs View', () => {
    it('should show task logs when logs option is true', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTask),
        getTaskLogs: vi.fn().mockResolvedValue(mockLogs)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { logs: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📝 Task Logs for: test-task-1')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task started')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Performance warning')
      );
    });

    it('should display log metadata when present', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTask),
        getTaskLogs: vi.fn().mockResolvedValue(mockLogs)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { logs: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Metadata: {"cpu":"85%"}')
      );
    });

    it('should handle tasks with no logs', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTask),
        getTaskLogs: vi.fn().mockResolvedValue([])
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { logs: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No logs found.')
      );
    });
  });

  describe('Artifacts View', () => {
    it('should show task artifacts when artifacts option is true', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTask)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { artifacts: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📎 Task Artifacts for: test-task-1')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('FILE (1):')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('REPORT (1):')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('DIFF (1):')
      );
    });

    it('should handle tasks with no artifacts', async () => {
      const taskWithNoArtifacts = { ...mockTask, artifacts: [] };
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(taskWithNoArtifacts)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { artifacts: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No artifacts found.')
      );
    });

    it('should display artifact content size information', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTask)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { artifacts: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Size: 19 characters')
      );
    });
  });

  describe('Checkpoints View', () => {
    it('should show task checkpoints when checkpoints option is true', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTask),
        listCheckpoints: vi.fn().mockResolvedValue(mockCheckpoints)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { checkpoints: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🏁 Task Checkpoints for: test-task-1')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('checkpoint-1')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('checkpoint-2')
      );
    });

    it('should display checkpoint conversation state length', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTask),
        listCheckpoints: vi.fn().mockResolvedValue(mockCheckpoints)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { checkpoints: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Conversation Messages: 1')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Conversation Messages: 2')
      );
    });

    it('should handle tasks with no checkpoints', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(mockTask),
        listCheckpoints: vi.fn().mockResolvedValue([])
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { checkpoints: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No checkpoints found.')
      );
    });
  });

  describe('Status Emojis', () => {
    it('should display correct emojis for different task statuses', async () => {
      const testStatuses = [
        { status: 'pending' as TaskStatus, emoji: '⏳' },
        { status: 'running' as TaskStatus, emoji: '🔄' },
        { status: 'completed' as TaskStatus, emoji: '✅' },
        { status: 'failed' as TaskStatus, emoji: '❌' },
        { status: 'paused' as TaskStatus, emoji: '⏸️' },
        { status: 'cancelled' as TaskStatus, emoji: '🚫' }
      ];

      for (const { status, emoji } of testStatuses) {
        const taskWithStatus = { ...mockTask, status };
        const mockOrch = createMockOrchestrator({
          getTask: vi.fn().mockResolvedValue(taskWithStatus)
        });

        const inspector = new TaskInspector(mockOrch);
        await inspector.inspectTask('test-task-1');

        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining(`${emoji} ${status.toUpperCase()}`)
        );

        mockConsoleLog.mockClear();
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle orchestrator errors gracefully', async () => {
      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockRejectedValue(new Error('Database connection failed'))
      });

      const inspector = new TaskInspector(mockOrch);

      await expect(inspector.inspectTask('test-task-1')).rejects.toThrow('Database connection failed');
    });

    it('should handle missing optional task fields', async () => {
      const minimalTask = {
        id: 'minimal-task',
        description: 'Minimal task',
        workflow: 'feature',
        autonomy: 'autonomous' as AutonomyLevel,
        status: 'pending' as TaskStatus,
        priority: 'low' as TaskPriority,
        effort: 'small' as TaskEffort,
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
          estimatedCost: 0
        }
      };

      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(minimalTask)
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('minimal-task');

      // Should not throw and should display basic information
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📋 Task Inspection: minimal-task')
      );
    });

    it('should handle tasks with undefined artifacts and logs', async () => {
      const taskWithUndefinedFields = {
        ...mockTask,
        artifacts: undefined,
        logs: undefined
      };

      const mockOrch = createMockOrchestrator({
        getTask: vi.fn().mockResolvedValue(taskWithUndefinedFields),
        getTaskLogs: vi.fn().mockResolvedValue([]),
        listCheckpoints: vi.fn().mockResolvedValue([])
      });

      const inspector = new TaskInspector(mockOrch);
      await inspector.inspectTask('test-task-1', { files: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No file modifications found.')
      );
    });
  });
});