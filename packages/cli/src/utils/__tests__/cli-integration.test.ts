/**
 * @fileoverview Integration tests for CLI startup with update checker
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkAndNotifyUpdates } from '../update-checker.js';

// Mock dependencies
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

vi.mock('fs/promises');
vi.mock('chalk', () => ({
  cyan: vi.fn((text) => text),
  green: vi.fn((text) => text),
  red: vi.fn((text) => text),
  yellow: vi.fn((text) => text),
  blue: vi.fn((text) => text),
  dim: vi.fn((text) => text),
}));

const originalConsoleLog = console.log;
let consoleLogs: string[] = [];

describe('CLI Startup Integration Tests', () => {
  const { getLatestPackageVersion } = require('@apexcli/core');

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogs = [];

    console.log = vi.fn((message) => {
      consoleLogs.push(message);
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('Startup Banner and Update Check Integration', () => {
    it('should show update notification after banner', async () => {
      getLatestPackageVersion.mockResolvedValue('0.7.0');

      // Simulate CLI banner display
      console.log('APEX CLI v0.6.0');

      // Then run update check
      await checkAndNotifyUpdates();

      expect(consoleLogs).toHaveLength(2);
      expect(consoleLogs[0]).toBe('APEX CLI v0.6.0');
      expect(consoleLogs[1]).toContain('Update available: 0.6.0 → 0.7.0');
    });

    it('should not interrupt banner when update check fails', async () => {
      getLatestPackageVersion.mockRejectedValue(new Error('Network error'));

      // Simulate CLI banner display
      console.log('APEX CLI v0.6.0');

      // Then run update check (should fail silently)
      await checkAndNotifyUpdates();

      expect(consoleLogs).toHaveLength(1);
      expect(consoleLogs[0]).toBe('APEX CLI v0.6.0');
    });

    it('should be non-blocking during startup', async () => {
      getLatestPackageVersion.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve('0.7.0'), 100))
      );

      const startTime = Date.now();

      // Simulate CLI banner display
      console.log('APEX CLI v0.6.0');

      // Start update check but don't wait (non-blocking)
      const updatePromise = checkAndNotifyUpdates();

      // Continue with CLI startup
      console.log('CLI ready');

      const midTime = Date.now();

      // Now wait for update check to complete
      await updatePromise;

      const endTime = Date.now();

      // CLI should be ready quickly, update check happens in background
      expect(midTime - startTime).toBeLessThan(50);
      expect(endTime - startTime).toBeGreaterThan(90);

      expect(consoleLogs).toHaveLength(3);
      expect(consoleLogs[0]).toBe('APEX CLI v0.6.0');
      expect(consoleLogs[1]).toBe('CLI ready');
      expect(consoleLogs[2]).toContain('Update available');
    });
  });

  describe('Environment Variable Integration', () => {
    it('should respect APEX_SKIP_UPDATE_CHECK in production', async () => {
      const originalEnv = process.env.APEX_SKIP_UPDATE_CHECK;

      // Simulate production environment
      process.env.APEX_SKIP_UPDATE_CHECK = '1';

      console.log('APEX CLI v0.6.0');
      await checkAndNotifyUpdates();

      expect(consoleLogs).toHaveLength(1);
      expect(consoleLogs[0]).toBe('APEX CLI v0.6.0');
      expect(getLatestPackageVersion).not.toHaveBeenCalled();

      // Restore environment
      if (originalEnv === undefined) {
        delete process.env.APEX_SKIP_UPDATE_CHECK;
      } else {
        process.env.APEX_SKIP_UPDATE_CHECK = originalEnv;
      }
    });

    it('should work normally without environment variable', async () => {
      const originalEnv = process.env.APEX_SKIP_UPDATE_CHECK;
      delete process.env.APEX_SKIP_UPDATE_CHECK;

      getLatestPackageVersion.mockResolvedValue('0.7.0');

      console.log('APEX CLI v0.6.0');
      await checkAndNotifyUpdates();

      expect(consoleLogs).toHaveLength(2);
      expect(consoleLogs[0]).toBe('APEX CLI v0.6.0');
      expect(consoleLogs[1]).toContain('Update available');
      expect(getLatestPackageVersion).toHaveBeenCalled();

      // Restore environment
      if (originalEnv !== undefined) {
        process.env.APEX_SKIP_UPDATE_CHECK = originalEnv;
      }
    });
  });

  describe('User Command vs Service Command Integration', () => {
    it('should check updates for user commands', async () => {
      getLatestPackageVersion.mockResolvedValue('0.7.0');

      // Simulate user command execution
      await checkAndNotifyUpdates();

      expect(getLatestPackageVersion).toHaveBeenCalled();
      expect(consoleLogs[0]).toContain('Update available');
    });

    it('should not check updates for daemon/service commands', async () => {
      // This would be handled by the CLI command dispatcher
      // but we test the silent option here
      await checkAndNotifyUpdates({ silent: true });

      expect(getLatestPackageVersion).not.toHaveBeenCalled();
      expect(consoleLogs).toHaveLength(0);
    });
  });

  describe('Network Conditions Integration', () => {
    it('should handle slow networks gracefully', async () => {
      getLatestPackageVersion.mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(() => resolve('0.7.0'), 4000); // 4 second delay
        })
      );

      const startTime = Date.now();
      console.log('APEX CLI v0.6.0');

      await checkAndNotifyUpdates();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should timeout at 3 seconds as configured
      expect(duration).toBeLessThan(3500);
      expect(consoleLogs).toHaveLength(1); // Only banner, no update notification
    });

    it('should handle DNS failures gracefully', async () => {
      getLatestPackageVersion.mockRejectedValue(new Error('ENOTFOUND registry.npmjs.org'));

      console.log('APEX CLI v0.6.0');
      await checkAndNotifyUpdates();

      expect(consoleLogs).toHaveLength(1);
      expect(consoleLogs[0]).toBe('APEX CLI v0.6.0');
    });

    it('should handle registry HTTP errors gracefully', async () => {
      getLatestPackageVersion.mockRejectedValue(new Error('HTTP 503 Service Unavailable'));

      console.log('APEX CLI v0.6.0');
      await checkAndNotifyUpdates();

      expect(consoleLogs).toHaveLength(1);
      expect(consoleLogs[0]).toBe('APEX CLI v0.6.0');
    });
  });

  describe('Cache Integration', () => {

    it('should use cache to avoid repeated network calls', async () => {
      const { readFile, writeFile } = require('fs/promises');

      // Mock cache exists with recent update info
      const cacheData = {
        timestamp: Date.now() - 1000, // 1 second ago
        updateInfo: {
          currentVersion: '0.6.0',
          latestVersion: '0.7.0',
          hasUpdate: true,
          updateType: 'minor',
        },
      };

      readFile.mockResolvedValue(JSON.stringify(cacheData));

      console.log('APEX CLI v0.6.0');
      await checkAndNotifyUpdates();

      // Should use cache instead of network call
      expect(getLatestPackageVersion).not.toHaveBeenCalled();
      expect(consoleLogs).toHaveLength(2);
      expect(consoleLogs[1]).toContain('Update available: 0.6.0 → 0.7.0');
    });

    it('should refresh stale cache', async () => {
      const { readFile } = require('fs/promises');

      // Mock stale cache (7 hours old)
      const staleCache = {
        timestamp: Date.now() - (7 * 60 * 60 * 1000),
        updateInfo: {
          currentVersion: '0.6.0',
          latestVersion: '0.7.0',
          hasUpdate: true,
          updateType: 'minor',
        },
      };

      readFile.mockResolvedValue(JSON.stringify(staleCache));
      getLatestPackageVersion.mockResolvedValue('0.8.0');

      console.log('APEX CLI v0.6.0');
      await checkAndNotifyUpdates();

      // Should make network call to refresh stale cache
      expect(getLatestPackageVersion).toHaveBeenCalled();
      expect(consoleLogs).toHaveLength(2);
      expect(consoleLogs[1]).toContain('Update available: 0.6.0 → 0.8.0');
    });
  });
});