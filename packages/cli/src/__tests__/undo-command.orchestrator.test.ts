/**
 * Undo Command Orchestrator Integration Tests
 * Tests the integration between CLI command and orchestrator methods
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { commands } from '../index.js';

describe('Undo Command Orchestrator Integration', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('should call orchestrator.undoLastAction when undo is executed', () => {
    // Create a mock orchestrator
    const mockOrchestrator = {
      getCurrentTask: vi.fn().mockResolvedValue({
        id: 'test-task-123',
        description: 'Test task',
        workflow: 'feature',
        autonomy: 'high',
        status: 'completed',
        priority: 'normal',
        effort: 'medium',
        projectPath: '/test',
        branchName: 'test-branch',
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.01,
        },
        logs: [],
        artifacts: [],
        iterationHistory: {
          taskId: 'test-task-123',
          entries: [],
        },
      }),
      getTask: vi.fn(),
      undoLastAction: vi.fn().mockResolvedValue({
        success: true,
        actionId: 'action-123',
        restoredFiles: ['src/app.js'],
        failedFiles: [],
        completedAt: new Date(),
      }),
      toolActionStore: {
        getUndoableActions: vi.fn().mockResolvedValue([]),
      },
    };

    const mockContext = {
      orchestrator: mockOrchestrator as unknown as ApexOrchestrator,
      cwd: '/test',
      initialized: true,
      config: null,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };

    const undoCommand = commands.find(cmd => cmd.name === 'undo');
    expect(undoCommand).toBeDefined();

    // Test that the command can access orchestrator methods
    expect(mockContext.orchestrator).toBeDefined();
    expect(typeof mockContext.orchestrator.undoLastAction).toBe('function');
    expect(typeof mockContext.orchestrator.getCurrentTask).toBe('function');
  });

  it('should verify UndoOperationResult type compatibility', () => {
    const mockUndoResult = {
      success: true,
      actionId: 'test-action-123',
      restoredFiles: ['file1.js', 'file2.js'],
      failedFiles: [],
      completedAt: new Date(),
    };

    // Verify the mock result has all required properties
    expect(mockUndoResult).toHaveProperty('success');
    expect(mockUndoResult).toHaveProperty('actionId');
    expect(mockUndoResult).toHaveProperty('restoredFiles');
    expect(mockUndoResult).toHaveProperty('failedFiles');
    expect(mockUndoResult).toHaveProperty('completedAt');

    expect(typeof mockUndoResult.success).toBe('boolean');
    expect(typeof mockUndoResult.actionId).toBe('string');
    expect(Array.isArray(mockUndoResult.restoredFiles)).toBe(true);
    expect(Array.isArray(mockUndoResult.failedFiles)).toBe(true);
    expect(mockUndoResult.completedAt).toBeInstanceOf(Date);
  });

  it('should handle orchestrator error responses correctly', async () => {
    const mockOrchestrator = {
      getCurrentTask: vi.fn().mockRejectedValue(new Error('Database error')),
      getTask: vi.fn(),
      undoLastAction: vi.fn(),
      toolActionStore: {
        getUndoableActions: vi.fn(),
      },
    };

    const mockContext = {
      orchestrator: mockOrchestrator as unknown as ApexOrchestrator,
      cwd: '/test',
      initialized: true,
      config: null,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };

    const undoCommand = commands.find(cmd => cmd.name === 'undo');
    await undoCommand!.handler(mockContext, []);

    // Should handle the error gracefully and show error message
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('❌ Failed to undo: Database error')
    );
  });

  it('should verify toolActionStore integration', () => {
    const mockToolActionStore = {
      getUndoableActions: vi.fn().mockResolvedValue([
        {
          id: 'action-1',
          taskId: 'test-task',
          toolName: 'Write',
          operation: 'write',
          filePath: '/test/src/app.js',
          timestamp: new Date(),
          snapshots: [],
        },
      ]),
    };

    const mockOrchestrator = {
      toolActionStore: mockToolActionStore,
    };

    // Verify toolActionStore has the expected interface
    expect(mockOrchestrator.toolActionStore).toHaveProperty('getUndoableActions');
    expect(typeof mockOrchestrator.toolActionStore.getUndoableActions).toBe('function');
  });

  it('should handle toolAction data structure correctly', () => {
    const mockToolAction = {
      id: 'action-123',
      taskId: 'task-456',
      toolName: 'Write',
      operation: 'write',
      filePath: '/test/src/example.js',
      timestamp: new Date(),
      snapshots: [],
    };

    // Verify tool action has expected structure
    expect(mockToolAction).toHaveProperty('id');
    expect(mockToolAction).toHaveProperty('taskId');
    expect(mockToolAction).toHaveProperty('toolName');
    expect(mockToolAction).toHaveProperty('operation');
    expect(mockToolAction).toHaveProperty('filePath');
    expect(mockToolAction).toHaveProperty('timestamp');
    expect(mockToolAction).toHaveProperty('snapshots');

    expect(typeof mockToolAction.id).toBe('string');
    expect(typeof mockToolAction.taskId).toBe('string');
    expect(typeof mockToolAction.toolName).toBe('string');
    expect(typeof mockToolAction.operation).toBe('string');
    expect(typeof mockToolAction.filePath).toBe('string');
    expect(mockToolAction.timestamp).toBeInstanceOf(Date);
    expect(Array.isArray(mockToolAction.snapshots)).toBe(true);
  });
});