import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleDaemonLogs } from '../daemon-handlers';
import fs, { createReadStream } from 'fs';
import path from 'path';
import { createInterface } from 'readline';

/**
 * Cross-platform file watching tests for daemon log functionality
 * These tests verify that the replacement of Unix-only `tail -f` commands
 * works correctly on Windows, macOS, and Linux platforms.
 */

// Mock all external dependencies
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
  createReadStream: vi.fn(),
  watch: vi.fn(),
}));

vi.mock('path', () => ({
  join: vi.fn((...args) => args.join(process.platform === 'win32' ? '\\' : '/')),
}));

vi.mock('readline', () => ({
  createInterface: vi.fn(),
}));

// Mock chalk to remove color codes
vi.mock('chalk', () => ({
  default: {
    red: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    cyan: (str: string) => str,
    gray: (str: string) => str,
    white: (str: string) => str,
  },
}));

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);
const mockCreateInterface = vi.mocked(createInterface);

describe('Daemon Logs Cross-Platform File Watching', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let originalPlatform: string;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    originalPlatform = process.platform;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    });
  });

  describe('Windows Platform Compatibility', () => {
    beforeEach(() => {
      // Mock Windows platform
      Object.defineProperty(process, 'platform', {
        value: 'win32',
      });
    });

    it('should handle Windows-style paths correctly', async () => {
      const windowsCtx = { cwd: 'C:\\Users\\test\\project', initialized: true };
      const logContent = '[2023-10-15T10:00:00.000Z] INFO  Windows log entry';

      mockPath.join.mockImplementation((...args) => args.join('\\'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(logContent);

      await handleDaemonLogs(windowsCtx, []);

      expect(mockPath.join).toHaveBeenCalledWith('C:\\Users\\test\\project', '.apex', 'daemon.log');
      expect(mockFs.existsSync).toHaveBeenCalledWith('C:\\Users\\test\\project\\.apex\\daemon.log');
      expect(mockFs.readFileSync).toHaveBeenCalledWith('C:\\Users\\test\\project\\.apex\\daemon.log', 'utf-8');
      expect(consoleSpy).toHaveBeenCalledWith('[2023-10-15T10:00:00.000Z] INFO  Windows log entry');
    });

    it('should use fs.watch() instead of tail command on Windows', async () => {
      const windowsCtx = { cwd: 'C:\\Windows\\project', initialized: true };
      const mockWatcher = {
        close: vi.fn(),
        on: vi.fn(),
      };

      mockPath.join.mockImplementation((...args) => args.join('\\'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 100 } as any);
      mockFs.readFileSync.mockReturnValue('[2023-10-15T10:00:00.000Z] INFO  Initial entry');
      mockFs.watch.mockReturnValue(mockWatcher as any);

      // Mock process.on to avoid actual signal handling
      const originalProcessOn = process.on;
      const mockProcessOn = vi.fn();
      process.on = mockProcessOn;

      const followPromise = handleDaemonLogs(windowsCtx, ['--follow']);

      // Allow time for setup
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockFs.watch).toHaveBeenCalledWith('C:\\Windows\\project\\.apex\\daemon.log', expect.any(Function));
      expect(consoleSpy).toHaveBeenCalledWith('Following daemon logs (C:\\Windows\\project\\.apex\\daemon.log)');

      // Restore original process.on
      process.on = originalProcessOn;
    });

    it('should handle Windows file locking scenarios', async () => {
      const windowsCtx = { cwd: 'C:\\Program Files\\app', initialized: true };
      const mockWatcher = {
        close: vi.fn(),
        on: vi.fn(),
      };

      mockPath.join.mockImplementation((...args) => args.join('\\'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('[2023-10-15T10:00:00.000Z] INFO  Locked file');

      // Simulate file locked scenario where stat fails
      mockFs.statSync.mockImplementation(() => {
        throw new Error('EBUSY: resource busy or locked');
      });

      mockFs.watch.mockImplementation((path, callback) => {
        setTimeout(() => callback('change'), 5);
        return mockWatcher as any;
      });

      // Mock process.on to avoid actual signal handling
      const originalProcessOn = process.on;
      const mockProcessOn = vi.fn();
      process.on = mockProcessOn;

      const followPromise = handleDaemonLogs(windowsCtx, ['--follow']);

      // Allow time for setup and change event
      await new Promise(resolve => setTimeout(resolve, 20));

      // Should handle file locking gracefully
      expect(consoleSpy).toHaveBeenCalledWith('[2023-10-15T10:00:00.000Z] INFO  Locked file');

      // Restore original process.on
      process.on = originalProcessOn;
    });

    it('should handle PowerShell-style line endings (CRLF)', async () => {
      const windowsCtx = { cwd: 'C:\\test\\project', initialized: true };
      // Windows typically uses CRLF line endings
      const logContent = '[2023-10-15T10:00:00.000Z] INFO  Line 1\r\n[2023-10-15T10:01:00.000Z] WARN  Line 2\r\n';

      mockPath.join.mockImplementation((...args) => args.join('\\'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(logContent);

      await handleDaemonLogs(windowsCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith('[2023-10-15T10:00:00.000Z] INFO  Line 1');
      expect(consoleSpy).toHaveBeenCalledWith('[2023-10-15T10:01:00.000Z] WARN  Line 2');
    });

    it('should handle Windows UNC paths', async () => {
      const uncCtx = { cwd: '\\\\server\\share\\project', initialized: true };
      const logContent = '[2023-10-15T10:00:00.000Z] INFO  UNC path log';

      mockPath.join.mockImplementation((...args) => args.join('\\'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(logContent);

      await handleDaemonLogs(uncCtx, []);

      expect(mockPath.join).toHaveBeenCalledWith('\\\\server\\share\\project', '.apex', 'daemon.log');
      expect(mockFs.existsSync).toHaveBeenCalledWith('\\\\server\\share\\project\\.apex\\daemon.log');
      expect(consoleSpy).toHaveBeenCalledWith('[2023-10-15T10:00:00.000Z] INFO  UNC path log');
    });
  });

  describe('macOS Platform Compatibility', () => {
    beforeEach(() => {
      // Mock macOS platform
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
      });
    });

    it('should handle macOS paths correctly', async () => {
      const macCtx = { cwd: '/Users/test/project', initialized: true };
      const logContent = '[2023-10-15T10:00:00.000Z] INFO  macOS log entry';

      mockPath.join.mockImplementation((...args) => args.join('/'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(logContent);

      await handleDaemonLogs(macCtx, []);

      expect(mockPath.join).toHaveBeenCalledWith('/Users/test/project', '.apex', 'daemon.log');
      expect(mockFs.existsSync).toHaveBeenCalledWith('/Users/test/project/.apex/daemon.log');
      expect(consoleSpy).toHaveBeenCalledWith('[2023-10-15T10:00:00.000Z] INFO  macOS log entry');
    });

    it('should use fs.watch() instead of tail command on macOS', async () => {
      const macCtx = { cwd: '/Users/developer/app', initialized: true };
      const mockWatcher = {
        close: vi.fn(),
        on: vi.fn(),
      };

      mockPath.join.mockImplementation((...args) => args.join('/'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 50 } as any);
      mockFs.readFileSync.mockReturnValue('[2023-10-15T10:00:00.000Z] INFO  Initial');
      mockFs.watch.mockReturnValue(mockWatcher as any);

      // Mock process.on to avoid actual signal handling
      const originalProcessOn = process.on;
      const mockProcessOn = vi.fn();
      process.on = mockProcessOn;

      const followPromise = handleDaemonLogs(macCtx, ['--follow']);

      // Allow time for setup
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockFs.watch).toHaveBeenCalledWith('/Users/developer/app/.apex/daemon.log', expect.any(Function));

      // Restore original process.on
      process.on = originalProcessOn;
    });
  });

  describe('Linux Platform Compatibility', () => {
    beforeEach(() => {
      // Mock Linux platform
      Object.defineProperty(process, 'platform', {
        value: 'linux',
      });
    });

    it('should handle Linux paths correctly', async () => {
      const linuxCtx = { cwd: '/home/user/project', initialized: true };
      const logContent = '[2023-10-15T10:00:00.000Z] INFO  Linux log entry';

      mockPath.join.mockImplementation((...args) => args.join('/'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(logContent);

      await handleDaemonLogs(linuxCtx, []);

      expect(mockPath.join).toHaveBeenCalledWith('/home/user/project', '.apex', 'daemon.log');
      expect(mockFs.existsSync).toHaveBeenCalledWith('/home/user/project/.apex/daemon.log');
      expect(consoleSpy).toHaveBeenCalledWith('[2023-10-15T10:00:00.000Z] INFO  Linux log entry');
    });

    it('should use fs.watch() instead of tail command on Linux', async () => {
      const linuxCtx = { cwd: '/opt/myapp', initialized: true };
      const mockWatcher = {
        close: vi.fn(),
        on: vi.fn(),
      };

      mockPath.join.mockImplementation((...args) => args.join('/'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 75 } as any);
      mockFs.readFileSync.mockReturnValue('[2023-10-15T10:00:00.000Z] INFO  Initial');
      mockFs.watch.mockReturnValue(mockWatcher as any);

      // Mock process.on to avoid actual signal handling
      const originalProcessOn = process.on;
      const mockProcessOn = vi.fn();
      process.on = mockProcessOn;

      const followPromise = handleDaemonLogs(linuxCtx, ['--follow']);

      // Allow time for setup
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockFs.watch).toHaveBeenCalledWith('/opt/myapp/.apex/daemon.log', expect.any(Function));

      // Restore original process.on
      process.on = originalProcessOn;
    });
  });

  describe('Cross-Platform File Operations', () => {
    it('should handle file size tracking correctly across platforms', async () => {
      const testCases = [
        { platform: 'win32', cwd: 'C:\\test\\project', sep: '\\' },
        { platform: 'darwin', cwd: '/Users/test/project', sep: '/' },
        { platform: 'linux', cwd: '/home/test/project', sep: '/' },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        Object.defineProperty(process, 'platform', {
          value: testCase.platform,
        });

        const mockWatcher = {
          close: vi.fn(),
          on: vi.fn(),
        };

        const mockReadStream = {
          on: vi.fn(),
        };

        const mockReadlineInterface = {
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'line') {
              callback('[2023-10-15T10:01:00.000Z] INFO  New content');
            } else if (event === 'close') {
              callback();
            }
          }),
        };

        mockPath.join.mockImplementation((...args) => args.join(testCase.sep));
        mockFs.existsSync.mockReturnValue(true);

        let fileSize = 100;
        mockFs.statSync.mockImplementation(() => {
          fileSize += 50; // Simulate file growth
          return { size: fileSize } as any;
        });

        mockFs.readFileSync.mockReturnValue('[2023-10-15T10:00:00.000Z] INFO  Initial');
        mockFs.watch.mockImplementation((path, callback) => {
          setTimeout(() => callback('change'), 5);
          return mockWatcher as any;
        });
        mockFs.createReadStream.mockReturnValue(mockReadStream as any);
        mockCreateInterface.mockReturnValue(mockReadlineInterface as any);

        // Mock process.on to avoid actual signal handling
        const originalProcessOn = process.on;
        const mockProcessOn = vi.fn();
        process.on = mockProcessOn;

        const ctx = { cwd: testCase.cwd, initialized: true };
        const followPromise = handleDaemonLogs(ctx, ['--follow']);

        // Allow time for setup and change event
        await new Promise(resolve => setTimeout(resolve, 20));

        const expectedLogPath = `${testCase.cwd}${testCase.sep}.apex${testCase.sep}daemon.log`;
        expect(mockFs.watch).toHaveBeenCalledWith(expectedLogPath, expect.any(Function));
        expect(mockFs.createReadStream).toHaveBeenCalledWith(expectedLogPath, {
          start: expect.any(Number),
          end: expect.any(Number),
          encoding: 'utf-8'
        });

        // Restore original process.on
        process.on = originalProcessOn;
      }
    });

    it('should handle signal handlers correctly on all platforms', async () => {
      const testPlatforms = ['win32', 'darwin', 'linux'];

      for (const platform of testPlatforms) {
        vi.clearAllMocks();
        Object.defineProperty(process, 'platform', {
          value: platform,
        });

        const mockWatcher = {
          close: vi.fn(),
          on: vi.fn(),
        };

        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ size: 0 } as any);
        mockFs.watch.mockReturnValue(mockWatcher as any);

        // Mock process.on to capture signal handlers
        const originalProcessOn = process.on;
        const mockProcessOn = vi.fn();
        process.on = mockProcessOn;

        const ctx = { cwd: platform === 'win32' ? 'C:\\test' : '/test', initialized: true };
        const followPromise = handleDaemonLogs(ctx, ['--follow']);

        // Allow time for setup
        await new Promise(resolve => setTimeout(resolve, 10));

        // Should register signal handlers on all platforms
        expect(mockProcessOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
        expect(mockProcessOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

        // Restore original process.on
        process.on = originalProcessOn;
      }
    });

    it('should handle file encoding consistently across platforms', async () => {
      const testCases = [
        { platform: 'win32', content: 'INFO  Windows entry\r\n' },
        { platform: 'darwin', content: 'INFO  macOS entry\n' },
        { platform: 'linux', content: 'INFO  Linux entry\n' },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        Object.defineProperty(process, 'platform', {
          value: testCase.platform,
        });

        const logContent = `[2023-10-15T10:00:00.000Z] ${testCase.content}`;
        const separator = testCase.platform === 'win32' ? '\\' : '/';
        const cwd = testCase.platform === 'win32' ? 'C:\\test' : '/test';

        mockPath.join.mockImplementation((...args) => args.join(separator));
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(logContent);

        const ctx = { cwd, initialized: true };
        await handleDaemonLogs(ctx, []);

        // Should read file with UTF-8 encoding on all platforms
        expect(mockFs.readFileSync).toHaveBeenCalledWith(
          `${cwd}${separator}.apex${separator}daemon.log`,
          'utf-8'
        );

        // Should display content correctly regardless of line endings
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('INFO'));
      }
    });
  });

  describe('Performance and Resource Management', () => {
    it('should properly clean up watchers on all platforms', async () => {
      const testPlatforms = ['win32', 'darwin', 'linux'];

      for (const platform of testPlatforms) {
        vi.clearAllMocks();
        Object.defineProperty(process, 'platform', {
          value: platform,
        });

        const mockWatcher = {
          close: vi.fn(),
          on: vi.fn(),
        };

        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ size: 0 } as any);
        mockFs.watch.mockReturnValue(mockWatcher as any);

        // Mock process.on and capture cleanup function
        const originalProcessOn = process.on;
        const mockProcessOn = vi.fn();
        let cleanupFunction: Function | undefined;

        mockProcessOn.mockImplementation((signal: string, callback: Function) => {
          if (signal === 'SIGINT') {
            cleanupFunction = callback;
          }
          return process as any;
        });
        process.on = mockProcessOn;

        const ctx = { cwd: platform === 'win32' ? 'C:\\test' : '/test', initialized: true };
        const followPromise = handleDaemonLogs(ctx, ['--follow']);

        // Allow time for setup
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify watcher cleanup is available
        expect(cleanupFunction).toBeDefined();

        // Restore original process.on
        process.on = originalProcessOn;
      }
    });

    it('should handle memory efficiently during large file operations', async () => {
      const mockWatcher = {
        close: vi.fn(),
        on: vi.fn(),
      };

      const mockReadStream = {
        on: vi.fn(),
      };

      const mockReadlineInterface = {
        on: vi.fn((event: string, callback: Function) => {
          if (event === 'line') {
            // Simulate many lines being read
            for (let i = 0; i < 1000; i++) {
              callback(`[2023-10-15T10:${i.toString().padStart(2, '0')}:00.000Z] INFO  Entry ${i}`);
            }
          } else if (event === 'close') {
            callback();
          }
        }),
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockImplementation(() => {
        return { size: 1000000 } as any; // 1MB file
      });
      mockFs.readFileSync.mockReturnValue('[2023-10-15T10:00:00.000Z] INFO  Initial');
      mockFs.watch.mockImplementation((path, callback) => {
        setTimeout(() => callback('change'), 5);
        return mockWatcher as any;
      });
      mockFs.createReadStream.mockReturnValue(mockReadStream as any);
      mockCreateInterface.mockReturnValue(mockReadlineInterface as any);

      // Mock process.on to avoid actual signal handling
      const originalProcessOn = process.on;
      const mockProcessOn = vi.fn();
      process.on = mockProcessOn;

      const ctx = { cwd: '/test', initialized: true };
      const followPromise = handleDaemonLogs(ctx, ['--follow']);

      // Allow time for processing
      await new Promise(resolve => setTimeout(resolve, 20));

      // Should use streaming read with specified range
      expect(mockFs.createReadStream).toHaveBeenCalledWith('/test/.apex/daemon.log', {
        start: expect.any(Number),
        end: expect.any(Number),
        encoding: 'utf-8'
      });

      // Should use readline for efficient line processing
      expect(mockCreateInterface).toHaveBeenCalledWith({
        input: mockReadStream,
        crlfDelay: Infinity // Handles both CRLF and LF line endings
      });

      // Restore original process.on
      process.on = originalProcessOn;
    });
  });
});