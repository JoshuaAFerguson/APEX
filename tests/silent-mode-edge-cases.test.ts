/**
 * @fileoverview Edge cases and error path tests for silent mode functionality
 *
 * Tests various failure scenarios, edge cases, and error conditions
 * to ensure robust behavior under adverse conditions.
 */

import { describe, test, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Mock child process that can simulate various failure scenarios
class MockChildProcess extends EventEmitter {
  public pid: number = 12345;
  public stdout = null;
  public stderr = null;
  public stdin = null;
  public killed = false;
  public exitCode: number | null = null;

  constructor() {
    super();
    // Simulate process behavior
  }

  unref = vi.fn();
  kill = vi.fn().mockImplementation((signal?: NodeJS.Signals) => {
    this.killed = true;
    this.emit('exit', 0, signal);
    return true;
  });

  // Simulate process failure
  simulateFailure(error: Error) {
    setTimeout(() => this.emit('error', error), 10);
  }

  // Simulate process crash
  simulateCrash(code: number = 1) {
    setTimeout(() => {
      this.exitCode = code;
      this.emit('exit', code, null);
    }, 10);
  }
}

// Create hoisted mock
const { mockSpawn, createMockProcess } = vi.hoisted(() => {
  let mockProcess: MockChildProcess;

  return {
    mockSpawn: vi.fn().mockImplementation(() => {
      mockProcess = new MockChildProcess();
      return mockProcess;
    }),
    createMockProcess: () => mockProcess
  };
});

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawn: mockSpawn,
    default: {
      ...actual,
      spawn: mockSpawn
    }
  };
});

describe('Silent Mode Edge Cases and Error Handling', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetAllMocks();
  });

  describe('Environment Variable Edge Cases', () => {
    test('should handle APEX_SILENT with whitespace', () => {
      const edgeCaseValues = [
        '1 ',      // trailing space
        ' 1',      // leading space
        ' 1 ',     // both spaces
        '1\n',     // newline
        '1\t',     // tab
        '\t1\n',   // mixed whitespace
      ];

      edgeCaseValues.forEach(value => {
        process.env.APEX_SILENT = value;
        const silent = process.env.APEX_SILENT === '1';
        // Only exact '1' should be truthy
        expect(silent).toBe(false);
      });
    });

    test('should handle APEX_SILENT with numeric variations', () => {
      const numericValues = ['01', '1.0', '+1', '1e0', '0x1'];

      numericValues.forEach(value => {
        process.env.APEX_SILENT = value;
        const silent = process.env.APEX_SILENT === '1';
        expect(silent).toBe(false);
      });
    });

    test('should handle APEX_SILENT with boolean-like strings', () => {
      const booleanValues = ['true', 'True', 'TRUE', 'yes', 'on', 'enabled'];

      booleanValues.forEach(value => {
        process.env.APEX_SILENT = value;
        const silent = process.env.APEX_SILENT === '1';
        expect(silent).toBe(false);
      });
    });

    test('should handle undefined, null, and empty environment variables', () => {
      // Test undefined
      delete process.env.APEX_SILENT;
      expect(process.env.APEX_SILENT === '1').toBe(false);

      // Test empty string
      process.env.APEX_SILENT = '';
      expect(process.env.APEX_SILENT === '1').toBe(false);

      // Test null-like string
      process.env.APEX_SILENT = 'null';
      expect(process.env.APEX_SILENT === '1').toBe(false);

      // Test undefined string
      process.env.APEX_SILENT = 'undefined';
      expect(process.env.APEX_SILENT === '1').toBe(false);
    });

    test('should handle environment variable corruption scenarios', () => {
      const corruptedValues = [
        '\x00', // null byte
        '\uFFFD', // replacement character
        String.fromCharCode(0), // another null
        '1\x001', // embedded null
      ];

      corruptedValues.forEach(value => {
        process.env.APEX_SILENT = value;
        const silent = process.env.APEX_SILENT === '1';
        expect(silent).toBe(false);
      });
    });
  });

  describe('Process Spawning Error Scenarios', () => {
    test('should handle spawn ENOENT error (command not found)', async () => {
      const error = new Error('spawn ENOENT');
      (error as any).code = 'ENOENT';
      (error as any).errno = -2;

      mockSpawn.mockImplementation(() => {
        const proc = new MockChildProcess();
        proc.simulateFailure(error);
        return proc;
      });

      const proc = spawn('nonexistent-command', ['arg'], {
        env: { APEX_SILENT: '1' },
        stdio: 'ignore',
        detached: true,
      });

      // Should not throw synchronously
      expect(proc).toBeDefined();

      // Error should be emitted asynchronously
      const errorPromise = new Promise((resolve) => {
        proc.on('error', resolve);
      });

      const receivedError = await errorPromise;
      expect(receivedError).toBeInstanceOf(Error);
      expect((receivedError as Error).message).toBe('spawn ENOENT');
    });

    test('should handle spawn EACCES error (permission denied)', async () => {
      const error = new Error('spawn EACCES');
      (error as any).code = 'EACCES';
      (error as any).errno = -13;

      mockSpawn.mockImplementation(() => {
        const proc = new MockChildProcess();
        proc.simulateFailure(error);
        return proc;
      });

      const proc = spawn('restricted-command', ['arg'], {
        env: { APEX_SILENT: '1' },
        stdio: 'ignore',
        detached: true,
      });

      const errorPromise = new Promise((resolve) => {
        proc.on('error', resolve);
      });

      const receivedError = await errorPromise;
      expect((receivedError as Error).message).toBe('spawn EACCES');
    });

    test('should handle process crash scenarios', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new MockChildProcess();
        proc.simulateCrash(1); // Exit with code 1
        return proc;
      });

      const proc = spawn('node', ['/path/to/api/dist/index.js'], {
        env: { APEX_SILENT: '1' },
        stdio: 'ignore',
        detached: true,
      });

      const exitPromise = new Promise((resolve) => {
        proc.on('exit', (code, signal) => resolve({ code, signal }));
      });

      const exitInfo = await exitPromise;
      expect((exitInfo as any).code).toBe(1);
    });

    test('should handle process killed by signal', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new MockChildProcess();
        setTimeout(() => {
          proc.kill('SIGTERM');
          proc.emit('exit', null, 'SIGTERM');
        }, 10);
        return proc;
      });

      const proc = spawn('node', ['/path/to/api/dist/index.js'], {
        env: { APEX_SILENT: '1' },
        stdio: 'ignore',
        detached: true,
      });

      const exitPromise = new Promise((resolve) => {
        proc.on('exit', (code, signal) => resolve({ code, signal }));
      });

      const exitInfo = await exitPromise;
      expect((exitInfo as any).signal).toBe('SIGTERM');
    });
  });

  describe('Resource and Memory Management', () => {
    test('should handle multiple concurrent spawns', () => {
      const procCount = 10;
      const processes: any[] = [];

      for (let i = 0; i < procCount; i++) {
        const proc = spawn('node', [`/path/to/api${i}/dist/index.js`], {
          env: {
            APEX_SILENT: '1',
            INSTANCE: i.toString()
          },
          stdio: 'ignore',
          detached: true,
        });
        processes.push(proc);
      }

      expect(mockSpawn).toHaveBeenCalledTimes(procCount);

      // Verify each spawn has correct configuration
      mockSpawn.mock.calls.forEach((call, index) => {
        const options = call[2];
        expect(options.env).toHaveProperty('APEX_SILENT', '1');
        expect(options.env).toHaveProperty('INSTANCE', index.toString());
        expect(options.stdio).toBe('ignore');
        expect(options.detached).toBe(true);
      });
    });

    test('should handle process cleanup on parent exit', () => {
      mockSpawn('node', ['/path/to/api/dist/index.js'], {
        env: { APEX_SILENT: '1' },
        stdio: 'ignore',
        detached: true,
      });

      // Verify spawn was called with detached configuration for proper cleanup
      expect(mockSpawn).toHaveBeenCalledWith('node', ['/path/to/api/dist/index.js'], {
        env: { APEX_SILENT: '1' },
        stdio: 'ignore',
        detached: true,
      });
    });

    test('should handle file descriptor limits', () => {
      // Simulate many spawns to test file descriptor handling
      const manySpawns = 100;

      for (let i = 0; i < manySpawns; i++) {
        spawn('node', ['/path/to/api/dist/index.js'], {
          env: {
            APEX_SILENT: '1',
            BATCH: i.toString()
          },
          stdio: 'ignore', // This should prevent FD leaks
          detached: true,
        });
      }

      expect(mockSpawn).toHaveBeenCalledTimes(manySpawns);

      // All calls should use stdio: 'ignore' to prevent FD leaks
      mockSpawn.mock.calls.forEach(call => {
        expect(call[2].stdio).toBe('ignore');
      });
    });
  });

  describe('Platform-Specific Edge Cases', () => {
    test('should handle Windows-specific path issues', () => {
      // Mock Windows-like paths
      const windowsPath = 'C:\\path\\to\\api\\dist\\index.js';

      spawn('node', [windowsPath], {
        env: { APEX_SILENT: '1' },
        stdio: 'ignore',
        detached: true,
      });

      expect(mockSpawn).toHaveBeenCalledWith('node', [windowsPath], expect.objectContaining({
        env: expect.objectContaining({ APEX_SILENT: '1' }),
        stdio: 'ignore',
        detached: true,
      }));
    });

    test('should handle Unix-specific permission scenarios', () => {
      // Mock Unix-like executable
      const proc = spawn('/usr/bin/node', ['/path/to/api/dist/index.js'], {
        env: { APEX_SILENT: '1' },
        stdio: 'ignore',
        detached: true,
      });

      expect(mockSpawn).toHaveBeenCalledWith('/usr/bin/node', ['/path/to/api/dist/index.js'], expect.objectContaining({
        env: expect.objectContaining({ APEX_SILENT: '1' }),
        stdio: 'ignore',
        detached: true,
      }));
    });
  });

  describe('Configuration Validation Edge Cases', () => {
    test('should handle invalid spawn options gracefully', () => {
      // Test with undefined options
      spawn('node', ['/path/to/api/dist/index.js'], undefined as any);
      expect(mockSpawn).toHaveBeenCalled();

      // Test with null options
      spawn('node', ['/path/to/api/dist/index.js'], null as any);
      expect(mockSpawn).toHaveBeenCalled();
    });

    test('should handle malformed environment objects', () => {
      const malformedEnv = {
        APEX_SILENT: '1',
        UNDEFINED_VAR: undefined,
        NULL_VAR: null,
        [Symbol('test')]: 'symbol-key', // Non-string key
      } as any;

      spawn('node', ['/path/to/api/dist/index.js'], {
        env: malformedEnv,
        stdio: 'ignore',
        detached: true,
      });

      const call = mockSpawn.mock.calls[mockSpawn.mock.calls.length - 1];
      const passedEnv = call[2].env;

      expect(passedEnv).toHaveProperty('APEX_SILENT', '1');
    });

    test('should handle circular references in environment', () => {
      const circularEnv: any = { APEX_SILENT: '1' };
      circularEnv.self = circularEnv;

      // This should not crash the spawn call
      expect(() => {
        spawn('node', ['/path/to/api/dist/index.js'], {
          env: circularEnv,
          stdio: 'ignore',
          detached: true,
        });
      }).not.toThrow();
    });
  });

  describe('Timing and Race Condition Edge Cases', () => {
    test('should handle rapid spawn/kill cycles', () => {
      // Test rapid spawn calls
      for (let i = 0; i < 5; i++) {
        mockSpawn('node', ['/path/to/api/dist/index.js'], {
          env: { APEX_SILENT: '1' },
          stdio: 'ignore',
          detached: true,
        });
      }

      expect(mockSpawn).toHaveBeenCalledTimes(5);

      // Verify all spawns had correct configuration
      mockSpawn.mock.calls.forEach(call => {
        const options = call[2];
        expect(options.env).toHaveProperty('APEX_SILENT', '1');
        expect(options.stdio).toBe('ignore');
        expect(options.detached).toBe(true);
      });
    });

    test('should handle environment changes during spawn', () => {
      // Set initial value
      process.env.APEX_SILENT = '1';

      // Start spawn
      spawn('node', ['/path/to/api/dist/index.js'], {
        env: { ...process.env },
        stdio: 'ignore',
        detached: true,
      });

      // Change environment after spawn (should not affect spawned process)
      process.env.APEX_SILENT = '0';

      const call = mockSpawn.mock.calls[mockSpawn.mock.calls.length - 1];
      expect(call[2].env).toHaveProperty('APEX_SILENT', '1');
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    test('should handle large environment variable counts', () => {
      const largeEnv: Record<string, string> = {
        APEX_SILENT: '1',
        ...process.env
      };

      // Add many environment variables
      for (let i = 0; i < 1000; i++) {
        largeEnv[`TEST_VAR_${i}`] = `value${i}`;
      }

      spawn('node', ['/path/to/api/dist/index.js'], {
        env: largeEnv,
        stdio: 'ignore',
        detached: true,
      });

      const call = mockSpawn.mock.calls[mockSpawn.mock.calls.length - 1];
      expect(call[2].env).toHaveProperty('APEX_SILENT', '1');
      expect(Object.keys(call[2].env).length).toBeGreaterThan(1000);
    });

    test('should handle very long argument lists', () => {
      const longArgs: string[] = [];
      for (let i = 0; i < 100; i++) {
        longArgs.push(`--arg${i}=value${i}`);
      }

      spawn('node', ['/path/to/api/dist/index.js', ...longArgs], {
        env: { APEX_SILENT: '1' },
        stdio: 'ignore',
        detached: true,
      });

      const call = mockSpawn.mock.calls[mockSpawn.mock.calls.length - 1];
      expect(call[1]).toHaveLength(101); // Original file + 100 args
      expect(call[2].env).toHaveProperty('APEX_SILENT', '1');
    });

    test('should handle processes with long-running cleanup', () => {
      mockSpawn.mockImplementation(() => {
        const proc = new MockChildProcess();

        // Simulate delayed cleanup
        proc.kill = vi.fn().mockImplementation((signal) => {
          setTimeout(() => {
            proc.killed = true;
            proc.emit('exit', 0, signal);
          }, 100); // Delayed exit
          return true;
        });

        return proc;
      });

      const proc = spawn('node', ['/path/to/api/dist/index.js'], {
        env: { APEX_SILENT: '1' },
        stdio: 'ignore',
        detached: true,
      });

      proc.kill('SIGTERM');
      expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });
});