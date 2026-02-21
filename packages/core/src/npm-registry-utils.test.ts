import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { existsSync, unlinkSync, mkdirSync, rmSync } from 'fs';
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

describe('NPM Registry Version Checker Utility', () => {
  const testCacheDir = join(tmpdir(), '.apex-test-cache');

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

  describe('checkApexCliVersion', () => {
    it('should successfully check @apexcli/cli version', async () => {
      // Mock successful npm registry response
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.6.0',
        latestVersion: '0.6.0',
        versions: ['0.5.0', '0.5.1', '0.6.0'],
      });

      mockCompareVersions.mockReturnValue(0); // Same version

      const result = await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      expect(result).toBeDefined();
      expect(result!.packageName).toBe('@apexcli/cli');
      expect(result!.currentVersion).toBe('0.6.0');
      expect(result!.latestVersion).toBe('0.6.0');
      expect(result!.isLatest).toBe(true);
      expect(result!.hasUpdate).toBe(false);
      expect(result!.versionComparison).toBe(0);
      expect(result!.error).toBeUndefined();

      expect(mockQueryNpmRegistry).toHaveBeenCalledWith('@apexcli/cli', {
        registry: undefined,
        timeout: undefined,
      });
    });

    it('should detect when update is available', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.7.0',
        latestVersion: '0.7.0',
        versions: ['0.5.0', '0.6.0', '0.7.0'],
      });

      mockCompareVersions.mockReturnValue(-1); // Current is older

      const result = await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      expect(result).toBeDefined();
      expect(result!.currentVersion).toBe('0.6.0');
      expect(result!.latestVersion).toBe('0.7.0');
      expect(result!.isLatest).toBe(false);
      expect(result!.hasUpdate).toBe(true);
      expect(result!.versionComparison).toBe(-1);
    });

    it('should detect when current version is newer than latest', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.6.0',
        latestVersion: '0.6.0',
        versions: ['0.5.0', '0.6.0'],
      });

      mockCompareVersions.mockReturnValue(1); // Current is newer

      const result = await checkApexCliVersion('0.7.0-beta', { cacheDir: testCacheDir });

      expect(result).toBeDefined();
      expect(result!.currentVersion).toBe('0.7.0-beta');
      expect(result!.latestVersion).toBe('0.6.0');
      expect(result!.isLatest).toBe(true);
      expect(result!.hasUpdate).toBe(false);
      expect(result!.versionComparison).toBe(1);
    });
  });

  describe('checkPackageVersion (generic)', () => {
    it('should work with any npm package', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: 'react',
        version: '18.2.0',
        latestVersion: '18.2.0',
        versions: ['16.0.0', '17.0.0', '18.0.0', '18.2.0'],
      });

      mockCompareVersions.mockReturnValue(-1);

      const result = await checkPackageVersion('react', '18.0.0', { cacheDir: testCacheDir });

      expect(result).toBeDefined();
      expect(result!.packageName).toBe('react');
      expect(result!.currentVersion).toBe('18.0.0');
      expect(result!.latestVersion).toBe('18.2.0');
      expect(result!.hasUpdate).toBe(true);

      expect(mockQueryNpmRegistry).toHaveBeenCalledWith('react', {
        registry: undefined,
        timeout: undefined,
      });
    });

    it('should pass custom registry and timeout options', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@company/private-pkg',
        version: '1.0.0',
        latestVersion: '1.0.0',
        versions: ['1.0.0'],
      });

      const options: VersionCheckOptions = {
        registry: 'https://npm.company.com',
        timeout: 10000,
        cacheDir: testCacheDir,
      };

      await checkPackageVersion('@company/private-pkg', '1.0.0', options);

      expect(mockQueryNpmRegistry).toHaveBeenCalledWith('@company/private-pkg', {
        registry: 'https://npm.company.com',
        timeout: 10000,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle npm registry errors gracefully', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '',
        latestVersion: '',
        versions: [],
        error: 'Package not found',
      });

      const result = await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      expect(result).toBeDefined();
      expect(result!.error).toBe('Package not found');
      expect(result!.latestVersion).toBe('');
      expect(result!.hasUpdate).toBe(false);
      expect(result!.isLatest).toBe(false);
    });

    it('should handle network timeouts', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '',
        latestVersion: '',
        versions: [],
        error: 'Request timeout',
      });

      const result = await checkApexCliVersion('0.6.0', {
        timeout: 1000,
        cacheDir: testCacheDir,
      });

      expect(result).toBeDefined();
      expect(result!.error).toBe('Request timeout');
    });

    it('should handle null response from queryNpmRegistry', async () => {
      mockQueryNpmRegistry.mockResolvedValue(null);

      const result = await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      expect(result).toBeNull();
    });

    it('should handle thrown errors', async () => {
      mockQueryNpmRegistry.mockRejectedValue(new Error('Network error'));

      const result = await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      expect(result).toBeDefined();
      expect(result!.error).toBe('Network error');
      expect(result!.latestVersion).toBe('');
    });

    it('should handle unknown errors', async () => {
      mockQueryNpmRegistry.mockRejectedValue('Unknown error');

      const result = await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      expect(result).toBeDefined();
      expect(result!.error).toBe('Unknown error occurred');
    });
  });

  describe('Caching Functionality', () => {
    it('should cache successful results', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.6.0',
        latestVersion: '0.6.0',
        versions: ['0.6.0'],
      });

      mockCompareVersions.mockReturnValue(0);

      // First call should query npm
      const result1 = await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });
      expect(mockQueryNpmRegistry).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });
      expect(mockQueryNpmRegistry).toHaveBeenCalledTimes(1); // Still 1

      expect(result1).toEqual(result2);
    });

    it('should respect custom cache TTL', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.6.0',
        latestVersion: '0.6.0',
        versions: ['0.6.0'],
      });

      mockCompareVersions.mockReturnValue(0);

      const shortTtl = 100; // 100ms
      await checkApexCliVersion('0.6.0', {
        cacheTtl: shortTtl,
        cacheDir: testCacheDir,
      });

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, shortTtl + 10));

      // Should query npm again
      await checkApexCliVersion('0.6.0', {
        cacheTtl: shortTtl,
        cacheDir: testCacheDir,
      });

      expect(mockQueryNpmRegistry).toHaveBeenCalledTimes(2);
    });

    it('should force refresh when requested', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.6.0',
        latestVersion: '0.6.0',
        versions: ['0.6.0'],
      });

      // First call
      await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      // Force refresh should bypass cache
      await checkApexCliVersion('0.6.0', {
        forceRefresh: true,
        cacheDir: testCacheDir,
      });

      expect(mockQueryNpmRegistry).toHaveBeenCalledTimes(2);
    });

    it('should not cache error results', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '',
        latestVersion: '',
        versions: [],
        error: 'Network error',
      });

      // First call with error
      await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      // Second call should try again (not cached)
      await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      expect(mockQueryNpmRegistry).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Management', () => {
    beforeEach(() => {
      // Ensure clean test environment
      clearVersionCache(undefined, undefined, { cacheDir: testCacheDir });
    });

    it('should clear specific package version from cache', async () => {
      // Add some cached data
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.6.0',
        latestVersion: '0.6.0',
        versions: ['0.6.0'],
      });

      await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      // Clear specific version
      clearVersionCache('@apexcli/cli', '0.6.0', { cacheDir: testCacheDir });

      // Should query npm again
      await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      expect(mockQueryNpmRegistry).toHaveBeenCalledTimes(2);
    });

    it('should clear all versions of a package', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.6.0',
        latestVersion: '0.6.0',
        versions: ['0.6.0'],
      });

      // Cache multiple versions
      await checkApexCliVersion('0.5.0', { cacheDir: testCacheDir });
      await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      // Clear all versions of package
      clearVersionCache('@apexcli/cli', undefined, { cacheDir: testCacheDir });

      // Both should query npm again
      await checkApexCliVersion('0.5.0', { cacheDir: testCacheDir });
      await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      expect(mockQueryNpmRegistry).toHaveBeenCalledTimes(4);
    });

    it('should clear entire cache', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: 'test-pkg',
        version: '1.0.0',
        latestVersion: '1.0.0',
        versions: ['1.0.0'],
      });

      // Cache some data
      await checkPackageVersion('pkg1', '1.0.0', { cacheDir: testCacheDir });
      await checkPackageVersion('pkg2', '1.0.0', { cacheDir: testCacheDir });

      clearVersionCache(undefined, undefined, { cacheDir: testCacheDir });

      // Should query npm again for both
      await checkPackageVersion('pkg1', '1.0.0', { cacheDir: testCacheDir });
      await checkPackageVersion('pkg2', '1.0.0', { cacheDir: testCacheDir });

      expect(mockQueryNpmRegistry).toHaveBeenCalledTimes(4);
    });
  });

  describe('Cache Statistics', () => {
    beforeEach(() => {
      clearVersionCache(undefined, undefined, { cacheDir: testCacheDir });
    });

    it('should return correct cache stats for empty cache', () => {
      const stats = getCacheStats({ cacheDir: testCacheDir });

      expect(stats.totalEntries).toBe(0);
      expect(stats.validEntries).toBe(0);
      expect(stats.expiredEntries).toBe(0);
      expect(stats.packages).toEqual([]);
    });

    it('should return correct cache stats with data', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.6.0',
        latestVersion: '0.6.0',
        versions: ['0.6.0'],
      });

      // Add some cached entries
      await checkApexCliVersion('0.5.0', { cacheDir: testCacheDir });
      await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });
      await checkPackageVersion('react', '18.0.0', { cacheDir: testCacheDir });

      const stats = getCacheStats({ cacheDir: testCacheDir });

      expect(stats.totalEntries).toBe(3);
      expect(stats.validEntries).toBe(3);
      expect(stats.expiredEntries).toBe(0);
      expect(stats.packages).toContain('@apexcli/cli');
      expect(stats.packages).toContain('react');
      expect(stats.packages.length).toBe(2);
    });

    it('should detect expired entries', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.6.0',
        latestVersion: '0.6.0',
        versions: ['0.6.0'],
      });

      // Add entry with very short TTL
      await checkApexCliVersion('0.6.0', {
        cacheTtl: 50,
        cacheDir: testCacheDir,
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60));

      const stats = getCacheStats({ cacheDir: testCacheDir });

      expect(stats.totalEntries).toBe(1);
      expect(stats.validEntries).toBe(0);
      expect(stats.expiredEntries).toBe(1);
    });
  });

  describe('File System Error Handling', () => {
    it('should work gracefully when cache directory cannot be created', async () => {
      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.6.0',
        latestVersion: '0.6.0',
        versions: ['0.6.0'],
      });

      // Use an invalid cache directory
      const invalidCacheDir = '/invalid/cache/path';

      const result = await checkApexCliVersion('0.6.0', {
        cacheDir: invalidCacheDir,
      });

      // Should still work without caching
      expect(result).toBeDefined();
      expect(result!.packageName).toBe('@apexcli/cli');
    });

    it('should work when cache file is corrupted', async () => {
      // Create corrupted cache file
      if (!existsSync(testCacheDir)) {
        mkdirSync(testCacheDir, { recursive: true });
      }

      const cacheFile = join(testCacheDir, 'npm-versions.json');
      require('fs').writeFileSync(cacheFile, 'invalid json');

      mockQueryNpmRegistry.mockResolvedValue({
        name: '@apexcli/cli',
        version: '0.6.0',
        latestVersion: '0.6.0',
        versions: ['0.6.0'],
      });

      const result = await checkApexCliVersion('0.6.0', { cacheDir: testCacheDir });

      // Should still work and create new cache
      expect(result).toBeDefined();
      expect(result!.packageName).toBe('@apexcli/cli');
    });
  });
});