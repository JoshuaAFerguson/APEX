/**
 * @fileoverview End-to-end tests for update checker integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock only what we need to control for e2e testing
vi.mock('@apexcli/core', () => ({
  getLatestPackageVersion: vi.fn(),
  compareVersionStrings: vi.fn((a, b) => {
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
  }),
}));

describe('Update Checker E2E Integration', () => {
  const { getLatestPackageVersion } = require('@apexcli/core');
  let originalConsoleLog: typeof console.log;
  let consoleLogs: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogs = [];
    originalConsoleLog = console.log;
    console.log = vi.fn((message) => {
      consoleLogs.push(message);
      originalConsoleLog(message); // Keep original console.log for debugging
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it('should work end-to-end with CLI startup', async () => {
    // Import the actual implementation
    const { checkAndNotifyUpdates } = await import('../update-checker.js');

    // Mock a newer version available
    getLatestPackageVersion.mockResolvedValue('0.7.0');

    // Simulate CLI startup
    await checkAndNotifyUpdates();

    // Should display update notification
    expect(consoleLogs).toHaveLength(1);
    expect(consoleLogs[0]).toContain('Update available');
    expect(consoleLogs[0]).toContain('0.6.0 → 0.7.0');
    expect(consoleLogs[0]).toContain('npm update -g @apexcli/cli');
  });

  it('should respect environment variable in real scenario', async () => {
    const { checkAndNotifyUpdates } = await import('../update-checker.js');

    const originalEnv = process.env.APEX_SKIP_UPDATE_CHECK;
    process.env.APEX_SKIP_UPDATE_CHECK = '1';

    getLatestPackageVersion.mockResolvedValue('0.7.0');

    await checkAndNotifyUpdates();

    expect(consoleLogs).toHaveLength(0);
    expect(getLatestPackageVersion).not.toHaveBeenCalled();

    // Restore environment
    if (originalEnv === undefined) {
      delete process.env.APEX_SKIP_UPDATE_CHECK;
    } else {
      process.env.APEX_SKIP_UPDATE_CHECK = originalEnv;
    }
  });

  it('should handle network errors gracefully in real scenario', async () => {
    const { checkAndNotifyUpdates } = await import('../update-checker.js');

    getLatestPackageVersion.mockRejectedValue(new Error('ECONNREFUSED'));

    // Should not throw
    await expect(checkAndNotifyUpdates()).resolves.not.toThrow();
    expect(consoleLogs).toHaveLength(0);
  });

  it('should not show notification when no update available', async () => {
    const { checkAndNotifyUpdates } = await import('../update-checker.js');

    getLatestPackageVersion.mockResolvedValue('0.6.0'); // Same version

    await checkAndNotifyUpdates();

    expect(consoleLogs).toHaveLength(0);
  });
});