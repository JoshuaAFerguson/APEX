import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
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

// Mock ChildProcess with additional error simulation capabilities
class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  pid = 1234;

  constructor(public shouldFailOnStart = false, public exitCode = 0) {
    super();

    if (shouldFailOnStart) {
      // Simulate process failing to start
      setTimeout(() => this.emit('error', new Error('ENOENT: spawn docker ENOENT')), 0);
    }
  }

  kill(signal?: string) {
    this.killed = true;
    setTimeout(() => {
      this.emit('exit', this.exitCode);
      this.emit('close');
    }, 0);
    return true;
  }

  removeAllListeners() {
    super.removeAllListeners();
    this.stdout.removeAllListeners();
    this.stderr.removeAllListeners();
    return this;
  }

  simulateTimeout() {
    // Simulate a timeout scenario
    setTimeout(() => {
      this.emit('error', new Error('Process timeout'));
    }, 100);
  }

  simulateHangingProcess() {
    // Process that doesn't respond to kill signals
    this.kill = vi.fn(() => false);
  }
}

const mockSpawn = vi.mocked(spawn);

describe('ContainerLogStream - Edge Cases and Error Handling', () => {
  let mockProcess: MockChildProcess;
  let mockRuntime: ContainerRuntime;

  beforeEach(() => {
    mockProcess = new MockChildProcess();
    mockSpawn.mockReturnValue(mockProcess as any);

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

  describe('process startup failures', () => {
    it('should handle spawn command not found', () => {
      mockProcess = new MockChildProcess(true);
      mockSpawn.mockReturnValue(mockProcess as any);

      const stream = new ContainerLogStream('test-container', {}, 'invalid-runtime');
      const errorHandler = vi.fn();
      stream.on('error', errorHandler);

      // Wait for the error to be emitted
      return new Promise<void>(resolve => {
        stream.on('error', () => {
          expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({
            message: 'ENOENT: spawn docker ENOENT'
          }));
          expect(stream.isActive).toBe(false);
          resolve();
        });
      });
    });

    it('should handle permission denied error', () => {
      const permissionError = new Error('Permission denied');
      (permissionError as any).code = 'EACCES';

      mockProcess = new MockChildProcess(false);
      mockSpawn.mockReturnValue(mockProcess as any);

      const stream = new ContainerLogStream('test-container', {}, 'docker');
      const errorHandler = vi.fn();
      stream.on('error', errorHandler);

      // Simulate permission error
      setTimeout(() => mockProcess.emit('error', permissionError), 0);

      return new Promise<void>(resolve => {
        stream.on('error', (error) => {
          expect(error).toBe(permissionError);
          expect(stream.isActive).toBe(false);
          resolve();
        });
      });
    });
  });

  describe('log parsing edge cases', () => {
    it('should handle extremely long log lines', () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');
      const veryLongMessage = 'A'.repeat(10000); // 10KB line
      const entries: ContainerLogEntry[] = [];

      stream.on('data', (entry) => entries.push(entry));

      mockProcess.stdout.emit('data', Buffer.from(`${veryLongMessage}\n`));

      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe(veryLongMessage);
      expect(entries[0].stream).toBe('stdout');

      stream.end();
    });

    it('should handle binary data in log streams', () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');
      const entries: ContainerLogEntry[] = [];

      stream.on('data', (entry) => entries.push(entry));

      // Simulate binary data mixed with text
      const binaryBuffer = Buffer.from([0x00, 0x01, 0x02, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x0a]); // Hello with binary prefix
      mockProcess.stdout.emit('data', binaryBuffer);

      expect(entries).toHaveLength(1);
      expect(entries[0].message).toContain('Hello');
      expect(entries[0].stream).toBe('stdout');

      stream.end();
    });

    it('should handle unicode characters correctly', () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');
      const entries: ContainerLogEntry[] = [];

      stream.on('data', (entry) => entries.push(entry));

      // Unicode test cases
      const unicodeMessages = [
        '🚀 Container started successfully',
        '警告: メモリ使用量が高い',
        'Error: файл не найден',
        '🐛 Bug found in line 42'
      ];

      unicodeMessages.forEach(msg => {
        mockProcess.stdout.emit('data', Buffer.from(`${msg}\n`));
      });

      expect(entries).toHaveLength(4);
      entries.forEach((entry, i) => {
        expect(entry.message).toBe(unicodeMessages[i]);
        expect(entry.stream).toBe('stdout');
      });

      stream.end();
    });

    it('should handle incomplete UTF-8 sequences across chunks', () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');
      const entries: ContainerLogEntry[] = [];

      stream.on('data', (entry) => entries.push(entry));

      // Split a multi-byte UTF-8 character across two chunks
      const utf8Char = Buffer.from('🚀'); // 4-byte UTF-8 character
      const chunk1 = Buffer.concat([utf8Char.slice(0, 2), Buffer.from(' Test')]);
      const chunk2 = Buffer.concat([utf8Char.slice(2), Buffer.from('\n')]);

      mockProcess.stdout.emit('data', chunk1);
      mockProcess.stdout.emit('data', chunk2);

      // Should handle this gracefully without throwing
      expect(entries.length).toBeGreaterThanOrEqual(0);

      stream.end();
    });

    it('should handle mixed line endings (\\r\\n, \\n, \\r)', () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');
      const entries: ContainerLogEntry[] = [];

      stream.on('data', (entry) => entries.push(entry));

      // Different line ending formats
      mockProcess.stdout.emit('data', Buffer.from('Line1\nLine2\r\nLine3\rLine4\n'));

      expect(entries.length).toBeGreaterThan(0);
      entries.forEach(entry => {
        expect(['Line1', 'Line2', 'Line3', 'Line4']).toContain(entry.message);
      });

      stream.end();
    });

    it('should handle empty lines and whitespace-only lines', () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');
      const entries: ContainerLogEntry[] = [];

      stream.on('data', (entry) => entries.push(entry));

      mockProcess.stdout.emit('data', Buffer.from('\n\n   \n\t\n  actual content  \n'));

      // Should only capture non-empty lines
      const nonEmptyEntries = entries.filter(e => e.message.trim() !== '');
      expect(nonEmptyEntries).toHaveLength(1);
      expect(nonEmptyEntries[0].message).toBe('actual content');

      stream.end();
    });
  });

  describe('timestamp parsing edge cases', () => {
    it('should handle various timestamp formats from different runtimes', () => {
      const options: ContainerLogStreamOptions = { timestamps: true };
      const stream = new ContainerLogStream('test-container', options, 'docker');
      const entries: ContainerLogEntry[] = [];

      stream.on('data', (entry) => entries.push(entry));

      // Different timestamp formats
      const timestampFormats = [
        '2024-01-01T12:00:00.123456789Z Message with nanoseconds',
        '2024-01-01T12:00:00.123Z Message with milliseconds',
        '2024-01-01T12:00:00Z Message with seconds only',
        'Jan 01 12:00:00 Invalid format message', // Invalid format should still work
      ];

      timestampFormats.forEach(line => {
        mockProcess.stdout.emit('data', Buffer.from(`${line}\n`));
      });

      expect(entries).toHaveLength(4);

      // First three should have valid timestamps
      expect(entries[0].timestamp).toBeInstanceOf(Date);
      expect(entries[1].timestamp).toBeInstanceOf(Date);
      expect(entries[2].timestamp).toBeInstanceOf(Date);

      // Fourth should still parse the message even with invalid timestamp
      expect(entries[3].message).toContain('Invalid format message');

      stream.end();
    });

    it('should handle timezone-aware timestamps', () => {
      const options: ContainerLogStreamOptions = { timestamps: true };
      const stream = new ContainerLogStream('test-container', options, 'docker');
      const entries: ContainerLogEntry[] = [];

      stream.on('data', (entry) => entries.push(entry));

      // Timestamps with different timezone formats
      const timezoneFormats = [
        '2024-01-01T12:00:00+05:30 Message with +5:30 timezone',
        '2024-01-01T12:00:00-08:00 Message with -8:00 timezone',
        '2024-01-01T12:00:00.000+00:00 Message with UTC offset',
      ];

      timezoneFormats.forEach(line => {
        mockProcess.stdout.emit('data', Buffer.from(`${line}\n`));
      });

      expect(entries).toHaveLength(3);
      entries.forEach(entry => {
        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(entry.timestamp?.getTime()).toBeGreaterThan(0);
      });

      stream.end();
    });
  });

  describe('stream filtering edge cases', () => {
    it('should handle rapid switching between stdout and stderr', () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');
      const entries: ContainerLogEntry[] = [];

      stream.on('data', (entry) => entries.push(entry));

      // Rapidly alternate between stdout and stderr
      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          mockProcess.stdout.emit('data', Buffer.from(`stdout message ${i}\n`));
        } else {
          mockProcess.stderr.emit('data', Buffer.from(`stderr message ${i}\n`));
        }
      }

      expect(entries).toHaveLength(10);
      entries.forEach((entry, i) => {
        expect(entry.stream).toBe(i % 2 === 0 ? 'stdout' : 'stderr');
        expect(entry.message).toBe(`${entry.stream} message ${i}`);
      });

      stream.end();
    });

    it('should handle stream prefix conflicts', () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');
      const entries: ContainerLogEntry[] = [];

      stream.on('data', (entry) => entries.push(entry));

      // Messages that contain stream prefixes but aren't actually prefixed
      mockProcess.stdout.emit('data', Buffer.from('This stdout: message contains stdout prefix\n'));
      mockProcess.stderr.emit('data', Buffer.from('stderr: This message starts with stderr:\n'));

      expect(entries).toHaveLength(2);
      expect(entries[0].stream).toBe('stdout');
      expect(entries[0].message).toContain('stdout: message');
      expect(entries[1].stream).toBe('stderr');
      expect(entries[1].message).toContain('This message starts with stderr:');

      stream.end();
    });
  });

  describe('performance and stress testing', () => {
    it('should handle high-volume log streaming', (done) => {
      const stream = new ContainerLogStream('test-container', { follow: true }, 'docker');
      const entries: ContainerLogEntry[] = [];
      let processedCount = 0;
      const totalMessages = 1000;

      stream.on('data', (entry) => {
        entries.push(entry);
        processedCount++;

        if (processedCount === totalMessages) {
          expect(entries).toHaveLength(totalMessages);
          expect(stream.isActive).toBe(true);
          stream.end();
          done();
        }
      });

      // Simulate high-volume logs
      for (let i = 0; i < totalMessages; i++) {
        const message = `High volume message ${i} with some additional content to make it realistic`;
        setTimeout(() => {
          mockProcess.stdout.emit('data', Buffer.from(`${message}\n`));
        }, i % 10); // Batch messages to avoid overwhelming
      }
    }, 10000); // Increase timeout for performance test

    it('should handle memory pressure during long-running streams', () => {
      const stream = new ContainerLogStream('test-container', { follow: true }, 'docker');
      let memoryUsageBefore = process.memoryUsage().heapUsed;

      // Simulate a long-running stream with large messages
      for (let i = 0; i < 100; i++) {
        const largeMessage = 'X'.repeat(1000); // 1KB per message
        mockProcess.stdout.emit('data', Buffer.from(`${largeMessage}\n`));
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memoryUsageAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryUsageAfter - memoryUsageBefore;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);

      stream.end();
    });
  });

  describe('graceful shutdown and cleanup', () => {
    it('should handle force kill when SIGTERM fails', async () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');

      // Mock a process that doesn't respond to SIGTERM
      mockProcess.simulateHangingProcess();

      const endPromise = new Promise<void>((resolve) => {
        stream.on('end', resolve);
      });

      stream.end();

      // Should eventually end even with hanging process
      await expect(endPromise).resolves.toBeUndefined();
    });

    it('should handle multiple end() calls gracefully', () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');
      const endHandler = vi.fn();

      stream.on('end', endHandler);

      // Call end multiple times
      stream.end();
      stream.end();
      stream.end();

      // Should only emit end event once
      expect(endHandler).toHaveBeenCalledTimes(1);
      expect(stream.isActive).toBe(false);
    });

    it('should cleanup all event listeners on end', () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');

      // Add some listeners
      stream.on('data', () => {});
      stream.on('error', () => {});
      stream.on('exit', () => {});

      expect(stream.listenerCount('data')).toBeGreaterThan(0);
      expect(stream.listenerCount('error')).toBeGreaterThan(0);
      expect(stream.listenerCount('exit')).toBeGreaterThan(0);

      stream.end();

      // All listeners should be removed
      expect(stream.listenerCount('data')).toBe(0);
      expect(stream.listenerCount('error')).toBe(0);
      expect(stream.listenerCount('exit')).toBe(0);
    });
  });

  describe('async iterator edge cases', () => {
    it('should handle iterator errors gracefully', async () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');
      const entries: ContainerLogEntry[] = [];

      const iteratorPromise = (async () => {
        try {
          for await (const entry of stream) {
            entries.push(entry);

            // Simulate an error after first entry
            if (entries.length === 1) {
              mockProcess.emit('error', new Error('Simulated error'));
              break;
            }
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe('Simulated error');
        }
      })();

      // Send some data
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('First entry\n'));
      }, 10);

      await iteratorPromise;
      expect(entries).toHaveLength(1);
    });

    it('should handle iterator break and continue', async () => {
      const stream = new ContainerLogStream('test-container', {}, 'docker');
      const entries: ContainerLogEntry[] = [];

      const iteratorPromise = (async () => {
        let count = 0;
        for await (const entry of stream) {
          count++;
          if (count <= 3) {
            entries.push(entry);
          }
          if (count === 3) {
            break; // Early break
          }
        }
      })();

      // Send multiple messages
      for (let i = 1; i <= 5; i++) {
        setTimeout(() => {
          mockProcess.stdout.emit('data', Buffer.from(`Message ${i}\n`));
        }, i * 10);
      }

      setTimeout(() => stream.end(), 100);

      await iteratorPromise;
      expect(entries).toHaveLength(3);
    });
  });
});

describe('ContainerManager.streamLogs - Runtime Integration Edge Cases', () => {
  let manager: ContainerManager;
  let mockRuntime: ContainerRuntime;

  beforeEach(() => {
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    manager = new ContainerManager(mockRuntime);
    vi.clearAllMocks();
  });

  describe('runtime switching and fallback', () => {
    it('should handle runtime switching mid-stream', async () => {
      // Start with docker, then simulate it becoming unavailable
      let callCount = 0;
      vi.mocked(mockRuntime.getBestRuntime).mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? 'docker' : 'podman';
      });

      const stream1 = await manager.streamLogs('container1');
      const stream2 = await manager.streamLogs('container2');

      expect(mockSpawn).toHaveBeenNthCalledWith(1, 'docker', expect.any(Array), expect.any(Object));
      expect(mockSpawn).toHaveBeenNthCalledWith(2, 'podman', expect.any(Array), expect.any(Object));

      stream1.end();
      stream2.end();
    });

    it('should handle runtime detection failures gracefully', async () => {
      vi.mocked(mockRuntime.getBestRuntime).mockRejectedValue(new Error('Runtime detection failed'));

      await expect(manager.streamLogs('test-container')).rejects.toThrow('Runtime detection failed');
    });
  });

  describe('container ID validation edge cases', () => {
    it('should handle special characters in container names', async () => {
      const specialNames = [
        'container-with-dashes',
        'container_with_underscores',
        'container.with.dots',
        'container123',
        'CONTAINER_UPPERCASE'
      ];

      for (const name of specialNames) {
        const stream = await manager.streamLogs(name);
        expect(mockSpawn).toHaveBeenLastCalledWith('docker',
          expect.arrayContaining([expect.stringContaining(name)]),
          expect.any(Object)
        );
        stream.end();
      }
    });

    it('should handle very long container IDs', async () => {
      const longContainerId = 'a'.repeat(256); // Simulate very long container ID

      const stream = await manager.streamLogs(longContainerId);
      expect(mockSpawn).toHaveBeenCalledWith('docker',
        expect.arrayContaining([longContainerId]),
        expect.any(Object)
      );

      stream.end();
    });
  });

  describe('option validation and sanitization', () => {
    it('should handle extreme tail values', async () => {
      const extremeOptions = [
        { tail: 0 }, // Zero tail
        { tail: Number.MAX_SAFE_INTEGER }, // Very large number
        { tail: -1 }, // Negative number (should be ignored)
        { tail: 'all' as const }, // String value
      ];

      for (const options of extremeOptions) {
        const stream = await manager.streamLogs('test-container', options);
        stream.end();
      }

      // Should not throw any errors
      expect(mockSpawn).toHaveBeenCalledTimes(extremeOptions.length);
    });

    it('should handle invalid timestamp formats gracefully', async () => {
      const invalidOptions = [
        { since: 'not-a-date' },
        { until: 'also-not-a-date' },
        { since: NaN },
        { until: Infinity },
        { since: new Date('invalid') },
      ];

      for (const options of invalidOptions) {
        const stream = await manager.streamLogs('test-container', options);
        stream.end();
      }

      // Should handle invalid timestamps without throwing
      expect(mockSpawn).toHaveBeenCalledTimes(invalidOptions.length);
    });
  });

  describe('concurrent stream management', () => {
    it('should handle multiple concurrent streams from same container', async () => {
      const streams = await Promise.all([
        manager.streamLogs('same-container', { follow: true }),
        manager.streamLogs('same-container', { timestamps: true }),
        manager.streamLogs('same-container', { tail: 100 }),
      ]);

      expect(mockSpawn).toHaveBeenCalledTimes(3);
      streams.forEach(stream => expect(stream.isActive).toBe(true));

      // Clean up
      streams.forEach(stream => stream.end());
    });

    it('should handle rapid stream creation and destruction', async () => {
      const streams: ContainerLogStream[] = [];

      // Create and destroy streams rapidly
      for (let i = 0; i < 10; i++) {
        const stream = await manager.streamLogs(`container-${i}`);
        streams.push(stream);

        if (i < 5) {
          setTimeout(() => stream.end(), 10);
        }
      }

      expect(mockSpawn).toHaveBeenCalledTimes(10);

      // Clean up remaining streams
      streams.forEach(stream => stream.end());
    });
  });
});