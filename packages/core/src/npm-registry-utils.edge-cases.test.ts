import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { existsSync, unlinkSync, mkdirSync, rmSync, writeFileSync, chmodSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  checkApexCliVersion,
  checkPackageVersion,
  clearVersionCache,
  getCacheStats,
  type CachedVersionInfo,
  type VersionCheckOptions,
} from './npm-registry-utils';

// Mock dependencies
vi.mock('./doctor-utils', () => ({
  queryNpmRegistry: vi.fn(),
}));

vi.mock('./utils', () => ({
  compareVersions: vi.fn(),
}));

import { queryNpmRegistry } from './doctor-utils';
import { compareVersions } from './utils';

const mockQueryNpmRegistry = vi.mocked(queryNpmRegistry);
const mockCompareVersions = vi.mocked(compareVersions);

describe('NPM Registry Version Checker - Edge Cases and Additional Coverage', () => {
  const testCacheDir = join(tmpdir(), '.apex-edge-test-cache');

  beforeAll(() => {
    // Clean up any existing test cache
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    mockCompareVersions.mockImplementation((current: string, latest: string) => {
      // Simple comparison for testing
      const currentNum = parseFloat(current.replace(/[^\d.]/g, ''));
      const latestNum = parseFloat(latest.replace(/[^\d.]/g, ''));
      return currentNum < latestNum ? -1 : currentNum > latestNum ? 1 : 0;
    });

    // Clear cache before each test
    clearVersionCache(undefined, undefined, { cacheDir: testCacheDir });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Concurrent Access Scenarios', () => {
    it('should handle multiple simultaneous requests for same package', async () => {
      let callCount = 0;
      mockQueryNpmRegistry.mockImplementation(async () => {
        callCount++;
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          name: '@apexcli/cli',
          version: '0.6.0',
          latestVersion: '0.6.0',
          versions: ['0.6.0'],
        };
      });

      mockCompareVersions.mockReturnValue(0);

      // Make multiple concurrent requests
      const promises = Array(5).fill(null).map(() =>
        checkApexCliVersion('0.6.0', { cacheDir: testCacheDir })
      );

      const results = await Promise.all(promises);

      // All should succeed and return same result
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result!.packageName).toBe('@apexcli/cli');
      });

      // Should have made multiple calls (no caching during concurrent execution)
      // This depends on implementation - if cache is checked after network request,
      // multiple calls might be made initially
      expect(callCount).toBeGreaterThan(0);
    });

    it('should handle concurrent requests for different packages', async () => {
      mockQueryNpmRegistry.mockImplementation(async (packageName) => {
        return {
          name: packageName,
          version: '1.0.0',
          latestVersion: '1.0.0',
          versions: ['1.0.0'],
        };
      });

      mockCompareVersions.mockReturnValue(0);

      const packages = ['package-a', 'package-b', 'package-c'];
      const promises = packages.map(pkg =>
        checkPackageVersion(pkg, '1.0.0', { cacheDir: testCacheDir })
      );

      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result!.packageName).toBe(packages[index]);
      });
    });
  });

  describe('Large Data Scenarios', () => {
    it('should handle packages with many versions', async () => {
      // Simulate a package with many versions (like React or Express)
      const manyVersions = Array.from({ length: 1000 }, (_, i) => `1.0.${i}`);

      mockQueryNpmRegistry.mockResolvedValue({
        name: 'popular-package',
        version: '1.0.999',
        latestVersion: '1.0.999',
        versions: manyVersions,
      });

      mockCompareVersions.mockReturnValue(0);

      const result = await checkPackageVersion('popular-package', '1.0.500', {
        cacheDir: testCacheDir
      });

      expect(result).toBeDefined();
      expect(result!.versions).toHaveLength(1000);
      expect(result!.latestVersion).toBe('1.0.999');
    });

    it('should handle large cache files gracefully', async () => {
      // Create a large cache with many entries
      const largeCache: Record<string, any> = {};
      for (let i = 0; i < 1000; i++) {
        largeCache[`package-${i}@1.0.0`] = {
          packageName: `package-${i}`,
          currentVersion: '1.0.0',
          latestVersion: '1.0.0',
          versions: ['1.0.0'],
          isLatest: true,
          hasUpdate: false,
          versionComparison: 0,
          cachedAt: Date.now(),
          cacheTtl: 24 * 60 * 60 * 1000,
        };
      }

      // Write large cache file
      mkdirSync(testCacheDir, { recursive: true });
      const cacheFile = join(testCacheDir, 'npm-versions.json');
      writeFileSync(cacheFile, JSON.stringify(largeCache, null, 2));

      mockQueryNpmRegistry.mockResolvedValue({
        name: 'new-package',
        version: '1.0.0',
        latestVersion: '1.0.0',
        versions: ['1.0.0'],
      });

      // Should still work with large cache
      const result = await checkPackageVersion('new-package', '1.0.0', {
        cacheDir: testCacheDir
      });

      expect(result).toBeDefined();

      const stats = getCacheStats({ cacheDir: testCacheDir });
      expect(stats.totalEntries).toBeGreaterThan(1000);
    });
  });

  describe('Malformed Data Handling', () => {
    it('should handle unusual version formats', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '1.0.0-alpha.beta.gamma+build.123',
        latestVersion: '1.0.0-alpha.beta.gamma+build.123',
        versions: [
          '1.0.0-alpha',
          '1.0.0-beta.1',
          '1.0.0-rc.1+build.123',
          '1.0.0-alpha.beta.gamma+build.123'
        ],
      });

      // Mock version comparison for complex versions
      mockCompareVersions.mockReturnValue(0);

      const result = await checkApexCliVersion('1.0.0-alpha.beta', {
        cacheDir: testCacheDir
      });

      expect(result).toBeDefined();
      expect(result!.latestVersion).toBe('1.0.0-alpha.beta.gamma+build.123');
    });

    it('should handle empty version arrays', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '1.0.0',
        latestVersion: '1.0.0',
        versions: [], // Empty versions array
      });

      mockCompareVersions.mockReturnValue(0);

      const result = await checkApexCliVersion('1.0.0', { cacheDir: testCacheDir });

      expect(result).toBeDefined();
      expect(result!.versions).toEqual([]);
      expect(result!.latestVersion).toBe('1.0.0');
    });

    it('should handle missing package name in response', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '', // Empty name
        version: '1.0.0',
        latestVersion: '1.0.0',
        versions: ['1.0.0'],
      });

      mockCompareVersions.mockReturnValue(0);

      const result = await checkApexCliVersion('1.0.0', { cacheDir: testCacheDir });

      expect(result).toBeDefined();
      expect(result!.packageName).toBe('@apexcli/cli'); // Should use requested name
      expect(result!.latestVersion).toBe('1.0.0');
    });
  });

  describe('Advanced Filesystem Error Scenarios', () => {
    it('should handle read-only cache directory', async () => {
      if (process.platform === 'win32') {
        // Skip on Windows as chmod behavior is different
        return;
      }

      // Create cache directory and make it read-only
      mkdirSync(testCacheDir, { recursive: true });
      chmodSync(testCacheDir, 0o444); // Read-only

      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.6.0',
        latestVersion: '0.6.0',
        versions: ['0.6.0'],
      });

      mockCompareVersions.mockReturnValue(0);

      const result = await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      // Should still work without caching
      expect(result).toBeDefined();
      expect(result!.packageName).toBe('@apexcli/cli');

      // Cleanup: restore permissions
      chmodSync(testCacheDir, 0o755);
      rmSync(testCacheDir, { recursive: true, force: true });
    });

    it('should handle cache file with wrong permissions', async () => {
      if (process.platform === 'win32') {
        // Skip on Windows as chmod behavior is different
        return;
      }

      mkdirSync(testCacheDir, { recursive: true });
      const cacheFile = join(testCacheDir, 'npm-versions.json');

      // Create cache file and make it unreadable
      writeFileSync(cacheFile, '{}');
      chmodSync(cacheFile, 0o000); // No permissions

      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.6.0',
        latestVersion: '0.6.0',
        versions: ['0.6.0'],
      });

      mockCompareVersions.mockReturnValue(0);

      const result = await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      // Should work by ignoring corrupted cache
      expect(result).toBeDefined();

      // Cleanup
      chmodSync(cacheFile, 0o644);
      rmSync(testCacheDir, { recursive: true, force: true });
    });
  });

  describe('Network Edge Cases', () => {
    it('should handle partial registry responses', async () => {
      // Simulate partial/incomplete response
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '', // Missing version
        latestVersion: '0.6.0',
        versions: ['0.6.0'],
      });

      mockCompareVersions.mockReturnValue(-1);

      const result = await checkApexCliVersion('0.5.0', { cacheDir: testCacheDir });

      expect(result).toBeDefined();
      expect(result!.latestVersion).toBe('0.6.0');
      expect(result!.hasUpdate).toBe(true);
    });

    it('should handle registry response with undefined values', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: undefined as any,
        latestVersion: undefined as any,
        versions: undefined as any,
      });

      const result = await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      expect(result).toBeDefined();
      expect(result!.latestVersion).toBe('');
      expect(result!.versions).toEqual([]);
    });
  });

  describe('Cache Key Generation Edge Cases', () => {
    it('should handle packages with special characters in names', async () => {
      const specialPackages = [
        '@scope/package-name',
        '@scope/package_name',
        '@scope/package.name',
        'package+plus',
        'package@symbol', // This would be unusual but test anyway
      ];

      mockQueryNpmRegistry.mockImplementation(async (packageName) => ({
        name: packageName,
        version: '1.0.0',
        latestVersion: '1.0.0',
        versions: ['1.0.0'],
      }));

      mockCompareVersions.mockReturnValue(0);

      for (const packageName of specialPackages) {
        const result = await checkPackageVersion(packageName, '1.0.0', {
          cacheDir: testCacheDir
        });
        expect(result).toBeDefined();
        expect(result!.packageName).toBe(packageName);
      }

      // Verify all are cached separately
      const stats = getCacheStats({ cacheDir: testCacheDir });
      expect(stats.totalEntries).toBe(specialPackages.length);
    });

    it('should handle versions with special characters', async () => {
      const specialVersions = [
        '1.0.0-alpha+build.123',
        '1.0.0-beta.1',
        '1.0.0-rc.1+build',
        '2.0.0-pre-release.1',
        '1.0.0+20200101',
      ];

      mockQueryNpmRegistry.mockImplementation(async () => ({
        name: '@apexcli/cli',
        version: '2.0.0',
        latestVersion: '2.0.0',
        versions: ['2.0.0'],
      }));

      mockCompareVersions.mockReturnValue(-1);

      for (const version of specialVersions) {
        const result = await checkApexCliVersion(version, { cacheDir: testCacheDir });
        expect(result).toBeDefined();
        expect(result!.currentVersion).toBe(version);
      }

      // Each version should create separate cache entry
      const stats = getCacheStats({ cacheDir: testCacheDir });
      expect(stats.totalEntries).toBe(specialVersions.length);
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle rapid cache clearing operations', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.6.0',
        latestVersion: '0.6.0',
        versions: ['0.6.0'],
      });

      // Add some entries
      await checkApexCliVersion('0.5.0', { cacheDir: testCacheDir });
      await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      // Rapid clear operations
      clearVersionCache('@apexcli/cli', '0.5.0', { cacheDir: testCacheDir });
      clearVersionCache('@apexcli/cli', undefined, { cacheDir: testCacheDir });
      clearVersionCache(undefined, undefined, { cacheDir: testCacheDir });

      const stats = getCacheStats({ cacheDir: testCacheDir });
      expect(stats.totalEntries).toBe(0);
    });

    it('should handle zero TTL cache correctly', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.6.0',
        latestVersion: '0.6.0',
        versions: ['0.6.0'],
      });

      mockCompareVersions.mockReturnValue(0);

      // First call with zero TTL
      await checkApexCliVersion('0.6.0', {
        cacheTtl: 0,
        cacheDir: testCacheDir
      });

      // Second call should not use cache (TTL = 0)
      await checkApexCliVersion('0.6.0', {
        cacheTtl: 0,
        cacheDir: testCacheDir
      });

      // Should have made 2 network calls
      expect(mockQueryNpmRegistry).toHaveBeenCalledTimes(2);
    });

    it('should handle extremely large TTL values', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.6.0',
        latestVersion: '0.6.0',
        versions: ['0.6.0'],
      });

      mockCompareVersions.mockReturnValue(0);

      const maxTtl = Number.MAX_SAFE_INTEGER;

      const result = await checkApexCliVersion('0.6.0', {
        cacheTtl: maxTtl,
        cacheDir: testCacheDir
      });

      expect(result).toBeDefined();
      expect(result!.cacheTtl).toBe(maxTtl);

      // Second call should use cache
      await checkApexCliVersion('0.6.0', {
        cacheTtl: maxTtl,
        cacheDir: testCacheDir
      });

      expect(mockQueryNpmRegistry).toHaveBeenCalledTimes(1);
    });
  });
});