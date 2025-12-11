import { describe, it, expect, vi } from 'vitest';
import {
  generateTaskId,
  slugify,
  generateBranchName,
  calculateCost,
  formatDuration,
  formatTokens,
  formatCost,
  parseConventionalCommit,
  createConventionalCommit,
  safeJsonParse,
  deepMerge,
  truncate,
  extractCodeBlocks,
  retry,
  createDeferred,
} from './utils';

describe('generateTaskId', () => {
  it('should generate unique task IDs', () => {
    const id1 = generateTaskId();
    const id2 = generateTaskId();
    expect(id1).not.toBe(id2);
  });

  it('should start with task_ prefix', () => {
    const id = generateTaskId();
    expect(id).toMatch(/^task_/);
  });

  it('should have timestamp and random components', () => {
    const id = generateTaskId();
    const parts = id.split('_');
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe('task');
  });
});

describe('slugify', () => {
  it('should convert to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('should replace spaces with hyphens', () => {
    expect(slugify('multiple spaces here')).toBe('multiple-spaces-here');
  });

  it('should remove special characters', () => {
    expect(slugify('test@#$%^&*()')).toBe('test');
  });

  it('should truncate to 50 characters', () => {
    const long = 'a'.repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(50);
  });

  it('should handle empty strings', () => {
    expect(slugify('')).toBe('');
  });
});

describe('generateBranchName', () => {
  it('should combine prefix, task id, and description', () => {
    const branch = generateBranchName('apex/', 'task_abc123_def456', 'Add user auth');
    expect(branch).toMatch(/^apex\//);
    expect(branch).toContain('add-user-auth');
  });

  it('should extract short ID from full task ID', () => {
    const branch = generateBranchName('feature/', 'task_abc123_def456', 'Test');
    expect(branch).toBe('feature/abc123-test');
  });
});

describe('calculateCost', () => {
  it('should calculate cost based on token usage', () => {
    // 1M input tokens at $3/M + 0 output = $3
    const cost = calculateCost(1_000_000, 0);
    expect(cost).toBe(3);
  });

  it('should calculate output tokens at higher rate', () => {
    // 0 input + 1M output tokens at $15/M = $15
    const cost = calculateCost(0, 1_000_000);
    expect(cost).toBe(15);
  });

  it('should round to 4 decimal places', () => {
    const cost = calculateCost(100, 100);
    expect(cost.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(4);
  });

  it('should handle zero tokens', () => {
    expect(calculateCost(0, 0)).toBe(0);
  });
});

describe('formatDuration', () => {
  it('should format milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('should format seconds', () => {
    expect(formatDuration(5000)).toBe('5.0s');
  });

  it('should format minutes and seconds', () => {
    expect(formatDuration(90000)).toBe('1m 30s');
  });

  it('should format hours and minutes', () => {
    expect(formatDuration(3700000)).toBe('1h 1m');
  });
});

describe('formatTokens', () => {
  it('should format with commas', () => {
    expect(formatTokens(1000000)).toBe('1,000,000');
  });

  it('should handle small numbers', () => {
    expect(formatTokens(100)).toBe('100');
  });
});

describe('formatCost', () => {
  it('should format as USD with 4 decimal places', () => {
    expect(formatCost(1.2345)).toBe('$1.2345');
  });

  it('should pad to 4 decimal places', () => {
    expect(formatCost(1)).toBe('$1.0000');
  });
});

describe('parseConventionalCommit', () => {
  it('should parse basic commit', () => {
    const result = parseConventionalCommit('feat: add new feature');
    expect(result).toEqual({
      type: 'feat',
      description: 'add new feature',
      breaking: false,
    });
  });

  it('should parse commit with scope', () => {
    const result = parseConventionalCommit('fix(auth): resolve login issue');
    expect(result).toEqual({
      type: 'fix',
      scope: 'auth',
      description: 'resolve login issue',
      breaking: false,
    });
  });

  it('should parse breaking change', () => {
    const result = parseConventionalCommit('feat!: breaking change');
    expect(result).toEqual({
      type: 'feat',
      description: 'breaking change',
      breaking: true,
    });
  });

  it('should parse commit with body', () => {
    const result = parseConventionalCommit('docs: update readme\n\nAdded more examples');
    expect(result?.body).toBe('Added more examples');
  });

  it('should return null for invalid format', () => {
    expect(parseConventionalCommit('not a conventional commit')).toBeNull();
  });
});

describe('createConventionalCommit', () => {
  it('should create basic commit message', () => {
    const msg = createConventionalCommit('feat', 'add feature');
    expect(msg).toBe('feat: add feature');
  });

  it('should include scope', () => {
    const msg = createConventionalCommit('fix', 'fix bug', { scope: 'api' });
    expect(msg).toBe('fix(api): fix bug');
  });

  it('should include breaking change marker', () => {
    const msg = createConventionalCommit('feat', 'breaking', { breaking: true });
    expect(msg).toBe('feat!: breaking');
  });

  it('should include body', () => {
    const msg = createConventionalCommit('docs', 'update', { body: 'More details here' });
    expect(msg).toBe('docs: update\n\nMore details here');
  });
});

describe('safeJsonParse', () => {
  it('should parse valid JSON', () => {
    expect(safeJsonParse('{"a": 1}', null)).toEqual({ a: 1 });
  });

  it('should return default for invalid JSON', () => {
    expect(safeJsonParse('not json', { default: true })).toEqual({ default: true });
  });

  it('should return fallback for invalid JSON', () => {
    expect(safeJsonParse('not json', null)).toBeNull();
  });
});

describe('deepMerge', () => {
  it('should merge simple objects', () => {
    const result = deepMerge({ a: 1 }, { b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('should merge nested objects', () => {
    const result = deepMerge(
      { nested: { a: 1 } },
      { nested: { b: 2 } }
    );
    expect(result).toEqual({ nested: { a: 1, b: 2 } });
  });

  it('should override primitives', () => {
    const result = deepMerge({ a: 1 }, { a: 2 });
    expect(result).toEqual({ a: 2 });
  });

  it('should handle arrays by replacing', () => {
    const result = deepMerge({ arr: [1, 2] }, { arr: [3, 4] });
    expect(result).toEqual({ arr: [3, 4] });
  });
});

describe('truncate', () => {
  it('should truncate long strings', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  it('should not truncate short strings', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('should use custom suffix', () => {
    expect(truncate('hello world', 8, '…')).toBe('hello w…');
  });
});

describe('extractCodeBlocks', () => {
  it('should extract code blocks', () => {
    const markdown = 'Some text\n```typescript\nconst x = 1;\n```\nMore text';
    const blocks = extractCodeBlocks(markdown);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      language: 'typescript',
      code: 'const x = 1;',
    });
  });

  it('should extract multiple code blocks', () => {
    const markdown = '```js\ncode1\n```\n\n```py\ncode2\n```';
    const blocks = extractCodeBlocks(markdown);
    expect(blocks).toHaveLength(2);
  });

  it('should handle code blocks without language as plaintext', () => {
    const markdown = '```\nplain code\n```';
    const blocks = extractCodeBlocks(markdown);
    expect(blocks[0].language).toBe('plaintext');
  });

  it('should return empty array for no code blocks', () => {
    expect(extractCodeBlocks('no code here')).toEqual([]);
  });
});

describe('retry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await retry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await retry(fn, { maxAttempts: 3, initialDelay: 1 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(
      retry(fn, { maxAttempts: 3, initialDelay: 1 })
    ).rejects.toThrow('always fails');

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should use exponential backoff', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const start = Date.now();
    await retry(fn, { maxAttempts: 2, initialDelay: 50, backoffFactor: 2 });
    const elapsed = Date.now() - start;

    // Should have waited approximately 50ms
    expect(elapsed).toBeGreaterThanOrEqual(40);
    expect(elapsed).toBeLessThan(200);
  });

  it('should respect maxDelay on subsequent retries', async () => {
    // maxDelay caps the backoff growth after the first delay
    // First retry uses initialDelay, second uses min(initialDelay * backoff, maxDelay)
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const start = Date.now();
    // First delay: 20ms, second delay: min(20*2=40, 25) = 25ms
    await retry(fn, { maxAttempts: 3, initialDelay: 20, maxDelay: 25, backoffFactor: 2 });
    const elapsed = Date.now() - start;

    // Should take approximately 20 + 25 = 45ms (with overhead)
    expect(elapsed).toBeGreaterThanOrEqual(35);
    expect(elapsed).toBeLessThan(150);
  });

  it('should use default options', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    await retry(fn);

    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('createDeferred', () => {
  it('should create a deferred that can be resolved', async () => {
    const deferred = createDeferred<string>();

    setTimeout(() => deferred.resolve('hello'), 10);

    const result = await deferred.promise;
    expect(result).toBe('hello');
  });

  it('should create a deferred that can be rejected', async () => {
    const deferred = createDeferred<string>();

    setTimeout(() => deferred.reject(new Error('failed')), 10);

    await expect(deferred.promise).rejects.toThrow('failed');
  });

  it('should have promise, resolve, and reject properties', () => {
    const deferred = createDeferred<number>();

    expect(deferred.promise).toBeInstanceOf(Promise);
    expect(typeof deferred.resolve).toBe('function');
    expect(typeof deferred.reject).toBe('function');
  });

  it('should resolve synchronously', async () => {
    const deferred = createDeferred<number>();
    deferred.resolve(42);

    const result = await deferred.promise;
    expect(result).toBe(42);
  });
});
