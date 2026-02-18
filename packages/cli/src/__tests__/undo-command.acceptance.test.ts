/**
 * Undo Command Acceptance Tests
 * Tests that verify the command meets all acceptance criteria
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { commands } from '../index.js';
import { Task, UndoOperationResult } from '@apexcli/core';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import readline from 'readline';

// Mock readline for user confirmation
vi.mock('readline', () => ({
  createInterface: vi.fn(),
}));

const mockReadline = vi.mocked(readline);

describe('Undo Command Acceptance Criteria', () => {
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

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-undo-acceptance-'));

    await fs.ensureDir(path.join(tempDir, '.apex'));

    const configContent = `
project:
  name: undo-acceptance-test
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

    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    orchestrator = new ApexOrchestrator({ projectPath: tempDir });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    cwdSpy.mockRestore();
    vi.clearAllMocks();

    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('Acceptance Criteria: New apex undo command', () => {
    it('should have an apex undo command that exists', () => {
      const undoCommand = commands.find(cmd => cmd.name === 'undo');

      expect(undoCommand).toBeDefined();
      expect(undoCommand!.name).toBe('undo');
    });

    it('should be accessible as /undo in REPL mode', () => {
      const undoCommand = commands.find(cmd => cmd.name === 'undo');

      expect(undoCommand).toBeDefined();
      // Commands array is used by REPL, so presence here means it's accessible
    });
  });

  describe('Acceptance Criteria: Reverts last tool action(s)', () => {
    it('should revert the last tool action by default', async () => {
      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockResolvedValue({
          id: 'test-task',
          description: 'Test task',
          workflow: 'feature',
          autonomy: 'high',
          status: 'completed',
          priority: 'normal',
          effort: 'medium',
          projectPath: tempDir,
          branchName: 'test-branch',
          retryCount: 0,
          maxRetries: 3,
          resumeAttempts: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.01 },
          logs: [],
          artifacts: [],
          iterationHistory: { taskId: 'test-task', entries: [] },
        } as Task);

      const getUndoableActionsSpy = vi.spyOn(orchestrator['toolActionStore'], 'getUndoableActions')
        .mockResolvedValue([
          {
            id: 'action-1',
            taskId: 'test-task',
            toolName: 'Write',
            operation: 'write',
            filePath: '/test/src/app.js',
            timestamp: new Date(),
            snapshots: [],
          },
        ]);

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction')
        .mockResolvedValue({
          success: true,
          actionId: 'action-1',
          restoredFiles: ['/test/src/app.js'],
          failedFiles: [],
          completedAt: new Date(),
        } as UndoOperationResult);

      // Mock readline for confirmation - user says yes
      const mockInterface = {
        question: vi.fn((question, callback) => callback('y')),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), []);

      // Should call undo once by default
      expect(undoSpy).toHaveBeenCalledTimes(1);
      expect(undoSpy).toHaveBeenCalledWith('test-task');

      currentTaskSpy.mockRestore();
      getUndoableActionsSpy.mockRestore();
      undoSpy.mockRestore();
    });

    it('should revert multiple actions when specified', async () => {
      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockResolvedValue({
          id: 'test-task',
          description: 'Test task',
          workflow: 'feature',
          autonomy: 'high',
          status: 'completed',
          priority: 'normal',
          effort: 'medium',
          projectPath: tempDir,
          branchName: 'test-branch',
          retryCount: 0,
          maxRetries: 3,
          resumeAttempts: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.01 },
          logs: [],
          artifacts: [],
          iterationHistory: { taskId: 'test-task', entries: [] },
        } as Task);

      const getUndoableActionsSpy = vi.spyOn(orchestrator['toolActionStore'], 'getUndoableActions')
        .mockResolvedValue([
          {
            id: 'action-1',
            taskId: 'test-task',
            toolName: 'Write',
            operation: 'write',
            filePath: '/test/src/app.js',
            timestamp: new Date(),
            snapshots: [],
          },
          {
            id: 'action-2',
            taskId: 'test-task',
            toolName: 'Edit',
            operation: 'edit',
            filePath: '/test/src/utils.js',
            timestamp: new Date(),
            snapshots: [],
          },
          {
            id: 'action-3',
            taskId: 'test-task',
            toolName: 'Create',
            operation: 'create',
            filePath: '/test/src/new.js',
            timestamp: new Date(),
            snapshots: [],
          },
        ]);

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction')
        .mockResolvedValue({
          success: true,
          actionId: 'action-1',
          restoredFiles: ['/test/src/app.js'],
          failedFiles: [],
          completedAt: new Date(),
        } as UndoOperationResult);

      // Mock readline for confirmation - user says yes
      const mockInterface = {
        question: vi.fn((question, callback) => callback('y')),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), ['--count', '3']);

      // Should call undo three times
      expect(undoSpy).toHaveBeenCalledTimes(3);

      currentTaskSpy.mockRestore();
      getUndoableActionsSpy.mockRestore();
      undoSpy.mockRestore();
    });
  });

  describe('Acceptance Criteria: Supports --task-id flag', () => {
    it('should support --task-id flag to specify task', async () => {
      const getTaskSpy = vi.spyOn(orchestrator, 'getTask')
        .mockResolvedValue({
          id: 'specific-task-123',
          description: 'Specific test task',
          workflow: 'feature',
          autonomy: 'high',
          status: 'completed',
          priority: 'normal',
          effort: 'medium',
          projectPath: tempDir,
          branchName: 'test-branch',
          retryCount: 0,
          maxRetries: 3,
          resumeAttempts: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.01 },
          logs: [],
          artifacts: [],
          iterationHistory: { taskId: 'specific-task-123', entries: [] },
        } as Task);

      const getUndoableActionsSpy = vi.spyOn(orchestrator['toolActionStore'], 'getUndoableActions')
        .mockResolvedValue([
          {
            id: 'action-1',
            taskId: 'specific-task-123',
            toolName: 'Write',
            operation: 'write',
            filePath: '/test/src/app.js',
            timestamp: new Date(),
            snapshots: [],
          },
        ]);

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction')
        .mockResolvedValue({
          success: true,
          actionId: 'action-1',
          restoredFiles: ['/test/src/app.js'],
          failedFiles: [],
          completedAt: new Date(),
        } as UndoOperationResult);

      // Mock readline for confirmation - user says yes
      const mockInterface = {
        question: vi.fn((question, callback) => callback('y')),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), ['--task-id', 'specific-task-123']);

      expect(getTaskSpy).toHaveBeenCalledWith('specific-task-123');
      expect(getUndoableActionsSpy).toHaveBeenCalledWith('specific-task-123');
      expect(undoSpy).toHaveBeenCalledWith('specific-task-123');

      getTaskSpy.mockRestore();
      getUndoableActionsSpy.mockRestore();
      undoSpy.mockRestore();
    });
  });

  describe('Acceptance Criteria: Supports --count flag', () => {
    it('should support --count flag to specify number of actions', async () => {
      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockResolvedValue({
          id: 'test-task',
          description: 'Test task',
          workflow: 'feature',
          autonomy: 'high',
          status: 'completed',
          priority: 'normal',
          effort: 'medium',
          projectPath: tempDir,
          branchName: 'test-branch',
          retryCount: 0,
          maxRetries: 3,
          resumeAttempts: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.01 },
          logs: [],
          artifacts: [],
          iterationHistory: { taskId: 'test-task', entries: [] },
        } as Task);

      const getUndoableActionsSpy = vi.spyOn(orchestrator['toolActionStore'], 'getUndoableActions')
        .mockResolvedValue([
          { id: 'action-1', taskId: 'test-task', toolName: 'Write', operation: 'write', filePath: '/test/1.js', timestamp: new Date(), snapshots: [] },
          { id: 'action-2', taskId: 'test-task', toolName: 'Write', operation: 'write', filePath: '/test/2.js', timestamp: new Date(), snapshots: [] },
          { id: 'action-3', taskId: 'test-task', toolName: 'Write', operation: 'write', filePath: '/test/3.js', timestamp: new Date(), snapshots: [] },
          { id: 'action-4', taskId: 'test-task', toolName: 'Write', operation: 'write', filePath: '/test/4.js', timestamp: new Date(), snapshots: [] },
          { id: 'action-5', taskId: 'test-task', toolName: 'Write', operation: 'write', filePath: '/test/5.js', timestamp: new Date(), snapshots: [] },
        ]);

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction')
        .mockResolvedValue({
          success: true,
          actionId: 'action-1',
          restoredFiles: ['/test/src/app.js'],
          failedFiles: [],
          completedAt: new Date(),
        } as UndoOperationResult);

      // Mock readline for confirmation - user says yes
      const mockInterface = {
        question: vi.fn((question, callback) => callback('y')),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), ['--count', '5']);

      expect(undoSpy).toHaveBeenCalledTimes(5);

      currentTaskSpy.mockRestore();
      getUndoableActionsSpy.mockRestore();
      undoSpy.mockRestore();
    });
  });

  describe('Acceptance Criteria: Shows what will be undone before confirming', () => {
    it('should show preview of actions that will be undone', async () => {
      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockResolvedValue({
          id: 'test-task',
          description: 'Test task',
          workflow: 'feature',
          autonomy: 'high',
          status: 'completed',
          priority: 'normal',
          effort: 'medium',
          projectPath: tempDir,
          branchName: 'test-branch',
          retryCount: 0,
          maxRetries: 3,
          resumeAttempts: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.01 },
          logs: [],
          artifacts: [],
          iterationHistory: { taskId: 'test-task', entries: [] },
        } as Task);

      const getUndoableActionsSpy = vi.spyOn(orchestrator['toolActionStore'], 'getUndoableActions')
        .mockResolvedValue([
          {
            id: 'action-123',
            taskId: 'test-task',
            toolName: 'Write',
            operation: 'write',
            filePath: '/test/src/important.js',
            timestamp: new Date(),
            snapshots: [],
          },
          {
            id: 'action-456',
            taskId: 'test-task',
            toolName: 'Edit',
            operation: 'edit',
            filePath: '/test/src/config.js',
            timestamp: new Date(),
            snapshots: [],
          },
        ]);

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction')
        .mockResolvedValue({
          success: true,
          actionId: 'action-1',
          restoredFiles: [],
          failedFiles: [],
          completedAt: new Date(),
        } as UndoOperationResult);

      // Mock readline for confirmation - user says no to test preview
      const mockInterface = {
        question: vi.fn((question, callback) => {
          // Verify the confirmation question is asked
          expect(question).toContain('Do you want to proceed?');
          callback('n'); // User says no
        }),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), ['--count', '2']);

      // Should show preview information
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('The following 2 actions will be undone:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Write operation on /test/src/important.js')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Edit operation on /test/src/config.js')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Action ID: action-123')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Action ID: action-456')
      );

      // Should not perform undo since user said no
      expect(undoSpy).not.toHaveBeenCalled();

      currentTaskSpy.mockRestore();
      getUndoableActionsSpy.mockRestore();
      undoSpy.mockRestore();
    });

    it('should ask for user confirmation', async () => {
      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockResolvedValue({
          id: 'test-task',
          description: 'Test task',
          workflow: 'feature',
          autonomy: 'high',
          status: 'completed',
          priority: 'normal',
          effort: 'medium',
          projectPath: tempDir,
          branchName: 'test-branch',
          retryCount: 0,
          maxRetries: 3,
          resumeAttempts: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.01 },
          logs: [],
          artifacts: [],
          iterationHistory: { taskId: 'test-task', entries: [] },
        } as Task);

      const getUndoableActionsSpy = vi.spyOn(orchestrator['toolActionStore'], 'getUndoableActions')
        .mockResolvedValue([
          {
            id: 'action-1',
            taskId: 'test-task',
            toolName: 'Write',
            operation: 'write',
            filePath: '/test/src/app.js',
            timestamp: new Date(),
            snapshots: [],
          },
        ]);

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction');

      // Mock readline to verify confirmation is requested
      const mockInterface = {
        question: vi.fn((question, callback) => {
          expect(question).toContain('Do you want to proceed?');
          callback('n');
        }),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), []);

      expect(mockInterface.question).toHaveBeenCalled();
      expect(undoSpy).not.toHaveBeenCalled();

      currentTaskSpy.mockRestore();
      getUndoableActionsSpy.mockRestore();
      undoSpy.mockRestore();
    });
  });

  describe('Acceptance Criteria: Displays success/failure feedback', () => {
    it('should display success feedback when undo succeeds', async () => {
      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockResolvedValue({
          id: 'test-task',
          description: 'Test task',
          workflow: 'feature',
          autonomy: 'high',
          status: 'completed',
          priority: 'normal',
          effort: 'medium',
          projectPath: tempDir,
          branchName: 'test-branch',
          retryCount: 0,
          maxRetries: 3,
          resumeAttempts: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.01 },
          logs: [],
          artifacts: [],
          iterationHistory: { taskId: 'test-task', entries: [] },
        } as Task);

      const getUndoableActionsSpy = vi.spyOn(orchestrator['toolActionStore'], 'getUndoableActions')
        .mockResolvedValue([
          {
            id: 'action-success',
            taskId: 'test-task',
            toolName: 'Write',
            operation: 'write',
            filePath: '/test/src/app.js',
            timestamp: new Date(),
            snapshots: [],
          },
        ]);

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction')
        .mockResolvedValue({
          success: true,
          actionId: 'action-success',
          restoredFiles: ['/test/src/app.js', '/test/src/utils.js'],
          failedFiles: [],
          completedAt: new Date(),
        } as UndoOperationResult);

      // Mock readline for confirmation - user says yes
      const mockInterface = {
        question: vi.fn((question, callback) => callback('y')),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), []);

      // Should show success message
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓ Successfully undid 1 action')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Restored: /test/src/app.js, /test/src/utils.js')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('💡 Tip: Use /diff to see the current state')
      );

      currentTaskSpy.mockRestore();
      getUndoableActionsSpy.mockRestore();
      undoSpy.mockRestore();
    });

    it('should display failure feedback when undo fails', async () => {
      const currentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
        .mockResolvedValue({
          id: 'test-task',
          description: 'Test task',
          workflow: 'feature',
          autonomy: 'high',
          status: 'completed',
          priority: 'normal',
          effort: 'medium',
          projectPath: tempDir,
          branchName: 'test-branch',
          retryCount: 0,
          maxRetries: 3,
          resumeAttempts: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.01 },
          logs: [],
          artifacts: [],
          iterationHistory: { taskId: 'test-task', entries: [] },
        } as Task);

      const getUndoableActionsSpy = vi.spyOn(orchestrator['toolActionStore'], 'getUndoableActions')
        .mockResolvedValue([
          {
            id: 'action-fail',
            taskId: 'test-task',
            toolName: 'Write',
            operation: 'write',
            filePath: '/test/src/app.js',
            timestamp: new Date(),
            snapshots: [],
          },
        ]);

      const undoSpy = vi.spyOn(orchestrator, 'undoLastAction')
        .mockResolvedValue({
          success: false,
          actionId: 'action-fail',
          restoredFiles: [],
          failedFiles: [{ path: '/test/src/app.js', error: 'File not found' }],
          completedAt: new Date(),
          error: 'Unable to restore file: File not found',
        } as UndoOperationResult);

      // Mock readline for confirmation - user says yes
      const mockInterface = {
        question: vi.fn((question, callback) => callback('y')),
        close: vi.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockInterface as any);

      const undoCommand = commands.find(cmd => cmd.name === 'undo');
      await undoCommand!.handler(createMockContext(), []);

      // Should show failure message
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Failed to undo action 1/1: Unable to restore file: File not found')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to undo any actions')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('action-fail: Unable to restore file: File not found')
      );

      currentTaskSpy.mockRestore();
      getUndoableActionsSpy.mockRestore();
      undoSpy.mockRestore();
    });
  });
});