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

/**
 * Performance-focused mock process that can simulate various load scenarios
 */
class PerformanceMockProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  pid = Math.floor(Math.random() * 10000);

  constructor(
    private scenario: 'high-frequency' | 'large-messages' | 'burst-traffic' | 'sustained-load'
  ) {
    super();
    this.startScenario();
  }

  private startScenario() {
    switch (this.scenario) {
      case 'high-frequency':
        this.simulateHighFrequency();
        break;
      case 'large-messages':
        this.simulateLargeMessages();
        break;
      case 'burst-traffic':
        this.simulateBurstTraffic();
        break;
      case 'sustained-load':
        this.simulateSustainedLoad();
        break;
    }
  }

  private simulateHighFrequency() {
    // Simulate 1000 messages/second
    let messageCount = 0;
    const maxMessages = 1000;

    const sendMessage = () => {
      if (this.killed || messageCount >= maxMessages) {
        this.emit('exit', 0);
        return;
      }

      this.stdout.emit('data', Buffer.from(`Message ${++messageCount} at ${Date.now()}\n`));
      setImmediate(sendMessage); // Send next message immediately
    };

    sendMessage();
  }

  private simulateLargeMessages() {
    // Simulate large log messages (1KB each)
    let messageCount = 0;
    const maxMessages = 100;
    const messageSize = 1024;

    const sendLargeMessage = () => {
      if (this.killed || messageCount >= maxMessages) {
        this.emit('exit', 0);
        return;
      }

      const content = 'X'.repeat(messageSize - 50); // Reserve space for metadata
      const message = `[${++messageCount}] ${content} END\n`;
      this.stdout.emit('data', Buffer.from(message));

      setTimeout(sendLargeMessage, 10);
    };

    sendLargeMessage();
  }

  private simulateBurstTraffic() {
    // Simulate burst traffic patterns - periods of high activity followed by quiet
    let burstCount = 0;
    const maxBursts = 5;

    const sendBurst = () => {
      if (this.killed || burstCount >= maxBursts) {
        this.emit('exit', 0);
        return;
      }

      burstCount++;
      const burstSize = 100;

      // Send burst of messages rapidly
      for (let i = 0; i < burstSize; i++) {
        setTimeout(() => {
          this.stdout.emit('data', Buffer.from(`Burst ${burstCount} Message ${i + 1}\n`));

          // Add some stderr messages in burst
          if (i % 10 === 0) {
            this.stderr.emit('data', Buffer.from(`Burst ${burstCount} Error ${i / 10 + 1}\n`));
          }
        }, i * 5); // 5ms between messages in burst
      }

      // Schedule next burst after quiet period
      setTimeout(sendBurst, 1000);
    };

    sendBurst();
  }

  private simulateSustainedLoad() {
    // Simulate sustained load with mixed message sizes and frequencies
    let messageCount = 0;
    const maxMessages = 10000;

    const sendMixedMessage = () => {
      if (this.killed || messageCount >= maxMessages) {
        this.emit('exit', 0);
        return;
      }

      messageCount++;

      // Vary message size and content
      const messageType = messageCount % 4;
      let message: string;

      switch (messageType) {
        case 0: // Short message
          message = `Short log ${messageCount}`;
          break;
        case 1: // Medium message
          message = `Medium log ${messageCount}: ${'data'.repeat(50)}`;
          break;
        case 2: // Long message
          message = `Long log ${messageCount}: ${'information'.repeat(100)}`;
          break;
        case 3: // JSON-like structured message
          message = `{"timestamp":"${new Date().toISOString()}","level":"info","message":"Log ${messageCount}","data":{"key":"${'value'.repeat(20)}"}}`;
          break;
      }

      const stream = messageCount % 10 === 0 ? this.stderr : this.stdout;
      stream.emit('data', Buffer.from(`${message}\n`));

      // Vary timing - sometimes rapid, sometimes slower
      const delay = messageCount % 50 === 0 ? 50 : 1;
      setTimeout(sendMixedMessage, delay);
    };

    sendMixedMessage();
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

describe('ContainerLogStream - Performance Tests', () => {
  let mockRuntime: ContainerRuntime;

  beforeEach(() => {
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('High-frequency message handling', () => {
    it('should handle 1000+ messages per second efficiently', async () => {
      const perfProcess = new PerformanceMockProcess('high-frequency');
      mockSpawn.mockReturnValue(perfProcess as any);

      const stream = new ContainerLogStream('high-freq-container', { follow: true }, 'docker');
      const entries: ContainerLogEntry[] = [];
      const startTime = Date.now();
      let totalProcessingTime = 0;

      stream.on('data', (entry) => {
        const processingStart = Date.now();
        entries.push(entry);
        totalProcessingTime += Date.now() - processingStart;
      });

      await new Promise<void>((resolve) => {
        stream.on('exit', () => resolve());
      });

      const totalTime = Date.now() - startTime;

      expect(entries.length).toBe(1000);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(totalProcessingTime).toBeLessThan(totalTime * 0.1); // Processing overhead should be minimal

      // Verify message ordering
      entries.forEach((entry, index) => {
        expect(entry.message).toBe(`Message ${index + 1} at ${expect.any(String)}`);
      });

      stream.end();
    });

    it('should maintain low memory usage during high-frequency streams', async () => {
      const perfProcess = new PerformanceMockProcess('high-frequency');
      mockSpawn.mockReturnValue(perfProcess as any);

      const stream = new ContainerLogStream('memory-test-container', { follow: true }, 'docker');

      const initialMemory = process.memoryUsage();
      let messageCount = 0;

      stream.on('data', () => {
        messageCount++;
      });

      await new Promise<void>((resolve) => {
        stream.on('exit', () => resolve());
      });

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(messageCount).toBe(1000);
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Should not increase by more than 50MB

      stream.end();
    });
  });

  describe('Large message handling', () => {
    it('should efficiently process large log messages', async () => {
      const perfProcess = new PerformanceMockProcess('large-messages');
      mockSpawn.mockReturnValue(perfProcess as any);

      const stream = new ContainerLogStream('large-msg-container', {}, 'docker');
      const entries: ContainerLogEntry[] = [];
      const startTime = Date.now();

      stream.on('data', (entry) => {
        entries.push(entry);
      });

      await new Promise<void>((resolve) => {
        stream.on('exit', () => resolve());
      });

      const totalTime = Date.now() - startTime;

      expect(entries.length).toBe(100);
      expect(totalTime).toBeLessThan(3000); // Should process 100KB within 3 seconds

      // Verify large messages are handled correctly
      entries.forEach((entry, index) => {
        expect(entry.message).toMatch(new RegExp(`^\\[${index + 1}\\].*END$`));
        expect(entry.message.length).toBeGreaterThan(1000); // Should be ~1KB
      });

      stream.end();
    });

    it('should handle memory efficiently with large messages', async () => {
      const perfProcess = new PerformanceMockProcess('large-messages');
      mockSpawn.mockReturnValue(perfProcess as any);

      const stream = new ContainerLogStream('large-msg-memory-test', {}, 'docker');

      const initialMemory = process.memoryUsage();
      let totalMessageSize = 0;

      stream.on('data', (entry) => {
        totalMessageSize += entry.message.length;
      });

      await new Promise<void>((resolve) => {
        stream.on('exit', () => resolve());
      });

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(totalMessageSize).toBeGreaterThan(100 * 1024); // Total size > 100KB
      // Memory increase should not be significantly more than message size
      expect(memoryIncrease).toBeLessThan(totalMessageSize * 5); // Allow 5x overhead max

      stream.end();
    });
  });

  describe('Burst traffic patterns', () => {
    it('should handle burst traffic without message loss', async () => {
      const perfProcess = new PerformanceMockProcess('burst-traffic');
      mockSpawn.mockReturnValue(perfProcess as any);

      const stream = new ContainerLogStream('burst-container', { follow: true }, 'docker');
      const stdoutEntries: ContainerLogEntry[] = [];
      const stderrEntries: ContainerLogEntry[] = [];

      stream.on('data', (entry) => {
        if (entry.stream === 'stdout') {
          stdoutEntries.push(entry);
        } else {
          stderrEntries.push(entry);
        }
      });

      await new Promise<void>((resolve) => {
        stream.on('exit', () => resolve());
      });

      // Should receive all burst messages
      expect(stdoutEntries.length).toBe(500); // 5 bursts × 100 messages
      expect(stderrEntries.length).toBe(50);  // 5 bursts × 10 error messages

      // Verify burst grouping
      let currentBurst = 0;
      stdoutEntries.forEach((entry) => {
        const match = entry.message.match(/^Burst (\d+) Message \d+$/);
        expect(match).toBeTruthy();

        const burstNumber = parseInt(match![1]);
        expect(burstNumber).toBeGreaterThanOrEqual(currentBurst);
        expect(burstNumber).toBeLessThanOrEqual(5);

        if (burstNumber > currentBurst) {
          currentBurst = burstNumber;
        }
      });

      stream.end();
    });
  });

  describe('Sustained load testing', () => {
    it('should maintain performance under sustained load', async () => {
      const perfProcess = new PerformanceMockProcess('sustained-load');
      mockSpawn.mockReturnValue(perfProcess as any);

      const stream = new ContainerLogStream('sustained-container', { follow: true }, 'docker');
      const entries: ContainerLogEntry[] = [];
      const processingTimes: number[] = [];

      stream.on('data', (entry) => {
        const start = Date.now();
        entries.push(entry);
        const processingTime = Date.now() - start;
        processingTimes.push(processingTime);
      });

      const startTime = Date.now();

      await new Promise<void>((resolve) => {
        stream.on('exit', () => resolve());
      });

      const totalTime = Date.now() - startTime;

      expect(entries.length).toBe(10000);
      expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds

      // Calculate performance metrics
      const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const maxProcessingTime = Math.max(...processingTimes);
      const p95ProcessingTime = processingTimes.sort()[Math.floor(processingTimes.length * 0.95)];

      expect(avgProcessingTime).toBeLessThan(1); // Average < 1ms per message
      expect(maxProcessingTime).toBeLessThan(10); // Max < 10ms per message
      expect(p95ProcessingTime).toBeLessThan(2); // 95th percentile < 2ms

      // Verify message variety
      const messageTypes = new Set(entries.map(e => {
        if (e.message.startsWith('Short')) return 'short';
        if (e.message.startsWith('Medium')) return 'medium';
        if (e.message.startsWith('Long')) return 'long';
        if (e.message.startsWith('{"timestamp"')) return 'json';
        return 'unknown';
      }));

      expect(messageTypes.size).toBe(4); // Should have all 4 message types

      stream.end();
    });

    it('should maintain memory stability during sustained load', async () => {
      const perfProcess = new PerformanceMockProcess('sustained-load');
      mockSpawn.mockReturnValue(perfProcess as any);

      const stream = new ContainerLogStream('sustained-memory-test', { follow: true }, 'docker');

      const memorySnapshots: number[] = [];
      let messageCount = 0;

      // Take memory snapshots every 1000 messages
      stream.on('data', () => {
        messageCount++;
        if (messageCount % 1000 === 0) {
          memorySnapshots.push(process.memoryUsage().heapUsed);
        }
      });

      await new Promise<void>((resolve) => {
        stream.on('exit', () => resolve());
      });

      expect(messageCount).toBe(10000);
      expect(memorySnapshots.length).toBe(10);

      // Memory usage should remain relatively stable (not continuously growing)
      const memoryGrowth = memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0];
      const avgMessageSize = 200; // Approximate average based on message types
      const expectedMemoryUsage = messageCount * avgMessageSize;

      // Allow some overhead, but memory growth shouldn't be excessive
      expect(memoryGrowth).toBeLessThan(expectedMemoryUsage * 2);

      stream.end();
    });
  });

  describe('Async iterator performance', () => {
    it('should maintain performance when using async iteration', async () => {
      const perfProcess = new PerformanceMockProcess('high-frequency');
      mockSpawn.mockReturnValue(perfProcess as any);

      const stream = new ContainerLogStream('async-perf-container', { follow: true }, 'docker');
      const entries: ContainerLogEntry[] = [];
      const startTime = Date.now();

      const iterationPromise = (async () => {
        for await (const entry of stream) {
          entries.push(entry);

          // Process first 500 messages then break
          if (entries.length >= 500) {
            break;
          }
        }
      })();

      await iterationPromise;

      const totalTime = Date.now() - startTime;

      expect(entries.length).toBe(500);
      expect(totalTime).toBeLessThan(3000); // Should be processed quickly

      // Verify async iteration preserves order
      entries.forEach((entry, index) => {
        expect(entry.message).toBe(`Message ${index + 1} at ${expect.any(String)}`);
      });

      stream.end();
    });
  });
});

describe('ContainerManager.streamLogs - Performance Integration', () => {
  let manager: ContainerManager;
  let mockRuntime: ContainerRuntime;

  beforeEach(() => {
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    manager = new ContainerManager(mockRuntime);
    vi.clearAllMocks();
  });

  describe('Concurrent stream performance', () => {
    it('should handle multiple high-performance streams concurrently', async () => {
      const streamCount = 5;
      const streams: ContainerLogStream[] = [];
      const allEntries: ContainerLogEntry[][] = [];

      const startTime = Date.now();

      // Create multiple concurrent high-frequency streams
      for (let i = 0; i < streamCount; i++) {
        const perfProcess = new PerformanceMockProcess('high-frequency');
        mockSpawn.mockReturnValue(perfProcess as any);

        const stream = await manager.streamLogs(`perf-container-${i}`, { follow: true });
        streams.push(stream);

        const entries: ContainerLogEntry[] = [];
        allEntries.push(entries);

        stream.on('data', (entry) => {
          entries.push(entry);
        });
      }

      // Wait for all streams to complete
      await Promise.all(streams.map(stream =>
        new Promise<void>(resolve => stream.on('exit', () => resolve()))
      ));

      const totalTime = Date.now() - startTime;

      // Verify all streams processed correctly
      expect(streams.length).toBe(streamCount);
      allEntries.forEach((entries, index) => {
        expect(entries.length).toBe(1000);
        expect(streams[index].isActive).toBe(false);
      });

      expect(totalTime).toBeLessThan(10000); // All streams should complete within 10 seconds

      // Clean up
      streams.forEach(stream => stream.end());
    });

    it('should scale efficiently with stream count', async () => {
      const streamCounts = [1, 3, 5, 10];
      const results: { count: number; time: number }[] = [];

      for (const count of streamCounts) {
        const startTime = Date.now();
        const streams: ContainerLogStream[] = [];

        // Create streams
        for (let i = 0; i < count; i++) {
          const perfProcess = new PerformanceMockProcess('burst-traffic');
          mockSpawn.mockReturnValue(perfProcess as any);

          const stream = await manager.streamLogs(`scale-test-${i}`, { follow: true });
          streams.push(stream);
        }

        // Wait for completion
        await Promise.all(streams.map(stream =>
          new Promise<void>(resolve => stream.on('exit', () => resolve()))
        ));

        const totalTime = Date.now() - startTime;
        results.push({ count, time: totalTime });

        // Clean up
        streams.forEach(stream => stream.end());
        mockSpawn.mockClear();
      }

      // Performance should scale reasonably (not exponentially)
      results.forEach((result, index) => {
        if (index > 0) {
          const previousResult = results[index - 1];
          const timeRatio = result.time / previousResult.time;
          const countRatio = result.count / previousResult.count;

          // Time increase should not be much worse than linear with stream count
          expect(timeRatio).toBeLessThan(countRatio * 2);
        }
      });
    });
  });

  describe('Resource management performance', () => {
    it('should efficiently manage resources across stream lifecycle', async () => {
      const perfProcess = new PerformanceMockProcess('sustained-load');
      mockSpawn.mockReturnValue(perfProcess as any);

      const initialMemory = process.memoryUsage();
      const stream = await manager.streamLogs('resource-test-container', { follow: true });

      let messageCount = 0;
      stream.on('data', () => {
        messageCount++;
      });

      // Let it run for a portion of the test
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          stream.end();
          resolve();
        }, 2000);
      });

      const endingMemory = process.memoryUsage();

      // Wait for cleanup to complete
      await new Promise<void>((resolve) => {
        stream.on('end', () => resolve());
      });

      const finalMemory = process.memoryUsage();

      expect(messageCount).toBeGreaterThan(100); // Should have processed many messages

      // Memory should be cleaned up after stream ends
      const memoryLeakage = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryLeakage).toBeLessThan(10 * 1024 * 1024); // Less than 10MB leakage
    });
  });
});