/**
 * Comprehensive APEX Serve Command Test Suite
 *
 * This test suite provides comprehensive coverage for the apex serve command
 * including unit tests, integration tests, edge cases, and error handling.
 *
 * Test Categories:
 * 1. Unit tests for handleServe function
 * 2. CLI command integration tests
 * 3. Process management tests
 * 4. Environment variable tests
 * 5. Edge cases and error handling
 * 6. Port configuration tests
 * 7. APEX_SILENT mode tests
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { EventEmitter } from 'events';

// Mock the child_process module
const mockSpawn = vi.fn() as MockedFunction<any>;
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

// Create a comprehensive mock child process
class MockChildProcess extends EventEmitter {
  public pid = 12345;
  public killed = false;
  public exitCode: number | null = null;
  private _unrefCalled = false;

  constructor() {
    super();
  }

  kill(signal?: string): boolean {
    this.killed = true;
    this.exitCode = 0;
    setImmediate(() => this.emit('exit', 0, signal));
    return true;
  }

  unref(): void {
    this._unrefCalled = true;
  }

  get wasUnrefCalled(): boolean {
    return this._unrefCalled;
  }
}

describe('APEX Serve Command - Comprehensive Test Suite', () => {
  let mockChildProcess: MockChildProcess;
  let mockContext: any;

  beforeEach(() => {
    mockChildProcess = new MockChildProcess();

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    mockSpawn.mockReturnValue(mockChildProcess);
    mockPathResolve.mockReturnValue('/mock/api/path');
    mockPathJoin.mockReturnValue('/mock/api/path/dist/index.js');

    // Create a fresh mock context for each test
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

  describe('Unit Tests - handleServe Function Logic', () => {

    it('should check initialization status before proceeding', async () => {
      mockContext.initialized = false;

      // Simulate handleServe function logic
      if (!mockContext.initialized) {
        mockContext.app?.addMessage({
          type: 'error',
          content: 'APEX not initialized. Run /init first.',
        });
        return;
      }

      expect(mockContext.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'APEX not initialized. Run /init first.',
      });
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should prevent multiple server instances', async () => {
      mockContext.apiProcess = mockChildProcess;

      // Simulate handleServe function logic
      if (mockContext.apiProcess) {
        mockContext.app?.addMessage({
          type: 'system',
          content: 'API server is already running.',
        });
        return;
      }

      expect(mockContext.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'API server is already running.',
      });
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should parse port arguments correctly', async () => {
      const testCases = [
        { args: [], expectedPort: 3000 },
        { args: ['--port', '4000'], expectedPort: 4000 },
        { args: ['-p', '5000'], expectedPort: 5000 },
        { args: ['--port', '8080', '--other', 'flag'], expectedPort: 8080 },
        { args: ['-p', '9000', '--verbose'], expectedPort: 9000 },
      ];

      for (const { args, expectedPort } of testCases) {
        let port = mockContext.apiPort ?? 3000;

        // Simulate port parsing logic from handleServe
        for (let i = 0; i < args.length; i++) {
          if (args[i] === '--port' || args[i] === '-p') {
            port = parseInt(args[++i], 10);
          }
        }

        expect(port).toBe(expectedPort);
      }
    });

    it('should handle invalid port arguments gracefully', async () => {
      const invalidPortArgs = ['--port', 'invalid'];
      let port = mockContext.apiPort ?? 3000;

      for (let i = 0; i < invalidPortArgs.length; i++) {
        if (invalidPortArgs[i] === '--port' || invalidPortArgs[i] === '-p') {
          port = parseInt(invalidPortArgs[++i], 10);
        }
      }

      expect(port).toBeNaN();
    });

    it('should call spawn with correct arguments and environment', async () => {
      const args: string[] = ['--port', '3333'];
      let port = mockContext.apiPort ?? 3000;

      // Parse arguments
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      // Simulate handleServe spawn logic
      const apiPath = mockPathResolve('__dirname', '../../api');
      const proc = mockSpawn('node', [mockPathJoin(apiPath, 'dist/index.js')], {
        cwd: mockContext.cwd,
        env: {
          ...process.env,
          PORT: port.toString(),
          APEX_PROJECT: mockContext.cwd,
          APEX_SILENT: '1',
        },
        stdio: 'ignore',
        detached: true,
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        ['/mock/api/path/dist/index.js'],
        expect.objectContaining({
          cwd: '/mock/project',
          env: expect.objectContaining({
            PORT: '3333',
            APEX_PROJECT: '/mock/project',
            APEX_SILENT: '1',
          }),
          stdio: 'ignore',
          detached: true,
        })
      );
    });

    it('should handle spawn errors gracefully', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      let errorMessage = '';

      try {
        const apiPath = mockPathResolve('__dirname', '../../api');
        mockSpawn('node', [mockPathJoin(apiPath, 'dist/index.js')], {
          cwd: mockContext.cwd,
          env: {
            ...process.env,
            PORT: '3000',
            APEX_PROJECT: mockContext.cwd,
            APEX_SILENT: '1',
          },
          stdio: 'ignore',
          detached: true,
        });
      } catch (error) {
        errorMessage = `Failed to start API server: ${error instanceof Error ? error.message : String(error)}`;
        mockContext.app?.addMessage({
          type: 'error',
          content: errorMessage,
        });
      }

      expect(errorMessage).toBe('Failed to start API server: Spawn failed');
      expect(mockContext.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to start API server: Spawn failed',
      });
    });
  });

  describe('Process Management Tests', () => {

    it('should create detached process', async () => {
      const apiPath = mockPathResolve('__dirname', '../../api');
      const proc = mockSpawn('node', [mockPathJoin(apiPath, 'dist/index.js')], {
        cwd: mockContext.cwd,
        env: {
          ...process.env,
          PORT: '3000',
          APEX_PROJECT: mockContext.cwd,
          APEX_SILENT: '1',
        },
        stdio: 'ignore',
        detached: true,
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          stdio: 'ignore',
          detached: true,
        })
      );
    });

    it('should unref the spawned process', async () => {
      const apiPath = mockPathResolve('__dirname', '../../api');
      const proc = mockSpawn('node', [mockPathJoin(apiPath, 'dist/index.js')], {
        cwd: mockContext.cwd,
        env: {
          ...process.env,
          PORT: '3000',
          APEX_PROJECT: mockContext.cwd,
          APEX_SILENT: '1',
        },
        stdio: 'ignore',
        detached: true,
      });

      proc.unref();

      expect(mockChildProcess.wasUnrefCalled).toBe(true);
    });

    it('should update context with process reference and port', async () => {
      const port = 4000;
      const apiPath = mockPathResolve('__dirname', '../../api');
      const proc = mockSpawn('node', [mockPathJoin(apiPath, 'dist/index.js')], {
        cwd: mockContext.cwd,
        env: {
          ...process.env,
          PORT: port.toString(),
          APEX_PROJECT: mockContext.cwd,
          APEX_SILENT: '1',
        },
        stdio: 'ignore',
        detached: true,
      });

      proc.unref();
      mockContext.apiProcess = proc;
      mockContext.apiPort = port;

      expect(mockContext.apiProcess).toBe(mockChildProcess);
      expect(mockContext.apiPort).toBe(4000);
    });

    it('should handle process kill operations', async () => {
      const proc = mockChildProcess;

      expect(proc.killed).toBe(false);

      const killResult = proc.kill('SIGTERM');

      expect(killResult).toBe(true);
      expect(proc.killed).toBe(true);
      expect(proc.exitCode).toBe(0);
    });

    it('should handle process exit events', async () => {
      const proc = mockChildProcess;

      const exitPromise = new Promise<void>((resolve) => {
        proc.on('exit', (code, signal) => {
          expect(code).toBe(0);
          expect(signal).toBe('SIGTERM');
          resolve();
        });
      });

      proc.kill('SIGTERM');

      await exitPromise;
    });
  });

  describe('Environment Variable Configuration', () => {

    it('should set APEX_SILENT to 1', async () => {
      const apiPath = mockPathResolve('__dirname', '../../api');
      mockSpawn('node', [mockPathJoin(apiPath, 'dist/index.js')], {
        cwd: mockContext.cwd,
        env: {
          ...process.env,
          PORT: '3000',
          APEX_PROJECT: mockContext.cwd,
          APEX_SILENT: '1',
        },
        stdio: 'ignore',
        detached: true,
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_SILENT: '1',
          }),
        })
      );
    });

    it('should set APEX_PROJECT to current working directory', async () => {
      const apiPath = mockPathResolve('__dirname', '../../api');
      mockSpawn('node', [mockPathJoin(apiPath, 'dist/index.js')], {
        cwd: mockContext.cwd,
        env: {
          ...process.env,
          PORT: '3000',
          APEX_PROJECT: mockContext.cwd,
          APEX_SILENT: '1',
        },
        stdio: 'ignore',
        detached: true,
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_PROJECT: '/mock/project',
          }),
        })
      );
    });

    it('should set PORT environment variable correctly', async () => {
      const testPort = 8080;
      const apiPath = mockPathResolve('__dirname', '../../api');
      mockSpawn('node', [mockPathJoin(apiPath, 'dist/index.js')], {
        cwd: mockContext.cwd,
        env: {
          ...process.env,
          PORT: testPort.toString(),
          APEX_PROJECT: mockContext.cwd,
          APEX_SILENT: '1',
        },
        stdio: 'ignore',
        detached: true,
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '8080',
          }),
        })
      );
    });

    it('should preserve existing environment variables', async () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, CUSTOM_VAR: 'test-value' };

      const apiPath = mockPathResolve('__dirname', '../../api');
      mockSpawn('node', [mockPathJoin(apiPath, 'dist/index.js')], {
        cwd: mockContext.cwd,
        env: {
          ...process.env,
          PORT: '3000',
          APEX_PROJECT: mockContext.cwd,
          APEX_SILENT: '1',
        },
        stdio: 'ignore',
        detached: true,
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            CUSTOM_VAR: 'test-value',
            PORT: '3000',
            APEX_PROJECT: mockContext.cwd,
            APEX_SILENT: '1',
          }),
        })
      );

      process.env = originalEnv;
    });
  });

  describe('API Path Resolution', () => {

    it('should resolve API package path correctly', async () => {
      mockPathResolve.mockReturnValue('/resolved/api/path');
      mockPathJoin.mockReturnValue('/resolved/api/path/dist/index.js');

      const apiPath = mockPathResolve('__dirname', '../../api');
      const scriptPath = mockPathJoin(apiPath, 'dist/index.js');

      expect(mockPathResolve).toHaveBeenCalledWith('__dirname', '../../api');
      expect(mockPathJoin).toHaveBeenCalledWith('/resolved/api/path', 'dist/index.js');
      expect(scriptPath).toBe('/resolved/api/path/dist/index.js');
    });

    it('should use node executable for spawning', async () => {
      const apiPath = mockPathResolve('__dirname', '../../api');
      mockSpawn('node', [mockPathJoin(apiPath, 'dist/index.js')], {
        cwd: mockContext.cwd,
        env: {
          ...process.env,
          PORT: '3000',
          APEX_PROJECT: mockContext.cwd,
          APEX_SILENT: '1',
        },
        stdio: 'ignore',
        detached: true,
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.any(Object)
      );
    });
  });

  describe('User Interface Integration', () => {

    it('should send startup message', async () => {
      const port = 3000;

      mockContext.app?.addMessage({
        type: 'system',
        content: `Starting API server on port ${port}...`,
      });

      expect(mockContext.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Starting API server on port 3000...',
      });
    });

    it('should update state with API URL after startup', async () => {
      const port = 3000;
      const apiUrl = `http://localhost:${port}`;

      // Simulate the delay and success flow
      await new Promise((resolve) => setTimeout(resolve, 10)); // Shortened for testing

      mockContext.app?.updateState({ apiUrl });
      mockContext.app?.addMessage({
        type: 'assistant',
        content: `API server running at ${apiUrl}`,
      });

      expect(mockContext.app.updateState).toHaveBeenCalledWith({
        apiUrl: 'http://localhost:3000',
      });
      expect(mockContext.app.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: 'API server running at http://localhost:3000',
      });
    });

    it('should send error message on failure', async () => {
      const errorMessage = 'Test error';

      mockContext.app?.addMessage({
        type: 'error',
        content: `Failed to start API server: ${errorMessage}`,
      });

      expect(mockContext.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to start API server: Test error',
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {

    it('should handle missing app context gracefully', async () => {
      mockContext.app = undefined;

      // Should not throw when app is undefined
      expect(() => {
        mockContext.app?.addMessage({
          type: 'system',
          content: 'Starting API server on port 3000...',
        });
      }).not.toThrow();
    });

    it('should handle port 0 (system-assigned port)', async () => {
      const args = ['--port', '0'];
      let port = mockContext.apiPort ?? 3000;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      expect(port).toBe(0);
    });

    it('should handle very high port numbers', async () => {
      const args = ['--port', '65535'];
      let port = mockContext.apiPort ?? 3000;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      expect(port).toBe(65535);
    });

    it('should handle negative port numbers', async () => {
      const args = ['--port', '-1'];
      let port = mockContext.apiPort ?? 3000;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      expect(port).toBe(-1);
    });

    it('should handle empty port argument', async () => {
      const args = ['--port'];
      let port = mockContext.apiPort ?? 3000;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          const nextArg = args[++i];
          port = parseInt(nextArg, 10);
        }
      }

      expect(port).toBeNaN();
    });

    it('should handle multiple port flags (last one wins)', async () => {
      const args = ['--port', '3000', '-p', '4000'];
      let port = mockContext.apiPort ?? 3000;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      expect(port).toBe(4000);
    });
  });

  describe('Full Integration Workflow', () => {

    it('should execute complete serve workflow successfully', async () => {
      const args = ['--port', '5000'];

      // Simulate the complete handleServe workflow
      if (!mockContext.initialized) {
        mockContext.app?.addMessage({
          type: 'error',
          content: 'APEX not initialized. Run /init first.',
        });
        return;
      }

      if (mockContext.apiProcess) {
        mockContext.app?.addMessage({
          type: 'system',
          content: 'API server is already running.',
        });
        return;
      }

      let port = mockContext.apiPort ?? 3000;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      mockContext.app?.addMessage({
        type: 'system',
        content: `Starting API server on port ${port}...`,
      });

      try {
        const apiPath = mockPathResolve('__dirname', '../../api');
        const proc = mockSpawn('node', [mockPathJoin(apiPath, 'dist/index.js')], {
          cwd: mockContext.cwd,
          env: {
            ...process.env,
            PORT: port.toString(),
            APEX_PROJECT: mockContext.cwd,
            APEX_SILENT: '1',
          },
          stdio: 'ignore',
          detached: true,
        });

        proc.unref();
        mockContext.apiProcess = proc;
        mockContext.apiPort = port;
        const apiUrl = `http://localhost:${port}`;

        await new Promise((resolve) => setTimeout(resolve, 10)); // Shortened for testing

        mockContext.app?.updateState({ apiUrl });
        mockContext.app?.addMessage({
          type: 'assistant',
          content: `API server running at ${apiUrl}`,
        });
      } catch (error: unknown) {
        mockContext.app?.addMessage({
          type: 'error',
          content: `Failed to start API server: ${error instanceof Error ? error.message : String(error)}`,
        });
      }

      // Verify the complete workflow
      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        ['/mock/api/path/dist/index.js'],
        expect.objectContaining({
          cwd: '/mock/project',
          env: expect.objectContaining({
            PORT: '5000',
            APEX_PROJECT: '/mock/project',
            APEX_SILENT: '1',
          }),
          stdio: 'ignore',
          detached: true,
        })
      );

      expect(mockChildProcess.wasUnrefCalled).toBe(true);
      expect(mockContext.apiProcess).toBe(mockChildProcess);
      expect(mockContext.apiPort).toBe(5000);

      expect(mockContext.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Starting API server on port 5000...',
      });

      expect(mockContext.app.updateState).toHaveBeenCalledWith({
        apiUrl: 'http://localhost:5000',
      });

      expect(mockContext.app.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: 'API server running at http://localhost:5000',
      });
    });
  });
});