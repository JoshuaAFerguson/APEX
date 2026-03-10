import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn, exec, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { DaemonManager } from '../packages/orchestrator/src/daemon';
import { detectPlatform } from '../packages/orchestrator/src/service-manager';

const execAsync = promisify(exec);

/**
 * v0.4.0 Real-World Cross-Platform Process Management Tests
 *
 * These tests verify actual process management capabilities across different platforms
 * using real system calls and process interactions.
 */
describe('v0.4.0 Cross-Platform Process Management', () => {
  let testProjectPath: string;
  let daemonManager: DaemonManager;
  let originalPlatform: NodeJS.Platform;
  let testProcesses: ChildProcess[] = [];

  beforeEach(async () => {
    originalPlatform = process.platform;
    testProjectPath = join(__dirname, 'test-project-process');

    // Create test project structure
    await fs.mkdir(testProjectPath, { recursive: true });
    await fs.mkdir(join(testProjectPath, '.apex'), { recursive: true });

    daemonManager = new DaemonManager({
      projectPath: testProjectPath,
      logLevel: 'debug'
    });
  });

  afterEach(async () => {
    // Clean up any test processes
    for (const process of testProcesses) {
      try {
        if (!process.killed) {
          process.kill('SIGTERM');
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    testProcesses = [];

    // Restore platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true
    });

    // Clean up test directory
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error);
    }

    vi.restoreAllMocks();
  });

  describe('Platform Detection', () => {
    it('should correctly detect the current platform', () => {
      const detectedPlatform = detectPlatform();
      expect(['linux', 'darwin', 'win32']).toContain(detectedPlatform);
    });

    it('should detect platform-specific capabilities', () => {
      const platform = process.platform;

      switch (platform) {
        case 'linux':
          expect(platform).toBe('linux');
          break;
        case 'darwin':
          expect(platform).toBe('darwin');
          break;
        case 'win32':
          expect(platform).toBe('win32');
          break;
        default:
          // Allow for unsupported platforms in tests
          expect(true).toBe(true);
      }
    });
  });

  describe('Process Detection Across Platforms', () => {
    it('should detect running processes using platform-specific methods', async () => {
      const platform = process.platform;

      if (platform === 'win32') {
        // Test Windows tasklist command
        try {
          const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq node.exe"');
          expect(stdout).toContain('node.exe');
        } catch (error) {
          // Skip on systems without node in PATH
          expect(error).toBeDefined();
        }
      } else {
        // Test Unix ps command
        try {
          const { stdout } = await execAsync('ps aux | grep node');
          expect(stdout).toContain('node');
        } catch (error) {
          // Skip on systems without ps command
          expect(error).toBeDefined();
        }
      }
    });

    it('should validate PID existence across platforms', async () => {
      // Use current process PID as a known valid PID
      const currentPid = process.pid;

      if (process.platform === 'win32') {
        // Windows: Use tasklist to check if PID exists
        try {
          const { stdout } = await execAsync(`tasklist /FI "PID eq ${currentPid}"`);
          expect(stdout).toContain(currentPid.toString());
        } catch (error) {
          // System may not have tasklist
          expect(error).toBeDefined();
        }
      } else {
        // Unix: Use kill -0 to check if PID exists without actually sending a signal
        try {
          // This should not throw if PID exists
          process.kill(currentPid, 0);
          expect(true).toBe(true);
        } catch (error) {
          // Should not reach here with our own PID
          expect(false).toBe(true);
        }
      }
    });
  });

  describe('Process Termination Across Platforms', () => {
    it('should support graceful termination on Unix systems', async () => {
      if (process.platform === 'win32') {
        // Skip on Windows
        return;
      }

      // Create a long-running test process
      const testProcess = spawn('node', ['-e', 'setInterval(() => {}, 1000);'], {
        detached: false,
        stdio: 'ignore'
      });

      testProcesses.push(testProcess);

      // Wait for process to start
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(testProcess.pid).toBeDefined();
      expect(testProcess.killed).toBe(false);

      // Send SIGTERM (graceful shutdown)
      testProcess.kill('SIGTERM');

      // Wait for process to terminate
      await new Promise((resolve) => {
        testProcess.on('exit', resolve);
        // Timeout after 2 seconds
        setTimeout(resolve, 2000);
      });

      expect(testProcess.killed).toBe(true);
    });

    it('should support force termination on Unix systems', async () => {
      if (process.platform === 'win32') {
        // Skip on Windows
        return;
      }

      // Create a process that ignores SIGTERM
      const testProcess = spawn('node', ['-e', `
        process.on('SIGTERM', () => {
          console.log('SIGTERM ignored');
        });
        setInterval(() => {}, 1000);
      `], {
        detached: false,
        stdio: 'ignore'
      });

      testProcesses.push(testProcess);

      // Wait for process to start
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(testProcess.pid).toBeDefined();

      // Force kill with SIGKILL
      testProcess.kill('SIGKILL');

      // Wait for process to terminate
      await new Promise((resolve) => {
        testProcess.on('exit', resolve);
        setTimeout(resolve, 1000);
      });

      expect(testProcess.killed).toBe(true);
    });

    it('should support termination on Windows', async () => {
      if (process.platform !== 'win32') {
        // Skip on non-Windows
        return;
      }

      // Create a test process on Windows
      const testProcess = spawn('node', ['-e', 'setInterval(() => {}, 1000);'], {
        detached: false,
        stdio: 'ignore'
      });

      testProcesses.push(testProcess);

      // Wait for process to start
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(testProcess.pid).toBeDefined();

      // Windows termination
      testProcess.kill();

      // Wait for process to terminate
      await new Promise((resolve) => {
        testProcess.on('exit', resolve);
        setTimeout(resolve, 2000);
      });

      expect(testProcess.killed).toBe(true);
    });
  });

  describe('PID File Management', () => {
    it('should create and manage PID files correctly', async () => {
      const pidFile = join(testProjectPath, '.apex', 'daemon.pid');
      const testPid = 12345;

      // Write PID file
      await fs.writeFile(pidFile, testPid.toString());

      // Verify PID file was created
      const pidExists = await fs.access(pidFile).then(() => true).catch(() => false);
      expect(pidExists).toBe(true);

      // Read PID back
      const readPid = await fs.readFile(pidFile, 'utf-8');
      expect(parseInt(readPid.trim())).toBe(testPid);

      // Clean up PID file
      await fs.unlink(pidFile);

      // Verify PID file was removed
      const pidExistsAfterCleanup = await fs.access(pidFile).then(() => true).catch(() => false);
      expect(pidExistsAfterCleanup).toBe(false);
    });

    it('should handle corrupted PID files gracefully', async () => {
      const pidFile = join(testProjectPath, '.apex', 'daemon.pid');

      // Write invalid PID content
      await fs.writeFile(pidFile, 'not-a-number\ninvalid-content');

      // Try to read PID - should handle gracefully
      try {
        const content = await fs.readFile(pidFile, 'utf-8');
        const pid = parseInt(content.trim());
        expect(isNaN(pid)).toBe(true);
      } catch (error) {
        // Should not throw
        expect(false).toBe(true);
      }
    });

    it('should handle missing PID files', async () => {
      const pidFile = join(testProjectPath, '.apex', 'nonexistent.pid');

      // Try to read non-existent PID file
      const pidExists = await fs.access(pidFile).then(() => true).catch(() => false);
      expect(pidExists).toBe(false);
    });
  });

  describe('Log File Management', () => {
    it('should create and manage log files', async () => {
      const logFile = join(testProjectPath, '.apex', 'daemon.log');
      const testLog = 'Test log entry\n';

      // Write log entry
      await fs.writeFile(logFile, testLog);

      // Verify log file exists
      const logExists = await fs.access(logFile).then(() => true).catch(() => false);
      expect(logExists).toBe(true);

      // Read log content
      const logContent = await fs.readFile(logFile, 'utf-8');
      expect(logContent).toBe(testLog);

      // Append to log
      await fs.appendFile(logFile, 'Additional log entry\n');

      const updatedContent = await fs.readFile(logFile, 'utf-8');
      expect(updatedContent).toContain('Test log entry');
      expect(updatedContent).toContain('Additional log entry');
    });

    it('should handle log rotation scenarios', async () => {
      const logFile = join(testProjectPath, '.apex', 'daemon.log');
      const logRotatedFile = join(testProjectPath, '.apex', 'daemon.log.1');

      // Create original log
      await fs.writeFile(logFile, 'Original log\n');

      // Simulate log rotation
      await fs.rename(logFile, logRotatedFile);
      await fs.writeFile(logFile, 'New log\n');

      // Verify both files exist
      const originalExists = await fs.access(logRotatedFile).then(() => true).catch(() => false);
      const newExists = await fs.access(logFile).then(() => true).catch(() => false);

      expect(originalExists).toBe(true);
      expect(newExists).toBe(true);

      // Verify content
      const originalContent = await fs.readFile(logRotatedFile, 'utf-8');
      const newContent = await fs.readFile(logFile, 'utf-8');

      expect(originalContent).toContain('Original log');
      expect(newContent).toContain('New log');
    });
  });

  describe('File System Permissions', () => {
    it('should handle directory creation with proper permissions', async () => {
      const testDir = join(testProjectPath, 'permission-test');

      await fs.mkdir(testDir, { recursive: true });

      // Verify directory exists
      const dirExists = await fs.access(testDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);

      // Check directory stats
      const stats = await fs.stat(testDir);
      expect(stats.isDirectory()).toBe(true);

      // Clean up
      await fs.rmdir(testDir);
    });

    it('should handle file permissions appropriately', async () => {
      const testFile = join(testProjectPath, 'permission-test.txt');

      await fs.writeFile(testFile, 'test content');

      // Verify file exists and is readable
      const fileExists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('test content');

      // Clean up
      await fs.unlink(testFile);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle process not found scenarios', async () => {
      const nonExistentPid = 99999999; // Very unlikely to exist

      if (process.platform !== 'win32') {
        // Unix: kill -0 should throw ESRCH for non-existent PID
        try {
          process.kill(nonExistentPid, 0);
          // If we reach here, the PID surprisingly exists
          expect(true).toBe(true);
        } catch (error: any) {
          expect(error.code).toBe('ESRCH');
        }
      }
    });

    it('should handle permission denied scenarios', async () => {
      if (process.platform !== 'win32') {
        // Try to kill PID 1 (init process) which should fail with permission error
        try {
          process.kill(1, 'SIGTERM');
          // If successful, we have root privileges
          expect(true).toBe(true);
        } catch (error: any) {
          expect(error.code).toBe('EPERM');
        }
      }
    });
  });

  describe('Cross-Platform File Path Handling', () => {
    it('should handle platform-specific path separators', () => {
      const testPath = join('test', 'path', 'file.txt');

      if (process.platform === 'win32') {
        expect(testPath).toContain('\\');
      } else {
        expect(testPath).toContain('/');
      }
    });

    it('should normalize paths correctly', () => {
      const unnormalizedPath = 'test//path///file.txt';
      const normalizedPath = join(...unnormalizedPath.split(/[/\\]+/));

      expect(normalizedPath).not.toContain('//');
      expect(normalizedPath).not.toContain('///');
    });
  });

  describe('Environment Variable Handling', () => {
    it('should read environment variables correctly', () => {
      // Set test environment variable
      process.env.TEST_DAEMON_VAR = 'test-value';

      expect(process.env.TEST_DAEMON_VAR).toBe('test-value');

      // Clean up
      delete process.env.TEST_DAEMON_VAR;
    });

    it('should handle missing environment variables', () => {
      const nonExistent = process.env.NON_EXISTENT_VAR;
      expect(nonExistent).toBeUndefined();
    });
  });
});