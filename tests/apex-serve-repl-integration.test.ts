/**
 * APEX Serve REPL Integration Test Suite
 *
 * This test suite focuses on the REPL-specific implementation of the handleServe function
 * including APEX_SILENT mode verification and REPL context handling
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

// Create hoisted mocks that can be referenced in vi.mock
const { mockSpawn, mockChildProcessInstance } = vi.hoisted(() => {
  const mockChildProcessInstance = {
    unref: vi.fn(),
    kill: vi.fn(),
    pid: 12345,
    on: vi.fn(),
    emit: vi.fn()
  };
  return {
    mockSpawn: vi.fn().mockReturnValue(mockChildProcessInstance),
    mockChildProcessInstance
  };
});

// Mock child_process module
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawn: mockSpawn
  };
});

describe('APEX Serve REPL Integration', () => {

  beforeEach(() => {
    mockSpawn.mockReturnValue(mockChildProcessInstance);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('REPL Context Integration', () => {

    it('should integrate with global REPL context', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext({
        initialized: true,
        cwd: '/repl/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: {
          addMessage: vi.fn(),
          updateState: vi.fn()
        }
      });

      await handleServe([]);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          cwd: '/repl/test/project'
        })
      );
    });

    it('should handle REPL state updates correctly', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      const mockApp = {
        addMessage: vi.fn(),
        updateState: vi.fn()
      };

      resetContext({
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: mockApp
      });

      await handleServe([]);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 1600));

      expect(mockApp.updateState).toHaveBeenCalledWith({
        apiUrl: 'http://localhost:3000'
      });
    });

    it('should manage REPL context process reference', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext({
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: { addMessage: vi.fn(), updateState: vi.fn() }
      });

      await handleServe([]);

      // Check that context was updated with process reference
      const ctx = (global as any).ctx;
      expect(ctx.apiProcess).toBe(mockChildProcess);
    });
  });

  describe('APEX_SILENT Mode Verification', () => {

    it('should always set APEX_SILENT=1 in REPL mode', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();

      await handleServe([]);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_SILENT: '1'
          })
        })
      );
    });

    it('should set APEX_SILENT regardless of other environment variables', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      // Set some environment variables that might conflict
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        APEX_SILENT: '0', // This should be overridden
        DEBUG: '1'
      };

      resetContext();

      await handleServe([]);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_SILENT: '1', // Should override existing value
            DEBUG: '1' // Should preserve other env vars
          })
        })
      );

      process.env = originalEnv;
    });

    it('should verify APEX_SILENT prevents console output in API server', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();

      await handleServe([]);

      // Verify the environment variable is set correctly for silent mode
      const spawnCall = mockSpawn.mock.calls[0];
      const env = spawnCall[2].env;

      expect(env).toHaveProperty('APEX_SILENT', '1');

      // In a real scenario, this would prevent the API server from logging
      // Here we just verify the configuration is correct
    });
  });

  describe('Process Detachment and Background Execution', () => {

    it('should spawn process with detached: true', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();

      await handleServe([]);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          detached: true
        })
      );
    });

    it('should call unref() on spawned process for background execution', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();

      await handleServe([]);

      expect(mockChildProcess.unref).toHaveBeenCalled();
    });

    it('should use stdio: ignore for detached process', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();

      await handleServe([]);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          stdio: 'ignore'
        })
      );
    });

    it('should handle process lifecycle correctly', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();

      await handleServe([]);

      // Verify process is stored in context
      const ctx = (global as any).ctx;
      expect(ctx.apiProcess).toBe(mockChildProcess);

      // Simulate process exit
      if (mockChildProcess.emit) {
        mockChildProcess.emit('exit', 0);
      }

      // Process should handle exit gracefully
      expect(mockChildProcess.unref).toHaveBeenCalled();
    });
  });

  describe('Error Handling in REPL Context', () => {

    it('should handle spawn errors gracefully in REPL', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      const mockApp = {
        addMessage: vi.fn(),
        updateState: vi.fn()
      };

      resetContext({
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: mockApp
      });

      // Mock spawn to throw an error
      mockSpawn.mockImplementation(() => {
        throw new Error('Failed to spawn process');
      });

      await handleServe([]);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: expect.stringContaining('Failed to start API server')
      });
    });

    it('should handle uninitialized REPL context', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      const mockApp = {
        addMessage: vi.fn(),
        updateState: vi.fn()
      };

      resetContext({
        initialized: false, // Not initialized
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: mockApp
      });

      await handleServe([]);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'APEX not initialized. Run /init first.'
      });

      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should handle existing API process in REPL', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      const mockApp = {
        addMessage: vi.fn(),
        updateState: vi.fn()
      };

      resetContext({
        initialized: true,
        cwd: '/test/project',
        apiProcess: { pid: 999 }, // Existing process
        apiPort: 3000,
        app: mockApp
      });

      await handleServe([]);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'API server is already running.'
      });

      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });

  describe('REPL Message Handling', () => {

    it('should send appropriate system messages during startup', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      const mockApp = {
        addMessage: vi.fn(),
        updateState: vi.fn()
      };

      resetContext({
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: mockApp
      });

      await handleServe([]);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Starting API server on port 3000...'
      });
    });

    it('should send success message after startup delay', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      const mockApp = {
        addMessage: vi.fn(),
        updateState: vi.fn()
      };

      resetContext({
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 4000,
        app: mockApp
      });

      await handleServe([]);

      // Wait for the startup delay
      await new Promise(resolve => setTimeout(resolve, 1600));

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: 'API server running at http://localhost:4000'
      });
    });

    it('should handle port-specific messages correctly', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      const mockApp = {
        addMessage: vi.fn(),
        updateState: vi.fn()
      };

      resetContext({
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: mockApp
      });

      await handleServe(['--port', '7777']);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Starting API server on port 7777...'
      });

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 1600));

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: 'API server running at http://localhost:7777'
      });
    });
  });

  describe('Startup Timing and State Management', () => {

    it('should wait for server startup before completing', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();

      const startTime = Date.now();
      await handleServe([]);
      const endTime = Date.now();

      // Should wait at least 1500ms for server startup
      expect(endTime - startTime).toBeGreaterThanOrEqual(1500);
    });

    it('should update context state after successful startup', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext({
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: { addMessage: vi.fn(), updateState: vi.fn() }
      });

      await handleServe(['--port', '8888']);

      const ctx = (global as any).ctx;
      expect(ctx.apiProcess).toBe(mockChildProcess);
      expect(ctx.apiPort).toBe(8888);
    });
  });
});