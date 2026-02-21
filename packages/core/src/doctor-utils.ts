import { z } from 'zod';
import { compareVersions, parseSemver } from './utils';
import type { DoctorCheckResult, HealthReport, CheckStatus } from './types';

// Use Node.js built-in fetch if available (Node 18+), otherwise use undici
const fetchImpl = (() => {
  try {
    // Try to use Node.js built-in fetch (available in Node 18+)
    return globalThis.fetch;
  } catch {
    try {
      // Fallback to undici for older Node versions
      const { fetch } = require('undici');
      return fetch;
    } catch {
      // If undici is not available, return null (will be handled in queryNpmRegistry)
      return null;
    }
  }
})();

// ============================================================================
// Version Comparison Utilities
// ============================================================================

/**
 * Check if a version satisfies a minimum version requirement
 * Leverages existing semver utilities for robust version comparison
 *
 * @param current - Current version string (e.g., "18.17.0", "v2.1.0")
 * @param required - Required minimum version (e.g., "16.0.0")
 * @returns true if current >= required, false otherwise
 *
 * @example
 * ```typescript
 * console.log(satisfiesVersion('18.17.0', '16.0.0')); // true
 * console.log(satisfiesVersion('14.15.0', '16.0.0')); // false
 * console.log(satisfiesVersion('v2.1.0', '2.0.0')); // true (handles v prefix)
 * console.log(satisfiesVersion('invalid', '1.0.0')); // false (graceful handling)
 * ```
 */
export function satisfiesVersion(current: string, required: string): boolean {
  if (!current || !required) {
    return false;
  }

  const comparison = compareVersions(current, required);
  return comparison >= 0; // current >= required
}

/**
 * Compare two version strings using semantic versioning rules
 * This is a thin wrapper around the existing compareVersions utility
 * for consistency with the doctor-utils API
 *
 * @param a - First version string
 * @param b - Second version string
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 *
 * @example
 * ```typescript
 * console.log(compareVersionStrings('1.0.0', '1.0.1')); // -1
 * console.log(compareVersionStrings('2.0.0', '1.9.9')); // 1
 * console.log(compareVersionStrings('1.0.0', '1.0.0')); // 0
 * console.log(compareVersionStrings('v1.2.3', '1.2.3')); // 0 (handles prefixes)
 * ```
 */
export function compareVersionStrings(a: string, b: string): -1 | 0 | 1 {
  return compareVersions(a, b);
}

/**
 * Parse version from command output (e.g., "v18.17.0" -> "18.17.0")
 * Handles common version output formats from CLI tools
 *
 * @param output - Raw output from version command
 * @returns Clean version string, or null if no valid version found
 *
 * @example
 * ```typescript
 * console.log(parseVersionOutput('v18.17.0')); // "18.17.0"
 * console.log(parseVersionOutput('npm version 8.19.2')); // "8.19.2"
 * console.log(parseVersionOutput('git version 2.34.1')); // "2.34.1"
 * console.log(parseVersionOutput('Node.js v16.14.0')); // "16.14.0"
 * console.log(parseVersionOutput('invalid output')); // null
 * ```
 */
export function parseVersionOutput(output: string): string | null {
  if (!output || typeof output !== 'string') {
    return null;
  }

  // Common patterns for version output
  const patterns = [
    // v18.17.0 or v1.2.3-beta.1
    /v?(\d+\.\d+\.\d+(?:[-+][\w.-]*)?)/i,
    // "version 8.19.2" or "Version: 1.2.3"
    /version\s+v?(\d+\.\d+\.\d+(?:[-+][\w.-]*)?)/i,
    // "Node.js v16.14.0" or "npm 8.19.2"
    /(?:node\.?js|npm|git|python|java)\s+v?(\d+\.\d+\.\d+(?:[-+][\w.-]*)?)/i,
  ];

  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match && match[1]) {
      const version = match[1];
      // Validate it's a proper semver by attempting to parse
      if (parseSemver(version)) {
        return version;
      }
    }
  }

  return null;
}

// ============================================================================
// NPM Registry Query Utilities
// ============================================================================

/**
 * Result of an npm registry package query
 * Contains package metadata and version information
 */
export interface NpmPackageInfo {
  /** Package name */
  name: string;
  /** Current/requested version */
  version: string;
  /** Latest version available on registry */
  latestVersion: string;
  /** All available versions */
  versions: string[];
  /** Deprecation warning if package is deprecated */
  deprecated?: string;
  /** Package homepage URL */
  homepage?: string;
  /** Repository URL */
  repository?: string;
  /** Error message if query failed */
  error?: string;
}

/**
 * Query npm registry for package information
 * Includes timeout and error handling for robust operation
 *
 * @param packageName - Name of the package to query (e.g., '@apexcli/core')
 * @param options - Query configuration options
 * @returns Package information or null if query failed
 *
 * @example
 * ```typescript
 * const info = await queryNpmRegistry('@apexcli/core');
 * if (info) {
 *   console.log(`Latest version: ${info.latestVersion}`);
 * }
 *
 * const privateInfo = await queryNpmRegistry('@company/private-pkg', {
 *   registry: 'https://npm.company.com',
 *   timeout: 10000
 * });
 * ```
 */
export async function queryNpmRegistry(
  packageName: string,
  options: {
    /** NPM registry URL (defaults to public registry) */
    registry?: string;
    /** Request timeout in milliseconds */
    timeout?: number;
  } = {}
): Promise<NpmPackageInfo | null> {
  const { registry = 'https://registry.npmjs.org', timeout = 5000 } = options;

  if (!packageName) {
    return null;
  }

  try {
    // Check if fetch is available
    if (!fetchImpl) {
      return {
        name: packageName,
        version: '',
        latestVersion: '',
        versions: [],
        error: 'Fetch API not available',
      };
    }

    // Encode package name for URL (handles scoped packages like @scope/name)
    const encodedName = packageName.replace('/', '%2F');
    const url = `${registry}/${encodedName}`;

    // Use AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetchImpl(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'APEX-doctor/0.6.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return {
          name: packageName,
          version: '',
          latestVersion: '',
          versions: [],
          error: 'Package not found',
        };
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      name: data.name || packageName,
      version: data.version || '',
      latestVersion: data['dist-tags']?.latest || '',
      versions: Object.keys(data.versions || {}),
      deprecated: data.deprecated,
      homepage: data.homepage,
      repository: typeof data.repository === 'string' ? data.repository : data.repository?.url,
    };

  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          name: packageName,
          version: '',
          latestVersion: '',
          versions: [],
          error: 'Request timeout',
        };
      }
      return {
        name: packageName,
        version: '',
        latestVersion: '',
        versions: [],
        error: error.message,
      };
    }

    return null;
  }
}

/**
 * Check if a package version is available on npm
 * Useful for validating specific version requirements
 *
 * @param packageName - Name of the package
 * @param version - Version to check for
 * @param options - Query options
 * @returns true if version exists, false otherwise
 *
 * @example
 * ```typescript
 * const available = await isPackageVersionAvailable('react', '18.2.0');
 * console.log(available); // true (assuming version exists)
 *
 * const beta = await isPackageVersionAvailable('react', '18.3.0-beta.1');
 * ```
 */
export async function isPackageVersionAvailable(
  packageName: string,
  version: string,
  options: { registry?: string; timeout?: number } = {}
): Promise<boolean> {
  const info = await queryNpmRegistry(packageName, options);

  if (!info || info.error) {
    return false;
  }

  return info.versions.includes(version);
}

/**
 * Get the latest version of a package from npm
 * Simple utility for version checking and update notifications
 *
 * @param packageName - Name of the package
 * @param options - Query options
 * @returns Latest version string or null if query failed
 *
 * @example
 * ```typescript
 * const latest = await getLatestPackageVersion('@apexcli/core');
 * if (latest) {
 *   console.log(`Latest APEX version: ${latest}`);
 * }
 * ```
 */
export async function getLatestPackageVersion(
  packageName: string,
  options: { registry?: string; timeout?: number } = {}
): Promise<string | null> {
  const info = await queryNpmRegistry(packageName, options);
  return info?.latestVersion || null;
}

// ============================================================================
// Health Check Factory Functions
// ============================================================================

/**
 * Create a DoctorCheckResult with default values
 * Provides sensible defaults for common fields while requiring essential ones
 *
 * @param partial - Partial check result with required fields
 * @returns Complete DoctorCheckResult object
 *
 * @example
 * ```typescript
 * const result = createDoctorCheckResult({
 *   id: 'node-version',
 *   name: 'Node.js Version Check',
 *   category: 'toolchain',
 *   status: 'pass',
 *   message: 'Node.js version is compatible'
 * });
 * // Automatically includes timestamp, duration, severity, description
 * ```
 */
export function createDoctorCheckResult(
  partial: Partial<DoctorCheckResult> & Pick<DoctorCheckResult, 'id' | 'name' | 'category'>
): DoctorCheckResult {
  const now = new Date();

  return {
    description: `Health check for ${partial.name}`,
    status: 'unknown' as CheckStatus,
    severity: 'info',
    message: 'Check completed',
    timestamp: now,
    durationMs: 0,
    ...partial, // Override defaults with provided values
  };
}

/**
 * Create a HealthReport from check results
 * Automatically calculates summary statistics and system information
 *
 * @param checks - Array of individual check results
 * @param options - Report generation options
 * @returns Complete HealthReport object
 *
 * @example
 * ```typescript
 * const checks = [check1, check2, check3];
 * const report = createHealthReport(checks, { apexVersion: '0.6.0' });
 * console.log(report.summary); // { total: 3, passed: 2, failed: 1, ... }
 * ```
 */
export function createHealthReport(
  checks: DoctorCheckResult[],
  options: { apexVersion?: string } = {}
): HealthReport {
  const { apexVersion = '0.6.0' } = options;
  const now = new Date();

  // Calculate summary statistics
  const summary = {
    total: checks.length,
    passed: checks.filter(c => c.status === 'pass').length,
    failed: checks.filter(c => c.status === 'fail').length,
    warnings: checks.filter(c => c.severity === 'warning' && c.status !== 'pass').length,
    skipped: checks.filter(c => c.status === 'skip').length,
  };

  // Determine overall status
  let overallStatus: CheckStatus = 'pass';
  if (summary.failed > 0) {
    overallStatus = 'fail';
  } else if (summary.total === 0 || summary.total === summary.skipped) {
    overallStatus = 'unknown';
  }

  // Calculate total duration
  const durationMs = checks.reduce((sum, check) => sum + (check.durationMs || 0), 0);

  // Generate report ID
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const id = `health-${timestamp}`;

  return {
    id,
    timestamp: now,
    overallStatus,
    summary,
    checks,
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cwd: process.cwd(),
    },
    durationMs,
    apexVersion,
  };
}