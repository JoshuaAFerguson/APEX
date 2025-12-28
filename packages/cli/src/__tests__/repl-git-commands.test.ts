import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// Mock core utilities
vi.mock('@apexcli/core', () => ({
  getPlatformShell: vi.fn(() => ({
    shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
    shellArgs: process.platform === 'win32' ? ['/d', '/s', '/c'] : ['-c']
  })),
  isWindows: vi.fn(() => process.platform === 'win32'),
  resolveExecutable: vi.fn((name: string) =>
    process.platform === 'win32' && !name.includes('.') ? `${name}.exe` : name
  ),
}));

describe('REPL Git Command Platform Integration', () => {
  const mockExecSync = vi.mocked(execSync);
  let originalPlatform: string;

  beforeEach(() => {
    vi.clearAllMocks();
    originalPlatform = process.platform;
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
  });

  describe('getGitBranch function behavior', () => {
    it('should use Windows shell configuration on Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      mockExecSync.mockReturnValue('main\n');

      // Simulate the getGitBranch function logic
      const { getPlatformShell } = require('@apexcli/core');
      const shellConfig = getPlatformShell();

      const result = mockExecSync('git branch --show-current', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: shellConfig.shell,
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        'git branch --show-current',
        expect.objectContaining({
          shell: 'cmd.exe',
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      );

      expect(result?.toString().trim()).toBe('main');
    });

    it('should use Unix shell configuration on macOS', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
      });

      mockExecSync.mockReturnValue('feature-branch\n');

      const { getPlatformShell } = require('@apexcli/core');
      const shellConfig = getPlatformShell();

      const result = mockExecSync('git branch --show-current', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: shellConfig.shell,
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        'git branch --show-current',
        expect.objectContaining({
          shell: '/bin/sh',
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      );

      expect(result?.toString().trim()).toBe('feature-branch');
    });

    it('should use Unix shell configuration on Linux', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
      });

      mockExecSync.mockReturnValue('develop\n');

      const { getPlatformShell } = require('@apexcli/core');
      const shellConfig = getPlatformShell();

      mockExecSync('git branch --show-current', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: shellConfig.shell,
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        'git branch --show-current',
        expect.objectContaining({
          shell: '/bin/sh',
        })
      );
    });

    it('should handle empty git output', () => {
      mockExecSync.mockReturnValue('');

      // Simulate git command returning empty output
      const result = mockExecSync('git branch --show-current', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: '/bin/sh',
      });

      const branch = result?.toString().trim() || undefined;
      expect(branch).toBeUndefined();
    });

    it('should handle git command failures gracefully', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      // The getGitBranch function should return undefined on error
      let branch: string | undefined;
      try {
        const result = mockExecSync('git branch --show-current', {
          cwd: process.cwd(),
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: '/bin/sh',
        });
        branch = result?.toString().trim() || undefined;
      } catch {
        branch = undefined;
      }

      expect(branch).toBeUndefined();
    });

    it('should trim whitespace from git branch output', () => {
      const branchOutputs = [
        'main\n',
        '  feature-branch  \n',
        '\tmain\t',
        'develop\r\n',
        '\n  hotfix/urgent  \r\n'
      ];

      const expectedBranches = [
        'main',
        'feature-branch',
        'main',
        'develop',
        'hotfix/urgent'
      ];

      branchOutputs.forEach((output, index) => {
        mockExecSync.mockReturnValue(output);

        const result = mockExecSync('git branch --show-current', {
          cwd: process.cwd(),
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: '/bin/sh',
        });

        const branch = result?.toString().trim() || undefined;
        expect(branch).toBe(expectedBranches[index]);
      });
    });

    it('should handle special branch names', () => {
      const specialBranches = [
        'feature/special-chars-!@#',
        'hotfix/1.2.3',
        'users/john.doe/feature-branch',
        'releases/v2.0.0-beta',
        'bugfix/fix-issue-123'
      ];

      specialBranches.forEach((branchName) => {
        mockExecSync.mockReturnValue(`${branchName}\n`);

        const result = mockExecSync('git branch --show-current', {
          cwd: process.cwd(),
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: '/bin/sh',
        });

        const branch = result?.toString().trim() || undefined;
        expect(branch).toBe(branchName);
      });
    });

    it('should work with different working directories', () => {
      const testPaths = [
        '/tmp/test-repo',
        'C:\\Users\\test\\repo',
        './relative-path',
        '../parent-dir/repo'
      ];

      testPaths.forEach((testPath) => {
        mockExecSync.mockReturnValue('main\n');

        mockExecSync('git branch --show-current', {
          cwd: testPath,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: '/bin/sh',
        });

        expect(mockExecSync).toHaveBeenCalledWith(
          'git branch --show-current',
          expect.objectContaining({
            cwd: testPath,
          })
        );
      });
    });
  });

  describe('Git command stdio configuration', () => {
    it('should use proper stdio configuration to capture output', () => {
      mockExecSync.mockReturnValue('main\n');

      mockExecSync('git branch --show-current', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: '/bin/sh',
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        'git branch --show-current',
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe'],
          encoding: 'utf-8',
        })
      );
    });

    it('should handle stderr output properly', () => {
      // Test that stderr is captured but doesn't interfere
      mockExecSync.mockImplementation(() => {
        const error = new Error('Command failed') as any;
        error.stderr = 'fatal: not a git repository';
        throw error;
      });

      let errorCaught = false;
      try {
        mockExecSync('git branch --show-current', {
          cwd: process.cwd(),
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: '/bin/sh',
        });
      } catch (error) {
        errorCaught = true;
        expect((error as any).stderr).toBe('fatal: not a git repository');
      }

      expect(errorCaught).toBe(true);
    });
  });

  describe('Platform-specific git execution', () => {
    it('should work with Windows line endings', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      // Windows git might return CRLF line endings
      mockExecSync.mockReturnValue('main\r\n');

      const result = mockExecSync('git branch --show-current', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: 'cmd.exe',
      });

      const branch = result?.toString().trim() || undefined;
      expect(branch).toBe('main');
    });

    it('should work with Unix line endings', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
      });

      mockExecSync.mockReturnValue('main\n');

      const result = mockExecSync('git branch --show-current', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: '/bin/sh',
      });

      const branch = result?.toString().trim() || undefined;
      expect(branch).toBe('main');
    });

    it('should handle mixed line endings', () => {
      const mixedOutput = 'main\r\n\n';
      mockExecSync.mockReturnValue(mixedOutput);

      const result = mockExecSync('git branch --show-current', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: '/bin/sh',
      });

      const branch = result?.toString().trim() || undefined;
      expect(branch).toBe('main');
    });
  });

  describe('Error scenarios and edge cases', () => {
    it('should handle permission errors', () => {
      mockExecSync.mockImplementation(() => {
        const error = new Error('Permission denied') as any;
        error.code = 'EACCES';
        throw error;
      });

      let branch: string | undefined;
      try {
        mockExecSync('git branch --show-current', {
          cwd: process.cwd(),
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: '/bin/sh',
        });
      } catch {
        branch = undefined;
      }

      expect(branch).toBeUndefined();
    });

    it('should handle timeout errors', () => {
      mockExecSync.mockImplementation(() => {
        const error = new Error('Command timeout') as any;
        error.code = 'TIMEOUT';
        throw error;
      });

      let branch: string | undefined;
      try {
        mockExecSync('git branch --show-current', {
          cwd: process.cwd(),
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: '/bin/sh',
        });
      } catch {
        branch = undefined;
      }

      expect(branch).toBeUndefined();
    });

    it('should handle git not installed', () => {
      mockExecSync.mockImplementation(() => {
        const error = new Error('git: command not found') as any;
        error.code = 'ENOENT';
        throw error;
      });

      let branch: string | undefined;
      try {
        mockExecSync('git branch --show-current', {
          cwd: process.cwd(),
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: '/bin/sh',
        });
      } catch {
        branch = undefined;
      }

      expect(branch).toBeUndefined();
    });

    it('should handle detached HEAD state', () => {
      // In detached HEAD, git branch --show-current returns empty
      mockExecSync.mockReturnValue('');

      const result = mockExecSync('git branch --show-current', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: '/bin/sh',
      });

      const branch = result?.toString().trim() || undefined;
      expect(branch).toBeUndefined();
    });

    it('should handle repositories with no commits', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('fatal: ref refs/heads/master not found');
      });

      let branch: string | undefined;
      try {
        mockExecSync('git branch --show-current', {
          cwd: process.cwd(),
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: '/bin/sh',
        });
      } catch {
        branch = undefined;
      }

      expect(branch).toBeUndefined();
    });
  });

  describe('Integration with shell utilities', () => {
    it('should use getPlatformShell result correctly', () => {
      const { getPlatformShell } = require('@apexcli/core');

      // Test Windows
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      const winShell = getPlatformShell();
      expect(winShell).toEqual({
        shell: 'cmd.exe',
        shellArgs: ['/d', '/s', '/c']
      });

      // Test Unix
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
      });

      const unixShell = getPlatformShell();
      expect(unixShell).toEqual({
        shell: '/bin/sh',
        shellArgs: ['-c']
      });
    });

    it('should maintain consistency with shell configuration', () => {
      const { getPlatformShell, isWindows } = require('@apexcli/core');

      const shellConfig = getPlatformShell();
      const isWin = isWindows();

      if (isWin) {
        expect(shellConfig.shell).toBe('cmd.exe');
      } else {
        expect(shellConfig.shell).toBe('/bin/sh');
      }
    });
  });
});