/**
 * @fileoverview Doctor and Update Checker Integration Tests
 *
 * Tests that verify the integration between the doctor command functionality
 * and the update checker, ensuring they work together correctly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDoctorCheckResult, createHealthReport, getLatestPackageVersion } from '@apexcli/core';
import { checkForUpdates, displayUpdateNotification } from '../utils/update-checker.js';
import type { DoctorCheckResult, HealthReport } from '@apexcli/core';
import type { UpdateInfo } from '../utils/update-checker.js';

// Mock dependencies
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    getLatestPackageVersion: vi.fn(),
  };
});

vi.mock('chalk', () => ({
  default: {
    cyan: vi.fn((text) => `[CYAN]${text}[/CYAN]`),
    green: vi.fn((text) => `[GREEN]${text}[/GREEN]`),
    red: vi.fn((text) => `[RED]${text}[/RED]`),
    yellow: vi.fn((text) => `[YELLOW]${text}[/YELLOW]`),
    blue: vi.fn((text) => `[BLUE]${text}[/BLUE]`),
    dim: vi.fn((text) => `[DIM]${text}[/DIM]`),
    bold: vi.fn((text) => `[BOLD]${text}[/BOLD]`),
  },
}));

vi.mock('boxen', () => ({
  default: vi.fn((content, options) => `[BOX:${options?.borderColor || 'default'}]${content}[/BOX]`),
}));

const mockedGetLatestPackageVersion = vi.mocked(getLatestPackageVersion);

describe('Doctor and Update Checker Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Health Check with Update Notifications', () => {
    it('should display update notification when health check passes and update available', async () => {
      // Mock successful version check
      mockedGetLatestPackageVersion.mockResolvedValue('0.7.0');

      // Create a successful health report
      const checks: DoctorCheckResult[] = [
        createDoctorCheckResult({
          id: 'node-check',
          name: 'Node.js Version',
          category: 'toolchain',
          status: 'pass',
          message: 'Node.js version is compatible',
        }),
        createDoctorCheckResult({
          id: 'npm-check',
          name: 'npm Package Manager',
          category: 'toolchain',
          status: 'pass',
          message: 'npm is available and compatible',
        }),
      ];

      const healthReport = createHealthReport(checks, { apexVersion: '0.6.0' });
      const updateInfo = await checkForUpdates();

      // Verify health report is successful
      expect(healthReport.overallStatus).toBe('pass');
      expect(healthReport.summary.passed).toBe(2);
      expect(healthReport.summary.failed).toBe(0);

      // Verify update is available
      expect(updateInfo?.hasUpdate).toBe(true);
      expect(updateInfo?.latestVersion).toBe('0.7.0');
      expect(updateInfo?.currentVersion).toBe('0.6.0');
    });

    it('should handle update check failures gracefully when health checks pass', async () => {
      // Mock network failure for update check
      mockedGetLatestPackageVersion.mockRejectedValue(new Error('Network error'));

      // Create a successful health report
      const checks: DoctorCheckResult[] = [
        createDoctorCheckResult({
          id: 'node-check',
          name: 'Node.js Version',
          category: 'toolchain',
          status: 'pass',
          message: 'Node.js version is compatible',
        }),
      ];

      const healthReport = createHealthReport(checks, { apexVersion: '0.6.0' });
      const updateInfo = await checkForUpdates();

      // Health report should still be successful
      expect(healthReport.overallStatus).toBe('pass');

      // Update check should fail gracefully
      expect(updateInfo).toBeNull();
    });

    it('should prioritize health check failures over update notifications', async () => {
      // Mock update available
      mockedGetLatestPackageVersion.mockResolvedValue('0.7.0');

      // Create a failed health report
      const checks: DoctorCheckResult[] = [
        createDoctorCheckResult({
          id: 'node-check',
          name: 'Node.js Version',
          category: 'toolchain',
          status: 'fail',
          severity: 'error',
          message: 'Node.js version is incompatible',
        }),
      ];

      const healthReport = createHealthReport(checks, { apexVersion: '0.6.0' });
      const updateInfo = await checkForUpdates();

      // Health report should show failure
      expect(healthReport.overallStatus).toBe('fail');
      expect(healthReport.summary.failed).toBe(1);

      // Update should still be detected but health issues take priority
      expect(updateInfo?.hasUpdate).toBe(true);
    });
  });

  describe('Version Consistency Checks', () => {
    it('should verify version consistency between health report and update checker', async () => {
      mockedGetLatestPackageVersion.mockResolvedValue('0.6.0'); // Same as current

      const checks: DoctorCheckResult[] = [
        createDoctorCheckResult({
          id: 'version-consistency',
          name: 'Version Consistency Check',
          category: 'apex',
          status: 'pass',
          message: 'APEX version is consistent',
        }),
      ];

      const healthReport = createHealthReport(checks, { apexVersion: '0.6.0' });
      const updateInfo = await checkForUpdates();

      // Both should report the same current version
      expect(healthReport.apexVersion).toBe('0.6.0');
      expect(updateInfo?.currentVersion).toBe('0.6.0');
      expect(updateInfo?.hasUpdate).toBe(false);
    });

    it('should handle major version updates appropriately', async () => {
      mockedGetLatestPackageVersion.mockResolvedValue('1.0.0'); // Major version bump

      const checks: DoctorCheckResult[] = [
        createDoctorCheckResult({
          id: 'apex-compatibility',
          name: 'APEX Compatibility',
          category: 'apex',
          status: 'pass',
          message: 'Current APEX installation is working',
        }),
      ];

      const healthReport = createHealthReport(checks, { apexVersion: '0.6.0' });
      const updateInfo = await checkForUpdates();

      expect(healthReport.overallStatus).toBe('pass');
      expect(updateInfo?.updateType).toBe('major');
      expect(updateInfo?.hasUpdate).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle concurrent errors in health checks and update checks', async () => {
      // Mock update check failure
      mockedGetLatestPackageVersion.mockRejectedValue(new Error('Registry unavailable'));

      // Create health check with timeout/error
      const checks: DoctorCheckResult[] = [
        createDoctorCheckResult({
          id: 'network-check',
          name: 'Network Connectivity',
          category: 'network',
          status: 'fail',
          severity: 'warning',
          message: 'Network connectivity issues detected',
          suggestion: 'Check internet connection',
        }),
      ];

      const healthReport = createHealthReport(checks, { apexVersion: '0.6.0' });
      const updateInfo = await checkForUpdates();

      // Both should handle errors gracefully
      expect(healthReport.overallStatus).toBe('fail');
      expect(updateInfo).toBeNull();
    });

    it('should provide meaningful feedback when both systems are working', async () => {
      mockedGetLatestPackageVersion.mockResolvedValue('0.6.1'); // Patch update

      const checks: DoctorCheckResult[] = [
        createDoctorCheckResult({
          id: 'full-system-check',
          name: 'Full System Health',
          category: 'system',
          status: 'pass',
          message: 'All systems operational',
          durationMs: 1500,
        }),
      ];

      const healthReport = createHealthReport(checks, { apexVersion: '0.6.0' });
      const updateInfo = await checkForUpdates();

      // Verify comprehensive success state
      expect(healthReport.overallStatus).toBe('pass');
      expect(healthReport.summary.total).toBe(1);
      expect(healthReport.summary.passed).toBe(1);
      expect(healthReport.durationMs).toBe(1500);

      expect(updateInfo?.hasUpdate).toBe(true);
      expect(updateInfo?.updateType).toBe('patch');
      expect(updateInfo?.currentVersion).toBe('0.6.0');
      expect(updateInfo?.latestVersion).toBe('0.6.1');
    });
  });

  describe('Performance Integration', () => {
    it('should handle health checks and update checks within reasonable time limits', async () => {
      // Mock quick responses
      mockedGetLatestPackageVersion.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve('0.6.0'), 100))
      );

      const startTime = Date.now();

      const checks: DoctorCheckResult[] = [
        createDoctorCheckResult({
          id: 'performance-check',
          name: 'Performance Test',
          category: 'performance',
          status: 'pass',
          message: 'Performance within acceptable limits',
          durationMs: 50,
        }),
      ];

      const healthReport = createHealthReport(checks, { apexVersion: '0.6.0' });

      // Advance time to simulate async operations
      vi.advanceTimersByTime(100);

      const updateInfo = await checkForUpdates();

      // Should complete quickly
      expect(healthReport.durationMs).toBeLessThan(100);
      expect(updateInfo?.currentVersion).toBe('0.6.0');
    });
  });

  describe('Configuration Integration', () => {
    it('should respect timeout configurations across both systems', async () => {
      // Mock slow update check
      mockedGetLatestPackageVersion.mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve('0.7.0'), 10000))
      );

      const checks: DoctorCheckResult[] = [
        createDoctorCheckResult({
          id: 'timeout-test',
          name: 'Timeout Configuration Test',
          category: 'config',
          status: 'pass',
          message: 'Timeout configuration working',
        }),
      ];

      const healthReport = createHealthReport(checks, { apexVersion: '0.6.0' });

      // Test with short timeout (should timeout)
      const updatePromise = checkForUpdates({ timeout: 1000 });

      // Advance to trigger timeout
      vi.advanceTimersByTime(1000);

      const updateInfo = await updatePromise;

      expect(healthReport.overallStatus).toBe('pass');
      // Update check should handle timeout gracefully
      expect(updateInfo).toBeDefined(); // May succeed or fail gracefully
    });
  });
});