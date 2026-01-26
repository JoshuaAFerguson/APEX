import { describe, it, expect } from 'vitest';
import {
  // Semantic Version Functions
  parseSemver,
  isPreRelease,
  compareVersions,
  getUpdateType,

  // Conventional Commit Functions
  parseConventionalCommit,
  createConventionalCommit,

  // Utility Functions
  safeJsonParse,
  deepMerge,
  retry,
  createDeferred,
  extractCodeBlocks,

  // Git Utilities
  detectConflicts,
  suggestConflictResolution,
  formatConflictReport,
  parseGitLog,
  groupCommitsByType,
  generateChangelogMarkdown,
  suggestCommitType,

  // Other utilities
  slugify,
  generateBranchName,
  calculateCost
} from '../utils.js';

describe('Advanced Utility Functions', () => {
  // ============================================================================
  // Semantic Version Tests
  // ============================================================================

  describe('Semantic Version Utilities', () => {
    describe('parseSemver', () => {
      it('parses valid semantic versions', () => {
        const result = parseSemver('1.2.3');
        expect(result).toEqual({
          major: 1,
          minor: 2,
          patch: 3,
          raw: '1.2.3'
        });
      });

      it('parses versions with prerelease', () => {
        const result = parseSemver('1.0.0-alpha.1');
        expect(result).toEqual({
          major: 1,
          minor: 0,
          patch: 0,
          prerelease: ['alpha', '1'],
          raw: '1.0.0-alpha.1'
        });
      });

      it('parses versions with build metadata', () => {
        const result = parseSemver('1.0.0+build.123');
        expect(result).toEqual({
          major: 1,
          minor: 0,
          patch: 0,
          build: ['build', '123'],
          raw: '1.0.0+build.123'
        });
      });

      it('parses versions with v prefix', () => {
        const result = parseSemver('v2.1.0');
        expect(result).toEqual({
          major: 2,
          minor: 1,
          patch: 0,
          raw: 'v2.1.0'
        });
      });

      it('returns null for invalid versions', () => {
        expect(parseSemver('invalid')).toBeNull();
        expect(parseSemver('')).toBeNull();
        expect(parseSemver('1.2')).toBeNull();
        expect(parseSemver('1.2.3.4')).toBeNull();
      });
    });

    describe('isPreRelease', () => {
      it('identifies prerelease versions', () => {
        expect(isPreRelease('1.0.0-alpha')).toBe(true);
        expect(isPreRelease('2.1.0-beta.1')).toBe(true);
        expect(isPreRelease('1.0.0-rc.1')).toBe(true);
      });

      it('identifies stable versions', () => {
        expect(isPreRelease('1.0.0')).toBe(false);
        expect(isPreRelease('2.1.0')).toBe(false);
        expect(isPreRelease('1.0.0+build.123')).toBe(false);
      });

      it('works with SemVer objects', () => {
        const prerelease = parseSemver('1.0.0-alpha.1')!;
        const stable = parseSemver('1.0.0')!;

        expect(isPreRelease(prerelease)).toBe(true);
        expect(isPreRelease(stable)).toBe(false);
      });
    });

    describe('compareVersions', () => {
      it('compares major versions', () => {
        expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
        expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
      });

      it('compares minor versions', () => {
        expect(compareVersions('1.2.0', '1.1.0')).toBe(1);
        expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
      });

      it('compares patch versions', () => {
        expect(compareVersions('1.0.2', '1.0.1')).toBe(1);
        expect(compareVersions('1.0.1', '1.0.2')).toBe(-1);
      });

      it('considers stable > prerelease', () => {
        expect(compareVersions('1.0.0', '1.0.0-alpha')).toBe(1);
        expect(compareVersions('1.0.0-alpha', '1.0.0')).toBe(-1);
      });

      it('compares prerelease identifiers', () => {
        expect(compareVersions('1.0.0-alpha.2', '1.0.0-alpha.1')).toBe(1);
        expect(compareVersions('1.0.0-beta', '1.0.0-alpha')).toBe(1);
      });

      it('returns 0 for equal versions', () => {
        expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
        expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.1')).toBe(0);
      });
    });

    describe('getUpdateType', () => {
      it('identifies major updates', () => {
        expect(getUpdateType('1.0.0', '2.0.0')).toBe('major');
      });

      it('identifies minor updates', () => {
        expect(getUpdateType('1.0.0', '1.1.0')).toBe('minor');
      });

      it('identifies patch updates', () => {
        expect(getUpdateType('1.0.0', '1.0.1')).toBe('patch');
      });

      it('identifies prerelease updates', () => {
        expect(getUpdateType('1.0.0-alpha.1', '1.0.0-alpha.2')).toBe('prerelease');
      });

      it('identifies downgrades', () => {
        expect(getUpdateType('2.0.0', '1.0.0')).toBe('downgrade');
      });

      it('identifies no update needed', () => {
        expect(getUpdateType('1.0.0', '1.0.0')).toBe('none');
      });
    });
  });

  // ============================================================================
  // Conventional Commit Tests
  // ============================================================================

  describe('Conventional Commit Utilities', () => {
    describe('parseConventionalCommit', () => {
      it('parses basic commit messages', () => {
        const result = parseConventionalCommit('feat: add new feature');
        expect(result).toEqual({
          type: 'feat',
          description: 'add new feature',
          breaking: false
        });
      });

      it('parses commits with scope', () => {
        const result = parseConventionalCommit('fix(auth): resolve login issue');
        expect(result).toEqual({
          type: 'fix',
          scope: 'auth',
          description: 'resolve login issue',
          breaking: false
        });
      });

      it('parses breaking changes', () => {
        const result = parseConventionalCommit('feat!: breaking API change');
        expect(result).toEqual({
          type: 'feat',
          description: 'breaking API change',
          breaking: true
        });
      });

      it('parses commits with body', () => {
        const message = 'feat: add feature\n\nThis is the body';
        const result = parseConventionalCommit(message);
        expect(result).toEqual({
          type: 'feat',
          description: 'add feature',
          body: 'This is the body',
          breaking: false
        });
      });

      it('returns null for invalid format', () => {
        expect(parseConventionalCommit('invalid commit message')).toBeNull();
        expect(parseConventionalCommit('')).toBeNull();
      });
    });

    describe('createConventionalCommit', () => {
      it('creates basic commit messages', () => {
        const result = createConventionalCommit('feat', 'add new feature');
        expect(result).toBe('feat: add new feature');
      });

      it('creates commits with scope', () => {
        const result = createConventionalCommit('fix', 'resolve issue', { scope: 'auth' });
        expect(result).toBe('fix(auth): resolve issue');
      });

      it('creates breaking changes', () => {
        const result = createConventionalCommit('feat', 'breaking change', { breaking: true });
        expect(result).toBe('feat!: breaking change');
      });

      it('creates commits with body', () => {
        const result = createConventionalCommit('feat', 'add feature', { body: 'Description' });
        expect(result).toBe('feat: add feature\n\nDescription');
      });

      it('creates complete commits', () => {
        const result = createConventionalCommit('feat', 'add feature', {
          scope: 'api',
          breaking: true,
          body: 'This is a breaking change'
        });
        expect(result).toBe('feat(api)!: add feature\n\nThis is a breaking change');
      });
    });
  });

  // ============================================================================
  // Utility Function Tests
  // ============================================================================

  describe('Utility Functions', () => {
    describe('safeJsonParse', () => {
      it('parses valid JSON', () => {
        const result = safeJsonParse('{"key": "value"}', {});
        expect(result).toEqual({ key: 'value' });
      });

      it('returns fallback for invalid JSON', () => {
        const fallback = { error: true };
        const result = safeJsonParse('invalid json', fallback);
        expect(result).toBe(fallback);
      });

      it('handles empty strings', () => {
        const result = safeJsonParse('', null);
        expect(result).toBeNull();
      });
    });

    describe('deepMerge', () => {
      it('merges simple objects', () => {
        const target = { a: 1, b: 2 };
        const source = { b: 3, c: 4 };
        const result = deepMerge(target, source);

        expect(result).toEqual({ a: 1, b: 3, c: 4 });
      });

      it('merges nested objects', () => {
        const target = { nested: { a: 1, b: 2 } };
        const source = { nested: { b: 3, c: 4 } };
        const result = deepMerge(target, source);

        expect(result).toEqual({ nested: { a: 1, b: 3, c: 4 } });
      });

      it('does not merge arrays', () => {
        const target = { arr: [1, 2] };
        const source = { arr: [3, 4] };
        const result = deepMerge(target, source);

        expect(result).toEqual({ arr: [3, 4] });
      });

      it('preserves original objects', () => {
        const target = { a: 1, nested: { b: 2 } };
        const source = { nested: { c: 3 } };
        const result = deepMerge(target, source);

        expect(target).toEqual({ a: 1, nested: { b: 2 } });
        expect(result.nested).not.toBe(target.nested);
      });
    });

    describe('retry', () => {
      it('succeeds on first attempt', async () => {
        const fn = vi.fn().mockResolvedValue('success');
        const result = await retry(fn);

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('retries on failure and eventually succeeds', async () => {
        const fn = vi.fn()
          .mockRejectedValueOnce(new Error('fail 1'))
          .mockRejectedValueOnce(new Error('fail 2'))
          .mockResolvedValue('success');

        const result = await retry(fn);

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(3);
      });

      it('throws last error after max attempts', async () => {
        const error = new Error('persistent failure');
        const fn = vi.fn().mockRejectedValue(error);

        await expect(retry(fn, { maxAttempts: 2 })).rejects.toThrow('persistent failure');
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('respects custom retry options', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('fail'));

        const start = Date.now();
        await expect(retry(fn, {
          maxAttempts: 2,
          initialDelay: 10,
          maxDelay: 100
        })).rejects.toThrow();
        const elapsed = Date.now() - start;

        expect(elapsed).toBeGreaterThanOrEqual(10);
        expect(fn).toHaveBeenCalledTimes(2);
      });
    });

    describe('createDeferred', () => {
      it('creates a deferred promise', () => {
        const deferred = createDeferred<string>();

        expect(deferred.promise).toBeInstanceOf(Promise);
        expect(typeof deferred.resolve).toBe('function');
        expect(typeof deferred.reject).toBe('function');
      });

      it('resolves with value', async () => {
        const deferred = createDeferred<string>();

        setTimeout(() => deferred.resolve('test'), 10);

        const result = await deferred.promise;
        expect(result).toBe('test');
      });

      it('rejects with error', async () => {
        const deferred = createDeferred<string>();
        const error = new Error('test error');

        setTimeout(() => deferred.reject(error), 10);

        await expect(deferred.promise).rejects.toThrow('test error');
      });
    });

    describe('extractCodeBlocks', () => {
      it('extracts code blocks from markdown', () => {
        const markdown = `
Text before

\`\`\`javascript
console.log('hello');
\`\`\`

More text

\`\`\`python
print('world')
\`\`\`

Text after
        `;

        const blocks = extractCodeBlocks(markdown);

        expect(blocks).toHaveLength(2);
        expect(blocks[0]).toEqual({
          language: 'javascript',
          code: "console.log('hello');"
        });
        expect(blocks[1]).toEqual({
          language: 'python',
          code: "print('world')"
        });
      });

      it('handles blocks without language', () => {
        const markdown = '```\nplain code\n```';
        const blocks = extractCodeBlocks(markdown);

        expect(blocks).toHaveLength(1);
        expect(blocks[0]).toEqual({
          language: 'plaintext',
          code: 'plain code'
        });
      });

      it('returns empty array for no code blocks', () => {
        const markdown = 'Just regular text';
        const blocks = extractCodeBlocks(markdown);

        expect(blocks).toEqual([]);
      });
    });
  });

  // ============================================================================
  // Git Utilities Tests
  // ============================================================================

  describe('Git Utilities', () => {
    describe('detectConflicts', () => {
      it('detects simple conflicts', () => {
        const content = `
Some content
<<<<<<< HEAD
Current content
=======
Incoming content
>>>>>>> feature-branch
More content
        `;

        const result = detectConflicts(content, 'test.txt');

        expect(result).not.toBeNull();
        expect(result!.conflictMarkers).toHaveLength(1);
        expect(result!.conflictMarkers[0]).toMatchObject({
          currentContent: 'Current content',
          incomingContent: 'Incoming content'
        });
      });

      it('handles diff3 style conflicts', () => {
        const content = `
<<<<<<< HEAD
Current content
||||||| base
Base content
=======
Incoming content
>>>>>>> feature
        `;

        const result = detectConflicts(content, 'test.txt');

        expect(result).not.toBeNull();
        expect(result!.conflictMarkers[0]).toMatchObject({
          currentContent: 'Current content',
          baseContent: 'Base content',
          incomingContent: 'Incoming content'
        });
      });

      it('returns null for no conflicts', () => {
        const content = 'Regular file content without conflicts';
        const result = detectConflicts(content, 'test.txt');

        expect(result).toBeNull();
      });

      it('handles multiple conflicts in one file', () => {
        const content = `
<<<<<<< HEAD
First conflict current
=======
First conflict incoming
>>>>>>> branch

Some content

<<<<<<< HEAD
Second conflict current
=======
Second conflict incoming
>>>>>>> branch
        `;

        const result = detectConflicts(content, 'test.txt');

        expect(result).not.toBeNull();
        expect(result!.conflictMarkers).toHaveLength(2);
      });
    });

    describe('suggestConflictResolution', () => {
      it('suggests keeping incoming for empty current', () => {
        const marker = {
          startLine: 1,
          endLine: 5,
          currentContent: '',
          incomingContent: 'new content'
        };

        const suggestions = suggestConflictResolution(marker);
        const topSuggestion = suggestions.find(s => s.confidence === 'high');

        expect(topSuggestion?.type).toBe('keep-incoming');
      });

      it('suggests keeping current for empty incoming', () => {
        const marker = {
          startLine: 1,
          endLine: 5,
          currentContent: 'existing content',
          incomingContent: ''
        };

        const suggestions = suggestConflictResolution(marker);
        const topSuggestion = suggestions.find(s => s.confidence === 'high');

        expect(topSuggestion?.type).toBe('keep-current');
      });

      it('suggests keeping either for identical content', () => {
        const marker = {
          startLine: 1,
          endLine: 5,
          currentContent: 'same content',
          incomingContent: 'same content'
        };

        const suggestions = suggestConflictResolution(marker);
        const topSuggestion = suggestions.find(s => s.confidence === 'high');

        expect(topSuggestion?.type).toBe('keep-current');
      });

      it('always includes manual resolution option', () => {
        const marker = {
          startLine: 1,
          endLine: 5,
          currentContent: 'current',
          incomingContent: 'incoming'
        };

        const suggestions = suggestConflictResolution(marker);
        const manualSuggestion = suggestions.find(s => s.type === 'manual');

        expect(manualSuggestion).toBeDefined();
      });
    });

    describe('formatConflictReport', () => {
      it('reports no conflicts', () => {
        const report = formatConflictReport([]);
        expect(report).toBe('No conflicts detected.');
      });

      it('formats single conflict', () => {
        const conflicts = [{
          file: 'test.txt',
          baseBranch: 'main',
          incomingBranch: 'feature',
          conflictMarkers: [{
            startLine: 1,
            endLine: 5,
            currentContent: 'current',
            incomingContent: 'incoming'
          }]
        }];

        const report = formatConflictReport(conflicts);

        expect(report).toContain('test.txt');
        expect(report).toContain('main ← feature');
        expect(report).toContain('Conflicts: 1');
      });
    });

    describe('parseGitLog', () => {
      it('parses git log output', () => {
        const logOutput = `commit abc123def
Author: John Doe <john@example.com>
Date:   Mon Jan 1 00:00:00 2024 +0000

    feat: add new feature

commit def456ghi
Author: Jane Smith <jane@example.com>
Date:   Sun Dec 31 23:59:59 2023 +0000

    fix(bug): resolve issue`;

        const entries = parseGitLog(logOutput);

        expect(entries).toHaveLength(2);
        expect(entries[0]).toMatchObject({
          hash: 'abc123def',
          shortHash: 'abc123d',
          author: 'John Doe <john@example.com>',
          message: 'feat: add new feature'
        });
        expect(entries[0].conventional).toMatchObject({
          type: 'feat',
          description: 'add new feature'
        });
      });
    });

    describe('suggestCommitType', () => {
      it('suggests test for test files', () => {
        const files = ['test/example.test.js', 'src/utils.spec.ts'];
        expect(suggestCommitType(files)).toBe('test');
      });

      it('suggests docs for documentation files', () => {
        const files = ['README.md', 'docs/api.md'];
        expect(suggestCommitType(files)).toBe('docs');
      });

      it('suggests build for package files', () => {
        const files = ['package.json', 'yarn.lock'];
        expect(suggestCommitType(files)).toBe('build');
      });

      it('defaults to feat for new files', () => {
        const files = ['src/new-feature.ts'];
        expect(suggestCommitType(files)).toBe('feat');
      });
    });
  });

  // ============================================================================
  // Other Utility Tests
  // ============================================================================

  describe('Other Utilities', () => {
    describe('slugify', () => {
      it('converts text to lowercase slug', () => {
        expect(slugify('Hello World')).toBe('hello-world');
      });

      it('removes special characters', () => {
        expect(slugify('Hello, World!')).toBe('hello-world');
      });

      it('handles multiple spaces', () => {
        expect(slugify('Hello    World')).toBe('hello-world');
      });

      it('truncates long strings', () => {
        const long = 'A'.repeat(60);
        const result = slugify(long);
        expect(result.length).toBeLessThanOrEqual(50);
      });
    });

    describe('generateBranchName', () => {
      it('generates formatted branch name', () => {
        const result = generateBranchName('feature/', 'task_abc123_def', 'Add user authentication');
        expect(result).toMatch(/^feature\/[a-z0-9]+-add-user-authentication$/);
      });

      it('handles task IDs with underscores', () => {
        const result = generateBranchName('fix/', 'task_1234567890_abcd', 'Fix login bug');
        expect(result).toContain('1234567890');
      });
    });

    describe('calculateCost', () => {
      it('calculates cost correctly', () => {
        const cost = calculateCost(1000000, 500000); // 1M input, 500K output
        // Based on pricing: input $3/M, output $15/M
        // Expected: (1 * 3) + (0.5 * 15) = 10.5
        expect(cost).toBe(10.5);
      });

      it('rounds to 4 decimal places', () => {
        const cost = calculateCost(1000, 1000); // Small amounts
        expect(cost.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(4);
      });

      it('handles zero tokens', () => {
        expect(calculateCost(0, 0)).toBe(0);
      });
    });
  });
});