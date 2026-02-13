/**
 * Tests for workspace handlers - handles workspace management commands
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import chalk from 'chalk';
import {
  handleWorkspaceList,
  handleWorkspaceInfo,
  handleWorkspaceCleanup,
  handleWorkspaceStats,
} from '../workspace-handlers.js';

// Mock chalk to prevent ANSI codes in test output
vi.mock('chalk', () => ({
  default: {
    red: vi.fn((str: string) => str),
    green: vi.fn((str: string) => str),
    yellow: vi.fn((str: string) => str),
    blue: vi.fn((str: string) => str),
    cyan: vi.fn((str: string) => str),
    gray: vi.fn((str: string) => str),
    magenta: vi.fn((str: string) => str),
    bold: vi.fn((str: string) => str),
  },
}));

// Mock console.log to capture output
const mockConsoleLog = vi.fn();
const mockConsoleError = vi.fn();
vi.spyOn(console, 'log').mockImplementation(mockConsoleLog);
vi.spyOn(console, 'error').mockImplementation(mockConsoleError);

// Sample workspace data
const mockWorkspace = {
  taskId: 'task_12345678901234567890',
  config: { strategy: 'isolated' },
  workspacePath: '/path/to/workspace',
  status: 'active' as const,
  createdAt: new Date('2024-01-01T10:00:00Z'),
  lastAccessed: new Date('2024-01-01T11:00:00Z'),
  containerId: 'container_123456789012',
  warnings: ['Warning: Low disk space'],
};

const mockWorkspaceStats = {
  activeCount: 5,
  cleanupPendingCount: 2,
  totalDiskUsage: 1073741824, // 1GB in bytes
  workspacesByStrategy: {
    isolated: 3,
    shared: 2,
  },
  oldestWorkspace: {
    taskId: 'task_oldest123456789',
    createdAt: new Date('2024-01-01T09:00:00Z'),
  },
  containerHealthStats: {
    monitoredContainers: 5,
    healthyContainers: 4,
    unhealthyContainers: 1,
    totalRestarts: 3,
  },
};

const mockContainerHealth = {
  status: 'running',
  running: true,
  cpuUsage: 25.5,
  memoryUsageMb: 1536, // 1.5GB
  restarts: 1,
  uptimeMs: 3600000, // 1 hour
};

describe('workspace-handlers', () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock context
    mockCtx = {
      orchestrator: {
        listAllWorkspaces: vi.fn(),
        getWorkspaceManager: vi.fn(() => ({
          getWorkspace: vi.fn(),
          cleanupWorkspace: vi.fn(),
          cleanupOldWorkspaces: vi.fn(),
          getWorkspaceStats: vi.fn(),
          getContainerHealth: vi.fn(),
        })),
      },
    };
  });

  describe('handleWorkspaceList', () => {
    it('should handle missing orchestrator', async () => {
      const ctxWithoutOrchestrator = { orchestrator: null };

      await handleWorkspaceList(ctxWithoutOrchestrator);

      expect(mockConsoleLog).toHaveBeenCalledWith('❌ Orchestrator not available');
    });

    it('should display message when no workspaces exist', async () => {
      mockCtx.orchestrator.listAllWorkspaces.mockResolvedValue([]);

      await handleWorkspaceList(mockCtx);

      expect(mockCtx.orchestrator.listAllWorkspaces).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('\nNo active task workspaces found.\n');
    });

    it('should list active workspaces with full details', async () => {
      mockCtx.orchestrator.listAllWorkspaces.mockResolvedValue([mockWorkspace]);

      await handleWorkspaceList(mockCtx);

      expect(mockCtx.orchestrator.listAllWorkspaces).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('\n📋 Active Task Workspaces:\n');
      expect(mockConsoleLog).toHaveBeenCalledWith('  task_1234567');
      expect(mockConsoleLog).toHaveBeenCalledWith('    Strategy: isolated');
      expect(mockConsoleLog).toHaveBeenCalledWith('    Path: /path/to/workspace');
      expect(mockConsoleLog).toHaveBeenCalledWith('    Status: active');
    });

    it('should show warnings when present', async () => {
      mockCtx.orchestrator.listAllWorkspaces.mockResolvedValue([mockWorkspace]);

      await handleWorkspaceList(mockCtx);

      expect(mockConsoleLog).toHaveBeenCalledWith('    Warnings:');
      expect(mockConsoleLog).toHaveBeenCalledWith('      - Warning: Low disk space');
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Failed to list workspaces');
      mockCtx.orchestrator.listAllWorkspaces.mockRejectedValue(error);

      await handleWorkspaceList(mockCtx);

      expect(mockConsoleError).toHaveBeenCalledWith(
        '\n❌ Failed to list workspaces: Failed to list workspaces\n'
      );
    });
  });

  describe('handleWorkspaceInfo', () => {
    it('should handle missing orchestrator', async () => {
      const ctxWithoutOrchestrator = { orchestrator: null };

      await handleWorkspaceInfo(ctxWithoutOrchestrator, ['task_123']);

      expect(mockConsoleLog).toHaveBeenCalledWith('❌ Orchestrator not available');
    });

    it('should show usage when no task ID provided', async () => {
      await handleWorkspaceInfo(mockCtx, []);

      expect(mockConsoleLog).toHaveBeenCalledWith('Usage: /workspace info <task-id>');
    });

    it('should handle workspace not found', async () => {
      const workspaceManager = mockCtx.orchestrator.getWorkspaceManager();
      workspaceManager.getWorkspace.mockReturnValue(null);

      await handleWorkspaceInfo(mockCtx, ['nonexistent']);

      expect(workspaceManager.getWorkspace).toHaveBeenCalledWith('nonexistent');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '\nWorkspace not found for task: nonexistent\n'
      );
    });

    it('should display workspace info with container health', async () => {
      const workspaceManager = mockCtx.orchestrator.getWorkspaceManager();
      workspaceManager.getWorkspace.mockReturnValue(mockWorkspace);
      workspaceManager.getContainerHealth.mockResolvedValue(mockContainerHealth);

      await handleWorkspaceInfo(mockCtx, ['task_123']);

      expect(workspaceManager.getWorkspace).toHaveBeenCalledWith('task_123');
      expect(workspaceManager.getContainerHealth).toHaveBeenCalledWith('task_123');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '\n📊 Workspace Info for Task task_1234567:\n'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith('  Strategy: isolated');
      expect(mockConsoleLog).toHaveBeenCalledWith('  Container Health:');
      expect(mockConsoleLog).toHaveBeenCalledWith('    Status: running');
      expect(mockConsoleLog).toHaveBeenCalledWith('    Running: Yes');
      expect(mockConsoleLog).toHaveBeenCalledWith('    CPU Usage: 25.5%');
      expect(mockConsoleLog).toHaveBeenCalledWith('    Memory Usage: 1.50 GB');
      expect(mockConsoleLog).toHaveBeenCalledWith('    Restarts: 1');
      expect(mockConsoleLog).toHaveBeenCalledWith('    Uptime: 1h');
    });

    it('should handle container health fetch error', async () => {
      const workspaceManager = mockCtx.orchestrator.getWorkspaceManager();
      workspaceManager.getWorkspace.mockReturnValue(mockWorkspace);
      workspaceManager.getContainerHealth.mockRejectedValue(new Error('Container not found'));

      await handleWorkspaceInfo(mockCtx, ['task_123']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '  Failed to get container health: Container not found'
      );
    });

    it('should handle general errors', async () => {
      const workspaceManager = mockCtx.orchestrator.getWorkspaceManager();
      workspaceManager.getWorkspace.mockImplementation(() => {
        throw new Error('Database error');
      });

      await handleWorkspaceInfo(mockCtx, ['task_123']);

      expect(mockConsoleError).toHaveBeenCalledWith(
        '\n❌ Failed to get workspace info: Database error\n'
      );
    });
  });

  describe('handleWorkspaceCleanup', () => {
    it('should handle missing orchestrator', async () => {
      const ctxWithoutOrchestrator = { orchestrator: null };

      await handleWorkspaceCleanup(ctxWithoutOrchestrator, []);

      expect(mockConsoleLog).toHaveBeenCalledWith('❌ Orchestrator not available');
    });

    it('should cleanup specific workspace when task ID provided', async () => {
      const workspaceManager = mockCtx.orchestrator.getWorkspaceManager();
      workspaceManager.cleanupWorkspace.mockResolvedValue(undefined);

      await handleWorkspaceCleanup(mockCtx, ['task_123']);

      expect(workspaceManager.cleanupWorkspace).toHaveBeenCalledWith('task_123');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '\n🧹 Cleaning up workspace for task task_123...'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '✅ Workspace for task task_123 cleaned up successfully.'
      );
    });

    it('should cleanup all old workspaces when no task ID provided', async () => {
      const workspaceManager = mockCtx.orchestrator.getWorkspaceManager();
      workspaceManager.cleanupOldWorkspaces.mockResolvedValue(undefined);

      await handleWorkspaceCleanup(mockCtx, []);

      expect(workspaceManager.cleanupOldWorkspaces).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '\n🧹 Cleaning up all old workspaces...\n'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '✅ Old workspaces cleanup initiated. Check logs for details.'
      );
    });

    it('should handle cleanup errors', async () => {
      const workspaceManager = mockCtx.orchestrator.getWorkspaceManager();
      workspaceManager.cleanupWorkspace.mockRejectedValue(new Error('Cleanup failed'));

      await handleWorkspaceCleanup(mockCtx, ['task_123']);

      expect(mockConsoleError).toHaveBeenCalledWith(
        '\n❌ Failed to cleanup workspaces: Cleanup failed\n'
      );
    });
  });

  describe('handleWorkspaceStats', () => {
    it('should handle missing orchestrator', async () => {
      const ctxWithoutOrchestrator = { orchestrator: null };

      await handleWorkspaceStats(ctxWithoutOrchestrator);

      expect(mockConsoleLog).toHaveBeenCalledWith('❌ Orchestrator not available');
    });

    it('should display comprehensive workspace statistics', async () => {
      const workspaceManager = mockCtx.orchestrator.getWorkspaceManager();
      workspaceManager.getWorkspaceStats.mockResolvedValue(mockWorkspaceStats);

      await handleWorkspaceStats(mockCtx);

      expect(workspaceManager.getWorkspaceStats).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('\n📈 Workspace Statistics:\n');
      expect(mockConsoleLog).toHaveBeenCalledWith('  Active Workspaces: 5');
      expect(mockConsoleLog).toHaveBeenCalledWith('  Cleanup Pending: 2');
      expect(mockConsoleLog).toHaveBeenCalledWith('  Total Disk Usage: 1024.00 MB');

      // Check strategy breakdown
      expect(mockConsoleLog).toHaveBeenCalledWith('\n  Workspaces by Strategy:');
      expect(mockConsoleLog).toHaveBeenCalledWith('    isolated: 3');
      expect(mockConsoleLog).toHaveBeenCalledWith('    shared: 2');

      // Check oldest workspace info
      expect(mockConsoleLog).toHaveBeenCalledWith('\n  Oldest Workspace:');
      expect(mockConsoleLog).toHaveBeenCalledWith('    Task ID: task_oldest');

      // Check container health stats
      expect(mockConsoleLog).toHaveBeenCalledWith('\n  Container Health Stats:');
      expect(mockConsoleLog).toHaveBeenCalledWith('    Monitored Containers: 5');
      expect(mockConsoleLog).toHaveBeenCalledWith('    Healthy Containers: 4');
      expect(mockConsoleLog).toHaveBeenCalledWith('    Unhealthy Containers: 1');
      expect(mockConsoleLog).toHaveBeenCalledWith('    Total Restarts: 3');
    });

    it('should handle stats without optional fields', async () => {
      const minimalStats = {
        activeCount: 1,
        cleanupPendingCount: 0,
        totalDiskUsage: 0,
        workspacesByStrategy: { isolated: 1 },
      };

      const workspaceManager = mockCtx.orchestrator.getWorkspaceManager();
      workspaceManager.getWorkspaceStats.mockResolvedValue(minimalStats);

      await handleWorkspaceStats(mockCtx);

      expect(mockConsoleLog).toHaveBeenCalledWith('  Active Workspaces: 1');
      expect(mockConsoleLog).toHaveBeenCalledWith('  Total Disk Usage: 0.00 MB');
      // Should not crash when optional fields are missing
    });

    it('should handle stats errors', async () => {
      const workspaceManager = mockCtx.orchestrator.getWorkspaceManager();
      workspaceManager.getWorkspaceStats.mockRejectedValue(new Error('Stats unavailable'));

      await handleWorkspaceStats(mockCtx);

      expect(mockConsoleError).toHaveBeenCalledWith(
        '\n❌ Failed to get workspace stats: Stats unavailable\n'
      );
    });
  });
});