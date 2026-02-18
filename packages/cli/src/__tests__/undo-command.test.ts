/**
 * Undo Command Tests
 * Comprehensive tests for the apex undo command functionality
 * Tests all acceptance criteria: --task-id, --count flags, confirmation, feedback
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { commands } from '../index.js';
import { Task, TaskStatus, UndoOperationResult } from '@apexcli/core';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import readline from 'readline';

// Mock readline for user confirmation
vi.mock('readline', () => ({
  createInterface: vi.fn(),
}));

const mockReadline = vi.mocked(readline);

describe('Undo Command', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  const createMockContext = () => ({
    orchestrator,
    cwd: tempDir,
    initialized: true,
    config: null,
    apiProcess: null,
    webUIProcess: null,
    apiPort: 3000,
    webUIPort: 3001,
  });

  const createMockTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'test-task-123',
    description: 'Test task for undo command',
    workflow: 'feature',
    autonomy: 'high' as const,
    status: 'completed' as TaskStatus,
    priority: 'normal' as const,
    effort: 'medium' as const,
    projectPath: tempDir,
    branchName: 'test-branch',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      estimatedCost: 0.075,
    },
    logs: [],
    artifacts: [],
    iterationHistory: {
      taskId: 'test-task-123',
      entries: [],
    },
    ...overrides,
  });

  const createMockUndoResult = (overrides: Partial<UndoOperationResult> = {}): UndoOperationResult => ({
    success: true,
    actionId: 'action-123',
    restoredFiles: ['src/app.js', 'src/utils.js'],
    failedFiles: [],
    completedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    // Create temporary directory for test project
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-undo-test-'));

    // Set up basic project structure
    await fs.ensureDir(path.join(tempDir, '.apex'));
    await fs.ensureDir(path.join(tempDir, 'src'));

    // Create minimal config
    const configContent = `
project:
  name: undo-command-test
  version: 1.0.0
agents:
  developer:
    model: haiku
    autonomy: high
workflows:
  feature:
    stages:
      - name: implementation
        agent: developer
limits:
  maxTokens: 10000
  maxCost: 1.0
`;

    await fs.writeFile(path.join(tempDir, '.apex', 'config.yaml'), configContent);

    // Mock process.cwd to return our temp directory
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({ projectPath: tempDir });

    // Mock console.log to capture output
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    cwdSpy.mockRestore();
    vi.clearAllMocks();

    // Clean up temp directory
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('Basic Undo Functionality', () => {
    it('should show usage information when no arguments provided', async () => {
      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      expect(undoCommand).toBeDefined();

      await undoCommand!.handler(createMockContext(), []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /undo [--task-id <taskId>] [--count <number>]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Options:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('--task-id <taskId>')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('--count <number>')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Examples:')
      );
    });

    it('should show error when orchestrator not initialized', async () => {
      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      const context = {
        ...createMockContext(),
        initialized: false,
        orchestrator: null,
      };

      await undoCommand!.handler(context, ['--task-id', 'task-123']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized. Run /init first.')
      );
    });

    it('should handle missing handleUndoCommand function gracefully', async () => {
      const undoCommand = commands.find(cmd => cmd.name === 'undo');

      await undoCommand!.handler(createMockContext(), ['--task-id', 'task-123']);

      // Should show that the command attempted to run
      // Once handleUndoCommand is implemented, this test will verify it gets called
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Task ID Parameter', () => {
    it('should use current task when no --task-id specified', async () => {
      // Mock orchestrator with current task
      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockResolvedValue(createMockTask({ id: 'current-task-456' }));

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction')
        .mockResolvedValue(createMockUndoResult());

      // Mock readline for confirmation
      const mockInterface = {
        question: vi.fn((question, callback) => callback('y')),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), []);

      // Should attempt to get current task
      expect(currentTaskSpy).toHaveBeenCalled();
      currentTaskSpy.mockRestore();
      undoSpy.mockRestore();
    });

    it('should use specified task ID when --task-id provided', async () => {
      const taskSpy = vi.spyOn(orchestrator, 'getTask')
        .mockResolvedValue(createMockTask({ id: 'specified-task' }));

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction')
        .mockResolvedValue(createMockUndoResult());

      // Mock readline for confirmation
      const mockInterface = {
        question: vi.fn((question, callback) => callback('y')),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), ['--task-id', 'specified-task']);

      expect(taskSpy).toHaveBeenCalledWith('specified-task');
      taskSpy.mockRestore();
      undoSpy.mockRestore();
    });

    it('should handle task not found error', async () => {
      const taskSpy = vi.spyOn(orchestrator, 'getTask')
        .mockResolvedValue(null);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), ['--task-id', 'nonexistent']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Task not found: nonexistent')
      );

      taskSpy.mockRestore();
    });
  });

  describe('Count Parameter', () => {
    it('should undo single action when no --count specified', async () => {
      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockResolvedValue(createMockTask());

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction')
        .mockResolvedValue(createMockUndoResult());

      // Mock readline for confirmation
      const mockInterface = {
        question: vi.fn((question, callback) => callback('y')),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), []);

      // Should call undoLastAction once
      expect(undoSpy).toHaveBeenCalledTimes(1);

      currentTaskSpy.mockRestore();
      undoSpy.mockRestore();
    });

    it('should undo multiple actions when --count specified', async () => {
      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockResolvedValue(createMockTask());

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction')
        .mockResolvedValue(createMockUndoResult());

      // Mock readline for confirmation
      const mockInterface = {
        question: vi.fn((question, callback) => callback('y')),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), ['--count', '3']);

      // Should call undoLastAction 3 times
      expect(undoSpy).toHaveBeenCalledTimes(3);

      currentTaskSpy.mockRestore();
      undoSpy.mockRestore();
    });

    it('should validate count parameter is a positive number', async () => {
      const undoCommand = commands.find(cmd => cmd.name === 'undo');

      await undoCommand!.handler(createMockContext(), ['--count', 'invalid']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Count must be a positive number')
      );
    });

    it('should validate count parameter is not zero', async () => {
      const undoCommand = commands.find(cmd => cmd.name === 'undo');

      await undoCommand!.handler(createMockContext(), ['--count', '0']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Count must be a positive number')
      );
    });

    it('should limit count to reasonable maximum', async () => {
      const undoCommand = commands.find(cmd => cmd.name === 'undo');

      await undoCommand!.handler(createMockContext(), ['--count', '100']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Count cannot exceed 50 actions')
      );
    });
  });

  describe('User Confirmation', () => {
    it('should show preview and ask for confirmation', async () => {
      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockResolvedValue(createMockTask());

      // Mock getUndoableActions to return actions
      const getUndoableActionsSpy = vi.spyOn(orchestrator['toolActionStore'], 'getUndoableActions')
        .mockResolvedValue([
          {
            id: 'action-1',
            taskId: 'test-task-123',
            toolName: 'Write',
            operation: 'write',
            filePath: '/test/src/app.js',
            timestamp: new Date(),
            snapshots: [],
          },
          {
            id: 'action-2',
            taskId: 'test-task-123',
            toolName: 'Edit',
            operation: 'edit',
            filePath: '/test/src/utils.js',
            timestamp: new Date(),
            snapshots: [],
          },
        ]);

      // Mock readline for confirmation - user says yes
      const mockInterface = {
        question: vi.fn((question, callback) => {
          expect(question).toContain('Do you want to proceed?');
          callback('y');
        }),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction')
        .mockResolvedValue(createMockUndoResult());

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), ['--count', '2']);

      // Should show preview of what will be undone
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('The following actions will be undone:')
      );

      currentTaskSpy.mockRestore();
      getUndoableActionsSpy.mockRestore();
      undoSpy.mockRestore();
    });

    it('should cancel when user says no', async () => {
      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockResolvedValue(createMockTask());

      // Mock getUndoableActions to return actions
      const getUndoableActionsSpy = vi.spyOn(orchestrator['toolActionStore'], 'getUndoableActions')
        .mockResolvedValue([
          {
            id: 'action-1',
            taskId: 'test-task-123',
            toolName: 'Write',
            operation: 'write',
            filePath: '/test/src/app.js',
            timestamp: new Date(),
            snapshots: [],
          },
        ]);

      // Mock readline for confirmation - user says no
      const mockInterface = {
        question: vi.fn((question, callback) => callback('n')),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction');

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), []);

      // Should not call undo
      expect(undoSpy).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Undo cancelled')
      );

      currentTaskSpy.mockRestore();
      getUndoableActionsSpy.mockRestore();
      undoSpy.mockRestore();
    });
  });

  describe('Success Feedback', () => {
    it('should show success message for single undo', async () => {
      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockResolvedValue(createMockTask());

      const undoResult = createMockUndoResult({
        actionId: 'action-456',
        restoredFiles: ['src/app.js']
      });

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction')
        .mockResolvedValue(undoResult);

      // Mock readline for confirmation
      const mockInterface = {
        question: vi.fn((question, callback) => callback('y')),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓ Successfully undid action: action-456')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Restored files:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('src/app.js')
      );

      currentTaskSpy.mockRestore();
      undoSpy.mockRestore();
    });

    it('should show summary for multiple undos', async () => {
      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockResolvedValue(createMockTask());

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction')
        .mockResolvedValueOnce(createMockUndoResult({
          actionId: 'action-1',
          restoredFiles: ['src/app.js']
        }))
        .mockResolvedValueOnce(createMockUndoResult({
          actionId: 'action-2',
          restoredFiles: ['src/utils.js']
        }));

      // Mock readline for confirmation
      const mockInterface = {
        question: vi.fn((question, callback) => callback('y')),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), ['--count', '2']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓ Successfully undid 2 actions')
      );

      currentTaskSpy.mockRestore();
      undoSpy.mockRestore();
    });

    it('should show partial success when some undos fail', async () => {
      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockResolvedValue(createMockTask());

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction')
        .mockResolvedValueOnce(createMockUndoResult({
          actionId: 'action-1',
          restoredFiles: ['src/app.js']
        }))
        .mockResolvedValueOnce(createMockUndoResult({
          success: false,
          actionId: 'action-2',
          restoredFiles: [],
          error: 'File not found'
        }));

      // Mock readline for confirmation
      const mockInterface = {
        question: vi.fn((question, callback) => callback('y')),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), ['--count', '2']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Completed 1 of 2 undo operations')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to undo action-2: File not found')
      );

      currentTaskSpy.mockRestore();
      undoSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle no undoable actions gracefully', async () => {
      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockResolvedValue(createMockTask());

      // Mock getUndoableActions to return empty array
      const getUndoableActionsSpy = vi.spyOn(orchestrator['toolActionStore'], 'getUndoableActions')
        .mockResolvedValue([]);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No undoable actions found for this task')
      );

      currentTaskSpy.mockRestore();
      getUndoableActionsSpy.mockRestore();
    });

    it('should handle orchestrator errors gracefully', async () => {
      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockRejectedValue(new Error('Database connection failed'));

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to undo: Database connection failed')
      );

      currentTaskSpy.mockRestore();
    });

    it('should stop on first failure when undoing multiple actions', async () => {
      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockResolvedValue(createMockTask());

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction')
        .mockResolvedValueOnce(createMockUndoResult())
        .mockResolvedValueOnce(createMockUndoResult({
          success: false,
          error: 'Critical error'
        }));

      // Mock readline for confirmation
      const mockInterface = {
        question: vi.fn((question, callback) => callback('y')),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), ['--count', '5']);

      // Should stop after the failed undo
      expect(undoSpy).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stopping due to failure')
      );

      currentTaskSpy.mockRestore();
      undoSpy.mockRestore();
    });
  });

  describe('Command Aliases', () => {
    it('should work with "u" alias', async () => {
      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      expect(undoCommand?.aliases).toContain('u');

      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockResolvedValue(createMockTask());

      await undoCommand!.handler(createMockContext(), []);

      expect(currentTaskSpy).toHaveBeenCalled();
      currentTaskSpy.mockRestore();
    });
  });

  describe('Argument Parsing', () => {
    it('should parse --task-id and --count together', async () => {
      const taskSpy = vi.spyOn(orchestrator, 'getTask')
        .mockResolvedValue(createMockTask());

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction')
        .mockResolvedValue(createMockUndoResult());

      // Mock readline for confirmation
      const mockInterface = {
        question: vi.fn((question, callback) => callback('y')),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), ['--task-id', 'my-task', '--count', '2']);

      expect(taskSpy).toHaveBeenCalledWith('my-task');
      expect(undoSpy).toHaveBeenCalledTimes(2);

      taskSpy.mockRestore();
      undoSpy.mockRestore();
    });

    it('should handle missing values for flags', async () => {
      const undoCommand = commands.find(cmd => cmd.name === 'undo');

      await undoCommand!.handler(createMockContext(), ['--task-id']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('--task-id requires a task ID')
      );
    });

    it('should handle missing count value', async () => {
      const undoCommand = commands.find(cmd => cmd.name === 'undo');

      await undoCommand!.handler(createMockContext(), ['--count']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('--count requires a number')
      );
    });
  });

  describe('Integration with Orchestrator', () => {
    it('should call orchestrator undo methods correctly', async () => {
      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockResolvedValue(createMockTask());

      const getUndoableActionsSpy = vi.spyOn(orchestrator['toolActionStore'], 'getUndoableActions')
        .mockResolvedValue([
          {
            id: 'action-1',
            taskId: 'test-task-123',
            toolName: 'Write',
            operation: 'write',
            filePath: '/test/src/app.js',
            timestamp: new Date(),
            snapshots: [],
          },
        ]);

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction')
        .mockResolvedValue(createMockUndoResult());

      // Mock readline for confirmation
      const mockInterface = {
        question: vi.fn((question, callback) => callback('y')),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), []);

      expect(currentTaskSpy).toHaveBeenCalled();
      expect(getUndoableActionsSpy).toHaveBeenCalledWith('test-task-123');
      expect(undoSpy).toHaveBeenCalledWith('test-task-123');

      currentTaskSpy.mockRestore();
      getUndoableActionsSpy.mockRestore();
      undoSpy.mockRestore();
    });
  });
});