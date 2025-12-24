import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorktreeManager, WorktreeError } from './worktree-manager';
import { WorktreeStatus } from '@apexcli/core';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';

// Mock external dependencies
vi.mock('child_process');
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    rm: vi.fn(),
    access: vi.fn(),
    stat: vi.fn(),
    utimes: vi.fn(),
  },
}));

const mockExec = exec as any;
const mockFs = fs as any;

describe('WorktreeManager', () => {
  let worktreeManager: WorktreeManager;
  const projectPath = '/test/project';
  const worktreeBaseDir = '/test/project/../.apex-worktrees';

  beforeEach(() => {
    vi.clearAllMocks();
    worktreeManager = new WorktreeManager({
      projectPath,
      config: {
        cleanupOnComplete: true,
        maxWorktrees: 3,
        pruneStaleAfterDays: 2,
        preserveOnFailure: false,
      },
    });
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const manager = new WorktreeManager({ projectPath: '/test' });
      const config = manager.getConfig();

      expect(config.cleanupOnComplete).toBe(true);
      expect(config.maxWorktrees).toBe(5);
      expect(config.pruneStaleAfterDays).toBe(7);
      expect(config.preserveOnFailure).toBe(false);
    });

    it('should use custom config when provided', () => {
      const customConfig = {
        maxWorktrees: 10,
        pruneStaleAfterDays: 14,
      };
      const manager = new WorktreeManager({
        projectPath: '/test',
        config: customConfig,
      });
      const config = manager.getConfig();

      expect(config.maxWorktrees).toBe(10);
      expect(config.pruneStaleAfterDays).toBe(14);
    });

    it('should set correct base directory', () => {
      const manager = new WorktreeManager({
        projectPath: '/test/project',
        config: { baseDir: '/custom/worktrees' },
      });

      expect(manager.getWorktreeBaseDir()).toBe('/custom/worktrees');
    });
  });

  describe('createWorktree', () => {
    beforeEach(() => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          if (command.includes('worktree list')) {
            // Mock empty worktree list
            callback(null, { stdout: '', stderr: '' } as any);
          } else if (command.includes('worktree add')) {
            // Mock successful worktree creation
            callback(null, { stdout: 'Preparing worktree', stderr: '' } as any);
          }
        }
        return {} as any;
      });
    });

    it('should create a new worktree successfully', async () => {
      const taskId = 'test-task-123';
      const branchName = 'feature/test-branch';

      const result = await worktreeManager.createWorktree(taskId, branchName);

      expect(result).toBe(join(worktreeBaseDir, 'task-test-task-123'));
      expect(mockFs.mkdir).toHaveBeenCalledWith(worktreeBaseDir, { recursive: true });
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('worktree add'),
        expect.objectContaining({ cwd: projectPath }),
        expect.any(Function)
      );
    });

    it('should throw error when taskId is empty', async () => {
      await expect(worktreeManager.createWorktree('', 'branch')).rejects.toThrow(WorktreeError);
      await expect(worktreeManager.createWorktree('task', '')).rejects.toThrow(WorktreeError);
    });

    it('should throw error when max worktrees limit is reached', async () => {
      // Mock existing worktrees at the limit
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          const mockOutput = `worktree /test/project/../.apex-worktrees/task-1
HEAD abc123
branch feature/task-1

worktree /test/project/../.apex-worktrees/task-2
HEAD def456
branch feature/task-2

worktree /test/project/../.apex-worktrees/task-3
HEAD ghi789
branch feature/task-3
`;
          callback(null, { stdout: mockOutput, stderr: '' } as any);
        }
        return {} as any;
      });

      await expect(
        worktreeManager.createWorktree('new-task', 'new-branch')
      ).rejects.toThrow('Maximum number of worktrees (3) reached');
    });

    it('should throw error when worktree already exists for task', async () => {
      // Mock existing worktree for the same task
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          const mockOutput = `worktree /test/project/../.apex-worktrees/task-existing-task
HEAD abc123
branch feature/existing
`;
          callback(null, { stdout: mockOutput, stderr: '' } as any);
        }
        return {} as any;
      });

      await expect(
        worktreeManager.createWorktree('existing-task', 'new-branch')
      ).rejects.toThrow('Worktree already exists for task existing-task');
    });

    it('should clean up on creation failure', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          if (command.includes('worktree list')) {
            callback(null, { stdout: '', stderr: '' } as any);
          } else if (command.includes('worktree add')) {
            callback(new Error('Git command failed'), null);
          }
        }
        return {} as any;
      });

      await expect(
        worktreeManager.createWorktree('test-task', 'test-branch')
      ).rejects.toThrow(WorktreeError);

      expect(mockFs.rm).toHaveBeenCalledWith(
        join(worktreeBaseDir, 'task-test-task'),
        { recursive: true, force: true }
      );
    });
  });

  describe('getWorktree', () => {
    beforeEach(() => {
      mockFs.stat.mockResolvedValue({
        birthtime: new Date('2024-01-01'),
        mtime: new Date('2024-01-02'),
      } as any);
      mockFs.access.mockResolvedValue(undefined);
    });

    it('should return worktree info when found', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          const mockOutput = `worktree /test/project/../.apex-worktrees/task-test-task
HEAD abc123
branch feature/test-branch
`;
          callback(null, { stdout: mockOutput, stderr: '' } as any);
        }
        return {} as any;
      });

      const result = await worktreeManager.getWorktree('test-task');

      expect(result).not.toBeNull();
      expect(result?.taskId).toBe('test-task');
      expect(result?.branch).toBe('feature/test-branch');
      expect(result?.head).toBe('abc123');
    });

    it('should return null when worktree not found', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          callback(null, { stdout: '', stderr: '' } as any);
        }
        return {} as any;
      });

      const result = await worktreeManager.getWorktree('nonexistent-task');
      expect(result).toBeNull();
    });

    it('should return null for empty taskId', async () => {
      const result = await worktreeManager.getWorktree('');
      expect(result).toBeNull();
    });
  });

  describe('switchToWorktree', () => {
    beforeEach(() => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.utimes.mockResolvedValue(undefined);
    });

    it('should switch to existing worktree', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          const mockOutput = `worktree /test/project/../.apex-worktrees/task-test-task
HEAD abc123
branch feature/test-branch
`;
          callback(null, { stdout: mockOutput, stderr: '' } as any);
        }
        return {} as any;
      });

      const result = await worktreeManager.switchToWorktree('test-task');

      expect(result).toBe('/test/project/../.apex-worktrees/task-test-task');
      expect(mockFs.access).toHaveBeenCalledWith('/test/project/../.apex-worktrees/task-test-task');
      expect(mockFs.utimes).toHaveBeenCalled();
    });

    it('should throw error when worktree not found', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          callback(null, { stdout: '', stderr: '' } as any);
        }
        return {} as any;
      });

      await expect(
        worktreeManager.switchToWorktree('nonexistent-task')
      ).rejects.toThrow('No worktree found for task nonexistent-task');
    });

    it('should throw error when taskId is empty', async () => {
      await expect(worktreeManager.switchToWorktree('')).rejects.toThrow('TaskId is required');
    });

    it('should throw error when worktree path is not accessible', async () => {
      mockFs.access.mockRejectedValue(new Error('Path not accessible'));

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          const mockOutput = `worktree /test/project/../.apex-worktrees/task-test-task
HEAD abc123
branch feature/test-branch
`;
          callback(null, { stdout: mockOutput, stderr: '' } as any);
        }
        return {} as any;
      });

      await expect(
        worktreeManager.switchToWorktree('test-task')
      ).rejects.toThrow(WorktreeError);
    });
  });

  describe('deleteWorktree', () => {
    it('should delete existing worktree', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          if (command.includes('worktree list')) {
            const mockOutput = `worktree /test/project/../.apex-worktrees/task-test-task
HEAD abc123
branch feature/test-branch
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          } else if (command.includes('worktree remove')) {
            callback(null, { stdout: 'Removed worktree', stderr: '' } as any);
          }
        }
        return {} as any;
      });

      const result = await worktreeManager.deleteWorktree('test-task');

      expect(result).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('worktree remove'),
        expect.objectContaining({ cwd: projectPath }),
        expect.any(Function)
      );
    });

    it('should return false when worktree does not exist', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          callback(null, { stdout: '', stderr: '' } as any);
        }
        return {} as any;
      });

      const result = await worktreeManager.deleteWorktree('nonexistent-task');
      expect(result).toBe(false);
    });

    it('should fallback to manual cleanup when git command fails', async () => {
      mockFs.rm.mockResolvedValue(undefined);

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          if (command.includes('worktree list')) {
            const mockOutput = `worktree /test/project/../.apex-worktrees/task-test-task
HEAD abc123
branch feature/test-branch
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          } else if (command.includes('worktree remove')) {
            callback(new Error('Git command failed'), null);
          } else if (command.includes('worktree prune')) {
            callback(null, { stdout: '', stderr: '' } as any);
          }
        }
        return {} as any;
      });

      const result = await worktreeManager.deleteWorktree('test-task');

      expect(result).toBe(true);
      expect(mockFs.rm).toHaveBeenCalledWith(
        '/test/project/../.apex-worktrees/task-test-task',
        { recursive: true, force: true }
      );
    });

    it('should return false for empty taskId', async () => {
      const result = await worktreeManager.deleteWorktree('');
      expect(result).toBe(false);
    });
  });

  describe('listWorktrees', () => {
    it('should parse worktree list output correctly', async () => {
      mockFs.stat.mockResolvedValue({
        birthtime: new Date('2024-01-01'),
        mtime: new Date('2024-01-02'),
      } as any);
      mockFs.access.mockResolvedValue(undefined);

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          const mockOutput = `worktree /test/project
HEAD abc123
branch main

worktree /test/project/../.apex-worktrees/task-test-task
HEAD def456
branch feature/test-branch

worktree /test/project/../.apex-worktrees/task-another-task
HEAD ghi789
branch feature/another-branch
`;
          callback(null, { stdout: mockOutput, stderr: '' } as any);
        }
        return {} as any;
      });

      const worktrees = await worktreeManager.listWorktrees();

      expect(worktrees).toHaveLength(3);

      // Main worktree
      expect(worktrees[0].isMain).toBe(true);
      expect(worktrees[0].branch).toBe('main');
      expect(worktrees[0].status).toBe('active');

      // Task worktrees
      expect(worktrees[1].taskId).toBe('test-task');
      expect(worktrees[1].isMain).toBe(false);
      expect(worktrees[2].taskId).toBe('another-task');
      expect(worktrees[2].isMain).toBe(false);
    });

    it('should handle detached HEAD', async () => {
      mockFs.stat.mockResolvedValue({
        birthtime: new Date('2024-01-01'),
        mtime: new Date('2024-01-02'),
      } as any);
      mockFs.access.mockResolvedValue(undefined);

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          const mockOutput = `worktree /test/project/../.apex-worktrees/task-detached
HEAD abc123
detached
`;
          callback(null, { stdout: mockOutput, stderr: '' } as any);
        }
        return {} as any;
      });

      const worktrees = await worktreeManager.listWorktrees();

      expect(worktrees).toHaveLength(1);
      expect(worktrees[0].branch).toBe('HEAD');
    });

    it('should handle empty worktree list', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          callback(null, { stdout: '', stderr: '' } as any);
        }
        return {} as any;
      });

      const worktrees = await worktreeManager.listWorktrees();
      expect(worktrees).toHaveLength(0);
    });

    it('should throw error when git command fails', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          callback(new Error('Git command failed'), null);
        }
        return {} as any;
      });

      await expect(worktreeManager.listWorktrees()).rejects.toThrow(WorktreeError);
    });
  });

  describe('cleanupOrphanedWorktrees', () => {
    it('should cleanup stale worktrees', async () => {
      mockFs.stat.mockResolvedValue({
        birthtime: new Date('2024-01-01'),
        mtime: new Date('2024-01-01'), // Old timestamp
      } as any);
      mockFs.access.mockResolvedValue(undefined);

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          if (command.includes('worktree list')) {
            const mockOutput = `worktree /test/project
HEAD abc123
branch main

worktree /test/project/../.apex-worktrees/task-stale-task
HEAD def456
branch feature/stale-branch
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          } else if (command.includes('worktree remove')) {
            callback(null, { stdout: 'Removed worktree', stderr: '' } as any);
          }
        }
        return {} as any;
      });

      const cleanedUp = await worktreeManager.cleanupOrphanedWorktrees();

      expect(cleanedUp).toContain('stale-task');
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('worktree remove'),
        expect.objectContaining({ cwd: projectPath }),
        expect.any(Function)
      );
    });

    it('should skip main worktree', async () => {
      mockFs.stat.mockResolvedValue({
        birthtime: new Date('2024-01-01'),
        mtime: new Date('2024-01-01'),
      } as any);
      mockFs.access.mockResolvedValue(undefined);

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          const mockOutput = `worktree /test/project
HEAD abc123
branch main
`;
          callback(null, { stdout: mockOutput, stderr: '' } as any);
        }
        return {} as any;
      });

      const cleanedUp = await worktreeManager.cleanupOrphanedWorktrees();

      expect(cleanedUp).toHaveLength(0);
      expect(mockExec).not.toHaveBeenCalledWith(
        expect.stringContaining('worktree remove'),
        expect.anything(),
        expect.anything()
      );
    });

    it('should continue cleanup even if individual cleanup fails', async () => {
      mockFs.stat.mockResolvedValue({
        birthtime: new Date('2024-01-01'),
        mtime: new Date('2024-01-01'),
      } as any);
      mockFs.access.mockResolvedValue(undefined);

      // Mock console.warn to suppress warning output during test
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          if (command.includes('worktree list')) {
            const mockOutput = `worktree /test/project/../.apex-worktrees/task-fail-task
HEAD def456
branch feature/fail-branch

worktree /test/project/../.apex-worktrees/task-success-task
HEAD ghi789
branch feature/success-branch
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          } else if (command.includes('task-fail-task')) {
            callback(new Error('Failed to remove'), null);
          } else if (command.includes('task-success-task')) {
            callback(null, { stdout: 'Removed worktree', stderr: '' } as any);
          }
        }
        return {} as any;
      });

      const cleanedUp = await worktreeManager.cleanupOrphanedWorktrees();

      expect(cleanedUp).toContain('success-task');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to cleanup worktree'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getWorktreeBaseDir', () => {
    it('should return correct base directory', () => {
      const result = worktreeManager.getWorktreeBaseDir();
      expect(result).toBe(worktreeBaseDir);
    });
  });

  describe('getConfig', () => {
    it('should return copy of config', () => {
      const config1 = worktreeManager.getConfig();
      const config2 = worktreeManager.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Should be different objects
    });
  });

  describe('error handling', () => {
    it('should create WorktreeError with cause', () => {
      const cause = new Error('Original error');
      const error = new WorktreeError('Test error', cause);

      expect(error.message).toBe('Test error');
      expect(error.cause).toBe(cause);
      expect(error.name).toBe('WorktreeError');
      expect(error.stack).toContain('Caused by:');
    });

    it('should create WorktreeError without cause', () => {
      const error = new WorktreeError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.cause).toBeUndefined();
      expect(error.name).toBe('WorktreeError');
    });
  });
});