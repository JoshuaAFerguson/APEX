import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fork, exec, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { DaemonManager, DaemonError, type DaemonOptions } from './daemon';

// Mock child_process.fork and exec
const mockFork = vi.fn();
const mockExecAsync = vi.fn();
const mockChild = {
  pid: 12345,
  stdout: {
    on: vi.fn(),
  },
  stderr: {
    on: vi.fn(),
  },
  on: vi.fn(),
  unref: vi.fn(),
};

vi.mock('child_process', () => ({
  fork: mockFork,
  exec: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecAsync),
}));

// Mock file system operations
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    mkdir: vi.fn(),
    appendFile: vi.fn(),
  },
}));

/**
 * Windows Compatibility Tests for Daemon Module
 *
 * This test suite covers Windows-specific functionality including:
 * - Process spawning with cmd.exe
 * - Tasklist output parsing for process detection
 * - Taskkill command generation
 * - PID file handling on Windows paths
 * - Process signal handling differences on Windows
 */
describe('Windows Compatibility Tests for Daemon Module', () => {
  const originalPlatform = process.platform;
  const testProjectPath = 'C:\\Users\\test\\project';
  const testPidFile = join(testProjectPath, '.apex', 'daemon.pid');
  const testLogFile = join(testProjectPath, '.apex', 'daemon.log');

  let daemonManager: DaemonManager;
  let options: DaemonOptions;

  beforeEach(() => {
    // Mock Windows platform
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      writable: true,
    });

    // Reset all mocks
    vi.clearAllMocks();
    mockFork.mockReturnValue(mockChild);

    options = {
      projectPath: testProjectPath,
      pidFile: testPidFile,
      logFile: testLogFile,
    };

    daemonManager = new DaemonManager(options);

    // Mock file system operations
    (fs.mkdir as any).mockResolvedValue(undefined);
    (fs.writeFile as any).mockResolvedValue(undefined);
    (fs.unlink as any).mockResolvedValue(undefined);
    (fs.appendFile as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
    vi.resetAllMocks();
  });

  describe('Windows Process Spawning with cmd.exe', () => {
    it('should spawn daemon process with Windows-compatible environment variables', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' }); // No PID file

      const pid = await daemonManager.startDaemon();

      expect(pid).toBe(12345);
      expect(mockFork).toHaveBeenCalledWith(
        expect.stringContaining('daemon-entry.js'),
        [],
        expect.objectContaining({
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
          env: expect.objectContaining({
            APEX_DAEMON_MODE: '1',
            APEX_PROJECT_PATH: testProjectPath,
          }),
        })
      );
    });

    it('should handle Windows path separators in project path environment variable', async () => {
      const windowsProjectPath = 'C:\\Program Files\\MyApp\\project';
      const windowsDaemonManager = new DaemonManager({
        projectPath: windowsProjectPath,
      });

      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      await windowsDaemonManager.startDaemon();

      expect(mockFork).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_PROJECT_PATH: windowsProjectPath,
          }),
        })
      );
    });

    it('should pass Windows-specific daemon configuration through environment', async () => {
      const windowsOptions: DaemonOptions = {
        projectPath: testProjectPath,
        pollIntervalMs: 3000,
        logLevel: 'debug',
        debugMode: true,
      };

      const windowsDaemonManager = new DaemonManager(windowsOptions);
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      await windowsDaemonManager.startDaemon();

      expect(mockFork).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_DAEMON_MODE: '1',
            APEX_PROJECT_PATH: testProjectPath,
            APEX_POLL_INTERVAL: '3000',
            APEX_LOG_LEVEL: 'debug',
            APEX_DAEMON_DEBUG: '1',
          }),
        })
      );
    });

    it('should handle child process creation failure on Windows', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      mockFork.mockImplementation(() => {
        const error = new Error('Failed to spawn process');
        (error as any).code = 'ENOENT';
        throw error;
      });

      await expect(daemonManager.startDaemon()).rejects.toThrow(DaemonError);
      await expect(daemonManager.startDaemon()).rejects.toThrow('Failed to start daemon process');
    });
  });

  describe('Tasklist Output Parsing for Process Detection', () => {
    const createPidFileData = (pid: number) => ({
      pid,
      startedAt: new Date().toISOString(),
      projectPath: testProjectPath,
    });

    it('should correctly parse standard tasklist CSV output', async () => {
      const pidData = createPidFileData(12345);
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      // Standard tasklist CSV output with target process
      const tasklist_output = `"Image Name","PID","Session Name","Session#","Mem Usage"
"System Idle Process","0","Services","0","24 K"
"System","4","Services","0","280 K"
"node.exe","12345","Console","1","50,234 K"
"notepad.exe","6789","Console","1","12,456 K"`;

      mockExecAsync.mockResolvedValue({ stdout: tasklist_output });

      const running = await daemonManager.isDaemonRunning();
      expect(running).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith('tasklist /fi "PID eq 12345" /fo csv');
    });

    it('should handle tasklist output with quoted process names containing commas', async () => {
      const pidData = createPidFileData(9876);
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      // Tasklist output with process names that contain commas
      const tasklist_output = `"Image Name","PID","Session Name","Session#","Mem Usage"
"Google Chrome Helper (GPU)","1234","Console","1","25,000 K"
"Microsoft Office, Excel","5678","Console","1","75,123 K"
"node.exe","9876","Console","1","50,000 K"`;

      mockExecAsync.mockResolvedValue({ stdout: tasklist_output });

      const running = await daemonManager.isDaemonRunning();
      expect(running).toBe(true);
    });

    it('should handle tasklist output with various memory formats', async () => {
      const pidData = createPidFileData(4321);
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      // Test different memory usage formats
      const memory_formats = [
        '"node.exe","4321","Console","1","1,234 K"',
        '"node.exe","4321","Console","1","12,345 K"',
        '"node.exe","4321","Console","1","123,456 K"',
        '"node.exe","4321","Console","1","1,234,567 K"',
        '"node.exe","4321","Console","1","50 K"',
      ];

      for (const format of memory_formats) {
        const output = `"Image Name","PID","Session Name","Session#","Mem Usage"\n${format}`;
        mockExecAsync.mockResolvedValue({ stdout: output });

        const running = await daemonManager.isDaemonRunning();
        expect(running).toBe(true);
      }
    });

    it('should handle empty tasklist output (no matching processes)', async () => {
      const pidData = createPidFileData(99999);
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      // Only header line, no processes found
      const tasklist_output = '"Image Name","PID","Session Name","Session#","Mem Usage"';

      mockExecAsync.mockResolvedValue({ stdout: tasklist_output });

      const running = await daemonManager.isDaemonRunning();
      expect(running).toBe(false);
    });

    it('should handle tasklist output with extra whitespace and empty lines', async () => {
      const pidData = createPidFileData(5555);
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      // Output with whitespace, empty lines, and carriage returns
      const tasklist_output = `

"Image Name","PID","Session Name","Session#","Mem Usage"

"node.exe","5555","Console","1","50,000 K"


      `;

      mockExecAsync.mockResolvedValue({ stdout: tasklist_output });

      const running = await daemonManager.isDaemonRunning();
      expect(running).toBe(true);
    });

    it('should handle malformed tasklist output gracefully', async () => {
      const pidData = createPidFileData(7777);
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      const malformedOutputs = [
        '', // Empty output
        'Error: Access denied', // Error message instead of CSV
        'INFO: No tasks are running which match the specified criteria.', // No processes message
        '{"not": "csv"}', // JSON instead of CSV
        'Image Name,PID,Session Name,Session#,Mem Usage', // Unquoted CSV headers
        '"Incomplete CSV"', // Incomplete CSV
        null as any,
        undefined as any,
      ];

      for (const output of malformedOutputs) {
        mockExecAsync.mockResolvedValue({ stdout: output || '' });

        const running = await daemonManager.isDaemonRunning();
        expect(running).toBe(false); // Should safely handle malformed output
      }
    });

    it('should handle tasklist command execution errors', async () => {
      const pidData = createPidFileData(8888);
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      const errorCases = [
        new Error('Access is denied.'),
        new Error('The system cannot find the file specified.'),
        new Error('Command failed with exit code 1'),
        { code: 'ENOENT', message: 'Command not found' },
        { code: 'EACCES', message: 'Permission denied' },
      ];

      for (const error of errorCases) {
        mockExecAsync.mockRejectedValue(error);

        const running = await daemonManager.isDaemonRunning();
        expect(running).toBe(false); // Errors should be treated as process not found
      }
    });

    it('should handle very large PID values in tasklist output', async () => {
      const largePid = 2147483647; // Max 32-bit signed integer
      const pidData = createPidFileData(largePid);
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      const tasklist_output = `"Image Name","PID","Session Name","Session#","Mem Usage"
"node.exe","${largePid}","Console","1","50,000 K"`;

      mockExecAsync.mockResolvedValue({ stdout: tasklist_output });

      const running = await daemonManager.isDaemonRunning();
      expect(running).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith(`tasklist /fi "PID eq ${largePid}" /fo csv`);
    });
  });

  describe('Taskkill Command Generation', () => {
    const createPidFileData = (pid: number) => ({
      pid,
      startedAt: new Date().toISOString(),
      projectPath: testProjectPath,
    });

    it('should generate correct taskkill command for graceful termination', async () => {
      const pid = 12345;
      const pidData = createPidFileData(pid);
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      // Mock tasklist to show process exists initially
      let processExists = true;
      mockExecAsync.mockImplementation(async (cmd: string) => {
        if (cmd.includes('tasklist')) {
          if (processExists) {
            return { stdout: `"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","${pid}","Console","1","50,000 K"` };
          } else {
            return { stdout: '"Image Name","PID","Session Name","Session#","Mem Usage"' };
          }
        } else if (cmd.includes('taskkill') && !cmd.includes('/f')) {
          // Simulate successful graceful termination
          setTimeout(() => { processExists = false; }, 10);
          return { stdout: `SUCCESS: Sent termination signal to process with PID ${pid}.` };
        }
      });

      const result = await daemonManager.stopDaemon();

      expect(result).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith(`taskkill /pid ${pid}`);
    });

    it('should generate correct taskkill command for force kill', async () => {
      const pid = 54321;
      const pidData = createPidFileData(pid);
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      // Mock tasklist to always show process exists
      mockExecAsync.mockImplementation(async (cmd: string) => {
        if (cmd.includes('tasklist')) {
          return { stdout: `"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","${pid}","Console","1","50,000 K"` };
        } else if (cmd.includes('taskkill /f')) {
          return { stdout: `SUCCESS: The process with PID ${pid} has been terminated.` };
        }
      });

      const result = await daemonManager.killDaemon();

      expect(result).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith(`taskkill /f /pid ${pid}`);
    });

    it('should handle taskkill permission errors', async () => {
      const pid = 11111;
      const pidData = createPidFileData(pid);
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      mockExecAsync.mockImplementation(async (cmd: string) => {
        if (cmd.includes('tasklist')) {
          return { stdout: `"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","${pid}","Console","1","50,000 K"` };
        } else if (cmd.includes('taskkill')) {
          const error = new Error('Access is denied.');
          (error as any).code = 'EACCES';
          throw error;
        }
      });

      await expect(daemonManager.stopDaemon()).rejects.toThrow(DaemonError);
      await expect(daemonManager.killDaemon()).rejects.toThrow(DaemonError);
    });

    it('should handle taskkill process not found errors', async () => {
      const pid = 22222;
      const pidData = createPidFileData(pid);
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      mockExecAsync.mockImplementation(async (cmd: string) => {
        if (cmd.includes('tasklist')) {
          // Process initially exists but disappears
          return { stdout: '"Image Name","PID","Session Name","Session#","Mem Usage"' };
        } else if (cmd.includes('taskkill')) {
          const error = new Error('The process "22222" not found.');
          (error as any).code = 'ESRCH';
          throw error;
        }
      });

      await expect(daemonManager.stopDaemon()).rejects.toThrow(DaemonError);
    });

    it('should handle timeout in graceful termination and fallback to force kill', async () => {
      const pid = 33333;
      const pidData = createPidFileData(pid);
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      let killAttempted = false;
      mockExecAsync.mockImplementation(async (cmd: string) => {
        if (cmd.includes('tasklist')) {
          // Process continues to exist until force killed
          return killAttempted
            ? { stdout: '"Image Name","PID","Session Name","Session#","Mem Usage"' }
            : { stdout: `"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","${pid}","Console","1","50,000 K"` };
        } else if (cmd.includes('taskkill') && !cmd.includes('/f')) {
          // Graceful kill sends signal but process doesn't exit
          return { stdout: `SUCCESS: Sent termination signal to process with PID ${pid}.` };
        } else if (cmd.includes('taskkill /f')) {
          // Force kill succeeds
          killAttempted = true;
          return { stdout: `SUCCESS: The process with PID ${pid} has been terminated.` };
        }
      });

      const result = await daemonManager.stopDaemon();

      expect(result).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith(`taskkill /pid ${pid}`);
      expect(mockExecAsync).toHaveBeenCalledWith(`taskkill /f /pid ${pid}`);
    });
  });

  describe('PID File Handling on Windows Paths', () => {
    it('should handle Windows-style paths with drive letters', async () => {
      const windowsPaths = [
        'C:\\Users\\Administrator\\project',
        'D:\\Projects\\my-app',
        'E:\\Development\\apex-test',
        'F:\\Program Files\\MyApp',
      ];

      for (const windowsPath of windowsPaths) {
        const windowsDaemon = new DaemonManager({ projectPath: windowsPath });
        const expectedPidFile = join(windowsPath, '.apex', 'daemon.pid');

        (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' }); // No PID file initially

        await windowsDaemon.startDaemon();

        expect(fs.writeFile).toHaveBeenCalledWith(
          expectedPidFile,
          expect.any(String),
          'utf-8'
        );
      }
    });

    it('should handle Windows paths with spaces and special characters', async () => {
      const specialPaths = [
        'C:\\Program Files\\My Application',
        'C:\\Users\\John Doe\\Documents\\Projects',
        'D:\\My Projects (Personal)',
        'C:\\Projects\\[Development]\\apex',
        'C:\\Users\\user@domain\\project',
      ];

      for (const specialPath of specialPaths) {
        const windowsDaemon = new DaemonManager({ projectPath: specialPath });

        (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

        await windowsDaemon.startDaemon();

        const expectedPidFile = join(specialPath, '.apex', 'daemon.pid');
        expect(fs.writeFile).toHaveBeenCalledWith(
          expectedPidFile,
          expect.any(String),
          'utf-8'
        );
      }
    });

    it('should create .apex directory with Windows permissions', async () => {
      const windowsProjectPath = 'C:\\Windows\\Temp\\apex-test';
      const windowsDaemon = new DaemonManager({ projectPath: windowsProjectPath });

      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      await windowsDaemon.startDaemon();

      expect(fs.mkdir).toHaveBeenCalledWith(
        join(windowsProjectPath, '.apex'),
        { recursive: true }
      );
    });

    it('should handle Windows file path errors (UNC paths, invalid characters)', async () => {
      const invalidPaths = [
        '\\\\invalid\\unc\\path',
        'C:\\path\\with\\invalid|chars',
        'CON:', // Reserved name
        'PRN:', // Reserved name
      ];

      for (const invalidPath of invalidPaths) {
        const windowsDaemon = new DaemonManager({ projectPath: invalidPath });

        (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
        (fs.mkdir as any).mockRejectedValue({ code: 'ENOENT', message: 'The system cannot find the path specified.' });

        await expect(windowsDaemon.startDaemon()).rejects.toThrow(DaemonError);
      }
    });

    it('should read and write PID file with Windows line endings', async () => {
      const windowsProjectPath = 'C:\\test\\project';
      const windowsDaemon = new DaemonManager({ projectPath: windowsProjectPath });

      // Test PID file write
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      const startTime = Date.now();
      await windowsDaemon.startDaemon();

      // Verify PID file structure
      const writeCall = (fs.writeFile as any).mock.calls.find(
        call => call[0].includes('daemon.pid')
      );
      expect(writeCall).toBeDefined();

      const pidData = JSON.parse(writeCall[1]);
      expect(pidData.pid).toBe(12345);
      expect(pidData.projectPath).toBe(windowsProjectPath);
      expect(new Date(pidData.startedAt).getTime()).toBeGreaterThanOrEqual(startTime);

      // Test PID file read
      (fs.readFile as any).mockResolvedValue(writeCall[1]);

      const status = await windowsDaemon.getStatus();
      expect(status.running).toBe(true);
      expect(status.pid).toBe(12345);
    });

    it('should handle PID file locking on Windows', async () => {
      const windowsProjectPath = 'C:\\locked\\project';
      const windowsDaemon = new DaemonManager({ projectPath: windowsProjectPath });

      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      (fs.writeFile as any).mockRejectedValue({
        code: 'EBUSY',
        message: 'The process cannot access the file because it is being used by another process.'
      });

      await expect(windowsDaemon.startDaemon()).rejects.toThrow(DaemonError);
      await expect(windowsDaemon.startDaemon()).rejects.toThrow('Failed to write PID file');
    });
  });

  describe('Process Signal Handling Differences on Windows', () => {
    it('should not attempt to send POSIX signals on Windows', async () => {
      const pid = 44444;
      const pidData = {
        pid,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      // Mock process.kill to track what signals are sent
      const mockProcessKill = vi.fn();
      const originalKill = process.kill;
      process.kill = mockProcessKill;

      try {
        // Mock tasklist and taskkill to simulate successful operation
        mockExecAsync.mockImplementation(async (cmd: string) => {
          if (cmd.includes('tasklist')) {
            return { stdout: `"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","${pid}","Console","1","50,000 K"` };
          } else if (cmd.includes('taskkill')) {
            return { stdout: `SUCCESS: The process with PID ${pid} has been terminated.` };
          }
        });

        await daemonManager.stopDaemon();

        // Verify that process.kill was never called (Windows uses taskkill instead)
        expect(mockProcessKill).not.toHaveBeenCalled();
        expect(mockExecAsync).toHaveBeenCalledWith(`taskkill /pid ${pid}`);

      } finally {
        process.kill = originalKill;
      }
    });

    it('should handle Windows-specific process termination patterns', async () => {
      const pid = 55555;
      const pidData = {
        pid,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      // Simulate Windows process termination scenarios
      const terminationScenarios = [
        {
          name: 'Clean termination',
          taskkillResponse: `SUCCESS: Sent termination signal to process with PID ${pid}.`,
          expectSuccess: true,
        },
        {
          name: 'Force termination',
          taskkillResponse: `SUCCESS: The process with PID ${pid} has been terminated.`,
          expectSuccess: true,
        },
        {
          name: 'Access denied',
          error: new Error('Access is denied.'),
          expectSuccess: false,
        },
        {
          name: 'Process not found',
          error: new Error(`The process "${pid}" not found.`),
          expectSuccess: false,
        },
      ];

      for (const scenario of terminationScenarios) {
        mockExecAsync.mockReset();

        mockExecAsync.mockImplementation(async (cmd: string) => {
          if (cmd.includes('tasklist')) {
            return { stdout: `"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","${pid}","Console","1","50,000 K"` };
          } else if (cmd.includes('taskkill')) {
            if (scenario.error) {
              throw scenario.error;
            } else {
              return { stdout: scenario.taskkillResponse };
            }
          }
        });

        if (scenario.expectSuccess) {
          const result = await daemonManager.stopDaemon();
          expect(result).toBe(true);
        } else {
          await expect(daemonManager.stopDaemon()).rejects.toThrow(DaemonError);
        }
      }
    });

    it('should handle Windows process tree termination', async () => {
      const pid = 66666;
      const pidData = {
        pid,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      // Test termination of process trees (parent-child relationships on Windows)
      mockExecAsync.mockImplementation(async (cmd: string) => {
        if (cmd.includes('tasklist')) {
          // Simulate parent process with children
          return {
            stdout: `"Image Name","PID","Session Name","Session#","Mem Usage"
"node.exe","${pid}","Console","1","50,000 K"
"node.exe","${pid + 1}","Console","1","25,000 K"
"node.exe","${pid + 2}","Console","1","30,000 K"`
          };
        } else if (cmd.includes('taskkill')) {
          if (cmd.includes('/t')) {
            // Tree termination
            return { stdout: `SUCCESS: The process tree with PID ${pid} has been terminated.` };
          } else {
            // Single process termination
            return { stdout: `SUCCESS: The process with PID ${pid} has been terminated.` };
          }
        }
      });

      const result = await daemonManager.stopDaemon();
      expect(result).toBe(true);

      // Should use single process termination by default
      expect(mockExecAsync).toHaveBeenCalledWith(`taskkill /pid ${pid}`);
    });

    it('should handle Windows service vs console application differences', async () => {
      const servicePid = 77777;
      const consolePid = 88888;

      // Test service-like process (runs in Services session)
      const servicePidData = {
        pid: servicePid,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };

      (fs.readFile as any).mockResolvedValue(JSON.stringify(servicePidData));

      mockExecAsync.mockImplementation(async (cmd: string) => {
        if (cmd.includes('tasklist') && cmd.includes(servicePid.toString())) {
          return { stdout: `"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","${servicePid}","Services","0","50,000 K"` };
        } else if (cmd.includes('tasklist') && cmd.includes(consolePid.toString())) {
          return { stdout: `"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","${consolePid}","Console","1","50,000 K"` };
        } else if (cmd.includes('taskkill')) {
          const pid = cmd.includes(servicePid.toString()) ? servicePid : consolePid;
          return { stdout: `SUCCESS: The process with PID ${pid} has been terminated.` };
        }
      });

      // Test service process detection
      let result = await daemonManager.isDaemonRunning();
      expect(result).toBe(true);

      // Test console process detection
      const consolePidData = {
        pid: consolePid,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(consolePidData));

      result = await daemonManager.isDaemonRunning();
      expect(result).toBe(true);
    });
  });

  describe('Windows Integration Edge Cases', () => {
    it('should handle Windows system locale affecting command output', async () => {
      const pid = 99999;
      const pidData = {
        pid,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      // Test different locale-specific outputs
      const localeOutputs = [
        // English (US)
        '"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","99999","Console","1","50,000 K"',
        // German (spaces in numbers)
        '"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","99999","Console","1","50 000 K"',
        // French (comma as decimal separator)
        '"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","99999","Console","1","50,000 K"',
      ];

      for (const output of localeOutputs) {
        mockExecAsync.mockResolvedValue({ stdout: output });

        const result = await daemonManager.isDaemonRunning();
        expect(result).toBe(true);
      }
    });

    it('should handle Windows UAC and elevation scenarios', async () => {
      const pid = 11111;
      const pidData = {
        pid,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      // Simulate elevated process detection and termination
      mockExecAsync.mockImplementation(async (cmd: string) => {
        if (cmd.includes('tasklist')) {
          return { stdout: `"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","${pid}","Console","1","50,000 K"` };
        } else if (cmd.includes('taskkill')) {
          // Simulate UAC prompt or elevation requirement
          const error = new Error('You do not have sufficient privilege to perform this operation.');
          (error as any).code = 'EACCES';
          throw error;
        }
      });

      await expect(daemonManager.stopDaemon()).rejects.toThrow(DaemonError);
      expect(mockExecAsync).toHaveBeenCalledWith(`taskkill /pid ${pid}`);
    });

    it('should handle Windows long path names (over 260 characters)', async () => {
      // Create a very long Windows path
      const longPath = 'C:\\' + 'very-long-directory-name-'.repeat(10) + 'project';
      const longPathDaemon = new DaemonManager({ projectPath: longPath });

      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      await longPathDaemon.startDaemon();

      // Should handle long paths gracefully
      expect(mockFork).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_PROJECT_PATH: longPath,
          }),
        })
      );
    });

    it('should handle Windows file system case sensitivity', async () => {
      const mixedCasePath = 'C:\\Users\\TestUser\\MyProject';
      const lowerCasePath = 'c:\\users\\testuser\\myproject';

      // Windows file system is case-insensitive, so both should work
      const mixedCaseDaemon = new DaemonManager({ projectPath: mixedCasePath });
      const lowerCaseDaemon = new DaemonManager({ projectPath: lowerCasePath });

      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      await mixedCaseDaemon.startDaemon();
      mockFork.mockClear();

      await lowerCaseDaemon.startDaemon();

      // Both should successfully start
      expect(mockFork).toHaveBeenCalledTimes(2);
    });
  });
});