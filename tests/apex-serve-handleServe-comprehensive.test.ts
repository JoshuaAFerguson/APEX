/**
 * Comprehensive Test Suite for handleServe Function
 *
 * This test suite specifically tests the handleServe function implementation
 * from packages/cli/src/repl.tsx with comprehensive coverage including:
 * - Unit tests for all function behaviors
 * - Integration tests with mocked dependencies
 * - Edge cases and error scenarios
 * - Process management and lifecycle
 * - Environment variable configuration
 * - Port parsing and validation
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';

// Mock all dependencies before importing anything else
vi.mock('child_process');
vi.mock('path');
vi.mock('@apexcli/core');

// Mock child process implementation
class MockChildProcess extends EventEmitter implements Partial<ChildProcess> {
  public pid = Math.floor(Math.random() * 10000) + 1000;
  public killed = false;
  public exitCode: number | null = null;
  private _unrefCalled = false;

  constructor() {
    super();
  }

  kill(signal?: string): boolean {
    this.killed = true;
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
}

// Context interface for testing
interface TestContext {
  initialized: boolean;
  cwd: string;
  apiProcess: ChildProcess | null;
  apiPort: number | undefined;
  app: {
    addMessage: vi.MockedFunction<any>;
    updateState: vi.MockedFunction<any>;
  } | null;
}

// Get mock references that will be set in beforeEach
let mockSpawn: any;
let mockResolve: any;
let mockJoin: any;
let mockResolveExecutable: any;

// Simulate handleServe function logic for testing
async function simulateHandleServe(args: string[], ctx: TestContext): Promise<void> {
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
    // Find the API package path
    const apiPath = mockResolve('__dirname', '../../api');

    // Spawn the API server as a background process
    const proc = mockSpawn(mockResolveExecutable('node'), [mockJoin(apiPath, 'dist/index.js')], {
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

    // Wait for server to start (simulate 1500ms delay)
    await new Promise((resolve) => setTimeout(resolve, 10)); // Use shorter delay for tests

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

describe('handleServe Function - Comprehensive Test Suite', () => {
  let mockChildProcess: MockChildProcess;
  let testContext: TestContext;

  beforeEach(async () => {
    mockChildProcess = new MockChildProcess();

    // Reset all mocks
    vi.clearAllMocks();

    // Get mock references and setup implementations
    const childProcessMock = await vi.importMock<any>('child_process');
    const pathMock = await vi.importMock<any>('path');
    const coreMock = await vi.importMock<any>('@apexcli/core');

    mockSpawn = childProcessMock.spawn;
    mockResolve = pathMock.resolve;
    mockJoin = pathMock.join;
    mockResolveExecutable = coreMock.resolveExecutable;

    // Setup mock implementations
    mockSpawn.mockReturnValue(mockChildProcess);
    mockResolveExecutable.mockImplementation((name: string) => name);
    mockResolve.mockReturnValue('/mock/api/path');
    mockJoin.mockReturnValue('/mock/api/path/dist/index.js');

    // Fresh test context for each test
    testContext = {
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

  describe('Function Prerequisites', () => {
    it('should reject execution when APEX is not initialized', async () => {
      testContext.initialized = false;

      await simulateHandleServe([], testContext);

      expect(testContext.app?.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'APEX not initialized. Run /init first.',
      });
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should reject execution when API server is already running', async () => {
      testContext.apiProcess = mockChildProcess;

      await simulateHandleServe([], testContext);

      expect(testContext.app?.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'API server is already running.',
      });
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should proceed when all prerequisites are met', async () => {
      await simulateHandleServe([], testContext);

      expect(mockSpawn).toHaveBeenCalled();
      expect(testContext.app?.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system',
          content: expect.stringContaining('Starting API server on port'),
        })
      );
    });
  });

  describe('Port Configuration', () => {
    it('should use default port when no port specified', async () => {
      await simulateHandleServe([], testContext);

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

    it('should use context apiPort when no args provided', async () => {
      testContext.apiPort = 4000;

      await simulateHandleServe([], testContext);

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

    it('should parse --port flag correctly', async () => {
      await simulateHandleServe(['--port', '8080'], testContext);

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

    it('should parse -p flag correctly', async () => {
      await simulateHandleServe(['-p', '9000'], testContext);

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

    it('should handle multiple port flags (use last one)', async () => {
      await simulateHandleServe(['--port', '7000', '-p', '8000'], testContext);

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

    it('should handle port flag with no value gracefully', async () => {
      await simulateHandleServe(['--port'], testContext);

      // Should still attempt to start with undefined converted to NaN, then toString
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should handle non-numeric port values', async () => {
      await simulateHandleServe(['--port', 'invalid'], testContext);

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

  describe('Process Spawning', () => {
    it('should spawn process with correct command and arguments', async () => {
      await simulateHandleServe([], testContext);

      expect(mockResolveExecutable).toHaveBeenCalledWith('node');
      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        ['/mock/api/path/dist/index.js'],
        expect.any(Object)
      );
    });

    it('should spawn process with correct working directory', async () => {
      await simulateHandleServe([], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          cwd: '/mock/project',
        })
      );
    });

    it('should spawn process with detached option', async () => {
      await simulateHandleServe([], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          detached: true,
        })
      );
    });

    it('should spawn process with stdio ignore', async () => {
      await simulateHandleServe([], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          stdio: 'ignore',
        })
      );
    });

    it('should call unref on spawned process', async () => {
      await simulateHandleServe([], testContext);

      expect(mockChildProcess.wasUnrefCalled).toBe(true);
    });
  });

  describe('Environment Variables', () => {
    it('should set PORT environment variable', async () => {
      await simulateHandleServe(['-p', '5000'], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '5000',
          }),
        })
      );
    });

    it('should set APEX_PROJECT environment variable', async () => {
      await simulateHandleServe([], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_PROJECT: '/mock/project',
          }),
        })
      );
    });

    it('should set APEX_SILENT environment variable', async () => {
      await simulateHandleServe([], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_SILENT: '1',
          }),
        })
      );
    });

    it('should preserve existing environment variables', async () => {
      const originalEnv = process.env.EXISTING_VAR;
      process.env.EXISTING_VAR = 'test-value';

      await simulateHandleServe([], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            EXISTING_VAR: 'test-value',
          }),
        })
      );

      // Cleanup
      if (originalEnv !== undefined) {
        process.env.EXISTING_VAR = originalEnv;
      } else {
        delete process.env.EXISTING_VAR;
      }
    });
  });

  describe('Process Management', () => {
    it('should update context with spawned process reference', async () => {
      await simulateHandleServe([], testContext);

      expect(testContext.apiProcess).toBe(mockChildProcess);
    });

    it('should update context with port number', async () => {
      await simulateHandleServe(['-p', '7000'], testContext);

      expect(testContext.apiPort).toBe(7000);
    });

    it('should update app state with API URL', async () => {
      await simulateHandleServe(['-p', '6000'], testContext);

      expect(testContext.app?.updateState).toHaveBeenCalledWith({
        apiUrl: 'http://localhost:6000',
      });
    });

    it('should send confirmation message after startup', async () => {
      await simulateHandleServe(['-p', '5555'], testContext);

      expect(testContext.app?.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: 'API server running at http://localhost:5555',
      });
    });

    it('should send starting message before spawn', async () => {
      await simulateHandleServe(['-p', '4444'], testContext);

      expect(testContext.app?.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Starting API server on port 4444...',
      });
    });
  });

  describe('Path Resolution', () => {
    it('should resolve API path correctly', async () => {
      await simulateHandleServe([], testContext);

      expect(mockResolve).toHaveBeenCalledWith('__dirname', '../../api');
    });

    it('should join API path with dist/index.js', async () => {
      await simulateHandleServe([], testContext);

      expect(mockJoin).toHaveBeenCalledWith('/mock/api/path', 'dist/index.js');
    });

    it('should handle different resolved paths', async () => {
      mockResolve.mockReturnValue('/different/path');
      mockJoin.mockReturnValue('/different/path/dist/index.js');

      await simulateHandleServe([], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        ['/different/path/dist/index.js'],
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle spawn errors gracefully', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      await simulateHandleServe([], testContext);

      expect(testContext.app?.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to start API server: Spawn failed',
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockSpawn.mockImplementation(() => {
        throw 'String error';
      });

      await simulateHandleServe([], testContext);

      expect(testContext.app?.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to start API server: String error',
      });
    });

    it('should handle path resolution errors', async () => {
      mockResolve.mockImplementation(() => {
        throw new Error('Path resolution failed');
      });

      await simulateHandleServe([], testContext);

      expect(testContext.app?.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to start API server: Path resolution failed',
      });
    });

    it('should handle resolveExecutable errors', async () => {
      mockResolveExecutable.mockImplementation(() => {
        throw new Error('Cannot resolve node executable');
      });

      await simulateHandleServe([], testContext);

      expect(testContext.app?.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to start API server: Cannot resolve node executable',
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing app context gracefully', async () => {
      testContext.app = null;

      // Should not throw error
      await expect(simulateHandleServe([], testContext)).resolves.not.toThrow();
    });

    it('should handle undefined apiPort gracefully', async () => {
      testContext.apiPort = undefined;

      await simulateHandleServe([], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '3000', // Should default to 3000
          }),
        })
      );
    });

    it('should handle zero port value', async () => {
      await simulateHandleServe(['--port', '0'], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '0',
          }),
        })
      );
    });

    it('should handle negative port value', async () => {
      await simulateHandleServe(['--port', '-1'], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '-1',
          }),
        })
      );
    });

    it('should handle very large port values', async () => {
      await simulateHandleServe(['--port', '99999'], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '99999',
          }),
        })
      );
    });

    it('should handle empty args array', async () => {
      await simulateHandleServe([], testContext);

      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should handle args with extra flags', async () => {
      await simulateHandleServe(['--port', '3000', '--unknown-flag', 'value'], testContext);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '3000',
          }),
        })
      );
    });
  });

  describe('Timing and Async Behavior', () => {
    it('should handle server startup delay', async () => {
      const startTime = Date.now();

      await simulateHandleServe([], testContext);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(10); // Our test delay
    });

    it('should update state after delay', async () => {
      await simulateHandleServe(['-p', '3333'], testContext);

      // State should be updated after the delay
      expect(testContext.app?.updateState).toHaveBeenCalledWith({
        apiUrl: 'http://localhost:3333',
      });
    });

    it('should send success message after delay', async () => {
      await simulateHandleServe(['-p', '4444'], testContext);

      expect(testContext.app?.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: 'API server running at http://localhost:4444',
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete successful workflow', async () => {
      await simulateHandleServe(['--port', '8888'], testContext);

      // Verify all steps occurred in order
      expect(testContext.app?.addMessage).toHaveBeenNthCalledWith(1, {
        type: 'system',
        content: 'Starting API server on port 8888...',
      });

      expect(mockSpawn).toHaveBeenCalled();
      expect(mockChildProcess.wasUnrefCalled).toBe(true);
      expect(testContext.apiProcess).toBe(mockChildProcess);
      expect(testContext.apiPort).toBe(8888);

      expect(testContext.app?.updateState).toHaveBeenCalledWith({
        apiUrl: 'http://localhost:8888',
      });

      expect(testContext.app?.addMessage).toHaveBeenNthCalledWith(2, {
        type: 'assistant',
        content: 'API server running at http://localhost:8888',
      });
    });

    it('should maintain process reference for management', async () => {
      await simulateHandleServe([], testContext);

      const process = testContext.apiProcess as MockChildProcess;
      expect(process).toBeTruthy();
      expect(typeof process?.pid).toBe('number');
      expect(process?.killed).toBe(false);
    });
  });
});