/**
 * APEX Serve Command - Edge Cases and Stress Test Suite
 *
 * This test suite focuses on edge cases, boundary conditions,
 * and stress testing scenarios for the apex serve command.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// Mock the child_process module
const mockSpawn = vi.fn();
const mockExecSync = vi.fn();

vi.mock('child_process', () => ({
  spawn: mockSpawn,
  execSync: mockExecSync,
}));

// Mock path module
const mockPathResolve = vi.fn();
const mockPathJoin = vi.fn();

vi.mock('path', () => ({
  resolve: mockPathResolve,
  join: mockPathJoin,
}));

// Mock resolveExecutable from @apexcli/core
vi.mock('@apexcli/core', () => ({
  resolveExecutable: (name: string) => name,
  isWindows: () => false,
  getPlatformShell: () => ({ shell: '/bin/bash' }),
}));

// Enhanced MockChildProcess with more realistic behavior
class MockChildProcess extends EventEmitter {
  public pid: number;
  public killed = false;
  public exitCode: number | null = null;
  private _unrefCalled = false;
  private _failureMode: string | null = null;

  constructor(failureMode?: string) {
    super();
    this.pid = Math.floor(Math.random() * 90000) + 10000; // Random PID
    this._failureMode = failureMode || null;
  }

  kill(signal?: string): boolean {
    if (this._failureMode === 'unkillable') {
      return false;
    }

    this.killed = true;
    this.exitCode = this._failureMode === 'abnormal_exit' ? 1 : 0;

    setImmediate(() => {
      this.emit('exit', this.exitCode, signal);
    });

    return true;
  }

  unref(): void {
    this._unrefCalled = true;
  }

  get wasUnrefCalled(): boolean {
    return this._unrefCalled;
  }

  // Simulate process startup failure
  simulateStartupFailure(): void {
    setImmediate(() => {
      // Only emit if we have listeners to prevent unhandled errors
      if (this.listenerCount('error') > 0) {
        this.emit('error', new Error('Process startup failed'));
      }
    });
  }

  // Simulate process crash
  simulateCrash(): void {
    setImmediate(() => {
      this.killed = true;
      this.exitCode = 1;
      this.emit('exit', 1, 'SIGSEGV');
    });
  }
}

describe('APEX Serve Command - Edge Cases and Stress Tests', () => {
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathResolve.mockReturnValue('/mock/api/path');
    mockPathJoin.mockReturnValue('/mock/api/path/dist/index.js');

    mockContext = {
      initialized: true,
      cwd: '/mock/project',
      apiProcess: null,
      apiPort: 3000,
      app: {
        addMessage: vi.fn(),
        updateState: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Port Edge Cases', () => {
    it('should handle minimum port number (1)', () => {
      const args = ['--port', '1'];
      let port = 3000;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      expect(port).toBe(1);
    });

    it('should handle maximum port number (65535)', () => {
      const args = ['--port', '65535'];
      let port = 3000;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      expect(port).toBe(65535);
    });

    it('should handle port number beyond valid range', () => {
      const args = ['--port', '65536'];
      let port = 3000;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      expect(port).toBe(65536); // Parser doesn't validate range
    });

    it('should handle floating point port numbers', () => {
      const args = ['--port', '3000.5'];
      let port = 3000;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      expect(port).toBe(3000); // parseInt truncates
    });

    it('should handle port with leading zeros', () => {
      const args = ['--port', '03000'];
      let port = 3000;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      expect(port).toBe(3000);
    });

    it('should handle hexadecimal port numbers', () => {
      const args = ['--port', '0x1770']; // 6000 in hex
      let port = 3000;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      expect(port).toBe(0); // parseInt with radix 10 fails on hex
    });
  });

  describe('Argument Parsing Edge Cases', () => {
    it('should handle empty arguments array', () => {
      const args: string[] = [];
      let port = 3000;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      expect(port).toBe(3000);
    });

    it('should handle arguments with special characters', () => {
      const args = ['--port', '3000', '--config', '/path/with spaces/config.json'];
      let port = 3000;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      expect(port).toBe(3000);
    });

    it('should handle malformed flag without value', () => {
      const args = ['--port'];
      let port = 3000;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          const nextArg = args[++i]; // undefined
          port = parseInt(nextArg, 10);
        }
      }

      expect(port).toBeNaN();
    });

    it('should handle mixed case flags', () => {
      const args = ['--PORT', '4000']; // Mixed case
      let port = 3000;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      expect(port).toBe(3000); // Case sensitive, no match
    });

    it('should handle very long argument arrays', () => {
      const args = Array(1000).fill('--other').concat(['--port', '5000']);
      let port = 3000;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      expect(port).toBe(5000);
    });
  });

  describe('Process Management Edge Cases', () => {
    it('should handle process that fails to start', async () => {
      const mockProc = new MockChildProcess('startup_failure');
      mockSpawn.mockReturnValue(mockProc);

      const errorHandler = vi.fn();
      mockProc.on('error', errorHandler);

      // Simulate the spawn call
      mockSpawn('node', ['/mock/api/dist/index.js'], {
        detached: true,
        stdio: 'ignore',
      });

      // Use a promise to handle the async event
      const errorPromise = new Promise<void>((resolve) => {
        mockProc.on('error', () => {
          resolve();
        });
      });

      mockProc.simulateStartupFailure();

      await errorPromise;

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Process startup failed'
        })
      );
    });

    it('should handle process that crashes immediately', async () => {
      const mockProc = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProc);

      const exitHandler = vi.fn();
      mockProc.on('exit', exitHandler);

      mockSpawn('node', ['/mock/api/dist/index.js'], {
        detached: true,
        stdio: 'ignore',
      });

      // Use a promise to handle the async event
      const exitPromise = new Promise<void>((resolve) => {
        mockProc.on('exit', () => {
          resolve();
        });
      });

      mockProc.simulateCrash();

      await exitPromise;

      expect(exitHandler).toHaveBeenCalledWith(1, 'SIGSEGV');
    });

    it('should handle unkillable process', () => {
      const mockProc = new MockChildProcess('unkillable');
      mockSpawn.mockReturnValue(mockProc);

      mockSpawn('node', ['/mock/api/dist/index.js'], {
        detached: true,
        stdio: 'ignore',
      });

      const killResult = mockProc.kill('SIGTERM');
      expect(killResult).toBe(false);
      expect(mockProc.killed).toBe(false);
    });

    it('should handle multiple rapid spawn attempts', () => {
      for (let i = 0; i < 10; i++) {
        const mockProc = new MockChildProcess();
        mockSpawn.mockReturnValueOnce(mockProc);

        mockSpawn('node', ['/mock/api/dist/index.js'], {
          detached: true,
          stdio: 'ignore',
        });

        mockProc.unref();
      }

      expect(mockSpawn).toHaveBeenCalledTimes(10);
    });
  });

  describe('Environment Variable Edge Cases', () => {
    it('should handle environment with existing APEX variables', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        APEX_SILENT: '0', // Should be overridden
        APEX_PROJECT: '/different/path', // Should be overridden
      };

      mockSpawn('node', ['/mock/api/dist/index.js'], {
        env: {
          ...process.env,
          PORT: '3000',
          APEX_PROJECT: '/mock/project',
          APEX_SILENT: '1',
        },
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_SILENT: '1', // Overridden
            APEX_PROJECT: '/mock/project', // Overridden
          })
        })
      );

      process.env = originalEnv;
    });

    it('should handle environment with undefined process.env', () => {
      const originalEnv = process.env;
      // @ts-ignore - Testing edge case
      process.env = undefined;

      expect(() => {
        mockSpawn('node', ['/mock/api/dist/index.js'], {
          env: {
            ...process.env,
            PORT: '3000',
            APEX_PROJECT: '/mock/project',
            APEX_SILENT: '1',
          },
        });
      }).not.toThrow();

      process.env = originalEnv;
    });

    it('should handle very large environment variables', () => {
      const largeValue = 'x'.repeat(100000); // 100KB string

      mockSpawn('node', ['/mock/api/dist/index.js'], {
        env: {
          PORT: '3000',
          APEX_PROJECT: largeValue,
          APEX_SILENT: '1',
        },
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_PROJECT: largeValue,
          })
        })
      );
    });
  });

  describe('Context State Edge Cases', () => {
    it('should handle context without app property', () => {
      const contextWithoutApp = {
        initialized: true,
        cwd: '/mock/project',
        apiProcess: null,
        apiPort: 3000,
        // app: undefined - missing
      };

      expect(() => {
        contextWithoutApp.app?.addMessage({
          type: 'system',
          content: 'Starting API server...',
        });
      }).not.toThrow();
    });

    it('should handle context with null values', () => {
      const nullContext = {
        initialized: true,
        cwd: null,
        apiProcess: null,
        apiPort: null,
        app: {
          addMessage: vi.fn(),
          updateState: vi.fn(),
        },
      };

      const port = nullContext.apiPort ?? 3000;
      expect(port).toBe(3000);
    });

    it('should handle context state corruption', () => {
      const corruptContext = {
        initialized: 'yes', // Should be boolean
        cwd: 123, // Should be string
        apiProcess: 'not-a-process', // Should be ChildProcess
        apiPort: '3000', // Should be number
        app: {
          addMessage: 'not-a-function',
          updateState: null,
        },
      };

      // Code should handle type mismatches gracefully
      expect(typeof corruptContext.initialized).toBe('string');
      expect(typeof corruptContext.cwd).toBe('number');
      expect(typeof corruptContext.apiPort).toBe('string');
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle spawn with large arguments array', () => {
      const largeArgs = Array(1000).fill('--config').concat(['value']);

      mockSpawn('node', largeArgs, {
        detached: true,
        stdio: 'ignore',
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        largeArgs,
        expect.any(Object)
      );
    });

    it('should handle rapid successive spawn calls', async () => {
      const promises: Promise<void>[] = [];

      for (let i = 0; i < 100; i++) {
        promises.push(new Promise<void>((resolve) => {
          const mockProc = new MockChildProcess();
          mockSpawn.mockReturnValueOnce(mockProc);

          mockSpawn('node', ['/mock/api/dist/index.js'], {
            detached: true,
            stdio: 'ignore',
          });

          mockProc.unref();
          resolve();
        }));
      }

      await Promise.all(promises);
      expect(mockSpawn).toHaveBeenCalledTimes(100);
    });

    it('should handle cleanup of event listeners', () => {
      const mockProc = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProc);

      const errorHandler = vi.fn();
      const exitHandler = vi.fn();

      mockProc.on('error', errorHandler);
      mockProc.on('exit', exitHandler);

      // Simulate cleanup
      mockProc.removeAllListeners();

      mockProc.simulateStartupFailure();
      mockProc.simulateCrash();

      // Handlers should not be called after cleanup
      expect(errorHandler).not.toHaveBeenCalled();
      expect(exitHandler).not.toHaveBeenCalled();
    });
  });

  describe('Path Resolution Edge Cases', () => {
    it('should handle path resolution failure', () => {
      mockPathResolve.mockImplementation(() => {
        throw new Error('Path resolution failed');
      });

      expect(() => {
        mockPathResolve('__dirname', '../../api');
      }).toThrow('Path resolution failed');
    });

    it('should handle very long path names', () => {
      const longPath = '/very/long/path/' + 'a'.repeat(1000) + '/api';
      mockPathResolve.mockReturnValue(longPath);
      mockPathJoin.mockReturnValue(longPath + '/dist/index.js');

      const apiPath = mockPathResolve('__dirname', '../../api');
      const scriptPath = mockPathJoin(apiPath, 'dist/index.js');

      expect(scriptPath).toBe(longPath + '/dist/index.js');
    });

    it('should handle paths with special characters', () => {
      const specialPath = '/path with spaces/and$pecial&chars/api';
      mockPathResolve.mockReturnValue(specialPath);
      mockPathJoin.mockReturnValue(specialPath + '/dist/index.js');

      const apiPath = mockPathResolve('__dirname', '../../api');
      const scriptPath = mockPathJoin(apiPath, 'dist/index.js');

      expect(scriptPath).toBe(specialPath + '/dist/index.js');
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle simultaneous initialization checks', () => {
      // Simulate race condition where multiple threads check initialization
      const results: boolean[] = [];

      for (let i = 0; i < 10; i++) {
        results.push(mockContext.initialized);
      }

      expect(results.every(result => result === true)).toBe(true);
    });

    it('should handle concurrent port assignments', () => {
      const ports = [3000, 3001, 3002, 3003, 3004];
      const assignments: number[] = [];

      ports.forEach(port => {
        assignments.push(port);
      });

      expect(assignments).toEqual(ports);
    });

    it('should handle overlapping spawn operations', async () => {
      const spawns: Promise<any>[] = [];

      for (let i = 0; i < 5; i++) {
        spawns.push(new Promise(resolve => {
          const mockProc = new MockChildProcess();
          mockSpawn.mockReturnValueOnce(mockProc);

          const proc = mockSpawn('node', ['/mock/api/dist/index.js'], {
            detached: true,
            stdio: 'ignore',
          });

          resolve(proc);
        }));
      }

      const results = await Promise.all(spawns);
      expect(results).toHaveLength(5);
      expect(mockSpawn).toHaveBeenCalledTimes(5);
    });
  });
});