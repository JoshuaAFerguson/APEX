import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DaemonRunner } from './runner';

// Mock the runner module
vi.mock('./runner', () => ({
  DaemonRunner: vi.fn(),
}));

// Mock console methods
const mockConsoleLog = vi.fn();
const mockConsoleError = vi.fn();
const mockConsoleWarn = vi.fn();
const originalConsole = console;

describe('daemon-entry Config Integration', () => {
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
    console.warn = mockConsoleWarn;

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

    // Reset process.env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original functions
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    process.exit = originalExit;
    process.env = originalEnv;
    require.main = originalRequireMain;

    // Clear module cache to reset require.main check
    delete require.cache[require.resolve('./daemon-entry')];
  });

  describe('config loading and priority resolution', () => {
    it('should prioritize environment variables over config file defaults', async () => {
      process.env.APEX_PROJECT_PATH = '/test/project';
      process.env.APEX_POLL_INTERVAL = '1500'; // Env var should take priority
      process.env.APEX_LOG_LEVEL = 'debug'; // Env var should take priority
      process.env.APEX_DAEMON_DEBUG = '1'; // Env var should take priority
      require.main = module;

      mockRunner.start.mockResolvedValue(undefined);

      require('./daemon-entry');
      await new Promise(resolve => setImmediate(resolve));

      expect(DaemonRunner).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: 1500,
        logLevel: 'debug',
        logToStdout: true,
        config: undefined, // No pre-loaded config
      });

      expect(mockConsoleLog).toHaveBeenCalledWith('Poll interval: 1500ms (from env)');
      expect(mockConsoleLog).toHaveBeenCalledWith('Log level: debug (from env)');
      expect(mockConsoleLog).toHaveBeenCalledWith('Debug logging: true');
    });

    it('should load config from APEX_CONFIG_JSON when provided', async () => {
      const testConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          description: 'Test project',
        },
        daemon: {
          pollInterval: 3000,
          logLevel: 'warn',
          autoStart: true,
        },
        limits: {
          maxConcurrentTasks: 5,
          maxTokensPerTask: 50000,
          maxCostPerTask: 10.0,
          dailyTokenLimit: 1000000,
          dailyCostLimit: 100.0,
        },
      };

      process.env.APEX_PROJECT_PATH = '/test/project';
      process.env.APEX_CONFIG_JSON = JSON.stringify(testConfig);
      require.main = module;

      mockRunner.start.mockResolvedValue(undefined);

      require('./daemon-entry');
      await new Promise(resolve => setImmediate(resolve));

      expect(DaemonRunner).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: undefined, // Not set in env, should use config
        logLevel: undefined, // Not set in env, should use config
        logToStdout: false,
        config: testConfig, // Pre-loaded config passed
      });
    });

    it('should handle malformed APEX_CONFIG_JSON gracefully', async () => {
      process.env.APEX_PROJECT_PATH = '/test/project';
      process.env.APEX_CONFIG_JSON = '{ invalid json }';
      require.main = module;

      mockRunner.start.mockResolvedValue(undefined);

      require('./daemon-entry');
      await new Promise(resolve => setImmediate(resolve));

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Failed to parse APEX_CONFIG_JSON, will load config from file:',
        expect.any(Error)
      );

      expect(DaemonRunner).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: undefined,
        logLevel: undefined,
        logToStdout: false,
        config: undefined, // No config due to parse error
      });
    });

    it('should prioritize env vars over config file when both are present', async () => {
      const testConfig = {
        daemon: {
          pollInterval: 8000, // Config says 8000
          logLevel: 'info', // Config says info
        }
      };

      process.env.APEX_PROJECT_PATH = '/test/project';
      process.env.APEX_CONFIG_JSON = JSON.stringify(testConfig);
      process.env.APEX_POLL_INTERVAL = '2000'; // Env should override config
      process.env.APEX_LOG_LEVEL = 'error'; // Env should override config
      require.main = module;

      mockRunner.start.mockResolvedValue(undefined);

      require('./daemon-entry');
      await new Promise(resolve => setImmediate(resolve));

      expect(DaemonRunner).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: 2000, // From env, not config
        logLevel: 'error', // From env, not config
        logToStdout: false,
        config: testConfig, // Config still passed for other values
      });

      expect(mockConsoleLog).toHaveBeenCalledWith('Poll interval: 2000ms (from env)');
      expect(mockConsoleLog).toHaveBeenCalledWith('Log level: error (from env)');
    });
  });

  describe('environment variable parsing edge cases', () => {
    it('should handle invalid poll interval values gracefully', async () => {
      const invalidValues = ['not-a-number', '', 'null', 'undefined', '-1', '0.5'];

      for (const invalidValue of invalidValues) {
        vi.clearAllMocks();

        process.env.APEX_PROJECT_PATH = '/test/project';
        process.env.APEX_POLL_INTERVAL = invalidValue;
        require.main = module;

        mockRunner.start.mockResolvedValue(undefined);

        // Clear module cache and re-require
        delete require.cache[require.resolve('./daemon-entry')];
        require('./daemon-entry');
        await new Promise(resolve => setImmediate(resolve));

        // Should pass the parsed value (including NaN) to DaemonRunner
        // DaemonRunner will handle validation and clamping
        const expectedValue = parseInt(invalidValue, 10);
        expect(DaemonRunner).toHaveBeenCalledWith(
          expect.objectContaining({
            pollIntervalMs: expectedValue,
          })
        );
      }
    });

    it('should handle various debug flag values correctly', async () => {
      const testCases = [
        { value: '1', expected: true, description: 'string "1"' },
        { value: '0', expected: false, description: 'string "0"' },
        { value: 'true', expected: false, description: 'string "true" (not "1")' },
        { value: 'false', expected: false, description: 'string "false"' },
        { value: '', expected: false, description: 'empty string' },
        { value: 'any-other-value', expected: false, description: 'any other value' },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        process.env.APEX_PROJECT_PATH = '/test/project';
        process.env.APEX_DAEMON_DEBUG = testCase.value;
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

        expect(mockConsoleLog).toHaveBeenCalledWith(`Debug logging: ${testCase.expected}`);
      }
    });

    it('should handle invalid log level values', async () => {
      const invalidLevels = ['trace', 'verbose', 'fatal', '', 'DEBUG', 'INFO'];

      for (const invalidLevel of invalidLevels) {
        vi.clearAllMocks();

        process.env.APEX_PROJECT_PATH = '/test/project';
        process.env.APEX_LOG_LEVEL = invalidLevel;
        require.main = module;

        mockRunner.start.mockResolvedValue(undefined);

        // Clear module cache and re-require
        delete require.cache[require.resolve('./daemon-entry')];
        require('./daemon-entry');
        await new Promise(resolve => setImmediate(resolve));

        // Should pass invalid value to DaemonRunner for validation
        expect(DaemonRunner).toHaveBeenCalledWith(
          expect.objectContaining({
            logLevel: invalidLevel,
          })
        );
      }
    });
  });

  describe('complex configuration scenarios', () => {
    it('should handle full configuration with all environment variables set', async () => {
      const complexConfig = {
        version: '1.0',
        project: {
          name: 'full-config-test',
          description: 'Test with full configuration',
        },
        daemon: {
          pollInterval: 6000, // Should be overridden by env
          logLevel: 'info', // Should be overridden by env
          autoStart: true,
          installAsService: false,
          serviceName: 'test-apex-daemon',
          healthCheck: {
            enabled: true,
            interval: 60000,
            timeout: 10000,
            retries: 5,
          },
          watchdog: {
            enabled: true,
            restartDelay: 3000,
            maxRestarts: 10,
            restartWindow: 600000,
          },
        },
        autonomy: {
          default: 'review-before-merge' as const,
        },
        limits: {
          maxConcurrentTasks: 8,
          maxTokensPerTask: 100000,
          maxCostPerTask: 25.0,
          dailyTokenLimit: 2000000,
          dailyCostLimit: 250.0,
        },
      };

      process.env.APEX_PROJECT_PATH = '/complex/test/project';
      process.env.APEX_CONFIG_JSON = JSON.stringify(complexConfig);
      process.env.APEX_POLL_INTERVAL = '1750'; // Override config
      process.env.APEX_LOG_LEVEL = 'debug'; // Override config
      process.env.APEX_DAEMON_DEBUG = '1'; // Enable debug
      require.main = module;

      mockRunner.start.mockResolvedValue(undefined);

      require('./daemon-entry');
      await new Promise(resolve => setImmediate(resolve));

      expect(DaemonRunner).toHaveBeenCalledWith({
        projectPath: '/complex/test/project',
        pollIntervalMs: 1750, // From env, overrides config
        logLevel: 'debug', // From env, overrides config
        logToStdout: true, // From env
        config: complexConfig, // Full config passed
      });

      expect(mockConsoleLog).toHaveBeenCalledWith('Starting APEX daemon...');
      expect(mockConsoleLog).toHaveBeenCalledWith('Project path: /complex/test/project');
      expect(mockConsoleLog).toHaveBeenCalledWith('Poll interval: 1750ms (from env)');
      expect(mockConsoleLog).toHaveBeenCalledWith('Log level: debug (from env)');
      expect(mockConsoleLog).toHaveBeenCalledWith('Debug logging: true');
    });

    it('should handle minimal configuration with config defaults', async () => {
      const minimalConfig = {
        version: '1.0',
        project: {
          name: 'minimal-test',
          description: 'Minimal config test',
        },
        limits: {
          maxConcurrentTasks: 2,
          maxTokensPerTask: 25000,
          maxCostPerTask: 5.0,
          dailyTokenLimit: 500000,
          dailyCostLimit: 50.0,
        },
      };

      process.env.APEX_PROJECT_PATH = '/minimal/test';
      process.env.APEX_CONFIG_JSON = JSON.stringify(minimalConfig);
      // No other env vars set - should use config/defaults
      require.main = module;

      mockRunner.start.mockResolvedValue(undefined);

      require('./daemon-entry');
      await new Promise(resolve => setImmediate(resolve));

      expect(DaemonRunner).toHaveBeenCalledWith({
        projectPath: '/minimal/test',
        pollIntervalMs: undefined, // Will use config default
        logLevel: undefined, // Will use config default
        logToStdout: false, // Default value
        config: minimalConfig,
      });

      // Should not show "from env" messages
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringMatching(/\(from env\)/));
    });

    it('should handle empty config object', async () => {
      const emptyConfig = {};

      process.env.APEX_PROJECT_PATH = '/empty/config/test';
      process.env.APEX_CONFIG_JSON = JSON.stringify(emptyConfig);
      require.main = module;

      mockRunner.start.mockResolvedValue(undefined);

      require('./daemon-entry');
      await new Promise(resolve => setImmediate(resolve));

      expect(DaemonRunner).toHaveBeenCalledWith({
        projectPath: '/empty/config/test',
        pollIntervalMs: undefined,
        logLevel: undefined,
        logToStdout: false,
        config: emptyConfig,
      });
    });
  });

  describe('error scenarios with config', () => {
    it('should handle JSON parse errors and continue without config', async () => {
      process.env.APEX_PROJECT_PATH = '/test/project';
      process.env.APEX_CONFIG_JSON = '{"malformed": json}';
      require.main = module;

      mockRunner.start.mockResolvedValue(undefined);

      require('./daemon-entry');
      await new Promise(resolve => setImmediate(resolve));

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Failed to parse APEX_CONFIG_JSON, will load config from file:',
        expect.any(Error)
      );

      expect(DaemonRunner).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: undefined,
        logLevel: undefined,
        logToStdout: false,
        config: undefined,
      });

      // Should still attempt to start despite config error
      expect(mockRunner.start).toHaveBeenCalled();
    });

    it('should handle config with circular references', async () => {
      // This would come from APEX_CONFIG_JSON being improperly serialized elsewhere
      process.env.APEX_PROJECT_PATH = '/test/project';
      process.env.APEX_CONFIG_JSON = '{"a": {"b": {"c": "[Circular]"}}}';
      require.main = module;

      mockRunner.start.mockResolvedValue(undefined);

      require('./daemon-entry');
      await new Promise(resolve => setImmediate(resolve));

      // JSON.parse should succeed even with circular reference strings
      expect(DaemonRunner).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: undefined,
        logLevel: undefined,
        logToStdout: false,
        config: { a: { b: { c: '[Circular]' } } },
      });
    });

    it('should handle startup failure with config and log appropriate error', async () => {
      const config = {
        daemon: { pollInterval: 5000, logLevel: 'info' }
      };

      process.env.APEX_PROJECT_PATH = '/test/project';
      process.env.APEX_CONFIG_JSON = JSON.stringify(config);
      require.main = module;

      const startupError = new Error('Daemon startup failed');
      mockRunner.start.mockRejectedValue(startupError);

      require('./daemon-entry');
      await new Promise(resolve => setImmediate(resolve));

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to start daemon:', startupError);
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('logging and output validation', () => {
    it('should log all relevant configuration information', async () => {
      process.env.APEX_PROJECT_PATH = '/comprehensive/test';
      process.env.APEX_POLL_INTERVAL = '3500';
      process.env.APEX_LOG_LEVEL = 'warn';
      process.env.APEX_DAEMON_DEBUG = '1';
      require.main = module;

      mockRunner.start.mockResolvedValue(undefined);

      require('./daemon-entry');
      await new Promise(resolve => setImmediate(resolve));

      // Verify all expected log messages
      expect(mockConsoleLog).toHaveBeenCalledWith('Starting APEX daemon...');
      expect(mockConsoleLog).toHaveBeenCalledWith('Project path: /comprehensive/test');
      expect(mockConsoleLog).toHaveBeenCalledWith('Poll interval: 3500ms (from env)');
      expect(mockConsoleLog).toHaveBeenCalledWith('Log level: warn (from env)');
      expect(mockConsoleLog).toHaveBeenCalledWith('Debug logging: true');
    });

    it('should log correctly when no env overrides are present', async () => {
      process.env.APEX_PROJECT_PATH = '/default/test';
      require.main = module;

      mockRunner.start.mockResolvedValue(undefined);

      require('./daemon-entry');
      await new Promise(resolve => setImmediate(resolve));

      expect(mockConsoleLog).toHaveBeenCalledWith('Starting APEX daemon...');
      expect(mockConsoleLog).toHaveBeenCalledWith('Project path: /default/test');
      expect(mockConsoleLog).toHaveBeenCalledWith('Debug logging: false');

      // Should not show poll interval or log level messages when not explicitly set
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringMatching(/Poll interval:/));
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringMatching(/Log level:/));
    });
  });

  describe('performance considerations', () => {
    it('should minimize JSON parsing overhead for large configs', async () => {
      // Create a large config to test performance
      const largeConfig = {
        version: '1.0',
        project: { name: 'performance-test', description: 'Large config test' },
        daemon: {
          pollInterval: 5000,
          logLevel: 'info',
          // Add many nested properties to make it large
          timeBasedUsage: {
            enabled: true,
            dayModeHours: Array.from({ length: 12 }, (_, i) => i + 8),
            nightModeHours: Array.from({ length: 12 }, (_, i) => (i + 20) % 24),
            dayModeThresholds: { maxTokensPerTask: 50000, maxCostPerTask: 10.0, maxConcurrentTasks: 3 },
            nightModeThresholds: { maxTokensPerTask: 100000, maxCostPerTask: 20.0, maxConcurrentTasks: 6 },
          },
          healthCheck: { enabled: true, interval: 30000, timeout: 5000, retries: 3 },
          watchdog: { enabled: true, restartDelay: 5000, maxRestarts: 5, restartWindow: 300000 },
        },
        limits: { maxConcurrentTasks: 5, maxTokensPerTask: 75000, maxCostPerTask: 15.0, dailyTokenLimit: 1500000, dailyCostLimit: 150.0 },
      };

      process.env.APEX_PROJECT_PATH = '/performance/test';
      process.env.APEX_CONFIG_JSON = JSON.stringify(largeConfig);
      require.main = module;

      mockRunner.start.mockResolvedValue(undefined);

      const startTime = Date.now();
      require('./daemon-entry');
      await new Promise(resolve => setImmediate(resolve));
      const endTime = Date.now();

      // Should complete quickly (under 100ms for this size config)
      expect(endTime - startTime).toBeLessThan(100);

      expect(DaemonRunner).toHaveBeenCalledWith({
        projectPath: '/performance/test',
        pollIntervalMs: undefined,
        logLevel: undefined,
        logToStdout: false,
        config: largeConfig,
      });
    });
  });
});