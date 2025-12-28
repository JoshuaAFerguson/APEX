import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorktreeManager } from './worktree-manager';
import { getPlatformShell } from '@apexcli/core';
import { exec } from 'child_process';
import { promises as fs } from 'fs';

// Mock external dependencies
vi.mock('child_process');
vi.mock('@apexcli/core', () => ({
  getPlatformShell: vi.fn(),
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

describe('WorktreeManager - Cross-Platform Shell Support', () => {
  let worktreeManager: WorktreeManager;
  const projectPath = '/test/project';

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

    // Default mock setup
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.access.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({
      birthtime: new Date('2024-01-01'),
      mtime: new Date('2024-01-02'),
    });
    mockFs.utimes.mockResolvedValue(undefined);
  });

  describe('Windows shell support', () => {
    beforeEach(() => {
      mockGetPlatformShell.mockReturnValue({
        shell: 'cmd.exe',
        shellArgs: ['/d', '/s', '/c']
      });
    });

    it('should use cmd.exe shell for createWorktree on Windows', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          if (command.includes('worktree list')) {
            callback(null, { stdout: '', stderr: '' } as any);
          } else if (command.includes('worktree add')) {
            callback(null, { stdout: 'Preparing worktree', stderr: '' } as any);
          }
        }
        return {} as any;
      });

      // Mock verification call for createWorktree
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
          callback(null, { stdout: 'Preparing worktree', stderr: '' } as any);
        }
        return {} as any;
      });

      await worktreeManager.createWorktree('test-task', 'test-branch');

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('worktree add'),
        expect.objectContaining({
          cwd: projectPath,
          shell: 'cmd.exe'
        }),
        expect.any(Function)
      );
    });

    it('should use cmd.exe shell for deleteWorktree on Windows', async () => {
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

      await worktreeManager.deleteWorktree('test-task');

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('worktree remove'),
        expect.objectContaining({
          cwd: projectPath,
          shell: 'cmd.exe'
        }),
        expect.any(Function)
      );
    });

    it('should use cmd.exe shell for listWorktrees on Windows', async () => {
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

      await worktreeManager.listWorktrees();

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('worktree list --porcelain'),
        expect.objectContaining({
          cwd: projectPath,
          shell: 'cmd.exe'
        }),
        expect.any(Function)
      );
    });

    it('should use cmd.exe shell for cleanup operations on Windows', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          if (command.includes('worktree list')) {
            const mockOutput = `worktree /test/project/../.apex-worktrees/task-stale-task
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

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days ago
      mockFs.stat.mockResolvedValue({
        birthtime: oldDate,
        mtime: oldDate,
      });

      await worktreeManager.cleanupOrphanedWorktrees();

      // Verify both worktree list and remove commands use cmd.exe
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('worktree list'),
        expect.objectContaining({ shell: 'cmd.exe' }),
        expect.any(Function)
      );

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('worktree remove'),
        expect.objectContaining({ shell: 'cmd.exe' }),
        expect.any(Function)
      );
    });

    it('should use cmd.exe shell for git worktree prune on Windows', async () => {
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
            callback(new Error('Git remove failed'), null);
          } else if (command.includes('worktree prune')) {
            callback(null, { stdout: '', stderr: '' } as any);
          }
        }
        return {} as any;
      });

      await worktreeManager.deleteWorktree('test-task');

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('worktree prune'),
        expect.objectContaining({
          cwd: projectPath,
          shell: 'cmd.exe'
        }),
        expect.any(Function)
      );
    });
  });

  describe('Unix shell support', () => {
    beforeEach(() => {
      mockGetPlatformShell.mockReturnValue({
        shell: '/bin/sh',
        shellArgs: ['-c']
      });
    });

    it('should use /bin/sh shell for createWorktree on Unix', async () => {
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
          callback(null, { stdout: 'Preparing worktree', stderr: '' } as any);
        }
        return {} as any;
      });

      await worktreeManager.createWorktree('test-task', 'test-branch');

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('worktree add'),
        expect.objectContaining({
          cwd: projectPath,
          shell: '/bin/sh'
        }),
        expect.any(Function)
      );
    });

    it('should use /bin/sh shell for deleteWorktree on Unix', async () => {
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

      await worktreeManager.deleteWorktree('test-task');

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('worktree remove'),
        expect.objectContaining({
          cwd: projectPath,
          shell: '/bin/sh'
        }),
        expect.any(Function)
      );
    });

    it('should use /bin/sh shell for listWorktrees on Unix', async () => {
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

      await worktreeManager.listWorktrees();

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('worktree list --porcelain'),
        expect.objectContaining({
          cwd: projectPath,
          shell: '/bin/sh'
        }),
        expect.any(Function)
      );
    });
  });

  describe('getPlatformShell integration', () => {
    it('should call getPlatformShell for each git command execution', async () => {
      mockGetPlatformShell.mockReturnValue({
        shell: '/bin/sh',
        shellArgs: ['-c']
      });

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          if (command.includes('worktree list')) {
            callback(null, { stdout: '', stderr: '' } as any);
          } else if (command.includes('worktree add')) {
            callback(null, { stdout: 'Preparing worktree', stderr: '' } as any);
          }
        }
        return {} as any;
      });

      // createWorktree makes multiple calls to git (list for checking, add, list for verification)
      await worktreeManager.createWorktree('test-task', 'test-branch').catch(() => {
        // Ignore verification failure, we're testing shell calls
      });

      // getPlatformShell should be called for each exec call
      expect(mockGetPlatformShell).toHaveBeenCalled();
    });

    it('should handle different shell configurations', async () => {
      // Test with PowerShell configuration
      mockGetPlatformShell.mockReturnValue({
        shell: 'powershell.exe',
        shellArgs: ['-Command']
      });

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          callback(null, { stdout: '', stderr: '' } as any);
        }
        return {} as any;
      });

      await worktreeManager.listWorktrees();

      expect(mockExec).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          shell: 'powershell.exe'
        }),
        expect.any(Function)
      );
    });

    it('should handle shell configuration errors gracefully', async () => {
      // Mock getPlatformShell to return undefined/null shell (edge case)
      mockGetPlatformShell.mockReturnValue({
        shell: undefined,
        shellArgs: []
      });

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          callback(null, { stdout: '', stderr: '' } as any);
        }
        return {} as any;
      });

      await worktreeManager.listWorktrees();

      expect(mockExec).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          shell: undefined
        }),
        expect.any(Function)
      );
    });
  });

  describe('path handling and normalization', () => {
    it('should handle Windows-style paths in worktree operations', async () => {
      mockGetPlatformShell.mockReturnValue({
        shell: 'cmd.exe',
        shellArgs: ['/d', '/s', '/c']
      });

      const windowsProjectPath = 'C:\\projects\\test-project';
      const windowsWorktreeManager = new WorktreeManager({
        projectPath: windowsProjectPath,
      });

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          const mockOutput = `worktree C:\\projects\\test-project\\..\\apex-worktrees\\task-windows-test
HEAD abc123
branch feature/windows-test
`;
          callback(null, { stdout: mockOutput, stderr: '' } as any);
        }
        return {} as any;
      });

      const worktrees = await windowsWorktreeManager.listWorktrees();
      expect(worktrees).toHaveLength(1);
      expect(worktrees[0].taskId).toBe('windows-test');
    });

    it('should handle Unix-style paths in worktree operations', async () => {
      mockGetPlatformShell.mockReturnValue({
        shell: '/bin/sh',
        shellArgs: ['-c']
      });

      const unixProjectPath = '/home/user/projects/test-project';
      const unixWorktreeManager = new WorktreeManager({
        projectPath: unixProjectPath,
      });

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          const mockOutput = `worktree /home/user/projects/test-project/../.apex-worktrees/task-unix-test
HEAD abc123
branch feature/unix-test
`;
          callback(null, { stdout: mockOutput, stderr: '' } as any);
        }
        return {} as any;
      });

      const worktrees = await unixWorktreeManager.listWorktrees();
      expect(worktrees).toHaveLength(1);
      expect(worktrees[0].taskId).toBe('unix-test');
    });
  });

  describe('command execution verification', () => {
    it('should verify all execAsync calls include shell option', async () => {
      mockGetPlatformShell.mockReturnValue({
        shell: 'test-shell',
        shellArgs: ['-test']
      });

      const execCalls: any[] = [];
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        execCalls.push({ command, options });
        if (callback) {
          if (command.includes('worktree list')) {
            callback(null, { stdout: '', stderr: '' } as any);
          } else if (command.includes('worktree add')) {
            callback(null, { stdout: 'Preparing worktree', stderr: '' } as any);
          } else if (command.includes('worktree remove')) {
            callback(null, { stdout: 'Removed worktree', stderr: '' } as any);
          }
        }
        return {} as any;
      });

      // Test multiple operations to verify all use shell option
      await worktreeManager.listWorktrees();

      // Verify that every exec call includes the shell option
      for (const call of execCalls) {
        expect(call.options).toHaveProperty('shell');
        expect(call.options.shell).toBe('test-shell');
      }
    });

    it('should maintain backwards compatibility with existing functionality', async () => {
      mockGetPlatformShell.mockReturnValue({
        shell: '/bin/sh',
        shellArgs: ['-c']
      });

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          if (command.includes('worktree list')) {
            const mockOutput = `worktree /test/project
HEAD abc123
branch main

worktree /test/project/../.apex-worktrees/task-compat-test
HEAD def456
branch feature/compat-test
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          } else if (command.includes('worktree remove')) {
            callback(null, { stdout: 'Removed worktree', stderr: '' } as any);
          }
        }
        return {} as any;
      });

      // Test that existing functionality still works
      const worktrees = await worktreeManager.listWorktrees();
      expect(worktrees).toHaveLength(2);

      const taskWorktree = worktrees.find(w => w.taskId === 'compat-test');
      expect(taskWorktree).toBeDefined();
      expect(taskWorktree?.isMain).toBe(false);
      expect(taskWorktree?.branch).toBe('feature/compat-test');

      const mainWorktree = worktrees.find(w => w.isMain);
      expect(mainWorktree).toBeDefined();
      expect(mainWorktree?.branch).toBe('main');

      const result = await worktreeManager.deleteWorktree('compat-test');
      expect(result).toBe(true);
    });
  });

  describe('error handling with shell support', () => {
    it('should handle shell execution errors properly', async () => {
      mockGetPlatformShell.mockReturnValue({
        shell: 'cmd.exe',
        shellArgs: ['/d', '/s', '/c']
      });

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          // Simulate shell-related error
          const error = new Error('Command failed with shell: cmd.exe');
          callback(error, null);
        }
        return {} as any;
      });

      await expect(worktreeManager.listWorktrees()).rejects.toThrow();

      // Verify the shell option was still used in the failed call
      expect(mockExec).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          shell: 'cmd.exe'
        }),
        expect.any(Function)
      );
    });

    it('should handle different shell types in error scenarios', async () => {
      mockGetPlatformShell.mockReturnValue({
        shell: '/bin/bash',
        shellArgs: ['-c']
      });

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          const error = new Error('bash: command not found');
          callback(error, null);
        }
        return {} as any;
      });

      await expect(worktreeManager.listWorktrees()).rejects.toThrow();

      expect(mockExec).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          shell: '/bin/bash'
        }),
        expect.any(Function)
      );
    });
  });
});