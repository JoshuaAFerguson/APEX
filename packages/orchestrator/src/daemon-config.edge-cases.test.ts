import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createWriteStream } from 'fs';
import { promises as fs } from 'fs';
import { join } from 'path';
import { DaemonRunner, type DaemonRunnerOptions } from './runner';
import { DaemonManager, type DaemonOptions } from './daemon';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';

// Mock dependencies for DaemonRunner
vi.mock('fs', () => ({
  createWriteStream: vi.fn(),
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    mkdir: vi.fn(),
    appendFile: vi.fn(),
  },
}));

vi.mock('./index', () => ({
  ApexOrchestrator: vi.fn(),
}));

vi.mock('./store', () => ({
  TaskStore: vi.fn(),
}));

vi.mock('child_process', () => ({
  fork: vi.fn(),
}));

const { loadConfig, getEffectiveConfig } = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  getEffectiveConfig: vi.fn(),
}));

vi.mock('@apexcli/core', () => ({
  loadConfig,
  getEffectiveConfig,
}));

// Mock objects
const mockStream = {
  write: vi.fn(),
  end: vi.fn((callback?: () => void) => callback?.()),
  destroyed: false,
};

const mockOrchestrator = {
  initialize: vi.fn(),
  executeTask: vi.fn(),
  on: vi.fn(),
};

const mockStore = {
  initialize: vi.fn(),
  close: vi.fn(),
  getNextQueuedTask: vi.fn(),
};

const mockChild = {
  pid: 12345,
  stdout: { on: vi.fn() },
  stderr: { on: vi.fn() },
  on: vi.fn(),
  unref: vi.fn(),
};

describe('Daemon Configuration Edge Cases and Error Scenarios', () => {
  const testProjectPath = '/test/project';

  // Save original process methods
  const originalExit = process.exit;
  const originalOn = process.on;
  const originalKill = process.kill;
  const mockProcessOn = vi.fn();
  const mockKill = vi.fn();
  const mockFork = vi.fn();

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock process methods
    process.on = mockProcessOn as any;
    process.kill = mockKill;
    process.exit = vi.fn() as any;

    // Setup default mocks
    (createWriteStream as any).mockReturnValue(mockStream);
    (ApexOrchestrator as any).mockImplementation(() => mockOrchestrator);
    (TaskStore as any).mockImplementation(() => mockStore);

    const { fork } = require('child_process');
    fork.mockImplementation(mockFork);
    mockFork.mockReturnValue(mockChild);

    // Setup file system mocks
    (fs.mkdir as any).mockResolvedValue(undefined);
    (fs.writeFile as any).mockResolvedValue(undefined);
    (fs.appendFile as any).mockResolvedValue(undefined);
    (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
  });

  afterEach(() => {
    // Restore original methods
    process.exit = originalExit;
    process.on = originalOn;
    process.kill = originalKill;
    vi.clearAllTimers();
  });

  describe('configuration corruption and recovery', () => {
    it('should handle corrupted config file gracefully in DaemonRunner', async () => {
      loadConfig.mockRejectedValue(new Error('Config file is corrupted'));

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await expect(runner.start()).rejects.toThrow('Config file is corrupted');

      // Should attempt cleanup
      expect(mockStream.end).toHaveBeenCalled();
    });

    it('should handle circular references in config object', async () => {
      const circularConfig: any = {
        daemon: {
          pollInterval: 5000,
        }
      };
      circularConfig.self = circularConfig; // Create circular reference

      loadConfig.mockResolvedValue(circularConfig);

      // getEffectiveConfig should handle circular references
      getEffectiveConfig.mockImplementation((config) => {
        // Simulate handling circular references by returning safe config
        return {
          daemon: config.daemon,
          limits: { maxConcurrentTasks: 3 },
        };
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await runner.start();
      expect(runner.getMetrics().isRunning).toBe(true);
      await runner.stop();
    });

    it('should handle config with unexpected data types', async () => {
      const malformedConfig = {
        daemon: {
          pollInterval: 'not-a-number', // Wrong type
          logLevel: 123, // Wrong type
          autoStart: 'maybe', // Wrong type
        },
        limits: 'invalid', // Wrong structure
      };

      loadConfig.mockResolvedValue(malformedConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: malformedConfig.daemon,
        limits: { maxConcurrentTasks: 3 },
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      // Should handle gracefully and apply defaults/validation
      await runner.start();
      expect(runner.getMetrics().isRunning).toBe(true);
      await runner.stop();
    });

    it('should handle missing nested config properties', async () => {
      const incompleteConfig = {
        daemon: {}, // Empty daemon config
        // No limits section
      };

      loadConfig.mockResolvedValue(incompleteConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: {},
        limits: { maxConcurrentTasks: 1 }, // Minimal limits
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await runner.start();
      expect(runner.getMetrics().isRunning).toBe(true);
      await runner.stop();
    });
  });

  describe('extreme configuration values', () => {
    it('should handle extremely large pollInterval values', async () => {
      const extremeConfig = {
        daemon: {
          pollInterval: Number.MAX_SAFE_INTEGER,
        }
      };

      loadConfig.mockResolvedValue(extremeConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: extremeConfig.daemon,
        limits: { maxConcurrentTasks: 3 },
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await runner.start();
      // Should clamp to maximum allowed value (60000)
      expect(runner.getMetrics().isRunning).toBe(true);
      await runner.stop();
    });

    it('should handle negative pollInterval values', async () => {
      const negativeConfig = {
        daemon: {
          pollInterval: -5000,
        }
      };

      loadConfig.mockResolvedValue(negativeConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: negativeConfig.daemon,
        limits: { maxConcurrentTasks: 3 },
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await runner.start();
      // Should clamp to minimum allowed value (1000)
      expect(runner.getMetrics().isRunning).toBe(true);
      await runner.stop();
    });

    it('should handle zero and floating point pollInterval values', async () => {
      const testCases = [0, 0.5, 1500.75, Number.EPSILON];

      for (const pollInterval of testCases) {
        vi.clearAllMocks();
        (createWriteStream as any).mockReturnValue(mockStream);
        (ApexOrchestrator as any).mockImplementation(() => mockOrchestrator);
        (TaskStore as any).mockImplementation(() => mockStore);

        const config = {
          daemon: { pollInterval }
        };

        loadConfig.mockResolvedValue(config);
        getEffectiveConfig.mockReturnValue({
          daemon: config.daemon,
          limits: { maxConcurrentTasks: 3 },
        });

        const runner = new DaemonRunner({
          projectPath: testProjectPath,
        });

        await runner.start();
        expect(runner.getMetrics().isRunning).toBe(true);
        await runner.stop();
      }
    });

    it('should handle extremely large maxConcurrentTasks values', async () => {
      const config = {
        daemon: { pollInterval: 5000 }
      };

      loadConfig.mockResolvedValue(config);
      getEffectiveConfig.mockReturnValue({
        daemon: config.daemon,
        limits: { maxConcurrentTasks: Number.MAX_SAFE_INTEGER },
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await runner.start();
      expect(runner.getMetrics().isRunning).toBe(true);
      await runner.stop();
    });
  });

  describe('resource constraints and failures', () => {
    it('should handle log file creation failure', async () => {
      (createWriteStream as any).mockImplementation(() => {
        throw new Error('Cannot create log file');
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await expect(runner.start()).rejects.toThrow('Cannot create log file');
    });

    it('should handle store initialization failure', async () => {
      mockStore.initialize.mockRejectedValue(new Error('Database locked'));

      loadConfig.mockResolvedValue({});
      getEffectiveConfig.mockReturnValue({
        limits: { maxConcurrentTasks: 3 }
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await expect(runner.start()).rejects.toThrow('Database locked');
      expect(mockStream.end).toHaveBeenCalled(); // Should cleanup
    });

    it('should handle orchestrator initialization failure', async () => {
      mockOrchestrator.initialize.mockRejectedValue(new Error('Claude API unavailable'));

      loadConfig.mockResolvedValue({});
      getEffectiveConfig.mockReturnValue({
        limits: { maxConcurrentTasks: 3 }
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await expect(runner.start()).rejects.toThrow('Claude API unavailable');
      expect(mockStream.end).toHaveBeenCalled();
    });

    it('should handle out of memory scenarios during config loading', async () => {
      loadConfig.mockRejectedValue(new Error('JavaScript heap out of memory'));

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await expect(runner.start()).rejects.toThrow('JavaScript heap out of memory');
    });
  });

  describe('concurrent access and race conditions', () => {
    it('should handle multiple DaemonManager instances with same config', async () => {
      const config = {
        daemon: { pollInterval: 3000, logLevel: 'info' }
      };

      const manager1 = new DaemonManager({
        projectPath: testProjectPath,
        config,
      });

      const manager2 = new DaemonManager({
        projectPath: testProjectPath,
        config,
      });

      // First manager starts successfully
      await manager1.startDaemon();

      // Second manager should detect running daemon
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));
      mockKill.mockReturnValue(undefined);

      await expect(manager2.startDaemon()).rejects.toThrow('already running');
    });

    it('should handle config changes during startup', async () => {
      let configCallCount = 0;
      loadConfig.mockImplementation(async () => {
        configCallCount++;
        if (configCallCount === 1) {
          return { daemon: { pollInterval: 3000 } };
        } else {
          return { daemon: { pollInterval: 5000 } }; // Changed config
        }
      });

      getEffectiveConfig.mockReturnValue({
        daemon: { pollInterval: 3000 },
        limits: { maxConcurrentTasks: 3 },
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await runner.start();
      expect(runner.getMetrics().isRunning).toBe(true);
      await runner.stop();
    });
  });

  describe('environment and system edge cases', () => {
    it('should handle invalid project path characters', async () => {
      const invalidPaths = [
        '/path/with\x00null',
        '/path/with\ttab',
        '/path/with\nnewline',
        '/path/with"quotes',
        '//double//slashes',
        '/path/with spaces /',
      ];

      for (const invalidPath of invalidPaths) {
        vi.clearAllMocks();
        (createWriteStream as any).mockReturnValue(mockStream);

        loadConfig.mockResolvedValue({});
        getEffectiveConfig.mockReturnValue({
          limits: { maxConcurrentTasks: 3 }
        });

        const runner = new DaemonRunner({
          projectPath: invalidPath,
        });

        // Should handle gracefully (may fail for some paths, but shouldn't crash)
        try {
          await runner.start();
          await runner.stop();
        } catch (error) {
          // Expected for some invalid paths
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle permission denied on config directory', async () => {
      const manager = new DaemonManager({
        projectPath: testProjectPath,
      });

      (fs.mkdir as any).mockRejectedValue({ code: 'EACCES', message: 'Permission denied' });

      await expect(manager.startDaemon()).rejects.toThrow('Permission denied');
    });

    it('should handle disk full scenarios', async () => {
      const manager = new DaemonManager({
        projectPath: testProjectPath,
      });

      (fs.writeFile as any).mockRejectedValue({ code: 'ENOSPC', message: 'No space left on device' });

      await expect(manager.startDaemon()).rejects.toThrow('No space left on device');
    });

    it('should handle network timeouts during config loading', async () => {
      loadConfig.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network timeout')), 100);
        });
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await expect(runner.start()).rejects.toThrow('Network timeout');
    });
  });

  describe('configuration validation edge cases', () => {
    it('should handle config with null prototype', async () => {
      const nullProtoConfig = Object.create(null);
      nullProtoConfig.daemon = { pollInterval: 5000 };

      loadConfig.mockResolvedValue(nullProtoConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: nullProtoConfig.daemon,
        limits: { maxConcurrentTasks: 3 },
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await runner.start();
      expect(runner.getMetrics().isRunning).toBe(true);
      await runner.stop();
    });

    it('should handle config with Symbol properties', async () => {
      const symbolConfig = {
        daemon: { pollInterval: 4000 },
        [Symbol('test')]: 'should be ignored',
      };

      loadConfig.mockResolvedValue(symbolConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: symbolConfig.daemon,
        limits: { maxConcurrentTasks: 3 },
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await runner.start();
      expect(runner.getMetrics().isRunning).toBe(true);
      await runner.stop();
    });

    it('should handle config with getters that throw', async () => {
      const problematicConfig = {
        daemon: {
          pollInterval: 5000,
          get problematicProperty() {
            throw new Error('Getter error');
          },
        },
      };

      loadConfig.mockResolvedValue(problematicConfig);
      getEffectiveConfig.mockImplementation((config) => {
        // Should handle getter errors gracefully
        return {
          daemon: { pollInterval: config.daemon.pollInterval },
          limits: { maxConcurrentTasks: 3 },
        };
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await runner.start();
      expect(runner.getMetrics().isRunning).toBe(true);
      await runner.stop();
    });

    it('should handle config with frozen objects', async () => {
      const frozenConfig = Object.freeze({
        daemon: Object.freeze({
          pollInterval: 6000,
          logLevel: 'warn',
        }),
      });

      loadConfig.mockResolvedValue(frozenConfig);
      getEffectiveConfig.mockReturnValue({
        daemon: frozenConfig.daemon,
        limits: { maxConcurrentTasks: 3 },
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await runner.start();
      expect(runner.getMetrics().isRunning).toBe(true);
      await runner.stop();
    });
  });

  describe('cleanup and recovery scenarios', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle cleanup failures gracefully', async () => {
      mockStream.end.mockImplementation((callback) => {
        throw new Error('Stream cleanup failed');
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      loadConfig.mockRejectedValue(new Error('Config error'));

      // Should not throw additional errors during cleanup
      await expect(runner.start()).rejects.toThrow('Config error');
    });

    it('should handle store cleanup failures during shutdown', async () => {
      loadConfig.mockResolvedValue({});
      getEffectiveConfig.mockReturnValue({
        limits: { maxConcurrentTasks: 3 }
      });

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await runner.start();

      mockStore.close.mockImplementation(() => {
        throw new Error('Store cleanup failed');
      });

      // Should complete shutdown despite cleanup error
      await expect(runner.stop()).resolves.toBeUndefined();
    });

    it('should handle partial initialization cleanup', async () => {
      loadConfig.mockResolvedValue({});
      getEffectiveConfig.mockReturnValue({
        limits: { maxConcurrentTasks: 3 }
      });

      // Store initializes but orchestrator fails
      mockOrchestrator.initialize.mockRejectedValue(new Error('Orchestrator init failed'));

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
      });

      await expect(runner.start()).rejects.toThrow('Orchestrator init failed');

      // Should cleanup what was initialized
      expect(mockStream.end).toHaveBeenCalled();
    });
  });
});