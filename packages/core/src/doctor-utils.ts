import { z } from 'zod';
import { compareVersions, parseSemver } from './utils';
import type { DoctorCheckResult, HealthReport, CheckStatus, ToolchainCheck } from './types';

// Fetch is used via globalThis.fetch at call time (not module load time)
// This allows tests to mock fetch using vi.stubGlobal('fetch', mockFetch)

// ============================================================================
// Version Comparison Utilities
// ============================================================================

/**
 * Check if a version satisfies a version range requirement
 * Supports semver range operators: >=, >, <=, <, ^, ~, and exact match
 *
 * @param range - Version range string (e.g., ">=18.0.0", "^1.0.0", "~1.0.0", "1.0.0")
 * @param version - Version string to check (e.g., "18.17.0", "v2.1.0")
 * @returns true if version satisfies the range, false otherwise
 *
 * @example
 * ```typescript
 * // Exact match
 * console.log(satisfiesVersion('1.0.0', '1.0.0')); // true
 * console.log(satisfiesVersion('1.0.0', '1.0.1')); // false
 *
 * // Greater than or equal
 * console.log(satisfiesVersion('>=18.0.0', '18.0.0')); // true
 * console.log(satisfiesVersion('>=18.0.0', '19.0.0')); // true
 * console.log(satisfiesVersion('>=18.0.0', '17.0.0')); // false
 *
 * // Caret ranges (compatible with major)
 * console.log(satisfiesVersion('^1.0.0', '1.0.0')); // true
 * console.log(satisfiesVersion('^1.0.0', '1.5.0')); // true
 * console.log(satisfiesVersion('^1.0.0', '2.0.0')); // false
 *
 * // Tilde ranges (compatible with minor)
 * console.log(satisfiesVersion('~1.0.0', '1.0.0')); // true
 * console.log(satisfiesVersion('~1.0.0', '1.0.5')); // true
 * console.log(satisfiesVersion('~1.0.0', '1.1.0')); // false
 * ```
 */
export function satisfiesVersion(range: string, version: string): boolean {
  if (!range || !version) {
    return false;
  }

  // Parse range operator and base version
  let operator = '';
  let rangeVersion = range;

  if (range.startsWith('>=')) {
    operator = '>=';
    rangeVersion = range.slice(2);
  } else if (range.startsWith('>') && !range.startsWith('>=')) {
    operator = '>';
    rangeVersion = range.slice(1);
  } else if (range.startsWith('<=')) {
    operator = '<=';
    rangeVersion = range.slice(2);
  } else if (range.startsWith('<') && !range.startsWith('<=')) {
    operator = '<';
    rangeVersion = range.slice(1);
  } else if (range.startsWith('^')) {
    operator = '^';
    rangeVersion = range.slice(1);
  } else if (range.startsWith('~')) {
    operator = '~';
    rangeVersion = range.slice(1);
  }

  const parsedRange = parseSemver(rangeVersion);
  const parsedVersion = parseSemver(version);

  // Return false for invalid versions
  if (!parsedRange || !parsedVersion) {
    return false;
  }

  const comparison = compareVersions(parsedVersion, parsedRange);

  switch (operator) {
    case '>=':
      return comparison >= 0;
    case '>':
      return comparison > 0;
    case '<=':
      return comparison <= 0;
    case '<':
      return comparison < 0;
    case '^':
      // Compatible with major version (same major, version >= range)
      return parsedVersion.major === parsedRange.major && comparison >= 0;
    case '~':
      // Compatible with minor version (same major.minor, version >= range)
      return parsedVersion.major === parsedRange.major &&
             parsedVersion.minor === parsedRange.minor &&
             comparison >= 0;
    default:
      // Exact match (ignoring build metadata per semver spec)
      return comparison === 0;
  }
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
 * console.log(parseVersionOutput('Version: 1.2.3-beta.1+build.123')); // "1.2.3-beta.1+build.123"
 * console.log(parseVersionOutput('invalid output')); // null
 * ```
 */
export function parseVersionOutput(output: string): string | null {
  if (!output || typeof output !== 'string') {
    return null;
  }

  // Common patterns for version output - updated to capture full semver with build metadata
  // The pattern captures: major.minor.patch followed by optional prerelease (-xxx) and build metadata (+xxx)
  // Order matters - more specific patterns first to avoid false positives
  const patterns = [
    // "node v18.0.0" at start of string or after whitespace - before any parenthetical content
    /^node\s+v?(\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?)/i,
    // "Node.js v16.14.0" or "Node.js version: v18.0.0"
    /node\.?js\s+(?:version[:\s]+)?v?(\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?)/i,
    // "version 8.19.2" or "Version: 1.2.3-beta.1+build.123"
    /version[:\s]+v?(\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?)/i,
    // "npm 8.19.2", "git 2.34.1", etc
    /(?:npm|git|python|java|typescript)\s+v?(\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?)/i,
    // v18.17.0 or v1.2.3-beta.1+build.123 (generic pattern with v prefix)
    /\bv(\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?)/i,
    // Generic version pattern as last resort
    /\b(\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?)\b/,
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
    // Use globalThis.fetch directly for mockability in tests
    // Tests can use vi.stubGlobal('fetch', mockFetch) to mock this
    if (!globalThis.fetch) {
      return null;
    }

    // Use unencoded package name for scoped packages
    // npm registry handles @scope/name URLs correctly
    const url = `${registry}/${packageName}`;

    // Use AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await globalThis.fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'APEX-doctor/0.6.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Return null for HTTP errors (including 404)
    // This allows calling code to handle unavailability gracefully
    if (!response.ok) {
      return null;
    }

    const data = await response.json() as Record<string, unknown>;

    return {
      name: (data.name as string) || packageName,
      version: (data.version as string) || '',
      latestVersion: (data['dist-tags'] as Record<string, string>)?.latest || '',
      versions: Object.keys((data.versions as Record<string, unknown>) || {}),
      deprecated: data.deprecated as string | undefined,
      homepage: data.homepage as string | undefined,
      repository: typeof data.repository === 'string' ? data.repository : (data.repository as Record<string, unknown>)?.url as string | undefined,
    };

  } catch (error) {
    // For network errors, fetch failures, and timeouts, return null
    // This allows calling code to handle unavailability gracefully
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
// Toolchain Detection Utilities
// ============================================================================

/**
 * Check TypeScript version and availability
 *
 * @param options - Detection options
 * @returns Promise resolving to toolchain check result
 */
export async function detectTypeScript(options: {
  /** Check locally installed version instead of global */
  local?: boolean;
  /** Working directory to check for local installation */
  cwd?: string;
} = {}): Promise<ToolchainCheck> {
  const { local = false, cwd = process.cwd() } = options;

  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const command = local ? 'npx tsc --version' : 'tsc --version';
    const execOptions = cwd ? { cwd } : {};

    try {
      const { stdout } = await execAsync(command, execOptions);
      const version = parseVersionOutput(stdout.trim());

      return {
        name: 'typescript',
        currentVersion: version,
        requiredVersion: '4.0.0',
        required: false,
        path: local ? 'local' : 'global',
        metadata: {
          installation: local ? 'local' : 'global',
          raw: stdout.trim(),
        },
      };
    } catch (cmdError) {
      if (local) {
        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          const packageJsonPath = path.join(cwd, 'package.json');
          const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
          const packageJson = JSON.parse(packageContent);

          const tsVersion =
            packageJson.dependencies?.typescript ||
            packageJson.devDependencies?.typescript;

          if (tsVersion) {
            const cleanVersion = parseVersionOutput(tsVersion) || tsVersion;
            return {
              name: 'typescript',
              currentVersion: cleanVersion,
              requiredVersion: '4.0.0',
              required: false,
              path: packageJsonPath,
              metadata: {
                installation: 'package.json',
                raw: tsVersion,
              },
            };
          }
        } catch {
          // Ignore errors
        }
      }

      return {
        name: 'typescript',
        currentVersion: null,
        requiredVersion: '4.0.0',
        required: false,
        metadata: {
          installation: local ? 'local' : 'global',
          error: cmdError instanceof Error ? cmdError.message : 'Command failed',
        },
      };
    }
  } catch (error) {
    return {
      name: 'typescript',
      currentVersion: null,
      requiredVersion: '4.0.0',
      required: false,
      metadata: {
        error: error instanceof Error ? error.message : 'Detection failed',
      },
    };
  }
}

/**
 * Check Yarn package manager version and availability
 *
 * @returns Promise resolving to toolchain check result
 */
export async function detectYarn(): Promise<ToolchainCheck> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const { stdout } = await execAsync('yarn --version');
    const version = parseVersionOutput(stdout.trim());

    return {
      name: 'yarn',
      currentVersion: version,
      requiredVersion: '1.22.0',
      required: false,
      metadata: {
        raw: stdout.trim(),
        packageManager: true,
      },
    };
  } catch (error) {
    return {
      name: 'yarn',
      currentVersion: null,
      requiredVersion: '1.22.0',
      required: false,
      metadata: {
        error: error instanceof Error ? error.message : 'Yarn not found',
        packageManager: true,
      },
    };
  }
}

/**
 * Check pnpm package manager version and availability
 *
 * @returns Promise resolving to toolchain check result
 */
export async function detectPnpm(): Promise<ToolchainCheck> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const { stdout } = await execAsync('pnpm --version');
    const version = parseVersionOutput(stdout.trim());

    return {
      name: 'pnpm',
      currentVersion: version,
      requiredVersion: '7.0.0',
      required: false,
      metadata: {
        raw: stdout.trim(),
        packageManager: true,
      },
    };
  } catch (error) {
    return {
      name: 'pnpm',
      currentVersion: null,
      requiredVersion: '7.0.0',
      required: false,
      metadata: {
        error: error instanceof Error ? error.message : 'pnpm not found',
        packageManager: true,
      },
    };
  }
}

/**
 * Check Claude API key presence
 * Only checks for presence, never logs actual key values for security
 *
 * @param options - Detection options
 * @returns Promise resolving to toolchain check result
 */
export async function detectClaudeApiKey(options: {
  checkEnv?: boolean;
  envVar?: string;
} = {}): Promise<ToolchainCheck> {
  const { checkEnv = true, envVar = 'CLAUDE_API_KEY' } = options;

  try {
    let apiKeyFound = false;
    let source: string | undefined;

    if (checkEnv) {
      const envVars = [envVar, 'ANTHROPIC_API_KEY'];
      for (const varName of envVars) {
        if (process.env[varName]) {
          apiKeyFound = true;
          source = varName;
          break;
        }
      }
    }

    return {
      name: 'claude-api-key',
      currentVersion: apiKeyFound ? 'present' : null,
      requiredVersion: 'present',
      required: true,
      path: source,
      metadata: {
        source,
        checkMethod: 'environment-variables',
      },
    };
  } catch (error) {
    return {
      name: 'claude-api-key',
      currentVersion: null,
      requiredVersion: 'present',
      required: true,
      metadata: {
        error: error instanceof Error ? error.message : 'Detection failed',
      },
    };
  }
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
  partial: Partial<DoctorCheckResult> & Pick<DoctorCheckResult, 'name'>
): DoctorCheckResult {
  const now = new Date();

  return {
    id: `check-${Math.random().toString(36).substr(2, 9)}`,
    category: 'environment' as const,
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
    warnings: checks.filter(c => c.severity === 'warning').length,
    skipped: checks.filter(c => c.status === 'skip').length,
    errors: checks.filter(c => c.severity === 'error').length,
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