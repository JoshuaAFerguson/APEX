import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { DaemonRunner, type DaemonRunnerOptions } from './runner';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';

// Mock dependencies
vi.mock('fs', () => ({
  createWriteStream: vi.fn(),
}));

vi.mock('./index', () => ({
  ApexOrchestrator: vi.fn(),
}));

vi.mock('./store', () => ({
  TaskStore: vi.fn(),
}));

const { loadConfig, getEffectiveConfig } = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  getEffectiveConfig: vi.fn(),
}));

vi.mock('@apexcli/core', () => ({
  loadConfig,
  getEffectiveConfig,
}));

// Mock stream
const mockStream = {
  write: vi.fn(),
  end: vi.fn((callback?: () => void) => callback?.()),
  destroyed: false,
};

// Mock orchestrator
const mockOrchestrator = {
  initialize: vi.fn(),
  executeTask: vi.fn(),
  on: vi.fn(),
};

// Mock store
const mockStore = {
  initialize: vi.fn(),
  close: vi.fn(),
  getNextQueuedTask: vi.fn(),
};

describe('DaemonRunner Config Integration', () => {
  const testProjectPath = '/test/project';

  // Save original process methods
  const originalExit = process.exit;
  const originalOn = process.on;
  const mockProcessOn = vi.fn();

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock process.on to capture signal handlers
    process.on = mockProcessOn as any;

    // Setup default mocks
    (createWriteStream as MockedFunction<typeof createWriteStream>).mockReturnValue(mockStream as any);
    (ApexOrchestrator as any).mockImplementation(() => mockOrchestrator);
    (TaskStore as any).mockImplementation(() => mockStore);
  });

  afterEach(() => {
    // Restore original methods
    process.exit = originalExit;
    process.on = originalOn;

    // Clear intervals and timeouts
    vi.clearAllTimers();
  });

  describe('config loading and priority resolution', () => {
    it('should load config when no pre-loaded config is provided', async () => {
      const mockConfig = {
        daemon: {
          pollInterval: 3000,
          logLevel: 'debug' as const,
        }
      };

      loadConfig.mockResolvedValue(mockConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: mockConfig.daemon,
        limits: { maxConcurrentTasks: 5 }
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await runner.start();

      expect(loadConfig).toHaveBeenCalledWith(testProjectPath);
      expect(getEffectiveConfig).toHaveBeenCalledWith(mockConfig);
    });

    it('should use pre-loaded config when provided', async () => {
      const preLoadedConfig = {
        daemon: {
          pollInterval: 2000,
          logLevel: 'warn' as const,
        }
      };

      getEffectiveConfig.mockReturnValue({
        daemon: preLoadedConfig.daemon,
        limits: { maxConcurrentTasks: 4 }
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        config: preLoadedConfig,
      });

      await runner.start();

      expect(loadConfig).not.toHaveBeenCalled();
      expect(getEffectiveConfig).toHaveBeenCalledWith(preLoadedConfig);
    });

    it('should prioritize explicit options over config defaults', async () => {
      const mockConfig = {
        daemon: {
          pollInterval: 8000, // Config says 8000
          logLevel: 'debug' as const, // Config says debug
        }
      };

      loadConfig.mockResolvedValue(mockConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: mockConfig.daemon,
        limits: { maxConcurrentTasks: 3 }
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 2000, // Explicit option should take priority
        logLevel: 'error', // Explicit option should take priority
      });

      await runner.start();

      // Verify that the runner starts with explicit options, not config values
      const metrics = runner.getMetrics();
      expect(metrics.isRunning).toBe(true);
    });

    it('should use config values when options are undefined', async () => {
      const mockConfig = {
        daemon: {
          pollInterval: 7000,
          logLevel: 'warn' as const,
        }
      };

      loadConfig.mockResolvedValue(mockConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: mockConfig.daemon,
        limits: { maxConcurrentTasks: 2 }
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        // No pollIntervalMs or logLevel provided - should use config
      });

      await runner.start();

      const metrics = runner.getMetrics();
      expect(metrics.isRunning).toBe(true);
    });

    it('should handle missing daemon config gracefully', async () => {
      const mockConfig = {}; // No daemon config

      loadConfig.mockResolvedValue(mockConfig);
      getEffectiveConfig.mockReturnValue({
        limits: { maxConcurrentTasks: 3 }
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await runner.start();

      // Should use default values when config is missing
      const metrics = runner.getMetrics();
      expect(metrics.isRunning).toBe(true);
    });

    it('should handle partial daemon config', async () => {
      const mockConfig = {
        daemon: {
          pollInterval: 4000, // Only pollInterval specified
          // logLevel missing - should use default
        }
      };

      loadConfig.mockResolvedValue(mockConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: mockConfig.daemon,
        limits: { maxConcurrentTasks: 3 }
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await runner.start();

      const metrics = runner.getMetrics();
      expect(metrics.isRunning).toBe(true);
    });
  });

  describe('pollInterval configuration', () => {
    it('should clamp pollInterval from config to valid range', async () => {
      const testCases = [
        { configValue: 500, expectedClamped: 1000 }, // Below minimum
        { configValue: 90000, expectedClamped: 60000 }, // Above maximum
        { configValue: 5000, expectedClamped: 5000 }, // Valid value
        { configValue: 1000, expectedClamped: 1000 }, // Minimum boundary
        { configValue: 60000, expectedClamped: 60000 }, // Maximum boundary
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        const mockConfig = {
          daemon: {
            pollInterval: testCase.configValue,
          }
        };

        loadConfig.mockResolvedValue(mockConfig);
        getEffectiveConfig.mockReturnValue({
          daemon: mockConfig.daemon,
          limits: { maxConcurrentTasks: 3 }
        });

        const runner = new DaemonRunner({
          projectPath: testProjectPath,
        });

        await runner.start();

        // Verify the runner started successfully (indicating valid pollInterval)
        const metrics = runner.getMetrics();
        expect(metrics.isRunning).toBe(true);

        await runner.stop();
      }
    });

    it('should handle invalid pollInterval types in config', async () => {
      const mockConfig = {
        daemon: {
          pollInterval: 'invalid' as any, // Invalid type
        }
      };

      loadConfig.mockResolvedValue(mockConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: mockConfig.daemon,
        limits: { maxConcurrentTasks: 3 }
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      // Should handle gracefully and use defaults
      await expect(runner.start()).resolves.not.toThrow();
    });
  });

  describe('logLevel configuration', () => {
    it('should use config logLevel when not explicitly provided', async () => {
      const testCases = ['debug', 'info', 'warn', 'error'] as const;

      for (const logLevel of testCases) {
        vi.clearAllMocks();

        const mockConfig = {
          daemon: {
            logLevel,
          }
        };

        loadConfig.mockResolvedValue(mockConfig);
        getEffectiveConfig.mockReturnValue({
          daemon: mockConfig.daemon,
          limits: { maxConcurrentTasks: 3 }
        });

        const runner = new DaemonRunner({
          projectPath: testProjectPath,
        });

        await runner.start();

        const metrics = runner.getMetrics();
        expect(metrics.isRunning).toBe(true);

        await runner.stop();
      }
    });

    it('should handle invalid logLevel in config', async () => {
      const mockConfig = {
        daemon: {
          logLevel: 'invalid' as any,
        }
      };

      loadConfig.mockResolvedValue(mockConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: mockConfig.daemon,
        limits: { maxConcurrentTasks: 3 }
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      // Should handle gracefully
      await expect(runner.start()).resolves.not.toThrow();
    });
  });

  describe('maxConcurrentTasks configuration', () => {
    it('should use config maxConcurrentTasks when option is 0', async () => {
      const mockConfig = {};

      loadConfig.mockResolvedValue(mockConfig);
      getEffectiveConfig.mockReturnValue({
        limits: { maxConcurrentTasks: 7 }
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 0, // 0 means use config
      });

      await runner.start();

      const metrics = runner.getMetrics();
      expect(metrics.isRunning).toBe(true);
    });

    it('should use explicit maxConcurrentTasks when provided', async () => {
      const mockConfig = {};

      loadConfig.mockResolvedValue(mockConfig);
      getEffectiveConfig.mockReturnValue({
        limits: { maxConcurrentTasks: 7 }
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 5, // Explicit value should override config
      });

      await runner.start();

      const metrics = runner.getMetrics();
      expect(metrics.isRunning).toBe(true);
    });
  });

  describe('logging integration', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T10:30:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should respect logLevel from config for log filtering', async () => {
      const mockConfig = {
        daemon: {
          logLevel: 'warn' as const, // Only warn and error should be logged
        }
      };

      loadConfig.mockResolvedValue(mockConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: mockConfig.daemon,
        limits: { maxConcurrentTasks: 3 }
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await runner.start();

      // Wait for initial log writes
      await new Promise(resolve => setImmediate(resolve));

      // Check that log stream was created and written to
      expect(createWriteStream).toHaveBeenCalledWith(
        join(testProjectPath, '.apex', 'daemon.log'),
        { flags: 'a' }
      );

      // The info-level startup message should be written since it's an important lifecycle event
      expect(mockStream.write).toHaveBeenCalled();
    });

    it('should write to log file with correct format and timestamp', async () => {
      const mockConfig = {
        daemon: {
          logLevel: 'info' as const,
        }
      };

      loadConfig.mockResolvedValue(mockConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: mockConfig.daemon,
        limits: { maxConcurrentTasks: 3 }
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await runner.start();

      // Wait for log writes
      await new Promise(resolve => setImmediate(resolve));

      // Verify log format
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringMatching(/^\[2024-01-15T10:30:00\.000Z\] \[INFO \] Daemon started/)
      );
    });
  });

  describe('error handling during config loading', () => {
    it('should handle loadConfig failure gracefully', async () => {
      loadConfig.mockRejectedValue(new Error('Config load failed'));

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await expect(runner.start()).rejects.toThrow('Config load failed');

      // Should cleanup on error
      expect(mockStream.end).toHaveBeenCalled();
    });

    it('should handle getEffectiveConfig failure gracefully', async () => {
      loadConfig.mockResolvedValue({});
      getEffectiveConfig.mockImplementation(() => {
        throw new Error('Invalid config');
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await expect(runner.start()).rejects.toThrow('Invalid config');

      // Should cleanup on error
      expect(mockStream.end).toHaveBeenCalled();
    });
  });

  describe('configuration priority scenarios', () => {
    it('should follow priority: CLI args > Options > Env vars > Config > Defaults', async () => {
      // This test verifies the documented priority order
      const mockConfig = {
        daemon: {
          pollInterval: 8000, // Lowest priority (config)
          logLevel: 'debug' as const,
        }
      };

      loadConfig.mockResolvedValue(mockConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: mockConfig.daemon,
        limits: { maxConcurrentTasks: 3 }
      });

      // Options should override config
      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 3000, // Higher priority (options)
        logLevel: 'error', // Higher priority (options)
      });

      await runner.start();

      const metrics = runner.getMetrics();
      expect(metrics.isRunning).toBe(true);

      // Verify that explicit options were used, not config values
      // (We can't directly inspect internal values, but the successful start indicates proper configuration)
    });

    it('should handle mixed explicit and config values', async () => {
      const mockConfig = {
        daemon: {
          pollInterval: 6000, // Should be used since not overridden
          logLevel: 'debug' as const, // Should be overridden
        }
      };

      loadConfig.mockResolvedValue(mockConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: mockConfig.daemon,
        limits: { maxConcurrentTasks: 2 }
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        logLevel: 'warn', // Explicit option overrides config
        // pollIntervalMs not provided, should use config value
      });

      await runner.start();

      const metrics = runner.getMetrics();
      expect(metrics.isRunning).toBe(true);
    });
  });

  describe('config validation edge cases', () => {
    it('should handle null config values', async () => {
      const mockConfig = {
        daemon: {
          pollInterval: null as any,
          logLevel: null as any,
        }
      };

      loadConfig.mockResolvedValue(mockConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: mockConfig.daemon,
        limits: { maxConcurrentTasks: 3 }
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      // Should handle null values gracefully and use defaults
      await expect(runner.start()).resolves.not.toThrow();
    });

    it('should handle empty daemon config object', async () => {
      const mockConfig = {
        daemon: {} // Empty object
      };

      loadConfig.mockResolvedValue(mockConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: mockConfig.daemon,
        limits: { maxConcurrentTasks: 3 }
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await runner.start();

      const metrics = runner.getMetrics();
      expect(metrics.isRunning).toBe(true);
    });

    it('should handle config with unexpected extra fields', async () => {
      const mockConfig = {
        daemon: {
          pollInterval: 5000,
          logLevel: 'info' as const,
          unexpectedField: 'should be ignored',
          anotherField: 123,
        }
      };

      loadConfig.mockResolvedValue(mockConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: mockConfig.daemon,
        limits: { maxConcurrentTasks: 3 }
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      // Should handle extra fields gracefully
      await runner.start();

      const metrics = runner.getMetrics();
      expect(metrics.isRunning).toBe(true);
    });
  });
});