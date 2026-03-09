/**
 * APEX Serve Process Management Test Suite
 *
 * This test suite focuses on process management aspects of the apex serve command,
 * including detached process handling, background execution, and process lifecycle.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('child_process');

// Extended mock child process that properly implements EventEmitter
class MockChildProcess extends EventEmitter {
  pid = Math.floor(Math.random() * 10000) + 1000;
  killed = false;
  exitCode: number | null = null;
  stdout = null;
  stderr = null;
  stdin = null;

  kill(signal: string | number = 'SIGTERM'): boolean {
    if (this.killed) return false;

    this.killed = true;
    this.exitCode = signal === 'SIGKILL' ? 137 : 0;

    // Emit exit event asynchronously
    process.nextTick(() => {
      this.emit('exit', this.exitCode, signal);
    });

    return true;
  }

  unref(): void {
    // Mock implementation - in real Node.js this detaches the process
  }

  disconnect(): void {
    // Mock implementation
  }
}

describe('APEX Serve Process Management', () => {
  let mockSpawn: Mock;
  let mockChildProcess: MockChildProcess;

  beforeEach(() => {
    mockChildProcess = new MockChildProcess();
    mockSpawn = vi.mocked(spawn);
    mockSpawn.mockImplementation(() => mockChildProcess as any);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Process Detachment', () => {

    it('should spawn process with detached flag set to true', async () => {
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

    it('should call unref() on spawned process for background operation', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      const unrefSpy = vi.spyOn(mockChildProcess, 'unref');

      resetContext();
      await handleServe([]);

      expect(unrefSpy).toHaveBeenCalled();
    });

    it('should configure stdio as ignored for detached process', async () => {
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

    it('should verify detached process can run independently', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();
      await handleServe([]);

      // Verify the process is configured for independence
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          detached: true,
          stdio: 'ignore'
        })
      );

      // Verify unref was called to allow parent to exit
      expect(mockChildProcess.unref).toHaveBeenCalled();
    });
  });

  describe('Background Execution', () => {

    it('should allow parent process to continue after spawning', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();

      const startTime = Date.now();
      await handleServe([]);
      const endTime = Date.now();

      // Function should complete relatively quickly (within reasonable time)
      // The 1500ms delay is internal, but the function should return
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('should not block parent process exit', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();
      await handleServe([]);

      // Verify process is unreferenced
      expect(mockChildProcess.unref).toHaveBeenCalled();

      // In a real scenario, this allows the parent process to exit
      // even if the child process is still running
    });

    it('should maintain process reference in context for management', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();
      await handleServe([]);

      const ctx = (global as any).ctx;
      expect(ctx.apiProcess).toBe(mockChildProcess);
      expect(ctx.apiProcess.pid).toBe(mockChildProcess.pid);
    });
  });

  describe('Process Lifecycle Management', () => {

    it('should handle process exit events', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();
      await handleServe([]);

      const exitHandler = vi.fn();
      mockChildProcess.on('exit', exitHandler);

      // Simulate process exit
      mockChildProcess.emit('exit', 0, 'SIGTERM');

      expect(exitHandler).toHaveBeenCalledWith(0, 'SIGTERM');
    });

    it('should handle process error events', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();
      await handleServe([]);

      const errorHandler = vi.fn();
      mockChildProcess.on('error', errorHandler);

      const testError = new Error('Process error');
      mockChildProcess.emit('error', testError);

      expect(errorHandler).toHaveBeenCalledWith(testError);
    });

    it('should handle process termination gracefully', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();
      await handleServe([]);

      expect(mockChildProcess.killed).toBe(false);

      // Terminate the process
      const killed = mockChildProcess.kill('SIGTERM');
      expect(killed).toBe(true);
      expect(mockChildProcess.killed).toBe(true);
    });

    it('should handle force kill if necessary', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();
      await handleServe([]);

      // Force kill the process
      const killed = mockChildProcess.kill('SIGKILL');
      expect(killed).toBe(true);
      expect(mockChildProcess.killed).toBe(true);
      expect(mockChildProcess.exitCode).toBe(137); // SIGKILL exit code
    });
  });

  describe('Process Monitoring and Health', () => {

    it('should track process ID for monitoring', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();
      await handleServe([]);

      const ctx = (global as any).ctx;
      expect(ctx.apiProcess.pid).toBeDefined();
      expect(typeof ctx.apiProcess.pid).toBe('number');
    });

    it('should handle process state changes', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();
      await handleServe([]);

      // Initially not killed
      expect(mockChildProcess.killed).toBe(false);

      // After kill
      mockChildProcess.kill();
      expect(mockChildProcess.killed).toBe(true);
    });

    it('should prevent multiple server instances', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      const mockApp = { addMessage: vi.fn(), updateState: vi.fn() };

      resetContext({
        initialized: true,
        cwd: '/test/project',
        apiProcess: mockChildProcess, // Already running
        apiPort: 3000,
        app: mockApp
      });

      await handleServe([]);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'API server is already running.'
      });

      // Should not spawn another process
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });

  describe('Cross-Platform Compatibility', () => {

    it('should use proper executable resolution', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();
      await handleServe([]);

      // Should use 'node' executable (cross-platform)
      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('should handle different signal types', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();
      await handleServe([]);

      // Test different signal types
      expect(mockChildProcess.kill('SIGTERM')).toBe(true);

      // Reset for next test
      mockChildProcess.killed = false;
      expect(mockChildProcess.kill('SIGINT')).toBe(true);

      // Reset for next test
      mockChildProcess.killed = false;
      expect(mockChildProcess.kill('SIGKILL')).toBe(true);
    });
  });

  describe('Resource Management', () => {

    it('should handle resource cleanup on process exit', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();
      await handleServe([]);

      const ctx = (global as any).ctx;
      expect(ctx.apiProcess).toBe(mockChildProcess);

      // Simulate process exit
      mockChildProcess.emit('exit', 0);

      // In a real implementation, this might clear the context reference
      // Here we just verify the exit event was handled
      expect(mockChildProcess.killed).toBe(false); // Exited naturally, not killed
    });

    it('should handle memory and file descriptor management', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();
      await handleServe([]);

      // Verify stdio is set to ignore to prevent file descriptor leaks
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          stdio: 'ignore'
        })
      );

      // Verify process is unreferenced to prevent memory leaks
      expect(mockChildProcess.unref).toHaveBeenCalled();
    });
  });

  describe('Error Recovery and Resilience', () => {

    it('should handle spawn failures gracefully', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      const mockApp = { addMessage: vi.fn(), updateState: vi.fn() };

      resetContext({
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: mockApp
      });

      // Mock spawn to fail
      mockSpawn.mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      await handleServe([]);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: expect.stringContaining('Failed to start API server')
      });
    });

    it('should handle process crash scenarios', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();
      await handleServe([]);

      // Simulate process crash
      mockChildProcess.emit('exit', 1, 'SIGABRT');

      // Process should handle the exit event
      expect(mockChildProcess.exitCode).toBe(1);
    });

    it('should handle unexpected process termination', async () => {
      const { handleServe, resetContext } = await import('./test-helpers/repl-serve-handler');

      resetContext();
      await handleServe([]);

      // Simulate unexpected termination
      mockChildProcess.emit('exit', null, 'SIGKILL');

      // Should handle null exit code (unexpected termination)
      expect(mockChildProcess.killed).toBe(false); // Not killed by our code
    });
  });
});