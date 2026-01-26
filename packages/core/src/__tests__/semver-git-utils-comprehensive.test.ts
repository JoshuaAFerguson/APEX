import { describe, it, expect } from 'vitest';
import {
  // Semver utilities
  parseSemver,
  compareVersions,
  isPreRelease,
  getUpdateType,
  type SemVer,
  type UpdateType,

  // Conventional commit utilities
  parseConventionalCommit,
  createConventionalCommit,
  COMMIT_TYPES,
  suggestCommitType,
  type ConventionalCommit,
  type CommitType,

  // Git utilities
  detectConflicts,
  suggestConflictResolution,
  formatConflictReport,
  parseGitLog,
  groupCommitsByType,
  generateChangelogMarkdown,
  type ConflictInfo,
  type ConflictSuggestion,
  type GitLogEntry
} from '../utils';

/**
 * Comprehensive test suite for semver and git utilities documented in the README
 *
 * This test file verifies all examples and functionality documented in the README,
 * ensuring that the utilities work as documented and handle edge cases properly.
 */

describe('Semver and Git Utilities - README Examples', () => {

  describe('Semantic Versioning Utilities', () => {

    describe('parseSemver function', () => {
      it('should parse semantic version strings as documented in README', () => {
        const version = parseSemver('1.2.3-alpha.1+build.123');
        expect(version).toEqual({
          major: 1,
          minor: 2,
          patch: 3,
          prerelease: ['alpha', '1'],
          build: ['build', '123'],
          raw: '1.2.3-alpha.1+build.123'
        });
      });

      it('should parse simple versions', () => {
        const version = parseSemver('1.0.0');
        expect(version).toEqual({
          major: 1,
          minor: 0,
          patch: 0,
          raw: '1.0.0'
        });
      });

      it('should parse versions with v prefix', () => {
        const version = parseSemver('v2.1.0');
        expect(version).toEqual({
          major: 2,
          minor: 1,
          patch: 0,
          raw: 'v2.1.0'
        });
      });

      it('should parse prerelease versions', () => {
        const version = parseSemver('1.0.0-beta.2');
        expect(version).toEqual({
          major: 1,
          minor: 0,
          patch: 0,
          prerelease: ['beta', '2'],
          raw: '1.0.0-beta.2'
        });
      });

      it('should parse versions with build metadata', () => {
        const version = parseSemver('1.0.0+20130313144700');
        expect(version).toEqual({
          major: 1,
          minor: 0,
          patch: 0,
          build: ['20130313144700'],
          raw: '1.0.0+20130313144700'
        });
      });

      it('should return null for invalid versions', () => {
        expect(parseSemver('invalid')).toBeNull();
        expect(parseSemver('1.2')).toBeNull();
        expect(parseSemver('1.2.3.4')).toBeNull();
        expect(parseSemver('')).toBeNull();
        expect(parseSemver('   ')).toBeNull();
      });

      it('should handle edge cases gracefully', () => {
        expect(parseSemver(null as any)).toBeNull();
        expect(parseSemver(undefined as any)).toBeNull();
        expect(parseSemver(123 as any)).toBeNull();
        expect(parseSemver({} as any)).toBeNull();
      });
    });

    describe('compareVersions function', () => {
      it('should compare versions as documented in README', () => {
        expect(compareVersions('1.0.0', '2.0.0')).toBe(-1); // first is older
        expect(compareVersions('2.0.0', '1.0.0')).toBe(1);  // first is newer
        expect(compareVersions('1.0.0', '1.0.0')).toBe(0);  // equal
      });

      it('should handle prerelease versions as documented', () => {
        expect(compareVersions('1.0.0-alpha', '1.0.0')).toBe(-1);      // prerelease < stable
        expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1); // alpha < beta
      });

      it('should compare major versions correctly', () => {
        expect(compareVersions('1.9.9', '2.0.0')).toBe(-1);
        expect(compareVersions('10.0.0', '2.0.0')).toBe(1);
      });

      it('should compare minor versions correctly', () => {
        expect(compareVersions('1.1.9', '1.2.0')).toBe(-1);
        expect(compareVersions('1.10.0', '1.2.0')).toBe(1);
      });

      it('should compare patch versions correctly', () => {
        expect(compareVersions('1.0.1', '1.0.2')).toBe(-1);
        expect(compareVersions('1.0.10', '1.0.2')).toBe(1);
      });

      it('should handle complex prerelease comparison', () => {
        expect(compareVersions('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1);
        expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.beta')).toBe(-1);
        expect(compareVersions('1.0.0-alpha.beta', '1.0.0-beta')).toBe(-1);
        expect(compareVersions('1.0.0-beta', '1.0.0-beta.2')).toBe(-1);
        expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.11')).toBe(-1);
        expect(compareVersions('1.0.0-beta.11', '1.0.0-rc.1')).toBe(-1);
      });

      it('should handle invalid versions gracefully', () => {
        expect(compareVersions('invalid', '1.0.0')).toBe(-1);
        expect(compareVersions('1.0.0', 'invalid')).toBe(1);
        expect(compareVersions('invalid', 'invalid')).toBe(0);
      });
    });

    describe('isPreRelease function', () => {
      it('should identify prerelease versions as documented in README', () => {
        expect(isPreRelease('1.0.0')).toBe(false);
        expect(isPreRelease('1.0.0-alpha')).toBe(true);
        expect(isPreRelease('1.0.0-beta.1')).toBe(true);
        expect(isPreRelease('1.0.0+build.123')).toBe(false); // build metadata ≠ prerelease
      });

      it('should work with parsed SemVer objects', () => {
        const stableVersion = parseSemver('1.0.0')!;
        const prereleaseVersion = parseSemver('1.0.0-alpha')!;

        expect(isPreRelease(stableVersion)).toBe(false);
        expect(isPreRelease(prereleaseVersion)).toBe(true);
      });

      it('should handle various prerelease formats', () => {
        expect(isPreRelease('1.0.0-alpha')).toBe(true);
        expect(isPreRelease('1.0.0-beta')).toBe(true);
        expect(isPreRelease('1.0.0-rc')).toBe(true);
        expect(isPreRelease('1.0.0-dev')).toBe(true);
        expect(isPreRelease('1.0.0-snapshot')).toBe(true);
        expect(isPreRelease('1.0.0-1')).toBe(true);
      });

      it('should return false for invalid versions', () => {
        expect(isPreRelease('invalid')).toBe(false);
        expect(isPreRelease('')).toBe(false);
        expect(isPreRelease(null as any)).toBe(false);
        expect(isPreRelease(undefined as any)).toBe(false);
      });
    });

    describe('getUpdateType function', () => {
      it('should determine update types as documented in README', () => {
        expect(getUpdateType('1.0.0', '2.0.0')).toBe('major');
        expect(getUpdateType('1.0.0', '1.1.0')).toBe('minor');
        expect(getUpdateType('1.0.0', '1.0.1')).toBe('patch');
        expect(getUpdateType('1.0.0-alpha', '1.0.0')).toBe('prerelease');
        expect(getUpdateType('1.0.0', '1.0.0')).toBe('none');
        expect(getUpdateType('2.0.0', '1.0.0')).toBe('downgrade');
      });

      it('should prioritize major changes', () => {
        expect(getUpdateType('1.0.0', '2.1.5')).toBe('major');
        expect(getUpdateType('1.5.10', '2.0.0')).toBe('major');
      });

      it('should prioritize minor changes over patch', () => {
        expect(getUpdateType('1.0.0', '1.1.5')).toBe('minor');
        expect(getUpdateType('1.2.0', '1.5.10')).toBe('minor');
      });

      it('should handle prerelease transitions', () => {
        expect(getUpdateType('1.0.0-alpha', '1.0.0-beta')).toBe('prerelease');
        expect(getUpdateType('1.0.0-alpha.1', '1.0.0-alpha.2')).toBe('prerelease');
        expect(getUpdateType('1.0.0', '1.0.0-alpha')).toBe('prerelease');
      });

      it('should handle invalid versions', () => {
        expect(getUpdateType('invalid', '1.0.0')).toBe('none');
        expect(getUpdateType('1.0.0', 'invalid')).toBe('none');
        expect(getUpdateType('invalid', 'invalid')).toBe('none');
      });
    });
  });

  describe('Conventional Commits', () => {

    describe('parseConventionalCommit function', () => {
      it('should parse conventional commit messages as documented in README', () => {
        const commit = parseConventionalCommit('feat(auth): add OAuth login\n\nSupports Google and GitHub');
        expect(commit).toEqual({
          type: 'feat',
          scope: 'auth',
          description: 'add OAuth login',
          body: 'Supports Google and GitHub',
          breaking: false
        });
      });

      it('should parse breaking changes with !', () => {
        const commit = parseConventionalCommit('feat!: remove deprecated API');
        expect(commit).toEqual({
          type: 'feat',
          description: 'remove deprecated API',
          breaking: true,
          scope: undefined,
          body: undefined
        });
      });

      it('should parse simple commit without scope or body', () => {
        const commit = parseConventionalCommit('fix: resolve login issue');
        expect(commit).toEqual({
          type: 'fix',
          description: 'resolve login issue',
          breaking: false,
          scope: undefined,
          body: undefined
        });
      });

      it('should parse commit with scope but no body', () => {
        const commit = parseConventionalCommit('docs(api): update README');
        expect(commit).toEqual({
          type: 'docs',
          scope: 'api',
          description: 'update README',
          breaking: false,
          body: undefined
        });
      });

      it('should return null for non-conventional messages', () => {
        expect(parseConventionalCommit('Add new feature')).toBeNull();
        expect(parseConventionalCommit('Update README.md')).toBeNull();
        expect(parseConventionalCommit('')).toBeNull();
        expect(parseConventionalCommit('invalid format')).toBeNull();
      });

      it('should handle multi-line body correctly', () => {
        const message = `feat(ui): add dark mode support

This includes:
- System preference detection
- Toggle button in settings
- CSS variable updates

Fixes #123`;

        const commit = parseConventionalCommit(message);
        expect(commit?.body).toContain('This includes:');
        expect(commit?.body).toContain('Fixes #123');
      });
    });

    describe('createConventionalCommit function', () => {
      it('should create conventional commit messages as documented in README', () => {
        expect(createConventionalCommit('fix', 'resolve login issue')).toBe('fix: resolve login issue');
      });

      it('should create commit with scope and body', () => {
        const message = createConventionalCommit('feat', 'add dark mode', {
          scope: 'ui',
          body: 'Includes system preference detection',
          breaking: false
        });
        expect(message).toBe('feat(ui): add dark mode\n\nIncludes system preference detection');
      });

      it('should create breaking change commit', () => {
        const message = createConventionalCommit('refactor', 'update API', { breaking: true });
        expect(message).toBe('refactor!: update API');
      });

      it('should create commit with scope and breaking change', () => {
        const message = createConventionalCommit('feat', 'new auth system', {
          scope: 'auth',
          breaking: true,
          body: 'Completely replaces old authentication'
        });
        expect(message).toBe('feat(auth)!: new auth system\n\nCompletely replaces old authentication');
      });
    });

    describe('COMMIT_TYPES constant', () => {
      it('should have feat type as documented in README', () => {
        expect(COMMIT_TYPES.feat).toEqual({
          title: 'Features',
          emoji: '✨',
          description: 'New features'
        });
      });

      it('should have all standard commit types', () => {
        const expectedTypes = [
          'feat', 'fix', 'docs', 'style', 'refactor',
          'perf', 'test', 'build', 'ci', 'chore', 'revert'
        ];

        for (const type of expectedTypes) {
          expect(COMMIT_TYPES).toHaveProperty(type);
          expect(COMMIT_TYPES[type as CommitType]).toHaveProperty('title');
          expect(COMMIT_TYPES[type as CommitType]).toHaveProperty('emoji');
          expect(COMMIT_TYPES[type as CommitType]).toHaveProperty('description');
        }
      });
    });

    describe('suggestCommitType function', () => {
      it('should suggest commit types as documented in README', () => {
        expect(suggestCommitType(['src/auth.test.ts', 'src/login.test.ts'])).toBe('test');
        expect(suggestCommitType(['README.md', 'docs/api.md'])).toBe('docs');
        expect(suggestCommitType(['src/api.ts', 'src/utils.ts'])).toBe('feat');
      });

      it('should suggest test for test files', () => {
        expect(suggestCommitType(['src/component.test.js'])).toBe('test');
        expect(suggestCommitType(['tests/unit/api.spec.ts'])).toBe('test');
        expect(suggestCommitType(['__tests__/utils.js'])).toBe('test');
      });

      it('should suggest docs for documentation files', () => {
        expect(suggestCommitType(['README.md'])).toBe('docs');
        expect(suggestCommitType(['docs/guide.md'])).toBe('docs');
        expect(suggestCommitType(['CHANGELOG.md'])).toBe('docs');
      });

      it('should suggest style for style files', () => {
        expect(suggestCommitType(['src/styles.css'])).toBe('style');
        expect(suggestCommitType(['components/Button.scss'])).toBe('style');
        expect(suggestCommitType(['theme.less'])).toBe('style');
      });

      it('should suggest build for build files', () => {
        expect(suggestCommitType(['package.json'])).toBe('build');
        expect(suggestCommitType(['yarn.lock'])).toBe('build');
        expect(suggestCommitType(['package-lock.json'])).toBe('build');
      });

      it('should suggest ci for CI files', () => {
        expect(suggestCommitType(['.github/workflows/ci.yml'])).toBe('ci');
        expect(suggestCommitType(['.gitlab-ci.yml'])).toBe('ci');
        expect(suggestCommitType(['.circleci/config.yml'])).toBe('ci');
      });

      it('should suggest chore for config files', () => {
        expect(suggestCommitType(['.eslintrc.js'])).toBe('chore');
        expect(suggestCommitType(['.prettierrc'])).toBe('chore');
        expect(suggestCommitType(['tsconfig.json'])).toBe('chore');
      });

      it('should default to feat for unknown file types', () => {
        expect(suggestCommitType(['src/newfeature.js'])).toBe('feat');
        expect(suggestCommitType(['lib/utils.ts'])).toBe('feat');
      });

      it('should handle empty file list', () => {
        expect(suggestCommitType([])).toBe('chore');
      });
    });
  });

  describe('Git Utilities', () => {

    describe('detectConflicts function', () => {
      it('should detect merge conflicts as documented in README', () => {
        const fileContent = `
function hello() {
<<<<<<< HEAD
  console.log("Hello from main");
=======
  console.log("Hello from feature");
>>>>>>> feature-branch
}
`;

        const conflicts = detectConflicts(fileContent, 'src/hello.ts');
        expect(conflicts).toEqual({
          file: 'src/hello.ts',
          conflictMarkers: [{
            startLine: 3,
            endLine: 7,
            currentContent: '  console.log("Hello from main");',
            incomingContent: '  console.log("Hello from feature");'
          }],
          baseBranch: 'HEAD',
          incomingBranch: 'feature-branch'
        });
      });

      it('should detect multiple conflicts in a file', () => {
        const fileContent = `
function a() {
<<<<<<< main
  return 'main';
=======
  return 'feature';
>>>>>>> feature
}

function b() {
<<<<<<< main
  return 'original';
=======
  return 'modified';
>>>>>>> feature
}
`;

        const conflicts = detectConflicts(fileContent, 'test.js');
        expect(conflicts?.conflictMarkers).toHaveLength(2);
        expect(conflicts?.conflictMarkers[0].startLine).toBe(3);
        expect(conflicts?.conflictMarkers[1].startLine).toBe(10);
      });

      it('should handle diff3 style conflicts with base', () => {
        const fileContent = `
<<<<<<< HEAD
current content
||||||| base
base content
=======
incoming content
>>>>>>> feature
`;

        const conflicts = detectConflicts(fileContent, 'test.js');
        expect(conflicts?.conflictMarkers[0]).toEqual({
          startLine: 2,
          endLine: 7,
          currentContent: 'current content',
          baseContent: 'base content',
          incomingContent: 'incoming content'
        });
      });

      it('should return null for files without conflicts', () => {
        const fileContent = `
function hello() {
  console.log("No conflicts here");
}
`;

        expect(detectConflicts(fileContent, 'test.js')).toBeNull();
      });

      it('should handle empty files', () => {
        expect(detectConflicts('', 'empty.js')).toBeNull();
        expect(detectConflicts('   \n   \n   ', 'whitespace.js')).toBeNull();
      });
    });

    describe('suggestConflictResolution function', () => {
      it('should suggest keeping incoming when current is empty', () => {
        const marker = {
          startLine: 1,
          endLine: 5,
          currentContent: '',
          incomingContent: 'new content'
        };

        const suggestions = suggestConflictResolution(marker);
        const topSuggestion = suggestions.find(s => s.confidence === 'high');

        expect(topSuggestion).toEqual({
          type: 'keep-incoming',
          description: 'Accept incoming changes (current side is empty)',
          resolvedContent: 'new content',
          confidence: 'high',
          reason: 'Current branch removed this content, incoming branch has additions'
        });
      });

      it('should suggest keeping current when incoming is empty', () => {
        const marker = {
          startLine: 1,
          endLine: 5,
          currentContent: 'existing content',
          incomingContent: ''
        };

        const suggestions = suggestConflictResolution(marker);
        const topSuggestion = suggestions.find(s => s.confidence === 'high');

        expect(topSuggestion).toEqual({
          type: 'keep-current',
          description: 'Keep current changes (incoming side is empty)',
          resolvedContent: 'existing content',
          confidence: 'high',
          reason: 'Current branch has content, incoming branch removed it'
        });
      });

      it('should suggest keeping either when contents are identical', () => {
        const marker = {
          startLine: 1,
          endLine: 5,
          currentContent: '  same content  \n',
          incomingContent: 'same content'
        };

        const suggestions = suggestConflictResolution(marker);
        const topSuggestion = suggestions.find(s => s.confidence === 'high');

        expect(topSuggestion?.type).toBe('keep-current');
        expect(topSuggestion?.description).toBe('Keep either (contents are identical)');
      });

      it('should suggest keeping incoming when it includes current content', () => {
        const marker = {
          startLine: 1,
          endLine: 5,
          currentContent: 'function test() {}',
          incomingContent: 'function test() {}\nfunction extra() {}'
        };

        const suggestions = suggestConflictResolution(marker);
        const mediumSuggestion = suggestions.find(s => s.confidence === 'medium' && s.type === 'keep-incoming');

        expect(mediumSuggestion?.description).toBe('Accept incoming (includes current content plus additions)');
      });

      it('should always provide keep-both and manual options', () => {
        const marker = {
          startLine: 1,
          endLine: 5,
          currentContent: 'current',
          incomingContent: 'incoming'
        };

        const suggestions = suggestConflictResolution(marker);

        expect(suggestions.find(s => s.type === 'keep-both')).toBeDefined();
        expect(suggestions.find(s => s.type === 'manual')).toBeDefined();
      });
    });

    describe('formatConflictReport function', () => {
      it('should format conflict reports as documented in README', () => {
        const conflicts: ConflictInfo[] = [{
          file: 'src/hello.ts',
          conflictMarkers: [{
            startLine: 3,
            endLine: 7,
            currentContent: '  console.log("Hello from main");',
            incomingContent: '  console.log("Hello from feature");'
          }],
          baseBranch: 'HEAD',
          incomingBranch: 'feature-branch'
        }];

        const report = formatConflictReport(conflicts);
        expect(report).toContain('Found 1 file(s) with conflicts:');
        expect(report).toContain('📄 src/hello.ts');
        expect(report).toContain('Branches: HEAD ← feature-branch');
        expect(report).toContain('Conflicts: 1');
      });

      it('should handle empty conflicts array', () => {
        const report = formatConflictReport([]);
        expect(report).toBe('No conflicts detected.');
      });

      it('should handle multiple files with multiple conflicts', () => {
        const conflicts: ConflictInfo[] = [
          {
            file: 'file1.js',
            conflictMarkers: [
              { startLine: 1, endLine: 5, currentContent: 'a', incomingContent: 'b' },
              { startLine: 10, endLine: 15, currentContent: 'c', incomingContent: 'd' }
            ]
          },
          {
            file: 'file2.js',
            conflictMarkers: [
              { startLine: 20, endLine: 25, currentContent: 'e', incomingContent: 'f' }
            ]
          }
        ];

        const report = formatConflictReport(conflicts);
        expect(report).toContain('Found 2 file(s) with conflicts:');
        expect(report).toContain('file1.js');
        expect(report).toContain('file2.js');
        expect(report).toContain('Conflicts: 2');
        expect(report).toContain('Conflicts: 1');
      });
    });

    describe('parseGitLog function', () => {
      it('should parse git log output as documented in README', () => {
        const logOutput = `commit abc123
Author: John Doe <john@example.com>
Date: Mon Jan 1 12:00:00 2023

feat(auth): add OAuth support

commit def456
Author: Jane Smith <jane@example.com>
Date: Mon Jan 1 11:00:00 2023

fix: resolve login bug`;

        const entries = parseGitLog(logOutput);
        expect(entries).toHaveLength(2);

        expect(entries[0]).toEqual({
          hash: 'abc123',
          shortHash: 'abc123',
          author: 'John Doe <john@example.com>',
          date: new Date('Mon Jan 1 12:00:00 2023'),
          message: 'feat(auth): add OAuth support',
          conventional: {
            type: 'feat',
            scope: 'auth',
            description: 'add OAuth support',
            breaking: false,
            body: undefined
          }
        });
      });

      it('should handle commits with multi-line messages', () => {
        const logOutput = `commit abc123
Author: John Doe <john@example.com>
Date: Mon Jan 1 12:00:00 2023

feat(api): add new endpoint

This adds support for user authentication
with OAuth providers including Google and GitHub.

Fixes #123
Closes #456`;

        const entries = parseGitLog(logOutput);
        expect(entries).toHaveLength(1);
        expect(entries[0].message).toContain('This adds support');
        expect(entries[0].message).toContain('Fixes #123');
        expect(entries[0].conventional?.description).toBe('add new endpoint');
      });

      it('should handle non-conventional commit messages', () => {
        const logOutput = `commit abc123
Author: John Doe <john@example.com>
Date: Mon Jan 1 12:00:00 2023

Update README and fix typos`;

        const entries = parseGitLog(logOutput);
        expect(entries).toHaveLength(1);
        expect(entries[0].conventional).toBeUndefined();
        expect(entries[0].message).toBe('Update README and fix typos');
      });

      it('should handle empty log output', () => {
        expect(parseGitLog('')).toEqual([]);
        expect(parseGitLog('   \n   ')).toEqual([]);
      });

      it('should handle malformed log entries gracefully', () => {
        const logOutput = `commit abc123
Author: John Doe
Date: Invalid Date

feat: test commit`;

        const entries = parseGitLog(logOutput);
        expect(entries).toHaveLength(1);
        expect(entries[0].date).toEqual(new Date('Invalid Date'));
      });
    });

    describe('groupCommitsByType function', () => {
      it('should group commits by type as documented in README', () => {
        const entries: GitLogEntry[] = [
          {
            hash: 'abc123',
            shortHash: 'abc123',
            author: 'John Doe',
            date: new Date(),
            message: 'feat: add feature',
            conventional: { type: 'feat', description: 'add feature', breaking: false }
          },
          {
            hash: 'def456',
            shortHash: 'def456',
            author: 'Jane Smith',
            date: new Date(),
            message: 'fix: fix bug',
            conventional: { type: 'fix', description: 'fix bug', breaking: false }
          },
          {
            hash: 'ghi789',
            shortHash: 'ghi789',
            author: 'Bob Johnson',
            date: new Date(),
            message: 'Update README',
            conventional: undefined
          }
        ];

        const groups = groupCommitsByType(entries);

        expect(groups).toHaveLength(3);
        expect(groups[0]).toEqual({
          type: 'feat',
          title: 'Features',
          commits: [entries[0]]
        });
        expect(groups[1]).toEqual({
          type: 'fix',
          title: 'Bug Fixes',
          commits: [entries[1]]
        });
        expect(groups[2]).toEqual({
          type: 'other',
          title: 'Other Changes',
          commits: [entries[2]]
        });
      });

      it('should handle empty entries array', () => {
        expect(groupCommitsByType([])).toEqual([]);
      });

      it('should group multiple commits of same type', () => {
        const entries: GitLogEntry[] = [
          {
            hash: 'abc123',
            shortHash: 'abc123',
            author: 'John',
            date: new Date(),
            message: 'feat: feature 1',
            conventional: { type: 'feat', description: 'feature 1', breaking: false }
          },
          {
            hash: 'def456',
            shortHash: 'def456',
            author: 'Jane',
            date: new Date(),
            message: 'feat: feature 2',
            conventional: { type: 'feat', description: 'feature 2', breaking: false }
          }
        ];

        const groups = groupCommitsByType(entries);
        expect(groups).toHaveLength(1);
        expect(groups[0].commits).toHaveLength(2);
      });
    });

    describe('generateChangelogMarkdown function', () => {
      it('should generate changelog markdown as documented in README', () => {
        const date = new Date('2023-01-01');
        const groups = [
          {
            type: 'feat' as const,
            title: 'Features',
            commits: [{
              hash: 'abc123',
              shortHash: 'abc123',
              author: 'John Doe',
              date: new Date(),
              message: 'feat(auth): add OAuth support',
              conventional: {
                type: 'feat',
                scope: 'auth',
                description: 'add OAuth support',
                breaking: false
              }
            }]
          },
          {
            type: 'fix' as const,
            title: 'Bug Fixes',
            commits: [{
              hash: 'def456',
              shortHash: 'def456',
              author: 'Jane Smith',
              date: new Date(),
              message: 'fix: resolve login bug',
              conventional: {
                type: 'fix',
                description: 'resolve login bug',
                breaking: false
              }
            }]
          }
        ];

        const changelog = generateChangelogMarkdown('1.2.0', date, groups, {
          includeHashes: true,
          repoUrl: 'https://github.com/user/repo'
        });

        expect(changelog).toContain('## [1.2.0] - 2023-01-01');
        expect(changelog).toContain('### ✨ Features');
        expect(changelog).toContain('- **auth:** add OAuth support ([abc123](https://github.com/user/repo/commit/abc123))');
        expect(changelog).toContain('### 🐛 Bug Fixes');
        expect(changelog).toContain('- resolve login bug ([def456](https://github.com/user/repo/commit/def456))');
      });

      it('should handle breaking changes with warning emoji', () => {
        const groups = [{
          type: 'feat' as const,
          title: 'Features',
          commits: [{
            hash: 'abc123',
            shortHash: 'abc123',
            author: 'John',
            date: new Date(),
            message: 'feat!: breaking change',
            conventional: {
              type: 'feat',
              description: 'breaking change',
              breaking: true
            }
          }]
        }];

        const changelog = generateChangelogMarkdown('2.0.0', new Date(), groups);
        expect(changelog).toContain('- ⚠️ BREAKING: breaking change');
      });

      it('should handle options for includeHashes and includeAuthors', () => {
        const groups = [{
          type: 'feat' as const,
          title: 'Features',
          commits: [{
            hash: 'abc123',
            shortHash: 'abc123',
            author: 'John Doe <john@example.com>',
            date: new Date(),
            message: 'feat: test',
            conventional: { type: 'feat', description: 'test', breaking: false }
          }]
        }];

        // With hashes but no authors
        const changelog1 = generateChangelogMarkdown('1.0.0', new Date(), groups, {
          includeHashes: true,
          includeAuthors: false
        });
        expect(changelog1).toContain('(abc123)');
        expect(changelog1).not.toContain('John Doe');

        // With authors but no hashes
        const changelog2 = generateChangelogMarkdown('1.0.0', new Date(), groups, {
          includeHashes: false,
          includeAuthors: true
        });
        expect(changelog2).not.toContain('abc123');
        expect(changelog2).toContain('- John Doe');

        // With neither
        const changelog3 = generateChangelogMarkdown('1.0.0', new Date(), groups, {
          includeHashes: false,
          includeAuthors: false
        });
        expect(changelog3).not.toContain('abc123');
        expect(changelog3).not.toContain('John Doe');
      });

      it('should handle empty groups', () => {
        const changelog = generateChangelogMarkdown('1.0.0', new Date(), []);
        expect(changelog).toContain('## [1.0.0]');
        expect(changelog.split('\n')).toHaveLength(3); // Header + empty lines
      });

      it('should handle groups with no commits', () => {
        const groups = [{
          type: 'feat' as const,
          title: 'Features',
          commits: []
        }];

        const changelog = generateChangelogMarkdown('1.0.0', new Date(), groups);
        expect(changelog).not.toContain('### ✨ Features');
      });
    });
  });
});