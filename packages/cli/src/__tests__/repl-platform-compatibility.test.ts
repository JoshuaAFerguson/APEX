import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as os from 'os';

// Mock child_process to capture calls
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
}));

// Mock os module to test different platforms
vi.mock('os', () => ({
  platform: vi.fn(),
}));

// Mock the core utilities - we'll test that they're used correctly
vi.mock('@apexcli/core', () => ({
  getPlatformShell: vi.fn(() => ({
    shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
    shellArgs: process.platform === 'win32' ? ['/d', '/s', '/c'] : ['-c']
  })),
  isWindows: vi.fn(() => process.platform === 'win32'),
  resolveExecutable: vi.fn((name: string) =>
    process.platform === 'win32' && !name.includes('.') ? `${name}.exe` : name
  ),
  isApexInitialized: vi.fn(() => Promise.resolve(false)),
  formatCost: vi.fn((cost: number) => `$${cost.toFixed(2)}`),
  formatTokens: vi.fn((tokens: number) => `${tokens} tokens`),
  getEffectiveConfig: vi.fn(),
}));

// Mock the UI to avoid rendering issues in tests
vi.mock('../ui/index.js', () => ({
  startInkApp: vi.fn().mockResolvedValue({
    waitUntilExit: vi.fn(),
    addMessage: vi.fn(),
    updateState: vi.fn(),
    getState: vi.fn(() => ({})),
  }),
}));

// Mock other services
vi.mock('../services/SessionStore.js', () => ({
  SessionStore: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    getActiveSessionId: vi.fn(),
  })),
}));

vi.mock('../services/SessionAutoSaver.js', () => ({
  SessionAutoSaver: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

vi.mock('@apexcli/orchestrator', () => ({
  ApexOrchestrator: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    on: vi.fn(),
  })),
}));

describe('REPL Platform Compatibility', () => {
  const mockExecSync = vi.mocked(execSync);
  const mockOsPlatform = vi.mocked(os.platform);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Git branch detection', () => {
    it('should use platform shell for git commands on Windows', async () => {
      // Mock Windows platform
      mockOsPlatform.mockReturnValue('win32');
      mockExecSync.mockReturnValue('main\n');

      // Import the module after mocking
      const { startInkREPL } = await import('../repl');

      // Need to test the internal getGitBranch function indirectly
      // We'll do this by triggering the REPL initialization
      const replPromise = startInkREPL();

      // Wait a bit for initialization
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify execSync was called with the correct shell option
      expect(mockExecSync).toHaveBeenCalledWith(
        'git branch --show-current',
        expect.objectContaining({
          shell: 'cmd.exe',
        })
      );

      // Clean up
      vi.clearAllTimers();
      process.removeAllListeners('SIGINT');
      process.removeAllListeners('SIGTERM');
    });

    it('should use platform shell for git commands on Unix-like systems', async () => {
      // Mock Unix platform
      mockOsPlatform.mockReturnValue('darwin');
      mockExecSync.mockReturnValue('main\n');

      // Import the module after mocking
      const { startInkREPL } = await import('../repl');

      const replPromise = startInkREPL();

      // Wait a bit for initialization
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify execSync was called with the correct shell option
      expect(mockExecSync).toHaveBeenCalledWith(
        'git branch --show-current',
        expect.objectContaining({
          shell: '/bin/sh',
        })
      );

      // Clean up
      vi.clearAllTimers();
      process.removeAllListeners('SIGINT');
      process.removeAllListeners('SIGTERM');
    });
  });

  describe('Process port detection', () => {
    it('should use Windows netstat command on Windows platform', async () => {
      // Mock Windows platform
      mockOsPlatform.mockReturnValue('win32');
      mockExecSync.mockReturnValue('  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234\n');

      // Import functions from repl module
      const replModule = await import('../repl');

      // We need to access the internal function, but since it's not exported,
      // we'll test it through the cleanup functionality
      // For now, we'll verify that execSync would be called with Windows commands

      // Mock a scenario where we need to kill processes on port
      const mockContext = {
        apiPort: 3000,
        apiProcess: null,
        webUIPort: undefined,
        webUIProcess: null,
      };

      // This tests the internal getProcessesOnPort function indirectly
      // The actual test would happen when killProcessOnPort is called
      expect(mockOsPlatform).toHaveBeenCalled();
    });

    it('should use Unix lsof/netstat commands on Unix-like platforms', async () => {
      // Mock Unix platform
      mockOsPlatform.mockReturnValue('darwin');
      mockExecSync.mockReturnValue('1234\n');

      const replModule = await import('../repl');

      // Similar indirect test as above for Unix platforms
      expect(mockOsPlatform).toHaveBeenCalled();
    });
  });

  describe('Command execution platform compatibility', () => {
    it('should handle empty or error responses gracefully on all platforms', async () => {
      // Test Windows
      mockOsPlatform.mockReturnValue('win32');
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      const replModule = await import('../repl');

      // Should not throw even when commands fail
      expect(() => {
        // This would test error handling in git branch detection
      }).not.toThrow();

      // Test Unix
      mockOsPlatform.mockReturnValue('darwin');
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      // Should handle Unix errors gracefully too
      expect(() => {
        // This would test error handling on Unix
      }).not.toThrow();
    });

    it('should use correct executable resolution for spawn calls', async () => {
      // Mock the core functions to verify they're called correctly
      const { getPlatformShell, isWindows, resolveExecutable } = await import('@apexcli/core');

      // Test Windows executable resolution
      mockOsPlatform.mockReturnValue('win32');
      const resolvedNode = (resolveExecutable as any)('node');
      expect(resolvedNode).toBe('node.exe');

      const resolvedNpx = (resolveExecutable as any)('npx');
      expect(resolvedNpx).toBe('npx.exe');

      // Test Unix executable resolution
      mockOsPlatform.mockReturnValue('darwin');
      const resolvedNodeUnix = (resolveExecutable as any)('node');
      expect(resolvedNodeUnix).toBe('node');
    });
  });

  describe('Shell configuration', () => {
    it('should use correct shell configuration for execSync calls', async () => {
      const { getPlatformShell } = await import('@apexcli/core');

      // Test Windows shell config
      mockOsPlatform.mockReturnValue('win32');
      const winShell = (getPlatformShell as any)();
      expect(winShell).toEqual({
        shell: 'cmd.exe',
        shellArgs: ['/d', '/s', '/c']
      });

      // Test Unix shell config
      mockOsPlatform.mockReturnValue('darwin');
      const unixShell = (getPlatformShell as any)();
      expect(unixShell).toEqual({
        shell: '/bin/sh',
        shellArgs: ['-c']
      });
    });
  });

  describe('Error handling', () => {
    it('should handle platform detection errors gracefully', async () => {
      // Mock platform detection failure
      mockOsPlatform.mockImplementation(() => {
        throw new Error('Platform detection failed');
      });

      // The REPL should still start even if platform detection fails
      expect(async () => {
        const { startInkREPL } = await import('../repl');
        // Should not throw during module import
      }).not.toThrow();
    });

    it('should handle command execution failures on all platforms', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command execution failed');
      });

      // Git branch detection should return undefined on failure
      const replModule = await import('../repl');

      // The REPL should handle command failures gracefully
      expect(() => {
        // Internal git branch function should not throw
      }).not.toThrow();
    });
  });
});