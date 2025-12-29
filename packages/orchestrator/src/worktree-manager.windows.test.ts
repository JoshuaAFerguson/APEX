import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorktreeManager } from './worktree-manager';
import { getPlatformShell } from '@apexcli/core';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { join, sep } from 'path';

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

describe('WorktreeManager - Windows Compatibility Tests', () => {
  let worktreeManager: WorktreeManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Windows shell configuration
    mockGetPlatformShell.mockReturnValue({
      shell: 'cmd.exe',
      shellArgs: ['/d', '/s', '/c']
    });

    // Default mock setup for fs operations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.access.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({
      birthtime: new Date('2024-01-01'),
      mtime: new Date('2024-01-02'),
    });
    mockFs.utimes.mockResolvedValue(undefined);
    mockFs.rm.mockResolvedValue(undefined);
  });

  describe('Windows path handling', () => {
    it('should handle Windows drive letters in project paths', async () => {
      const windowsProjectPath = 'C:\\projects\\my-app';
      worktreeManager = new WorktreeManager({
        projectPath: windowsProjectPath,
        config: { maxWorktrees: 5 }
      });

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          // Simulate git worktree list output with Windows paths
          const mockOutput = `worktree C:\\projects\\my-app
HEAD abc123
branch main

worktree C:\\projects\\..\\apex-worktrees\\task-win-test
HEAD def456
branch feature/windows-support
`;
          callback(null, { stdout: mockOutput, stderr: '' } as any);
        }
        return {} as any;
      });

      const worktrees = await worktreeManager.listWorktrees();

      expect(worktrees).toHaveLength(2);
      const taskWorktree = worktrees.find(w => w.taskId === 'win-test');
      expect(taskWorktree).toBeDefined();
      expect(taskWorktree?.path).toContain('C:\\projects');
      expect(taskWorktree?.branch).toBe('feature/windows-support');

      // Verify cmd.exe shell was used
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('worktree list --porcelain'),
        expect.objectContaining({ shell: 'cmd.exe' }),
        expect.any(Function)
      );
    });

    it('should handle UNC paths for network drives', async () => {
      const uncPath = '\\\\server\\shared\\projects\\my-app';
      worktreeManager = new WorktreeManager({
        projectPath: uncPath,
        config: { maxWorktrees: 3 }
      });

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          const mockOutput = `worktree \\\\server\\shared\\projects\\my-app\\..\\apex-worktrees\\task-unc-test
HEAD abc123
branch feature/unc-support
`;
          callback(null, { stdout: mockOutput, stderr: '' } as any);
        }
        return {} as any;
      });

      const worktrees = await worktreeManager.listWorktrees();
      expect(worktrees).toHaveLength(1);
      expect(worktrees[0].path).toContain('\\\\server\\shared');
      expect(worktrees[0].taskId).toBe('unc-test');
    });

    it('should handle paths with spaces using proper Windows quoting', async () => {
      const pathWithSpaces = 'C:\\Program Files\\My Project\\app';
      worktreeManager = new WorktreeManager({
        projectPath: pathWithSpaces,
        config: { maxWorktrees: 3 }
      });

      let callCount = 0;
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          if (command.includes('worktree list')) {
            if (callCount === 0) {
              // First call: empty list for limit check
              callback(null, { stdout: '', stderr: '' } as any);
            } else {
              // Subsequent call: verification
              const mockOutput = `worktree C:\\Program Files\\My Project\\..\\apex-worktrees\\task-space-test
HEAD abc123
branch feature/spaces
`;
              callback(null, { stdout: mockOutput, stderr: '' } as any);
            }
            callCount++;
          } else if (command.includes('worktree add')) {
            callback(null, { stdout: 'Preparing worktree', stderr: '' } as any);
          }
        }
        return {} as any;
      });

      await worktreeManager.createWorktree('space-test', 'feature/spaces');

      // Verify the worktree add command was called with proper quoting
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringMatching(/git worktree add ".*apex-worktrees.*task-space-test" -b "feature\/spaces"/),
        expect.objectContaining({
          shell: 'cmd.exe',
          cwd: pathWithSpaces
        }),
        expect.any(Function)
      );
    });

    it('should handle Windows reserved path names gracefully', async () => {
      // Test with paths containing Windows reserved names (CON, PRN, AUX, etc.)
      const projectPath = 'C:\\projects\\CON-test\\app';
      worktreeManager = new WorktreeManager({
        projectPath: projectPath,
        config: { maxWorktrees: 3 }
      });

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          const mockOutput = `worktree C:\\projects\\CON-test\\..\\apex-worktrees\\task-reserved-test
HEAD abc123
branch feature/reserved-names
`;
          callback(null, { stdout: mockOutput, stderr: '' } as any);
        }
        return {} as any;
      });

      const worktrees = await worktreeManager.listWorktrees();
      expect(worktrees).toHaveLength(1);
      expect(worktrees[0].taskId).toBe('reserved-test');
    });

    it('should handle long paths beyond Windows MAX_PATH', async () => {
      // Create a very long path that exceeds traditional 260 character limit
      const longPath = 'C:\\' + 'very-long-directory-name\\'.repeat(10) + 'my-project';
      worktreeManager = new WorktreeManager({
        projectPath: longPath,
        config: { maxWorktrees: 3 }
      });

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          const longWorktreePath = longPath + '\\..\\apex-worktrees\\task-long-path-test';
          const mockOutput = `worktree ${longWorktreePath}
HEAD abc123
branch feature/long-paths
`;
          callback(null, { stdout: mockOutput, stderr: '' } as any);
        }
        return {} as any;
      });

      // Should not throw even with very long paths
      const worktrees = await worktreeManager.listWorktrees();
      expect(worktrees).toHaveLength(1);
      expect(worktrees[0].taskId).toBe('long-path-test');
    });
  });

  describe('Windows shell command execution', () => {
    beforeEach(() => {
      const windowsProjectPath = 'C:\\projects\\test-app';
      worktreeManager = new WorktreeManager({
        projectPath: windowsProjectPath,
        config: { maxWorktrees: 5 }
      });
    });

    it('should use cmd.exe with proper flags for all git operations', async () => {
      let execCallCount = 0;
      const execCalls: any[] = [];

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        execCalls.push({ command, options });

        if (callback) {
          if (command.includes('worktree list')) {
            if (execCallCount === 0) {
              // Empty list for limit check
              callback(null, { stdout: '', stderr: '' } as any);
            } else {
              // Verification call
              const mockOutput = `worktree C:\\projects\\test-app\\..\\apex-worktrees\\task-cmd-test
HEAD abc123
branch feature/cmd-test
`;
              callback(null, { stdout: mockOutput, stderr: '' } as any);
            }
          } else if (command.includes('worktree add')) {
            callback(null, { stdout: 'Preparing worktree', stderr: '' } as any);
          }
        }
        execCallCount++;
        return {} as any;
      });

      await worktreeManager.createWorktree('cmd-test', 'feature/cmd-test');

      // Verify all exec calls used cmd.exe shell
      for (const call of execCalls) {
        expect(call.options).toHaveProperty('shell', 'cmd.exe');
        expect(call.options).toHaveProperty('cwd');
      }

      // Verify getPlatformShell was called for each operation
      expect(mockGetPlatformShell).toHaveBeenCalled();
    });

    it('should handle cmd.exe command escaping for special characters', async () => {
      // Test with branch names containing special characters that need escaping in cmd.exe
      const specialBranchName = 'feature/test&bug|fix';

      let callCount = 0;
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          if (command.includes('worktree list')) {
            if (callCount === 0) {
              callback(null, { stdout: '', stderr: '' } as any);
            } else {
              const mockOutput = `worktree C:\\projects\\test-app\\..\\apex-worktrees\\task-special-test
HEAD abc123
branch feature/test&bug|fix
`;
              callback(null, { stdout: mockOutput, stderr: '' } as any);
            }
            callCount++;
          } else if (command.includes('worktree add')) {
            callback(null, { stdout: 'Preparing worktree', stderr: '' } as any);
          }
        }
        return {} as any;
      });

      await worktreeManager.createWorktree('special-test', specialBranchName);

      // Verify the command was properly quoted for cmd.exe
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining(`-b "${specialBranchName}"`),
        expect.objectContaining({ shell: 'cmd.exe' }),
        expect.any(Function)
      );
    });

    it('should handle cmd.exe batch file commands', async () => {
      // Test scenarios where git might be a batch file on Windows
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }

        // Simulate git being available as git.cmd or git.bat
        if (callback && command.includes('worktree list')) {
          const mockOutput = `worktree C:\\projects\\test-app
HEAD abc123
branch main
`;
          callback(null, { stdout: mockOutput, stderr: '' } as any);
        }
        return {} as any;
      });

      const worktrees = await worktreeManager.listWorktrees();

      expect(worktrees).toHaveLength(1);
      expect(mockExec).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ shell: 'cmd.exe' }),
        expect.any(Function)
      );
    });

    it('should handle Windows environment variables in commands', async () => {
      // Test with paths that might contain Windows environment variables
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          // Simulate git output that might contain expanded env vars
          const mockOutput = `worktree C:\\Users\\TestUser\\projects\\test-app\\..\\apex-worktrees\\task-env-test
HEAD abc123
branch feature/env-vars
`;
          callback(null, { stdout: mockOutput, stderr: '' } as any);
        }
        return {} as any;
      });

      const worktrees = await worktreeManager.listWorktrees();

      expect(worktrees).toHaveLength(1);
      expect(worktrees[0].path).toContain('Users\\TestUser');
    });
  });

  describe('Windows cleanup operations', () => {
    beforeEach(() => {
      const windowsProjectPath = 'C:\\projects\\test-app';
      worktreeManager = new WorktreeManager({
        projectPath: windowsProjectPath,
        config: {
          maxWorktrees: 5,
          pruneStaleAfterDays: 3,
          cleanupOnComplete: true
        }
      });
    });

    it('should use cmd.exe for worktree removal operations', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          if (command.includes('worktree list')) {
            const mockOutput = `worktree C:\\projects\\test-app\\..\\apex-worktrees\\task-cleanup-test
HEAD abc123
branch feature/cleanup
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          } else if (command.includes('worktree remove')) {
            callback(null, { stdout: 'Removed worktree', stderr: '' } as any);
          }
        }
        return {} as any;
      });

      const result = await worktreeManager.deleteWorktree('cleanup-test');

      expect(result).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringMatching(/git worktree remove ".*task-cleanup-test" --force/),
        expect.objectContaining({ shell: 'cmd.exe' }),
        expect.any(Function)
      );
    });

    it('should handle Windows file locking during cleanup', async () => {
      // Simulate Windows file locking issues during cleanup
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          if (command.includes('worktree list')) {
            const mockOutput = `worktree C:\\projects\\test-app\\..\\apex-worktrees\\task-locked-test
HEAD abc123
branch feature/locked
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          } else if (command.includes('worktree remove')) {
            // Simulate file lock error that's common on Windows
            const error = new Error('unable to remove worktree: file in use');
            callback(error, null);
          } else if (command.includes('worktree prune')) {
            callback(null, { stdout: '', stderr: '' } as any);
          }
        }
        return {} as any;
      });

      // Should fall back to manual cleanup then prune
      const result = await worktreeManager.deleteWorktree('locked-test');

      expect(result).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('worktree prune'),
        expect.objectContaining({ shell: 'cmd.exe' }),
        expect.any(Function)
      );
      expect(mockFs.rm).toHaveBeenCalledWith(
        expect.stringContaining('task-locked-test'),
        expect.objectContaining({ recursive: true, force: true })
      );
    });

    it('should handle Windows permission errors during cleanup', async () => {
      // Test cleanup when Windows denies permissions
      mockFs.rm.mockRejectedValue(new Error('Access denied'));

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          if (command.includes('worktree list')) {
            const mockOutput = `worktree C:\\projects\\test-app\\..\\apex-worktrees\\task-perm-test
HEAD abc123
branch feature/permissions
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          } else if (command.includes('worktree remove')) {
            const error = new Error('Permission denied');
            callback(error, null);
          }
        }
        return {} as any;
      });

      // Should propagate the error when both git remove and fs.rm fail
      await expect(worktreeManager.deleteWorktree('perm-test'))
        .rejects.toThrow('Failed to delete worktree');
    });

    it('should handle orphaned worktree cleanup on Windows', async () => {
      // Set up stale worktree for cleanup
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 5); // 5 days ago (stale)

      mockFs.stat.mockResolvedValue({
        birthtime: oldDate,
        mtime: oldDate,
      });

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          if (command.includes('worktree list')) {
            const mockOutput = `worktree C:\\projects\\test-app\\..\\apex-worktrees\\task-stale-test
HEAD abc123
branch feature/old-branch

worktree C:\\projects\\test-app\\..\\apex-worktrees\\task-orphan
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

      expect(cleanedUp).toContain('stale-test');
      expect(cleanedUp).toContain('orphan');

      // Verify cmd.exe was used for cleanup operations
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('worktree remove'),
        expect.objectContaining({ shell: 'cmd.exe' }),
        expect.any(Function)
      );
    });
  });

  describe('Windows error handling and edge cases', () => {
    beforeEach(() => {
      const windowsProjectPath = 'C:\\projects\\test-app';
      worktreeManager = new WorktreeManager({
        projectPath: windowsProjectPath,
        config: { maxWorktrees: 5 }
      });
    });

    it('should handle cmd.exe specific error messages', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          // Simulate a cmd.exe specific error
          const error = new Error("'git' is not recognized as an internal or external command");
          callback(error, null);
        }
        return {} as any;
      });

      await expect(worktreeManager.listWorktrees())
        .rejects.toThrow('Failed to list worktrees');

      // Verify cmd.exe shell was attempted
      expect(mockExec).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ shell: 'cmd.exe' }),
        expect.any(Function)
      );
    });

    it('should handle Windows line endings in git output', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          // Use Windows line endings (CRLF)
          const mockOutput = `worktree C:\\projects\\test-app\r\nHEAD abc123\r\nbranch main\r\n\r\nworktree C:\\projects\\test-app\\..\\apex-worktrees\\task-crlf-test\r\nHEAD def456\r\nbranch feature/crlf\r\n`;
          callback(null, { stdout: mockOutput, stderr: '' } as any);
        }
        return {} as any;
      });

      const worktrees = await worktreeManager.listWorktrees();

      expect(worktrees).toHaveLength(2);
      const taskWorktree = worktrees.find(w => w.taskId === 'crlf-test');
      expect(taskWorktree).toBeDefined();
      expect(taskWorktree?.branch).toBe('feature/crlf');
    });

    it('should handle Windows case-insensitive path comparisons', async () => {
      // Test with mixed case paths (Windows is case-insensitive)
      const mixedCasePath = 'C:\\Projects\\Test-App';
      const worktreeManagerMixed = new WorktreeManager({
        projectPath: mixedCasePath,
        config: { maxWorktrees: 5 }
      });

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback && command.includes('worktree list')) {
          // Git might return paths in different case
          const mockOutput = `worktree c:\\projects\\test-app
HEAD abc123
branch main

worktree C:\\PROJECTS\\TEST-APP\\..\\apex-worktrees\\task-case-test
HEAD def456
branch feature/case-test
`;
          callback(null, { stdout: mockOutput, stderr: '' } as any);
        }
        return {} as any;
      });

      const worktrees = await worktreeManagerMixed.listWorktrees();

      expect(worktrees).toHaveLength(2);
      const mainWorktree = worktrees.find(w => w.isMain);
      expect(mainWorktree).toBeDefined();

      const taskWorktree = worktrees.find(w => w.taskId === 'case-test');
      expect(taskWorktree).toBeDefined();
    });

    it('should handle Windows drive letter edge cases', async () => {
      // Test with different drive letters and formats
      const driveVariations = [
        'D:\\projects\\app',
        'Z:\\network\\shared\\app',
        'c:\\lowercase\\path'  // Lowercase drive letter
      ];

      for (const drivePath of driveVariations) {
        const driveWorktreeManager = new WorktreeManager({
          projectPath: drivePath,
          config: { maxWorktrees: 3 }
        });

        mockExec.mockImplementation((command, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          if (callback && command.includes('worktree list')) {
            const mockOutput = `worktree ${drivePath}\\..\\apex-worktrees\\task-drive-test
HEAD abc123
branch feature/drive-test
`;
            callback(null, { stdout: mockOutput, stderr: '' } as any);
          }
          return {} as any;
        });

        const worktrees = await driveWorktreeManager.listWorktrees();
        expect(worktrees).toHaveLength(1);
        expect(worktrees[0].taskId).toBe('drive-test');
      }
    });
  });

  describe('Windows-specific integration scenarios', () => {
    it('should verify getPlatformShell integration throughout workflow', async () => {
      const windowsProjectPath = 'C:\\projects\\integration-test';
      worktreeManager = new WorktreeManager({
        projectPath: windowsProjectPath,
        config: { maxWorktrees: 5 }
      });

      // Reset mock to track calls
      mockGetPlatformShell.mockClear();

      let callSequence = 0;
      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (callback) {
          if (command.includes('worktree list')) {
            if (callSequence === 0) {
              // Initial limit check
              callback(null, { stdout: '', stderr: '' } as any);
            } else if (callSequence === 2) {
              // Verification after creation
              const mockOutput = `worktree C:\\projects\\integration-test\\..\\apex-worktrees\\task-integration
HEAD abc123
branch feature/integration
`;
              callback(null, { stdout: mockOutput, stderr: '' } as any);
            } else if (callSequence === 3) {
              // List before deletion
              const mockOutput = `worktree C:\\projects\\integration-test\\..\\apex-worktrees\\task-integration
HEAD abc123
branch feature/integration
`;
              callback(null, { stdout: mockOutput, stderr: '' } as any);
            }
          } else if (command.includes('worktree add')) {
            callback(null, { stdout: 'Preparing worktree', stderr: '' } as any);
          } else if (command.includes('worktree remove')) {
            callback(null, { stdout: 'Removed worktree', stderr: '' } as any);
          }
        }
        callSequence++;
        return {} as any;
      });

      // Full workflow: create, verify, delete
      await worktreeManager.createWorktree('integration', 'feature/integration');
      await worktreeManager.deleteWorktree('integration');

      // Verify getPlatformShell was called for each git operation
      expect(mockGetPlatformShell).toHaveBeenCalledTimes(callSequence);

      // Verify all exec calls used cmd.exe
      const allCalls = mockExec.mock.calls;
      for (const call of allCalls) {
        const options = typeof call[1] === 'function' ? {} : call[1];
        expect(options).toHaveProperty('shell', 'cmd.exe');
      }
    });

    it('should handle complete Windows worktree lifecycle', async () => {
      const windowsProjectPath = 'C:\\dev\\myapp';
      worktreeManager = new WorktreeManager({
        projectPath: windowsProjectPath,
        config: {
          maxWorktrees: 3,
          baseDir: 'C:\\worktrees\\myapp',
          cleanupOnComplete: true
        }
      });

      let operationStep = 0;
      const operations = [
        'list-check',    // Check current worktrees for limit
        'add',          // Create new worktree
        'list-verify',  // Verify creation
        'list-delete',  // List before delete
        'remove'        // Remove worktree
      ];

      mockExec.mockImplementation((command, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }

        const currentOp = operations[operationStep] || 'unknown';

        if (callback) {
          if (command.includes('worktree list')) {
            switch (currentOp) {
              case 'list-check':
                callback(null, { stdout: '', stderr: '' } as any);
                break;
              case 'list-verify':
              case 'list-delete':
                const mockOutput = `worktree C:\\worktrees\\myapp\\task-lifecycle
HEAD abc123
branch feature/windows-lifecycle
`;
                callback(null, { stdout: mockOutput, stderr: '' } as any);
                break;
            }
          } else if (command.includes('worktree add')) {
            expect(currentOp).toBe('add');
            expect(command).toContain('C:\\worktrees\\myapp\\task-lifecycle');
            callback(null, { stdout: 'Preparing worktree', stderr: '' } as any);
          } else if (command.includes('worktree remove')) {
            expect(currentOp).toBe('remove');
            callback(null, { stdout: 'Removed worktree', stderr: '' } as any);
          }
        }

        operationStep++;
        return {} as any;
      });

      // Execute complete lifecycle
      const worktreePath = await worktreeManager.createWorktree('lifecycle', 'feature/windows-lifecycle');
      expect(worktreePath).toContain('C:\\worktrees\\myapp\\task-lifecycle');

      const worktree = await worktreeManager.getWorktree('lifecycle');
      expect(worktree).toBeDefined();
      expect(worktree?.taskId).toBe('lifecycle');

      const deleted = await worktreeManager.deleteWorktree('lifecycle');
      expect(deleted).toBe(true);

      // Verify all operations used cmd.exe shell
      const allCalls = mockExec.mock.calls;
      for (const call of allCalls) {
        const options = typeof call[1] === 'function' ? {} : call[1];
        expect(options).toHaveProperty('shell', 'cmd.exe');
      }
    });
  });
});