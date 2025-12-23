import { describe, it, expect, vi } from 'vitest';
import {
  generateTaskId,
  slugify,
  generateBranchName,
  calculateCost,
  formatDuration,
  formatTokens,
  formatCost,
  parseSemver,
  isPreRelease,
  compareVersions,
  getUpdateType,
  parseConventionalCommit,
  createConventionalCommit,
  safeJsonParse,
  deepMerge,
  truncate,
  extractCodeBlocks,
  retry,
  createDeferred,
  COMMIT_TYPES,
  parseGitLog,
  groupCommitsByType,
  generateChangelogMarkdown,
  suggestCommitType,
  detectConflicts,
  suggestConflictResolution,
  formatConflictReport,
  type SemVer,
  type UpdateType,
} from './utils';

describe.skip('generateTaskId', () => {
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

describe.skip('slugify', () => {
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

describe.skip('generateBranchName', () => {
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

describe.skip('calculateCost', () => {
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

describe.skip('formatDuration', () => {
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

describe.skip('formatTokens', () => {
  it('should format with commas', () => {
    expect(formatTokens(1000000)).toBe('1,000,000');
  });

  it('should handle small numbers', () => {
    expect(formatTokens(100)).toBe('100');
  });
});

describe.skip('formatCost', () => {
  it('should format as USD with 4 decimal places', () => {
    expect(formatCost(1.2345)).toBe('$1.2345');
  });

  it('should pad to 4 decimal places', () => {
    expect(formatCost(1)).toBe('$1.0000');
  });
});

// ============================================================================
// SEMANTIC VERSIONING TESTS
// ============================================================================

describe.skip('parseSemver', () => {
  // Valid versions
  it('should parse basic version', () => {
    const result = parseSemver('1.2.3');
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      raw: '1.2.3',
    });
  });

  it('should parse version with v prefix', () => {
    const result = parseSemver('v1.2.3');
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      raw: 'v1.2.3',
    });
  });

  it('should parse version with prerelease', () => {
    const result = parseSemver('1.0.0-alpha.1');
    expect(result).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: ['alpha', '1'],
      raw: '1.0.0-alpha.1',
    });
  });

  it('should parse version with build metadata', () => {
    const result = parseSemver('1.0.0+build.123');
    expect(result).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      build: ['build', '123'],
      raw: '1.0.0+build.123',
    });
  });

  it('should parse version with prerelease and build', () => {
    const result = parseSemver('1.0.0-alpha.1+build.123');
    expect(result).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: ['alpha', '1'],
      build: ['build', '123'],
      raw: '1.0.0-alpha.1+build.123',
    });
  });

  it('should parse zero version', () => {
    const result = parseSemver('0.0.0');
    expect(result?.major).toBe(0);
    expect(result?.minor).toBe(0);
    expect(result?.patch).toBe(0);
  });

  it('should parse large version numbers', () => {
    const result = parseSemver('100.200.300');
    expect(result?.major).toBe(100);
    expect(result?.minor).toBe(200);
    expect(result?.patch).toBe(300);
  });

  it('should parse simple prerelease identifiers', () => {
    const result = parseSemver('1.0.0-alpha');
    expect(result?.prerelease).toEqual(['alpha']);
  });

  it('should parse complex prerelease identifiers', () => {
    const result = parseSemver('1.0.0-rc.1.2.3');
    expect(result?.prerelease).toEqual(['rc', '1', '2', '3']);
  });

  it('should parse numeric prerelease', () => {
    const result = parseSemver('1.0.0-1');
    expect(result?.prerelease).toEqual(['1']);
  });

  // Invalid versions
  it('should return null for empty string', () => {
    expect(parseSemver('')).toBeNull();
  });

  it('should return null for whitespace-only string', () => {
    expect(parseSemver('   ')).toBeNull();
  });

  it('should return null for incomplete version', () => {
    expect(parseSemver('1.2')).toBeNull();
    expect(parseSemver('1')).toBeNull();
    expect(parseSemver('1.')).toBeNull();
    expect(parseSemver('1.2.')).toBeNull();
  });

  it('should return null for too many segments', () => {
    expect(parseSemver('1.2.3.4')).toBeNull();
  });

  it('should return null for non-numeric segments', () => {
    expect(parseSemver('a.b.c')).toBeNull();
    expect(parseSemver('1.a.3')).toBeNull();
  });

  it('should return null for negative numbers', () => {
    expect(parseSemver('-1.2.3')).toBeNull();
    expect(parseSemver('1.-2.3')).toBeNull();
  });

  it('should return null for random text', () => {
    expect(parseSemver('invalid')).toBeNull();
    expect(parseSemver('not-a-version')).toBeNull();
    expect(parseSemver('version 1.2.3')).toBeNull();
  });

  it('should return null for null input', () => {
    expect(parseSemver(null as any)).toBeNull();
    expect(parseSemver(undefined as any)).toBeNull();
  });

  it('should return null for non-string input', () => {
    expect(parseSemver(123 as any)).toBeNull();
    expect(parseSemver({} as any)).toBeNull();
  });
});

describe.skip('isPreRelease', () => {
  it('should return true for prerelease versions', () => {
    expect(isPreRelease('1.0.0-alpha')).toBe(true);
    expect(isPreRelease('1.0.0-alpha.1')).toBe(true);
    expect(isPreRelease('1.0.0-beta')).toBe(true);
    expect(isPreRelease('1.0.0-rc.1')).toBe(true);
    expect(isPreRelease('1.0.0-0')).toBe(true);
    expect(isPreRelease('2.5.10-beta.2')).toBe(true);
  });

  it('should return false for stable versions', () => {
    expect(isPreRelease('1.0.0')).toBe(false);
    expect(isPreRelease('2.5.10')).toBe(false);
    expect(isPreRelease('0.0.0')).toBe(false);
    expect(isPreRelease('v1.0.0')).toBe(false);
  });

  it('should return false for versions with only build metadata', () => {
    expect(isPreRelease('1.0.0+build.123')).toBe(false);
    expect(isPreRelease('2.1.0+20230101')).toBe(false);
  });

  it('should work with SemVer objects', () => {
    const prerelease = parseSemver('1.0.0-alpha')!;
    const stable = parseSemver('1.0.0')!;
    expect(isPreRelease(prerelease)).toBe(true);
    expect(isPreRelease(stable)).toBe(false);
  });

  it('should return false for invalid versions', () => {
    expect(isPreRelease('invalid')).toBe(false);
    expect(isPreRelease('')).toBe(false);
    expect(isPreRelease('1.2')).toBe(false);
  });

  it('should return false for null SemVer object', () => {
    expect(isPreRelease(null as any)).toBe(false);
  });
});

describe.skip('compareVersions', () => {
  // Basic comparisons
  it('should compare major versions', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    expect(compareVersions('10.0.0', '2.0.0')).toBe(1);
  });

  it('should compare minor versions', () => {
    expect(compareVersions('1.2.0', '1.1.0')).toBe(1);
    expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
    expect(compareVersions('1.10.0', '1.2.0')).toBe(1);
  });

  it('should compare patch versions', () => {
    expect(compareVersions('1.0.2', '1.0.1')).toBe(1);
    expect(compareVersions('1.0.1', '1.0.2')).toBe(-1);
    expect(compareVersions('1.0.10', '1.0.2')).toBe(1);
  });

  it('should return 0 for equal versions', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('0.0.0', '0.0.0')).toBe(0);
  });

  // Prerelease comparisons
  it('should rank stable higher than prerelease', () => {
    expect(compareVersions('1.0.0', '1.0.0-alpha')).toBe(1);
    expect(compareVersions('1.0.0-alpha', '1.0.0')).toBe(-1);
    expect(compareVersions('1.0.0', '1.0.0-rc.1')).toBe(1);
  });

  it('should compare prerelease identifiers alphabetically', () => {
    expect(compareVersions('1.0.0-beta', '1.0.0-alpha')).toBe(1);
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
    expect(compareVersions('1.0.0-rc', '1.0.0-beta')).toBe(1);
  });

  it('should compare numeric prerelease identifiers numerically', () => {
    expect(compareVersions('1.0.0-alpha.2', '1.0.0-alpha.1')).toBe(1);
    expect(compareVersions('1.0.0-alpha.10', '1.0.0-alpha.2')).toBe(1);
    expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.10')).toBe(-1);
  });

  it('should rank numeric identifiers lower than alphanumeric', () => {
    expect(compareVersions('1.0.0-alpha', '1.0.0-1')).toBe(1);
    expect(compareVersions('1.0.0-1', '1.0.0-alpha')).toBe(-1);
    expect(compareVersions('1.0.0-beta', '1.0.0-2')).toBe(1);
  });

  it('should compare prerelease with more identifiers as greater', () => {
    expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha')).toBe(1);
    expect(compareVersions('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1);
    expect(compareVersions('1.0.0-alpha.1.2', '1.0.0-alpha.1')).toBe(1);
  });

  it('should handle complex prerelease comparisons', () => {
    expect(compareVersions('1.0.0-alpha.beta', '1.0.0-alpha.1')).toBe(1);
    expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.beta')).toBe(-1);
    expect(compareVersions('1.0.0-alpha.beta.1', '1.0.0-alpha.beta')).toBe(1);
  });

  it('should compare equal prerelease versions correctly', () => {
    expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.1')).toBe(0);
    expect(compareVersions('1.0.0-beta', '1.0.0-beta')).toBe(0);
  });

  // Build metadata ignored
  it('should ignore build metadata in comparisons', () => {
    expect(compareVersions('1.0.0+build.1', '1.0.0+build.2')).toBe(0);
    expect(compareVersions('1.0.0', '1.0.0+build')).toBe(0);
    expect(compareVersions('1.0.0-alpha+build.1', '1.0.0-alpha+build.2')).toBe(0);
  });

  // Edge cases
  it('should handle v prefix', () => {
    expect(compareVersions('v1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('v2.0.0', 'v1.0.0')).toBe(1);
    expect(compareVersions('v1.0.0-alpha', 'v1.0.0')).toBe(-1);
  });

  it('should work with SemVer objects', () => {
    const a = parseSemver('2.0.0')!;
    const b = parseSemver('1.0.0')!;
    expect(compareVersions(a, b)).toBe(1);
    expect(compareVersions(b, a)).toBe(-1);
    expect(compareVersions(a, '2.0.0')).toBe(0);
  });

  it('should handle invalid versions as 0.0.0', () => {
    expect(compareVersions('invalid', '1.0.0')).toBe(-1);
    expect(compareVersions('1.0.0', 'invalid')).toBe(1);
    expect(compareVersions('invalid', 'invalid')).toBe(0);
    expect(compareVersions('', '1.0.0')).toBe(-1);
  });

  it('should handle mixed valid and invalid versions', () => {
    expect(compareVersions('1.0.0', '')).toBe(1);
    expect(compareVersions('0.0.0', 'invalid')).toBe(0);
    expect(compareVersions('1.0.0-alpha', 'bad')).toBe(1);
  });
});

describe.skip('getUpdateType', () => {
  it('should detect major updates', () => {
    expect(getUpdateType('1.0.0', '2.0.0')).toBe('major');
    expect(getUpdateType('1.5.10', '3.0.0')).toBe('major');
    expect(getUpdateType('0.9.9', '1.0.0')).toBe('major');
  });

  it('should detect minor updates', () => {
    expect(getUpdateType('1.0.0', '1.1.0')).toBe('minor');
    expect(getUpdateType('1.2.3', '1.5.0')).toBe('minor');
    expect(getUpdateType('2.0.0', '2.1.0')).toBe('minor');
  });

  it('should detect patch updates', () => {
    expect(getUpdateType('1.0.0', '1.0.1')).toBe('patch');
    expect(getUpdateType('1.2.3', '1.2.5')).toBe('patch');
    expect(getUpdateType('2.5.0', '2.5.10')).toBe('patch');
  });

  it('should detect prerelease updates', () => {
    expect(getUpdateType('1.0.0-alpha', '1.0.0-beta')).toBe('prerelease');
    expect(getUpdateType('1.0.0-alpha.1', '1.0.0-alpha.2')).toBe('prerelease');
    expect(getUpdateType('1.0.0-alpha', '1.0.0')).toBe('prerelease');
    expect(getUpdateType('1.0.0', '1.0.0-alpha')).toBe('prerelease');
  });

  it('should detect no change', () => {
    expect(getUpdateType('1.0.0', '1.0.0')).toBe('none');
    expect(getUpdateType('v1.0.0', '1.0.0')).toBe('none');
    expect(getUpdateType('1.0.0-alpha', '1.0.0-alpha')).toBe('none');
    expect(getUpdateType('1.0.0+build.1', '1.0.0+build.2')).toBe('none');
  });

  it('should detect downgrades', () => {
    expect(getUpdateType('2.0.0', '1.0.0')).toBe('downgrade');
    expect(getUpdateType('1.1.0', '1.0.0')).toBe('downgrade');
    expect(getUpdateType('1.0.1', '1.0.0')).toBe('downgrade');
    expect(getUpdateType('1.0.0', '1.0.0-alpha')).toBe('downgrade');
    expect(getUpdateType('1.0.0-beta', '1.0.0-alpha')).toBe('downgrade');
  });

  it('should handle promotion from prerelease to stable as prerelease update', () => {
    expect(getUpdateType('1.0.0-alpha', '1.0.0')).toBe('prerelease');
    expect(getUpdateType('2.0.0-rc.1', '2.0.0')).toBe('prerelease');
  });

  it('should handle demotion from stable to prerelease as prerelease update', () => {
    expect(getUpdateType('1.0.0', '1.0.0-alpha')).toBe('prerelease');
  });

  it('should prioritize major over prerelease changes', () => {
    expect(getUpdateType('1.0.0-alpha', '2.0.0')).toBe('major');
    expect(getUpdateType('1.0.0', '2.0.0-beta')).toBe('major');
  });

  it('should prioritize minor over prerelease changes', () => {
    expect(getUpdateType('1.0.0-alpha', '1.1.0')).toBe('minor');
    expect(getUpdateType('1.0.0', '1.1.0-beta')).toBe('minor');
  });

  it('should prioritize patch over prerelease changes', () => {
    expect(getUpdateType('1.0.0-alpha', '1.0.1')).toBe('patch');
    expect(getUpdateType('1.0.0', '1.0.1-beta')).toBe('patch');
  });

  it('should return none for invalid versions', () => {
    expect(getUpdateType('invalid', '1.0.0')).toBe('none');
    expect(getUpdateType('1.0.0', 'invalid')).toBe('none');
    expect(getUpdateType('invalid', 'invalid')).toBe('none');
    expect(getUpdateType('', '1.0.0')).toBe('none');
  });

  it('should work with SemVer objects', () => {
    const current = parseSemver('1.0.0')!;
    const latest = parseSemver('2.0.0')!;
    expect(getUpdateType(current, latest)).toBe('major');

    const currentPre = parseSemver('1.0.0-alpha')!;
    const latestPre = parseSemver('1.0.0-beta')!;
    expect(getUpdateType(currentPre, latestPre)).toBe('prerelease');
  });

  it('should handle edge cases correctly', () => {
    // Mixed string and SemVer
    const semver = parseSemver('1.0.0')!;
    expect(getUpdateType(semver, '2.0.0')).toBe('major');
    expect(getUpdateType('1.0.0', semver)).toBe('none');

    // v prefix combinations
    expect(getUpdateType('v1.0.0', '1.0.0')).toBe('none');
    expect(getUpdateType('1.0.0', 'v1.1.0')).toBe('minor');
  });
});

describe.skip('parseConventionalCommit', () => {
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

describe.skip('createConventionalCommit', () => {
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

describe.skip('safeJsonParse', () => {
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

describe.skip('deepMerge', () => {
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

describe.skip('truncate', () => {
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

describe.skip('extractCodeBlocks', () => {
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

describe.skip('retry', () => {
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

describe.skip('createDeferred', () => {
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

describe.skip('COMMIT_TYPES', () => {
  it('should have all standard commit types', () => {
    expect(COMMIT_TYPES.feat).toBeDefined();
    expect(COMMIT_TYPES.fix).toBeDefined();
    expect(COMMIT_TYPES.docs).toBeDefined();
    expect(COMMIT_TYPES.refactor).toBeDefined();
    expect(COMMIT_TYPES.test).toBeDefined();
    expect(COMMIT_TYPES.chore).toBeDefined();
  });

  it('should have title and emoji for each type', () => {
    for (const type of Object.values(COMMIT_TYPES)) {
      expect(type.title).toBeDefined();
      expect(type.emoji).toBeDefined();
      expect(type.description).toBeDefined();
    }
  });
});

describe.skip('parseGitLog', () => {
  it('should parse git log output', () => {
    const logOutput = `commit abc123def456789
Author: John Doe <john@example.com>
Date:   Mon Jan 15 10:30:00 2025 -0800

    feat: add new feature

commit 789abc123456def
Author: Jane Smith <jane@example.com>
Date:   Sun Jan 14 15:00:00 2025 -0800

    fix(api): fix bug in endpoint
`;

    const entries = parseGitLog(logOutput);

    expect(entries).toHaveLength(2);
    expect(entries[0].hash).toBe('abc123def456789');
    expect(entries[0].shortHash).toBe('abc123d');
    expect(entries[0].author).toBe('John Doe <john@example.com>');
    expect(entries[0].message).toBe('feat: add new feature');
    expect(entries[0].conventional?.type).toBe('feat');

    expect(entries[1].conventional?.type).toBe('fix');
    expect(entries[1].conventional?.scope).toBe('api');
  });

  it('should handle non-conventional commits', () => {
    const logOutput = `commit abc123
Author: User <user@example.com>
Date:   Mon Jan 15 10:00:00 2025 -0800

    random commit message
`;

    const entries = parseGitLog(logOutput);

    expect(entries).toHaveLength(1);
    expect(entries[0].conventional).toBeUndefined();
  });

  it('should handle empty log', () => {
    const entries = parseGitLog('');
    expect(entries).toHaveLength(0);
  });
});

describe.skip('groupCommitsByType', () => {
  it('should group commits by conventional type', () => {
    const entries = [
      {
        hash: 'abc123',
        shortHash: 'abc123',
        author: 'User',
        date: new Date(),
        message: 'feat: feature 1',
        conventional: { type: 'feat', description: 'feature 1', breaking: false },
      },
      {
        hash: 'def456',
        shortHash: 'def456',
        author: 'User',
        date: new Date(),
        message: 'feat: feature 2',
        conventional: { type: 'feat', description: 'feature 2', breaking: false },
      },
      {
        hash: 'ghi789',
        shortHash: 'ghi789',
        author: 'User',
        date: new Date(),
        message: 'fix: bug fix',
        conventional: { type: 'fix', description: 'bug fix', breaking: false },
      },
    ];

    const groups = groupCommitsByType(entries);

    expect(groups).toHaveLength(2);
    expect(groups[0].type).toBe('feat');
    expect(groups[0].commits).toHaveLength(2);
    expect(groups[1].type).toBe('fix');
    expect(groups[1].commits).toHaveLength(1);
  });

  it('should put non-conventional commits in "other" group', () => {
    const entries = [
      {
        hash: 'abc123',
        shortHash: 'abc123',
        author: 'User',
        date: new Date(),
        message: 'random message',
        conventional: undefined,
      },
    ];

    const groups = groupCommitsByType(entries);

    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('other');
  });
});

describe.skip('generateChangelogMarkdown', () => {
  it('should generate markdown changelog', () => {
    const groups = [
      {
        type: 'feat' as const,
        title: 'Features',
        commits: [
          {
            hash: 'abc123full',
            shortHash: 'abc123f',
            author: 'User',
            date: new Date(),
            message: 'feat: add feature',
            conventional: { type: 'feat', description: 'add feature', breaking: false },
          },
        ],
      },
    ];

    const markdown = generateChangelogMarkdown('1.0.0', new Date('2025-01-15'), groups);

    expect(markdown).toContain('## [1.0.0] - 2025-01-15');
    expect(markdown).toContain('### ✨ Features');
    expect(markdown).toContain('- add feature');
    expect(markdown).toContain('(abc123f)');
  });

  it('should include repo links when URL provided', () => {
    const groups = [
      {
        type: 'fix' as const,
        title: 'Bug Fixes',
        commits: [
          {
            hash: 'abc123full',
            shortHash: 'abc123f',
            author: 'User',
            date: new Date(),
            message: 'fix: fix bug',
            conventional: { type: 'fix', description: 'fix bug', breaking: false },
          },
        ],
      },
    ];

    const markdown = generateChangelogMarkdown('1.0.0', new Date(), groups, {
      repoUrl: 'https://github.com/user/repo',
    });

    expect(markdown).toContain('[abc123f](https://github.com/user/repo/commit/abc123full)');
  });

  it('should mark breaking changes', () => {
    const groups = [
      {
        type: 'feat' as const,
        title: 'Features',
        commits: [
          {
            hash: 'abc123',
            shortHash: 'abc123',
            author: 'User',
            date: new Date(),
            message: 'feat!: breaking change',
            conventional: { type: 'feat', description: 'breaking change', breaking: true },
          },
        ],
      },
    ];

    const markdown = generateChangelogMarkdown('2.0.0', new Date(), groups);

    expect(markdown).toContain('⚠️ BREAKING:');
  });

  it('should include scope in output', () => {
    const groups = [
      {
        type: 'fix' as const,
        title: 'Bug Fixes',
        commits: [
          {
            hash: 'abc123',
            shortHash: 'abc123',
            author: 'User',
            date: new Date(),
            message: 'fix(api): fix endpoint',
            conventional: { type: 'fix', scope: 'api', description: 'fix endpoint', breaking: false },
          },
        ],
      },
    ];

    const markdown = generateChangelogMarkdown('1.0.1', new Date(), groups);

    expect(markdown).toContain('**api:**');
  });
});

describe.skip('suggestCommitType', () => {
  it('should suggest test type for test files', () => {
    const files = ['src/utils.test.ts', 'tests/integration.spec.js'];
    expect(suggestCommitType(files)).toBe('test');
  });

  it('should suggest docs type for documentation', () => {
    const files = ['README.md', 'docs/guide.md'];
    expect(suggestCommitType(files)).toBe('docs');
  });

  it('should suggest build type for package files', () => {
    const files = ['package.json', 'package-lock.json'];
    expect(suggestCommitType(files)).toBe('build');
  });

  it('should suggest ci type for CI files', () => {
    const files = ['.github/workflows/ci.yml'];
    expect(suggestCommitType(files)).toBe('ci');
  });

  it('should suggest style for CSS files', () => {
    const files = ['src/styles.css', 'components/Button.scss'];
    expect(suggestCommitType(files)).toBe('style');
  });

  it('should suggest chore for files with paths that do not match patterns', () => {
    const files = ['src/newFeature.ts', 'lib/component.tsx'];
    expect(suggestCommitType(files)).toBe('chore');
  });

  it('should suggest feat for files without path separators', () => {
    const files = ['newFeature.ts', 'component.tsx'];
    expect(suggestCommitType(files)).toBe('feat');
  });
});

// ============================================================================
// CONFLICT DETECTION TESTS
// ============================================================================

describe.skip('detectConflicts', () => {
  it('should detect simple conflict markers', () => {
    const content = `line 1
<<<<<<< HEAD
current content
=======
incoming content
>>>>>>> feature-branch
line 2`;

    const result = detectConflicts(content, 'test.ts');

    expect(result).not.toBeNull();
    expect(result!.file).toBe('test.ts');
    expect(result!.conflictMarkers).toHaveLength(1);
    expect(result!.conflictMarkers[0].currentContent).toBe('current content');
    expect(result!.conflictMarkers[0].incomingContent).toBe('incoming content');
    expect(result!.baseBranch).toBe('HEAD');
    expect(result!.incomingBranch).toBe('feature-branch');
  });

  it('should detect multiple conflicts', () => {
    const content = `<<<<<<< HEAD
content1
=======
incoming1
>>>>>>> branch
middle
<<<<<<< HEAD
content2
=======
incoming2
>>>>>>> branch`;

    const result = detectConflicts(content, 'test.ts');

    expect(result).not.toBeNull();
    expect(result!.conflictMarkers).toHaveLength(2);
  });

  it('should handle diff3 style conflicts with base', () => {
    const content = `<<<<<<< HEAD
current
||||||| merged common ancestors
base content
=======
incoming
>>>>>>> branch`;

    const result = detectConflicts(content, 'test.ts');

    expect(result).not.toBeNull();
    expect(result!.conflictMarkers[0].currentContent).toBe('current');
    expect(result!.conflictMarkers[0].baseContent).toBe('base content');
    expect(result!.conflictMarkers[0].incomingContent).toBe('incoming');
  });

  it('should return null for files without conflicts', () => {
    const content = `normal file content
no conflicts here
just regular code`;

    const result = detectConflicts(content, 'test.ts');
    expect(result).toBeNull();
  });

  it('should track line numbers correctly', () => {
    const content = `line 1
line 2
<<<<<<< HEAD
conflict
=======
other
>>>>>>> branch
line 8`;

    const result = detectConflicts(content, 'test.ts');

    expect(result!.conflictMarkers[0].startLine).toBe(3);
    expect(result!.conflictMarkers[0].endLine).toBe(7);
  });
});

describe.skip('suggestConflictResolution', () => {
  it('should suggest keep-incoming when current is empty', () => {
    const marker = {
      startLine: 1,
      endLine: 5,
      currentContent: '',
      incomingContent: 'new content',
    };

    const suggestions = suggestConflictResolution(marker);

    expect(suggestions[0].type).toBe('keep-incoming');
    expect(suggestions[0].confidence).toBe('high');
  });

  it('should suggest keep-current when incoming is empty', () => {
    const marker = {
      startLine: 1,
      endLine: 5,
      currentContent: 'existing content',
      incomingContent: '',
    };

    const suggestions = suggestConflictResolution(marker);

    expect(suggestions[0].type).toBe('keep-current');
    expect(suggestions[0].confidence).toBe('high');
  });

  it('should suggest keep-either when contents are identical', () => {
    const marker = {
      startLine: 1,
      endLine: 5,
      currentContent: 'same content',
      incomingContent: 'same content',
    };

    const suggestions = suggestConflictResolution(marker);

    expect(suggestions[0].type).toBe('keep-current');
    expect(suggestions[0].description).toContain('identical');
    expect(suggestions[0].confidence).toBe('high');
  });

  it('should suggest keep-incoming when it includes current content', () => {
    const marker = {
      startLine: 1,
      endLine: 5,
      currentContent: 'original',
      incomingContent: 'original\nplus more',
    };

    const suggestions = suggestConflictResolution(marker);
    const incomingSuggestion = suggestions.find((s) => s.type === 'keep-incoming');

    expect(incomingSuggestion).toBeDefined();
    expect(incomingSuggestion!.confidence).toBe('medium');
  });

  it('should always include keep-both and manual options', () => {
    const marker = {
      startLine: 1,
      endLine: 5,
      currentContent: 'completely different',
      incomingContent: 'nothing in common',
    };

    const suggestions = suggestConflictResolution(marker);
    const types = suggestions.map((s) => s.type);

    expect(types).toContain('keep-both');
    expect(types).toContain('manual');
  });
});

describe.skip('formatConflictReport', () => {
  it('should return no conflicts message for empty array', () => {
    const report = formatConflictReport([]);
    expect(report).toBe('No conflicts detected.');
  });

  it('should format conflict information', () => {
    const conflicts = [
      {
        file: 'src/test.ts',
        baseBranch: 'main',
        incomingBranch: 'feature',
        conflictMarkers: [
          {
            startLine: 10,
            endLine: 15,
            currentContent: 'current',
            incomingContent: 'incoming',
          },
        ],
      },
    ];

    const report = formatConflictReport(conflicts);

    expect(report).toContain('src/test.ts');
    expect(report).toContain('main');
    expect(report).toContain('feature');
    expect(report).toContain('lines 10-15');
  });
});
