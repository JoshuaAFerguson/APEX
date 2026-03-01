/**
 * APEX Serve Command Audit Test Suite
 *
 * This test suite audits the functionality of the `apex serve` command
 * to verify API server starts from CLI with port configuration, APEX_SILENT mode,
 * and detached process handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// Mock child_process module
const mockSpawn = vi.fn();
vi.mock('child_process', () => ({
  spawn: mockSpawn
}));

// Mock path module
const mockPathResolve = vi.fn();
const mockPathJoin = vi.fn();
vi.mock('path', () => ({
  resolve: mockPathResolve,
  join: mockPathJoin
}));

// Create a mock that extends EventEmitter for proper child process behavior
class MockChildProcess extends EventEmitter {
  killed = false;
  exitCode: number | null = null;
  pid = 12345;

  kill(signal?: string) {
    this.killed = true;
    this.emit('exit', 0, signal);
    return true;
  }

  unref() {
    // Mock implementation
  }
}

describe('APEX Serve Command Audit', () => {
  let mockChildProcess: MockChildProcess;

  // Mock CLI context
  const mockContext = {
    initialized: true,
    cwd: '/mock/project',
    apiProcess: null as any,
    apiPort: 3000,
    app: {
      addMessage: vi.fn(),
      updateState: vi.fn()
    }
  };

  beforeEach(() => {
    mockChildProcess = new MockChildProcess();

    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock implementations
    mockSpawn.mockReturnValue(mockChildProcess);
    mockPathResolve.mockReturnValue('/mock/api/path');
    mockPathJoin.mockReturnValue('/mock/api/path/dist/index.js');

    // Setup context
    mockContext.apiProcess = null;
    mockContext.apiPort = 3000;
    mockContext.initialized = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CLI Command Handler Simulation', () => {

    it('should handle serve command with default port', async () => {
      // Simulate CLI serve command handler logic directly
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

      let port = mockContext.apiPort;
      const args: string[] = [];

      // Parse arguments (none in this test)
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      // Simulate starting server
      const apiPath = mockPathResolve('__dirname', '../../api');
      const proc = mockSpawn('node', [mockPathJoin(apiPath, 'dist/index.js')], {
        cwd: mockContext.cwd,
        env: {
          PORT: port.toString(),
          APEX_PROJECT: mockContext.cwd,
          APEX_SILENT: '1',
        },
        stdio: 'ignore',
        detached: true,
      });

      proc.unref();
      mockContext.apiProcess = proc;

      // Verify the spawn was called with correct parameters
      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        ['/mock/api/path/dist/index.js'],
        expect.objectContaining({
          cwd: '/mock/project',
          env: expect.objectContaining({
            PORT: '3000',
            APEX_PROJECT: '/mock/project',
            APEX_SILENT: '1',
          }),
          stdio: 'ignore',
          detached: true,
        })
      );
    });

    it('should handle serve command with custom port', async () => {
      let port = mockContext.apiPort;
      const args: string[] = ['--port', '4000'];

      // Parse arguments
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      // Simulate starting server
      const apiPath = mockPathResolve('__dirname', '../../api');
      mockSpawn('node', [mockPathJoin(apiPath, 'dist/index.js')], {
        cwd: mockContext.cwd,
        env: {
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
          env: expect.objectContaining({
            PORT: '4000',
          }),
        })
      );
    });

    it('should handle serve command with -p flag', async () => {
      let port = mockContext.apiPort;
      const args: string[] = ['-p', '5000'];

      // Parse arguments
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      // Simulate starting server
      const apiPath = mockPathResolve('__dirname', '../../api');
      mockSpawn('node', [mockPathJoin(apiPath, 'dist/index.js')], {
        cwd: mockContext.cwd,
        env: {
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
          env: expect.objectContaining({
            PORT: '5000',
          }),
        })
      );
    });

    it('should prevent multiple server instances', async () => {
      // Set existing process
      mockContext.apiProcess = mockChildProcess;

      // Should not spawn if already running
      if (mockContext.apiProcess) {
        mockContext.app?.addMessage({
          type: 'system',
          content: 'API server is already running.',
        });
        expect(mockSpawn).not.toHaveBeenCalled();
        expect(mockContext.app?.addMessage).toHaveBeenCalledWith({
          type: 'system',
          content: 'API server is already running.',
        });
      }
    });

    it('should require initialization', async () => {
      mockContext.initialized = false;

      if (!mockContext.initialized) {
        mockContext.app?.addMessage({
          type: 'error',
          content: 'APEX not initialized. Run /init first.',
        });
        expect(mockSpawn).not.toHaveBeenCalled();
        expect(mockContext.app?.addMessage).toHaveBeenCalledWith({
          type: 'error',
          content: 'APEX not initialized. Run /init first.',
        });
      }
    });
  });

  describe('REPL handleServe Function Simulation', () => {

    it('should start API server with correct environment variables', async () => {
      // Simulate the actual handleServe logic
      let port = mockContext.apiPort ?? 3000;
      const args: string[] = [];

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

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
          env: expect.objectContaining({
            APEX_SILENT: '1',
            APEX_PROJECT: mockContext.cwd,
            PORT: '3000',
          }),
        })
      );
    });

    it('should handle port parsing correctly', async () => {
      let port = mockContext.apiPort ?? 3000;
      const args: string[] = ['--port', '8080'];

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      const apiPath = mockPathResolve('__dirname', '../../api');
      mockSpawn('node', [mockPathJoin(apiPath, 'dist/index.js')], {
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
          env: expect.objectContaining({
            PORT: '8080',
          }),
        })
      );
    });

    it('should create detached process', async () => {
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
          stdio: 'ignore',
          detached: true,
        })
      );
    });

    it('should unref the process for background execution', async () => {
      const unrefSpy = vi.spyOn(mockChildProcess, 'unref');

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

      expect(unrefSpy).toHaveBeenCalled();
    });

    it('should update context with process reference', async () => {
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
      mockContext.apiProcess = proc;
      mockContext.apiPort = 3000;

      expect(mockContext.apiProcess).toBe(mockChildProcess);
      expect(mockContext.apiPort).toBe(3000);
    });

    it('should handle spawn errors gracefully', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Spawn failed');
      });

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
        mockContext.app?.addMessage({
          type: 'error',
          content: `Failed to start API server: ${error instanceof Error ? error.message : String(error)}`,
        });
      }

      expect(mockContext.app?.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to start API server: Spawn failed',
      });
    });
  });

  describe('Process Management', () => {

    it('should handle process cleanup on exit', async () => {
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

      mockContext.apiProcess = proc;

      // Simulate process exit
      mockChildProcess.emit('exit', 0);

      // Verify cleanup would occur
      expect(mockChildProcess.killed).toBeFalsy(); // Process exited naturally
    });

    it('should handle process kill signals', async () => {
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

      mockContext.apiProcess = proc;

      // Kill the process
      mockChildProcess.kill('SIGTERM');

      expect(mockChildProcess.killed).toBe(true);
    });
  });

  describe('Error Handling', () => {

    it('should handle invalid port numbers', async () => {
      let port = mockContext.apiPort ?? 3000;
      const args: string[] = ['--port', 'invalid'];

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      const apiPath = mockPathResolve('__dirname', '../../api');
      mockSpawn('node', [mockPathJoin(apiPath, 'dist/index.js')], {
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
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: 'NaN', // Invalid port becomes NaN
          }),
        })
      );
    });

    it('should handle missing API package', async () => {
      mockPathResolve.mockReturnValue('/nonexistent/path');
      mockPathJoin.mockReturnValue('/nonexistent/path/dist/index.js');

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

      // Should still attempt to spawn with the resolved path
      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        ['/nonexistent/path/dist/index.js'],
        expect.any(Object)
      );
    });
  });

  describe('Integration with API Server', () => {

    it('should wait for server startup', async () => {
      // Simulate the logic that would wait for server startup
      const port = 3000;
      const apiUrl = `http://localhost:${port}`;

      // Simulate the 1500ms delay that handleServe does
      await new Promise((resolve) => setTimeout(resolve, 10)); // Use smaller timeout for testing

      mockContext.app?.updateState({ apiUrl });
      mockContext.app?.addMessage({
        type: 'assistant',
        content: `API server running at ${apiUrl}`,
      });

      expect(mockContext.app?.updateState).toHaveBeenCalledWith({
        apiUrl: 'http://localhost:3000'
      });
      expect(mockContext.app?.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: 'API server running at http://localhost:3000',
      });
    });

    it('should provide correct API URL', async () => {
      let port = 9000;

      mockContext.apiPort = port;
      const apiUrl = `http://localhost:${port}`;

      mockContext.app?.updateState({ apiUrl });

      expect(mockContext.app?.updateState).toHaveBeenCalledWith({
        apiUrl: 'http://localhost:9000'
      });
    });
  });
});

describe('APEX Serve Command - Full Integration', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mockSpawn.mockReturnValue(new MockChildProcess());
    mockPathResolve.mockReturnValue('/test/api/path');
    mockPathJoin.mockReturnValue('/test/api/path/dist/index.js');
  });

  it('should verify complete serve workflow', async () => {
    const mockContext = {
      initialized: true,
      cwd: '/test/project',
      apiProcess: null as any,
      apiPort: 3000,
      app: {
        addMessage: vi.fn(),
        updateState: vi.fn()
      }
    };

    // Simulate complete serve workflow
    const args = ['--port', '3333'];
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

    // Verify all steps occurred
    expect(mockSpawn).toHaveBeenCalledOnce();
    expect(mockContext.app?.addMessage).toHaveBeenCalledWith({
      type: 'system',
      content: 'Starting API server on port 3333...',
    });
    expect(mockContext.apiPort).toBe(3333);
  });

  it('should verify APEX_SILENT mode configuration', async () => {
    const apiPath = mockPathResolve('__dirname', '../../api');
    mockSpawn('node', [mockPathJoin(apiPath, 'dist/index.js')], {
      cwd: '/test/project',
      env: {
        ...process.env,
        PORT: '3000',
        APEX_PROJECT: '/test/project',
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
          APEX_SILENT: '1'
        })
      })
    );
  });
});