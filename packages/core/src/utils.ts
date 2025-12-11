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
