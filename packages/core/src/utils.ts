import * as crypto from 'crypto';

export interface CodeBlock {
  language: string;
  code: string;
}

export interface ChangelogGroup {
  type: CommitType | 'other';
  title: string;
  commits: GitLogEntry[];
}

/**
 * Generate a unique task ID with timestamp and random components
 *
 * @returns A unique task ID string in the format 'task_{timestamp}_{random}'
 *
 * @example
 * ```typescript
 * const taskId = generateTaskId();
 * console.log(taskId); // 'task_lx2k4m_a1b2c3d4'
 * ```
 */
export function generateTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `task_${timestamp}_${random}`;
}

/**
 * Generate a unique idle task ID with timestamp and random components
 *
 * @returns A unique idle task ID string in the format 'idle_{timestamp}_{random}'
 *
 * @example
 * ```typescript
 * const idleTaskId = generateIdleTaskId();
 * console.log(idleTaskId); // 'idle_lx2k4m_a1b2c3d4'
 * ```
 */
export function generateIdleTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `idle_${timestamp}_${random}`;
}

/**
 * Generate a unique task template ID with timestamp and random components
 *
 * @returns A unique task template ID string in the format 'template_{timestamp}_{random}'
 *
 * @example
 * ```typescript
 * const templateId = generateTaskTemplateId();
 * console.log(templateId); // 'template_lx2k4m_a1b2c3d4'
 * ```
 */
export function generateTaskTemplateId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `template_${timestamp}_${random}`;
}

/**
 * Generate a unique approval ID with timestamp and random components
 *
 * @returns A unique approval ID string in the format 'apr_{timestamp}_{random}'
 *
 * @example
 * ```typescript
 * const approvalId = generateApprovalId();
 * console.log(approvalId); // 'apr_lx2k4m_a1b2c3d4'
 * ```
 */
export function generateApprovalId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `apr_${timestamp}_${random}`;
}

/**
 * Convert a string into a URL-friendly slug by removing special characters,
 * replacing spaces with hyphens, and normalizing to lowercase
 *
 * @param text - The input text to convert to a slug
 * @returns A URL-friendly slug string (max 50 characters)
 *
 * @example
 * ```typescript
 * const slug = slugify('Hello World! This is a Test');
 * console.log(slug); // 'hello-world-this-is-a-test'
 *
 * const longSlug = slugify('A very long title that exceeds the maximum length limit');
 * console.log(longSlug); // 'a-very-long-title-that-exceeds-the-maximum-len'
 * ```
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

/**
 * Generate a Git branch name combining a prefix, task ID, and description
 *
 * @param prefix - The branch prefix (e.g., 'feature/', 'bugfix/')
 * @param taskId - The task ID to extract a short identifier from
 * @param description - The task description to slugify
 * @returns A formatted branch name string
 *
 * @example
 * ```typescript
 * const branchName = generateBranchName('feature/', 'task_lx2k4m_a1b2c3d4', 'Add user authentication');
 * console.log(branchName); // 'feature/lx2k4m-add-user-authentication'
 *
 * const bugfixBranch = generateBranchName('bugfix/', 'bug_123', 'Fix login issue');
 * console.log(bugfixBranch); // 'bugfix/bug_123-fix-login-issue'
 * ```
 */
export function generateBranchName(
  prefix: string,
  taskId: string,
  description: string
): string {
  const slug = slugify(description);
  const shortId = taskId.split('_')[1] || taskId.substring(0, 8);
  return `${prefix}${shortId}-${slug}`;
}

/**
 * Calculate estimated cost from token usage based on Claude Sonnet 4 pricing
 *
 * @param inputTokens - Number of input tokens consumed
 * @param outputTokens - Number of output tokens generated
 * @returns The estimated cost in USD, rounded to 4 decimal places
 *
 * @example
 * ```typescript
 * const cost = calculateCost(1000, 500);
 * console.log(cost); // 0.0105 (based on Sonnet 4 pricing: $3/1M input, $15/1M output)
 *
 * const largeCost = calculateCost(50000, 25000);
 * console.log(largeCost); // 0.525
 * ```
 */
export function calculateCost(inputTokens: number, outputTokens: number): number {
  // Sonnet 4 pricing (per million tokens)
  const inputCostPerMillion = 3.0;
  const outputCostPerMillion = 15.0;

  const inputCost = (inputTokens / 1_000_000) * inputCostPerMillion;
  const outputCost = (outputTokens / 1_000_000) * outputCostPerMillion;

  return Math.round((inputCost + outputCost) * 10000) / 10000; // Round to 4 decimal places
}

/**
 * Format a duration in milliseconds to a human-readable string
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string (e.g., '500ms', '2.5s', '1m 30s', '2h 15m')
 *
 * @example
 * ```typescript
 * console.log(formatDuration(500)); // '500ms'
 * console.log(formatDuration(2500)); // '2.5s'
 * console.log(formatDuration(90000)); // '1m 30s'
 * console.log(formatDuration(7800000)); // '2h 10m'
 * ```
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/**
 * Formats elapsed time from a start date to current time in a human-readable format
 *
 * @param startTime - The start time as a Date object
 * @param currentTime - The current time as a Date object (defaults to now)
 * @returns Formatted elapsed time string (e.g., "42s", "2m 15s", "1h 5m")
 *
 * @example
 * ```typescript
 * const start = new Date('2024-01-01T10:00:00Z');
 * const current = new Date('2024-01-01T10:02:30Z');
 * console.log(formatElapsed(start, current)); // '2m 30s'
 *
 * // Using current time
 * const now = new Date();
 * console.log(formatElapsed(new Date(Date.now() - 5000))); // '5s'
 * ```
 */
export function formatElapsed(startTime: Date, currentTime: Date = new Date()): string {
  const startMs = startTime?.getTime?.();
  const currentMs = currentTime?.getTime?.();

  if (!Number.isFinite(startMs) || !Number.isFinite(currentMs)) {
    return '0s';
  }

  const elapsedMs = currentMs - startMs;

  // Handle edge cases
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return '0s';
  }

  if (elapsedMs < 1000) {
    return '0s'; // Show 0s for sub-second durations
  }

  const seconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  // Format based on duration
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}

/**
 * Format token count with thousands separators for readability
 *
 * @param tokens - Number of tokens to format
 * @returns Formatted token count string with locale-appropriate separators
 *
 * @example
 * ```typescript
 * console.log(formatTokens(1234)); // '1,234'
 * console.log(formatTokens(1000000)); // '1,000,000'
 * console.log(formatTokens(42)); // '42'
 * ```
 */
export function formatTokens(tokens: number): string {
  return tokens.toLocaleString();
}

/**
 * Format cost as USD currency string with 4 decimal places
 *
 * @param cost - Cost amount in USD
 * @returns Formatted cost string with dollar sign and 4 decimal places
 *
 * @example
 * ```typescript
 * console.log(formatCost(0.1234)); // '$0.1234'
 * console.log(formatCost(1.5)); // '$1.5000'
 * console.log(formatCost(25)); // '$25.0000'
 * ```
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

// ============================================================================
// Semantic Versioning Utilities
// ============================================================================

/**
 * Parsed semantic version components
 */
export interface SemVer {
  /** Major version number (breaking changes) */
  major: number;
  /** Minor version number (new features, backwards compatible) */
  minor: number;
  /** Patch version number (bug fixes, backwards compatible) */
  patch: number;
  /** Prerelease identifiers (e.g., ['alpha', '1'] for 1.0.0-alpha.1) */
  prerelease?: string[];
  /** Build metadata identifiers (e.g., ['build', '123'] for 1.0.0+build.123) */
  build?: string[];
  /** Original version string */
  raw: string;
}

/**
 * Type of version update
 */
export type UpdateType = 'major' | 'minor' | 'patch' | 'prerelease' | 'none' | 'downgrade';

/**
 * Parse a semantic version string into structured components
 *
 * @param version - Version string to parse (e.g., "1.2.3", "v1.0.0-alpha.1+build.123")
 * @returns Parsed SemVer object with major/minor/patch numbers and optional prerelease/build metadata, or null if invalid
 *
 * @example
 * ```typescript
 * const version = parseSemver('1.2.3-alpha.1+build.123');
 * console.log(version);
 * // {
 * //   major: 1,
 * //   minor: 2,
 * //   patch: 3,
 * //   prerelease: ['alpha', '1'],
 * //   build: ['build', '123'],
 * //   raw: '1.2.3-alpha.1+build.123'
 * // }
 *
 * const simple = parseSemver('v2.0.0');
 * console.log(simple); // { major: 2, minor: 0, patch: 0, raw: 'v2.0.0' }
 *
 * const invalid = parseSemver('not.a.version');
 * console.log(invalid); // null
 * ```
 */
export function parseSemver(version: string): SemVer | null {
  if (typeof version !== 'string' || !version.trim()) {
    return null;
  }

  const regex = /^v?(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?(?:\+([\w.-]+))?$/;
  const match = version.match(regex);

  if (!match) {
    return null;
  }

  const [, major, minor, patch, prerelease, build] = match;

  return {
    major: parseInt(major, 10),
    minor: parseInt(minor, 10),
    patch: parseInt(patch, 10),
    prerelease: prerelease ? prerelease.split('.') : undefined,
    build: build ? build.split('.') : undefined,
    raw: version,
  };
}

/**
 * Check if a version is a prerelease (contains prerelease identifiers)
 *
 * @param version - Version string or parsed SemVer object to check
 * @returns true if the version has prerelease identifiers, false otherwise
 *
 * @example
 * ```typescript
 * console.log(isPreRelease('1.0.0-alpha.1')); // true
 * console.log(isPreRelease('1.0.0-beta')); // true
 * console.log(isPreRelease('1.0.0')); // false
 * console.log(isPreRelease('2.1.3+build.456')); // false (build metadata doesn't make it prerelease)
 *
 * const parsed = parseSemver('1.0.0-rc.1');
 * console.log(isPreRelease(parsed)); // true
 * ```
 */
export function isPreRelease(version: string | SemVer): boolean {
  const parsed = typeof version === 'string' ? parseSemver(version) : version;
  if (!parsed) {
    return false;
  }
  return !!(parsed.prerelease && parsed.prerelease.length > 0);
}

/**
 * Compare two identifiers according to semantic versioning precedence rules
 * Numeric identifiers are compared numerically, non-numeric identifiers lexically.
 * Numeric identifiers always have lower precedence than non-numeric identifiers.
 *
 * @param a - First identifier to compare
 * @param b - Second identifier to compare
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 *
 * @example
 * ```typescript
 * console.log(compareIdentifiers('1', '2')); // -1 (numeric comparison)
 * console.log(compareIdentifiers('alpha', 'beta')); // -1 (lexical comparison)
 * console.log(compareIdentifiers('1', 'alpha')); // -1 (numeric < non-numeric)
 * console.log(compareIdentifiers('beta', '2')); // 1 (non-numeric > numeric)
 * ```
 */
function compareIdentifiers(a: string, b: string): -1 | 0 | 1 {
  const aNum = parseInt(a, 10);
  const bNum = parseInt(b, 10);
  const aIsNum = !isNaN(aNum) && String(aNum) === a;
  const bIsNum = !isNaN(bNum) && String(bNum) === b;

  if (aIsNum && bIsNum) {
    return aNum < bNum ? -1 : aNum > bNum ? 1 : 0;
  }
  if (aIsNum) return -1; // numeric < alphanumeric
  if (bIsNum) return 1;
  return a < b ? -1 : a > b ? 1 : 0; // lexical comparison
}

/**
 * Compare two semantic versions according to semver precedence rules
 * Handles major.minor.patch comparison, prerelease precedence, and invalid versions
 *
 * @param a - First version (string or SemVer object)
 * @param b - Second version (string or SemVer object)
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 *
 * @example
 * ```typescript
 * console.log(compareVersions('1.0.0', '1.0.1')); // -1
 * console.log(compareVersions('2.0.0', '1.9.9')); // 1
 * console.log(compareVersions('1.0.0', '1.0.0')); // 0
 *
 * // Prerelease handling
 * console.log(compareVersions('1.0.0-alpha', '1.0.0')); // -1 (prerelease < stable)
 * console.log(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.2')); // -1
 * console.log(compareVersions('1.0.0-alpha', '1.0.0-beta')); // -1 (lexical order)
 *
 * // Invalid versions treated as 0.0.0
 * console.log(compareVersions('invalid', '1.0.0')); // -1
 * ```
 */
export function compareVersions(a: string | SemVer, b: string | SemVer): -1 | 0 | 1 {
  const parsedA = typeof a === 'string' ? parseSemver(a) : a;
  const parsedB = typeof b === 'string' ? parseSemver(b) : b;

  // Treat invalid versions as 0.0.0 for graceful degradation
  const versionA = parsedA || { major: 0, minor: 0, patch: 0, raw: '0.0.0' };
  const versionB = parsedB || { major: 0, minor: 0, patch: 0, raw: '0.0.0' };

  // Compare major, minor, patch
  if (versionA.major !== versionB.major) {
    return versionA.major < versionB.major ? -1 : 1;
  }
  if (versionA.minor !== versionB.minor) {
    return versionA.minor < versionB.minor ? -1 : 1;
  }
  if (versionA.patch !== versionB.patch) {
    return versionA.patch < versionB.patch ? -1 : 1;
  }

  // Handle prerelease comparison
  const aHasPre = !!(versionA.prerelease && versionA.prerelease.length > 0);
  const bHasPre = !!(versionB.prerelease && versionB.prerelease.length > 0);

  if (!aHasPre && bHasPre) return 1; // stable > prerelease
  if (aHasPre && !bHasPre) return -1; // prerelease < stable
  if (!aHasPre && !bHasPre) return 0; // both stable, equal

  // Both have prerelease - compare identifiers
  const aPre = versionA.prerelease!;
  const bPre = versionB.prerelease!;
  const maxLength = Math.max(aPre.length, bPre.length);

  for (let i = 0; i < maxLength; i++) {
    const aId = aPre[i];
    const bId = bPre[i];

    if (aId === undefined) return -1; // fewer identifiers < more
    if (bId === undefined) return 1; // more identifiers > fewer

    const result = compareIdentifiers(aId, bId);
    if (result !== 0) return result;
  }

  return 0;
}

/**
 * Determine the type of update between two versions (major, minor, patch, prerelease, etc.)
 *
 * @param current - Current version (string or SemVer object)
 * @param latest - Latest/target version to compare against
 * @returns The type of update required: 'major', 'minor', 'patch', 'prerelease', 'none', or 'downgrade'
 *
 * @example
 * ```typescript
 * console.log(getUpdateType('1.0.0', '2.0.0')); // 'major'
 * console.log(getUpdateType('1.0.0', '1.1.0')); // 'minor'
 * console.log(getUpdateType('1.0.0', '1.0.1')); // 'patch'
 * console.log(getUpdateType('1.0.0', '1.0.0-beta')); // 'downgrade'
 * console.log(getUpdateType('1.0.0-alpha', '1.0.0-beta')); // 'prerelease'
 * console.log(getUpdateType('1.0.0', '1.0.0')); // 'none'
 *
 * // With parsed objects
 * const current = parseSemver('1.2.3');
 * const latest = parseSemver('1.3.0');
 * console.log(getUpdateType(current, latest)); // 'minor'
 * ```
 */
export function getUpdateType(current: string | SemVer, latest: string | SemVer): UpdateType {
  const parsedCurrent = typeof current === 'string' ? parseSemver(current) : current;
  const parsedLatest = typeof latest === 'string' ? parseSemver(latest) : latest;

  // If either version is invalid, return 'none'
  if (!parsedCurrent || !parsedLatest) {
    return 'none';
  }

  const comparison = compareVersions(parsedCurrent, parsedLatest);

  if (comparison === 0) {
    return 'none';
  }

  if (comparison > 0) {
    return 'downgrade';
  }

  // latest > current, determine update type
  if (parsedLatest.major > parsedCurrent.major) {
    return 'major';
  }
  if (parsedLatest.minor > parsedCurrent.minor) {
    return 'minor';
  }
  if (parsedLatest.patch > parsedCurrent.patch) {
    return 'patch';
  }

  // Same version numbers, check prerelease difference
  const currentHasPre = !!(parsedCurrent.prerelease && parsedCurrent.prerelease.length > 0);
  const latestHasPre = !!(parsedLatest.prerelease && parsedLatest.prerelease.length > 0);

  if (currentHasPre || latestHasPre) {
    return 'prerelease';
  }

  return 'none';
}

// ============================================================================
// Conventional Commits
// ============================================================================

/**
 * Parse conventional commit message
 */
export interface ConventionalCommit {
  type: string;
  scope?: string;
  description: string;
  body?: string;
  breaking: boolean;
}

/**
 * Parse a conventional commit message into its components
 *
 * @param message - The commit message to parse
 * @returns Parsed ConventionalCommit object or null if invalid format
 *
 * @example
 * ```typescript
 * const commit = parseConventionalCommit('feat(auth): add user login');
 * console.log(commit);
 * // { type: 'feat', scope: 'auth', description: 'add user login', breaking: false }
 *
 * const breaking = parseConventionalCommit('feat!: major API change\n\nThis is a breaking change');
 * console.log(breaking);
 * // { type: 'feat', description: 'major API change', body: 'This is a breaking change', breaking: true }
 * ```
 */
export function parseConventionalCommit(message: string): ConventionalCommit | null {
  const match = message.match(
    /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+?)(?:\n\n([\s\S]*))?$/
  );

  if (!match) return null;

  const [, type, scope, breaking, description, body] = match;

  return {
    type,
    scope: scope || undefined,
    description,
    body: body?.trim() || undefined,
    breaking: !!breaking,
  };
}

/**
 * Create a conventional commit message from components
 *
 * @param type - The commit type (feat, fix, docs, etc.)
 * @param description - Brief description of the change
 * @param options - Optional configuration
 * @param options.scope - Scope of the change (e.g., 'auth', 'api')
 * @param options.body - Extended description of the change
 * @param options.breaking - Whether this is a breaking change
 * @returns Formatted conventional commit message
 *
 * @example
 * ```typescript
 * const commit = createConventionalCommit('feat', 'add user login', {
 *   scope: 'auth',
 *   body: 'Implements OAuth 2.0 authentication flow'
 * });
 * console.log(commit); // 'feat(auth): add user login\n\nImplements OAuth 2.0 authentication flow'
 *
 * const breaking = createConventionalCommit('feat', 'remove deprecated API', {
 *   breaking: true,
 *   body: 'BREAKING CHANGE: Old API endpoints no longer supported'
 * });
 * console.log(breaking); // 'feat!: remove deprecated API\n\nBREAKING CHANGE: ...'
 * ```
 */
export function createConventionalCommit(
  type: string,
  description: string,
  options?: {
    scope?: string;
    body?: string;
    breaking?: boolean;
  }
): string {
  let message = type;

  if (options?.scope) {
    message += `(${options.scope})`;
  }

  if (options?.breaking) {
    message += '!';
  }

  message += `: ${description}`;

  if (options?.body) {
    message += `\n\n${options.body}`;
  }

  return message;
}

/**
 * Safely parse JSON with a fallback value if parsing fails
 *
 * @param json - JSON string to parse
 * @param fallback - Value to return if parsing fails
 * @returns Parsed JSON object or fallback value
 *
 * @example
 * ```typescript
 * const validJson = safeJsonParse('{"name": "John"}', {});
 * console.log(validJson); // { name: 'John' }
 *
 * const invalidJson = safeJsonParse('invalid json', { default: true });
 * console.log(invalidJson); // { default: true }
 *
 * const arrayFallback = safeJsonParse('malformed', []);
 * console.log(arrayFallback); // []
 * ```
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Deep merge two objects, recursively merging nested objects while preserving types
 *
 * @param target - The target object to merge into
 * @param source - The source object to merge from
 * @returns A new object with deeply merged properties
 *
 * @example
 * ```typescript
 * const target = { a: 1, b: { x: 1, y: 2 }, c: 'original' };
 * const source = { b: { y: 3, z: 4 }, d: 'new' };
 *
 * const merged = deepMerge(target, source);
 * console.log(merged);
 * // { a: 1, b: { x: 1, y: 3, z: 4 }, c: 'original', d: 'new' }
 *
 * // Arrays are replaced, not merged
 * const config = { items: [1, 2] };
 * const update = { items: [3, 4, 5] };
 * const result = deepMerge(config, update);
 * console.log(result.items); // [3, 4, 5]
 * ```
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[Extract<keyof T, string>];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[Extract<keyof T, string>];
    }
  }

  return result;
}

/**
 * Retry a function with exponential backoff strategy
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @param options.maxAttempts - Maximum number of retry attempts (default: 3)
 * @param options.initialDelay - Initial delay between retries in milliseconds (default: 1000)
 * @param options.maxDelay - Maximum delay between retries in milliseconds (default: 30000)
 * @param options.backoffFactor - Factor to multiply delay by each attempt (default: 2)
 * @returns Promise that resolves with the function result or rejects with the last error
 *
 * @example
 * ```typescript
 * const fetchWithRetry = async () => {
 *   const response = await fetch('https://api.example.com/data');
 *   if (!response.ok) throw new Error('Network error');
 *   return response.json();
 * };
 *
 * const data = await retry(fetchWithRetry, {
 *   maxAttempts: 5,
 *   initialDelay: 500,
 *   maxDelay: 10000
 * });
 *
 * // Custom backoff with different factor
 * await retry(someOperation, { backoffFactor: 1.5 }); // Slower exponential growth
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Create a deferred promise
 */
export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

/**
 * Create a deferred promise with external resolve/reject control
 *
 * @returns Deferred object containing promise, resolve, and reject functions
 *
 * @example
 * ```typescript
 * const deferred = createDeferred<string>();
 *
 * // Use the promise elsewhere
 * deferred.promise.then(value => console.log('Got:', value));
 *
 * // Resolve from external code
 * setTimeout(() => {
 *   deferred.resolve('Hello World');
 * }, 1000);
 *
 * // Error handling
 * const errorDeferred = createDeferred<number>();
 * errorDeferred.reject(new Error('Something went wrong'));
 * ```
 */
export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Truncate a string to a maximum length with optional suffix
 *
 * @param str - The string to truncate
 * @param maxLength - Maximum allowed length
 * @param suffix - Suffix to append when truncated (default: '...')
 * @returns Truncated string with suffix if needed
 *
 * @example
 * ```typescript
 * const long = 'This is a very long string that needs truncation';
 * console.log(truncate(long, 20)); // 'This is a very lo...'
 * console.log(truncate(long, 20, ' [more]')); // 'This is a [more]'
 *
 * const short = 'Short text';
 * console.log(truncate(short, 20)); // 'Short text' (unchanged)
 * ```
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Extract code blocks from markdown text
 *
 * @param markdown - Markdown text containing code blocks
 * @returns Array of CodeBlock objects with language and code content
 *
 * @example
 * ```typescript
 * const markdown = `
 * Here is some JavaScript:
 * \`\`\`javascript
 * console.log('Hello World');
 * \`\`\`
 *
 * And some Python:
 * \`\`\`python
 * print("Hello World")
 * \`\`\`
 * `;
 *
 * const blocks = extractCodeBlocks(markdown);
 * console.log(blocks);
 * // [
 * //   { language: 'javascript', code: "console.log('Hello World');" },
 * //   { language: 'python', code: 'print("Hello World")' }
 * // ]
 * ```
 */
export function extractCodeBlocks(markdown: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    blocks.push({
      language: match[1] || 'plaintext',
      code: match[2].trim(),
    });
  }

  return blocks;
}

/**
 * Commit type configuration for conventional commits
 */
export const COMMIT_TYPES = {
  feat: { title: 'Features', emoji: '✨', description: 'New features' },
  fix: { title: 'Bug Fixes', emoji: '🐛', description: 'Bug fixes' },
  docs: { title: 'Documentation', emoji: '📚', description: 'Documentation changes' },
  style: { title: 'Styles', emoji: '💎', description: 'Code style changes' },
  refactor: { title: 'Code Refactoring', emoji: '♻️', description: 'Code refactoring' },
  perf: { title: 'Performance', emoji: '🚀', description: 'Performance improvements' },
  test: { title: 'Tests', emoji: '🧪', description: 'Test additions/changes' },
  build: { title: 'Build', emoji: '📦', description: 'Build system changes' },
  ci: { title: 'CI', emoji: '👷', description: 'CI configuration changes' },
  chore: { title: 'Chores', emoji: '🔧', description: 'Maintenance tasks' },
  revert: { title: 'Reverts', emoji: '⏪', description: 'Reverted changes' },
} as const;

export type CommitType = keyof typeof COMMIT_TYPES;

/**
 * Git conflict detection types
 */
export interface ConflictInfo {
  file: string;
  conflictMarkers: ConflictMarker[];
  baseBranch?: string;
  incomingBranch?: string;
}

export interface ConflictMarker {
  startLine: number;
  endLine: number;
  currentContent: string;
  incomingContent: string;
  baseContent?: string;
}

/**
 * Detect merge conflicts in a file's content by parsing Git conflict markers
 *
 * @param fileContent - The file content to analyze for conflicts
 * @param filePath - The path of the file being analyzed
 * @returns ConflictInfo object with details about conflicts found, or null if none
 *
 * @example
 * ```typescript
 * const conflictedContent = `
 * function hello() {
 * <<<<<<< HEAD
 *   console.log('Hello from main');
 * =======
 *   console.log('Hello from feature');
 * >>>>>>> feature-branch
 * }
 * `;
 *
 * const conflicts = detectConflicts(conflictedContent, 'src/hello.js');
 * console.log(conflicts?.conflictMarkers.length); // 1
 * console.log(conflicts?.baseBranch); // 'HEAD'
 * console.log(conflicts?.incomingBranch); // 'feature-branch'
 * ```
 */
export function detectConflicts(fileContent: string, filePath: string): ConflictInfo | null {
  const lines = fileContent.split('\n');
  const conflictMarkers: ConflictMarker[] = [];
  let currentStart: number | null = null;
  let currentContent: string[] = [];
  let baseContent: string[] | null = null;
  let incomingContent: string[] = [];
  let isInCurrent = false;
  let isInBase = false;
  let isInIncoming = false;
  let baseBranch: string | undefined;
  let incomingBranch: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Start of conflict marker: <<<<<<< branch-name
    if (line.startsWith('<<<<<<<')) {
      currentStart = lineNum;
      baseBranch = line.substring(7).trim() || 'HEAD';
      isInCurrent = true;
      currentContent = [];
      baseContent = null;
      incomingContent = [];
      continue;
    }

    // Optional base marker (for diff3 style): ||||||| branch-name
    if (line.startsWith('|||||||') && isInCurrent) {
      isInCurrent = false;
      isInBase = true;
      baseContent = [];
      continue;
    }

    // Separator: =======
    if (line === '=======' && (isInCurrent || isInBase)) {
      isInCurrent = false;
      isInBase = false;
      isInIncoming = true;
      continue;
    }

    // End of conflict: >>>>>>> branch-name
    if (line.startsWith('>>>>>>>') && isInIncoming && currentStart !== null) {
      incomingBranch = line.substring(7).trim() || 'incoming';
      conflictMarkers.push({
        startLine: currentStart,
        endLine: lineNum,
        currentContent: currentContent.join('\n'),
        incomingContent: incomingContent.join('\n'),
        baseContent: baseContent?.join('\n'),
      });
      currentStart = null;
      isInIncoming = false;
      continue;
    }

    // Collect content based on current state
    if (isInCurrent) {
      currentContent.push(line);
    } else if (isInBase && baseContent) {
      baseContent.push(line);
    } else if (isInIncoming) {
      incomingContent.push(line);
    }
  }

  if (conflictMarkers.length === 0) {
    return null;
  }

  return {
    file: filePath,
    conflictMarkers,
    baseBranch,
    incomingBranch,
  };
}

/**
 * Resolution suggestion for a conflict
 */
export interface ConflictSuggestion {
  type: 'keep-current' | 'keep-incoming' | 'keep-both' | 'manual';
  description: string;
  resolvedContent: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Suggest resolution strategies for a conflict marker based on content analysis
 *
 * @param marker - The conflict marker to analyze
 * @returns Array of ConflictSuggestion objects with different resolution strategies
 *
 * @example
 * ```typescript
 * const marker: ConflictMarker = {
 *   startLine: 5,
 *   endLine: 9,
 *   currentContent: 'console.log("Hello");',
 *   incomingContent: 'console.log("Hello"); // Added comment'
 * };
 *
 * const suggestions = suggestConflictResolution(marker);
 * console.log(suggestions[0].type); // 'keep-incoming'
 * console.log(suggestions[0].confidence); // 'medium'
 * console.log(suggestions[0].reason); // 'Incoming changes include all current content with additions'
 * ```
 */
export function suggestConflictResolution(marker: ConflictMarker): ConflictSuggestion[] {
  const suggestions: ConflictSuggestion[] = [];
  const currentTrimmed = marker.currentContent.trim();
  const incomingTrimmed = marker.incomingContent.trim();

  // Check if one side is empty
  if (!currentTrimmed && incomingTrimmed) {
    suggestions.push({
      type: 'keep-incoming',
      description: 'Accept incoming changes (current side is empty)',
      resolvedContent: marker.incomingContent,
      confidence: 'high',
      reason: 'Current branch removed this content, incoming branch has additions',
    });
  } else if (currentTrimmed && !incomingTrimmed) {
    suggestions.push({
      type: 'keep-current',
      description: 'Keep current changes (incoming side is empty)',
      resolvedContent: marker.currentContent,
      confidence: 'high',
      reason: 'Current branch has content, incoming branch removed it',
    });
  }

  // Check if contents are identical (whitespace differences only)
  if (currentTrimmed === incomingTrimmed) {
    suggestions.push({
      type: 'keep-current',
      description: 'Keep either (contents are identical)',
      resolvedContent: marker.currentContent,
      confidence: 'high',
      reason: 'Both sides have identical content (possible whitespace differences)',
    });
  }

  // Check if one is a superset of the other (additive changes)
  if (incomingTrimmed.includes(currentTrimmed) && currentTrimmed !== incomingTrimmed) {
    suggestions.push({
      type: 'keep-incoming',
      description: 'Accept incoming (includes current content plus additions)',
      resolvedContent: marker.incomingContent,
      confidence: 'medium',
      reason: 'Incoming changes include all current content with additions',
    });
  } else if (currentTrimmed.includes(incomingTrimmed) && currentTrimmed !== incomingTrimmed) {
    suggestions.push({
      type: 'keep-current',
      description: 'Keep current (includes incoming content plus additions)',
      resolvedContent: marker.currentContent,
      confidence: 'medium',
      reason: 'Current changes include all incoming content with additions',
    });
  }

  // Offer combined option for non-overlapping changes
  const combinedContent = marker.currentContent + '\n' + marker.incomingContent;
  suggestions.push({
    type: 'keep-both',
    description: 'Keep both changes (concatenate)',
    resolvedContent: combinedContent,
    confidence: 'low',
    reason: 'Combine both changes - requires manual review',
  });

  // Always offer manual resolution
  suggestions.push({
    type: 'manual',
    description: 'Manual resolution required',
    resolvedContent: marker.currentContent, // Placeholder
    confidence: 'low',
    reason: 'Complex conflict that needs human review',
  });

  return suggestions;
}

/**
 * Format conflict detection results into a human-readable report
 *
 * @param conflicts - Array of ConflictInfo objects to format
 * @returns Formatted string report with conflict details and suggestions
 *
 * @example
 * ```typescript
 * const conflicts = [
 *   {
 *     file: 'src/main.js',
 *     baseBranch: 'main',
 *     incomingBranch: 'feature',
 *     conflictMarkers: [{ startLine: 5, endLine: 10, currentContent: '...', incomingContent: '...' }]
 *   }
 * ];
 *
 * const report = formatConflictReport(conflicts);
 * console.log(report);
 * // "Found 1 file(s) with conflicts:
 * //  📄 src/main.js
 * //     Branches: main ← feature
 * //     Conflicts: 1
 * //     ..."
 * ```
 */
export function formatConflictReport(conflicts: ConflictInfo[]): string {
  if (conflicts.length === 0) {
    return 'No conflicts detected.';
  }

  let report = `Found ${conflicts.length} file(s) with conflicts:\n\n`;

  for (const conflict of conflicts) {
    report += `📄 ${conflict.file}\n`;
    report += `   Branches: ${conflict.baseBranch || 'HEAD'} ← ${conflict.incomingBranch || 'incoming'}\n`;
    report += `   Conflicts: ${conflict.conflictMarkers.length}\n`;

    for (let i = 0; i < conflict.conflictMarkers.length; i++) {
      const marker = conflict.conflictMarkers[i];
      report += `\n   Conflict ${i + 1} (lines ${marker.startLine}-${marker.endLine}):\n`;

      const suggestions = suggestConflictResolution(marker);
      const topSuggestion = suggestions.find((s) => s.confidence === 'high') || suggestions[0];

      report += `   Suggestion: ${topSuggestion.description}\n`;
      report += `   Confidence: ${topSuggestion.confidence}\n`;
      report += `   Reason: ${topSuggestion.reason}\n`;
    }
    report += '\n';
  }

  return report;
}

/**
 * Parsed git log entry
 */
export interface GitLogEntry {
  hash: string;
  shortHash: string;
  author: string;
  date: Date;
  message: string;
  conventional?: ConventionalCommit;
}

/**
 * Parse git log output into structured entries with conventional commit analysis
 *
 * @param logOutput - Raw git log output string
 * @returns Array of GitLogEntry objects with parsed commit information
 *
 * @example
 * ```typescript
 * const logOutput = `
 * commit a1b2c3d4e5f6789
 * Author: John Doe <john@example.com>
 * Date: Mon Jan 15 10:30:00 2024 -0500
 *
 * feat(auth): add user login functionality
 *
 * commit 9876543210abcdef
 * Author: Jane Smith <jane@example.com>
 * Date: Sun Jan 14 15:45:00 2024 -0500
 *
 * fix: resolve memory leak in parser
 * `;
 *
 * const entries = parseGitLog(logOutput);
 * console.log(entries[0].conventional?.type); // 'feat'
 * console.log(entries[1].shortHash); // '9876543'
 * ```
 */
export function parseGitLog(logOutput: string): GitLogEntry[] {
  const entries: GitLogEntry[] = [];
  const commitRegex = /commit\s+([a-f0-9]+)\nAuthor:\s*(.+)\nDate:\s*(.+)\n\n([\s\S]*?)(?=commit\s+[a-f0-9]+|$)/g;
  let match;

  while ((match = commitRegex.exec(logOutput)) !== null) {
    const [, hash, author, dateStr, messageBlock] = match;
    const message = messageBlock.trim();

    entries.push({
      hash,
      shortHash: hash.substring(0, 7),
      author: author.trim(),
      date: new Date(dateStr.trim()),
      message,
      conventional: parseConventionalCommit(message.split('\n')[0]) ?? undefined,
    });
  }

  return entries;
}

/**
 * Group commits by their conventional commit type for changelog generation
 *
 * @param entries - Array of GitLogEntry objects to group
 * @returns Array of ChangelogGroup objects organized by commit type
 *
 * @example
 * ```typescript
 * const commits = [
 *   { hash: 'abc123', message: 'feat: add new feature', conventional: { type: 'feat' } },
 *   { hash: 'def456', message: 'fix: resolve bug', conventional: { type: 'fix' } },
 *   { hash: 'ghi789', message: 'feat: another feature', conventional: { type: 'feat' } }
 * ];
 *
 * const groups = groupCommitsByType(commits);
 * console.log(groups[0].type); // 'feat'
 * console.log(groups[0].commits.length); // 2
 * console.log(groups[1].type); // 'fix'
 * console.log(groups[1].commits.length); // 1
 * ```
 */
export function groupCommitsByType(entries: GitLogEntry[]): ChangelogGroup[] {
  const groups = new Map<CommitType | 'other', GitLogEntry[]>();

  for (const entry of entries) {
    const type = entry.conventional?.type as CommitType;
    const groupType = type && type in COMMIT_TYPES ? type : 'other';

    if (!groups.has(groupType)) {
      groups.set(groupType, []);
    }
    groups.get(groupType)!.push(entry);
  }

  const result: ChangelogGroup[] = [];

  // Add groups in order of COMMIT_TYPES
  for (const type of Object.keys(COMMIT_TYPES) as CommitType[]) {
    const commits = groups.get(type);
    if (commits && commits.length > 0) {
      result.push({
        type,
        title: COMMIT_TYPES[type].title,
        commits,
      });
    }
  }

  // Add 'other' at the end
  const other = groups.get('other');
  if (other && other.length > 0) {
    result.push({
      type: 'other',
      title: 'Other Changes',
      commits: other,
    });
  }

  return result;
}

/**
 * Generate changelog markdown from grouped commits with customizable formatting
 *
 * @param version - Version string for the changelog section
 * @param date - Release date
 * @param groups - Array of ChangelogGroup objects with commits by type
 * @param options - Optional formatting configuration
 * @param options.includeHashes - Whether to include commit hashes (default: true)
 * @param options.includeAuthors - Whether to include commit authors (default: false)
 * @param options.repoUrl - Repository URL for creating commit links
 * @returns Formatted markdown changelog string
 *
 * @example
 * ```typescript
 * const groups = [
 *   {
 *     type: 'feat',
 *     title: 'Features',
 *     commits: [
 *       { shortHash: 'abc123', conventional: { description: 'add user login' } }
 *     ]
 *   }
 * ];
 *
 * const changelog = generateChangelogMarkdown('1.2.0', new Date('2024-01-15'), groups, {
 *   includeHashes: true,
 *   repoUrl: 'https://github.com/user/repo'
 * });
 *
 * console.log(changelog);
 * // ## [1.2.0] - 2024-01-15
 * //
 * // ### ✨ Features
 * //
 * // - add user login ([abc123](https://github.com/user/repo/commit/abc123...))
 * ```
 */
export function generateChangelogMarkdown(
  version: string,
  date: Date,
  groups: ChangelogGroup[],
  options?: {
    includeHashes?: boolean;
    includeAuthors?: boolean;
    repoUrl?: string;
  }
): string {
  const { includeHashes = true, includeAuthors = false, repoUrl } = options || {};

  let markdown = `## [${version}] - ${date.toISOString().split('T')[0]}\n\n`;

  for (const group of groups) {
    if (group.commits.length === 0) continue;

    const typeConfig = group.type !== 'other' ? COMMIT_TYPES[group.type as CommitType] : null;
    const emoji = typeConfig?.emoji || '📝';

    markdown += `### ${emoji} ${group.title}\n\n`;

    for (const commit of group.commits) {
      const description = commit.conventional?.description || commit.message.split('\n')[0];
      const scope = commit.conventional?.scope ? `**${commit.conventional.scope}:** ` : '';
      const breaking = commit.conventional?.breaking ? '⚠️ BREAKING: ' : '';

      let line = `- ${breaking}${scope}${description}`;

      if (includeHashes && repoUrl) {
        line += ` ([${commit.shortHash}](${repoUrl}/commit/${commit.hash}))`;
      } else if (includeHashes) {
        line += ` (${commit.shortHash})`;
      }

      if (includeAuthors) {
        line += ` - ${commit.author}`;
      }

      markdown += line + '\n';
    }

    markdown += '\n';
  }

  return markdown;
}

/**
 * Suggest conventional commit type based on file paths and patterns
 *
 * @param files - Array of file paths that were changed
 * @returns Suggested CommitType based on file patterns
 *
 * @example
 * ```typescript
 * const testFiles = ['src/utils.test.ts', 'src/api.spec.js'];
 * console.log(suggestCommitType(testFiles)); // 'test'
 *
 * const docFiles = ['README.md', 'docs/api.md'];
 * console.log(suggestCommitType(docFiles)); // 'docs'
 *
 * const mixedFiles = ['src/api.ts', 'package.json'];
 * console.log(suggestCommitType(mixedFiles)); // 'build' (package.json detected)
 *
 * const newFeatureFiles = ['src/newComponent.tsx'];
 * console.log(suggestCommitType(newFeatureFiles)); // 'feat'
 * ```
 */
export function suggestCommitType(files: string[]): CommitType {
  const patterns: Array<{ pattern: RegExp; type: CommitType }> = [
    { pattern: /\.test\.|\.spec\.|__tests__|\/tests?\//i, type: 'test' },
    { pattern: /\.md$|docs\//i, type: 'docs' },
    { pattern: /\.css$|\.scss$|\.less$|\.styled\./i, type: 'style' },
    { pattern: /package\.json$|yarn\.lock$|package-lock\.json$/i, type: 'build' },
    { pattern: /\.github\/|\.gitlab-ci|\.circleci|jenkinsfile/i, type: 'ci' },
    { pattern: /\.eslint|\.prettier|\.editorconfig|tsconfig/i, type: 'chore' },
  ];

  // Count matches for each type
  const counts = new Map<CommitType, number>();

  for (const file of files) {
    for (const { pattern, type } of patterns) {
      if (pattern.test(file)) {
        counts.set(type, (counts.get(type) || 0) + 1);
        break;
      }
    }
  }

  // Find the most common type
  let maxCount = 0;
  let suggestedType: CommitType = 'feat';

  for (const [type, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      suggestedType = type;
    }
  }

  // Default to 'feat' for new features or 'fix' if files suggest bug fixes
  if (maxCount === 0) {
    const hasNewFiles = files.some((f) => !f.includes('/'));
    return hasNewFiles ? 'feat' : 'chore';
  }

  return suggestedType;
}

// ============================================================================
// Tool Output Truncation
// ============================================================================

/**
 * Options for truncating tool output
 */
export interface TruncateOptions {
  /** Maximum number of characters before truncation (default: 10000) */
  maxLength?: number;
  /** Suffix to append when content is truncated (default: '... [truncated]') */
  suffix?: string;
  /** Whether to preserve JSON structure when truncating JSON strings (default: true) */
  preserveJson?: boolean;
  /** Whether to try to truncate at word boundaries when possible (default: true) */
  wordBoundary?: boolean;
}

/**
 * Result of tool output truncation
 */
export interface TruncateResult {
  /** The truncated output */
  output: string;
  /** Whether the output was truncated */
  truncated: boolean;
  /** Original length before truncation */
  originalLength: number;
  /** Final length after truncation */
  truncatedLength: number;
}

/**
 * Check if a string is valid JSON
 */
function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Truncate JSON content while preserving structure
 */
function truncateJsonContent(content: string, maxLength: number, suffix: string): TruncateResult {
  try {
    const parsed = JSON.parse(content);

    // If the original JSON is already short enough, return it
    if (content.length <= maxLength) {
      return {
        output: content,
        truncated: false,
        originalLength: content.length,
        truncatedLength: content.length,
      };
    }

    // Try to create a truncated version while preserving structure
    let truncated: any;

    if (Array.isArray(parsed)) {
      // For arrays, keep some elements and indicate truncation
      const availableLength = maxLength - suffix.length - 20; // Reserve space for structure
      let truncatedArray = [];
      let currentLength = 2; // Account for []

      for (let i = 0; i < parsed.length; i++) {
        const itemJson = JSON.stringify(parsed[i]);
        const itemLength = itemJson.length + (i > 0 ? 1 : 0); // +1 for comma

        if (currentLength + itemLength > availableLength) {
          // Add truncation indicator
          truncatedArray.push(`... ${parsed.length - i} more items`);
          break;
        }

        truncatedArray.push(parsed[i]);
        currentLength += itemLength;
      }

      truncated = truncatedArray;
    } else if (typeof parsed === 'object' && parsed !== null) {
      // For objects, keep some properties and indicate truncation
      const availableLength = maxLength - suffix.length - 20; // Reserve space for structure
      let truncatedObj: any = {};
      let currentLength = 2; // Account for {}
      const keys = Object.keys(parsed);
      let truncatedKeys = 0;

      for (const key of keys) {
        const value = parsed[key];
        const propJson = JSON.stringify({ [key]: value });
        const propLength = propJson.length - 2 + (truncatedKeys > 0 ? 1 : 0); // -2 for {}, +1 for comma

        if (currentLength + propLength > availableLength) {
          // Add truncation indicator
          const remaining = keys.length - truncatedKeys;
          truncatedObj[`... ${remaining} more properties`] = '...';
          break;
        }

        truncatedObj[key] = value;
        currentLength += propLength;
        truncatedKeys++;
      }

      truncated = truncatedObj;
    } else {
      // For primitives, just truncate the string representation
      const stringified = JSON.stringify(parsed);
      const truncateLength = maxLength - suffix.length;

      return {
        output: stringified.substring(0, truncateLength) + suffix,
        truncated: true,
        originalLength: content.length,
        truncatedLength: truncateLength + suffix.length,
      };
    }

    const truncatedJson = JSON.stringify(truncated, null, 2);

    // If the truncated JSON is still too long, fall back to simple truncation
    if (truncatedJson.length > maxLength) {
      const truncateLength = maxLength - suffix.length;
      return {
        output: content.substring(0, truncateLength) + suffix,
        truncated: true,
        originalLength: content.length,
        truncatedLength: truncateLength + suffix.length,
      };
    }

    return {
      output: truncatedJson + (truncatedJson !== content ? suffix : ''),
      truncated: truncatedJson !== content,
      originalLength: content.length,
      truncatedLength: truncatedJson.length + (truncatedJson !== content ? suffix.length : 0),
    };

  } catch {
    // If JSON parsing fails, fall back to regular truncation
    const truncateLength = maxLength - suffix.length;
    return {
      output: content.substring(0, truncateLength) + suffix,
      truncated: true,
      originalLength: content.length,
      truncatedLength: truncateLength + suffix.length,
    };
  }
}

/**
 * Truncate text content at word boundaries when possible
 */
function truncateAtWordBoundary(content: string, maxLength: number, suffix: string): string {
  const truncateLength = maxLength - suffix.length;

  if (content.length <= maxLength) {
    return content;
  }

  const truncated = content.substring(0, truncateLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  const lastNewlineIndex = truncated.lastIndexOf('\n');

  // Find the best boundary (prefer newlines over spaces)
  const boundaryIndex = Math.max(lastNewlineIndex, lastSpaceIndex);

  // Only use word boundary if it's not too far back (within 10% of target length)
  const minBoundary = truncateLength * 0.9;

  if (boundaryIndex > minBoundary) {
    return truncated.substring(0, boundaryIndex);
  }

  return truncated;
}

/**
 * Truncate tool output to a maximum length while preserving readability
 *
 * @param output - The tool output to truncate
 * @param options - Truncation options
 * @returns Result containing the truncated output and metadata
 */
export function truncateToolOutput(output: string, options: TruncateOptions = {}): TruncateResult {
  const {
    maxLength = 10000,
    suffix = '... [truncated]',
    preserveJson = true,
    wordBoundary = true,
  } = options;

  // Handle null/undefined input
  if (!output) {
    return {
      output: output || '',
      truncated: false,
      originalLength: 0,
      truncatedLength: 0,
    };
  }

  const originalLength = output.length;

  // If content is within limits, return as-is
  if (originalLength <= maxLength) {
    return {
      output,
      truncated: false,
      originalLength,
      truncatedLength: originalLength,
    };
  }

  // Try JSON-aware truncation if enabled and content appears to be JSON
  if (preserveJson && isValidJson(output.trim())) {
    return truncateJsonContent(output.trim(), maxLength, suffix);
  }

  // Regular text truncation
  let truncated: string;
  const truncateLength = maxLength - suffix.length;

  if (wordBoundary) {
    truncated = truncateAtWordBoundary(output, maxLength, suffix);
    // If word boundary truncation didn't work well, fall back to character truncation
    if (truncated.length < truncateLength * 0.8) {
      truncated = output.substring(0, truncateLength);
    }
  } else {
    truncated = output.substring(0, truncateLength);
  }

  const finalOutput = truncated + suffix;

  return {
    output: finalOutput,
    truncated: true,
    originalLength,
    truncatedLength: finalOutput.length,
  };
}
