import * as crypto from 'crypto';

/**
 * Generate a unique task ID
 */
export function generateTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `task_${timestamp}_${random}`;
}

/**
 * Generate a slug from a string
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
 * Generate a branch name for a task
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
 * Calculate estimated cost from token usage
 * Based on Claude Sonnet 4 pricing (adjust as needed)
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
 * Format a duration in milliseconds to human readable
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/**
 * Formats elapsed time from a start date to current time in a human-readable format
 * @param startTime - The start time as a Date object
 * @param currentTime - The current time as a Date object (defaults to now)
 * @returns Formatted elapsed time string (e.g., "42s", "2m 15s", "1h 5m")
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
 * Format token count with commas
 */
export function formatTokens(tokens: number): string {
  return tokens.toLocaleString();
}

/**
 * Format cost as USD
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
 * Parse a semantic version string into components
 * @param version - Version string to parse (e.g., "1.2.3", "v1.0.0-alpha.1+build.123")
 * @returns Parsed SemVer object or null if invalid
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
 * Check if a version is a prerelease
 * @param version - Version string or parsed SemVer
 * @returns true if the version has prerelease identifiers
 */
export function isPreRelease(version: string | SemVer): boolean {
  const parsed = typeof version === 'string' ? parseSemver(version) : version;
  if (!parsed) {
    return false;
  }
  return !!(parsed.prerelease && parsed.prerelease.length > 0);
}

/**
 * Compare two identifiers according to semver precedence rules
 * @param a - First identifier
 * @param b - Second identifier
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
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
 * Compare two semantic versions
 * @param a - First version (string or SemVer)
 * @param b - Second version (string or SemVer)
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
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
 * Determine the type of update between two versions
 * @param current - Current version
 * @param latest - Latest/target version
 * @returns The type of update required
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
 * Create a conventional commit message
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
 * Safely parse JSON with a fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Deep merge two objects
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
 * Retry a function with exponential backoff
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
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Extract code blocks from markdown
 */
export interface CodeBlock {
  language: string;
  code: string;
}

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
 * Detect merge conflicts in a file's content
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
 * Suggest resolution for a conflict marker
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
 * Format conflict detection results for display
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
 * Parse git log output into structured entries
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
 * Group commits by type for changelog generation
 */
export interface ChangelogGroup {
  type: CommitType | 'other';
  title: string;
  commits: GitLogEntry[];
}

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
 * Generate changelog markdown from grouped commits
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

    const typeConfig = group.type !== 'other' ? COMMIT_TYPES[group.type] : null;
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
 * Suggest commit type based on file changes
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
