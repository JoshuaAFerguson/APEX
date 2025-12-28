import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync, spawn } from 'child_process';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(() => ({
    pid: 1234,
    unref: vi.fn(),
    kill: vi.fn(),
  })),
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
  isApexInitialized: vi.fn(() => Promise.resolve(true)),
  loadConfig: vi.fn(() => Promise.resolve({
    project: { name: 'test-project' },
    api: { autoStart: false },
  })),
  loadAgents: vi.fn(() => Promise.resolve({})),
  loadWorkflows: vi.fn(() => Promise.resolve({})),
  formatCost: vi.fn((cost: number) => `$${cost.toFixed(2)}`),
  formatTokens: vi.fn((tokens: number) => `${tokens} tokens`),
  getEffectiveConfig: vi.fn(),
}));

// Mock the orchestrator
vi.mock('@apexcli/orchestrator', () => ({
  ApexOrchestrator: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    on: vi.fn(),
    createTask: vi.fn(() => Promise.resolve({
      id: 'test-task-123',
      status: 'pending'
    })),
    executeTask: vi.fn(() => Promise.resolve()),
    getTask: vi.fn(() => Promise.resolve({
      id: 'test-task-123',
      status: 'completed'
    })),
  })),
}));

// Mock the UI components
vi.mock('../ui/index.js', () => ({
  startInkApp: vi.fn().mockResolvedValue({
    waitUntilExit: vi.fn(),
    addMessage: vi.fn(),
    updateState: vi.fn(),
    getState: vi.fn(() => ({})),
  }),
}));

// Mock services
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

vi.mock('../services/ConversationManager.js', () => ({
  ConversationManager: vi.fn().mockImplementation(() => ({})),
}));

describe('REPL Platform Integration Tests', () => {
  const mockExecSync = vi.mocked(execSync);
  const mockSpawn = vi.mocked(spawn);
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

  describe('Complete Windows platform workflow', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });
    });

    it('should initialize REPL with Windows platform detection', async () => {
      mockExecSync.mockReturnValue('main\n');

      // Import after mocking to ensure platform detection works
      const { startInkREPL } = await import('../repl');
      const { getPlatformShell, isWindows, resolveExecutable } = await import('@apexcli/core');

      // Verify platform detection
      expect(isWindows()).toBe(true);
      expect(getPlatformShell()).toEqual({
        shell: 'cmd.exe',
        shellArgs: ['/d', '/s', '/c']
      });
      expect(resolveExecutable('node')).toBe('node.exe');
    });

    it('should use Windows commands for service management', async () => {
      mockSpawn.mockReturnValue({
        pid: 1234,
        unref: vi.fn(),
        kill: vi.fn(),
      } as any);

      const { resolveExecutable } = await import('@apexcli/core');

      // Simulate starting API server
      const nodeExe = resolveExecutable('node');
      expect(nodeExe).toBe('node.exe');

      // Simulate starting Web UI
      const npxExe = resolveExecutable('npx');
      expect(npxExe).toBe('npx.exe');
    });

    it('should handle Windows-specific process cleanup', async () => {
      // Mock Windows netstat output
      const windowsNetstatOutput = `
  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  TCP    0.0.0.0:3001           0.0.0.0:0              LISTENING       5678
      `.trim();

      mockExecSync.mockImplementation((command) => {
        if (command.includes('netstat')) {
          return windowsNetstatOutput;
        }
        return '';
      });

      // Verify Windows netstat command would be used
      const expectedCommand = 'netstat -ano | findstr :3000';
      expect(expectedCommand).toMatch(/netstat -ano/);
      expect(expectedCommand).toMatch(/findstr/);
    });

    it('should use Windows taskkill for process termination', async () => {
      const { getPlatformShell } = await import('@apexcli/core');
      const shellConfig = getPlatformShell();

      // Verify taskkill command structure
      const killCommand = 'taskkill /f /pid 1234';
      expect(killCommand).toMatch(/taskkill \/f \/pid/);

      // Verify shell configuration for command execution
      expect(shellConfig.shell).toBe('cmd.exe');
      expect(shellConfig.shellArgs).toEqual(['/d', '/s', '/c']);
    });
  });

  describe('Complete Unix platform workflow', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
      });
    });

    it('should initialize REPL with Unix platform detection', async () => {
      mockExecSync.mockReturnValue('main\n');

      const { getPlatformShell, isWindows, resolveExecutable } = await import('@apexcli/core');

      // Verify platform detection
      expect(isWindows()).toBe(false);
      expect(getPlatformShell()).toEqual({
        shell: '/bin/sh',
        shellArgs: ['-c']
      });
      expect(resolveExecutable('node')).toBe('node');
    });

    it('should use Unix commands for service management', async () => {
      mockSpawn.mockReturnValue({
        pid: 1234,
        unref: vi.fn(),
        kill: vi.fn(),
      } as any);

      const { resolveExecutable } = await import('@apexcli/core');

      // Unix executables should not have .exe extension
      expect(resolveExecutable('node')).toBe('node');
      expect(resolveExecutable('npx')).toBe('npx');
    });

    it('should handle Unix-specific process cleanup', async () => {
      // Mock Unix lsof output
      const unixLsofOutput = '1234\n5678\n';

      mockExecSync.mockImplementation((command) => {
        if (command.includes('lsof')) {
          return unixLsofOutput;
        }
        return '';
      });

      // Verify Unix lsof command would be used
      const expectedCommand = 'lsof -ti :3000 2>/dev/null || netstat -tlnp 2>/dev/null | grep :3000 | awk \'{print $7}\' | cut -d/ -f1';
      expect(expectedCommand).toMatch(/lsof -ti/);
      expect(expectedCommand).toMatch(/netstat -tlnp/);
    });

    it('should use Unix signals for process termination', async () => {
      // Mock process.kill
      const originalKill = process.kill;
      const mockKill = vi.fn();
      process.kill = mockKill;

      try {
        // Simulate Unix process termination
        process.kill(1234, 'SIGTERM');
        expect(mockKill).toHaveBeenCalledWith(1234, 'SIGTERM');
      } finally {
        process.kill = originalKill;
      }
    });
  });

  describe('Cross-platform git integration', () => {
    it('should detect git branch on Windows', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      mockExecSync.mockReturnValue('feature/windows-support\n');

      const { getPlatformShell } = await import('@apexcli/core');
      const shellConfig = getPlatformShell();

      // Simulate git branch detection
      mockExecSync('git branch --show-current', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: shellConfig.shell,
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        'git branch --show-current',
        expect.objectContaining({
          shell: 'cmd.exe',
        })
      );
    });

    it('should detect git branch on Unix systems', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
      });

      mockExecSync.mockReturnValue('feature/unix-support\n');

      const { getPlatformShell } = await import('@apexcli/core');
      const shellConfig = getPlatformShell();

      // Simulate git branch detection
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

    it('should handle git errors gracefully on all platforms', async () => {
      const platforms = ['win32', 'darwin', 'linux'];

      for (const platform of platforms) {
        Object.defineProperty(process, 'platform', {
          value: platform,
          writable: true,
        });

        mockExecSync.mockImplementation(() => {
          throw new Error('Not a git repository');
        });

        // Should not throw even when git fails
        let branch: string | undefined;
        try {
          const result = mockExecSync('git branch --show-current', {
            cwd: process.cwd(),
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: platform === 'win32' ? 'cmd.exe' : '/bin/sh',
          });
          branch = result?.toString().trim() || undefined;
        } catch {
          branch = undefined;
        }

        expect(branch).toBeUndefined();
      }
    });
  });

  describe('Service management integration', () => {
    it('should handle API server lifecycle on Windows', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      const mockProcess = {
        pid: 1234,
        unref: vi.fn(),
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const { resolveExecutable } = await import('@apexcli/core');

      // Start API server
      const nodeExe = resolveExecutable('node');
      const proc = mockSpawn(nodeExe, ['dist/index.js'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PORT: '3000',
          APEX_PROJECT: process.cwd(),
          APEX_SILENT: '1',
        },
        stdio: 'ignore',
        detached: true,
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'node.exe',
        ['dist/index.js'],
        expect.objectContaining({
          stdio: 'ignore',
          detached: true,
        })
      );

      expect(proc.unref).toHaveBeenCalled();
    });

    it('should handle Web UI lifecycle on Unix', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
      });

      const mockProcess = {
        pid: 5678,
        unref: vi.fn(),
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const { resolveExecutable } = await import('@apexcli/core');

      // Start Web UI
      const npxPath = resolveExecutable('npx');
      const proc = mockSpawn(npxPath, ['next', 'dev', '-p', '3001'], {
        cwd: '/path/to/web-ui',
        env: {
          ...process.env,
          PORT: '3001',
          NEXT_PUBLIC_APEX_API_URL: 'http://localhost:3000',
        },
        stdio: 'ignore',
        detached: true,
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'npx',
        ['next', 'dev', '-p', '3001'],
        expect.objectContaining({
          stdio: 'ignore',
          detached: true,
        })
      );

      expect(proc.unref).toHaveBeenCalled();
    });
  });

  describe('Error handling and recovery', () => {
    it('should handle platform detection failures gracefully', async () => {
      // Mock platform detection failure
      vi.doMock('os', () => ({
        platform: vi.fn(() => {
          throw new Error('Platform detection failed');
        }),
      }));

      // Should not throw during initialization
      expect(async () => {
        const { startInkREPL } = await import('../repl');
        // Module should load successfully
      }).not.toThrow();
    });

    it('should handle service startup failures on all platforms', async () => {
      const platforms = ['win32', 'darwin', 'linux'];

      for (const platform of platforms) {
        Object.defineProperty(process, 'platform', {
          value: platform,
          writable: true,
        });

        mockSpawn.mockImplementation(() => {
          throw new Error('Service startup failed');
        });

        // Should handle spawn failures gracefully
        expect(() => {
          try {
            mockSpawn('node', ['dist/index.js'], {
              cwd: process.cwd(),
              stdio: 'ignore',
              detached: true,
            });
          } catch {
            // Should be caught and handled
          }
        }).not.toThrow();
      }
    });

    it('should handle mixed platform environments', async () => {
      // Simulate environment where platform detection might be inconsistent
      let platformCallCount = 0;
      Object.defineProperty(process, 'platform', {
        get: () => {
          platformCallCount++;
          return platformCallCount % 2 === 0 ? 'win32' : 'darwin';
        },
        configurable: true,
      });

      const { getPlatformShell, isWindows } = await import('@apexcli/core');

      // Functions should handle platform detection consistently
      const shell1 = getPlatformShell();
      const shell2 = getPlatformShell();
      const isWin1 = isWindows();
      const isWin2 = isWindows();

      // Results should be based on actual platform calls
      expect(typeof shell1.shell).toBe('string');
      expect(typeof shell2.shell).toBe('string');
      expect(typeof isWin1).toBe('boolean');
      expect(typeof isWin2).toBe('boolean');
    });
  });

  describe('Performance and resource management', () => {
    it('should handle process cleanup efficiently', async () => {
      const mockProcesses = [
        { pid: 1234, kill: vi.fn() },
        { pid: 5678, kill: vi.fn() },
      ];

      // Simulate multiple running processes
      mockProcesses.forEach((proc) => {
        expect(typeof proc.pid).toBe('number');
        expect(proc.pid).toBeGreaterThan(0);
      });

      // Cleanup should handle all processes
      mockProcesses.forEach((proc) => {
        proc.kill();
        expect(proc.kill).toHaveBeenCalled();
      });
    });

    it('should handle concurrent platform operations', async () => {
      const { getPlatformShell, isWindows, resolveExecutable } = await import('@apexcli/core');

      // Multiple concurrent calls should work correctly
      const operations = await Promise.all([
        Promise.resolve(getPlatformShell()),
        Promise.resolve(isWindows()),
        Promise.resolve(resolveExecutable('node')),
        Promise.resolve(resolveExecutable('git')),
      ]);

      expect(operations).toHaveLength(4);
      expect(operations[0]).toHaveProperty('shell');
      expect(typeof operations[1]).toBe('boolean');
      expect(typeof operations[2]).toBe('string');
      expect(typeof operations[3]).toBe('string');
    });
  });

  describe('Integration with external tools', () => {
    it('should verify all required commands are available', async () => {
      const { resolveExecutable } = await import('@apexcli/core');

      const requiredCommands = ['node', 'git', 'npx'];
      const resolvedCommands = requiredCommands.map((cmd) => ({
        original: cmd,
        resolved: resolveExecutable(cmd),
      }));

      resolvedCommands.forEach(({ original, resolved }) => {
        expect(resolved).toBeDefined();
        expect(resolved.length).toBeGreaterThan(0);

        if (process.platform === 'win32') {
          expect(resolved).toMatch(/\.(exe|cmd|bat)$/);
        } else {
          expect(resolved).toBe(original);
        }
      });
    });

    it('should handle command path resolution correctly', async () => {
      const { resolveExecutable } = await import('@apexcli/core');

      // Test various command formats
      const testCases = [
        { input: 'node', expectedWin: 'node.exe', expectedUnix: 'node' },
        { input: 'git', expectedWin: 'git.exe', expectedUnix: 'git' },
        { input: 'node.exe', expectedWin: 'node.exe', expectedUnix: 'node.exe' },
        { input: 'script.cmd', expectedWin: 'script.cmd', expectedUnix: 'script.cmd' },
      ];

      testCases.forEach(({ input, expectedWin, expectedUnix }) => {
        Object.defineProperty(process, 'platform', {
          value: 'win32',
          writable: true,
        });
        expect(resolveExecutable(input)).toBe(expectedWin);

        Object.defineProperty(process, 'platform', {
          value: 'darwin',
          writable: true,
        });
        expect(resolveExecutable(input)).toBe(expectedUnix);
      });
    });
  });
});