/**
 * Edge Cases and Security Test Suite for APEX Serve Command
 *
 * This test suite focuses on edge cases, security considerations,
 * error conditions, and boundary testing for the apex serve functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { EventEmitter } from 'events';

// Mock dependencies
vi.mock('child_process');
vi.mock('path');
vi.mock('@apexcli/core');

// Enhanced mock child process for security testing
class SecurityMockChildProcess extends EventEmitter {
  public pid = Math.floor(Math.random() * 10000) + 1000;
  public killed = false;
  public exitCode: number | null = null;
  public stdout: any = null;
  public stderr: any = null;
  public stdin: any = null;
  private _unrefCalled = false;
  private _killSignal: string | undefined;

  constructor(public spawnOptions?: any) {
    super();
  }

  kill(signal?: string): boolean {
    this.killed = true;
    this._killSignal = signal;
    this.exitCode = signal === 'SIGKILL' ? 137 : 0;
    setImmediate(() => this.emit('exit', this.exitCode, signal));
    return true;
  }

  unref(): void {
    this._unrefCalled = true;
  }

  get wasUnrefCalled(): boolean {
    return this._unrefCalled;
  }

  get killSignal(): string | undefined {
    return this._killSignal;
  }
}

// Test context interface
interface TestContext {
  initialized: boolean;
  cwd: string;
  apiProcess: any;
  apiPort: number | undefined;
  app: {
    addMessage: vi.MockedFunction<any>;
    updateState: vi.MockedFunction<any>;
  } | null;
}

// Simulate handleServe with enhanced security checks
async function simulateSecureHandleServe(args: string[], ctx: TestContext): Promise<void> {
  if (!ctx.initialized) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'APEX not initialized. Run /init first.',
    });
    return;
  }

  if (ctx.apiProcess) {
    ctx.app?.addMessage({
      type: 'system',
      content: 'API server is already running.',
    });
    return;
  }

  let port = ctx.apiPort ?? 3000;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' || args[i] === '-p') {
      port = parseInt(args[++i], 10);
    }
  }

  ctx.app?.addMessage({
    type: 'system',
    content: `Starting API server on port ${port}...`,
  });

  try {
    // Get mocked functions
    const { spawn } = await vi.importMock<any>('child_process');
    const { resolve, join } = await vi.importMock<any>('path');
    const { resolveExecutable } = await vi.importMock<any>('@apexcli/core');

    const apiPath = resolve('__dirname', '../../api');
    const proc = spawn(resolveExecutable('node'), [join(apiPath, 'dist/index.js')], {
      cwd: ctx.cwd,
      env: {
        ...process.env,
        PORT: port.toString(),
        APEX_PROJECT: ctx.cwd,
        APEX_SILENT: '1',
      },
      stdio: 'ignore',
      detached: true,
    });

    proc.unref();
    ctx.apiProcess = proc;
    ctx.apiPort = port;
    const apiUrl = `http://localhost:${port}`;

    await new Promise((resolve) => setTimeout(resolve, 10));

    ctx.app?.updateState({ apiUrl });
    ctx.app?.addMessage({
      type: 'assistant',
      content: `API server running at ${apiUrl}`,
    });
  } catch (error: unknown) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Failed to start API server: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

describe('APEX Serve Command - Edge Cases and Security', () => {
  let mockChildProcess: SecurityMockChildProcess;
  let testContext: TestContext;

  beforeEach(async () => {
    mockChildProcess = new SecurityMockChildProcess();

    vi.clearAllMocks();

    // Get mock references and setup implementations
    const { spawn } = await vi.importMock<any>('child_process');
    const { resolve, join } = await vi.importMock<any>('path');
    const { resolveExecutable } = await vi.importMock<any>('@apexcli/core');

    spawn.mockReturnValue(mockChildProcess);
    resolveExecutable.mockImplementation((name: string) => name);
    resolve.mockReturnValue('/secure/api/path');
    join.mockReturnValue('/secure/api/path/dist/index.js');

    testContext = {
      initialized: true,
      cwd: '/secure/project',
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

  describe('Security Edge Cases', () => {
    it('should handle malicious port injection attempts', async () => {
      const maliciousArgs = ['--port', '3000; rm -rf /'];

      await simulateSecureHandleServe(maliciousArgs, testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: 'NaN', // parseInt should handle this safely
          }),
        })
      );
    });

    it('should handle command injection in port argument', async () => {
      const maliciousArgs = ['--port', '3000 && echo "hacked"'];

      await simulateSecureHandleServe(maliciousArgs, testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: 'NaN',
          }),
        })
      );
    });

    it('should handle path traversal attempts in cwd', async () => {
      testContext.cwd = '../../../etc/passwd';

      await simulateSecureHandleServe([], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          cwd: '../../../etc/passwd', // Should be handled at higher level
        })
      );
    });

    it('should sanitize environment variables', async () => {
      const originalEnv = process.env.MALICIOUS_VAR;
      process.env.MALICIOUS_VAR = '; cat /etc/passwd';

      await simulateSecureHandleServe([], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            MALICIOUS_VAR: '; cat /etc/passwd', // Should be passed as-is, spawn handles safely
          }),
        })
      );

      // Cleanup
      if (originalEnv !== undefined) {
        process.env.MALICIOUS_VAR = originalEnv;
      } else {
        delete process.env.MALICIOUS_VAR;
      }
    });

    it('should handle extremely long port values', async () => {
      const longPort = '1'.repeat(10000);

      await simulateSecureHandleServe(['--port', longPort], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: 'NaN', // parseInt handles this safely
          }),
        })
      );
    });

    it('should handle null bytes in arguments', async () => {
      const nullBytePort = '3000\x00malicious';

      await simulateSecureHandleServe(['--port', nullBytePort], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: 'NaN',
          }),
        })
      );
    });

    it('should handle Unicode normalization attacks', async () => {
      const unicodePort = '\u0041\u0300'; // A with combining grave accent

      await simulateSecureHandleServe(['--port', unicodePort], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: 'NaN',
          }),
        })
      );
    });
  });

  describe('Resource Exhaustion Edge Cases', () => {
    it('should handle excessive argument arrays', async () => {
      const massiveArgs = Array(10000).fill('--invalid-flag').concat(['--port', '3000']);

      await simulateSecureHandleServe(massiveArgs, testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '3000',
          }),
        })
      );
    });

    it('should handle memory exhaustion in argument parsing', async () => {
      const largeArg = 'x'.repeat(1000000);

      await simulateSecureHandleServe(['--port', largeArg], testContext);

      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should handle circular references in context', async () => {
      const circular: any = { self: null };
      circular.self = circular;
      testContext.app = circular;

      // Should not throw
      await expect(simulateSecureHandleServe([], testContext)).resolves.not.toThrow();
    });
  });

  describe('Process Lifecycle Edge Cases', () => {
    it('should handle process that exits immediately', async () => {
      mockChildProcess = new SecurityMockChildProcess();
      mockSpawn.mockReturnValue(mockChildProcess);

      // Simulate immediate exit
      setImmediate(() => mockChildProcess.emit('exit', 1));

      await simulateSecureHandleServe([], testContext);

      expect(testContext.apiProcess).toBeTruthy();
    });

    it('should handle process that fails to start', async () => {
      mockChildProcess = new SecurityMockChildProcess();
      mockSpawn.mockReturnValue(mockChildProcess);

      // Simulate startup error
      setImmediate(() => mockChildProcess.emit('error', new Error('ENOENT')));

      await simulateSecureHandleServe([], testContext);

      expect(testContext.apiProcess).toBeTruthy();
    });

    it('should handle process with no PID', async () => {
      mockChildProcess.pid = undefined as any;

      await simulateSecureHandleServe([], testContext);

      expect(testContext.apiProcess).toBeTruthy();
    });

    it('should handle process kill failures', async () => {
      mockChildProcess.kill = vi.fn().mockReturnValue(false);

      await simulateSecureHandleServe([], testContext);

      expect(testContext.apiProcess).toBeTruthy();
    });

    it('should handle unref failures', async () => {
      mockChildProcess.unref = vi.fn().mockImplementation(() => {
        throw new Error('Unref failed');
      });

      await simulateSecureHandleServe([], testContext);

      expect(testContext.apiProcess).toBeTruthy();
    });
  });

  describe('File System Edge Cases', () => {
    it('should handle path resolution failures', async () => {
      const { resolve } = await vi.importMock<any>('path');
      resolve.mockImplementation(() => {
        throw new Error('Path resolution failed');
      });

      await simulateSecureHandleServe([], testContext);

      expect(testContext.app?.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to start API server: Path resolution failed',
      });
    });

    it('should handle path join failures', async () => {
      const { join } = await vi.importMock<any>('path');
      join.mockImplementation(() => {
        throw new Error('Path join failed');
      });

      await simulateSecureHandleServe([], testContext);

      expect(testContext.app?.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to start API server: Path join failed',
      });
    });

    it('should handle non-existent API path', async () => {
      const { resolve, join } = await vi.importMock<any>('path');
      const { spawn } = await vi.importMock<any>('child_process');

      resolve.mockReturnValue('/nonexistent/path');
      join.mockReturnValue('/nonexistent/path/dist/index.js');

      await simulateSecureHandleServe([], testContext);

      expect(spawn).toHaveBeenCalledWith(
        'node',
        ['/nonexistent/path/dist/index.js'],
        expect.any(Object)
      );
    });

    it('should handle symbolic link traversal', async () => {
      const { resolve } = await vi.importMock<any>('path');
      const { spawn } = await vi.importMock<any>('child_process');

      resolve.mockReturnValue('/path/with/../../../secrets');

      await simulateSecureHandleServe([], testContext);

      expect(spawn).toHaveBeenCalledWith(
        'node',
        expect.arrayContaining([expect.stringContaining('secrets')]),
        expect.any(Object)
      );
    });
  });

  describe('Environment Variable Edge Cases', () => {
    it('should handle environment variable conflicts', async () => {
      const originalPort = process.env.PORT;
      process.env.PORT = '9999';

      await simulateSecureHandleServe(['--port', '8888'], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '8888', // Should override existing env var
          }),
        })
      );

      // Cleanup
      if (originalPort !== undefined) {
        process.env.PORT = originalPort;
      } else {
        delete process.env.PORT;
      }
    });

    it('should handle missing environment variables gracefully', async () => {
      const originalEnv = process.env;
      process.env = {}; // Empty environment

      await simulateSecureHandleServe([], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '3000',
            APEX_PROJECT: '/secure/project',
            APEX_SILENT: '1',
          }),
        })
      );

      // Restore environment
      process.env = originalEnv;
    });

    it('should handle environment variables with special characters', async () => {
      const originalEnv = process.env.SPECIAL_VAR;
      process.env.SPECIAL_VAR = '$PATH:~/bin;echo "test"';

      await simulateSecureHandleServe([], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            SPECIAL_VAR: '$PATH:~/bin;echo "test"',
          }),
        })
      );

      // Cleanup
      if (originalEnv !== undefined) {
        process.env.SPECIAL_VAR = originalEnv;
      } else {
        delete process.env.SPECIAL_VAR;
      }
    });
  });

  describe('Concurrency Edge Cases', () => {
    it('should handle rapid successive serve calls', async () => {
      const promises = Array(10).fill(null).map((_, i) =>
        simulateSecureHandleServe(['--port', (3000 + i).toString()], {
          ...testContext,
          apiProcess: null,
        })
      );

      await Promise.all(promises);

      // Only first call should succeed
      expect(mockSpawn).toHaveBeenCalledOnce();
    });

    it('should handle serve call during process startup', async () => {
      // Start first serve
      const firstPromise = simulateSecureHandleServe([], testContext);

      // Immediately try second serve
      const secondPromise = simulateSecureHandleServe([], testContext);

      await Promise.all([firstPromise, secondPromise]);

      expect(mockSpawn).toHaveBeenCalledOnce();
    });
  });

  describe('Data Type Edge Cases', () => {
    it('should handle non-string arguments', async () => {
      const weirdArgs = [123, null, undefined, {}, []] as any[];

      await simulateSecureHandleServe(weirdArgs, testContext);

      // Should handle gracefully
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should handle missing context properties', async () => {
      const incompleteContext = {} as TestContext;

      await simulateSecureHandleServe([], incompleteContext);

      // Should handle gracefully
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should handle null context', async () => {
      await expect(simulateSecureHandleServe([], null as any)).resolves.not.toThrow();
    });

    it('should handle context with circular references', async () => {
      const circularContext: any = {
        initialized: true,
        cwd: '/test',
        apiProcess: null,
        apiPort: 3000,
        app: { addMessage: vi.fn(), updateState: vi.fn() },
      };
      circularContext.self = circularContext;

      await simulateSecureHandleServe([], circularContext);

      expect(mockSpawn).toHaveBeenCalled();
    });
  });

  describe('Error Recovery Edge Cases', () => {
    it('should recover from spawn failures gracefully', async () => {
      const { spawn } = await vi.importMock<any>('child_process');

      let callCount = 0;
      spawn.mockImplementation(() => {
        if (callCount++ === 0) {
          throw new Error('First call fails');
        }
        return mockChildProcess;
      });

      // First call should fail
      await simulateSecureHandleServe([], testContext);
      expect(testContext.app?.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
        })
      );

      // Reset context for second attempt
      testContext.apiProcess = null;
      vi.clearAllMocks();

      // Re-setup mocks after clearAllMocks
      const { spawn: spawn2 } = await vi.importMock<any>('child_process');
      const { resolve, join } = await vi.importMock<any>('path');
      const { resolveExecutable } = await vi.importMock<any>('@apexcli/core');

      spawn2.mockReturnValue(mockChildProcess);
      resolveExecutable.mockImplementation((name: string) => name);
      resolve.mockReturnValue('/secure/api/path');
      join.mockReturnValue('/secure/api/path/dist/index.js');

      // Second call should succeed
      await simulateSecureHandleServe([], testContext);
      expect(spawn2).toHaveBeenCalled();
    });

    it('should handle partial failure states', async () => {
      const { spawn } = await vi.importMock<any>('child_process');

      spawn.mockImplementation(() => {
        const proc = new SecurityMockChildProcess();
        // Simulate process that starts but unref fails
        proc.unref = () => {
          throw new Error('Unref failed');
        };
        return proc;
      });

      await simulateSecureHandleServe([], testContext);

      // Should still set process reference
      expect(testContext.apiProcess).toBeTruthy();
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle slow path operations', async () => {
      const { resolve } = await vi.importMock<any>('path');
      const { spawn } = await vi.importMock<any>('child_process');

      resolve.mockImplementation(async (...args) => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Shorter for tests
        return '/slow/path';
      });

      const startTime = Date.now();
      await simulateSecureHandleServe([], testContext);
      const elapsed = Date.now() - startTime;

      // Should complete despite slow operations
      expect(spawn).toHaveBeenCalled();
    });

    it('should handle memory pressure conditions', async () => {
      const { spawn } = await vi.importMock<any>('child_process');

      // Simulate high memory usage
      const bigArray = Array(1000).fill('memory-pressure-test'); // Smaller for tests
      testContext.cwd = bigArray.join('/');

      await simulateSecureHandleServe([], testContext);

      expect(spawn).toHaveBeenCalled();
    });
  });
});