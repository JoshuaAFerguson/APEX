import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorktreeManager, WorktreeError } from './worktree-manager';
import { WorktreeStatus, getPlatformShell } from '@apexcli/core';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';

// Mock external dependencies
vi.mock('child_process');
vi.mock('@apexcli/core', () => ({
  getPlatformShell: vi.fn(() => ({
    shell: '/bin/sh',
    shellArgs: ['-c']
  })),
  WorktreeStatus: {
    active: 'active',
    stale: 'stale',
    prunable: 'prunable',
  },
}));
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
const mockGetPlatformShell = getPlatformShell as any;

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
        expect.objectContaining({
          cwd: projectPath,
          shell: '/bin/sh'
        }),
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
        expect.objectContaining({
          cwd: projectPath,
          shell: '/bin/sh'
        }),
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

  // Additional comprehensive test coverage
  describe('edge cases and comprehensive coverage', () => {
    describe('createWorktree edge cases', () => {
      it('should handle verification failure after creation', async () => {
        let callCount = 0;
        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback) {
            if (command.includes('worktree list')) {
              if (callCount === 0) {
                // First call: empty list (for limit check)
                callback(null, { stdout: '', stderr: '' } as any);
              } else {
                // Second call: still empty (verification fails)
                callback(null, { stdout: '', stderr: '' } as any);
              }
              callCount++;
            } else if (command.includes('worktree add')) {
              callback(null, { stdout: 'Preparing worktree', stderr: '' } as any);
            }
          }
          return {} as any;
        });

        await expect(
          worktreeManager.createWorktree('test-task', 'test-branch')
        ).rejects.toThrow('Failed to verify worktree creation');

        expect(mockFs.rm).toHaveBeenCalledWith(
          join(worktreeBaseDir, 'task-test-task'),
          { recursive: true, force: true }
        );
      });

      it('should handle cleanup error during creation failure', async () => {
        mockFs.rm.mockRejectedValue(new Error('Cleanup failed'));

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

        // Should still attempt cleanup even if it fails
        expect(mockFs.rm).toHaveBeenCalled();
      });
    });

    describe('switchToWorktree edge cases', () => {
      it('should handle updateWorktreeTimestamp failure gracefully', async () => {
        mockFs.access.mockResolvedValue(undefined);
        mockFs.utimes.mockRejectedValue(new Error('utimes failed'));

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

        // Should succeed despite utimes failure
        const result = await worktreeManager.switchToWorktree('test-task');
        expect(result).toBe('/test/project/../.apex-worktrees/task-test-task');
      });
    });

    describe('deleteWorktree edge cases', () => {
      it('should throw error when both git and manual cleanup fail', async () => {
        mockFs.rm.mockRejectedValue(new Error('Manual cleanup failed'));

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
              callback(new Error('Git remove failed'), null);
            } else if (command.includes('worktree prune')) {
              callback(null, { stdout: '', stderr: '' } as any);
            }
          }
          return {} as any;
        });

        await expect(
          worktreeManager.deleteWorktree('test-task')
        ).rejects.toThrow(WorktreeError);
      });
    });

    describe('listWorktrees edge cases', () => {
      it('should handle bare repository entries', async () => {
        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback && command.includes('worktree list')) {
            const mockOutput = `worktree /bare/repo
HEAD abc123
bare

worktree /test/project
HEAD def456
branch main
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          }
          return {} as any;
        });

        const worktrees = await worktreeManager.listWorktrees();

        // Should only include the non-bare worktree
        expect(worktrees).toHaveLength(1);
        expect(worktrees[0].path).toBe('/test/project');
      });

      it('should handle worktree with unknown branch', async () => {
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
            const mockOutput = `worktree /test/project/../.apex-worktrees/task-unknown
HEAD abc123
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          }
          return {} as any;
        });

        const worktrees = await worktreeManager.listWorktrees();
        expect(worktrees).toHaveLength(1);
        expect(worktrees[0].branch).toBe('unknown');
      });

      it('should handle incomplete worktree data', async () => {
        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback && command.includes('worktree list')) {
            const mockOutput = `worktree /incomplete/path
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          }
          return {} as any;
        });

        const worktrees = await worktreeManager.listWorktrees();
        expect(worktrees).toHaveLength(0); // Should be filtered out
      });
    });

    describe('finalizeWorktreeInfo edge cases', () => {
      it('should handle inaccessible worktree paths', async () => {
        mockFs.access.mockRejectedValue(new Error('Path not accessible'));
        mockFs.stat.mockRejectedValue(new Error('Stat failed'));

        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback && command.includes('worktree list')) {
            const mockOutput = `worktree /inaccessible/path/task-inaccessible
HEAD abc123
branch feature/inaccessible
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          }
          return {} as any;
        });

        const worktrees = await worktreeManager.listWorktrees();
        expect(worktrees).toHaveLength(1);
        expect(worktrees[0].status).toBe('prunable');
        expect(worktrees[0].createdAt).toBeUndefined();
        expect(worktrees[0].lastUsedAt).toBeUndefined();
      });

      it('should detect stale worktrees based on modification time', async () => {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 10); // 10 days ago, older than pruneStaleAfterDays (2)

        mockFs.access.mockResolvedValue(undefined);
        mockFs.stat.mockResolvedValue({
          birthtime: oldDate,
          mtime: oldDate,
        } as any);

        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback && command.includes('worktree list')) {
            const mockOutput = `worktree /test/project/../.apex-worktrees/task-stale
HEAD abc123
branch feature/stale
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          }
          return {} as any;
        });

        const worktrees = await worktreeManager.listWorktrees();
        expect(worktrees).toHaveLength(1);
        expect(worktrees[0].status).toBe('stale');
        expect(worktrees[0].taskId).toBe('stale');
      });

      it('should mark worktrees without taskId as prunable', async () => {
        mockFs.access.mockResolvedValue(undefined);
        mockFs.stat.mockResolvedValue({
          birthtime: new Date(),
          mtime: new Date(),
        } as any);

        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback && command.includes('worktree list')) {
            const mockOutput = `worktree /test/project/../.apex-worktrees/not-task-format
HEAD abc123
branch feature/not-task
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          }
          return {} as any;
        });

        const worktrees = await worktreeManager.listWorktrees();
        expect(worktrees).toHaveLength(1);
        expect(worktrees[0].status).toBe('prunable');
        expect(worktrees[0].taskId).toBeUndefined();
      });
    });

    describe('cleanupOrphanedWorktrees edge cases', () => {
      it('should cleanup worktrees without taskId', async () => {
        mockFs.stat.mockResolvedValue({
          birthtime: new Date('2024-01-01'),
          mtime: new Date('2024-01-01'),
        } as any);
        mockFs.access.mockResolvedValue(undefined);

        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback) {
            if (command.includes('worktree list')) {
              const mockOutput = `worktree /test/project/../.apex-worktrees/orphaned-worktree
HEAD def456
branch feature/orphaned
`;
              callback(null, { stdout: mockOutput, stderr: '' } as any);
            } else if (command.includes('worktree remove')) {
              callback(null, { stdout: 'Removed worktree', stderr: '' } as any);
            }
          }
          return {} as any;
        });

        const cleanedUp = await worktreeManager.cleanupOrphanedWorktrees();

        expect(cleanedUp).toHaveLength(0); // No taskId means it won't be added to cleanedUp array
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('worktree remove'),
          expect.objectContaining({ cwd: projectPath }),
          expect.any(Function)
        );
      });

      it('should handle prunable status worktrees', async () => {
        mockFs.access.mockRejectedValue(new Error('Not accessible'));

        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback) {
            if (command.includes('worktree list')) {
              const mockOutput = `worktree /test/project/../.apex-worktrees/task-prunable
HEAD def456
branch feature/prunable
`;
              callback(null, { stdout: mockOutput, stderr: '' } as any);
            } else if (command.includes('worktree remove')) {
              callback(null, { stdout: 'Removed worktree', stderr: '' } as any);
            }
          }
          return {} as any;
        });

        const cleanedUp = await worktreeManager.cleanupOrphanedWorktrees();

        expect(cleanedUp).toContain('prunable');
      });
    });

    describe('configuration variations', () => {
      it('should handle all default values', () => {
        const manager = new WorktreeManager({
          projectPath: '/test',
          config: {}
        });
        const config = manager.getConfig();

        expect(config.cleanupOnComplete).toBe(true);
        expect(config.maxWorktrees).toBe(5);
        expect(config.pruneStaleAfterDays).toBe(7);
        expect(config.preserveOnFailure).toBe(false);
        expect(config.cleanupDelayMs).toBe(0);
      });

      it('should handle cleanupDelayMs configuration', () => {
        const manager = new WorktreeManager({
          projectPath: '/test',
          config: { cleanupDelayMs: 1000 }
        });
        const config = manager.getConfig();

        expect(config.cleanupDelayMs).toBe(1000);
      });

      it('should resolve absolute project path', () => {
        const manager = new WorktreeManager({
          projectPath: './relative/path',
        });

        // Should resolve the path
        expect(manager.getWorktreeBaseDir()).toMatch(/\.apex-worktrees$/);
      });
    });

    describe('private method coverage', () => {
      it('should handle worktree info lookup for non-existent path', async () => {
        // This tests the private getWorktreeInfo method indirectly
        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback && command.includes('worktree list')) {
            callback(new Error('Git command failed'), null);
          }
          return {} as any;
        });

        // Create worktree should handle this gracefully during verification
        await expect(
          worktreeManager.createWorktree('test-task', 'test-branch')
        ).rejects.toThrow(WorktreeError);
      });
    });
  });

  describe('additional edge cases for comprehensive coverage', () => {
    describe('createWorktree advanced scenarios', () => {
      it('should handle mkdir failure during directory creation', async () => {
        mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

        await expect(
          worktreeManager.createWorktree('test-task', 'test-branch')
        ).rejects.toThrow(WorktreeError);

        // Should not proceed to git worktree add if mkdir fails
        expect(mockExec).not.toHaveBeenCalledWith(
          expect.stringContaining('worktree add'),
          expect.any(Object),
          expect.any(Function)
        );
      });

      it('should handle git worktree add with stderr output but no error', async () => {
        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback) {
            if (command.includes('worktree list')) {
              // First call for limit check, then verification call
              callback(null, { stdout: '', stderr: '' } as any);
            } else if (command.includes('worktree add')) {
              // Success but with stderr warning
              callback(null, { stdout: 'Preparing worktree', stderr: 'warning: branch already exists' } as any);
            }
          }
          return {} as any;
        });

        // After successful creation, verification should find the worktree
        let callCount = 0;
        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback && command.includes('worktree list')) {
            if (callCount === 0) {
              // First call: empty list (for limit check)
              callback(null, { stdout: '', stderr: '' } as any);
            } else {
              // Second call: verification shows worktree exists
              const mockOutput = `worktree /test/project/../.apex-worktrees/task-test-task
HEAD abc123
branch test-branch
`;
              callback(null, { stdout: mockOutput, stderr: '' } as any);
            }
            callCount++;
          } else if (command.includes('worktree add')) {
            callback(null, { stdout: 'Preparing worktree', stderr: 'warning: branch already exists' } as any);
          }
          return {} as any;
        });

        const result = await worktreeManager.createWorktree('test-task', 'test-branch');
        expect(result).toBe(join(worktreeBaseDir, 'task-test-task'));
      });
    });

    describe('listWorktrees comprehensive parsing', () => {
      it('should handle worktree with very long path names', async () => {
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
            const longPath = '/very/long/path/with/many/nested/directories/for/testing/purposes/.apex-worktrees/task-very-long-task-id-for-testing';
            const mockOutput = `worktree ${longPath}
HEAD abc123
branch feature/very-long-branch-name-for-comprehensive-testing
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          }
          return {} as any;
        });

        const worktrees = await worktreeManager.listWorktrees();
        expect(worktrees).toHaveLength(1);
        expect(worktrees[0].taskId).toBe('very-long-task-id-for-testing');
      });

      it('should handle mixed line endings in git worktree output', async () => {
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
            // Simulate mixed line endings
            const mockOutput = `worktree /test/project/../.apex-worktrees/task-mixed-endings\r\nHEAD abc123\rbranch feature/mixed\n`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          }
          return {} as any;
        });

        const worktrees = await worktreeManager.listWorktrees();
        expect(worktrees).toHaveLength(1);
        expect(worktrees[0].taskId).toBe('mixed-endings');
      });

      it('should handle empty lines and whitespace in git output', async () => {
        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback && command.includes('worktree list')) {
            const mockOutput = `

worktree /test/project

HEAD abc123

branch main


worktree /test/project/../.apex-worktrees/task-whitespace-test

HEAD def456

branch feature/whitespace

`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          }
          return {} as any;
        });

        const worktrees = await worktreeManager.listWorktrees();
        expect(worktrees).toHaveLength(2);
        expect(worktrees.find(w => w.taskId === 'whitespace-test')).toBeDefined();
      });

      it('should handle git worktree output with additional metadata lines', async () => {
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
            const mockOutput = `worktree /test/project/../.apex-worktrees/task-metadata-test
HEAD abc123
branch feature/metadata-test
locked
prunable
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          }
          return {} as any;
        });

        const worktrees = await worktreeManager.listWorktrees();
        expect(worktrees).toHaveLength(1);
        expect(worktrees[0].taskId).toBe('metadata-test');
        expect(worktrees[0].branch).toBe('feature/metadata-test');
      });
    });

    describe('finalizeWorktreeInfo comprehensive scenarios', () => {
      it('should handle worktree with exactly the stale threshold time', async () => {
        const exactThresholdDate = new Date();
        exactThresholdDate.setDate(exactThresholdDate.getDate() - 2); // Exactly pruneStaleAfterDays

        mockFs.access.mockResolvedValue(undefined);
        mockFs.stat.mockResolvedValue({
          birthtime: exactThresholdDate,
          mtime: exactThresholdDate,
        } as any);

        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback && command.includes('worktree list')) {
            const mockOutput = `worktree /test/project/../.apex-worktrees/task-threshold-test
HEAD abc123
branch feature/threshold-test
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          }
          return {} as any;
        });

        const worktrees = await worktreeManager.listWorktrees();
        expect(worktrees).toHaveLength(1);
        expect(worktrees[0].status).toBe('stale'); // Should be stale if >= threshold
      });

      it('should handle worktree with future timestamps', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1); // Future date

        mockFs.access.mockResolvedValue(undefined);
        mockFs.stat.mockResolvedValue({
          birthtime: futureDate,
          mtime: futureDate,
        } as any);

        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback && command.includes('worktree list')) {
            const mockOutput = `worktree /test/project/../.apex-worktrees/task-future-test
HEAD abc123
branch feature/future-test
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          }
          return {} as any;
        });

        const worktrees = await worktreeManager.listWorktrees();
        expect(worktrees).toHaveLength(1);
        expect(worktrees[0].status).toBe('active'); // Should be active for future dates
      });

      it('should handle worktree path that equals project path (main worktree)', async () => {
        mockFs.access.mockResolvedValue(undefined);
        mockFs.stat.mockResolvedValue({
          birthtime: new Date(),
          mtime: new Date(),
        } as any);

        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback && command.includes('worktree list')) {
            const mockOutput = `worktree ${projectPath}
HEAD abc123
branch main
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          }
          return {} as any;
        });

        const worktrees = await worktreeManager.listWorktrees();
        expect(worktrees).toHaveLength(1);
        expect(worktrees[0].isMain).toBe(true);
        expect(worktrees[0].status).toBe('active');
        expect(worktrees[0].taskId).toBeUndefined(); // Main worktree has no taskId
      });
    });

    describe('deleteWorktree edge cases', () => {
      it('should handle git worktree prune failure in manual cleanup', async () => {
        mockFs.rm.mockResolvedValue(undefined);

        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback) {
            if (command.includes('worktree list')) {
              const mockOutput = `worktree /test/project/../.apex-worktrees/task-prune-fail
HEAD abc123
branch feature/prune-fail
`;
              callback(null, { stdout: mockOutput, stderr: '' } as any);
            } else if (command.includes('worktree remove')) {
              callback(new Error('Git remove failed'), null);
            } else if (command.includes('worktree prune')) {
              callback(new Error('Prune failed'), null);
            }
          }
          return {} as any;
        });

        // Should still succeed because fs.rm succeeded
        const result = await worktreeManager.deleteWorktree('prune-fail');
        expect(result).toBe(true);
        expect(mockFs.rm).toHaveBeenCalled();
      });

      it('should return false for worktree with undefined taskId', async () => {
        // Edge case: calling delete with undefined/null taskId
        const result1 = await worktreeManager.deleteWorktree(undefined as any);
        const result2 = await worktreeManager.deleteWorktree(null as any);

        expect(result1).toBe(false);
        expect(result2).toBe(false);
      });
    });

    describe('configuration edge cases', () => {
      it('should handle undefined config values gracefully', () => {
        const manager = new WorktreeManager({
          projectPath: '/test',
          config: {
            maxWorktrees: undefined,
            pruneStaleAfterDays: undefined,
          } as any
        });
        const config = manager.getConfig();

        // Should use defaults when undefined values are provided
        expect(config.maxWorktrees).toBe(5);
        expect(config.pruneStaleAfterDays).toBe(7);
      });

      it('should handle null config object', () => {
        const manager = new WorktreeManager({
          projectPath: '/test',
          config: null as any
        });
        const config = manager.getConfig();

        expect(config.cleanupOnComplete).toBe(true);
        expect(config.maxWorktrees).toBe(5);
      });

      it('should resolve relative project paths correctly', () => {
        const relativePath = './relative/test/path';
        const manager = new WorktreeManager({
          projectPath: relativePath
        });

        const baseDir = manager.getWorktreeBaseDir();
        expect(baseDir).toMatch(/\.apex-worktrees$/);
        expect(baseDir).not.toContain('./');
      });
    });

    describe('error scenarios with specific error types', () => {
      it('should handle ENOENT error in filesystem operations', async () => {
        const enoentError = new Error('ENOENT: no such file or directory');
        (enoentError as any).code = 'ENOENT';

        mockFs.access.mockRejectedValue(enoentError);

        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback && command.includes('worktree list')) {
            const mockOutput = `worktree /nonexistent/path/task-enoent-test
HEAD abc123
branch feature/enoent-test
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          }
          return {} as any;
        });

        const worktrees = await worktreeManager.listWorktrees();
        expect(worktrees).toHaveLength(1);
        expect(worktrees[0].status).toBe('prunable');
      });

      it('should handle permission denied errors in filesystem operations', async () => {
        const permissionError = new Error('EACCES: permission denied');
        (permissionError as any).code = 'EACCES';

        mockFs.access.mockRejectedValue(permissionError);
        mockFs.stat.mockRejectedValue(permissionError);

        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback && command.includes('worktree list')) {
            const mockOutput = `worktree /permission/denied/task-permission-test
HEAD abc123
branch feature/permission-test
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          }
          return {} as any;
        });

        const worktrees = await worktreeManager.listWorktrees();
        expect(worktrees).toHaveLength(1);
        expect(worktrees[0].status).toBe('prunable');
      });

      it('should create WorktreeError with Error cause', () => {
        const originalError = new TypeError('Type error occurred');
        const worktreeError = new WorktreeError('Wrapped error', originalError);

        expect(worktreeError.message).toBe('Wrapped error');
        expect(worktreeError.cause).toBe(originalError);
        expect(worktreeError.name).toBe('WorktreeError');
        expect(worktreeError.stack).toContain('TypeError: Type error occurred');
      });

      it('should create WorktreeError with string cause', () => {
        const stringCause = 'String error message' as any;
        const worktreeError = new WorktreeError('Wrapped string error', stringCause);

        expect(worktreeError.message).toBe('Wrapped string error');
        expect(worktreeError.cause).toBe(stringCause);
      });
    });

    describe('updateWorktreeTimestamp edge cases', () => {
      it('should handle different timestamp update scenarios', async () => {
        // Test the private method indirectly through switchToWorktree
        mockFs.access.mockResolvedValue(undefined);

        // Test successful timestamp update
        mockFs.utimes.mockResolvedValue(undefined);

        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback && command.includes('worktree list')) {
            const mockOutput = `worktree /test/project/../.apex-worktrees/task-timestamp-test
HEAD abc123
branch feature/timestamp-test
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          }
          return {} as any;
        });

        await worktreeManager.switchToWorktree('timestamp-test');
        expect(mockFs.utimes).toHaveBeenCalled();

        // Test with specific error types for utimes
        const utimesError = new Error('EPERM: operation not permitted');
        (utimesError as any).code = 'EPERM';
        mockFs.utimes.mockRejectedValue(utimesError);

        // Should still succeed despite utimes failure
        const result = await worktreeManager.switchToWorktree('timestamp-test');
        expect(result).toBe('/test/project/../.apex-worktrees/task-timestamp-test');
      });
    });
  });
});