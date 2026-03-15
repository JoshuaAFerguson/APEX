/**
 * NPM Registry Version Checker Utility
 *
 * Provides cached version checking functionality for @apexcli/cli package
 * with network error handling and version comparison utilities.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { compareVersions } from './utils';
import { queryNpmRegistry, type NpmPackageInfo } from './doctor-utils';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Cached version information for a package
 */
export interface CachedVersionInfo {
  /** Package name that was checked */
  packageName: string;
  /** Current version (passed in by user) */
  currentVersion: string;
  /** Latest version from registry */
  latestVersion: string;
  /** All available versions */
  versions: string[];
  /** Whether current version is latest */
  isLatest: boolean;
  /** Whether an update is available */
  hasUpdate: boolean;
  /** Version comparison result (-1, 0, 1) */
  versionComparison: number;
  /** Timestamp when cached */
  cachedAt: number;
  /** Cache TTL in milliseconds */
  cacheTtl: number;
  /** Any error that occurred during fetch */
  error?: string;
}

/**
 * Options for version checking
 */
export interface VersionCheckOptions {
  /** Cache TTL in milliseconds (default: 24 hours) */
  cacheTtl?: number;
  /** Force refresh cache (bypass cache) */
  forceRefresh?: boolean;
  /** Custom registry URL */
  registry?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Custom cache directory */
  cacheDir?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Default cache TTL: 24 hours in milliseconds */
const DEFAULT_CACHE_TTL = 24 * 60 * 60 * 1000;

/** Default cache directory */
const DEFAULT_CACHE_DIR = join(tmpdir(), '.apex-cache');

/** Cache file name for version info */
const VERSION_CACHE_FILE = 'npm-versions.json';

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Get cache file path
 */
function getCacheFilePath(cacheDir: string = DEFAULT_CACHE_DIR): string {
  return join(cacheDir, VERSION_CACHE_FILE);
}

/**
 * Ensure cache directory exists
 */
function ensureCacheDir(cacheDir: string = DEFAULT_CACHE_DIR): void {
  if (!existsSync(cacheDir)) {
    try {
      mkdirSync(cacheDir, { recursive: true });
    } catch (error) {
      // Silently fail if we can't create cache directory
      // Version checking will work without cache
    }
  }
}

/**
 * Load cached version information
 */
function loadCache(cacheDir: string = DEFAULT_CACHE_DIR): Record<string, CachedVersionInfo> {
  const cacheFile = getCacheFilePath(cacheDir);

  try {
    if (existsSync(cacheFile)) {
      const content = readFileSync(cacheFile, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    // Return empty cache if we can't read file
  }

  return {};
}

/**
 * Save cached version information
 */
function saveCache(cache: Record<string, CachedVersionInfo>, cacheDir: string = DEFAULT_CACHE_DIR): void {
  const cacheFile = getCacheFilePath(cacheDir);

  try {
    ensureCacheDir(cacheDir);
    writeFileSync(cacheFile, JSON.stringify(cache, null, 2), 'utf8');
  } catch (error) {
    // Silently fail if we can't write cache
    // Version checking will work without cache
  }
}

/**
 * Check if cached data is still valid
 */
function isCacheValid(cachedInfo: CachedVersionInfo): boolean {
  const now = Date.now();
  return (now - cachedInfo.cachedAt) < cachedInfo.cacheTtl;
}

/**
 * Generate cache key for a package version check
 */
function getCacheKey(packageName: string, currentVersion: string): string {
  return `${packageName}@${currentVersion}`;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Check @apexcli/cli version against npm registry with caching
 *
 * This is the main utility function that:
 * - Queries npm registry for latest @apexcli/cli version
 * - Implements 24h caching to avoid excessive network calls
 * - Handles network errors gracefully with timeouts
 * - Returns current vs latest version comparison
 *
 * @param currentVersion - Current version to compare against
 * @param options - Configuration options
 * @returns Version comparison information or null if failed
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await checkApexCliVersion('0.5.0');
 * if (result) {
 *   console.log(`Current: ${result.currentVersion}`);
 *   console.log(`Latest: ${result.latestVersion}`);
 *   console.log(`Update available: ${result.hasUpdate}`);
 * }
 *
 * // With custom options
 * const result = await checkApexCliVersion('0.5.0', {
 *   cacheTtl: 12 * 60 * 60 * 1000, // 12 hours
 *   forceRefresh: true,
 *   timeout: 10000
 * });
 * ```
 */
export async function checkApexCliVersion(
  currentVersion: string,
  options: VersionCheckOptions = {}
): Promise<CachedVersionInfo | null> {
  const packageName = '@apexcli/cli';
  return checkPackageVersion(packageName, currentVersion, options);
}

/**
 * Check any package version against npm registry with caching
 *
 * Generic version of checkApexCliVersion that works with any npm package.
 * Provides the same caching and error handling capabilities.
 *
 * @param packageName - Name of package to check
 * @param currentVersion - Current version to compare against
 * @param options - Configuration options
 * @returns Version comparison information or null if failed
 *
 * @example
 * ```typescript
 * const result = await checkPackageVersion('@apexcli/core', '0.6.0');
 * if (result && result.hasUpdate) {
 *   console.log(`Update available: ${result.currentVersion} → ${result.latestVersion}`);
 * }
 * ```
 */
export async function checkPackageVersion(
  packageName: string,
  currentVersion: string,
  options: VersionCheckOptions = {}
): Promise<CachedVersionInfo | null> {
  const {
    cacheTtl = DEFAULT_CACHE_TTL,
    forceRefresh = false,
    registry,
    timeout,
    cacheDir = DEFAULT_CACHE_DIR
  } = options;

  const cacheKey = getCacheKey(packageName, currentVersion);

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cache = loadCache(cacheDir);
    const cachedInfo = cache[cacheKey];

    if (cachedInfo && isCacheValid(cachedInfo)) {
      return cachedInfo;
    }
  }

  // Query npm registry
  try {
    const npmInfo = await queryNpmRegistry(packageName, { registry, timeout });

    if (!npmInfo) {
      return null;
    }

    // Handle npm registry errors
    if (npmInfo.error) {
      const errorInfo: CachedVersionInfo = {
        packageName,
        currentVersion,
        latestVersion: '',
        versions: [],
        isLatest: false,
        hasUpdate: false,
        versionComparison: 0,
        cachedAt: Date.now(),
        cacheTtl,
        error: npmInfo.error
      };

      // Don't cache error results - they should be retried
      return errorInfo;
    }

    // Calculate version comparison
    const versionComparison = compareVersions(currentVersion, npmInfo.latestVersion);
    const isLatest = versionComparison >= 0;
    const hasUpdate = versionComparison < 0;

    const versionInfo: CachedVersionInfo = {
      packageName,
      currentVersion,
      latestVersion: npmInfo.latestVersion,
      versions: npmInfo.versions,
      isLatest,
      hasUpdate,
      versionComparison,
      cachedAt: Date.now(),
      cacheTtl
    };

    // Cache successful results
    const cache = loadCache(cacheDir);
    cache[cacheKey] = versionInfo;
    saveCache(cache, cacheDir);

    return versionInfo;

  } catch (error) {
    // Return error information without caching
    return {
      packageName,
      currentVersion,
      latestVersion: '',
      versions: [],
      isLatest: false,
      hasUpdate: false,
      versionComparison: 0,
      cachedAt: Date.now(),
      cacheTtl,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Clear version cache for specific package or all packages
 *
 * @param packageName - Package name to clear (if omitted, clears all)
 * @param currentVersion - Specific version to clear (if omitted with packageName, clears all versions of package)
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * // Clear specific package version
 * clearVersionCache('@apexcli/cli', '0.5.0');
 *
 * // Clear all versions of a package
 * clearVersionCache('@apexcli/cli');
 *
 * // Clear entire cache
 * clearVersionCache();
 * ```
 */
export function clearVersionCache(
  packageName?: string,
  currentVersion?: string,
  options: { cacheDir?: string } = {}
): void {
  const { cacheDir = DEFAULT_CACHE_DIR } = options;

  const cache = loadCache(cacheDir);

  if (!packageName) {
    // Clear entire cache
    saveCache({}, cacheDir);
    return;
  }

  if (currentVersion) {
    // Clear specific package@version
    const cacheKey = getCacheKey(packageName, currentVersion);
    delete cache[cacheKey];
  } else {
    // Clear all versions of package
    Object.keys(cache).forEach(key => {
      if (key.startsWith(packageName + '@')) {
        delete cache[key];
      }
    });
  }

  saveCache(cache, cacheDir);
}

/**
 * Get cache statistics
 *
 * @param options - Configuration options
 * @returns Cache statistics
 *
 * @example
 * ```typescript
 * const stats = getCacheStats();
 * console.log(`Cached entries: ${stats.totalEntries}`);
 * console.log(`Valid entries: ${stats.validEntries}`);
 * ```
 */
export function getCacheStats(options: { cacheDir?: string } = {}): {
  totalEntries: number;
  validEntries: number;
  expiredEntries: number;
  packages: string[];
} {
  const { cacheDir = DEFAULT_CACHE_DIR } = options;
  const cache = loadCache(cacheDir);

  const totalEntries = Object.keys(cache).length;
  let validEntries = 0;
  let expiredEntries = 0;
  const packages = new Set<string>();

  Object.values(cache).forEach(entry => {
    packages.add(entry.packageName);
    if (isCacheValid(entry)) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  });

  return {
    totalEntries,
    validEntries,
    expiredEntries,
    packages: Array.from(packages)
  };
}