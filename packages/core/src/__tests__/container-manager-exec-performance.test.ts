import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import {
  ContainerManager,
  type ExecCommandOptions,
  type ExecCommandResult,
} from '../container-manager';
import { ContainerRuntime } from '../container-runtime';

// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

const mockExec = vi.mocked(exec);

// Mock ContainerRuntime
vi.mock('../container-runtime');
const MockedContainerRuntime = vi.mocked(ContainerRuntime);

// Helper to create a mock exec callback
function mockExecCallback(stdout: string, stderr?: string, error?: Error) {
  return vi.fn((command: string, options: any, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
    if (callback) {
      setTimeout(() => callback(error || null, stdout, stderr || ''), 0);
    }
    return {} as any; // Mock ChildProcess
  });
}

// Helper to create a timeout error
function createTimeoutError() {
  const error = new Error('Command timed out') as any;
  error.code = 'ETIMEDOUT';
  return error;
}

describe('ContainerManager execCommand Performance Tests', () => {
  let manager: ContainerManager;
  let mockRuntime: ContainerRuntime;
  const testContainerId = 'perf-test-container';

  beforeEach(() => {
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    vi.mocked(mockRuntime.isRuntimeAvailable).mockResolvedValue(true);

    manager = new ContainerManager(mockRuntime);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('memory and output handling', () => {
    it('should handle extremely large output without memory issues', async () => {
      // Test with 50MB of output
      const largeSize = 50 * 1024 * 1024; // 50MB
      const chunk = 'x'.repeat(1024); // 1KB chunks
      const largeOutput = chunk.repeat(largeSize / 1024) + '\n';

      mockExec.mockImplementationOnce(mockExecCallback(largeOutput));

      const startMemory = process.memoryUsage().heapUsed;
      const startTime = Date.now();

      const result = await manager.execCommand(
        testContainerId,
        'cat /extremely-large-log-file',
        {
          timeout: 60000,
        }
      );

      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(result.stdout.length).toBe(largeOutput.length);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      // Memory increase should be reasonable (less than 5x the output size)
      expect(memoryIncrease).toBeLessThan(largeSize * 5);
    });

    it('should handle output with many newlines efficiently', async () => {
      // Create output with 100k lines
      const lines = Array.from({ length: 100000 }, (_, i) => `Line ${i + 1}: Some content here`);
      const manyLinesOutput = lines.join('\n') + '\n';

      mockExec.mockImplementationOnce(mockExecCallback(manyLinesOutput));

      const startTime = Date.now();
      const result = await manager.execCommand(
        testContainerId,
        'cat /file-with-many-lines',
        {
          timeout: 30000,
        }
      );
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.stdout.split('\n')).toHaveLength(100001); // 100k lines + empty string after last \n
      expect(duration).toBeLessThan(5000); // Should be fast despite many lines
    });

    it('should handle binary data in output streams', async () => {
      // Create binary-like data with various byte values
      const binaryData = Buffer.from(Array.from({ length: 1024 }, (_, i) => i % 256));
      const binaryOutput = binaryData.toString('binary');

      mockExec.mockImplementationOnce(mockExecCallback(binaryOutput));

      const result = await manager.execCommand(
        testContainerId,
        'cat /binary-file',
        {
          timeout: 10000,
        }
      );

      expect(result.success).toBe(true);
      expect(result.stdout.length).toBe(binaryOutput.length);
      expect(Buffer.from(result.stdout, 'binary')).toEqual(binaryData);
    });
  });

  describe('concurrency and throughput', () => {
    it('should handle high concurrency without degradation', async () => {
      const concurrentCount = 50;
      const expectedOutputs = Array.from({ length: concurrentCount }, (_, i) => `Concurrent task ${i + 1}\n`);

      // Set up all mock calls
      expectedOutputs.forEach(output => {
        mockExec.mockImplementationOnce(mockExecCallback(output));
      });

      const startTime = Date.now();

      // Execute many commands concurrently
      const promises = expectedOutputs.map((_, index) =>
        manager.execCommand(testContainerId, `echo "Concurrent task ${index + 1}"`, {
          timeout: 5000,
        })
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // All commands should succeed
      expect(results).toHaveLength(concurrentCount);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.stdout).toBe(`Concurrent task ${index + 1}\n`);
      });

      // Should complete within reasonable time (not sequential)
      expect(totalDuration).toBeLessThan(2000); // Much faster than sequential execution
    });

    it('should handle mixed success/failure scenarios under load', async () => {
      const totalCommands = 30;
      const failureRate = 0.3; // 30% failure rate

      const mockCalls: Array<{ success: boolean; output: string; exitCode?: number }> = [];

      for (let i = 0; i < totalCommands; i++) {
        const shouldFail = Math.random() < failureRate;
        if (shouldFail) {
          const error = new Error('Command failed') as any;
          error.code = Math.floor(Math.random() * 10) + 1; // Random exit code 1-10
          error.stdout = `Partial output ${i + 1}\n`;
          error.stderr = `Error in command ${i + 1}\n`;

          mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
            setTimeout(() => callback!(error, `Partial output ${i + 1}\n`, `Error in command ${i + 1}\n`), 0);
            return {} as any;
          }));

          mockCalls.push({ success: false, output: `Partial output ${i + 1}\n`, exitCode: error.code });
        } else {
          mockExec.mockImplementationOnce(mockExecCallback(`Success output ${i + 1}\n`));
          mockCalls.push({ success: true, output: `Success output ${i + 1}\n` });
        }
      }

      const promises = Array.from({ length: totalCommands }, (_, i) =>
        manager.execCommand(testContainerId, `test-command-${i + 1}`, {
          timeout: 3000,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(totalCommands);

      let successCount = 0;
      let failureCount = 0;

      results.forEach((result, index) => {
        const expected = mockCalls[index];
        expect(result.success).toBe(expected.success);

        if (expected.success) {
          expect(result.exitCode).toBe(0);
          expect(result.stdout).toBe(expected.output);
          successCount++;
        } else {
          expect(result.exitCode).toBe(expected.exitCode);
          expect(result.stdout).toBe(expected.output);
          failureCount++;
        }
      });

      expect(successCount + failureCount).toBe(totalCommands);
      expect(failureCount).toBeGreaterThan(totalCommands * 0.2); // At least 20% failures
    });

    it('should handle rapid sequential execution without resource leaks', async () => {
      const sequentialCount = 100;
      const outputs = Array.from({ length: sequentialCount }, (_, i) => `Sequential ${i + 1}\n`);

      // Set up all mock calls
      outputs.forEach(output => {
        mockExec.mockImplementationOnce(mockExecCallback(output));
      });

      const startMemory = process.memoryUsage().heapUsed;
      const startTime = Date.now();

      const results: ExecCommandResult[] = [];
      for (let i = 0; i < sequentialCount; i++) {
        const result = await manager.execCommand(testContainerId, `echo "Sequential ${i + 1}"`);
        results.push(result);
      }

      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;
      const duration = endTime - startTime;

      expect(results).toHaveLength(sequentialCount);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.stdout).toBe(`Sequential ${index + 1}\n`);
      });

      expect(duration).toBeLessThan(5000); // Should be reasonably fast

      // Memory increase should be minimal (indicating no significant leaks)
      expect(memoryIncrease).toBeLessThan(1024 * 1024); // Less than 1MB increase
    });
  });

  describe('timeout and resource management', () => {
    it('should handle timeout scenarios efficiently across multiple commands', async () => {
      const timeoutCommands = 10;
      const shortTimeout = 100; // 100ms timeout

      // Set up timeout errors for all commands
      Array.from({ length: timeoutCommands }, () => {
        mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
          setTimeout(() => callback!(createTimeoutError(), '', ''), 0);
          return {} as any;
        }));
      });

      const startTime = Date.now();

      const promises = Array.from({ length: timeoutCommands }, (_, i) =>
        manager.execCommand(testContainerId, `sleep ${i + 5}`, {
          timeout: shortTimeout,
        })
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(timeoutCommands);
      results.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.exitCode).toBe(124);
        expect(result.error).toContain('timed out after 100ms');
      });

      // All timeouts should be handled efficiently
      expect(duration).toBeLessThan(1000); // Much less than sum of all timeouts
    });

    it('should handle commands with varying timeout requirements', async () => {
      const commands = [
        { name: 'fast', timeout: 100, delay: 0 },
        { name: 'medium', timeout: 1000, delay: 50 },
        { name: 'slow', timeout: 5000, delay: 200 },
        { name: 'instant', timeout: 50, delay: 0 },
        { name: 'timeout', timeout: 100, delay: 500 }, // This should timeout
      ];

      commands.forEach((cmd, index) => {
        if (cmd.delay > cmd.timeout) {
          // This command will timeout
          mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
            setTimeout(() => callback!(createTimeoutError(), '', ''), 0);
            return {} as any;
          }));
        } else {
          mockExec.mockImplementationOnce(mockExecCallback(`${cmd.name} output\n`));
        }
      });

      const startTime = Date.now();

      const promises = commands.map(cmd =>
        manager.execCommand(testContainerId, `${cmd.name}-command`, {
          timeout: cmd.timeout,
        })
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(commands.length);

      results.forEach((result, index) => {
        const cmd = commands[index];
        if (cmd.delay > cmd.timeout) {
          expect(result.success).toBe(false);
          expect(result.exitCode).toBe(124);
        } else {
          expect(result.success).toBe(true);
          expect(result.stdout).toBe(`${cmd.name} output\n`);
        }
      });

      expect(duration).toBeLessThan(6000); // Should complete within max timeout + buffer
    });

    it('should handle commands with extreme timeout values', async () => {
      const testCases = [
        { timeout: 1, expected: 'very short' },
        { timeout: 1000 * 60 * 60, expected: 'very long' }, // 1 hour
        { timeout: Number.MAX_SAFE_INTEGER, expected: 'maximum' },
      ];

      testCases.forEach(testCase => {
        mockExec.mockImplementationOnce(mockExecCallback(`${testCase.expected} timeout test\n`));
      });

      for (const testCase of testCases) {
        const result = await manager.execCommand(
          testContainerId,
          'echo "timeout test"',
          { timeout: testCase.timeout }
        );

        expect(result.success).toBe(true);
        expect(result.stdout).toBe(`${testCase.expected} timeout test\n`);

        // Verify timeout was passed to exec
        expect(mockExec).toHaveBeenLastCalledWith(
          expect.any(String),
          expect.objectContaining({ timeout: testCase.timeout }),
          expect.any(Function)
        );
      }
    });
  });

  describe('stress testing with complex scenarios', () => {
    it('should handle sustained load over extended period', async () => {
      const batchSize = 20;
      const batchCount = 5;
      const totalCommands = batchSize * batchCount;

      // Set up all mock calls
      for (let batch = 0; batch < batchCount; batch++) {
        for (let i = 0; i < batchSize; i++) {
          const commandIndex = batch * batchSize + i;
          mockExec.mockImplementationOnce(mockExecCallback(`Batch ${batch} Command ${i} Output\n`));
        }
      }

      const allResults: ExecCommandResult[] = [];
      const startTime = Date.now();

      // Execute in batches to simulate sustained load
      for (let batch = 0; batch < batchCount; batch++) {
        const batchStartTime = Date.now();

        const batchPromises = Array.from({ length: batchSize }, (_, i) =>
          manager.execCommand(testContainerId, `batch-${batch}-command-${i}`, {
            timeout: 2000,
            environment: {
              BATCH_ID: batch.toString(),
              COMMAND_ID: i.toString(),
            },
          })
        );

        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);

        const batchDuration = Date.now() - batchStartTime;
        expect(batchDuration).toBeLessThan(1000); // Each batch should complete quickly

        // Small delay between batches to simulate real-world usage
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const totalDuration = Date.now() - startTime;

      expect(allResults).toHaveLength(totalCommands);
      allResults.forEach((result, index) => {
        const batch = Math.floor(index / batchSize);
        const commandInBatch = index % batchSize;

        expect(result.success).toBe(true);
        expect(result.stdout).toBe(`Batch ${batch} Command ${commandInBatch} Output\n`);
        expect(result.command).toContain(`--env BATCH_ID=${batch}`);
        expect(result.command).toContain(`--env COMMAND_ID=${commandInBatch}`);
      });

      expect(totalDuration).toBeLessThan(10000); // Total time should be reasonable
    });

    it('should handle commands with complex environment variable sets', async () => {
      const commandCount = 25;

      // Create commands with progressively larger environment sets
      const commands = Array.from({ length: commandCount }, (_, i) => {
        const envVarCount = (i + 1) * 10; // 10, 20, 30, ... environment variables
        const environment: Record<string, string> = {};

        for (let j = 1; j <= envVarCount; j++) {
          environment[`ENV_VAR_${j}`] = `value_${i}_${j}`;
          environment[`COMPLEX_VAR_${j}`] = `complex value with spaces & symbols ${i}-${j}`;
        }

        return {
          environment,
          expectedOutput: `Command ${i + 1} with ${envVarCount} env vars\n`,
        };
      });

      // Set up mock calls
      commands.forEach(cmd => {
        mockExec.mockImplementationOnce(mockExecCallback(cmd.expectedOutput));
      });

      const startTime = Date.now();

      const promises = commands.map((cmd, index) =>
        manager.execCommand(testContainerId, `env-test-${index + 1}`, {
          environment: cmd.environment,
          timeout: 5000,
        })
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(commandCount);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.stdout).toBe(commands[index].expectedOutput);

        // Verify that the command contains the environment variables
        Object.keys(commands[index].environment).forEach(envVar => {
          expect(result.command).toContain(`--env ${envVar}=`);
        });
      });

      expect(duration).toBeLessThan(3000); // Should handle complex env vars efficiently
    });

    it('should maintain performance with very long command strings', async () => {
      const commandLengths = [100, 500, 1000, 5000, 10000]; // Character lengths

      const commands = commandLengths.map(length => {
        const longArg = 'x'.repeat(length - 20); // Account for echo command length
        return {
          command: `echo "${longArg}"`,
          expectedOutput: `${longArg}\n`,
        };
      });

      // Set up mock calls
      commands.forEach(cmd => {
        mockExec.mockImplementationOnce(mockExecCallback(cmd.expectedOutput));
      });

      const startTime = Date.now();

      const promises = commands.map(cmd =>
        manager.execCommand(testContainerId, cmd.command, {
          timeout: 10000,
        })
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(commands.length);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.stdout).toBe(commands[index].expectedOutput);
        expect(result.command.length).toBeGreaterThan(commandLengths[index] + 50); // Account for docker exec prefix
      });

      expect(duration).toBeLessThan(2000); // Should handle long commands efficiently
    });
  });

  describe('edge case performance scenarios', () => {
    it('should handle runtime switching under load', async () => {
      const switchCount = 20;
      const runtimes = ['docker', 'podman'] as const;

      // Set up alternating runtime responses and mock calls
      for (let i = 0; i < switchCount; i++) {
        const runtime = runtimes[i % 2];
        vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce(runtime);
        mockExec.mockImplementationOnce(mockExecCallback(`${runtime} output ${i + 1}\n`));
      }

      const promises = Array.from({ length: switchCount }, (_, i) =>
        manager.execCommand(testContainerId, `runtime-switch-test-${i + 1}`)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(switchCount);
      results.forEach((result, index) => {
        const expectedRuntime = runtimes[index % 2];
        expect(result.success).toBe(true);
        expect(result.command).toContain(`${expectedRuntime} exec`);
        expect(result.stdout).toBe(`${expectedRuntime} output ${index + 1}\n`);
      });
    });

    it('should handle mixed container IDs efficiently', async () => {
      const containerCount = 15;
      const containers = Array.from({ length: containerCount }, (_, i) => ({
        id: `container-${i + 1}-${Math.random().toString(36).substr(2, 9)}`,
        output: `Container ${i + 1} output\n`,
      }));

      // Set up mock calls for different containers
      containers.forEach(container => {
        mockExec.mockImplementationOnce(mockExecCallback(container.output));
      });

      const promises = containers.map(container =>
        manager.execCommand(container.id, 'echo "container specific command"', {
          environment: { CONTAINER_ID: container.id },
          timeout: 3000,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(containerCount);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.stdout).toBe(containers[index].output);
        expect(result.command).toContain(containers[index].id);
        expect(result.command).toContain(`--env CONTAINER_ID=${containers[index].id}`);
      });
    });
  });
});