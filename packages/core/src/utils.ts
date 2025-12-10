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
