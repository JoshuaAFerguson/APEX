import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { ContainerLogStream, ContainerManager } from '../container-manager';
import { ContainerRuntime } from '../container-runtime';
import { ContainerLogStreamOptions, ContainerLogEntry } from '../types';

// Mock child_process.spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
}));

// Mock ContainerRuntime
vi.mock('../container-runtime');
const MockedContainerRuntime = vi.mocked(ContainerRuntime);

// Mock ChildProcess
class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;

  kill(signal?: string) {
    this.killed = true;
    this.emit('exit', 0);
    this.emit('close');
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

describe('ContainerLogStream', () => {
  let mockProcess: MockChildProcess;
  let mockRuntime: ContainerRuntime;

  beforeEach(() => {
    mockProcess = new MockChildProcess();
    mockSpawn.mockReturnValue(mockProcess as any);

    // Create a mock runtime
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    vi.mocked(mockRuntime.isRuntimeAvailable).mockResolvedValue(true);

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
    if (mockProcess) {
      mockProcess.removeAllListeners();
    }
  });

  describe('constructor and basic functionality', () => {
    it('should create a log stream and start streaming', () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');

      expect(mockSpawn).toHaveBeenCalledWith('docker', ['logs', 'test-container'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      expect(stream.isActive).toBe(true);
    });

    it('should build command with follow option', () => {
      const options: ContainerLogStreamOptions = { follow: true };
      new ContainerLogStream('test-container', options, 'docker');

      expect(mockSpawn).toHaveBeenCalledWith('docker', ['logs', '--follow', 'test-container'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });

    it('should build command with timestamps option', () => {
      const options: ContainerLogStreamOptions = { timestamps: true };
      new ContainerLogStream('test-container', options, 'docker');

      expect(mockSpawn).toHaveBeenCalledWith('docker', ['logs', '--timestamps', 'test-container'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });

    it('should build command with tail option', () => {
      const options: ContainerLogStreamOptions = { tail: 100 };
      new ContainerLogStream('test-container', options, 'docker');

      expect(mockSpawn).toHaveBeenCalledWith('docker', ['logs', '--tail', '100', 'test-container'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });

    it('should build command with since option', () => {
      const since = new Date('2024-01-01T12:00:00Z');
      const options: ContainerLogStreamOptions = { since };
      new ContainerLogStream('test-container', options, 'docker');

      expect(mockSpawn).toHaveBeenCalledWith('docker', ['logs', '--since', '2024-01-01T12:00:00.000Z', 'test-container'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });

    it('should build command with until option', () => {
      const until = new Date('2024-01-01T13:00:00Z');
      const options: ContainerLogStreamOptions = { until };
      new ContainerLogStream('test-container', options, 'docker');

      expect(mockSpawn).toHaveBeenCalledWith('docker', ['logs', '--until', '2024-01-01T13:00:00.000Z', 'test-container'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });

    it('should build command with all options', () => {
      const options: ContainerLogStreamOptions = {
        follow: true,
        timestamps: true,
        tail: 50,
        since: '2024-01-01T12:00:00Z',
        until: '2024-01-01T13:00:00Z'
      };
      new ContainerLogStream('test-container', options, 'docker');

      expect(mockSpawn).toHaveBeenCalledWith('docker', [
        'logs',
        '--follow',
        '--timestamps',
        '--since', '2024-01-01T12:00:00.000Z',
        '--until', '2024-01-01T13:00:00.000Z',
        '--tail', '50',
        'test-container'
      ], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });
  });

  describe('log parsing and events', () => {
    it('should emit data events for log lines', (done) => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');
      const expectedEntry: ContainerLogEntry = {
        message: 'Hello World',
        stream: 'stdout',
        raw: 'Hello World'
      };

      stream.on('data', (entry: ContainerLogEntry) => {
        expect(entry.message).toBe(expectedEntry.message);
        expect(entry.stream).toBe(expectedEntry.stream);
        expect(entry.raw).toBe(expectedEntry.raw);
        done();
      });

      // Simulate stdout data
      mockProcess.stdout.emit('data', Buffer.from('Hello World\n'));
    });

    it('should parse timestamp when timestamps option is enabled', (done) => {
      const options: ContainerLogStreamOptions = { timestamps: true };
      const stream = new ContainerLogStream('test-container', options, 'docker');

      stream.on('data', (entry: ContainerLogEntry) => {
        expect(entry.message).toBe('Hello World');
        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(entry.timestamp?.toISOString()).toBe('2024-01-01T12:00:00.000Z');
        done();
      });

      // Simulate timestamped log line
      mockProcess.stdout.emit('data', Buffer.from('2024-01-01T12:00:00.000000000Z Hello World\n'));
    });

    it('should emit stderr data with correct stream', (done) => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');

      stream.on('data', (entry: ContainerLogEntry) => {
        expect(entry.message).toBe('Error message');
        expect(entry.stream).toBe('stderr');
        done();
      });

      // Simulate stderr data
      mockProcess.stderr.emit('data', Buffer.from('Error message\n'));
    });

    it('should filter stdout when stderr only option is set', () => {
      const options: ContainerLogStreamOptions = { stderr: true, stdout: false };
      const stream = new ContainerLogStream('test-container', options, 'docker');
      const dataSpy = vi.fn();

      stream.on('data', dataSpy);

      // Simulate stdout data (should be filtered)
      mockProcess.stdout.emit('data', Buffer.from('stdout message\n'));

      // Simulate stderr data (should pass through)
      mockProcess.stderr.emit('data', Buffer.from('stderr message\n'));

      // Give time for events to process
      setTimeout(() => {
        expect(dataSpy).toHaveBeenCalledTimes(1);
        expect(dataSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'stderr message',
            stream: 'stderr'
          })
        );
      }, 0);
    });

    it('should filter stderr when stdout only option is set', () => {
      const options: ContainerLogStreamOptions = { stdout: true };
      const stream = new ContainerLogStream('test-container', options, 'docker');
      const dataSpy = vi.fn();

      stream.on('data', dataSpy);

      // Simulate stderr data (should be filtered)
      mockProcess.stderr.emit('data', Buffer.from('stderr message\n'));

      // Simulate stdout data (should pass through)
      mockProcess.stdout.emit('data', Buffer.from('stdout message\n'));

      // Give time for events to process
      setTimeout(() => {
        expect(dataSpy).toHaveBeenCalledTimes(1);
        expect(dataSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'stdout message',
            stream: 'stdout'
          })
        );
      }, 0);
    });
  });

  describe('error handling', () => {
    it('should emit error events from child process', (done) => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');
      const testError = new Error('Process error');

      stream.on('error', (error) => {
        expect(error).toBe(testError);
        done();
      });

      mockProcess.emit('error', testError);
    });

    it('should emit exit events from child process', (done) => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');

      stream.on('exit', (code) => {
        expect(code).toBe(1);
        done();
      });

      mockProcess.emit('exit', 1);
    });

    it('should handle malformed log lines gracefully', (done) => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');

      stream.on('data', (entry: ContainerLogEntry) => {
        expect(entry.message).toBe('malformed line');
        expect(entry.stream).toBe('stdout');
        done();
      });

      // Simulate malformed data that should still be parsed
      mockProcess.stdout.emit('data', Buffer.from('malformed line\n'));
    });
  });

  describe('stream lifecycle', () => {
    it('should end stream and cleanup resources', () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');
      const killSpy = vi.spyOn(mockProcess, 'kill');

      expect(stream.isActive).toBe(true);

      stream.end();

      expect(stream.isActive).toBe(false);
      expect(killSpy).toHaveBeenCalledWith('SIGTERM');
    });

    it('should not start streaming if already ended', () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');

      // End the stream first
      stream.end();

      // Clear the mock call count
      mockSpawn.mockClear();

      // Try to create another stream (should not call spawn again)
      expect(stream.isActive).toBe(false);
    });

    it('should emit end event when stream ends', (done) => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');

      stream.on('end', () => {
        expect(stream.isActive).toBe(false);
        done();
      });

      stream.end();
    });
  });

  describe('async iterator', () => {
    it('should work as async iterator', async () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');
      const entries: ContainerLogEntry[] = [];

      // Set up async iteration in background
      const iterationPromise = (async () => {
        for await (const entry of stream) {
          entries.push(entry);
          if (entries.length === 2) {
            stream.end(); // End after 2 entries
            break;
          }
        }
      })();

      // Emit some data
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('First line\n'));
      }, 10);

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Second line\n'));
      }, 20);

      await iterationPromise;

      expect(entries).toHaveLength(2);
      expect(entries[0].message).toBe('First line');
      expect(entries[1].message).toBe('Second line');
    });

    it('should handle empty streams in async iterator', async () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');
      const entries: ContainerLogEntry[] = [];

      // End stream immediately
      setTimeout(() => stream.end(), 10);

      for await (const entry of stream) {
        entries.push(entry);
      }

      expect(entries).toHaveLength(0);
    });
  });

  describe('timestamp formatting', () => {
    it('should format Date objects correctly', () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');
      const date = new Date('2024-01-01T12:00:00Z');

      // Access private method for testing
      const formatTimestamp = (stream as any).formatTimestamp.bind(stream);
      const result = formatTimestamp(date);

      expect(result).toBe('2024-01-01T12:00:00.000Z');
    });

    it('should format unix timestamps correctly', () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');
      const unixTime = 1704110400; // 2024-01-01T12:00:00Z

      const formatTimestamp = (stream as any).formatTimestamp.bind(stream);
      const result = formatTimestamp(unixTime);

      expect(result).toBe('2024-01-01T12:00:00.000Z');
    });

    it('should pass through relative timestamps', () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');

      const formatTimestamp = (stream as any).formatTimestamp.bind(stream);
      const result = formatTimestamp('1h');

      expect(result).toBe('1h');
    });

    it('should handle invalid timestamps gracefully', () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');

      const formatTimestamp = (stream as any).formatTimestamp.bind(stream);
      const result = formatTimestamp('invalid');

      expect(result).toBe('invalid');
    });
  });
});

describe('ContainerManager.streamLogs', () => {
  let manager: ContainerManager;
  let mockRuntime: ContainerRuntime;

  beforeEach(() => {
    // Create a mock runtime
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');

    manager = new ContainerManager(mockRuntime);
    vi.clearAllMocks();
  });

  it('should create and return a ContainerLogStream', async () => {
    const stream = await manager.streamLogs('test-container', { follow: true });

    expect(stream).toBeInstanceOf(ContainerLogStream);
    expect(stream.isActive).toBe(true);
  });

  it('should throw error when no container runtime is available', async () => {
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('none');

    await expect(manager.streamLogs('test-container')).rejects.toThrow(
      'No container runtime available'
    );
  });

  it('should pass options to ContainerLogStream', async () => {
    const options: ContainerLogStreamOptions = {
      follow: true,
      timestamps: true,
      tail: 100
    };

    const stream = await manager.streamLogs('test-container', options);

    expect(mockSpawn).toHaveBeenCalledWith('docker', [
      'logs',
      '--follow',
      '--timestamps',
      '--tail', '100',
      'test-container'
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    expect(stream.isActive).toBe(true);
  });

  it('should use provided runtime type', async () => {
    await manager.streamLogs('test-container', {}, 'podman');

    expect(mockSpawn).toHaveBeenCalledWith('podman', ['logs', 'test-container'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
  });

  it('should auto-detect runtime when not provided', async () => {
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('podman');

    await manager.streamLogs('test-container');

    expect(mockRuntime.getBestRuntime).toHaveBeenCalled();
    expect(mockSpawn).toHaveBeenCalledWith('podman', ['logs', 'test-container'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
  });
});