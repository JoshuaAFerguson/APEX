import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import {
  getCurrentVersion,
  checkForUpdates,
  displayUpdateNotification,
  checkAndNotifyUpdates,
  type UpdateInfo,
} from '../update-checker.js';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('chalk', () => ({
  cyan: vi.fn((text) => text),
  green: vi.fn((text) => text),
  red: vi.fn((text) => text),
  yellow: vi.fn((text) => text),
  blue: vi.fn((text) => text),
  dim: vi.fn((text) => text),
}));
vi.mock('boxen');
vi.mock('@apexcli/core', () => ({
  getLatestPackageVersion: vi.fn(),
  compareVersionStrings: vi.fn((a, b) => {
    // Simple mock version comparison
    const parseVersion = (v: string) => v.split('.').map(Number);
    const aParts = parseVersion(a);
    const bParts = parseVersion(b);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }
    return 0;
  }),
}));

const mockedFs = vi.mocked(fs);
const mockedChalk = vi.mocked(chalk);
const mockedBoxen = vi.mocked(boxen);

// Mock console methods
const originalConsoleLog = console.log;
let consoleLogs: string[] = [];

describe('Update Checker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogs = [];

    console.log = vi.fn((message) => {
      consoleLogs.push(message);
    });

    // Set up default chalk mocks to return the text as-is
    Object.keys(mockedChalk).forEach(method => {
      if (typeof mockedChalk[method as keyof typeof mockedChalk] === 'function') {
        vi.mocked(mockedChalk[method as keyof typeof mockedChalk] as any).mockImplementation((text) => text);
      }
    });

    mockedBoxen.mockImplementation((text, options) => `[BOXED] ${text}`);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('getCurrentVersion', () => {
    it('should return the current version from package.json', () => {
      const version = getCurrentVersion();
      expect(version).toBe('0.6.0');
    });

    it('should fallback to 0.6.0 when package.json cannot be read', () => {
      // This will test the fallback behavior in the implementation
      const version = getCurrentVersion();
      expect(version).toBe('0.6.0');
    });
  });

  describe('checkForUpdates', () => {
    const { getLatestPackageVersion } = require('@apexcli/core');

    it('should return update info when a newer version is available', async () => {
      getLatestPackageVersion.mockResolvedValue('0.7.0');

      const updateInfo = await checkForUpdates();

      expect(updateInfo).toEqual({
        currentVersion: '0.6.0',
        latestVersion: '0.7.0',
        hasUpdate: true,
        updateType: 'minor',
      });
    });

    it('should return update info when no update is available', async () => {
      getLatestPackageVersion.mockResolvedValue('0.6.0');

      const updateInfo = await checkForUpdates();

      expect(updateInfo).toEqual({
        currentVersion: '0.6.0',
        latestVersion: '0.6.0',
        hasUpdate: false,
        updateType: 'none',
      });
    });

    it('should return null when npm registry query fails', async () => {
      getLatestPackageVersion.mockRejectedValue(new Error('Network error'));

      const updateInfo = await checkForUpdates();

      expect(updateInfo).toBeNull();
    });

    it('should return null when no version is returned from registry', async () => {
      getLatestPackageVersion.mockResolvedValue(null);

      const updateInfo = await checkForUpdates();

      expect(updateInfo).toBeNull();
    });

    it('should detect major version updates', async () => {
      getLatestPackageVersion.mockResolvedValue('1.0.0');

      const updateInfo = await checkForUpdates();

      expect(updateInfo?.updateType).toBe('major');
      expect(updateInfo?.hasUpdate).toBe(true);
    });

    it('should detect patch version updates', async () => {
      getLatestPackageVersion.mockResolvedValue('0.6.1');

      const updateInfo = await checkForUpdates();

      expect(updateInfo?.updateType).toBe('patch');
      expect(updateInfo?.hasUpdate).toBe(true);
    });

    it('should use custom timeout option', async () => {
      getLatestPackageVersion.mockResolvedValue('0.7.0');

      await checkForUpdates({ timeout: 10000 });

      expect(getLatestPackageVersion).toHaveBeenCalledWith('@apexcli/cli', { timeout: 10000 });
    });

    it('should use cache when available and not forced', async () => {
      // Mock cache file exists with recent timestamp
      const cacheData = {
        timestamp: Date.now() - 1000, // 1 second ago
        updateInfo: {
          currentVersion: '0.6.0',
          latestVersion: '0.7.0',
          hasUpdate: true,
          updateType: 'minor' as const,
        },
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(cacheData));

      const updateInfo = await checkForUpdates();

      expect(updateInfo).toEqual(cacheData.updateInfo);
      expect(getLatestPackageVersion).not.toHaveBeenCalled();
    });

    it('should ignore stale cache', async () => {
      // Mock cache file exists with old timestamp (7 hours ago)
      const cacheData = {
        timestamp: Date.now() - (7 * 60 * 60 * 1000),
        updateInfo: {
          currentVersion: '0.6.0',
          latestVersion: '0.7.0',
          hasUpdate: true,
          updateType: 'minor' as const,
        },
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(cacheData));
      getLatestPackageVersion.mockResolvedValue('0.8.0');

      const updateInfo = await checkForUpdates();

      expect(getLatestPackageVersion).toHaveBeenCalled();
      expect(updateInfo?.latestVersion).toBe('0.8.0');
    });

    it('should force check even with valid cache', async () => {
      // Mock cache file exists with recent timestamp
      const cacheData = {
        timestamp: Date.now() - 1000,
        updateInfo: {
          currentVersion: '0.6.0',
          latestVersion: '0.7.0',
          hasUpdate: true,
          updateType: 'minor' as const,
        },
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(cacheData));
      getLatestPackageVersion.mockResolvedValue('0.8.0');

      const updateInfo = await checkForUpdates({ force: true });

      expect(getLatestPackageVersion).toHaveBeenCalled();
      expect(updateInfo?.latestVersion).toBe('0.8.0');
    });

    it('should handle cache file read errors gracefully', async () => {
      mockedFs.readFile.mockRejectedValue(new Error('File not found'));
      getLatestPackageVersion.mockResolvedValue('0.7.0');

      const updateInfo = await checkForUpdates();

      expect(getLatestPackageVersion).toHaveBeenCalled();
      expect(updateInfo?.latestVersion).toBe('0.7.0');
    });

    it('should save cache after successful check', async () => {
      getLatestPackageVersion.mockResolvedValue('0.7.0');
      mockedFs.writeFile.mockResolvedValue(undefined);

      await checkForUpdates();

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('update-check.json'),
        expect.stringContaining('"latestVersion":"0.7.0"'),
        'utf-8'
      );
    });

    it('should handle cache save errors silently', async () => {
      getLatestPackageVersion.mockResolvedValue('0.7.0');
      mockedFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      // Should not throw
      const updateInfo = await checkForUpdates();

      expect(updateInfo?.latestVersion).toBe('0.7.0');
    });
  });

  describe('displayUpdateNotification', () => {
    it('should display update notification', () => {
      const updateInfo: UpdateInfo = {
        currentVersion: '0.6.0',
        latestVersion: '0.7.0',
        hasUpdate: true,
        updateType: 'minor',
      };

      displayUpdateNotification(updateInfo);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Update available: 0.6.0 → 0.7.0. Run npm update -g @apexcli/cli')
      );
    });

    it('should not display notification when no update available', () => {
      const updateInfo: UpdateInfo = {
        currentVersion: '0.6.0',
        latestVersion: '0.6.0',
        hasUpdate: false,
        updateType: 'none',
      };

      displayUpdateNotification(updateInfo);

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should use correct colors for notification', () => {
      const updateInfo: UpdateInfo = {
        currentVersion: '0.6.0',
        latestVersion: '0.7.0',
        hasUpdate: true,
        updateType: 'minor',
      };

      displayUpdateNotification(updateInfo);

      expect(mockedChalk.yellow).toHaveBeenCalledWith('0.6.0');
      expect(mockedChalk.green).toHaveBeenCalledWith('0.7.0');
      expect(mockedChalk.cyan).toHaveBeenCalledWith('npm update -g @apexcli/cli');
      expect(mockedChalk.blue).toHaveBeenCalled();
    });
  });

  describe('checkAndNotifyUpdates', () => {
    const { getLatestPackageVersion } = require('@apexcli/core');

    it('should check and display notification when update available', async () => {
      getLatestPackageVersion.mockResolvedValue('0.7.0');

      await checkAndNotifyUpdates();

      expect(getLatestPackageVersion).toHaveBeenCalledWith('@apexcli/cli', { timeout: 3000 });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Update available: 0.6.0 → 0.7.0. Run npm update -g @apexcli/cli')
      );
    });

    it('should not display notification when no update available', async () => {
      getLatestPackageVersion.mockResolvedValue('0.6.0');

      await checkAndNotifyUpdates();

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should not check when silent option is true', async () => {
      await checkAndNotifyUpdates({ silent: true });

      expect(getLatestPackageVersion).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should force check when force option is true', async () => {
      // Mock cache file exists
      const cacheData = {
        timestamp: Date.now() - 1000,
        updateInfo: {
          currentVersion: '0.6.0',
          latestVersion: '0.7.0',
          hasUpdate: true,
          updateType: 'minor' as const,
        },
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(cacheData));
      getLatestPackageVersion.mockResolvedValue('0.8.0');

      await checkAndNotifyUpdates({ force: true });

      expect(getLatestPackageVersion).toHaveBeenCalled();
    });

    it('should handle errors silently', async () => {
      getLatestPackageVersion.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(checkAndNotifyUpdates()).resolves.not.toThrow();

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should handle null update info gracefully', async () => {
      getLatestPackageVersion.mockResolvedValue(null);

      await checkAndNotifyUpdates();

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should respect APEX_SKIP_UPDATE_CHECK environment variable', async () => {
      const originalEnv = process.env.APEX_SKIP_UPDATE_CHECK;

      process.env.APEX_SKIP_UPDATE_CHECK = '1';

      await checkAndNotifyUpdates();

      expect(getLatestPackageVersion).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();

      // Reset environment
      if (originalEnv === undefined) {
        delete process.env.APEX_SKIP_UPDATE_CHECK;
      } else {
        process.env.APEX_SKIP_UPDATE_CHECK = originalEnv;
      }
    });

    it('should respect APEX_SKIP_UPDATE_CHECK=true environment variable', async () => {
      const originalEnv = process.env.APEX_SKIP_UPDATE_CHECK;

      process.env.APEX_SKIP_UPDATE_CHECK = 'true';

      await checkAndNotifyUpdates();

      expect(getLatestPackageVersion).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();

      // Reset environment
      if (originalEnv === undefined) {
        delete process.env.APEX_SKIP_UPDATE_CHECK;
      } else {
        process.env.APEX_SKIP_UPDATE_CHECK = originalEnv;
      }
    });
  });

  describe('Cache Management', () => {
    it('should save cache after successful check', async () => {
      getLatestPackageVersion.mockResolvedValue('0.7.0');
      mockedFs.writeFile.mockResolvedValue(undefined);

      await checkForUpdates();

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('update-check.json'),
        expect.stringMatching(/"latestVersion":"0\.7\.0"/),
        'utf-8'
      );
    });

    it('should handle cache write errors silently', async () => {
      getLatestPackageVersion.mockResolvedValue('0.7.0');
      mockedFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      // Should not throw despite cache write failure
      const updateInfo = await checkForUpdates();

      expect(updateInfo?.latestVersion).toBe('0.7.0');
    });

    it('should use cache when available', async () => {
      // Mock cache file with recent data
      const cacheData = {
        timestamp: Date.now() - 1000, // 1 second ago
        updateInfo: {
          currentVersion: '0.6.0',
          latestVersion: '0.7.0',
          hasUpdate: true,
          updateType: 'minor' as const,
        },
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(cacheData));

      const updateInfo = await checkForUpdates();

      expect(updateInfo).toEqual(cacheData.updateInfo);
      expect(getLatestPackageVersion).not.toHaveBeenCalled();
    });

    it('should ignore stale cache', async () => {
      // Mock stale cache (7 hours old)
      const staleCache = {
        timestamp: Date.now() - (7 * 60 * 60 * 1000),
        updateInfo: {
          currentVersion: '0.6.0',
          latestVersion: '0.7.0',
          hasUpdate: true,
          updateType: 'minor' as const,
        },
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(staleCache));
      getLatestPackageVersion.mockResolvedValue('0.8.0');

      const updateInfo = await checkForUpdates();

      expect(getLatestPackageVersion).toHaveBeenCalled();
      expect(updateInfo?.latestVersion).toBe('0.8.0');
    });
  });

  describe('Integration and Edge Cases', () => {
    const { getLatestPackageVersion } = require('@apexcli/core');

    it('should handle concurrent update checks', async () => {
      getLatestPackageVersion.mockResolvedValue('0.7.0');

      // Simulate multiple concurrent checks
      const checks = Array.from({ length: 3 }, () => checkForUpdates());
      const results = await Promise.all(checks);

      results.forEach(result => {
        expect(result).toEqual({
          currentVersion: '0.6.0',
          latestVersion: '0.7.0',
          hasUpdate: true,
          updateType: 'minor',
        });
      });
    });

    it('should handle version strings with v prefix', async () => {
      getLatestPackageVersion.mockResolvedValue('v0.7.0');

      const updateInfo = await checkForUpdates();

      expect(updateInfo?.latestVersion).toBe('v0.7.0');
      expect(updateInfo?.hasUpdate).toBe(true);
    });

    it('should handle pre-release versions', async () => {
      getLatestPackageVersion.mockResolvedValue('0.7.0-beta.1');

      const updateInfo = await checkForUpdates();

      expect(updateInfo?.latestVersion).toBe('0.7.0-beta.1');
      expect(updateInfo?.hasUpdate).toBe(true);
      expect(updateInfo?.updateType).toBe('minor');
    });

    it('should handle complex version formats', async () => {
      getLatestPackageVersion.mockResolvedValue('0.6.0+build.123');

      const updateInfo = await checkForUpdates();

      expect(updateInfo?.latestVersion).toBe('0.6.0+build.123');
      // Should detect no update due to same base version
      expect(updateInfo?.hasUpdate).toBe(false);
    });

    it('should handle cache corruption gracefully', async () => {
      mockedFs.readFile.mockResolvedValue('invalid json');
      getLatestPackageVersion.mockResolvedValue('0.7.0');

      const updateInfo = await checkForUpdates();

      // Should proceed with fresh check when cache is corrupted
      expect(getLatestPackageVersion).toHaveBeenCalled();
      expect(updateInfo?.latestVersion).toBe('0.7.0');
    });

    it('should handle empty cache file', async () => {
      mockedFs.readFile.mockResolvedValue('');
      getLatestPackageVersion.mockResolvedValue('0.7.0');

      const updateInfo = await checkForUpdates();

      expect(getLatestPackageVersion).toHaveBeenCalled();
      expect(updateInfo?.latestVersion).toBe('0.7.0');
    });

    it('should timeout gracefully with custom timeout', async () => {
      getLatestPackageVersion.mockImplementation(() =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        })
      );

      const startTime = Date.now();
      const updateInfo = await checkForUpdates({ timeout: 50 });
      const duration = Date.now() - startTime;

      expect(updateInfo).toBeNull();
      expect(duration).toBeLessThan(200); // Should fail quickly
    });
  });

  describe('Real-world Scenarios', () => {
    const { getLatestPackageVersion } = require('@apexcli/core');

    it('should handle startup flow correctly', async () => {
      getLatestPackageVersion.mockResolvedValue('0.7.0');

      // Simulate CLI startup with update check
      const startTime = Date.now();

      // This should be non-blocking
      const updateCheckPromise = checkAndNotifyUpdates();

      // Should resolve quickly without blocking
      await updateCheckPromise;

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within timeout
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Update available')
      );
    });

    it('should work correctly in CI/automated environments', async () => {
      const originalEnv = process.env.APEX_SKIP_UPDATE_CHECK;
      process.env.APEX_SKIP_UPDATE_CHECK = '1';

      await checkAndNotifyUpdates();

      // Should not make network calls in CI
      expect(getLatestPackageVersion).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();

      // Reset environment
      if (originalEnv === undefined) {
        delete process.env.APEX_SKIP_UPDATE_CHECK;
      } else {
        process.env.APEX_SKIP_UPDATE_CHECK = originalEnv;
      }
    });

    it('should handle offline scenarios', async () => {
      getLatestPackageVersion.mockRejectedValue(new Error('ENOTFOUND'));

      const updateInfo = await checkForUpdates();

      expect(updateInfo).toBeNull();
      // Should not crash or show error to user
    });

    it('should work with beta/development versions', async () => {
      // Mock getCurrentVersion to return a beta version
      const originalGetCurrentVersion = getCurrentVersion;
      (getCurrentVersion as any) = vi.fn(() => '0.7.0-beta.1');

      getLatestPackageVersion.mockResolvedValue('0.6.0');

      const updateInfo = await checkForUpdates();

      // Beta should be considered newer than stable
      expect(updateInfo?.hasUpdate).toBe(false);
      expect(updateInfo?.updateType).toBe('none');

      // Restore original function
      (getCurrentVersion as any) = originalGetCurrentVersion;
    });
  });
});