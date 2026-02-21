import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { existsSync, rmSync } from 'fs';
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

describe('NPM Registry Version Checker - Integration Tests', () => {
  const testCacheDir = join(tmpdir(), '.apex-integration-test-cache');

  beforeAll(() => {
    // Clean up any existing test cache
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup realistic version comparison
    mockCompareVersions.mockImplementation((current: string, latest: string) => {
      // More sophisticated version comparison for integration tests
      const parseVersion = (v: string) => {
        const cleaned = v.replace(/^v/, '');
        const parts = cleaned.split(/[-+]/)[0].split('.').map(Number);
        while (parts.length < 3) parts.push(0);
        return parts;
      };

      const [currentMajor, currentMinor, currentPatch] = parseVersion(current);
      const [latestMajor, latestMinor, latestPatch] = parseVersion(latest);

      if (currentMajor !== latestMajor) return currentMajor < latestMajor ? -1 : 1;
      if (currentMinor !== latestMinor) return currentMinor < latestMinor ? -1 : 1;
      if (currentPatch !== latestPatch) return currentPatch < latestPatch ? -1 : 1;
      return 0;
    });

    // Clear cache before each test
    clearVersionCache(undefined, undefined, { cacheDir: testCacheDir });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Real-world Package Version Scenarios', () => {
    it('should handle typical APEX CLI version check workflow', async () => {
      // Simulate checking an older APEX CLI version against newer registry
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.7.0',
        latestVersion: '0.7.0',
        versions: ['0.1.0', '0.2.0', '0.5.0', '0.5.1', '0.6.0', '0.7.0'],
      });

      const result = await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      expect(result).toBeDefined();
      expect(result!.packageName).toBe('@apexcli/cli');
      expect(result!.currentVersion).toBe('0.6.0');
      expect(result!.latestVersion).toBe('0.7.0');
      expect(result!.hasUpdate).toBe(true);
      expect(result!.isLatest).toBe(false);
      expect(result!.versionComparison).toBe(-1);
      expect(result!.versions).toContain('0.6.0');
      expect(result!.versions).toContain('0.7.0');
      expect(result!.error).toBeUndefined();
    });

    it('should handle beta version scenarios', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.8.0',
        latestVersion: '0.8.0',
        versions: ['0.7.0', '0.8.0-beta.1', '0.8.0-beta.2', '0.8.0-rc.1', '0.8.0'],
      });

      // User running beta version
      const result = await checkApexCliVersion('0.8.0-beta.1', { cacheDir: testCacheDir });

      expect(result).toBeDefined();
      expect(result!.currentVersion).toBe('0.8.0-beta.1');
      expect(result!.latestVersion).toBe('0.8.0');
      expect(result!.hasUpdate).toBe(true);
    });

    it('should handle popular npm package scenarios', async () => {
      // Simulate checking React version
      mockQueryNpmRegistry.mockResolvedValue({
        name: 'react',
        version: '18.2.0',
        latestVersion: '18.2.0',
        versions: [
          '16.0.0', '16.14.0',
          '17.0.0', '17.0.2',
          '18.0.0', '18.1.0', '18.2.0'
        ],
      });

      const result = await checkPackageVersion('react', '17.0.2', { cacheDir: testCacheDir });

      expect(result).toBeDefined();
      expect(result!.packageName).toBe('react');
      expect(result!.hasUpdate).toBe(true);
      expect(result!.latestVersion).toBe('18.2.0');
    });

    it('should handle scoped package scenarios', async () => {
      const scopedPackages = [
        '@types/node',
        '@babel/core',
        '@eslint/config',
        '@company/internal-tool'
      ];

      for (const packageName of scopedPackages) {
        mockQueryNpmRegistry.mockResolvedValue({
          name: packageName,
          version: '1.5.0',
          latestVersion: '1.5.0',
          versions: ['1.0.0', '1.2.0', '1.5.0'],
        });

        const result = await checkPackageVersion(packageName, '1.2.0', {
          cacheDir: testCacheDir
        });

        expect(result).toBeDefined();
        expect(result!.packageName).toBe(packageName);
        expect(result!.hasUpdate).toBe(true);
      }
    });
  });

  describe('End-to-End Caching Workflows', () => {
    it('should demonstrate complete cache lifecycle', async () => {
      const packageName = '@apexcli/cli';
      const currentVersion = '0.6.0';

      mockQueryNpmRegistry.mockResolvedValue({
        name: packageName,
        version: '0.7.0',
        latestVersion: '0.7.0',
        versions: ['0.6.0', '0.7.0'],
      });

      // 1. Initial check - should query registry
      const result1 = await checkApexCliVersion(currentVersion, { cacheDir: testCacheDir });
      expect(mockQueryNpmRegistry).toHaveBeenCalledTimes(1);
      expect(result1!.hasUpdate).toBe(true);

      // 2. Second check - should use cache
      const result2 = await checkApexCliVersion(currentVersion, { cacheDir: testCacheDir });
      expect(mockQueryNpmRegistry).toHaveBeenCalledTimes(1); // Still 1
      expect(result2).toEqual(result1);

      // 3. Check cache stats
      let stats = getCacheStats({ cacheDir: testCacheDir });
      expect(stats.totalEntries).toBe(1);
      expect(stats.validEntries).toBe(1);
      expect(stats.packages).toContain(packageName);

      // 4. Force refresh
      const result3 = await checkApexCliVersion(currentVersion, {
        forceRefresh: true,
        cacheDir: testCacheDir
      });
      expect(mockQueryNpmRegistry).toHaveBeenCalledTimes(2); // Now 2
      expect(result3!.packageName).toBe(packageName);

      // 5. Clear specific entry
      clearVersionCache(packageName, currentVersion, { cacheDir: testCacheDir });
      stats = getCacheStats({ cacheDir: testCacheDir });
      expect(stats.totalEntries).toBe(0);

      // 6. Check again - should query registry
      const result4 = await checkApexCliVersion(currentVersion, { cacheDir: testCacheDir });
      expect(mockQueryNpmRegistry).toHaveBeenCalledTimes(3); // Now 3
      expect(result4!.packageName).toBe(packageName);
    });

    it('should handle mixed package caching scenarios', async () => {
      const packages = [
        { name: '@apexcli/cli', version: '0.6.0' },
        { name: '@apexcli/core', version: '0.6.0' },
        { name: 'react', version: '18.0.0' },
        { name: 'typescript', version: '5.0.0' }
      ];

      // Mock different responses for different packages
      mockQueryNpmRegistry.mockImplementation(async (packageName: string) => {
        const pkg = packages.find(p => p.name === packageName);
        return {
          name: packageName,
          version: pkg ? pkg.version : '1.0.0',
          latestVersion: pkg ? pkg.version : '1.0.0',
          versions: pkg ? [pkg.version] : ['1.0.0'],
        };
      });

      // Check all packages
      const results = await Promise.all(
        packages.map(pkg => checkPackageVersion(pkg.name, pkg.version, { cacheDir: testCacheDir }))
      );

      // Verify all succeeded
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result!.packageName).toBe(packages[index].name);
      });

      // Verify cache stats
      const stats = getCacheStats({ cacheDir: testCacheDir });
      expect(stats.totalEntries).toBe(packages.length);
      expect(stats.validEntries).toBe(packages.length);
      expect(stats.packages).toHaveLength(packages.length);

      // Clear specific package
      clearVersionCache('@apexcli/cli', undefined, { cacheDir: testCacheDir });
      const statsAfterClear = getCacheStats({ cacheDir: testCacheDir });
      expect(statsAfterClear.totalEntries).toBe(packages.length - 1);
      expect(statsAfterClear.packages).not.toContain('@apexcli/cli');
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should handle network failure to recovery workflow', async () => {
      // First attempt: Network error
      mockQueryNpmRegistry.mockResolvedValueOnce({
        name: '@apexcli/cli',
        version: '',
        latestVersion: '',
        versions: [],
        error: 'Network timeout'
      });

      const result1 = await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });
      expect(result1!.error).toBe('Network timeout');
      expect(mockQueryNpmRegistry).toHaveBeenCalledTimes(1);

      // Second attempt: Success (errors are not cached)
      mockQueryNpmRegistry.mockResolvedValueOnce({
        name: '@apexcli/cli',
        version: '0.7.0',
        latestVersion: '0.7.0',
        versions: ['0.6.0', '0.7.0'],
      });

      const result2 = await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });
      expect(result2!.error).toBeUndefined();
      expect(result2!.hasUpdate).toBe(true);
      expect(mockQueryNpmRegistry).toHaveBeenCalledTimes(2);

      // Third attempt: Should use cache now
      const result3 = await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });
      expect(result3).toEqual(result2);
      expect(mockQueryNpmRegistry).toHaveBeenCalledTimes(2); // Still 2
    });

    it('should handle partial failure scenarios', async () => {
      // Mock registry returning partial data
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '', // Missing version info
        latestVersion: '0.7.0',
        versions: ['0.7.0'], // Minimal versions
      });

      const result = await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      // Should still provide useful information
      expect(result).toBeDefined();
      expect(result!.latestVersion).toBe('0.7.0');
      expect(result!.hasUpdate).toBe(true);
      expect(result!.versions).toEqual(['0.7.0']);
    });
  });

  describe('Custom Configuration Workflows', () => {
    it('should handle custom registry scenarios', async () => {
      const customRegistry = 'https://npm.company.com';
      const customTimeout = 15000;

      mockQueryNpmRegistry.mockResolvedValue({
        name: '@company/private-package',
        version: '2.1.0',
        latestVersion: '2.1.0',
        versions: ['2.0.0', '2.1.0'],
      });

      const result = await checkPackageVersion('@company/private-package', '2.0.0', {
        registry: customRegistry,
        timeout: customTimeout,
        cacheDir: testCacheDir
      });

      expect(result).toBeDefined();
      expect(result!.hasUpdate).toBe(true);
      expect(mockQueryNpmRegistry).toHaveBeenCalledWith('@company/private-package', {
        registry: customRegistry,
        timeout: customTimeout
      });
    });

    it('should handle custom cache TTL workflows', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.7.0',
        latestVersion: '0.7.0',
        versions: ['0.7.0'],
      });

      // Short TTL for testing
      const shortTtl = 100;

      const result1 = await checkApexCliVersion('0.6.0', {
        cacheTtl: shortTtl,
        cacheDir: testCacheDir
      });
      expect(result1!.cacheTtl).toBe(shortTtl);

      // Wait for cache expiration
      await new Promise(resolve => setTimeout(resolve, shortTtl + 50));

      const result2 = await checkApexCliVersion('0.6.0', {
        cacheTtl: shortTtl,
        cacheDir: testCacheDir
      });

      // Should have made 2 network calls due to expiration
      expect(mockQueryNpmRegistry).toHaveBeenCalledTimes(2);
    });
  });

  describe('Production-like Scenarios', () => {
    it('should simulate typical CI/CD version checking', async () => {
      // Simulate CI environment checking multiple packages
      const ciPackages = [
        '@apexcli/cli',
        '@apexcli/core',
        '@apexcli/api',
        '@apexcli/orchestrator'
      ];

      mockQueryNpmRegistry.mockImplementation(async (packageName: string) => ({
        name: packageName,
        version: '0.7.0',
        latestVersion: '0.7.0',
        versions: ['0.6.0', '0.6.1', '0.7.0'],
      }));

      // Simulate parallel version checks (common in CI)
      const results = await Promise.all(
        ciPackages.map(pkg => checkPackageVersion(pkg, '0.6.0', {
          timeout: 5000, // Reasonable timeout for CI
          cacheDir: testCacheDir
        }))
      );

      // All should succeed
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result!.packageName).toBe(ciPackages[index]);
        expect(result!.hasUpdate).toBe(true);
      });

      // Verify cache efficiency
      const stats = getCacheStats({ cacheDir: testCacheDir });
      expect(stats.totalEntries).toBe(ciPackages.length);
      expect(stats.validEntries).toBe(ciPackages.length);
    });

    it('should handle development workflow scenarios', async () => {
      // Developer frequently checking for updates
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.8.0',
        latestVersion: '0.8.0',
        versions: ['0.7.0', '0.7.1', '0.8.0-beta.1', '0.8.0'],
      });

      // Initial check
      const check1 = await checkApexCliVersion('0.7.1', { cacheDir: testCacheDir });
      expect(check1!.hasUpdate).toBe(true);

      // Developer updates to beta
      const checkBeta = await checkApexCliVersion('0.8.0-beta.1', { cacheDir: testCacheDir });
      expect(checkBeta!.hasUpdate).toBe(true);
      expect(checkBeta!.currentVersion).toBe('0.8.0-beta.1');

      // Developer updates to stable
      const checkStable = await checkApexCliVersion('0.8.0', { cacheDir: testCacheDir });
      expect(checkStable!.isLatest).toBe(true);
      expect(checkStable!.hasUpdate).toBe(false);

      // Verify separate cache entries for different versions
      const stats = getCacheStats({ cacheDir: testCacheDir });
      expect(stats.totalEntries).toBe(3); // Three different versions
    });
  });
});