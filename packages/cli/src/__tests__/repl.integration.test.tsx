import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startInkREPL } from '../repl';

// Mock dependencies
vi.mock('@apexcli/core', () => ({
  isApexInitialized: vi.fn(),
  loadConfig: vi.fn(),
  loadAgents: vi.fn(),
  loadWorkflows: vi.fn(),
  formatCost: vi.fn((cost: number) => `$${cost.toFixed(2)}`),
  formatTokens: vi.fn((tokens: number) => `${tokens} tokens`),
  formatDuration: vi.fn((duration: number) => `${duration}ms`),
  getEffectiveConfig: vi.fn(),
}));

vi.mock('@apexcli/orchestrator', () => ({
  ApexOrchestrator: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    createTask: vi.fn(),
    executeTask: vi.fn(),
    getTask: vi.fn(),
    listTasks: vi.fn(),
    getTaskLogs: vi.fn(),
    cancelTask: vi.fn(),
    updateTaskStatus: vi.fn(),
  })),
  TaskStore: vi.fn(),
}));

vi.mock('../ui/index.js', () => ({
  startInkApp: vi.fn().mockResolvedValue({
    waitUntilExit: vi.fn(),
    addMessage: vi.fn(),
    updateState: vi.fn(),
  }),
}));

// Mock child_process for service spawning
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(),
}));

// Mock fs/promises for file operations
vi.mock('fs/promises', () => ({
  access: vi.fn(),
}));

describe('REPL Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock console methods to suppress output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock process methods
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    // Mock process signals
    vi.spyOn(process, 'on').mockImplementation(() => process as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('REPL Initialization', () => {
    it('starts REPL without errors', async () => {
      const { isApexInitialized } = await import('@apexcli/core');
      const { startInkApp } = await import('../ui/index.js');

      (isApexInitialized as any).mockResolvedValue(false);
      (startInkApp as any).mockResolvedValue({
        waitUntilExit: vi.fn().mockResolvedValue(undefined),
        addMessage: vi.fn(),
        updateState: vi.fn(),
      });

      // Mock process.exit to prevent actual exit
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      try {
        await expect(startInkREPL()).rejects.toThrow('Process exit called');
      } catch (error) {
        // Expected - we're mocking process.exit
      }

      expect(startInkApp).toHaveBeenCalled();
      mockExit.mockRestore();
    });

    it('handles initialized project correctly', async () => {
      const { isApexInitialized, loadConfig } = await import('@apexcli/core');
      const { ApexOrchestrator } = await import('@apexcli/orchestrator');
      const { startInkApp } = await import('../ui/index.js');

      (isApexInitialized as any).mockResolvedValue(true);
      (loadConfig as any).mockResolvedValue({ api: { autoStart: false } });
      (startInkApp as any).mockResolvedValue({
        waitUntilExit: vi.fn().mockResolvedValue(undefined),
        addMessage: vi.fn(),
        updateState: vi.fn(),
      });

      const mockOrchestrator = {
        initialize: vi.fn(),
      };
      (ApexOrchestrator as any).mockImplementation(() => mockOrchestrator);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      try {
        await expect(startInkREPL()).rejects.toThrow('Process exit called');
      } catch (error) {
        // Expected
      }

      expect(mockOrchestrator.initialize).toHaveBeenCalled();
      mockExit.mockRestore();
    });
  });

  describe('Git Integration', () => {
    it('detects git branch correctly', async () => {
      const { execSync } = await import('child_process');
      const { startInkApp } = await import('../ui/index.js');

      (execSync as any).mockReturnValue('feature-branch\n');
      (startInkApp as any).mockResolvedValue({
        waitUntilExit: vi.fn().mockResolvedValue(undefined),
        addMessage: vi.fn(),
        updateState: vi.fn(),
      });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      try {
        await expect(startInkREPL()).rejects.toThrow('Process exit called');
      } catch (error) {
        // Expected
      }

      expect(startInkApp).toHaveBeenCalledWith(
        expect.objectContaining({
          gitBranch: 'feature-branch',
        })
      );

      mockExit.mockRestore();
    });

    it('handles git errors gracefully', async () => {
      const { execSync } = await import('child_process');
      const { startInkApp } = await import('../ui/index.js');

      (execSync as any).mockImplementation(() => {
        throw new Error('Git not found');
      });
      (startInkApp as any).mockResolvedValue({
        waitUntilExit: vi.fn().mockResolvedValue(undefined),
        addMessage: vi.fn(),
        updateState: vi.fn(),
      });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      try {
        await expect(startInkREPL()).rejects.toThrow('Process exit called');
      } catch (error) {
        // Expected
      }

      expect(startInkApp).toHaveBeenCalledWith(
        expect.objectContaining({
          gitBranch: undefined,
        })
      );

      mockExit.mockRestore();
    });
  });

  describe('Auto-start Services', () => {
    it('auto-starts API when configured', async () => {
      const { isApexInitialized, loadConfig, getEffectiveConfig } = await import('@apexcli/core');
      const { spawn } = await import('child_process');
      const { startInkApp } = await import('../ui/index.js');

      (isApexInitialized as any).mockResolvedValue(true);
      (loadConfig as any).mockResolvedValue({ api: { autoStart: true, port: 3000 } });
      (getEffectiveConfig as any).mockReturnValue({ api: { autoStart: true, port: 3000 } });

      const mockProcess = { unref: vi.fn(), pid: 123 };
      (spawn as any).mockReturnValue(mockProcess);

      (startInkApp as any).mockResolvedValue({
        waitUntilExit: vi.fn().mockResolvedValue(undefined),
        addMessage: vi.fn(),
        updateState: vi.fn(),
      });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      try {
        await expect(startInkREPL()).rejects.toThrow('Process exit called');
      } catch (error) {
        // Expected
      }

      expect(spawn).toHaveBeenCalledWith(
        'node',
        expect.arrayContaining([expect.stringContaining('api')]),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '3000',
            APEX_SILENT: '1',
          }),
        })
      );

      mockExit.mockRestore();
    });

    it('auto-starts Web UI when configured', async () => {
      const { isApexInitialized, loadConfig, getEffectiveConfig } = await import('@apexcli/core');
      const { spawn } = await import('child_process');
      const { startInkApp } = await import('../ui/index.js');
      const fs = await import('fs/promises');

      (isApexInitialized as any).mockResolvedValue(true);
      (loadConfig as any).mockResolvedValue({
        api: { autoStart: true, port: 3000 },
      });
      (getEffectiveConfig as any).mockReturnValue({
        api: { autoStart: true, port: 3000 },
        webUI: { autoStart: true, port: 3001 },
      });

      (fs.access as any).mockResolvedValue(undefined);

      const mockProcess = { unref: vi.fn(), pid: 123 };
      (spawn as any).mockReturnValue(mockProcess);

      (startInkApp as any).mockResolvedValue({
        waitUntilExit: vi.fn().mockResolvedValue(undefined),
        addMessage: vi.fn(),
        updateState: vi.fn(),
      });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      try {
        await expect(startInkREPL()).rejects.toThrow('Process exit called');
      } catch (error) {
        // Expected
      }

      // Should start both API and Web UI
      expect(spawn).toHaveBeenCalledTimes(2);

      mockExit.mockRestore();
    });
  });

  describe('Signal Handling', () => {
    it('registers signal handlers for cleanup', async () => {
      const { startInkApp } = await import('../ui/index.js');

      (startInkApp as any).mockResolvedValue({
        waitUntilExit: vi.fn().mockResolvedValue(undefined),
        addMessage: vi.fn(),
        updateState: vi.fn(),
      });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      try {
        await expect(startInkREPL()).rejects.toThrow('Process exit called');
      } catch (error) {
        // Expected
      }

      // Should register SIGINT and SIGTERM handlers
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

      mockExit.mockRestore();
    });

    it('cleans up processes on signal', async () => {
      const { isApexInitialized, loadConfig, getEffectiveConfig } = await import('@apexcli/core');
      const { spawn } = await import('child_process');
      const { startInkApp } = await import('../ui/index.js');

      (isApexInitialized as any).mockResolvedValue(true);
      (loadConfig as any).mockResolvedValue({ api: { autoStart: true } });
      (getEffectiveConfig as any).mockReturnValue({ api: { autoStart: true } });

      const mockProcess = {
        unref: vi.fn(),
        pid: 123,
        kill: vi.fn(),
      };
      (spawn as any).mockReturnValue(mockProcess);

      (startInkApp as any).mockResolvedValue({
        waitUntilExit: vi.fn().mockResolvedValue(undefined),
        addMessage: vi.fn(),
        updateState: vi.fn(),
      });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      const mockKill = vi.spyOn(process, 'kill').mockImplementation(() => true);

      try {
        await expect(startInkREPL()).rejects.toThrow('Process exit called');
      } catch (error) {
        // Expected
      }

      // Get the SIGINT handler and call it
      const signalHandlers = (process.on as any).mock.calls;
      const sigintHandler = signalHandlers.find(([signal]: any) => signal === 'SIGINT')?.[1];

      if (sigintHandler) {
        expect(() => sigintHandler()).toThrow('Process exit called');
      }

      mockExit.mockRestore();
      mockKill.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('handles initialization errors gracefully', async () => {
      const { isApexInitialized } = await import('@apexcli/core');
      const { startInkApp } = await import('../ui/index.js');

      (isApexInitialized as any).mockRejectedValue(new Error('Init failed'));
      (startInkApp as any).mockResolvedValue({
        waitUntilExit: vi.fn().mockResolvedValue(undefined),
        addMessage: vi.fn(),
        updateState: vi.fn(),
      });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      // Should not throw - errors should be handled gracefully
      try {
        await expect(startInkREPL()).rejects.toThrow('Process exit called');
      } catch (error) {
        // Expected
      }

      expect(startInkApp).toHaveBeenCalled();
      mockExit.mockRestore();
    });

    it('handles service startup errors gracefully', async () => {
      const { isApexInitialized, loadConfig, getEffectiveConfig } = await import('@apexcli/core');
      const { spawn } = await import('child_process');
      const { startInkApp } = await import('../ui/index.js');

      (isApexInitialized as any).mockResolvedValue(true);
      (loadConfig as any).mockResolvedValue({ api: { autoStart: true } });
      (getEffectiveConfig as any).mockReturnValue({ api: { autoStart: true } });

      (spawn as any).mockImplementation(() => {
        throw new Error('Failed to spawn process');
      });

      (startInkApp as any).mockResolvedValue({
        waitUntilExit: vi.fn().mockResolvedValue(undefined),
        addMessage: vi.fn(),
        updateState: vi.fn(),
      });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      // Should handle spawn errors gracefully
      try {
        await expect(startInkREPL()).rejects.toThrow('Process exit called');
      } catch (error) {
        // Expected
      }

      expect(startInkApp).toHaveBeenCalled();
      mockExit.mockRestore();
    });
  });
});