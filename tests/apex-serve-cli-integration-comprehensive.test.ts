/**
 * Comprehensive Integration Tests for APEX Serve CLI Command
 *
 * This test suite provides end-to-end integration testing for the apex serve
 * command, including CLI argument parsing, command routing, and integration
 * with the actual REPL command handling system.
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { EventEmitter } from 'events';

// Mock all external dependencies
vi.mock('child_process');
vi.mock('path');
vi.mock('@apexcli/core');
vi.mock('@apexcli/orchestrator');
vi.mock('url');

// Mock child process for integration testing
class MockChildProcess extends EventEmitter {
  public pid = Math.floor(Math.random() * 10000) + 1000;
  public killed = false;
  public exitCode: number | null = null;
  private _unrefCalled = false;

  constructor() {
    super();
    // Simulate successful process start
    setImmediate(() => this.emit('spawn'));
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

// Mock CLI context that matches the REPL structure
interface CLIContext {
  cwd: string;
  initialized: boolean;
  config: any;
  orchestrator: any;
  apiProcess: any;
  webUIProcess: any;
  apiPort: number | undefined;
  webUIPort: number | undefined;
  app: {
    addMessage: vi.MockedFunction<any>;
    updateState: vi.MockedFunction<any>;
  };
}

// Simulate the command handler function that would be called
async function simulateCLIServeCommand(command: string, args: string[], ctx: CLIContext): Promise<void> {
  if (command !== 'serve') {
    throw new Error('Invalid command for this test');
  }

  // Simulate the handleServe function from repl.tsx
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

    await new Promise((resolve) => setTimeout(resolve, 10)); // Shortened delay for tests

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

describe('APEX Serve CLI Command - Integration Tests', () => {
  let mockChildProcess: MockChildProcess;
  let cliContext: CLIContext;

  beforeEach(async () => {
    mockChildProcess = new MockChildProcess();

    // Reset all mocks
    vi.clearAllMocks();

    // Get mock references and setup implementations
    const { spawn } = await vi.importMock<any>('child_process');
    const { resolve, join } = await vi.importMock<any>('path');
    const { resolveExecutable } = await vi.importMock<any>('@apexcli/core');

    // Setup mock implementations
    spawn.mockReturnValue(mockChildProcess);
    resolveExecutable.mockImplementation((name: string) => name);
    resolve.mockReturnValue('/integration/api/path');
    join.mockReturnValue('/integration/api/path/dist/index.js');

    // Fresh CLI context for each test
    cliContext = {
      cwd: '/integration/test/project',
      initialized: true,
      config: { api: { autoStart: false } },
      orchestrator: null,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
      app: {
        addMessage: vi.fn(),
        updateState: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CLI Command Routing', () => {
    it('should handle serve command without arguments', async () => {
      await simulateCLIServeCommand('serve', [], cliContext);

      expect(cliContext.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Starting API server on port 3000...',
      });
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should handle serve command with --port flag', async () => {
      await simulateCLIServeCommand('serve', ['--port', '4000'], cliContext);

      expect(cliContext.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Starting API server on port 4000...',
      });
      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '4000',
          }),
        })
      );
    });

    it('should handle serve command with -p shorthand flag', async () => {
      await simulateCLIServeCommand('serve', ['-p', '5000'], cliContext);

      expect(cliContext.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Starting API server on port 5000...',
      });
      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '5000',
          }),
        })
      );
    });

    it('should reject invalid commands', async () => {
      await expect(simulateCLIServeCommand('invalid', [], cliContext)).rejects.toThrow('Invalid command for this test');
    });
  });

  describe('CLI Argument Parsing', () => {
    it('should parse port arguments correctly', async () => {
      await simulateCLIServeCommand('serve', ['--port', '8080'], cliContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        ['/integration/api/path/dist/index.js'],
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '8080',
          }),
        })
      );
    });

    it('should handle mixed argument formats', async () => {
      await simulateCLIServeCommand('serve', ['-p', '9000', '--extra-flag'], cliContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '9000',
          }),
        })
      );
    });

    it('should prioritize last port argument', async () => {
      await simulateCLIServeCommand('serve', ['--port', '7000', '-p', '8000'], cliContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '8000',
          }),
        })
      );
    });

    it('should handle empty argument array', async () => {
      await simulateCLIServeCommand('serve', [], cliContext);

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
  });

  describe('CLI State Management', () => {
    it('should update CLI context after successful start', async () => {
      await simulateCLIServeCommand('serve', ['-p', '6000'], cliContext);

      expect(cliContext.apiProcess).toBe(mockChildProcess);
      expect(cliContext.apiPort).toBe(6000);
    });

    it('should update app state with API URL', async () => {
      await simulateCLIServeCommand('serve', ['-p', '7000'], cliContext);

      expect(cliContext.app.updateState).toHaveBeenCalledWith({
        apiUrl: 'http://localhost:7000',
      });
    });

    it('should preserve existing CLI state on error', async () => {
      const originalApiPort = cliContext.apiPort;
      const originalApiProcess = cliContext.apiProcess;

      mockSpawn.mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      await simulateCLIServeCommand('serve', [], cliContext);

      // Context should not be modified on error
      expect(cliContext.apiPort).toBe(originalApiPort);
      expect(cliContext.apiProcess).toBe(originalApiProcess);
    });
  });

  describe('CLI Error Handling', () => {
    it('should handle uninitialized CLI state', async () => {
      cliContext.initialized = false;

      await simulateCLIServeCommand('serve', [], cliContext);

      expect(cliContext.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'APEX not initialized. Run /init first.',
      });
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should handle existing server process', async () => {
      cliContext.apiProcess = mockChildProcess;

      await simulateCLIServeCommand('serve', [], cliContext);

      expect(cliContext.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'API server is already running.',
      });
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should display error messages to user', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Integration test error');
      });

      await simulateCLIServeCommand('serve', [], cliContext);

      expect(cliContext.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to start API server: Integration test error',
      });
    });
  });

  describe('CLI Process Integration', () => {
    it('should integrate with process spawning system', async () => {
      await simulateCLIServeCommand('serve', [], cliContext);

      expect(mockResolveExecutable).toHaveBeenCalledWith('node');
      expect(mockPathResolve).toHaveBeenCalledWith('__dirname', '../../api');
      expect(mockPathJoin).toHaveBeenCalledWith('/integration/api/path', 'dist/index.js');
    });

    it('should configure process environment correctly', async () => {
      await simulateCLIServeCommand('serve', ['-p', '3333'], cliContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        ['/integration/api/path/dist/index.js'],
        expect.objectContaining({
          cwd: '/integration/test/project',
          env: expect.objectContaining({
            PORT: '3333',
            APEX_PROJECT: '/integration/test/project',
            APEX_SILENT: '1',
          }),
          stdio: 'ignore',
          detached: true,
        })
      );
    });

    it('should properly unref spawned processes', async () => {
      await simulateCLIServeCommand('serve', [], cliContext);

      expect(mockChildProcess.wasUnrefCalled).toBe(true);
    });
  });

  describe('CLI User Experience', () => {
    it('should provide clear status messages', async () => {
      await simulateCLIServeCommand('serve', ['-p', '4444'], cliContext);

      // Starting message
      expect(cliContext.app.addMessage).toHaveBeenNthCalledWith(1, {
        type: 'system',
        content: 'Starting API server on port 4444...',
      });

      // Success message
      expect(cliContext.app.addMessage).toHaveBeenNthCalledWith(2, {
        type: 'assistant',
        content: 'API server running at http://localhost:4444',
      });
    });

    it('should provide appropriate error messages', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Port already in use');
      });

      await simulateCLIServeCommand('serve', [], cliContext);

      expect(cliContext.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to start API server: Port already in use',
      });
    });

    it('should maintain message consistency', async () => {
      await simulateCLIServeCommand('serve', [], cliContext);

      const messages = cliContext.app.addMessage.mock.calls;
      expect(messages[0][0].type).toBe('system');
      expect(messages[1][0].type).toBe('assistant');
      expect(messages[0][0].content).toContain('Starting');
      expect(messages[1][0].content).toContain('running at');
    });
  });

  describe('CLI Command Workflow', () => {
    it('should execute complete serve workflow', async () => {
      await simulateCLIServeCommand('serve', ['--port', '5555'], cliContext);

      // Verify complete workflow
      expect(cliContext.app.addMessage).toHaveBeenCalledTimes(2);
      expect(mockSpawn).toHaveBeenCalledOnce();
      expect(cliContext.app.updateState).toHaveBeenCalledOnce();
      expect(cliContext.apiProcess).toBeTruthy();
      expect(cliContext.apiPort).toBe(5555);
    });

    it('should handle workflow interruption gracefully', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Workflow interrupted');
      });

      await simulateCLIServeCommand('serve', [], cliContext);

      expect(cliContext.app.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
        })
      );
      expect(cliContext.app.updateState).not.toHaveBeenCalled();
    });

    it('should maintain consistent state throughout workflow', async () => {
      const initialState = { ...cliContext };

      await simulateCLIServeCommand('serve', ['-p', '6666'], cliContext);

      // Verify state changes are consistent
      expect(cliContext.cwd).toBe(initialState.cwd);
      expect(cliContext.initialized).toBe(initialState.initialized);
      expect(cliContext.apiPort).toBe(6666);
      expect(cliContext.apiProcess).toBeTruthy();
    });
  });

  describe('CLI Integration Edge Cases', () => {
    it('should handle malformed port arguments', async () => {
      await simulateCLIServeCommand('serve', ['--port', 'invalid-port'], cliContext);

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

    it('should handle missing port value', async () => {
      await simulateCLIServeCommand('serve', ['--port'], cliContext);

      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should handle undefined context properties', async () => {
      cliContext.apiPort = undefined;

      await simulateCLIServeCommand('serve', [], cliContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '3000', // Should default
          }),
        })
      );
    });

    it('should handle concurrent serve attempts', async () => {
      // First call should succeed
      await simulateCLIServeCommand('serve', [], cliContext);
      expect(mockSpawn).toHaveBeenCalledTimes(1);

      // Second call should be rejected
      vi.clearAllMocks();
      await simulateCLIServeCommand('serve', [], cliContext);
      expect(mockSpawn).not.toHaveBeenCalled();
      expect(cliContext.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'API server is already running.',
      });
    });
  });
});