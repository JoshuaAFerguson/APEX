import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DaemonRunner } from './runner';

// Mock the runner module
vi.mock('./runner', () => ({
  DaemonRunner: vi.fn(),
}));

// Mock console methods
const mockConsoleLog = vi.fn();
const mockConsoleError = vi.fn();
const originalConsole = console;

describe('daemon-entry', () => {
  let mockRunner: {
    start: ReturnType<typeof vi.fn>;
  };
  let originalExit: typeof process.exit;
  let originalEnv: NodeJS.ProcessEnv;
  let originalRequireMain: NodeJS.Module | undefined;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock console
    console.log = mockConsoleLog;
    console.error = mockConsoleError;

    // Mock process.exit
    originalExit = process.exit;
    process.exit = vi.fn() as any;

    // Save original env
    originalEnv = process.env;

    // Save original require.main
    originalRequireMain = require.main;

    // Mock DaemonRunner
    mockRunner = {
      start: vi.fn(),
    };
    (DaemonRunner as any).mockImplementation(() => mockRunner);
  });

  afterEach(() => {
    // Restore original functions
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    process.exit = originalExit;
    process.env = originalEnv;
    require.main = originalRequireMain;

    // Clear module cache to reset require.main check
    delete require.cache[require.resolve('./daemon-entry')];
  });

  describe('main function', () => {
    it('should exit with error if APEX_PROJECT_PATH is not set', () => {
      // Remove APEX_PROJECT_PATH from environment
      delete process.env.APEX_PROJECT_PATH;

      // Set require.main to current module to trigger execution
      require.main = module;

      // Import the module (this will trigger the main execution)
      require('./daemon-entry');

      expect(mockConsoleError).toHaveBeenCalledWith('APEX_PROJECT_PATH environment variable is required');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should start daemon with correct default configuration', async () => {
      process.env.APEX_PROJECT_PATH = '/test/project';
      require.main = module;

      mockRunner.start.mockResolvedValue(undefined);

      // Import and wait for execution
      require('./daemon-entry');

      // Wait a tick for async execution
      await new Promise(resolve => setImmediate(resolve));

      expect(DaemonRunner).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: 5000,
        logToStdout: false,
      });

      expect(mockConsoleLog).toHaveBeenCalledWith('Starting APEX daemon...');
      expect(mockConsoleLog).toHaveBeenCalledWith('Project path: /test/project');
      expect(mockConsoleLog).toHaveBeenCalledWith('Poll interval: 5000ms');
      expect(mockConsoleLog).toHaveBeenCalledWith('Debug logging: false');

      expect(mockRunner.start).toHaveBeenCalled();
    });

    it('should use custom poll interval from environment', async () => {
      process.env.APEX_PROJECT_PATH = '/test/project';
      process.env.APEX_POLL_INTERVAL = '2000';
      require.main = module;

      mockRunner.start.mockResolvedValue(undefined);

      require('./daemon-entry');
      await new Promise(resolve => setImmediate(resolve));

      expect(DaemonRunner).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: 2000,
        logToStdout: false,
      });

      expect(mockConsoleLog).toHaveBeenCalledWith('Poll interval: 2000ms');
    });

    it('should enable debug logging when APEX_DAEMON_DEBUG is set', async () => {
      process.env.APEX_PROJECT_PATH = '/test/project';
      process.env.APEX_DAEMON_DEBUG = '1';
      require.main = module;

      mockRunner.start.mockResolvedValue(undefined);

      require('./daemon-entry');
      await new Promise(resolve => setImmediate(resolve));

      expect(DaemonRunner).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: 5000,
        logToStdout: true,
      });

      expect(mockConsoleLog).toHaveBeenCalledWith('Debug logging: true');
    });

    it('should handle invalid poll interval gracefully', async () => {
      process.env.APEX_PROJECT_PATH = '/test/project';
      process.env.APEX_POLL_INTERVAL = 'invalid';
      require.main = module;

      mockRunner.start.mockResolvedValue(undefined);

      require('./daemon-entry');
      await new Promise(resolve => setImmediate(resolve));

      // Should default to NaN, which will be handled by DaemonRunner
      expect(DaemonRunner).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: NaN,
        logToStdout: false,
      });
    });

    it('should exit with error if daemon startup fails', async () => {
      process.env.APEX_PROJECT_PATH = '/test/project';
      require.main = module;

      const startupError = new Error('Failed to initialize');
      mockRunner.start.mockRejectedValue(startupError);

      require('./daemon-entry');
      await new Promise(resolve => setImmediate(resolve));

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to start daemon:', startupError);
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle unexpected errors in main function', async () => {
      process.env.APEX_PROJECT_PATH = '/test/project';
      require.main = module;

      // Make DaemonRunner constructor throw
      (DaemonRunner as any).mockImplementation(() => {
        throw new Error('Constructor error');
      });

      require('./daemon-entry');
      await new Promise(resolve => setImmediate(resolve));

      expect(mockConsoleError).toHaveBeenCalledWith('Daemon startup error:', expect.any(Error));
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('module execution guard', () => {
    it('should not execute main when not the main module', () => {
      process.env.APEX_PROJECT_PATH = '/test/project';

      // Set require.main to something else
      require.main = {} as any;

      require('./daemon-entry');

      // Should not have called console.log for startup messages
      expect(mockConsoleLog).not.toHaveBeenCalledWith('Starting APEX daemon...');
      expect(DaemonRunner).not.toHaveBeenCalled();
    });
  });

  describe('environment variable parsing', () => {
    it('should parse APEX_DAEMON_DEBUG as boolean correctly', async () => {
      const testCases = [
        { value: '1', expected: true },
        { value: '0', expected: false },
        { value: 'true', expected: false }, // Only '1' is truthy
        { value: 'false', expected: false },
        { value: '', expected: false },
        { value: undefined, expected: false },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        process.env.APEX_PROJECT_PATH = '/test/project';
        if (testCase.value !== undefined) {
          process.env.APEX_DAEMON_DEBUG = testCase.value;
        } else {
          delete process.env.APEX_DAEMON_DEBUG;
        }
        require.main = module;

        mockRunner.start.mockResolvedValue(undefined);

        // Clear module cache and re-require
        delete require.cache[require.resolve('./daemon-entry')];
        require('./daemon-entry');
        await new Promise(resolve => setImmediate(resolve));

        expect(DaemonRunner).toHaveBeenCalledWith(
          expect.objectContaining({
            logToStdout: testCase.expected,
          })
        );
      }
    });

    it('should handle various poll interval values correctly', async () => {
      const testCases = [
        { value: '1000', expected: 1000 },
        { value: '0', expected: 0 },
        { value: '-100', expected: -100 }, // Negative values
        { value: '999999', expected: 999999 }, // Large values
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        process.env.APEX_PROJECT_PATH = '/test/project';
        process.env.APEX_POLL_INTERVAL = testCase.value;
        require.main = module;

        mockRunner.start.mockResolvedValue(undefined);

        // Clear module cache and re-require
        delete require.cache[require.resolve('./daemon-entry')];
        require('./daemon-entry');
        await new Promise(resolve => setImmediate(resolve));

        expect(DaemonRunner).toHaveBeenCalledWith(
          expect.objectContaining({
            pollIntervalMs: testCase.expected,
          })
        );
      }
    });
  });
});