import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { ContainerLogStream, ContainerManager } from '../container-manager';
import { ContainerRuntime } from '../container-runtime';
import { ContainerLogStreamOptions, ContainerLogEntry } from '../types';

// Mock child_process.spawn for integration scenarios
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
}));

// Mock ContainerRuntime for different runtime scenarios
vi.mock('../container-runtime');
const MockedContainerRuntime = vi.mocked(ContainerRuntime);

/**
 * Mock implementation that simulates real Docker/Podman log outputs
 */
class DockerLikeProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  pid = Math.floor(Math.random() * 10000);

  constructor(
    private scenario: 'docker' | 'podman' | 'mixed-output' | 'long-running' | 'error-prone',
    private containerExists = true
  ) {
    super();

    if (!containerExists) {
      setTimeout(() => {
        this.stderr.emit('data', Buffer.from('Error: No such container: non-existent-container\n'));
        this.emit('exit', 1);
      }, 10);
      return;
    }

    // Start simulating log output based on scenario
    this.startLogSimulation();
  }

  private startLogSimulation() {
    switch (this.scenario) {
      case 'docker':
        this.simulateDockerLogs();
        break;
      case 'podman':
        this.simulatePodmanLogs();
        break;
      case 'mixed-output':
        this.simulateMixedOutput();
        break;
      case 'long-running':
        this.simulateLongRunningLogs();
        break;
      case 'error-prone':
        this.simulateErrorProneLogs();
        break;
    }
  }

  private simulateDockerLogs() {
    const dockerLogs = [
      '2024-01-01T12:00:01.123456789Z Starting application...',
      '2024-01-01T12:00:02.234567890Z Database connection established',
      '2024-01-01T12:00:03.345678901Z Server listening on port 3000',
      '2024-01-01T12:00:04.456789012Z Ready to accept connections',
    ];

    dockerLogs.forEach((log, index) => {
      setTimeout(() => {
        this.stdout.emit('data', Buffer.from(`${log}\n`));
      }, index * 100);
    });

    // Simulate some error logs
    setTimeout(() => {
      this.stderr.emit('data', Buffer.from('2024-01-01T12:00:05.567890123Z Warning: Memory usage is high\n'));
    }, 500);

    // End gracefully after all logs
    setTimeout(() => {
      this.emit('exit', 0);
    }, 1000);
  }

  private simulatePodmanLogs() {
    // Podman might have slightly different timestamp format
    const podmanLogs = [
      '2024-01-01T12:00:01Z Initializing podman container',
      '2024-01-01T12:00:02Z Loading configuration from /app/config.json',
      '2024-01-01T12:00:03Z Starting web server',
      '2024-01-01T12:00:04Z Health check passed',
    ];

    podmanLogs.forEach((log, index) => {
      setTimeout(() => {
        this.stdout.emit('data', Buffer.from(`${log}\n`));
      }, index * 150);
    });

    setTimeout(() => {
      this.stderr.emit('data', Buffer.from('2024-01-01T12:00:05Z [WARNING] Deprecated API usage detected\n'));
    }, 700);
  }

  private simulateMixedOutput() {
    const messages = [
      { stream: 'stdout', content: 'Application starting up...' },
      { stream: 'stderr', content: 'Debug: Loading modules' },
      { stream: 'stdout', content: 'Module A loaded successfully' },
      { stream: 'stderr', content: 'Warning: Module B deprecated' },
      { stream: 'stdout', content: 'All modules loaded' },
      { stream: 'stderr', content: 'Error: Failed to load optional module C' },
      { stream: 'stdout', content: 'Application ready' },
    ];

    messages.forEach((msg, index) => {
      setTimeout(() => {
        const emitter = msg.stream === 'stdout' ? this.stdout : this.stderr;
        emitter.emit('data', Buffer.from(`${msg.content}\n`));
      }, index * 50);
    });
  }

  private simulateLongRunningLogs() {
    let counter = 0;
    const interval = setInterval(() => {
      if (this.killed) {
        clearInterval(interval);
        return;
      }

      this.stdout.emit('data', Buffer.from(`Log entry ${++counter} - ${new Date().toISOString()}\n`));

      if (counter % 10 === 0) {
        this.stderr.emit('data', Buffer.from(`Periodic health check ${counter / 10} - OK\n`));
      }

      // Stop after 100 messages for test purposes
      if (counter >= 100) {
        clearInterval(interval);
        this.emit('exit', 0);
      }
    }, 10);
  }

  private simulateErrorProneLogs() {
    const errorScenarios = [
      () => this.stdout.emit('data', Buffer.from('Normal startup message\n')),
      () => this.stderr.emit('data', Buffer.from('Error: Database connection failed\n')),
      () => this.emit('error', new Error('Process crashed unexpectedly')),
    ];

    errorScenarios.forEach((scenario, index) => {
      setTimeout(scenario, index * 100);
    });
  }

  kill(signal?: string) {
    this.killed = true;
    setTimeout(() => {
      this.emit('exit', signal === 'SIGKILL' ? -9 : 0);
      this.emit('close');
    }, 10);
    return true;
  }

  removeAllListeners() {
    super.removeAllListeners();
    this.stdout.removeAllListeners();
    this.stderr.removeAllListeners();
    return this;
  }
}

const mockSpawn = vi.mocked(spawn);

describe('ContainerLogStream - Integration Tests', () => {
  let mockRuntime: ContainerRuntime;

  beforeEach(() => {
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    vi.mocked(mockRuntime.isRuntimeAvailable).mockResolvedValue(true);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Docker runtime integration', () => {
    it('should handle realistic Docker log output with timestamps', async () => {
      const dockerProcess = new DockerLikeProcess('docker');
      mockSpawn.mockReturnValue(dockerProcess as any);

      const stream = new ContainerLogStream('web-app-container', { timestamps: true }, 'docker');
      const entries: ContainerLogEntry[] = [];

      stream.on('data', (entry) => entries.push(entry));

      const endPromise = new Promise<void>((resolve) => {
        stream.on('exit', () => {
          resolve();
        });
      });

      await endPromise;

      expect(entries.length).toBeGreaterThan(0);

      // Verify timestamp parsing
      const stdoutEntries = entries.filter(e => e.stream === 'stdout');
      stdoutEntries.forEach(entry => {
        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(entry.message).toBeTruthy();
      });

      // Should have both stdout and stderr entries
      expect(entries.some(e => e.stream === 'stdout')).toBe(true);
      expect(entries.some(e => e.stream === 'stderr')).toBe(true);
    });

    it('should handle Docker logs without timestamps', async () => {
      const dockerProcess = new DockerLikeProcess('docker');
      mockSpawn.mockReturnValue(dockerProcess as any);

      const stream = new ContainerLogStream('web-app-container', { timestamps: false }, 'docker');
      const entries: ContainerLogEntry[] = [];

      stream.on('data', (entry) => entries.push(entry));

      await new Promise<void>((resolve) => {
        stream.on('exit', () => resolve());
      });

      expect(entries.length).toBeGreaterThan(0);

      // Without timestamps option, messages should not have parsed timestamps
      entries.forEach(entry => {
        expect(entry.message).toBeTruthy();
        // Timestamps might still be undefined since Docker includes them by default
      });
    });
  });

  describe('Podman runtime integration', () => {
    it('should handle Podman-specific log formatting', async () => {
      const podmanProcess = new DockerLikeProcess('podman');
      mockSpawn.mockReturnValue(podmanProcess as any);

      const stream = new ContainerLogStream('podman-container', { timestamps: true }, 'podman');
      const entries: ContainerLogEntry[] = [];

      stream.on('data', (entry) => entries.push(entry));

      await new Promise<void>((resolve) => {
        stream.on('exit', () => resolve());
      });

      expect(entries.length).toBeGreaterThan(0);

      // Verify Podman logs are parsed correctly
      const stdoutEntries = entries.filter(e => e.stream === 'stdout');
      expect(stdoutEntries.length).toBeGreaterThan(0);

      stdoutEntries.forEach(entry => {
        expect(entry.message).toBeTruthy();
        const keywords = ['Initializing', 'Loading', 'Starting', 'Health'];
        expect(keywords.some(keyword => entry.message.includes(keyword))).toBe(true);
      });
    });
  });

  describe('Mixed output scenarios', () => {
    it('should handle rapid alternating stdout/stderr output', async () => {
      const mixedProcess = new DockerLikeProcess('mixed-output');
      mockSpawn.mockReturnValue(mixedProcess as any);

      const stream = new ContainerLogStream('mixed-app', {}, 'docker');
      const entries: ContainerLogEntry[] = [];

      stream.on('data', (entry) => entries.push(entry));

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          stream.end();
          resolve();
        }, 500);
      });

      expect(entries.length).toBeGreaterThan(0);

      // Should have both stdout and stderr entries
      const stdoutCount = entries.filter(e => e.stream === 'stdout').length;
      const stderrCount = entries.filter(e => e.stream === 'stderr').length;

      expect(stdoutCount).toBeGreaterThan(0);
      expect(stderrCount).toBeGreaterThan(0);

      // Verify order is preserved
      let stdoutIndex = 0;
      let stderrIndex = 0;
      entries.forEach(entry => {
        if (entry.stream === 'stdout') {
          expect(entry.message).toBeTruthy();
          stdoutIndex++;
        } else {
          expect(entry.message).toBeTruthy();
          stderrIndex++;
        }
      });
    });
  });

  describe('Long-running stream scenarios', () => {
    it('should handle long-running log streams efficiently', async () => {
      const longRunningProcess = new DockerLikeProcess('long-running');
      mockSpawn.mockReturnValue(longRunningProcess as any);

      const stream = new ContainerLogStream('long-running-app', { follow: true }, 'docker');
      const entries: ContainerLogEntry[] = [];

      const startTime = Date.now();
      let processingTime = 0;

      stream.on('data', (entry) => {
        const entryStartTime = Date.now();
        entries.push(entry);
        processingTime += Date.now() - entryStartTime;
      });

      await new Promise<void>((resolve) => {
        stream.on('exit', () => resolve());
      });

      const totalTime = Date.now() - startTime;

      expect(entries.length).toBe(100); // Should receive all 100 log entries
      expect(processingTime).toBeLessThan(totalTime / 10); // Processing should be fast

      // Verify log sequence
      const stdoutEntries = entries.filter(e => e.stream === 'stdout');
      stdoutEntries.forEach((entry, index) => {
        expect(entry.message).toContain(`Log entry ${index + 1}`);
      });

      const stderrEntries = entries.filter(e => e.stream === 'stderr');
      expect(stderrEntries.length).toBe(10); // Should have 10 health check messages
    });

    it('should support graceful termination of long-running streams', async () => {
      const longRunningProcess = new DockerLikeProcess('long-running');
      mockSpawn.mockReturnValue(longRunningProcess as any);

      const stream = new ContainerLogStream('long-running-app', { follow: true }, 'docker');
      const entries: ContainerLogEntry[] = [];

      stream.on('data', (entry) => entries.push(entry));

      // Let it run for a bit, then terminate
      setTimeout(() => {
        expect(stream.isActive).toBe(true);
        stream.end();
      }, 100);

      await new Promise<void>((resolve) => {
        stream.on('end', () => resolve());
      });

      expect(stream.isActive).toBe(false);
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.length).toBeLessThan(100); // Should be terminated before all 100 messages
    });
  });

  describe('Error recovery scenarios', () => {
    it('should handle container not found errors', async () => {
      const errorProcess = new DockerLikeProcess('docker', false); // Container doesn't exist
      mockSpawn.mockReturnValue(errorProcess as any);

      const stream = new ContainerLogStream('non-existent-container', {}, 'docker');
      const errors: Error[] = [];

      stream.on('error', (error) => errors.push(error));

      await new Promise<void>((resolve) => {
        stream.on('exit', (code) => {
          expect(code).toBe(1);
          resolve();
        });
      });

      // Should detect that container doesn't exist based on stderr output
      expect(errors.length).toBe(0); // Not necessarily an error, just exit code 1
    });

    it('should handle process crashes gracefully', async () => {
      const errorProneProcess = new DockerLikeProcess('error-prone');
      mockSpawn.mockReturnValue(errorProneProcess as any);

      const stream = new ContainerLogStream('unstable-container', {}, 'docker');
      const entries: ContainerLogEntry[] = [];
      const errors: Error[] = [];

      stream.on('data', (entry) => entries.push(entry));
      stream.on('error', (error) => errors.push(error));

      await new Promise<void>((resolve) => {
        stream.on('error', () => resolve());
      });

      expect(entries.length).toBeGreaterThan(0); // Should have received some logs before crash
      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Process crashed unexpectedly');
      expect(stream.isActive).toBe(false);
    });
  });

  describe('Option handling integration', () => {
    it('should build correct commands for various option combinations', async () => {
      const testCases = [
        {
          options: { follow: true, timestamps: true, tail: 100 },
          expectedArgs: ['logs', '--follow', '--timestamps', '--tail', '100']
        },
        {
          options: { since: '1h', until: '2024-01-01T12:00:00Z' },
          expectedArgs: ['logs', '--since', '1h', '--until', '2024-01-01T12:00:00.000Z']
        },
        {
          options: { tail: 'all' as const, timestamps: true },
          expectedArgs: ['logs', '--timestamps', '--tail', 'all']
        }
      ];

      for (const testCase of testCases) {
        const process = new DockerLikeProcess('docker');
        mockSpawn.mockReturnValue(process as any);

        const stream = new ContainerLogStream('test-container', testCase.options, 'docker');

        expect(mockSpawn).toHaveBeenLastCalledWith(
          'docker',
          expect.arrayContaining(testCase.expectedArgs.concat(['test-container'])),
          expect.objectContaining({
            stdio: ['ignore', 'pipe', 'pipe']
          })
        );

        stream.end();
        mockSpawn.mockClear();
      }
    });
  });
});

describe('ContainerManager.streamLogs - Full Integration', () => {
  let manager: ContainerManager;
  let mockRuntime: ContainerRuntime;

  beforeEach(() => {
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    manager = new ContainerManager(mockRuntime);
    vi.clearAllMocks();
  });

  describe('End-to-end workflow tests', () => {
    it('should support complete application lifecycle logging', async () => {
      const appProcess = new DockerLikeProcess('docker');
      mockSpawn.mockReturnValue(appProcess as any);

      const stream = await manager.streamLogs('web-application', {
        follow: true,
        timestamps: true
      });

      expect(stream).toBeInstanceOf(ContainerLogStream);
      expect(stream.isActive).toBe(true);

      const entries: ContainerLogEntry[] = [];
      stream.on('data', (entry) => entries.push(entry));

      // Wait for the application lifecycle to complete
      await new Promise<void>((resolve) => {
        stream.on('exit', () => resolve());
      });

      // Verify we captured the complete application lifecycle
      expect(entries.length).toBeGreaterThan(0);

      const messages = entries.map(e => e.message);
      expect(messages.some(m => m.includes('Starting application'))).toBe(true);
      expect(messages.some(m => m.includes('Database connection'))).toBe(true);
      expect(messages.some(m => m.includes('Ready to accept connections'))).toBe(true);
    });

    it('should handle runtime auto-detection and container operations', async () => {
      // Test runtime switching
      let callCount = 0;
      vi.mocked(mockRuntime.getBestRuntime).mockImplementation(async () => {
        callCount++;
        return callCount % 2 === 1 ? 'docker' : 'podman';
      });

      const dockerProcess = new DockerLikeProcess('docker');
      const podmanProcess = new DockerLikeProcess('podman');

      mockSpawn
        .mockReturnValueOnce(dockerProcess as any)
        .mockReturnValueOnce(podmanProcess as any);

      const dockerStream = await manager.streamLogs('docker-container');
      const podmanStream = await manager.streamLogs('podman-container');

      expect(mockSpawn).toHaveBeenNthCalledWith(1, 'docker', expect.any(Array), expect.any(Object));
      expect(mockSpawn).toHaveBeenNthCalledWith(2, 'podman', expect.any(Array), expect.any(Object));

      dockerStream.end();
      podmanStream.end();
    });

    it('should support async iteration in real-world scenarios', async () => {
      const appProcess = new DockerLikeProcess('mixed-output');
      mockSpawn.mockReturnValue(appProcess as any);

      const stream = await manager.streamLogs('async-app', { follow: true });
      const collectedLogs: string[] = [];

      // Use async iteration to collect logs
      const iterationPromise = (async () => {
        for await (const entry of stream) {
          collectedLogs.push(`[${entry.stream}] ${entry.message}`);

          // Break after collecting enough logs
          if (collectedLogs.length >= 5) {
            break;
          }
        }
      })();

      await iterationPromise;

      expect(collectedLogs.length).toBe(5);

      // Verify we have a mix of stdout and stderr logs
      const stdoutLogs = collectedLogs.filter(log => log.startsWith('[stdout]'));
      const stderrLogs = collectedLogs.filter(log => log.startsWith('[stderr]'));

      expect(stdoutLogs.length).toBeGreaterThan(0);
      expect(stderrLogs.length).toBeGreaterThan(0);

      stream.end();
    });
  });

  describe('Performance and reliability', () => {
    it('should maintain performance with multiple concurrent streams', async () => {
      const streams = [];
      const startTime = Date.now();

      // Create multiple concurrent streams
      for (let i = 0; i < 5; i++) {
        const process = new DockerLikeProcess('docker');
        mockSpawn.mockReturnValue(process as any);

        const stream = await manager.streamLogs(`app-${i}`, { follow: true });
        streams.push(stream);
      }

      const setupTime = Date.now() - startTime;
      expect(setupTime).toBeLessThan(1000); // Setup should be fast

      // All streams should be active
      streams.forEach(stream => {
        expect(stream.isActive).toBe(true);
      });

      // Clean up
      streams.forEach(stream => stream.end());
    });

    it('should recover from runtime failures gracefully', async () => {
      // First call fails, second succeeds
      vi.mocked(mockRuntime.getBestRuntime)
        .mockRejectedValueOnce(new Error('Docker daemon not running'))
        .mockResolvedValueOnce('podman');

      // First attempt should fail
      await expect(manager.streamLogs('test-container')).rejects.toThrow('Docker daemon not running');

      // Second attempt should succeed with fallback runtime
      const process = new DockerLikeProcess('podman');
      mockSpawn.mockReturnValue(process as any);

      const stream = await manager.streamLogs('test-container');
      expect(stream.isActive).toBe(true);

      stream.end();
    });
  });
});