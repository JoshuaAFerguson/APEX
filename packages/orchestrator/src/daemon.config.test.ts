import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { DaemonManager, DaemonError, type DaemonOptions } from './daemon';
import { ApexConfig } from '@apexcli/core';

// Mock child_process.fork
const mockFork = vi.fn();
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

// Mock process.kill
const originalKill = process.kill;
const mockKill = vi.fn();

describe('DaemonManager Config Integration', () => {
  const testProjectPath = '/test/project';
  const testPidFile = join(testProjectPath, '.apex', 'daemon.pid');
  const testLogFile = join(testProjectPath, '.apex', 'daemon.log');

  let daemonManager: DaemonManager;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    mockFork.mockReturnValue(mockChild);

    // Mock process.kill
    process.kill = mockKill;

    // Setup default file system mocks
    (fs.mkdir as any).mockResolvedValue(undefined);
    (fs.writeFile as any).mockResolvedValue(undefined);
    (fs.appendFile as any).mockResolvedValue(undefined);
    (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' }); // No existing daemon
  });

  afterEach(() => {
    // Restore process.kill
    process.kill = originalKill;
    vi.resetAllMocks();
  });

  describe('config-based options', () => {
    it('should pass pollIntervalMs from options to daemon process', async () => {
      const options: DaemonOptions = {
        projectPath: testProjectPath,
        pollIntervalMs: 2500,
      };

      daemonManager = new DaemonManager(options);
      await daemonManager.startDaemon();

      expect(mockFork).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_POLL_INTERVAL: '2500',
          }),
        })
      );
    });

    it('should pass logLevel from options to daemon process', async () => {
      const options: DaemonOptions = {
        projectPath: testProjectPath,
        logLevel: 'debug',
      };

      daemonManager = new DaemonManager(options);
      await daemonManager.startDaemon();

      expect(mockFork).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_LOG_LEVEL: 'debug',
          }),
        })
      );
    });

    it('should pass debugMode from options to daemon process', async () => {
      const options: DaemonOptions = {
        projectPath: testProjectPath,
        debugMode: true,
      };

      daemonManager = new DaemonManager(options);
      await daemonManager.startDaemon();

      expect(mockFork).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_DAEMON_DEBUG: '1',
          }),
        })
      );
    });

    it('should not set APEX_DAEMON_DEBUG when debugMode is false', async () => {
      const options: DaemonOptions = {
        projectPath: testProjectPath,
        debugMode: false,
      };

      daemonManager = new DaemonManager(options);
      await daemonManager.startDaemon();

      expect(mockFork).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_DAEMON_DEBUG: '0',
          }),
        })
      );
    });

    it('should not pass undefined values to environment', async () => {
      const options: DaemonOptions = {
        projectPath: testProjectPath,
        // pollIntervalMs, logLevel, debugMode all undefined
      };

      daemonManager = new DaemonManager(options);
      await daemonManager.startDaemon();

      const forkCall = mockFork.mock.calls[0];
      const env = forkCall[2].env;

      expect(env).not.toHaveProperty('APEX_POLL_INTERVAL');
      expect(env).not.toHaveProperty('APEX_LOG_LEVEL');
      expect(env).not.toHaveProperty('APEX_DAEMON_DEBUG');
    });
  });

  describe('config object serialization', () => {
    it('should serialize and pass config object when provided', async () => {
      const config: ApexConfig = {
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

      const options: DaemonOptions = {
        projectPath: testProjectPath,
        config,
      };

      daemonManager = new DaemonManager(options);
      await daemonManager.startDaemon();

      expect(mockFork).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_CONFIG_JSON: JSON.stringify(config),
          }),
        })
      );
    });

    it('should not pass APEX_CONFIG_JSON when config is not provided', async () => {
      const options: DaemonOptions = {
        projectPath: testProjectPath,
      };

      daemonManager = new DaemonManager(options);
      await daemonManager.startDaemon();

      const forkCall = mockFork.mock.calls[0];
      const env = forkCall[2].env;

      expect(env).not.toHaveProperty('APEX_CONFIG_JSON');
    });

    it('should handle complex config object with nested structures', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'complex-project',
          description: 'Complex test project',
        },
        daemon: {
          pollInterval: 2000,
          logLevel: 'info',
          autoStart: false,
          installAsService: true,
          serviceName: 'my-apex-daemon',
          healthCheck: {
            enabled: true,
            interval: 45000,
            timeout: 8000,
            retries: 5,
          },
          watchdog: {
            enabled: false,
            restartDelay: 10000,
            maxRestarts: 3,
            restartWindow: 600000,
          },
          timeBasedUsage: {
            enabled: true,
            dayModeHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
            nightModeHours: [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6],
            dayModeThresholds: {
              maxTokensPerTask: 75000,
              maxCostPerTask: 7.5,
              maxConcurrentTasks: 3,
            },
            nightModeThresholds: {
              maxTokensPerTask: 150000,
              maxCostPerTask: 15.0,
              maxConcurrentTasks: 6,
            },
          },
        },
        limits: {
          maxConcurrentTasks: 8,
          maxTokensPerTask: 100000,
          maxCostPerTask: 20.0,
          dailyTokenLimit: 2000000,
          dailyCostLimit: 200.0,
        },
      };

      const options: DaemonOptions = {
        projectPath: testProjectPath,
        config,
      };

      daemonManager = new DaemonManager(options);
      await daemonManager.startDaemon();

      expect(mockFork).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_CONFIG_JSON: JSON.stringify(config),
          }),
        })
      );

      // Verify the config can be parsed back
      const serializedConfig = JSON.parse(JSON.stringify(config));
      expect(serializedConfig.daemon.timeBasedUsage.dayModeHours).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
      expect(serializedConfig.daemon.watchdog.enabled).toBe(false);
    });
  });

  describe('priority resolution between options and config', () => {
    it('should prioritize explicit options over config values', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test', description: 'test' },
        daemon: {
          pollInterval: 8000, // Config says 8000
          logLevel: 'debug', // Config says debug
        },
        limits: { maxConcurrentTasks: 3, maxTokensPerTask: 50000, maxCostPerTask: 10.0, dailyTokenLimit: 1000000, dailyCostLimit: 100.0 },
      };

      const options: DaemonOptions = {
        projectPath: testProjectPath,
        pollIntervalMs: 1500, // Explicit option should take priority
        logLevel: 'error', // Explicit option should take priority
        config, // Config provided but should be overridden
      };

      daemonManager = new DaemonManager(options);
      await daemonManager.startDaemon();

      expect(mockFork).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_POLL_INTERVAL: '1500', // Explicit option
            APEX_LOG_LEVEL: 'error', // Explicit option
            APEX_CONFIG_JSON: JSON.stringify(config), // Config still passed for other values
          }),
        })
      );
    });

    it('should allow mixing explicit options with config object', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test', description: 'test' },
        daemon: {
          pollInterval: 6000,
          logLevel: 'info',
          autoStart: true,
        },
        limits: { maxConcurrentTasks: 4, maxTokensPerTask: 75000, maxCostPerTask: 15.0, dailyTokenLimit: 1500000, dailyCostLimit: 150.0 },
      };

      const options: DaemonOptions = {
        projectPath: testProjectPath,
        debugMode: true, // Only debugMode explicitly set
        config,
      };

      daemonManager = new DaemonManager(options);
      await daemonManager.startDaemon();

      const forkCall = mockFork.mock.calls[0];
      const env = forkCall[2].env;

      expect(env.APEX_DAEMON_DEBUG).toBe('1'); // Explicit option
      expect(env.APEX_CONFIG_JSON).toBe(JSON.stringify(config)); // Config object passed
      expect(env).not.toHaveProperty('APEX_POLL_INTERVAL'); // Should use config value
      expect(env).not.toHaveProperty('APEX_LOG_LEVEL'); // Should use config value
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle config with invalid JSON serialization', async () => {
      const circularRef: any = { name: 'test' };
      circularRef.self = circularRef; // Create circular reference

      const options: DaemonOptions = {
        projectPath: testProjectPath,
        config: circularRef as any,
      };

      daemonManager = new DaemonManager(options);

      // Should handle JSON.stringify error gracefully
      await expect(daemonManager.startDaemon()).rejects.toThrow();
    });

    it('should handle all possible option combinations', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'comprehensive-test', description: 'test' },
        daemon: {
          pollInterval: 4000,
          logLevel: 'warn',
          autoStart: false,
        },
        limits: { maxConcurrentTasks: 6, maxTokensPerTask: 80000, maxCostPerTask: 12.0, dailyTokenLimit: 1200000, dailyCostLimit: 120.0 },
      };

      const options: DaemonOptions = {
        projectPath: testProjectPath,
        pidFile: '/custom/daemon.pid',
        logFile: '/custom/daemon.log',
        pollIntervalMs: 3500,
        logLevel: 'debug',
        debugMode: true,
        config,
        onOutput: vi.fn(),
        onError: vi.fn(),
      };

      daemonManager = new DaemonManager(options);
      await daemonManager.startDaemon();

      expect(mockFork).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_PROJECT_PATH: testProjectPath,
            APEX_POLL_INTERVAL: '3500',
            APEX_LOG_LEVEL: 'debug',
            APEX_DAEMON_DEBUG: '1',
            APEX_CONFIG_JSON: JSON.stringify(config),
          }),
        })
      );
    });

    it('should handle null and undefined config values gracefully', async () => {
      const config: any = {
        version: '1.0',
        project: { name: 'test', description: 'test' },
        daemon: {
          pollInterval: null,
          logLevel: undefined,
          autoStart: false,
        },
        limits: null,
      };

      const options: DaemonOptions = {
        projectPath: testProjectPath,
        config,
      };

      daemonManager = new DaemonManager(options);
      await daemonManager.startDaemon();

      // Should serialize config even with null/undefined values
      expect(mockFork).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_CONFIG_JSON: JSON.stringify(config),
          }),
        })
      );
    });
  });

  describe('environment variable validation', () => {
    it('should correctly format boolean debugMode values', async () => {
      const testCases = [
        { debugMode: true, expected: '1' },
        { debugMode: false, expected: '0' },
        { debugMode: undefined, expected: undefined },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

        const options: DaemonOptions = {
          projectPath: testProjectPath,
          ...(testCase.debugMode !== undefined && { debugMode: testCase.debugMode }),
        };

        daemonManager = new DaemonManager(options);
        await daemonManager.startDaemon();

        const forkCall = mockFork.mock.calls[0];
        const env = forkCall[2].env;

        if (testCase.expected !== undefined) {
          expect(env.APEX_DAEMON_DEBUG).toBe(testCase.expected);
        } else {
          expect(env).not.toHaveProperty('APEX_DAEMON_DEBUG');
        }
      }
    });

    it('should correctly format pollIntervalMs values', async () => {
      const testCases = [
        { pollIntervalMs: 1000, expected: '1000' },
        { pollIntervalMs: 0, expected: '0' },
        { pollIntervalMs: 999999, expected: '999999' },
        { pollIntervalMs: undefined, expected: undefined },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

        const options: DaemonOptions = {
          projectPath: testProjectPath,
          ...(testCase.pollIntervalMs !== undefined && { pollIntervalMs: testCase.pollIntervalMs }),
        };

        daemonManager = new DaemonManager(options);
        await daemonManager.startDaemon();

        const forkCall = mockFork.mock.calls[0];
        const env = forkCall[2].env;

        if (testCase.expected !== undefined) {
          expect(env.APEX_POLL_INTERVAL).toBe(testCase.expected);
        } else {
          expect(env).not.toHaveProperty('APEX_POLL_INTERVAL');
        }
      }
    });

    it('should correctly pass through logLevel values', async () => {
      const testCases = [
        'debug', 'info', 'warn', 'error'
      ] as const;

      for (const logLevel of testCases) {
        vi.clearAllMocks();
        (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

        const options: DaemonOptions = {
          projectPath: testProjectPath,
          logLevel,
        };

        daemonManager = new DaemonManager(options);
        await daemonManager.startDaemon();

        const forkCall = mockFork.mock.calls[0];
        const env = forkCall[2].env;

        expect(env.APEX_LOG_LEVEL).toBe(logLevel);
      }
    });
  });

  describe('config performance optimization', () => {
    it('should avoid re-serializing identical config objects', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'performance-test', description: 'test' },
        daemon: { pollInterval: 5000 },
        limits: { maxConcurrentTasks: 3, maxTokensPerTask: 50000, maxCostPerTask: 10.0, dailyTokenLimit: 1000000, dailyCostLimit: 100.0 },
      };

      const options: DaemonOptions = {
        projectPath: testProjectPath,
        config,
      };

      // First daemon start
      const manager1 = new DaemonManager(options);
      await manager1.startDaemon();

      // Stop first daemon
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));
      (fs.unlink as any).mockResolvedValue(undefined);
      mockKill.mockImplementation((pid, signal) => {
        if (signal === 0) throw { code: 'ESRCH' };
        return undefined;
      });
      await manager1.stopDaemon();

      // Second daemon start with same config
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      vi.clearAllMocks();
      mockFork.mockReturnValue(mockChild);

      const manager2 = new DaemonManager(options);
      await manager2.startDaemon();

      // Both should use same serialized config
      expect(mockFork).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_CONFIG_JSON: JSON.stringify(config),
          }),
        })
      );
    });
  });
});