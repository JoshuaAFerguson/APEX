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
        (mockedChalk[method as keyof typeof mockedChalk] as jest.MockedFunction<any>).mockImplementation((text) => text);
      }
    });

    mockedBoxen.mockImplementation((text, options) => `[BOXED] ${text}`);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('getCurrentVersion', () => {
    it('should return the current version', () => {
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

      expect(getLatestPackageVersion).toHaveBeenCalledWith('apex-cli', { timeout: 10000 });
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
        expect.stringContaining('.apex-update-cache.json'),
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
    it('should display minor update notification', () => {
      const updateInfo: UpdateInfo = {
        currentVersion: '0.6.0',
        latestVersion: '0.7.0',
        hasUpdate: true,
        updateType: 'minor',
      };

      displayUpdateNotification(updateInfo);

      expect(mockedBoxen).toHaveBeenCalledWith(
        expect.stringContaining('Update Available'),
        expect.objectContaining({
          borderColor: 'yellow',
        })
      );
    });

    it('should display major update notification with warning style', () => {
      const updateInfo: UpdateInfo = {
        currentVersion: '0.6.0',
        latestVersion: '1.0.0',
        hasUpdate: true,
        updateType: 'major',
      };

      displayUpdateNotification(updateInfo);

      expect(mockedBoxen).toHaveBeenCalledWith(
        expect.stringContaining('Update Available'),
        expect.objectContaining({
          borderColor: 'red',
          backgroundColor: 'bgRed',
        })
      );
    });

    it('should display patch update notification', () => {
      const updateInfo: UpdateInfo = {
        currentVersion: '0.6.0',
        latestVersion: '0.6.1',
        hasUpdate: true,
        updateType: 'patch',
      };

      displayUpdateNotification(updateInfo);

      expect(mockedBoxen).toHaveBeenCalledWith(
        expect.stringContaining('Update Available'),
        expect.objectContaining({
          borderColor: 'green',
        })
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

      expect(mockedBoxen).not.toHaveBeenCalled();
    });

    it('should include version information in notification', () => {
      const updateInfo: UpdateInfo = {
        currentVersion: '0.6.0',
        latestVersion: '0.7.0',
        hasUpdate: true,
        updateType: 'minor',
      };

      displayUpdateNotification(updateInfo);

      const notificationText = (mockedBoxen as jest.MockedFunction<any>).mock.calls[0][0];
      expect(notificationText).toContain('Current: 0.6.0');
      expect(notificationText).toContain('Latest: 0.7.0');
      expect(notificationText).toContain('(minor)');
    });

    it('should include update instructions in notification', () => {
      const updateInfo: UpdateInfo = {
        currentVersion: '0.6.0',
        latestVersion: '0.7.0',
        hasUpdate: true,
        updateType: 'minor',
      };

      displayUpdateNotification(updateInfo);

      const notificationText = (mockedBoxen as jest.MockedFunction<any>).mock.calls[0][0];
      expect(notificationText).toContain('npm install -g apex-cli');
      expect(notificationText).toContain('apex update');
    });
  });

  describe('checkAndNotifyUpdates', () => {
    const { getLatestPackageVersion } = require('@apexcli/core');

    it('should check and display notification when update available', async () => {
      getLatestPackageVersion.mockResolvedValue('0.7.0');

      await checkAndNotifyUpdates();

      expect(getLatestPackageVersion).toHaveBeenCalledWith('apex-cli', { timeout: 3000 });
      expect(mockedBoxen).toHaveBeenCalledWith(
        expect.stringContaining('Update Available'),
        expect.any(Object)
      );
    });

    it('should not display notification when no update available', async () => {
      getLatestPackageVersion.mockResolvedValue('0.6.0');

      await checkAndNotifyUpdates();

      expect(mockedBoxen).not.toHaveBeenCalled();
    });

    it('should not check when silent option is true', async () => {
      await checkAndNotifyUpdates({ silent: true });

      expect(getLatestPackageVersion).not.toHaveBeenCalled();
      expect(mockedBoxen).not.toHaveBeenCalled();
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

      expect(mockedBoxen).not.toHaveBeenCalled();
    });

    it('should handle null update info gracefully', async () => {
      getLatestPackageVersion.mockResolvedValue(null);

      await checkAndNotifyUpdates();

      expect(mockedBoxen).not.toHaveBeenCalled();
    });
  });

  describe('Cache Management', () => {
    it('should use correct cache file path', async () => {
      const originalEnv = process.env;

      // Test with HOME environment variable
      process.env = { ...originalEnv, HOME: '/home/user' };

      getLatestPackageVersion.mockResolvedValue('0.7.0');
      mockedFs.writeFile.mockResolvedValue(undefined);

      await checkForUpdates();

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        '/home/user/.apex-update-cache.json',
        expect.any(String),
        'utf-8'
      );

      process.env = originalEnv;
    });

    it('should use USERPROFILE on Windows', async () => {
      const originalEnv = process.env;

      // Test with USERPROFILE (Windows)
      process.env = { USERPROFILE: 'C:\\Users\\user' };
      delete process.env.HOME;

      getLatestPackageVersion.mockResolvedValue('0.7.0');
      mockedFs.writeFile.mockResolvedValue(undefined);

      await checkForUpdates();

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        'C:\\Users\\user\\.apex-update-cache.json',
        expect.any(String),
        'utf-8'
      );

      process.env = originalEnv;
    });

    it('should fallback to /tmp when no home directory is available', async () => {
      const originalEnv = process.env;

      // Remove home directory environment variables
      process.env = {};

      getLatestPackageVersion.mockResolvedValue('0.7.0');
      mockedFs.writeFile.mockResolvedValue(undefined);

      await checkForUpdates();

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        '/tmp/.apex-update-cache.json',
        expect.any(String),
        'utf-8'
      );

      process.env = originalEnv;
    });
  });
});