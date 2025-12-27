/**
 * Tests for the push command functionality
 * Tests command registration, validation, and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { commands, type CliContext } from '../index.js';

describe('Push Command', () => {
  let mockContext: CliContext;
  let mockOrchestrator: any;

  beforeEach(() => {
    mockOrchestrator = {
      getTask: vi.fn(),
      pushTaskBranch: vi.fn(),
    };

    mockContext = {
      cwd: process.cwd(),
      initialized: true,
      config: {} as any,
      orchestrator: mockOrchestrator,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };
  });

  describe('Command registration', () => {
    it('should be registered with correct properties', () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');

      expect(pushCommand).toBeDefined();
      expect(pushCommand?.name).toBe('push');
      expect(pushCommand?.aliases).toEqual(['p']);
      expect(pushCommand?.description).toBe('Push task branch to remote origin');
      expect(pushCommand?.usage).toBe('/push <task_id>');
      expect(pushCommand?.handler).toBeTypeOf('function');
    });

    it('should have unique alias that does not conflict', () => {
      const aliasMap = new Map<string, string[]>();

      for (const command of commands) {
        for (const alias of command.aliases) {
          if (!aliasMap.has(alias)) {
            aliasMap.set(alias, []);
          }
          aliasMap.get(alias)!.push(command.name);
        }
      }

      const pushAliasConflicts = aliasMap.get('p');
      expect(pushAliasConflicts).toEqual(['push']);
    });
  });

  describe('Command validation', () => {
    it('should reject when APEX is not initialized', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const uninitializedContext = { ...mockContext, initialized: false, orchestrator: null };

      await pushCommand?.handler(uninitializedContext, ['test-task-id']);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('APEX not initialized'));
      consoleSpy.mockRestore();
    });

    it('should reject when no task ID is provided', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await pushCommand?.handler(mockContext, []);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: /push <task_id>'));
      consoleSpy.mockRestore();
    });

    it('should reject when task is not found', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      mockOrchestrator.getTask.mockResolvedValue(null);

      await pushCommand?.handler(mockContext, ['non-existent-task']);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('non-existent-task');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Task not found: non-existent-task'));
      consoleSpy.mockRestore();
    });

    it('should reject when task has no branch', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const taskWithoutBranch = {
        id: 'test-task',
        description: 'Test task',
        branchName: null,
      };

      mockOrchestrator.getTask.mockResolvedValue(taskWithoutBranch);

      await pushCommand?.handler(mockContext, ['test-task']);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('test-task');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Task does not have a branch'));
      consoleSpy.mockRestore();
    });
  });

  describe('Success path', () => {
    it('should successfully push task branch', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const taskWithBranch = {
        id: 'test-task',
        description: 'Test task',
        branchName: 'feature/test-branch',
      };

      mockOrchestrator.getTask.mockResolvedValue(taskWithBranch);
      mockOrchestrator.pushTaskBranch.mockResolvedValue({ success: true });

      await pushCommand?.handler(mockContext, ['test-task']);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('test-task');
      expect(mockOrchestrator.pushTaskBranch).toHaveBeenCalledWith('test-task');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Pushing branch feature/test-branch to remote'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Successfully pushed feature/test-branch to origin'));
      consoleSpy.mockRestore();
    });
  });

  describe('Error handling', () => {
    it('should handle push failure gracefully', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const taskWithBranch = {
        id: 'test-task',
        description: 'Test task',
        branchName: 'feature/test-branch',
      };

      mockOrchestrator.getTask.mockResolvedValue(taskWithBranch);
      mockOrchestrator.pushTaskBranch.mockResolvedValue({
        success: false,
        error: 'Remote repository not found'
      });

      await pushCommand?.handler(mockContext, ['test-task']);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('test-task');
      expect(mockOrchestrator.pushTaskBranch).toHaveBeenCalledWith('test-task');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to push: Remote repository not found'));
      consoleSpy.mockRestore();
    });

    it('should handle orchestrator method call errors', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const taskWithBranch = {
        id: 'test-task',
        description: 'Test task',
        branchName: 'feature/test-branch',
      };

      mockOrchestrator.getTask.mockResolvedValue(taskWithBranch);
      mockOrchestrator.pushTaskBranch.mockRejectedValue(new Error('Network error'));

      // Should not throw, but handle the error gracefully
      await expect(pushCommand?.handler(mockContext, ['test-task'])).resolves.not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('Command positioning', () => {
    it('should be positioned near related git commands', () => {
      const pushIndex = commands.findIndex(cmd => cmd.name === 'push');
      const prIndex = commands.findIndex(cmd => cmd.name === 'pr');

      expect(pushIndex).toBeGreaterThan(-1);
      expect(prIndex).toBeGreaterThan(-1);

      // Push should be positioned after pr command (since we added it after pr)
      expect(pushIndex).toBeGreaterThan(prIndex);
    });
  });
});