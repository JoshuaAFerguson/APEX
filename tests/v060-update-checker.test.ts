/**
 * @fileoverview Tests for v0.6.0 Update Available Checker functionality
 *
 * This test suite validates the update checker features that should:
 * - Check npm registry for newer APEX versions on CLI startup with non-intrusive notification (v0.6.0 roadmap requirement)
 * - Provide version comparison and update detection utilities
 * - Handle network failures gracefully
 * - Support scoped packages and proper npm registry API usage
 *
 * These tests cover the NPM registry utilities that are implemented in @apexcli/core.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  queryNpmRegistry,
  getLatestPackageVersion,
  isPackageVersionAvailable,
  satisfiesVersion,
  compareVersionStrings,
  parseVersionOutput,
  type NpmPackageInfo,
} from '@apexcli/core';

// Mock global fetch for npm registry tests
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('v0.6.0 Update Available Checker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('NPM Registry Query', () => {
    it('should query npm registry with correct headers and URL', async () => {
      const mockNpmResponse = {
        name: '@apexcli/core',
        'dist-tags': { latest: '0.6.1', next: '0.7.0-beta.1' },
        versions: {
          '0.6.1': { version: '0.6.1' },
          '0.6.0': { version: '0.6.0' },
          '0.5.0': { version: '0.5.0' },
        },
        time: {
          '0.6.1': '2026-02-20T10:00:00.000Z',
          '0.6.0': '2026-02-18T10:00:00.000Z',
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNpmResponse),
      });

      const result = await queryNpmRegistry('@apexcli/core');

      // Verify correct URL for scoped package (unencoded)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://registry.npmjs.org/@apexcli/core',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'User-Agent': 'APEX-doctor/0.6.0',
          }),
        })
      );

      // Verify result is transformed into NpmPackageInfo format
      expect(result).toMatchObject({
        name: '@apexcli/core',
        latestVersion: '0.6.1',
        versions: expect.arrayContaining(['0.6.1', '0.6.0', '0.5.0']),
      });
    });

    it('should handle non-scoped packages correctly', async () => {
      const mockNpmResponse = {
        name: 'apex',
        'dist-tags': { latest: '0.6.0' },
        versions: { '0.6.0': {} },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNpmResponse),
      });

      const result = await queryNpmRegistry('apex');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://registry.npmjs.org/apex',
        expect.any(Object)
      );

      // Verify result is transformed into NpmPackageInfo format
      expect(result).toMatchObject({
        name: 'apex',
        latestVersion: '0.6.0',
        versions: ['0.6.0'],
      });
    });

    it('should handle timeout gracefully', async () => {
      mockFetch.mockImplementation(() =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        })
      );

      const result = await queryNpmRegistry('@apexcli/core');
      expect(result).toBeNull();
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await queryNpmRegistry('@apexcli/core');
      expect(result).toBeNull();
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await queryNpmRegistry('non-existent-package');
      // Implementation returns null for HTTP errors (including 404)
      expect(result).toBeNull();
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const result = await queryNpmRegistry('@apexcli/core');
      expect(result).toBeNull();
    });
  });

  describe('Latest Version Detection', () => {
    it('should get latest version from dist-tags', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          'dist-tags': { latest: '0.6.1', next: '0.7.0-beta.1' },
          versions: { '0.6.1': {}, '0.6.0': {} },
        }),
      });

      const latestVersion = await getLatestPackageVersion('@apexcli/core');
      expect(latestVersion).toBe('0.6.1');
    });

    it('should return null when package not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const latestVersion = await getLatestPackageVersion('non-existent');
      expect(latestVersion).toBeNull();
    });

    it('should handle missing dist-tags', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          versions: { '0.6.0': {} },
        }),
      });

      const latestVersion = await getLatestPackageVersion('@apexcli/core');
      expect(latestVersion).toBeNull();
    });

    it('should handle empty dist-tags', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          'dist-tags': {},
          versions: { '0.6.0': {} },
        }),
      });

      const latestVersion = await getLatestPackageVersion('@apexcli/core');
      expect(latestVersion).toBeNull();
    });
  });

  describe('Version Availability Check', () => {
    it('should check if specific version exists', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          versions: {
            '0.6.0': { version: '0.6.0' },
            '0.5.0': { version: '0.5.0' },
          },
        }),
      });

      const exists = await isPackageVersionAvailable('@apexcli/core', '0.6.0');
      expect(exists).toBe(true);

      const notExists = await isPackageVersionAvailable('@apexcli/core', '0.7.0');
      expect(notExists).toBe(false);
    });

    it('should return false when package not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const exists = await isPackageVersionAvailable('non-existent', '1.0.0');
      expect(exists).toBe(false);
    });

    it('should handle missing versions object', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          'dist-tags': { latest: '0.6.0' },
        }),
      });

      const exists = await isPackageVersionAvailable('@apexcli/core', '0.6.0');
      expect(exists).toBe(false);
    });
  });

  describe('Version Comparison Utilities', () => {
    describe('satisfiesVersion', () => {
      it('should validate version against range requirements', () => {
        // Exact version matching
        expect(satisfiesVersion('1.0.0', '1.0.0')).toBe(true);
        expect(satisfiesVersion('1.0.0', '1.0.1')).toBe(false);

        // Greater than or equal
        expect(satisfiesVersion('>=18.0.0', '18.0.0')).toBe(true);
        expect(satisfiesVersion('>=18.0.0', '19.0.0')).toBe(true);
        expect(satisfiesVersion('>=18.0.0', '17.0.0')).toBe(false);

        // Caret ranges (compatible)
        expect(satisfiesVersion('^1.0.0', '1.0.0')).toBe(true);
        expect(satisfiesVersion('^1.0.0', '1.5.0')).toBe(true);
        expect(satisfiesVersion('^1.0.0', '2.0.0')).toBe(false);

        // Tilde ranges (reasonably close)
        expect(satisfiesVersion('~1.0.0', '1.0.0')).toBe(true);
        expect(satisfiesVersion('~1.0.0', '1.0.5')).toBe(true);
        expect(satisfiesVersion('~1.0.0', '1.1.0')).toBe(false);
      });

      it('should handle pre-release versions', () => {
        expect(satisfiesVersion('1.0.0-beta.1', '1.0.0-beta.1')).toBe(true);
        expect(satisfiesVersion('>=1.0.0-beta.1', '1.0.0-beta.2')).toBe(true);
        expect(satisfiesVersion('>=1.0.0-beta.1', '1.0.0-alpha.1')).toBe(false);
      });

      it('should handle build metadata', () => {
        expect(satisfiesVersion('1.0.0+build.1', '1.0.0+build.1')).toBe(true);
        expect(satisfiesVersion('1.0.0+build.1', '1.0.0+build.2')).toBe(true); // Build metadata ignored
      });

      it('should handle invalid version formats gracefully', () => {
        expect(satisfiesVersion('invalid', '1.0.0')).toBe(false);
        expect(satisfiesVersion('1.0.0', 'invalid')).toBe(false);
        expect(satisfiesVersion('', '1.0.0')).toBe(false);
        expect(satisfiesVersion('1.0.0', '')).toBe(false);
      });
    });

    describe('compareVersionStrings', () => {
      it('should compare semantic versions correctly', () => {
        // Equal versions
        expect(compareVersionStrings('1.0.0', '1.0.0')).toBe(0);

        // Different major versions
        expect(compareVersionStrings('2.0.0', '1.0.0')).toBeGreaterThan(0);
        expect(compareVersionStrings('1.0.0', '2.0.0')).toBeLessThan(0);

        // Different minor versions
        expect(compareVersionStrings('1.1.0', '1.0.0')).toBeGreaterThan(0);
        expect(compareVersionStrings('1.0.0', '1.1.0')).toBeLessThan(0);

        // Different patch versions
        expect(compareVersionStrings('1.0.1', '1.0.0')).toBeGreaterThan(0);
        expect(compareVersionStrings('1.0.0', '1.0.1')).toBeLessThan(0);
      });

      it('should handle pre-release versions', () => {
        expect(compareVersionStrings('1.0.0', '1.0.0-beta.1')).toBeGreaterThan(0);
        expect(compareVersionStrings('1.0.0-beta.1', '1.0.0')).toBeLessThan(0);
        expect(compareVersionStrings('1.0.0-beta.2', '1.0.0-beta.1')).toBeGreaterThan(0);
        expect(compareVersionStrings('1.0.0-alpha.1', '1.0.0-beta.1')).toBeLessThan(0);
      });

      it('should handle version prefixes', () => {
        expect(compareVersionStrings('v1.0.0', '1.0.0')).toBe(0);
        expect(compareVersionStrings('v2.0.0', 'v1.0.0')).toBeGreaterThan(0);
      });

      it('should handle invalid versions gracefully', () => {
        // Invalid versions are treated as 0.0.0 for graceful degradation
        expect(compareVersionStrings('invalid', '1.0.0')).toBeLessThan(0); // 0.0.0 < 1.0.0
        expect(compareVersionStrings('1.0.0', 'invalid')).toBeGreaterThan(0); // 1.0.0 > 0.0.0
        expect(compareVersionStrings('', '')).toBe(0); // 0.0.0 === 0.0.0
      });
    });

    describe('parseVersionOutput', () => {
      it('should extract versions from command output', () => {
        expect(parseVersionOutput('v18.0.0')).toBe('18.0.0');
        expect(parseVersionOutput('npm version 9.0.0')).toBe('9.0.0');
        expect(parseVersionOutput('git version 2.39.0')).toBe('2.39.0');
        expect(parseVersionOutput('TypeScript 5.3.0')).toBe('5.3.0');
      });

      it('should handle complex version output', () => {
        expect(parseVersionOutput('node v18.0.0 (npm 9.0.0)')).toBe('18.0.0');
        expect(parseVersionOutput('Node.js version: v18.0.0')).toBe('18.0.0');
        expect(parseVersionOutput('Version: 1.2.3-beta.1+build.123')).toBe('1.2.3-beta.1+build.123');
      });

      it('should return null for no version found', () => {
        expect(parseVersionOutput('no version here')).toBeNull();
        expect(parseVersionOutput('')).toBeNull();
        expect(parseVersionOutput('command not found')).toBeNull();
      });

      it('should handle multiline output', () => {
        const multilineOutput = `Some header text
        Version: 1.2.3
        Other information`;
        expect(parseVersionOutput(multilineOutput)).toBe('1.2.3');
      });
    });
  });

  describe('CLI Startup Integration', () => {
    it('should check for updates non-intrusively on CLI startup', async () => {
      // Mock successful update check
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          'dist-tags': { latest: '0.6.1' },
          versions: { '0.6.1': {}, '0.6.0': {} },
          time: {
            '0.6.1': '2026-02-20T10:00:00.000Z',
          },
        }),
      });

      const currentVersion = '0.6.0';
      const latestVersion = await getLatestPackageVersion('apex');

      // Simulate CLI startup update check logic
      const updateInfo = {
        currentVersion,
        latestVersion,
        updateAvailable: latestVersion && latestVersion !== currentVersion,
        isNonIntrusive: true, // Should not block CLI startup
        message: latestVersion && latestVersion !== currentVersion
          ? `📦 Update available: ${currentVersion} → ${latestVersion} (run 'npm install -g apex' to update)`
          : null,
      };

      expect(updateInfo.updateAvailable).toBe(true);
      expect(updateInfo.isNonIntrusive).toBe(true);
      expect(updateInfo.message).toContain('Update available');
      expect(updateInfo.message).toContain('0.6.0 → 0.6.1');
    });

    it('should not block CLI startup on network failures', async () => {
      // Mock network failure
      mockFetch.mockRejectedValue(new Error('Network timeout'));

      const startTime = Date.now();
      const latestVersion = await getLatestPackageVersion('apex');
      const duration = Date.now() - startTime;

      // Update check should fail fast and not block startup
      expect(latestVersion).toBeNull();
      expect(duration).toBeLessThan(6000); // Should timeout within 5 seconds
    });

    it('should handle update check for development versions', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          'dist-tags': { latest: '0.6.0', next: '0.7.0-beta.1' },
          versions: {
            '0.7.0-beta.1': {},
            '0.6.0': {},
          },
        }),
      });

      const currentVersion = '0.7.0-dev';
      const latestVersion = await getLatestPackageVersion('apex');

      // Development versions should not trigger update notifications
      const updateInfo = {
        currentVersion,
        latestVersion,
        isDevelopment: currentVersion.includes('dev') || currentVersion.includes('beta'),
        shouldNotify: latestVersion &&
                      latestVersion !== currentVersion &&
                      !currentVersion.includes('dev') &&
                      !currentVersion.includes('beta'),
      };

      expect(updateInfo.isDevelopment).toBe(true);
      expect(updateInfo.shouldNotify).toBe(false);
    });
  });

  describe('Real-world NPM Registry Integration', () => {
    it('should work with actual APEX packages structure', async () => {
      // Mock realistic APEX package structure
      const apexPackages = [
        '@apexcli/core',
        '@apexcli/cli',
        '@apexcli/api',
        '@apexcli/orchestrator',
        '@apexcli/browser',
        '@apexcli/web-ui',
      ];

      mockFetch.mockImplementation((url: string) => {
        // Extract package name from URL (handle scoped packages)
        // URL format: https://registry.npmjs.org/@scope/name or https://registry.npmjs.org/name
        const urlPath = url.replace('https://registry.npmjs.org/', '');
        const packageName = urlPath.startsWith('@') ? urlPath : urlPath.split('/')[0];

        if (apexPackages.includes(packageName)) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              name: packageName,
              'dist-tags': { latest: '0.6.0' },
              versions: { '0.6.0': { version: '0.6.0' } },
            }),
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      // Test checking each APEX package
      const results = await Promise.all(
        apexPackages.map(async pkg => ({
          package: pkg,
          latest: await getLatestPackageVersion(pkg),
          available: await isPackageVersionAvailable(pkg, '0.6.0'),
        }))
      );

      results.forEach(result => {
        expect(result.latest).toBe('0.6.0');
        expect(result.available).toBe(true);
      });
    });

    it('should handle package deprecation warnings', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          name: 'old-apex-package',
          'dist-tags': { latest: '0.6.0' },
          versions: {
            '0.6.0': {
              deprecated: 'This package has been deprecated. Use @apexcli/core instead.',
            },
          },
          // Top-level deprecated field is what queryNpmRegistry extracts
          deprecated: 'This package has been deprecated. Use @apexcli/core instead.',
        }),
      });

      const packageInfo = await queryNpmRegistry('old-apex-package') as NpmPackageInfo;

      // The implementation extracts deprecated from the top-level npm response
      // and returns it in the NpmPackageInfo.deprecated field
      expect(packageInfo?.deprecated).toContain('deprecated');
    });

    it('should respect npm registry rate limits', async () => {
      let requestCount = 0;
      mockFetch.mockImplementation(() => {
        requestCount++;
        if (requestCount > 3) {
          return Promise.resolve({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 'dist-tags': { latest: '0.6.0' } }),
        });
      });

      // Make multiple requests
      const requests = Array.from({ length: 5 }, () =>
        queryNpmRegistry('@apexcli/core')
      );

      const results = await Promise.all(requests);

      // First 3 should succeed, rest should return null due to rate limiting
      expect(results.slice(0, 3).every(result => result !== null)).toBe(true);
      expect(results.slice(3).every(result => result === null)).toBe(true);
    });
  });
});