import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleDaemonStatus } from '../handlers/daemon-handlers';
import { DaemonManager, ExtendedDaemonStatus, CapacityStatusInfo } from '@apex/orchestrator';
import chalk from 'chalk';

// Mock dependencies
vi.mock('@apex/orchestrator');
vi.mock('chalk', () => ({
  default: {
    red: (str: string) => `[RED]${str}[/RED]`,
    green: (str: string) => `[GREEN]${str}[/GREEN]`,
    yellow: (str: string) => `[YELLOW]${str}[/YELLOW]`,
    cyan: (str: string) => `[CYAN]${str}[/CYAN]`,
    gray: (str: string) => `[GRAY]${str}[/GRAY]`,
    blue: (str: string) => `[BLUE]${str}[/BLUE]`,
  },
}));

const mockDaemonManager = vi.mocked(DaemonManager);

describe('Daemon Status CLI Integration - Capacity Information', () => {
  let mockManager: any;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let capturedOutput: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOutput = [];

    // Mock console.log to capture output
    consoleSpy = vi.spyOn(console, 'log').mockImplementation((message: string) => {
      capturedOutput.push(message);
    });

    // Create mock manager instance
    mockManager = {
      getExtendedStatus: vi.fn(),
    };

    mockDaemonManager.mockImplementation(() => mockManager);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  const ctx = { cwd: '/test/project', initialized: true };

  describe('Complete daemon status display flow', () => {
    it('should display comprehensive daemon status during peak hours', async () => {
      const capacity: CapacityStatusInfo = {
        mode: 'day',
        capacityThreshold: 0.75,
        currentUsagePercent: 0.65,
        isAutoPaused: false,
        nextModeSwitch: new Date('2023-01-01T22:00:00Z'),
        timeBasedUsageEnabled: true,
      };

      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 54321,
        startedAt: new Date('2023-01-01T09:30:00Z'),
        uptime: 7200000, // 2 hours
        capacity,
      };

      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus(ctx);

      // Verify complete output structure
      expect(capturedOutput).toContain('[CYAN]\\nDaemon Status[/CYAN]');
      expect(capturedOutput).toContain('[GRAY]────────────────────────────────────[/GRAY]');
      expect(capturedOutput).toContain('  State:           [GREEN]running[/GREEN]');
      expect(capturedOutput).toContain('  PID:             54321');
      expect(capturedOutput).toContain('  Started:         1/1/2023, 9:30:00 AM');
      expect(capturedOutput).toContain('  Uptime:          2h 0m');
      expect(capturedOutput).toContain('  Log file:        [GRAY].apex/daemon.log[/GRAY]');

      // Verify capacity section
      expect(capturedOutput).toContain('[CYAN]Capacity Status[/CYAN]');
      expect(capturedOutput).toContain('  Mode:            [YELLOW]day[/YELLOW] [GRAY](9:00 AM - 6:00 PM)[/GRAY]');
      expect(capturedOutput).toContain('  Threshold:       75%');
      expect(capturedOutput).toContain('  Current Usage:   [GREEN]65.0%[/GREEN]');
      expect(capturedOutput).toContain('  Auto-Pause:      [GREEN]No[/GREEN]');
      expect(capturedOutput).toContain('  Next Mode:       night at 10:00:00 PM');
    });

    it('should display daemon status during off-peak hours with auto-pause', async () => {
      const capacity: CapacityStatusInfo = {
        mode: 'night',
        capacityThreshold: 0.90,
        currentUsagePercent: 0.92,
        isAutoPaused: true,
        pauseReason: 'Night mode capacity exceeded',
        nextModeSwitch: new Date('2023-01-02T09:00:00Z'),
        timeBasedUsageEnabled: true,
      };

      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 54321,
        startedAt: new Date('2023-01-01T22:30:00Z'),
        uptime: 18000000, // 5 hours
        capacity,
      };

      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus(ctx);

      // Verify night mode display
      expect(capturedOutput).toContain('  Mode:            [BLUE]night[/BLUE] [GRAY](10:00 PM - 6:00 AM)[/GRAY]');
      expect(capturedOutput).toContain('  Threshold:       90%');
      expect(capturedOutput).toContain('  Current Usage:   [RED]92.0%[/RED]'); // Should be red for over threshold
      expect(capturedOutput).toContain('  Auto-Pause:      [RED]Yes[/RED] (Night mode capacity exceeded)');
      expect(capturedOutput).toContain('  Next Mode:       day at 9:00:00 AM');

      // Verify warning message
      expect(capturedOutput).toContain('  [YELLOW]⚠[/YELLOW] Tasks paused. Will resume when capacity available or mode changes.');
    });

    it('should display daemon status during off-hours', async () => {
      const capacity: CapacityStatusInfo = {
        mode: 'off-hours',
        capacityThreshold: 0.95,
        currentUsagePercent: 0.15,
        isAutoPaused: false,
        nextModeSwitch: new Date('2023-01-02T09:00:00Z'),
        timeBasedUsageEnabled: true,
      };

      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 54321,
        startedAt: new Date('2023-01-01T18:00:00Z'),
        uptime: 21600000, // 6 hours
        capacity,
      };

      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus(ctx);

      expect(capturedOutput).toContain('  Mode:            [GRAY]off-hours[/GRAY]');
      expect(capturedOutput).toContain('  Threshold:       95%');
      expect(capturedOutput).toContain('  Current Usage:   [GREEN]15.0%[/GREEN]');
      expect(capturedOutput).toContain('  Next Mode:       active hours at 9:00:00 AM');
    });

    it('should handle daemon with disabled time-based usage', async () => {
      const capacity: CapacityStatusInfo = {
        mode: 'day',
        capacityThreshold: 0.80,
        currentUsagePercent: 0.45,
        isAutoPaused: false,
        nextModeSwitch: new Date('2023-01-01T22:00:00Z'),
        timeBasedUsageEnabled: false,
      };

      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 54321,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        uptime: 3600000, // 1 hour
        capacity,
      };

      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus(ctx);

      expect(capturedOutput).toContain('[CYAN]Capacity Status[/CYAN]');
      expect(capturedOutput).toContain('  Time-based usage is disabled.');
      expect(capturedOutput).toContain('  Configure in .apex/config.yaml under daemon.timeBasedUsage');
    });

    it('should handle daemon starting up without capacity info', async () => {
      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 54321,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        uptime: 3600000, // 1 hour
        // No capacity information available
      };

      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus(ctx);

      expect(capturedOutput).toContain('[CYAN]Capacity Status[/CYAN]');
      expect(capturedOutput).toContain('  [YELLOW]⚠[/YELLOW] State file not found. Daemon may be starting up.');
      expect(capturedOutput).toContain('    Capacity information will be available once daemon is fully initialized.');
    });

    it('should handle stopped daemon', async () => {
      const extendedStatus: ExtendedDaemonStatus = {
        running: false,
      };

      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus(ctx);

      expect(capturedOutput).toContain('  State:           [GRAY]stopped[/GRAY]');
      expect(capturedOutput).toContain("Use '/daemon start' to start the daemon.");

      // Should not display capacity information for stopped daemon
      expect(capturedOutput.join('\\n')).not.toMatch(/Capacity Status/);
    });
  });

  describe('Real-world scenario tests', () => {
    it('should display status during heavy usage approaching threshold', async () => {
      const capacity: CapacityStatusInfo = {
        mode: 'day',
        capacityThreshold: 0.85,
        currentUsagePercent: 0.83, // Close to but under threshold
        isAutoPaused: false,
        nextModeSwitch: new Date('2023-01-01T22:00:00Z'),
        timeBasedUsageEnabled: true,
      };

      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 54321,
        startedAt: new Date('2023-01-01T09:00:00Z'),
        uptime: 28800000, // 8 hours
        capacity,
      };

      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus(ctx);

      // Usage should be yellow (80%+ but under threshold)
      expect(capturedOutput).toContain('  Current Usage:   [YELLOW]83.0%[/YELLOW]');
      expect(capturedOutput).toContain('  Auto-Pause:      [GREEN]No[/GREEN]');
    });

    it('should display status when exactly at threshold', async () => {
      const capacity: CapacityStatusInfo = {
        mode: 'day',
        capacityThreshold: 0.80,
        currentUsagePercent: 0.80, // Exactly at threshold
        isAutoPaused: true,
        pauseReason: 'Threshold reached',
        nextModeSwitch: new Date('2023-01-01T22:00:00Z'),
        timeBasedUsageEnabled: true,
      };

      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 54321,
        startedAt: new Date('2023-01-01T09:00:00Z'),
        uptime: 28800000, // 8 hours
        capacity,
      };

      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus(ctx);

      // Usage should be red (at threshold)
      expect(capturedOutput).toContain('  Current Usage:   [RED]80.0%[/RED]');
      expect(capturedOutput).toContain('  Auto-Pause:      [RED]Yes[/RED] (Threshold reached)');
    });

    it('should display proper output format for reporting', async () => {
      const capacity: CapacityStatusInfo = {
        mode: 'day',
        capacityThreshold: 0.75,
        currentUsagePercent: 0.45,
        isAutoPaused: false,
        nextModeSwitch: new Date('2023-01-01T22:00:00Z'),
        timeBasedUsageEnabled: true,
      };

      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 54321,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        uptime: 3600000, // 1 hour
        capacity,
      };

      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus(ctx);

      const fullOutput = capturedOutput.join('\\n');

      // Verify the output contains all acceptance criteria fields
      expect(fullOutput).toMatch(/Mode:.*day/);
      expect(fullOutput).toMatch(/Threshold:.*75%/);
      expect(fullOutput).toMatch(/Current Usage:.*45\.0%/);
      expect(fullOutput).toMatch(/Auto-Pause:.*No/);
      expect(fullOutput).toMatch(/Next Mode:.*night at/);
    });
  });

  describe('Error scenarios', () => {
    it('should handle DaemonManager errors gracefully', async () => {
      mockManager.getExtendedStatus.mockRejectedValue(new Error('Failed to read status'));

      await expect(handleDaemonStatus(ctx)).rejects.toThrow('Failed to read status');

      // Verify DaemonManager was called with correct parameters
      expect(mockDaemonManager).toHaveBeenCalledWith({
        projectPath: '/test/project',
      });
    });

    it('should handle malformed capacity data', async () => {
      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 54321,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        uptime: 3600000,
        capacity: {
          mode: 'day',
          capacityThreshold: NaN, // Invalid data
          currentUsagePercent: 0.45,
          isAutoPaused: false,
          nextModeSwitch: new Date('2023-01-01T22:00:00Z'),
          timeBasedUsageEnabled: true,
        } as CapacityStatusInfo,
      };

      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus(ctx);

      // Should handle NaN gracefully
      expect(capturedOutput).toContain('  Threshold:       NaN%');
    });
  });
});