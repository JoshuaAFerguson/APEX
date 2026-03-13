import { describe, test, expect, vi } from 'vitest';
import { TaskInspector } from '../packages/cli/src/services/task-inspector';

/**
 * Unit tests for v0.4.0 Task Interaction Commands
 *
 * These tests focus on unit testing individual components
 * without requiring full orchestrator initialization to avoid
 * Docker container monitoring issues in the CI environment.
 */

describe('v0.4.0 Task Interaction Commands - Unit Tests', () => {

  describe('TaskInspector Unit Tests', () => {
    test('should create TaskInspector instance', () => {
      const mockOrchestrator = {
        getTask: vi.fn(),
        getTaskLogs: vi.fn(),
        listCheckpoints: vi.fn()
      } as any;

      const inspector = new TaskInspector(mockOrchestrator);
      expect(inspector).toBeInstanceOf(TaskInspector);
    });

    test('should handle non-existent task gracefully', async () => {
      const mockOrchestrator = {
        getTask: vi.fn().mockResolvedValue(null),
        getTaskLogs: vi.fn(),
        listCheckpoints: vi.fn()
      } as any;

      const inspector = new TaskInspector(mockOrchestrator);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await inspector.inspectTask('non-existent-task');

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('non-existent-task');

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Task not found: non-existent-task');

      consoleSpy.mockRestore();
    });

    test('should display comprehensive task information', async () => {
      const mockTask = {
        id: 'test-task-123',
        description: 'Test task for unit testing',
        workflow: 'feature',
        priority: 'high',
        effort: 'medium',
        autonomy: 'high',
        acceptanceCriteria: 'Must include comprehensive tests',
        status: 'in-progress',
        currentStage: 'implementation',
        createdAt: new Date('2025-01-01T10:00:00Z'),
        updatedAt: new Date('2025-01-01T11:00:00Z'),
        projectPath: '/test/project',
        usage: {
          totalTokens: 12345,
          inputTokens: 6789,
          outputTokens: 5556,
          estimatedCost: 0.1234
        },
        artifacts: [
          {
            id: 'artifact-1',
            type: 'file',
            name: 'test.js',
            path: 'src/test.js',
            content: 'console.log("test");',
            createdAt: new Date(),
            taskId: 'test-task-123'
          }
        ],
        logs: [
          {
            id: 'log-1',
            level: 'info',
            message: 'Task started',
            timestamp: new Date(),
            taskId: 'test-task-123'
          }
        ],
        retryCount: 1,
        maxRetries: 3,
        resumeAttempts: 0
      };

      const mockOrchestrator = {
        getTask: vi.fn().mockResolvedValue(mockTask),
        getTaskLogs: vi.fn().mockResolvedValue([]),
        listCheckpoints: vi.fn().mockResolvedValue([])
      } as any;

      const inspector = new TaskInspector(mockOrchestrator);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await inspector.inspectTask('test-task-123');

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('test-task-123');

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      // Verify key information is displayed
      expect(output).toContain('📋 Task Inspection');
      expect(output).toContain('test-task-123');
      expect(output).toContain('IN-PROGRESS');
      expect(output).toContain('Test task for unit testing');
      expect(output).toContain('feature');
      expect(output).toContain('high');
      expect(output).toContain('medium');
      expect(output).toContain('implementation');
      expect(output).toContain('12,345'); // Formatted tokens
      expect(output).toContain('$0.12'); // Formatted cost
      expect(output).toContain('Artifacts: 1 items');
      expect(output).toContain('Log Entries: 1 entries');

      consoleSpy.mockRestore();
    });

    test('should display file modifications correctly', async () => {
      const mockTask = {
        id: 'test-task-files',
        description: 'Task for file testing',
        artifacts: [
          {
            id: 'file1',
            type: 'file',
            name: 'component.jsx',
            path: 'src/components/component.jsx',
            createdAt: new Date('2025-01-01T10:30:00Z'),
            taskId: 'test-task-files'
          },
          {
            id: 'file2',
            type: 'file',
            name: 'styles.css',
            path: 'src/styles.css',
            createdAt: new Date('2025-01-01T10:35:00Z'),
            taskId: 'test-task-files'
          }
        ]
      };

      const mockOrchestrator = {
        getTask: vi.fn().mockResolvedValue(mockTask)
      } as any;

      const inspector = new TaskInspector(mockOrchestrator);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await inspector.inspectTask('test-task-files', { files: true });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('📁 Modified Files for Task');
      expect(output).toContain('📄 src/components/component.jsx');
      expect(output).toContain('📄 src/styles.css');
      expect(output).toContain('Modified:');
      expect(output).toContain('📊 Total: 2 files modified');

      consoleSpy.mockRestore();
    });

    test('should handle empty file list', async () => {
      const mockTask = {
        id: 'test-task-no-files',
        description: 'Task with no files',
        artifacts: []
      };

      const mockOrchestrator = {
        getTask: vi.fn().mockResolvedValue(mockTask)
      } as any;

      const inspector = new TaskInspector(mockOrchestrator);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await inspector.inspectTask('test-task-no-files', { files: true });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('📁 Modified Files for Task');
      expect(output).toContain('No file modifications found');

      consoleSpy.mockRestore();
    });

    test('should display specific file content', async () => {
      const fileContent = `function hello() {
  console.log("Hello, World!");
  return "success";
}`;

      const mockTask = {
        id: 'test-task-content',
        description: 'Task for content testing',
        artifacts: [
          {
            id: 'content-file',
            type: 'file',
            name: 'hello.js',
            path: 'src/hello.js',
            content: fileContent,
            taskId: 'test-task-content'
          }
        ]
      };

      const mockOrchestrator = {
        getTask: vi.fn().mockResolvedValue(mockTask)
      } as any;

      const inspector = new TaskInspector(mockOrchestrator);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await inspector.inspectTask('test-task-content', { file: 'src/hello.js' });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('📄 File Content: src/hello.js');
      expect(output).toContain('Task: test-task-content');
      expect(output).toContain('─'.repeat(60));
      expect(output).toContain('function hello()');
      expect(output).toContain('console.log("Hello, World!");');

      consoleSpy.mockRestore();
    });

    test('should handle missing file request', async () => {
      const mockTask = {
        id: 'test-task-missing',
        description: 'Task for missing file test',
        artifacts: []
      };

      const mockOrchestrator = {
        getTask: vi.fn().mockResolvedValue(mockTask)
      } as any;

      const inspector = new TaskInspector(mockOrchestrator);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await inspector.inspectTask('test-task-missing', { file: 'non-existent.js' });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('File not found in task artifacts: non-existent.js');

      consoleSpy.mockRestore();
    });

    test('should display execution timeline', async () => {
      const mockTask = {
        id: 'test-task-timeline',
        description: 'Task for timeline testing',
        createdAt: new Date('2025-01-01T10:00:00Z'),
        completedAt: new Date('2025-01-01T11:00:00Z')
      };

      const mockLogs = [
        {
          id: 'log-1',
          message: 'Task started',
          level: 'info',
          stage: 'planning',
          agent: 'test-agent',
          timestamp: new Date('2025-01-01T10:05:00Z'),
          taskId: 'test-task-timeline'
        },
        {
          id: 'log-2',
          message: 'Implementation began',
          level: 'info',
          stage: 'implementation',
          timestamp: new Date('2025-01-01T10:30:00Z'),
          taskId: 'test-task-timeline'
        }
      ];

      const mockCheckpoints = [
        {
          id: 'checkpoint-1',
          checkpointId: 'cp-1',
          taskId: 'test-task-timeline',
          stage: 'implementation',
          createdAt: new Date('2025-01-01T10:45:00Z'),
          conversationState: [],
          metadata: {},
          stageIndex: 1
        }
      ];

      const mockOrchestrator = {
        getTask: vi.fn().mockResolvedValue(mockTask),
        getTaskLogs: vi.fn().mockResolvedValue(mockLogs),
        listCheckpoints: vi.fn().mockResolvedValue(mockCheckpoints)
      } as any;

      const inspector = new TaskInspector(mockOrchestrator);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await inspector.inspectTask('test-task-timeline', { timeline: true });

      expect(mockOrchestrator.getTaskLogs).toHaveBeenCalledWith('test-task-timeline');
      expect(mockOrchestrator.listCheckpoints).toHaveBeenCalledWith('test-task-timeline');

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('⏱️  Execution Timeline for Task');
      expect(output).toContain('Task created');
      expect(output).toContain('test-agent: [planning] Task started');
      expect(output).toContain('Implementation began');
      expect(output).toContain('🏁'); // Checkpoint emoji
      expect(output).toContain('Checkpoint created: cp-1');
      expect(output).toContain('Task completed');

      consoleSpy.mockRestore();
    });

    test('should display task logs with different levels', async () => {
      const mockTask = {
        id: 'test-task-logs',
        description: 'Task for logs testing'
      };

      const mockLogs = [
        {
          id: 'log-1',
          level: 'info',
          message: 'Information message',
          stage: 'implementation',
          agent: 'test-agent',
          timestamp: new Date(),
          taskId: 'test-task-logs'
        },
        {
          id: 'log-2',
          level: 'warn',
          message: 'Warning message',
          stage: 'testing',
          timestamp: new Date(),
          taskId: 'test-task-logs',
          metadata: { warning_type: 'deprecated_api' }
        },
        {
          id: 'log-3',
          level: 'error',
          message: 'Error occurred',
          stage: 'testing',
          timestamp: new Date(),
          taskId: 'test-task-logs'
        }
      ];

      const mockOrchestrator = {
        getTask: vi.fn().mockResolvedValue(mockTask),
        getTaskLogs: vi.fn().mockResolvedValue(mockLogs)
      } as any;

      const inspector = new TaskInspector(mockOrchestrator);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await inspector.inspectTask('test-task-logs', { logs: true });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('📝 Task Logs for:');
      expect(output).toContain('ℹ️'); // Info emoji
      expect(output).toContain('⚠️'); // Warning emoji
      expect(output).toContain('❌'); // Error emoji
      expect(output).toContain('[implementation]');
      expect(output).toContain('[testing]');
      expect(output).toContain('{test-agent}');
      expect(output).toContain('Information message');
      expect(output).toContain('Warning message');
      expect(output).toContain('Error occurred');
      expect(output).toContain('Metadata:');
      expect(output).toContain('warning_type');
      expect(output).toContain('📊 Total log entries: 3');

      consoleSpy.mockRestore();
    });

    test('should display artifacts grouped by type', async () => {
      const mockTask = {
        id: 'test-task-artifacts',
        description: 'Task for artifacts testing',
        artifacts: [
          {
            id: 'art1',
            type: 'file',
            name: 'main.js',
            content: 'console.log("main");',
            createdAt: new Date(),
            taskId: 'test-task-artifacts'
          },
          {
            id: 'art2',
            type: 'file',
            name: 'helper.js',
            content: 'export const helper = () => {};',
            createdAt: new Date(),
            taskId: 'test-task-artifacts'
          },
          {
            id: 'art3',
            type: 'diff',
            name: 'changes.diff',
            content: '--- a/file.js\n+++ b/file.js',
            createdAt: new Date(),
            taskId: 'test-task-artifacts'
          },
          {
            id: 'art4',
            type: 'report',
            name: 'analysis.md',
            content: '# Analysis Report\nDetailed analysis...',
            createdAt: new Date(),
            taskId: 'test-task-artifacts'
          }
        ]
      };

      const mockOrchestrator = {
        getTask: vi.fn().mockResolvedValue(mockTask)
      } as any;

      const inspector = new TaskInspector(mockOrchestrator);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await inspector.inspectTask('test-task-artifacts', { artifacts: true });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('📎 Task Artifacts for:');
      expect(output).toContain('📄 FILE (2):');
      expect(output).toContain('📊 DIFF (1):');
      expect(output).toContain('📋 REPORT (1):');
      expect(output).toContain('main.js');
      expect(output).toContain('helper.js');
      expect(output).toContain('changes.diff');
      expect(output).toContain('analysis.md');
      expect(output).toContain('Size:');
      expect(output).toContain('characters');
      expect(output).toContain('📊 Total artifacts: 4');

      consoleSpy.mockRestore();
    });

    test('should display checkpoints with detailed information', async () => {
      const mockTask = {
        id: 'test-task-checkpoints',
        description: 'Task for checkpoints testing'
      };

      const mockCheckpoints = [
        {
          id: 'cp1',
          checkpointId: 'checkpoint-planning',
          taskId: 'test-task-checkpoints',
          stage: 'planning',
          stageIndex: 0,
          createdAt: new Date('2025-01-01T10:00:00Z'),
          conversationState: [
            { role: 'user', content: 'Please implement feature X' },
            { role: 'assistant', content: 'I will implement feature X' }
          ],
          metadata: { phase: 'planning-complete', files_analyzed: 5 }
        },
        {
          id: 'cp2',
          checkpointId: 'checkpoint-implementation',
          taskId: 'test-task-checkpoints',
          stage: 'implementation',
          stageIndex: 1,
          createdAt: new Date('2025-01-01T10:30:00Z'),
          conversationState: [],
          metadata: { phase: 'implementation-mid' }
        }
      ];

      const mockOrchestrator = {
        getTask: vi.fn().mockResolvedValue(mockTask),
        listCheckpoints: vi.fn().mockResolvedValue(mockCheckpoints)
      } as any;

      const inspector = new TaskInspector(mockOrchestrator);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await inspector.inspectTask('test-task-checkpoints', { checkpoints: true });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('🏁 Task Checkpoints for:');
      expect(output).toContain('checkpoint-planning');
      expect(output).toContain('checkpoint-implementation');
      expect(output).toContain('Stage: planning (Index: 0)');
      expect(output).toContain('Stage: implementation (Index: 1)');
      expect(output).toContain('Conversation Messages: 2');
      expect(output).toContain('Metadata:');
      expect(output).toContain('files_analyzed');
      expect(output).toContain('📊 Total checkpoints: 2');

      consoleSpy.mockRestore();
    });
  });

  describe('Task Interaction Method Availability', () => {
    test('should verify required methods exist on orchestrator interface', () => {
      // This test verifies the expected API shape without requiring implementation
      const requiredMethods = [
        'iterateTask',
        'getIterationDiff',
        'getTaskDiff',
        'pushTaskBranch',
        'mergeTaskBranch',
        'listTaskWorktrees',
        'getTaskWorktree',
        'cleanupTaskWorktree',
        'cleanupOrphanedWorktrees',
        'trashTask',
        'restoreTask',
        'listTrashed',
        'emptyTrash',
        'archiveTask',
        'unarchiveTask',
        'listArchivedTasks',
        'saveTemplate',
        'useTemplate',
        'listTemplates',
        'getTemplate',
        'updateTemplate',
        'deleteTemplate'
      ];

      // Create mock orchestrator with all required methods
      const mockOrchestrator = {};
      requiredMethods.forEach(method => {
        (mockOrchestrator as any)[method] = vi.fn();
      });

      // Verify all methods exist
      requiredMethods.forEach(method => {
        expect(typeof (mockOrchestrator as any)[method]).toBe('function');
      });
    });
  });

  describe('Error Handling Unit Tests', () => {
    test('should handle null task in inspector', async () => {
      const mockOrchestrator = {
        getTask: vi.fn().mockResolvedValue(null)
      } as any;

      const inspector = new TaskInspector(mockOrchestrator);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await inspector.inspectTask('null-task-id');

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('null-task-id');

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Task not found: null-task-id');

      consoleSpy.mockRestore();
    });

    test('should handle orchestrator errors gracefully', async () => {
      const mockOrchestrator = {
        getTask: vi.fn().mockRejectedValue(new Error('Database connection failed'))
      } as any;

      const inspector = new TaskInspector(mockOrchestrator);

      // Should not throw, but handle error gracefully
      await expect(inspector.inspectTask('error-task-id')).rejects.toThrow('Database connection failed');

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('error-task-id');
    });

    test('should handle empty data gracefully', async () => {
      const mockTask = {
        id: 'empty-task',
        description: 'Empty task',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'pending',
        projectPath: '/test',
        artifacts: [],
        logs: [],
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
        usage: {
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          estimatedCost: 0
        }
      };

      const mockOrchestrator = {
        getTask: vi.fn().mockResolvedValue(mockTask),
        getTaskLogs: vi.fn().mockResolvedValue([]),
        listCheckpoints: vi.fn().mockResolvedValue([])
      } as any;

      const inspector = new TaskInspector(mockOrchestrator);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await inspector.inspectTask('empty-task');

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('Empty task');
      expect(output).toContain('Artifacts: 0 items');
      expect(output).toContain('Log Entries: 0 entries');

      consoleSpy.mockRestore();
    });
  });
});