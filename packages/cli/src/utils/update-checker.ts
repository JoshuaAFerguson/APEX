import chalk from 'chalk';
import boxen from 'boxen';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { getLatestPackageVersion, compareVersionStrings } from '@apexcli/core';

/**
 * Information about available updates
 */
export interface UpdateInfo {
  /** Current version of APEX */
  currentVersion: string;
  /** Latest version available on npm */
  latestVersion: string;
  /** Whether an update is available */
  hasUpdate: boolean;
  /** Type of update (major, minor, patch) */
  updateType: 'major' | 'minor' | 'patch' | 'none';
}

/**
 * Cache for update check results to avoid excessive API calls
 */
interface UpdateCache {
  /** Timestamp when the check was performed */
  timestamp: number;
  /** Update information from the last check */
  updateInfo: UpdateInfo;
}

/**
 * Get the current APEX version from package.json
 */
export function getCurrentVersion(): string {
  try {
    // Try to find and read package.json from CLI package
    const packageJsonPath = path.join(__dirname, '../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version || '0.6.0';
  } catch {
    // Fallback for development environment or if package.json can't be read
    return '0.6.0';
  }
}

/**
 * Determine the type of version update
 */
function getUpdateType(current: string, latest: string): 'major' | 'minor' | 'patch' | 'none' {
  if (compareVersionStrings(current, latest) >= 0) {
    return 'none';
  }

  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);

  if (latestParts[0] > currentParts[0]) {
    return 'major';
  }
  if (latestParts[1] > currentParts[1]) {
    return 'minor';
  }
  return 'patch';
}

/**
 * Get the cache file path for storing update check results
 */
function getCacheFilePath(): string {
  // Store in user's home directory or temp directory
  const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
  return path.join(homeDir, '.apex-update-cache.json');
}

/**
 * Load cached update information
 */
async function loadUpdateCache(): Promise<UpdateCache | null> {
  try {
    const cacheFile = getCacheFilePath();
    const cacheContent = await fsPromises.readFile(cacheFile, 'utf-8');
    const cache = JSON.parse(cacheContent) as UpdateCache;

    // Cache is valid for 6 hours (6 * 60 * 60 * 1000 = 21600000 ms)
    const cacheAgeMs = Date.now() - cache.timestamp;
    const maxCacheAge = 6 * 60 * 60 * 1000;

    if (cacheAgeMs < maxCacheAge) {
      return cache;
    }
  } catch (error) {
    // Cache file doesn't exist or is invalid - will check fresh
  }

  return null;
}

/**
 * Save update information to cache
 */
async function saveUpdateCache(updateInfo: UpdateInfo): Promise<void> {
  try {
    const cache: UpdateCache = {
      timestamp: Date.now(),
      updateInfo,
    };

    const cacheFile = getCacheFilePath();
    await fsPromises.writeFile(cacheFile, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    // Silently fail - caching is not critical
  }
}

/**
 * Check if a newer version of APEX is available
 */
export async function checkForUpdates(options: {
  /** Force check even if cached result is available */
  force?: boolean;
  /** Timeout for npm registry query in milliseconds */
  timeout?: number;
} = {}): Promise<UpdateInfo | null> {
  const { force = false, timeout = 5000 } = options;

  const currentVersion = getCurrentVersion();

  // Try to load from cache unless forced
  if (!force) {
    const cachedInfo = await loadUpdateCache();
    if (cachedInfo) {
      return cachedInfo.updateInfo;
    }
  }

  try {
    // Query npm registry for latest version
    const latestVersion = await getLatestPackageVersion('apex-cli', { timeout });

    if (!latestVersion) {
      return null;
    }

    const hasUpdate = compareVersionStrings(currentVersion, latestVersion) < 0;
    const updateType = getUpdateType(currentVersion, latestVersion);

    const updateInfo: UpdateInfo = {
      currentVersion,
      latestVersion,
      hasUpdate,
      updateType,
    };

    // Cache the result
    await saveUpdateCache(updateInfo);

    return updateInfo;
  } catch (error) {
    // Return null on error - update checking is non-critical
    return null;
  }
}

/**
 * Display an update notification if an update is available
 */
export function displayUpdateNotification(updateInfo: UpdateInfo): void {
  if (!updateInfo.hasUpdate) {
    return;
  }

  const updateTypeColor = updateInfo.updateType === 'major' ? 'red' :
                         updateInfo.updateType === 'minor' ? 'yellow' : 'green';

  const updateTypeEmoji = updateInfo.updateType === 'major' ? '🚨' :
                         updateInfo.updateType === 'minor' ? '⚡' : '🔧';

  const message =
    `${updateTypeEmoji} ${chalk.blue('Update Available')}\n\n` +
    `A newer version of APEX is available!\n` +
    `Current: ${chalk.yellow(updateInfo.currentVersion)}\n` +
    `Latest: ${chalk.green(updateInfo.latestVersion)} ${chalk[updateTypeColor](`(${updateInfo.updateType})`)}\n\n` +
    `${chalk.dim('Run')} ${chalk.cyan('npm install -g apex-cli')} ${chalk.dim('to update')}\n` +
    `${chalk.dim('or')} ${chalk.cyan('apex update')} ${chalk.dim('for more options')}`;

  console.log(boxen(message, {
    padding: 1,
    margin: { top: 0, bottom: 1, left: 0, right: 0 },
    borderStyle: 'round',
    borderColor: updateTypeColor,
    backgroundColor: updateInfo.updateType === 'major' ? 'bgRed' : undefined,
  }));
}

/**
 * Check for updates and display notification if appropriate
 * This is designed to be called during CLI startup
 */
export async function checkAndNotifyUpdates(options: {
  /** Whether to show update notifications */
  silent?: boolean;
  /** Force check even if cached result is available */
  force?: boolean;
} = {}): Promise<void> {
  const { silent = false, force = false } = options;

  if (silent) {
    return;
  }

  try {
    const updateInfo = await checkForUpdates({ force, timeout: 3000 });

    if (updateInfo?.hasUpdate) {
      displayUpdateNotification(updateInfo);
    }
  } catch (error) {
    // Silently fail - update checking is non-critical for CLI operation
  }
}