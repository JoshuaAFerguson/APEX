/**
 * @fileoverview Tests specifically for acceptance criteria verification
 *
 * Acceptance Criteria:
 * - On CLI startup, asynchronously checks for updates (non-blocking)
 * - If newer version available, displays non-intrusive colored notification after banner
 * - Format: 'Update available: 0.6.0 → 0.7.0. Run npm update -g @apexcli/cli'
 * - Respects APEX_SKIP_UPDATE_CHECK env var to disable
 * - Cache stored in ~/.apex/update-check.json
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import {
  checkAndNotifyUpdates,
  checkForUpdates,
  displayUpdateNotification,
  type UpdateInfo,
} from '../update-checker.js';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('chalk', () => ({
  default: {
    cyan: vi.fn((text) => `[CYAN]${text}[/CYAN]`),
    green: vi.fn((text) => `[GREEN]${text}[/GREEN]`),
    yellow: vi.fn((text) => `[YELLOW]${text}[/YELLOW]`),
    blue: vi.fn((text) => `[BLUE]${text}[/BLUE]`),
  },
}));

// Create mock functions
const mockGetLatestPackageVersion = vi.fn();
const mockCompareVersionStrings = vi.fn((a: string, b: string) => {
  const parseVersion = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const aParts = parseVersion(a);
  const bParts = parseVersion(b);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;
    if (aPart > bPart) return 1;
    if (aPart < bPart) return -1;
  }
  return 0;
});

vi.mock('@apexcli/core', async () => {
  return {
    getLatestPackageVersion: mockGetLatestPackageVersion,
    compareVersionStrings: mockCompareVersionStrings,
  };
});

const mockedFs = vi.mocked(fs);

describe('Acceptance Criteria Verification', () => {
  let originalConsoleLog: typeof console.log;
  let consoleLogs: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogs = [];
    originalConsoleLog = console.log;
    console.log = vi.fn((message) => {
      consoleLogs.push(message);
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('AC1: Asynchronous, non-blocking update checks on CLI startup', () => {
    it('should perform update check asynchronously without blocking', async () => {
      mockGetLatestPackageVersion.mockResolvedValue('0.7.0');

      const startTime = Date.now();

      // Start the update check but don't await it (simulating CLI startup)
      const updatePromise = checkAndNotifyUpdates();

      // CLI should continue executing immediately
      const midTime = Date.now();
      expect(midTime - startTime).toBeLessThan(50); // Should start immediately

      // Now wait for the update check to complete
      await updatePromise;

      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThan(0); // Should take some time to complete

      // Should have displayed notification
      expect(consoleLogs).toHaveLength(1);
      expect(consoleLogs[0]).toContain('Update available');
    });

    it('should not block CLI startup even when network is slow', async () => {
      // Mock slow network response
      mockGetLatestPackageVersion.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve('0.7.0'), 4000))
      );

      const startTime = Date.now();

      // Start update check
      const updatePromise = checkAndNotifyUpdates();

      // Should timeout after 3 seconds and not block CLI
      await updatePromise;

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3500); // Should timeout before 4 seconds

      // No notification due to timeout
      expect(consoleLogs).toHaveLength(0);
    });
  });

  describe('AC2: Non-intrusive colored notification display', () => {
    it('should display colored notification with correct format after banner', () => {
      const updateInfo: UpdateInfo = {
        currentVersion: '0.6.0',
        latestVersion: '0.7.0',
        hasUpdate: true,
        updateType: 'minor',
      };

      // Simulate CLI banner
      console.log('APEX CLI v0.6.0');

      // Display update notification
      displayUpdateNotification(updateInfo);

      expect(consoleLogs).toHaveLength(2);
      expect(consoleLogs[0]).toBe('APEX CLI v0.6.0'); // Banner first
      expect(consoleLogs[1]).toContain('[BLUE]'); // Colored output
      expect(consoleLogs[1]).toContain('[YELLOW]0.6.0[/YELLOW]'); // Current version in yellow
      expect(consoleLogs[1]).toContain('[GREEN]0.7.0[/GREEN]'); // Latest version in green
    });

    it('should not display notification when no update available', () => {
      const updateInfo: UpdateInfo = {
        currentVersion: '0.6.0',
        latestVersion: '0.6.0',
        hasUpdate: false,
        updateType: 'none',
      };

      console.log('APEX CLI v0.6.0');
      displayUpdateNotification(updateInfo);

      expect(consoleLogs).toHaveLength(1); // Only banner, no notification
      expect(consoleLogs[0]).toBe('APEX CLI v0.6.0');
    });
  });

  describe('AC3: Exact message format requirement', () => {
    it('should display exact message format as specified', () => {
      const updateInfo: UpdateInfo = {
        currentVersion: '0.6.0',
        latestVersion: '0.7.0',
        hasUpdate: true,
        updateType: 'minor',
      };

      displayUpdateNotification(updateInfo);

      expect(consoleLogs).toHaveLength(1);

      // Extract the raw message without color codes for format verification
      const message = consoleLogs[0];
      expect(message).toContain('Update available: ');
      expect(message).toContain('0.6.0 → 0.7.0');
      expect(message).toContain('Run [CYAN]npm update -g @apexcli/cli[/CYAN]');
    });

    it('should use correct arrow character (→) in version display', () => {
      const updateInfo: UpdateInfo = {
        currentVersion: '0.5.0',
        latestVersion: '1.0.0',
        hasUpdate: true,
        updateType: 'major',
      };

      displayUpdateNotification(updateInfo);

      expect(consoleLogs[0]).toContain('0.5.0 → 1.0.0');
    });

    it('should use correct package name in update command', () => {
      const updateInfo: UpdateInfo = {
        currentVersion: '0.6.0',
        latestVersion: '0.7.0',
        hasUpdate: true,
        updateType: 'minor',
      };

      displayUpdateNotification(updateInfo);

      expect(consoleLogs[0]).toContain('npm update -g @apexcli/cli');
    });
  });

  describe('AC4: APEX_SKIP_UPDATE_CHECK environment variable', () => {
    it('should respect APEX_SKIP_UPDATE_CHECK=1', async () => {
      const originalEnv = process.env.APEX_SKIP_UPDATE_CHECK;
      process.env.APEX_SKIP_UPDATE_CHECK = '1';

      mockGetLatestPackageVersion.mockResolvedValue('0.7.0');

      await checkAndNotifyUpdates();

      expect(mockGetLatestPackageVersion).not.toHaveBeenCalled();
      expect(consoleLogs).toHaveLength(0);

      // Restore environment
      if (originalEnv === undefined) {
        delete process.env.APEX_SKIP_UPDATE_CHECK;
      } else {
        process.env.APEX_SKIP_UPDATE_CHECK = originalEnv;
      }
    });

    it('should respect APEX_SKIP_UPDATE_CHECK=true', async () => {
      const originalEnv = process.env.APEX_SKIP_UPDATE_CHECK;
      process.env.APEX_SKIP_UPDATE_CHECK = 'true';

      mockGetLatestPackageVersion.mockResolvedValue('0.7.0');

      await checkAndNotifyUpdates();

      expect(mockGetLatestPackageVersion).not.toHaveBeenCalled();
      expect(consoleLogs).toHaveLength(0);

      // Restore environment
      if (originalEnv === undefined) {
        delete process.env.APEX_SKIP_UPDATE_CHECK;
      } else {
        process.env.APEX_SKIP_UPDATE_CHECK = originalEnv;
      }
    });

    it('should perform normal checks when environment variable is not set', async () => {
      const originalEnv = process.env.APEX_SKIP_UPDATE_CHECK;
      delete process.env.APEX_SKIP_UPDATE_CHECK;

      mockGetLatestPackageVersion.mockResolvedValue('0.7.0');

      await checkAndNotifyUpdates();

      expect(mockGetLatestPackageVersion).toHaveBeenCalled();
      expect(consoleLogs).toHaveLength(1);
      expect(consoleLogs[0]).toContain('Update available');

      // Restore environment
      if (originalEnv !== undefined) {
        process.env.APEX_SKIP_UPDATE_CHECK = originalEnv;
      }
    });

    it('should perform normal checks when environment variable is empty string', async () => {
      const originalEnv = process.env.APEX_SKIP_UPDATE_CHECK;
      process.env.APEX_SKIP_UPDATE_CHECK = '';

      mockGetLatestPackageVersion.mockResolvedValue('0.7.0');

      await checkAndNotifyUpdates();

      expect(mockGetLatestPackageVersion).toHaveBeenCalled();
      expect(consoleLogs).toHaveLength(1);

      // Restore environment
      if (originalEnv === undefined) {
        delete process.env.APEX_SKIP_UPDATE_CHECK;
      } else {
        process.env.APEX_SKIP_UPDATE_CHECK = originalEnv;
      }
    });
  });

  describe('AC5: Cache storage in ~/.apex/update-check.json', () => {
    it('should save cache to correct location after update check', async () => {
      mockGetLatestPackageVersion.mockResolvedValue('0.7.0');
      mockedFs.writeFile.mockResolvedValue(undefined);

      await checkForUpdates();

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/\.apex[/\\]update-check\.json$/),
        expect.stringContaining('"latestVersion":"0.7.0"'),
        'utf-8'
      );
    });

    it('should use cached data when available', async () => {
      // Mock cache file with recent data
      const cacheData = {
        timestamp: Date.now() - 1000, // 1 second ago (fresh)
        updateInfo: {
          currentVersion: '0.6.0',
          latestVersion: '0.7.0',
          hasUpdate: true,
          updateType: 'minor',
        },
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(cacheData));

      const result = await checkForUpdates();

      expect(result).toEqual(cacheData.updateInfo);
      expect(mockGetLatestPackageVersion).not.toHaveBeenCalled(); // Should use cache
    });

    it('should refresh stale cache (older than 6 hours)', async () => {
      // Mock stale cache
      const staleCache = {
        timestamp: Date.now() - (7 * 60 * 60 * 1000), // 7 hours ago
        updateInfo: {
          currentVersion: '0.6.0',
          latestVersion: '0.6.0',
          hasUpdate: false,
          updateType: 'none',
        },
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(staleCache));
      mockGetLatestPackageVersion.mockResolvedValue('0.7.0');

      const result = await checkForUpdates();

      expect(mockGetLatestPackageVersion).toHaveBeenCalled(); // Should refresh stale cache
      expect(result?.latestVersion).toBe('0.7.0');
    });

    it('should handle cache file not found gracefully', async () => {
      mockedFs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));
      mockGetLatestPackageVersion.mockResolvedValue('0.7.0');

      const result = await checkForUpdates();

      expect(mockGetLatestPackageVersion).toHaveBeenCalled(); // Should perform fresh check
      expect(result?.latestVersion).toBe('0.7.0');
    });

    it('should handle cache write failures silently', async () => {
      mockGetLatestPackageVersion.mockResolvedValue('0.7.0');
      mockedFs.writeFile.mockRejectedValue(new Error('EACCES: permission denied'));

      // Should not throw despite cache write failure
      const result = await checkForUpdates();

      expect(result?.latestVersion).toBe('0.7.0'); // Main functionality should work
    });
  });

  describe('Complete Integration: All Acceptance Criteria Together', () => {
    it('should fulfill all acceptance criteria in a complete CLI startup scenario', async () => {
      // Setup: Mock network call
      mockGetLatestPackageVersion.mockResolvedValue('0.7.0');
      mockedFs.readFile.mockRejectedValue(new Error('ENOENT')); // No cache
      mockedFs.writeFile.mockResolvedValue(undefined);

      // Step 1: CLI startup banner
      console.log('APEX CLI v0.6.0');

      // Step 2: Asynchronous update check (AC1)
      const startTime = Date.now();
      const updatePromise = checkAndNotifyUpdates(); // Non-blocking

      // CLI can continue immediately
      const midTime = Date.now();
      expect(midTime - startTime).toBeLessThan(50);

      // Step 3: Wait for update check to complete
      await updatePromise;

      // Verify all acceptance criteria:
      // AC1: Non-blocking ✅
      expect(Date.now() - startTime).toBeGreaterThan(0);

      // AC2: Non-intrusive colored notification after banner ✅
      expect(consoleLogs).toHaveLength(2);
      expect(consoleLogs[0]).toBe('APEX CLI v0.6.0'); // Banner first
      expect(consoleLogs[1]).toContain('[BLUE]'); // Colored

      // AC3: Exact message format ✅
      expect(consoleLogs[1]).toContain('Update available: [YELLOW]0.6.0[/YELLOW] → [GREEN]0.7.0[/GREEN]');
      expect(consoleLogs[1]).toContain('[CYAN]npm update -g @apexcli/cli[/CYAN]');

      // AC4: Environment variable respect (tested separately above) ✅

      // AC5: Cache storage ✅
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/\.apex[/\\]update-check\.json$/),
        expect.stringContaining('"latestVersion":"0.7.0"'),
        'utf-8'
      );
    });
  });
});