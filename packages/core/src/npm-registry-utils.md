# NPM Registry Version Checker Utility

This utility provides cached version checking functionality for npm packages, specifically designed for the @apexcli/cli package but works with any npm package.

## Features

- ✅ **Caching**: 24-hour default cache to avoid excessive network calls
- ✅ **Error Handling**: Graceful handling of network errors and timeouts
- ✅ **Version Comparison**: Returns current vs latest version comparison
- ✅ **Configurable**: Custom cache TTL, timeouts, and registry support
- ✅ **Cache Management**: Clear specific or all cached entries
- ✅ **TypeScript**: Full type safety with comprehensive interfaces

## Quick Start

```typescript
import { checkApexCliVersion } from '@apexcli/core';

// Basic usage
const result = await checkApexCliVersion('0.5.0');
if (result && !result.error) {
  console.log(`Current: ${result.currentVersion}`);
  console.log(`Latest: ${result.latestVersion}`);
  console.log(`Update available: ${result.hasUpdate}`);
}
```

## API Reference

### Functions

#### `checkApexCliVersion(currentVersion, options?)`

Checks @apexcli/cli version against npm registry with caching.

**Parameters:**
- `currentVersion` (string): Current version to compare against
- `options` (VersionCheckOptions): Configuration options

**Returns:** `Promise<CachedVersionInfo | null>`

#### `checkPackageVersion(packageName, currentVersion, options?)`

Generic version checker for any npm package.

**Parameters:**
- `packageName` (string): Name of package to check
- `currentVersion` (string): Current version to compare against
- `options` (VersionCheckOptions): Configuration options

**Returns:** `Promise<CachedVersionInfo | null>`

#### `clearVersionCache(packageName?, currentVersion?, options?)`

Clear version cache entries.

**Parameters:**
- `packageName` (string, optional): Package to clear (if omitted, clears all)
- `currentVersion` (string, optional): Specific version to clear
- `options` (object): Configuration with `cacheDir` option

#### `getCacheStats(options?)`

Get cache statistics.

**Returns:** Object with `totalEntries`, `validEntries`, `expiredEntries`, `packages`

### Types

#### `VersionCheckOptions`

```typescript
interface VersionCheckOptions {
  cacheTtl?: number;        // Cache TTL in ms (default: 24h)
  forceRefresh?: boolean;   // Bypass cache
  registry?: string;        // Custom registry URL
  timeout?: number;         // Request timeout in ms
  cacheDir?: string;        // Custom cache directory
}
```

#### `CachedVersionInfo`

```typescript
interface CachedVersionInfo {
  packageName: string;
  currentVersion: string;
  latestVersion: string;
  versions: string[];
  isLatest: boolean;
  hasUpdate: boolean;
  versionComparison: number; // -1, 0, or 1
  cachedAt: number;
  cacheTtl: number;
  error?: string;
}
```

## Usage Examples

### Basic Version Check

```typescript
import { checkApexCliVersion } from '@apexcli/core';

const result = await checkApexCliVersion('0.6.0');
if (result) {
  if (result.hasUpdate) {
    console.log(`Update available: ${result.currentVersion} → ${result.latestVersion}`);
  } else {
    console.log('You are running the latest version!');
  }
}
```

### Custom Configuration

```typescript
const result = await checkApexCliVersion('0.5.0', {
  cacheTtl: 12 * 60 * 60 * 1000, // 12 hours
  timeout: 10000,                 // 10 second timeout
  forceRefresh: true,            // Bypass cache
});
```

### Generic Package Checking

```typescript
import { checkPackageVersion } from '@apexcli/core';

const reactResult = await checkPackageVersion('react', '18.0.0');
const typesResult = await checkPackageVersion('@types/node', '18.0.0');
```

### Error Handling

```typescript
const result = await checkApexCliVersion('0.6.0');
if (result?.error) {
  switch (result.error) {
    case 'Package not found':
      console.log('Package does not exist');
      break;
    case 'Request timeout':
      console.log('Network timeout - try again later');
      break;
    default:
      console.log(`Error: ${result.error}`);
  }
}
```

### Cache Management

```typescript
import { getCacheStats, clearVersionCache } from '@apexcli/core';

// Check cache statistics
const stats = getCacheStats();
console.log(`Cached packages: ${stats.packages.join(', ')}`);

// Clear specific version
clearVersionCache('@apexcli/cli', '0.5.0');

// Clear all versions of a package
clearVersionCache('@apexcli/cli');

// Clear entire cache
clearVersionCache();
```

## Caching Behavior

- **Default TTL**: 24 hours (86,400,000 milliseconds)
- **Cache Location**: `~/.apex-cache/npm-versions.json` by default
- **Error Caching**: Errors are NOT cached and will be retried
- **Cache Keys**: `packageName@currentVersion` format
- **Automatic Cleanup**: Expired entries are detected but not automatically removed

## Network Configuration

- **Default Timeout**: 5 seconds
- **Default Registry**: https://registry.npmjs.org
- **Custom Registry**: Supports private registries
- **User Agent**: `APEX-doctor/0.6.0`
- **Request Headers**: `Accept: application/json`

## Error Types

- `Package not found`: 404 from registry
- `Request timeout`: Network timeout exceeded
- `Network error`: General network/HTTP errors
- `Fetch API not available`: Runtime doesn't support fetch

## Requirements

- Node.js 18+ (uses built-in fetch) or undici package
- File system access for caching (optional - works without)
- Network access to npm registry

## Performance

- **Cold Start**: ~100-500ms depending on network
- **Cached**: ~1-5ms for cache hits
- **Memory Usage**: Minimal - cache stored on disk
- **Concurrent Safe**: Multiple processes can share cache